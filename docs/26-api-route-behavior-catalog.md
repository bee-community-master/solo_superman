# 26. API Route Behavior Catalog

## 목적

이 문서는 Phase 1 구현자가 Hono route handler, API client, contract test를 만들 때 endpoint별 request, ProductEngine command/query mapping, response category, statusUrl, SSE/refetch, error/precondition을 즉석에서 결정하지 않도록 고정한다.

Canonical path: `docs/26-api-route-behavior-catalog.md`.

`21-sidecar-api-runtime-contract.md`가 sidecar runtime boundary와 route group을 정의하고, `25-contracts-dto-catalog.md`가 public DTO/type shape를 정의한다면, 이 문서는 **endpoint별 API behavior**를 소유한다.

이 문서는 API route behavior의 기준 계약이다. Hono handler, Zod schema file, generated OpenAPI, runtime code, React 화면 상태, DB migration은 각 구현 PR과 현재 코드베이스가 소유하며, 이 문서는 endpoint별 command/query/status/SSE/error behavior를 정의한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Canonical source | Phase 1 endpoint별 API behavior는 이 문서가 소유 |
| Coverage | `21-sidecar-api-runtime-contract.md`의 전체 Phase 1 endpoint |
| Row detail | request, command/query mapping, response/statusUrl, effects/SSE/refetch, errors/preconditions |
| Command naming | `25-contracts-dto-catalog.md`의 closed `CommandType`에 맞춰 정규화 |
| DTO fields | 재정의하지 않고 `25-contracts-dto-catalog.md`를 참조 |
| DB row/DDL | 제외. `20-data-storage-contract.md`가 소유 |
| React state/layout | 제외. 02/13/25번 문서가 소유 |
| Runtime/code implementation | 제외. 구현 PR에서 수행 |
| Required acceptance | endpoint coverage matrix, SSE/refetch recovery, error/precondition guardrails, representative operations incident dry-runs, docs cross-reference consistency |

## Ownership boundaries

26번 문서는 다음을 소유한다.

- endpoint별 method/path/auth requirement.
- endpoint별 params/query/body DTO reference.
- endpoint별 ProductEngine `commandType` 또는 read-only query/application action 구분.
- endpoint별 response category and projection return rule.
- endpoint별 `statusUrl` 필요 여부.
- endpoint별 effect task, SSE event, refetch hint expectation.
- endpoint별 representative error/precondition/idempotency rule.

26번 문서는 다음을 소유하지 않는다.

- DTO field table, Zod schema implementation, generated OpenAPI file.
- Drizzle table, SQL migration, repository row shape.
- React component state, layout, microcopy, client store implementation.
- Codex prompt/output artifact schema.
- Hono handler code or runtime adapter code.

## Command naming normalization

`normalize_routes_to_25_command_enum` is binding for Phase 1.

Rules:

- `commandType` must be one of the closed `CommandType` values in `25-contracts-dto-catalog.md`.
- Route action labels are not allowed to become new `CommandType` values unless 25번 is updated first.
- Answer routing is ProductEngine behavior after `SubmitAnswer`; it is not a separate command.
- Spec update suggestion is represented by `CreateSpecUpdatePreview`.
- Completion candidate calculation is represented by `ScoreCompleteness`.
- Founder Brief draft/export metadata is represented by `PrepareFounderBrief`.
- Decision card creation from an existing preview is an application action unless it is part of `CreateSpecUpdatePreview` or `ResolveDecision`.
- Unsupported file/shell/browser/network/credential/destructive requests are represented as blocked runtime artifacts or blocked command responses, never as executable commands in Phase 1.

## Endpoint row contract

Every endpoint row in this document uses the following five information groups.

| Group | Required content |
| --- | --- |
| Request contract | auth, params, query, body DTO ref, validation rule |
| Command/query mapping | `commandType` or query/application action, payload source, `expectedStateVersion` source |
| Response/statusUrl contract | response envelope/category, returned projection, `statusUrl` rule |
| Effects/SSE/refetch | effect task types, SSE events, projection refetch URLs |
| Errors/preconditions | representative error codes, domain preconditions, idempotency rule |

Common response rules:

- Read-only endpoints return `ApiSuccessEnvelope<T>` or `ApiErrorEnvelope`.
- ProductEngine mutating endpoints return `CommandResponse` inside the success envelope when a command is accepted.
- Application actions that do not issue a `ProductEngineCommand` must be explicitly marked `commandType: none` unless docs/25 defines a project-level application `CommandType` for that route family.
- `statusUrl` is required when async effects are pending.
- `accepted_with_projection` is allowed only for active-batch-safe or explicitly deterministic projections.
- `blocked` is required for forbidden runtime execution attempts.

