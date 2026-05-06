# 31. Phase 2 Planning Handoff Contract

## 목적

이 문서는 Phase 2 Execution Planning Handoff의 canonical 구현 준비 계약이다. 목표는 `Planning-ready` handoff를 만들 때 구현자가 artifact 종류, gate 판정, PR/issue/task breakdown, readiness evidence, residual risk 표시를 다시 결정하지 않게 하는 것이다.

`11-roadmap-and-phase-boundaries.md`가 Phase 2의 범위와 진입 조건을, `28-founder-os-product-doctrine.md`가 gate doctrine을, `29-phase-capability-implementation-matrix.md`가 capability matrix를 정의한다면, 이 문서는 **Phase 2 handoff artifact schema와 blocker report 계약**을 소유한다.

Canonical path: `docs/31-phase2-planning-handoff-contract.md`.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Canonical source | Phase 2 Planning Handoff artifact/report schema는 이 문서가 소유 |
| Final artifact | `PlanningHandoffArtifact`는 final `Planning-ready` handoff 전용 |
| Blocker artifact | fatal blocker, gate 실패, 부분충족은 `PlanningHandoffBlockerArtifact` 또는 동등한 blocker report로 분리 |
| Preview boundary | `ImplementationPlanPreviewArtifact`는 Phase 1/1.5B preview-only planning note이며 final handoff가 아니다 |
| Field depth | 전체 추적형 계약: sourceRefs, gate verdict, task/PR/issue plan, Build Slice Plan, Serve Checklist, Learning Loop hook, readiness checklist, residual risk, Phase 1.5B hints mapping을 모두 필수 field family로 둠 |
| Execution boundary | Phase 2는 실행계획 handoff까지이며 file patch, shell command, browser action, deploy, external mutation을 실행하지 않음 |
| User-facing label | `Planning-ready`는 final `PlanningHandoffArtifact`가 생성될 때만 사용할 수 있음 |
| Code boundary | #42 Contracts PR은 `packages/contracts` DTO/command/event/projection/route placeholder와 verifier sync만 승격한다. reducer behavior, storage schema, API handler, UI 구현은 후속 Phase 2 구현 PR이 소유 |

## Phase 2 source inputs

`PlanningHandoffArtifact` 또는 blocker report는 다음 source를 trace해야 한다.

| Source | Required | Purpose |
| --- | --- | --- |
| Living Product Spec | yes | 구현할 제품 결정, non-goal, success criteria의 기준 snapshot |
| Founder Brief / Completion Candidate | yes | 사용자-facing 요약과 Known Risks가 숨겨지지 않았는지 확인 |
| Decision-linked Evidence Pack | yes | high-impact claim/decision의 pro/con/uncertainty와 source quality 근거 |
| Research-updated Queue | yes | Phase 2 gate 대상 card와 terminal outcome source of truth |
| Known Risks / Open Questions | yes | low/medium 또는 non-fatal residual risk를 planning context에 보존 |
| Build/Serve/Learning Loop contract | yes | 다음 구현 조각, 서빙 준비, 사용자 반응 학습 기준을 `33-build-slice-serve-learning-loop.md` 기준으로 보존 |
| Phase 1.5B hints | yes if present | approval, sandbox, rollback, expected evidence, risk metadata 재사용 |
| Audit/activity refs | yes if present | 사용자 승인, risk acceptance, defer reason, manual handoff source trace |

## Gate verdict contract

Phase 2 gate verdict는 artifact 생성 전에 먼저 계산된다.

| Verdict | Meaning | Allowed output |
| --- | --- | --- |
| `planning_ready` | fatal blocker가 없고 residual risk가 숨겨지지 않음 | `PlanningHandoffArtifact` |
| `blocked_by_fatal` | fatal blocker class가 unresolved, `research_insufficient`, 또는 사용자 승인 없는 `deferred` 상태 | `PlanningHandoffBlockerArtifact` / blocker report |
| `needs_risk_acceptance` | fatal blocker 후보가 남았지만 사용자가 명시적으로 risk acceptance를 선택할 수 있음 | `PlanningHandoffBlockerArtifact` / blocker report |
| `queue_review_incomplete` | Research-updated Queue 검토가 끝나지 않았거나 terminal outcome이 빠짐 | `PlanningHandoffBlockerArtifact` / blocker report |
| `source_trace_incomplete` | Spec/Evidence/Queue sourceRef가 부족해 final trace를 만들 수 없음 | `PlanningHandoffBlockerArtifact` / blocker report |

Gate 규칙:

- `고객/문제/JTBD`, `성공기준/검증계획`, `승인/보안/실행안전` class는 fatal blocker class다.
- fatal blocker class가 unresolved, `research_insufficient`, 또는 사용자 승인 없는 `deferred`이면 final `PlanningHandoffArtifact`를 생성하지 않는다.
- fatal blocker class는 resolved 상태가 되거나, 사용자가 남은 위험과 이유를 명시적으로 `risk_accepted` 해야 통과한다.
- `가치제안/차별화`, `MVP 범위/비범위`의 부족분은 fatal blocker가 아니다. 다만 final artifact의 residual risk, prerequisite, assumption, validation dependency에 명시되어야 한다.
- low/medium risk는 Known Risks, Open Questions, prerequisite로 유지할 수 있다.
- `Planning-ready` label은 `verdict = planning_ready`인 final artifact에만 붙인다.

## `PlanningHandoffArtifact` field contract

`PlanningHandoffArtifact`는 final handoff 전용이다. 이 artifact가 존재한다는 것은 Phase 2 gate가 통과됐고, 다음 구현자가 PR/issue/task plan을 읽고 Phase 3 이전의 준비 작업을 시작할 수 있음을 뜻한다.

| Field family | Required | Required content |
| --- | --- | --- |
| `identity` | yes | `artifactId`, `kind = PlanningHandoffArtifact`, `schemaVersion = solo-superman.phase2-planning-handoff.v1`, `createdAt`, `createdBy` |
| `status` | yes | `planning_ready` only. blocked/provisional status는 이 artifact에 넣지 않음 |
| `sourceRefs` | yes | SpecVersion, Founder Brief/Completion Candidate, Evidence Pack, Research-updated Queue, Decision/Risk Acceptance, Known Risk/Open Question, Phase 1.5B hint refs |
| `gateVerdict` | yes | `verdict = planning_ready`, reviewed queue card ids, terminal outcome summary, fatal blocker classes checked, residual risk visibility check |
| `scopeSnapshot` | yes | 구현 대상 product slice, explicit non-goals, excluded phases, user-facing journey label, current assumptions |
| `taskBreakdown` | yes | task id/title/intent, source refs, dependency, owner role, acceptance evidence, non-goals, linked risk/validation dependency |
| `prIssuePlan` | yes | proposed issue/PR sequence, dependency order, PR-sized slicing rationale, blocked-by/prerequisite links |
| `buildSlicePlan` | yes | 이번 한 번의 구현 사이클에서 만들 가장 작고 검증 가능한 product slice, 포함/제외 범위, acceptance evidence |
| `serveChecklist` | yes | 배포 대상 후보, env/secrets gap, privacy check, smoke test, rollback note, launch note, metric 후보. 실제 deploy 실행 권한은 아님 |
| `learningLoopHook` | yes | Served MVP 이후 수집할 feedback/usage signal, 해석 기준, pivot/persevere decision 후보, 다음 Build Slice trigger |
| `readinessChecklist` | yes | required approvals, sandbox/worktree boundary, rollback reference, expected evidence, command/file/browser preview requirements |
| `residualRiskRegister` | yes | visible residual risk, assumptions, prerequisites, validation dependencies, owner/follow-up trigger |
| `phase15bHintMapping` | yes | Phase 1.5B hint refs mapped to approval, sandbox, rollback, expected evidence, risk normalization |
| `noExecutionPolicy` | yes | explicit statement that Phase 2 does not apply file patch, run shell, perform browser action, deploy, or mutate external systems |
| `handoffSummary` | yes | Korean-first summary that is safe to show as final Planning-ready context without hiding remaining risk |

Build/Serve/Learning field family의 세부 의미는 `33-build-slice-serve-learning-loop.md`를 따른다. 이 문서는 final handoff artifact에 해당 field family가 있어야 한다는 trace requirement를 소유하고, Phase 3 실행 adapter나 배포 구현을 소유하지 않는다.

### `taskBreakdown` minimum item

| Field | Required | Rule |
| --- | --- | --- |
| `taskId` | yes | local deterministic id or future issue placeholder |
| `title` | yes | 구현 의도 중심의 짧은 제목 |
| `intent` | yes | 왜 이 task가 필요한지, 어떤 source decision/risk에서 나왔는지 설명 |
| `sourceRefs` | yes | Spec/Evidence/Queue/Decision refs 중 하나 이상 |
| `dependsOn` | yes | 없으면 empty array |
| `ownerRole` | yes | frontend/backend/product/qa/docs/security/research 등 역할 단위 |
| `acceptanceEvidence` | yes | 테스트, dry-run, fixture, manual inspection, artifact path 등 |
| `nonGoals` | yes | 이 task에서 하지 않을 것 |
| `riskRefs` | yes | 관련 residual risk/prerequisite/validation dependency refs, 없으면 empty array |

### `prIssuePlan` minimum item

