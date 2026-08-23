"""Structured FFmpeg media validation and deterministic visual review."""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from typing import Iterable, Mapping, Sequence

import numpy as np
from PIL import Image

from .config import CompositionSpec, RenderManifest


ALPHA_COVERAGE_THRESHOLD = 0.999
# VP9 can leave tiny nonzero alpha values outside the visible matte. Coverage
# therefore means pixels within two percent of opaque, not merely nonzero.
ALPHA_COVERAGE_MINIMUM = 250
# A transition is not safe while even its weakest decoded pixel is mostly
# transparent. This rejects codec-noise "coverage" before the portal closes.
ALPHA_COVERAGE_FLOOR = 128
LOOP_SSIM_THRESHOLD = 0.995
LOOP_SEAM_RATIO = 1.5
LOOP_NUMERICAL_EPSILON = 1e-12
PIXEL_NUMERICAL_EPSILON = 1e-7
EXPECTED_H264_GOP_FRAMES = 60
# The H.264 I/P boundary allowance is capped at one mean code value.  This is
# enough for the measured quantization reset in the holding loops, while a
# larger real discontinuity must still fail.  Localized checks never receive a
# codec-boundary mask.
CODEC_RESIDUAL_MEAN_LIMIT = 1.0 / 255.0
# A step is codec-static only when both its global and per-pixel residuals are
# bounded. The static seam fallback is then separately bounded the same way.
CODEC_STATIC_MEAN_LIMIT = 1e-6
CODEC_STATIC_MAX_DELTA = 4.0 / 255.0
CODEC_STATIC_CHANGED_FRACTION = 0.001
STATIC_SEAM_MEAN_LIMIT = 1e-5
STATIC_SEAM_MAX_DELTA = 4.0 / 255.0
STATIC_SEAM_CHANGED_FRACTION = 0.001
ONE_CODE_VALUE = 1.0 / 255.0
# At least 0.01% of pixels exceeding their neighboring motion by 32 code
# values is a visible localized discontinuity, even when its global mean is low.
LOCALIZED_EXCESS_DELTA = 32.0 / 255.0
LOCALIZED_EXCESS_FRACTION = 0.0001
# A moderate defect can hide below both the mean codec allowance and the
# high-delta pixel gate.  A 16x9-sized sliding window catches that concentrated
# energy at every pixel offset while tolerating the diffuse I/P quantization
# residual in valid loops.
LOCALIZED_TILE_COLUMNS = 16
LOCALIZED_TILE_ROWS = 9
LOCALIZED_TILE_MEAN_DELTA = 8.0 / 255.0
DARK_NAVY = (4, 11, 27)
LIGHT_GRAY = (214, 220, 228)
CONTACT_TILE_SIZE = (384, 216)
REVIEW_SIZES = ((1280, 720), (854, 480))


@dataclass(frozen=True)
class Finding:
    code: str
    message: str
    expected: object = None
    actual: object = None
    frame: int | None = None

    def to_dict(self) -> dict:
        result = {"code": self.code, "message": self.message}
        if self.expected is not None:
            result["expected"] = self.expected
        if self.actual is not None:
            result["actual"] = self.actual
        if self.frame is not None:
            result["frame"] = self.frame
        return result


@dataclass(frozen=True)
class ValidationResult:
    asset_id: str
    path: str
    findings: tuple[Finding, ...] = ()
    metrics: Mapping[str, object] = field(default_factory=dict)
    review: Mapping[str, object] = field(default_factory=dict)
    filename: str | None = None
    sha256: str | None = None

    @property
    def ok(self) -> bool:
        return not self.findings

    def to_dict(self) -> dict:
        result = {
            "id": self.asset_id,
            "path": self.path,
            "ok": self.ok,
            "findings": [finding.to_dict() for finding in self.findings],
            "metrics": _json_value(self.metrics),
        }
        if self.review:
            result["review"] = _json_value(self.review)
        if self.filename is not None:
            result["filename"] = self.filename
        if self.sha256 is not None:
            result["sha256"] = self.sha256
        return result


@dataclass(frozen=True)
class ValidationReport:
    output_directory: str
    results: tuple[ValidationResult, ...]
    schema_version: int = 2

    @property
    def ok(self) -> bool:
        return all(result.ok for result in self.results)

    def to_dict(self) -> dict:
        return {
            "schemaVersion": self.schema_version,
            "ok": self.ok,
            "outputDirectory": self.output_directory,
            "assets": [result.to_dict() for result in self.results],
        }


def probe_media(path: Path) -> dict:
    """Return ffprobe's typed JSON document, counting decoded video frames."""
    path = Path(path)
    completed = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-count_frames",
            "-show_streams",
            "-show_format",
            "-show_frames",
            "-of",
            "json",
            str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip() or f"ffprobe exited {completed.returncode}"
        raise RuntimeError(f"could not probe {path}: {detail}")
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"ffprobe returned invalid JSON for {path}: {error}") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("streams"), list):
        raise RuntimeError(f"ffprobe returned no stream list for {path}")
    return payload


