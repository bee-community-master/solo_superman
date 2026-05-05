# 21. Sidecar API and Runtime Contract

## 목적

이 문서는 Node/Hono sidecar의 API route, validation, local auth, event stream, Codex app-server integration, RuntimePreviewArtifact 변환 계약을 고정한다.

`19-phase1-implementation-architecture.md`가 process topology를 정의하고, `20-data-storage-contract.md`가 persistence를 정의한다면, 이 문서는 frontend와 sidecar, sidecar와 Codex app-server 사이의 구현 계약을 정의한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Sidecar framework | Hono |
| Validation | Zod + Hono validator/OpenAPI route definitions |
| DTO canonical source | `25-contracts-dto-catalog.md` |
| Endpoint behavior canonical source | `26-api-route-behavior-catalog.md` |
| API version prefix | `/api/v1` |
| Health endpoints | `/healthz`, `/readyz` |
| Event stream | Server-Sent Events at `/api/v1/events/stream` |
| Local auth | Tauri-issued capability token |
| Codex app-server transport | stdio by default |
| Codex generated schema | generated per installed Codex version |
| Codex app schema | `24-codex-prompt-output-contract.md`의 internal Prompt/Output schema |
| Runtime output | RuntimePreviewArtifact, allowed Codex artifacts, ManualRetryCard, RuntimeBlockedCard only |
| Browser/file/shell apply | forbidden in Phase 1 |

## API envelope

All JSON API responses use one of two envelopes.

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "req_...",
    "eventId": "evt_..."
  }
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

Rules:

- Frontend must not depend on raw Hono error shapes.
- Domain errors use stable `error.code` strings.
- Mutating APIs return one of `accepted`, `accepted_with_projection`, `rejected`, or `blocked`.
- Mutating APIs include `eventIds` and `effectTaskIds` when ProductEngine events/effects were persisted.
- APIs must not pretend async effect output is already complete.
- Every mutating API should return the updated projection only when `active batch projection exception` applies.
- `CommandResponse`, `statusUrl`, `StatusEndpointDto`, SSE DTO, and UI Projection DTO shapes are canonical in `25-contracts-dto-catalog.md`.
- Endpoint-specific request, command/query mapping, response category, statusUrl, SSE/refetch, and error/precondition behavior is canonical in `26-api-route-behavior-catalog.md`.
- End-to-end failure/status/recovery expectations and representative incident dry-runs are canonical in `27-operations-observability-contract.md`.

## ProductEngine runtime policy block

```text
ProductEngine runtime policy:
- ProductEngine core uses pure reducer + effect plan.
- Reducer never calls DB, Hono, Codex, filesystem, shell, browser, or network.
- Reducer input is ProductEngineCommand plus ProductEngineStateSnapshot.
- Reducer output is ProductEngineReduction containing events, nextState, effectPlan, deterministicOutputs, and optional immediateProjection.
- Effect execution uses persisted async effect queue by default.
- In-memory-only effect queue is forbidden.
- active batch projection exception allows immediate active-batch-safe queue projection in the command response.
- First-class effect types are queue_projection_effect, research_evidence_effect, and codex_runtime_preview_effect.
- scoring_effect and spec_export_effect are not Phase 1 first-class async effects.
- Completeness/Scoring, SpecVersion, and Founder Brief draft are reducer_deterministic_output values persisted in the repository transaction.
- Retry policy is conservative_ai_retry_matrix.
```

## Command response categories

| Category | When used | Response data |
| --- | --- | --- |
| `accepted` | command accepted, async effects queued, no immediate active-batch projection | `eventIds`, `effectTaskIds`, `statusUrl`, `queuedActivity`; exact DTO in `25-contracts-dto-catalog.md` |
| `accepted_with_projection` | `active batch projection exception` applies | `eventIds`, `effectTaskIds`, `queueProjection`, `activity`, `pendingEffectSummary`; exact DTO in `25-contracts-dto-catalog.md` |
| `rejected` | validation/precondition failure | stable error code and no event/effect ids; exact error envelope in `25-contracts-dto-catalog.md` |
| `blocked` | command is valid but policy/runtime blocks execution | blocking card projection, blocked artifact ref, no external execution; exact DTO in `25-contracts-dto-catalog.md` |

