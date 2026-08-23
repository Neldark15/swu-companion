"""Command-line interface for the reproducible SWU SV renderer."""

import argparse
from dataclasses import dataclass
import hashlib
import importlib
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile

from .config import (
    COMPOSITION_IDS,
    RenderManifest,
    load_render_manifest,
    load_source_manifest,
)


ROOT = Path(__file__).resolve().parents[2]
PACKAGE_DIRECTORY_NAME = "SWU-SV-Paquete-Animaciones-OBS"


def default_output_directory(renderer_root: Path) -> Path:
    """Resolve delivery beside packaged masters or under staging outputs."""
    if renderer_root.name == "MASTER-FUENTES":
        return renderer_root.parent
    return renderer_root.parents[1] / "outputs" / PACKAGE_DIRECTORY_NAME


DEFAULT_OUTPUT_DIRECTORY = default_output_directory(ROOT)
FONT_CANDIDATES = (
    ROOT / "assets" / "fonts" / "DIN Condensed Bold.ttf",
    Path("/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf"),
    Path("/Library/Fonts/DIN Condensed Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"),
    Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
)


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    detail: str


@dataclass(frozen=True)
class PreflightReport:
    results: tuple[CheckResult, ...]

    @property
    def ok(self) -> bool:
        return all(result.ok for result in self.results)


@dataclass(frozen=True)
class RenderContext:
    assets: object
    manifest: RenderManifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="swu-obs-render")
    subparsers = parser.add_subparsers(dest="command", required=True)
    preflight_parser = subparsers.add_parser(
        "preflight", help="verify sources and local render tools"
    )
    preflight_parser.add_argument("--output-dir", type=Path)
    subparsers.add_parser("test", help="run the renderer unit tests")

    render_parser = subparsers.add_parser("render", help="render one or all compositions")
    render_parser.add_argument("composition", choices=(*COMPOSITION_IDS, "all"))
    render_parser.add_argument("--output-dir", type=Path)

    validate_parser = subparsers.add_parser(
        "validate", help="validate rendered media"
    )
    validate_parser.add_argument("--output-dir", type=Path)
    package_parser = subparsers.add_parser(
        "package", help="assemble the final delivery package"
    )
    package_parser.add_argument("--output-dir", type=Path)
    return parser


def preflight(
    renderer_root: Path = ROOT,
    output_directory: Path = None,
) -> PreflightReport:
    """Check every local prerequisite without loading or copying source images."""
    output_directory = output_directory or default_output_directory(renderer_root)
    results = []
    source_manifest_path = renderer_root / "source-manifest.json"
    try:
        source_manifest = load_source_manifest(source_manifest_path)
    except (OSError, ValueError, KeyError, TypeError) as error:
        results.append(CheckResult("source manifest", False, str(error)))
    else:
        from .assets import verified_original_paths

        results.append(
            CheckResult(
                "source manifest",
                len(source_manifest.sources) == 6,
                f"{len(source_manifest.sources)} pinned sources (expected 6)",
            )
        )
        packaged_paths = verified_original_paths(source_manifest, renderer_root)
        for source in source_manifest.sources:
            source_path = (
                packaged_paths[source.id]
                if packaged_paths is not None
                else source.path
            )
            try:
                actual = _sha256(source_path)
            except OSError as error:
                results.append(CheckResult(f"source {source.id}", False, str(error)))
            else:
                matches = actual == source.sha256
                if matches:
                    location = (
                        "packaged original"
                        if packaged_paths is not None
                        else "manifest source"
                    )
                    detail = f"SHA-256 matches ({location}: {source_path})"
                else:
                    detail = f"hash mismatch: expected {source.sha256}, got {actual}"
                results.append(CheckResult(f"source {source.id}", matches, detail))
        if packaged_paths is None:
            results.append(
                _writable_directory_check(
                    renderer_root / "assets" / "original",
                    "source staging directory",
                )
            )

    for executable_name in ("ffmpeg", "ffprobe"):
        executable = shutil.which(executable_name)
        if executable is None:
            results.append(CheckResult(executable_name, False, "not found on PATH"))
            continue
        try:
            completed = subprocess.run(
                [executable, "-version"],
                check=True,
                capture_output=True,
                text=True,
                timeout=10,
            )
            version = completed.stdout.splitlines()[0]
        except (OSError, subprocess.SubprocessError, IndexError) as error:
            results.append(CheckResult(executable_name, False, str(error)))
        else:
            results.append(CheckResult(executable_name, True, version))

    pillow = _package_check("PIL", "Pillow")
    numpy = _package_check("numpy", "NumPy")
    results.extend((pillow, numpy))
    results.append(_font_check(pillow.ok))
    results.append(_writable_directory_check(output_directory))
    return PreflightReport(tuple(results))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        while chunk := source_file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _package_check(module_name: str, display_name: str) -> CheckResult:
    try:
        module = importlib.import_module(module_name)
    except (ImportError, OSError) as error:
        return CheckResult(display_name, False, f"not importable: {error}")
    version = getattr(module, "__version__", "version unavailable")
    return CheckResult(display_name, True, str(version))


