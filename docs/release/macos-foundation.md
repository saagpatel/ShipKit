# macOS Release Foundation

ShipKit is still pre-signing and pre-notarization, but the repo now has a stronger macOS release foundation than a pure build-only flow.

## Current release checks

- `pnpm run smoke:desktop`
  - Builds the Tauri app in debug mode without bundling.
- `pnpm run package:smoke`
  - Builds a macOS `.app` bundle in CI-safe mode.
  - Launches the packaged app with `SHIPKIT_SMOKE_EXIT_AFTER_MS` so the smoke gate proves the app can start and exit cleanly.
  - Runs the `restore-support-bundle` smoke scenario against an isolated data directory, so packaged recovery behavior is validated during launch.
  - Stages a zipped copy of the packaged app under `.release-results/artifacts/` so CI can retain a portable artifact.
- `pnpm run release:manifest`
  - Writes release metadata to `.release-results/` for the latest built macOS app bundle.
  - Captures channel, version, bundle identifier, bundle path, staged artifact path, and SHA256 values for downstream release work.
- `pnpm run release:preflight`
  - Writes a signing, notarization, updater, and distribution readiness report to `.release-results/signing-preflight.json`.
  - Supports report-only mode by default and strict failure mode when `SHIPKIT_REQUIRE_SIGNING_SECRETS=1` or `--strict`.
- `pnpm run updater:scaffold`
  - Writes updater metadata to `.release-results/` using the latest generated release manifest.
  - Signs the staged artifact with Tauri signer when updater signing keys are provided.
  - Derives GitHub Releases URLs automatically when `SHIPKIT_RELEASE_HOST=github-releases`.
- `pnpm run release:tauri-config`
  - Writes the Tauri overlay used to embed updater endpoints and the public verification key into packaged release builds.
- `pnpm run release:bundle`
  - Creates a publishable release bundle under `.release-results/publish/`.
  - Includes artifact, updater metadata, updater-compatible `latest.json`, release manifest, release notes, and provenance JSON.
- `pnpm run release:validate-feed`
  - Hosts the generated release bundle locally for a short validation pass.
  - Verifies a locally served updater manifest can fetch the staged artifact and match its checksum.
- `pnpm run release:rehearse-local-feed`
  - Generates a temporary updater keypair and rebuilds the package with a localhost updater endpoint.
  - Produces a signed local rehearsal feed without needing production credentials.
- `pnpm run release:promote -- --from canary --to beta`
  - Copies the generated release metadata forward one release channel.
  - Writes a promotion report into `.release-results/` for review.
- `pnpm run verify`
  - Runs the full repo gate, including packaged smoke, signing preflight, updater metadata generation, and release bundle creation.

## Current scope

- Target: macOS-first release path
- Artifact shape: unsigned debug `.app` bundle plus staged zip artifact, updater metadata, updater-compatible latest manifest, publish bundle, and generated provenance for smoke validation
- Confidence level: packaged startup, packaged restore-from-bundle validation, CI artifact upload, and publish-bundle generation are in place before signing/notarization work begins
- Local hosted-feed rehearsal: available, including temporary signed updater metadata and localhost feed validation

## Still required before real release

- Apple Developer signing credentials
- Notarization + stapling workflow
- Real Apple codesign + notarization build execution
- Final hosted release publication with live credentials
- Rollback and release-note workflow

## Recommended next release steps

1. Run the strict `release-publish` workflow with real Apple credentials, updater keys, and either a stable GitHub Releases feed or an explicit prerelease updater endpoint.
2. Replace debug unsigned macOS packaging with an actual signed and notarized build lane.
3. Publish validated canary/beta/stable assets through GitHub Releases using the generated bundle outputs, including `latest.json`.
4. Add rollback policy and final release-note authoring on top of the generated publish bundle.
