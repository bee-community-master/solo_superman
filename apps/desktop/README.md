# Desktop scaffold

`pnpm dev:desktop` starts the Vite development shell. The Tauri v2 native shell is scaffolded under `src-tauri/` and can be tried with `pnpm --filter @solo-superman/desktop dev:tauri` when local native prerequisites are available.

Current desktop scope mounts the Decision Queue sidecar client, loopback-only local capability token boundary, native app-data path discovery, and secret-ref boundary stubs. ProductEngine persistence, DB-backed storage, Codex runtime execution, and real OS secret persistence remain sidecar/native follow-up work.

Phase 1.5A operations recovery is surfaced in the Decision Queue shell without changing the canonical docs/30 source of truth:

- The allowlist screen lists connector/source categories, `public_safe_summary` policy, disclosure logging, rate/retry limits, and pause/revoke controls.
- Research disclosure logs appear in the Activity feed with the public-safe summary, status, blocker reason, and manual-handoff reason when applicable.
- Research run cards show status, quality-gate state, stale/failure/review reason, `statusUrl`/refetch recovery context, and cancel/retry controls.
- The 1.5A exit gate is explicit: unresolved blocking Research-updated Queue cards, missing recovery hints, or missing quality-gate visibility block 1.5B readiness.

Useful checks for desktop changes:

- `pnpm vitest run apps/desktop/src --passWithNoTests`
- `pnpm --filter @solo-superman/desktop typecheck`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