def decode_frame(path: Path, frame: int, mode: str = "RGB") -> Image.Image:
    """Decode one zero-based frame; WebM always uses libvpx-vp9 explicitly."""
    if frame < 0:
        raise ValueError("frame must be nonnegative")
    probe = probe_media(path)
    video = _single_video_stream(probe)
    size = (int(video["width"]), int(video["height"]))
    return _decode_selected(path, (frame,), mode, size)[0]


def validate_stream(
    path: Path,
    spec: CompositionSpec,
    probe: Mapping[str, object] | None = None,
) -> ValidationResult:
    """Validate exact stream/container gates without using pixel format as alpha proof."""
    path = Path(path)
    findings = []
    if not path.is_file():
        return ValidationResult(
            spec.id,
            str(path),
            (Finding("missing_media", "expected media file is missing", True, False),),
        )
    try:
        probe = probe_media(path) if probe is None else probe
    except (OSError, RuntimeError) as error:
        return ValidationResult(
            spec.id,
            str(path),
            (Finding("probe_error", "media could not be probed", "valid media", str(error)),),
        )

    streams = probe.get("streams", [])
    videos = [stream for stream in streams if stream.get("codec_type") == "video"]
    audios = [stream for stream in streams if stream.get("codec_type") == "audio"]
    if len(videos) != 1:
        findings.append(
            Finding(
                "video_stream_count",
                "media must contain exactly one video stream",
                1,
                len(videos),
            )
        )
    if audios:
        findings.append(
            Finding(
                "audio_stream_present",
                "media must not contain an audio stream",
                0,
                len(audios),
            )
        )
    metrics = {"videoStreamCount": len(videos), "audioStreamCount": len(audios)}
    if len(videos) != 1:
        return ValidationResult(spec.id, str(path), tuple(findings), metrics)

    video = videos[0]
    _expect(findings, "wrong_width", "video width is wrong", spec.width, video.get("width"))
    _expect(findings, "wrong_height", "video height is wrong", spec.height, video.get("height"))

    expected_rate = Fraction(spec.fps, 1)
    rate_fields = {
        "r_frame_rate": video.get("r_frame_rate"),
        "avg_frame_rate": video.get("avg_frame_rate"),
    }
    rates_ok = all(_fraction(value) == expected_rate for value in rate_fields.values())
    if not rates_ok:
        findings.append(
            Finding(
                "wrong_frame_rate",
                "video must be constant at the manifest frame rate",
                f"{spec.fps}/1",
                rate_fields,
            )
        )

    actual_frames = _integer(video.get("nb_read_frames"))
    if actual_frames is None:
        actual_frames = _integer(video.get("nb_frames"))
    _expect(
        findings,
        "wrong_frame_count",
        "decoded frame count is wrong",
        spec.frames,
        actual_frames,
    )

    timing_findings, timing_metrics = _validate_frame_timing(
        probe, video, spec.fps, spec.frames
    )
    findings.extend(timing_findings)

    codec = video.get("codec_name")
    pixel_format = video.get("pix_fmt")
    if spec.profile == "h264":
        _expect(findings, "wrong_codec", "opaque media must use H.264", "h264", codec)
        _expect(
            findings,
            "wrong_pixel_format",
            "H.264 media must use yuv420p",
            "yuv420p",
            pixel_format,
        )
        for key in ("color_space", "color_primaries", "color_transfer"):
            _expect(
                findings,
                f"wrong_{key}",
                f"H.264 {key} must be BT.709",
                "bt709",
                video.get(key),
            )
    elif spec.profile == "vp9-alpha":
        _expect(findings, "wrong_codec", "transparent media must use VP9", "vp9", codec)
        tags = {str(key).upper(): value for key, value in video.get("tags", {}).items()}
        if str(tags.get("ALPHA_MODE")) != "1":
            findings.append(
                Finding(
                    "missing_alpha_mode",
                    "VP9 stream must declare ALPHA_MODE=1",
                    "1",
                    tags.get("ALPHA_MODE"),
                )
            )
    else:
        findings.append(
            Finding("unknown_profile", "manifest media profile is unsupported", None, spec.profile)
        )

    metrics.update(
        {
            "codec": codec,
            "pixelFormat": pixel_format,
            "width": video.get("width"),
            "height": video.get("height"),
            "rFrameRate": video.get("r_frame_rate"),
            "avgFrameRate": video.get("avg_frame_rate"),
            "decodedFrames": actual_frames,
            "frameTiming": timing_metrics,
            "colorSpace": video.get("color_space"),
            "colorPrimaries": video.get("color_primaries"),
            "colorTransfer": video.get("color_transfer"),
        }
    )
    return ValidationResult(spec.id, str(path), tuple(findings), metrics)


