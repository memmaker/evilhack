# Entry for roguelikes-index/killers/make.py (RVIP stage 9), same as
# web/publish/killers-make.patch (git apply it in roguelikes-index).
# Place after `def slashem(): ...` and append `evilhack()` to the run-all line.
# Needs ~/Games/evilhack with web/build.sh run (web/gen/src/tile.c,
# web/gen/include/pm.h, web/dist/tiles.png). Run only this game:
#     cd ~/Games/roguelikes-index/killers && python3 make.py evilhack
# Output is pixel-identical to web/publish/killers/evilhack/ (killers-make.py,
# stdlib); copying that folder to killers/evilhack/ is equivalent.
# Tested in a scratch copy of roguelikes (HOME pointed at a fake ~/Games): 559 PNGs.
import os, re
from PIL import Image
G = os.path.expanduser('~/Games')
HERE = os.path.dirname(os.path.abspath(__file__))
def slug(s): return re.sub('[^a-z0-9]', '-', s.lower())

def evilhack():                                       # web/gen (build.sh): glyph2tile[PM] in src/tile.c, name at that tile in win/share/monsters.txt; tiles.png 16px, 40/row
    h = G + '/evilhack'
    n = int(re.search(r'#define\s+NUMMONS\s+(\d+)', open(h + '/web/gen/include/pm.h').read()).group(1))
    g2t = [int(v) for v in open(h + '/web/gen/src/tile.c').read().split('glyph2tile[MAX_GLYPH] = {')[1].split('}')[0].split(',') if v.strip()]
    names = {int(t): m for t, m in re.findall(r'^# tile (\d+) \(([^)]+)\)', open(h + '/win/share/monsters.txt').read(), re.M)}
    img, d, seen = Image.open(h + '/web/dist/tiles.png').convert('RGB'), os.path.join(HERE, 'evilhack'), set()
    os.makedirs(d, exist_ok=True)
    for t in g2t[:n]:
        if slug(names[t]) in seen: continue          # werejackal etc.: both forms share the name
        seen.add(slug(names[t])); x, y = t % 40 * 16, t // 40 * 16
        img.crop((x, y, x + 16, y + 16)).resize((32, 32), Image.NEAREST).save(os.path.join(d, slug(names[t]) + '.png'), optimize=True)
    print('evilhack', len(os.listdir(d)))
