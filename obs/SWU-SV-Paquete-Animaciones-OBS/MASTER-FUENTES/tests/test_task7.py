import hashlib
import json
from io import StringIO
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import ANY, Mock, patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.config import CompositionSpec, RenderManifest
from swu_obs_anim.scenes.preview import render_preview


EXPECTED_SOURCE_IDS = (
    "logo-png",
    "youtube-banner",
    "camera-background",
    "stream-frame",
    "stream-logo",
    "stream-background",
)


@dataclass(frozen=True)
class PreviewContext:
    manifest: RenderManifest


def preview_context() -> PreviewContext:
    definitions = (
        ("ambient", 600, "h264", True),
        ("energy-frame", 360, "vp9-alpha", True),
        ("holographic-logo", 240, "vp9-alpha", True),
        ("stinger", 36, "vp9-alpha", False),
        ("starting", 600, "h264", True),
        ("break", 600, "h264", True),
        ("preview", 1200, "h264", False),
    )
    compositions = tuple(
        CompositionSpec(
            composition_id,
            f"{composition_id}.mp4",
            32,
            18,
            30,
            frames,
            profile,
            loop,
        )
        for composition_id, frames, profile, loop in definitions
    )
    return PreviewContext(RenderManifest(compositions, {}, 17))


def opaque(marker):
    return lambda frame, context: Image.new("RGB", (32, 18), (marker, frame % 256, 0))


def transparent(marker):
    return lambda frame, context: Image.new("RGBA", (32, 18), (marker, frame % 256, 0, 255))


class PreviewTests(unittest.TestCase):
    def test_preview_uses_exact_segment_boundaries_and_local_frames(self):
        context = preview_context()

        def holding(frame, context, title, motion_scale):
            marker = 50 if title == "EMPEZAMOS PRONTO" else 60
            return Image.new("RGB", (32, 18), (marker, frame % 256, 0))

        with (
            patch("swu_obs_anim.scenes.preview.render_ambient", opaque(10)),
            patch("swu_obs_anim.scenes.preview.render_energy_frame", transparent(20)),
            patch("swu_obs_anim.scenes.preview.render_holographic_logo", transparent(30)),
            patch("swu_obs_anim.scenes.preview.render_stinger", transparent(40)),
            patch("swu_obs_anim.scenes.preview.render_holding", holding),
        ):
            expected = {
                0: (10, 0),
                239: (10, 239),
                240: (20, 0),
                419: (20, 179),
                420: (30, 0),
                599: (30, 179),
                600: (40, 0),
                635: (40, 35),
                660: (40, 0),
                695: (40, 35),
                720: (50, 0),
                959: (50, 239),
                960: (60, 0),
                1199: (60, 239),
            }
            for frame, pixel in expected.items():
                with self.subTest(frame=frame):
                    image = render_preview(frame, context)
                    self.assertEqual(image.mode, "RGB")
                    self.assertEqual(image.getpixel((0, 0))[:2], pixel)

            for frame in (636, 659, 696, 719):
                with self.subTest(rest_frame=frame):
                    image = render_preview(frame, context)
                    self.assertEqual(image.getpixel((0, 0)), (4, 11, 27))
                    self.assertEqual(image.getpixel((31, 0)), (214, 220, 228))

    def test_preview_segment_boundaries_are_derived_from_manifest_fps(self):
        context = PreviewContext(
            RenderManifest(
                (
                    CompositionSpec(
                        "stinger", "stinger.webm", 32, 18, 30, 36, "vp9-alpha", False
                    ),
                    CompositionSpec(
                        "preview", "preview.mp4", 32, 18, 60, 2400, "h264", False
                    ),
                ),
                {},
                17,
            )
        )

        def holding(frame, context, title, motion_scale):
            marker = 50 if title == "EMPEZAMOS PRONTO" else 60
            return Image.new("RGB", (32, 18), (marker, frame % 256, 0))

        with (
            patch("swu_obs_anim.scenes.preview.render_ambient", opaque(10)),
            patch("swu_obs_anim.scenes.preview.render_energy_frame", transparent(20)),
            patch("swu_obs_anim.scenes.preview.render_holographic_logo", transparent(30)),
            patch("swu_obs_anim.scenes.preview.render_stinger", transparent(40)),
            patch("swu_obs_anim.scenes.preview.render_holding", holding),
        ):
            expected = {
                479: (10, 479 % 256),
                480: (20, 0),
                839: (20, 359 % 256),
                840: (30, 0),
                1199: (30, 359 % 256),
                1200: (40, 0),
                1235: (40, 35),
                1320: (40, 0),
                1355: (40, 35),
                1440: (50, 0),
                1919: (50, 479 % 256),
                1920: (60, 0),
                2399: (60, 479 % 256),
            }
            for frame, pixel in expected.items():
                with self.subTest(frame=frame):
                    self.assertEqual(
                        render_preview(frame, context).getpixel((0, 0))[:2], pixel
                    )


