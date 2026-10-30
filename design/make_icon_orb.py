"""App icon: a glass orb of water on the app's deep-blue background.
Renders icon-orb-1024.png (plain) and icon-orb-drop-1024.png (with a drop)."""
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import math

SS, W = 3, 1024
S = W * SS
u = lambda v: int(v * SS)
lerp = lambda a, b, t: tuple(round(x + (y - x) * t) for x, y in zip(a, b))
NAVY, TEAL = (0x0B, 0x1F, 0x3A), (0x0E, 0x4C, 0x5A)
AQUA, AQUA_DEEP, AQUA_LIGHT = (0x38, 0xD0, 0xE0), (0x0A, 0x7F, 0xA6), (0x9A, 0xF0, 0xF7)

def build(drop):
    bg = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S): d.line((0, y, S, y), fill=lerp(NAVY, TEAL, y / S))
    cx, cy, r = 512, 520, 330
    # glow behind the orb
    glow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glow).ellipse((u(cx - r - 40), u(cy - r - 40), u(cx + r + 40), u(cy + r + 40)), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(u(90)))
    bg.paste(Image.new("RGB", (S, S), AQUA), mask=glow.point(lambda v: int(v * 0.42)))
    # faint ripple rings
    rings = Image.new("L", (S, S), 0)
    rd = ImageDraw.Draw(rings)
    for k, a in ((1.17, 60), (1.36, 34)):
        rr = r * k
        rd.ellipse((u(cx - rr), u(cy - rr), u(cx + rr), u(cy + rr)), outline=a, width=u(5))
    bg.paste(Image.new("RGB", (S, S), (255, 255, 255)), mask=rings)

    # orb body: radial gradient, light upper-left
    orb = Image.new("RGB", (S, S))
    od = ImageDraw.Draw(orb)
    for i in range(90, -1, -1):
        t = i / 90
        rr = r * 1.9 * t
        ox, oy = cx - 120 * (1 - t) - 70, cy - 150 * (1 - t) - 90
        od.ellipse((u(ox - rr), u(oy - rr), u(ox + rr), u(oy + rr)), fill=lerp(AQUA_LIGHT, AQUA_DEEP, min(1, t * 1.05)))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), fill=255)

    # water: three wave layers, back to front
    water = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    wd = ImageDraw.Draw(water)
    layers = [((0x7B, 0xE8, 0xF2, 150), 0.60, 22, 1.5, 0.4), (AQUA + (190,), 0.53, 26, 1.15, 2.0), (AQUA_DEEP + (235,), 0.45, 30, 0.9, 3.4)]
    for col, level, amp, wl, ph in layers:
        top = cy + r - 2 * r * level
        k = 2 * math.pi / (2 * r * wl)
        pts = [(u(cx - r - 20), u(cy + r + 20))]
        x = cx - r - 20
        while x <= cx + r + 20:
            pts.append((u(x), u(top + amp * math.sin(k * (x - cx) + ph))))
            x += 4
        pts.append((u(cx + r + 20), u(cy + r + 20)))
        wd.polygon(pts, fill=col)
    orb.paste(water, mask=water.split()[3])

    # glass highlight and rim
    hl = Image.new("L", (S, S), 0)
    ImageDraw.Draw(hl).ellipse((u(cx - 230), u(cy - 280), u(cx + 10), u(cy - 170)), fill=150)
    hl = hl.rotate(24, center=(u(cx - 110), u(cy - 225))).filter(ImageFilter.GaussianBlur(u(7)))
    orb.paste(Image.new("RGB", (S, S), (255, 255, 255)), mask=ImageChops.multiply(hl, mask))
    rim = Image.new("L", (S, S), 0)
    ImageDraw.Draw(rim).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), outline=110, width=u(7))

    # orb drop shadow, then orb
    sh = Image.new("L", (S, S), 0)
    ImageDraw.Draw(sh).ellipse((u(cx - r), u(cy - r + 26), u(cx + r), u(cy + r + 26)), fill=130)
    bg.paste(Image.new("RGB", (S, S), (0x03, 0x0C, 0x1A)), mask=sh.filter(ImageFilter.GaussianBlur(u(30))))
    bg.paste(orb, mask=mask)
    bg.paste(Image.new("RGB", (S, S), (255, 255, 255)), mask=rim)

    if drop:  # a white drop above the waterline
        dm = Image.new("L", (S, S), 0)
        dd = ImageDraw.Draw(dm)
        dx, dtop, rad = cx, cy - 170, 70
        dcy = dtop + 200 - rad
        dd.polygon([(u(dx), u(dtop)), (u(dx - rad * 0.93), u(dcy - rad * 0.36)), (u(dx + rad * 0.93), u(dcy - rad * 0.36))], fill=255)
        dd.ellipse((u(dx - rad), u(dcy - rad), u(dx + rad), u(dcy + rad)), fill=255)
        bg.paste(Image.new("RGB", (S, S), (0x03, 0x0C, 0x1A)), mask=dm.filter(ImageFilter.GaussianBlur(u(10))).point(lambda v: int(v * 0.35)))
        bg.paste(Image.new("RGB", (S, S), (255, 255, 255)), mask=dm)
    return bg.resize((W, W), Image.LANCZOS)

build(False).save("icon-orb-1024.png")
build(True).save("icon-orb-drop-1024.png")
# small-size preview strip: 180, 120, 60 px
a, b = Image.open("icon-orb-1024.png"), Image.open("icon-orb-drop-1024.png")
strip = Image.new("RGB", (900, 200), (0xD8, 0xDE, 0xE6))
x = 10
for img in (a, b):
    for sz in (180, 120, 60):
        t = img.resize((sz, sz), Image.LANCZOS)
        m = Image.new("L", (sz, sz), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, sz, sz), radius=int(sz * 0.225), fill=255)
        strip.paste(t, (x, 10), m); x += sz + 12
    x += 24
strip.save("icon-orb-preview-small.png")
