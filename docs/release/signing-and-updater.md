# Signing and Updater Scaffolding

ShipKit now has a report-first release scaffold for macOS packaging. It does not sign or notarize artifacts yet, but it does make the expected environment and generated metadata explicit.

## Commands

- `pnpm run release:preflight`
  - Writes `.release-results/signing-preflight.json`
  - Checks whether the repo has enough environment data for signing and notarization
  - Runs in report-only mode unless `SHIPKIT_REQUIRE_SIGNING_SECRETS=1`
- `pnpm run updater:scaffold`
  - Writes `.release-results/updater-scaffold-<channel>-<platform>.json`
  - Uses the latest generated release manifest for the selected channel
  - Signs the staged artifact when updater signing keys are available
- `pnpm run release:tauri-config`
  - Writes `.release-results/tauri-release-overlay.json`
  - Embeds updater endpoints and the public verification key into the Tauri build only when both values are available
  - Defaults GitHub Releases hosting to the stable `latest.json` path; prerelease channels need an explicit updater endpoint or custom artifact base URL
- Desktop app `Updates` workspace
  - Uses the official Tauri updater and process plugins
  - Can inspect the configured manifest endpoint before a live update check
  - Can check, download, install, and relaunch when the release build includes a signed updater feed
  - Unsigned local/dev builds may return setup errors until the real feed and public key are embedded
- `pnpm run release:bundle`
  - Creates `.release-results/publish/<channel>/<version>/<platform>/`
  - Stages artifact, signature, release metadata, release notes, and provenance for publication
- `pnpm run release:validate-feed`
  - Starts a temporary local static server against the generated release bundle
  - Validates a locally served updater manifest and artifact download before live publication
- `pnpm run release:rehearse-local-feed`
  - Generates a temporary Tauri updater keypair
  - Rebuilds the package with a localhost updater endpoint and public key embedded
  - Produces a signed local feed rehearsal without production secrets
- `pnpm run release:promote -- --from canary --to beta`
  - Promotes the generated release manifest and updater scaffold to the next channel with promotion metadata
  - Creates a channel-aligned copy of the staged artifact zip inside `.release-results/artifacts/`
  - Writes `.release-results/release-promotion-<from>-to-<to>-<platform>.json`

## CI entry points

- `.github/workflows/ci.yml`
  - Runs packaged smoke, updater scaffold generation, local feed validation, signing preflight, and uploads `.release-results/` from macOS CI.
- `.github/workflows/release-foundation.yml`
  - Manual workflow for canary -> beta or beta -> stable metadata promotion.
  - Rebuilds the packaged artifact, regenerates release metadata, validates the local hosted feed, runs preflight, promotes the selected channel, and uploads the resulting `.release-results/`.
- `.github/workflows/release-publish.yml`
  - Strict manual workflow for signed updater metadata and GitHub Releases publication.
  - Requires real signing/notarization and updater credentials to pass preflight.
  - Also validates the generated bundle through the local hosted-feed check before publishing.

## Expected signing environment

### Required for signing

- `SHIPKIT_APPLE_CERTIFICATE_P12_BASE64`
- `SHIPKIT_APPLE_CERTIFICATE_PASSWORD`
- `SHIPKIT_APPLE_SIGNING_IDENTITY`
- `SHIPKIT_APPLE_TEAM_ID`

### Supported notarization modes

- Apple ID mode
  - `SHIPKIT_APPLE_ID`
  - `SHIPKIT_APPLE_APP_PASSWORD`
- App Store Connect API key mode
  - `SHIPKIT_APPLE_API_KEY_ID`
  - `SHIPKIT_APPLE_API_ISSUER_ID`
  - `SHIPKIT_APPLE_API_PRIVATE_KEY`
- Stored notarytool profile mode
  - `SHIPKIT_APPLE_NOTARY_TOOL_PROFILE`

## Optional release metadata environment

- `SHIPKIT_RELEASE_CHANNEL`
  - Defaults to `canary`