def _font_check(pillow_available: bool) -> CheckResult:
    if not pillow_available:
        return CheckResult("font", False, "cannot test fonts without Pillow")
    try:
        image_font = importlib.import_module("PIL.ImageFont")
    except (ImportError, OSError) as error:
        return CheckResult("font", False, str(error))

    override = os.environ.get("SWU_OBS_FONT")
    candidates = ((Path(override),) if override else ()) + FONT_CANDIDATES
    errors = []
    for candidate in candidates:
        try:
            loaded_font = image_font.truetype(str(candidate), 24)
        except OSError as error:
            errors.append(f"{candidate}: {error}")
        else:
            return CheckResult(
                "font", True, str(getattr(loaded_font, "path", candidate))
            )
    return CheckResult("font", False, "; ".join(errors) or "no font candidates")


def _writable_directory_check(
    directory: Path, name: str = "output directory"
) -> CheckResult:
    try:
        directory.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(prefix=".swu-write-test-", dir=directory):
            pass
    except OSError as error:
        return CheckResult(name, False, f"{directory}: {error}")
    return CheckResult(name, True, str(directory))


def render_requested(
    requested: str,
    renderer_root: Path = ROOT,
    output_directory: Path = None,
    stdout=None,
) -> None:
    """Load verified sources once, then stream the requested frames to FFmpeg."""
    output_directory = output_directory or default_output_directory(renderer_root)
    stdout = sys.stdout if stdout is None else stdout
    from .assets import load_or_copy_sources
    from .encode import encode_frames
    from .registry import RENDERERS

    manifest = load_render_manifest(renderer_root / "render-manifest.json")
    manifest_ids = tuple(spec.id for spec in manifest.compositions)
    if set(manifest_ids) != set(RENDERERS) or len(manifest_ids) != len(RENDERERS):
        raise ValueError("renderer registry does not exactly match the render manifest")

    source_manifest = load_source_manifest(renderer_root / "source-manifest.json")
    assets = load_or_copy_sources(source_manifest, renderer_root)
    context = RenderContext(assets, manifest)
    composition_ids = manifest_ids if requested == "all" else (requested,)
    for composition_id in composition_ids:
        spec = manifest.by_id(composition_id)
        output = output_directory / spec.filename
        print(
            f"Rendering {composition_id}: {spec.frames} frames -> {output}",
            file=stdout,
        )
        _encode_atomically(
            spec,
            lambda frame, renderer=RENDERERS[composition_id]: renderer(frame, context),
            output,
            encode_frames,
        )
        print(f"Rendered {composition_id}", file=stdout)


