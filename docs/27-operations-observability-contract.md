# 27. Operations/Observability Contract

## 목적

이 문서는 Phase 1 구현자가 세션 중 장애가 생겼을 때 상태, effect, API, SSE, UI recovery를 다시 설계하지 않도록 전구간 운영·관측성 계약을 고정한다.

핵심 질문은 다음이다.

> intake에서 completion까지 어디서 실패하든, 무엇이 저장되고, 사용자는 무엇을 보며, 어떤 refetch/status 경로로 회복하고, completion/decision gate는 어떻게 보호되는가?

## 범위와 non-goals

포함:

- `intake -> question -> research -> runtime -> decision -> completion` 전구간의 얇은 failure/status/recovery 계약.
- `queue_projection_effect`, `research_evidence_effect`, `codex_runtime_preview_effect`의 사용자-visible recovery 기대값.
- `statusUrl`, SSE, projection refetch, activity feed, recovery card가 함께 동작하는 방식.
- 대표 장애 dry-run 3개: research effect 실패, Codex runtime 장애, SSE 누락 후 refetch 복구.

제외:

- 런타임 코드 구현.
- 이 문서 자체의 DB/API/DTO field 상세 확장. 세부 DTO와 endpoint behavior는 `25-contracts-dto-catalog.md`, `26-api-route-behavior-catalog.md`가 소유한다.
- 외부 APM, log drain, 배포 관측 플랫폼 선택.
- detailed scheduler algorithm.
- Phase 1의 preview-only runtime boundary를 넘어서는 file patch, shell command, browser action 실행.

## 운영 원칙

1. **Persisted truth first**: 사용자가 보는 장애 상태는 persisted event, effect task, projection, activity item에서 재구성 가능해야 한다.
2. **SSE is notification only**: SSE는 빠른 알림 채널이며 canonical state가 아니다. UI는 reconnect 후 `statusUrl` 또는 projection refetch로 회복한다.
3. **No hidden optimistic recovery**: effect 실패를 숨기고 성공 projection처럼 표시하지 않는다.
4. **User-visible recovery**: 자동 재시도가 끝나면 사용자는 manual retry, manual handoff, defer, risk/research_insufficient, blocked reason 중 하나를 볼 수 있어야 한다.
5. **Completion integrity**: unresolved high-impact incident는 completion candidate를 막거나 Known Risks/Next Validation Actions에 연결한다.
6. **Preview boundary preserved**: Codex runtime failure recovery는 preview/handoff/card 생성까지만 허용하며 실제 파일·shell·browser action을 실행하지 않는다.

## Lifecycle observability matrix

| Lifecycle stage | 대표 장애 | Persisted truth | 사용자-visible recovery | Refetch/status path | Completion/decision impact |
| --- | --- | --- | --- | --- | --- |
| Intake / session start | stale `expectedStateVersion`, invalid intake, duplicated project start | rejected command with stable error; no partial ProductEngine event | inline validation or conflict recovery message | project/session projection refetch | no spec draft lock until resolved |
| Ambiguity / queue activation | no eligible batch, active batch conflict, queue projection effect failure | `QueueProjectionFailed` activity or rejected command | keep current active batch, show queue recovery/refetch action | `/api/v1/sessions/:sessionId/queue`, command `statusUrl` | no new question batch replaces active batch silently |
| Answer / research planning | answer routes to `research_needed` but synthesis fails | `research_evidence_effect` attempts, terminal failure or `ResearchEffectFailed` card | manual retry, retain source/result, mark research_insufficient or defer | research projection, queue projection, command `statusUrl` | high-impact claim cannot become decision-ready without evidence gate |
| Runtime preview / Codex | app-server unavailable, schema mismatch, forbidden action, timeout | `codex_runtime_preview_effect` failed/blocked with adapter status and artifact ref | ManualRetryCard, RuntimeBlockedCard, manual prompt handoff | runtime activity projection and artifact refetch | runtime output cannot create spec update without allowed conversion |
| Decision / spec version | decision card resolves with stale evidence or missing approval | rejected command or blocked decision status | show blocking reason and evidence/approval requirement | decision queue, living spec, confidence projection | no `SpecVersion` without approved evidence-backed decision |
| Completion / Founder Brief | score high but incident/risk unresolved | completion command rejected or completion candidate includes incident risk | show if-stop-now artifact plus known unresolved incident | confidence/completion projection and Founder Brief projection | completion candidate blocked or risk explicitly carried forward |
| SSE / reconnect | UI misses `effect.succeeded` or `effect.failed` | effect task terminal status and projection version persisted | reconnect banner resolves through projection/status refetch | command `statusUrl`, session projection, activity feed | no duplicate effect or stale card remains after recovery |

