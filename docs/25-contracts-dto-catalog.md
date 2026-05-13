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
| `ChangeProjectPurposeMode` | user-confirmed change between business and personal project-purpose modes; records an audit reason and updates shell/planning scope without rewriting the active batch |
| `ChangeBusinessCriticIntensity` | user-confirmed business critic intensity change (`balanced`, `strong`, `investor_grade`); queues new critical pressure items as `queued_next` without replacing the active batch |
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
| `CreatePlanningHandoff` | create the deterministic Phase 2 final/blocker Planning Handoff artifact and projection without execution side effects |
| `CreatePhase25ResearchComparison` | create deterministic Phase 2.5 ResearchQualityComparisonReport quality-lift or safe-failure artifact without live browser/ChatGPT execution |
| `CreateExecutionAuthority` | create deterministic Phase 3 common `ExecutionAuthorityRecord` / `BoundedAgentOutputRecord` ledger projection; records approval and blocked preconditions without running adapters |
| `CreateChatGptBrowserDelegationRun` | create Post-Phase3 per-run `ChatGptBrowserDelegationRun` preflight record; requires data disclosure preview, redaction/export/delete boundary, user approval, browser action authority ref, policy/session verdicts, and visible fallback for blocked runs |
| `RevokeChatGptBrowserDelegationRun` | revoke the latest pending/waiting/running/importing ChatGPT delegation run, stop later browser actions, and record user-visible audit/fallback evidence |
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
| `user` | direct user action from UI |
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
| project/session intake | `StartProjectPayload`, `ChangeProjectPurposeModePayload`, `ChangeBusinessCriticIntensityPayload`, `CaptureIntakePayload` | raw idea, local privacy mode, user-confirmed `projectPurposeMode`, mode-change reason/audit metadata, explicit `businessCriticIntensity` when the business user has confirmed one, `intensity_required` while unselected, optional source note |
| spec/ambiguity | `DraftInitialSpecPayload`, `AnalyzeAmbiguityPayload` | target spec draft/version refs, analysis target refs |
| queue/answer | `ActivateQuestionBatchPayload`, `SubmitAnswerPayload`, `DeferQueueItemPayload`, `DismissQueueItemPayload` | queue item/batch ids and answer/defer/dismiss reason |
| research/evidence | `PlanResearchPayload`, `ImportResearchResultPayload`, `SynthesizeEvidencePayload` | research task/result refs, source reliability/metadata, claim/decision/spec/question refs, synthesis target |
| runtime/codex | `CreateRuntimePreviewPayload`, `ConvertRuntimeArtifactPayload` | turnPurpose/artifact id/target conversion request |
| decision/spec version | `CreateSpecUpdatePreviewPayload`, `ResolveDecisionPayload`, `CreateSpecVersionPayload` | decision/spec update refs and approval outcome |
| completion/export | `ScoreCompletenessPayload`, `PrepareFounderBriefPayload` | scoring target or founder brief draft target |
| phase2.5 artifact gate | `CreatePhase25ResearchComparisonPayload` | research question, decision context, baseline, candidate, DelegationRiskGate, rubric, trace source refs |
| ChatGPT browser delegation | `CreateChatGptBrowserDelegationRunPayload` | research task id, prompt preview ref, redaction/data-disclosure preview, policy/session verdicts, approval decision, browser action authority ref, optional result import gate, fallback, screenshot/log/audit refs |
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
| `planningHandoff` | no | `PlanningHandoffProjection` | latest Phase 2 final or blocker Planning Handoff projection emitted by `CreatePlanningHandoff` |
| `phase25ResearchComparison` | no | `Phase25ResearchComparisonProjection` | latest Phase 2.5 quality-lift or safe-failure comparison report emitted by `CreatePhase25ResearchComparison` |
| `executionAuthorityLedger` | no | `ExecutionAuthorityLedgerProjection` | latest Phase 3 common authority ledger record emitted by `CreateExecutionAuthority`; approved records remain `not_run` until adapter slices exist |
| `chatGptBrowserDelegation` | no | `ChatGptBrowserDelegationProjection` | latest Post-Phase3 ChatGPT Pro local browser delegation preflight/run record emitted by `CreateChatGptBrowserDelegationRun`; blocked runs must expose fallback |

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
| `deterministicOutputs` | yes | `ProductEngineDeterministicOutput[]` | completeness/spec/founder brief/planning handoff/Phase 2.5 comparison/Phase 3 authority deterministic material |
| `immediateProjection` | no | `ActiveBatchSafeProjection` | active-batch-safe or explicitly deterministic projection exception |

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

