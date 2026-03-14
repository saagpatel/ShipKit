#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

LEAN_ROOT="${TMPDIR:-/tmp}/shipkit-lean-dev-$$"
LEAN_CARGO_TARGET="$LEAN_ROOT/cargo-target"
LEAN_VITE_CACHE="$LEAN_ROOT/vite-cache"

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  "$SCRIPT_DIR/clean-heavy.sh" || true
  for _ in 1 2 3; do
    rm -rf "$LEAN_ROOT" 2>/dev/null || true
    [ ! -d "$LEAN_ROOT" ] && break
    sleep 1
  done

  return "$exit_code"
}

trap cleanup EXIT INT TERM

mkdir -p "$LEAN_CARGO_TARGET" "$LEAN_VITE_CACHE"

echo "lean dev temp root: $LEAN_ROOT"
echo "cargo target dir: $LEAN_CARGO_TARGET"
echo "vite cache dir: $LEAN_VITE_CACHE"

cd "$APP_DIR"
CARGO_TARGET_DIR="$LEAN_CARGO_TARGET" \
VITE_CACHE_DIR="$LEAN_VITE_CACHE" \
pnpm dev:tauri "$@"
