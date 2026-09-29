#!/bin/sh
# Upload web/dist to https://ruzzoli.de/roguelikes/evilhack/ (after web/build.sh)
set -e
cd "$(dirname "$0")" && git fetch -q && [ -z "$(git status --porcelain)" ] && [ "$(git rev-parse @)" = "$(git rev-parse @{u})" ] || { echo "commit + push first"; exit 1; }
[ -f dist/evilhack-core.wasm ] || { echo "build first (web/build.sh)"; exit 1; }
ssh ruzzoli.de 'sudo mkdir -p /var/www/ruzzoli.de/roguelikes/evilhack && sudo chown -R felix:www-data /var/www/ruzzoli.de/roguelikes/evilhack'
rsync -rtz --delete dist/ ruzzoli.de:/var/www/ruzzoli.de/roguelikes/evilhack/
