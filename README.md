# ShipKit

> Tauri 2 desktop foundations plus a local-first macOS desktop control app

ShipKit is a Rust workspace and Tauri desktop app focused on the parts teams usually have to rebuild: database migrations, settings management, theming, and structured logging. The repository currently contains a strong shared-core foundation and an actively modernizing desktop product shell.

## Status

**Foundation complete, local macOS hardening in progress** — the shared Rust modules are real and integrated, and the repo is currently focused on truthful verification, a product-grade local shell, and repeatable Mac operator workflows.

- ✅ Core library with database, settings, theme, and logger modules
- ✅ Tauri integration with desktop IPC coverage and a working frontend
- 🚧 Local macOS operator hardening: setup truth, UI smoke automation, deeper product surfaces, and runbook quality

## Features

### Core Library (`shipkit-core`)

- **Database Module** — SQLite connection pool with WAL mode, migration engine with SHA256 checksums, file-based migrations with rollback support
- **Settings Module** — Type-safe settings with derive macro, SQLite backend, namespace isolation
- **Theme Module** — CSS variable themes with light/dark defaults, system theme detection (macOS), runtime theme switching
- **Logger Module** — Structured JSON logging with tracing, file rotation (daily/hourly/never), level filtering

### Desktop App (`shipkit-desktop`)

- **25 IPC Commands** — Tauri 2 integration exposing the core module API
- **Desktop Product Shell** — active modernization from a panel demo into a routed desktop workspace
- **Curated Plugin Catalog** — signed-only plugin metadata with local enable/disable controls
- **Updates Admin Surface** — local-only updater posture, signed-feed inspection, and graceful handling for builds without embedded release credentials
- **TypeScript Bindings** — checked TypeScript/Rust contracts with additive desktop summaries
- **Persistent State** — theme preference survives app restarts

## Architecture

```
ShipKit/
├── packages/
│   ├── core/           # shipkit-core library
│   │   ├── db/         # ConnectionPool, MigrationEngine
│   │   ├── settings/   # Settings trait, SqliteSettingsStore
│   │   ├── theme/      # ThemeEngine, default themes
│   │   └── logger/     # Logger, read_log_entries
│   └── macros/         # #[derive(Settings)]
└── apps/
    └── desktop/        # Tauri 2 app
        ├── src/        # React 19 + TypeScript frontend
        └── src-tauri/  # Rust backend with IPC commands
```

## Quick Start

### Prerequisites

- Rust 1.84+ (edition 2024)
- Node.js 22 LTS with pnpm
- macOS as the only supported product platform for this milestone
- Xcode Command Line Tools

### Validate This Mac First

```bash
pnpm run doctor:mac
```

### Install Browser Support For UI Smoke

```bash
pnpm --dir apps/desktop exec playwright install chromium
```

### Run the Desktop App

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run in normal dev mode (faster warm rebuilds, more disk usage)
pnpm run dev:desktop
```

### Lean Dev Mode (Low Disk)

```bash
cd apps/desktop
pnpm lean:dev
```

`pnpm lean:dev` still starts the app with `pnpm dev:tauri`, but redirects heavy build caches to a temporary directory and cleans heavy artifacts automatically when the process exits.
`pnpm run dev:desktop` picks the first open local port starting at `1420`, so another repo already using `1420` does not block ShipKit from starting.

Tradeoff:
- Normal dev keeps build outputs in the repo (`target`, Vite cache) for faster rebuilds.
- Lean dev reuses dependencies but discards heavy build artifacts on exit, so startup/rebuilds are slower while disk usage stays lower.

### Cleanup Commands

```bash
cd apps/desktop

# Remove heavy build artifacts only (keeps dependencies installed)
pnpm clean:heavy

# Remove all reproducible local caches/artifacts (including node_modules)
pnpm clean:full
```

### Use the Core Library

```toml
[dependencies]
shipkit-core = { git = "https://github.com/saagar210/ShipKit" }
```

```rust
use shipkit_core::{ConnectionPool, LoggerConfig, Logger};

