# 30. Phase 1.5 Research Runtime and Readiness Contract

## 역할

이 문서는 Phase 1.5 구현자가 background research runtime과 execution-readiness metadata를 다시 설계하지 않도록 고정하는 canonical source다.

Phase 1.5는 하나의 기능 덩어리가 아니라 순차 번들이다.

1. **Phase 1.5A: Background Research Runtime** — 프로젝트 단위 allowlist 안에서 read-only external research task를 durable하게 실행·관측·취소·재시도한다.
2. **Phase 1.5B: Execution-readiness Hints** — later Phase 2/3 실행 계획이 재사용할 approval, sandbox, rollback, evidence, risk metadata를 저장·조회·export한다.

이 문서는 `06-research-engine.md`, `10-security-privacy-and-approval.md`, `11-roadmap-and-phase-boundaries.md`, `12-validation-and-dry-run.md`, `17-ai-runtime-access-strategy.md`, `20-data-storage-contract.md`, `21-sidecar-api-runtime-contract.md`, `23-product-engine-runtime-contract.md`, `24-codex-prompt-output-contract.md`, `25-contracts-dto-catalog.md`, `26-api-route-behavior-catalog.md`, `27-operations-observability-contract.md`, `28-founder-os-product-doctrine.md`, `29-phase-capability-implementation-matrix.md`의 Phase 1.5 체크리스트 기준이다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Canonical source | Phase 1.5A/B 상세 구현 계약은 이 문서가 소유 |
| Phase split | 1.5A Background Research Runtime → 1.5B Execution-readiness Hints 순서 |
| 1.5A authority | project-level allowlist 안의 read-only external research connector 자동 실행 가능 |
| 1.5A context boundary | public-safe summary + research objective까지만 자동 전송 |
| Private source | private document, full raw idea, detailed answers, credentialed source는 task-level approval 또는 manual handoff 필수 |
| 1.5A required governance | connector/source category, revoke/pause, audit/disclosure log, rate/budget/staleness limits |
| 1.5A required lifecycle | run state machine, provider run reference, cancel/pause/resume, retry/backoff/idempotency, result quality gate |
| 1.5B authority | hints 저장·조회·export only |
| 1.5B no-execution invariant | file/shell/browser/network write/credential/destructive/ChatGPT web automation 실행 금지 |
| Product axes | mobile, team collaboration, billing, remote sync, marketplace는 Phase 1.5 non-goal |
| Documentation shape | 새 canonical doc + 기존 책임 문서의 link/checklist |

## Non-negotiable boundary

Phase 1.5A에서 허용되는 것은 **read-only research**다. 다음은 Phase 1.5A/B 전체에서 금지한다.

- repo file patch 적용.
- shell command 실행.
- browser click/type/submit/action 실행.
- network write, external resource creation, external mutation.
- credential value 저장 또는 묵시적 credential 사용.
- destructive operation 실행.
- ChatGPT Pro web UI 자동 조작.
- project-level execution delegation 활성화.
- implementation task commitment를 실행 가능한 계획으로 확정.

`phase15bUpgradeHints`는 실행을 준비하는 metadata이지 실행 권한이 아니다. 구현자는 `executionEnabled`, `delegationActive`, `autoApply`, `canExecute`처럼 Phase 1.5에서 실제 실행을 암시하는 true 상태를 만들지 않는다.

## Phase 1.5A: Background Research Runtime

### Read-only connector definition

Read-only connector는 외부 source를 검색·조회·요약할 수 있지만, 외부 시스템 상태를 바꾸지 않는다.

| Allowed | Forbidden |
| --- | --- |
| public web/search read | form submit, POST/write action |
| official docs read | cloud resource create/update/delete |
| public dataset/academic source read | payment, legal, medical, financial action |
| user-provided public URL fetch | private account/session scraping |
| allowlisted API read endpoint | credential exfiltration or secret storage |