Common error codes:

| Error code | Use |
| --- | --- |
| `AUTH_REQUIRED` | missing or invalid local capability token |
| `VALIDATION_FAILED` | params/query/body schema invalid |
| `RESOURCE_NOT_FOUND` | project/session/question/decision/artifact not found |
| `STATE_VERSION_CONFLICT` | `expectedStateVersion` does not match loaded snapshot |
| `COMMAND_PRECONDITION_FAILED` | command is valid JSON but invalid for current domain state |
| `IDEMPOTENCY_CONFLICT` | same idempotency key with incompatible payload |
| `RUNTIME_UNAVAILABLE` | Codex app-server/runtime preview path unavailable |
| `RUNTIME_ACTION_BLOCKED` | file/shell/browser/network/credential/destructive action requested |
| `EFFECT_STATUS_UNAVAILABLE` | command/effect status cannot be loaded |
| `SIDECAR_NOT_READY` | DB migration/runtime readiness not established |
| `STREAM_SESSION_REQUIRED` | SSE stream opened without valid session scope |

## Health endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `GET /healthz` | Auth: none. No params/query/body. | `commandType: none`; process liveness query. | Health payload, not `CommandResponse`; no `statusUrl`. | No effect, no SSE. | Must not require DB. Returns process alive even when DB is not ready. |
| `GET /readyz` | Auth: none. No params/query/body. | `commandType: none`; readiness query for DB migration, ProductEngine initialization, runtime status probe. | Readiness payload, not `CommandResponse`; no `statusUrl`. | No effect, no SSE. | Can report `SIDECAR_NOT_READY` state without throwing raw Hono errors. |

