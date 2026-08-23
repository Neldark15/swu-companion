import hashlib
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.assets import verify_and_copy_sources
from swu_obs_anim.config import load_source_manifest


class AssetTests(unittest.TestCase):
    def test_verified_sources_are_copied_with_pinned_logo_hash(self):
        manifest = load_source_manifest(ROOT / "source-manifest.json")
        manifest = replace(
            manifest,
            sources=tuple(
                replace(
                    source,
                    path=ROOT / "assets" / "original" / source.copy_as,
                )
                for source in manifest.sources
            ),
        )
        with tempfile.TemporaryDirectory() as temporary_directory:
            bundle = verify_and_copy_sources(manifest, Path(temporary_directory))
            copies = list((Path(temporary_directory) / "assets" / "original").iterdir())
            self.assertEqual(len(copies), 6)
            logo = next(source for source in manifest.sources if source.id == "logo-png")
            copied_logo = Path(temporary_directory) / "assets" / "original" / logo.copy_as
            self.assertEqual(
                hashlib.sha256(copied_logo.read_bytes()).hexdigest(), logo.sha256
            )
            self.assertEqual(set(bundle.images), {source.id for source in manifest.sources})


if __name__ == "__main__":
    unittest.main()
