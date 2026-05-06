# 32. Phase 2 Implementation Preflight Contract

## 목적

이 문서는 `31-phase2-planning-handoff-contract.md` 이후 Phase 2 code PR을 시작하기 전에 더 이상 구현자가 다시 결정하지 않아야 할 cross-layer 기본값을 고정한다. `31`번이 `PlanningHandoffArtifact`와 `PlanningHandoffBlockerArtifact`의 artifact/report schema를 소유한다면, 이 문서는 그 schema를 실제 DTO, ProductEngine command, gate algorithm, storage, API, 구현 순서, Phase 1.5 dependency로 옮길 때의 **exact default**를 소유한다.

Canonical path: `docs/32-phase2-implementation-preflight-contract.md`.

## Scope lock

| 항목 | 결정 |
| --- | --- |
| Canonical source | Phase 2 implementation preflight decisions는 이 문서가 소유한다. |
| Decision depth | DTO field names/types, enum values, routeId/clientName, DB columns/indexes, idempotency key, gate source-of-truth까지 exact default로 고정한다. |
| Issue boundary | 이 문서는 PR/issue 분해 기준을 제공하지만 GitHub issue draft나 live issue 생성은 포함하지 않는다. |
| Code boundary | 이 문서는 implementation defaults를 소유한다. #42 Contracts PR은 DTO/command/event/projection/route placeholder와 verifier sync만 code로 승격하고, Drizzle schema/migration, route handler, reducer, UI behavior는 후속 code PR이 소유한다. |
| Phase boundary | Phase 2는 planning handoff까지다. Phase 3 controlled execution, file/shell/browser/deploy/external mutation capability는 설계하지 않는다. |

Non-goals:

- Drizzle schema/migration, Hono route handler, ProductEngine reducer behavior, `apps/*` UI behavior 변경.
- PR 단위 GitHub issue draft 문서 작성.
- live GitHub issue 생성/수정.
- Phase 3 controlled execution 설계.

## 1. DTO / wire shape exact defaults

#42 Contracts PR은 `25-contracts-dto-catalog.md`의 Planning Handoff names를 closed contract surface로 승격할 때 아래 wire shape를 기본값으로 사용한다. 모든 field name은 lower camelCase를 사용하고, time field는 ISO-8601 string을 사용한다.

### Core enums

```ts
export type PlanningHandoffArtifactKind = "PlanningHandoffArtifact" | "PlanningHandoffBlockerArtifact";

export type PlanningHandoffVerdict =
  | "planning_ready"
  | "blocked_by_fatal"
  | "needs_risk_acceptance"
  | "queue_review_incomplete"
  | "source_trace_incomplete";

export type PlanningHandoffBlockerClass =
  | "customer_problem_jtbd"
  | "success_metrics_validation"
  | "approval_security_execution_safety";

export type PlanningHandoffResidualRiskClass =
  | "value_proposition_differentiation"
  | "mvp_scope_non_scope"
  | "known_low_medium_risk"
  | "phase15b_readiness_gap";

export type PlanningHandoffQueueOutcome =
  | "approved"
  | "revised"
  | "rejected"
  | "risk_accepted"
  | "research_insufficient"
  | "deferred";

export type PlanningHandoffRequiredUserAction =
  | "approve"
  | "revise"
  | "reject"
  | "defer_with_reason"
  | "risk_accept"
  | "research_more";
```

### Source refs

```ts
export type PlanningHandoffSourceType =
  | "spec_version"
  | "founder_brief"
  | "completion_candidate"
  | "decision_linked_evidence_pack"
  | "research_updated_queue_item"
  | "decision"
  | "risk_acceptance"
  | "known_risk"
  | "open_question"
  | "phase15b_hint"
  | "runtime_preview_artifact"
  | "activity_event";

export interface PlanningHandoffSourceRefDto {
  readonly sourceType: PlanningHandoffSourceType;
  readonly sourceId: string;
  readonly sourceLabel?: string;
  readonly required: boolean;
  readonly stale: boolean;
}
```

Rules:

- `required = true` means the source is required for the current verdict calculation.
- `stale = true` means the referenced object exists but was not produced from the current `expectedStateVersion` context; stale required refs produce `source_trace_incomplete`.
- Missing Phase 1.5B hint refs are not blockers by themselves. Missing required Spec/Evidence/Queue refs are blockers.

### Request DTO

```ts
export interface CreatePlanningHandoffRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly requestedScope?: PlanningHandoffRequestedScopeDto;
}

export interface PlanningHandoffRequestedScopeDto {
  readonly productSlice: string;
  readonly userFacingJourneyLabel: "Planning-ready";
  readonly nonGoals: readonly string[];
  readonly excludedInternalPhases: readonly ("phase3_controlled_execution" | "chatgpt_web_automation" | "external_deploy")[];
  readonly assumptions: readonly string[];
}
```

Request rules:

- `sourceRefs` must include at least one current `spec_version`, one `completion_candidate` or `founder_brief`, one `decision_linked_evidence_pack`, and one `research_updated_queue_item` ref.
- `requestedScope` is optional. If omitted, ProductEngine derives it from the current Living Spec, Founder Brief/Completion Candidate, and Known Risks.
- Request payload must not include file path to patch, shell command, browser instruction, deploy target, credential, or external mutation intent.

### Artifact DTOs