Rules:

- Hono route handlers do not create domain objects directly.
- Hono route handlers map request to the ProductEngine command or explicit query/application action defined in `26-api-route-behavior-catalog.md`, call the application service, and serialize the defined response category.
- Frontend treats any returned projection as read model, not source of truth.
- SSE/refetch is the source of truth for effect completion.
- File/shell/browser execution requests return `blocked` or preview-only artifact, never actual execution.

## Local auth and loopback policy

- Sidecar listens on loopback only.
- Tauri issues a high-entropy local capability token at app startup.
- Frontend sends `Authorization: Bearer <local-token>` to sidecar.
- Sidecar accepts unauthenticated requests only for `/healthz` and `/readyz`.
- Sidecar rejects requests from non-loopback addresses.
- CORS is restricted to the Tauri/WebView origin in packaged mode and localhost dev origins in development.
- The local token is not the user's Codex credential and must not be persisted to disk.

## Route groups

### Health

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/healthz` | process alive | no |
| GET | `/readyz` | DB migrated, ProductEngine initialized, runtime status known | no |

### Project and session

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/projects` | `StartProject` | project overview and first session |
| GET | `/api/v1/projects` | list projects | project summaries |
| GET | `/api/v1/projects/:projectId` | project detail | project overview projection |
| POST | `/api/v1/projects/:projectId/sessions` | start or resume session | session projection |
| GET | `/api/v1/projects/:projectId/sessions/:sessionId` | get session | full session shell projection |

### Intake and spec

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/sessions/:sessionId/intake` | `CaptureIntake` | normalized intake and next action |
| POST | `/api/v1/sessions/:sessionId/spec/initial` | `DraftInitialSpec` | living spec projection |
| GET | `/api/v1/sessions/:sessionId/spec` | get current spec | living spec projection |
| POST | `/api/v1/sessions/:sessionId/spec/analyze` | `AnalyzeAmbiguity` | ambiguity and queue projection |
| GET | `/api/v1/sessions/:sessionId/spec/versions` | list versions | version list |

### Queue and answer

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/sessions/:sessionId/queue` | get queue projection | active, next, blocked, deferred |
| POST | `/api/v1/sessions/:sessionId/queue/activate` | `ActivateQuestionBatch` | queue projection |
| POST | `/api/v1/questions/:questionId/answers` | `SubmitAnswer`; answer routing is reducer behavior | updated queue and activity |
| POST | `/api/v1/queue-items/:queueItemId/defer` | `DeferQueueItem` | queue projection |
| POST | `/api/v1/queue-items/:queueItemId/dismiss` | `DismissQueueItem` | queue projection |

### Research and evidence

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/sessions/:sessionId/research-tasks` | `PlanResearch` | research task projection |
| GET | `/api/v1/sessions/:sessionId/research` | list research state | research/evidence projection |
| POST | `/api/v1/research-tasks/:researchTaskId/results` | `ImportResearchResult` | EvidenceMatrix and queue projection |
| POST | `/api/v1/research-results/:researchResultId/synthesize` | `SynthesizeEvidence` | EvidenceMatrix |

### Decision and spec version

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/spec-updates` | `CreateSpecUpdatePreview` | spec update candidate |
| POST | `/api/v1/decisions` | create decision card from existing preview; no new `CommandType` | decision card |
| POST | `/api/v1/decisions/:decisionId/resolve` | `ResolveDecision` | decision outcome and queue projection |
| POST | `/api/v1/sessions/:sessionId/spec/versions` | `CreateSpecVersion` | spec version and score trigger |

