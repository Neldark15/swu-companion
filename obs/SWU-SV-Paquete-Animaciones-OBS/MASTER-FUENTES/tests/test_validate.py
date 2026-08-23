import hashlib
from io import StringIO
import json
import math
import shutil
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.config import CompositionSpec, RenderManifest
from swu_obs_anim.encode import encode_frames
from swu_obs_anim.validate import (
    LOOP_SEAM_RATIO,
    decode_frame,
    find_stinger_cut_frame,
    generate_visual_review,
    probe_media,
    validate_alpha,
    validate_directory,
    validate_loop,
    validate_stream,
    write_checksums,
    write_validation_report,
)


SIZE = (64, 36)


def _spec(
    composition_id="fixture",
    filename="fixture.mp4",
    frames=6,
    profile="h264",
    loop=False,
):
    return CompositionSpec(
        composition_id,
        filename,
        SIZE[0],
        SIZE[1],
        30,
        frames,
        profile,
        loop,
    )


def _opaque_frame(index, frames):
    value = round(30 + 90 * np.sin(np.pi * index / max(1, frames - 1)) ** 2)
    return Image.new("RGB", SIZE, (value, 50, 100))


def _alpha_frame(index, frames):
    pixels = np.zeros((SIZE[1], SIZE[0], 4), dtype=np.uint8)
    x0 = 5 + index
    pixels[5:31, x0 : x0 + 22, :3] = (40, 180, 240)
    pixels[5:31, x0 : x0 + 22, 3] = 255
    return Image.fromarray(pixels, "RGBA")


def _encode(spec, path, renderer):
    encode_frames(spec, renderer, path)
    return path


def _encode_audio_fixture(path):
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"color=c=navy:s={SIZE[0]}x{SIZE[1]}:r=30:d=0.2",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000:duration=0.2",
            "-frames:v",
            "6",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-colorspace",
            "bt709",
            "-c:a",
            "aac",
            "-shortest",
            str(path),
        ],
        check=True,
    )


def _encode_vfr_fixture(path):
    timestamps = (
        "if(eq(N,0),0,if(eq(N,1),20,if(eq(N,2),67,"
        "if(eq(N,3),100,if(eq(N,4),150,167)))))"
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"testsrc2=size={SIZE[0]}x{SIZE[1]}:rate=30:duration=0.2",
            "-vf",
            f"settb=1/1000,setpts='{timestamps}'",
            "-fps_mode",
            "passthrough",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-colorspace",
            "bt709",
            "-x264-params",
            "colorprim=bt709:transfer=bt709:colormatrix=bt709",
            str(path),
        ],
        check=True,
    )