## Project and session endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/projects` | Auth required. Body DTO: `StartProjectRequest`. Body carries raw idea, local privacy mode, optional source note. | `commandType: StartProject`. Payload from body. `expectedStateVersion: 0`. `causationId: null`. | `accepted_with_projection` with project overview and `SessionShellProjection`; no `statusUrl` unless implementation queues follow-up effects. | Emits `command.accepted`, may emit `projection.updated` for `SessionShellProjection`. Refetch `/api/v1/projects/:projectId` and `/api/v1/projects/:projectId/sessions/:sessionId`. | `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`. Root command idempotency key is based on raw idea hash plus privacy mode. |
| `GET /api/v1/projects` | Auth required. Optional pagination query. No body. | `commandType: none`; project list query. | `ApiSuccessEnvelope<ProjectSummary[]>`; no `statusUrl`. | No effect. Refetch self URL after project creation. | `AUTH_REQUIRED`, `VALIDATION_FAILED`. |
| `GET /api/v1/projects/:projectId` | Auth required. Param: `projectId`. No body. | `commandType: none`; project detail query. | `ApiSuccessEnvelope<ProjectOverviewProjection>`; no `statusUrl`. | No effect. Refetch after `StartProject` or session metadata changes. | `RESOURCE_NOT_FOUND` if project missing. |
| `GET /api/v1/projects/:projectId/research-allowlists` | Auth required. Param: `projectId`. No body. | `commandType: none`; project-scoped allowlist governance query. | `ApiSuccessEnvelope<ResearchAllowlistGovernanceProjection>`; no `statusUrl`. Response includes `refetchUrl` and allowlist automatic-run policy summary. | No effect. Refetch after allowlist create/update/pause/revoke commands. | `RESOURCE_NOT_FOUND` if project missing. |
| `POST /api/v1/projects/:projectId/research-allowlists` | Auth required. Param: `projectId`. Body DTO: `CreateResearchAllowlistRequest`. | `commandType: CreateResearchAllowlist`; project-level application command persisted by allowlist governance, not ProductEngine reducer events. | `accepted_with_projection` with `ResearchAllowlistGovernanceProjection`; no async `statusUrl` because persistence is immediate. Response includes refetch hints for `/api/v1/projects/:projectId/research-allowlists`. | Emits no ProductEngine reducer effect. Refetch allowlist route. | `RESOURCE_NOT_FOUND` if project missing, `VALIDATION_FAILED` for project mismatch or unsupported source category, `COMMAND_PRECONDITION_FAILED` for duplicate allowlist id. |
| `POST /api/v1/projects/:projectId/research-allowlists/:allowlistId` | Auth required. Params: `projectId`, `allowlistId`. Body DTO: `UpdateResearchAllowlistRequest`. | `commandType: UpdateResearchAllowlist`; project-level application command. | `accepted_with_projection` with updated allowlist governance projection; no async `statusUrl`. Response includes refetch hints. | Emits no ProductEngine reducer effect. Refetch allowlist route. | `RESOURCE_NOT_FOUND` if project/allowlist missing, `VALIDATION_FAILED` for route/body mismatch, empty update body, unsupported source category, or missing `approvedBy` on policy/activation updates, `COMMAND_PRECONDITION_FAILED` if allowlist is revoked or update attempts pause/revoke instead of dedicated endpoint. |
| `POST /api/v1/projects/:projectId/research-allowlists/:allowlistId/pause` | Auth required. Params: `projectId`, `allowlistId`. Body DTO: `PauseResearchAllowlistRequest`. | `commandType: PauseResearchAllowlist`; project-level application command. | `accepted_with_projection` with paused allowlist and automatic-run blocked policy; no async `statusUrl`. Response includes refetch hints. | Emits no ProductEngine reducer effect. Refetch allowlist route. | `RESOURCE_NOT_FOUND` if project/allowlist missing, `VALIDATION_FAILED` for route/body mismatch, `COMMAND_PRECONDITION_FAILED` if allowlist is revoked. |
| `POST /api/v1/projects/:projectId/research-allowlists/:allowlistId/revoke` | Auth required. Params: `projectId`, `allowlistId`. Body DTO: `RevokeResearchAllowlistRequest`. | `commandType: RevokeResearchAllowlist`; project-level application command. | `accepted_with_projection` with revoked allowlist and automatic-run blocked policy; no async `statusUrl`. Response includes refetch hints. | Emits no ProductEngine reducer effect. Refetch allowlist route. | `RESOURCE_NOT_FOUND` if project/allowlist missing, `VALIDATION_FAILED` for route/body mismatch. Revoked state is terminal and blocks future automatic run starts. |
| `POST /api/v1/projects/:projectId/research-disclosures` | Auth required. Param: `projectId`. Body DTO: `PrepareResearchDisclosureRequest`. | `commandType: PrepareResearchDisclosure`; project-level application command. | `accepted_with_projection` when an active allowlist permits a public-safe payload; `blocked` with manual handoff details when source/context/allowlist policy blocks automatic transfer. No async `statusUrl`. | Emits no ProductEngine reducer effect and no provider execution. Persists `ResearchDisclosureLogProjection`; refetch `/api/v1/projects/:projectId/research-disclosures`. | `RESOURCE_NOT_FOUND` if project is missing, `VALIDATION_FAILED` for route/body mismatch or unsupported source category. Private/full/credentialed context returns blocked manual handoff, not automatic run. |
| `GET /api/v1/projects/:projectId/research-disclosures` | Auth required. Param: `projectId`. No body. | `commandType: none`; project-scoped disclosure/audit query. | `ApiSuccessEnvelope<ResearchDisclosureLogProjection>`; no `statusUrl`. Response includes disclosure refetch URL and latest disclosure log. | No effect. Refetch after disclosure preparation or blocked automatic route logging. | `RESOURCE_NOT_FOUND` if project missing. |
| `POST /api/v1/projects/:projectId/sessions` | Auth required. Param: `projectId`. Body DTO: `StartOrResumeSessionRequest`. | `commandType: none` for Phase 1; application action creates or resumes local session shell metadata only. Product state transition requires a future 25번 CommandType update. | `ApiSuccessEnvelope<SessionShellProjection>`; no command `statusUrl`. | Emits `projection.updated` for `SessionShellProjection` if a shell row is created. Refetch session URL. | `RESOURCE_NOT_FOUND`, `COMMAND_PRECONDITION_FAILED` if multiple-session creation would alter product state beyond shell metadata. |
| `GET /api/v1/projects/:projectId/sessions/:sessionId` | Auth required. Params: `projectId`, `sessionId`. No body. | `commandType: none`; session shell query. | `ApiSuccessEnvelope<SessionShellProjection>`; no `statusUrl`. | No effect. Refetch after session/project/projection events. | `RESOURCE_NOT_FOUND` if project/session mismatch. |

