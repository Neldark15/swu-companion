"""Loop-safe holding screens for the two pre-stream states."""

import math
import os
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from ..drawing import draw_tracked_text
from ..motion import loop_phase, seeded_stars


BASE_SIZE = (1920, 1080)
TITLE_PANEL = (520, 838, 1400, 926)
LOGO_CENTER = (960, 548)
LOGO_SAFE_RADIUS = 150
PROJECT_DIN_FONT = (
    Path(__file__).resolve().parents[3] / "assets" / "fonts" / "DIN Condensed Bold.ttf"
)
MACOS_DIN_FONT = Path("/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf")
FONT_FALLBACKS = (
    Path("/Library/Fonts/DIN Condensed Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"),
    Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
)
COBALT = (28, 105, 230)
COOL_WHITE = (232, 244, 255)
TITLE_COMPOSITIONS = {
    "EMPEZAMOS PRONTO": "starting",
    "VOLVEMOS PRONTO": "break",
}
_BANNER_CACHE = {}
_STAR_FIELD = seeded_stars(20260816, 58, (105, 170, 1815, 745))


def render_holding(frame, context, title, motion_scale) -> Image.Image:
    """Render an RGB holding screen, with the first and final frames identical."""
    if not title or motion_scale < 0:
        raise ValueError("title must be nonempty and motion_scale nonnegative")

    spec = _holding_spec(context, title)
    phase = loop_phase(frame, spec.frames)
    # Trigonometric functions at 2π are only approximately zero; pin both
    # endpoints to the same phase so an H.264 loop has byte-identical inputs.
    if frame == spec.frames - 1:
        phase = 0.0
    size = (spec.width, spec.height)
    scale_x = spec.width / BASE_SIZE[0]
    scale_y = spec.height / BASE_SIZE[1]

    canvas = _scaled_banner(context.assets.images["youtube-banner"], size).convert("RGBA")
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    _draw_drifting_stars(overlay, phase, motion_scale, scale_x, scale_y)
    _draw_orbital_arc(overlay, phase, motion_scale, scale_x, scale_y)
    _draw_floor_reflection(overlay, phase, motion_scale, scale_x, scale_y)
    _draw_title_panel(overlay, title, scale_x, scale_y)
    canvas.alpha_composite(overlay)
    return canvas.convert("RGB")


def _holding_spec(context, title):
    # The title identifies the only two holding contracts in the manifest.
    try:
        composition_id = TITLE_COMPOSITIONS[title]
    except KeyError as error:
        raise ValueError("unsupported holding-screen title") from error
    return context.manifest.by_id(composition_id)


def _scaled_banner(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    key = (id(source), size)
    cached = _BANNER_CACHE.get(key)
    if cached is None or cached[0] is not source:
        # Preserve the source geometry: 2048x1152 and 1920x1080 are both 16:9.
        source_width, source_height = source.size
        target_width, target_height = size
        factor = max(target_width / source_width, target_height / source_height)
        resized = source.convert("RGB").resize(
            (round(source_width * factor), round(source_height * factor)),
            Image.Resampling.LANCZOS,
        )
        left = (resized.width - target_width) // 2
        top = (resized.height - target_height) // 2
        cached = (source, resized.crop((left, top, left + target_width, top + target_height)))
        _BANNER_CACHE[key] = cached
    return cached[1]


def _draw_drifting_stars(layer, phase, motion_scale, scale_x, scale_y) -> None:
    draw = ImageDraw.Draw(layer)
    drift_x = 2.5 * motion_scale * math.sin(math.tau * phase)
    drift_y = 1.5 * motion_scale * math.sin(math.tau * phase + math.pi / 3)
    for star in _STAR_FIELD:
        if math.hypot(star.x - LOGO_CENTER[0], star.y - LOGO_CENTER[1]) < LOGO_SAFE_RADIUS:
            continue
        x = (star.x + drift_x * (0.5 + star.radius / 2)) * scale_x
        y = (star.y + drift_y * (0.5 + star.radius / 2)) * scale_y
        radius = max(1, round(star.radius * min(scale_x, scale_y)))
        alpha = round(star.alpha * 0.50)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(182, 228, 255, alpha))