Closed ProductEngine event type groups:

| Group | EventType examples | Notes |
| --- | --- | --- |
| project/session | `ProjectStarted`, `ProjectPurposeModeChanged`, `BusinessCriticIntensityChanged`, `IntakeCaptured`, `SessionPhaseChanged` | shell/session state, project-purpose mode and business critic intensity audit trails |
| spec | `InitialSpecDrafted`, `SpecUpdatePreviewCreated`, `SpecVersionCreated` | Living Spec state |
| ambiguity/queue | `AmbiguityAnalyzed`, `QuestionBatchActivated`, `QueueItemDeferred`, `QueueItemDismissed` | queue and question loop |
| answer/decision | `AnswerSubmitted`, `DecisionResolved` | user decisions and answer cards |
| research/evidence | `ResearchPlanned`, `ResearchResultImported`, `EvidenceSynthesisRequested`, `EvidenceSynthesized`, `ResearchQueueCardResolved` | research/evidence closed loop; request events queue async work, synthesized events are emitted by the effect executor, and user terminal outcomes update queue/completeness projections |
| runtime | `RuntimePreviewRequested`, `RuntimeArtifactConverted` | sandbox preview only |
| completeness/export | `CompletenessScored`, `FounderBriefPrepared` | deterministic output refs |
| planning handoff | `PlanningHandoffCreated`, `PlanningHandoffBlocked` | Phase 2 final/blocker handoff artifact persistence; deterministic, no effect queue |
| phase2.5 artifact gate | `Phase25ResearchComparisonCreated`, `Phase25ResearchComparisonBlocked` | Phase 2.5 quality-lift/safe-failure comparison report persistence; deterministic, no effect queue |
| phase3 authority ledger | `ExecutionAuthorityRecorded`, `ExecutionAuthorityBlocked` | Phase 3 common authority/bounded-output ledger persistence; deterministic, no adapter execution effect queue |
| ChatGPT browser delegation | `ChatGptBrowserDelegationRunRecorded`, `ChatGptBrowserDelegationRunBlocked`, `ChatGptBrowserDelegationRunFailed`, `ChatGptBrowserDelegationRunRevoked` | Post-Phase3 per-run ChatGPT delegation run/audit/revoke/result-import gate persistence; deterministic, no hidden retry or credential/session custody |

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
| `planning_handoff_artifact` | Planning Handoff | final or blocker handoff artifact; deterministic and no execution side effects |
| `phase25_research_comparison_report` | Phase 2.5 Artifact+Gate | quality-lift or safe-failure ResearchQualityComparisonReport; deterministic and no live adapter execution |
| `execution_authority_record` | Phase 3 common ledger/authority | approved/not-run or blocked `ExecutionAuthorityRecord` plus bounded output refs; deterministic and no adapter execution |
| `chatgpt_browser_delegation_run` | Post-Phase3 ChatGPT browser delegation | pending/waiting/running/completed/blocked/failed/revoked `ChatGptBrowserDelegationRun` with policy/session/data disclosure/approval/fallback/revoke audit and result-import quality gates; deterministic and no hidden live retry |

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
| `accepted_with_projection` | active-batch-safe or explicitly deterministic projection exception applies |
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
| `deterministicOutputs` | no | `ProductEngineDeterministicOutput[]` | public reducer outputs for accepted commands, including spec update preview, Planning Handoff refs, and Phase 2.5 comparison refs |
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
| `projectionKind` | yes | enum | one of the UI/query projection kinds |
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
| `Phase15bUpgradeHintProjection` | `api/phase15b-hint-export.ts` | Phase 1.5B readiness hint query/export |
| `ResearchEvidenceProjection` | `projections/research-evidence.ts` | Research Results/Evidence Matrix |
| `ConfidenceCompletionProjection` | `projections/confidence-completion.ts` | progress/radar/risk cards |
| `RuntimeActivityProjection` | `projections/runtime-activity.ts` | background task board/activity feed |
| `FounderBriefProjection` | `projections/founder-brief.ts` | if-stop-now/founder brief export |
| `PlanningHandoffProjection` | `projections/planning-handoff.ts` | Phase 2 final/blocker Planning Handoff |
| `Phase25ResearchComparisonProjection` | `projections/phase25-research-comparison.ts` | Phase 2.5 Artifact+Gate comparison report |
| `ExecutionAuthorityLedgerProjection` | `projections/execution-authority.ts` | Phase 3 common authority ledger and blocked-precondition visibility |
| `ChatGptBrowserDelegationProjection` | `projections/chatgpt-browser-delegation.ts` | Post-Phase3 ChatGPT Pro local browser delegation run state, audit, revoke, fallback, retention, and result-import gate visibility |