def _encode_atomically(spec, render_frame, output: Path, encoder) -> None:
    """Publish a complete 0644 encode and remove every temporary on failure."""
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output.stem}-",
        suffix=output.suffix,
        dir=output.parent,
    )
    temporary = Path(temporary_name)
    try:
        os.close(descriptor)
        descriptor = -1
        # Keep mkstemp's exclusive regular-file reservation; FFmpeg's -y
        # truncates this inode without reopening an unreserved path window.
        encoder(spec, render_frame, temporary)
        invalid_output = RuntimeError(
            f"encoder output invalid for {spec.id}: expected a nonempty regular file "
            f"at {temporary}"
        )
        try:
            encoded_status = temporary.lstat()
        except OSError as error:
            raise invalid_output from error
        if not stat.S_ISREG(encoded_status.st_mode) or encoded_status.st_size == 0:
            raise invalid_output
        temporary.chmod(0o644)
        os.replace(temporary, output)
    finally:
        try:
            if descriptor >= 0:
                os.close(descriptor)
        finally:
            temporary.unlink(missing_ok=True)


def _write_preflight(report: PreflightReport, stream) -> None:
    for result in report.results:
        state = "OK" if result.ok else "FAIL"
        print(f"[{state}] {result.name}: {result.detail}", file=stream)


def _run_tests(renderer_root: Path, stdout, stderr) -> int:
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            str(renderer_root / "tests"),
            "-v",
        ],
        cwd=renderer_root,
        stdout=stdout,
        stderr=stderr,
    )
    return completed.returncode


def main(argv=None, *, stdout=None, stderr=None) -> int:
    stdout = sys.stdout if stdout is None else stdout
    stderr = sys.stderr if stderr is None else stderr
    arguments = build_parser().parse_args(argv)
    if arguments.command == "preflight":
        output_directory = arguments.output_dir or default_output_directory(ROOT)
        report = preflight(ROOT, output_directory)
        _write_preflight(report, stdout)
        if not report.ok:
            print("Preflight failed; correct the FAIL items before rendering.", file=stderr)
        return 0 if report.ok else 1
    if arguments.command == "test":
        return _run_tests(ROOT, stdout, stderr)
    if arguments.command == "render":
        output_directory = arguments.output_dir or default_output_directory(ROOT)
        report = preflight(ROOT, output_directory)
        _write_preflight(report, stdout)
        if not report.ok:
            print("Preflight failed; rendering was not started.", file=stderr)
            return 1
        try:
            render_requested(
                arguments.composition, ROOT, output_directory, stdout
            )
        except (OSError, ValueError, KeyError, RuntimeError) as error:
            print(f"Render failed: {error}", file=stderr)
            return 1
        return 0
    if arguments.command == "validate":
        from .validate import (
            validate_directory,
            write_validation_report,
        )

        output_directory = arguments.output_dir or default_output_directory(ROOT)
        try:
            manifest = load_render_manifest(ROOT / "render-manifest.json")
            validation = validate_directory(manifest, output_directory)
            report_path = output_directory / "validation-report.json"
            write_validation_report(validation, report_path)
        except (OSError, ValueError, KeyError, RuntimeError) as error:
            print(f"Validation failed before report generation: {error}", file=stderr)
            return 1
        for result in validation.results:
            state = "OK" if result.ok else "FAIL"
            detail = (
                "all gates passed"
                if result.ok
                else ", ".join(finding.code for finding in result.findings)
            )
            print(f"[{state}] {result.asset_id}: {detail}", file=stdout)
        print(f"Validation report: {report_path}", file=stdout)
        if not validation.ok:
            print(
                "Validation failed; inspect the named findings in the report.",
                file=stderr,
            )
        return 0 if validation.ok else 1
    if arguments.command == "package":
        from .package import package_delivery

        output_directory = arguments.output_dir or default_output_directory(ROOT)
        try:
            manifest = load_render_manifest(ROOT / "render-manifest.json")
            result = package_delivery(manifest, ROOT, output_directory)
        except (OSError, ValueError, KeyError, RuntimeError) as error:
            print(f"Packaging failed: {error}", file=stderr)
            return 1
        print(
            f"Packaged {len(result.checksummed_files)} files in "
            f"{result.output_directory}",
            file=stdout,
        )
        return 0
    print(f"Unknown command: {arguments.command}", file=stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
