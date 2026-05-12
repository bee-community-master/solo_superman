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
| `GET /api/v1/projects/:projectId/research-runs` | Auth required. Param: `projectId`. No body. | `commandType: none`; project-scoped ResearchRun query. | `ApiSuccessEnvelope<ResearchRunControlProjection>`; no command `statusUrl`. Response includes run collection `refetchUrl` and `projection.updated` recovery hints. | No ProductEngine reducer effect. Refetch after run start/cancel/retry/status updates. | `RESOURCE_NOT_FOUND` if project missing. |
| `POST /api/v1/projects/:projectId/research-runs` | Auth required. Param: `projectId`. Body DTO: `StartResearchRunRequest`. | `commandType: StartResearchRun`; project-level application command. | `accepted_with_projection` with `ResearchRunControlResult` when active allowlist, public-safe disclosure, staleness, and rate/budget checks pass. Returns run `statusUrl` `/api/v1/projects/:projectId/research-runs/:researchRunId/status`. `blocked` for manual handoff or precondition blockers. | Persists `ResearchDisclosureLogProjection` and `ResearchRunProjection`; emits recovery hints for `projection.updated` and refetch run status/collection. No ProductEngine reducer effect. | `RESOURCE_NOT_FOUND` if project missing, `VALIDATION_FAILED` for route/body mismatch, unsupported connector/source/adapter, or malformed context. Missing/paused/revoked allowlist, private/full/credentialed context, exhausted rate budget, or stale task returns blocked/manual handoff or blocked precondition before provider execution. |
| `GET /api/v1/projects/:projectId/research-runs/:researchRunId/status` | Auth required. Params: `projectId`, `researchRunId`. No body. | `commandType: none`; project-scoped ResearchRun status query. | `ApiSuccessEnvelope<ResearchRunStatusDto>` with selected run, stable `statusUrl`, collection `refetchUrl`, and projection hints. | Polling this URL recovers missed SSE/status updates. When a local read-only provider result is complete and the linked `ResearchTask` exists, the sidecar ingests the public-safe provider summary through `ImportResearchResult`, runs the Evidence Pack quality gate, updates `ResearchRunProjection` quality status, and refetches research/queue projections; no SpecVersion or external mutation is produced. | `RESOURCE_NOT_FOUND` if project or run missing/mismatched. |
| `POST /api/v1/projects/:projectId/research-runs/:researchRunId/cancel` | Auth required. Params: `projectId`, `researchRunId`. Body DTO: `CancelResearchRunRequest`. | `commandType: CancelResearchRun`; project-level application command. | `accepted_with_projection` with `ResearchRunControlResult`; queued run may become `cancelled`, provider-started run becomes `cancel_requested` until terminal status. Returns stable run `statusUrl`. | Persists ResearchRun state transition and projection/refetch hints; connector cancellation is adapter-boundary only, no external mutation beyond read-only provider cancellation request. | `RESOURCE_NOT_FOUND` if project/run missing; `VALIDATION_FAILED` for route/body mismatch; `COMMAND_PRECONDITION_FAILED` if terminal run cannot be cancelled. |
| `POST /api/v1/projects/:projectId/research-runs/:researchRunId/retry` | Auth required. Params: `projectId`, `researchRunId`. Body DTO: `RetryResearchRunRequest`. | `commandType: RetryResearchRun`; project-level application command. | `accepted_with_projection` creates a new ResearchRun id with `retryOfRunId`, explicit `retryReason`, incremented attempt/idempotency, prior failure summary, retry backoff, and stable `statusUrl`. `blocked` when retry is not allowed. | Persists new retry run and projection/refetch hints; no automatic retry for approval/precondition/policy blockers. | `RESOURCE_NOT_FOUND` if project/run/allowlist missing; `VALIDATION_FAILED` for route/body mismatch; `COMMAND_PRECONDITION_FAILED` or blocked response when prior run is not failed/stale/research_insufficient, allowlist is inactive, or retry budget is exhausted. |
| `GET /api/v1/projects/:projectId/phase15b-upgrade-hints` | Auth required. Param: `projectId`. No body. | `commandType: none`; project-scoped Phase 1.5B readiness metadata query. | `ApiSuccessEnvelope<Phase15bUpgradeHintProjection>` with `metadataLabel: readiness_preview_handoff_metadata`, sanitized `sourceRefs`, `refetchUrl`, and `exportUrl`; no command `statusUrl`. | No effect, no file/shell/browser/network write/credential/destructive/ChatGPT automation execution. Refetch after runtime artifact hint persistence. | `RESOURCE_NOT_FOUND` if project missing. Source ref labels/private payloads are omitted from API records unless a future explicit approval policy adds a safe export path. |
| `GET /api/v1/projects/:projectId/phase15b-upgrade-hints/export` | Auth required. Param: `projectId`. No body. | `commandType: none`; project-scoped Phase 1.5B readiness metadata export. | `ApiSuccessEnvelope<Phase15bUpgradeHintExportDto>` with approval, sandbox, rollback, expected evidence, risk normalization, source trace ids, and `privatePayloadsIncluded: false`; no command `statusUrl`. | No effect. Export is JSON metadata only and cannot activate execution/delegation. | `RESOURCE_NOT_FOUND` if project missing. Credential values, private/full/credentialed source payloads, and sourceRef labels are omitted. |
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
| `GET /api/v1/sessions/:sessionId/research` | Auth required. Param: `sessionId`. No body. | `commandType: none`; research/evidence projection query. | `ApiSuccessEnvelope<ResearchEvidenceProjection>` including tasks, results, EvidenceMatrix summaries, and DecisionEvidencePack ledger rows; no `statusUrl`. | No effect. Refetch after research task/result/evidence/pack SSE. | `RESOURCE_NOT_FOUND` if session missing. |
| `POST /api/v1/research-tasks/:researchTaskId/results` | Auth required. Param: `researchTaskId`. Body DTO: `ImportResearchResultRequest`. | `commandType: ImportResearchResult`. Payload includes pasted/manual result, source reliability/metadata, researchRun/claim/decision/spec/question refs, stale sensitivity, and limitation notes. | `accepted` with `statusUrl`; EvidenceMatrix is not returned as an immediate projection. | Queues `research_evidence_effect`; the effect executor later emits `EvidenceSynthesized`, persists DecisionEvidencePack, and may queue `queue_projection_effect`. Refetch research, queue, confidence after status/projection hints. | `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED` for missing source/result or invalid source reliability, `IDEMPOTENCY_CONFLICT` by task id + result hash. |
| `POST /api/v1/research-results/:researchResultId/synthesize` | Auth required. Param: `researchResultId`. Body DTO: `SynthesizeEvidenceRequest`. | `commandType: SynthesizeEvidence`. User-request payload from result ref and synthesis target emits `EvidenceSynthesisRequested`; effect executor payload emits `EvidenceSynthesized` with EvidenceMatrix and DecisionEvidencePack output refs. | User request returns `accepted` with `statusUrl`; only the effect executor persists EvidenceMatrix and DecisionEvidencePack output. | Queues `research_evidence_effect`; executor completion persists gate status (`accepted`, `research_insufficient`, `stale`, or `needs_review`), may update the linked ResearchRun quality terminal state, and may queue `queue_projection_effect`; no SpecVersion update is allowed. Refetch research, queue, confidence. | `COMMAND_PRECONDITION_FAILED` if result is empty, stale, or already terminal without force option. |
| `POST /api/v1/research-cards/:cardId/resolve` | Auth required. Param: `cardId`. Body DTO: `ResolveResearchQueueCardRequest`. | `commandType: ResolveResearchQueueCard`. Payload records terminal outcome `approved`, `revised`, `rejected`, `deferred`, `risk_accepted`, or `research_insufficient`. | `accepted_with_projection` with `DecisionQueueProjection`; response may also carry deterministic completeness output refs. | Queues `queue_projection_effect`; persists `ResearchQueueCardResolved`, updates `ResearchEvidenceProjection` review card terminal state, and recomputes confidence gates. Refetch research, queue, confidence. | `RESOURCE_NOT_FOUND` for missing card, `VALIDATION_FAILED` for unavailable outcome or missing rationale on `deferred`/`risk_accepted`, `COMMAND_PRECONDITION_FAILED` when card is already terminal. |

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
| `POST /api/v1/sessions/:sessionId/planning-handoff` | Auth required. Param: `sessionId`. Body DTO: `CreatePlanningHandoffRequest`; route param must match body `sessionId`. | `commandType: CreatePlanningHandoff`; deterministic ProductEngine command. | `accepted_with_projection` with `PlanningHandoffProjection` for both final and blocker artifacts; no `statusUrl`. | Emits `PlanningHandoffCreated` or `PlanningHandoffBlocked` and may emit `projection.updated` for `PlanningHandoffProjection`. No Codex/runtime effect, file/shell/browser/deploy/external mutation, credential, or active delegation. | `RESOURCE_NOT_FOUND` for missing session, `STATE_VERSION_CONFLICT` for stale expected state, `VALIDATION_FAILED` for malformed body or unsupported requested scope. Valid but missing/stale source refs are gate failures and should persist `PlanningHandoffBlockerArtifactDto` when validation/state checks pass. |
| `GET /api/v1/sessions/:sessionId/planning-handoff` | Auth required. Param: `sessionId`. No body. | `commandType: none`; Planning Handoff projection query. | `ApiSuccessEnvelope<PlanningHandoffProjection | null>`; existing session with no handoff returns `data: null`; no `statusUrl`. | No effect. Refetch after `PlanningHandoffCreated` or `PlanningHandoffBlocked`. | `RESOURCE_NOT_FOUND` if session missing; auth/project ownership checks match the session route family. |
| `POST /api/v1/sessions/:sessionId/execution-authority` | Auth required. Param: `sessionId`. Body DTO: `CreateExecutionAuthorityRequest`; route param must match body `sessionId`; body must carry an `idempotencyKey`. | `commandType: CreateExecutionAuthority`; ProductEngine/application command boundary is authoritative for approval/security semantics. | `accepted_with_projection` with `ExecutionAuthorityLedgerProjection`; approved/non-blocked authority returns `currentStatus=ready_for_execution`, while missing source/preview/approval/rollback/sandbox or preview-hash mismatch returns a blocked ledger projection. No adapter `statusUrl`. | Persists `ExecutionAuthorityRecord` and same-ledger `BoundedAgentOutputRecord`; emits `ExecutionAuthorityRecorded` or `ExecutionAuthorityBlocked`. No file/shell/browser adapter execution. | `AUTH_REQUIRED` for missing token or non-local origin, `RESOURCE_NOT_FOUND` for missing session, `STATE_VERSION_CONFLICT` for stale expected state or replay, `VALIDATION_FAILED` for malformed body/unsupported keys. Pending/rejected/revoked/expired approvals are blocked before execution. |
| `GET /api/v1/sessions/:sessionId/execution-authority` | Auth required. Param: `sessionId`. No body. | `commandType: none`; latest execution authority ledger query. | `ApiSuccessEnvelope<ExecutionAuthorityLedgerProjection | null>`; existing session with no authority returns `data: null`; no `statusUrl`. | No effect. Refetch after `CreateExecutionAuthority`. | `RESOURCE_NOT_FOUND` if session missing. Hosted/non-local origins are rejected before route handling. |
| `POST /api/v1/execution-authorities/:authorityRecordId/preflight` | Auth required. Param: `authorityRecordId`. Body DTO: `ValidateExecutionAuthorityPreflightRequest` with `sessionId`, `idempotencyKey`, `actionClass`, exact `previewArtifactHash`, `requestedAt`, and optional `approvalExpiresAt`. | `commandType: none`; service-level adapter preflight reads `executionAuthorityRepository` and does not execute an adapter. | `ApiSuccessEnvelope<ExecutionAuthorityPreflightResult>` with `status=ready_for_execution` only when the stored record is an executable action class, approved, unexpired, action-class matched, exact preview hash matched, not already running, and rollback/evidence/audit refs exist; otherwise `status=blocked`. No adapter `statusUrl`. | No file/shell/browser adapter effect. Adds preflight audit/evidence refs to the response only. | Missing authority, action-class mismatch/out-of-sequence request, preview-only external mutation authority, preview hash mismatch, expired approval, missing rollback, blocked prior record, missing evidence/audit, hosted/non-local origin, or missing idempotency key is fail-closed. |

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

