# 제품 개요

언어: 한국어 | [English](product_EN.md)

## 한 문장 정의

Solo Superman은 초기 창업자의 막연한 아이디어를 제품 명세, 근거 있는 결정, 안전한 구현 준비로 바꾸는 local-first Founder OS입니다.

## 핵심 사용자

- Primary: 만들기 전에 제품 사고를 더 날카롭게 다듬어야 하는 early solo founder.
- Secondary: 개인 workflow tool이나 내부 실험 도구를 만들려는 builder.
- Current release fit: local technical preview와 one terminal command 실행에 익숙한 사용자.

## 핵심 JTBD

앱은 founder가 흐릿한 아이디어에서 바로 시작 가능한 구체적 출발점으로 이동하도록 돕습니다.

| 영역 | 고정되어야 하는 결과 |
| --- | --- |
| Problem | 문제와 고객 pain이 분명해진다. |
| Customer | 타깃 세그먼트와 first users가 분리된다. |
| Value | value proposition과 switching reason이 명확해진다. |
| Evidence | pro evidence, con evidence, uncertainty가 함께 남는다. |
| Scope | MVP/Build Slice가 과하지 않게 정리된다. |
| Risk | 남은 리스크와 next validation action을 알고 시작한다. |

## 세션 모델

- Default session: 2~5 hour focused clarification loop.
- Core surface: Decision Queue. 한 번에 3~5개의 우선순위 질문을 다루며, 질문은 generic startup prompt가 아니라 온보딩에서 입력한 아이디어와 목표에 맞게 생성되어야 합니다.
- 온보딩에서는 공개·읽기 전용 리서치 소스를 허용할지도 함께 묻습니다. 안전한 기본값은 리서치를 나중에 설정하는 것입니다.
- Output: Living Product Spec, Founder Brief, Build Slice Plan, Serve Checklist, Learning Loop Hook.
- Stop feeling: “perfect certainty”가 아니라 “remaining risks를 알고 deliberate하게 시작할 수 있다.”

## 프로젝트 목적 모드

Solo Superman은 두 가지 project-purpose mode를 지원합니다. code field는 `projectPurposeMode`이며, 앱은 mode를 조용히 추정하지 않고 묻거나 확인해야 합니다.

| Mode | 쓰는 경우 | 필수 focus |
| --- | --- | --- |
| `business` | 사업화, 출시, 유료화, 고객 검증 | customer, problem strength, willingness to pay, alternatives, channels, legal/operational risk, validation experiment |
| `personal` | 개인 workflow, 내부 도구, 학습/실험 | actual workflow, repeat frequency, input/output, local data/security, implementation cost, usability success criteria |

Business mode는 명시적인 `businessCriticIntensity`가 필요하며 no default value입니다. Personal mode는 market size, pricing, competition, acquisition channel, investor narrative 같은 commercialization axes를 생략할 수 있지만, 생략된 축은 숨기지 말고 보이게 둡니다.

## UX 원칙