OpenClaw Background Task, Codex official path, search/research connector는 adapter 후보일 수 있다. Phase 1.5A 구현은 특정 provider가 아니라 아래 `BackgroundResearchRuntime` contract를 먼저 만족해야 한다.

### ResearchAllowlist contract

Project-level allowlist approval은 read-only research 자동 실행의 유일한 포괄 승인이다.

| Field | Required | Rule |
| --- | --- | --- |
| `allowlistId` | yes | project-local unique id |
| `projectId` | yes | allowlist owner project |
| `status` | yes | `active`, `paused`, `revoked` |
| `connectorIds` | yes | 허용 connector/provider ids |
| `sourceCategories` | yes | 허용 source category list |
| `contextMode` | yes | Phase 1.5A automatic mode는 `public_safe_summary` only |
| `rateBudgetPolicy` | yes | concurrency, per-session max, timeout, retry budget |
| `stalenessPolicy` | yes | freshness-sensitive task의 stale 기준 |
| `disclosureLogPolicy` | yes | every automatic run logs query/context/source summary |
| `approvedBy` | yes | user or project owner actor id |
| `approvedAt` | yes | ISO timestamp |
| `pausedAt` | conditional | `status = paused`일 때 필요 |
| `revokedAt` | conditional | `status = revoked`일 때 필요 |

Minimum Phase 1.5A defaults:

- max concurrent research runs per project: `2`.
- max automatic retries per run: `2`.
- default run timeout: `10 minutes`.
- retry backoff: first retry after `30 seconds`, second retry after `2 minutes`.
- stale-sensitive result becomes `stale` when the run exceeds the task freshness window or the source timestamp predates the task requirement.

### Source category policy

| Source category | Automatic with allowlist | Extra gate |
| --- | --- | --- |
| `public_web` | yes | public-safe summary only |
| `official_docs` | yes | public-safe summary only |
| `public_dataset` | yes | source URL/license captured |
| `academic_source` | yes | publication/date captured |
| `user_provided_public_url` | yes | URL must not require auth |
| `private_document` | no | task-level approval or manual handoff |
| `credentialed_source` | no | task-level explicit grant; no secret value in libSQL |
| `account_session_source` | no | Phase 2+ / separate approval model |

### Context disclosure policy

| Context material | Automatic external transfer | Required route |
| --- | --- | --- |
| research objective/query | allowed | disclosure log |
| 1-3 sentence public-safe summary | allowed | summary preview + audit log |
| raw idea full text | forbidden | task-level approval/manual handoff |
| detailed answers | forbidden | task-level approval/manual handoff |
| Living Spec section excerpt | task-level approval | section-level disclosure log |
| private document | task-level approval | source sensitivity disclosure |
| credential value/secret | never | OS secret ref only, no external transfer by default |

Public-safe summary builder rules:

- remove secrets, contact details, private customer names, unreleased partner names, private documents, and detailed answer text.
- preserve only product category, high-level customer/problem hypothesis, and research objective.
- store the exact summary sent in `ResearchDisclosureLog`.

### BackgroundResearchRun state machine

| Status | Meaning | Terminal |
| --- | --- | --- |
| `queued` | allowlist/precondition passed; waiting for execution | no |
| `running` | connector/provider run started | no |
| `paused` | allowlist or user pause prevents progress | no |
| `cancel_requested` | user requested cancel; provider may still be stopping | no |
| `cancelled` | run stopped without accepted result | yes |
| `needs_review` | provider returned result; quality gate/review pending | no |
| `accepted` | result passed quality gate and can connect to EvidenceMatrix | yes |
| `research_insufficient` | result exists but is weak/incomplete | yes |
| `failed` | connector/provider/runtime failure exhausted retries | yes |
| `stale` | result is too old for the task freshness requirement | yes |

Allowed transitions:

```text
queued -> running -> needs_review -> accepted
queued -> running -> needs_review -> research_insufficient
queued -> running -> failed
queued -> running -> stale
queued -> paused -> queued
running -> paused -> running
queued|running|paused -> cancel_requested -> cancelled
failed|stale|research_insufficient -> queued (manual retry only)
```

No terminal status returns to non-terminal without a new run id and explicit retry reason.

### Provider run reference

Every run stores a provider-neutral trace object.

| Field | Required | Rule |
| --- | --- | --- |
| `researchRunId` | yes | stable internal id |
| `researchTaskId` | yes | originating ResearchTask |
| `adapterKind` | yes | connector family, e.g. `codex_official`, `openclaw_candidate`, `web_search_readonly` |
| `adapterVersion` | yes | app adapter version, not provider marketing version |
| `providerRunId` | optional | external run id if provider returns one |
| `sourceCategory` | yes | source category used for allowlist match |
| `idempotencyKey` | yes | task objective + connector + context hash + allowlist version |
| `startedAt` | conditional | set when `running` |
| `completedAt` | conditional | set when terminal or `needs_review` result arrives |
| `attempt` | yes | 1-based attempt count |

### Revoke, pause, cancel, retry

- `revoked` allowlist blocks new automatic runs immediately.
- `paused` allowlist blocks new automatic runs and moves queued runs to `paused`.
- running runs receive cancel when connector supports cancellation; otherwise UI shows `cancel_requested` until provider returns terminal status or timeout marks `failed`.
- retry requires same idempotency base plus incremented attempt.
- automatic retry is allowed only for transient connector/runtime failure and timeout, never for policy/precondition/approval failure.
- manual retry must show the prior failure reason and disclosure summary.

### Result quality gate

A completed provider run is not automatically accepted evidence. It must pass the Pro/Con Evidence Gate from `15-pro-con-evidence-gate.md` and Research Engine quality rules.

Minimum gate checks:

- source URL/title/date captured when available.
- source reliability is not `low` for high-impact claims.
- pro and con evidence are both present or `missing_con_evidence` is explicitly recorded.
- limitations are connected to Known Risks or Next Validation Actions.
- stale-sensitive claims pass staleness policy.
- implication is scoped to the evidence strength.

If the quality gate cannot be evaluated automatically, the run remains `needs_review` with an explicit review reason. If the gate is evaluated and fails, the run becomes `research_insufficient` or `stale` as appropriate, and the UI may create a Risk Card or manual follow-up; it never silently updates SpecVersion.

### Research-updated Queue terminal outcomes

Evidence Pack outcomes create user-actionable queue cards from synthesized decision evidence, not from raw source dumps.

| Card type | Created when | Allowed terminal outcomes |
| --- | --- | --- |
| `research_review` | gate is `needs_review`, `stale`, or source quality failed | `revised`, `research_insufficient`, `deferred` |
| `decision_approval` | gate is accepted and pro/con evidence is balanced | `approved`, `revised`, `rejected`, `deferred` |
| `risk_acceptance` | high-impact or known-risk evidence remains insufficient | `risk_accepted`, `research_insufficient`, `deferred`, `rejected` |
| `conflict_resolution` | counter-evidence blocks the claim | `revised`, `rejected`, `risk_accepted`, `research_insufficient`, `deferred` |
| `follow_up_question` | non-fatal evidence needs additional validation | `revised`, `research_insufficient`, `deferred` |

Terminal outcome rules:

- `deferred` and `risk_accepted` must preserve a user-visible rationale.
- High-impact Research-updated Queue cards block `Planning-ready` until resolved.
- Terminal `deferred` and `research_insufficient` remain visible blockers for high-impact cards.
- `risk_accepted` unblocks only when the rationale is carried forward into Known Risks.
- None of these outcomes creates a Phase 2 planning artifact, SpecVersion, file patch, shell/browser action, network write, or safe-execution capability.

## Phase 1.5B: Execution-readiness Hints

### `Phase15bUpgradeHints` contract

