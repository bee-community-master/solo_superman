# 19. Phase 1 Implementation Architecture Snapshot

## 목적

이 문서는 Solo Superman Phase 1~2.5에서 만들어진 implementation topology를 web-local implementation snapshot으로 보존한다. Phase 3 web-local canonical 방향은 `Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db`이며, Tauri/native shell은 source·dependency·script 기본 경로에서 제거된 historical context로만 남는다. 구현자는 native host를 다시 선택하지 않고 `apps/web`과 `apps/sidecar` 경계를 기준으로 작업한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Future canonical host | Local web browser UI |
| Frontend | React + TypeScript + Vite |
| Local backend | Node.js/Hono sidecar as local service |
| Removed native host history | Tauri v2 scaffold; historical context only |
| Sidecar HTTP framework | Hono |
| ProductEngine 위치 | Node/Hono sidecar |
| SQLite/libSQL repository 위치 | Node/Hono sidecar |
| Codex app-server integration 위치 | Node/Hono sidecar |
| Native host responsibility | none in active source/dependency/script path |
| Package manager | pnpm workspace |
| API contract | Hono route + Zod contract + generated OpenAPI artifact |
| Storage | local embedded libSQL 우선 |
| Remote storage | config slot only, no sync in Phase 1 |
| Runtime execution | Phase 1~2.5 sandbox/preview only; Phase 3 requires `ExecutionAuthorityRecord` |

## Rejected alternatives

| 대안 | 기각 이유 |
| --- | --- |
| Rust core 중심 ProductEngine | native packaging과 native 경계는 강하지만 ProductEngine, JSON schema, LLM orchestration 구현 속도가 느려진다 |
| Native-host storage + Node orchestration | 모든 repository 호출이 native bridge를 타며 구현 복잡도가 커진다 |
| Frontend-local prototype | 데모는 빠르지만 Codex 자동 구현 목표와 장기 구조 안정성이 약하다 |
| 기능별 혼합 ownership | Queue, storage, Codex, ProductEngine 책임이 분산되어 구현 중 의사결정이 다시 발생한다 |
| Phase 1 remote sync 포함 | auth, conflict, offline/online, privacy disclosure가 함께 필요해 MVP가 커진다 |

## Canonical Phase 3+ topology

```text
Local Web Frontend
  -> loopback HTTP with per-run local capability token
  -> Local Node/Hono Service
  -> ProductEngine/contracts/db
```

이 topology는 `36-phase3-controlled-execution-contract.md`가 소유한다. Browser UI는 DB, filesystem, Codex runtime, shell, browser automation에 직접 접근하지 않고 local service API만 호출한다.

## Current web-local implementation snapshot

현재 runtime ownership은 다음처럼 고정한다.

```text
Local Web Frontend (`apps/web`)
├─ React/Vite browser UI
├─ TanStack Query client
├─ local UI state
└─ calls Local Node/Hono Service over loopback HTTP
   ├─ VITE_SOLO_SIDECAR_BASE_URL
   └─ VITE_SOLO_LOCAL_CAPABILITY_TOKEN

Local Node/Hono Service (`apps/sidecar`)
├─ Hono API server
├─ ProductEngine Orchestrator
├─ Decision Queue Scheduler
├─ Spec/Research/Evidence modules
├─ Completeness Scorer
├─ CodexRuntimeAdapter
├─ libSQL repository layer
├─ migration execution
└─ event/activity stream
```

Tauri/native shell source, dependency, CLI script, and bridge fallback are not active implementation paths. Historical references may remain only when they explain migration history or rejected alternatives.

## Ownership boundary

Phase 3 web-local owner 기준은 Local Node/Hono Service와 Local Web Frontend다.

| Capability | Owner | Notes |
| --- | --- | --- |
| ProductEngine command/event/state reduce | Node sidecar | `packages/core`에서 pure service로 구현하고 sidecar가 호출한다 |
| Queue projection and scheduling | Node sidecar | Frontend는 projection을 표시하고 user command만 보낸다 |
| Spec/Research/Completeness modules | Node sidecar | LLM/JSON/schema-heavy logic은 TypeScript에 둔다 |
| SQLite/libSQL connection | Node sidecar | repository layer가 DB를 직접 소유한다 |
| Migration execution | Node sidecar startup | local service startup에서 unapplied migration을 적용한다 |
| Codex app-server child process | Node sidecar | stdio transport를 기본으로 spawn한다 |
| Sidecar process launch | local bootstrap/dev env | root `pnpm dev`가 web frontend와 sidecar를 함께 실행한다 |
| App data dir | Local service config/env | local service가 app data dir을 소유한다 |
| Secret storage | secret ref adapter only | secret value는 저장하지 않고 ref만 전달한다 |
| File picker/export | Web/local service UX | 사용자가 승인한 export action만 local service에 전달한다 |
| UI rendering | React frontend | Sidecar가 view model을 제공하고 frontend는 표시한다 |

## Package layout contract

```text
.
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ apps/
│  ├─ web/
│  │  ├─ package.json
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ main.tsx
│  │     ├─ app/
│  │     ├─ features/
│  │     └─ shared/
│  └─ sidecar/
│     ├─ package.json
│     └─ src/
│        ├─ main.ts
│        ├─ server.ts
│        ├─ config/
│        ├─ runtime/
│        └─ storage/
├─ packages/
│  ├─ contracts/
│  ├─ core/
│  └─ db/
└─ scripts/
```