### Projection minimum fields

| Projection | Required domain fields |
| --- | --- |
| `SessionShellProjection` | project summary, session phase, readiness, active lanes, global pending effects, user-facing project-purpose mode label/effect, business critic intensity selection status/label/effect when in business mode |
| `DecisionQueueProjection` | active, next, blocked, deferred queue item arrays, active batch id, priority reasons, mode effect summary, business critic intensity pressure summary, and skipped commercialization axes when personal mode applies |
| `LivingSpecProjection` | spec sections, current draft/version ref, pending spec update previews, approval status |
| `ResearchAllowlistProjection` | status, connector ids, source categories, context mode, rate/budget policy including per-session run cap, staleness/disclosure policies, pause/revoke timestamps |
| `ResearchDisclosureLogProjection` | connector/source category, objective summary, exact public-safe summary sent/prepared, source refs, automatic-vs-manual handoff status |
| `ResearchRunProjection` | status state machine, provider-neutral reference, attempt/idempotency key, source category, disclosure log ref, quality gate status, terminal reason |
| `Phase15bUpgradeHintProjection` | readiness/preview/handoff metadata records, sanitized source refs, private payload policy, no-execution semantics, export URL |
| `ResearchEvidenceProjection` | research tasks, manual handoff prompts, evidence matrix summary, decision evidence packs, pro/con balance, review cards, research tasks annotated with project-purpose mode effect |
| `ConfidenceCompletionProjection` | five-axis scores, radar data, composite completeness, top risk cards, score history, purpose-mode adjusted next-best actions, business critic intensity/pressure gates, and skipped commercialization gates |
| `RuntimeActivityProjection` | effect tasks, Codex runtime status, runtime artifacts, retry/blocked cards, activity feed |
| `FounderBriefProjection` | if-stop-now artifact, brief draft sections, export readiness, known risks, next validation actions, founder-facing project-purpose mode narrative |
| `PlanningHandoffProjection` | latest final `PlanningHandoffArtifactDto` or latest `PlanningHandoffBlockerArtifactDto`, source refs, gate verdict, build/serve/learning checklist fields on final handoff, readiness/residual-risk summary, project-purpose mode scope fields, refetch URL |
| `Phase25ResearchComparisonProjection` | latest `ResearchQualityComparisonReport`, source refs, DelegationRiskGate verdict, baseline/candidate comparison, quality-lift claim flag, safe-failure status, refetch URL |
| `ExecutionAuthorityLedgerProjection` | latest `ExecutionAuthorityRecord`, `BoundedAgentOutputRecord`, approval decision, requested scope, sandbox boundary, rollback/evidence/audit refs, blocked preconditions, summary, refetch URL |
| `ChatGptBrowserDelegationProjection` | latest `ChatGptBrowserDelegationRun`, `pending_preflight`/`waiting_for_approval`/`running`/`waiting_for_user`/`importing_result`/`completed`/`blocked`/`failed`/`revoked` status, user-visible explanation and next action, policy/session verdicts, data disclosure preview, redaction summary, browser action authority ref, result import gate, fallback state, retained screenshot/log/audit/activity-feed refs, blocked preconditions, refetch URL |

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
| `Phase15bUpgradeHintProjection` | 30번 Phase 1.5B readiness query/export contract | project-scoped sanitized query view; labels hints as readiness/preview/handoff metadata and never as execution state |
| `Phase15bUpgradeHintExportDto` | 30번 Phase 1.5B readiness query/export contract | JSON export DTO with approval/sandbox/rollback/evidence/risk/source ids and private payload/credential values omitted |

