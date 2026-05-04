# Desktop scaffold

`pnpm dev:desktop` intentionally starts the Vite development shell only. The Tauri v2 native shell is scaffolded under `src-tauri/` and can be tried with `pnpm --filter @solo-superman/desktop dev:tauri` when local native prerequisites are available.

This PR-01 scaffold does not implement ProductEngine, DB, Codex, or full Decision Queue UI behavior.