- User-facing language는 Spec-ready, Research in progress, Planning-ready, Waiting for safe execution 같은 journey term을 사용합니다.
- Phase 1, Phase 2.5, tracker, PR number 같은 내부 용어는 일반 user UI에서 제외합니다.
- Question AI는 날카로운 product coach처럼 질문 이유를 설명하고, assumption을 challenge하며, fatigue를 감지합니다.
- Codex generated JSON 초기 질문과 deterministic fallback 질문은 모두 ambiguity-reduction algorithm metadata를 가져야 합니다. 각 질문은 목표·범위·제약·성공 기준·맥락·결정권·assumption pressure 중 가장 약한 차원을 표시하고, fact-checking/current research/human judgment route를 분리해야 하며, 질문 묶음에는 최소 하나의 pressure question과 source-seeking research task가 포함되어야 합니다.
- 반복 질문은 topic key와 repeat limit로 수렴해야 하며, 앱은 사용자를 infinite question loop에 가두면 안 됩니다.
- 질문 카드와 생성된 후속 질문은 질문 의도에 맞춰 주관식/서술형 open question, 찬성·반대 객관식, 여러 종류 중 하나 선택, 하나 이상 선택, 우선순위, 근거 판단, 실험 답변 형식 중 알맞은 답변 방식을 써야 하며 모든 답변을 찬반/pro-con 형태로 강제하면 안 됩니다.
- 긴 clarification session에서는 생성됨, 지금 답할 질문, 다음 질문, 막힘, 답변됨, 전체 후속 질문, 남은 후속 질문, topic coverage, 남은 follow-up budget count를 질문 진행률에 보여야 합니다. Maintainer는 credential-free clarification pipeline 및 clarification volume smoke로 아이디어 intake부터 초기 스펙 분석, 활성 질문 묶음, 답변 제출, follow-up/research debt, Planning Handoff blocker까지 이어지는 질문 루프와 200개 이상의 bounded question/answer loop, 100% question-debt completion을 검증할 수 있어야 합니다.
- 질문 새로고침과 다음 질문 불러오기 control은 화면에서 보이게 두고, 답변 또는 보류 후에는 다음 관련 질문이 자동 보충될 수 있어야 합니다.
- 답변 제출은 백그라운드 리서치 시작이나 다음 질문 자동 보충이 끝날 때까지 사용자를 멈춰 세우면 안 됩니다. 답변 저장이 끝나면 입력 흐름은 먼저 풀리고, public-web 리서치 시작/실패와 queue refill은 조용한 후속 작업 또는 별도 오류로 처리되어야 합니다.
- 긴 session에서는 현재 활성 질문 묶음에 작성된 답변들을 한 번에 제출할 수 있지만, 이 action은 보이는 질문/후속 질문 card로만 제한되고 기존 답변별 research loop를 그대로 사용해야 합니다.
- 리서치가 생성한 추가 질문은 evidence card note에만 숨기지 말고 답변 가능하고 source trace가 남는 후속 질문 debt로 Decision Queue에 다시 들어와야 하며, evidence synthesis가 후속 질문을 만들 때 같은 source trace를 `sourceQueueItemId`로 갖는 planned research task와 `research_evidence_effect` 대기 작업도 함께 만들어야 합니다. Planning Handoff의 build-slice evidence도 같은 research follow-up provenance를 이어받아야 합니다. 이 후속 질문의 답변 형식은 질문 의도에 따라 주관식/서술형 open question, 찬성·반대, 여러 종류 중 하나 선택, 하나 이상 선택, 우선순위, evidence 판단을 고를 수 있어야 하며 모든 질문을 pro/con stance로 강제하면 안 됩니다.
- Research review card는 공개 근거, run, source question이 card를 만든 경우 retained source trace를 보여줘야 하며, 사용자가 리서치 생성 후속 질문을 처리하기 전에 provenance를 확인할 수 있어야 합니다.
- Research tab의 evidence matrix와 evidence pack은 pro evidence, con evidence, uncertainty, missing counter-evidence reason, known risk, next validation action, source reliability, quality gate check를 함께 보여줘야 하며, Planning-ready 전에 skeptical-search gap이 숨겨지지 않아야 합니다.
- Research tab은 현재 준비된 planned public-web 리서치 작업을 bounded batch로 시작할 수 있으며, active allowlist와 concurrency budget을 지키고 각 실행은 기존 per-task read-only research path를 그대로 사용해야 합니다. 사용자는 Research tab에서 동시에 실행할 최대 리서치 수와 세션당 최대 리서치 실행 수를 조절할 수 있어야 하며, 이 한도는 수동 시작과 답변 후 자동 public-web 리서치 시작 모두에 적용됩니다. Provider-polled research 결과는 markdown memory로 저장되어 같은 리서치를 반복할 때 기존 근거를 인용할 수 있어야 하지만, 사용자가 더 넓은 follow-up research를 요청하거나 evidence synthesis가 generated follow-up research task를 시작하면 기존 memory를 baseline context로 붙인 채 새로운 run을 시작해야 합니다. Maintainer는 credential-free research pipeline smoke로 mounted `web_search_readonly` provider polling, source-traced result import, insufficient quality gate review, markdown memory 저장/재사용, evidence matrix/pack/review-card synthesis, Decision Queue follow-up question debt, generated follow-up research run이 함께 연결되는지 검증할 수 있어야 합니다. 실제 공개 웹 접근이 가능한 환경에서는 `pnpm verify:research-pipeline:live-web`로 Playwright 기반 public-web 검색이 fixture URL이 아닌 실제 공개 source URL을 import하는지도 별도로 확인할 수 있어야 합니다. 이 live-web 검증은 로그인, CAPTCHA 우회, 유료 서비스 접근 없이 실패/차단 사유를 그대로 드러내는 opt-in 경로입니다.
- Risk UI는 데이터가 충분할 때 Confidence Map, if-stop-now risk/action, next-best validation/build-readiness action, five-axis radar, Top 3 Risk Cards를 보여줍니다. Founder Brief의 risk/action 배열은 prose section 안에만 묻히지 않고 first-class list로 유지해야 합니다. 질문별 리스크 입력은 항상 노출하지 않고 선택형 추가 의견/리스크 펼쳐보기 안에 둡니다.
- ChatGPT local browser delegation은 external AI workspace를 visible handoff로 사용하기 전에 data disclosure preview, 제외된 민감 필드, policy/session-ownership verdict, approval/authority ref, browser evidence ref, revoke control, result-import gate를 보여줘야 합니다. Browser action은 read-only evidence capture를 위해 approved public-read HTTPS DNS target을 사용할 수 있지만 service-page/local preview flow에는 loopback-only가 계속 필요합니다. External service page-use permission도 user-present login, permission/action echo, artifact deletion, revoke, final-submit boundary를 명시적으로 유지해야 합니다. Maintainer는 실제 ChatGPT/service credential이나 외부 네트워크 접근 없이 loopback browser action, 승인 및 refetch 가능한 permission, artifact cleanup 또는 revoke path, blocked final-submit/credential-free boundary를 증명하는 credential-free browser delegation 및 service page-use pipeline smoke를 실행할 수 있어야 합니다.
- Auto implementation worker control은 local worker job 실행 전에 Codex runtime 준비 상태, checked-at evidence, adapter/schema/transport evidence, execution mode, account status, live-turn flag, manual handoff 가능 여부, ledger-import fallback을 보여줘야 하며, Implementation runtime panel은 사용자가 구현 flow를 떠나지 않고 이 runtime 상태를 새로고침하고 execution mode, Codex account, live-turn state, manual handoff state를 포함한 같은 readiness evidence를 볼 수 있어야 합니다. Maintainer는 live runtime 실행을 기본 verification suite에 강제하지 않고도 `pnpm verify:codex-live-runtime` 같은 opt-in runtime verification command로 skipped, blocked, passed readiness evidence를 구분할 수 있어야 하며, runtime preview request가 `codex_runtime_preview_effect`를 queue하고 effect executor가 실행되어 `preview_ready` runtime artifact를 저장하며 bounded auto-implementation worker job 하나를 ledger import 및 stage advancement까지 완료하고 generated PR open/body-update/merge mutation guard를 실제 GitHub write 없이 검증하는 credential-free fixture smoke들, 모든 canonical auto-implementation stage가 code-review/clean-code/missing-test audit/test evidence로 완료되는 review-loop smoke, preview/worker/PR mutation/review-loop evidence를 한 번에 묶는 aggregate pipeline smoke, 그리고 아이디어 intake부터 clarification answer, research follow-up debt, generated follow-up research, readiness-to-implementation handoff, runtime preview, worker, PR mutation, review-loop, merge_main evidence까지 한 명령으로 묶는 `pnpm verify:core-product-loop` smoke를 사용할 수 있어야 합니다. Maintainer는 `pnpm verify:readiness-to-implementation`로 `spec_ready` completion candidate가 `planning_ready` Planning Handoff를 만든 뒤 첫 auto-implementation run의 `initial_pr` 단계로만 진입하는 positive readiness handoff도 별도로 검증할 수 있어야 합니다. 최종 merge_main 단계는 final_verify_pr_update 이후 현재 PR body evidence가 있고, PR 설명에 전체 검증 명령과 missing-test audit/test evidence가 갱신된 경우에만 진행되어야 합니다. Implementation view는 #259, #266, #267 general-release evidence blocker와 bundle/ready-release 명령을 release-lab checklist로 계속 보여줘야 하며, operator가 local dry-run을 broad-release readiness로 착각하지 않게 해야 합니다.

