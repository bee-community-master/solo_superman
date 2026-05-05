# 23. ProductEngine Runtime Contract

## 목적

이 문서는 Phase 1 ProductEngine을 실제 코드로 옮길 때 구현자가 다시 결정하지 않아야 할 reducer, effect plan, effect queue, retry/idempotency, API response, SSE, test contract를 고정한다. 전구간 failure/status/recovery와 대표 장애 dry-run은 `27-operations-observability-contract.md`가 소유한다.

`18-product-engine-orchestrator.md`가 제품 엔진의 command/event/state 의미를 정의한다면, 이 문서는 그 의미를 `packages/core`, `packages/db`, `apps/sidecar`, `apps/desktop`이 어떻게 나눠 구현해야 하는지 정의한다.

이 문서는 ProductEngine runtime의 기준 계약이다. 런타임 코드, 앱 scaffold, DB migration file, Hono handler, Codex adapter 코드는 각 구현 PR과 현재 코드베이스가 소유하며, 이 문서는 reducer/effect/status 경계와 금지선을 정의한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| ProductEngine 구현 패턴 | `pure reducer + effect plan` |
| Reducer side effect | 금지. DB, Hono, Codex, filesystem, network를 직접 호출하지 않는다 |
| Application service 책임 | command precondition, repository load/save, reducer 호출, effect task persistence, response projection 선택 |
| Effect 실행 모델 | 기본 `persisted async effect queue` |
| UX 예외 | `active batch projection exception`만 즉시 projection 반환 허용 |
| 1급 Effect Type | `queue_projection_effect`, `research_evidence_effect`, `codex_runtime_preview_effect` |
| Effect 아님 | `scoring_effect`, `spec_export_effect`는 Phase 1 1급 async effect가 아니다 |
| Scoring/export 처리 | `reducer_deterministic_output`으로 계산하고 repository transaction이 저장한다 |
| Retry matrix | `conservative_ai_retry_matrix` |
| In-memory queue | 금지. effect task는 DB에 persisted되어야 한다 |
| Codex effect 권한 | `24-codex-prompt-output-contract.md`의 RuntimePreviewArtifact/artifact만 생성. 파일/shell/browser 적용 금지 |

## Canonical duplication policy

후속 구현자가 검색하기 쉽도록 이 문서와 기존 `18`, `20`, `21`, `22` 문서에는 핵심 정책 원문을 중복 허용한다.

중복 허용 규칙:

- 같은 정책은 같은 stable keyword를 사용한다.
- `pure reducer + effect plan`, `persisted async effect queue`, `active batch projection exception`, `conservative_ai_retry_matrix` 문구는 바꾸지 않는다.
- 중복된 정책이 충돌하면 구현자는 임의로 선택하지 않고 문서 수정 PR에서 충돌을 먼저 제거한다.
- `12-validation-and-dry-run.md`의 cross-doc consistency checklist가 중복 문구 일치 여부를 검증한다.
- `27-operations-observability-contract.md`는 이 effect lifecycle이 사용자-visible recovery와 incident dry-run으로 검증되는지 확인한다.

## Runtime policy block

아래 block은 `18`, `20`, `21`, `22` 문서에도 같은 의미로 반복되어야 한다.

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

## Package ownership

| Package | Runtime contract responsibility | Must not do |
| --- | --- | --- |
| `packages/core` | ProductEngine command/reducer/types/effect plan/deterministic output | import Hono, Drizzle client, Codex client, Tauri, filesystem, browser automation |
| `packages/db` | load state snapshot, persist events, persist deterministic outputs, persist effect tasks, update effect status | decide product state transitions |
| `apps/sidecar` | Hono route, local auth, application service, effect executor, SSE stream | place ProductEngine branching logic in route handlers |
| `apps/desktop` | call sidecar API, render projection, subscribe to SSE, show pending/manual retry cards | mutate queue/spec/scoring as source of truth |
| `packages/contracts` | shared command/event/effect/API/SSE/projection DTOs defined in `25-contracts-dto-catalog.md` | define behavior not backed by ProductEngine contract or import runtime/db/ui frameworks |

