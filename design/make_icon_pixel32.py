"""Pixel-art app icon (32x32 grid): globe with green continents, wheel-handle spigot and spout."""
from PIL import Image
import math

N = 32
BG0, BG1 = (0x0B, 0x1F, 0x3A), (0x0E, 0x4C, 0x5A)
OUT = (0x04, 0x0E, 0x1C)
OCEAN, OCEAN_D, OCEAN_L = (0x38, 0xD0, 0xE0), (0x0A, 0x7F, 0xA6), (0x9A, 0xF0, 0xF7)
LAND, LAND_D = (0x5C, 0xCB, 0x6A), (0x2E, 0x9A, 0x52)
METAL, METAL_D, METAL_L = (0xC9, 0xD6, 0xE2), (0x8C, 0xA0, 0xB3), (0xF4, 0xF8, 0xFB)

img = Image.new("RGB", (N, N))
px = img.load()
for y in range(N):
    band = min(3, y * 4 // N)
    t = band / 3
    for x in range(N):
        px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BG0, BG1))

DY = 0

def put(x, y, c):
    y += DY
    if 0 <= x < N and 0 <= y < N: px[x, y] = c

def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): put(x, y, c)

cx, cy, r = 12.5, 19.5, 9.5
land = {
    *[(x, y) for y in range(12, 16) for x in range(7, 11)], (11, 13), (11, 14), (6, 14), (6, 15),
    *[(x, y) for y in range(16, 21) for x in range(9, 12)], (10, 21), (10, 22), (9, 20),
    *[(x, y) for y in range(13, 17) for x in range(15, 18)], (18, 14), (18, 15), (17, 17), (16, 18),
    *[(x, y) for y in range(20, 24) for x in range(16, 19)], (19, 21), (17, 24),
}
for y in range(N):
    for x in range(N):
        d = math.hypot(x - cx, y - cy)
        if d <= r:
            if d >= r - 1.1: c = OUT
            elif (x, y) in land: c = LAND_D if (x + y > 33) else LAND
            elif x + y > 34 or d > r - 2.2 and x + y > 30: c = OCEAN_D
            else: c = OCEAN
            put(x, y, c)
for (x, y) in [(8, 12), (9, 11), (10, 11), (7, 13)]:
    if (x, y) not in land: put(x, y, OCEAN_L)

DY = 1  # body sits one row lower to make room for the wheel handle (handle is drawn with DY = 0 below)
rect(21, 14, 27, 18, OUT); rect(21, 15, 26, 17, METAL); rect(21, 17, 26, 17, METAL_D); rect(22, 15, 24, 15, METAL_L)
rect(25, 14, 29, 24, OUT); rect(26, 15, 28, 23, METAL); rect(28, 16, 28, 23, METAL_D); rect(26, 15, 26, 22, METAL_L)
rect(24, 23, 30, 26, OUT); rect(25, 24, 29, 25, METAL); rect(29, 24, 29, 25, METAL_D); rect(25, 24, 26, 24, METAL_L)
DY = 0
for (x, y) in [(27, 28), (26, 29), (27, 29), (28, 29), (26, 30), (27, 30), (28, 30)]: put(x, y, OCEAN)
put(26, 29, OCEAN_L); put(26, 30, OCEAN_L); put(28, 30, OCEAN_D)
put(27, 27, OCEAN) if False else None

DY = 0
# spigot: wheel handle with four spokes on a short stem
def ell(x, y, rx, ry, cxw=12.5, cyw=4.6): return ((x - cxw) / rx) ** 2 + ((y - cyw) / ry) ** 2
rect(11, 8, 14, 11, OUT); rect(12, 8, 13, 11, METAL); rect(13, 9, 13, 11, METAL_D)
for y in range(0, 10):
    for x in range(2, 24):
        e = ell(x, y, 9.2, 4.3)
        if e <= 1: put(x, y, OUT)
for y in range(0, 10):
    for x in range(2, 24):
        if ell(x, y, 7.9, 3.2) <= 1: put(x, y, METAL_L if y <= 1 else (METAL_D if y >= 7 else METAL))
for y in range(0, 10):
    for x in range(2, 24):
        if ell(x, y, 5.6, 1.9) <= 1: put(x, y, OUT)
rect(8, 4, 17, 5, METAL)                       # horizontal spoke
rect(12, 2, 13, 7, METAL)                      # vertical spoke
rect(11, 3, 14, 6, METAL_D); rect(12, 4, 13, 5, METAL_L)   # hub

img.resize((1024, 1024), Image.NEAREST).save("icon-pixel-spigot-1024.png")