def validate_alpha(
    path: Path,
    spec: CompositionSpec,
    normal_frames: Sequence[int] | None = None,
    stinger_frames: Sequence[int] = (),
    threshold: float = ALPHA_COVERAGE_THRESHOLD,
) -> ValidationResult:
    """Validate decoded VP9 alpha variation, range, and optional stinger coverage."""
    path = Path(path)
    normal_frames = tuple(normal_frames or _normal_alpha_frames(spec.frames))
    indices = tuple(dict.fromkeys((*normal_frames, *stinger_frames)))
    findings = []
    metrics = {"decoder": "libvpx-vp9", "normalFrames": list(normal_frames)}
    try:
        decoded = _decode_selected(path, indices, "RGBA", (spec.width, spec.height))
    except (OSError, RuntimeError, ValueError) as error:
        return ValidationResult(
            spec.id,
            str(path),
            (Finding("alpha_decode_error", "VP9 alpha could not be decoded", None, str(error)),),
            metrics,
        )
    by_index = dict(zip(indices, decoded))
    alpha_planes = []
    frame_metrics = {}
    for frame in normal_frames:
        alpha = np.asarray(by_index[frame].getchannel("A"))
        alpha_planes.append(alpha)
        minimum = int(alpha.min())
        maximum = int(alpha.max())
        coverage = float(np.count_nonzero(alpha) / alpha.size)
        frame_metrics[str(frame)] = {
            "min": minimum,
            "max": maximum,
            "coverage": coverage,
        }
        if minimum == 255:
            findings.append(
                Finding(
                    "fully_opaque_alpha",
                    "normal alpha frame is fully opaque",
                    "transparent and visible pixels",
                    {"min": minimum, "max": maximum},
                    frame,
                )
            )
        elif maximum == 0:
            findings.append(
                Finding(
                    "missing_visible_alpha",
                    "normal alpha frame has no visible pixels",
                    "transparent and visible pixels",
                    {"min": minimum, "max": maximum},
                    frame,
                )
            )
        elif minimum > 0:
            findings.append(
                Finding(
                    "missing_transparent_alpha",
                    "normal alpha frame has no fully transparent pixels",
                    0,
                    minimum,
                    frame,
                )
            )

    if len(alpha_planes) >= 2 and all(
        np.array_equal(alpha_planes[0], plane) for plane in alpha_planes[1:]
    ):
        findings.append(
            Finding(
                "static_alpha",
                "decoded alpha is static across representative frames",
                "changing alpha",
                "identical alpha planes",
            )
        )

    coverage_metrics = {}
    floor_metrics = {}
    for frame in stinger_frames:
        alpha = np.asarray(by_index[frame].getchannel("A"))
        coverage = float(np.count_nonzero(alpha >= ALPHA_COVERAGE_MINIMUM) / alpha.size)
        floor = int(alpha.min())
        coverage_metrics[str(frame)] = coverage
        floor_metrics[str(frame)] = floor
        if coverage < threshold or floor < ALPHA_COVERAGE_FLOOR:
            findings.append(
                Finding(
                    "stinger_alpha_coverage",
                    "stinger frame does not meet full-cover alpha threshold",
                    {"coverage": threshold, "minimumAlpha": ALPHA_COVERAGE_FLOOR},
                    {"coverage": coverage, "minimumAlpha": floor},
                    frame,
                )
            )
    metrics["frames"] = frame_metrics
    if coverage_metrics:
        metrics["stingerCoverage"] = coverage_metrics
        metrics["stingerMinimumAlpha"] = floor_metrics
        metrics["coverageAlphaMinimum"] = ALPHA_COVERAGE_MINIMUM
        metrics["coverageFloorMinimum"] = ALPHA_COVERAGE_FLOOR
    return ValidationResult(spec.id, str(path), tuple(findings), metrics)


