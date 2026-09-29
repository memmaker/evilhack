# EvilHack — handover

Web port of EvilHack 0.9.3 following RVIP (`/home/user/rvip/RVIP.md`, Mac:
`~/Games/rvip-tools/RVIP.md`). Cloud run, repo memmaker/evilhack-cloud.

## RVIP progress
- **Stage 1 (Get + build): done.** Next: **stage 2** (explore + stairs + no `--More--`).
- Folder: `/home/user/evilhack-cloud` (cloud); web name `evilhack`.
- Upstream: k21971/EvilHack branch `master` @ `c444f6a3ab1e9f16d0676961dba86f628e91c6ba`
  (commit 1 of this repo, full history). There is **no `upstream` remote** in
  the cloud clone; add it on the Mac (`git remote add upstream
  https://github.com/k21971/EvilHack`). Source checked: no empty files.
- Case **O**, NetHack 3.6 window port. Frontend: `win/web/winweb.c`
  (`web_procs`, `WEB_GRAPHICS`), adapted from slashem's `win/web/winweb.c`
  (nethack50 `winsdl.c`/`winweb.h` lineage) to the 3.6 window-procs struct
  (putmixed, 5-arg print_glyph, genl_status_*, getmsghistory, can_suspend).
  JS side `web/evilhack.js` (stage-1 page, plain panes; the rvip-wm.js page is
  stage 5), `web/index.html`, `web/sysconf` (web SYSCF, no server options).
- Wiring: `include/config.h` (`__EMSCRIPTEN__` → `WEB_GRAPHICS`,
  `DEFAULT_WINDOW_SYS "web"`, no COMPRESS), `include/unixconf.h`
  (`NO_FILE_LINKS`, `LOCKDIR "/evilhack"`), `src/windows.c` (winchoices),
  `src/rip.c` (TEXT_TOMBSTONE), `util/makedefs.c` (window_opts "web").
- C → JS API (EM_JS in winweb.c): `js_map(cells, chars, hx, hy, lev)` with
  tile index (`glyph2tile`) and `char | colour<<8` per cell; `js_text(id, s)`
  0 prompt, 1 status, 2 inventory rows, 3 pop-up, 4 message, 5 mark old,
  6 replace last; `js_key(peek, at_cmd)`; `js_end()` (async, syncs IDBFS).
- Test hooks: `window.nhShadow` (map rows, status, inv, pop, prompt, msgs,
  hero, ended, crash) and `window.nhKey(c)`.

### Build
1. Native first (generated headers, `src/tile.c`, `util/*_yacc.c`/`_lex.c`,
   dat text): needs `bison` + `flex` (`apt-get install flex`; the pregenerated
   `sys/share/*_lex.c`/`*_yacc.c` are stale: dgn_comp fails on `dungeon.pdf`).
   Serial make (parallel races on pm.h):
   ```
   sh sys/unix/setup.sh sys/unix/hints/linux
   make PREFIX=$PWD/install HACKDIR=$PWD/playground SHELLDIR=$PWD/install/bin \
        YACC="bison -y" LEX=flex all install
   ```
   `tbl`/`nroff: not found` are harmless. Mac: use `hints/macosx` (untested here).