## Status taxonomy

These status words are documentation-level behavior labels. DTO field names remain canonical in `25-contracts-dto-catalog.md` and endpoint behavior remains canonical in `26-api-route-behavior-catalog.md`.

| Status | Meaning | User promise |
| --- | --- | --- |
| `queued` | effect task persisted and not started | pending activity can be shown |
| `started` | executor has begun an attempt | progress activity can be shown, but no output is promised |
| `failed_retryable` | attempt failed and automatic retry remains | UI may show pending retry summary, not terminal failure |
| `failed_terminal` | attempts exhausted or non-retryable failure | UI must offer recovery, defer, or blocked explanation |
| `blocked_policy` | request is valid shape but forbidden by Phase/security/runtime policy | UI shows blocked card; no external execution occurs |
| `manual_handoff_required` | automated runtime path cannot continue safely | UI exposes prompt/artifact handoff and next step |
| `recovered_by_refetch` | UI state was restored after missed SSE/reconnect | activity records refetch recovery instead of duplicating work |
| `research_insufficient` | evidence cannot satisfy a claim after retry/review | decision/completion gates treat the claim as unresolved or risk-accepted only |

Forbidden status behavior:

- raw exception text as the only user-facing state.
- terminal failure without a next action.
- duplicate effect execution on reconnect.
- completion candidate generated from stale optimistic UI state.

## Incident dry-run contract

Every representative incident dry-run must include:

1. trigger and starting command;
2. ProductEngine event/effect sequence;
3. persisted effect/status outcome;
4. SSE/projection/refetch behavior;
5. user-visible card or activity item;
6. allowed recovery actions;
7. forbidden shortcut;
8. decision/completion impact.

## Incident 1. Research effect retry exhausted

Trigger:

- User answers an active question and `SubmitAnswer` routes to `research_needed` for a high-impact claim.
- `research_evidence_effect` cannot synthesize balanced evidence after the configured automatic retries.

Expected trace:

| Step | Event/effect | Persisted status | UI/activity |
| --- | --- | --- | --- |
| 1 | `AnswerSubmitted` | answer saved with `expectedStateVersion` match | active question marked answered |
| 2 | `AnswerRouted: research_needed` | trace link to ambiguity/claim/question | research pending activity |
| 3 | `ResearchPlanned` | `ResearchTask` and `research_evidence_effect` queued | Research Review Card pending |
| 4 | `effect.started` | attempt count increments | progress indicator only |
| 5 | `effect.failed` with retry remaining | `failed_retryable` | no terminal failure card yet |
| 6 | final `effect.failed` | `failed_terminal`, source/result retained | `ResearchEffectFailed` card |
| 7 | queue recalculation | blocker or research_insufficient path persisted | manual retry, defer, or risk acceptance prompt |

Recovery contract:

- Manual retry is allowed through Research Review Card when the user changes prompt/source context or explicitly retries.
- `research_insufficient` must connect to Known Risks and Next Validation Actions.
- Existing sources/results are retained for audit and do not vanish when synthesis fails.

Forbidden shortcut:

- creating a decision-ready EvidenceMatrix from partial pro-only or failed synthesis output.
- hiding the failed research and increasing completeness score from stale optimistic projection.

Completion impact:

- high-impact claim remains blocked unless the user explicitly accepts risk through the existing approval path.

## Incident 2. Codex runtime unavailable or schema-mismatched

Trigger:

- User requests `CreateRuntimePreview` for a research prompt, spec update preview, or implementation plan preview.
- Codex app-server is unavailable, returns schema-incompatible output, times out, or proposes a forbidden action.

Expected trace:

| Step | Event/effect | Persisted status | UI/activity |
| --- | --- | --- | --- |
| 1 | `CreateRuntimePreview` accepted | command id and `codex_runtime_preview_effect` queued | Runtime preview pending |
| 2 | runtime status probe | adapter status saved | runtime status visible |
| 3 | parser repair / self-repair attempt | attempt metadata retained | no external action executed |
| 4 | max 1 automatic retry exhausted or forbidden action detected | `failed_terminal` or `blocked_policy` | ManualRetryCard or RuntimeBlockedCard |
| 5 | optional manual handoff artifact created | `RuntimePreviewArtifact` with handoff mode | user can copy prompt / retry manually |
| 6 | queue recalculation | runtime card remains next or blocked | completion/decision waits for allowed conversion |