def _draw_orbital_arc(layer, phase, motion_scale, scale_x, scale_y) -> None:
    center_x, center_y = LOGO_CENTER[0] * scale_x, LOGO_CENTER[1] * scale_y
    radius_x, radius_y = 262 * scale_x, 106 * scale_y
    bounds = (center_x - radius_x, center_y - radius_y, center_x + radius_x, center_y + radius_y)
    arc_layer = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(arc_layer)
    # A periodic oscillation closes with the same position *and velocity*.
    # motion_scale reduces angular amplitude for the calmer break screen;
    # it never produces a fractional rotation whose final frame must jump.
    rotation = 18.0 * motion_scale * math.sin(math.tau * phase)
    # The gap across the central insignia leaves the exact source logo untouched.
    for start, end, alpha in ((18, 145, 92), (202, 330, 70)):
        draw.arc(bounds, start + rotation, end + rotation, fill=(*COBALT, alpha), width=max(1, round(2 * scale_y)))
    _clear_logo_area(arc_layer, center_x, center_y, LOGO_SAFE_RADIUS * min(scale_x, scale_y))
    glow = arc_layer.filter(ImageFilter.GaussianBlur(max(1, round(5 * scale_y))))
    _clear_logo_area(glow, center_x, center_y, LOGO_SAFE_RADIUS * min(scale_x, scale_y))
    layer.alpha_composite(glow)
    layer.alpha_composite(arc_layer)


def _draw_floor_reflection(layer, phase, motion_scale, scale_x, scale_y) -> None:
    reflection = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(reflection)
    cx = LOGO_CENTER[0] * scale_x
    floor_y = 734 * scale_y
    breathe = 0.55 + 0.45 * (math.sin(math.tau * phase) + 1) / 2
    alpha = round(21 * breathe * motion_scale)
    draw.ellipse(
        (cx - 245 * scale_x, floor_y - 20 * scale_y, cx + 245 * scale_x, floor_y + 28 * scale_y),
        outline=(88, 187, 255, alpha),
        width=max(1, round(2 * scale_y)),
    )
    reflection = reflection.filter(ImageFilter.GaussianBlur(max(1, round(3 * scale_y))))
    layer.alpha_composite(reflection)


def _draw_title_panel(layer, title, scale_x, scale_y) -> None:
    x0, y0, x1, y1 = _scale_box(TITLE_PANEL, scale_x, scale_y)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=max(1, round(10 * scale_y)), fill=(2, 10, 28, 190), outline=(44, 116, 204, 128), width=max(1, round(scale_y)))
    rule_y = y1 - max(4, round(11 * scale_y))
    draw.line((x0 + round(28 * scale_x), rule_y, x1 - round(28 * scale_x), rule_y), fill=(*COBALT, 230), width=max(1, round(2 * scale_y)))
    font = _holding_font(max(1, round(68 * scale_y)))
    draw_tracked_text(
        draw,
        (x0 + x1) / 2,
        y0 + round(4 * scale_y),
        title,
        font,
        COOL_WHITE,
        7 * scale_x,
    )


def _scale_box(box, scale_x, scale_y):
    x0, y0, x1, y1 = box
    return (round(x0 * scale_x), round(y0 * scale_y), round(x1 * scale_x), round(y1 * scale_y))


def _clear_logo_area(layer, center_x, center_y, radius) -> None:
    """Keep effects strictly behind the source insignia, never painted over it."""
    mask = Image.new("L", layer.size, 255)
    ImageDraw.Draw(mask).ellipse(
        (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
        fill=0,
    )
    layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", layer.size, 0), mask))


def _font_candidates() -> tuple[str, ...]:
    """Resolve an optional user override before portable DIN-like fallbacks."""
    override = os.environ.get("SWU_OBS_FONT")
    candidates = [override] if override else []
    candidates.extend(str(path) for path in (PROJECT_DIN_FONT, MACOS_DIN_FONT, *FONT_FALLBACKS))
    return tuple(candidates)


@lru_cache(maxsize=32)
def _cached_holding_font(size: int, candidates: tuple[str, ...]):
    """Load once per size/source set; render calls do not reopen a font file."""
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def _holding_font(size: int):
    return _cached_holding_font(size, _font_candidates())
