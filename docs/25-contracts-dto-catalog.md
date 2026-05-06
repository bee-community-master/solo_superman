# 25. Contracts DTO Catalog

## 목적

이 문서는 Phase 1 구현자가 `packages/contracts`의 public 타입, DTO, enum, projection, export path를 구현 중 다시 결정하지 않도록 고정한다.

Canonical path: `docs/25-contracts-dto-catalog.md`.

`19-phase1-implementation-architecture.md`가 monorepo/process topology를 정의하고, `21-sidecar-api-runtime-contract.md`가 Hono route/runtime boundary를 정의하며, `23-product-engine-runtime-contract.md`가 reducer/effect 실행 계약을 정의한다면, 이 문서는 **앱 경계를 지나는 TypeScript contract의 public surface**를 소유한다.

이 문서는 contracts/DTO의 기준 계약이다. 런타임 코드, Zod schema 파일, package scaffold, DB migration, Hono handler는 각 구현 PR과 현재 코드베이스가 소유하며, 이 문서는 public DTO와 package dependency boundary를 정의한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Canonical source | `packages/contracts` public DTO/type catalog는 이 문서가 소유 |
| 범위 | ProductEngine core + API DTO + SSE DTO + UI Projection/ViewModel |
| 제외 | DB row, Drizzle schema, repository record, SQL migration shape |
| 상세도 | type family별 field table, closed enum, example DTO, export path, Zod schema naming |
| Module layout | family별 folder + `index.ts` |
| Command model | event-sourcing style command envelope |
| Command required meta | concurrency + causation meta까지 required |
| CommandResponse/statusUrl | field table + lifecycle + example DTO까지 고정 |
| UI Projection | 8개 1급 read model 고정 |
| Codex re-export | 24번 문서의 enum/taxonomy를 contracts에서 re-export하는 방식만 고정 |
| Required acceptance | command envelope fixture, CommandResponse/statusUrl lifecycle, SSE DTO + refetch hint |
| Non-required validation | export map, UI projection fixture, Codex re-export compatibility, forbidden imports는 checklist/validation note |

## Non-goals and ownership boundaries

`packages/contracts`는 다음을 소유한다.

- branded ID, schemaVersion, projectionVersion type.
- ProductEngine command/event/reduction/effect DTO.
- Hono API request/response DTO and envelope type.
- SSE event DTO.
- frontend read-model projection DTO.
- Codex contract enum/taxonomy re-export type.
- Zod schema naming and export convention.

`packages/contracts`는 다음을 소유하지 않는다.

- Drizzle table row shape.
- SQL migration file.
- repository transaction behavior.
- reducer business behavior.
- Hono route implementation.
- React component-local state.
- Codex app-server generated protocol type.

DB row and migration details remain in `20-data-storage-contract.md`. Codex prompt/output schema details remain in `24-codex-prompt-output-contract.md`.

## Module layout

`packages/contracts/src` uses family folders with `index.ts` files.

```text
packages/contracts/src/
├─ index.ts
├─ ids/
│  ├─ index.ts
│  └─ schemas.ts
├─ product-engine/
│  ├─ index.ts
│  ├─ commands.ts
│  ├─ events.ts
│  ├─ state.ts
│  └─ reduction.ts
├─ effects/
│  ├─ index.ts
│  ├─ tasks.ts
│  └─ runtime.ts
├─ api/
│  ├─ index.ts
│  ├─ envelopes.ts
│  ├─ command-response.ts
│  ├─ requests.ts
│  └─ errors.ts
├─ sse/
│  ├─ index.ts
│  └─ events.ts
├─ projections/
│  ├─ index.ts
│  ├─ session-shell.ts
│  ├─ decision-queue.ts
│  ├─ living-spec.ts
│  ├─ research-allowlist.ts
│  ├─ research-evidence.ts
│  ├─ confidence-completion.ts
│  ├─ runtime-activity.ts
│  └─ founder-brief.ts
└─ codex/
   ├─ index.ts
   └─ reexports.ts
```

Rules:

- Root `index.ts` re-exports only family `index.ts` files.
- Family `index.ts` files export public types and Zod schemas for that family.
- Files must not import from `apps/*`, `packages/db`, `packages/core`, Hono, Drizzle, React, Tauri, filesystem, shell, browser, or Codex runtime client.
- `codex/reexports.ts` imports or mirrors only internal app enum/taxonomy types defined by the contracts package implementation from `24-codex-prompt-output-contract.md`; it does not import Codex app-server runtime client types.
- Generated Codex app-server schema stays under `packages/contracts/src/codex-generated/<codex-version>/` as described in `21-sidecar-api-runtime-contract.md`, and is not part of the handwritten public DTO catalog.

## Zod and type naming convention

| Contract item | Naming rule | Example |
| --- | --- | --- |
| TypeScript type | PascalCase | `ProductEngineCommand` |
| Zod schema | PascalCase + `Schema` | `ProductEngineCommandSchema` |
| Enum type | PascalCase | `CommandType` |
| Enum schema | PascalCase + `Schema` | `CommandTypeSchema` |
| DTO type | PascalCase + `Dto` only when it is purely wire-level | `StatusEndpointDto` |
| Projection type | PascalCase + `Projection` | `DecisionQueueProjection` |
| Event stream type | PascalCase + `SseEvent` | `EffectSucceededSseEvent` |
| Root export | family namespace export allowed | `export * from './product-engine'` |

Implementation must prefer discriminated unions for command, domain event, effect task status, API response category, and SSE event unions.

## Type family catalog

| Family | Folder | Owns | Must not own |
| --- | --- | --- | --- |
| ID/Brand/Version | `ids/` | stable branded identifiers and version tokens | database primary-key generation policy |
| ProductEngine Core | `product-engine/` | command, event draft, state snapshot, reduction, deterministic output | reducer behavior |
| Effect/Runtime | `effects/` | effect task DTO, runtime artifact refs, retry summary refs | effect executor behavior |
| API Request/Response | `api/` | Hono request/response DTO, envelope, errors, statusUrl DTO | route handlers |
| SSE/Event Stream | `sse/` | server-sent event DTOs and refetch hints | SSE transport implementation |
| UI Projection/ViewModel | `projections/` | frontend read models returned by sidecar | React component state |
| Codex Contract Re-export | `codex/` | app-internal Codex enum/taxonomy bridge | Codex app-server client protocol |

