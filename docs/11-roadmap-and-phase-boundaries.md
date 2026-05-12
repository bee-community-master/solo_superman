# 11. Roadmap and Phase Boundaries

## Phase 원칙

- Phase는 사용자 UI에 노출되는 여정명이 아니라 내부 capability, roadmap, GitHub issue, implementation planning 용어다.
- 사용자-facing 여정명은 `28-founder-os-product-doctrine.md`의 매핑표를 따른다.
- Phase별 capability, 사용자 가치, entry gate, exit evidence, non-goal 매트릭스는 `29-phase-capability-implementation-matrix.md`를 따른다.
- Phase는 기술 레이어가 아니라 검증할 사용자 가치 단위로 나눈다.
- 각 Phase는 이전 Phase의 성공 조건을 전제로 한다.
- non-goal로 정한 항목은 해당 Phase 진입 전까지 구현하지 않는다.

## Phase 0: 기획 문서 완성

완료된 초기 문서/계약 단계다. 현재 기준선은 Phase 1 PR-01~PR-09 구현 완료 이후의 product doctrine 보강이다.

산출물:

- 31개 번호 문서와 README로 구성된 상세 기획/구현 계약 문서.
- 구현자 핸드오프 검토.
- 샘플 아이디어 dry-run.

완료 조건:

- 문서 간 상충 없음.
- Phase 1 구현자가 추가 제품 결정을 하지 않아도 됨.
- dry-run에서 질문 큐, 리서치 매트릭스, Spec 업데이트, 완성도 점수가 설명 가능.
- Phase 1 구현자가 topology, package layout, DB binding, API route shape/endpoint behavior, Codex boundary, PR sequence를 다시 결정하지 않아도 됨.

## Phase 1: Research 포함 Spec 폐루프 MVP

목표:

- 초기 창업자가 하나의 아이디어를 Living Product Spec v1까지 구체화한다.

포함:

- local web frontend 방향성.
- 초기 Tauri/Vite scaffold history는 historical context로만 보존하고 future default로 확장하지 않음.
- Local Node/Hono Service.
- local embedded libSQL + Drizzle.
- Project 생성.
- Initial Spec Draft.
- AmbiguityIssue 분석.
- Question Priority Queue.
- 3~5개 질문 배치.
- 답변 저장.
- 실제 리서치 결과 저장.
- Codex app-server 기반 Spec/Research sandbox preview.
- 수동 프롬프트 핸드오프와 `17-ai-runtime-access-strategy.md`가 정의한 공식 Codex 경로 fallback.
- 찬반 근거 매트릭스.
- Suggested Spec Update.
- Decision Approval.
- SpecVersion.
- Composite Completeness Score.
- Hono `/api/v1` local API and SSE event stream.
- Codex app-server sandbox preview adapter.
- Founder Brief export.

제외:

- 팀 협업.
- 모바일 앱.
- 결제/과금.
- 자동 코드 실행.
- 브라우저 조작 실행.
- ChatGPT Pro 웹 자동화.
- actual remote sync beyond config placeholder.
- runtime marketplace.

완료 조건:

- 샘플 아이디어 하나가 end-to-end로 처리된다.
- 완료 후보 card가 생성된다.
- 사용자가 Spec v1과 Founder Brief를 export할 수 있다.
- PR-01~PR-09 implementation sequence의 E2E dry-run acceptance를 통과한다.

## Phase 1.5A: Background Research Runtime

상세 구현 계약은 `30-phase1.5-research-runtime-and-readiness-contract.md`가 소유한다. Founder OS 여정/gate 해석은 `28-founder-os-product-doctrine.md`와 `29-phase-capability-implementation-matrix.md`를 따른다.

목표:

- Phase 1의 Spec-ready 결과물 이후, 특정 claim/decision에 묶인 깊고 지속적인 리서치를 durable한 background run으로 운영한다.
- 리서치 결과를 source dump가 아니라 Evidence Pack과 Research-updated Queue로 연결해 사용자가 답변 흐름을 잃지 않게 한다.
- 사용자-facing 여정명은 `리서치 보강 중` 또는 `리서치 결과 검토 중`이며, UI에는 Phase 1.5A를 노출하지 않는다.

공통 포함:

- project-level allowlist 승인 안의 read-only external research connector.
- ResearchAllowlist, ResearchRun, ResearchDisclosureLog.
- connector/source category, revoke/pause, audit/disclosure log, rate/budget/staleness limits.
- run state machine, provider run reference, cancel/pause/resume, retry/backoff/idempotency.
- public-safe summary 자동 전송과 private/full/credentialed source task-level approval gate.
- Pro/Con Evidence Gate와 연결된 result quality gate.

### Phase 1.5A-1: Decision-linked Evidence Pack

목표:

- background research 결과를 source dump가 아니라 decision-linked evidence ledger로 저장한다.

