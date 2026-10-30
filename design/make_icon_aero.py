"""App icon, Frutiger Aero / skeuomorphic style: a glossy glass orb of water with a drop at its centre.
Renders icon-aero-1024.png and a small-size preview."""
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import math

SS, W = 3, 1024
S = W * SS
u = lambda v: int(round(v * SS))
lerp = lambda a, b, t: tuple(round(x + (y - x) * t) for x, y in zip(a, b))

def solid(c): return Image.new("RGB", (S, S), c)
def new_mask(): return Image.new("L", (S, S), 0)
def blur(m, r): return m.filter(ImageFilter.GaussianBlur(u(r)))
def scale_mask(m, k): return m.point(lambda v: int(v * k))
def vgrad(y0, y1, stops):
    g = Image.new("RGB", (S, S)); d = ImageDraw.Draw(g)
    for y in range(S):
        t = min(1, max(0, (y / SS - y0) / (y1 - y0)))
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1: d.line((0, y, S, y), fill=lerp(c0, c1, (t - t0) / (t1 - t0) if t1 > t0 else 0)); break
    return g
def rgrad(cx, cy, rr, stops, ox=0, oy=0):
    """Radial gradient; centre of light at (cx+ox, cy+oy), radius rr, stops from centre (0) to edge (1)."""
    g = solid(stops[-1][1]); d = ImageDraw.Draw(g)
    for i in range(120, -1, -1):
        t = i / 120
        c = stops[-1][1]
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1: c = lerp(c0, c1, (t - t0) / (t1 - t0) if t1 > t0 else 0); break
        r_ = rr * t
        d.ellipse((u(cx + ox * (1 - t) - r_), u(cy + oy * (1 - t) - r_), u(cx + ox * (1 - t) + r_), u(cy + oy * (1 - t) + r_)), fill=c)
    return g

# ---- background: bright sky-to-deep-aqua with light rays and bokeh bubbles
img = vgrad(0, 1024, [(0, (0x7C, 0xDA, 0xFA)), (0.45, (0x1B, 0x9B, 0xE0)), (1, (0x04, 0x5A, 0xA6))])
rays = new_mask(); rd = ImageDraw.Draw(rays)
for x0, w in ((-100, 120), (150, 90), (380, 140), (640, 80)):
    rd.polygon([(u(x0), 0), (u(x0 + w), 0), (u(x0 + w + 520), u(1024)), (u(x0 + 140), u(1024))], fill=70)
img.paste(solid((255, 255, 255)), mask=scale_mask(blur(rays, 26), 0.55))
glowb = new_mask(); ImageDraw.Draw(glowb).ellipse((u(180), u(640), u(844), u(1180)), fill=255)
img.paste(solid((0x3B, 0xE8, 0xD4)), mask=scale_mask(blur(glowb, 90), 0.5))

def bubble(cx, cy, r, a=1.0):
    m = new_mask(); ImageDraw.Draw(m).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), fill=255)
    body = rgrad(cx, cy, r, [(0, (255, 255, 255)), (0.6, (0xC8, 0xF2, 0xFF)), (1, (0x7C, 0xD4, 0xF5))], ox=-r * 0.35, oy=-r * 0.35)
    img.paste(body, mask=scale_mask(m, 0.22 * a))
    rim = new_mask(); ImageDraw.Draw(rim).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), outline=255, width=max(2, u(r * 0.06)))
    img.paste(solid((255, 255, 255)), mask=scale_mask(rim, 0.55 * a))
    hl = new_mask(); ImageDraw.Draw(hl).ellipse((u(cx - r * 0.55), u(cy - r * 0.62), u(cx - r * 0.05), u(cy - r * 0.3)), fill=255)
    img.paste(solid((255, 255, 255)), mask=scale_mask(blur(hl, r * 0.04), 0.8 * a))
for b in ((120, 180, 44), (905, 120, 28), (170, 780, 30), (930, 560, 52), (860, 880, 24), (75, 470, 20), (780, 235, 18)):
    bubble(*b)

# ---- orb
cx, cy, r = 512, 548, 345
orb_mask = new_mask(); ImageDraw.Draw(orb_mask).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), fill=255)

# contact shadow + reflection glow on the "surface" beneath
sh = new_mask(); ImageDraw.Draw(sh).ellipse((u(cx - r * 0.8), u(cy + r + 18), u(cx + r * 0.8), u(cy + r + 70)), fill=255)
img.paste(solid((0x02, 0x1E, 0x4A)), mask=scale_mask(blur(sh, 22), 0.6))