### Runtime preview

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/runtime/status` | runtime availability | adapter status |
| POST | `/api/v1/runtime/codex/preview` | `CreateRuntimePreview` | RuntimePreviewArtifact |
| POST | `/api/v1/runtime/manual-handoff` | `CreateRuntimePreview` in manual handoff mode | RuntimePreviewArtifact |
| POST | `/api/v1/runtime/artifacts/:artifactId/convert` | `ConvertRuntimeArtifact` | queue projection |
| POST | `/api/v1/runtime/artifacts/:artifactId/block` | `ConvertRuntimeArtifact` with blocked target | blocked outcome |

### Completeness and export

| Method | Path | Command/query | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/sessions/:sessionId/completeness/score` | `ScoreCompleteness` | completeness projection |
| POST | `/api/v1/sessions/:sessionId/completion-candidate` | `ScoreCompleteness`; completion candidate is deterministic output | completion candidate card |
| GET | `/api/v1/sessions/:sessionId/founder-brief` | get current brief draft | founder brief projection |
| POST | `/api/v1/sessions/:sessionId/founder-brief/export` | `PrepareFounderBrief`; export metadata only | export artifact metadata |

### Command status

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/commands/:commandId/status` | status endpoint for command `statusUrl` |

### Events

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/events/stream?sessionId=...` | SSE stream for activity, queue, runtime, score updates |
| GET | `/api/v1/sessions/:sessionId/activity` | paginated activity feed |

## Hono validation contract

- Each route has a Zod schema for params, query, body, and response.
- Shared schemas live in `packages/contracts/src/api/` and follow `25-contracts-dto-catalog.md`.
- Route-specific behavior and representative error/precondition cases follow `26-api-route-behavior-catalog.md`.
- Sidecar route files import schemas from `packages/contracts`.
- Hono handlers use validated data only.
- Request body tests must send `Content-Type: application/json`.
- Generated OpenAPI artifact is emitted at build time and served in development at `/api/v1/openapi.json`.
- Packaged app may disable interactive docs but must keep the generated artifact in source control or build artifacts.

## ProductEngine API command flow

Mutating routes follow this shape:

```text
validate request
  -> map request to ProductEngine command
  -> load ProductEngineStateSnapshot
  -> call pure reducer + effect plan
  -> transaction: append events, persist state patch, persist reducer_deterministic_output, persist effect_tasks
  -> if active batch projection exception applies: return accepted_with_projection
  -> otherwise: return accepted with eventIds/effectTaskIds
  -> publish command/effect SSE events
```

Handlers must not directly update multiple repositories without going through ProductEngine for product state changes. Handlers must not wait for `research_evidence_effect` or `codex_runtime_preview_effect` to complete before returning a command response.

## SSE event contract

SSE events use stable event names. Event DTO shape and projection refetch hints are canonical in `25-contracts-dto-catalog.md`; endpoint-specific SSE/refetch recovery is canonical in `26-api-route-behavior-catalog.md`.

| Event name | Payload |
| --- | --- |
| `activity.updated` | latest activity item |
| `queue.updated` | active/next/blocked/deferred summary |
| `spec.updated` | changed section/version summary |
| `research.updated` | task/result/evidence status |
| `decision.updated` | decision card status |
| `runtime.updated` | adapter/artifact status |
| `completeness.updated` | score and weak axes |
| `completion.ready` | completion candidate summary |
| `sidecar.warning` | recoverable warning |
| `sidecar.error` | user-visible error state |
| `command.accepted` | projectId, sessionId, commandType, eventIds, effectTaskIds |
| `command.rejected` | commandType, errorCode, reason |
| `effect.queued` | effectTaskId, effectType, sourceEventIds |
| `effect.started` | effectTaskId, effectType, attemptCount |
| `effect.succeeded` | effectTaskId, effectType, outputRef, projectionHint |
| `effect.failed` | effectTaskId, effectType, errorCode, retryAvailable |
| `effect.blocked` | effectTaskId, effectType, blockReason, userAction |
| `projection.updated` | projectionKind, version, affectedQueueItemIds |

SSE is a UI update channel, not the source of truth. The frontend must refetch projections when it reconnects. Missed SSE messages are recovered by polling/refetching session projection or the command `statusUrl` defined in `25-contracts-dto-catalog.md`; endpoint-specific recovery paths are listed in `26-api-route-behavior-catalog.md`, and incident-level recovery expectations are tested through `27-operations-observability-contract.md`.

## Codex app-server integration

### Why app-server