## Intake and spec endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/sessions/:sessionId/intake` | Auth required. Param: `sessionId`. Body DTO: `CaptureIntakeRequest`. | `commandType: CaptureIntake`. Payload from normalized intake body. `expectedStateVersion` from client projection. | `accepted` or `accepted_with_projection` with normalized intake/activity; `statusUrl` only if effects are queued. | Emits `command.accepted`, `projection.updated` for `SessionShellProjection` or `LivingSpecProjection`. | `STATE_VERSION_CONFLICT`, `VALIDATION_FAILED`, `COMMAND_PRECONDITION_FAILED` if intake already locked without explicit overwrite path. |
| `POST /api/v1/sessions/:sessionId/spec/initial` | Auth required. Body DTO: `DraftInitialSpecRequest`. | `commandType: DraftInitialSpec`. Payload points to intake refs. | `accepted_with_projection` with `LivingSpecProjection`; no async output required. | Emits `command.accepted`, `projection.updated` for `LivingSpecProjection`. | `COMMAND_PRECONDITION_FAILED` when intake is missing. Idempotency by session + intake hash. |
| `GET /api/v1/sessions/:sessionId/spec` | Auth required. Param: `sessionId`. No body. | `commandType: none`; current spec query. | `ApiSuccessEnvelope<LivingSpecProjection>`; no `statusUrl`. | No effect. Refetch after spec draft, spec update preview, or spec version events. | `RESOURCE_NOT_FOUND` if session missing. |
| `POST /api/v1/sessions/:sessionId/spec/analyze` | Auth required. Body DTO: `AnalyzeAmbiguityRequest`. | `commandType: AnalyzeAmbiguity`. Payload selects spec/issue target refs. | `accepted_with_projection` when ambiguity/queue summary can be returned immediately; `statusUrl` required if queue projection effect is queued. | May queue `queue_projection_effect`. Emits `effect.queued`, `projection.updated` for `DecisionQueueProjection` and `ConfidenceCompletionProjection`. Refetch queue and confidence URLs. | `COMMAND_PRECONDITION_FAILED` when initial spec missing; `STATE_VERSION_CONFLICT` on stale projection. |
| `GET /api/v1/sessions/:sessionId/spec/versions` | Auth required. Optional pagination query. | `commandType: none`; spec version list query. | `ApiSuccessEnvelope<SpecVersionSummary[]>`; no `statusUrl`. | No effect. Refetch after `CreateSpecVersion`. | `RESOURCE_NOT_FOUND` if session missing. |

## Queue and answer endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/sessions/:sessionId/queue` | Auth required. Param: `sessionId`. No body. | `commandType: none`; queue projection query. | `ApiSuccessEnvelope<DecisionQueueProjection>`; no `statusUrl`. | No effect. Refetch after queue projection SSE. | `RESOURCE_NOT_FOUND` if session missing. |
| `POST /api/v1/sessions/:sessionId/queue/activate` | Auth required. Body DTO: `ActivateQuestionBatchRequest`. | `commandType: ActivateQuestionBatch`. Payload from candidate batch/queue refs. | `accepted_with_projection` with active-batch-safe `DecisionQueueProjection`; `statusUrl` required if deeper queue recalculation is queued. | Queues `queue_projection_effect`. Emits `effect.queued`, `projection.updated`. Refetch queue URL. | `COMMAND_PRECONDITION_FAILED` if no eligible batch or active batch cannot be replaced. |
| `POST /api/v1/questions/:questionId/answers` | Auth required. Param: `questionId`. Body DTO: `SubmitAnswerRequest`. | `commandType: SubmitAnswer`. Answer routing is reducer behavior inside this command, not a separate command. | `accepted_with_projection` updates active card state; `statusUrl` required when research or queue effects are queued. | May queue `research_evidence_effect` and `queue_projection_effect`. Emits `command.accepted`, effect events, and projection updates for queue/research/confidence. | `RESOURCE_NOT_FOUND`, `COMMAND_PRECONDITION_FAILED` if question is not active, `STATE_VERSION_CONFLICT`, invalid answer shape. Idempotency by question id + answer hash. |
| `POST /api/v1/queue-items/:queueItemId/defer` | Auth required. Param: `queueItemId`. Body DTO: `DeferQueueItemRequest`. | `commandType: DeferQueueItem`. Payload from defer reason and until/refocus metadata. | `accepted_with_projection` with `DecisionQueueProjection`; `statusUrl` if queue recalculation is async. | May queue `queue_projection_effect`; emits queue projection update. | `COMMAND_PRECONDITION_FAILED` if item is terminal/resolved or defer would hide high-severity blocker. |
| `POST /api/v1/queue-items/:queueItemId/dismiss` | Auth required. Param: `queueItemId`. Body DTO: `DismissQueueItemRequest`. | `commandType: DismissQueueItem`. Payload from dismiss reason. | `accepted_with_projection` with `DecisionQueueProjection`; `statusUrl` if queue recalculation is async. | May queue `queue_projection_effect`; emits queue projection update. | `COMMAND_PRECONDITION_FAILED` if item is required by high-severity gate or already terminal. |

