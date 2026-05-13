# 37. Post-Phase3 Full-Vision Backlog Contract

## 역할

이 문서는 Phase 3 Controlled Execution MVP 이후 Solo Superman이 사용자의 최종 제품상으로 확장될 때 필요한 **기능 단위 backlog 계약**을 고정한다. Unified tracker는 #91이며, #91은 Phase 3 child issues #92~#97과 Post-Phase3 full-vision child issues #99~#106을 함께 추적한다. 이 문서는 Phase 3 common ledger/authority, approval/API security, `file_diff`, `shell_command`, `browser_action`, closeout hardening 범위를 대체하지 않고, 그 이후 또는 그 위에 얹히는 후속 issue가 구현 중 임의 결정을 하지 않도록 제품 모드, 권한 경계, acceptance, sequencing을 정리한다. 이전 standalone tracker #98은 #91에 흡수되어 closed 상태다.

사용자-facing UI에는 `Post-Phase3`, `phase`, `PR-xx` 같은 내부 용어를 노출하지 않는다. 사용자에게는 “프로젝트 목적”, “상업성 검증 강도”, “ChatGPT 브라우저 위임”, “서비스 로그인 권한”, “구현 단계 검토”, “설치 확인”처럼 행동 중심 언어로 표시한다.

## Scope anchor

이번 backlog alignment의 기준 결정은 다음이다.

| 항목 | 확정 결정 |
| --- | --- |
| Backlog scope | #91 unified tracker 아래 Phase 3 #92~#97과 Post-Phase3 #99~#106을 기능 단위 issue graph로 함께 추적한다 |
| Project purpose mode | `business`와 `personal` 2개 모드를 둔다 |
| Business critic intensity | 사업화 모드 안에서 사용자가 비판 질문 강도를 명시 선택한다. 기본값은 없다 |
| ChatGPT Pro no-API-key path | 첫 live 목표는 사용자가 직접 로그인한 ChatGPT 브라우저의 **per-run 승인형 로컬 브라우저 자동화**다 |
| Permission posture | 사용자 소유 세션, 명시 승인, revoke, audit, fallback 없이는 자동화하지 않는다 |
| Implementation quality posture | tracker doc, implement step doc, step별 local commit, code review, clean-code review, test evidence를 ledger로 남긴다 |
| Cross-platform posture | macOS shell과 Windows PowerShell 모두에서 install/run/verify 경로가 문서와 테스트로 확인돼야 한다 |

## Hard non-goals and later-contract-only boundaries

다음은 후속 issue 전체에 적용되는 hard boundary다.

- Solo Superman은 사용자의 비밀번호, 2FA, session cookie, API key, ChatGPT credential을 저장하거나 대리 입력하지 않는다.
- 사용자의 ChatGPT Pro 계정을 계정 공유, 제3자 서비스 구동, 재판매, shared backend capacity로 사용하지 않는다.
- 결제, 법률, 의료, 금융, 민감 개인정보, 고객 실명/연락처/계약서/투자자료 원문, 외부 production mutation은 별도 explicit contract 전까지 자동 submit/write하지 않는다.
- hosted web origin은 local pairing, per-run local capability token, explicit approval 없이는 사용자의 로컬 파일, shell, browser를 제어하지 못한다.
- 외부 서비스 회원가입/로그인은 무인 처리하지 않는다. 사용자가 현존하고, 화면을 볼 수 있고, 중단할 수 있어야 한다.
- Phase 3 `ExecutionAuthorityRecord` 없이 file/shell/browser 실행 claim을 만들지 않는다.

## Feature contract A — Project purpose mode

`projectPurposeMode`는 질문, 리서치, completeness, Founder Brief, Planning Handoff의 기본 축을 바꾸는 project-level setting이다.

| Mode | 사용 상황 | 기본 질문/리서치 축 | 생략 또는 optional 처리 | Completion gate |
| --- | --- | --- | --- | --- |
| `business` | 사업화, 출시, 유료화, 고객 검증이 목표 | 고객, 문제 강도, 유료 의향, 대체재, 경쟁, 가격, 채널, 법무/운영 리스크, validation experiment | 없음. 다만 사용자가 특정 축을 명시 defer하면 Known Risk로 남김 | 핵심 business risk가 질문 또는 evidence로 다뤄지고, 반대근거/불확실성/다음 검증이 기록돼야 함 |
| `personal` | 본인이 쓸 도구, 개인 workflow, 내부 실험, 학습용 구현 | 실제 workflow, 반복 빈도, 입력/출력, GUI 필요성, local data/security, 구현 난이도, 유지보수 비용, 성공 기준 | 시장규모, 유료화, 경쟁/대체재, 획득 채널, 투자자 narrative | 개인 workflow success criteria, 구현 가능성, 안전/보안, 사용성 기준이 잠기면 completion 가능 |

