import math

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import numpy as np

from ..motion import loop_phase, periodic_offset, pulse_window, seeded_stars


COBALT = (28, 105, 230)
CYAN = (80, 218, 255)
STAR_SEED_LEFT = 20260816
STAR_SEED_RIGHT = 20260817
_BASE_CACHE = {}


def render_ambient(frame, context) -> Image.Image:
    spec = context.manifest.by_id("ambient")
    phase = loop_phase(frame, spec.frames) % 1.0
    size = (spec.width, spec.height)
    base = _resized_base(context.assets.images["camera-background"], size)
    brightness = 1.0 + 0.04 * math.sin(phase * math.tau)
    canvas = ImageEnhance.Brightness(base).enhance(brightness).convert("RGBA")

    table = context.manifest.protected_regions["table"]
    _draw_scenic_stars(canvas, phase, table)
    _draw_volcano_halos(canvas, phase)
    _draw_sweeps(canvas, phase)
    return canvas.convert("RGB")


def _resized_base(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    key = (id(source), size)
    if key not in _BASE_CACHE:
        resized = source.convert("RGB").resize(size, Image.Resampling.LANCZOS)
        pixels = np.array(resized)
        red = pixels[:, :, 0].astype(np.uint16)
        green = pixels[:, :, 1].astype(np.uint16)
        blue = pixels[:, :, 2].astype(np.uint16)
        static_red = (red * 100 > green * 135) & (red * 100 > blue * 135)
        pixels[static_red, 0] = pixels[static_red, 2]
        pixels[static_red, 1] = np.maximum(pixels[static_red, 1], red[static_red] // 2)
        pixels[static_red, 2] = red[static_red]
        _BASE_CACHE[key] = (source, Image.fromarray(pixels))
    return _BASE_CACHE[key][1]


def _draw_scenic_stars(canvas: Image.Image, phase: float, table) -> None:
    width, height = canvas.size
    x0, _, x1, _ = table
    scale_x = width / 1920.0
    scale_y = height / 1080.0
    drift_x = periodic_offset(phase, min(2.5, 2.5 * scale_x))
    drift_y = periodic_offset(phase, min(1.5, 1.5 * scale_y), 2.0)
    count = max(12, round(52 * width * height / (1920 * 1080)))
    zones = (
        (STAR_SEED_LEFT, (0, 0, max(1, x0), height)),
        (STAR_SEED_RIGHT, (min(width - 1, x1), 0, width, height)),
    )

    for seed, zone in zones:
        zx0, zy0, zx1, zy1 = zone
        if zx1 <= zx0 or zy1 <= zy0:
            continue
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        inset = max(3, round(4 * scale_x))
        bounds = (zx0 + inset, zy0 + inset, max(zx0 + inset, zx1 - inset), max(zy0 + inset, zy1 - inset))
        for star in seeded_stars(seed, count, bounds):
            radius = max(0.6, star.radius * max(scale_x, scale_y))
            x = star.x + drift_x
            y = star.y + drift_y
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=(180, 220, 255, star.alpha),
            )
        clipped = layer.crop(zone)
        canvas.alpha_composite(clipped, (zx0, zy0))


def _draw_volcano_halos(canvas: Image.Image, phase: float) -> None:
    width, height = canvas.size
    scale_x = width / 1920.0
    scale_y = height / 1080.0
    breathing = 0.5 + 0.5 * math.sin(phase * math.tau * 2.0)
    halo = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(halo)
    for center_x in (340, 1600):
        cx = center_x * scale_x
        cy = 731 * scale_y
        rx = 76 * scale_x
        ry = 31 * scale_y
        draw.ellipse(
            (cx - rx, cy - ry, cx + rx, cy + ry),
            fill=(*CYAN, round(10 + 10 * breathing)),
        )
    halo = halo.filter(ImageFilter.GaussianBlur(max(1.0, 20 * max(scale_x, scale_y))))
    canvas.alpha_composite(halo)


def _draw_sweeps(canvas: Image.Image, phase: float) -> None:
    width, height = canvas.size
    scale_y = height / 1080.0
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    line_width = max(1, round(3 * scale_y))
    length = max(20, round(width * 0.16))

    upper = pulse_window(phase, 0.38, 0.18)
    if upper:
        progress = _window_progress(phase, 0.38, 0.18)
        head = round(progress * (width + length))
        draw.line(
            ((head - length, round(44 * scale_y)), (head, round(44 * scale_y))),
            fill=(*COBALT, round(42 * upper)),
            width=line_width,
        )

    lower = pulse_window(phase, 0.68, 0.18)
    if lower:
        progress = _window_progress(phase, 0.68, 0.18)
        head = round(width + length - progress * (width + length))
        draw.line(
            ((head, round(1037 * scale_y)), (head + length, round(1037 * scale_y))),
            fill=(*CYAN, round(38 * lower)),
            width=line_width,
        )
    canvas.alpha_composite(layer)


def _window_progress(phase: float, center: float, width: float) -> float:
    start = (center - width / 2) % 1.0
    return ((phase - start) % 1.0) / width