`phase15bUpgradeHints` is stored on `ImplementationPlanPreviewArtifact`, `BlockedActionArtifact`, and future Phase 1.5B hint records. It remains preview/readiness metadata.

| Field family | Required | Required content |
| --- | --- | --- |
| `executionIntent` | yes | candidate action type, target surface, non-executing summary |
| `approvalRequirements` | yes | approval type, reason, scope, required actor, reconfirm/expires rule |
| `sandboxRequirements` | yes | isolated worktree, browser sandbox, network mode, command allowlist, secret grant boundary as applicable |
| `rollbackReference` | yes | base ref/diff ref/rollback note/reversible flag/cleanup expectation |
| `expectedEvidence` | yes | tests, smoke checks, artifact paths, manual inspection, expected logs |
| `riskNormalization` | yes | riskLevel, blockedActionType, blockReason, userVisibleAction, escalation target |
| `sourceRefs` | yes | originating preview artifact, blocked action, ResearchRun, EvidenceMatrix, allowlist, audit log refs |
| `createdAt` | yes | ISO timestamp |
| `schemaVersion` | yes | `solo-superman.phase15b-hints.v1` |

### Approval requirements

Approval requirements are metadata, not active permissions.

| Field | Rule |
| --- | --- |
| `approvalType` | `task_level_execution`, `project_level_delegation`, `credential_grant`, `destructive_action`, `browser_action`, `network_write`, `phase3_safe_execution` |
| `reason` | user-visible reason |
| `scope` | exact target surface/action/source |
| `requiredActor` | user/project owner/system policy |
| `reconfirmRule` | when the approval must be asked again |

### Sandbox and rollback requirements

Hints must describe what a later execution phase needs before it can run.

- file patch: isolated worktree, diff preview, base commit, rollback ref.
- shell command: command allowlist, cwd, timeout, env policy, log capture.
- browser action: browser sandbox, replay log, manual confirmation before submit.
- network write: credential scope, dry-run proof, idempotency and rollback note.
- credential access: OS secret ref, purpose, revocation, no value in libSQL.
- destructive operation: separate high-risk approval, backup/rollback plan.
- ChatGPT web automation: Phase 2+ only, policy review and revoke/audit/session failure handling.

### No-execution preservation

Phase 1.5B acceptance must prove:

- hints can be stored, queried, and exported.
- no file, shell, browser, network write, credential, destructive, or ChatGPT web automation action is executed.
- no project-level delegation becomes active.
- no hint can create SpecVersion or implementation commitment directly.
- UI labels say `readiness`, `preview`, `blocked`, or `handoff`, never `executed`.

## API, DTO, DB, and UI checklist

The new canonical types are implemented later in `packages/contracts`, DB schema, Hono routes, ProductEngine commands/effects, and UI projections. This document fixes the minimum contract before implementation.

### DTO/checklist

- `ResearchAllowlistProjection` exposes status, connector ids, source categories, context mode, rate/budget/staleness summary, and revoke/pause state.
- `ResearchRunProjection` exposes run status, provider reference, attempt, source category, disclosure log ref, quality gate status, and terminal reason.
- `ResearchDisclosureLogProjection` exposes connector/source category, query/objective summary, public-safe summary sent, timestamp, and source refs.
- `Phase15bUpgradeHints` is implemented as a structured object, not `Record<string, unknown>`, with a dedicated local `phase15b_upgrade_hints` record when runtime artifacts carry hint payloads.

### API/checklist

- create/update/revoke/pause allowlist endpoints validate project ownership and source categories.
- start automatic research run endpoint rejects missing/paused/revoked allowlist.
- private/full/credentialed source request returns approval/manual handoff route, not automatic run.
- cancel/retry endpoints enforce state transition and idempotency rules.
- hint query/export endpoints return `Phase15bUpgradeHintProjection` and `Phase15bUpgradeHintExportDto` readiness metadata without enabling execution.
- hint query/export endpoints label records as `readiness_preview_handoff_metadata`, preserve sourceRef `kind`/`refId` traceability, and omit sourceRef labels/private payloads/credential values unless a future explicit app policy approves a safe export path.
- SSE/refetch hints exist for allowlist, research run, disclosure log, evidence gate, and hint export changes.

