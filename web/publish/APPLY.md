# Stages 7-9 on the Mac: what the cloud could not do

Cloud branch: `claude/nice-tesla-fyure4` of memmaker/evilhack-cloud. Everything
below needs ssh, the shared index repo or GitHub repo admin.

## 1. Selection page card + family tree (repo memmaker/roguelikes)

    cd ~/Games/roguelikes-index && git pull
    cp <evilhack>/web/publish/card.png img/evilhack.png
    cp -r <evilhack>/web/publish/shrine/evilhack.html <evilhack>/web/publish/shrine/evilhack shrine/   # stage 8 shrine
    patch -p1 < <evilhack>/web/publish/roguelikes-index.patch   # card (+Info), tree <li> (+✦), years.json, 41 -> 42
    ./order.py --fix && ./order.py                              # must be silent / OK

If the patch does not apply (index changed since), apply by hand:
`web/publish/card.html` after the last 2016-2018 card, `web/publish/tree.html`
as a child of NetHack right before the NetHack 5.0 `<li>`, the years.json entry
from the patch, bump "N classic roguelikes". Both snippets already carry the shrine links (card Info button, tree ✦); the
game page's `#bar h1` links to `../shrine/evilhack.html` since stage 5.

## 2. og tags

`web/index.html` already carries the `<!--og-->` block (made by og.py's second
loop in a scratch copy, image `img/evilhack.png`). Run `python3 og.py` (3.12+,
Chrome) in roguelikes-index anyway for the index page's own block (the count);
revert what it changes in other games' `web/index.html`; if it rewrote the
EvilHack block, keep one block only.

## 3. Commit, push, deploy, check

    cd ~/Games/roguelikes-index && git add img/evilhack.png index.html years.json shrine/evilhack.html shrine/evilhack && git commit -m "Add EvilHack card and tree entry" && git push && ./deploy.sh
    curl -s https://ruzzoli.de/roguelikes/ | diff - index.html
    curl -sI https://ruzzoli.de/roguelikes/shrine/evilhack.html | head -1     # 200; then click Info, ✦ and the game's EvilHack title
    cd <evilhack> && RVIP_WEB=~/Games/rvip-tools/web sh web/build.sh && sh web/deploy.sh
    curl -s https://ruzzoli.de/roguelikes/evilhack/ | grep og:image
    curl -s https://ruzzoli.de/roguelikes/evilhack/evilhack-core.wasm | md5; md5 web/dist/evilhack-core.wasm

Then the browser-pane visual check owed since stage 1 (tiles, windows, help,
sound heard once).

## 4. Repo split (RVIP 5.15)

The cloud clone is **shallow** (history starts 2026-06-11, 49 upstream commits
up to c444f6a in the clone). Unshallow first or the public repo lacks upstream
history: `git fetch --unshallow https://github.com/k21971/EvilHack master`.

    git clone --no-local <cloud clone> evilhack && cd evilhack
    git checkout -B main origin/claude/nice-tesla-fyure4
    git remote add upstream https://github.com/k21971/EvilHack && git fetch upstream
    git merge-base --is-ancestor c444f6a3ab1e9f16d0676961dba86f628e91c6ba main   # must succeed
    git filter-repo --refs c444f6a3ab1e9f16d0676961dba86f628e91c6ba..main \
        --path CLOUD.md --path LESSONS.md --path web/shots --invert-paths
    git remote remove origin
    gh repo create memmaker/evilhack --public --source . --push
    git rev-parse c444f6a3ab1e9f16d0676961dba86f628e91c6ba   # hash unchanged (only our range filtered)

Keep `web/publish/` in the public repo (card image, snippets and facts are
build/publish inputs and document the version); drop only the cloud procedure
files above (`CLOUD.md`, `LESSONS.md` after merging it into RVIP.md; there is
no `rvip/` dir or `web/shots/` in this repo, harmless to name). HANDOVER.md
stays. `build.sh` already defaults `RVIP_WEB` to `~/Games/rvip-tools/web`.
README/help quote only the upstream hash, which filtering our range keeps.
Then delete memmaker/evilhack-cloud and the remote cloud branch (the cloud
proxy cannot delete branches).

## 5. Stage 9: killer art, beacon live check

The game already reports each finished run (`src/end.c` `rvip_run_report`,
tested headless with the beacon blocked/unblocked). Killer art:

    cd ~/Games/roguelikes-index && git pull
    git apply <evilhack>/web/publish/killers-make.patch       # adds evilhack() to killers/make.py
    cd killers && python3 make.py evilhack                     # only this game; needs <evilhack>/web/gen + web/dist (build.sh); prints "evilhack 559"
    #   (equivalent: cp -r <evilhack>/web/publish/killers/evilhack killers/ ; same pixels)
    cd .. && git add killers/make.py killers/evilhack && git commit -m "Killer art for EvilHack" && git push && ./deploy.sh
    cd <evilhack> && git push && RVIP_WEB=~/Games/rvip-tools/web sh web/build.sh && sh web/deploy.sh
    curl -sI https://ruzzoli.de/roguelikes/killers/evilhack/jackal.png | head -1   # 200

If the patch does not apply, paste `web/publish/killers-make-snippet.py`'s
`evilhack()` after `def slashem()` and append `evilhack()` to the run-all line.
Non-monster killers ("starvation", "quit while already on Charon's boat", ...)
have no art: the graveyard falls back to text (CONTRACT.md).

Live check (a real browser, not the Claude one: its user agent is filtered):
open https://ruzzoli.de/roguelikes/evilhack/, play a few turns, `#quit` + `yes`,
DevTools Network shows `/roguelikes/beacon?g=evilhack&ev=quit&name=...&id=...&at=...`
answered 204; after the next cron (10 min) the run is in `data/runs.json` and
on `graveyard.html`. Never touch `/var/lib/roguelikes-stats/wins/`.
