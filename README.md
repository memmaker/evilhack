## EvilHack in the browser (RVIP port)

Based on EvilHack 0.9.3 · memmaker/evilhack @ c444f6a

This repository is **EvilHack 0.9.3** by Keith Simpson (k21971), upstream
[k21971/EvilHack `master` @ `c444f6a`](https://github.com/k21971/EvilHack/tree/c444f6a3ab1e9f16d0676961dba86f628e91c6ba)
("Switch status from beta to released", 2026-07-12), plus a web port that runs
the game in a browser (WebAssembly). Everything the port changes is in the
compare view:
<https://github.com/memmaker/evilhack/compare/c444f6a3ab1e9f16d0676961dba86f628e91c6ba...main>

(The public repository is `memmaker/evilhack`; this work was done in the
cloud repository `memmaker/evilhack-cloud`, which is split into the public one.)

Gameplay is unchanged. The port adds:

- a web window port (`win/web/winweb.c`, `web/`): separate map, messages,
  status, inventory, equipment and visible-things windows (draggable, resizable,
  per-window text size), one-window mode, fonts;
- auto-explore and walking to the stairs, no `--More--` prompts;
- an Enter command menu and cursor-driven inventory menus with item actions;
- tiles from the NetHack 3.6 tile sources (text mode switchable);
- synthesized sound effects for game actions (off by default);
- saving in the browser (IndexedDB, autosave checkpoint), in-page help.

Play: <https://ruzzoli.de/roguelikes/evilhack/>

### Build

1. Native build first (generated headers, level compilers, data); needs `bison`
   and `flex`, serial make:

       sh sys/unix/setup.sh sys/unix/hints/linux
       make PREFIX=$PWD/install HACKDIR=$PWD/playground SHELLDIR=$PWD/install/bin \
            YACC="bison -y" LEX=flex all install

2. Web build with Emscripten (`emcc` on `PATH`) and the shared RVIP page
   scripts (`rvip-wm.js`, `rvip-app.js`, `rvip-sound.js`) in `$RVIP_WEB`:

       RVIP_WEB=~/Games/rvip-tools/web sh web/build.sh

   Output: `web/dist/` (deployable) and `web/serve/` (serve it and open
   `/evilhack/`).

Licence: the NetHack General Public License, as upstream (`dat/license`,
`LICENSE`). The web port's additions are under the same licence.

The upstream README follows.

---

## EvilHack

EvilHack is a NetHack variant that is designed to be a much more challenging
experience that the original, drawing inspiration from and incorporating some
of the best features from variants such as GruntHack and SporkHack, as well
as other interesting bits of code from other variants (Slash'EM, Splicehack,
UnNetHack, xNetHack).  Wrap all that up along with some custom/unique content
never seen before in any other variant, and you have EvilHack.

EvilHack was initially built off of the NetHack 3.6.2 codebase, and will be
updated accordingly as NetHack 3.6.x progresses and evolves.

This variant is designed to be difficult, much like how GruntHack and SporkHack
turned out to be (hence the name 'EvilHack').  It is not impossible to win by
any means, but several aspects of the game that one might take for granted in
the 'vanilla' version of NetHack can easily cost you your game in this variant.
Various monsters are tougher, have more hit points, can fight more intelligently,
and can use a variety of objects against you that previously only the player
could use.

The EvilHack changelog is updated regularly and is an excellent resource to
access for viewing current changes to existing releases, as well as up and
coming changes for future versions -
https://github.com/k21971/EvilHack/blob/master/doc/evilhack-changelog.md

More information regarding this variant can be accessed at the NetHackWiki -
https://nethackwiki.com/wiki/EvilHack. Have questions and want to interact
with people in real time? Visit channels #evilhack or #hardfought on Libera
IRC, or #evilhack on the Roguelikes Discord.

## Design Philosophy

As stated before, the overall design goal for EvilHack is that it's a more
difficult and challenging game than vanilla NetHack or other variants,
*without* sacrificing game balance or (most importantly) the game's fun-factor.

In short:
- EvilHack is meant to be very difficult and challenging
- EvilHack is meant to be fun, even though it is difficult
- Any changes should be balanced
- Replayablilty/randomness is a priority design goal to ensure unpredictable
  outcomes and to keep the experience fresh
- Addressing bugs/balance issues will always be an ongoing process
- Player feedback/constructive criticism is welcome and encouraged

## Installation

Each OS type found under the `sys` folder has an installation guide for that
particular operating system. Pre-compiled binaries for windows OS can be
found here - https://github.com/k21971/EvilHack/releases

For Linux (TL;DR version):
- Dependencies needed: `make` `gcc` `gdb` `flex` `bison` `libncurses-dev`
- From the desired directory, `git clone https://github.com/k21971/EvilHack.git`
- Navigate to the `EvilHack/sys/unix` folder, then `./setup.sh hints/linux` or
  `./setup.sh hints/linux-debug` depending on what you intend to do

  - Using the standard `linux` hints file assumes running as a normal user, and
  game folders and files will reside in `/home/$USER` based on the account used.
  Invoking `sudo` should not be necessary

  - Using the `linux-debug` hints file assumes installing as root, and includes
  extra CFLAGS for debugging in a development scenario. If you prefer using clang
  as your compiler and have it installed, see `clang-linux-debug` as an alternative
  hints file to use

  - With either hints file, edit the install paths to your liking
- Navigate back to the root EvilHack folder, and `make all && make install`
- Execute the `evilhack` binary
- In the home directory of the account used to install EvilHack, create your
  rc config file - `touch .evilhackrc` and then edit as necessary