## ProductEngine reducer contract

Reducer signature shape. Canonical command/state/reduction DTO fields are defined in `25-contracts-dto-catalog.md`:

```ts
type ProductEngineReducer = (
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
) => ProductEngineReduction;
```

Required input:

| Input | Description |
| --- | --- |
| `command` | Validated event-sourcing style ProductEngineCommand from Hono application service |
| `state.project` | Project and privacy mode |
| `state.session` | Current session status and active batch refs |
| `state.currentSpec` | Working draft plus latest SpecVersion ref |
| `state.openIssues` | AmbiguityIssue set relevant to the command |
| `state.queueProjection` | Current active/next/blocked/deferred queue projection |
| `state.researchState` | ResearchTask/ResearchResult/EvidenceMatrix summary needed for routing |
| `state.decisions` | Decision outcomes and approval status |
| `state.runtimeState` | RuntimePreviewArtifact and blocked/manual retry summaries |
| `state.completeness` | Latest completeness/confidence snapshot |

Required output:

```ts
type ProductEngineReduction = {
  accepted: boolean;
  rejectionReason?: ProductEngineRejection;
  events: ProductEngineEventDraft[];
  nextState: ProductEngineStatePatch;
  effectPlan: ProductEngineEffectPlanItem[];
  deterministicOutputs: ProductEngineDeterministicOutput[];
  immediateProjection?: ActiveBatchSafeProjection;
};
```

Rules:

- `accepted=false` returns no events, no effect plan, and a stable `COMMAND_PRECONDITION_FAILED` compatible reason.
- `events` are append-only drafts. Repository assigns durable ids and commit order.
- `nextState` is a patch intent, not a direct DB write.
- `effectPlan` contains persisted async work to enqueue after events are saved.
- `deterministicOutputs` contains scoring/export/spec snapshot outputs that are safe to persist in the same transaction.
- `immediateProjection` is allowed only for active batch UX exceptions.

## Command handling pipeline

Every mutating Hono command follows this sequence:

```text
request received
  -> validate Zod schema
  -> authenticate local capability token
  -> load ProductEngineStateSnapshot from repository
  -> call pure reducer + effect plan
  -> if rejected: return COMMAND_PRECONDITION_FAILED
  -> transaction:
       append events
       persist nextState patch
       persist reducer_deterministic_output
       persist effect_tasks from effectPlan
       persist active batch safe immediate projection when allowed
  -> emit SSE events for command accepted and effect queued
  -> return command response
```

Forbidden shortcuts:

- Hono route handler directly creates Question, Decision, EvidenceMatrix, SpecVersion, or RuntimePreviewArtifact.
- Effect executor changes session state without a ProductEngine follow-up command/event.
- Reducer reads from DB to fill missing context.
- Frontend computes ProductEngine decisions locally.

## Active batch projection exception

`active batch projection exception` is the only Phase 1 exception to all-async effect execution.

Allowed immediate projection:

- mark submitted active question as answered.
- keep current active batch stable.
- show queued effect status for research/Codex/queue recalculation.
- show next queue placeholder when reducer can derive it deterministically without external effect results.
- show activity feed item explaining that deeper recalculation is queued.

Not allowed immediate projection:

- importing research results.
- creating EvidenceMatrix from external or user-imported source.
- creating RuntimePreviewArtifact from Codex output.
- applying high-impact SpecUpdate.
- declaring CompletionCandidate based on unfinished effect.
- changing active batch because a background effect might produce a higher-priority item.

API implication:

- active-batch commands may return `accepted_with_projection`.
- all other mutating commands return `accepted` plus queued effect refs, then UI waits for SSE/refetch.

## Effect task lifecycle

All first-class effects use the same lifecycle states.