class ValidationTests(unittest.TestCase):
    def test_stream_accepts_good_h264_and_names_contract_mismatches(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "good.mp4"
            spec = _spec(filename=path.name)
            _encode(spec, path, lambda index: _opaque_frame(index, spec.frames))

            probe = probe_media(path)
            self.assertEqual(validate_stream(path, spec, probe).findings, ())
            bad_spec = replace(spec, width=65, height=37, fps=29, frames=7)
            codes = {item.code for item in validate_stream(path, bad_spec, probe).findings}

        self.assertTrue({"wrong_width", "wrong_height", "wrong_frame_rate", "wrong_frame_count"} <= codes)

    def test_stream_rejects_nonuniform_decoded_timing_despite_30_fps_summaries(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "nominal-30-vfr.mp4"
            spec = _spec(filename=path.name)
            _encode_vfr_fixture(path)
            probe = probe_media(path)
            video = next(
                stream
                for stream in probe["streams"]
                if stream["codec_type"] == "video"
            )
            result = validate_stream(path, spec, probe)

        self.assertEqual(video["r_frame_rate"], "30/1")
        self.assertEqual(video["avg_frame_rate"], "30/1")
        self.assertEqual(video["nb_read_frames"], "6")
        self.assertIn("non_cfr_timing", {item.code for item in result.findings})

    def test_stream_rejects_audio_and_missing_vp9_alpha_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            audio_path = directory / "audio.mp4"
            _encode_audio_fixture(audio_path)
            audio_result = validate_stream(audio_path, _spec(filename=audio_path.name))

            alpha_path = directory / "alpha.webm"
            alpha_spec = _spec(filename=alpha_path.name, profile="vp9-alpha")
            _encode(alpha_spec, alpha_path, lambda index: _alpha_frame(index, alpha_spec.frames))
            probe = probe_media(alpha_path)
            stripped = json.loads(json.dumps(probe))
            stripped["streams"][0]["tags"] = {}
            alpha_result = validate_stream(alpha_path, alpha_spec, stripped)

        self.assertIn("audio_stream_present", {item.code for item in audio_result.findings})
        self.assertIn("missing_alpha_mode", {item.code for item in alpha_result.findings})

    def test_stream_names_wrong_codec_pixel_format_and_color_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "good.mp4"
            spec = _spec(filename=path.name)
            _encode(spec, path, lambda index: _opaque_frame(index, spec.frames))
            altered = json.loads(json.dumps(probe_media(path)))
            video = altered["streams"][0]
            video.update(
                {
                    "codec_name": "mpeg4",
                    "pix_fmt": "yuv444p",
                    "color_space": "bt470bg",
                    "color_primaries": "bt470bg",
                    "color_transfer": "smpte170m",
                }
            )
            result = validate_stream(path, spec, altered)
            duplicate_video = json.loads(json.dumps(probe_media(path)))
            duplicate_video["streams"].append(
                json.loads(json.dumps(duplicate_video["streams"][0]))
            )
            duplicate_result = validate_stream(path, spec, duplicate_video)

        self.assertTrue(
            {
                "wrong_codec",
                "wrong_pixel_format",
                "wrong_color_space",
                "wrong_color_primaries",
                "wrong_color_transfer",
            }
            <= {item.code for item in result.findings}
        )
        self.assertIn(
            "video_stream_count", {item.code for item in duplicate_result.findings}
        )

    def test_alpha_is_decoded_by_libvpx_and_rejects_static_or_fully_opaque_planes(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            good_path = directory / "good-alpha.webm"
            spec = _spec(filename=good_path.name, profile="vp9-alpha")
            _encode(spec, good_path, lambda index: _alpha_frame(index, spec.frames))
            good = validate_alpha(good_path, spec, normal_frames=(0, 2, 5))
            decoded = np.asarray(decode_frame(good_path, 2, mode="RGBA"))

            static_path = directory / "static-alpha.webm"
            _encode(spec, static_path, lambda _index: _alpha_frame(0, spec.frames))
            static = validate_alpha(static_path, spec, normal_frames=(0, 2, 5))

            opaque_path = directory / "opaque-alpha.webm"
            _encode(spec, opaque_path, lambda _index: Image.new("RGBA", SIZE, (20, 30, 40, 255)))
            opaque = validate_alpha(opaque_path, spec, normal_frames=(0, 2, 5))

        self.assertEqual(good.findings, ())
        self.assertEqual((int(decoded[:, :, 3].min()), int(decoded[:, :, 3].max())), (0, 255))
        self.assertIn("static_alpha", {item.code for item in static.findings})
        self.assertIn("fully_opaque_alpha", {item.code for item in opaque.findings})

    def test_stinger_requires_frames_17_to_19_and_finds_first_covered_frame(self):
        frames = 22
        spec = _spec("stinger", "stinger.webm", frames, "vp9-alpha")

        def render(index):
            if 16 <= index <= 19:
                return Image.new("RGBA", SIZE, (4, 11, 27, 255))
            return _alpha_frame(index % 5, frames)

        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            path = directory / spec.filename
            _encode(spec, path, render)
            result = validate_alpha(
                path,
                spec,
                normal_frames=(0, 5, 21),
                stinger_frames=(17, 18, 19),
            )
            cut = find_stinger_cut_frame(path, spec, threshold=0.999)

            bad_path = directory / "bad-stinger.webm"

            def bad_render(index):
                if index in (17, 19):
                    return Image.new("RGBA", SIZE, (4, 11, 27, 255))
                return _alpha_frame(index % 5, frames)

            _encode(spec, bad_path, bad_render)
            bad = validate_alpha(
                bad_path,
                spec,
                normal_frames=(0, 5, 21),
                stinger_frames=(17, 18, 19),
            )

        self.assertEqual(result.findings, ())
        self.assertEqual(cut, 16)
        bad_coverage = [
            item
            for item in bad.findings
            if item.code == "stinger_alpha_coverage"
        ]
        self.assertEqual([item.frame for item in bad_coverage], [18])

    def test_stinger_cut_ignores_full_frame_low_alpha_noise_fixture(self):
        frames = 22
        spec = _spec("stinger", "noisy-stinger.webm", frames, "vp9-alpha")

        def render(index):
            pixels = np.zeros((SIZE[1], SIZE[0], 4), dtype=np.uint8)
            pixels[:, :, :3] = (4, 11, 27)
            pixels[:, :, 3] = 1
            pixels[8:28, 16:48, 3] = 255
            if 15 <= index <= 19:
                pixels[:, :, 3] = 255
            return Image.fromarray(pixels, "RGBA")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            decoded_noise = np.asarray(decode_frame(path, 0, "RGBA"))[:, :, 3]
            cut = find_stinger_cut_frame(path, spec, threshold=0.999)

        self.assertGreater(np.count_nonzero(decoded_noise) / decoded_noise.size, 0.999)
        self.assertLess(int(decoded_noise.min()), 128)
        self.assertEqual(cut, 15)

    def test_loop_rejects_discontinuous_endpoints_and_accepts_continuous_motion(self):
        spec = _spec(filename="loop.mp4", frames=4, loop=True)
        good_colors = (20, 90, 90, 20)
        bad_colors = (20, 22, 24, 210)
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            good_path = directory / "good.mp4"
            _encode(spec, good_path, lambda index: Image.new("RGB", SIZE, (good_colors[index], 40, 80)))
            good = validate_loop(good_path, spec)
            bad_path = directory / "bad.mp4"
            _encode(spec, bad_path, lambda index: Image.new("RGB", SIZE, (bad_colors[index], 40, 80)))
            bad = validate_loop(bad_path, spec)
            static_path = directory / "static.mp4"
            _encode(spec, static_path, lambda _index: Image.new("RGB", SIZE, (20, 40, 80)))
            static = validate_loop(static_path, spec)

        self.assertEqual(good.findings, ())
        self.assertEqual(static.findings, ())
        self.assertTrue(
            {"loop_endpoint_ssim", "loop_seam_energy"}
            & {item.code for item in bad.findings}
        )

    def test_loop_accepts_h264_endpoint_matching_its_internal_gop_boundary(self):
        spec = _spec(
            composition_id="starting",
            filename="holding-loop.mp4",
            frames=120,
            loop=True,
        )
        pixels = np.empty((SIZE[1], SIZE[0], 3), dtype=np.uint8)
        for y in range(SIZE[1]):
            for x in range(SIZE[0]):
                pixels[y, x] = (
                    20 + x,
                    30 + y,
                    50 + (x + y) // 2,
                )
        background = Image.fromarray(pixels, "RGB")

        def render(index):
            phase = 0.0 if index == spec.frames - 1 else index / (spec.frames - 1)
            image = background.copy()
            x = 4 + round(3 * math.sin(math.tau * phase))
            ImageDraw.Draw(image).ellipse((x, 10, x + 5, 15), fill=(240, 250, 255))
            return image

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            result = validate_loop(path, spec)

        self.assertEqual(result.findings, ())
        self.assertEqual(result.metrics["codecBoundaryFrame"], 60)
        self.assertLessEqual(
            result.metrics["seamEnergy"],
            result.metrics["permittedSeamEnergy"],
        )

    def test_loop_rejects_localized_endpoint_defect_despite_internal_gop_motion(self):
        spec = _spec(
            composition_id="starting",
            filename="holding-loop-with-defect.mp4",
            frames=120,
            loop=True,
        )
        pixels = np.empty((SIZE[1], SIZE[0], 3), dtype=np.uint8)
        for y in range(SIZE[1]):
            for x in range(SIZE[0]):
                pixels[y, x] = (
                    (x * 17 + y * 11) % 256,
                    (x * 5 + y * 23) % 256,
                    (x * 31 + y * 7) % 256,
                )

        def render(index):
            frame = pixels.copy()
            # Deliberate real motion exactly at the first GOP boundary. It must
            # never become a per-pixel mask for an unrelated loop defect.
            if index == 60:
                frame[11:24, 24:43] = (245, 20, 210)
            if index >= 110:
                frame[16:17, 32:33] = (255, 255, 255)
            return Image.fromarray(frame, "RGB")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            result = validate_loop(path, spec)

        self.assertGreaterEqual(result.metrics["endpointSsim"], 0.995)
        self.assertEqual(result.metrics["codecBoundaryFrame"], 60)
        self.assertIn("loop_localized_seam", {item.code for item in result.findings})

    def test_loop_rejects_global_endpoint_defect_despite_internal_gop_motion(self):
        spec = _spec(
            composition_id="break",
            filename="holding-loop-with-global-defect.mp4",
            frames=120,
            loop=True,
        )
        yy, xx = np.indices((SIZE[1], SIZE[0]))
        pixels = np.stack(
            (20 + xx, 30 + yy, 50 + (xx + yy) // 2), axis=2
        ).astype(np.uint8)

        def render(index):
            frame = pixels.copy()
            if index == 60:
                frame[:, :] = (230, 25, 200)
            if index >= 110:
                frame = np.clip(frame.astype(np.int16) + 4, 0, 255).astype(np.uint8)
            return Image.fromarray(frame, "RGB")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            result = validate_loop(path, spec)

        self.assertGreaterEqual(result.metrics["endpointSsim"], 0.995)
        self.assertEqual(result.metrics["codecBoundaryFrame"], 60)
        self.assertLessEqual(
            result.metrics["codecResidualAllowance"], 1.0 / 255.0
        )
        self.assertIn("loop_seam_energy", {item.code for item in result.findings})

    def test_loop_rejects_moderate_patch_hidden_below_mean_codec_allowance(self):
        spec = _spec(
            composition_id="starting",
            filename="holding-loop-with-moderate-patch.mp4",
            frames=120,
            loop=True,
        )
        yy, xx = np.indices((SIZE[1], SIZE[0]))
        pixels = np.stack(
            (20 + xx, 30 + yy, 50 + (xx + yy) // 2), axis=2
        ).astype(np.uint8)
        background = Image.fromarray(pixels, "RGB")

        def render(index):
            phase = 0.0 if index == spec.frames - 1 else index / (spec.frames - 1)
            image = background.copy()
            x = 4 + round(3 * math.sin(math.tau * phase))
            ImageDraw.Draw(image).ellipse((x, 10, x + 5, 15), fill=(240, 250, 255))
            frame = np.asarray(image).copy()
            if index >= 110:
                patch = frame[12:16, 24:28].astype(np.int16) + 12
                frame[12:16, 24:28] = np.clip(patch, 0, 255).astype(np.uint8)
            return Image.fromarray(frame, "RGB")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            result = validate_loop(path, spec)

        self.assertGreaterEqual(result.metrics["endpointSsim"], 0.995)
        self.assertLess(
            result.metrics["seamEnergy"], result.metrics["permittedSeamEnergy"]
        )
        self.assertLess(
            result.metrics["seamDetail"]["maxDelta"], 32.0 / 255.0
        )
        self.assertIn("loop_localized_seam", {item.code for item in result.findings})

    def test_loop_rejects_moderate_patch_crossing_spatial_grid_boundaries(self):
        spec = _spec(
            composition_id="starting",
            filename="holding-loop-with-boundary-patch.mp4",
            frames=120,
            loop=True,
        )
        yy, xx = np.indices((SIZE[1], SIZE[0]))
        pixels = np.stack(
            (20 + xx, 30 + yy, 50 + (xx + yy) // 2), axis=2
        ).astype(np.uint8)
        background = Image.fromarray(pixels, "RGB")

        def render(index):
            phase = 0.0 if index == spec.frames - 1 else index / (spec.frames - 1)
            image = background.copy()
            x = 4 + round(3 * math.sin(math.tau * phase))
            ImageDraw.Draw(image).ellipse((x, 10, x + 5, 15), fill=(240, 250, 255))
            frame = np.asarray(image).copy()
            if index >= 110:
                # The 16x9 grid produces 4x4 cells for this 64x36 fixture.
                # This equally visible 4x4 defect is shifted two pixels across
                # both a row and column boundary, splitting it four ways in a
                # single fixed partition.
                patch = frame[14:18, 26:30].astype(np.int16) + 12
                frame[14:18, 26:30] = np.clip(patch, 0, 255).astype(np.uint8)
            return Image.fromarray(frame, "RGB")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            result = validate_loop(path, spec)

        self.assertGreaterEqual(result.metrics["endpointSsim"], 0.995)
        self.assertLess(
            result.metrics["seamEnergy"], result.metrics["permittedSeamEnergy"]
        )
        self.assertLess(
            result.metrics["seamDetail"]["maxDelta"], 32.0 / 255.0
        )
        self.assertIn("loop_localized_seam", {item.code for item in result.findings})

    def test_loop_rejects_a_localized_seam_between_codec_static_neighbors(self):
        spec = _spec(filename="localized.mp4", frames=4, loop=True)

        def render(index):
            pixels = np.zeros((SIZE[1], SIZE[0], 3), dtype=np.uint8)
            pixels[:, :] = (20, 40, 80)
            if index >= 2:
                pixels[18:21, 32:35, 0] = 100
            return Image.fromarray(pixels, "RGB")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / spec.filename
            _encode(spec, path, render)
            result = validate_loop(path, spec)

        self.assertGreaterEqual(result.metrics["endpointSsim"], 0.995)
        self.assertLess(result.metrics["seamEnergy"], 1 / 255)
        self.assertIn("loop_localized_seam", {item.code for item in result.findings})

    def test_reports_checksums_and_review_outputs_are_deterministic(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            opaque = directory / "opaque.mp4"
            opaque_spec = _spec("opaque", opaque.name)
            _encode(opaque_spec, opaque, lambda index: _opaque_frame(index, opaque_spec.frames))
            alpha = directory / "alpha.webm"
            alpha_spec = _spec("alpha", alpha.name, profile="vp9-alpha")
            _encode(alpha_spec, alpha, lambda index: _alpha_frame(index, alpha_spec.frames))

            review = directory / "REVISION-VISUAL"
            opaque_outputs = generate_visual_review(opaque, opaque_spec, review)
            alpha_outputs = generate_visual_review(alpha, alpha_spec, review)
            report_path = directory / "validation-report.json"
            payload = {"ok": True, "review": [opaque_outputs, alpha_outputs]}
            write_validation_report(payload, report_path)
            checksums = directory / "SHA256SUMS.txt"
            write_checksums((opaque, alpha, report_path), checksums)

            report = json.loads(report_path.read_text(encoding="utf-8"))
            checksum_lines = checksums.read_text(encoding="utf-8").splitlines()
            images = {}
            for image_path in review.iterdir():
                with Image.open(image_path) as image:
                    images[image_path.name] = image.size

        self.assertEqual(report, payload)
        self.assertEqual(len(checksum_lines), 3)
        self.assertTrue(all(len(line.split()[0]) == hashlib.sha256().digest_size * 2 for line in checksum_lines))
        self.assertEqual(images["opaque-contact.png"], (1920, 216))
        self.assertEqual(images["alpha-contact-dark-navy.png"], (1920, 216))
        self.assertEqual(images["alpha-contact-light-gray.png"], (1920, 216))
        self.assertIn((1280, 720), set(images.values()))
        self.assertIn((854, 480), set(images.values()))
        self.assertEqual(opaque_outputs["selected_frames"], [0, 1, 2, 4, 5])
        self.assertEqual(alpha_outputs["selected_frames"], [0, 1, 2, 4, 5])

    def test_directory_validation_fails_when_initial_media_digest_is_unavailable(self):
        spec = _spec(filename="digest-error.mp4", frames=6, loop=False)
        manifest = RenderManifest((spec,), {}, 17)
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            path = directory / spec.filename
            _encode(spec, path, lambda index: _opaque_frame(index, spec.frames))
            import swu_obs_anim.validate as validation_module

            real_digest = validation_module._file_sha256
            calls = 0

            def fail_first_digest(candidate):
                nonlocal calls
                calls += 1
                if calls == 1:
                    raise OSError("simulated initial digest failure")
                return real_digest(candidate)

            with patch(
                "swu_obs_anim.validate._file_sha256",
                side_effect=fail_first_digest,
            ):
                report = validate_directory(
                    manifest, directory, directory / "REVISION-VISUAL"
                )

        self.assertFalse(report.ok)
        self.assertIn(
            "media_digest_error",
            {finding.code for finding in report.results[0].findings},
        )
        self.assertIsNone(report.results[0].sha256)

    def test_checksums_reject_duplicate_basenames(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            first = directory / "first" / "same.bin"
            second = directory / "second" / "same.bin"
            first.parent.mkdir()
            second.parent.mkdir()
            first.write_bytes(b"first")
            second.write_bytes(b"second")

            with self.assertRaisesRegex(ValueError, "duplicate checksum basename"):
                write_checksums((first, second), directory / "SHA256SUMS.txt")

    def test_cli_validate_accepts_output_dir_reports_all_missing_media_as_failures(self):
        import swu_obs_anim.__main__ as command_line

        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            shutil.copyfile(
                ROOT / "render-manifest.json", renderer_root / "render-manifest.json"
            )
            output_directory = Path(directory) / "delivery"
            stdout = StringIO()
            stderr = StringIO()
            with patch.object(command_line, "ROOT", renderer_root):
                status = command_line.main(
                    ["validate", "--output-dir", str(output_directory)],
                    stdout=stdout,
                    stderr=stderr,
                )
            report = json.loads(
                (output_directory / "validation-report.json").read_text(encoding="utf-8")
            )
        self.assertEqual(status, 1)
        self.assertFalse(report["ok"])
        self.assertEqual(len(report["assets"]), 7)
        self.assertTrue(
            all(
                asset["findings"][0]["code"] == "missing_media"
                for asset in report["assets"]
            )
        )
        self.assertIn("[FAIL] ambient", stdout.getvalue())
        self.assertIn("Validation failed", stderr.getvalue())

    def test_cli_validate_accepts_a_complete_tiny_delivery(self):
        import swu_obs_anim.__main__ as command_line

        composition_ids = (
            "ambient",
            "energy-frame",
            "holographic-logo",
            "stinger",
            "starting",
            "break",
            "preview",
        )
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            renderer_root = directory / "renderer"
            renderer_root.mkdir()
            output_directory = directory / "delivery"
            output_directory.mkdir()

            opaque_spec = _spec("opaque", "opaque.mp4", frames=6, loop=True)
            opaque = output_directory / opaque_spec.filename
            _encode(
                opaque_spec,
                opaque,
                lambda index: _opaque_frame(index, opaque_spec.frames),
            )

            alpha_frames = 22
            alpha_spec = _spec(
                "alpha", "alpha.webm", alpha_frames, "vp9-alpha", True
            )
            alpha = output_directory / alpha_spec.filename

            def alpha_loop(index):
                phase_index = min(index, alpha_frames - 1 - index)
                return _alpha_frame(phase_index % 6, alpha_frames)

            _encode(alpha_spec, alpha, alpha_loop)

            stinger_spec = _spec(
                "stinger", "stinger.webm", alpha_frames, "vp9-alpha", False
            )
            stinger = output_directory / stinger_spec.filename

            def stinger_frame(index):
                if 15 <= index <= 19:
                    return Image.new("RGBA", SIZE, (4, 11, 27, 255))
                return _alpha_frame(index % 6, alpha_frames)

            _encode(stinger_spec, stinger, stinger_frame)

            items = []
            for composition_id in composition_ids:
                if composition_id in {"energy-frame", "holographic-logo"}:
                    profile, frames, loop, source = (
                        "vp9-alpha",
                        alpha_frames,
                        True,
                        alpha,
                    )
                elif composition_id == "stinger":
                    profile, frames, loop, source = (
                        "vp9-alpha",
                        alpha_frames,
                        False,
                        stinger,
                    )
                else:
                    profile, frames, loop, source = (
                        "h264",
                        opaque_spec.frames,
                        composition_id != "preview",
                        opaque,
                    )
                filename = f"asset-{composition_id}{source.suffix}"
                shutil.copyfile(source, output_directory / filename)
                items.append(
                    {
                        "id": composition_id,
                        "filename": filename,
                        "width": SIZE[0],
                        "height": SIZE[1],
                        "fps": 30,
                        "frames": frames,
                        "profile": profile,
                        "loop": loop,
                    }
                )
            (renderer_root / "render-manifest.json").write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "stingerTransitionFrame": 17,
                        "protectedRegions": {},
                        "compositions": items,
                    }
                ),
                encoding="utf-8",
            )
            stdout = StringIO()
            stderr = StringIO()
            with patch.object(command_line, "ROOT", renderer_root):
                status = command_line.main(
                    ["validate", "--output-dir", str(output_directory)],
                    stdout=stdout,
                    stderr=stderr,
                )
            report = json.loads(
                (output_directory / "validation-report.json").read_text(encoding="utf-8")
            )
            expected_hashes = {
                item["filename"]: hashlib.sha256(
                    (output_directory / item["filename"]).read_bytes()
                ).hexdigest()
                for item in items
            }

        self.assertEqual(status, 0, stderr.getvalue())
        self.assertTrue(report["ok"])
        self.assertEqual(len(report["assets"]), 7)
        self.assertEqual(report["schemaVersion"], 2)
        self.assertEqual(
            {
                asset["filename"]: asset["sha256"]
                for asset in report["assets"]
            },
            expected_hashes,
        )
        self.assertEqual(stderr.getvalue(), "")
        self.assertIn("[OK] stinger", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
