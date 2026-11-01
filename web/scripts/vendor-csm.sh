#!/usr/bin/env bash
# Vendors the built ts-cloud-storage-manager ES modules into web/vendor/ so
# the app (no bundler) can import them via relative paths, and the output can
# be committed for GitHub Pages. Re-run after any change in the library
# (bun run build there) or after bun install.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p vendor/ts-cloud-storage-manager
# -L dereferences: bun links file: deps, and committed vendor copies must be
# real files (absolute symlinks would 404 on every other machine/Pages).
cp -RL node_modules/ts-cloud-storage-manager/dist/. vendor/ts-cloud-storage-manager/
# Runtime only: type declarations come from node_modules, maps are dev-only.
find vendor/ts-cloud-storage-manager \( -name '*.d.ts' -o -name '*.js.map' \) -delete
echo "Vendored ts-cloud-storage-manager -> vendor/ts-cloud-storage-manager"
