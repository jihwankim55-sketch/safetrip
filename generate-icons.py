"""One-off icon generator for SafeTrip PWA. Produces icon-192.png and icon-512.png."""
import math
from PIL import Image, ImageDraw


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def make_icon(size: int) -> Image.Image:
    s = size / 512.0
    top = hex_to_rgb("3b82f6")
    bot = hex_to_rgb("1e40af")
    shield_outline = hex_to_rgb("1e3a8a")
    plane = hex_to_rgb("2563eb")

    # Vertical gradient as base.
    grad = Image.new("RGB", (size, size), top)
    pixels = grad.load()
    for y in range(size):
        c = lerp(top, bot, y / max(size - 1, 1))
        for x in range(size):
            pixels[x, y] = c

    # Rounded-square mask (radius ~19% of size — modern app-tile look).
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.19), fill=255)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(img)

    # Shield silhouette (smooth-ish polygon).
    shield = [
        (256,  88), (208, 100), (172, 116), (148, 128),
        (148, 264), (152, 304), (170, 344), (198, 378),
        (228, 406), (256, 428), (284, 406), (314, 378),
        (342, 344), (360, 304), (364, 264), (364, 128),
        (340, 116), (304, 100),
    ]
    shield_scaled = [(x * s, y * s) for x, y in shield]
    draw.polygon(shield_scaled, fill=(255, 255, 255, 255), outline=shield_outline)

    # Paper-plane silhouette, tilted -25° (pointing up-right).
    plane_local = [
        (-92,   2), (-18,  -6), ( 0, -56), ( 12, -56),
        ( 24,  -6), ( 92,   2), ( 24,  10), ( 18,  26),
        ( 34,  66), ( 18,  72), (  6,  34), (  0,  34),
        ( -6,  34), (-18,  72), (-34,  66), (-18,  26),
        (-24,  10),
    ]
    cx, cy = 256 * s, 268 * s
    angle = math.radians(-25)
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    scale = 0.92 * s
    plane_pts = []
    for px, py in plane_local:
        sx, sy = px * scale, py * scale
        rx = sx * cos_a - sy * sin_a
        ry = sx * sin_a + sy * cos_a
        plane_pts.append((cx + rx, cy + ry))
    draw.polygon(plane_pts, fill=plane)

    return img


if __name__ == "__main__":
    for sz in (192, 512):
        out = f"icon-{sz}.png"
        make_icon(sz).save(out, "PNG", optimize=True)
        print(f"wrote {out}")
