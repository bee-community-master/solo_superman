# 34. Phase 2.5 Browser Automation Preview Contract

## 목적

이 문서는 Phase 2.5 Browser Automation Preview의 canonical 문서 계약이다. 목표는 Phase 2 Planning Handoff 이후, Phase 3 Controlled Execution 이전에 브라우저/ChatGPT Pro 계열 research delegation이 Phase 1.5A allowlisted read-only research보다 실제로 더 나은 evidence depth, source trace, decision impact를 만드는지 검증하는 기준을 고정하는 것이다.

Phase 2.5는 실행 단계가 아니다. 이 문서는 browser automation과 ChatGPT Pro/Deep Research delegation을 제품 capability로 바로 구현하기 전에, 정책·세션·데이터 노출·revoke/audit·fallback·품질 향상 기준을 문서 계약으로 잠근다.

Canonical path: `docs/34-phase2.5-browser-automation-preview-contract.md`.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Canonical source | Phase 2.5 Browser Automation Preview 계약은 이 문서가 소유 |
| Primary objective | Phase 1.5A baseline 대비 research quality lift를 비교 dry-run으로 검증 |
| Scope depth | docs-level contract only; DTO/API/DB exact default, route id, PR sequence는 후속 preflight 전까지 확정하지 않음 |
| Candidate surfaces | PlaywrightRuntime, BrowserUseRuntime, ChatGPT Pro/Deep Research web delegation, manual prompt handoff, official Codex path fallback |
| ChatGPT Pro boundary | 정책·약관·세션·사용량·account-risk gate를 통과해야 하며, 계정 공유나 credential custody가 아님 |
| No-execution boundary | Phase 2.5는 form submit, POST/write, deploy, external mutation, credential storage, hidden browser action을 실행하지 않음 |
| User value | 사용자는 browser/ChatGPT delegation을 켜기 전에 어떤 evidence 품질 개선, 위험, fallback, revoke 경계가 있는지 본다 |
| Completion evidence | 동일 high-impact research question에 대한 Phase 1.5A vs Phase 2.5 comparative dry-run contract |
| Artifact status | 이 문서의 artifact names는 docs-level vocabulary이며 `packages/contracts` closed DTO로 승격하지 않음 |

## Phase relationship

| Phase | Phase 2.5가 이어받는 것 | Phase 2.5가 하지 않는 것 |
| --- | --- | --- |
| Phase 1 | Codex app-server sandbox preview와 manual handoff boundary | Phase 1에 browser automation 또는 ChatGPT web automation을 추가하지 않음 |
| Phase 1.5A | ResearchAllowlist, ResearchRun, disclosure log, Evidence Pack, Research-updated Queue, read-only connector 기준 | allowlist를 account-session scraping 또는 write action 승인으로 확장하지 않음 |
| Phase 1.5B | approval, sandbox, rollback, expected evidence, risk metadata를 readiness hint로 보존하는 패턴 | hint를 active permission 또는 실행 commitment로 해석하지 않음 |
| Phase 2 | PlanningHandoffArtifact, blocker report, residual risk visibility, no-execution policy | planning handoff를 browser action 실행으로 승격하지 않음 |
| Phase 2.5 | browser/ChatGPT delegation preview가 research quality lift를 만드는지 검증 | submit/write/credential custody/account sharing/implementation preflight/team/mobile/billing을 하지 않음 |
| Phase 3 | controlled execution에 필요한 approval-first, sandbox, rollback, audit expectation을 준비 | Phase 3의 controlled execution adapter를 설계하거나 구현하지 않음 |

## Ambiguities resolved

| 모호점 | Phase 2.5 결정 |
| --- | --- |
| `preview`가 실제 브라우저 실행인가 | 이 문서에서는 preview artifact, action plan, source capture plan, delegation risk gate, comparative dry-run evidence contract를 뜻한다. 후속 구현이 실제 browser read-only session을 열려면 이 문서의 no-execution boundary를 먼저 만족해야 한다. |
| ChatGPT Pro web automation이 기본 실행 경로인가 | 아니다. ChatGPT Pro/Deep Research는 quality-lift 검증 후보이며, 정책·세션·사용량·데이터 노출 gate를 통과하지 못하면 manual handoff 또는 official Codex path fallback으로 수렴한다. |
| Project-level delegation이 credential 보관인가 | 아니다. 위임은 사용자가 볼 수 있는 목적/데이터 범주/revoke/audit/fallback 설명이며, Solo Superman은 ChatGPT 계정 비밀번호, 2FA, API key, session token을 저장하거나 대리 입력하지 않는다. |
| Source capture가 source dump인가 | 아니다. source capture는 Evidence Pack/Research-updated Queue에 연결되는 URL/report/screenshot/log/provenance summary와 decision impact trace다. Decision impact 없는 source list는 실패다. |
| Phase 2.5가 구현 preflight인가 | 아니다. DTO wire shape, DB columns, route ids, product code, GitHub issue/PR slicing은 후속 작업이다. |

