# 19. Phase 1 Implementation Architecture

## 목적

이 문서는 Solo Superman Phase 1을 Codex가 구현할 때 첫 scaffold에서 다시 결정하지 않도록 runtime topology, package layout, dev scripts, process boundary, native boundary, storage/runtime 연결의 기준을 고정한다.

이 문서는 Phase 1 구현의 기준 계약이다. 실제 Tauri scaffold, package.json, migration file, API handler, runtime adapter 코드는 각 구현 PR과 현재 코드베이스가 소유하며, 이 문서는 그 구현이 따라야 할 경계와 금지선을 정의한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Desktop shell | Tauri v2 |
| Frontend | React + TypeScript + Vite |
| Local backend | Node.js sidecar |
| Sidecar HTTP framework | Hono |
| ProductEngine 위치 | Node/Hono sidecar |
| SQLite/libSQL repository 위치 | Node/Hono sidecar |
| Codex app-server integration 위치 | Node/Hono sidecar |
| Rust/Tauri 책임 | native boundary와 sidecar lifecycle |
| Package manager | pnpm workspace |
| API contract | Hono route + Zod contract + generated OpenAPI artifact |
| Storage | local embedded libSQL 우선 |
| Remote storage | config slot only, no sync in Phase 1 |
| Runtime execution | sandbox preview only, no file/shell/browser apply |

## Rejected alternatives

| 대안 | 기각 이유 |
| --- | --- |
| Rust core 중심 ProductEngine | macOS packaging과 native 경계는 강하지만 ProductEngine, JSON schema, LLM orchestration 구현 속도가 느려진다 |
| Rust storage + Node orchestration | 모든 repository 호출이 Tauri bridge를 타며 구현 복잡도가 커진다 |
| Frontend-local prototype | 데모는 빠르지만 Codex 자동 구현 목표와 장기 구조 안정성이 약하다 |
| 기능별 혼합 ownership | Queue, storage, Codex, ProductEngine 책임이 분산되어 구현 중 의사결정이 다시 발생한다 |
| Phase 1 remote sync 포함 | auth, conflict, offline/online, privacy disclosure가 함께 필요해 MVP가 커진다 |

## Process topology

```text
Tauri desktop process
├─ Rust host
│  ├─ window/app lifecycle
│  ├─ sidecar launch and shutdown
│  ├─ app data directory resolution
│  ├─ OS secret store boundary
│  ├─ file picker/export boundary
│  └─ sidecar base URL discovery
│
├─ WebView frontend
│  ├─ React UI
│  ├─ TanStack Query client
│  ├─ local UI state
│  └─ calls Node sidecar over loopback HTTP
│
└─ Node/Hono sidecar process
   ├─ Hono API server
   ├─ ProductEngine Orchestrator
   ├─ Decision Queue Scheduler
   ├─ Spec Engine module
   ├─ Research/Evidence module
   ├─ Completeness Scorer
   ├─ CodexRuntimeAdapter
   ├─ libSQL repository layer
   └─ event/activity stream
```

## Ownership boundary

| Capability | Owner | Notes |
| --- | --- | --- |
| ProductEngine command/event/state reduce | Node sidecar | `packages/core`에서 pure service로 구현하고 sidecar가 호출한다 |
| Queue projection and scheduling | Node sidecar | Frontend는 projection을 표시하고 user command만 보낸다 |
| Spec/Research/Completeness modules | Node sidecar | LLM/JSON/schema-heavy logic은 TypeScript에 둔다 |
| SQLite/libSQL connection | Node sidecar | repository layer가 DB를 직접 소유한다 |
| Migration execution | Node sidecar startup | packaged app startup에서 unapplied migration을 적용한다 |
| Codex app-server child process | Node sidecar | stdio transport를 기본으로 spawn한다 |
| Sidecar process launch | Rust/Tauri | Tauri가 Node sidecar binary를 시작하고 health를 확인한다 |
| App data dir | Rust/Tauri | OS별 path를 계산해 sidecar에 넘긴다 |
| Secret storage | Rust/Tauri | secret value는 Rust command를 통해 읽고, Node에는 필요한 runtime token만 전달한다 |
| File picker/export | Rust/Tauri | 사용자가 선택한 path나 export action만 Node에 전달한다 |
| UI rendering | React frontend | Sidecar가 view model을 제공하고 frontend는 표시한다 |

## Package layout contract

Phase 1 implementation must use this layout unless a later ADR explicitly replaces it.

