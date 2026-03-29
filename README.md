# ShipKit

[![Rust](https://img.shields.io/badge/Rust-dea584?style=flat-square&logo=rust)](#) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#)

> The Tauri foundations every desktop app needs — migrations, settings, theming, logging — already built.

ShipKit is a Rust workspace providing production-ready shared modules for Tauri 2 desktop applications. Stop rebuilding database migration engines, settings stores, and theme systems from scratch — `shipkit-core` gives you type-safe, SQLite-backed implementations with a working Tauri 2 desktop shell demonstrating all 25 IPC commands.

## Features

- **Database module** — SQLite connection pool (WAL mode), migration engine with SHA256 checksums, file-based migrations with rollback
- **Settings module** — type-safe settings with `#[derive(Settings)]` macro, SQLite backend, namespace isolation
- **Theme module** — CSS variable themes with light/dark defaults, macOS system theme detection, runtime switching
- **Logger module** — structured JSON logging via tracing, file rotation (daily/hourly/never), level filtering
- **25 IPC commands** — complete Tauri 2 integration exposing the full core API to TypeScript

## Quick Start

### Prerequisites
- Rust stable
- Node.js 18+ and pnpm
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)

### Installation
```bash
git clone https://github.com/saagpatel/ShipKit.git
cd ShipKit
pnpm install
```

### Usage
```bash
# Run the desktop app
pnpm tauri dev

# Build the core library only
cargo build -p shipkit-core
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | Rust (workspace) |
| Desktop runtime | Tauri 2 |
| Storage | SQLite (SQLx, WAL mode) |
| Logging | tracing + tracing-appender |
| Macros | proc-macro crate (shipkit-macros) |
| Frontend | React 19 + TypeScript |

## License

MIT