# glass body: dark-edged, bright centre (as if backlit)
glass = rgrad(cx, cy, r * 1.02, [(0, (0xD8, 0xFA, 0xFF)), (0.55, (0x5F, 0xD6, 0xF0)), (0.9, (0x14, 0x7C, 0xC4)), (1, (0x08, 0x4A, 0x96))], ox=-50, oy=-70)
img.paste(glass, mask=orb_mask)

# water inside the orb: three wave layers, each with its own colour
def wave(level, amp, wl, ph, fill, alpha):
    top = cy + r - 2 * r * level; k = 2 * math.pi / (2 * r * wl)
    pts = [(u(cx - r - 20), u(cy + r + 20))]
    x = cx - r - 20
    while x <= cx + r + 20:
        pts.append((u(x), u(top + amp * math.sin(k * (x - cx) + ph)))); x += 3
    pts.append((u(cx + r + 20), u(cy + r + 20)))
    m = new_mask(); ImageDraw.Draw(m).polygon(pts, fill=255)
    img.paste(fill, mask=scale_mask(ImageChops.multiply(m, orb_mask), alpha))
wave(0.58, 20, 1.5, 0.3, solid((0xB8, 0xF6, 0xFF)), 0.55)
wave(0.53, 24, 1.15, 1.9, vgrad(cy - 60, cy + 200, [(0, (0x7A, 0xEC, 0xF8)), (1, (0x2D, 0xC0, 0xEE))]), 0.85)
wave(0.47, 28, 0.95, 3.3, vgrad(cy - 10, cy + r, [(0, (0x2C, 0xB4, 0xEC)), (0.6, (0x0E, 0x86, 0xD6)), (1, (0x06, 0x5C, 0xB0))]), 1.0)
# bright meniscus line along the surface of the front wave
men = new_mask(); md = ImageDraw.Draw(men)
top = cy + r - 2 * r * 0.46; k = 2 * math.pi / (2 * r * 0.95)
md.line([(u(x), u(top + 28 * math.sin(k * (x - cx) + 3.3))) for x in range(cx - r - 20, cx + r + 20, 3)], fill=255, width=u(6))
img.paste(solid((0xE8, 0xFF, 0xFF)), mask=scale_mask(ImageChops.multiply(blur(men, 1.5), orb_mask), 0.85))
# caustic glow in the lower water
caus = new_mask(); ImageDraw.Draw(caus).ellipse((u(cx - 190), u(cy + 120), u(cx + 190), u(cy + 330)), fill=255)
img.paste(solid((0x9F, 0xF4, 0xFF)), mask=scale_mask(ImageChops.multiply(blur(caus, 42), orb_mask), 0.55))
# rising bubbles in the water
for bx, by, br in ((330, 690, 20), (390, 760, 11), (690, 700, 16), (640, 790, 9), (300, 600, 8)):
    bm = new_mask(); ImageDraw.Draw(bm).ellipse((u(bx - br), u(by - br), u(bx + br), u(by + br)), fill=255)
    img.paste(solid((0xDF, 0xFB, 0xFF)), mask=scale_mask(bm, 0.28))
    ring = new_mask(); ImageDraw.Draw(ring).ellipse((u(bx - br), u(by - br), u(bx + br), u(by + br)), outline=255, width=u(2.5))
    img.paste(solid((255, 255, 255)), mask=scale_mask(ring, 0.8))

