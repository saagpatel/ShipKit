# AGENTS.md

<!-- comm-contract:start -->

## Communication Contract

- Inherit global Codex communication and reporting rules from `/Users/d/.codex/AGENTS.override.md` and `/Users/d/.codex/policies/communication/BigPictureReportingV1.md`.
- Repo-specific instructions below add project constraints only; do not restate global voice or status-reporting rules here.
<!-- comm-contract:end -->

## Repo-Specific Completion Rules

- Work on a non-default branch named `codex/<type>/<slug>` for implementation changes.
- Commits must be atomic by concern and follow Conventional Commits.
- PR descriptions must include What, Why, How, Testing, Performance impact, and Risk / Notes.
- If a lockfile changed, include lockfile rationale in the PR body.
- Required checks before done-state:
  - git hygiene
  - `pnpm run policy:changes`
  - `pnpm run contracts:check`
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run test`
  - `pnpm run build`
  - `pnpm run smoke:desktop`
  - `pnpm run package:smoke`
  - `pnpm run release:preflight`
  - `pnpm run updater:scaffold`
  - `pnpm run release:bundle`
  - `pnpm run release:validate-feed`
  - `pnpm run perf:build`
  - `pnpm run perf:bundle`
  - `pnpm run perf:memory`
  - `pnpm run perf:assets`
- Required gates block completion when `fail` or `not-run`.
- Performance budget enforcement is currently applied by the `perf-enforced` workflow when the production profile is enabled.

## Inherited Operating Rules

- Inherit global git, review/fix, testing, docs, UI, security, skill-use, and reporting gates from `/Users/d/.codex/AGENTS.md` and active session instructions.
- Use `.codex/verify.commands` and `.codex/scripts/run_verify_commands.sh` as this repo-local verification authority when present.
- API/command surface changes must update the checked frontend/backend contract surface (`pnpm run contracts:check`) and any request/response examples.