## Research and evidence endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/sessions/:sessionId/research-tasks` | Auth required. Body DTO: `PlanResearchRequest`. | `commandType: PlanResearch`. Payload from ambiguity/claim/question refs and research objective. | `accepted` with research task/activity; `statusUrl` required when `research_evidence_effect` is queued. | Queues `research_evidence_effect` when synthesis/prompt generation is needed. Emits effect events and research projection updates. | `COMMAND_PRECONDITION_FAILED` if research objective lacks linked ambiguity/claim. Idempotency by objective hash + target refs. |
| `GET /api/v1/sessions/:sessionId/research` | Auth required. Param: `sessionId`. No body. | `commandType: none`; research/evidence projection query. | `ApiSuccessEnvelope<ResearchEvidenceProjection>`; no `statusUrl`. | No effect. Refetch after research task/result/evidence SSE. | `RESOURCE_NOT_FOUND` if session missing. |
| `POST /api/v1/research-tasks/:researchTaskId/results` | Auth required. Param: `researchTaskId`. Body DTO: `ImportResearchResultRequest`. | `commandType: ImportResearchResult`. Payload includes pasted/manual result, source metadata, and limitation notes. | `accepted` with `statusUrl`; EvidenceMatrix is not returned as an immediate projection. | Queues `research_evidence_effect`; the effect executor later emits `EvidenceSynthesized` and may queue `queue_projection_effect`. Refetch research, queue, confidence after status/projection hints. | `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED` for missing source/result, `IDEMPOTENCY_CONFLICT` by task id + result hash. |
| `POST /api/v1/research-results/:researchResultId/synthesize` | Auth required. Param: `researchResultId`. Body DTO: `SynthesizeEvidenceRequest`. | `commandType: SynthesizeEvidence`. User-request payload from result ref and synthesis target emits `EvidenceSynthesisRequested`; effect executor payload emits `EvidenceSynthesized`. | User request returns `accepted` with `statusUrl`; only the effect executor persists EvidenceMatrix output. | Queues `research_evidence_effect`; executor completion may queue `queue_projection_effect`. Refetch research, queue, confidence. | `COMMAND_PRECONDITION_FAILED` if result is empty, stale, or already terminal without force option. |

## Decision and spec version endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/spec-updates` | Auth required. Body DTO: `CreateSpecUpdatePreviewRequest`. | `commandType: CreateSpecUpdatePreview`. Payload from evidence/artifact/manual edit refs. | `accepted_with_projection` with spec update preview and decision/queue card; `statusUrl` only if queue projection effect is queued. | May queue `queue_projection_effect`. Refetch living spec and decision queue. | `COMMAND_PRECONDITION_FAILED` if preview lacks evidence/decision rationale. |
| `POST /api/v1/decisions` | Auth required. Body DTO: `CreateDecisionCardRequest`. | `commandType: none` unless it wraps `CreateSpecUpdatePreview`. Application action materializes a decision card from an existing preview/deterministic output. | `ApiSuccessEnvelope<DecisionQueueProjection>` or `ApiErrorEnvelope`; no command `statusUrl` unless backed by a ProductEngine command. | Emits `projection.updated` for `DecisionQueueProjection` if card materialized. | `COMMAND_PRECONDITION_FAILED` if no source preview/output exists. Must not invent a new CommandType. |
| `POST /api/v1/decisions/:decisionId/resolve` | Auth required. Param: `decisionId`. Body DTO: `ResolveDecisionRequest`. | `commandType: ResolveDecision`. Payload from approval outcome, rationale, risk acceptance, or defer reason. | `accepted_with_projection` with decision outcome and queue/spec projection; `statusUrl` if follow-up queue effect is queued. | May queue `queue_projection_effect`. Refetch queue, spec, confidence. | `RESOURCE_NOT_FOUND`, `COMMAND_PRECONDITION_FAILED` if decision already terminal or required con evidence missing. |
| `POST /api/v1/sessions/:sessionId/spec/versions` | Auth required. Body DTO: `CreateSpecVersionRequest`. | `commandType: CreateSpecVersion`. Payload from approved spec update refs. | `accepted_with_projection` with `LivingSpecProjection` and version summary; `statusUrl` if scoring/queue projections are queued. | May queue `queue_projection_effect`; deterministic completeness output may update confidence projection. Refetch spec, versions, queue, confidence. | `COMMAND_PRECONDITION_FAILED` if approvals/evidence gates are incomplete. |

