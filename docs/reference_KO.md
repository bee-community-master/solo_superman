# 코드 기반 계약 색인

언어: 한국어 | [English](reference_EN.md)

이 문서는 의도적으로 compact하지만 machine-checked입니다. `packages/contracts`와 `scripts/verify-doc-contracts.mjs`가 drift하지 않도록 함께 유지합니다.

## Command and event contracts / 명령과 이벤트

### CommandType enum

| Value | Rule |
| --- | --- |
| `StartProject` | code-backed |
| `ChangeProjectPurposeMode` | code-backed |
| `ChangeBusinessCriticIntensity` | code-backed |
| `CaptureIntake` | code-backed |
| `DraftInitialSpec` | code-backed |
| `AnalyzeAmbiguity` | code-backed |
| `ActivateQuestionBatch` | code-backed |
| `SubmitAnswer` | code-backed |
| `DeferQueueItem` | code-backed |
| `DismissQueueItem` | code-backed |
| `PlanResearch` | code-backed |
| `ImportResearchResult` | code-backed |
| `SynthesizeEvidence` | code-backed |
| `ResolveResearchQueueCard` | code-backed |
| `CreateRuntimePreview` | code-backed |
| `ConvertRuntimeArtifact` | code-backed |
| `CreateSpecUpdatePreview` | code-backed |
| `ResolveDecision` | code-backed |
| `CreateSpecVersion` | code-backed |
| `ScoreCompleteness` | code-backed |
| `PrepareFounderBrief` | code-backed |
| `CreatePlanningHandoff` | code-backed |
| `CreatePhase25ResearchComparison` | code-backed |
| `CreateExecutionAuthority` | code-backed |
| `CreateChatGptBrowserDelegationRun` | code-backed |
| `RevokeChatGptBrowserDelegationRun` | code-backed |
| `CreateServicePageUsePermission` | code-backed |
| `RevokeServicePageUsePermission` | code-backed |
| `DeleteServicePageUsePermissionArtifacts` | code-backed |
| `RecordImplementationStepLedger` | code-backed |
| `CreateResearchAllowlist` | code-backed |
| `UpdateResearchAllowlist` | code-backed |
| `PauseResearchAllowlist` | code-backed |
| `RevokeResearchAllowlist` | code-backed |
| `PrepareResearchDisclosure` | code-backed |
| `StartResearchRun` | code-backed |
| `CancelResearchRun` | code-backed |
| `RetryResearchRun` | code-backed |

### ProductEngineCommand envelope

Every ProductEngine command carries command id, type, project/session ids, actor, issued time, idempotency key, expected state version, causation/correlation ids, schema version, and payload.

`CommandActor` enum:

| Value | Rule |
| --- | --- |
| `user` | code-backed |
| `product_engine` | code-backed |
| `effect_executor` | code-backed |
| `codex_runtime` | code-backed |
| `system` | code-backed |

Example command envelope: code owns exact field names in `packages/contracts/src/product-engine/commands.ts`.

Closed ProductEngine event type groups:

| Group | Event |
| --- | --- |
| ProductEngine | `ProjectStarted` |
| ProductEngine | `ProjectPurposeModeChanged` |
| ProductEngine | `BusinessCriticIntensityChanged` |
| ProductEngine | `IntakeCaptured` |
| ProductEngine | `SessionPhaseChanged` |
| ProductEngine | `InitialSpecDrafted` |
| ProductEngine | `SpecUpdatePreviewCreated` |
| ProductEngine | `SpecVersionCreated` |
| ProductEngine | `AmbiguityAnalyzed` |
| ProductEngine | `QuestionBatchActivated` |
| ProductEngine | `QueueItemDeferred` |
| ProductEngine | `QueueItemDismissed` |
| ProductEngine | `AnswerSubmitted` |
| ProductEngine | `DecisionResolved` |
| ProductEngine | `ResearchPlanned` |
| ProductEngine | `ResearchResultImported` |
| ProductEngine | `EvidenceSynthesisRequested` |
| ProductEngine | `EvidenceSynthesized` |
| ProductEngine | `ResearchQueueCardResolved` |
| ProductEngine | `RuntimePreviewRequested` |
| ProductEngine | `RuntimeArtifactConverted` |
| ProductEngine | `CompletenessScored` |
| ProductEngine | `FounderBriefPrepared` |
| ProductEngine | `PlanningHandoffCreated` |
| ProductEngine | `PlanningHandoffBlocked` |
| ProductEngine | `Phase25ResearchComparisonCreated` |
| ProductEngine | `Phase25ResearchComparisonBlocked` |
| ProductEngine | `ExecutionAuthorityRecorded` |
| ProductEngine | `ExecutionAuthorityBlocked` |
| ProductEngine | `ChatGptBrowserDelegationRunRecorded` |
| ProductEngine | `ChatGptBrowserDelegationRunBlocked` |
| ProductEngine | `ChatGptBrowserDelegationRunFailed` |
| ProductEngine | `ChatGptBrowserDelegationRunRevoked` |
| ProductEngine | `ServicePagePermissionGranted` |
| ProductEngine | `ServicePagePermissionRevoked` |
| ProductEngine | `ServicePageArtifactsDeleted` |
| ProductEngine | `ServicePageActionBlocked` |
| ProductEngine | `ServicePageFinalSubmitRequested` |
| ProductEngine | `ImplementationStepLedgerRecorded` |
| ProductEngine | `ImplementationStepBlocked` |
| ProductEngine | `ImplementationStepCompleted` |