| Status | Meaning | Next statuses |
| --- | --- | --- |
| `queued` | persisted and waiting for executor | `leased`, `cancelled`, `blocked` |
| `leased` | executor claimed work | `running`, `failed`, `blocked` |
| `running` | executor is actively processing the task | `succeeded`, `failed`, `blocked` |
| `succeeded` | output persisted and follow-up event emitted | terminal |
| `failed` | attempts exhausted or non-retryable failure | `queued` only through manual retry command; user-visible recovery is required by `27-operations-observability-contract.md` |
| `blocked` | policy, approval, missing dependency, or runtime unavailable blocks execution | `queued`, `cancelled` |
| `cancelled` | user/system cancelled before terminal output | terminal |

Required fields:

| Field | Required meaning |
| --- | --- |
| `id` | `eft_` prefixed stable id |
| `projectId` | project scope |
| `sessionId` | session scope |
| `sourceEventId` | event that created this effect |
| `effectType` | one of the three first-class effect types |
| `status` | lifecycle status |
| `idempotencyKey` | effect-specific duplicate guard |
| `attemptCount` | attempts already started |
| `maxAttempts` | policy-defined upper bound |
| `leaseOwner` | executor instance id while leased/running; cleared for queued or terminal statuses |
| `leaseExpiresAt` | stale-running recovery deadline; cleared for queued or terminal statuses |
| `inputRef` | JSON ref or payload pointer needed by executor |
| `outputRef` | result pointer when succeeded |
| `lastErrorCode` | stable error code when failed/blocked |
| `lastErrorMessage` | human-readable explanation |
| `createdAt` | creation timestamp |
| `updatedAt` | last status timestamp |

Crash recovery:

- On sidecar startup, `running` tasks with expired lease become `queued` when `attemptCount < maxAttempts`.
- Expired tasks with exhausted attempts become `failed` and emit `effect.failed` SSE on next activity sync.
- `blocked` tasks do not auto-retry until the blocking condition changes or a user command requests retry.

## Effect type taxonomy

| Effect type | Purpose | Typical source command/event | Output |
| --- | --- | --- | --- |
| `queue_projection_effect` | Recalculate active/next/blocked/deferred queue and activity feed after state-changing events | answer, decision, evidence, runtime preview, repeat limit | QueueProjection, ActivityEvent |
| `research_evidence_effect` | Plan research, synthesize imported ResearchResult, create EvidenceMatrix, mark missing_con_evidence/blockers | AnswerRouted, ResearchResultImported, EvidenceSynthesisRequested | ResearchTask, EvidenceMatrix, Risk/Review Card |
| `codex_runtime_preview_effect` | Run Codex app-server/manual handoff preview and convert output using `24-codex-prompt-output-contract.md` | RuntimePreviewRequested, ResearchPlanned | RuntimePreviewArtifact, allowed Codex Artifact, ManualRetryCard, BlockedRuntimeCard |

Non-effect deterministic outputs:

| Deterministic output | Why not an async effect | Persistence rule |
| --- | --- | --- |
| `completeness_snapshot` | derived from current state, evidence, decisions, known risks | persisted in same repository transaction as reducer output |
| `confidence_map` | derived from CompletenessSnapshot and axis impacts | persisted or projected with completeness snapshot |
| `spec_version_material` | deterministic snapshot material after approved decision | persisted with event transaction when preconditions pass |
| `founder_brief_draft` | deterministic export draft from current Spec/Decision/Risk state | persisted as draft metadata; file write/export action remains user-triggered native boundary |

## Conservative AI retry matrix

`conservative_ai_retry_matrix` is mandatory in Phase 1.

| Effect type | Idempotency key | Auto retry | Manual retry | Failure output |
| --- | --- | --- | --- | --- |
| `queue_projection_effect` | `sourceEventId + projectionKind` | max 3 | not normally needed | `QueueProjectionFailed` activity and sidecar refetch recommendation |
| `research_evidence_effect` | `researchTaskId` or `researchResultId + synthesisVersion` | max 2 | allowed through Research Review Card | `ResearchEffectFailed` card with retained source/result |
| `codex_runtime_preview_effect` | `turnPurpose + contextHash + runtimeAdapterVersion` | max 1 | required after auto retry exhausted | `ManualRetryCard` or `RuntimeBlockedCard` |

