# Architecture

Language: [한국어](architecture_KO.md) | English

## Canonical topology

Solo Superman is a local-first web app + local Node/Hono service.

```text
Local Web Frontend
  -> Local Node/Hono Service
  -> ProductEngine + packages/contracts
  -> local embedded libSQL + Drizzle repositories
  -> bounded runtime adapters such as Codex preview, file_diff, shell_command, browser_action
```

There is no hosted SaaS default. A hosted web origin, if introduced later, may only be a paired surface; it must not control local files, shell, browser, or secrets without local pairing, per-run local capability token, explicit approval, loopback-only enforcement, and CSRF/replay protection.

## Component responsibilities

| Component | Owns | Must not own |
| --- | --- | --- |
| Local Web Frontend | User screens, Decision Queue, approval cards, local browser UX. | Direct DB writes, Node filesystem access, credential custody. |
| Local Node/Hono Service | API envelope, command dispatch, SSE, local auth, runtime adapter boundary. | Product decision logic hidden outside ProductEngine. |
| ProductEngine | Pure reducer, state transitions, deterministic outputs, effect plans. | Direct DB/Hono/Codex/filesystem/network calls. |
| `packages/contracts` | DTOs, command/event types, API route catalog, SSE and projection shapes. | App-specific UI behavior. |
| `packages/db` | libSQL/Drizzle schema, repositories, projection persistence. | Product scoring or AI policy. |
| Runtime adapters | Bounded previews/execution with evidence and rollback refs. | Silent auto-apply or broad fallback behavior. |

## ProductEngine pattern

The reducer follows `pure reducer + effect plan`:

- Commands enter through the API or application boundary.
- ProductEngine validates state, emits events, returns deterministic outputs, and plans effects.
- Effect executors persist or call external/runtime boundaries after policy checks.
- Immediate projections are allowed only when deterministic and safe for the current user action.

## API and local service contract

The ProductEngine/application command boundary keeps application commands, route handlers, and reducer decisions separate.

- API routes live in `packages/contracts/src/api/routes.ts` and are checked against `docs/reference_EN.md` and `docs/reference_KO.md`.
- Command responses use accepted/rejected categories and may expose `statusUrl` for async work.
- SSE events provide command, effect, projection, and runtime status changes.
- Read-only diagnostics time out at 30 seconds unless a later explicit contract changes that limit.
- Phase 3 controlled execution route presence is not permission by itself: a route may expose preflight or bounded adapter code, but an action becomes executable only when an `ExecutionAuthorityRecord` approves that exact action class and scope.

## Current runtime boundary

- Codex SDK is the preferred preview runtime for structured prompt/output contracts and uses the local Codex CLI login path, not ChatGPT web-session custody.
- ChatGPT Pro browser delegation is a separate per-run, user-visible local browser delegation path; it is not an API, not a stable backend service, and not required for the default backend question/research preview.
- `file_diff`, `shell_command`, and `browser_action` are separate action classes with separate preflight, approval, rollback, and evidence requirements.
- Tauri/native shell source, dependency, and script paths were removed; that native app-host history is recorded in `decisions_EN.md` only and is separate from the Windows `.cmd` Desktop runner.
