# Support Matrix

ShipKit is still in the final production-readiness program. The matrix below
describes what the repo currently verifies, not what it merely hopes to support
later.

## Current platform posture

| Platform | Current status | What CI verifies today | Remaining gap to production |
| --- | --- | --- | --- |
| macOS | Primary release target | Rust quality, frontend quality, debug desktop smoke, packaged app smoke, release preflight, updater scaffold, release bundle generation | Real Apple signing, notarization, stapling, and live signed publish |
| Linux | Build-smoke validation | Rust quality, frontend quality, debug Tauri build smoke, no-bundle package smoke | Signed packaging, runtime package install validation, updater delivery, platform polish |
| Windows | Build-smoke validation | Debug Tauri build smoke, no-bundle package smoke | Signed installer, runtime install validation, updater delivery, platform polish |

## What this means operationally

- macOS is the only platform currently on the path to release-candidate quality.
- Linux and Windows are now part of the repo’s automated build confidence loop,
  but not yet part of a signed production distribution workflow.
- Packaged launch validation is currently strongest on macOS because that is
  where the release path is being hardened first.

## Current canonical checks

- `pnpm run smoke:desktop`
  - Cross-platform debug no-bundle Tauri build smoke
- `pnpm run package:smoke`
  - macOS: packaged `.app` build, launch smoke, restore-from-bundle scenario,
    staged zip artifact, release manifest generation
  - Linux/Windows: no-bundle package-path validation with updater overlay config
- `pnpm run verify`
  - Full repo gate used for local verification and CI parity

## Remaining support milestones

1. Make the signed macOS publish lane real with Apple credentials.
2. Add runtime install and updater validation for Linux and Windows.
3. Add platform-specific packaging/signing guidance for Windows and Linux.
4. Promote Linux and Windows from build-smoke support to full release support.