| Field | Required | Rule |
| --- | --- | --- |
| `sequenceId` | yes | PR/issue 실행 순서 식별자 |
| `summary` | yes | PR-sized slice가 달성할 outcome |
| `includedTaskIds` | yes | `taskBreakdown` item과 연결 |
| `entryPrerequisites` | yes | 시작 전에 필요한 승인/source/evidence/sandbox 조건 |
| `exitEvidence` | yes | 완료 주장에 필요한 검증 evidence |
| `blockedBy` | yes | 없으면 empty array |
| `phaseBoundary` | yes | Phase 2 planning, Phase 3 controlled execution 등 내부 boundary |

## `PlanningHandoffBlockerArtifact` / blocker report contract

`PlanningHandoffBlockerArtifact` 또는 동등한 blocker report는 final handoff를 대체하지 않는다. 이 report는 왜 `Planning-ready`가 아닌지, 어떤 사용자 결정/리서치/승인이 필요하지를 보여준다.

| Field family | Required | Required content |
| --- | --- | --- |
| `identity` | yes | `artifactId`, `kind = PlanningHandoffBlockerArtifact`, `schemaVersion = solo-superman.phase2-planning-handoff-blocker.v1`, `createdAt` |
| `status` | yes | `blocked_by_fatal`, `needs_risk_acceptance`, `queue_review_incomplete`, or `source_trace_incomplete` |
| `sourceRefs` | yes | blocking queue card, Evidence Pack, Spec section, Decision/Risk Acceptance refs |
| `blockers` | yes | blocker class, card id, current outcome, why fatal, required next action |
| `residualRisks` | yes | non-fatal residual risks that may later enter final artifact if visible |
| `requiredUserActions` | yes | approve/revise/reject/defer-with-reason/risk_accept/research_more 중 가능한 next action |
| `safePreviewRefs` | yes | existing `ImplementationPlanPreviewArtifact` or planning note refs if present |
| `noFinalLabelRule` | yes | `Planning-ready` label and final handoff copy must not be used |

Blocker report는 task/PR/issue plan을 final처럼 보여주지 않는다. 필요하면 safe preview refs를 연결하되, final artifact로 승격하려면 gate verdict를 다시 계산해야 한다.

## Phase 1.5B hint mapping

Phase 1.5B `phase15bUpgradeHints`는 실행 권한이 아니라 Phase 2 handoff의 readiness metadata source다.
`30-phase1.5-research-runtime-and-readiness-contract.md` remains the source of truth for Phase 1.5B readiness semantics; this document only maps those hints into Phase 2 handoff fields without treating hints as execution permission.

| Phase 1.5B field family | Phase 2 mapping |
| --- | --- |
| `approvalRequirements` | `readinessChecklist.requiredApprovals`와 blocker `requiredUserActions` |
| `sandboxRequirements` | `readinessChecklist.sandboxBoundary`와 PR/issue `entryPrerequisites` |
| `rollbackReference` | `readinessChecklist.rollbackReference`와 Phase 3 준비 조건 |
| `expectedEvidence` | `taskBreakdown[].acceptanceEvidence`와 `prIssuePlan[].exitEvidence` |
| `riskNormalization` | `gateVerdict`, `residualRiskRegister`, blocker `blockers[].whyFatal` |
| `sourceRefs` | artifact-level `sourceRefs`와 task/PR/issue source trace |
| `createdAt` / `schemaVersion` | stale hint detection과 migration 없이 읽기 위한 compatibility check |

Mapping rule:

- hint가 존재하면 final artifact 또는 blocker report는 이를 sourceRef로 남긴다.
- hint가 실행을 암시하는 field처럼 보이더라도 Phase 2에서는 readiness metadata로만 해석한다.
- missing hint는 final handoff를 자동으로 막지 않는다. 다만 approval/sandbox/rollback/expected evidence가 필요한 task라면 `readinessChecklist` 또는 blocker report에 gap을 표시한다.

## Relationship to `ImplementationPlanPreviewArtifact`

`ImplementationPlanPreviewArtifact`는 Phase 1/1.5B Codex prompt output 계약의 preview-only artifact다.

| Artifact | Phase | Meaning | Final handoff? |
| --- | --- | --- | --- |
| `ImplementationPlanPreviewArtifact` | Phase 1/1.5B | planning note, safe preview, readiness hints preservation | no |
| `PlanningHandoffBlockerArtifact` | Phase 2 | final handoff가 막힌 이유와 필요한 next action | no |
| `PlanningHandoffArtifact` | Phase 2 | gate 통과 후 final Planning-ready handoff | yes |

`ImplementationPlanPreviewArtifact`를 `PlanningHandoffArtifact`로 자동 승격하지 않는다. 승격하려면 Research-updated Queue gate, sourceRefs, residual risk visibility, readiness checklist를 이 문서 기준으로 다시 검증해야 한다.

## Implementation-layer binding