```ts
export interface PlanningHandoffGateVerdictDto {
  readonly verdict: PlanningHandoffVerdict;
  readonly reviewedQueueItemIds: readonly string[];
  readonly terminalOutcomeSummary: readonly PlanningHandoffQueueOutcomeSummaryDto[];
  readonly fatalBlockerClassesChecked: readonly PlanningHandoffBlockerClass[];
  readonly residualRiskVisibilityCheck: "passed" | "failed";
  readonly rationale: string;
}

export interface PlanningHandoffQueueOutcomeSummaryDto {
  readonly queueItemId: string;
  readonly outcome: PlanningHandoffQueueOutcome;
  readonly impact: "low" | "medium" | "high";
  readonly blockerClass?: PlanningHandoffBlockerClass;
  readonly residualRiskClass?: PlanningHandoffResidualRiskClass;
  readonly riskAccepted: boolean;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
}

export interface PlanningHandoffTaskDto {
  readonly taskId: string;
  readonly title: string;
  readonly intent: string;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly dependsOn: readonly string[];
  readonly ownerRole: "frontend" | "backend" | "product" | "qa" | "docs" | "security" | "research";
  readonly acceptanceEvidence: readonly string[];
  readonly nonGoals: readonly string[];
  readonly riskRefs: readonly string[];
}

export interface PlanningHandoffPrIssuePlanItemDto {
  readonly sequenceId: string;
  readonly summary: string;
  readonly includedTaskIds: readonly string[];
  readonly entryPrerequisites: readonly string[];
  readonly exitEvidence: readonly string[];
  readonly blockedBy: readonly string[];
  readonly phaseBoundary: "phase2_planning_handoff" | "phase3_controlled_execution_prerequisite";
}

export interface PlanningHandoffReadinessChecklistDto {
  readonly requiredApprovals: readonly string[];
  readonly sandboxBoundary: string;
  readonly rollbackReference: string;
  readonly expectedEvidence: readonly string[];
  readonly commandPreviewRequirements: readonly string[];
  readonly filePreviewRequirements: readonly string[];
  readonly browserPreviewRequirements: readonly string[];
}

export interface PlanningHandoffResidualRiskDto {
  readonly riskId: string;
  readonly riskClass: PlanningHandoffResidualRiskClass;
  readonly title: string;
  readonly severity: "low" | "medium" | "high";
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly assumption: string;
  readonly prerequisite: string;
  readonly validationDependency: string;
  readonly ownerRole: "frontend" | "backend" | "product" | "qa" | "docs" | "security" | "research";
  readonly followUpTrigger: string;
}

export interface PlanningHandoffBuildSlicePlanDto {
  readonly sliceGoal: string;
  readonly includedCapabilities: readonly string[];
  readonly nonGoals: readonly string[];
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly acceptanceCriteria: readonly string[];
  readonly smokeTests: readonly string[];
  readonly validationMetric: string;
  readonly residualRisks: readonly string[];
}

export interface PlanningHandoffServeEnvVarDto {
  readonly envVarName: string;
  readonly required: boolean;
  readonly present: boolean;
  readonly valueIncluded: false;
  readonly note?: string;
}

export interface PlanningHandoffServeChecklistDto {
  readonly serveTarget: string;
  readonly envVars: readonly PlanningHandoffServeEnvVarDto[];
  readonly publicUrl?: string;
  readonly authAndPrivacyCheck: string;
  readonly smokeTestChecklist: readonly string[];
  readonly rollbackPlan: string;
  readonly launchNote: string;
  readonly learningMetrics: readonly string[];
}

export type PlanningHandoffLearningDecisionOption = "pivot" | "persevere" | "narrow_scope" | "next_slice";

export interface PlanningHandoffLearningLoopHookDto {
  readonly signalsToCollect: readonly string[];
  readonly interpretationFrame: string;
  readonly decisionOptions: readonly PlanningHandoffLearningDecisionOption[];
  readonly recommendedNextSliceRule: string;
  readonly riskUpdateRule: string;
}

export interface PlanningHandoffArtifactDto {
  readonly artifactId: string;
  readonly kind: "PlanningHandoffArtifact";
  readonly schemaVersion: "solo-superman.phase2-planning-handoff.v1";
  readonly createdAt: string;
  readonly createdBy: "user" | "product_engine" | "system";
  readonly status: "planning_ready";
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly gateVerdict: PlanningHandoffGateVerdictDto & { readonly verdict: "planning_ready" };
  readonly scopeSnapshot: PlanningHandoffRequestedScopeDto;
  readonly taskBreakdown: readonly PlanningHandoffTaskDto[];
  readonly prIssuePlan: readonly PlanningHandoffPrIssuePlanItemDto[];
  readonly buildSlicePlan: PlanningHandoffBuildSlicePlanDto;
  readonly serveChecklist: PlanningHandoffServeChecklistDto;
  readonly learningLoopHook: PlanningHandoffLearningLoopHookDto;
  readonly readinessChecklist: PlanningHandoffReadinessChecklistDto;
  readonly residualRiskRegister: readonly PlanningHandoffResidualRiskDto[];
  readonly phase15bHintMapping: readonly PlanningHandoffSourceRefDto[];
  readonly noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation";
  readonly handoffSummary: string;
}

export interface PlanningHandoffBlockerDto {
  readonly blockerId: string;
  readonly blockerClass: PlanningHandoffBlockerClass | "source_trace" | "queue_review";
  readonly queueItemId?: string;
  readonly currentOutcome?: PlanningHandoffQueueOutcome;
  readonly whyFatal: string;
  readonly requiredNextAction: PlanningHandoffRequiredUserAction;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
}

export interface PlanningHandoffBlockerArtifactDto {
  readonly artifactId: string;
  readonly kind: "PlanningHandoffBlockerArtifact";
  readonly schemaVersion: "solo-superman.phase2-planning-handoff-blocker.v1";
  readonly createdAt: string;
  readonly createdBy: "user" | "product_engine" | "system";
  readonly status: Exclude<PlanningHandoffVerdict, "planning_ready">;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly gateVerdict: PlanningHandoffGateVerdictDto & { readonly verdict: Exclude<PlanningHandoffVerdict, "planning_ready"> };
  readonly blockers: readonly PlanningHandoffBlockerDto[];
  readonly residualRisks: readonly PlanningHandoffResidualRiskDto[];
  readonly requiredUserActions: readonly PlanningHandoffRequiredUserAction[];
  readonly safePreviewRefs: readonly PlanningHandoffSourceRefDto[];
  readonly noFinalLabelRule: "must_not_use_planning_ready_label";
}
```

### Projection DTO

