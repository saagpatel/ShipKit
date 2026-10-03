# ShipKit

[![Rust](https://img.shields.io/badge/Rust-dea584?style=flat-square&logo=rust)](#) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)

> The Tauri foundations every desktop app needs — migrations, settings, theming, logging — already built.

ShipKit is a Rust workspace providing production-ready shared modules for Tauri 2 desktop applications. Stop rebuilding database migration engines, settings stores, and theme systems from scratch — `shipkit-core` gives you type-safe, SQLite-backed implementations with a working Tauri 2 desktop shell exposing 26 IPC commands.

## Features

- **Database module** — SQLite connection pool (WAL mode), migration engine with SHA256 checksums, file-based migrations with rollback
- **Settings module** — type-safe settings with `#[derive(Settings)]` macro, SQLite backend, namespace isolation
- **Theme module** — CSS variable themes with light/dark defaults, macOS system theme detection, runtime switching
- **Logger module** — structured JSON logging via tracing, file rotation (daily/hourly/never), level filtering
- **26 IPC commands** — Tauri 2 integration exposing database, settings, theme, logging, diagnostics and plugin operations to TypeScript

## Quick Start

### Prerequisites
- macOS with Xcode Command Line Tools
- Rust stable with `cargo`
- Node.js 22 and pnpm 10 (see root `package.json` engines)
- Repo-local Tauri CLI, installed with the frozen JavaScript dependencies

Follow [macOS local setup](docs/ops/macos-local-setup.md) for prerequisites and
Playwright Chromium installation. Ubuntu CI checks code health; it does not
establish Linux desktop support.

### Installation
```bash
git clone https://github.com/saagpatel/ShipKit.git
cd ShipKit
pnpm install --frozen-lockfile
```

### Usage
```bash
# Run the desktop app
pnpm run dev:desktop

# Build the core library only
cargo build -p shipkit-core
```

## Verification

Run commands from the repository root. For focused coverage, use
`pnpm run test:frontend` or `cargo test --locked -p shipkit-core`; the broader unit suite
is `pnpm run test`. TypeScript and Rust checks are `pnpm run typecheck` and
`pnpm run lint` (Clippy). `pnpm run build` builds the frontend and Rust workspace.
No separate format command is configured.

The workspace `Cargo.lock` is committed to pin the desktop application and core
verification dependency graph. Keep Cargo manifests unchanged when refreshing
setup; use `--locked` for reproducible Rust checks. Intentional dependency
updates should review the manifest and lockfile together.

The complete gate is `pnpm run verify`, defined by
[`.codex/verify.commands`](.codex/verify.commands) and required by
[AGENTS.md](AGENTS.md). Keep its policy, contract, browser E2E, desktop/package,
release-scaffold and performance checks. Focused checks do not replace it.
Use the [local smoke runbook](docs/ops/local-smoke-runbook.md) for the expected
operator journey, especially after UI or IPC behavior changes. Browser E2E
uses a localhost server on port 4173; if occupied, preserve the existing
listener and resolve the port conflict before running the canonical command.

Desktop/package smoke requires macOS. Package smoke builds and launches an
unsigned app with isolated smoke data; signing preflight warnings, a generated
local feed, and passing tests do not prove signing, notarization or a live
updater. See the existing [support matrix](docs/release/support-matrix.md) and
[signing/updater guide](docs/release/signing-and-updater.md). Release freeze and
publication decisions remain as documented there.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Rust (workspace) |
| Desktop runtime | Tauri 2 |
| Storage | SQLite (rusqlite + r2d2, WAL mode) |
| Logging | tracing + tracing-appender |
| Macros | proc-macro crate (shipkit-macros) |
| Frontend | React 19 + TypeScript |

## License

MIT