## ID, brand, and version types

All public DTOs use string identifiers with branded type aliases in TypeScript. Runtime JSON remains string.

| Type | JSON shape | Used by | Notes |
| --- | --- | --- | --- |
| `ProjectId` | string | project/session/API/projection | stable local project id |
| `SessionId` | string | session/queue/research/runtime | stable within project |
| `QueueItemId` | string | queue/projection/SSE | question, decision, blocked, retry card id |
| `QuestionId` | string | question batch/answer | generated before persistence allowed |
| `DecisionId` | string | approval/spec/evidence | stable decision card id |
| `ResearchAllowlistId` | string | research allowlist | project-local allowlist id |
| `ResearchConnectorId` | string | research allowlist | stable non-secret connector slug from the approved read-only registry |
| `ResearchTaskId` | string | research/evidence | manual handoff or Codex research task |
| `ResearchResultId` | string | evidence synthesis | imported result id |
| `EvidenceItemId` | string | EvidenceMatrix | claim/evidence entry id |
| `DecisionEvidencePackId` | string | DecisionEvidencePack | quality-gated, decision-linked evidence pack id |
| `SpecVersionId` | string | Living Spec | persisted version id |
| `RuntimeArtifactId` | string | Codex/runtime artifact | maps to 24번 artifact output |
| `EffectTaskId` | string | effect queue | persisted async effect task id |
| `EventId` | string | event log/SSE | ProductEngine event id |
| `CommandId` | string | command envelope | idempotency/audit trace |
| `CorrelationId` | string | command/event chain | groups related commands/events/effects |
| `CausationId` | string | command/event chain | previous event/command causing this command |
| `ProjectionVersion` | number | projections/SSE | monotonic per projection kind |
| `StateVersion` | number | ProductEngine concurrency | optimistic concurrency token |
| `SchemaVersion` | string | API/DTO/Codex | exact schema string |

Example JSON:

```json
{
  "projectId": "project_demo_001",
  "sessionId": "session_demo_001",
  "eventId": "event_001",
  "projectionVersion": 12,
  "schemaVersion": "solo-superman.contracts.v1"
}
```

## ProductEngine core types

### CommandType enum

Phase 1 command type values are closed, and Phase 1.5A allowlist/disclosure/run-control governance adds a small project-level application-command family. `26-api-route-behavior-catalog.md` must normalize route actions to these values and must not introduce extra `CommandType` names. Project-level application commands remain in the route/catalog taxonomy, but they are not `ProductEngineCommand` reducer envelopes and must not fake a session id.

| CommandType | Purpose |
| --- | --- |
| `StartProject` | create project shell from raw idea |
| `CaptureIntake` | store initial idea/intake answer |
| `DraftInitialSpec` | create initial Living Spec draft material |
| `AnalyzeAmbiguity` | derive ambiguity issues/confidence projection |
| `ActivateQuestionBatch` | activate next 3-5 question cards |
| `SubmitAnswer` | answer active question |
| `DeferQueueItem` | defer queue item |
| `DismissQueueItem` | dismiss invalid queue item |
| `PlanResearch` | create ResearchTask/manual handoff prompt |
| `ImportResearchResult` | import pasted/manual research result |
| `SynthesizeEvidence` | run evidence matrix synthesis path |
| `ResolveResearchQueueCard` | resolve a Research-updated Queue card with approved/revised/rejected/deferred/risk_accepted/research_insufficient terminal outcome |
| `CreateRuntimePreview` | run Codex/manual runtime preview effect |
| `ConvertRuntimeArtifact` | convert allowed runtime artifact to local candidate/projection |
| `CreateSpecUpdatePreview` | create SpecUpdate candidate |
| `ResolveDecision` | approve/reject/defer decision card |
| `CreateSpecVersion` | persist approved spec version material |
| `ScoreCompleteness` | calculate deterministic completeness snapshot |
| `PrepareFounderBrief` | prepare deterministic founder brief draft |
| `CreateResearchAllowlist` | create project-level read-only research allowlist governance projection; no ProductEngine reducer side effects |
| `UpdateResearchAllowlist` | update active/paused allowlist policy fields or reactivate paused allowlist; no ProductEngine reducer side effects |
| `PauseResearchAllowlist` | pause future automatic research run starts for an allowlist; no ProductEngine reducer side effects |
| `RevokeResearchAllowlist` | terminally revoke future automatic research run starts for an allowlist; no ProductEngine reducer side effects |
| `PrepareResearchDisclosure` | prepare and audit public-safe research disclosure payload or blocked manual handoff; no provider execution and no ProductEngine reducer side effects |
| `StartResearchRun` | create and observe a project-level read-only ResearchRun after allowlist/disclosure/precondition checks; no ProductEngine reducer side effects |
| `CancelResearchRun` | request cancellation for a queued/running/paused ResearchRun and expose recoverable status/refetch hints; no ProductEngine reducer side effects |
| `RetryResearchRun` | create a new manual retry ResearchRun from failed/stale/insufficient prior runs with incremented attempt/idempotency; no ProductEngine reducer side effects |

### ProductEngineCommand envelope

`ProductEngineCommand` is a session-scoped event-sourcing command envelope with concurrency and causation required. Project-level application commands such as allowlist/disclosure governance use their own application-service boundary and return command-shaped responses without ProductEngine reducer events/effects.

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `commandId` | yes | `CommandId` | unique per submitted command |
| `commandType` | yes | `ProductEngineCommandType` | closed session-scoped reducer enum |
| `projectId` | yes | `ProjectId` | project scope |
| `sessionId` | yes | `SessionId` | session scope |
| `actor` | yes | `CommandActor` | who/what issued command |
| `issuedAt` | yes | ISO datetime string | generated by sidecar/native client boundary |
| `idempotencyKey` | yes | string | stable for retries of same intent |
| `expectedStateVersion` | yes | `StateVersion` | optimistic concurrency token |
| `causationId` | yes | `CommandId` or `EventId` or `null` | source command/event that caused this command; null only for root commands |
| `correlationId` | yes | `CorrelationId` | shared across a user-visible flow |
| `schemaVersion` | yes | `SchemaVersion` | `solo-superman.contracts.v1` |
| `payload` | yes | discriminated payload | commandType-specific object |

