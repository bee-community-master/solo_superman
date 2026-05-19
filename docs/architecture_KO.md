# 아키텍처

언어: 한국어 | [English](architecture_EN.md)

## 기준 토폴로지

Solo Superman은 local-first web app + local Node/Hono service입니다.

```text
Local Web Frontend
  -> Local Node/Hono Service
  -> ProductEngine + packages/contracts
  -> local embedded libSQL + Drizzle repositories
  -> bounded runtime adapters such as Codex preview, file_diff, shell_command, browser_action
```

Hosted SaaS default는 없습니다. 나중에 hosted web origin이 생기더라도 paired surface일 뿐이며, local pairing, per-run local capability token, explicit approval, loopback-only enforcement, CSRF/replay protection 없이 local files, shell, browser, secrets를 제어할 수 없습니다.

## 컴포넌트 책임

| Component | Owns | Must not own |
| --- | --- | --- |
| Local Web Frontend | User screens, Decision Queue, approval cards, local browser UX. | Direct DB writes, Node filesystem access, credential custody. |
| Local Node/Hono Service | API envelope, command dispatch, SSE, local auth, runtime adapter boundary. | ProductEngine 밖에 숨은 product decision logic. |
| ProductEngine | Pure reducer, state transitions, deterministic outputs, effect plans. | Direct DB/Hono/Codex/filesystem/network calls. |
| `packages/contracts` | DTOs, command/event types, API route catalog, SSE and projection shapes. | App-specific UI behavior. |
| `packages/db` | libSQL/Drizzle schema, repositories, projection persistence. | Product scoring or AI policy. |
| Runtime adapters | Evidence와 rollback refs가 있는 bounded preview/execution. | Silent auto-apply 또는 broad fallback behavior. |

## ProductEngine 패턴

Reducer는 `pure reducer + effect plan` 패턴을 따릅니다.

- Command는 API 또는 application boundary를 통해 들어옵니다.
- ProductEngine은 state를 검증하고 event를 emit하며 deterministic output과 effect plan을 반환합니다.
- Effect executor는 policy check 이후 persistence 또는 external/runtime boundary를 호출합니다.
- Immediate projection은 deterministic하고 현재 user action에 안전할 때만 허용됩니다.

## API와 로컬 서비스 계약

ProductEngine/application command boundary는 application command, route handler, reducer decision을 분리합니다.

- API routes는 `packages/contracts/src/api/routes.ts`에 있으며 `docs/reference_KO.md`와 대조됩니다.
- Command response는 accepted/rejected category를 쓰며 async work에는 `statusUrl`을 노출할 수 있습니다.
- SSE event는 command, effect, projection, runtime status change를 제공합니다.
- Read-only diagnostics는 later explicit contract가 바꾸기 전까지 30초 후 timeout됩니다.
- Phase 3 controlled execution route presence 자체는 permission이 아닙니다. route가 preflight 또는 bounded adapter code를 노출해도 action은 해당 action class와 scope에 대해 `ExecutionAuthorityRecord`가 승인한 뒤에야 executable입니다.

## 현재 런타임 경계

- Codex app-server는 structured prompt/output contract를 위한 preferred preview runtime이며 ChatGPT web-session custody가 아니라 local Codex CLI login path를 사용합니다.
- ChatGPT Pro browser delegation은 별도의 per-run, user-visible local browser delegation path입니다. API도 stable backend service도 아니며 default backend question/research preview에 필요하지 않습니다.
- `file_diff`, `shell_command`, `browser_action`은 각각 별도 action class로, preflight, approval, rollback, evidence requirement를 분리합니다.
- Tauri/native shell source, dependency, script path는 제거되었습니다. 그 native app-host history는 `decisions_KO.md`에만 기록되며 Windows `.cmd` Desktop runner와 별개입니다.