- `SHIPKIT_RELEASE_HOST`
  - Set to `github-releases` to derive release URLs from the current repository and computed tag
- `SHIPKIT_RELEASE_REPOSITORY`
  - Overrides the GitHub repository used for release URLs and publish workflows
- `GH_TOKEN` or `GITHUB_TOKEN`
  - Required when using `SHIPKIT_RELEASE_HOST=github-releases` in strict preflight or publish workflows
- `SHIPKIT_RELEASE_ARTIFACT_BASE_URL`
  - Base URL used when building scaffold artifact URLs
- `SHIPKIT_RELEASE_NOTES_BASE_URL`
  - Base URL used when building scaffold notes URLs
- `SHIPKIT_TAURI_UPDATER_ENDPOINT`
  - Explicit endpoint to embed in the packaged app when stable GitHub Releases latest.json is not the right feed
- `SHIPKIT_UPDATER_PUBLIC_KEY` or `SHIPKIT_UPDATER_PUBLIC_KEY_PATH`
  - Public verification key embedded into release builds so the Tauri updater can validate signatures
- `VITE_SHIPKIT_UPDATE_CHANNEL`
  - Optional frontend hint for the desktop `Updates` workspace
- `VITE_SHIPKIT_RELEASE_HOST`
  - Optional frontend hint for how the release feed is expected to be hosted
- `VITE_SHIPKIT_RELEASE_REPOSITORY`
  - Optional frontend hint for the GitHub Releases repository shown in the desktop `Updates` workspace
- `VITE_SHIPKIT_RELEASE_ARTIFACT_BASE_URL`
  - Optional frontend hint for a custom hosted latest-manifest URL shown in the desktop `Updates` workspace
- `VITE_SHIPKIT_TAURI_UPDATER_ENDPOINT`
  - Optional frontend hint for the exact embedded updater endpoint shown in the desktop `Updates` workspace
- `SHIPKIT_UPDATER_PRIVATE_KEY` or `TAURI_SIGNING_PRIVATE_KEY`
  - Used by Tauri signer to create updater-compatible signatures for the staged artifact
- `SHIPKIT_UPDATER_PRIVATE_KEY_PASSWORD` or `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - Optional password for the updater signing key

## Generated outputs

- `.release-results/release-manifest-<channel>-<platform>.json`
  - Packaged artifact metadata from `package:smoke`, including the staged zip artifact when available
- `.release-results/signing-preflight.json`
  - Secret/readiness report for signing and notarization
- `.release-results/updater-scaffold-<channel>-<platform>.json`
  - Updater metadata with signature fields populated when signing keys are available
- `.release-results/artifacts/*.zip`
  - Portable staged macOS artifact copied out of the local Tauri build cache for CI retention and later promotion work
- `.release-results/publish/<channel>/<version>/<platform>/`
  - Publish-ready bundle with artifact, updater metadata, release notes, updater-compatible `latest.json`, and provenance JSON
- `.release-results/release-bundle-summary-<channel>-<platform>.json`
  - Summary file used by CI workflows to publish the correct assets
- `.release-results/local-feed-validation-<channel>-<platform>.json`
  - Result of the lightweight hosted-feed validation pass against the generated bundle
- `.release-results/local-feed-rehearsal-<channel>-<platform>.json`
  - Result of the deeper signed localhost rehearsal flow

## Hosting note

- Stable releases can use the GitHub Releases `latest/download/latest.json` path by default.
- Canary and beta releases should provide `SHIPKIT_TAURI_UPDATER_ENDPOINT` or `SHIPKIT_RELEASE_ARTIFACT_BASE_URL` so the packaged app does not embed a misleading stable-only feed.

## Promotion model

- `canary`
  - Default internal validation channel
- `beta`
  - Promotion target after canary smoke and review
- `stable`
  - Promotion target after signing, notarization, and rollback checks

Promotion remains metadata-first, while `release-publish.yml` is the strict path for signed updater metadata and hosted GitHub Releases publication.
