# Execution Substrate

## Purpose

This repo uses a small project-scoped Codex execution layer so local work, worktrees, and later automations all bootstrap the same way.

## Files

- `.codex/config.toml` - project-level Codex defaults
- `.codex/actions/setup-worktree.sh` - install/bootstrap action
- `.codex/actions/run-verify.sh` - canonical verify action
- `.codex/actions/dev-desktop.sh` - desktop dev action
- `.codex/actions/package-smoke.sh` - packaged-build smoke action
- `.codex/execution-batch.schema.json` - structured output contract for milestone batches

## Worktree Defaults

- Keep feature work on a `codex/<type>/<slug>` branch.
- Use the setup script before running build or smoke commands in a fresh worktree.
- Treat `pnpm run verify` as the default completion gate for local milestone work.

## Manual-First Automation Candidates

These are planned but should only be scheduled after manual dry runs:

- nightly verify drift check
- weekly dependency and license sweep
- release-brief generation

The repo does not schedule these automatically yet.