### Layout rules

- `packages/core` must not import React, Hono, DB clients, native bridge modules, Node HTTP types, filesystem, shell, or browser automation modules.
- `packages/core` may import `packages/contracts` ProductEngine command/event/effect DTOs defined in `25-contracts-dto-catalog.md`.
- `packages/db` may import `packages/contracts` ids and enums but must not treat UI Projection DTOs as DB row shapes.
- `apps/sidecar` may import `packages/core`, `packages/db`, and `packages/contracts`.
- `apps/web` may import `packages/contracts` API client DTO and UI Projection/ViewModel types only.
- `apps/web` must not import `packages/db`, call libSQL directly, import native bridge modules, or guess sidecar ports.
- `packages/contracts` module layout, export path, Zod naming, and public DTO ownership are canonical in `25-contracts-dto-catalog.md`.
- `packages/contracts` must not import Hono, Drizzle, React, native bridge modules, or Codex runtime client modules.

## Dev script contract

Root scripts:

| Script | Required behavior |
| --- | --- |
| `pnpm install` | install all workspace dependencies |
| `pnpm dev` | run local web frontend and sidecar dev processes together with a local token |
| `pnpm dev:web` | run Vite web frontend dev on loopback |
| `pnpm dev:sidecar` | run Hono sidecar in watch mode on loopback |
| `pnpm build` | build contracts, core, db, sidecar, web |
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

### Startup discovery

- On startup, sidecar prints one JSON line to stdout:

```json
{"type":"sidecar-ready","baseUrl":"http://127.0.0.1:<port>","pid":1234}
```

- Root `pnpm dev` injects `VITE_SOLO_SIDECAR_BASE_URL` and `VITE_SOLO_LOCAL_CAPABILITY_TOKEN` for the web frontend.
- Frontend must never guess a sidecar port or use a native bridge fallback.
- If sidecar is unavailable, the web UI shows a recoverable “local engine unavailable” state instead of silently falling back to frontend-only mode.

## Node sidecar startup sequence

```text
load config
  -> validate loopback host/port
  -> receive appDataDir and secret refs from local service config or dev env
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
| `SOLO_APP_DATA_DIR` | local service config or env | directory for DB/cache/logs |
| `SOLO_SIDECAR_HOST` | sidecar | default `127.0.0.1` |
| `SOLO_SIDECAR_PORT` | sidecar | `43110` in dev, `0` in packaged |
| `SOLO_LOCAL_CAPABILITY_TOKEN` | local bootstrap or env/CLI | per-run local capability token passed to sidecar; sidecar must not invent a browser-unreachable token |
| `SOLO_LOCAL_DB_URL` | sidecar | `file:<appDataDir>/solo-superman.db` |
| `SOLO_REMOTE_DB_URL` | sidecar config only | stored but not used for sync in Phase 1 |
| `SOLO_REMOTE_DB_TOKEN_REF` | secret ref adapter | secret ref only, no remote sync call |
| `SOLO_CODEX_TRANSPORT` | sidecar | `stdio` default |
| `SOLO_CODEX_SCHEMA_VERSION` | sidecar/contracts | generated schema directory name |

The default AI path skips API key input. Codex authentication follows the Codex app-server/Codex installation path defined in `17-ai-runtime-access-strategy.md` and `21-sidecar-api-runtime-contract.md`.

## Security boundary

- Hono sidecar listens on loopback only.
- Frontend requests include a per-run local capability token issued by local bootstrap/dev env.
- Sidecar rejects non-loopback requests.
- Sidecar rejects requests without the local capability token except `/healthz` and `/readyz`.
- Remote database config is inert in Phase 1.
- RuntimePreviewArtifact cannot apply file patch, shell command, or browser action.
- ChatGPT web automation is not part of Phase 1.

## Official reference notes

- Historical native sidecar patterns are reference material only; future default remains web + local Node/Hono service. Reference: <https://v2.tauri.app/learn/sidecar-nodejs/> and <https://v2.tauri.app/ko/develop/sidecar/>
- Codex app-server is intended for rich product integrations with authentication, conversation history, approvals, and streamed agent events. Reference: <https://developers.openai.com/codex/app-server>
- Hono supports simple Web Standard based APIs and validation through Zod middleware/OpenAPI integrations. Reference: <https://hono.dev/docs/api>, <https://hono.dev/docs/guides/validation>, <https://hono.dev/examples/zod-openapi>
- Drizzle supports TypeScript schema and migration generation/apply flows. Reference: <https://orm.drizzle.team/docs/get-started/sqlite-new>, <https://orm.drizzle.team/docs/migrations>
- Turso/libSQL TypeScript docs support local `file:` URLs and embedded/remote patterns. Phase 1 uses local file mode and leaves remote config inert. Reference: <https://docs.turso.tech/sdk/ts/reference>

## Implementation checklist

- Phase 3 migration PRs must preserve this workspace layout while carving a browser-first local web path before feature code.
- The sidecar must expose `/healthz` and `/readyz` before ProductEngine features.
- The frontend must call sidecar APIs through a single API client, not through direct libSQL or Codex access.
- The sidecar must be startable without Codex app-server availability.
- The local service and any legacy packaged host must not hardcode the dev port.
- The web UI and any legacy host must fail closed if sidecar cannot start.