### ProductEngineEffectPlanItem

Effect plans are reducer outputs and are executed by bounded effect executors, not by the reducer.

### EffectType enum

| Value | Rule |
| --- | --- |
| `queue_projection_effect` | code-backed |
| `research_evidence_effect` | code-backed |
| `codex_runtime_preview_effect` | code-backed |

### EffectStatus enum

| Value | Rule |
| --- | --- |
| `queued` | code-backed |
| `leased` | code-backed |
| `running` | code-backed |
| `succeeded` | code-backed |
| `failed` | code-backed |
| `blocked` | code-backed |
| `cancelled` | code-backed |

### EffectTaskDto

Effect tasks preserve source command/event refs, correlation, retry counts, output refs, and explicit errors.

## Deterministic outputs / 결정적 출력

### ProductEngineDeterministicOutput

| Field | Required | Type | Rule |
| --- | --- | --- | --- |
| `outputType` | yes | enum | closed output type |
| `outputRef` | yes | string | points to projection/artifact/evidence |
| `payload` | yes | object | code-backed payload |

| OutputType | Used by | Rule |
| --- | --- | --- |
| `reducer_deterministic_output` | ProductEngine | deterministic output |
| `initial_spec_draft` | ProductEngine | deterministic output |
| `ambiguity_analysis` | ProductEngine | deterministic output |
| `active_question_batch` | ProductEngine | deterministic output |
| `completeness_snapshot` | ProductEngine | deterministic output |
| `confidence_map` | ProductEngine | deterministic output |
| `spec_version_material` | ProductEngine | deterministic output |
| `founder_brief_draft` | ProductEngine | deterministic output |
| `planning_handoff_artifact` | ProductEngine | deterministic output |
| `phase25_research_comparison_report` | ProductEngine | deterministic output |
| `execution_authority_record` | ProductEngine | deterministic output |
| `chatgpt_browser_delegation_run` | ProductEngine | deterministic output |
| `service_page_use_permission` | ProductEngine | deterministic output |
| `implementation_step_ledger` | ProductEngine | deterministic output |

## Effect and runtime types

Phase 1 and later runtime previews use bounded Codex artifacts. Phase 3 execution authority is required before file/shell/browser actions become executable. Live Codex app-server preview turn은 `SOLO_CODEX_APP_SERVER_LIVE_TURNS=1`로 opt-in해야 하며 local Codex CLI login이 필요하고, 활성화되어도 read-only/no-network runtime boundary 안의 preview-only turn만 실행합니다.

## Codex preview contract / Codex 미리보기 계약

Phase 1에서 허용되는 Codex turnPurpose는 다음 6개뿐이다.

| Value | Rule |
| --- | --- |
| `question_generation` | code-backed |
| `ambiguity_analysis` | code-backed |
| `research_prompt` | code-backed |
| `evidence_synthesis` | code-backed |
| `spec_update_preview` | code-backed |
| `implementation_plan_preview` | code-backed |

## Input contract overview

Codex preview input combines core project/session context with turn-specific delta context.

## Artifact field contracts

### QuestionBatchArtifact

- Code-backed artifact kind.

### AmbiguityAnalysisArtifact

- Code-backed artifact kind.

### ResearchPromptArtifact

- Code-backed artifact kind.

### EvidenceSynthesisArtifact

- Code-backed artifact kind.

### SpecUpdatePreviewArtifact

- Code-backed artifact kind.

### ImplementationPlanPreviewArtifact

- Code-backed artifact kind.

### BlockedActionArtifact

- Code-backed artifact kind.

## Blocked action taxonomy

