# Web frontend

`pnpm dev:web` starts the Vite web frontend on loopback. The root `pnpm dev` command starts this web frontend and the Local Node/Hono Service together with a shared per-run local capability token.

Current web scope mounts the Decision Queue sidecar client and uses only `VITE_SOLO_SIDECAR_BASE_URL` plus `VITE_SOLO_LOCAL_CAPABILITY_TOKEN` for local sidecar discovery. The frontend must not import local DB, filesystem, shell, or native-bridge modules; ProductEngine persistence, DB-backed storage, Codex runtime preview, and Phase 3 controlled execution authority stay in the sidecar/service boundary.

Phase 1.5A operations recovery is surfaced in the Decision Queue shell without changing the canonical docs/30 source of truth:

- The allowlist screen lists connector/source categories, `public_safe_summary` policy, disclosure logging, rate/retry limits, and pause/revoke controls.
- Research disclosure logs appear in the Activity feed with the public-safe summary, status, blocker reason, and manual-handoff reason when applicable.
- Research run cards show status, quality-gate state, stale/failure/review reason, `statusUrl`/refetch recovery context, and cancel/retry controls.
- The 1.5A exit gate is explicit: unresolved blocking Research-updated Queue cards, missing recovery hints, or missing quality-gate visibility block 1.5B readiness.

Useful checks for web changes:

- `pnpm vitest run apps/web/src --passWithNoTests`
- `pnpm --filter @solo-superman/web typecheck`
