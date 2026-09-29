#!/bin/sh
# Build EvilHack for the browser (Emscripten + Asyncify) into web/dist.
# win/web/winweb.c is the window port, web/evilhack.js draws.
# Needs the native build first (generated headers pm.h/onames.h/date.h,
# util/tilemap -> src/tile.c, dat/ text data): see HANDOVER.md.
# Data tools (makedefs, lev_comp, dgn_comp, dlb) are rebuilt with emcc and
# run under node: quest.dat and the .lev files hold longs (4 bytes in
# wasm32, 8 natively), so natively written data is unreadable in wasm.
# Shared page code comes from RVIP_WEB (never copied into this repo).
set -e
cd "$(dirname "$0")/.."
RVIP_WEB=${RVIP_WEB:-$HOME/Games/rvip-tools/web}
OUT=web/dist SEED=web/seed TOOLS=web/tools OBJ=web/obj
[ -f include/pm.h ] && [ -f include/date.h ] && [ -f src/tile.c ] \
	|| { echo "build natively first (see HANDOVER.md)"; exit 1; }
[ -f util/lev_yacc.c ] && [ -f util/dgn_yacc.c ] || { echo "util/*_yacc.c missing: native build first"; exit 1; }
NPROC=$(nproc 2>/dev/null || sysctl -n hw.ncpu)
WARN=${WARN:--w}

# ---- data tools as wasm, run under node ----
# DEFS must match the game: makedefs -v writes date.h (feature bits and
# VERSION_SANITY sizes) that the data file headers are checked against.
DEFS="-DDLB -DNOMAIL -DNOSHELL -DHACKDIR=\"/evilhack\" -DUSE_WEB"
GEN=web/gen
mkdir -p "$TOOLS" "$GEN/include"
CT="-O1 $WARN -Iinclude $DEFS -sNODERAWFS -sENVIRONMENT=node -sEXIT_RUNTIME=1 -sSTACK_SIZE=4MB -sALLOW_MEMORY_GROWTH"
tool() {        # rebuild when a source, config.h, a generated header or this script is newer
	n=$1; shift; o="$TOOLS/$n.js"
	for f in "$@" include/config.h web/build.sh $GEN/include/*.h; do [ "$o" -nt "$f" ] || { emcc $CT "$@" -o "$o"; return; }; done
}
rm -rf "$SEED" && mkdir -p "$SEED/dat" "$SEED/include"
cp dat/* "$SEED/dat/" 2>/dev/null || true
rm -f "$SEED"/dat/*.lev "$SEED"/dat/dungeon "$SEED"/dat/nhdat "$SEED"/dat/quest.dat
T=$PWD/$TOOLS
# pm.h/onames.h with the web DEFS first: -DNOMAIL drops the mail daemon and
# the scroll of mail from monst.c/objects.c, so the native headers (MAIL)
# would number every later monster/object one off (-o/-p need no pm.h)
tool makedefs0 util/makedefs.c src/monst.c src/objects.c
(cd "$SEED/dat" && node $T/makedefs0.js -o && node $T/makedefs0.js -p)
for h in onames.h pm.h; do cmp -s "$SEED/include/$h" "$GEN/include/$h" || cp "$SEED/include/$h" "$GEN/include/$h"; done
# web/gen/include is a full copy of include/ (quoted #includes look in the
# including header's own folder first, so a copy of only pm.h would be
# shadowed by the native one); date.h, pm.h, onames.h are the web's own
for f in include/*.h; do
	case "${f##*/}" in date.h|pm.h|onames.h) continue ;; esac
	cmp -s "$f" "$GEN/include/${f##*/}" || cp -p "$f" "$GEN/include/"
done
CT=$(echo "$CT" | sed "s|-Iinclude|-I$GEN/include|")
tool makedefs util/makedefs.c src/monst.c src/objects.c
(cd "$SEED/dat" && node $T/makedefs.js -v)       # wasm32 date.h + options
# replace date.h only when more than the build date changed (no full rebuild)
dh() { grep -v 'BUILD_\|VERSION_ID' "$1" 2>/dev/null || true; }
[ "$(dh "$SEED/include/date.h")" = "$(dh "$GEN/include/date.h")" ] || cp "$SEED/include/date.h" "$GEN/include/date.h"
tool lev_comp util/lev_yacc.c util/lev_lex.c util/lev_main.c util/panic.c \
	src/alloc.c src/drawing.c src/decl.c src/monst.c src/objects.c
tool dgn_comp util/dgn_yacc.c util/dgn_lex.c util/dgn_main.c util/panic.c src/alloc.c
tool dlb util/dlb_main.c src/dlb.c util/panic.c src/alloc.c

(cd "$SEED/dat" && node $T/makedefs.js -d && node $T/makedefs.js -r && node $T/makedefs.js -q \
	&& node $T/makedefs.js -h && node $T/makedefs.js -s \
	&& for d in *.des; do node $T/lev_comp.js "$d" >/dev/null || exit 1; done \
	&& node $T/dgn_comp.js dungeon.pdf >/dev/null)
# the nhdat file list from the top Makefile (DATDLB)
(cd "$SEED/dat" && LC_ALL=C node $T/dlb.js cf nhdat help hh cmdhelp keyhelp history opthelp wizhelp \
	Guidebook dungeon tribute *.lev bogusmon data engrave epitaph oracles options quest.dat rumors vaults.dat)
mkdir -p "$SEED/fs"
cp "$SEED/dat/nhdat" dat/license dat/symbols web/sysconf "$SEED/fs/"
echo "$(ls "$SEED"/dat/*.lev | wc -l) levels compiled"

# ---- the game ----
CF="-O2 -fcommon $WARN -I$GEN/include $DEFS"
SRCS="$(ls src/*.c) sys/share/ioctl.c sys/share/unixtty.c sys/share/posixregex.c \
	sys/unix/unixmain.c sys/unix/unixunix.c sys/unix/unixres.c win/web/winweb.c"
mkdir -p "$OBJ"
export CF OBJ
printf '%s\n' $SRCS | xargs -P "$NPROC" -n 1 sh -c \
	'o="$OBJ/$(basename "$1" .c).o"; [ "$o" -nt "$1" ] && [ -z "$(find web/gen/include -newer "$o" -name "*.h" | head -1)" ] || emcc $CF -c "$1" -o "$o"' _
emcc $CF -DNO_MAIN -c util/recover.c -o "$OBJ/recover.o"
rm -rf "$OUT" && mkdir -p "$OUT"
emcc -O2 $WARN "$OBJ"/*.o --preload-file "$SEED/fs@/seed" -o "$OUT/evilhack-core.js" \
	-sASYNCIFY -sASYNCIFY_STACK_SIZE=131072 -sSTACK_SIZE=4MB \
	-sALLOW_MEMORY_GROWTH -sEXIT_RUNTIME=1 -sINITIAL_MEMORY=64MB \
	-sEXPORTED_FUNCTIONS=_main \
	-sEXPORTED_RUNTIME_METHODS=FS,IDBFS,ENV,HEAP32 \
	-sFORCE_FILESYSTEM -lidbfs.js -sENVIRONMENT=web
rm -rf "$SEED"
cp web/index.html web/evilhack.js "$OUT/"
# serve tree as on the server: dist + shared ../rvip-*.js (gitignored)
rm -rf web/serve && mkdir -p web/serve
ln -s ../dist web/serve/evilhack
for f in "$RVIP_WEB"/rvip-*.js; do [ -f "$f" ] && ln -s "$f" web/serve/; done
ls -la "$OUT"