## Runtime preview endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/runtime/status` | Auth required. Optional adapter query. | `commandType: none`; runtime availability query. | `ApiSuccessEnvelope<RuntimeActivityProjection>` or adapter status DTO; no `statusUrl`. | Emits `runtime.status.changed` when status changes. Refetch runtime activity. | `RUNTIME_UNAVAILABLE` can be represented as status data, not raw exception. |
| `POST /api/v1/runtime/codex/preview` | Auth required. Body DTO: `CreateRuntimePreviewRequest`. | `commandType: CreateRuntimePreview`. Payload includes turnPurpose, context refs, artifact target, and sandbox preview policy. | `accepted` with `statusUrl` when Codex effect is queued; `blocked` if request asks for forbidden execution. | Queues `codex_runtime_preview_effect`. Emits effect lifecycle, runtime status, projection updates. Refetch runtime activity and affected artifact/projection URLs. | `RUNTIME_UNAVAILABLE`, `RUNTIME_ACTION_BLOCKED`, `VALIDATION_FAILED`, idempotency by turnPurpose + contextHash + runtimeAdapterVersion. |
| `POST /api/v1/runtime/manual-handoff` | Auth required. Body DTO: `CreateManualHandoffRequest`. | `commandType: CreateRuntimePreview` with manual handoff mode. No external runtime execution. | `accepted_with_projection` with `RuntimePreviewArtifact`/manual handoff artifact; no async `statusUrl` unless conversion effect is queued. | Emits runtime projection update. Refetch runtime activity. | `COMMAND_PRECONDITION_FAILED` if no prompt/context artifact can be produced. |
| `POST /api/v1/runtime/artifacts/:artifactId/convert` | Auth required. Param: `artifactId`. Body DTO: `ConvertRuntimeArtifactRequest`. | `commandType: ConvertRuntimeArtifact`. Payload selects conversion target: research, spec update preview, risk card, or blocked artifact. | `accepted_with_projection` for allowed conversion; `blocked` for forbidden execution conversion; `statusUrl` if research/queue effect is queued. | May queue `research_evidence_effect` or `queue_projection_effect`. Refetch runtime, research, queue, spec as hinted. | `RESOURCE_NOT_FOUND`, `RUNTIME_ACTION_BLOCKED`, `COMMAND_PRECONDITION_FAILED` if artifact applyPolicy disallows conversion. |
| `POST /api/v1/runtime/artifacts/:artifactId/block` | Auth required. Param: `artifactId`. Body DTO: `BlockRuntimeArtifactRequest`. | `commandType: ConvertRuntimeArtifact` with blocked target. | `blocked` with blocking card or blocked artifact ref; no external side effect. | Emits `effect.blocked` or `projection.updated` for runtime/queue depending on artifact state. Refetch runtime and queue. | `RESOURCE_NOT_FOUND`, `RUNTIME_ACTION_BLOCKED`. Must never execute file/shell/browser/network/credential/destructive actions. |

## Completeness and Founder Brief endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/sessions/:sessionId/completeness` | Auth required. Param: `sessionId`. No body. | `commandType: none`; latest confidence/completion projection query. | `ApiSuccessEnvelope<ConfidenceCompletionProjection>`; no `statusUrl`. | No effect. Refetch after `ScoreCompleteness` or deterministic scoring updates. | `RESOURCE_NOT_FOUND` if session missing. |
| `POST /api/v1/sessions/:sessionId/completeness/score` | Auth required. Body DTO: `ScoreCompletenessRequest`. | `commandType: ScoreCompleteness`. Payload from latest spec/evidence/decision refs. | `accepted_with_projection` with `ConfidenceCompletionProjection`; no async scoring effect. | Emits `projection.updated` for confidence/completion. Refetch confidence and queue if completion candidate changes. | `COMMAND_PRECONDITION_FAILED` if required snapshot groups are missing. |
| `POST /api/v1/sessions/:sessionId/completion-candidate` | Auth required. Body DTO: `CompletionCandidateRequest`. | `commandType: ScoreCompleteness`. Completion candidate is deterministic output of scoring, not a separate command. | `accepted_with_projection` if gates pass; `rejected` with low-confidence axes/known risks if gates fail. No `statusUrl`. | Emits confidence/queue projection updates when candidate state changes. | `COMMAND_PRECONDITION_FAILED` if all axes/gates from 07/16 are not satisfied. |
| `GET /api/v1/sessions/:sessionId/founder-brief` | Auth required. Param: `sessionId`. No body. | `commandType: none`; founder brief projection query. | `ApiSuccessEnvelope<FounderBriefProjection>`; no `statusUrl`. | No effect. Refetch after `PrepareFounderBrief`. | `RESOURCE_NOT_FOUND` if session missing. |
| `POST /api/v1/sessions/:sessionId/founder-brief/export` | Auth required. Body DTO: `PrepareFounderBriefRequest`. | `commandType: PrepareFounderBrief`. Payload requests draft/export metadata only. | `accepted_with_projection` with `FounderBriefProjection` and export metadata. File write/download side effect is not Phase 1. | Emits founder brief projection update. Refetch founder brief. | `COMMAND_PRECONDITION_FAILED` if Founder Brief sections/gates missing; `RUNTIME_ACTION_BLOCKED` if request attempts file write or external export side effect. |

