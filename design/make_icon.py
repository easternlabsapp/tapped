"""Pixel-art app icon: a globe with a faucet handle on top and a spout on the side."""
from PIL import Image
import math

N = 48
BG = [(0x0B, 0x1F, 0x3A), (0x0C, 0x2D, 0x45), (0x0D, 0x3A, 0x50), (0x0E, 0x4C, 0x5A)]
OUT = (0x04, 0x0E, 0x1C)
OCEAN, OCEAN_D, OCEAN_L = (0x38, 0xD0, 0xE0), (0x0A, 0x7F, 0xA6), (0x9A, 0xF0, 0xF7)
LAND, LAND_D = (0x5C, 0xCB, 0x6A), (0x2E, 0x9A, 0x52)
METAL, METAL_D, METAL_L = (0xB4, 0xC3, 0xD2), (0x7C, 0x90, 0xA6), (0xF4, 0xF8, 0xFB)
SHADOW = (0x06, 0x14, 0x24)

img = Image.new("RGB", (N, N))
px = img.load()
for y in range(N):
    for x in range(N):
        px[x, y] = BG[min(3, y * 4 // N)]

def put(x, y, c):
    if 0 <= x < N and 0 <= y < N: px[x, y] = c

def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): put(x, y, c)

def boxed(x0, y0, x1, y1, fill, light, dark):
    rect(x0, y0, x1, y1, OUT); rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)
    rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, light); rect(x0 + 1, y1 - 1, x1 - 1, y1 - 1, dark)

cx, cy, r = 18.5, 29.5, 14.5
inside = lambda x, y: math.hypot(x - cx, y - cy) <= r
# continents as blobs (ellipses), clipped to the globe
blobs = [(12, 24, 5.5, 4.5), (14, 31, 3.5, 5.5), (13, 36, 2, 2.5), (25, 25, 4, 3.5), (27, 31, 3.5, 4.5), (24, 37, 2.5, 2)]
for y in range(N):
    for x in range(N):
        if not inside(x, y): continue
        edge = any(not inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge: put(x, y, OUT); continue
        c = OCEAN
        if any(((x - bx) / a) ** 2 + ((y - by) / b) ** 2 <= 1 for bx, by, a, b in blobs): c = LAND
        if (x - cx) + (y - cy) > 11:                     # shaded lower-right
            c = LAND_D if c == LAND else OCEAN_D
        put(x, y, c)
for x, y in [(11, 18), (12, 17), (13, 17), (14, 17), (10, 19), (10, 20), (11, 19)]:
    if px[x, y] == OCEAN: put(x, y, OCEAN_L)

# spigot handle: four-spoke wheel with round knobs, hub and screw, on a short stem
boxed(16, 14, 21, 18, METAL, METAL_L, METAL_D)
shape = set()
def disc(cx_, cy_, rr):
    for y in range(N):
        for x in range(N):
            if math.hypot(x - cx_, y - cy_) <= rr: shape.add((x, y))
for x in range(5, 33): shape.update({(x, 7), (x, 8), (x, 9)})          # horizontal spokes
for y in range(3, 14): shape.update({(17, y), (18, y), (19, y)})       # vertical spokes (foreshortened)
disc(5.5, 8, 3.3); disc(31.5, 8, 3.3); disc(18, 3.5, 2.8); disc(18, 13, 2.8)   # knobs
disc(18, 8, 5.4)                                                        # hub
edge = {(x + dx, y + dy) for x, y in shape for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - shape
for x, y in edge: put(x, y, OUT)
for x, y in shape:
    c = METAL
    if (x, y - 1) not in shape: c = METAL_L
    elif (x, y + 1) not in shape: c = METAL_D
    put(x, y, c)
for x, y in [(x, y) for y in range(N) for x in range(N) if math.hypot(x - 18, y - 8) <= 2.3]: put(x, y, METAL_D)
for x, y in [(17, 7), (18, 7), (17, 8)]: put(x, y, METAL_L)
rect(13, 5, 14, 5, METAL_L) if False else None
# spout out of the side, bending down
boxed(31, 22, 41, 26, METAL, METAL_L, METAL_D)
boxed(38, 22, 42, 35, METAL, METAL_L, METAL_D)
boxed(36, 33, 44, 37, METAL, METAL_L, METAL_D)
# falling drop
drop = [(40, 39), (40, 40), (39, 41), (40, 41), (41, 41), (38, 42), (39, 42), (40, 42), (41, 42), (42, 42),
        (38, 43), (39, 43), (40, 43), (41, 43), (42, 43), (39, 44), (40, 44), (41, 44), (40, 45)]
for x, y in drop: put(x, y, OCEAN)
for x, y in [(39, 42), (39, 43), (38, 43)]: put(x, y, OCEAN_L)
for x, y in [(42, 43), (41, 44), (42, 42)]: put(x, y, OCEAN_D)

img.resize((1024, 1024), Image.NEAREST).save("icon-pixel-spigot48-1024.png")
