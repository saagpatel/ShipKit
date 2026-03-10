# Codex Project Actions

These scripts are the shared action layer for ShipKit's Codex app setup.

Use them as the command targets for:

- Local environment setup
- Verify
- Desktop dev
- Package smoke

Recommended local-environment setup command:

```bash
bash .codex/actions/setup-worktree.sh
```

Recommended project actions:

- `Verify` -> `bash .codex/actions/run-verify.sh`
- `Desktop Dev` -> `bash .codex/actions/dev-desktop.sh`
- `Package Smoke` -> `bash .codex/actions/package-smoke.sh`

The scripts are also safe to run directly from the repository root.