## Phase 2 Planning Handoff endpoint behavior

이 섹션은 `31-phase2-planning-handoff-contract.md`의 artifact contract를 API behavior로 연결하는 endpoint contract다. `32-phase2-implementation-preflight-contract.md`는 exact routeId/clientName, response category, idempotency, GET no-handoff default를 소유한다. #42는 이 endpoint names를 current parsed docs/26 route surface와 `API_ROUTE_CATALOG` placeholder에 승격했고, #45는 Hono route handlers와 sidecar command-service persistence/query wiring을 mounted route로 연결한다.

Endpoint names:

- `POST /api/v1/sessions/:sessionId/planning-handoff`
  - Request DTO: `CreatePlanningHandoffRequest`.
  - Route/body consistency: body `sessionId` must match the route param.
  - Command mapping: deterministic ProductEngine command `CreatePlanningHandoff`.
  - Response: `accepted_with_projection` with `PlanningHandoffProjection`; no async `statusUrl` unless a future implementation explicitly introduces a non-execution projection effect.
  - Gate pass: persist `PlanningHandoffArtifact` and emit `PlanningHandoffCreated`.
  - Gate pass content after #74: `taskBreakdown`, `prIssuePlan`, and `buildSlicePlan` are source-driven from Spec/Founder Brief or Completion Candidate, Decision-linked Evidence Pack, Research-updated Queue, Known Risks/Open Questions, and Phase 1.5B hints instead of a generic single scaffold.
  - Gate fail: persist `PlanningHandoffBlockerArtifact` and emit `PlanningHandoffBlocked`; semantic gate failure should not be represented only as command rejection when a blocker artifact can be persisted.
  - Effects/SSE/refetch: no Codex/runtime effect and no file/shell/browser/deploy/external mutation; future implementation may emit `projection.updated` for `PlanningHandoffProjection`.
  - Errors/preconditions: `RESOURCE_NOT_FOUND` for missing session, `STATE_VERSION_CONFLICT` for stale expected state, `VALIDATION_FAILED` for malformed body or unsupported requested scope. Malformed JSON/body and route/body mismatch are `ApiErrorEnvelope` failures before ProductEngine command construction; reducer-level payload validation after command construction is `CommandResponse.rejected`. Valid but missing/stale source refs are gate failures that should persist `PlanningHandoffBlockerArtifactDto` when validation/state checks pass. Use `COMMAND_PRECONDITION_FAILED` only when no durable blocker artifact can safely be persisted.