Rules:

- 24번과 25번 enum values must match exactly.
- `codex/reexports.ts` must not import generated Codex app-server runtime client modules directly.
- Runtime adapter may map generated Codex schema into these app-internal DTOs.

## Phase 1.5 DTO checklist

Phase 1.5 DTO 구현자는 `30-phase1.5-research-runtime-and-readiness-contract.md`를 canonical source로 사용한다.

- `ResearchAllowlistProjection` is implemented first for Phase 1.5A PR-01; `ResearchDisclosureLogProjection` is implemented in Phase 1.5A PR-03 before provider execution; `ResearchRunProjection` is implemented in Phase 1.5A PR-04 for lifecycle/provider-reference storage; Phase 1.5A PR-05 adds `StartResearchRunRequest`, `CancelResearchRunRequest`, `RetryResearchRunRequest`, `ResearchRunControlProjection`, `ResearchRunControlResult`, and `ResearchRunStatusDto` for run control/status/refetch recovery; Phase 1.5A PR-06 adds quality-gate checks and `DecisionEvidencePackProjection` records without auto-updating SpecVersion; Phase 1.5A PR-07 adds Research-updated Queue card types/outcomes and `ResolveResearchQueueCardRequest`; Phase 1.5B PR-09 adds structured `Phase15bUpgradeHints` contracts and local hint records; Phase 1.5B PR-10 adds `Phase15bUpgradeHintProjection` and `Phase15bUpgradeHintExportDto` for metadata-only hint query/export; Phase 1.5B PR-11 renders those query records on UI readiness/blocked-action handoff surfaces without adding execution controls; Phase 1.5B PR-12 hardens no-execution acceptance across every blocked runtime boundary and docs contract consistency.
- Phase15bUpgradeHints must expose approval requirements, sandbox/workspace requirements, rollback/reference plan, expected evidence, risk normalization, and sourceRefs.
- Phase15bUpgradeHint query/export DTOs must omit private source payloads, credential values, and sourceRef labels by default while preserving sourceRef kind/refId traceability.
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
- High-impact research cards expose `blocksPlanning: true` until resolved; terminal `deferred` and `research_insufficient` remain blockers only for fatal classes (`customer_problem_jtbd`, `success_metrics_validation`, `approval_security_execution_safety`). Non-fatal value proposition/differentiation or MVP scope/non-scope gaps must be carried into Planning Handoff residual risk, prerequisite, and validation dependency fields instead of being hidden.
- `risk_accepted` carries rationale into Known Risks and may unblock fatal classes only when the risk-acceptance source is linked to the queue card/evidence source trace.
- `DecisionQueueProjection` items may include `cardType`, `researchTaskId`, `evidencePackId`, `availableOutcomes`, `terminalOutcome`, `terminalRationale`, `blocksPlanning`, `businessCriticCategory`, `businessCriticIntensity`, `businessCriticPressureKind`, `knownRiskAccepted`, and `nextValidationAction` so UI and refetch recovery can render the same state.
- Business mode does not default `businessCriticIntensity`; until the user confirms `balanced`, `strong`, or `investor_grade`, business completion remains gated with the `상업성 검증 강도 선택 필요` label. `strong` and `investor_grade` pressure additions must enter `queued_next` and must not replace the current active batch. A founder may defer a pressure item only by carrying it as a Known Risk with a Next Validation Action.