def validate_loop(
    path: Path,
    spec: CompositionSpec,
    ssim_threshold: float = LOOP_SSIM_THRESHOLD,
    seam_ratio: float = LOOP_SEAM_RATIO,
    epsilon: float = LOOP_NUMERICAL_EPSILON,
) -> ValidationResult:
    """Validate endpoint similarity and seam motion against both neighboring steps."""
    path = Path(path)
    endpoint_indices = (0, 1, spec.frames - 2, spec.frames - 1)
    codec_boundary_frame = (
        _first_internal_keyframe(path, spec.frames)
        if spec.profile == "h264"
        else None
    )
    if (
        codec_boundary_frame != EXPECTED_H264_GOP_FRAMES
        or codec_boundary_frame is None
        or codec_boundary_frame < 2
        or codec_boundary_frame + 1 >= spec.frames
    ):
        codec_boundary_frame = None
    codec_boundary_indices = (
        (
            codec_boundary_frame - 2,
            codec_boundary_frame - 1,
            codec_boundary_frame,
            codec_boundary_frame + 1,
        )
        if codec_boundary_frame is not None
        else ()
    )
    indices = tuple(dict.fromkeys((*endpoint_indices, *codec_boundary_indices)))
    mode = "RGBA" if spec.profile == "vp9-alpha" else "RGB"
    findings = []
    try:
        images = _decode_selected(path, indices, mode, (spec.width, spec.height))
    except (OSError, RuntimeError, ValueError) as error:
        return ValidationResult(
            spec.id,
            str(path),
            (Finding("loop_decode_error", "loop frames could not be decoded", None, str(error)),),
        )
    arrays = {
        index: np.asarray(image, dtype=np.float32) / 255.0
        for index, image in zip(indices, images)
    }
    first, second, penultimate, last = endpoint_indices
    endpoint_ssim = _global_ssim(arrays[last], arrays[first])
    leading_delta = _pixel_delta(arrays[first], arrays[second])
    trailing_delta = _pixel_delta(arrays[penultimate], arrays[last])
    seam_delta = _pixel_delta(arrays[last], arrays[first])
    leading_step = _frame_energy(arrays[first], arrays[second])
    trailing_step = _frame_energy(arrays[penultimate], arrays[last])
    seam_energy = _frame_energy(arrays[last], arrays[first])
    codec_boundary_energy = None
    codec_boundary_leading_energy = None
    codec_boundary_trailing_energy = None
    codec_residual_energy = 0.0
    codec_residual_allowance = 0.0
    if codec_boundary_frame is not None:
        codec_boundary_energy = _frame_energy(
            arrays[codec_boundary_frame - 1], arrays[codec_boundary_frame]
        )
        codec_boundary_leading_energy = _frame_energy(
            arrays[codec_boundary_frame - 2], arrays[codec_boundary_frame - 1]
        )
        codec_boundary_trailing_energy = _frame_energy(
            arrays[codec_boundary_frame], arrays[codec_boundary_frame + 1]
        )
        codec_residual_energy = max(
            0.0,
            codec_boundary_energy
            - max(codec_boundary_leading_energy, codec_boundary_trailing_energy),
        )
        codec_residual_allowance = min(
            codec_residual_energy, CODEC_RESIDUAL_MEAN_LIMIT
        )
    neighboring_step = max(leading_step, trailing_step)
    leading_detail = _delta_metrics(leading_delta)
    trailing_detail = _delta_metrics(trailing_delta)
    seam_detail = _delta_metrics(seam_delta)
    codec_static = (
        codec_residual_allowance <= epsilon
        and _is_codec_static(leading_step, leading_detail, epsilon)
        and _is_codec_static(trailing_step, trailing_detail, epsilon)
    )
    permitted_seam = (
        STATIC_SEAM_MEAN_LIMIT
        if codec_static
        else seam_ratio * neighboring_step + codec_residual_allowance + epsilon
    )
    neighboring_delta = np.maximum(leading_delta, trailing_delta)
    localized_excess = seam_delta - seam_ratio * neighboring_delta
    localized_tile_height = max(
        1, round(localized_excess.shape[0] / LOCALIZED_TILE_ROWS)
    )
    localized_tile_width = max(
        1, round(localized_excess.shape[1] / LOCALIZED_TILE_COLUMNS)
    )
    localized_tile_peak = _max_sliding_window_mean(
        np.maximum(localized_excess, 0.0),
        localized_tile_width,
        localized_tile_height,
    )
    visible_excess_fraction = float(
        np.count_nonzero(localized_excess > LOCALIZED_EXCESS_DELTA)
        / localized_excess.size
    )
    metrics = {
        "frames": list(endpoint_indices),
        "endpointSsim": endpoint_ssim,
        "leadingStepEnergy": leading_step,
        "trailingStepEnergy": trailing_step,
        "seamEnergy": seam_energy,
        "permittedSeamEnergy": permitted_seam,
        "numericalEpsilon": epsilon,
        "neighborClassification": "codec-static" if codec_static else "motion",
        "staticFallbackApplied": codec_static,
        "leadingStepDetail": leading_detail,
        "trailingStepDetail": trailing_detail,
        "seamDetail": seam_detail,
        "localizedExcessThreshold": LOCALIZED_EXCESS_DELTA,
        "localizedExcessFraction": visible_excess_fraction,
        "localizedExcessFractionLimit": LOCALIZED_EXCESS_FRACTION,
        "localizedTileGrid": [LOCALIZED_TILE_COLUMNS, LOCALIZED_TILE_ROWS],
        "localizedTileWindow": [localized_tile_width, localized_tile_height],
        "localizedTileSampling": "sliding-all-offsets",
        "localizedTilePeakMean": localized_tile_peak,
        "localizedTileMeanLimit": LOCALIZED_TILE_MEAN_DELTA,
    }
    if codec_boundary_frame is not None:
        metrics.update(
            {
                "codecBoundaryFrame": codec_boundary_frame,
                "codecBoundaryEnergy": codec_boundary_energy,
                "codecBoundaryLeadingEnergy": codec_boundary_leading_energy,
                "codecBoundaryTrailingEnergy": codec_boundary_trailing_energy,
                "codecResidualEnergy": codec_residual_energy,
                "codecResidualAllowance": codec_residual_allowance,
                "codecResidualMeanLimit": CODEC_RESIDUAL_MEAN_LIMIT,
            }
        )
    if endpoint_ssim < ssim_threshold:
        findings.append(
            Finding(
                "loop_endpoint_ssim",
                "loop endpoints are not sufficiently similar",
                f">={ssim_threshold}",
                endpoint_ssim,
            )
        )
    if seam_energy > permitted_seam:
        findings.append(
            Finding(
                "loop_seam_energy",
                "loop seam exceeds neighboring motion energy",
                (
                    f"codec-static mean <= {STATIC_SEAM_MEAN_LIMIT}"
                    if codec_static
                    else f"<={seam_ratio}*neighbor+{epsilon}"
                ),
                seam_energy,
            )
        )
    static_localized_failure = codec_static and (
        seam_detail["maxDelta"]
        > STATIC_SEAM_MAX_DELTA + PIXEL_NUMERICAL_EPSILON
        or seam_detail["fractionAboveOneCode"]
        > STATIC_SEAM_CHANGED_FRACTION
    )
    if (
        static_localized_failure
        or visible_excess_fraction > LOCALIZED_EXCESS_FRACTION
        or localized_tile_peak
        > LOCALIZED_TILE_MEAN_DELTA + PIXEL_NUMERICAL_EPSILON
    ):
        findings.append(
            Finding(
                "loop_localized_seam",
                "loop contains a visible localized endpoint discontinuity",
                {
                    "staticMaxDelta": STATIC_SEAM_MAX_DELTA,
                    "staticChangedFraction": STATIC_SEAM_CHANGED_FRACTION,
                    "visibleExcessFraction": LOCALIZED_EXCESS_FRACTION,
                    "tilePeakMean": LOCALIZED_TILE_MEAN_DELTA,
                },
                {
                    "maxDelta": seam_detail["maxDelta"],
                    "fractionAboveOneCode": seam_detail[
                        "fractionAboveOneCode"
                    ],
                    "visibleExcessFraction": visible_excess_fraction,
                    "tilePeakMean": localized_tile_peak,
                },
            )
        )
    return ValidationResult(spec.id, str(path), tuple(findings), metrics)