- `GET /api/v1/sessions/:sessionId/planning-handoff`
  - Query mapping: no ProductEngine command; read `planningHandoffProjection`.
  - Response: `ApiSuccessEnvelope<PlanningHandoffProjection | null>`; no `statusUrl`. Existing session with no handoff returns `data: null`.
  - Projection content: latest final handoff or latest blocker artifact for the session, sourceRefs, gate verdict, readiness/residual risk summary, and recovery/next-action hints.
  - Errors/preconditions: `RESOURCE_NOT_FOUND` for missing session; auth/project ownership checks match the session route family.

## Phase 3 Controlled Execution route placeholders

이 섹션은 `36-phase3-controlled-execution-contract.md`와 `21-sidecar-api-runtime-contract.md`를 endpoint behavior로 연결한다. #86, #87, #88 web-local migration prerequisite이 완료된 뒤 PR-01 common ledger/authority slice는 `CreateExecutionAuthority`, `ExecutionAuthorityLedgerProjection`, `executionAuthorityRepository`로 code-backed ProductEngine/storage surface가 됐다. #93은 common ledger/authority Hono route와 adapter preflight guard를 mounted route로 승격하지만, file/shell/browser adapter execution은 후속 slice 전까지 placeholder 또는 blocked 상태다.

Placeholder route families:

- Common ledger/authority family
  - Purpose: create/read `BoundedAgentOutputRecord`, create/read `ExecutionAuthorityRecord`, record pending/approval/rejection/revocation/expiry transitions, and expose audit/evidence/rollback refs.
  - Current #93 mounted surface: `POST /api/v1/sessions/:sessionId/execution-authority`, `GET /api/v1/sessions/:sessionId/execution-authority`, and `POST /api/v1/execution-authorities/:authorityRecordId/preflight`.
  - ProductEngine surface: `CreateExecutionAuthority` accepts a same-ledger bounded output plus source/preview/explicit-scope/approval/sandbox/rollback refs and returns `ExecutionAuthorityLedgerProjection`; `ExecutionAuthorityRecorded` means approved + `not_run`, not adapter execution. `external_mutation_preview_only` returns `currentStatus=preview_only`, not executable `ready_for_execution`.
  - Request contract: Auth required; local token, loopback, explicit CORS, hosted-origin rejection, CSRF/replay/idempotency, preview hash, authority record id, and expiry checks follow 21번.
  - Response/statusUrl: `accepted_with_projection` with `currentStatus=ready_for_execution`, `preview_only`, or `blocked`; no adapter `statusUrl` until an implementation PR introduces a non-blocked execution effect.
  - Effects/SSE/refetch: ledger projection and activity refetch only; no file/shell/browser adapter runs in this family.
  - State defaults: `approvalDecision` includes `pending`; `executionResult` includes `running`; `cancelled` and `rolled_back` are not MVP execution result states.
  - Errors/preconditions: missing planning source, missing bounded output link, missing explicit requested scope, missing preview artifact, preview hash mismatch, missing rollback reference, credential value requirement, pending/rejected/revoked/expired approval, or sandbox boundary failure returns `blocked`.
