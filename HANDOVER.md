# EvilHack — handover

Web port of EvilHack 0.9.3 following RVIP (`/home/user/rvip/RVIP.md`, Mac:
`~/Games/rvip-tools/RVIP.md`). Cloud run, repo memmaker/evilhack-cloud.

## RVIP progress
- **Stage 1 (Get + build): done.**
- **Stage 2 (Explore + stairs + no `--More--`): done.**
- **Stage 3 (Enter menu + inventory): done.**
- **Stage 4 (Tiles): done.** Next: **stage 5** (rvip-wm page and windows).

### Stage 4 facts
- **Set:** EvilHack's own NetHack 3.6 16x16 set, `win/share/{monsters,
  objects,other}.txt` (the only set offered; then None = text). Upstream
  already keeps the txt files in step with monst.c/objects.c (568 + 566 +
  273 tiles; `util/tile2bmp` checks each name, exit 101 on mismatch), so
  every glyph (9240) has a tile; no stand-in file needed.
- **Coverage vs NetHack 3.6** (pixels compared by name against
  NetHack/NetHack `NetHack-3.6` win/share, script `scratchpad/s4/cov.py`):
  monsters 437/568 own art (377 same, 5 redrawn, 55 new) = 77 %, 131 are
  same-set copies (e.g. mountain dwarf = dwarf, skeletal horse, gnoll group
  share one new tile); objects 436/566 = 77 % (130 copies: dark elven/
  orcish variants, staffs, new rings/potions/spellbooks reuse a vanilla
  appearance of the same class); other 248/273 = 91 % (25 copies: acid and
  shock explosions, zap 9, bolt/spear/magic beam traps). Overall 1121/1407
  = 80 % distinct art, **100 % with same-set stand-ins** (RVIP 5.8: one set,
  never mixed). Other sets checked: slashem 16x16 names cover 780/1129
  EvilHack monsters+objects, its 32x32 sets 68: not used; nethack50 is the
  3.7 set (gendered tiles): not used; dynahack has no tile set.
- **Sheet (build time, `web/build.sh`):** native `tilemap` built with
  `-DSTATUES_LOOK_LIKE_MONSTERS=` and the web DEFS → `web/gen/src/tile.c`
  (replaces `src/tile.c` in the web game); native `util/tile2bmp` →
  `web/gen/nhtiles.bmp` (monsters, objects, other incl. `sub` wall sets,
  then grey monsters for statues); `web/mktiles.py` (stdlib only) → PNG
  `tiles.png` 640x800, 16x16 cells, 40 per row, backdrop (71,108,108) →
  black, asserts every glyph2tile/substitute entry < `total_tiles_used`.
- **Game side:** `include/global.h` sets `USE_TILES` for `WEB_GRAPHICS`
  (`shuffle_tiles()` in o_init.c/restore: random appearances map by
  appearance; `substitute_tiles()` for mines/gehennom/knox/sokoban walls).
  winweb.c already sends `glyph2tile[glyph]` per map cell (`js_map`) and per
  menu/inventory row (first tab field; `add_menu` glyph from
  `obj_to_glyph`). Statues = grey monster tile, corpses = corpse tile,
  figurines = figurine tile, hero = role tile.
- **Page (`web/evilhack.js`, stage-1 page):** `SETS = [{name:'NetHack
  3.6', src:'tiles.png', size:16}]`; `useTiles(name)` loads the sheet with
  a generation counter (late `onload` after a switch/None is dropped) and
  calls `setup()` (cell size, canvas size, which map shows, redraw map,
  inventory, pop-up). Tiles button cycles sets then None. Zoom −/+ = whole
  multiples 1..4 (default 2 = 32 px cells, square because the tiles are
  16x16), `imageSmoothingEnabled=false`, `image-rendering: pixelated`.
  Prefs `{tiles, zoom}` in `/evilhack/web-layout.json` (IDBFS, synced),
  read in preRun right after `syncfs` before the sheet loads. Row icons:
  `<span class="ti" data-t=tile>` from the sheet at 16 px. Test hooks:
  `nhShadow.tiles`, `nhShadow.sheet`, `nhShadow.cells`, `window.nhTiles`.
  Stage 5: move `SETS`/`useTiles`/`setup` and the layout file into the
  rvip-wm page (A−/A+ per window instead of the zoom buttons).
- **Fixed a stage-1 bug:** the web build used native `pm.h`/`onames.h`
  (MAIL) with monst.c/objects.c compiled `-DNOMAIL`: every monster after
  the mail daemon and object after the scroll of mail was one off (gold
  showed as `*`). `build.sh` now makes both headers with the web makedefs
  and compiles against a copy of `include/` in `web/gen/include`.
- **Tests:** `scratchpad/s4/s4.cjs` (0 fails; needs a temporary wizard
  unlock, see below): default set before the first prompt, canvas 80x21
  cells at 32 px, hero tile = priest(ess), wished statue = grey newt,
  figurine, corpse, ring and potion tiles = the appearance in the message
  (`copper / shock resistance` for "a copper ring"), inventory rows'
  tiles vs appearance for wands/rings/spellbooks, walls/corridors/doors
  after ^F, zoom, late-onload guard, button → None → reload keeps None →
  back to tiles → reload keeps tiles; crops read at 2x (`crop-items.png`,
  `inv.png`, `page-tiles.png`). Wizard mode in wasm fails (`get_unix_pw()`
  is NULL): the test build patched `authorize_wizard_mode()` with
  `getenv("RVIP_TESTWIZ")` temporarily (reverted, rebuilt). Stage-3
  `s3.cjs` and stage-1 `play.cjs` still pass.
- Open: not checked in the Mac pane (look of 32 px cells, row icons);
  the gnome-king-style heavy statue wish drops a statue that showed as a
  boulder before the header fix (now fine). No DawnLike/other set offered.

### Stage 3 facts
- Files: `src/cmd.c` (end: `rvip_cmdmenu`, `rvip_cmd_key`, `rvip_extkey`,
  `rvip_movekey`, `rvip_ext_preset`), `src/invent.c` (getobj probe/preselect
  hooks; end: `rvip_ddoinv`, `rvip_actmenu`, `rvip_inv_again`, action table
  `rvip_acts[]`), `src/apply.c` (`rvip_applyclasses` wraps static
  `setapplyclasses`), `src/hack.c` (`rvip_nhostile` now global),
  `include/extern.h`, `win/web/winweb.c`, `web/evilhack.js`, `web/index.html`.
  All game-side code under `#ifdef WEB_GRAPHICS`; tty build unchanged.
- **Enter menu:** JS Enter = 13 (`^M`), free in vi and number_pad sets and
  unused by getpos. `web_nh_poskey`: 13 while `iflags.in_parse` (and no
  pop-up/prompt) → `rvip_cmdmenu()`: every `extcmdlist` entry grouped like
  `dokeylist()` (General / Game / Wizard-mode if wizard), no
  `CMD_NOT_AVAILABLE`; key = reverse lookup in `Cmd.commands` (printable
  first; step/run keys of the current keyset skipped, but `<`/`>` kept),
  else shown `#name`. Choosing returns the key into parse(); keyless ones
  return `#` and `web_get_ext_cmd` takes `rvip_ext_preset`. The command's
  own key picks its row (gch), arrows/8/2 move, Enter/5/6/click choose,
  Esc/0/4 close. Enter menu → `i` reaches the inventory.
- **Inventory (`i`, `ddoinv` → `rvip_ddoinv`):** the game's own inventory
  menu shown in *raw* mode (`web_menu_raw`): winweb only moves the cursor
  and returns any other key (`web_menu_key`, row id `web_menu_pick`, cursor
  `web_menu_idx`). Lists: inventory ↔ equipment ↔ floor (4/6/←/→, empty ones
  skipped). Letter = main action; Shift+letter drop; Ctrl+letter examine;
  Enter/Space/5/click = action menu; `+` main, `-` drop, `*` examine; Esc/0/.
  close; other keys run as commands. Examine = encyclopedia (`checkfile`,
  the old `ddoinv` pick, now `examine_obj`).
- **How item actions run (key queue + preselect, 5.7):** `rvip_acts[]` =
  {command function, name, getobj word, the command's own class list}. Fit
  test: `rvip_probe_obj` makes `getobj()` return right after it builds its
  candidate list (`rvip_probe_fit` = item listed) — the game's own "ugly
  checks" decide. Chosen action: `rvip_presel = obj`, key from
  `rvip_cmd_key(fn)` (current keyset; `#`+preset for keyless) queued with
  `web_push_key` (C queue, read before page keys); the command's first
  `getobj()` takes the preselect and goes through its normal verification.
  Main-action order: zap, read, quaff, wield (not if wielded), apply, eat,
  remove, take off, put on, wear, else examine. Floor list: main = pick up
  (`,`). Offer only on an altar. `rvip_inv_again()` (called from
  `web_nh_poskey` when parse reads with an empty queue) clears the preselect
  and returns `i` again unless a hostile is in view (`rvip_nhostile`).
- **Every item prompt with a cursor:** `iflags.force_invmenu = TRUE` (set in
  `web_init_nhwindows`, upstream 3.6 option): every `getobj()` opens its
  item list at once (PICK_ONE; letters, `-` hands, `*` list everything).
  Menus: raw arrow codes (0x101..) reach `select_menu` while a pop-up is up;
  8/2 move (unless a row uses that key), 5/6/Enter choose, 0/4/./Esc close,
  PgUp/PgDn/Home/End.
- **Keypad:** JS sends keypad digits as 0x110+d (by `e.code`); C turns them
  into digits in menus/prompts and into steps on the map.
- Fixed a stage-1 bug: any group accelerator (gch, e.g. class symbols in
  the pick-up menu) suppressed menu letters; now only `web_menu_noletters`
  (command/action/floor menus) does.
- Pop-up (stage-1 page): `position: fixed`, `width: max-content`, capped
  at the viewport and scrolled; cursor row scrolled into view; rows carry
  `data-row` (click → 0x20000|row). Stage 5 renders the same rows in an
  rvip-wm popup.
- Test hooks: `nhShadow.popTitle`, `popRows`, `popCur` (cursor row index).
- Tests: `scratchpad/s3/s3.cjs` (Healer; 0 fails): menu lists all table
  commands (non-wizard), `~ < >` present, no movement keys, groups, width =
  longest row, arrows/letter/Enter/click/Esc; `i` cursor, keypad 8/2/4/6/5/
  0, item menus for weapon, armor, food, spellbook, potion, wand, tool, gem;
  letter quaff with no prompt + list reopens; Shift drop; Ctrl examine; menu
  eat via keypad; `-` drop; floor list `+` pick-up; item prompts q e r z a W
  P w t d Q E show the cursor list; letter picks at a prompt.
  `scratchpad/s3/np.cjs`: `EVILHACKOPTIONS=number_pad:1` → menu shows
  `j` jump, `k` kick, `^L` redraw (keyset keys). Native tty `make` builds.
- Open: `#name`/`#call`/`#force` not in the item menu (they ask their own
  menus first); counts in item prompts (digits are keypad keys in the list);
  reopen check uses hostiles only (peacefuls don't block); not yet checked
  in the Mac pane.

### Stage 2 facts
- Explore key **`~`** (`#autoexplore`, `src/cmd.c` extcmdlist): free in the
  command table, vi and number_pad sets, getpos keys. Code at the end of
  `src/hack.c` (`rvip_*`, `doexplore`); decls in `include/extern.h`.
- Main-loop hook: `src/allmain.c` moveloop `else if (multi == 0)`:
  `if (!rvip_continue()) rhack(0);` — one step per turn, `flush_screen(1)`
  then `web_walk_pause()` (winweb.c: redraw, 40 ms sleep, any queued key
  stops the walk and is swallowed).
- Known grid: `levl[x][y].seenv` + remembered glyph (`levl[][].glyph`),
  stairs also via `lastseentyp` (stairs covered by an object in memory);
  `test_move(TEST_TRAV)` only between seen squares. Frontier = passable, next
  to unseen, not stood on; remembered objects not stood on are targets; the
  target is kept until stood on. Per-level marks (stood / locked door) in
  `rvip_mark[ledger][x][y]` (not saved: a restored game re-walks some cells).
- Stops: new message (`rvip_msgs++` in `src/pline.c` before `putmesg`,
  snapshot before each step, re-baselined after explore's own door open),
  visible hostile ("In view: the jackal."), key, step that did not move,
  held/engulfed. Avoids known traps, water/lava, boulders, visible non-pets.
  Closed doors: `doopen_indir()`; locked (`D_LOCKED`) never opened (EvilHack
  `autounlock` would pick it): "This door is locked.", marked, skipped.
  No goal left: "Known traps, water or locked doors block the way…" if a
  loose BFS finds one, else "Nothing left to explore here (secret doors may
  need searching)."
- `<`/`>` (`src/do.c` top of `doup`/`dodown`): off the right stairs →
  `rvip_start()` walks to nearest known stairs/ladder/branch stairs of that
  kind and stops; second press takes. Never trapdoors/holes/portals (not
  stairs). Skipped when levitating, held, in a pit (`<`), in water, or on a
  known trap (`>` keeps falling through). Stair walks stop on messages and
  only when *more* hostiles are in view than at the start.
- No `--More--`: the web window port never waits on the message window
  (`display_nhwindow(WIN_MESSAGE)` = redraw; no `xwaitforspace`); birth has no
  stops (tested). Text pop-ups (intro, `i`) still wait for a key: those are
  windows, not `--More--`. No option needed.
- Help: `dat/help`, `dat/hh`, `dat/cmdhelp`.
- Tests: Playwright (`scratchpad/pw/s2.cjs`): explore stops on monsters,
  pet swaps, pickups; key queued mid-walk stops it; `>` from off-stairs walks,
  stops on arrival, second press descends; `<` likewise; no `More` during
  birth. Native wizard pty (`scratchpad/s2/drive.py`, pyte): Dlvl 1–2 fully
  explored to "Nothing left…", descended by `>` walks; locked doors,
  hidden door found, door resists/opens without stopping.
- Open: pet messages ("You swap places with your kitten") stop explore
  (by the any-message rule); shop items are all targets (each stops with
  "You see here"); a hidden trap can still be walked into (unknown).
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
- Tiles done in stage 4. Saves/IDBFS recovery and `ev=win` not wired
  (stages 5/9).
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