## Candidate runtime lanes

| Lane | Allowed evaluation | Required fallback |
| --- | --- | --- |
| Phase 1.5A baseline | existing allowlisted read-only connector, public-safe summary, disclosure log, Evidence Pack output | If evidence is insufficient, record `research_insufficient` or `missing_con_evidence` |
| Playwright/BrowserUse preview | public or user-provided public URL read-only browsing plan, source capture plan, browser action preview | If any login/write/sensitive action is required, block and create risk/fallback note |
| ChatGPT Pro/Deep Research delegation preview | user-visible deep research purpose, data disclosure preview, policy/session/reliability gate, exported report provenance when user provides it | If policy/session/account-risk appears, recommend manual prompt handoff or official Codex path fallback |
| Manual prompt handoff | user copies prompt/result manually and app records disclosure/source refs | If result lacks source trace or con evidence, route to Research Review/Risk card |
| Official Codex path fallback | use Codex-supported path only when it preserves sandbox/preview/no-execution boundary | If insufficient, create Risk Card, Known Risk, and Next Validation Action |

## `DelegationRiskGate` contract

`DelegationRiskGate` is a docs-level gate run before any Phase 2.5 browser/ChatGPT delegation is treated as valid comparison evidence.

| Check | Pass condition | Block condition |
| --- | --- | --- |
| Policy/terms risk | Intended use is research support, not automated data extraction, account sharing, resale, or third-party service operation | Terms risk is unresolved or requires account sharing/credential custody |
| Data disclosure | Only public-safe summary or user-approved excerpt is sent; private data categories are named and excluded | raw idea, detailed answers, private documents, customer/partner names, credentials, or account-session data would be sent without explicit task approval |
| Session custody | User keeps account/session control; product does not store or replay secrets | password/2FA/API key/session token custody is required |
| Browser action | Read-only browsing or preview plan only | form submit, POST/write, payment, legal/medical/financial/sensitive action, deploy, or external mutation is required |
| Revoke/audit | user-visible revoke path and audit/source refs are described | delegation can continue silently or cannot be explained after failure |
| Reliability | usage limits, CAPTCHA/anti-bot, UI changes, result retrieval failure have fallback copy | failure would silently degrade evidence or appear as completed research |

Gate verdicts:

- `allowed_for_comparative_preview`: may be used as Phase 2.5 comparison candidate evidence.
- `blocked_by_policy_risk`: policy/terms risk is too high or unresolved.
- `blocked_by_data_sensitivity`: required context exceeds public-safe or approved disclosure.
- `blocked_by_session_custody`: credential/session custody would be required.
- `blocked_by_write_action`: browser or ChatGPT flow requires submit/write/external mutation.
- `fallback_required`: candidate is not safe/reliable enough; use manual handoff, official Codex path, Risk Card, or Known Risk.

## `ResearchQualityComparisonReport` contract

`ResearchQualityComparisonReport` is a docs-level comparative dry-run artifact. It decides whether Phase 2.5 creates enough quality lift to justify later implementation planning.

Required inputs:

- Same high-impact `researchQuestion` or `decisionContext` for both baseline and candidate.
- Phase 1.5A baseline Evidence Pack or `research_insufficient` result.
- Phase 2.5 candidate output from browser/ChatGPT/manual/Codex fallback lane.
- DelegationRiskGate verdict and rationale.
- source refs, retrieved/exported timestamps, disclosure summary, fallback/revoke/audit refs.
- linked Spec section, Decision, Question, ResearchTask, Risk Card, or Research-updated Queue item.

Comparison rubric:

| Dimension | Pass signal | Fail signal |
| --- | --- | --- |
| Evidence balance | Candidate adds material pro evidence, con evidence, or uncertainty that changes decision context | candidate is pro-only, source dump only, or repeats baseline summary |
| Source trace | source URLs/report refs/screenshot/log/provenance summary are recoverable and linked | source provenance is missing, unverifiable, or detached from evidence claims |
| Decision impact | candidate changes Decision Approval, Risk Acceptance, Conflict Resolution, Follow-up Question, or Known Risk | no product implication is recorded |
| Freshness/staleness | retrievedAt/source date and stale risk are explicit | freshness-sensitive claim lacks date or stale risk |
| Safety/revoke | no-execution boundary, disclosure, fallback, revoke/audit are visible | hidden action, silent fallback, or unlogged failure |
| Baseline lift | clearly explains what Phase 2.5 found that Phase 1.5A could not or why it failed safely | quality lift is asserted without comparison |

Completion rule:

- Phase 2.5 is worth later implementation planning only if at least one representative high-impact research question produces material quality lift without DelegationRiskGate block.
- If candidate output is blocked but the block is well explained, Phase 2.5 may still pass the safety contract but must not claim quality lift.
- If neither quality lift nor safe failure evidence is available, Phase 2.5 remains a research/planning risk and should not open Phase 3 execution planning.