def find_stinger_cut_frame(
    path: Path,
    spec: CompositionSpec,
    threshold: float = ALPHA_COVERAGE_THRESHOLD,
) -> int | None:
    """Return the first decoded frame whose visually opaque coverage meets threshold."""
    if spec.profile != "vp9-alpha":
        raise ValueError("stinger cut detection requires a VP9 alpha stream")
    cut_frame = None
    for index, image in _iter_frames(path, "RGBA", (spec.width, spec.height)):
        alpha = np.asarray(image.getchannel("A"))
        coverage = np.count_nonzero(alpha >= ALPHA_COVERAGE_MINIMUM) / alpha.size
        if (
            cut_frame is None
            and coverage >= threshold
            and int(alpha.min()) >= ALPHA_COVERAGE_FLOOR
        ):
            cut_frame = index
    return cut_frame


def generate_visual_review(
    path: Path,
    spec: CompositionSpec,
    review_directory: Path,
) -> dict:
    """Generate deterministic five-frame sheets and two representative sizes."""
    path = Path(path)
    review_directory = Path(review_directory)
    review_directory.mkdir(parents=True, exist_ok=True)
    selected = _review_frames(spec.frames)
    mode = "RGBA" if spec.profile == "vp9-alpha" else "RGB"
    frames = _decode_selected(path, selected, mode, (spec.width, spec.height))
    outputs = []
    if spec.profile == "vp9-alpha":
        for background_name, background in (
            ("dark-navy", DARK_NAVY),
            ("light-gray", LIGHT_GRAY),
        ):
            contact = review_directory / f"{spec.id}-contact-{background_name}.png"
            composites = [_composite(frame, background) for frame in frames]
            _write_contact_sheet(composites, contact)
            outputs.append(str(contact))
        representative = _composite(frames[2], DARK_NAVY)
    else:
        contact = review_directory / f"{spec.id}-contact.png"
        _write_contact_sheet([frame.convert("RGB") for frame in frames], contact)
        outputs.append(str(contact))
        representative = frames[2].convert("RGB")

    representative_frame = selected[2]
    for width, height in REVIEW_SIZES:
        destination = review_directory / (
            f"{spec.id}-frame-{representative_frame}-{width}x{height}.png"
        )
        resized = representative.resize((width, height), Image.Resampling.LANCZOS)
        _atomic_image(resized, destination)
        outputs.append(str(destination))
    return {
        "selected_frames": list(selected),
        "contactTileSize": list(CONTACT_TILE_SIZE),
        "representativeFrame": representative_frame,
        "outputs": outputs,
    }