```ts
export type PlanningHandoffProjection =
  | {
      readonly kind: "PlanningHandoffProjection";
      readonly sessionId: SessionId;
      readonly version: ProjectionVersion;
      readonly currentStatus: "planning_ready";
      readonly finalArtifact: PlanningHandoffArtifactDto;
      readonly blockerArtifact?: never;
      readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
      readonly summary: string;
      readonly refetchUrl: string;
    }
  | {
      readonly kind: "PlanningHandoffProjection";
      readonly sessionId: SessionId;
      readonly version: ProjectionVersion;
      readonly currentStatus: Exclude<PlanningHandoffVerdict, "planning_ready">;
      readonly finalArtifact?: never;
      readonly blockerArtifact: PlanningHandoffBlockerArtifactDto;
      readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
      readonly summary: string;
      readonly refetchUrl: string;
    };
```

Projection rules:

- `finalArtifact` and `blockerArtifact` are mutually exclusive.
- `refetchUrl` is `/api/v1/sessions/{sessionId}/planning-handoff`.
- If no handoff artifact exists yet, GET returns `ApiSuccessEnvelope<PlanningHandoffProjection | null>` with `data: null`; missing session remains `RESOURCE_NOT_FOUND`.

## 2. Gate algorithm exact default

`CreatePlanningHandoff` computes the verdict before artifact creation. The reducer never calls DB, Hono, Codex, filesystem, shell, browser, network, or external services.

### Source-of-truth inputs

| Input | Source of truth | Required for final? |
| --- | --- | --- |
| Living Product Spec | current `SpecVersion`/LivingSpecProjection ref | yes |
| Completion Candidate or Founder Brief | `ConfidenceCompletionProjection.completionCandidate` or `FounderBriefProjection` | yes |
| Decision-linked Evidence Pack | `ResearchEvidenceProjection.evidenceMatrices` and linked decision/source refs | yes |
| Research-updated Queue | `DecisionQueueProjection` plus research review card refs | yes |
| Risk acceptance | `DecisionSnapshot.status = risk_accepted` or linked decision sourceRef | yes when fatal risk remains |
| Known Risks/Open Questions | `ConfidenceCompletionProjection.topRiskCards`, Founder Brief known risks, research known risks | yes for residual risk visibility |
| Phase 1.5B hints | `phase15bUpgradeHints` refs on runtime/hint sources | no, unless present |

### Verdict precedence

1. Return `source_trace_incomplete` when any required source ref is missing, stale, or not found in the loaded state snapshot.
2. Return `queue_review_incomplete` when any high-impact Research-updated Queue card lacks a terminal `PlanningHandoffQueueOutcome`.
3. Return `blocked_by_fatal` when a fatal blocker class has unresolved, `research_insufficient`, or `deferred` outcome without explicit `risk_accepted` source. A `deferred` source must preserve its user-visible rationale separately.
4. Return `needs_risk_acceptance` when a fatal blocker candidate is fully described and safe to present to the user for explicit `risk_accept`, but no such acceptance exists yet.
5. Return `planning_ready` only when all required source traces are current, all high-impact queue items are terminal, fatal blockers are resolved or risk-accepted, and non-fatal gaps are visible in `residualRiskRegister`.

### Fatal and non-fatal mapping

| Planning class | DTO class | Gate behavior |
| --- | --- | --- |
| 고객/문제/JTBD | `customer_problem_jtbd` | fatal; blocks unless resolved or risk-accepted |
| 성공기준/검증계획 | `success_metrics_validation` | fatal; blocks unless resolved or risk-accepted |
| 승인/보안/실행안전 | `approval_security_execution_safety` | fatal; blocks unless resolved or risk-accepted |
| 가치제안/차별화 | `value_proposition_differentiation` | non-fatal when visible as residual risk |
| MVP 범위/비범위 | `mvp_scope_non_scope` | non-fatal when visible as residual risk |
| Phase 1.5B readiness gap | `phase15b_readiness_gap` | non-fatal unless it hides required approval/security evidence |

Gate failure is not runtime `blocked`. It is an accepted ProductEngine command that persists `PlanningHandoffBlockerArtifactDto` whenever validation and state-version checks pass.

## 3. Storage schema exact default

후속 storage PR은 `20-data-storage-contract.md`의 table group names를 아래 columns/indexes로 구현한다. Full artifact JSON is stored for forward compatibility, while source/task/PR/risk rows are normalized for query and projection recovery.