`CommandActor` enum:

| Value | Meaning |
| --- | --- |
| `user` | direct user action from desktop UI |
| `product_engine` | deterministic follow-up generated by ProductEngine application service |
| `effect_executor` | async effect completion command |
| `codex_runtime` | Codex preview/result routed through sidecar, never direct file/shell/browser execution |
| `system` | local maintenance/recovery action |

Example command envelope:

```json
{
  "commandId": "cmd_submit_answer_001",
  "commandType": "SubmitAnswer",
  "projectId": "project_demo_001",
  "sessionId": "session_demo_001",
  "actor": "user",
  "issuedAt": "2026-05-04T07:00:00.000Z",
  "idempotencyKey": "SubmitAnswer:queue_item_001:answer_hash_001",
  "expectedStateVersion": 17,
  "causationId": "event_question_batch_001",
  "correlationId": "corr_session_flow_001",
  "schemaVersion": "solo-superman.contracts.v1",
  "payload": {
    "queueItemId": "queue_item_001",
    "answer": {
      "kind": "single_choice",
      "selectedValue": "idea_stage_solo_founder",
      "freeText": null
    }
  }
}
```

### Command payload families

| CommandType group | Payload type | Required fields |
| --- | --- | --- |
| project/session intake | `StartProjectPayload`, `CaptureIntakePayload` | raw idea, local privacy mode, optional source note |
| spec/ambiguity | `DraftInitialSpecPayload`, `AnalyzeAmbiguityPayload` | target spec draft/version refs, analysis target refs |
| queue/answer | `ActivateQuestionBatchPayload`, `SubmitAnswerPayload`, `DeferQueueItemPayload`, `DismissQueueItemPayload` | queue item/batch ids and answer/defer/dismiss reason |
| research/evidence | `PlanResearchPayload`, `ImportResearchResultPayload`, `SynthesizeEvidencePayload` | research task/result refs, source reliability/metadata, claim/decision/spec/question refs, synthesis target |
| runtime/codex | `CreateRuntimePreviewPayload`, `ConvertRuntimeArtifactPayload` | turnPurpose/artifact id/target conversion request |
| decision/spec version | `CreateSpecUpdatePreviewPayload`, `ResolveDecisionPayload`, `CreateSpecVersionPayload` | decision/spec update refs and approval outcome |
| completion/export | `ScoreCompletenessPayload`, `PrepareFounderBriefPayload` | scoring target or founder brief draft target |
| allowlist governance | `CreateResearchAllowlistRequest`, `UpdateResearchAllowlistRequest`, `PauseResearchAllowlistRequest`, `RevokeResearchAllowlistRequest` | project id, allowlist id, read-only connector/source policy, pause/revoke transition target |
| disclosure governance | `PrepareResearchDisclosureRequest` | project id, optional allowlist id, connector/source category, research objective, public-safe summary inputs, source refs |

### ProductEngineStateSnapshot

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `stateVersion` | yes | `StateVersion` | must match command expectedStateVersion before reducer call |
| `project` | yes | `ProjectSnapshot` | project metadata/privacy mode |
| `session` | yes | `SessionSnapshot` | phase/status/current batch refs |
| `currentSpec` | yes | `CurrentSpecSnapshot` | draft/version material needed by reducer |
| `openIssues` | yes | `AmbiguityIssueSnapshot[]` | active ambiguity issues only |
| `queueProjection` | yes | `DecisionQueueProjection` | current active/next/blocked/deferred read model |
| `researchState` | yes | `ResearchEvidenceProjection` | summary projection sufficient for routing |
| `decisions` | yes | `DecisionSnapshot[]` | active/resolved approvals with one `requiredDecisionRef` per required completion decision |
| `specUpdatePreviews` | no | `SpecUpdatePreviewSnapshot[]` | preview material keyed by `previewRef` so approved decisions cannot version different title/sections |
| `runtimeState` | yes | `RuntimeActivityProjection` | runtime preview/retry/block summary |
| `completeness` | yes | `ConfidenceCompletionProjection` | latest deterministic scoring projection |

`DecisionSnapshot.requiredDecisionRef` is a closed completion-gate key: `primary_customer`, `problem`, `value`, `mvp_scope`, `validation_plan`, or `success_criteria`. PR-08 completeness must count unique closed required refs, not any six unrelated decisions.
High-impact `CreateSpecVersion` must consume the approved `SpecUpdatePreviewSnapshot` material for its `approvedPreviewRef`; request body title/sections are optional echoes and must not mutate the approved preview material.

### ProductEngineReduction

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `accepted` | yes | boolean | false only for domain/precondition rejection |
| `rejectionReason` | no | `ProductEngineRejection` | required when accepted false |
| `events` | yes | `ProductEngineEventDraft[]` | can be empty only when rejected |
| `nextState` | yes | `ProductEngineStatePatch` | semantic state patch, not DB row diff |
| `effectPlan` | yes | `ProductEngineEffectPlanItem[]` | first-class effect types only |
| `deterministicOutputs` | yes | `ProductEngineDeterministicOutput[]` | completeness/spec/founder brief draft material |
| `immediateProjection` | no | `ActiveBatchSafeProjection` | only active batch projection exception |

Example reduction summary:

```json
{
  "accepted": true,
  "events": [{ "eventType": "AnswerSubmitted", "sourceCommandId": "cmd_submit_answer_001" }],
  "nextState": { "stateVersionDelta": 1, "touched": ["queue", "answers"] },
  "effectPlan": [{ "effectType": "research_evidence_effect", "idempotencyKey": "research:answer_001" }],
  "deterministicOutputs": [{ "outputType": "completeness_snapshot", "reason": "answer changed customer axis" }],
  "immediateProjection": { "projectionKind": "DecisionQueueProjection", "version": 18 }
}
```