Codex app-server is used because Phase 1 needs deep product integration: conversation history, approvals, and streamed agent events. For generic CI automation, Codex SDK would be a better fit, but this product needs user-facing session integration.

### Transport

- Phase 1 default: `codex app-server` over stdio JSONL.
- WebSocket app-server transport is not the Phase 1 default because the official docs mark it experimental/unsupported.
- Sidecar spawns the Codex app-server child process when a runtime preview is requested or when runtime status check needs it.
- Sidecar keeps Codex child lifecycle separate from Hono lifecycle. Hono remains ready even when Codex is unavailable.

### Schema pinning

Codex integration has two schema layers.

1. Codex app-server generated schema: installed Codex version에 맞춰 생성한다.
2. Solo Superman internal Codex Prompt/Output schema: `24-codex-prompt-output-contract.md`를 canonical source로 구현한다.

Before implementing Codex integration, generate version-specific schemas:

```text
codex app-server generate-ts --out packages/contracts/src/codex-generated/<codex-version>
codex app-server generate-json-schema --out packages/contracts/src/codex-generated/<codex-version>/json-schema
```

Implementation rules:

- Generated schema directory includes the Codex version used to generate it.
- Sidecar adapter imports generated types through a narrow wrapper.
- If generated schema changes, update `17-ai-runtime-access-strategy.md` or add a short compatibility note in this document.
- Internal turnPurpose, artifact kind, applyPolicy, repair, and severity routing changes must update `24-codex-prompt-output-contract.md` first.
- Public `packages/contracts/src/codex/` re-export names and forbidden runtime-client import rules follow `25-contracts-dto-catalog.md`.
- Do not hand-write broad `any` wrappers around app-server messages.

### Thread/session mapping

| Solo Superman object | Codex app-server object |
| --- | --- |
| Project | metadata on local mapping table |
| Session | Codex thread candidate |
| RuntimePreviewArtifact | Codex turn result summary |
| Activity Feed item | Codex stream notification normalized to local event |
| Approval Card | app-server approval/user-input request mapped to Queue item |

Mapping table minimum fields:

- `id`.
- `projectId`.
- `sessionId`.
- `codexThreadId`.
- `codexModel`.
- `schemaVersion`.
- `createdAt`.
- `lastTurnId`.
- `status`.

### Turn policy

Allowed Phase 1 turn purposes are exactly the 6 canonical values in `24-codex-prompt-output-contract.md`:

- `question_generation`.
- `ambiguity_analysis`.
- `research_prompt`.
- `evidence_synthesis`.
- `spec_update_preview`.
- `implementation_plan_preview`.

Forbidden Phase 1 turn outcomes:

- apply file patch.
- run shell command.
- control browser.
- submit ChatGPT web automation.
- modify external service.

If Codex proposes a forbidden action, sidecar must convert it into `BlockedActionArtifact` inside a `RuntimePreviewArtifact` and Queue must show the blocked reason. Blocked action taxonomy is defined in `24-codex-prompt-output-contract.md`.

## Conservative AI retry matrix

| Effect type | Idempotency key | Auto retry | Manual retry | Failure output |
| --- | --- | --- | --- | --- |
| `queue_projection_effect` | `sourceEventId + projectionKind` | max 3 | not normally needed | `QueueProjectionFailed` activity and sidecar refetch recommendation |
| `research_evidence_effect` | `researchTaskId` or `researchResultId + synthesisVersion` | max 2 | allowed through Research Review Card | `ResearchEffectFailed` card with retained source/result |
| `codex_runtime_preview_effect` | `turnPurpose + contextHash + runtimeAdapterVersion` | max 1 | required after auto retry exhausted | `ManualRetryCard` or `RuntimeBlockedCard` |

The sidecar must not aggressively retry Codex runtime preview beyond the single automatic retry. Inside each attempt, JSON output follows `24-codex-prompt-output-contract.md`: deterministic parser repair once, Codex self-repair once, then severity routing. When exhausted, it emits a manual retry, manual handoff, validation failure, or runtime blocked card.

## Phase 1.5 API checklist

Phase 1.5 endpoint 상세는 구현 시 `30-phase1.5-research-runtime-and-readiness-contract.md`를 따른다. Sidecar API는 최소한 다음 behavior를 표현해야 한다.

