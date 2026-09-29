# EvilHack: facts for the Docs folder (written in the cloud, no Docs folder there)

- **Version line:** Based on EvilHack 0.9.3 · k21971/EvilHack @ c444f6a
- **Upstream:** k21971/EvilHack `master` @ `c444f6a3ab1e9f16d0676961dba86f628e91c6ba`
  ("Switch status from beta to released", 2026-07-12, EvilHack 0.9.3):
  https://github.com/k21971/EvilHack/tree/c444f6a3ab1e9f16d0676961dba86f628e91c6ba
- **Port repo:** https://github.com/memmaker/evilhack (public after the split;
  cloud work repo memmaker/evilhack-cloud). Port changes:
  https://github.com/memmaker/evilhack/compare/c444f6a3ab1e9f16d0676961dba86f628e91c6ba...main
- **Author:** Keith Simpson (k21971). **Parent:** NetHack 3.6.2 codebase (code),
  kept up with 3.6.x; features taken from GruntHack and SporkHack, other bits
  from Slash'EM, SpliceHack, UnNetHack, xNetHack (README.md upstream text,
  doc/evilhack-changelog.md "from X" notes).
- **Year:** work began 2018-10-20, public release April 2019 on the Hardfought
  servers (`dat/history` lines 3-5) → card/tree year **2019**. The git clone is
  shallow (73 commits, first 2026-06-11), so git gives no birth year; the GitHub
  API/web cross-check was not reachable from the cloud (open: check on the Mac).
- **Licence:** NetHack General Public License (`LICENSE`, `dat/license`).
- **Live URL:** https://ruzzoli.de/roguelikes/evilhack/ (after deploy).
- **Card image:** `web/publish/card.png` → roguelikes `img/evilhack.png`: 60
  monster tiles from the build's `tiles.png` (NetHack 3.6 tile sources as kept by
  EvilHack), evenly sampled over the 568 monster tiles after skipping blank/dark
  ones (<70 lit px or mean luma <28), 16 px at 2× nearest-neighbour, 12×5 = 384×160.
- **Help:** `web/make-help.py` → `help.html` "About this version" carries the
  version line, the compare link and the upstream commit link.
