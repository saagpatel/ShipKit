# macOS Local Setup

ShipKit currently supports a macOS-only local development and smoke workflow.

## Prerequisites

- macOS
- Node 22
- pnpm 10
- Rust toolchain with `cargo`
- Xcode Command Line Tools
- Repo-local Tauri CLI from `pnpm install --frozen-lockfile`

## First-time setup

```bash
pnpm run doctor:mac
pnpm install --frozen-lockfile
pnpm --dir apps/desktop exec playwright install chromium
```

`pnpm run doctor:mac` does not modify the repo. It should only fail when this
Mac is missing a prerequisite or is using the wrong runtime lane.

## Day-to-day local flow

```bash
pnpm run dev:desktop
```

If the normal dev path is too heavy on disk:

```bash
cd apps/desktop
pnpm lean:dev
```

## Local verification path

```bash
pnpm run doctor:mac
pnpm run test
pnpm run test:e2e
pnpm run smoke:desktop
pnpm run package:smoke
pnpm run verify
```

## Common fixes

- Node warning about unsupported engine:
  - Switch the shell to Node 22, then rerun `pnpm install --frozen-lockfile`
- `doctor:mac` reports missing Xcode CLT:
  - Run `xcode-select --install`
- `test:e2e` cannot launch Chromium:
  - Run `pnpm --dir apps/desktop exec playwright install chromium`
- `dev:desktop` does not open on `1420`:
  - ShipKit already picks the first open port starting at `1420`; check the printed URL
- updater/feed looks unavailable:
  - That is expected for the current local-only milestone unless you deliberately embed a feed
- `package:smoke` fails while browser smoke passes:
  - Inspect `.release-results/`; that usually points to a Tauri or packaging regression rather than a UI workflow bug

## Intentional non-goals for this setup

- Real Apple signing and notarization
- Live hosted updater credentials
- Linux or Windows desktop support