class RegistryTests(unittest.TestCase):
    def test_registry_has_exactly_one_callable_for_each_manifest_id(self):
        from swu_obs_anim.registry import RENDERERS

        self.assertEqual(
            set(RENDERERS),
            {
                "ambient",
                "energy-frame",
                "holographic-logo",
                "stinger",
                "starting",
                "break",
                "preview",
            },
        )
        self.assertTrue(all(callable(renderer) for renderer in RENDERERS.values()))
        self.assertEqual(len({id(renderer) for renderer in RENDERERS.values()}), 7)

    def test_registry_mapping_remains_semantic_when_manifest_order_changes(self):
        import importlib

        import swu_obs_anim.config as config
        import swu_obs_anim.registry as registry
        from swu_obs_anim.scenes.ambient import render_ambient
        from swu_obs_anim.scenes.energy_frame import render_energy_frame
        from swu_obs_anim.scenes.holographic_logo import render_holographic_logo
        from swu_obs_anim.scenes.preview import render_preview
        from swu_obs_anim.scenes.stinger import render_stinger

        expected = {
            "ambient": render_ambient,
            "energy-frame": render_energy_frame,
            "holographic-logo": render_holographic_logo,
            "stinger": render_stinger,
            "preview": render_preview,
        }
        try:
            with patch.object(
                config, "COMPOSITION_IDS", tuple(reversed(config.COMPOSITION_IDS))
            ):
                reordered_registry = importlib.reload(registry)
                for composition_id, renderer in expected.items():
                    with self.subTest(composition_id=composition_id):
                        self.assertIs(
                            reordered_registry.RENDERERS[composition_id], renderer
                        )

                context = object()
                with patch.object(
                    reordered_registry, "render_holding", return_value="starting"
                ) as render_holding:
                    self.assertEqual(
                        reordered_registry.RENDERERS["starting"](7, context),
                        "starting",
                    )
                    render_holding.assert_called_once_with(
                        7, context, "EMPEZAMOS PRONTO", 1.0
                    )
                with patch.object(
                    reordered_registry, "render_holding", return_value="break"
                ) as render_holding:
                    self.assertEqual(
                        reordered_registry.RENDERERS["break"](11, context),
                        "break",
                    )
                    render_holding.assert_called_once_with(
                        11, context, "VOLVEMOS PRONTO", 0.7
                    )
        finally:
            importlib.reload(registry)

    def test_asset_bundle_keeps_precise_pillow_type_without_runtime_import(self):
        completed = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; sys.path.insert(0, sys.argv[1]); "
                    "import swu_obs_anim.assets as assets; "
                    "assert 'PIL' not in sys.modules; "
                    "assert assets.AssetBundle.__annotations__['images'] "
                    "== 'dict[str, Image.Image]'"
                ),
                str(ROOT / "src"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_registry_rejects_configured_id_set_mismatch(self):
        import importlib

        import swu_obs_anim.config as config
        import swu_obs_anim.registry as registry

        mismatched_ids = (*config.COMPOSITION_IDS[:-1], "unknown-composition")
        try:
            with patch.object(config, "COMPOSITION_IDS", mismatched_ids):
                with self.assertRaisesRegex(
                    RuntimeError, "does not match composition IDs"
                ):
                    importlib.reload(registry)
        finally:
            importlib.reload(registry)


class CommandTests(unittest.TestCase):
    def test_source_manifest_requires_exact_typed_unique_contract(self):
        from swu_obs_anim.__main__ import preflight
        from swu_obs_anim.config import load_source_manifest

        valid_sources = [
            {
                "id": source_id,
                "path": f"/absolute/source-{index}.png",
                "copyAs": f"source-{index}.png",
                "sha256": f"{index + 1:064x}",
            }
            for index, source_id in enumerate(EXPECTED_SOURCE_IDS)
        ]
        malformed_sources = []

        duplicate_id = [dict(item) for item in valid_sources]
        duplicate_id[-1]["id"] = duplicate_id[0]["id"]
        malformed_sources.append(duplicate_id)

        wrong_id = [dict(item) for item in valid_sources]
        wrong_id[-1]["id"] = "unrelated-source"
        malformed_sources.append(wrong_id)

        duplicate_destination = [dict(item) for item in valid_sources]
        duplicate_destination[-1]["copyAs"] = duplicate_destination[0]["copyAs"]
        malformed_sources.append(duplicate_destination)

        wrong_type = [dict(item) for item in valid_sources]
        wrong_type[0]["path"] = ["not", "a", "path"]
        malformed_sources.append(wrong_type)

        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "source-manifest.json"
            for index, sources in enumerate(malformed_sources):
                with self.subTest(case=index):
                    manifest_path.write_text(
                        json.dumps({"schemaVersion": 1, "sources": sources}),
                        encoding="utf-8",
                    )
                    with self.assertRaises(ValueError):
                        load_source_manifest(manifest_path)

            malformed_documents = (
                {"schemaVersion": "1", "sources": valid_sources},
                {"schemaVersion": 1, "sources": {"not": "a list"}},
                {"schemaVersion": 1, "sources": [*valid_sources[:-1], 7]},
            )
            for index, document in enumerate(malformed_documents):
                with self.subTest(document=index):
                    manifest_path.write_text(
                        json.dumps(document), encoding="utf-8"
                    )
                    with self.assertRaises(ValueError):
                        load_source_manifest(manifest_path)

            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            (renderer_root / "source-manifest.json").write_text(
                json.dumps(
                    {"schemaVersion": 1, "sources": malformed_sources[-1]}
                ),
                encoding="utf-8",
            )
            report = preflight(renderer_root, Path(directory) / "delivery")

        manifest_result = next(
            result for result in report.results if result.name == "source manifest"
        )
        self.assertFalse(manifest_result.ok)
        self.assertIn("path", manifest_result.detail)

    def test_output_destination_is_portable_and_explicitly_overridable(self):
        from swu_obs_anim.__main__ import build_parser, default_output_directory

        workspace = Path("/portable/workspace")
        staging_root = workspace / "work" / "swu-animation-renderer"
        package = workspace / "outputs" / "SWU-SV-Paquete-Animaciones-OBS"
        packaged_root = package / "MASTER-FUENTES"
        custom = workspace / "custom-delivery"

        self.assertEqual(default_output_directory(staging_root), package)
        self.assertEqual(default_output_directory(packaged_root), package)
        self.assertEqual(
            build_parser().parse_args(
                ["render", "ambient", "--output-dir", str(custom)]
            ).output_dir,
            custom,
        )

    def test_preflight_accepts_verified_packaged_originals_without_staging_writes(self):
        from swu_obs_anim.__main__ import preflight

        source_ids = EXPECTED_SOURCE_IDS
        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "MASTER-FUENTES"
            originals = renderer_root / "assets" / "original"
            originals.mkdir(parents=True)
            sources = []
            for index, source_id in enumerate(source_ids):
                copy_as = f"source-{index}.bin"
                payload = f"verified-{source_id}".encode()
                (originals / copy_as).write_bytes(payload)
                sources.append(
                    {
                        "id": source_id,
                        "path": str(Path(directory) / "missing" / copy_as),
                        "copyAs": copy_as,
                        "sha256": hashlib.sha256(payload).hexdigest(),
                    }
                )
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )
            originals.chmod(0o555)
            try:
                report = preflight(renderer_root)
            finally:
                originals.chmod(0o755)

        source_results = {
            result.name: result for result in report.results if result.name.startswith("source")
        }
        self.assertTrue(source_results["source manifest"].ok)
        for source_id in source_ids:
            self.assertTrue(source_results[f"source {source_id}"].ok)
            self.assertIn("packaged original", source_results[f"source {source_id}"].detail)
        self.assertNotIn("source staging directory", source_results)
        output_result = next(
            result for result in report.results if result.name == "output directory"
        )
        self.assertEqual(output_result.detail, directory)

    def test_render_source_loading_does_not_rewrite_verified_packaged_originals(self):
        from swu_obs_anim.assets import load_or_copy_sources
        from swu_obs_anim.config import load_source_manifest

        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "MASTER-FUENTES"
            originals = renderer_root / "assets" / "original"
            originals.mkdir(parents=True)
            sources = []
            expected_bytes = {}
            for index, source_id in enumerate(EXPECTED_SOURCE_IDS):
                copy_as = f"source-{index}.png"
                copied = originals / copy_as
                Image.new("RGBA", (4, 4), (index, 20, 40, 255)).save(copied)
                expected_bytes[copy_as] = copied.read_bytes()
                sources.append(
                    {
                        "id": source_id,
                        "path": str(Path(directory) / "missing" / copy_as),
                        "copyAs": copy_as,
                        "sha256": hashlib.sha256(copied.read_bytes()).hexdigest(),
                    }
                )
            manifest_path = renderer_root / "source-manifest.json"
            manifest_path.write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )
            manifest = load_source_manifest(manifest_path)

            originals.chmod(0o555)
            try:
                bundle = load_or_copy_sources(manifest, renderer_root)
            finally:
                originals.chmod(0o755)

            self.assertEqual(set(bundle.images), set(EXPECTED_SOURCE_IDS))
            self.assertEqual(
                {path.name: path.read_bytes() for path in originals.iterdir()},
                expected_bytes,
            )

    def test_preflight_rejects_unwritable_source_staging_when_copy_is_required(self):
        from swu_obs_anim.__main__ import preflight

        source_ids = EXPECTED_SOURCE_IDS
        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            source = Path(directory) / "source.bin"
            source.write_bytes(b"verified source")
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            sources = [
                {
                    "id": source_id,
                    "path": str(source),
                    "copyAs": f"source-{index}.bin",
                    "sha256": digest,
                }
                for index, source_id in enumerate(source_ids)
            ]
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )

            renderer_root.chmod(0o555)
            try:
                report = preflight(renderer_root, Path(directory) / "delivery")
            finally:
                renderer_root.chmod(0o755)

        staging = next(
            result
            for result in report.results
            if result.name == "source staging directory"
        )
        self.assertFalse(staging.ok)
        self.assertFalse(report.ok)

    def test_cli_exposes_the_six_required_commands(self):
        from swu_obs_anim.__main__ import build_parser

        parser = build_parser()
        cases = (
            (["preflight"], "preflight", None),
            (["test"], "test", None),
            (["render", "ambient"], "render", "ambient"),
            (["render", "all"], "render", "all"),
            (["validate"], "validate", None),
            (["package"], "package", None),
        )
        for arguments, command, composition in cases:
            with self.subTest(arguments=arguments):
                parsed = parser.parse_args(arguments)
                self.assertEqual(parsed.command, command)
                if composition is not None:
                    self.assertEqual(parsed.composition, composition)

    def test_preflight_rejects_a_pinned_source_hash_mismatch(self):
        from swu_obs_anim.__main__ import preflight

        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            source = Path(directory) / "source.png"
            source.write_bytes(b"pinned source")
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            sources = [
                {
                    "id": source_id,
                    "path": str(source),
                    "copyAs": f"source-{index}.png",
                    "sha256": "0" * 64 if index == 3 else digest,
                }
                for index, source_id in enumerate(EXPECTED_SOURCE_IDS)
            ]
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )

            report = preflight(renderer_root, Path(directory) / "output")

        self.assertFalse(report.ok)
        self.assertTrue(
            any(
                result.name == "source stream-frame"
                and not result.ok
                and "hash mismatch" in result.detail
                for result in report.results
            )
        )

    def test_preflight_rejects_missing_tools_packages_font_and_writable_output(self):
        import swu_obs_anim.__main__ as command_line

        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            source = Path(directory) / "source.bin"
            source.write_bytes(b"verified")
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            sources = [
                {
                    "id": source_id,
                    "path": str(source),
                    "copyAs": f"source-{index}.bin",
                    "sha256": digest,
                }
                for index, source_id in enumerate(EXPECTED_SOURCE_IDS)
            ]
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )
            blocked_parent = Path(directory) / "not-a-directory"
            blocked_parent.write_text("file", encoding="utf-8")

            with (
                patch.object(command_line.shutil, "which", return_value=None),
                patch.object(
                    command_line.importlib,
                    "import_module",
                    side_effect=ModuleNotFoundError("dependency unavailable"),
                ),
            ):
                report = command_line.preflight(
                    renderer_root, blocked_parent / "output"
                )

        failures = {result.name for result in report.results if not result.ok}
        self.assertTrue(
            {"ffmpeg", "ffprobe", "Pillow", "NumPy", "font", "output directory"}
            <= failures
        )

    def test_preflight_command_reports_source_tool_and_package_versions(self):
        from swu_obs_anim.__main__ import main

        stdout = StringIO()
        stderr = StringIO()
        status = main(["preflight"], stdout=stdout, stderr=stderr)

        self.assertEqual(status, 0, stderr.getvalue())
        report = stdout.getvalue()
        self.assertIn("6 pinned sources", report)
        self.assertIn("ffmpeg version", report)
        self.assertIn("ffprobe version", report)
        self.assertIn("Pillow: 12.3.0", report)
        self.assertIn("NumPy: 2.3.5", report)
        self.assertIn("DIN Condensed Bold.ttf", report)
        self.assertIn("output directory", report)

    def test_render_command_preflights_then_renders_the_requested_composition(self):
        import swu_obs_anim.__main__ as command_line

        output_directory = Path("/explicit/delivery")
        successful = command_line.PreflightReport(
            (command_line.CheckResult("ready", True, "ready"),)
        )
        preflight_check = Mock(return_value=successful)
        render_requested = Mock()
        with (
            patch.object(command_line, "preflight", preflight_check),
            patch.object(command_line, "render_requested", render_requested),
        ):
            status = command_line.main(
                ["render", "ambient", "--output-dir", str(output_directory)],
                stdout=StringIO(),
                stderr=StringIO(),
        )

        self.assertEqual(status, 0)
        preflight_check.assert_called_once_with(command_line.ROOT, output_directory)
        render_requested.assert_called_once_with(
            "ambient",
            command_line.ROOT,
            output_directory,
            ANY,
        )

    def test_failed_encode_keeps_existing_final_and_removes_temporary_output(self):
        from swu_obs_anim.__main__ import render_requested

        source_ids = EXPECTED_SOURCE_IDS
        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            (renderer_root / "render-manifest.json").write_text(
                (ROOT / "render-manifest.json").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            sources = []
            for index, source_id in enumerate(source_ids):
                source = Path(directory) / f"source-{index}.png"
                Image.new("RGBA", (4, 4), (index, 10, 20, 255)).save(source)
                sources.append(
                    {
                        "id": source_id,
                        "path": str(source),
                        "copyAs": source.name,
                        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    }
                )
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )
            output_directory = Path(directory) / "delivery"
            output_directory.mkdir()
            final = output_directory / "SWU-SV-Fondo-Ambiental-Loop-1920x1080.mp4"
            final.write_bytes(b"known-good-final")
            temporary_paths = []

            def fail_after_partial(spec, render_frame, output):
                temporary_paths.append(output)
                output.write_bytes(b"partial")
                raise RuntimeError("simulated encoder failure")

            with patch(
                "swu_obs_anim.encode.encode_frames", side_effect=fail_after_partial
            ):
                with self.assertRaisesRegex(RuntimeError, "simulated encoder failure"):
                    render_requested(
                        "ambient", renderer_root, output_directory, StringIO()
                    )

            self.assertEqual(final.read_bytes(), b"known-good-final")
            self.assertEqual(len(temporary_paths), 1)
            self.assertNotEqual(temporary_paths[0], final)
            self.assertFalse(temporary_paths[0].exists())
            self.assertEqual(list(output_directory.iterdir()), [final])

    def test_noop_encoder_keeps_existing_final_and_removes_empty_reservation(self):
        from swu_obs_anim.__main__ import render_requested

        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            (renderer_root / "render-manifest.json").write_text(
                (ROOT / "render-manifest.json").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            sources = []
            for index, source_id in enumerate(EXPECTED_SOURCE_IDS):
                source = Path(directory) / f"source-{index}.png"
                Image.new("RGBA", (4, 4), (index, 10, 20, 255)).save(source)
                sources.append(
                    {
                        "id": source_id,
                        "path": str(source),
                        "copyAs": source.name,
                        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    }
                )
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )
            output_directory = Path(directory) / "delivery"
            output_directory.mkdir()
            final = output_directory / "SWU-SV-Fondo-Ambiental-Loop-1920x1080.mp4"
            final.write_bytes(b"known-good-final")
            temporary_paths = []

            def no_output(spec, render_frame, output):
                temporary_paths.append(output)

            with patch("swu_obs_anim.encode.encode_frames", side_effect=no_output):
                with self.assertRaisesRegex(
                    RuntimeError, "ambient.*nonempty regular file"
                ):
                    render_requested(
                        "ambient", renderer_root, output_directory, StringIO()
                    )

            self.assertEqual(final.read_bytes(), b"known-good-final")
            self.assertEqual(len(temporary_paths), 1)
            self.assertFalse(temporary_paths[0].exists())
            self.assertEqual(list(output_directory.iterdir()), [final])

    def test_successful_encode_publishes_readable_file_from_reserved_sibling(self):
        from swu_obs_anim.__main__ import render_requested

        with tempfile.TemporaryDirectory() as directory:
            renderer_root = Path(directory) / "renderer"
            renderer_root.mkdir()
            (renderer_root / "render-manifest.json").write_text(
                (ROOT / "render-manifest.json").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            sources = []
            for index, source_id in enumerate(EXPECTED_SOURCE_IDS):
                source = Path(directory) / f"source-{index}.png"
                Image.new("RGBA", (4, 4), (index, 10, 20, 255)).save(source)
                sources.append(
                    {
                        "id": source_id,
                        "path": str(source),
                        "copyAs": source.name,
                        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    }
                )
            (renderer_root / "source-manifest.json").write_text(
                json.dumps({"schemaVersion": 1, "sources": sources}),
                encoding="utf-8",
            )
            output_directory = Path(directory) / "delivery"
            temporary_paths = []

            def complete_encode(spec, render_frame, output):
                temporary_paths.append(output)
                self.assertEqual(output.parent, output_directory)
                self.assertTrue(output.exists())
                self.assertTrue(stat.S_ISREG(output.lstat().st_mode))
                self.assertEqual(stat.S_IMODE(output.lstat().st_mode), 0o600)
                output.write_bytes(b"complete-encode")

            with patch(
                "swu_obs_anim.encode.encode_frames", side_effect=complete_encode
            ):
                render_requested(
                    "ambient", renderer_root, output_directory, StringIO()
                )

            final = output_directory / "SWU-SV-Fondo-Ambiental-Loop-1920x1080.mp4"
            self.assertEqual(final.read_bytes(), b"complete-encode")
            self.assertEqual(stat.S_IMODE(final.stat().st_mode), 0o644)
            self.assertEqual(len(temporary_paths), 1)
            self.assertNotEqual(temporary_paths[0], final)
            self.assertFalse(temporary_paths[0].exists())
            self.assertEqual(list(output_directory.iterdir()), [final])

    def test_render_shell_resolves_its_directory_without_touching_pythonpath(self):
        script = ROOT / "render.sh"
        self.assertTrue(os.access(script, os.X_OK))
        self.assertNotIn("PYTHONPATH", script.read_text(encoding="utf-8"))

        with tempfile.TemporaryDirectory() as directory:
            environment = os.environ.copy()
            environment["PYTHONPATH"] = "/sentinel/global/path"
            completed = subprocess.run(
                [str(script), "preflight"],
                cwd=directory,
                env=environment,
                capture_output=True,
                text=True,
                timeout=30,
            )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("6 pinned sources", completed.stdout)

if __name__ == "__main__":
    unittest.main()