```text
.
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ apps/
│  ├─ desktop/
│  │  ├─ package.json
│  │  ├─ index.html
│  │  ├─ src/
│  │  │  ├─ main.tsx
│  │  │  ├─ app/
│  │  │  ├─ features/
│  │  │  └─ shared/
│  │  └─ src-tauri/
│  │     ├─ Cargo.toml
│  │     ├─ tauri.conf.json
│  │     ├─ capabilities/
│  │     └─ src/
│  │        ├─ main.rs
│  │        ├─ sidecar.rs
│  │        ├─ native_paths.rs
│  │        └─ secrets.rs
│  │
│  └─ sidecar/
│     ├─ package.json
│     └─ src/
│        ├─ main.ts
│        ├─ server.ts
│        ├─ routes/
│        ├─ modules/
│        ├─ runtime/
│        └─ config/
│
└─ packages/
   ├─ contracts/
   │  └─ src/
   │     ├─ index.ts
   │     ├─ ids/
   │     ├─ product-engine/
   │     ├─ effects/
   │     ├─ api/
   │     ├─ sse/
   │     ├─ projections/
   │     ├─ codex/
   │     └─ codex-generated/
   ├─ core/
   │  └─ src/
   │     ├─ product-engine/
   │     ├─ spec-engine/
   │     ├─ decision-queue/
   │     ├─ research-engine/
   │     └─ completeness/
   └─ db/
      ├─ drizzle.config.ts
      ├─ drizzle/
      └─ src/
         ├─ schema.ts
         ├─ migrations.ts
         ├─ repositories/
         └─ projections/
```

### Layout rules

- `packages/core` must not import React, Tauri, Hono, or Node HTTP types.
- `packages/core` may import `packages/contracts` ProductEngine command/event/effect DTOs defined in `25-contracts-dto-catalog.md`.
- `packages/db` may import `packages/contracts` ids and enums but must not treat UI Projection DTOs as DB row shapes.
- `apps/sidecar` may import `packages/core`, `packages/db`, and `packages/contracts`.
- `apps/desktop` may import `packages/contracts` API client DTO and UI Projection/ViewModel types only.
- `apps/desktop` must not import `packages/db` or call libSQL directly.
- Rust/Tauri must not implement ProductEngine logic.

- `packages/contracts` module layout, export path, Zod naming, and public DTO ownership are canonical in `25-contracts-dto-catalog.md`.
- `packages/contracts` must not import Hono, Drizzle, React, Tauri, or Codex runtime client modules.

## Dev script contract

Root scripts:

| Script | Required behavior |
| --- | --- |
| `pnpm install` | install all workspace dependencies |
| `pnpm dev` | run desktop and sidecar dev processes together |
| `pnpm dev:desktop` | run Vite/Tauri desktop dev |
| `pnpm dev:sidecar` | run Hono sidecar in watch mode on loopback |
| `pnpm build` | build contracts, core, db, sidecar, desktop |
| `pnpm typecheck` | typecheck all TypeScript packages |
| `pnpm lint` | run lint without rewriting files |
| `pnpm test` | run unit/contract tests |
| `pnpm db:generate` | generate Drizzle SQL migration files from schema |
| `pnpm db:migrate` | apply local libSQL migrations |
| `pnpm verify` | run typecheck, lint, tests, and doc contract checks |

Package scripts may be more granular, but Codex should use root scripts as the implementation and verification entrypoints.

## Sidecar host and port policy

### Development

- Default sidecar host: `127.0.0.1`.
- Default sidecar port: `43110`.
- Development base URL: `http://127.0.0.1:43110`.
- Health endpoints:
  - `GET /healthz`: process is alive.
  - `GET /readyz`: DB migrated, ProductEngine initialized, Codex adapter status known.

### Packaged app

- Tauri launches the Node sidecar as an external binary.
- Packaged sidecar should accept `--host 127.0.0.1 --port 0` so the OS can allocate an available loopback port.
- On startup, sidecar prints one JSON line to stdout:

```json
{"type":"sidecar-ready","baseUrl":"http://127.0.0.1:<port>","pid":1234}
```

- Tauri stores the discovered base URL in process memory and exposes it to the WebView through a native command named `get_sidecar_base_url`.
- Frontend must never guess the packaged port.
- If sidecar exits, Tauri shows a recoverable “local engine unavailable” state instead of silently falling back to frontend-only mode.

## Rust/Tauri native boundary contract

Rust/Tauri commands are limited to native operations that cannot be owned safely by Node or WebView.