### UI requirements

- 프로젝트 생성 또는 intake 초기에 `business` / `personal` 중 하나를 선택하게 한다.
- 초기 답변으로 모드가 분명해도 AI가 확정하지 않고 사용자에게 확인한다.
- 모드는 나중에 변경 가능하지만, 변경 시 새 질문과 리서치 기준이 왜 바뀌는지 Activity Feed에 남긴다.
- Founder Brief에는 모드를 표시하되 내부 enum이 아니라 “사업화 검증 중심” 또는 “개인 workflow 구현 중심”으로 표시한다.

### Data/API notes

- #99 implementation records `projectPurposeMode: "business" | "personal"` in the ProductEngine project snapshot and StartProject payload only after `projectPurposeModeConfirmation: "user_confirmed"`; legacy/imported projects with no mode remain `mode_required` and do not receive an implicit business default.
- Mode 변경 event: `ProjectPurposeModeChanged` with previous mode, new mode, reason, actor, timestamp, and optional suggested mode.
- Queue, ResearchNeed/ResearchTask, Completeness, Founder Brief, and Planning Handoff projection surfaces explain mode effects; `personal` mode includes skipped commercialization axes.
- 변경 route: `POST /api/v1/sessions/:sessionId/project-purpose-mode` persists the audit event and updates the SessionShellProjection while preserving the current active question batch.

## Feature contract B — Business critic intensity

사업화 모드는 “비판 질문을 많이 해서 사업 성공 가능성을 높인다”는 제품 철학을 갖는다. 단, 사용자가 피로도를 통제할 수 있도록 `businessCriticIntensity`를 선택형으로 둔다.

사업화 모드에서 `businessCriticIntensity`는 default value를 갖지 않는다. 사용자가 `balanced`, `strong`, `investor_grade` 중 하나를 명시 선택하기 전에는 business completion gate를 확정하지 않고, UI는 “상업성 검증 강도 선택 필요” 상태를 보여준다. AI가 강도를 추정하거나 조용히 `balanced`/`strong`을 적용하지 않는다.

| Intensity | 사용자-facing 표현 | 질문 정책 | Completion 영향 |
| --- | --- | --- | --- |
| `balanced` | 균형형 검증 | 각 주요 decision group마다 최소 1개 이상의 반대/비판 질문을 포함 | 미해결 business risk는 Known Risk로 남기되 일부 medium risk는 completion을 막지 않음 |
| `strong` | 강한 검증 | 매 active batch에 최소 1개 이상의 핵심 가설 반박 질문을 포함. 고객/문제/유료화/대체재/채널 중 high-impact gap을 우선 | high-impact business risk가 답변/evidence/명시 defer 없이 남으면 completion candidate를 막음 |
| `investor_grade` | 투자심사급 검증 | 반론, 가격, 획득 채널, retention proxy, 법무/운영, 시장 타이밍, founder advantage를 별도 pressure pass로 다룸 | 주요 투자심사급 risk가 evidence 또는 validation action으로 닫히기 전 completion을 강하게 보류 |

### Critical question categories

Business mode에서 질문 엔진은 다음 category를 priority score에 반영한다.

- 고객이 실제로 돈/시간/평판 비용을 치르는 문제인가.
- 대체재가 이미 충분한데 왜 전환하는가.
- 무료 사용 의향과 유료 지불 의향이 분리돼 있는가.
- 처음 10명 고객에게 도달할 현실적인 채널이 있는가.
- MVP가 핵심 가설을 검증하지 못하는 기능 과잉은 아닌가.
- 시장/규제/운영/보안 리스크가 제품 출시를 막는가.
- founder advantage가 없을 때 어떤 distribution 또는 insight가 방어력이 되는가.

### Fatigue and stop rule

