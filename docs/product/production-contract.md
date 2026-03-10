# ShipKit Desktop Production Contract

## Product Promise

ShipKit Desktop is a polished, developer-facing desktop control center for local ShipKit-powered applications.

It should make local runtime management feel trustworthy and understandable by giving users one place to:

- Inspect database and migration state
- Manage typed settings
- Apply and preview themes
- Review logs and diagnostics
- Enable curated plugins and prepare for signed updater workflows

## Target User

- Primary: developers building or operating a ShipKit-based desktop app locally
- Secondary: maintainers validating release readiness, migrations, settings, and runtime health

## Release Defaults

- Primary release target: macOS
- Overall program completion still includes Windows and Linux readiness
- Plugin model default: curated and signed only
- Updater hosting default: GitHub Releases-backed signed feed unless explicitly replaced
- Sidecars/external binaries: avoid by default unless a later milestone proves they are required

## Product Surfaces

- `Home`
  - system status
  - quick actions
  - current theme and migration summary
  - diagnostics snapshot
- `Database`
  - migration status
  - apply/rollback
  - history and safe confirmations
- `Settings`
  - typed preferences
  - namespace details
  - import/export/reset
- `Theme`
  - active theme
  - mode selection
  - generated CSS preview
- `Logs`
  - recent entries
  - filtering
  - export
- `Diagnostics`
  - app paths
  - runtime health
  - support bundle path
- `Plugins`
  - curated plugin catalog
  - local enable/disable controls
  - capability visibility and compatibility messaging
- `Updates`
  - signed-feed check
  - download/install
  - restart to apply
  - graceful setup messaging for unsigned local builds

## Admin vs Product Split

- Product-first surfaces: Home, Database, Settings, Theme, Logs
- Advanced/admin surfaces: Diagnostics, Updates, Plugins
  - Current plugin scope is metadata-driven and curated-only.

## Current Execution Priorities

1. Make the repo truthful and deterministic.
2. Replace the demo grid with a production shell.
3. Harden contracts, settings, migrations, and permissions.
4. Add plugin and updater systems only after the base product is stable.

## Definition of Done For This Stage

- Root scripts exist for build, typecheck, test, verify, smoke, perf, and release-check.
- `.codex/verify.commands` runs meaningful repo gates.
- CI points only at real commands.
- The desktop app has a navigable shell and app-wide theme application.
- The desktop app includes a curated plugin catalog with persisted local enable/disable state.
- README and delivery docs no longer overstate the repo's current maturity.