| Value | Rule |
| --- | --- |
| `file_patch` | code-backed |
| `shell_command` | code-backed |
| `browser_action` | code-backed |
| `network_write` | code-backed |
| `credential_access` | code-backed |
| `destructive_operation` | code-backed |
| `chatgpt_web_automation` | code-backed |

## Auto-apply and gate matrix

Auto-apply is allowed only for low-risk deterministic previews. It does not cover file/shell/browser/network writes or credential access; those risky actions are blocked or approval-required.

## applyPolicy enum

| Value | Rule |
| --- | --- |
| `auto_apply` | code-backed |
| `conditional_auto_apply` | code-backed |
| `note_only` | code-backed |
| `approval_required` | code-backed |
| `blocked` | code-backed |
| `manual_handoff_required` | code-backed |

Unknown applyPolicy values must be rejected.

## SSE and projection contracts / SSE와 projection

### SseEvent union

| Value | Rule |
| --- | --- |
| `command.accepted` | code-backed |
| `command.rejected` | code-backed |
| `effect.queued` | code-backed |
| `effect.started` | code-backed |
| `effect.succeeded` | code-backed |
| `effect.failed` | code-backed |
| `effect.blocked` | code-backed |
| `projection.updated` | code-backed |
| `runtime.status.changed` | code-backed |

### ProjectionRefetchHint

Projection hints identify a projection kind and refetch URL.

| Projection | File | Primary UI |
| --- | --- | --- |
| `SessionShellProjection` | `packages/contracts/src/projections` | projection refetch |
| `DecisionQueueProjection` | `packages/contracts/src/projections` | projection refetch |
| `LivingSpecProjection` | `packages/contracts/src/projections` | projection refetch |
| `ResearchAllowlistProjection` | `packages/contracts/src/projections` | projection refetch |
| `ResearchDisclosureLogProjection` | `packages/contracts/src/projections` | projection refetch |
| `ResearchRunProjection` | `packages/contracts/src/projections` | projection refetch |
| `Phase15bUpgradeHintProjection` | `packages/contracts/src/projections` | projection refetch |
| `ResearchEvidenceProjection` | `packages/contracts/src/projections` | projection refetch |
| `ConfidenceCompletionProjection` | `packages/contracts/src/projections` | projection refetch |
| `RuntimeActivityProjection` | `packages/contracts/src/projections` | projection refetch |
| `FounderBriefProjection` | `packages/contracts/src/projections` | projection refetch |
| `PlanningHandoffProjection` | `packages/contracts/src/projections` | projection refetch |
| `Phase25ResearchComparisonProjection` | `packages/contracts/src/projections` | projection refetch |
| `ExecutionAuthorityLedgerProjection` | `packages/contracts/src/projections` | projection refetch |
| `ChatGptBrowserDelegationProjection` | `packages/contracts/src/projections` | projection refetch |
| `ServicePageUsePermissionProjection` | `packages/contracts/src/projections` | projection refetch |
| `ImplementationStepLedgerProjection` | `packages/contracts/src/projections` | projection refetch |
| `AutoImplementationRunProjection` | `packages/contracts/src/projections` | workspace implementation run / markdown issue fallback |

### Projection minimum fields

Every projection carries a kind and version, plus surface-specific status/summary fields where the source type requires them.

## API route behavior catalog / API 라우트 카탈로그

Route definitions are source-owned by `packages/contracts/src/api/routes.ts`. This table is checked for route and required-query parity.

