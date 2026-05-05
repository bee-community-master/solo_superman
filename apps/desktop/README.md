# Desktop scaffold

`pnpm dev:desktop` starts the Vite development shell. The Tauri v2 native shell is scaffolded under `src-tauri/` and can be tried with `pnpm --filter @solo-superman/desktop dev:tauri` when local native prerequisites are available.

Current desktop scope mounts the Decision Queue sidecar client, loopback-only local capability token boundary, native app-data path discovery, and secret-ref boundary stubs. ProductEngine persistence, DB-backed storage, Codex runtime execution, and real OS secret persistence remain sidecar/native follow-up work.

Useful checks for desktop changes:

- `pnpm vitest run apps/desktop/src --passWithNoTests`
- `pnpm --filter @solo-superman/desktop typecheck`
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