### ProductEngineEventDraft and persisted ProductEngineEvent

Reducer output creates event drafts; the application service persists them and assigns final event ids. `packages/contracts` exposes both draft and persisted DTOs so tests can validate reducer output without binding it to repository rows.

| Field | Draft required | Persisted required | Type | Rule |
| --- | --- | --- | --- | --- |
| `eventId` | no | yes | `EventId` | assigned by application service/persistence boundary |
| `eventType` | yes | yes | `ProductEngineEventType` | closed enum |
| `projectId` | yes | yes | `ProjectId` | project scope |
| `sessionId` | yes | yes | `SessionId` | session scope |
| `sourceCommandId` | yes | yes | `CommandId` | command that produced the event |
| `correlationId` | yes | yes | `CorrelationId` | copied from command |
| `causationId` | yes | yes | `CommandId` or `EventId` or `null` | copied from command or previous event |
| `sequence` | no | yes | number | monotonic within session event stream |
| `occurredAt` | no | yes | ISO datetime | persistence timestamp |
| `schemaVersion` | yes | yes | `SchemaVersion` | contract version |
| `payload` | yes | yes | discriminated payload | selected by eventType |

Closed Phase 1 event type groups:

| Group | EventType examples | Notes |
| --- | --- | --- |
| project/session | `ProjectStarted`, `IntakeCaptured`, `SessionPhaseChanged` | shell/session state |
| spec | `InitialSpecDrafted`, `SpecUpdatePreviewCreated`, `SpecVersionCreated` | Living Spec state |
| ambiguity/queue | `AmbiguityAnalyzed`, `QuestionBatchActivated`, `QueueItemDeferred`, `QueueItemDismissed` | queue and question loop |
| answer/decision | `AnswerSubmitted`, `DecisionResolved` | user decisions and answer cards |
| research/evidence | `ResearchPlanned`, `ResearchResultImported`, `EvidenceSynthesisRequested`, `EvidenceSynthesized`, `ResearchQueueCardResolved` | research/evidence closed loop; request events queue async work, synthesized events are emitted by the effect executor, and user terminal outcomes update queue/completeness projections |
| runtime | `RuntimePreviewRequested`, `RuntimeArtifactConverted` | sandbox preview only |
| completeness/export | `CompletenessScored`, `FounderBriefPrepared` | deterministic output refs |

### ProductEngineEffectPlanItem

`ProductEngineEffectPlanItem` is reducer output. It is not an executor task yet. The application service converts it to `EffectTaskDto` only after events are persisted.

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `effectType` | yes | `EffectType` | one of the three Phase 1 effects |
| `idempotencyKey` | yes | string | stable across command retry |
| `sourceCommandId` | yes | `CommandId` | copied from command |
| `sourceEventTypes` | yes | `ProductEngineEventType[]` | draft event types expected to cause effect |
| `correlationId` | yes | `CorrelationId` | copied from command |
| `priority` | yes | enum | `low`, `normal`, `high`, `urgent` |
| `runAfter` | no | ISO datetime | absent means runnable after commit |
| `inputRef` | yes | object | lightweight reference to persisted state/artifact |
| `previewPolicy` | yes | enum | `auto_low_risk`, `approval_required`, `manual_handoff_required`, `blocked` |

`previewPolicy`는 ProductEngine effect planning policy다. `24-codex-prompt-output-contract.md`의 6개 `CodexApplyPolicy`와 이름·값을 맞춰야 하는 enum이 아니며, runtime artifact를 만들 때만 adapter가 `CodexApplyPolicy`로 매핑한다.

### ProductEngineDeterministicOutput

Deterministic outputs are reducer-created artifacts that can be persisted or projected without asynchronous execution.

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `outputType` | yes | enum | closed values below |
| `sourceCommandId` | yes | `CommandId` | source command |
| `correlationId` | yes | `CorrelationId` | flow correlation |
| `stateVersionAfter` | no | `StateVersion` | filled after persistence assigns next version |
| `artifactRef` | no | object | optional persisted artifact reference |
| `payload` | yes | object | deterministic output body |
| `reason` | yes | string | user/debug visible explanation |

| OutputType | Used by | Rule |
| --- | --- | --- |
| `ambiguity_confidence_projection` | confidence/completion UI | deterministic from current state |
| `question_batch_projection` | active batch exception | may be returned immediately |
| `spec_update_preview` | approval queue | never mutates spec version until approved |
| `completeness_snapshot` | radar/progress/history | no async scoring effect in Phase 1 |
| `founder_brief_draft` | Founder Brief | if-stop-now artifact, deterministic draft |

## Effect and runtime types

### EffectType enum

| EffectType | Source | Output refs |
| --- | --- | --- |
| `queue_projection_effect` | queue/spec/evidence/runtime events | `DecisionQueueProjection`, ActivityEvent |
| `research_evidence_effect` | research planning/import/synthesis commands | ResearchTask, EvidenceMatrix, DecisionEvidencePack, Review/Risk card |
| `codex_runtime_preview_effect` | runtime preview request/research prompt need | RuntimePreviewArtifact, Codex artifact, ManualRetry/Blocked card |

### EffectStatus enum

| Status | Terminal | Meaning |
| --- | --- | --- |
| `queued` | no | persisted and waiting for executor |
| `leased` | no | executor claimed work |
| `running` | no | external/local effect running |
| `succeeded` | yes | outputRef persisted |
| `failed` | yes | retry unavailable or manual retry required |
| `blocked` | yes | policy/safety block |
| `cancelled` | yes | cancelled before terminal output |

### EffectTaskDto

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `effectTaskId` | yes | `EffectTaskId` | persisted effect task id |
| `effectType` | yes | `EffectType` | closed enum |
| `status` | yes | `EffectStatus` | lifecycle status |
| `sourceCommandId` | yes | `CommandId` | originating command |
| `sourceEventIds` | yes | `EventId[]` | causation events |
| `correlationId` | yes | `CorrelationId` | flow correlation |
| `idempotencyKey` | yes | string | duplicate prevention key |
| `attemptCount` | yes | number | starts at 0 |
| `maxAttempts` | yes | number | follows conservative retry matrix |
| `outputRef` | no | object | required when succeeded |
| `error` | no | `EffectErrorDto` | required when failed/blocked |
| `queuedAt` | yes | ISO datetime | visible in UI projections |
| `updatedAt` | yes | ISO datetime | status freshness |

