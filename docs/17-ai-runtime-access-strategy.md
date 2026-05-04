# 17. AI Runtime Access Strategy

## 역할

AI Runtime Access Strategy는 Solo Superman이 AI를 어떻게 사용자의 제품 경험으로 제공할지 정의한다. 핵심은 “AI provider를 얼마나 많이 붙일 것인가”가 아니라, **초기 창업자가 API key 발급 없이 Codex 중심 자동화와 깊은 리서치 보조를 사용할 수 있게 하되, Phase별 권한 경계를 명확히 지키는 것**이다.

이 문서는 `09-system-architecture.md`의 RuntimeAdapter 선택, `10-security-privacy-and-approval.md`의 권한 경계, `06-research-engine.md`의 리서치 실행 경로, `11-roadmap-and-phase-boundaries.md`의 Phase 진입 조건을 연결한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| 사용자 기본 AI onboarding | API key 입력을 기본 요구하지 않는다 |
| Phase 1 primary integration | Codex app-server |
| Phase 1 Codex 권한 | sandbox preview allowed |
| Phase 1 browser automation | 제외 |
| Phase 1 deep research fallback | 수동 프롬프트 핸드오프 → 공식 Codex 경로 |
| ChatGPT Pro 웹 자동화 | Phase 2+ 비전 |
| ChatGPT Pro 웹 자동화 승인 모델 | 프로젝트 단위 1회 포괄 위임, revoke/audit 필수 |
| 일반 사용자 API key fallback | 기본 UX에서 제외 |
| 고급 API key fallback | 후속 ADR 후보이며 Phase 1 기본값 아님 |

## 왜 API key 기본 입력을 피하는가

초기 창업자에게 API key 발급, billing dashboard, 사용량 예측, secret 보관을 요구하면 첫 세션의 진입 장벽이 커진다. Solo Superman의 첫 가치는 “기획을 촘촘하게 만드는 2~5시간 세션”이므로, AI 비용과 인증 설명이 제품 핵심 경험을 가로막으면 안 된다.

따라서 기본 UX는 다음 순서를 따른다.

1. 사용자는 Codex/ChatGPT 계정 기반 AI 사용을 먼저 시도한다.
2. Phase 1은 Codex app-server를 로컬 sidecar처럼 다루는 방향으로 설계한다.
3. ChatGPT Pro 웹 자동화는 Phase 1에서 구현하지 않고, Phase 2+의 깊은 리서치 자동화 비전으로 둔다.
4. 자동화가 막히면 API key 입력을 요구하기보다 수동 프롬프트 핸드오프와 공식 Codex 경로를 먼저 제공한다.

## 공식 근거와 설계 제약

OpenAI 공식 문서 기준으로 다음 사실을 Phase 0 문서 계약의 근거로 둔다.

- Codex CLI는 로컬 터미널에서 실행되며 ChatGPT 계정 또는 API key 인증을 지원한다. 참고: <https://developers.openai.com/codex/cli>
- Codex app-server는 자체 제품 안에서 인증, 대화 기록, 승인, 스트리밍 이벤트를 연결하는 깊은 통합 경로다. 참고: <https://developers.openai.com/codex/app-server>
- Codex SDK는 프로그래밍 방식의 Codex 작업 자동화 경로다. 참고: <https://developers.openai.com/codex/sdk>
- Codex는 ChatGPT Plus, Pro, Business, Edu, Enterprise 계정에서 사용할 수 있다. 참고: <https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan>
- ChatGPT Pro는 Codex와 Deep Research를 포함하지만, 자동/프로그램 방식의 데이터 추출, 계정 공유, 제3자 서비스 구동/재판매 관련 제한이 있을 수 있다. 참고: <https://help.openai.com/en/articles/9793128-what-is-c>

설계 제약:

- 문서는 현재 공식 문서에 근거한 제품 방향을 고정하지만, 실제 구현 직전에는 OpenAI 문서와 약관을 다시 확인해야 한다.
- ChatGPT 웹 UI를 자동 조작하는 방식은 공식 API 안정성 계약이 아니므로 Phase 1 기본 구현 범위가 아니다.
- 사용자의 ChatGPT 계정 또는 세션을 Solo Superman 서버가 보관하거나 대리 공유하는 구조는 금지한다.

## Runtime access ladder

```text
Phase 1
  Codex app-server sandbox preview
  + manual prompt handoff
  + official Codex path research/analysis fallback

Phase 2+
  ChatGPT Pro web deep research automation
  + project-level blanket delegation
  + revoke/audit/session failure handling

Later / ADR only
  Advanced API-key provider fallback
  + explicit cost ownership
  + encrypted secret storage
```

이 ladder의 목적은 자동화를 포기하는 것이 아니라, **Phase 1에서 안전한 자동화와 제품 정체성 검증을 먼저 끝낸 뒤 웹 자동화를 붙이는 것**이다.

## Phase 1: Codex app-server primary

Phase 1의 1차 AI RuntimeAdapter는 `CodexRuntimeAdapter`다. 구현 후보는 Codex app-server이며, SDK/CLI는 fallback 또는 보조 경로다.

### CodexRuntimeAdapter 책임

- 사용자 ChatGPT/Codex 로그인 흐름을 제품 onboarding에 연결한다.
- Codex thread를 Solo Superman Project/Session에 연결한다.
- 질문 생성, ambiguity 분석, 리서치 프롬프트 생성, evidence 요약, Spec update suggestion을 생성한다.
- Codex stream event를 Activity Feed와 Execution Log에 표시 가능한 이벤트로 변환한다.
- Codex approval request가 발생하면 Solo Superman의 Approval Manager로 라우팅한다.
- 파일/명령/브라우저 실행 요청은 Phase 1에서 실제 적용하지 않고 preview artifact로만 변환한다.

### 허용되는 Phase 1 작업

| 작업 | 허용 여부 | 설명 |
| --- | --- | --- |
| Initial Spec draft 생성 | 허용 | 사용자 아이디어를 Living Product Spec 초안으로 정리 |
| AmbiguityIssue 분석 | 허용 | missing/conflict/unsupported/vague/decision_required 탐지 |
| QuestionBatch 생성 | 허용 | 3~5개 질문과 선택지, why/how 설명 생성 |
| Research prompt 생성 | 허용 | 사용자가 ChatGPT/Codex에 넘길 프롬프트와 회수 템플릿 생성 |
| Evidence 요약/분류 | 허용 | 사용자가 붙여넣은 리서치 결과 또는 공식 Codex 경로 결과를 EvidenceMatrix로 정리 |
| Suggested Spec Update | 허용 | before/after summary와 risk level 생성 |
| Diff/command plan preview | 허용 | 실제 적용 없이 구현 계획 artifact로만 표시 |
| 앱 내부 low-risk 정리 | 조건부 허용 | 사용자 승인된 정책 안에서 문장 정리/중복 제거 수준만 가능 |

### 금지되는 Phase 1 작업

| 작업 | 이유 |
| --- | --- |
| 실제 프로젝트 파일 patch 적용 | “자동 코드 실행 없음” non-goal 위반 |
| shell command 실행 적용 | 로컬 환경과 데이터 안전 경계 위반 |
| browser action 실행 | Phase 1 browser automation 제외 원칙 위반 |
| ChatGPT 웹 UI 자동 조작 | Phase 2+ 비전이며 Phase 1 구현 제외 |
| 사용자의 ChatGPT 계정 공유/대리 보관 | 보안/정책 리스크 |
| API key를 일반 사용자 onboarding 필수값으로 요구 | 진입 장벽과 비용 통제 UX 악화 |

## Sandbox preview mode

Phase 1의 Codex 권한은 `sandbox_preview_allowed`다.

정의:

```text
Codex may reason, draft, simulate, and produce preview artifacts.
Codex may not apply changes to the user OS, browser, shell, or project files.
```

Preview artifact 유형:

- `research_prompt_preview`: ChatGPT/Codex에 넘길 깊은 리서치 프롬프트.
- `research_result_import_template`: 사용자가 결과를 붙여넣을 때 필요한 구조.
- `spec_update_preview`: Living Product Spec 변경 제안과 before/after 요약.
- `implementation_plan_preview`: Phase 2 handoff용 task breakdown.
- `diff_preview`: 실제 파일 적용 전의 예상 diff 설명.
- `command_plan_preview`: 실행하지 않는 명령 계획과 위험 설명.
- `browser_action_preview`: Phase 2+에서만 실행 가능한 브라우저 조작 계획.

Preview artifact는 “실행 결과”가 아니라 “검토 가능한 제안”이다. high-impact artifact는 Decision Approval Card 또는 Risk Card로 연결한다.

## Manual prompt handoff

Phase 1에서 깊은 리서치가 필요하지만 ChatGPT 웹 자동화가 아직 Phase 범위 밖이면, Research Engine은 다음 handoff를 생성한다.

1. 리서치 목적.
2. 포함할 project context 요약.
3. 제외해야 할 민감 정보.
4. ChatGPT/Codex에 붙여넣을 prompt.
5. 결과를 Solo Superman에 다시 가져오기 위한 template.
6. 기대 evidence type: pro evidence, con evidence, uncertainty, implication, source.
7. 결과가 불충분할 때의 fallback: 공식 Codex 경로 또는 Known Risk.

Manual handoff는 실패가 아니라 Phase 1의 안전한 깊은 리서치 경로다.

## Official Codex path fallback

사용자가 수동 프롬프트 핸드오프를 원하지 않고 계속 자동화를 원하면, Phase 1은 ChatGPT 웹 우회 자동화 대신 공식 Codex 경로로만 리서치/분석을 진행한다.

허용 경로:

- Codex app-server thread.
- Codex CLI 또는 Codex SDK 기반 research/analysis task.
- Codex 공식 web/search 기능이 제공하는 범위.

불허 경로:

- ChatGPT 웹 UI를 DOM/브라우저 자동화로 조작.
- 사용자의 웹 세션을 장시간 백그라운드 대리 사용.
- 정책상 자동 추출로 해석될 수 있는 반복 scraping.

공식 Codex 경로도 Phase 1에서는 sandbox preview 권한만 가진다. 즉, 결과는 Spec/Research artifact로 들어오지만 OS 파일, shell, browser에 적용되지 않는다.

## Phase 2+: ChatGPT Pro web automation vision

ChatGPT Pro 웹 자동화는 Phase 2+의 후보이며, 기존 Roadmap의 Browser Automation Preview 단계와 연결된다.

목표:

- 사용자가 프로젝트 단위로 한 번 위임하면 깊은 리서치 작업을 자동 수행한다.
- ChatGPT Pro의 Deep Research 성격을 활용하되, Solo Superman은 결과를 EvidenceMatrix와 Decision Queue에 맞게 회수/정리한다.
- 사용자는 자동화 상태, 남은 리스크, 실패 원인, revoke control을 볼 수 있어야 한다.

필수 진입 조건:

- ChatGPT 웹 자동화의 정책/약관 리스크 검토 완료.
- 웹 UI 변경, 세션 만료, 사용량 제한, CAPTCHA/anti-bot, 결과 회수 실패에 대한 recovery policy 정의.
- 프로젝트 단위 포괄 위임 screen, revoke control, audit log 설계 완료.
- private data 전송 금지 또는 redaction 규칙 정의.
- fallback chain이 구현되어 있음.

## Project-level blanket delegation

Phase 2+에서 ChatGPT Pro 웹 자동화를 켜면 기본 승인 모델은 프로젝트 단위 포괄 위임이다.

사용자에게 최초 1회 표시할 내용:

- 어떤 목적의 deep research에 ChatGPT 웹이 사용되는가.
- 어떤 데이터 범주가 전송될 수 있는가.
- 어떤 데이터는 절대 전송하지 않는가.
- 자동화가 실패하면 어떤 fallback이 적용되는가.
- 사용량 제한과 정책 리스크가 있을 수 있다는 점.
- 언제든 끌 수 있는 revoke control 위치.
- audit log에서 확인할 수 있는 항목.

포괄 위임 이후에도 다음은 별도 차단 또는 재확인 후보로 둔다.

- 계정 비밀번호/2FA/인증정보 입력 대리.
- 결제, 법률, 의료, 금융, 민감 개인정보 자동 제출.
- 고객 실명/연락처/계약서/투자자료 원문 전송.
- 로그인된 외부 SaaS에서 데이터 추출.
- 약관 위반 가능성이 큰 반복 자동화.

## Fallback chain

ChatGPT Pro 웹 자동화가 실패하거나 정책 리스크가 감지되면 다음 순서를 따른다.

```text
ChatGPT web automation requested
→ policy/session/reliability check
→ if risky or failed: recommend manual prompt handoff
→ if user still wants full automation: use official Codex path only
→ if official Codex path is insufficient: create Risk Card + Known Risk + Next Validation Action
```

Fallback은 조용히 일어나면 안 된다. Decision Queue 또는 Activity Feed에 다음을 표시한다.

- 왜 fallback이 발생했는가.
- 어떤 데이터가 전송되지 않았는가.
- 어떤 evidence가 부족한가.
- 사용자가 지금 멈추면 Founder Brief에 어떻게 남는가.

## Adapter 상태

`CodexRuntimeAdapter`는 최소한 다음 상태를 가져야 한다.

| 상태 | 의미 |
| --- | --- |
| `not_configured` | Codex 연결이 아직 없음 |
| `login_required` | ChatGPT/Codex 로그인 필요 |
| `ready` | Codex app-server thread 실행 가능 |
| `running` | 분석/리서치/질문 생성 중 |
| `approval_required` | Codex가 권한 요청을 보냈고 사용자 결정 필요 |
| `preview_ready` | 실행이 아니라 preview artifact가 생성됨 |
| `manual_handoff_recommended` | 웹 자동화 또는 공식 경로가 부적합해 수동 handoff 권유 |
| `codex_official_fallback` | 공식 Codex 경로로만 자동화 진행 |
| `blocked_by_policy_or_session` | 정책/세션/신뢰성 문제로 중단 |
| `failed` | 복구 가능한 오류 또는 retry 필요 |

## Traceability 연결

AI runtime 작업은 State/Event Contract를 우회하지 않는다.

- Codex가 생성한 질문은 반드시 `AmbiguityIssue`와 `topicKey`에 연결된다.
- Codex가 만든 리서치 프롬프트는 `ResearchTask` 또는 `ResearchNeed`에 연결된다.
- 수동 handoff 결과는 `ResearchResult`로 import되고 source/limitation을 가진다.
- Codex가 만든 Spec 변경은 `SpecUpdate`이며, high-impact이면 `Decision` approval을 요구한다.
- preview artifact는 `SpecVersion`의 직접 원인이 될 수 없다.
- CompletionCandidate는 runtime 성공 여부가 아니라 evidence, decision, known risk 상태로 판단한다.

## 검증 질문

구현 전 문서 검토자는 다음 질문에 모두 “예”라고 답할 수 있어야 한다.

- Phase 1에서 Codex app-server가 실제 파일을 바꿀 수 없는가?
- Phase 1에서 shell command가 실행되지 않는가?
- Phase 1에서 ChatGPT 웹 자동화가 구현 범위 밖인가?
- API key가 일반 사용자 onboarding 필수값이 아닌가?
- 깊은 리서치가 필요할 때 수동 handoff와 공식 Codex 경로 fallback이 정의되어 있는가?
- Phase 2+ ChatGPT 웹 자동화의 프로젝트 단위 포괄 위임, revoke, audit, policy/session failure가 정의되어 있는가?
- Codex 결과가 Question, ResearchTask, EvidenceMatrix, Decision, SpecVersion trace를 우회하지 않는가?