포함:

- claim/decisionContext별 pro evidence, con evidence, uncertainty.
- source quality, relevance, retrievedAt, stale risk.
- product implication과 연결된 Spec section, Decision, Question, ResearchTask.
- bounded long-running task status, retry, cancel, terminal failure recovery.

완료 조건:

- high-impact claim은 pro/con evidence와 uncertainty를 모두 가진다.
- evidence가 부족하면 `research_insufficient` 또는 `missing_con_evidence`로 수렴한다.
- Evidence Pack은 Research-updated Queue의 durable source of truth가 된다.

### Phase 1.5A-2: Research-updated Queue

목표:

- Evidence Pack에서 사용자가 처리해야 할 Research Review, Decision Approval, Risk Acceptance, Conflict Resolution, Follow-up Question card를 생성한다.

완료 조건:

- Evidence Pack에서 파생된 high-impact card가 모두 terminal outcome을 가진다.
- terminal outcome은 `approved`, `revised`, `rejected`, `deferred`, `risk_accepted`, `research_insufficient` 중 하나다.
- unresolved high-impact card가 있으면 Phase 2 Planning Handoff를 확정하지 않는다.

진입 조건:

- Phase 1에서 Research Loop가 제품 가치로 검증됨.
- Phase 1 E2E dry-run과 operational recovery 기준이 통과됨.
- local research task 상태 관리가 병목이거나, 깊은 리서치가 Founder Brief 이후 반복적으로 필요함.
- 사용자가 프로젝트 단위 read-only connector/source allowlist와 public-safe summary 정책을 승인함.

제외:

- file patch, shell command, browser action 실행.
- network write 또는 external mutation.
- credential value 저장 또는 묵시적 credential 사용.
- ChatGPT Pro web automation.
- recurring/open-ended market watch 제품화.
- 팀 협업, 본격 cloud sync, 모바일/원격 승인, 결제/과금.
- unresolved high-impact queue card를 무시한 planning handoff.

Phase 1.5A 공통 완료 조건:

- allowlist happy path, private-source approval gate, revoke/cancel/retry recovery, evidence quality gate acceptance가 통과한다.
- automatic external research는 public-safe summary까지만 전송하고 disclosure log를 남긴다.
- private document, full raw idea, detailed answers, credentialed source는 자동 실행되지 않는다.

## Phase 1.5B: Execution-readiness Hints

상세 구현 계약은 `30-phase1.5-research-runtime-and-readiness-contract.md`가 소유한다.

목표:

- Phase 1 preview artifact와 Phase 1.5A research evidence가 나중의 실행 계획/위임 단계에서 재사용할 수 있는 approval, sandbox, rollback, expected evidence, risk metadata를 보존한다.

포함:

- structured `phase15bUpgradeHints` field family.
- approval requirements, sandbox/workspace requirements, rollback/reference plan.
- expected evidence contract, risk/blocked reason normalization.
- ResearchRun/EvidenceMatrix/allowlist/audit log source linkage.
- hint storage, query, export.

제외:

- file patch 실행.
- shell command 실행.
- browser action 실행.
- network write 또는 external mutation.
- credential value 접근/저장.
- destructive operation 실행.
- ChatGPT Pro web automation.
- project-level delegation 활성화.
- implementation task commitment 확정.

진입 조건:

- Phase 1 RuntimePreviewArtifact와 BlockedActionArtifact 저장이 안정됨.
- Phase 1.5A Evidence Pack 또는 Research-updated Queue에서 execution-readiness metadata가 반복적으로 필요함.

완료 조건:

- Phase 1.5B hint metadata는 저장·조회·export 가능하지만 실행되지 않는다.
- Phase 2/3 구현자가 artifact shape migration 없이 hint를 읽을 수 있다.
- no-execution preservation, hint export/readiness reuse, docs contract consistency acceptance가 통과한다.

## Phase 2: Execution Planning Handoff

목표:

- Living Product Spec과 해결된 Research-updated Queue를 구현 가능한 task plan으로 변환한다.
- 전체 제품을 한 번에 만들지 않고 가장 작고 검증 가능한 Build Slice를 정의한다.
- Served MVP 이후 다시 Evidence/Decision/다음 Build Slice로 돌아오는 Learning Loop hook을 남긴다.
- 사용자-facing 여정명은 `Planning-ready`이며, UI에는 Phase 2를 노출하지 않는다.

포함:

- Spec -> task breakdown.
- PR/issue 단위 실행 계획.
- implementation readiness checklist.
- Build Slice Plan.
- Serve Checklist.
- Learning Loop hook.
- unresolved risk와 prerequisite 표시.
- final `PlanningHandoffArtifact`와 gate 실패용 blocker report의 schema는 `31-phase2-planning-handoff-contract.md`를 따른다.
- Build Slice, Serve Checklist, Learning Loop의 checklist/handoff 수준 계약은 `33-build-slice-serve-learning-loop.md`를 따른다.
- DTO/API/storage/gate/idempotency 구현 기본값은 `32-phase2-implementation-preflight-contract.md`를 따른다.
- file diff/command/browser action은 preview까지만 설계 가능.