def validate_directory(
    manifest: RenderManifest,
    output_directory: Path,
    review_directory: Path | None = None,
) -> ValidationReport:
    """Validate every manifest media file; missing media is always a finding."""
    output_directory = Path(output_directory)
    review_directory = review_directory or output_directory / "REVISION-VISUAL"
    results = []
    for spec in manifest.compositions:
        path = output_directory / spec.filename
        digest_before = None
        initial_digest_error = None
        if path.is_file():
            try:
                digest_before = _file_sha256(path)
            except OSError as error:
                initial_digest_error = str(error)
        stream_result = validate_stream(path, spec)
        findings = list(stream_result.findings)
        if initial_digest_error is not None:
            findings.append(
                Finding(
                    "media_digest_error",
                    "initial validated media digest could not be computed",
                    "stable readable media",
                    initial_digest_error,
                )
            )
        metrics = {"stream": dict(stream_result.metrics)}
        review = {}
        if path.is_file() and not any(
            finding.code in {"probe_error", "video_stream_count", "wrong_width", "wrong_height", "wrong_frame_count"}
            for finding in findings
        ):
            if spec.profile == "vp9-alpha":
                alpha_result = validate_alpha(
                    path,
                    spec,
                    normal_frames=_normal_alpha_frames(spec.frames),
                    stinger_frames=(17, 18, 19) if spec.id == "stinger" else (),
                )
                findings.extend(alpha_result.findings)
                metrics["alpha"] = dict(alpha_result.metrics)
                if spec.id == "stinger":
                    try:
                        cut_frame = find_stinger_cut_frame(path, spec)
                    except (OSError, RuntimeError, ValueError) as error:
                        findings.append(
                            Finding("stinger_cut_decode_error", "stinger cut frame could not be determined", None, str(error))
                        )
                    else:
                        metrics["stingerCutFrame"] = cut_frame
                        if cut_frame is None or not 15 <= cut_frame <= 18:
                            findings.append(
                                Finding(
                                    "stinger_cut_frame",
                                    "first covered stinger frame must land from 15 through 18",
                                    "15-18",
                                    cut_frame,
                                )
                            )
            if spec.loop:
                loop_result = validate_loop(path, spec)
                findings.extend(loop_result.findings)
                metrics["loop"] = dict(loop_result.metrics)
            try:
                review = generate_visual_review(path, spec, review_directory)
            except (OSError, RuntimeError, ValueError) as error:
                findings.append(
                    Finding("visual_review_error", "visual review could not be generated", None, str(error))
                )
        digest_after = None
        if path.is_file():
            try:
                digest_after = _file_sha256(path)
            except OSError as error:
                findings.append(
                    Finding(
                        "media_digest_error",
                        "validated media digest could not be computed",
                        "stable readable media",
                        str(error),
                    )
                )
        if initial_digest_error is not None:
            digest_after = None
        elif digest_before is not None and digest_after != digest_before:
            findings.append(
                Finding(
                    "media_changed_during_validation",
                    "media bytes changed while validation was running",
                    digest_before,
                    digest_after,
                )
            )
            digest_after = None
        results.append(
            ValidationResult(
                spec.id,
                str(path),
                tuple(findings),
                metrics,
                review,
                spec.filename,
                digest_after,
            )
        )
    return ValidationReport(str(output_directory), tuple(results))


def write_validation_report(report, path: Path) -> None:
    """Write stable, sorted JSON without adding nondeterministic timestamps."""
    payload = report.to_dict() if hasattr(report, "to_dict") else report
    _atomic_text(
        Path(path),
        json.dumps(_json_value(payload), indent=2, sort_keys=True) + "\n",
    )


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as source_file:
        while chunk := source_file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def write_checksums(paths: Iterable[Path], output: Path) -> None:
    """Write deterministic SHA-256 lines for explicit regular files only."""
    output = Path(output)
    unique = {}
    for source in paths:
        source = Path(source)
        if not source.is_file():
            raise FileNotFoundError(source)
        if source.name in unique:
            raise ValueError(
                f"duplicate checksum basename: {source.name} "
                f"({unique[source.name]} and {source})"
            )
        unique[source.name] = source
    lines = []
    for name in sorted(unique, key=str.casefold):
        lines.append(f"{_file_sha256(unique[name])}  {name}")
    _atomic_text(output, "\n".join(lines) + ("\n" if lines else ""))


def _decode_selected(
    path: Path,
    indices: Sequence[int],
    mode: str,
    size: tuple[int, int],
) -> list[Image.Image]:
    if mode not in {"RGB", "RGBA"}:
        raise ValueError("decode mode must be RGB or RGBA")
    if not indices or any(index < 0 for index in indices):
        raise ValueError("at least one nonnegative frame index is required")
    chronological = tuple(sorted(set(indices)))
    expression = "+".join(f"eq(n\\,{index})" for index in chronological)
    command = ["ffmpeg", "-v", "error"]
    if Path(path).suffix.casefold() == ".webm":
        command.extend(["-c:v", "libvpx-vp9"])
    pixel_format = "rgba" if mode == "RGBA" else "rgb24"
    command.extend(
        [
            "-i",
            str(path),
            "-vf",
            f"select={expression}",
            "-fps_mode",
            "passthrough",
            "-frames:v",
            str(len(chronological)),
            "-an",
            "-f",
            "rawvideo",
            "-pix_fmt",
            pixel_format,
            "pipe:1",
        ]
    )
    completed = subprocess.run(command, check=False, capture_output=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.decode(errors="replace").strip())
    channels = 4 if mode == "RGBA" else 3
    frame_size = size[0] * size[1] * channels
    expected_size = frame_size * len(chronological)
    if len(completed.stdout) != expected_size:
        raise RuntimeError(
            f"decoded {len(completed.stdout)} bytes, expected {expected_size} for frames {tuple(indices)}"
        )
    decoded = [
        Image.frombytes(mode, size, completed.stdout[offset : offset + frame_size])
        for offset in range(0, expected_size, frame_size)
    ]
    by_index = dict(zip(chronological, decoded))
    return [by_index[index] for index in indices]