## Phase 2 Planning Handoff DTO checklist

Phase 2 Planning Handoff 구현자는 `31-phase2-planning-handoff-contract.md`를 canonical artifact contract로 사용하고, `32-phase2-implementation-preflight-contract.md`를 exact DTO/wire shape, enum, route id, idempotency, and implementation sequencing default로 사용한다. 아래 이름은 #42에서 `packages/contracts` public contract surface와 parsed verifier table로 승격된 현재 DTO/command/event/projection names다. #43에서 ProductEngine reducer gate는 `CreatePlanningHandoff`로 연결되었고, #44에서 Drizzle persistence와 `planningHandoffRepository` normalized projection storage가 추가되었다. #45는 Hono route handler와 sidecar service read APIs를 mounted route로 연결했고, #46은 read-only `PlanningHandoffProjection` UI panel/view-model/test surface를 연결한다.

| Surface | Exact current name | Implementation note |
| --- | --- | --- |
| ProductEngine command | `CreatePlanningHandoff` | gate verdict를 계산한 뒤 final 또는 blocker artifact persistence를 요청한다. |
| API request DTO | `CreatePlanningHandoffRequest` | source snapshot refs와 optional requested scope만 담고 실행 payload를 담지 않는다. |
| UI/API projection | `PlanningHandoffProjection` | 한 session의 최신 final `PlanningHandoffArtifactDto` 또는 `PlanningHandoffBlockerArtifactDto`를 mutually exclusive current state로 반환한다. |
| Final artifact DTO | `PlanningHandoffArtifactDto` | `31`번의 `PlanningHandoffArtifact` field families를 DTO로 노출한다. |
| Blocker artifact DTO | `PlanningHandoffBlockerArtifactDto` | gate 실패, fatal blocker, queue/source incomplete 상태와 required user action을 durable artifact로 노출한다. |
| Gate verdict DTO | `PlanningHandoffGateVerdictDto` | verdict, fatal blocker classes checked, terminal outcome summary, residual risk visibility check를 담는다. |
| Task item DTO | `PlanningHandoffTaskDto` | task id/title/intent/sourceRefs/dependency/ownerRole/acceptanceEvidence/nonGoals/riskRefs를 담는다. |
| PR/issue item DTO | `PlanningHandoffPrIssuePlanItemDto` | sequence, included task ids, entry prerequisites, exit evidence, blocked-by, phase boundary를 담는다. |
| Build Slice DTO | `PlanningHandoffBuildSlicePlanDto` | smallest product slice, included capabilities, non-goals, source refs, acceptance criteria, smoke tests, validation metric, residual risk refs를 담는다. |
| Serve Checklist DTO | `PlanningHandoffServeChecklistDto` | serve target, env var presence metadata without values, privacy check, smoke checklist, rollback plan, launch note, learning metrics를 담는다. |
| Learning Loop DTO | `PlanningHandoffLearningLoopHookDto` | feedback/usage signals, interpretation frame, pivot/persevere/narrow-scope/next-slice options, next-slice and risk-update rules를 담는다. |
| Readiness DTO | `PlanningHandoffReadinessChecklistDto` | approvals, sandbox/worktree boundary, rollback reference, expected evidence를 담는다. |
| Residual risk DTO | `PlanningHandoffResidualRiskDto` | visible residual risk, assumption, prerequisite, validation dependency, owner/follow-up trigger를 담는다. |
| ProductEngine event | `PlanningHandoffCreated` | gate 통과 후 final artifact가 persisted 되었음을 기록한다. |
| ProductEngine event | `PlanningHandoffBlocked` | gate 실패 후 blocker artifact가 persisted 되었음을 기록한다. |
| Storage repository | `planningHandoffRepository` | final/blocker artifact JSON, source/task/PR-risk rows, latest-session projection recovery를 `planning_handoffs` family에 저장한다. |
| Deterministic output type | `planning_handoff_artifact` | final/blocker artifact materialization ref를 reducer output으로 추적한다. |
| Projection family file | `projections/planning-handoff.ts` | `PlanningHandoffProjection` export 위치다. |

