import numpy as np
from PIL import Image

from ..motion import ease_in_out_cubic


COBALT = np.array((24.0, 86.0, 196.0), dtype=np.float32)
CYAN = np.array((64.0, 205.0, 238.0), dtype=np.float32)
DARK_NAVY = np.array((4.0, 11.0, 27.0), dtype=np.float32)
_RADIAL_CACHE = {}


def render_stinger(frame, context) -> Image.Image:
    spec = context.manifest.by_id("stinger")
    if frame < 0 or frame >= spec.frames:
        raise ValueError("frame outside composition")

    radial, x_axis, y_axis = _normalized_radial_distance(spec.width, spec.height)
    if frame <= 16:
        progress = ease_in_out_cubic(frame / 16.0)
        alpha = _closing_alpha(radial, progress)
        boundary = 1.0 - progress
    elif frame <= 19:
        alpha = np.ones(radial.shape, dtype=np.float32)
        boundary = 0.0
    else:
        progress = ease_in_out_cubic((frame - 20) / 15.0)
        alpha = _opening_alpha(radial, progress)
        boundary = progress

    rgb = _metal_rgb(radial, x_axis, y_axis, boundary, frame)
    rgba = np.empty((spec.height, spec.width, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.rint(alpha * 255.0).astype(np.uint8)
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def _normalized_radial_distance(width: int, height: int):
    key = (width, height)
    cached = _RADIAL_CACHE.get(key)
    if cached is None:
        x_axis = np.linspace(-1.0, 1.0, width, dtype=np.float32)
        y_axis = np.linspace(-1.0, 1.0, height, dtype=np.float32)
        x_grid, y_grid = np.meshgrid(x_axis, y_axis)
        radial = np.sqrt(x_grid * x_grid + y_grid * y_grid)
        radial /= radial.max()
        cached = (radial, x_grid, y_grid)
        _RADIAL_CACHE[key] = cached
    return cached


def _closing_alpha(radial: np.ndarray, progress: float) -> np.ndarray:
    cutoff = 1.0 - progress
    return _smooth_boundary(radial - cutoff)


def _opening_alpha(radial: np.ndarray, progress: float) -> np.ndarray:
    return _smooth_boundary(radial - progress)


def _smooth_boundary(distance: np.ndarray) -> np.ndarray:
    edge = 0.012
    value = np.clip(distance / edge + 0.5, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def _metal_rgb(
    radial: np.ndarray,
    x_axis: np.ndarray,
    y_axis: np.ndarray,
    boundary: float,
    frame: int,
) -> np.ndarray:
    brushed = 5.0 * np.sin((x_axis * 11.0 + y_axis * 4.0) * np.pi + frame * 0.19)
    vignette = np.clip(1.0 - radial, 0.0, 1.0) * 12.0
    rgb = DARK_NAVY + (brushed + vignette)[:, :, None]

    distance = np.abs(radial - boundary)
    cobalt_ring = np.clip(1.0 - distance / 0.045, 0.0, 1.0)[:, :, None]
    cyan_ring = np.clip(1.0 - np.abs(distance - 0.018) / 0.010, 0.0, 1.0)[:, :, None]
    rgb = rgb * (1.0 - cobalt_ring * 0.44) + COBALT * (cobalt_ring * 0.44)
    rgb = rgb * (1.0 - cyan_ring * 0.38) + CYAN * (cyan_ring * 0.38)

    # Thin broken spokes supply sparse metallic highlights without a white flash.
    spokes = (
        (np.abs(y_axis - x_axis * 0.34) < 0.0028)
        & (radial > 0.24)
        & (((np.floor(radial * 22) + frame) % 5) == 0)
    )
    rgb[spokes] = rgb[spokes] * 0.45 + 255.0 * 0.55
    return rgb