### `planning_handoffs`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text primary key | `handoff_` prefix; deterministic from idempotency key |
| `project_id` | text not null | project scope |
| `session_id` | text not null | session scope |
| `source_command_id` | text not null | `CreatePlanningHandoff` command id |
| `source_event_id` | text not null | `PlanningHandoffCreated` or `PlanningHandoffBlocked` event id |
| `artifact_kind` | text not null | `PlanningHandoffArtifact` or `PlanningHandoffBlockerArtifact` |
| `status` | text not null | artifact status/verdict |
| `gate_verdict` | text not null | `PlanningHandoffVerdict` |
| `source_state_version` | integer not null | command `expectedStateVersion` |
| `summary` | text not null | safe Korean-first summary |
| `artifact_json` | text not null | full final/blocker artifact DTO |
| `created_by` | text not null | `user`, `product_engine`, or `system` |
| `created_at` | text not null | ISO time |
| `schema_version` | text not null | artifact schema version |

Indexes:

- `planning_handoffs_session_created_idx` on `(session_id, created_at)`.
- `planning_handoffs_source_command_idx` unique on `(source_command_id)`.
- `planning_handoffs_session_verdict_idx` on `(session_id, gate_verdict)`.

Current-state rule:

- `planning_handoffs` is append-only history.
- Current projection is the latest row for a session ordered by `created_at DESC, id DESC`.
- Do not add `is_current`; avoid SQLite partial-unique ambiguity and use projection rebuild order instead.

### `planning_handoff_sources`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text primary key | `handoff_src_` prefix |
| `handoff_id` | text not null | parent handoff id |
| `source_type` | text not null | `PlanningHandoffSourceType` |
| `source_id` | text not null | referenced object id/ref |
| `source_label` | text nullable | display/debug label |
| `required` | integer boolean not null | required for verdict |
| `stale` | integer boolean not null | stale source marker |
| `created_at` | text not null | ISO time |

Indexes:

- `planning_handoff_sources_handoff_idx` on `(handoff_id)`.
- `planning_handoff_sources_source_idx` on `(source_type, source_id)`.

### `planning_handoff_tasks`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text primary key | `taskId` |
| `handoff_id` | text not null | parent handoff id |
| `sequence_order` | integer not null | display/execution order |
| `title` | text not null | task title |
| `intent` | text not null | why this task exists |
| `owner_role` | text not null | `PlanningHandoffTaskDto.ownerRole` |
| `source_refs_json` | text not null | source refs array |
| `depends_on_json` | text not null | task ids array |
| `acceptance_evidence_json` | text not null | evidence strings array |
| `non_goals_json` | text not null | strings array |
| `risk_refs_json` | text not null | risk ids array |

Index: `planning_handoff_tasks_handoff_order_idx` on `(handoff_id, sequence_order)`.

### `planning_handoff_pr_issue_items`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text primary key | `sequenceId` |
| `handoff_id` | text not null | parent handoff id |
| `sequence_order` | integer not null | PR/issue order |
| `summary` | text not null | PR-sized outcome |
| `included_task_ids_json` | text not null | task ids array |
| `entry_prerequisites_json` | text not null | strings array |
| `exit_evidence_json` | text not null | strings array |
| `blocked_by_json` | text not null | sequence ids array |
| `phase_boundary` | text not null | `phase2_planning_handoff` or `phase3_controlled_execution_prerequisite` |

Index: `planning_handoff_pr_issue_items_handoff_order_idx` on `(handoff_id, sequence_order)`.

### `planning_handoff_risks`

| Column | Type | Rule |
| --- | --- | --- |
| `id` | text primary key | risk/blocker/action id |
| `handoff_id` | text not null | parent handoff id |
| `risk_kind` | text not null | `residual_risk`, `assumption`, `prerequisite`, `validation_dependency`, `blocker_next_action`, or `required_user_action` |
| `risk_class` | text not null | blocker/residual/source trace class |
| `severity` | text not null | `low`, `medium`, or `high` |
| `title` | text not null | risk/action title |
| `source_refs_json` | text not null | source refs array |
| `owner_role` | text not null | owner role |
| `follow_up_trigger` | text not null | trigger text |
| `required_action` | text nullable | `PlanningHandoffRequiredUserAction` when applicable |