| Command | Purpose | Returns | Forbidden |
| --- | --- | --- | --- |
| `get_sidecar_base_url` | Return current sidecar loopback URL | URL string and status | Starting ProductEngine work |
| `get_app_data_dir` | Resolve app data directory | absolute path | Creating DB schema |
| `read_secret_ref` | Read a named OS secret ref | opaque secret value or missing | Persisting secret in plain JSON |
| `write_secret_ref` | Store secret in OS secret store | secret ref id | Storing project data |
| `pick_export_path` | Let user choose export destination | absolute path | Writing file without user intent |
| `write_export_file` | Write approved export artifact | success/failure | Writing arbitrary runtime files |
| `restart_sidecar` | Restart failed sidecar | status | Migrating DB directly |

Rust/Tauri must not expose a generic shell command, generic file write, or generic SQLite command in Phase 1.

## Node sidecar startup sequence

```text
load config
  -> validate loopback host/port
  -> receive appDataDir and secret refs from Tauri or dev env
  -> open local libSQL database
  -> apply migrations
  -> initialize repositories
  -> initialize ProductEngine services
  -> check Codex app-server availability
  -> start Hono server
  -> emit sidecar-ready
```

If Codex app-server is unavailable, sidecar still starts with `codex.status = unavailable` and manual handoff fallback enabled.

## Configuration contract

Configuration keys are split by owner.

| Key | Owner | Phase 1 behavior |
| --- | --- | --- |
| `SOLO_APP_DATA_DIR` | Tauri/Rust in packaged, env in dev | directory for DB/cache/logs |
| `SOLO_SIDECAR_HOST` | sidecar | default `127.0.0.1` |
| `SOLO_SIDECAR_PORT` | sidecar | `43110` in dev, `0` in packaged |
| `SOLO_LOCAL_CAPABILITY_TOKEN` | Tauri/Rust in packaged, env/CLI in dev | per-startup local auth token passed to sidecar; sidecar must not invent a WebView-unreachable token |
| `SOLO_LOCAL_DB_URL` | sidecar | `file:<appDataDir>/solo-superman.db` |
| `SOLO_REMOTE_DB_URL` | sidecar config only | stored but not used for sync in Phase 1 |
| `SOLO_REMOTE_DB_TOKEN_REF` | Tauri secret store | secret ref only, no remote sync call |
| `SOLO_CODEX_TRANSPORT` | sidecar | `stdio` default |
| `SOLO_CODEX_SCHEMA_VERSION` | sidecar/contracts | generated schema directory name |

The default AI path skips API key input. Codex authentication follows the Codex app-server/Codex installation path defined in `17-ai-runtime-access-strategy.md` and `21-sidecar-api-runtime-contract.md`.

## Security boundary

- Hono sidecar listens on loopback only.
- Frontend requests include a local capability token issued by Tauri at app startup.
- Sidecar rejects non-loopback requests.
- Sidecar rejects requests without the local capability token except `/healthz` and `/readyz`.
- Remote database config is inert in Phase 1.
- RuntimePreviewArtifact cannot apply file patch, shell command, or browser action.
- ChatGPT web automation is not part of Phase 1.

## Official reference notes

- Tauri supports bundling external sidecar binaries and provides sidecar launch patterns. Phase 1 uses this only to launch the Node sidecar and not to run arbitrary user commands. Reference: <https://v2.tauri.app/learn/sidecar-nodejs/> and <https://v2.tauri.app/ko/develop/sidecar/>
- Codex app-server is intended for rich product integrations with authentication, conversation history, approvals, and streamed agent events. Reference: <https://developers.openai.com/codex/app-server>
- Hono supports simple Web Standard based APIs and validation through Zod middleware/OpenAPI integrations. Reference: <https://hono.dev/docs/api>, <https://hono.dev/docs/guides/validation>, <https://hono.dev/examples/zod-openapi>
- Drizzle supports TypeScript schema and migration generation/apply flows. Reference: <https://orm.drizzle.team/docs/get-started/sqlite-new>, <https://orm.drizzle.team/docs/migrations>
- Turso/libSQL TypeScript docs support local `file:` URLs and embedded/remote patterns. Phase 1 uses local file mode and leaves remote config inert. Reference: <https://docs.turso.tech/sdk/ts/reference>

## Implementation checklist

- The first implementation PR must create this workspace layout before feature code.
- The sidecar must expose `/healthz` and `/readyz` before ProductEngine features.
- The frontend must call sidecar APIs through a single API client, not through direct libSQL or Codex access.
- The sidecar must be startable without Codex app-server availability.
- The packaged sidecar must not hardcode the dev port.
- The app must fail closed if sidecar cannot start.