let pool = ConnectionPool::new("app.db")?;
let logger = Logger::init(LoggerConfig::default())?;
```

## Development

### Run Repo Verification

```bash
pnpm run verify
```

### Local Smoke Sequence

```bash
pnpm run test:e2e
pnpm run smoke:desktop
pnpm run package:smoke
```

### Key Commands

```bash
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run smoke:desktop
pnpm run package:smoke
pnpm run release:tauri-config
pnpm run release:preflight
pnpm run updater:scaffold
pnpm run release:bundle
pnpm run release:validate-feed
pnpm run release:rehearse-local-feed
pnpm run release:manifest
pnpm run release:promote -- --from canary --to beta
```

### Key Docs

- [`docs/product/production-contract.md`](docs/product/production-contract.md)
- [`docs/ops/macos-local-setup.md`](docs/ops/macos-local-setup.md)
- [`docs/ops/local-smoke-runbook.md`](docs/ops/local-smoke-runbook.md)
- [`docs/product/plugin-catalog.md`](docs/product/plugin-catalog.md)
- [`docs/release/local-feed-rehearsal.md`](docs/release/local-feed-rehearsal.md)
- [`docs/release/support-matrix.md`](docs/release/support-matrix.md)
- [`docs/release/signing-and-updater.md`](docs/release/signing-and-updater.md)

## API Examples

### Migrations

```rust
use shipkit_core::{MigrationEngine, Migration};

let mut engine = MigrationEngine::new(pool);
engine.register(Migration {
    version: 1,
    name: "create_users".into(),
    up_sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);".into(),
    down_sql: Some("DROP TABLE users;".into()),
});

engine.apply_pending()?;  // Run all pending migrations
```

### Settings with Derive Macro

```rust
use shipkit_core::{Settings, SqliteSettingsStore};
use serde::{Serialize, Deserialize};

#[derive(Settings, Serialize, Deserialize)]
#[settings(namespace = "app")]
struct AppSettings {
    #[settings(default = "dark")]
    theme: String,

    #[settings(default = "14")]
    font_size: u32,
}

let store = SqliteSettingsStore::new(pool)?;
let settings = AppSettings::load(&store)?;
```

### Theme Switching

```rust
use shipkit_core::{ThemeEngine, theme::default_themes};

let mut engine = ThemeEngine::new(default_themes(), "dark")?;
let theme = engine.set_active("light")?;
let css = engine.generate_css();  // `:root { --sk-color-primary: #3b82f6; ... }`
```

### Structured Logging

```rust
use shipkit_core::{Logger, LoggerConfig};
use tracing::info;

let logger = Logger::init(LoggerConfig {
    log_dir: "logs".into(),
    file_prefix: "app".into(),
    json_format: true,
    ..Default::default()
})?;

info!(user_id = 42, "User logged in");
```

## Current Focus

- Make the repo truthful: real root scripts, real verify commands, and Mac-only CI parity
- Deepen the migration, plugins, diagnostics, and local-only updater product surfaces
- Harden contracts, setup docs, smoke automation, and packaged-build validation
- Resume signed updater delivery only after the local macOS product is fully settled

## Technical Details

- **Rust Edition:** 2024
- **Workspace Lints:** `unwrap_used = "deny"`, `expect_used = "warn"`
- **Concurrency:** Mutex for mut operations, RwLock for read/write split
- **Database:** SQLite with WAL mode, r2d2 connection pooling
- **Frontend:** React 19, Vite 6, TypeScript 5 (strict mode)
- **IPC Pattern:** app-level commands with structured error envelopes and browser-hosted E2E bridge support for operator smoke

## License

MIT

## Contributing

Contributions welcome! This is an early-stage macOS-focused project under active development.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`cargo test -p shipkit-core -p shipkit-macros`)
4. Ensure clippy passes (`cargo clippy --workspace -- -D warnings`)
5. Commit (`git commit -m 'feat: add amazing feature'`)
6. Push and open a PR

---

Built with [Tauri 2](https://tauri.app) and [Rust](https://rust-lang.org).
