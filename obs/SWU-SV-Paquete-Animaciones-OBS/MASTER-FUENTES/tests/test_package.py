import hashlib
from io import StringIO
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.config import CompositionSpec, RenderManifest, load_render_manifest
from swu_obs_anim.package import PackageResult, package_delivery


SOURCE_IDS = (
    "logo-png",
    "youtube-banner",
    "camera-background",
    "stream-frame",
    "stream-logo",
    "stream-background",
)


def tiny_manifest() -> RenderManifest:
    definitions = (
        ("ambient", "ambient.mp4", "h264", True),
        ("energy-frame", "energy.webm", "vp9-alpha", True),
        ("holographic-logo", "logo.webm", "vp9-alpha", True),
        ("stinger", "stinger.webm", "vp9-alpha", False),
        ("starting", "starting.mp4", "h264", True),
        ("break", "break.mp4", "h264", True),
        ("preview", "preview.mp4", "h264", False),
    )
    return RenderManifest(
        tuple(
            CompositionSpec(
                composition_id,
                filename,
                64,
                36,
                30,
                6,
                profile,
                loop,
            )
            for composition_id, filename, profile, loop in definitions
        ),
        {},
        17,
    )


def stage_valid_delivery(output: Path, manifest: RenderManifest) -> dict[str, bytes]:
    media = {}
    assets = []
    for spec in manifest.compositions:
        payload = f"validated-{spec.id}".encode()
        (output / spec.filename).write_bytes(payload)
        media[spec.filename] = payload
        assets.append(
            {
                "id": spec.id,
                "path": str(output / spec.filename),
                "filename": spec.filename,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "ok": True,
                "findings": [],
            }
        )
    (output / "validation-report.json").write_text(
        json.dumps({"schemaVersion": 1, "ok": True, "assets": assets}),
        encoding="utf-8",
    )
    review = output / "REVISION-VISUAL"
    review.mkdir()
    (review / "contact.png").write_bytes(b"tiny-review")
    return media