## 현재 배포 범위

현재 public posture는 제한 베타 형태의 technical preview입니다. local web install/run path를 증명하고 위험한 행동을 reviewable 상태로 유지합니다. Signed package는 `docs/signed-packages_KO.md`/`pnpm verify:signed-package-preflight`의 credential-free preflight와 `docs/signed-package-release_KO.md`/`pnpm verify:signed-package-release`의 release evidence 계약까지만 제공하며, 실제 signing/notarization은 certificate/account/secret과 redacted evidence가 준비된 뒤 검증합니다. Packaged update channel은 `docs/release-channel_KO.md`의 manifest/signature/checksum/retry/rollback 검증 계약과 `docs/packaged-update-rollback_KO.md`/`pnpm verify:packaged-update-rollback`의 device rollback evidence 계약만 고정되어 있으며, `docs/windows-real-device_KO.md`/`pnpm verify:windows-real-device`와 `docs/release-readiness_KO.md`/`pnpm verify:release-readiness`가 Windows 실기기 및 broad release blocker를 한 곳에 묶어 둡니다. 실제 automatic update 적용은 macOS/Windows packaged artifact device rollback verification 이후로 남아 있습니다. 아직 automatic update, telemetry, Windows real-device certification, optional signed-artifact hardening을 갖춘 broad consumer-grade installer는 아닙니다.