- `strong`과 `investor_grade`에서도 현재 active question batch는 바꾸지 않는다. 새 critical item은 `queued_next`로 보낸다.
- 사용자는 “지금은 위험으로 남기고 진행”을 선택할 수 있다. 이 경우 business mode는 해당 항목을 Known Risk와 Next Validation Action에 연결해야 한다.
- 반복 비판 질문은 같은 topicKey repeat limit를 따라야 하며, 같은 반론을 말만 바꿔 되묻지 않는다.

## Feature contract C — ChatGPT Pro local browser delegation

ChatGPT Pro 구독자는 API key를 만들지 않아도, 사용자가 직접 로그인한 ChatGPT 브라우저 세션을 local에서 per-run 승인해 깊은 리서치 보조에 사용할 수 있어야 한다. 이 기능은 OpenAI API가 아니며, ChatGPT 웹 UI를 안정적 API처럼 취급하지 않는다. Required boundary snippets: no credential/2FA/session custody, no account sharing/resale.

### Required preflight

각 run은 시작 전 다음 gate를 통과해야 한다.

- `policyRiskCheck`: 자동/프로그램적 데이터 추출, 계정 공유, 제3자 서비스 구동/재판매로 해석될 위험이 없는지 확인한다.
- `sessionOwnershipCheck`: 사용자가 직접 로그인한 local browser profile인지 확인한다. 제품은 비밀번호, 2FA, cookie, token을 요청하거나 저장하지 않는다.
- `dataDisclosurePreview`: ChatGPT에 보낼 project context 요약, 제외되는 민감 데이터, redaction 결과를 보여준다.
- `approvalDecision`: 사용자가 이번 run에 대해 승인/거절/수정 요청을 선택한다.
- `fallbackPlan`: 실패 시 manual prompt handoff, official Codex path, Known Risk 중 무엇으로 갈지 표시한다.

### Allowed first implementation target

- 한 번의 research task 또는 research batch를 대상으로 per-run 승인한다.
- 승인된 prompt/context를 사용자가 보고 수정할 수 있다.
- local browser automation은 ChatGPT 입력과 결과 회수에 한정한다.
- 결과는 EvidenceMatrix, Research Feed, Decision Queue로 import되기 전에 source/provenance, uncertainty, con evidence, stale risk gate를 통과한다.
- 승인된 prompt, imported result, screenshot, log는 research artifact로 기본 보존한다. 단, credential/session/secret/2FA/payment/legal-sensitive field는 저장 금지이고, 저장 전 redaction preview를 사용자에게 보여준다.
- 사용자는 보존된 ChatGPT delegation artifact를 export/delete할 수 있어야 하며, 삭제 후에도 audit metadata는 원문 없이 hash/ref/provenance 중심으로 남긴다.

### Blocked in first implementation

- 프로젝트 단위 장기 background queue에서 ChatGPT 웹을 계속 사용하는 것.
- 무인으로 여러 task를 밤새 실행하는 것.
- CAPTCHA/anti-bot/usage-limit을 우회하는 것.
- ChatGPT UI 변경을 숨기고 best-effort로 계속 제출하는 것.
- ChatGPT 계정 credential/session custody.
- ChatGPT Pro 구독을 다른 사용자나 고객 요청 처리 backend로 쓰는 것.
- credential/session/secret/2FA/payment/legal-sensitive 원문을 prompt/result/screenshot/log artifact에 보존하는 것.

### Official source anchors

구현 직전 반드시 최신 OpenAI 문서와 약관을 다시 확인한다.

- Codex with ChatGPT plan: <https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan>
- ChatGPT Pro plans: <https://help.openai.com/en/articles/9793128-about-chatgpt-pro-plans>
- OpenAI Terms of Use: <https://openai.com/policies/terms-of-use/>

### PR-03 code-backed surface

