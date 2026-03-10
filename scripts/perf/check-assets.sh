#!/usr/bin/env bash
set -euo pipefail

# codex-os-managed
max_bytes="${ASSET_MAX_BYTES:-350000}"
fail=0

found_dir=0
for dir in apps/desktop/public apps/desktop/src-tauri/icons; do
  if [[ ! -d "$dir" ]]; then
    continue
  fi

  found_dir=1
  while IFS= read -r file; do
    size=$(wc -c < "$file")
    if (( size > max_bytes )); then
      echo "Asset too large (>${max_bytes} bytes): $file"
      fail=1
    fi
  done < <(find "$dir" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webp" -o -name "*.avif" -o -name "*.icns" -o -name "*.ico" \))
done

if (( found_dir == 0 )); then
  echo "No asset directories found; skipping asset check."
  exit 0
fi

exit $fail