def build_tiny_renderer(renderer: Path, manifest: RenderManifest) -> dict[str, bytes]:
    (renderer / "src" / "swu_obs_anim").mkdir(parents=True)
    (renderer / "tests").mkdir()
    originals = renderer / "assets" / "original"
    originals.mkdir(parents=True)
    (renderer / "proofs" / "ignored").mkdir(parents=True)
    (renderer / "snapshots").mkdir()
    (renderer / "src" / "swu_obs_anim" / "__pycache__").mkdir()

    (renderer / "render.py").write_text("print('tiny')\n", encoding="utf-8")
    render_shell = renderer / "render.sh"
    render_shell.write_text("#!/bin/sh\nexec python3 render.py \"$@\"\n", encoding="utf-8")
    render_shell.chmod(0o755)
    (renderer / "requirements.txt").write_text("Pillow==12.3.0\n", encoding="utf-8")
    (renderer / "render-manifest.json").write_text(
        json.dumps(
            {
                "compositions": [spec.__dict__ for spec in manifest.compositions]
            }
        ),
        encoding="utf-8",
    )
    (renderer / "src" / "swu_obs_anim" / "core.py").write_text(
        "VALUE = 1\n", encoding="utf-8"
    )
    (renderer / "tests" / "test_core.py").write_text(
        "def test_core(): pass\n", encoding="utf-8"
    )
    (renderer / "proofs" / "ignored" / "proof.mp4").write_bytes(b"proof")
    (renderer / "snapshots" / "old.py").write_text("old = True\n", encoding="utf-8")
    (renderer / "src" / "swu_obs_anim" / "__pycache__" / "core.pyc").write_bytes(
        b"cache"
    )

    source_entries = []
    original_bytes = {}
    for index, source_id in enumerate(SOURCE_IDS):
        filename = f"source-{index}.bin"
        payload = f"original-{source_id}".encode()
        (originals / filename).write_bytes(payload)
        original_bytes[filename] = payload
        source_entries.append(
            {
                "id": source_id,
                "path": str(renderer.parent / "unavailable" / filename),
                "copyAs": filename,
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    (renderer / "source-manifest.json").write_text(
        json.dumps({"schemaVersion": 1, "sources": source_entries}),
        encoding="utf-8",
    )
    checkpoint_digest = hashlib.sha256(
        (renderer / "render.py").read_bytes()
    ).hexdigest()
    for number in range(1, 10):
        (renderer / f"CHECKPOINT-{number:02d}.sha256").write_text(
            f"{checkpoint_digest}  work/swu-animation-renderer/render.py\n",
            encoding="utf-8",
        )
    return original_bytes


class PackagingTests(unittest.TestCase):
    def test_checkpoint_revalidates_completed_staged_master_after_source_mutation(self):
        import swu_obs_anim.package as package_module

        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)
            checkpointed_source = renderer / "render.py"
            original_copy_regular = package_module._copy_regular
            mutation_observed = False

            def mutate_after_checkpoint_validation(
                source, destination, *, executable=False
            ):
                nonlocal mutation_observed
                if source == checkpointed_source and not mutation_observed:
                    checkpointed_source.write_text(
                        "print('mutated-after-checkpoint-validation')\n",
                        encoding="utf-8",
                    )
                    mutation_observed = True
                return original_copy_regular(
                    source, destination, executable=executable
                )

            with patch(
                "swu_obs_anim.package._copy_regular",
                side_effect=mutate_after_checkpoint_validation,
            ):
                with self.assertRaisesRegex(
                    ValueError, "staged checkpoint digest mismatch"
                ):
                    package_delivery(manifest, renderer, output)

            self.assertTrue(mutation_observed)
            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions
                },
                expected_media,
            )
            for name in (
                "LEEME-Animaciones-OBS.md",
                "MANIFIESTO-Archivos.txt",
                "MASTER-FUENTES",
                "RESPALDO-COMPATIBILIDAD",
                "SHA256SUMS.txt",
            ):
                self.assertFalse((output / name).exists())

    def test_checkpoint_rejects_correct_digest_for_file_excluded_from_master(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            stage_valid_delivery(output, manifest)
            excluded = renderer / "proofs" / "ignored" / "proof.mp4"
            digest = hashlib.sha256(excluded.read_bytes()).hexdigest()
            (renderer / "CHECKPOINT-01.sha256").write_text(
                f"{digest}  work/swu-animation-renderer/proofs/ignored/proof.mp4\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "master allowlist"):
                package_delivery(manifest, renderer, output)

            self.assertFalse((output / "MASTER-FUENTES").exists())

    def test_checkpoint_rejects_symlink_in_intermediate_path_component(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            stage_valid_delivery(output, manifest)
            real_src = renderer / "real-src"
            (renderer / "src").rename(real_src)
            (renderer / "src").symlink_to(real_src, target_is_directory=True)
            referenced = renderer / "src" / "swu_obs_anim" / "core.py"
            digest = hashlib.sha256(referenced.read_bytes()).hexdigest()
            (renderer / "CHECKPOINT-01.sha256").write_text(
                f"{digest}  work/swu-animation-renderer/src/swu_obs_anim/core.py\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "symlink.*checkpoint"):
                package_delivery(manifest, renderer, output)

            self.assertFalse((output / "MASTER-FUENTES").exists())

    def test_checkpoint_rejects_symlink_in_final_path_component(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            stage_valid_delivery(output, manifest)
            linked = renderer / "tests" / "test_link.py"
            linked.symlink_to(renderer / "render.py")
            digest = hashlib.sha256(linked.read_bytes()).hexdigest()
            (renderer / "CHECKPOINT-01.sha256").write_text(
                f"{digest}  tests/test_link.py\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValueError, "symlink.*checkpoint"):
                package_delivery(manifest, renderer, output)

            self.assertFalse((output / "MASTER-FUENTES").exists())

    def test_checkpoint_rejects_digest_mismatch_for_allowed_file(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            stage_valid_delivery(output, manifest)
            (renderer / "CHECKPOINT-01.sha256").write_text(
                f"{'0' * 64}  render.py\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(ValueError, "checkpoint digest mismatch"):
                package_delivery(manifest, renderer, output)

            self.assertFalse((output / "MASTER-FUENTES").exists())

    def test_missing_media_fails_without_creating_support_files(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            (output / "validation-report.json").write_text(
                json.dumps({"ok": True, "assets": []}), encoding="utf-8"
            )

            with self.assertRaisesRegex(ValueError, "missing.*media"):
                package_delivery(manifest, renderer, output)

            self.assertEqual(
                {path.name for path in output.iterdir()}, {"validation-report.json"}
            )

    def test_validation_report_must_have_top_level_ok_and_seven_passing_assets(self):
        manifest = tiny_manifest()
        invalid_reports = (
            {"ok": False, "assets": []},
            {"ok": True, "assets": [{"id": "ambient", "ok": True}]},
            {
                "ok": True,
                "assets": [
                    {"id": spec.id, "ok": spec.id != "stinger"}
                    for spec in manifest.compositions
                ],
            },
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            expected_media = {}
            for spec in manifest.compositions:
                payload = f"validated-{spec.id}".encode()
                (output / spec.filename).write_bytes(payload)
                expected_media[spec.filename] = payload

            for report in invalid_reports:
                with self.subTest(report=report):
                    (output / "validation-report.json").write_text(
                        json.dumps(report), encoding="utf-8"
                    )
                    with self.assertRaisesRegex(ValueError, "validation report"):
                        package_delivery(manifest, renderer, output)
                    self.assertEqual(
                        {
                            spec.filename: (output / spec.filename).read_bytes()
                            for spec in manifest.compositions
                        },
                        expected_media,
                    )
                    self.assertFalse((output / "LEEME-Animaciones-OBS.md").exists())

    def test_validation_report_digest_must_match_current_media_bytes(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)
            changed = manifest.compositions[0]
            (output / changed.filename).write_bytes(b"replaced-after-validation")

            with self.assertRaisesRegex(ValueError, "digest.*does not match"):
                package_delivery(manifest, renderer, output)

            self.assertEqual(
                (output / changed.filename).read_bytes(), b"replaced-after-validation"
            )
            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions[1:]
                },
                {
                    spec.filename: expected_media[spec.filename]
                    for spec in manifest.compositions[1:]
                },
            )
            self.assertFalse((output / "LEEME-Animaciones-OBS.md").exists())

    def test_validation_report_filename_must_match_manifest_asset(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            stage_valid_delivery(output, manifest)
            report_path = output / "validation-report.json"
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["assets"][0]["filename"] = manifest.compositions[1].filename
            report_path.write_text(json.dumps(report), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "filename.*does not match"):
                package_delivery(manifest, renderer, output)

            self.assertFalse((output / "LEEME-Animaciones-OBS.md").exists())

    def test_success_builds_portable_allowlisted_master_docs_and_verified_checksums(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            original_bytes = build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)

            result = package_delivery(manifest, renderer, output)

            self.assertEqual(result.output_directory, output)
            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions
                },
                expected_media,
            )
            guide = (output / "LEEME-Animaciones-OBS.md").read_text(encoding="utf-8")
            for required in (
                "1920×1080",
                "30 fps",
                "x=0, y=0",
                "x=420, y=37, 1080×1043",
                "Marcador",
                "frame 15 = 500 ms",
                "hardware decode OFF",
                "track matte OFF",
                "Hide rather than delete",
                "live URL",
                "ProRes",
            ):
                self.assertIn(required, guide)

            file_manifest = (output / "MANIFIESTO-Archivos.txt").read_text(
                encoding="utf-8"
            )
            for spec in manifest.compositions:
                self.assertIn(spec.filename, file_manifest)
            for required in ("Propósito", "Códec", "6 frames", "64x36", "30 fps"):
                self.assertIn(required, file_manifest)

            master = output / "MASTER-FUENTES"
            self.assertEqual(
                {
                    path.name: path.read_bytes()
                    for path in (master / "assets" / "original").iterdir()
                },
                original_bytes,
            )
            self.assertTrue(os.access(master / "render.sh", os.X_OK))
            self.assertFalse((master / "proofs").exists())
            self.assertFalse((master / "snapshots").exists())
            self.assertFalse((master / "src" / "swu_obs_anim" / "__pycache__").exists())
            for number in range(1, 10):
                checkpoint = master / f"CHECKPOINT-{number:02d}.sha256"
                digest, relative = checkpoint.read_text(encoding="utf-8").strip().split(
                    "  ", 1
                )
                self.assertEqual(relative, "render.py")
                self.assertEqual(
                    digest, hashlib.sha256((master / relative).read_bytes()).hexdigest()
                )
            self.assertTrue(
                (output / "RESPALDO-COMPATIBILIDAD" / "NO-REQUERIDO.txt").is_file()
            )

            checksum_path = output / "SHA256SUMS.txt"
            lines = checksum_path.read_text(encoding="utf-8").splitlines()
            relative_paths = [line.split("  ", 1)[1] for line in lines]
            self.assertNotIn("SHA256SUMS.txt", relative_paths)
            self.assertEqual(
                relative_paths,
                sorted(relative_paths, key=lambda item: (item.casefold().encode(), item.encode())),
            )
            self.assertEqual(
                set(relative_paths),
                {
                    path.relative_to(output).as_posix()
                    for path in output.rglob("*")
                    if path.is_file() and path != checksum_path
                },
            )
            for line in lines:
                digest, relative = line.split("  ", 1)
                self.assertEqual(
                    digest, hashlib.sha256((output / relative).read_bytes()).hexdigest()
                )

    @unittest.skipIf(
        os.environ.get("SWU_OBS_PACKAGED_SUITE_CHILD") == "1",
        "avoid recursively packaging the suite from its packaged child",
    )
    def test_complete_packaged_master_runs_its_copied_test_suite(self):
        manifest = load_render_manifest(ROOT / "render-manifest.json")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "delivery"
            output.mkdir()
            stage_valid_delivery(output, manifest)
            package_delivery(manifest, ROOT, output)
            master = output / "MASTER-FUENTES"

            # A delivered master is itself a supported renderer source. Its
            # checkpoints are already package-relative, so rebuilding support
            # from it must safely preserve and verify those portable entries.
            second_output = Path(directory) / "second-delivery"
            second_output.mkdir()
            stage_valid_delivery(second_output, manifest)
            package_delivery(manifest, master, second_output)
            second_master = second_output / "MASTER-FUENTES"
            for number in range(1, 10):
                checkpoint = second_master / f"CHECKPOINT-{number:02d}.sha256"
                for line in checkpoint.read_text(encoding="utf-8").splitlines():
                    digest, relative = line.split("  ", 1)
                    self.assertFalse(Path(relative).is_absolute())
                    self.assertNotIn("..", Path(relative).parts)
                    self.assertEqual(
                        digest,
                        hashlib.sha256(
                            (second_master / relative).read_bytes()
                        ).hexdigest(),
                    )

            unsafe_output = Path(directory) / "unsafe-second-delivery"
            unsafe_output.mkdir()
            stage_valid_delivery(unsafe_output, manifest)
            checkpoint_one = master / "CHECKPOINT-01.sha256"
            original_checkpoint = checkpoint_one.read_bytes()
            digest = original_checkpoint.decode("utf-8").split("  ", 1)[0]
            try:
                checkpoint_one.write_text(
                    f"{digest}  ../render-manifest.json\n", encoding="utf-8"
                )
                with self.assertRaisesRegex(ValueError, "unsafe checkpoint"):
                    package_delivery(manifest, master, unsafe_output)
            finally:
                checkpoint_one.write_bytes(original_checkpoint)
            self.assertFalse((unsafe_output / "MASTER-FUENTES").exists())

            source_manifest_path = master / "source-manifest.json"
            source_manifest = json.loads(
                source_manifest_path.read_text(encoding="utf-8")
            )
            for source in source_manifest["sources"]:
                source["path"] = str(master / "unavailable-external" / source["copyAs"])
            source_manifest_path.write_text(
                json.dumps(source_manifest), encoding="utf-8"
            )
            environment = os.environ.copy()
            environment["SWU_OBS_PACKAGED_SUITE_CHILD"] = "1"
            environment["PYTHONDONTWRITEBYTECODE"] = "1"
            environment["PATH"] = (
                str(Path(sys.executable).parent)
                + os.pathsep
                + environment.get("PATH", "")
            )

            completed = subprocess.run(
                [str(master / "render.sh"), "test"],
                cwd=master,
                env=environment,
                capture_output=True,
                text=True,
                timeout=60,
            )

        self.assertEqual(
            completed.returncode,
            0,
            f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
        )

    def test_post_publish_failure_removes_partial_support_and_preserves_media(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)

            with patch(
                "swu_obs_anim.package.verify_package_checksums",
                side_effect=ValueError("simulated checksum failure"),
            ):
                with self.assertRaisesRegex(ValueError, "simulated checksum failure"):
                    package_delivery(manifest, renderer, output)

            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions
                },
                expected_media,
            )
            for name in (
                "LEEME-Animaciones-OBS.md",
                "MANIFIESTO-Archivos.txt",
                "MASTER-FUENTES",
                "RESPALDO-COMPATIBILIDAD",
                "SHA256SUMS.txt",
            ):
                self.assertFalse((output / name).exists())

    def test_rollback_preserves_support_replaced_by_another_owner(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)
            replaced = output / "LEEME-Animaciones-OBS.md"

            def replace_published_support_then_fail(*_args, **_kwargs):
                replaced.unlink()
                replaced.write_text("concurrent replacement\n", encoding="utf-8")
                raise ValueError("simulated failure after takeover")

            with patch(
                "swu_obs_anim.package.verify_package_checksums",
                side_effect=replace_published_support_then_fail,
            ):
                with self.assertRaisesRegex(ValueError, "after takeover"):
                    package_delivery(manifest, renderer, output)

            self.assertEqual(
                replaced.read_text(encoding="utf-8"), "concurrent replacement\n"
            )
            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions
                },
                expected_media,
            )
            for name in (
                "MANIFIESTO-Archivos.txt",
                "MASTER-FUENTES",
                "RESPALDO-COMPATIBILIDAD",
                "SHA256SUMS.txt",
            ):
                self.assertFalse((output / name).exists())

    def test_package_command_accepts_output_directory_and_dispatches_packager(self):
        import swu_obs_anim.__main__ as command_line

        output = Path("/explicit/tiny-delivery")
        packaged = PackageResult(output, ("ambient.mp4",))
        stdout = StringIO()
        stderr = StringIO()
        with patch(
            "swu_obs_anim.package.package_delivery", return_value=packaged
        ) as package:
            status = command_line.main(
                ["package", "--output-dir", str(output)],
                stdout=stdout,
                stderr=stderr,
            )

        self.assertEqual(status, 0, stderr.getvalue())
        package.assert_called_once()
        arguments = package.call_args.args
        self.assertEqual(arguments[1:], (command_line.ROOT, output))
        self.assertIn("1 files", stdout.getvalue())

    def test_symlink_traversal_is_rejected_and_partial_support_is_cleaned(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)
            outside = root / "outside"
            outside.mkdir()
            (outside / "secret.txt").write_text("not package content", encoding="utf-8")
            (output / "REVISION-VISUAL" / "escape").symlink_to(
                outside, target_is_directory=True
            )

            with self.assertRaisesRegex(ValueError, "symlink"):
                package_delivery(manifest, renderer, output)

            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions
                },
                expected_media,
            )
            self.assertFalse((output / "MASTER-FUENTES").exists())

    def test_dangling_support_symlink_is_existing_and_never_overwritten(self):
        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            stage_valid_delivery(output, manifest)
            target = output / "LEEME-Animaciones-OBS.md"
            target.symlink_to(root / "missing-target")

            with self.assertRaisesRegex(FileExistsError, "refusing to overwrite"):
                package_delivery(manifest, renderer, output)

            self.assertTrue(target.is_symlink())
            self.assertEqual(os.readlink(target), str(root / "missing-target"))

    def test_concurrent_support_target_created_during_staging_is_not_clobbered(self):
        import swu_obs_anim.package as package_module

        manifest = tiny_manifest()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            renderer = root / "renderer"
            output = root / "delivery"
            renderer.mkdir()
            output.mkdir()
            build_tiny_renderer(renderer, manifest)
            expected_media = stage_valid_delivery(output, manifest)
            target = output / "LEEME-Animaciones-OBS.md"
            original_build_master = package_module._build_master

            def build_master_then_race(renderer_root, master):
                original_build_master(renderer_root, master)
                target.write_text("concurrent-owner\n", encoding="utf-8")

            with patch(
                "swu_obs_anim.package._build_master",
                side_effect=build_master_then_race,
            ):
                with self.assertRaisesRegex(FileExistsError, "refusing to overwrite"):
                    package_delivery(manifest, renderer, output)

            self.assertEqual(target.read_text(encoding="utf-8"), "concurrent-owner\n")
            self.assertEqual(
                {
                    spec.filename: (output / spec.filename).read_bytes()
                    for spec in manifest.compositions
                },
                expected_media,
            )
            for name in (
                "MANIFIESTO-Archivos.txt",
                "MASTER-FUENTES",
                "RESPALDO-COMPATIBILIDAD",
                "SHA256SUMS.txt",
            ):
                self.assertFalse((output / name).exists())


if __name__ == "__main__":
    unittest.main()