Policy details:

- Retry uses bounded backoff. Exact timing is implementation detail, but tests must not depend on wall-clock waits.
- Automatic retry never changes user-approved decisions.
- Codex runtime effect cannot silently create multiple visible preview artifacts for the same idempotency key.
- Within one effect attempt, Codex JSON repair follows `24-codex-prompt-output-contract.md`: parser repair once, self-repair once, then severity routing.
- Failed Codex runtime effect must offer manual handoff, manual retry, validation failure card, or runtime blocked card, not aggressive hidden retry.
- Queue projection effect must be idempotent and safe to rerun after crash.
- Research evidence effect must preserve original source/result even when synthesis fails.

## Hono API response rule

Mutating command responses use one of these result categories. Endpoint-specific request mapping, response/statusUrl behavior, SSE/refetch recovery, and error/precondition cases are canonical in `26-api-route-behavior-catalog.md`.

| Category | When used | Response includes |
| --- | --- | --- |
| `accepted` | command accepted, no immediate active-batch projection | `eventIds`, `effectTaskIds`, `statusUrl`, `queuedActivity`; exact DTO in `25-contracts-dto-catalog.md` |
| `accepted_with_projection` | active batch projection exception applies | `eventIds`, `effectTaskIds`, `queueProjection`, `activity`, `pendingEffectSummary`; exact DTO in `25-contracts-dto-catalog.md` |
| `rejected` | precondition or validation fails | stable error code and no event/effect ids |
| `blocked` | command is valid but policy/runtime blocks effect execution | blocking card projection and no external execution |

Rules:

- API must not pretend async effect output is already complete.
- API routes must use only `CommandType` values defined in `25-contracts-dto-catalog.md`; route labels cannot introduce extra commands.
- Frontend treats returned projection as read model, not source of truth.
- SSE/refetch is the source of truth for effect completion.
- Commands that request file/shell/browser execution return `blocked` or preview-only artifact path, never apply side effects.

## SSE event rule

The sidecar emits stable SSE event names for effect lifecycle.

| Event | Required payload |
| --- | --- |
| `command.accepted` | projectId, sessionId, commandType, eventIds, effectTaskIds |
| `command.rejected` | commandType, errorCode, reason |
| `effect.queued` | effectTaskId, effectType, sourceEventIds |
| `effect.started` | effectTaskId, effectType, attemptCount |
| `effect.succeeded` | effectTaskId, effectType, outputRef, projectionHint |
| `effect.failed` | effectTaskId, effectType, errorCode, retryAvailable |
| `effect.blocked` | effectTaskId, effectType, blockReason, userAction |
| `projection.updated` | projectionKind, version, affectedQueueItemIds |

Rules:

- SSE payloads are notifications, not full canonical state.
- UI refetches affected projection after `effect.succeeded` or `projection.updated`; route-specific refetch URLs are defined in `26-api-route-behavior-catalog.md`.
- Missed SSE messages are recovered by polling/refetching session projection or command `statusUrl` as defined in `25-contracts-dto-catalog.md` and `26-api-route-behavior-catalog.md`; the missed-SSE incident dry-run is defined in `27-operations-observability-contract.md`.

## ProductEngine state snapshot contract

Repository load must give reducer a complete enough snapshot so reducer never queries external systems.

Minimum snapshot groups:

- project/session metadata.
- latest working spec and SpecVersion summary.
- open ambiguity issues and repeat counts.
- current queue projection and active batch.
- recent answers and route outcomes needed for current command.
- research/evidence summaries and blocker state.
- decision approval outcomes.
- runtime preview summaries and blocked/manual retry state.
- latest completeness snapshot and risk summary.

If snapshot is incomplete, application service returns `COMMAND_PRECONDITION_FAILED` or `SIDECAR_NOT_READY`; reducer must not fill gaps by side effect.

## Phase 1.5 runtime checklist

Phase 1.5 구현자는 `30-phase1.5-research-runtime-and-readiness-contract.md`를 ProductEngine command/effect/state 전이의 canonical input으로 사용한다.