Behavior rules:

- `PlanningHandoffProjection`은 final handoff와 blocker artifact를 동시에 current final state로 표시하지 않는다.
- UI/view-model은 final `PlanningHandoffArtifactDto`에서만 `Planning-ready` label을 사용하고, blocker artifact에서는 blocker class, required next action, residual risk, safe preview refs를 별도 report로 표시한다.
- `CreatePlanningHandoff` reducer는 source trace, queue terminal outcome, fatal blocker, risk acceptance precedence를 계산해 `PlanningHandoffCreated` 또는 `PlanningHandoffBlocked`를 accepted event로 내보내며 `effectPlan`을 비워 둔다.
- `ConvertRuntimeArtifact`는 preview note를 final `PlanningHandoffArtifact`로 승격하려는 target을 `RUNTIME_ACTION_BLOCKED`로 거부한다.
- final handoff는 `33-build-slice-serve-learning-loop.md`의 `buildSlicePlan`, `serveChecklist`, `learningLoopHook` field family를 포함하되 실행 권한이 아니라 preview/checklist/learning contract로만 해석한다.
- gate failure는 DTO/API 차원에서 단순 command rejection이 아니라 persisted `PlanningHandoffBlockerArtifactDto`와 projection으로 표현한다.
- 어떤 DTO field도 file patch, shell command, browser action, deploy, external mutation, active delegation을 실행했거나 실행할 권한을 부여한 것처럼 보이면 안 된다.
- exact field names/types/required flags for the Phase 2 DTO family are owned by `32-phase2-implementation-preflight-contract.md`.
- #42 이후 이 current 이름을 reducer/storage/API/UI 동작으로 연결할 때는 20/21/26번 문서와 `scripts/verify-doc-contracts.mjs` 검증을 함께 유지한다.


## Phase 2.5 Artifact+Gate DTO checklist

Phase 2.5 첫 product-code slice는 `34-phase2.5-browser-automation-preview-contract.md`를 canonical Artifact+Gate contract로 사용한다. 아래 이름은 `packages/contracts`, ProductEngine reducer, local persistence가 공유하는 현재 closed surface다. review UI panel, sidecar API route/client, live Playwright/BrowserUse/ChatGPT adapter, Phase 3 execution authority는 포함하지 않는다.

| Surface | Exact current name | Implementation note |
| --- | --- | --- |
| ProductEngine command | `CreatePhase25ResearchComparison` | baseline/candidate/risk gate/rubric payload를 deterministic report로 닫는다. |
| ProductEngine event | `Phase25ResearchComparisonCreated` | `allowed_for_comparative_preview`와 모든 rubric pass가 material quality lift로 저장됐음을 기록한다. |
| ProductEngine event | `Phase25ResearchComparisonBlocked` | policy/session/source/rubric 문제를 safe-failure report로 저장하고 quality lift를 claim하지 않는다. |
| Projection | `Phase25ResearchComparisonProjection` | latest `ResearchQualityComparisonReport`와 source refs, summary, refetch URL을 반환하는 read model이다. |
| Report DTO | `Phase25ResearchQualityComparisonReportDto` | `ResearchQualityComparisonReport` artifact의 closed field family다. |
| Gate DTO | `Phase25DelegationRiskGateDto` | verdict, checks, blocked reasons, fallback lane, no-execution boundary를 담는다. |
| Adapter port | `Phase25ResearchCandidateAdapterPort` | future adapter interface only; live adapter implementation은 후속 phase다. |
| Storage repository | `phase25ResearchComparisonRepository` | `phase25_research_comparisons`와 trace source rows에 artifact JSON과 query columns를 저장한다. |
| Deterministic output type | `phase25_research_comparison_report` | reducer output에서 quality-lift/safe-failure report ref를 추적한다. |