def _iter_frames(path: Path, mode: str, size: tuple[int, int]):
    command = ["ffmpeg", "-v", "error"]
    if Path(path).suffix.casefold() == ".webm":
        command.extend(["-c:v", "libvpx-vp9"])
    pixel_format = "rgba" if mode == "RGBA" else "rgb24"
    command.extend(
        ["-i", str(path), "-an", "-f", "rawvideo", "-pix_fmt", pixel_format, "pipe:1"]
    )
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    channels = 4 if mode == "RGBA" else 3
    frame_size = size[0] * size[1] * channels
    index = 0
    try:
        while True:
            payload = process.stdout.read(frame_size)
            if not payload:
                break
            if len(payload) != frame_size:
                raise RuntimeError(f"partial decoded frame {index}")
            yield index, Image.frombytes(mode, size, payload)
            index += 1
    finally:
        if process.stdout:
            process.stdout.close()
        stderr = process.stderr.read() if process.stderr else b""
        if process.stderr:
            process.stderr.close()
        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(stderr.decode(errors="replace").strip())


def _single_video_stream(probe: Mapping[str, object]) -> Mapping[str, object]:
    videos = [
        stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"
    ]
    if len(videos) != 1:
        raise RuntimeError(f"expected one video stream, found {len(videos)}")
    return videos[0]


def _first_internal_keyframe(path: Path, frame_count: int) -> int | None:
    """Return the first post-opening video keyframe in presentation order."""
    try:
        probe = probe_media(path)
    except (OSError, RuntimeError):
        return None
    video_frames = [
        frame
        for frame in probe.get("frames", [])
        if frame.get("media_type") in (None, "video")
    ]
    for index, frame in enumerate(video_frames):
        if 0 < index < frame_count and _integer(frame.get("key_frame")) == 1:
            return index
    return None


