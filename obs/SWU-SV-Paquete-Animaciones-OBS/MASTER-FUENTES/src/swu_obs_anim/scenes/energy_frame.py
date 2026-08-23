from PIL import Image, ImageDraw
import numpy as np

from ..drawing import clear_protected_regions, draw_glow_line
from ..motion import loop_phase, pulse_window


COBALT = (28, 105, 230)
CYAN = (74, 220, 255)
RED = (224, 42, 50)
CODEC_ALPHA_GUARD = 8
_BASE_CACHE = {}


def render_energy_frame(frame, context) -> Image.Image:
    spec = context.manifest.by_id("energy-frame")
    phase = loop_phase(frame, spec.frames) % 1.0
    size = (spec.width, spec.height)
    canvas = _resized_frame(context.assets.images["stream-frame"], size).copy()
    regions = context.manifest.protected_regions
    padding = max(
        CODEC_ALPHA_GUARD,
        round(CODEC_ALPHA_GUARD * max(spec.width / 1920.0, spec.height / 1080.0)),
    )

    _draw_rail_pulses(canvas, phase, regions, padding)
    _draw_junction_nodes(canvas, phase, regions["table"], padding)
    _draw_indicators(canvas, phase, regions, padding)
    guarded_regions = [
        _expand_region(regions[name], padding, canvas.size)
        for name in ("table", "topHud", "bottomHud")
    ]
    return clear_protected_regions(canvas, guarded_regions)


def _resized_frame(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    key = (id(source), size)
    if key not in _BASE_CACHE:
        resized = source.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
        pixels = np.array(resized)
        red = pixels[:, :, 0].astype(np.uint16)
        green = pixels[:, :, 1].astype(np.uint16)
        blue = pixels[:, :, 2].astype(np.uint16)
        static_red = (
            (pixels[:, :, 3] > 0)
            & (red * 100 > green * 135)
            & (red * 100 > blue * 135)
        )
        pixels[static_red, 0] = pixels[static_red, 2]
        pixels[static_red, 1] = np.maximum(pixels[static_red, 1], red[static_red] // 2)
        pixels[static_red, 2] = red[static_red]
        _BASE_CACHE[key] = (source, Image.fromarray(pixels))
    return _BASE_CACHE[key][1]


def _draw_rail_pulses(canvas: Image.Image, phase: float, regions, padding: int) -> None:
    width, height = canvas.size
    top_hud = regions["topHud"]
    bottom_hud = regions["bottomHud"]
    scale_y = height / 1080.0
    line_width = max(3, round(3 * scale_y))
    glow = max(4, round(12 * scale_y))
    length = max(28, round(width * 0.16))
    upper_y = max(line_width // 2, top_hud[1] - padding - 2)
    lower_y = min(height - line_width // 2 - 1, bottom_hud[3] + padding + 2)

    upper = pulse_window(phase, 0.32, 0.24)
    if upper:
        progress = _window_progress(phase, 0.32, 0.24)
        head = round(progress * (width + length))
        draw_glow_line(
            canvas,
            ((head - length, upper_y), (head, upper_y)),
            COBALT,
            width=line_width,
            glow=glow,
            alpha=round(96 * upper),
        )

    lower = pulse_window(phase, 0.64, 0.24)
    if lower:
        progress = _window_progress(phase, 0.64, 0.24)
        head = round(width + length - progress * (width + length))
        draw_glow_line(
            canvas,
            ((head, lower_y), (head + length, lower_y)),
            CYAN,
            width=line_width,
            glow=glow,
            alpha=round(92 * lower),
        )


def _draw_junction_nodes(canvas: Image.Image, phase: float, table, padding: int) -> None:
    x0, y0, x1, y1 = table
    scale = max(canvas.width / 1920.0, canvas.height / 1080.0)
    radius = max(3, round(5 * scale))
    alpha = round(105 + 28 * pulse_window(phase, 0.50, 0.54))
    offset = padding + radius + 2
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for x, y in (
        (x0 - offset, y0 + offset),
        (x1 + offset, y0 + offset),
        (x0 - offset, y1 - offset),
        (x1 + offset, y1 - offset),
    ):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*CYAN, alpha))
    canvas.alpha_composite(layer)


def _draw_indicators(canvas: Image.Image, phase: float, regions, padding: int) -> None:
    width, height = canvas.size
    scale_x = width / 1920.0
    scale_y = height / 1080.0
    radius = max(2, round(3 * max(scale_x, scale_y)))
    draw = ImageDraw.Draw(canvas)
    lower_y = min(
        height - radius - 1,
        max(round(1018 * scale_y), regions["bottomHud"][3] + padding + radius),
    )
    indicators = (
        (0.23, round(28 * scale_x), round(258 * scale_y)),
        (0.77, round(1906 * scale_x), lower_y),
    )
    for center, x, y in indicators:
        intensity = pulse_window(phase, center, 0.12)
        if intensity:
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=(*RED, round(165 * intensity)),
            )


def _window_progress(phase: float, center: float, width: float) -> float:
    start = (center - width / 2) % 1.0
    return ((phase - start) % 1.0) / width


def _expand_region(region, padding: int, size: tuple[int, int]):
    x0, y0, x1, y1 = region
    width, height = size
    return (
        max(0, x0 - padding),
        max(0, y0 - padding),
        min(width, x1 + padding),
        min(height, y1 + padding),
    )