### DB/checklist

- allowlists, runs, disclosure logs, and hint records are persisted locally.
- secret values are never stored in libSQL.
- every run links back to ProductEngine event/effect refs.
- terminal runs remain queryable for audit and recovery.
- export includes readiness metadata without private source payload unless explicitly approved.

### UI/checklist

- allowlist screen shows connector/source categories, public-safe summary policy, revoke/pause controls, and limits.
- Activity Feed shows automatic research disclosure entries.
- Research cards show run status, retry/cancel actions, stale/failure reasons, and quality gate result.
- Runtime/Planning cards show 1.5B hints as readiness metadata, not execution results.

## Acceptance scenarios

### Scenario A. Allowlist happy path

Given a project has an active allowlist for `public_web` and a read-only connector.

When a research task uses only public-safe summary and approved source category.

Then:

- a ResearchRun is created with `queued` status.
- the run moves to `running` with provider run reference.
- disclosure log stores objective/query, public-safe summary, connector, source category.
- statusUrl/SSE/refetch allow UI recovery.
- provider result enters `needs_review` before EvidenceMatrix acceptance.

### Scenario B. Private source approval gate

Given a research task needs a private document, full raw idea, detailed answer text, credentialed source, or account session.

When the task is planned under a project allowlist.

Then:

- automatic run is not started.
- a task-level approval card or manual handoff is created.
- audit log records the blocked automatic route reason.
- no private payload is sent externally before approval.

### Scenario C. Revoke, cancel, retry recovery

Given an allowlist is active and runs are queued or running.

When the user pauses or revokes the allowlist.

Then:

- new automatic runs are blocked.
- queued runs become `paused` or `cancelled` according to user action.
- running runs move through `cancel_requested` when provider cancellation is needed.
- retry uses bounded retry/backoff/idempotency and never retries approval/precondition failures automatically.

### Scenario D. Evidence quality gate

Given a provider returns research results.

When source quality, pro/con balance, staleness, or limitations fail the gate.

Then:

- EvidenceMatrix is not silently accepted.
- run becomes `needs_review`, `research_insufficient`, or `stale`.
- Risk/Review Card preserves source refs and missing evidence reason.

### Scenario E. Phase 1.5B no-execution preservation

Given file/shell/browser/network write/credential/destructive/ChatGPT web automation readiness hints exist.

When the app stores, queries, or exports them.

Then:

- no action is executed.
- delegation remains inactive.
- exported payload is labeled readiness/preview.
- blocked action and risk normalization remain intact.

### Scenario F. Hint export/readiness reuse

Given `phase15bUpgradeHints` has approval, sandbox, rollback, evidence, risk, and research linkage fields.

When a later planning surface reads or exports it.

Then:

- no artifact shape migration is required.
- source refs connect back to ResearchRun/EvidenceMatrix/allowlist/audit logs.
- Phase 2 implementer can map the hints into `31-phase2-planning-handoff-contract.md` readiness checklist, residual risk register, and blocker report without reinterpreting the blocked action.
- Phase 3 implementer can derive required approvals and evidence from the Phase 2 handoff without treating hints as execution permission.

### Scenario G. Docs contract consistency

Given this document is canonical for Phase 1.5.

When docs verification runs.

Then:

- README reading order and responsibility table include doc 30.
- roadmap/security/research/runtime/data/API/DTO/operations docs link to this document.
- Phase 2 handoff docs may reference these hints, but this document remains the source for Phase 1.5B readiness metadata semantics.
- no document claims Phase 1.5B may execute file/shell/browser actions.
- `phase15bUpgradeHints` remains readiness metadata, not an execution permission.
