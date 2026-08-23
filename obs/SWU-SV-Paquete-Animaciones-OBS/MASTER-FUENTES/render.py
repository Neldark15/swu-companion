import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from swu_obs_anim.__main__ import main


if __name__ == "__main__":
    raise SystemExit(main())