## Non-goals

Phase 2.5 does not include:

- actual form submission, POST/write action, external mutation, deploy, payment, legal/medical/financial/sensitive action.
- ChatGPT credential/session custody, account sharing, resale, team-shared account use, or third-party service operation through a user's Pro account.
- storing password, 2FA, API key, session token, or credential value in libSQL or app state.
- product DTO/API/storage/route implementation, route id/client name defaults, migration, generated code, live GitHub issue/PR slicing.
- team collaboration, mobile approval monitor, billing, marketplace, or full cloud sync expansion.
- recurring/open-ended market watch productization.
- treating a blocked policy/session result as final research success.

## Required document updates

When this document changes, keep these references aligned:

- `docs/README.md`: document index, responsibility boundary, official reference note, and current prohibition list.
- `docs/11-roadmap-and-phase-boundaries.md`: Phase 2.5 summary, entry gate, exit evidence, non-goals.
- `docs/17-ai-runtime-access-strategy.md`: ChatGPT Pro web automation vision and fallback chain.
- `docs/10-security-privacy-and-approval.md`: Tier 3 browser automation, project-level delegation, credential custody prohibition.
- `docs/29-phase-capability-implementation-matrix.md`: Phase 2.5 matrix row and transition blockers.
- `docs/12-validation-and-dry-run.md`: Phase 2.5 comparative dry-run pass/fail checks.

## Acceptance scenarios

### Scenario A. Comparative dry-run shows quality lift

Given a Phase 1.5A Evidence Pack for a high-impact decision is incomplete or low confidence.

When the same question is evaluated through a Phase 2.5 candidate lane.

Then:

- DelegationRiskGate returns `allowed_for_comparative_preview`.
- ResearchQualityComparisonReport compares baseline and candidate evidence.
- candidate output adds source-traceable pro/con/uncertainty or freshness evidence.
- product implication maps to Research Review, Decision Approval, Risk Acceptance, Conflict Resolution, Follow-up Question, or Known Risk.
- no submit/write/credential/session custody/account sharing occurs.

### Scenario B. Policy or account risk blocks ChatGPT Pro delegation

Given a ChatGPT Pro/Deep Research candidate would require automated data extraction, account sharing, credential custody, or third-party service operation semantics.

When DelegationRiskGate is evaluated.

Then:

- verdict is `blocked_by_policy_risk` or `blocked_by_session_custody`.
- no browser/ChatGPT action is executed.
- fallback recommends manual prompt handoff, official Codex path, Risk Card, or Known Risk.
- ResearchQualityComparisonReport may record safe failure but cannot claim quality lift.

### Scenario C. Sensitive context requires disclosure downgrade

Given the research question needs full raw idea text, detailed answers, private document, customer identity, credentialed source, or account-session source.

When Phase 2.5 candidate planning runs.

Then:

- automatic transfer is blocked unless a later task-level approval model is explicitly designed.
- public-safe summary or manual handoff is offered.
- disclosure summary records what was withheld.
- evidence remains blocked or downgraded rather than silently sent.

### Scenario D. Browser action preview reaches write boundary

Given browser exploration identifies a form, login, payment, account setting, or submit/write step.

When the preview plan reaches that boundary.

Then:

- Phase 2.5 stops before submit/write.
- action preview records the blocked boundary and required future Phase 3 approval/sandbox/rollback evidence.
- no external mutation occurs.

### Scenario E. Revoke/fallback is visible

Given the user revokes delegation or a session/usage/CAPTCHA/UI-change failure occurs.

When the candidate lane cannot continue safely.

Then:

- activity/audit summary explains why fallback happened.
- source/evidence gaps are visible.
- Research-updated Queue or Known Risks records the unresolved evidence dependency.
- no successful research claim is emitted from partial hidden state.

### Scenario F. Docs contract consistency

Given Phase 2.5 references appear in roadmap, runtime, security, matrix, validation, and README docs.

When documentation is reviewed.

Then:

- all references point to this document as canonical.
- no document claims Phase 2.5 executes submit/write, stores credentials, shares accounts, or implements DTO/API/storage defaults.
- Phase 2.5 remains preview/quality-comparison only until a separate preflight is approved.

## Official reference notes

- ChatGPT Pro includes advanced tools such as Deep Research and Codex, but OpenAI Help materials describe abuse guardrails around automated/programmatic data extraction, account credential sharing, and reselling or powering third-party services. Phase 2.5 must treat these as policy risk gates rather than assumed permission. 참고: <https://help.openai.com/en/articles/9793128-what-is-c>.
- Deep Research in ChatGPT can use public web and user-provided sources depending on plan/settings, and usage/limits vary. Phase 2.5 must preserve user-visible source trace, usage/failure awareness, and fallback. 참고: <https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt>.