## API Request/Response contract

### ApiEnvelope

All JSON API responses use `ApiSuccessEnvelope<T>` or `ApiErrorEnvelope`.

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `ok` | yes | boolean | discriminant |
| `data` | success only | T | absent in error |
| `error` | error only | `ApiError` | absent in success |
| `meta.requestId` | yes | string | generated by sidecar |
| `meta.schemaVersion` | yes | `SchemaVersion` | `solo-superman.contracts.v1` |

### CommandResponse category enum

| Category | Meaning |
| --- | --- |
| `accepted` | command accepted, async effects queued, no immediate projection |
| `accepted_with_projection` | active batch projection exception applies |
| `rejected` | validation/precondition/domain rejection, no events/effects persisted |
| `blocked` | valid command, but policy/runtime blocks execution |

### CommandResponse common fields

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `category` | yes | `CommandResponseCategory` | discriminant |
| `commandId` | yes | `CommandId` | command envelope id |
| `correlationId` | yes | `CorrelationId` | matches command |
| `stateVersionBefore` | yes | `StateVersion` | loaded snapshot version |
| `stateVersionAfter` | no | `StateVersion` | required when accepted or accepted_with_projection |
| `eventIds` | no | `EventId[]` | required when events persisted |
| `effectTaskIds` | no | `EffectTaskId[]` | required when effects queued |
| `statusUrl` | no | string | required when async effects are pending |
| `queuedActivity` | no | `ActivityItemDto` | allowed for accepted |
| `deterministicOutputs` | no | `ProductEngineDeterministicOutput[]` | public reducer outputs for accepted commands, including spec update preview refs |
| `queueProjection` | no | `DecisionQueueProjection` | only accepted_with_projection |
| `pendingEffectSummary` | no | `PendingEffectSummaryDto` | only accepted_with_projection or status payload |
| `blockingCard` | no | `QueueItemProjection` | required for blocked when user-visible |
| `error` | no | `ApiError` | required for rejected |

### statusUrl format

`statusUrl` must be relative to the sidecar API prefix.

```text
/api/v1/commands/{commandId}/status
```

Rules:

- `statusUrl` is stable for the command id.
- `statusUrl` returns a status endpoint DTO, not raw effect rows.
- `statusUrl` remains valid after terminal status until the session is deleted.
- frontend may poll `statusUrl` after reconnect or when SSE was missed.
- frontend must still refetch projections after `effect.succeeded` or `projection.updated`.

### StatusEndpointDto

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `commandId` | yes | `CommandId` | status target |
| `category` | yes | `CommandResponseCategory` | initial command category |
| `commandStatus` | yes | enum | `pending`, `partially_complete`, `complete`, `failed`, `blocked` |
| `eventIds` | yes | `EventId[]` | persisted events |
| `effects` | yes | `EffectTaskDto[]` | public effect DTOs |
| `pendingEffectSummary` | yes | `PendingEffectSummaryDto` | aggregate UI summary |
| `projectionHints` | yes | `ProjectionRefetchHint[]` | what frontend should refetch |
| `lastUpdatedAt` | yes | ISO datetime | freshness |

Example status endpoint payload:

```json
{
  "ok": true,
  "data": {
    "commandId": "cmd_submit_answer_001",
    "category": "accepted",
    "commandStatus": "partially_complete",
    "eventIds": ["event_answer_001"],
    "effects": [
      {
        "effectTaskId": "effect_research_001",
        "effectType": "research_evidence_effect",
        "status": "running",
        "sourceCommandId": "cmd_submit_answer_001",
        "sourceEventIds": ["event_answer_001"],
        "correlationId": "corr_session_flow_001",
        "idempotencyKey": "research:answer_001",
        "attemptCount": 1,
        "maxAttempts": 2,
        "queuedAt": "2026-05-04T07:00:00.000Z",
        "updatedAt": "2026-05-04T07:01:00.000Z"
      }
    ],
    "pendingEffectSummary": {
      "totalPending": 1,
      "byType": { "research_evidence_effect": 1 },
      "visibleLabel": "리서치 근거를 정리하는 중"
    },
    "projectionHints": [
      {
        "projectionKind": "ResearchEvidenceProjection",
        "refetchUrl": "/api/v1/sessions/session_demo_001/research",
        "affectedIds": ["research_task_001"],
        "reason": "research effect still running"
      }
    ],
    "lastUpdatedAt": "2026-05-04T07:01:00.000Z"
  },
  "meta": {
    "requestId": "req_status_001",
    "schemaVersion": "solo-superman.contracts.v1"
  }
}
```

Example accepted response:

```json
{
  "ok": true,
  "data": {
    "category": "accepted",
    "commandId": "cmd_submit_answer_001",
    "correlationId": "corr_session_flow_001",
    "stateVersionBefore": 17,
    "stateVersionAfter": 18,
    "eventIds": ["event_answer_001"],
    "effectTaskIds": ["effect_research_001"],
    "statusUrl": "/api/v1/commands/cmd_submit_answer_001/status",
    "queuedActivity": {
      "activityId": "activity_001",
      "kind": "command_accepted",
      "summary": "답변이 저장되었고 리서치 effect가 대기 중입니다."
    }
  },
  "meta": {
    "requestId": "req_001",
    "schemaVersion": "solo-superman.contracts.v1"
  }
}
```

Example accepted_with_projection response:

```json
{
  "ok": true,
  "data": {
    "category": "accepted_with_projection",
    "commandId": "cmd_activate_batch_001",
    "correlationId": "corr_session_flow_001",
    "stateVersionBefore": 18,
    "stateVersionAfter": 19,
    "eventIds": ["event_batch_activated_001"],
    "effectTaskIds": ["effect_queue_001"],
    "statusUrl": "/api/v1/commands/cmd_activate_batch_001/status",
    "queueProjection": {
      "projectionKind": "DecisionQueueProjection",
      "version": 19,
      "active": [],
      "next": [],
      "blocked": [],
      "deferred": []
    },
    "pendingEffectSummary": {
      "totalPending": 1,
      "byType": { "queue_projection_effect": 1 },
      "visibleLabel": "큐 재계산 중"
    }
  },
  "meta": {
    "requestId": "req_002",
    "schemaVersion": "solo-superman.contracts.v1"
  }
}
```

## SSE/Event Stream DTO

### SseEvent union

| Event name | DTO type | Required payload fields |
| --- | --- | --- |
| `command.accepted` | `CommandAcceptedSseEvent` | commandId, commandType, eventIds, effectTaskIds, statusUrl |
| `command.rejected` | `CommandRejectedSseEvent` | commandId, commandType, errorCode, reason |
| `effect.queued` | `EffectQueuedSseEvent` | effectTaskId, effectType, sourceEventIds |
| `effect.started` | `EffectStartedSseEvent` | effectTaskId, effectType, attemptCount |
| `effect.succeeded` | `EffectSucceededSseEvent` | effectTaskId, effectType, outputRef, projectionHint |
| `effect.failed` | `EffectFailedSseEvent` | effectTaskId, effectType, errorCode, retryAvailable |
| `effect.blocked` | `EffectBlockedSseEvent` | effectTaskId, effectType, blockReason, userAction |
| `projection.updated` | `ProjectionUpdatedSseEvent` | projectionKind, version, affectedIds, refetchUrl |
| `runtime.status.changed` | `RuntimeStatusChangedSseEvent` | adapterId, status, reason |

### ProjectionRefetchHint

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `projectionKind` | yes | enum | one of 8 UI projection kinds |
| `version` | no | `ProjectionVersion` | latest known version if available |
| `refetchUrl` | yes | string | relative `/api/v1/...` URL |
| `affectedIds` | yes | string[] | can be empty |
| `reason` | yes | string | user/debug visible reason |

Example SSE DTO:

```json
{
  "event": "effect.succeeded",
  "data": {
    "eventId": "sse_event_001",
    "sessionId": "session_demo_001",
    "correlationId": "corr_session_flow_001",
    "occurredAt": "2026-05-04T07:02:00.000Z",
    "effectTaskId": "effect_research_001",
    "effectType": "research_evidence_effect",
    "outputRef": { "kind": "EvidenceMatrix", "id": "evidence_matrix_001" },
    "projectionHint": {
      "projectionKind": "ResearchEvidenceProjection",
      "version": 8,
      "refetchUrl": "/api/v1/sessions/session_demo_001/research",
      "affectedIds": ["research_task_001"],
      "reason": "research evidence effect completed"
    }
  }
}
```

## UI Projection/ViewModel types

All projections are read models. React must not reconstruct them from raw tables or raw event streams.

### Projection common fields

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `projectionKind` | yes | enum | projection type discriminant |
| `projectId` | yes | `ProjectId` | project scope |
| `sessionId` | yes | `SessionId` | session scope |
| `version` | yes | `ProjectionVersion` | monotonic per projection kind |
| `generatedAt` | yes | ISO datetime | projection freshness |
| `stale` | yes | boolean | true when refetch recommended |
| `refetchUrl` | yes | string | sidecar endpoint |
| `pendingEffectSummary` | yes | `PendingEffectSummaryDto` | empty summary allowed |

Phase 1.5A PR-01 implementation note:

- `ResearchAllowlistProjection` is introduced first as the project-level allowlist read model because allowlist approval is project-scoped, not session-scoped.
- Before #28 exposes allowlist governance/refetch routes to React, the sidecar route DTO must wrap or enrich this project-level read model with the common route/view envelope fields above instead of special-casing a half-projection response.

### 1급 projection list

| Projection | File | Primary UI |
| --- | --- | --- |
| `SessionShellProjection` | `projections/session-shell.ts` | app shell/session header |
| `DecisionQueueProjection` | `projections/decision-queue.ts` | Decision Queue Center |
| `LivingSpecProjection` | `projections/living-spec.ts` | Living Spec Canvas |
| `ResearchAllowlistProjection` | `projections/research-allowlist.ts` | research allowlist governance/readiness |
| `ResearchDisclosureLogProjection` | `projections/research-disclosure-log.ts` | Activity Feed / disclosure audit |
| `ResearchRunProjection` | `projections/research-run.ts` | BackgroundResearchRun lifecycle/provider reference |
| `ResearchEvidenceProjection` | `projections/research-evidence.ts` | Research Results/Evidence Matrix |
| `ConfidenceCompletionProjection` | `projections/confidence-completion.ts` | progress/radar/risk cards |
| `RuntimeActivityProjection` | `projections/runtime-activity.ts` | background task board/activity feed |
| `FounderBriefProjection` | `projections/founder-brief.ts` | if-stop-now/founder brief export |

### Projection minimum fields

| Projection | Required domain fields |
| --- | --- |
| `SessionShellProjection` | project summary, session phase, readiness, active lanes, global pending effects |
| `DecisionQueueProjection` | active, next, blocked, deferred queue item arrays, active batch id, priority reasons |
| `LivingSpecProjection` | spec sections, current draft/version ref, pending spec update previews, approval status |
| `ResearchAllowlistProjection` | status, connector ids, source categories, context mode, rate/budget policy including per-session run cap, staleness/disclosure policies, pause/revoke timestamps |
| `ResearchDisclosureLogProjection` | connector/source category, objective summary, exact public-safe summary sent/prepared, source refs, automatic-vs-manual handoff status |
| `ResearchRunProjection` | status state machine, provider-neutral reference, attempt/idempotency key, source category, disclosure log ref, quality gate status, terminal reason |
| `ResearchEvidenceProjection` | research tasks, manual handoff prompts, evidence matrix summary, decision evidence packs, pro/con balance, review cards |
| `ConfidenceCompletionProjection` | five-axis scores, radar data, composite completeness, top risk cards, score history |
| `RuntimeActivityProjection` | effect tasks, Codex runtime status, runtime artifacts, retry/blocked cards, activity feed |
| `FounderBriefProjection` | if-stop-now artifact, brief draft sections, export readiness, known risks, next validation actions |