# glass: edge darkening (inner shadow), rim light, big specular and bottom bounce light
inner = new_mask(); ImageDraw.Draw(inner).ellipse((u(cx - r + 14), u(cy - r + 14), u(cx + r - 14), u(cy + r - 14)), fill=255)
edge = ImageChops.subtract(orb_mask, blur(inner, 20))
img.paste(solid((0x03, 0x2E, 0x6E)), mask=scale_mask(edge, 0.55))
rim = new_mask(); ImageDraw.Draw(rim).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), outline=255, width=u(8))
img.paste(vgrad(cy - r, cy + r, [(0, (255, 255, 255)), (0.5, (0xBF, 0xF0, 0xFF)), (1, (0x6A, 0xE6, 0xF2))]), mask=scale_mask(rim, 0.9))
cap = new_mask(); ImageDraw.Draw(cap).ellipse((u(cx - 255), u(cy - 322), u(cx + 255), u(cy - 95)), fill=255)
capfade = vgrad(cy - 322, cy - 95, [(0, (255, 255, 255)), (1, (0x20, 0x20, 0x20))]).convert("L")
cap = ImageChops.multiply(ImageChops.multiply(cap, capfade), orb_mask)
img.paste(solid((255, 255, 255)), mask=scale_mask(blur(cap, 1.5), 0.78))
sp2 = new_mask(); ImageDraw.Draw(sp2).ellipse((u(cx - 215), u(cy - 285), u(cx - 120), u(cy - 245)), fill=255)
sp2 = sp2.rotate(28, center=(u(cx - 168), u(cy - 265)))
img.paste(solid((255, 255, 255)), mask=scale_mask(blur(sp2, 3), 0.95))
bounce = new_mask(); ImageDraw.Draw(bounce).arc((u(cx - r + 30), u(cy - r + 30), u(cx + r - 30), u(cy + r - 30)), 35, 145, fill=255, width=u(16))
img.paste(solid((0xBF, 0xFF, 0xFF)), mask=scale_mask(ImageChops.multiply(blur(bounce, 7), orb_mask), 0.7))

# ---- glass drop at the centre
dx, dtop, dbot = cx, cy - 135, cy + 95
rad = (dbot - dtop) * 0.32
dcy = dbot - rad
dm = new_mask(); dd = ImageDraw.Draw(dm)
dd.polygon([(u(dx), u(dtop)), (u(dx - rad * 0.94), u(dcy - rad * 0.34)), (u(dx + rad * 0.94), u(dcy - rad * 0.34))], fill=255)
dd.ellipse((u(dx - rad), u(dcy - rad), u(dx + rad), u(dcy + rad)), fill=255)
img.paste(solid((0x02, 0x24, 0x58)), mask=scale_mask(blur(ImageChops.offset(dm, 0, u(14)), 12), 0.55))
dbody = rgrad(dx, dcy, rad * 1.5, [(0, (255, 255, 255)), (0.5, (0xE4, 0xFB, 0xFF)), (1, (0x7A, 0xDC, 0xF4))], ox=-rad * 0.3, oy=-rad * 0.9)
img.paste(dbody, mask=dm)
dedge = ImageChops.subtract(dm, blur(ImageChops.offset(dm, 0, 0).filter(ImageFilter.MinFilter(u(20) | 1)), 6))
img.paste(solid((0x2D, 0xA8, 0xE0)), mask=scale_mask(dedge, 0.65))
dr = new_mask(); drd = ImageDraw.Draw(dr)
drd.polygon([(u(dx), u(dtop)), (u(dx - rad * 0.94), u(dcy - rad * 0.34)), (u(dx + rad * 0.94), u(dcy - rad * 0.34)), (u(dx), u(dtop))], outline=255)
dh = new_mask(); ImageDraw.Draw(dh).ellipse((u(dx - rad * 0.68), u(dcy - rad * 0.6), u(dx - rad * 0.28), u(dcy + rad * 0.15)), fill=255)
dh = dh.rotate(12, center=(u(dx - rad * 0.48), u(dcy - rad * 0.2)))
img.paste(solid((255, 255, 255)), mask=scale_mask(blur(dh, 2), 0.95))
dbo = new_mask(); ImageDraw.Draw(dbo).arc((u(dx - rad * 0.8), u(dcy - rad * 0.8), u(dx + rad * 0.8), u(dcy + rad * 0.8)), 40, 140, fill=255, width=u(9))
img.paste(solid((0x9F, 0xE8, 0xFF)), mask=scale_mask(blur(dbo, 3), 0.8))

# ---- classic iOS-style top sheen across the whole tile
sheen = new_mask(); sg = ImageDraw.Draw(sheen)
sg.ellipse((u(-380), u(-880), u(1404), u(330)), fill=255)
img.paste(vgrad(0, 330, [(0, (255, 255, 255)), (1, (0xC8, 0xEE, 0xFF))]), mask=scale_mask(blur(sheen, 1.2), 0.26))

out = img.resize((W, W), Image.LANCZOS)
out.save("icon-aero-1024.png")
strip = Image.new("RGB", (480, 200), (0xD8, 0xDE, 0xE6)); x = 10
for sz in (180, 120, 60):
    t = out.resize((sz, sz), Image.LANCZOS); m = Image.new("L", (sz, sz), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sz, sz), radius=int(sz * 0.225), fill=255); strip.paste(t, (x, 10), m); x += sz + 14
strip.save("icon-aero-preview-small.png")