2. Web: `RVIP_WEB=/home/user/rvip/web sh web/build.sh` → `web/dist`
   (`evilhack-core.{js,wasm,data}`, `index.html`, `evilhack.js`) and
   `web/serve/` (dist + links to `rvip-*.js`). Emscripten 6.0.10 in the cloud
   (`PATH=/home/user/emsdk/upstream/emscripten:<emsdk node>/bin:$PATH`).
   - Game flags: `-O2 -fcommon -w -DDLB -DNOMAIL -DNOSHELL
     -DHACKDIR="/evilhack" -DUSE_WEB`; link `-sASYNCIFY
     -sASYNCIFY_STACK_SIZE=131072 -sSTACK_SIZE=4MB -sALLOW_MEMORY_GROWTH
     -sEXIT_RUNTIME=1 -sINITIAL_MEMORY=64MB -sEXPORTED_FUNCTIONS=_main
     -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,ENV,HEAP32 -sFORCE_FILESYSTEM
     -lidbfs.js -sENVIRONMENT=web`, data preloaded at `/seed`, copied into
     IDBFS `/evilhack` on each load; run as `-d /evilhack [-u name]`.
   - Data tools `makedefs`, `lev_comp`, `dgn_comp`, `dlb` are rebuilt with emcc
     (`web/tools/*.js`, `-sNODERAWFS -sENVIRONMENT=node`) and run under node.
     `makedefs -v` under node writes a wasm32 `date.h` into `web/gen/include/`
     (first on the include path): native `VERSION_SANITY`/`VERSION_FEATURES`
     differ, the game rejects natively built data ("Configuration
     incompatibility for file dungeon"). `WARN=...` overrides `-w`.

### Checks done
- Fresh clone: native build + `web/build.sh` + Playwright pass.
- Playwright (headless Chromium): boots, "Shall I pick" → `n`, role/race/
  alignment menus, intro pop-up, map with `@`, status, moves (hero position
  changes), `i` inventory pop-up. Script: see "Playwright" below.
- Crash check: full build without `-w` (only `-Wno-deprecated-non-prototype`):
  no `signature mismatch` / `conflicting signatures` in the game link; fixed
  one in the dlb tool (`util/dlb_main.c` `fopen_datafile` arity) and K&R
  boolean prototypes in `src/weapon.c`. `-Wcast-function-type-strict`: only
  signal handlers cast to `SIG_RET_TYPE` (allmain.c, unixmain.c), never called
  through a wrong type in wasm.
- ASan: native gcc 13 `-fsanitize=address` tty build (`git archive` copy in
  the scratchpad, linux hints setup, `CFLAGS="-g -O1 -fsanitize=address
  -I../include -DNOTPARMDECL -DDLB -DSYSCF -DSYSCF_FILE=... -DHACKDIR=...
  -DNOMAIL -w" LFLAGS=-fsanitize=address`, `web/sysconf`, empty perm/record/
  logfile/xlogfile + `save/`), driven through a pty (Python `pty.fork`) with
  ~3000 random keys per run, 5 seeds, `ASAN_OPTIONS=allow_user_segv_handler=0`:
  real game starts, fights, one death + DYWYPI: **no ASan reports**. Build and
  objects removed afterwards (`make clean` in the tree too).

### Quirks / open
- No `Who are you?` in the browser: `USER=player` becomes the name (stage 5
  should ask for a name or let the page set it).
- Player selection is the slashem-style menu sequence (role, race, gender,
  alignment filtered by `ok_*` from role.c), not tty's full selection menu.
- Web defaults (number_pad off, autopickup `$`, pickup_types, hilite_status,
  menucolors) not baked yet; `web/sysconf` carries no OPTIONS.
- No tiles sheet yet (tile indexes already sent; stage 4). Saves/IDBFS
  recovery and `ev=win` not wired (stages 5/9).
- Deploy: not possible from the cloud (no `web/deploy.sh` yet).

## Playwright (local copy)
Cloud: `playwright@1.56.1` is global (`NODE_PATH=/opt/node22/lib/node_modules`,
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, Chromium 1194). Serve with
`python3 -m http.server 8765 --directory $PWD/web/dist` (restart after each
build). Stage-1 test script (scratchpad copy `pw/play.cjs`): dispatch keydown
on `document`, poll `window.nhShadow` (`/Shall I pick/` on `prompt`, `/Pick a
role/` on `pop`, `@` in `map`, `/Dlvl/` in `status`), compare `hero` before
and after `hjklyubn`. On the Mac: `npm i playwright` in a scratch dir, same
script.