Example DecisionQueueProjection:

```json
{
  "projectionKind": "DecisionQueueProjection",
  "projectId": "project_demo_001",
  "sessionId": "session_demo_001",
  "version": 19,
  "generatedAt": "2026-05-04T07:03:00.000Z",
  "stale": false,
  "refetchUrl": "/api/v1/sessions/session_demo_001/queue",
  "pendingEffectSummary": {
    "totalPending": 1,
    "byType": { "queue_projection_effect": 1 },
    "visibleLabel": "큐 재계산 중"
  },
  "activeBatchId": "batch_001",
  "active": [
    {
      "queueItemId": "queue_item_001",
      "kind": "question",
      "title": "고객 세그먼트 질문",
      "priorityScore": 0.91,
      "status": "active",
      "topicKey": "customer_segment"
    }
  ],
  "next": [],
  "blocked": [],
  "deferred": []
}
```

## Codex contract re-export

`packages/contracts/src/codex/reexports.ts` exposes app-internal enums and DTO aliases that mirror `24-codex-prompt-output-contract.md`.

| Re-export | Source document | Notes |
| --- | --- | --- |
| `CodexTurnPurpose` | 24번 TurnPurpose taxonomy | 6 values only |
| `CodexArtifactKind` | 24번 artifact taxonomy | 7 values only |
| `CodexApplyPolicy` | 24번 applyPolicy enum | 6 values only |
| `BlockedActionType` | 24번 blocked action taxonomy | Phase 1 blocked, Phase 1.5B hint only |
| `CodexOutputEnvelopeRef` | 24번 output envelope | reference type for runtime artifacts, not raw Codex client type |
| `Phase15bUpgradeHints` | 30번 Phase 1.5B readiness contract | structured approval/sandbox/rollback/evidence/risk/sourceRef metadata; not execution permission |

Rules:

- 24번과 25번 enum values must match exactly.
- `codex/reexports.ts` must not import generated Codex app-server runtime client modules directly.
- Runtime adapter may map generated Codex schema into these app-internal DTOs.

## Phase 1.5 DTO checklist

Phase 1.5 DTO 구현자는 `30-phase1.5-research-runtime-and-readiness-contract.md`를 canonical source로 사용한다.

- `ResearchAllowlistProjection` is implemented first for Phase 1.5A PR-01; `ResearchDisclosureLogProjection` is implemented in Phase 1.5A PR-03 before provider execution; `ResearchRunProjection` is implemented in Phase 1.5A PR-04 for lifecycle/provider-reference storage; Phase 1.5A PR-05 adds `StartResearchRunRequest`, `CancelResearchRunRequest`, `RetryResearchRunRequest`, `ResearchRunControlProjection`, `ResearchRunControlResult`, and `ResearchRunStatusDto` for run control/status/refetch recovery; Phase 1.5A PR-06 adds quality-gate checks and `DecisionEvidencePackProjection` records without auto-updating SpecVersion; Phase 1.5A PR-07 adds Research-updated Queue card types/outcomes and `ResolveResearchQueueCardRequest`; Phase 1.5B PR-09 adds structured `Phase15bUpgradeHints` contracts and local hint records.
- Phase15bUpgradeHints must expose approval requirements, sandbox/workspace requirements, rollback/reference plan, expected evidence, risk normalization, and sourceRefs.
- DTOs must preserve no-execution semantics; no field should imply active delegation or executed side effects in Phase 1.5B.
- `packages/contracts` still must not import runtime clients, Hono, Drizzle, React, or Tauri modules.

### Phase 1.5A PR-06 research quality gate

- `ImportResearchResultRequest` may carry `researchRunId`, `sourceReliability`, `sourcePublishedAt`, `sourceRetrievedAt`, `claim`, `decisionContext`, `specSectionRef`, `questionRef`, `implicationScope`, `limitationNotes`, and stale-sensitivity metadata such as `staleSensitive`/`sourceRequiredAfter`.
- `DecisionEvidencePackProjection` is the durable ledger for the source metadata, pro/con balance, limitation coverage, staleness, and decision implication checks used to classify imported/synthesized research.
- Gate status values are `accepted`, `research_insufficient`, `stale`, and `needs_review`; `needs_review` must include a review reason and must surface as a queue/review blocker instead of silently accepting EvidenceMatrix content.
- Accepted/insufficient/stale Evidence Packs may update the linked `ResearchRunProjection` terminal quality state, but they must not mutate `SpecVersion` or create a spec update without an explicit later decision/spec-version command.

### Phase 1.5A PR-07 Research-updated Queue terminal outcomes

- Evidence Pack projection, not raw source dumps, derives Research Review, Decision Approval, Risk Acceptance, Conflict Resolution, and Follow-up Question queue card behavior.
- Research-updated Queue terminal outcomes are `approved`, `revised`, `rejected`, `deferred`, `risk_accepted`, and `research_insufficient`.
- `ResolveResearchQueueCardRequest` requires `sessionId`, `cardId`, `expectedStateVersion`, `outcome`, and a user-visible `rationale` for `deferred` or `risk_accepted`.
- High-impact research cards expose `blocksPlanning: true` until resolved; terminal `deferred` and `research_insufficient` remain visible blockers, while `risk_accepted` carries rationale into Known Risks.
- `DecisionQueueProjection` items may include `cardType`, `researchTaskId`, `evidencePackId`, `availableOutcomes`, `terminalOutcome`, `terminalRationale`, and `blocksPlanning` so UI and refetch recovery can render the same state.

## Phase 2 planned Planning Handoff DTO checklist

Phase 2 Planning Handoff 구현자는 `31-phase2-planning-handoff-contract.md`를 canonical artifact contract로 사용하고, `32-phase2-implementation-preflight-contract.md`를 exact DTO/wire shape, enum, route id, idempotency, and implementation sequencing default로 사용한다. 아래 이름은 **planned contract names**이며, 후속 product code PR이 `packages/contracts`와 `API_ROUTE_CATALOG`을 함께 갱신하기 전까지 위의 parsed Phase 1 `CommandType`, event, projection table에 추가하지 않는다.