- ResearchAllowlist command는 active/paused/revoked 상태를 reducer에서 검증 가능하게 만든다.
- ResearchRun effect는 provider call을 effect executor에만 둔다; reducer는 외부 connector를 직접 호출하지 않는다.
- retry/backoff/idempotency는 ResearchRun idempotency key와 attempt로 추적한다.
- Evidence quality gate 실패는 Risk/Review card와 terminal/non-terminal run status로 표현한다.
- Phase 1.5B hint conversion은 readiness metadata만 만들고 file/shell/browser/network/credential/destructive 실행 effect를 만들지 않는다.

## Acceptance scenarios

### Scenario A. Start project to first active batch

Given raw idea exists.

When `StartProject`, `CaptureIntake`, `DraftInitialSpec`, `AnalyzeAmbiguity`, `ActivateQuestionBatch` commands are submitted.

Then:

- each accepted command appends events.
- reducer returns effect plans without DB/runtime calls.
- queue projection appears through active batch exception or queued projection effect.
- first active batch has 3 to 5 cards.
- no Codex runtime is required.

### Scenario B. Answer routes to research effect

Given active question exists.

When user submits an answer that routes to `research_needed`.

Then:

- command response may mark active question answered immediately.
- `research_evidence_effect` is persisted.
- active batch remains stable.
- EvidenceMatrix is not visible until effect succeeds or manual import is processed.
- failed synthesis preserves source/result and creates retryable review card.

### Scenario C. Codex preview fails safely

Given Codex app-server is unavailable or a turn fails after parser repair, self-repair, and one effect auto retry.

When `codex_runtime_preview_effect` exhausts policy.

Then:

- no file/shell/browser action is applied.
- effect status becomes `failed` or `blocked`.
- UI receives severity-routed `ManualRetryCard`, `ManualHandoffCard`, `ValidationFailedCard`, or `RuntimeBlockedCard`.
- user can choose manual prompt handoff when applicable.
- blocked file/shell/browser/network/credential/destructive requests become `BlockedActionArtifact`.

### Scenario D. Completion remains deterministic

Given decisions, evidence, known risks, and spec material are available.

When reducer processes completion-related command.

Then:

- completeness snapshot and founder brief draft are deterministic outputs.
- they are not queued as async effects.
- unfinished research/Codex effects can block completion if gates require their output.
- founder brief draft does not claim startup success probability.

## Implementation PR mapping

| Implementation PR | Runtime contract additions |
| --- | --- |
| PR-03 | `effect_tasks` table/repository, event refs, idempotency fields |
| PR-04 | pure reducer + effect plan unit tests, command pipeline, active batch exception stub |
| PR-05 | UI pending effect states, SSE/refetch behavior, no frontend source-of-truth mutation |
| PR-06 | `research_evidence_effect` executor and retry/failure cards |
| PR-07 | `codex_runtime_preview_effect` executor, `24-codex-prompt-output-contract.md` schema, conservative AI retry, parser/self repair, manual retry/handoff/block cards |
| PR-08 | deterministic completeness/founder brief outputs, no async scoring/export effect |
| PR-09 | dry-run proves effect queue, failure handling, preview-only runtime, deterministic completion, and representative operations incidents from `27-operations-observability-contract.md` |

## Validation checklist

- `pure reducer + effect plan` appears in README, 18, 23.
- `persisted async effect queue` appears in 18, 20, 21, 22, 23.
- `active batch projection exception` appears in 18, 21, 23.
- All three first-class effect types appear in 20, 21, 22, 23.
- `reducer_deterministic_output` appears in 18, 20, 22, 23.
- `conservative_ai_retry_matrix` appears in 20, 21, 23.
- docs do not introduce `scoring_effect` or `spec_export_effect` as Phase 1 first-class async effect.
- `26-api-route-behavior-catalog.md` appears as the endpoint behavior source for API/SSE/refetch guardrails.
- `27-operations-observability-contract.md` appears as the end-to-end incident recovery source for research effect failure, Codex runtime failure, and missed SSE recovery.
