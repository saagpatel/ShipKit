# Local Smoke Runbook

This runbook is the canonical local macOS validation path for ShipKit.

## Command sequence

```bash
pnpm run doctor:mac
pnpm run test
pnpm run test:e2e
pnpm run smoke:desktop
pnpm run package:smoke
```

## What each step proves

- `pnpm run doctor:mac`
  - The machine is prepared for the current ShipKit workflow
- `pnpm run test`
  - Frontend and Rust unit/component coverage are healthy
- `pnpm run test:e2e`
  - The browser-hosted operator journey works end to end
- `pnpm run smoke:desktop`
  - The debug Tauri app still builds cleanly
- `pnpm run package:smoke`
  - The packaged `.app` can launch and complete the packaged smoke scenario

## Expected operator journey

1. Home renders without a global error.
2. Database shows pending migration work, then succeeds after apply.
3. Theme switches and persists.
4. Settings saves startup route, log level, and rollback preference.
5. Plugins enables a curated module and reflects the new count.
6. Diagnostics exports a support bundle and reports enabled plugin state.
7. Updates clearly shows the local-only/no-feed posture without pretending the build is broken.
8. A simulated restart restores the saved startup route and persisted state.

## Expected artifacts

- Local logs:
  - app data `logs` directory reported in Diagnostics
- Support bundles:
  - app data `support` directory reported in Diagnostics
- Packaged smoke outputs:
  - `.release-results/`
- Perf outputs:
  - `.perf-results/`

## Interpreting `doctor:mac`

- A pass means the Mac is aligned with the repo-supported local lane.
- A fail should be treated as an environment issue first, not as an app bug.
- The current most likely failure is Node not being on version 22.

## Common failure checks

- Unit tests fail after contract changes:
  - rerun `pnpm run contracts:check`
- E2E fails before launch:
  - rerun `pnpm --dir apps/desktop exec playwright install chromium`
- Packaged smoke fails but browser smoke passes:
  - inspect `.release-results/` and packaged-app launch output; this usually points to Tauri/package-specific regressions
- Updater page shows “not configured”:
  - expected for this milestone unless you explicitly embedded a feed

## Current deferred work

- Signed release publication
- Apple notarization/stapling
- Live updater credentials and hosted production feed
