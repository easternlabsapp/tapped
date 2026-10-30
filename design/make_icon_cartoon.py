"""Cartoon app icon: a globe with a faucet handle on top and a spout on the side.
Drawn at 3x and downsampled for smooth edges. Output: icon-1024.png"""
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import math

SS, W = 3, 1024
S = W * SS
def u(v): return int(v * SS)

def lerp(a, b, t): return tuple(round(x + (y - x) * t) for x, y in zip(a, b))

def gradient(box, c0, c1, vertical=True, radial=None):
    x0, y0, x1, y1 = box
    g = Image.new("RGB", (S, S))
    px = ImageDraw.Draw(g)
    if radial:
        cx, cy, rr = radial
        # concentric circles, outer first
        for i in range(60, -1, -1):
            t = i / 60
            col = lerp(c0, c1, t)
            r = rr * t
            px.ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), fill=col)
        return g
    n = u(y1 - y0) if vertical else u(x1 - x0)
    for i in range(max(n, 1)):
        col = lerp(c0, c1, i / max(n - 1, 1))
        if vertical: px.line((0, u(y0) + i, S, u(y0) + i), fill=col)
        else: px.line((u(x0) + i, 0, u(x0) + i, S), fill=col)
    return g

def mask_of(draw_fn):
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m), 255)
    return m

canvas = gradient((0, 0, W, W), (0x0B, 0x1F, 0x3A), (0x0E, 0x56, 0x68))
# soft glow behind the globe
glow = Image.new("L", (S, S), 0)
ImageDraw.Draw(glow).ellipse((u(60), u(250), u(800), u(990)), fill=110)
glow = glow.filter(ImageFilter.GaussianBlur(u(70)))
canvas.paste(Image.new("RGB", (S, S), (0x38, 0xD0, 0xE0)), mask=glow.point(lambda v: v * 0.45))

OUTLINE = (0x08, 0x16, 0x2B)
def part(draw_fn, fill_img, grow=14):
    """Draw a shape with a dark cartoon outline, filled by fill_img."""
    outer = mask_of(lambda d, c: draw_fn(d, c, grow))
    canvas.paste(Image.new("RGB", (S, S), OUTLINE), mask=outer)
    inner = mask_of(lambda d, c: draw_fn(d, c, 0))
    canvas.paste(fill_img, mask=inner)
    return inner

def rrect(x0, y0, x1, y1, r):
    return lambda d, c, g=0: d.rounded_rectangle((u(x0 - g), u(y0 - g), u(x1 + g), u(y1 + g)), radius=u(r + g), fill=c)

METAL_L, METAL_D = (0xF2, 0xF7, 0xFB), (0x8A, 0xA0, 0xB6)
def metal_h(x0, x1): return gradient((x0, 0, x1, W), METAL_L, METAL_D, vertical=False)
def metal_v(y0, y1): return gradient((0, y0, W, y1), METAL_L, METAL_D, vertical=True)

# spout (drawn first so the globe overlaps its base)
part(rrect(560, 505, 850, 625, 50), metal_v(505, 625))
part(rrect(790, 505, 905, 790, 45), metal_h(790, 905))
part(rrect(760, 735, 935, 825, 40), metal_v(735, 825))

# globe
GC, GR = (400, 640), 290
def circle(d, c, g=0): d.ellipse((u(GC[0] - GR - g), u(GC[1] - GR - g), u(GC[0] + GR + g), u(GC[1] + GR + g)), fill=c)
ocean = gradient(None, (0x9A, 0xF0, 0xF7), (0x0A, 0x6E, 0xA0), radial=(GC[0] - 90, GC[1] - 110, GR * 1.75)) if False else None
# radial ocean: light at upper-left, deep at lower-right
ocean = Image.new("RGB", (S, S))
od = ImageDraw.Draw(ocean)
for i in range(80, -1, -1):
    t = i / 80
    r = GR * 2.0 * t
    cx, cy = GC[0] - 110 * (1 - t) - 60, GC[1] - 130 * (1 - t) - 60
    od.ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), fill=lerp((0x8F, 0xEE, 0xF8), (0x0B, 0x6F, 0xB5), t))
globe_mask = part(circle, ocean)

def smooth(points, n=3):
    for _ in range(n):
        out = []
        for i, p in enumerate(points):
            q = points[(i + 1) % len(points)]
            out += [(0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1])]
        points = out
    return points

continents = [
    [(250, 470), (330, 420), (400, 440), (430, 510), (390, 560), (410, 640), (370, 720), (320, 800), (290, 740), (300, 650), (240, 590), (210, 520)],
    [(480, 520), (560, 470), (640, 500), (690, 580), (660, 660), (610, 700), (590, 780), (540, 820), (510, 750), (530, 660), (490, 600)],
    [(300, 860), (360, 830), (420, 850), (400, 900), (330, 910)],
]
land = Image.new("L", (S, S), 0)
ld = ImageDraw.Draw(land)
for pts in continents:
    ld.polygon([(u(x - 30), u(y)) for x, y in smooth(pts)], fill=255)
land = ImageChops.multiply(land, globe_mask)
land_fill = gradient((0, 380, W, 940), (0x6B, 0xD9, 0x72), (0x2A, 0x9A, 0x4E))
# darker coast line
shore = ImageChops.subtract(land, land.filter(ImageFilter.MinFilter(u(14) | 1)))
canvas.paste(Image.new("RGB", (S, S), (0x1F, 0x7F, 0x45)), mask=shore)
canvas.paste(land_fill, mask=land.filter(ImageFilter.MinFilter(u(8) | 1)))

# shading + glass highlight on the globe
shade = Image.new("L", (S, S), 0)
sd = ImageDraw.Draw(shade)
sd.ellipse((u(GC[0] - GR + 90), u(GC[1] - GR + 90), u(GC[0] + GR + 90), u(GC[1] + GR + 90)), fill=0)
inv = Image.new("L", (S, S), 90)
sd.rectangle((0, 0, S, S), fill=90)
sd.ellipse((u(GC[0] - GR - 60), u(GC[1] - GR - 70), u(GC[0] + GR - 10), u(GC[1] + GR - 20)), fill=0)
shade = ImageChops.multiply(shade.filter(ImageFilter.GaussianBlur(u(40))), globe_mask)
canvas.paste(Image.new("RGB", (S, S), (0x05, 0x2A, 0x55)), mask=shade)
hl = Image.new("L", (S, S), 0)
ImageDraw.Draw(hl).ellipse((u(200), u(390), u(370), u(470)), fill=170)
hl = hl.rotate(28, center=(u(285), u(430))).filter(ImageFilter.GaussianBlur(u(5)))
canvas.paste(Image.new("RGB", (S, S), (255, 255, 255)), mask=ImageChops.multiply(hl, globe_mask))

# handle on top (stem, then wheel)
part(rrect(365, 215, 435, 360, 18), metal_h(365, 435))
part(rrect(240, 130, 560, 225, 46), metal_v(130, 225))

# falling drop
def drop(d, c, g=0):
    cx, top, bot = 848, 845, 968
    cyc, rad = bot - 48, 48
    d.polygon([(u(cx), u(top - g * 1.6)), (u(cx - rad - g), u(cyc)), (u(cx + rad + g), u(cyc))], fill=c)
    d.ellipse((u(cx - rad - g), u(cyc - rad - g), u(cx + rad + g), u(cyc + rad + g)), fill=c)
part(drop, gradient((0, 850, W, 965), (0x9A, 0xF0, 0xF7), (0x1F, 0xA8, 0xD0)), grow=10)

canvas.resize((W, W), Image.LANCZOS).save("icon-1024.png")