## Command status, events, and activity endpoints

| Endpoint | Request contract | Command/query mapping | Response/statusUrl contract | Effects/SSE/refetch | Errors/preconditions |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/commands/:commandId/status` | Auth required. Param: `commandId`. No body. | `commandType: none`; command/effect status query. | `ApiSuccessEnvelope<StatusEndpointDto>`; this is the target of command `statusUrl`. | No effect. `projectionHints` tells frontend what to refetch. | `EFFECT_STATUS_UNAVAILABLE`, `RESOURCE_NOT_FOUND` if command id unknown. |
| `GET /api/v1/events/stream?sessionId=...` | Auth required. Query: `sessionId`. No body. | `commandType: none`; SSE stream subscription. | SSE stream, not JSON envelope after connection. No `statusUrl`. | Emits command/effect/projection/runtime/activity notifications from 21/23/25. Missed SSE recovered by statusUrl/refetch. | `STREAM_SESSION_REQUIRED`, `AUTH_REQUIRED`, `RESOURCE_NOT_FOUND`. |
| `GET /api/v1/sessions/:sessionId/activity` | Auth required. Param: `sessionId`. Optional pagination query. | `commandType: none`; activity feed query. | `ApiSuccessEnvelope<ActivityItemDto[]>`; no `statusUrl`. | No effect. Refetch after `activity.updated` or relevant command/effect events. | `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED` for invalid pagination. |

## Command response lifecycle checklist

This checklist is not a separate required acceptance scenario, but every mutating endpoint row must satisfy it. Incident-level user-visible recovery is canonical in `27-operations-observability-contract.md`.

- `accepted` rows define whether `statusUrl` is required.
- `accepted_with_projection` rows define why the immediate projection is allowed.
- `rejected` rows define at least one validation/precondition failure.
- `blocked` rows define whether the block is policy, runtime, or unsupported execution.
- Rows that can queue effects name effect types and expected projection hints.
- Rows that are application actions with `commandType: none` explain why no ProductEngine command is issued.

## Phase 1.5 route checklist

Phase 1.5 route behavior is introduced by later implementation PRs and must use `30-phase1.5-research-runtime-and-readiness-contract.md` as the canonical behavior source.

- allowlist routes must expose create/update/pause/revoke and reject unsupported source categories.
- disclosure routes must build public-safe payloads, persist `ResearchDisclosureLog`, and block private/full/credentialed context before external transfer.
- research run routes must expose start/status/cancel/retry and return statusUrl/SSE/refetch hints.
- automatic run start must block private/full/credentialed source material and route to approval/manual handoff.
- hint routes must expose query/export for `phase15bUpgradeHints` without enabling execution.
- no Phase 1.5 route may execute file/shell/browser/network write/credential/destructive/ChatGPT web automation actions.

## Phase 2 planned Planning Handoff endpoint behavior

이 섹션은 `31-phase2-planning-handoff-contract.md`의 artifact contract를 API behavior로 연결하는 planned endpoint contract다. `32-phase2-implementation-preflight-contract.md`는 이 planned endpoint를 code PR로 승격할 때의 exact routeId/clientName, response category, idempotency, GET no-handoff default를 소유한다. 아래 endpoint names는 현재 Phase 1 `API_ROUTE_CATALOG`의 route table row가 아니며, product code PR이 route catalog와 DTO/command enum을 함께 갱신할 때 실제 catalog에 추가한다.

Planned endpoint names:

- `POST /api/v1/sessions/:sessionId/planning-handoff`
  - Request DTO: `CreatePlanningHandoffRequest`.
  - Command mapping: deterministic ProductEngine command `CreatePlanningHandoff`.
  - Response: `accepted_with_projection` with `PlanningHandoffProjection`; no async `statusUrl` unless a future implementation explicitly introduces a non-execution projection effect.
  - Gate pass: persist `PlanningHandoffArtifact` and emit planned event `PlanningHandoffCreated`.
  - Gate fail: persist `PlanningHandoffBlockerArtifact` and emit planned event `PlanningHandoffBlocked`; semantic gate failure should not be represented only as command rejection when a blocker artifact can be persisted.
  - Effects/SSE/refetch: no Codex/runtime effect and no file/shell/browser/deploy/external mutation; future implementation may emit `projection.updated` for `PlanningHandoffProjection`.
  - Errors/preconditions: `RESOURCE_NOT_FOUND` for missing session/source refs, `STATE_VERSION_CONFLICT` for stale expected state, `VALIDATION_FAILED` for malformed body or unsupported requested scope. Use `COMMAND_PRECONDITION_FAILED` only when no durable blocker artifact can safely be persisted.
- `GET /api/v1/sessions/:sessionId/planning-handoff`
  - Query mapping: no ProductEngine command; read `planningHandoffProjection`.
  - Response: `ApiSuccessEnvelope<PlanningHandoffProjection | null>`; no `statusUrl`. Existing session with no handoff returns `data: null`.
  - Projection content: latest final handoff or latest blocker artifact for the session, sourceRefs, gate verdict, readiness/residual risk summary, and recovery/next-action hints.
  - Errors/preconditions: `RESOURCE_NOT_FOUND` for missing session; auth/project ownership checks match the session route family.

## Required acceptance scenarios

### Scenario A. Endpoint coverage matrix

Given `21-sidecar-api-runtime-contract.md` defines Phase 1 route groups.

When `26-api-route-behavior-catalog.md` is reviewed.

Then:

- every Phase 1 route from 21번 appears in this document.
- `GET /api/v1/commands/:commandId/status` appears because `statusUrl` in 25번 requires it.
- every endpoint row includes request contract, command/query mapping, response/statusUrl, effects/SSE/refetch, and errors/preconditions.
- ProductEngine command mappings use only 25번 closed `CommandType` values.

### Scenario B. SSE/refetch recovery

Given a command queues effects or updates projections.

When SSE is missed or reconnect occurs.

Then:

- the endpoint row names the likely SSE events.
- the row names at least one projection or command status refetch URL.
- async effect completion is recovered by polling `statusUrl` or projection refetch.
- SSE payloads remain notifications, not canonical full state.

### Scenario C. Error/precondition guardrails

Given representative failures occur: missing auth, invalid body, stale `expectedStateVersion`, missing resource, invalid transition, runtime unavailable, forbidden runtime execution.

When API behavior is implemented from this catalog.

Then:

- each failure maps to `ApiErrorEnvelope`, `rejected`, or `blocked`.
- forbidden execution maps to `RUNTIME_ACTION_BLOCKED` or `blocked`; it never executes.
- stale state maps to `STATE_VERSION_CONFLICT` and does not persist events/effects.
- domain precondition failures do not create partial ProductEngine events.

### Scenario D. Docs cross-reference consistency

Given 20/21/23/24/25 already own storage, runtime, effect, Codex output, and DTO contracts.

When 26번 is updated.

Then:

- DTO field definitions are referenced from 25번, not redefined here.
- DB row/DDL is referenced from 20번, not defined here.
- effect queue and runtime execution are referenced from 21/23번, not implemented here.
- Codex prompt/output schema is referenced from 24번.
- React screen state is excluded and referenced to UX/projection documents.

### Scenario E. Representative operations incident dry-runs

Given `27-operations-observability-contract.md` defines research effect failure, Codex runtime failure, and missed-SSE recovery incidents.

When endpoint behavior is implemented from this catalog.

Then:

- research endpoints expose enough `statusUrl`, effect events, and projection refetch hints to recover a terminal `research_evidence_effect` failure.
- runtime endpoints map unavailable, blocked, schema-mismatched, and forbidden-action failures to `blocked`, ManualRetryCard, RuntimeBlockedCard, or manual handoff behavior without external execution.
- event stream and command status endpoints allow missed SSE recovery without duplicate effect execution.
- every relevant endpoint row names enough error/precondition behavior to avoid raw exception-only recovery.

## Implementation checklist

- Add this route catalog before implementing Hono route handlers.
- Keep `CommandType` mappings in sync with `25-contracts-dto-catalog.md`.
- Implement endpoint tests for at least one happy path and one guardrail per implementation PR.
- Add status endpoint support before relying on `statusUrl` in clients.
- Add SSE reconnection/refetch tests before claiming async effect UI completion.
- Add representative operations incident tests from `27-operations-observability-contract.md` before claiming end-to-end dry-run hardening.
- Do not generate Hono/Zod/OpenAPI files in this docs-only PR.