Indexes:

- `planning_handoff_risks_handoff_idx` on `(handoff_id)`.
- `planning_handoff_risks_class_idx` on `(risk_class, severity)`.

Projection persistence:

- `PlanningHandoffProjection` is also saved in the existing generic `projections` table with `projection_kind = "PlanningHandoffProjection"`.
- `planningHandoffRepository` saves the handoff row, normalized child rows, and projection in the same transaction after the source event is appended.

## 4. Command, idempotency, and response behavior

### ProductEngine additions

| Surface | Exact default |
| --- | --- |
| CommandType | `CreatePlanningHandoff` |
| EventType on final | `PlanningHandoffCreated` |
| EventType on blocker | `PlanningHandoffBlocked` |
| ProjectionKind | `PlanningHandoffProjection` |
| Deterministic output type | `planning_handoff_artifact` |
| Reducer function | `reduceCreatePlanningHandoff` |

Command rules:

- `CreatePlanningHandoff` is deterministic and queues no `ProductEngineEffectPlanItem`.
- `ConvertRuntimeArtifact` must reject any target that attempts final `PlanningHandoffArtifact` creation.
- `PlanningHandoffCreated` and `PlanningHandoffBlocked` event payloads include `artifactId`, `verdict`, `artifactKind`, `sourceRefs`, `projection`, and `summary`.

### Idempotency

Default formula:

```text
CreatePlanningHandoff:{sessionId}:{expectedStateVersion}:{sha256(normalizedSourceRefs)}:{sha256(normalizedRequestedScopeOrDerivedScope)}
```

Artifact id formula:

```text
handoff_{first32hex(sha256(CreatePlanningHandoff:{sessionId}:{expectedStateVersion}:{sha256(normalizedSourceRefs)}:{sha256(normalizedRequestedScopeOrDerivedScope)}))}
```

Rules:

- `normalizedSourceRefs` is sorted by `sourceType + ":" + sourceId` before hashing.
- Missing `requestedScope` hashes the ProductEngine-derived scope snapshot.
- Reducer artifact identity is derived from the canonical handoff material above, not from a caller-specific raw retry id. Reordering `sourceRefs`, `nonGoals`, `assumptions`, or `excludedInternalPhases` must not change artifact identity when the semantic handoff input is unchanged.
- Identical retry at the same state version returns or upserts the same handoff artifact/projection.
- Same session with a later `expectedStateVersion` creates a new append-only handoff row.

### Response category

| Case | Response |
| --- | --- |
| malformed body | `rejected` with `VALIDATION_FAILED`, no event |
| stale `expectedStateVersion` | `rejected` with `STATE_VERSION_CONFLICT`, no event |
| missing session | `rejected` with `RESOURCE_NOT_FOUND`, no event |
| source trace semantic gap | `accepted_with_projection` with `PlanningHandoffBlockerArtifactDto`, no `statusUrl` |
| queue review incomplete | `accepted_with_projection` with `PlanningHandoffBlockerArtifactDto`, no `statusUrl` |
| fatal blocker / needs risk acceptance | `accepted_with_projection` with `PlanningHandoffBlockerArtifactDto`, no `statusUrl` |
| planning ready | `accepted_with_projection` with `PlanningHandoffArtifactDto`, no `statusUrl` |

`blocked` remains reserved for runtime/security policy blocks such as forbidden execution attempts, not for Phase 2 planning gate failure.

## 5. API route exact defaults

#42 Contracts PR은 `26-api-route-behavior-catalog.md`의 endpoint를 아래 route catalog placeholder values로 승격한다. 후속 API PR은 이 route catalog placeholder를 Hono handler와 persistence path에 연결한다.

| routeId | clientName | Method/path | commandType |
| --- | --- | --- | --- |
| `createPlanningHandoff` | `createPlanningHandoff` | `POST /api/v1/sessions/:sessionId/planning-handoff` | `CreatePlanningHandoff` |
| `getPlanningHandoff` | `getPlanningHandoff` | `GET /api/v1/sessions/:sessionId/planning-handoff` | `none` |

POST behavior:

- Route param `sessionId` must equal body `sessionId` if the body carries it.
- Request body uses `CreatePlanningHandoffRequest`.
- Response is `CommandResponse<PlanningHandoffProjection>` with `category = "accepted_with_projection"` for both final and blocker artifacts.
- No `statusUrl`, no effect task ids, no Codex runtime effect.
- Refetch hint, when emitted, targets `/api/v1/sessions/{sessionId}/planning-handoff`.

GET behavior:

- Existing session with no handoff returns `ApiSuccessEnvelope<PlanningHandoffProjection | null>` with `data: null`.
- Missing session returns `ApiErrorEnvelope` with `RESOURCE_NOT_FOUND`.
- GET never creates ProductEngine events/effects.

SSE/refetch default:

- If the codebase already has `projection.updated`, use it with `projectionKind = "PlanningHandoffProjection"`.
- Do not add a new SSE event name solely for Planning Handoff unless the route/projection PR updates `25` and the verifier together.

## 6. Implementation sequencing default

This is not a GitHub issue draft. It is the required follow-up code PR order for Phase 2 implementation after the preflight contract exists on `main`.

1. **Contracts PR (#42)**: add DTOs, command/event/projection taxonomy, request/response exports, fixtures, and docs/25/26 parsed tables plus verifier updates.
2. **ProductEngine gate PR**: implement `reduceCreatePlanningHandoff`, verdict precedence, no-execution enforcement, `ConvertRuntimeArtifact` guard, reducer tests.
3. **Storage/projection PR**: add Drizzle schema/migration, planningHandoffRepository, projection persistence, migration tests.
4. **Sidecar/API PR**: wire the route catalog placeholders to Hono handlers, command service persistence path, GET projection query, and API tests.
5. **UI/fixture/docs sync PR**: add read-only Planning-ready/blocker display surface, sample fixture coverage, docs acceptance refresh.

Sequencing rules:

- Do not start storage/API/UI PRs before the Contracts PR (#42) lands.
- Do not expose a user-facing `Planning-ready` label before ProductEngine gate tests prove `planning_ready` and blocker paths.
- Do not create Phase 3 execution capability in any Phase 2 handoff PR.

## 7. Phase 1.5 dependency handling

Phase 2 implementation may depend on Phase 1.5A/B artifacts, but it must not silently implement Phase 1.5 features inside Phase 2 code PRs.

Exact defaults:

- `phase15bUpgradeHints` are optional source refs. If present, map them into `readinessChecklist`, `phase15bHintMapping`, and blocker `requiredUserActions` without reinterpreting them as execution permission.
- `30-phase1.5-research-runtime-and-readiness-contract.md` remains the source of truth for Phase 1.5B readiness metadata semantics; this document only defines Phase 2 implementation defaults for consuming those hints.
- Missing `phase15bUpgradeHints` does not block final handoff by itself.
- Missing current SpecVersion, Completion Candidate/Founder Brief, Evidence Pack, or terminal Research-updated Queue source creates `source_trace_incomplete` or `queue_review_incomplete` blocker artifact.
- If Phase 1.5A Research-updated Queue is not yet implemented in code, the first Phase 2 code PR must either depend on the Phase 1.5 implementation PR or produce a persisted blocker artifact; it must not fake a final handoff from preview-only data.
- `ImplementationPlanPreviewArtifact` and `phase15bUpgradeHints` may appear only as `safePreviewRefs` or readiness metadata. They cannot create final `PlanningHandoffArtifact` without the gate algorithm above.

## Acceptance checklist

- [ ] `docs/32-phase2-implementation-preflight-contract.md` is referenced from README and owner docs.
- [ ] The seven decisions are exact enough for Phase 2 implementation PRs to proceed without choosing DTO names, enum values, route ids, storage columns, idempotency, gate precedence, or Phase 1.5 fallback behavior.
- [ ] The document does not add GitHub issue draft content.
- [ ] The document does not imply reducer/storage/API handler/UI behavior or Phase 3 execution changes in the Contracts PR (#42).
- [ ] Phase 2 contract names are promoted into parsed docs/25 enum/projection tables and docs/26 current route catalog rows only in the Contracts PR (#42), together with code and verifier updates.
