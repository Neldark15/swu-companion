import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.motion import loop_phase, periodic_offset, seeded_stars


class MotionTests(unittest.TestCase):
    def test_loop_endpoints_are_identical(self):
        self.assertEqual(loop_phase(0, 600), 0.0)
        self.assertEqual(loop_phase(599, 600), 1.0)
        self.assertAlmostEqual(
            periodic_offset(0.0, 3.0, 1.0), periodic_offset(1.0, 3.0, 1.0)
        )

    def test_seeded_stars_are_repeatable(self):
        self.assertEqual(
            seeded_stars(20260816, 12, (0, 0, 100, 100)),
            seeded_stars(20260816, 12, (0, 0, 100, 100)),
        )


if __name__ == "__main__":
    unittest.main()