| Route | routeId | commandType | requiredQueryParams |
| --- | --- | --- | --- |
| `GET /healthz` | `healthz` | `none` | - |
| `GET /readyz` | `readyz` | `none` | - |
| `POST /api/v1/projects` | `createProject` | `StartProject` | - |
| `GET /api/v1/projects` | `listProjects` | `none` | - |
| `GET /api/v1/projects/:projectId` | `getProject` | `none` | - |
| `GET /api/v1/projects/:projectId/research-allowlists` | `listResearchAllowlists` | `none` | - |
| `POST /api/v1/projects/:projectId/research-allowlists` | `createResearchAllowlist` | `CreateResearchAllowlist` | - |
| `POST /api/v1/projects/:projectId/research-allowlists/:allowlistId` | `updateResearchAllowlist` | `UpdateResearchAllowlist` | - |
| `POST /api/v1/projects/:projectId/research-allowlists/:allowlistId/pause` | `pauseResearchAllowlist` | `PauseResearchAllowlist` | - |
| `POST /api/v1/projects/:projectId/research-allowlists/:allowlistId/revoke` | `revokeResearchAllowlist` | `RevokeResearchAllowlist` | - |
| `POST /api/v1/projects/:projectId/research-disclosures` | `prepareResearchDisclosure` | `PrepareResearchDisclosure` | - |
| `GET /api/v1/projects/:projectId/research-disclosures` | `listResearchDisclosures` | `none` | - |
| `GET /api/v1/projects/:projectId/research-runs` | `listResearchRuns` | `none` | - |
| `POST /api/v1/projects/:projectId/research-runs` | `startResearchRun` | `StartResearchRun` | - |
| `GET /api/v1/projects/:projectId/research-runs/:researchRunId/status` | `getResearchRunStatus` | `none` | - |
| `POST /api/v1/projects/:projectId/research-runs/:researchRunId/cancel` | `cancelResearchRun` | `CancelResearchRun` | - |
| `POST /api/v1/projects/:projectId/research-runs/:researchRunId/retry` | `retryResearchRun` | `RetryResearchRun` | - |
| `GET /api/v1/projects/:projectId/phase15b-upgrade-hints` | `listPhase15bUpgradeHints` | `none` | - |
| `GET /api/v1/projects/:projectId/phase15b-upgrade-hints/export` | `exportPhase15bUpgradeHints` | `none` | - |
| `POST /api/v1/projects/:projectId/sessions` | `startOrResumeSession` | `none` | - |
| `GET /api/v1/projects/:projectId/sessions/:sessionId` | `getSession` | `none` | - |
| `POST /api/v1/sessions/:sessionId/project-purpose-mode` | `changeProjectPurposeMode` | `ChangeProjectPurposeMode` | - |
| `POST /api/v1/sessions/:sessionId/business-critic-intensity` | `changeBusinessCriticIntensity` | `ChangeBusinessCriticIntensity` | - |
| `POST /api/v1/sessions/:sessionId/intake` | `captureIntake` | `CaptureIntake` | - |
| `POST /api/v1/sessions/:sessionId/spec/initial` | `draftInitialSpec` | `DraftInitialSpec` | - |
| `GET /api/v1/sessions/:sessionId/spec` | `getLivingSpec` | `none` | - |
| `POST /api/v1/sessions/:sessionId/questions/generate` | `generateInitialQuestionSet` | `none` | - |
| `POST /api/v1/sessions/:sessionId/spec/analyze` | `analyzeAmbiguity` | `AnalyzeAmbiguity` | - |
| `GET /api/v1/sessions/:sessionId/spec/versions` | `listSpecVersions` | `none` | - |
| `GET /api/v1/sessions/:sessionId/queue` | `getDecisionQueue` | `none` | - |
| `POST /api/v1/sessions/:sessionId/queue/activate` | `activateQuestionBatch` | `ActivateQuestionBatch` | - |
| `POST /api/v1/questions/:questionId/answers` | `submitAnswer` | `SubmitAnswer` | - |
| `POST /api/v1/queue-items/:queueItemId/defer` | `deferQueueItem` | `DeferQueueItem` | - |
| `POST /api/v1/queue-items/:queueItemId/dismiss` | `dismissQueueItem` | `DismissQueueItem` | - |
| `POST /api/v1/sessions/:sessionId/research-tasks` | `planResearch` | `PlanResearch` | - |
| `GET /api/v1/sessions/:sessionId/research` | `getResearchEvidence` | `none` | - |
| `POST /api/v1/research-tasks/:researchTaskId/results` | `importResearchResult` | `ImportResearchResult` | - |
| `POST /api/v1/research-results/:researchResultId/synthesize` | `synthesizeEvidence` | `SynthesizeEvidence` | - |
| `POST /api/v1/research-cards/:cardId/resolve` | `resolveResearchQueueCard` | `ResolveResearchQueueCard` | - |
| `POST /api/v1/spec-updates` | `createSpecUpdatePreview` | `CreateSpecUpdatePreview` | - |
| `POST /api/v1/decisions` | `createDecisionCard` | `none` | - |
| `POST /api/v1/decisions/:decisionId/resolve` | `resolveDecision` | `ResolveDecision` | - |
| `POST /api/v1/sessions/:sessionId/spec/versions` | `createSpecVersion` | `CreateSpecVersion` | - |
| `GET /api/v1/runtime/status` | `getRuntimeStatus` | `none` | - |
| `POST /api/v1/runtime/codex/login/start` | `startCodexLogin` | `none` | - |
| `POST /api/v1/runtime/codex/preview` | `createRuntimePreview` | `CreateRuntimePreview` | - |
| `POST /api/v1/runtime/manual-handoff` | `createManualHandoff` | `CreateRuntimePreview` | - |
| `POST /api/v1/runtime/artifacts/:artifactId/convert` | `convertRuntimeArtifact` | `ConvertRuntimeArtifact` | - |
| `POST /api/v1/runtime/artifacts/:artifactId/block` | `blockRuntimeArtifact` | `ConvertRuntimeArtifact` | - |
| `GET /api/v1/sessions/:sessionId/completeness` | `getCompleteness` | `none` | - |
| `POST /api/v1/sessions/:sessionId/completeness/score` | `scoreCompleteness` | `ScoreCompleteness` | - |
| `POST /api/v1/sessions/:sessionId/completion-candidate` | `createCompletionCandidate` | `ScoreCompleteness` | - |
| `GET /api/v1/sessions/:sessionId/founder-brief` | `getFounderBrief` | `none` | - |
| `POST /api/v1/sessions/:sessionId/founder-brief/export` | `prepareFounderBriefExport` | `PrepareFounderBrief` | - |
| `POST /api/v1/sessions/:sessionId/planning-handoff` | `createPlanningHandoff` | `CreatePlanningHandoff` | - |
| `GET /api/v1/sessions/:sessionId/planning-handoff` | `getPlanningHandoff` | `none` | - |
| `POST /api/v1/sessions/:sessionId/execution-authority` | `createExecutionAuthority` | `CreateExecutionAuthority` | - |
| `GET /api/v1/sessions/:sessionId/execution-authority` | `getExecutionAuthority` | `none` | - |
| `POST /api/v1/execution-authorities/:authorityRecordId/preflight` | `validateExecutionAuthorityPreflight` | `none` | - |
| `POST /api/v1/execution-authorities/:authorityRecordId/file-diff` | `executeFileDiff` | `none` | - |
| `POST /api/v1/execution-authorities/:authorityRecordId/shell-command` | `executeShellCommand` | `none` | - |
| `POST /api/v1/execution-authorities/:authorityRecordId/browser-action` | `executeBrowserAction` | `none` | - |
| `POST /api/v1/sessions/:sessionId/chatgpt-browser-delegations` | `createChatGptBrowserDelegationRun` | `CreateChatGptBrowserDelegationRun` | - |
| `GET /api/v1/sessions/:sessionId/chatgpt-browser-delegations` | `getChatGptBrowserDelegationRuns` | `none` | - |
| `POST /api/v1/sessions/:sessionId/chatgpt-browser-delegations/:runId/revoke` | `revokeChatGptBrowserDelegationRun` | `RevokeChatGptBrowserDelegationRun` | - |
| `POST /api/v1/sessions/:sessionId/service-page-use-permissions` | `createServicePageUsePermission` | `CreateServicePageUsePermission` | - |
| `GET /api/v1/sessions/:sessionId/service-page-use-permissions` | `getServicePageUsePermissions` | `none` | - |
| `POST /api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/revoke` | `revokeServicePageUsePermission` | `RevokeServicePageUsePermission` | - |
| `POST /api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/artifacts/delete` | `deleteServicePageUsePermissionArtifacts` | `DeleteServicePageUsePermissionArtifacts` | - |
| `POST /api/v1/sessions/:sessionId/implementation-step-ledger` | `recordImplementationStepLedger` | `RecordImplementationStepLedger` | - |
| `GET /api/v1/sessions/:sessionId/implementation-step-ledger` | `getImplementationStepLedger` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs` | `createAutoImplementationRun` | `none` | - |
| `GET /api/v1/sessions/:sessionId/auto-implementation-runs` | `getAutoImplementationRuns` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/pr-mutations` | `recordAutoImplementationPullRequestMutation` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs` | `createAutoImplementationWorkerJob` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/complete` | `completeAutoImplementationWorkerJob` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/ledger-import` | `importAutoImplementationWorkerLedger` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/run` | `runAutoImplementationWorkerJob` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/worker-jobs/:jobId/advance-stage` | `advanceAutoImplementationWorkerStage` | `none` | - |
| `POST /api/v1/sessions/:sessionId/auto-implementation-runs/:runId/stages/:stage` | `recordAutoImplementationStage` | `none` | - |
| `GET /api/v1/commands/:commandId/status` | `getCommandStatus` | `none` | - |
| `GET /api/v1/events/stream` | `subscribeEventStream` | `none` | sessionId |
| `GET /api/v1/sessions/:sessionId/activity` | `getActivity` | `none` | - |

## Contract change rule / 계약 변경 규칙

When a contributor changes command/event/effect/Codex/SSE/projection/route values, update this document and run `pnpm verify:docs`. The verifier compares this file against source code and fails on drift.
