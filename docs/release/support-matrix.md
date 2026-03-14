# Support Matrix

ShipKit is currently a macOS-only desktop product.

This file describes the active product target and the generic code-health lanes
that still run in CI. It does not imply Linux or Windows desktop support.

## Current product support

| Platform | Product status | What the repo verifies today | Remaining gap |
| --- | --- | --- | --- |
| macOS | Supported local product target | Rust quality, frontend quality, browser E2E smoke, debug desktop smoke, packaged app smoke, release preflight, updater scaffold, release bundle generation | Real Apple signing, notarization, stapling, and live signed publish |

## Non-product CI lanes

| Platform | Why it still appears in CI | What it does not mean |
| --- | --- | --- |
| Ubuntu | Cheap Rust/frontend code-health execution and perf collection | It does not mean ShipKit supports Linux as a desktop product right now |

## Operational meaning

- macOS is the only platform maintainers should use for local ShipKit setup,
  development, smoke testing, and packaged-app validation.
- Release credentials are intentionally deferred for the current milestone, so
  local and packaged validation are the main success paths.
- Linux and Windows desktop smoke/package expectations are intentionally out of
  scope for now.

## Current canonical checks

- `pnpm run doctor:mac`
  - Confirms this machine matches the local macOS workflow expectations
- `pnpm run test:e2e`
  - Browser-hosted operator smoke for the main local workflow
- `pnpm run smoke:desktop`
  - Debug Tauri build smoke on macOS
- `pnpm run package:smoke`
  - Packaged `.app` build and launch smoke on macOS
- `pnpm run verify`
  - Full repo gate used for local verification and CI parity

## Next support milestone after this phase

1. Finish the local macOS product hardening work.
2. Resume signed macOS release setup with real credentials.
3. Reconsider any other platform only after the Mac path is fully settled.
