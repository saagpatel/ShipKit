#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/../.." && pwd)"
PORT="${SHIPKIT_DEV_PORT:-1420}"

existing_pid="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [[ -n "$existing_pid" ]]; then
  existing_command="$(ps -p "$existing_pid" -o command= 2>/dev/null || true)"
  existing_cwd="$(lsof -a -p "$existing_pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)"

  if [[ "$existing_command" == *"vite"* ]] && [[ "$existing_cwd" == "$APP_DIR" || "$existing_cwd" == "$REPO_DIR" ]]; then
    if curl -fsS "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
      echo "Reusing existing ShipKit Vite dev server on port $PORT (pid $existing_pid)."
      exit 0
    fi
  fi

  echo "Port $PORT is already in use by: ${existing_command:-unknown process}"
  echo "Free http://localhost:$PORT or stop the existing process, then retry."
  exit 1
fi

cd "$APP_DIR"
exec vite "$@"
