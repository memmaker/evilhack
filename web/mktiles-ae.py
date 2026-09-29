#!/usr/bin/env python3
"""Absurdly Evil tileset (Lemrent, floor tile John Shaw) -> web/tiles-ae.png.
usage: mktiles-ae.py "Absurdly Evil 93.bmp" web/tiles-ae.png
The 64 px BMP has the game's own tile order (monsters, objects, other, grey
statues from tile 1407: 1974 tiles, 40 per row) followed by extra race/role
sheets the game does not use. Keep the first 1974, no scaling (the page scales at run time).
(An 8-bit-free RGB PNG keeps the size sane.)"""
import sys
from PIL import Image
TOTAL, PER = 1974, 40
im = Image.open(sys.argv[1]).convert('RGB')
rows = -(-TOTAL // PER)
im = im.crop((0, 0, PER * 64, rows * 64))
im.save(sys.argv[2], optimize=True)
print(sys.argv[2], im.size)
