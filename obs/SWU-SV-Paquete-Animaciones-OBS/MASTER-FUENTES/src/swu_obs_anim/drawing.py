from PIL import Image, ImageDraw, ImageFilter


def draw_glow_line(canvas, points, color, width=3, glow=12, alpha=180):
    glow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.line(points, fill=(*color, alpha // 2), width=width + glow, joint="curve")
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(glow / 2))
    canvas.alpha_composite(glow_layer)
    ImageDraw.Draw(canvas).line(points, fill=(*color, alpha), width=width, joint="curve")


def draw_tracked_text(draw, center_x, y, text, font, fill, tracking):
    widths = [draw.textlength(char, font=font) for char in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = center_x - total / 2
    for char, width in zip(text, widths):
        draw.text((x, y), char, font=font, fill=fill, anchor="la")
        x += width + tracking


def clear_protected_regions(image, regions):
    for x0, y0, x1, y1 in regions:
        image.paste((0, 0, 0, 0), (x0, y0, x1, y1))
    return image
