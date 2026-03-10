# Local Hosted Feed Rehearsal

ShipKit now includes a local rehearsal path for the updater and release bundle.

This is the safest repo-controlled way to practice the hosted update flow before
real Apple credentials and production release hosting are available.

## Commands

- `pnpm run release:validate-feed`
  - Uses the latest generated release bundle
  - Hosts the bundle locally for a short validation pass
  - Fetches a local `latest.local.json`
  - Verifies that the artifact can be downloaded and that its checksum matches
    the generated release manifest
  - Writes `.release-results/local-feed-validation-<channel>-<platform>.json`
- `pnpm run release:rehearse-local-feed`
  - Generates a temporary updater signing keypair with Tauri signer
  - Rebuilds the packaged artifact with a localhost updater endpoint and public
    key embedded
  - Generates signed updater metadata and a publish bundle
  - Runs `release:validate-feed` against that locally hosted bundle
  - Writes `.release-results/local-feed-rehearsal-<channel>-<platform>.json`

## What this proves

- The packaged artifact, updater metadata, and hosted feed shape are internally
  consistent.
- The repo can rehearse a signed local update feed without production secrets.
- The future real publish lane has a closer dry run than “generate files and
  hope.”

## What it does not prove yet

- Apple signing or notarization success
- Live GitHub Releases publication
- Real production updater credentials and feed hosting
- A true in-app update install against a production feed

## Recommended use

1. Run `pnpm run package:smoke`
2. Run `pnpm run updater:scaffold`
3. Run `pnpm run release:bundle`
4. Run `pnpm run release:validate-feed`
5. When you want the deeper rehearsal, run `pnpm run release:rehearse-local-feed`