- `file_diff` adapter family
  - Purpose: apply an exact approved diff preview to a limited workspace/sandbox after common ledger/authority is green.
  - Response/statusUrl: completed/failed/partial/blocked result with diff stats, changed-file evidence refs, rollback refs, and audit refs.
  - Rollback/path default: `git_diff_reverse` is the default rollback kind; `filesystem_snapshot` is allowed only as an explicit exception when reverse diff is unsafe or unavailable. Allowed paths stay under the approved project workspace root; `.env*`, credential/secret/key files, home directory paths, repo-outside paths, and symlink escape return `blocked`.
  - Errors/preconditions: missing approved unexpired authority, missing rollback ref, path outside allowed workspace/glob, sensitive path, or preview hash mismatch returns `blocked`.
- `shell_command` adapter family
  - Purpose: run only non-destructive allowlisted commands inside a command sandbox after `file_diff` slice is green.
  - Response/statusUrl: completed/failed/partial/blocked result with exit code, duration, stdout/stderr summary, rollback or compensating-action refs, and audit refs.
  - Allowlist/timeout default: allowed commands are repo `package.json` scripts plus limited read-only diagnostics such as `ls`, `cat`, `rg`, and `git status`. Read-only diagnostics time out at 30 seconds; test/typecheck/lint/docs verify commands time out at 10 minutes; build/full verify commands time out at 20 minutes; dev server commands require preview mode with automatic shutdown/kill evidence.
  - Errors/preconditions: raw shell mutation outside the allowlist, destructive shell command, deploy, force reset/delete, system setting mutation, credential value requirement, missing allowlist, timeout, or sandbox enforcement failure returns `blocked`.
- `browser_action` adapter family
  - Purpose: run approved browser action preview sessions only against loopback-only local targets by default after `shell_command` slice is green.
  - Response/statusUrl: completed/failed/partial/blocked result with screenshot/log refs, target ref, reset/rollback refs, and audit refs.
  - Target default: allowed targets are `localhost`, `127.0.0.1`, `::1`, and explicit local web/sidecar ports. LAN/private IP targets and cloud preview URLs are outside MVP target policy.
  - Errors/preconditions: external-production mutation, blanket/project-level approval, credential/session custody, missing browser reset boundary, LAN/private/cloud target, or target outside loopback policy returns `blocked` until a later explicit contract changes the class.

Phase 3 route placeholder acceptance:

- The behavior catalog must keep the sequence common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action`.
- A route family cannot claim execution success without `ExecutionAuthorityRecord.approvalDecision = approved`, exact preview hash match, rollback reference, evidence refs, and audit refs.
- Concrete route naming can follow later implementation slices, but the ProductEngine/application command boundary and these fail-closed defaults are authoritative for #93.
- Placeholder wording must not imply current-MVP support for credential custody, hosted control plane, destructive shell command allowlist, 모바일 승인, 팀 협업, 제품 결제/과금, external-production mutation, or blanket approval.
- Once a Phase 3 route is implemented in code, this section must be promoted into concrete endpoint rows and `packages/contracts/src/api/routes.ts` in the same implementation slice.

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