Recovery contract:

- Manual retry is required after automatic retry exhaustion.
- Manual handoff is allowed without pretending Codex produced a valid artifact.
- `RuntimeBlockedCard` must name the blocked category, such as file patch, shell command, browser action, credential, destructive action, or schema mismatch.

Forbidden shortcut:

- running file patch, shell command, browser action, or credential-gated work in Phase 1.
- converting invalid Codex output into `SpecUpdate` without schema repair success and allowed apply policy.

Completion impact:

- runtime preview failure does not erase prior spec/evidence state, but it cannot advance a spec update or completion claim until a valid artifact or manual evidence path exists.

## Incident 3. SSE missed, refetch recovers state

Trigger:

- A command returns `accepted` with `statusUrl`, then the UI disconnects before `effect.succeeded`, `effect.failed`, or `projection.updated` arrives.

Expected trace:

| Step | Event/effect | Persisted status | UI/activity |
| --- | --- | --- | --- |
| 1 | mutating command accepted | command id, event ids, effect task ids persisted | pending activity shown |
| 2 | SSE disconnects | no state mutation from client-side timeout | reconnect banner or silent retry timer |
| 3 | effect reaches terminal state | terminal effect status and projection version persisted | missed SSE is acceptable |
| 4 | UI reconnects | `/api/v1/commands/:commandId/status` returns terminal state and projection hints | pending card reconciles |
| 5 | projection refetch | queue/research/runtime/confidence projection updated | activity marks recovered by refetch |

Recovery contract:

- The frontend must treat SSE as notification and refetch canonical projections after reconnect.
- Command status response must include enough projection hints to update affected UI surfaces.
- Recovery must not enqueue another identical effect unless the user issues an explicit manual retry command.

Forbidden shortcut:

- using stale in-memory UI state as source of truth.
- duplicating an effect because the original SSE success was missed.
- leaving an already terminal pending card visible after status refetch.

Completion impact:

- completion candidate may only use persisted projection state after refetch, not the client’s pre-disconnect optimistic state.

## Cross-document ownership

| Concern | Canonical owner | This document’s role |
| --- | --- | --- |
| ProductEngine transition ownership | `18-product-engine-orchestrator.md` | defines operational recovery expectations around transitions |
| persisted events/effect tasks/projections | `20-data-storage-contract.md` | requires recovery to be reconstructable from persisted state |
| API envelope, SSE event names, Codex sidecar boundary | `21-sidecar-api-runtime-contract.md` | defines what user-visible recovery must mean for those APIs |
| implementation PR sequence | `22-phase1-implementation-sequence.md` | adds PR-09 incident dry-run hardening expectation |
| effect lifecycle, retry, idempotency | `23-product-engine-runtime-contract.md` | adds end-to-end incident proof around the lifecycle |
| DTOs, `statusUrl`, projection hints | `25-contracts-dto-catalog.md` | does not redefine fields, only specifies recovery behavior |
| endpoint behavior and refetch mapping | `26-api-route-behavior-catalog.md` | requires endpoint rows to support the incident dry-runs |
| validation and dry-run evidence | `12-validation-and-dry-run.md` | records the pass/fail checks for these incidents |

## Phase 1.5 operations checklist

Phase 1.5 운영성은 `30-phase1.5-research-runtime-and-readiness-contract.md`의 acceptance scenario를 따른다.

- Allowlist happy path must be recoverable through statusUrl, SSE/refetch, and disclosure log.
- Revoke/pause/cancel/retry must produce user-visible terminal or recoverable states.
- Timeout/failure/stale transitions must preserve provider run refs and retry reasons.
- Evidence quality gate failure must route to Review/Risk card without silently updating EvidenceMatrix.
- Phase 1.5B hint storage/query/export must prove no-execution preservation.

## Implementation acceptance

Later Phase 1 implementation PRs are not complete until these checks are true:

- every async effect exposed to UI has command/effect ids, `statusUrl`, SSE event expectation, projection refetch hint, and user-visible pending state.
- every terminal failure maps to a recovery card/activity, not raw exception text.
- research effect failure retains source/result context and blocks or downgrades decision/completion as appropriate.
- Codex runtime failure preserves preview-only boundaries and offers manual retry/handoff/block explanation.
- SSE reconnect tests prove missed events recover by status/projection refetch without duplicate effects.
- PR-09 E2E dry-run covers at least two of the three incident classes above; all three are preferred before declaring Phase 1 operationally ready.
