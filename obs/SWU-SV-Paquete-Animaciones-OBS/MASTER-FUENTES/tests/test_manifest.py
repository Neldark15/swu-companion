import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.config import load_render_manifest, load_source_manifest


class ManifestTests(unittest.TestCase):
    def test_render_contract(self):
        manifest = load_render_manifest(ROOT / "render-manifest.json")
        expected = {
            "ambient": 600,
            "energy-frame": 360,
            "holographic-logo": 240,
            "stinger": 36,
            "starting": 600,
            "break": 600,
            "preview": 1200,
        }
        self.assertEqual({item.id: item.frames for item in manifest.compositions}, expected)
        self.assertTrue(all(item.width == 1920 for item in manifest.compositions))
        self.assertTrue(all(item.height == 1080 for item in manifest.compositions))
        self.assertTrue(all(item.fps == 30 for item in manifest.compositions))
        self.assertEqual(manifest.stinger_transition_frame, 17)

    def test_sources_are_absolute_and_hash_pinned(self):
        manifest = load_source_manifest(ROOT / "source-manifest.json")
        self.assertEqual(len(manifest.sources), 6)
        for source in manifest.sources:
            self.assertTrue(source.path.is_absolute())
            self.assertEqual(len(source.sha256), 64)


if __name__ == "__main__":
    unittest.main()