진입 조건:

- Phase 1.5A-2 Research-updated Queue의 high-impact card가 terminal outcome을 가진다.
- terminal outcome 없이 남은 high-impact risk는 Planning Handoff blocker다.
- Phase 2 gate는 impact-sensitive로 판정한다. `고객/문제/JTBD`, `성공기준/검증계획`, `승인/보안/실행안전` class가 unresolved, `research_insufficient`, 또는 사용자 승인 없는 `deferred` 상태이면 final Planning-ready handoff를 막는다.
- `가치제안/차별화`와 `MVP 범위/비범위`의 `research_insufficient`/`deferred`는 planning artifact가 residual risk, prerequisite, assumption, validation dependency를 숨기지 않을 때 Phase 2 planning context에 포함할 수 있다.
- low/medium risk는 Known Risks, Open Questions, prerequisite로 명시할 수 있다.
- final Planning-ready handoff는 `31-phase2-planning-handoff-contract.md`의 `PlanningHandoffArtifact`로만 확정한다.

제외:

- 자동 적용.
- shell 실행.
- gate 실패 또는 부분충족 blocker report를 final `PlanningHandoffArtifact`처럼 표시하는 것.
- 파일 patch 실행.
- browser action, deploy, external mutation 실행.
- Serve Checklist를 실제 deploy로 해석하는 것.
- Learning Loop를 자동 analytics/feedback ingestion 제품으로 확장하는 것.

## Phase 2.5: Browser Automation Preview

상세 문서 계약은 `34-phase2.5-browser-automation-preview-contract.md`가 소유한다.

목표:

- 시장/경쟁/검증 리서치에서 browser/ChatGPT Pro delegation 후보가 Phase 1.5A allowlisted read-only research보다 evidence depth, source trace, decision impact를 개선하는지 검증한다.
- PlaywrightRuntime, BrowserUseRuntime, ChatGPT Pro/Deep Research web delegation, manual prompt handoff, official Codex path fallback을 같은 comparative dry-run 기준으로 평가한다.
- 사용자-facing 여정명은 `브라우저 자동화 검토 중`이며, UI에는 Phase 2.5를 노출하지 않는다.

포함:

- `DelegationRiskGate`: policy/terms risk, data disclosure, session custody, browser write boundary, revoke/audit, reliability/fallback 판정.
- `ResearchQualityComparisonReport`: 동일 high-impact research question에 대한 Phase 1.5A baseline vs Phase 2.5 candidate 비교.
- `Phase25ResearchComparisonProjection`: 첫 Artifact+Gate core의 DTO/reducer/storage read model.
- source capture/provenance plan, action preview, revoke control, audit log, failure/fallback copy.
- ChatGPT Pro/Deep Research policy/session/usage-risk 검토와 safe failure recording.

진입 조건:

- Phase 1.5A Research Loop와 manual handoff가 실제 리서치 병목 또는 evidence quality gap으로 확인됨.
- Phase 2 Planning Handoff가 residual risk와 validation dependency를 숨기지 않음.
- ChatGPT Pro/browser 후보의 정책/약관/세션/사용량 제한 리스크를 검토할 준비가 있음.
- fallback chain, audit log, revoke control, disclosure boundary를 문서상으로 설명할 수 있음.

완료 조건:

- 대표 high-impact research question에서 Phase 1.5A baseline과 Phase 2.5 candidate를 비교하는 dry-run artifact가 DTO/reducer/storage round-trip으로 검증된다.
- candidate가 quality lift를 보이면 source trace, pro/con/uncertainty, decision impact, stale risk, fallback/revoke/audit evidence가 설명된다.
- candidate가 policy/session/data/write boundary에서 막히면 safe failure로 기록하고 quality lift를 주장하지 않는다.

제외:

- form submission, POST/write action, deploy, external mutation 실행.
- ChatGPT credential/session custody, account sharing/resale, third-party service operation.
- review UI panel, sidecar API route/client, live browser/ChatGPT adapter, Phase 3 execution authority, GitHub issue/PR slicing.
- 팀 협업, 모바일 원격 승인, 결제/과금, marketplace, 본격 cloud sync 확장.

## Phase 3: Safe Execution Adapter (Controlled Execution)

상세 구현 계약은 `36-phase3-controlled-execution-contract.md`가 소유한다. Phase 3의 runtime 방향은 `Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db`이며, no hosted SaaS default와 no browser-only DB rewrite를 유지한다.

목표:

- 코드/문서/브라우저 실행을 approval-first 방식으로 제공한다.
- 모든 실행 claim을 `ExecutionAuthorityRecord`로 묶어 source planning handoff, preview, approval, sandbox, rollback, evidence, audit을 추적한다.
- Tauri/native shell은 제거된 historical context이며 source/dependency/script/runtime 기본 경로에 남지 않음을 전제로 구현한다.

포함:

- file diff preview + approved workspace patch.
- shell command preview + approved command sandbox.
- browser action preview + approved browser preview session.
- per-run local capability token, loopback-only local service, explicit local origin allowlist.
- CSRF/replay/idempotency check for approval/execution routes.
- rollback reference, evidence refs, audit refs.
- `BoundedAgentOutputRecord`로 source/evidence/approval 없는 agent output을 suggestion-only로 격리.

진입 조건:

- Phase 2 task breakdown 품질이 충분히 검증됨.
- Phase 2.5 Artifact+Gate core가 no-execution boundary를 유지함.
- approval model, sandbox boundary, rollback reference가 docs/36 기준으로 설명됨.

완료 조건:

- 사용자가 승인한 controlled execution만 적용되고, 실행 전 preview와 실행 후 evidence/audit/rollback reference가 남는다.
- `ExecutionAuthorityRecord.approvalDecision`, `sandboxBoundary`, `rollbackReference`, `executionResult`, `evidenceRefs`, `auditRefs`가 저장된다.
- hosted web origin이 local execution authority를 묵시적으로 얻지 않는다.

제외:

- 무승인 실행.
- credential/destructive/external-production action 자동 실행.
- blanket delegation.
- hosted SaaS default, 새 replacement native shell 개발, browser-only DB rewrite.

## Phase 4: Optional Cloud and Mobile Monitor

목표:

- 프로젝트 sync와 모바일 원격 승인/모니터링을 제공한다.

포함:

- Supabase optional sync.
- Expo mobile app.
- push notification.
- approval queue monitor.
- task progress monitor.

진입 조건:

- 사용자가 local web/service 세션 밖에서도 질문/승인을 처리하려는 니즈가 확인됨.

## Phase 5: Team Collaboration

목표:

- 개인 창업자에서 소규모 창업팀으로 확장한다.

포함:

- workspace sharing.
- role/permission.
- comment/review.
- decision owner.
- audit log.

진입 조건:

- 개인용 workflow가 안정되고, 공유 요구가 반복적으로 확인됨.

## Phase 6: Advanced Multi-agent Strategy Engine

목표:

- 창업 전반 리서치/전략/실행을 다중 agent workflow로 확장한다.

후보:

- GooseRuntime for MCP-heavy local workflows.
- CrewAIRuntime for strategy/research crews.
- OpenClaw Task Flow for durable pipelines.

포함 가능:

- market research crew.
- investor narrative crew.
- product strategy critic.
- validation experiment planner.

## Phase guardrails

- 사용자 UI, onboarding, CTA, export에 내부 Phase 용어를 노출하지 않는다.
- Controlled Execution capability 전 자동 실행 기능을 만들지 않는다.
- Phase 1.5B는 execution-readiness hint만 저장하며 실제 file/shell/browser 실행 권한을 주지 않는다.
- unresolved fatal blocker 또는 terminal outcome 없는 Research-updated Queue의 high-impact card가 있으면 Planning Handoff를 확정하지 않는다.
- Phase 2 final artifact와 blocker report는 `31-phase2-planning-handoff-contract.md`의 split contract를 따른다.
- Phase 2 DTO/API/storage/gate exact defaults는 `32-phase2-implementation-preflight-contract.md`를 따른다.
- Build Slice, Serve Checklist, Learning Loop는 `33-build-slice-serve-learning-loop.md`의 no-execution checklist/handoff contract를 따른다.
- Phase 2.5 Browser Automation Preview의 canonical 계약은 `34-phase2.5-browser-automation-preview-contract.md`를 따른다.
- Phase 3 Controlled Execution의 canonical 계약은 `36-phase3-controlled-execution-contract.md`를 따른다.
- Phase 1에서 Codex app-server는 sandbox preview 권한을 넘지 않는다.
- Phase 1에서 ChatGPT Pro 웹 자동화를 만들지 않는다.
- 다음 research/planning capability 보강에서 모바일 앱을 만들지 않는다.
- 다음 research/planning capability 보강에서 결제/과금을 만들지 않는다.
- 다음 research/planning capability 보강에서 팀 협업을 만들지 않는다.
- cloud sync는 local-first 원칙을 깨지 않는 opt-in이어야 한다.
- Phase 1에서 remote sync는 remote config placeholder only로 남긴다.
- Phase 1 implementation sequence는 `22-phase1-implementation-sequence.md`를 따른다.
- Phase 0~6 capability implementation matrix는 `29-phase-capability-implementation-matrix.md`를 따른다.
