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
- 반복 질문은 topic key와 repeat limit로 수렴해야 하며, 앱은 사용자를 infinite question loop에 가두면 안 됩니다.
- 긴 clarification session에서는 생성됨, 답변됨, 전체 후속 질문, 남은 후속 질문, topic coverage, 남은 follow-up budget count를 질문 진행률에 보여야 합니다.
- 질문 새로고침과 다음 질문 불러오기 control은 화면에서 보이게 두고, 답변 또는 보류 후에는 다음 관련 질문이 자동 보충될 수 있어야 합니다.
- 긴 session에서는 현재 활성 질문 묶음에 작성된 답변들을 한 번에 제출할 수 있지만, 이 action은 보이는 질문/후속 질문 card로만 제한되고 기존 답변별 research loop를 그대로 사용해야 합니다.
- 리서치가 생성한 추가 질문은 evidence card note에만 숨기지 말고 답변 가능하고 source trace가 남는 후속 질문 debt로 Decision Queue에 다시 들어와야 하며, Planning Handoff의 build-slice evidence도 같은 research follow-up provenance를 이어받아야 합니다.
- Research tab은 현재 준비된 planned public-web 리서치 작업을 bounded batch로 시작할 수 있으며, active allowlist와 concurrency budget을 지키고 각 실행은 기존 per-task read-only research path를 그대로 사용해야 합니다.
- Risk UI는 데이터가 충분할 때 Confidence Map, five-axis radar, Top 3 Risk Cards를 보여줍니다. 질문별 리스크 입력은 항상 노출하지 않고 선택형 추가 의견/리스크 펼쳐보기 안에 둡니다.

## 현재 배포 범위

현재 public posture는 제한 베타 형태의 technical preview입니다. local web install/run path를 증명하고 위험한 행동을 reviewable 상태로 유지합니다. 아직 signed macOS/Windows installer package, automatic update, telemetry, Windows real-device certification을 갖춘 broad consumer-grade installer는 아닙니다.
