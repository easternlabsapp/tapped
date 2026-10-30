"""Simplified app icon: one orb, one wave, one highlight on the app's deep-blue background."""
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import math

SS, W = 3, 1024
S = W * SS
u = lambda v: int(round(v * SS))
lerp = lambda a, b, t: tuple(round(x + (y - x) * t) for x, y in zip(a, b))
NAVY, TEAL = (0x0B, 0x1F, 0x3A), (0x0E, 0x4C, 0x5A)
AQUA, AQUA_DEEP, AQUA_LIGHT = (0x38, 0xD0, 0xE0), (0x0A, 0x7F, 0xA6), (0x9A, 0xF0, 0xF7)

bg = Image.new("RGB", (S, S)); d = ImageDraw.Draw(bg)
for y in range(S): d.line((0, y, S, y), fill=lerp(NAVY, TEAL, y / S))

cx, cy, r = 512, 512, 350
orb = Image.new("RGB", (S, S)); od = ImageDraw.Draw(orb)
for i in range(90, -1, -1):
    t = i / 90; rr = r * 1.9 * t
    ox, oy = cx - 120 * (1 - t) - 70, cy - 150 * (1 - t) - 90
    od.ellipse((u(ox - rr), u(oy - rr), u(ox + rr), u(oy + rr)), fill=lerp(AQUA_LIGHT, AQUA, min(1, t * 1.1)))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).ellipse((u(cx - r), u(cy - r), u(cx + r), u(cy + r)), fill=255)

# a single wave
top = cy + 30; k = 2 * math.pi / (2 * r * 1.25)
pts = [(u(cx - r - 20), u(cy + r + 20))]
x = cx - r - 20
while x <= cx + r + 20:
    pts.append((u(x), u(top + 34 * math.sin(k * (x - cx) + 0.6)))); x += 3
pts.append((u(cx + r + 20), u(cy + r + 20)))
water = Image.new("L", (S, S), 0); ImageDraw.Draw(water).polygon(pts, fill=255)
body = Image.new("RGB", (S, S)); bd = ImageDraw.Draw(body)
for y in range(S): bd.line((0, y, S, y), fill=lerp((0x1E, 0x9F, 0xC8), AQUA_DEEP, min(1, max(0, (y / SS - top) / (r)))))
orb.paste(body, mask=water)

# one soft highlight
hl = Image.new("L", (S, S), 0)
ImageDraw.Draw(hl).ellipse((u(cx - 235), u(cy - 285), u(cx + 5), u(cy - 175)), fill=140)
hl = hl.rotate(24, center=(u(cx - 115), u(cy - 230))).filter(ImageFilter.GaussianBlur(u(8)))
orb.paste(Image.new("RGB", (S, S), (255, 255, 255)), mask=ImageChops.multiply(hl, mask))
bg.paste(orb, mask=mask)

out = bg.resize((W, W), Image.LANCZOS)
out.save("icon-simple-1024.png")
strip = Image.new("RGB", (480, 200), (0xD8, 0xDE, 0xE6)); x = 10
for sz in (180, 120, 60):
    t = out.resize((sz, sz), Image.LANCZOS); m = Image.new("L", (sz, sz), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sz, sz), radius=int(sz * 0.225), fill=255); strip.paste(t, (x, 10), m); x += sz + 14
strip.save("icon-simple-preview-small.png")
