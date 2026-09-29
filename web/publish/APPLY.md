# Stage 7 on the Mac: what the cloud could not do

Cloud branch: `claude/nice-tesla-fyure4` of memmaker/evilhack-cloud. Everything
below needs ssh, the shared index repo or GitHub repo admin.

## 1. Selection page card + family tree (repo memmaker/roguelikes)

    cd ~/Games/roguelikes-index && git pull
    cp <evilhack>/web/publish/card.png img/evilhack.png
    patch -p1 < <evilhack>/web/publish/roguelikes-index.patch   # card, tree <li>, years.json, 41 -> 42
    ./order.py --fix && ./order.py                              # must be silent / OK

If the patch does not apply (index changed since), apply by hand:
`web/publish/card.html` after the last 2016-2018 card, `web/publish/tree.html`
as a child of NetHack right before the NetHack 5.0 `<li>`, the years.json entry
from the patch, bump "N classic roguelikes". No Info button until the shrine
(stage 8) exists.

## 2. og tags

`web/index.html` already carries the `<!--og-->` block (made by og.py's second
loop in a scratch copy, image `img/evilhack.png`). Run `python3 og.py` (3.12+,
Chrome) in roguelikes-index anyway for the index page's own block (the count);
revert what it changes in other games' `web/index.html`; if it rewrote the
EvilHack block, keep one block only.

## 3. Commit, push, deploy, check

    cd ~/Games/roguelikes-index && git add img/evilhack.png index.html years.json && git commit -m "Add EvilHack card and tree entry" && git push && ./deploy.sh
    curl -s https://ruzzoli.de/roguelikes/ | diff - index.html
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