Behavior rules:

- `quality_lift_ready`는 `allowed_for_comparative_preview`, source trace, pro/con/uncertainty, decision impact, all-rubric-pass를 모두 요구한다.
- pro-only, source-dump, untraceable candidate output은 valid quality lift가 아니며 safe failure 또는 validation error로 수렴한다.
- `safe_failure_blocked`는 `qualityLiftClaimed=false`와 `safe_failure_no_lift`를 유지해야 한다.
- `DelegationRiskGate`는 exact no-execution boundary와 canonical check별 1개 row만 허용하며, rubric도 canonical quality dimension별 1개 score만 허용한다.
- `fallback_required` gate는 `manual_prompt_handoff` 또는 `official_codex_fallback` 중 하나를 explicit `fallbackLane`으로 가져야 한다.
- source refs의 `required`/`stale` metadata는 boolean으로 명시해야 하며, 누락 또는 string coercion은 validation error다.
- 어떤 DTO, repository row, adapter port도 submit/write, credential custody, hidden browser action, live adapter execution을 수행하거나 권한으로 표현하지 않는다.

## Phase 3 Execution Authority DTO checklist

Phase 3 PR-01은 `36-phase3-controlled-execution-contract.md`의 common ledger/authority slice를 code surface로 승격했고, PR-02(#93)는 same ledger를 local route/preflight API boundary로 노출한다. PR-03(#94)는 `file_diff` adapter route/DTO/result를 추가했고, PR-04(#95)는 `shell_command` adapter route/DTO/result를 same ledger approval/evidence/audit boundary에 연결한다. PR-05(#96)는 `browser_action` adapter route/DTO/result를 same ledger approval/reset/screenshot/log/evidence/audit boundary에 연결한다. PR-06(#97) closeout은 `38-phase3-closeout-evidence.md`, `PHASE3_CLOSEOUT_EVIDENCE`, and `PHASE3_CLOSEOUT_DRY_RUN_EVIDENCE_MAP`로 DTO/route/evidence guardrail을 재검증한다.

| Surface | Exact current name | Implementation note |
| --- | --- | --- |
| ProductEngine command | `CreateExecutionAuthority` | `BoundedAgentOutputRecord`, preview hash, requested scope, approval decision, sandbox/rollback/evidence/audit refs를 deterministic record로 닫는다. |
| ProductEngine event | `ExecutionAuthorityRecorded` | approval is `approved`, preview hash/rollback/sandbox preconditions pass, and execution result remains `not_run`; no adapter effect is queued. |
| ProductEngine event | `ExecutionAuthorityBlocked` | missing source/preview/approval/rollback, preview hash mismatch, credential requirement, sandbox failure, rejected/revoked/expired approval을 blocked ledger record로 저장한다. |
| Projection | `ExecutionAuthorityLedgerProjection` | latest authority record, same-ledger bounded output, blocked preconditions, summary, and refetch URL을 반환한다. `currentStatus`는 `preview_only`, `ready_for_execution`, `running`, `blocked`, `closed`로 닫혀 있으며 `blockedPreconditions`는 latest blocked record의 `blockReasons`와 일치해야 한다. |
| Request DTO | `CreateExecutionAuthorityRequest` | local route body for `CreateExecutionAuthority`; requires session/body match and `idempotencyKey` before command construction. |
| Request DTO | `ValidateExecutionAuthorityPreflightRequest` | adapter preflight body with authority id from route, idempotency key, action class, exact preview hash, requestedAt, and optional approvalExpiresAt. |
| Result DTO | `ExecutionAuthorityPreflightResult` | returns `ready_for_execution` or `blocked` without adapter execution; blocked reasons cover missing authority, action mismatch, hash mismatch, expiry, rollback, evidence, and audit gaps. |
| Request DTO | `ExecuteFileDiffRequest` | `file_diff` route body with session id, idempotency key, exact preview hash, requestedAt/optional expiry, approved workspace root, and exact unified diff body. |
| Result DTO | `FileDiffExecutionResult` | completed/blocked/failed/partial adapter result with changed files, diff stats, rollback ref, evidence refs, audit refs, and execution authority refetch URL. |
| Request DTO | `ExecuteShellCommandRequest` | `shell_command` route body with session id, idempotency key, exact preview hash, requestedAt/optional expiry, approved workspace root, argv-style command, and optional relative working directory. |
| Result DTO | `ShellCommandExecutionResult` | completed/blocked/failed/partial adapter result with command class, timeout, exit code, duration, redacted stdout/stderr summaries, rollback ref, evidence refs, audit refs, and execution authority refetch URL. |
| Request DTO | `ExecuteBrowserActionRequest` | `browser_action` route body with session id, idempotency key, exact preview hash, requestedAt/optional expiry, loopback target URL, and `BrowserActionPreviewDto`. |
| Request DTO | `BrowserActionPreviewDto` | visible `navigate_and_capture` preview metadata; credential/session custody and external mutation attempts are represented so the adapter can return blocked evidence instead of hiding them. |
| Result DTO | `BrowserActionExecutionResult` | completed/blocked/failed/partial adapter result with target URL/origin/port, HTTP status, duration, screenshot refs, log refs, rollback ref, evidence refs, audit refs, and execution authority refetch URL. |
| Record DTO | `ExecutionAuthorityRecord` | `actionClass`, `approvalDecision`, explicit-boundary `requestedScope`, `sandboxBoundary`, `rollbackReference`, `executionResult`, `evidenceRefs`, `auditRefs` closed field family다. |
| Bounded output DTO | `BoundedAgentOutputRecord` | source/evidence/approval-linked agent output only; unlinked output is suggestion/preview, not execution authority. |
| Storage repository | `executionAuthorityRepository` | `execution_authority_records`와 `bounded_agent_output_records`에 query columns plus JSON refs를 저장하고, `file_diff`/`shell_command`/`browser_action` terminal outcome을 같은 authority row에 evidence/audit refs로 갱신한다. |

Closeout DTO invariant:

- `ExecutionAuthorityLedgerProjection.ready_for_execution`은 approved/non-expired/exact-hash/rollback/evidence/audit-ready authority에만 붙는다.
- `FileDiffExecutionResult`, `ShellCommandExecutionResult`, `BrowserActionExecutionResult`는 `completed`, `blocked`, `failed`, `partial` terminal outcome 중 하나와 evidence/audit refs를 반환해야 하며, unauthorized execution이나 missing Phase 3 authority를 success로 바꾸지 않는다.
- Credential custody, destructive shell command, external-production mutation, hosted SaaS default, browser-only DB rewrite, and blanket approval remain blocked or non-goal boundaries.
| Deterministic output type | `execution_authority_record` | reducer output에서 authority record ref와 blocked-precondition evidence를 추적한다. |

Behavior rules:

- `approvalDecision` lifecycle is closed to `pending`, `approved`, `rejected`, `revoked`, and `expired`.
- `executionResult` lifecycle is closed to `not_run`, `running`, `blocked`, `completed`, `failed`, and `partial`, but this slice only creates `not_run` or `blocked`.
- `approved` authority still does not execute an adapter; it only proves that future adapter slices may look up an unexpired approved record. `external_mutation_preview_only` uses `currentStatus=preview_only` so it is visible but not executable.
- missing planning source, missing preview, preview hash mismatch, missing approval, expired/rejected/revoked approval, missing rollback, credential value requirement, and sandbox failure must persist as `blocked` evidence/audit refs.
- DTOs and projections must not contain credential values, session cookies, API key values, or raw secret values.

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
- `accepted_with_projection` responses include only active-batch-safe or explicitly deterministic projections.
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
