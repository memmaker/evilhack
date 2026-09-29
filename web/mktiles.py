#!/usr/bin/env python3
"""Tile sheet for the web page (RVIP stage 4), stdlib only.

usage: mktiles.py <nhtiles.bmp from util/tile2bmp> <src/tile.c> <out.png>

util/tile2bmp reads win/share/{monsters,objects,other}.txt (it checks every
tile name against the game's own monst.c/objects.c/defsyms order and stops
on a mismatch), then the monsters again in grey for statues: 16x16 cells,
40 per row. This converts that 8-bit BMP to PNG unchanged (no scaling; the
page scales by whole multiples, nearest-neighbour) except the tiles'
backdrop colour (71,108,108) becomes black like the text map. It asserts
that every glyph2tile[] entry (and every substitute tile) of the game's
src/tile.c points at a tile in the sheet.
"""
import re
import struct
import sys
import zlib

TILE = 16
BACKDROP = (71, 108, 108)


def read_bmp(fn):
    d = open(fn, 'rb').read()
    assert d[:2] == b'BM', 'not a BMP'
    off, = struct.unpack_from('<I', d, 10)
    hs, w, h, _, bpp = struct.unpack_from('<IiiHH', d, 14)
    ncol, = struct.unpack_from('<I', d, 46)
    assert bpp == 8, 'expected an 8-bit BMP, got %d' % bpp
    ncol = ncol or 256
    pal = [tuple(d[14 + hs + 4 * i + j] for j in (2, 1, 0)) for i in range(ncol)]
    stride = (w + 3) & ~3
    rows = []
    for y in range(abs(h)):
        sy = abs(h) - 1 - y if h > 0 else y        # bottom-up unless h < 0
        rows.append(d[off + sy * stride: off + sy * stride + w])
    return w, abs(h), pal, rows


def write_png(fn, w, h, pal, rows):
    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    raw = b''.join(b'\0' + bytes(r) for r in rows)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 3, 0, 0, 0))
    png += chunk(b'PLTE', b''.join(bytes(c) for c in pal))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(fn, 'wb').write(png)


def main():
    bmp, tilec, out = sys.argv[1:4]
    w, h, pal, rows = read_bmp(bmp)
    assert w % TILE == 0, 'sheet is not made of 16x16 cells'
    per_row = w // TILE
    src = open(tilec).read()
    g2t = [int(v) for v in re.search(r'glyph2tile\[MAX_GLYPH\] = \{(.*?)\};', src, re.S).group(1).replace(',', ' ').split()]
    subs = [int(v) for m in re.finditer(r'short std_tiles\d+\[\] = \{(.*?)\};', src, re.S)
            for v in m.group(1).replace(',', ' ').split()]
    nmon = int(re.search(r'#define MAXMONTILE (\d+)', src).group(1)) + 1
    noth = int(re.search(r'#define MAXOTHTILE (\d+)', src).group(1)) + 1
    total = int(re.search(r'total_tiles_used = (\d+)', src).group(1))
    top = max(g2t + subs)
    assert min(g2t) >= 0, 'a glyph has no tile (glyph2tile -1)'
    assert top < total <= (h // TILE) * per_row, 'glyph2tile points past the sheet (%d)' % top
    h = -(-total // per_row) * TILE        # tile2bmp pads the bitmap: keep used rows
    rows = rows[:h]
    pal = [(0, 0, 0) if c == BACKDROP else c for c in pal]
    write_png(out, w, h, pal, rows)
    print('%s: %dx%d, %d per row, %d tiles, %d glyphs -> tiles 0..%d (%d monster tiles, %d up to other)'
          %(out, w, h, per_row, total, len(g2t), top, nmon, noth))


main()