이 문서는 artifact/report schema의 canonical source다. 후속 Phase 2 구현 PR은 아래 문서의 implementation contract와 함께 읽어야 한다. #42는 DTO/command/event/projection/route placeholder와 verifier sync를 담당하며, reducer/storage/API handler/UI behavior는 별도 후속 PR 범위다.

| Layer | Owning document | Binding |
| --- | --- | --- |
| Storage | `20-data-storage-contract.md` | `planning_handoffs`, `planning_handoff_sources`, `planning_handoff_tasks`, `planning_handoff_pr_issue_items`, `planning_handoff_risks`, `planningHandoffRepository`, `planningHandoffProjection` |
| Runtime/API command boundary | `21-sidecar-api-runtime-contract.md` | `CreatePlanningHandoff`가 final/blocker artifact를 만들며 `ConvertRuntimeArtifact`는 preview-only planning note boundary를 넘지 않는다. |
| DTO/contracts | `25-contracts-dto-catalog.md` | `CreatePlanningHandoffRequest`, `PlanningHandoffProjection`, `PlanningHandoffArtifactDto`, `PlanningHandoffBlockerArtifactDto`, supporting DTO family, events `PlanningHandoffCreated`/`PlanningHandoffBlocked` |
| Route behavior | `26-api-route-behavior-catalog.md` | `POST`/`GET` planning-handoff endpoint behavior, `accepted_with_projection`, persisted blocker artifact semantics |
| Implementation preflight | `32-phase2-implementation-preflight-contract.md` | exact DTO wire shape, gate precedence, storage columns/indexes, idempotency, routeId/clientName, implementation sequencing, Phase 1.5 dependency fallback |
| Dry-run acceptance | `12-validation-and-dry-run.md` | gate, DTO/API/storage, no-execution, parser-safe contract boundary checks |

Binding rules:

- DTO/API contract names are current in docs/25, docs/26, `packages/contracts`, and the doc-contract verifier after #42; reducer/storage/handler/UI behavior remains follow-up work.
- exact implementation defaults for those contract names are owned by `32-phase2-implementation-preflight-contract.md`.
- gate failure output is a durable blocker artifact whenever safe to persist, not just a transient error response.
- final and blocker artifacts share source trace/readiness/risk semantics but only final `PlanningHandoffArtifact` may carry the user-facing `Planning-ready` label.
- Build Slice, Serve Checklist, Learning Loop hook은 final artifact에 포함되어도 no-execution policy 아래의 planning context다. 이 field를 근거로 file patch, shell command, browser action, deploy, external mutation을 실행하면 안 된다.

## Non-goals

- Product runtime artifact kind enum 또는 Codex artifact taxonomy에 Planning Handoff 값을 추가하지 않는다.
- API route handler, storage schema, repository, ProductEngine reducer, sidecar runtime conversion을 구현하지 않는다.
- `verify-doc-contracts`에 doc 31 전용 guard를 추가하지 않는다. #42는 docs/25와 docs/26의 current parsed contract table sync만 유지한다.
- file patch, shell command, browser action, deploy, external mutation 실행 capability를 만들지 않는다.
- Build Slice, Serve Checklist, Learning Loop hook을 Phase 3 execution adapter 세부 설계로 확장하지 않는다.
- provisional plan을 final implementation plan처럼 표시하지 않는다.
- 사용자-facing UI copy source of truth를 이 문서로 옮기지 않는다.

## Acceptance checklist

- [ ] `PlanningHandoffArtifact`는 final `Planning-ready` 전용으로 설명된다.
- [ ] gate 실패/부분충족은 `PlanningHandoffBlockerArtifact` 또는 blocker report로 분리된다.
- [ ] `ImplementationPlanPreviewArtifact`는 preview-only planning note로 유지된다.
- [ ] final artifact는 sourceRefs, gate verdict, task/PR/issue plan, readiness checklist, residual risk, Phase 1.5B hint mapping을 모두 포함한다.
- [ ] final artifact는 Build Slice Plan, Serve Checklist, Learning Loop hook을 포함하되 no-execution policy를 함께 표시한다.
- [ ] blocker report는 `Planning-ready` label을 사용하지 않는다.
- [ ] fatal blocker class와 visible residual risk 규칙은 `28-founder-os-product-doctrine.md`와 충돌하지 않는다.
- [ ] Phase 2 handoff는 실제 file/shell/browser/deploy/external mutation을 실행하지 않는다.
- [ ] DTO/API contract names are current in code-synchronized enum/projection/route placeholder tables only after #42 updates packages and verifier together.
- [ ] exact DTO/gate/storage/API/idempotency/sequence defaults are delegated to `32-phase2-implementation-preflight-contract.md`.
- [ ] 후속 reducer/storage/API handler/UI 구현은 이 문서의 field family와 20/21/25/26번 binding을 기준으로 별도 PR에서 진행한다.