| Planned surface | Exact planned name | Implementation note |
| --- | --- | --- |
| ProductEngine command | `CreatePlanningHandoff` | gate verdict를 계산한 뒤 final 또는 blocker artifact persistence를 요청한다. |
| API request DTO | `CreatePlanningHandoffRequest` | source snapshot refs와 optional requested scope만 담고 실행 payload를 담지 않는다. |
| UI/API projection | `PlanningHandoffProjection` | 한 session의 최신 final `PlanningHandoffArtifactDto` 또는 `PlanningHandoffBlockerArtifactDto`를 mutually exclusive current state로 반환한다. |
| Final artifact DTO | `PlanningHandoffArtifactDto` | `31`번의 `PlanningHandoffArtifact` field families를 DTO로 노출한다. |
| Blocker artifact DTO | `PlanningHandoffBlockerArtifactDto` | gate 실패, fatal blocker, queue/source incomplete 상태와 required user action을 durable artifact로 노출한다. |
| Gate verdict DTO | `PlanningHandoffGateVerdictDto` | verdict, fatal blocker classes checked, terminal outcome summary, residual risk visibility check를 담는다. |
| Task item DTO | `PlanningHandoffTaskDto` | task id/title/intent/sourceRefs/dependency/ownerRole/acceptanceEvidence/nonGoals/riskRefs를 담는다. |
| PR/issue item DTO | `PlanningHandoffPrIssuePlanItemDto` | sequence, included task ids, entry prerequisites, exit evidence, blocked-by, phase boundary를 담는다. |
| Readiness DTO | `PlanningHandoffReadinessChecklistDto` | approvals, sandbox/worktree boundary, rollback reference, expected evidence를 담는다. |
| Residual risk DTO | `PlanningHandoffResidualRiskDto` | visible residual risk, assumption, prerequisite, validation dependency, owner/follow-up trigger를 담는다. |
| ProductEngine event | `PlanningHandoffCreated` | gate 통과 후 final artifact가 persisted 되었음을 기록한다. |
| ProductEngine event | `PlanningHandoffBlocked` | gate 실패 후 blocker artifact가 persisted 되었음을 기록한다. |
| Deterministic output type | `planning_handoff_artifact` | 후속 code PR에서 final/blocker artifact materialization ref를 reducer output으로 추적한다. |
| Projection family file | `projections/planning-handoff.ts` | 후속 구현 PR에서 `PlanningHandoffProjection` export 위치로 사용한다. |

Behavior rules:

- `PlanningHandoffProjection`은 final handoff와 blocker artifact를 동시에 current final state로 표시하지 않는다.
- gate failure는 DTO/API 차원에서 단순 command rejection이 아니라 persisted `PlanningHandoffBlockerArtifactDto`와 projection으로 표현한다.
- 어떤 DTO field도 file patch, shell command, browser action, deploy, external mutation, active delegation을 실행했거나 실행할 권한을 부여한 것처럼 보이면 안 된다.
- exact field names/types/required flags for the Phase 2 DTO family are owned by `32-phase2-implementation-preflight-contract.md`.
- 후속 구현 PR에서 이 planned 이름을 closed enum/current projection list에 추가할 때는 20/21/26번 문서와 `scripts/verify-doc-contracts.mjs` 검증을 함께 갱신한다.

## Validation notes

These are not required acceptance scenarios, but they remain implementation checklist items.

| Validation note | Expected rule |
| --- | --- |
| Contract export map | root/family index files export only public contract types |
| API route command mapping | 26번 route catalog uses only this closed `CommandType` enum |
| UI Projection fixture | each of 8 projections has at least one fixture in implementation PR |
| Codex re-export compatibility | 24번 and 25번 enum values match |
| Forbidden dependency imports | contracts package imports no Hono, Drizzle, React, Tauri, Codex runtime client |

## Required acceptance scenarios

### Scenario A. Command envelope fixture

Given representative Phase 1 commands for intake, answer submission, research planning, runtime preview, decision resolution, and founder brief preparation.

When contract fixtures are validated.

Then:

- each command uses event-sourcing style `ProductEngineCommand` envelope.
- each command includes required concurrency + causation meta.
- `expectedStateVersion` is present.
- `causationId` is present and null only for root commands.
- `correlationId` ties related commands/events/effects together.
- payload shape is selected by `commandType`.

### Scenario B. CommandResponse/statusUrl lifecycle

Given a mutating API command returns `accepted`, `accepted_with_projection`, `rejected`, or `blocked`.

When frontend receives the response.

Then:

- response category is one of the closed values.
- `accepted` responses with pending effects include `statusUrl`.
- `accepted_with_projection` responses include only active-batch-safe projection.
- `rejected` responses include stable error envelope and no event/effect ids.
- `blocked` responses include user-visible blocking card or blocked artifact reference.
- polling `statusUrl` returns `StatusEndpointDto` with effects, pending summary, and projection hints.

### Scenario C. SSE DTO + refetch hint

Given command/effect/projection/runtime state changes occur.

When sidecar emits SSE events.

Then:

- emitted event names match the closed SSE union.
- effect events include `effectTaskId`, `effectType`, and terminal/error fields when applicable.
- projection events include `projectionKind`, `version`, `affectedIds`, and `refetchUrl`.
- missed SSE can be recovered by polling/refetching the projection URLs.

## Implementation checklist

- Create family folders and `index.ts` files exactly as defined in this document.
- Create TypeScript types and Zod schemas using the naming convention table.
- Keep DB row shapes in `packages/db`, not in `packages/contracts`.
- Implement command fixtures for the required acceptance scenario.
- Implement CommandResponse/statusUrl fixtures for all four response categories.
- Verify `26-api-route-behavior-catalog.md` route command mappings do not invent CommandType values.
- Implement SSE fixtures for command/effect/projection/runtime event families.
- Add UI Projection fixtures during frontend implementation, even though they are not required acceptance scenarios for this document.
- Add forbidden import checks during implementation verification.