- Record/projection: `ChatGptBrowserDelegationRun` inside existing `ChatGptBrowserDelegationProjection` (retained from #101 instead of renaming to `ChatGptDelegationRunProjection` because the route/projection was already mounted).
- Command/API: `CreateChatGptBrowserDelegationRun` via `POST /api/v1/sessions/:sessionId/chatgpt-browser-delegations`; latest projection via `GET /api/v1/sessions/:sessionId/chatgpt-browser-delegations`; revoke via `POST /api/v1/sessions/:sessionId/chatgpt-browser-delegations/:runId/revoke`.
- Run state model: `pending_preflight`, `waiting_for_approval`, `running`, `waiting_for_user`, `importing_result`, `completed`, `blocked`, `failed`, `revoked`; terminal states must include user-visible explanation and next action.
- Result import model: failed source/provenance, uncertainty, con-evidence, or stale-risk gates must become `failed` with `result_import_gate_failed` and visible fallback, not a silent retry or blind import.
- Execution boundary: the command persists deterministic preflight/result-import evidence only. Live navigation/capture remains tied to a Phase 3 `browser_action` `ExecutionAuthorityRecord`.
- Persistence boundary: #102 remains projection-only. The latest `ChatGptBrowserDelegationProjection` carries the run list/audit refs, while canonical chronology stays in ProductEngine events; add a dedicated run repository only when a later PR needs query-by-run or artifact-custody workflows beyond latest projection/refetch.

## Feature contract D — External service login and page-use permission

Solo Superman이 사용자의 프로그램 구현을 위해 Vercel, Supabase, Stripe, GitHub, domain/DNS, app store, 기타 SaaS 페이지 사용이 필요해지면, 권한은 “계정 대리 보관”이 아니라 “사용자가 로그인한 페이지에 대한 목적 제한 page-use permission”이어야 한다.

### Permission record requirements

후속 구현은 `ServicePageUsePermission`에 준하는 record를 둔다.

- service name and origin.
- user-visible purpose.
- allowed page/action classes: read, fill draft, preview, copy generated value, final submit request.
- explicitly blocked action classes.
- data categories visible to the agent.
- approval granularity: per action, per page, per setup step.
- explicit user approval ref after previewing service origin, page URL, purpose, data categories, allowed actions, blocked actions, and redaction/export/delete controls.
- revoke state and timestamp.
- audit refs and evidence refs.
- prompt/result/screenshot/log artifact는 연구·구현 근거로 기본 보존할 수 있지만, credential/session/secret/2FA/payment/legal-sensitive field는 저장하지 않는다.
- artifact 보존 전 redaction preview를 제공하고, 사용자가 원문 artifact를 export/delete할 수 있어야 한다.
- Current #103 implementation surface: `ServicePageUsePermission` records inside `ServicePageUsePermissionProjection`, created by `CreateServicePageUsePermission`, queried with `GET /api/v1/sessions/:sessionId/service-page-use-permissions`, revoked by `RevokeServicePageUsePermission`, and artifact-ref deleted by `DeleteServicePageUsePermissionArtifacts` via `POST /api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/artifacts/delete`.
- Events: `ServicePagePermissionGranted`, `ServicePagePermissionRevoked`, `ServicePageArtifactsDeleted`, `ServicePageActionBlocked`, and `ServicePageFinalSubmitRequested`.
- Persistence boundary: #103 remains projection-only. Browser page capture evidence comes from the Phase 3 `browser_action` `ExecutionAuthorityRecord`; service page-use dry-runs pass the permission id/action class so revoked or scope-mismatched permissions block before capture, while this permission route records purpose/action/data/retention/audit refs and never stores credentials/session values.

### Submit boundary

- “저장 직전까지 채우기”와 “최종 submit/click/구매/배포”는 다른 권한이다.
- final submit은 별도 confirmation card와 `ExecutionAuthorityRecord` linkage만으로 실행 가능 상태가 되지 않으며, production mutation을 명시적으로 검증하는 후속 contract가 생기기 전까지 blocked 상태로 남긴다.
- 결제, 법률, 의료, 금융, 개인정보, production deploy, DNS cutover, account deletion은 later explicit contract 전까지 blocked다.

## Feature contract E — Implementation step ledger

Canonical artifact family name: `ImplementationStepLedger`.

비개발자용 제품이 실제 프로그램을 만들어주는 단계로 가려면, 구현은 문서 기반 ledger를 따라야 한다.

### Required artifacts

- `TrackerDoc`: 전체 구현 목표, child step, dependency, stop condition.
- `ImplementationStepDoc`: 한 step의 목표, files/modules expected, commands, tests, rollback, review criteria.
- `StepCommitRecord`: local git commit SHA, diff summary, related step doc, authoring agent, timestamp.
- `CodeReviewRecord`: 이전 commit 대비 correctness/security/API/UX/test review 결과.
- `CleanCodeReviewRecord`: 단순화, 중복, naming, boundary, dependency creep 검토 결과.
- `TestEvidenceRecord`: commands, exit codes, logs, known gaps.

### Step policy

- 한 step은 구현, local commit, code review, clean-code review, test evidence 없이는 완료되지 않는다.
- 리뷰는 “현재 working tree”가 아니라 “이전 step commit 대비 diff”를 기준으로 한다.
- 실패한 test나 미실행 test는 다음 step으로 숨기지 않고 blocker 또는 Not-tested로 남긴다.
- 구현자가 새 dependency, external service, production mutation을 필요로 하면 step을 멈추고 새 approval/issue로 분리한다.

## Feature contract F — macOS and Windows PowerShell install/run verification

비개발자에게 web UI를 제공하려면 local setup 문서는 macOS shell과 Windows PowerShell 모두에서 복사 실행 가능해야 한다.

### Required command families

- prerequisites check: Node, pnpm/corepack, Git.
- install: dependency install and generated assets if needed.
- run: local sidecar + web UI with local capability token.
- verify: typecheck/lint/test/doc-contract checks.
- browser automation prerequisite check: Playwright/browser install or explicit skip/fallback.
- troubleshooting: port conflict, token mismatch, CORS/origin, Windows execution policy/path quoting, long path, antivirus/network prompt.

### Windows install default

Windows PowerShell 문서의 기본 설치 경로는 `winget` 우선이다.

- Node LTS와 Git은 `winget` command block을 먼저 제공한다.
- `winget`을 사용할 수 없거나 조직 정책으로 막힌 환경은 nodejs.org와 Git for Windows의 공식 다운로드/수동 설치 fallback을 제공한다.
- Chocolatey/Scoop은 first implementation의 기본 경로가 아니다. 나중에 필요하면 별도 troubleshooting note 또는 explicit follow-up으로 분리한다.

### Acceptance

- macOS and Windows commands are documented side by side.
- Windows examples use PowerShell syntax, not bash-only syntax.
- Windows prerequisite installation uses `winget` as the primary path and official manual downloads as fallback.
- No install command requires storing ChatGPT/OpenAI API keys by default.
- Verification can be run without external production credentials.

## Registered GitHub issue graph

이 issue graph는 live GitHub에 등록된 canonical backlog다.

1. #91 `[Tracker] Phase 3 Controlled Execution + Post-Phase3 Full-Vision Backlog`
2. #92~#97 Phase 3 controlled execution child issues
3. #99 `[Post-Phase3 / PR-01] Project purpose modes: business vs personal`
4. #100 `[Post-Phase3 / PR-02] Business critic intensity and critical-question gates`
5. #101 `[Post-Phase3 / PR-03] ChatGPT Pro local browser delegation contract`
6. #102 `[Post-Phase3 / PR-04] ChatGPT delegation run/audit/revoke/fallback UI and storage`
7. #103 `[Post-Phase3 / PR-05] External service login and page-use permission contract`
8. #104 `[Post-Phase3 / PR-06] Implementation step ledger with commit-review-test loop`
9. #105 `[Post-Phase3 / PR-07] macOS and Windows PowerShell install/run verification`
10. #106 `[Post-Phase3 / PR-08] Docs/verifier closeout for full-vision backlog alignment`

#98 was the temporary standalone Post-Phase3 tracker and is closed after its content was absorbed into #91.

각 child issue는 goal, user value, dependency, in-scope, out-of-scope, data/API/UI notes, acceptance criteria, verification plan, sequencing note를 포함해야 한다.

## Closeout checklist

- [x] `docs/README.md`, `01-prd.md`, `06-research-engine.md`, `10-security-privacy-and-approval.md`, `11-roadmap-and-phase-boundaries.md`, `17-ai-runtime-access-strategy.md`, `29-phase-capability-implementation-matrix.md`, `36-phase3-controlled-execution-contract.md`가 이 문서를 참조한다.
- [x] `scripts/verify-doc-contracts.mjs`가 이 문서의 핵심 snippet과 cross-reference를 검증한다.
- [x] GitHub issue tracker #91이 Phase 3 #92~#97과 Post-Phase3 #99~#106을 함께 추적하고, #98은 #91에 흡수되어 closed 상태다.
- [x] `pnpm verify`가 통과한다.
