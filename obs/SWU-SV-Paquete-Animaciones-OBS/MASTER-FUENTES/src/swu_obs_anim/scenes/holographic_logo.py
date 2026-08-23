import math

from PIL import Image, ImageDraw

from ..motion import loop_phase, pulse_window


LOGO_POSITION = (146, 2)
LOGO_SIZE = (128, 128)
RING_CENTER = (210, 66)
COBALT = (28, 105, 230)
CYAN = (74, 220, 255)
_LOGO_CACHE = {}


def render_holographic_logo(frame, context) -> Image.Image:
    spec = context.manifest.by_id("holographic-logo")
    phase = loop_phase(frame, spec.frames) % 1.0
    canvas = Image.new("RGBA", (spec.width, spec.height), (0, 0, 0, 0))

    _draw_segmented_rings(canvas, phase)
    emblem = _resized_logo(context.assets.images["logo-png"])
    canvas.alpha_composite(emblem, LOGO_POSITION)
    stable_alpha = canvas.getchannel("A")
    _draw_star_pulse(canvas, phase)
    _draw_reflection(canvas, emblem, phase)
    canvas.putalpha(stable_alpha)
    return canvas


def _resized_logo(source: Image.Image) -> Image.Image:
    key = id(source)
    cached = _LOGO_CACHE.get(key)
    if cached is None or cached[0] is not source:
        cached = (source, source.convert("RGBA").resize(LOGO_SIZE, Image.Resampling.LANCZOS))
        _LOGO_CACHE[key] = cached
    return cached[1]


def _draw_segmented_rings(canvas: Image.Image, phase: float) -> None:
    draw = ImageDraw.Draw(canvas)
    cx, cy = RING_CENTER
    rings = (
        (69, COBALT, phase * 360.0, 3, 34, 18),
        (76, CYAN, -phase * 270.0 + 14.0, 2, 24, 21),
    )
    for radius, color, rotation, width, segment, gap in rings:
        bounds = (cx - radius, cy - radius, cx + radius, cy + radius)
        angle = rotation
        while angle < rotation + 360.0:
            draw.arc(
                bounds,
                start=angle,
                end=min(angle + segment, rotation + 360.0),
                fill=(*color, 150),
                width=width,
            )
            angle += segment + gap


def _draw_star_pulse(canvas: Image.Image, phase: float) -> None:
    # 0.15 of an eight-second loop is exactly 1.2 seconds.
    intensity = pulse_window(phase, 0.42, 0.15)
    if not intensity:
        return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x, y = 242, 34
    radius = 2.0 + 8.0 * intensity
    alpha = round(220 * intensity)
    draw.line((x - radius, y, x + radius, y), fill=(235, 250, 255, alpha), width=1)
    draw.line((x, y - radius, x, y + radius), fill=(235, 250, 255, alpha), width=1)
    diagonal = radius * 0.45
    draw.line(
        (x - diagonal, y - diagonal, x + diagonal, y + diagonal),
        fill=(120, 225, 255, round(alpha * 0.72)),
        width=1,
    )
    canvas.alpha_composite(layer)


def _draw_reflection(canvas: Image.Image, emblem: Image.Image, phase: float) -> None:
    intensity = pulse_window(phase, 0.64, 0.14)
    if not intensity:
        return

    progress = _window_progress(phase, 0.64, 0.14)
    reflection = Image.new("RGBA", LOGO_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(reflection)
    head = round(-42 + progress * (LOGO_SIZE[0] + 84))
    draw.polygon(
        ((head - 26, 0), (head - 8, 0), (head + 34, 128), (head + 16, 128)),
        fill=(225, 250, 255, round(64 * intensity)),
    )
    reflection.putalpha(Image.composite(reflection.getchannel("A"), Image.new("L", LOGO_SIZE, 0), emblem.getchannel("A")))
    canvas.alpha_composite(reflection, LOGO_POSITION)


def _window_progress(phase: float, center: float, width: float) -> float:
    start = (center - width / 2) % 1.0
    return ((phase - start) % 1.0) / width
