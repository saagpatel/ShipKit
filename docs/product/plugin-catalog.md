# Curated Plugin Catalog

ShipKit Desktop currently treats plugins as a curated, signed-only catalog.

This is the first production slice of the plugin roadmap. It is intentionally
safer and narrower than a general-purpose extension marketplace.

## Current model

- Plugins are bundled as metadata manifests inside the desktop app.
- The desktop UI can list plugins and locally enable or disable them per
  workspace.
- Plugin status is persisted in ShipKit settings storage.
- Support bundles include plugin state so diagnostics and recovery artifacts can
  explain which curated modules were enabled when a bundle was exported.

## Why this scope exists

- It gives ShipKit a real plugin surface without introducing arbitrary code
  execution into the product before compatibility, trust, and release signing
  workflows are fully ready.
- It keeps the roadmap aligned with the repo’s current release maturity: signed
  updater and signed release delivery are still being completed.

## Current curated plugins

- `shipkit.release-brief`
  - Release-oriented metadata summary module
- `shipkit.runtime-snapshot`
  - Diagnostics-oriented runtime snapshot module
- `shipkit.migration-audit`
  - Database and migration review module

## Current user experience

- The `Plugins` workspace lists every bundled manifest.
- Each plugin shows category, distribution model, compatibility, minimum
  ShipKit version, and declared capabilities.
- Users can enable or disable a curated plugin for the local desktop workspace.

## Current boundaries

- No third-party plugin loading
- No external plugin downloads
- No sidecar/external binary requirement
- No arbitrary plugin execution outside the curated manifest model

## Planned later expansion

- Compatibility gates tied to signed release channels
- Stronger trust and provenance policy for curated plugin packages
- Deeper integration between plugin state, updater policy, and release notes
