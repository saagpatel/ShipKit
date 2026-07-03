# ShipKit — Portfolio Disposition

**Status:** Release Frozen — Rust workspace + Tauri 2 desktop foundation
shipped on `origin/main` with complete release-readiness docs (adr,
delivery, ops, product, release). Awaiting operator-only Apple
signing. Joins the signing-frozen cluster (now 9 repos).

> Disposition uses strict `origin/main` verification.

---

## Verification posture

This repo has both `origin` (`saagpatel/ShipKit`) and `legacy-origin`
(`saagar210/ShipKit`) remotes. Disposition reads `origin/main` only.

Specifically verified:
- `origin/main` tip: `98fd2cd` chore: add initial CHANGELOG
- Recent substantive commits on `origin/main`:
  - `6b97107` feat(desktop): harden mac-only operator workflow
  - `0b40ce1` perf(desktop): trim shipped shell copy
  - `2107f29` fix(desktop): harden local launch and readiness checks
  - `15eeb42` feat(desktop): complete release-ready desktop foundation (#3)
  - `8236947` feat: add Tauri 2 desktop app integration (Phase 2)
  - `992d01f` feat: implement shipkit-core Phase 1 — db, settings, theme, logger
  - `060b24f` feat: scaffold workspace with core and macros crates
- `docs/` on `origin/main` includes: adr/, delivery/, ops/, product/, release/
- `release/channels.json` defines release rings
- Cargo workspace (`Cargo.toml`) + `apps/`, `packages/`, `crates`

---

## Current state in one paragraph

ShipKit is a Rust workspace providing production-ready shared modules
for Tauri 2 desktop apps: SQLite migration engine with SHA256
checksums, type-safe settings with derive macro, CSS-variable themes
with macOS system-theme detection, structured JSON logging via
tracing. A working Tauri 2 desktop shell demonstrates all 25 IPC
commands. Phase 1 (shipkit-core: db, settings, theme, logger) and
Phase 2 (Tauri 2 desktop integration) complete. The mac-only
operator workflow is hardened and release-ready per the
`feat(desktop): complete release-ready desktop foundation` commit
(#3, merged).

For full detail (in priority order):
- `docs/release/` (release rings + channel config)
- `docs/ops/` (operator workflow)
- `docs/product/` (product framing)
- `docs/delivery/`
- `docs/adr/` (architecture decisions)
- `README.md`

---

## Portfolio operating system instructions

| Aspect | Posture |
|---|---|
| Portfolio status | `Release Frozen` |
| Review cadence | Suspend overdue counting |
| Resurface conditions | (a) Apple signing credentials wired, (b) operator opens a Phase 3 scope packet (additional modules, e.g. networking/auth/storage abstractions), or (c) operator decides to publish shipkit-core to crates.io as a library |
| Co-batch with | Signing cluster: DesktopPEt / ContentEngine / AIGCCore / Relay / FreeLanceInvoice / Nexus / DeepTank / OPscinema / **ShipKit** — **now 9 repos**. |
| Unique angle | This repo is a **foundation library** for Tauri 2 apps, not an end-user product. The "user" is the operator using shipkit-core in other repos. That changes the signing calculus — distribution might mean crates.io publishing, not just .app bundling. |

---

## Why "Release Frozen" instead of other dispositions

- **Active** — wrong. Release readiness scope is complete; only credentials gate.
- **Cold Storage / Archived** — wrong. Recent hardening commits show active work.
- **Release Frozen** — correct. Same shape as signing cluster.
- **Special case to consider:** distribution model. ShipKit is library code, not user-facing — so unblock may include crates.io publishing decision, not just .app signing.

---

## Unblock trigger (operator)

When ready to ship:

1. Decide distribution model:
   - Option A: `.app` bundle only — sign + notarize, distribute via release channels per `release/channels.json`
   - Option B: crates.io publish for `shipkit-core` and `shipkit-macros` — allows other operator projects (Conductor, SnippetLibrary, future Tauri apps) to depend on shipkit as a library
   - Option C: both
2. If A or C: Apple Developer ID + notarization credentials.
3. If B or C: `cargo publish` for the workspace crates.
4. Cut v0.1.0 release(s) per chosen channels.

Estimated operator time once decisions are in hand: ~3 hours for
Option A, ~1 hour for Option B (additive), ~4 hours for Option C.

---

## Reactivation procedure (for the next code session)

1. **Verify local clone tracking.** `git branch -vv` — if `main`
   tracks `legacy-origin/main`, retarget to `origin/main`. Trap
   reference: FreeLanceInvoice / PersonalKBDrafter corrections.
2. Re-run `cargo build && cargo test` to confirm the workspace
   compiles cleanly.
3. Re-run `pnpm install && pnpm tauri build` to confirm the desktop
   shell still builds after the freeze.
4. Decide distribution model (Option A/B/C above) before signing or
   publishing work.

---

## Last known reference

| Field | Value |
|---|---|
| `origin/main` tip | `98fd2cd` chore: add initial CHANGELOG |
| Last substantive commit | `6b97107` feat(desktop): harden mac-only operator workflow |
| Release-ready commit | `15eeb42` feat(desktop): complete release-ready desktop foundation (#3) |
| Build verification status | green |
| Blocker | Apple signing OR crates.io publishing decision (operator) |
| Migration note | `legacy-origin` points at frozen `saagar210/ShipKit`; do not push there |
| Special note | Library code, not end-user product — distribution model is part of unblock |
