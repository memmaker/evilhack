#!/usr/bin/env python3
"""Killer art for the roguelikes graveyard (server/CONTRACT.md, RVIP stage 9).

From the build's own tile sheet (web/dist/tiles.png, 16 px cells, 40 per row,
written by web/mktiles.py) writes web/publish/killers/evilhack/<slug>.png,
32 px (nearest-neighbour 2x), one per monster the game has (PM 0..NUMMONS-1).
Tile index = glyph2tile[PM] from the generated web/gen/src/tile.c; the name at
that index comes from win/share/monsters.txt (tilemap checks it against
mons[].mname). slug = lowercase, every non [a-z0-9] -> '-', no collapsing.
Stdlib only. Run after web/build.sh:  python3 web/publish/killers-make.py
"""
import os, re, struct, sys, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHEET = os.path.join(ROOT, 'web/dist/tiles.png')
TILEC = os.path.join(ROOT, 'web/gen/src/tile.c')
PMH = os.path.join(ROOT, 'web/gen/include/pm.h')
TXT = os.path.join(ROOT, 'win/share/monsters.txt')
OUT = os.path.join(ROOT, 'web/publish/killers/evilhack')
CELL, PER_ROW, SCALE = 16, 40, 2


def slug(s):
    return re.sub('[^a-z0-9]', '-', s.lower())


def read_png(fn):
    d = open(fn, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', fn
    pos, idat, w, pal = 8, b'', 0, None
    while pos < len(d):
        n, typ = struct.unpack_from('>I4s', d, pos)
        body = d[pos + 8:pos + 8 + n]
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack_from('>IIBB', body)
            assert depth == 8 and ctype in (2, 3, 6), (depth, ctype)
            bpp = {2: 3, 3: 1, 6: 4}[ctype]
        elif typ == b'PLTE':
            pal = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif typ == b'IDAT':
            idat += body
        pos += 12 + n
    raw, stride, rows, prev = zlib.decompress(idat), w * bpp, [], bytearray(w * bpp)
    for y in range(h):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b, c = prev[i], prev[i - bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append([pal[line[x]] if pal and bpp == 1 else tuple(line[x * bpp:x * bpp + 3]) for x in range(w)])
        prev = line
    return rows


def write_png(fn, px):
    h, w = len(px), len(px[0])
    raw = b''.join(b'\0' + bytes(v for p in row for v in p) for row in px)
    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    with open(fn, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def main():
    nummons = int(re.search(r'#define\s+NUMMONS\s+(\d+)', open(PMH).read()).group(1))
    body = open(TILEC).read().split('glyph2tile[MAX_GLYPH] = {')[1].split('}')[0]
    g2t = [int(v) for v in body.split(',') if v.strip()]
    names = {int(t): n for t, n in re.findall(r'^# tile (\d+) \(([^)]+)\)', open(TXT).read(), re.M)}
    sheet = read_png(SHEET)
    os.makedirs(OUT, exist_ok=True)
    done = set()
    for pm in range(nummons):
        t, name = g2t[pm], names[g2t[pm]]
        s = slug(name)
        if s in done:          # werejackal etc.: human and animal form share the name
            continue
        done.add(s)
        x0, y0 = t % PER_ROW * CELL, t // PER_ROW * CELL
        px = [[sheet[y0 + y // SCALE][x0 + x // SCALE] for x in range(CELL * SCALE)] for y in range(CELL * SCALE)]
        write_png(os.path.join(OUT, s + '.png'), px)
    print('evilhack', len(done), 'of', nummons, 'monsters ->', OUT)


if __name__ == '__main__':
    sys.exit(main())