def _normal_alpha_frames(frame_count: int) -> tuple[int, ...]:
    if frame_count < 2:
        return (0,)
    return tuple(dict.fromkeys((0, max(1, (frame_count - 1) // 4), frame_count - 1)))


def _review_frames(frame_count: int) -> tuple[int, int, int, int, int]:
    if frame_count < 1:
        raise ValueError("media must contain at least one frame")
    maximum = frame_count - 1
    return (
        0,
        round(maximum * 0.25),
        round(maximum * 0.50),
        round(maximum * 0.75),
        maximum,
    )


def _global_ssim(left: np.ndarray, right: np.ndarray) -> float:
    left_mean = float(left.mean())
    right_mean = float(right.mean())
    left_variance = float(left.var())
    right_variance = float(right.var())
    covariance = float(((left - left_mean) * (right - right_mean)).mean())
    c1 = 0.01**2
    c2 = 0.03**2
    numerator = (2 * left_mean * right_mean + c1) * (2 * covariance + c2)
    denominator = (
        (left_mean**2 + right_mean**2 + c1)
        * (left_variance + right_variance + c2)
    )
    return float(numerator / denominator) if denominator else 1.0


def _frame_energy(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.abs(left - right).mean())


def _composite(frame: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", frame.size, (*background, 255))
    canvas.alpha_composite(frame.convert("RGBA"))
    return canvas.convert("RGB")


def _write_contact_sheet(frames: Sequence[Image.Image], destination: Path) -> None:
    if len(frames) != 5:
        raise ValueError("contact sheets require exactly five frames")
    tile_width, tile_height = CONTACT_TILE_SIZE
    sheet = Image.new("RGB", (tile_width * 5, tile_height))
    for position, frame in enumerate(frames):
        tile = frame.convert("RGB").resize(CONTACT_TILE_SIZE, Image.Resampling.LANCZOS)
        sheet.paste(tile, (position * tile_width, 0))
    _atomic_image(sheet, destination)


def _atomic_image(image: Image.Image, destination: Path) -> None:
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.stem}-", suffix=".png", dir=destination.parent
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        image.save(temporary, format="PNG")
        temporary.chmod(0o644)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def _atomic_text(destination: Path, content: str) -> None:
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}-", dir=destination.parent
    )
    temporary = Path(temporary_name)
    try:
        output_file = os.fdopen(descriptor, "w", encoding="utf-8", newline="\n")
        descriptor = -1
        with output_file:
            output_file.write(content)
        temporary.chmod(0o644)
        os.replace(temporary, destination)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        temporary.unlink(missing_ok=True)


def _validate_frame_timing(
    probe: Mapping[str, object],
    video: Mapping[str, object],
    fps: int,
    expected_frames: int,
) -> tuple[tuple[Finding, ...], dict]:
    """Compare decoded PTS/durations to the ideal CFR schedule in stream ticks."""
    time_base = _fraction(video.get("time_base"))
    stream_index = _integer(video.get("index"))
    frames = [
        frame
        for frame in probe.get("frames", [])
        if frame.get("media_type") == "video"
        and (stream_index is None or _integer(frame.get("stream_index")) == stream_index)
    ]
    metrics = {
        "timeBase": video.get("time_base"),
        "decodedTimingFrames": len(frames),
        "expectedTimingFrames": expected_frames,
    }
    if time_base is None or time_base <= 0 or not frames:
        return (
            (
                Finding(
                    "frame_timing_unavailable",
                    "decoded frame timestamps and durations are required",
                    "positive time_base and decoded video frames",
                    {
                        "timeBase": video.get("time_base"),
                        "timingFrames": len(frames),
                    },
                ),
            ),
            metrics,
        )

    tolerance = time_base / 2
    ideal_duration = Fraction(1, fps)
    timestamps = [_frame_integer(frame, "best_effort_timestamp", "pts") for frame in frames]
    durations = [_frame_integer(frame, "duration", "pkt_duration") for frame in frames]
    if any(value is None for value in timestamps) or any(value is None for value in durations):
        return (
            (
                Finding(
                    "frame_timing_unavailable",
                    "every decoded video frame needs an integer timestamp and duration",
                    len(frames),
                    {
                        "timestamps": sum(value is not None for value in timestamps),
                        "durations": sum(value is not None for value in durations),
                    },
                ),
            ),
            metrics,
        )

    first_timestamp = timestamps[0]
    schedule_errors = []
    duration_errors = []
    failures = []
    for index, (timestamp, duration) in enumerate(zip(timestamps, durations)):
        schedule_error = abs(
            (timestamp - first_timestamp) * time_base - Fraction(index, fps)
        )
        duration_error = abs(duration * time_base - ideal_duration)
        schedule_errors.append(schedule_error)
        duration_errors.append(duration_error)
        if schedule_error > tolerance or duration_error > tolerance:
            failures.append(
                {
                    "frame": index,
                    "timestamp": timestamp,
                    "duration": duration,
                    "scheduleErrorSeconds": float(schedule_error),
                    "durationErrorSeconds": float(duration_error),
                }
            )

    max_schedule_error = max(schedule_errors, default=Fraction(0))
    max_duration_error = max(duration_errors, default=Fraction(0))
    metrics.update(
        {
            "toleranceSeconds": float(tolerance),
            "maxScheduleErrorSeconds": float(max_schedule_error),
            "maxDurationErrorSeconds": float(max_duration_error),
            "uniform": not failures,
        }
    )
    if failures:
        return (
            (
                Finding(
                    "non_cfr_timing",
                    "decoded frame timing does not follow the constant-rate schedule",
                    {
                        "schedule": f"timestamp[0] + frame/{fps}",
                        "duration": f"1/{fps}",
                        "toleranceSeconds": float(tolerance),
                    },
                    {"failures": failures[:8], "failureCount": len(failures)},
                ),
            ),
            metrics,
        )
    return (), metrics


def _frame_integer(frame: Mapping[str, object], *keys: str) -> int | None:
    for key in keys:
        value = _integer(frame.get(key))
        if value is not None:
            return value
    return None


def _pixel_delta(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.max(np.abs(left - right), axis=2)


def _max_sliding_window_mean(
    delta: np.ndarray, window_width: int, window_height: int
) -> float:
    """Return the peak box mean across every valid pixel-aligned window."""
    height, width = delta.shape
    window_width = min(max(1, window_width), width)
    window_height = min(max(1, window_height), height)
    integral = np.pad(delta, ((1, 0), (1, 0))).cumsum(axis=0).cumsum(axis=1)
    window_sums = (
        integral[window_height:, window_width:]
        - integral[:-window_height, window_width:]
        - integral[window_height:, :-window_width]
        + integral[:-window_height, :-window_width]
    )
    return float(window_sums.max() / (window_width * window_height))


def _delta_metrics(delta: np.ndarray) -> dict:
    return {
        "meanDelta": float(delta.mean()),
        "maxDelta": float(delta.max()),
        "fractionAboveOneCode": float(
            np.count_nonzero(delta > ONE_CODE_VALUE + PIXEL_NUMERICAL_EPSILON)
            / delta.size
        ),
    }


def _is_codec_static(energy: float, detail: Mapping[str, float], epsilon: float) -> bool:
    return (
        energy <= CODEC_STATIC_MEAN_LIMIT + epsilon
        and detail["maxDelta"]
        <= CODEC_STATIC_MAX_DELTA + PIXEL_NUMERICAL_EPSILON
        and detail["fractionAboveOneCode"] <= CODEC_STATIC_CHANGED_FRACTION
    )


def _expect(findings, code, message, expected, actual) -> None:
    if actual != expected:
        findings.append(Finding(code, message, expected, actual))


def _fraction(value) -> Fraction | None:
    try:
        fraction = Fraction(value)
    except (ValueError, ZeroDivisionError, TypeError):
        return None
    return fraction


def _integer(value) -> int | None:
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _json_value(value):
    if isinstance(value, Mapping):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, np.generic):
        return value.item()
    return value