- allowlist create/update/pause/revoke는 project ownership과 source category를 검증한다.
- automatic research run start는 active allowlist, public-safe context, rate/budget/staleness policy를 검증한다.
- private/full/credentialed source는 automatic run 대신 task-level approval/manual handoff response를 반환한다.
- cancel/retry는 ResearchRun state machine과 idempotency rule을 따른다.
- hint query/export는 readiness metadata만 반환하고 execution/delegation을 활성화하지 않는다.
- SSE/refetch hints는 allowlist, run, disclosure log, evidence gate, hint export 변화를 복구 가능하게 만든다.

## RuntimePreviewArtifact conversion

Runtime artifacts can convert only through ProductEngine commands. The canonical artifact taxonomy, applyPolicy enum, low-risk auto-apply matrix, evidence conditional gate, and blocked action taxonomy live in `24-codex-prompt-output-contract.md`.

| Artifact kind | Allowed conversion |
| --- | --- |
| `QuestionBatchArtifact` | Queue question candidates through `auto_apply` |
| `AmbiguityAnalysisArtifact` | Confidence/completeness projection through `auto_apply` |
| `ResearchPromptArtifact` | ResearchTask or Manual Handoff Card |
| `EvidenceSynthesisArtifact` | EvidenceMatrix only when conditional gate passes; otherwise review/risk/follow-up card |
| `SpecUpdatePreviewArtifact` | SpecUpdate candidate requiring approval |
| `ImplementationPlanPreviewArtifact` | PlanningNote only in Phase 1 |
| `BlockedActionArtifact` | RuntimeBlockedCard or blocked queue card |

No runtime artifact can directly create SpecVersion. No Phase 1 runtime artifact can execute file, shell, browser, network, credential, or destructive actions.

## Manual handoff fallback

When Codex app-server is unavailable or the user chooses not to connect it:

- Sidecar generates a copyable prompt.
- User may paste result back manually.
- Imported result is stored as `ResearchResult` or `RuntimePreviewArtifact` with source `manual_prompt_handoff`.
- Manual import must pass the same Evidence Gate and Approval Gate as Codex output.

## Error contract

| Error code | Meaning | UI behavior |
| --- | --- | --- |
| `SIDECAR_NOT_READY` | DB/runtime not ready | show local engine unavailable state |
| `UNAUTHORIZED_LOCAL_REQUEST` | missing/invalid local token | ask app to refresh session |
| `PROJECT_NOT_FOUND` | invalid project id | show recoverable not found |
| `COMMAND_PRECONDITION_FAILED` | ProductEngine state mismatch | refetch projections |
| `CODEX_UNAVAILABLE` | Codex app-server not available | offer manual handoff |
| `RUNTIME_EXECUTION_FORBIDDEN` | file/shell/browser apply requested | create blocked preview card |
| `VALIDATION_FAILED` | request schema invalid | show field-level guidance |
| `MIGRATION_FAILED` | DB migration failed | keep sidecar not ready |

## Official reference notes

- Codex app-server is documented as the interface for rich clients and supports authentication, conversation history, approvals, and streamed agent events. Reference: <https://developers.openai.com/codex/app-server>
- Codex app-server protocol uses JSON-RPC style messages over stdio by default and can generate TypeScript/JSON schemas for the installed version. Reference: <https://developers.openai.com/codex/app-server>
- Hono route validation can use Zod and validator middleware, and Hono's Zod OpenAPI example supports Zod schemas plus OpenAPI generation. Reference: <https://hono.dev/docs/guides/validation>, <https://hono.dev/examples/zod-openapi>

## Implementation checklist

- Implement Hono health endpoints before domain routes.
- Add local capability token middleware before any non-health route.
- Add Zod schemas before route handlers.
- Implement SSE reconnect behavior before long-running runtime preview UI.
- Validate the `27-operations-observability-contract.md` incidents before claiming long-running effect UI is production-ready.
- Implement Codex app-server status detection before creating runtime preview turns.
- Treat generated Codex schema as versioned implementation input.
