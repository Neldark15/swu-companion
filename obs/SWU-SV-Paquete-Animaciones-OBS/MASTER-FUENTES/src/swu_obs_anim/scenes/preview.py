"""Direct, deterministic 40-second preview composition."""

from PIL import Image, ImageDraw

from .ambient import render_ambient
from .energy_frame import render_energy_frame
from .holographic_logo import render_holographic_logo
from .holding import render_holding
from .stinger import render_stinger


DARK_NAVY = (4, 11, 27)
LIGHT_GRAY = (214, 220, 228)
CHECKER_DARK = (18, 25, 42)
CHECKER_LIGHT = (184, 192, 204)
AMBIENT_END_SECONDS = 8
ENERGY_END_SECONDS = 14
LOGO_END_SECONDS = 20
STINGER_END_SECONDS = 24
STARTING_END_SECONDS = 32
BREAK_END_SECONDS = 40
STINGER_SLOT_SECONDS = 2


def render_preview(frame, context) -> Image.Image:
    """Render one frame of the preview without reading encoded final media."""
    spec = context.manifest.by_id("preview")
    if frame < 0 or frame >= spec.frames:
        raise ValueError("frame outside composition")

    size = (spec.width, spec.height)
    ambient_end = AMBIENT_END_SECONDS * spec.fps
    energy_end = ENERGY_END_SECONDS * spec.fps
    logo_end = LOGO_END_SECONDS * spec.fps
    stinger_end = STINGER_END_SECONDS * spec.fps
    starting_end = STARTING_END_SECONDS * spec.fps
    expected_frames = BREAK_END_SECONDS * spec.fps
    if spec.frames != expected_frames:
        raise ValueError(
            f"preview must be {BREAK_END_SECONDS} seconds at {spec.fps} fps"
        )

    if frame < ambient_end:
        return render_ambient(frame, context).convert("RGB")
    if frame < energy_end:
        return _composite(
            _split_background(size), render_energy_frame(frame - ambient_end, context)
        )
    if frame < logo_end:
        return _composite(
            _checkerboard(size), render_holographic_logo(frame - energy_end, context)
        )
    if frame < stinger_end:
        background = _split_background(size)
        repeat_frame = (frame - logo_end) % (STINGER_SLOT_SECONDS * spec.fps)
        stinger_frames = context.manifest.by_id("stinger").frames
        if repeat_frame < stinger_frames:
            return _composite(background, render_stinger(repeat_frame, context))
        return background
    if frame < starting_end:
        return render_holding(
            frame - stinger_end, context, "EMPEZAMOS PRONTO", 1.0
        ).convert("RGB")
    return render_holding(
        frame - starting_end, context, "VOLVEMOS PRONTO", 0.7
    ).convert("RGB")


def _split_background(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGB", size, DARK_NAVY)
    ImageDraw.Draw(image).rectangle(
        (size[0] // 2, 0, size[0], size[1]), fill=LIGHT_GRAY
    )
    return image


def _checkerboard(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGB", size, CHECKER_DARK)
    draw = ImageDraw.Draw(image)
    cell = max(8, round(min(size) / 12))
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle(
                    (x, y, min(x + cell, size[0]), min(y + cell, size[1])),
                    fill=CHECKER_LIGHT,
                )
    return image


def _composite(background: Image.Image, foreground: Image.Image) -> Image.Image:
    canvas = background.convert("RGBA")
    canvas.alpha_composite(foreground.convert("RGBA"))
    return canvas.convert("RGB")
