# 02. User Journey and UX

## UX 핵심 문장

Solo Superman의 화면은 문서 편집기가 아니라 **창업자의 결정 관제실**이어야 한다. 중심은 긴 문서가 아니라 지금 답해야 할 질문과 승인해야 할 결정이다.

UX 세션의 세부 원칙은 `13-ux-doctrine-and-session-dynamics.md`를 source of truth로 둔다. 이 UX 문서는 화면과 사용자 여정을 설명하고, UX Doctrine 문서는 사용자가 세션 끝에 느껴야 할 감각, confidence map, 날카로운 제품 코치 톤, 행동 신호 기반 피로도 개입, Founder Brief 기준을 고정한다. 내부 capability phase와 사용자-facing journey stage의 용어 경계는 `28-founder-os-product-doctrine.md`를 따른다.

핵심 감각은 다음과 같다.

> 사용자는 “모든 것이 확실해졌다”가 아니라 **남은 리스크를 알고 시작한다**는 상태로 세션을 끝내야 한다.

## 기본 레이아웃

첫 제품 경험의 기본 레이아웃은 `Decision Queue 중심`이다.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Project Header: name, completeness, session timer, sync status    │
├───────────────┬───────────────────────────────────┬──────────────┤
│ Spec Outline  │ Decision / Question Queue          │ Context Panel │
│ - Problem     │ - current 3~5 questions            │ - evidence    │
│ - Customer    │ - decision approvals               │ - pro/con     │
│ - Value prop  │ - blocked items                    │ - spec diff   │
│ - Competition │ - completed decisions              │ - source log  │
├───────────────┴───────────────────────────────────┴──────────────┤
│ Research / Activity Feed: tasks, findings, update suggestions      │
└──────────────────────────────────────────────────────────────────┘
```

Header와 Context Panel은 복합 완성도 점수만 보여주지 않는다. 사용자가 어떤 리스크를 안고 다음 행동으로 넘어가는지 이해할 수 있도록 5축 레이더 기반 Confidence Map도 함께 제공한다.

## 2~5시간 세션 흐름

### 1. Intake

사용자가 아이디어를 입력한다.

좋은 intake는 많은 양식 입력을 요구하지 않는다. 사용자는 다음 중 하나만 해도 된다.

- 한 문장 아이디어.
- 긴 메모.
- 기존 기획서 초안.
- 경쟁 서비스 링크 목록.
- 창업자 본인의 문제 경험.

시스템은 입력 직후 다음을 만든다.

- Initial Spec Draft.
- AmbiguityIssue 목록.
- 첫 질문 배치.
- 첫 리서치 task 후보.

### 2. First question batch

첫 질문 배치는 3~5개다. 질문은 다음 원칙을 지킨다.

- 제품의 본질을 결정하는 질문을 먼저 묻는다.
- 답변하지 않으면 downstream rework가 큰 질문을 우선한다.
- 선택지만 던지지 않고, 현재 이해와 왜 중요한지를 설명한다.
- 객관식 선택지를 먼저 보여주고, 각 보기의 장점과 단점을 한 줄씩 함께 표시한다.
- 보기 중 맞는 답이 없으면 아래 텍스트박스에 직접 서술할 수 있다.

### 3. Parallel research

사용자가 질문에 답하는 동안 시스템은 병렬로 리서치를 수행한다.

- 경쟁/대체재 조사.
- 고객 세그먼트 관련 근거.
- 시장/트렌드 참고 자료.
- 검증 실험 예시.
- 반대근거와 리스크 탐색.

리서치 결과는 feed에 쌓이지만 사용자를 방해하지 않는다. 사용자가 볼 때는 Decision Queue의 근거 패널에 연결되어 있어야 한다.

### 4. Decision queue burn-down

질문이 계속 생기지만, 사용자는 항상 다음을 볼 수 있어야 한다.

- 현재 high-risk 질문 수.
- 이번 배치가 해소할 모호함.
- 답변 후 올라갈 예상 완성도.
- 답변 후 영향을 받는 confidence 축.
- 리서치가 아직 기다리는 항목.
- 지금 멈추면 어떤 품질의 Spec이 되는지.
- 지금 멈추면 Founder Brief에 어떤 Known Risks가 들어가는지.

### 5. Suggested Spec Update

답변과 리서치가 충분하면 시스템은 Spec 업데이트 제안을 만든다.

- low-risk 변경: 문장 정리, 구조화, 출처 연결, 중복 제거는 자동 반영 가능.
- high-impact 결정: 타깃, 문제정의, 가치제안, MVP 범위, 성공기준은 승인 필요.

### 6. Completion candidate

복합 완성도가 기준을 넘고 high-risk 질문이 임계치 이하가 되면 시스템은 완료 후보를 제안한다.

사용자는 세 가지 중 하나를 선택한다.

1. 완료 선언: 현재 Spec을 v1으로 고정한다.
2. 더 깊게 질문: 남은 medium/low 질문을 계속 답한다.
3. 리서치 보강: 근거가 약한 핵심 주장만 더 조사한다.

## 화면 컴포넌트

### Project Header

표시 항목:

- 프로젝트 이름.
- 복합 완성도 점수.
- Confidence Map 5축 레이더 요약.
- readiness label: Draft, Researching, Decision-ready, Spec-ready.
- 세션 경과 시간.
- sync 상태.
- 남은 high-risk 질문 수.
- 가장 낮은 confidence 축.

### Confidence Map Panel

Confidence Map은 사용자가 “어디까지 확실한가”보다 “어디가 아직 위험한가”를 파악하게 하는 패널이다.

첫 제품 경험 표시 방식:

- **5축 레이더**: 문제 확신도, 고객 세그먼트 확신도, 가치제안 확신도, 검증 가능성 확신도, 구현 준비도 확신도.
- **Top 3 Risk Cards**: 지금 가장 크게 남은 리스크 3개.
- **Next Question Batch**: 다음 3~5개 질문이 어떤 confidence 축을 올리는지.
- **Score History**: 답변, 리서치, 승인 이후 축별 점수 변화.

이 패널은 축하용 진행률 그래프가 아니다. 창업자가 낮은 confidence 축을 보고 “다음에는 무엇을 검증해야 하는지” 판단하게 하는 리스크 지도다.

### Spec Outline Panel

목적은 문서 편집이 아니라 현재 결정 지도를 보여주는 것이다.

- 각 section의 완성도.
- 근거 부족 표시.
- 충돌 표시.
- 승인 대기 표시.
- 최근 변경 표시.

### Decision / Question Queue

중앙 영역이다.

카드 유형:

- Question Card.
- Decision Approval Card.
- Research Review Card.
- Conflict Resolution Card.
- Completion Candidate Card.

카드 공통 필드:

- 제목.
- 중요도.
- 관련 Spec section.
- 왜 지금 중요한가.
- 답하면 잠기거나 열리는 decision.
- 답하지 않으면 생기는 risk.
- 어떤 confidence 축을 개선하는가.
- 선택지 또는 입력란.
- 답변 후 기대 효과.

첫 카드 경험은 가능하면 Next Best Action Card 형태로 보여준다. 사용자는 queue item type보다 “지금 무엇을 해야 하는가”를 먼저 이해해야 한다.

### Context Panel

현재 카드와 연결된 근거를 보여준다.

- 관련 리서치 요약.
- 찬성 근거.
- 반대 근거.
- 불확실성.
- 출처.
- Spec diff preview.

### Research / Activity Feed

실시간 작업 로그다.

표시 항목:

- research task 시작/완료.
- 새 evidence 생성.
- 새 question 생성.
- Spec update suggestion 생성.
- 자동 반영된 low-risk 변경.
- 승인된 결정.

## 질문 UX 규칙

각 질문은 다음 구조를 갖는다.

```text
현재 이해
- 시스템이 지금까지 이해한 내용.

왜 중요한가
- 이 답변이 어떤 모호함을 해소하는지.

답변 방법
- 사용자가 어떤 기준으로 고르면 되는지.

질문
- 한 번에 하나의 핵심 질문.

선택지
- 객관식 2~4개 추천 선택지를 주관식 입력보다 위에 표시한다.
- 각 선택지는 장점(`pro`)과 단점(`con`)을 한 줄씩 함께 보여준다.
- 보기 중 맞는 답이 없으면 아래 텍스트박스에 직접 서술할 수 있다.
```

## 내부 용어 노출 금지

사용자-facing 화면은 내부 phase, command, schema, runtime adapter를 직접 드러내지 않는다. 내부 정보가 필요한 경우 debug/admin surface로 숨긴다.

| 내부 표현 | 사용자-facing 표현 |
| --- | --- |
| `Phase 1.5A` | 근거 보강 |
| `Phase 1.5B` | 실행 준비 메모 |
| `Runtime preview` | 만들기 전 실행 계획 미리보기 |
| `Effect task` | 백그라운드 작업 |
| `Command failed` | 처리 실패 |
| `schema version` | debug/admin metadata |
| raw planning gate text, `blocks Planning-ready` | 실행 계획 준비 조건 / 아직 실행 계획 준비 전 |

`Planning-ready` 자체는 `28-founder-os-product-doctrine.md`와 `31-phase2-planning-handoff-contract.md`가 허용한 final user-facing stage label이다. 금지되는 것은 blocker report, raw gate status, 내부 오류 문구를 `Planning-ready` handoff처럼 보여주는 것이다.

## 질문 AI 톤

AI는 기본적으로 **날카로운 제품 코치**처럼 행동한다. 사용자의 아이디어를 칭찬하는 것보다 모호함, 근거 없는 확신, 문제-고객-가치제안 불일치, 너무 넓은 MVP 범위를 명확히 짚는 것이 우선이다.

단, 날카로움은 안전 경계를 지켜야 한다.

- 항상 왜 이 질문이 필요한지 설명한다.
- 같은 주제 질문이 3회 반복되면 더 묻지 않고 보류, 리서치 부족, risk accepted 중 하나로 전환한다.
- 근거가 약한 판단은 “가설”, “현재 추정”, “검증 필요”로 표현한다.
- 피로도가 감지되면 질문 강도를 낮추고 요약 후 계속 여부를 확인한다.

## 행동 신호 기반 피로도 UX

피로도는 별도 설문만으로 판단하지 않는다. 첫 제품 경험은 **행동 신호 기반**으로 집중력 저하를 감지한다.

주요 신호:

- 답변이 급격히 짧아짐.
- 보류 답변이나 건너뛰기가 늘어남.
- 같은 선택지를 반복하지만 이유 설명이 줄어듦.
- 질문 회피가 늘어남.
- 낮은 confidence 축이 개선되지 않는데 질문만 반복됨.

피로 신호가 감지되면 시스템은 즉시 다음 질문을 밀어붙이지 않고 다음 요약을 보여준다.

- 지금까지 확정된 결정.
- confidence delta.
- 지금 멈추면 받을 수 있는 산출물.
- 낮은 confidence 축.

이 요약에서는 명시적 Top 3 Risk Cards를 기본으로 보여주지 않는다. 피로 상태에서는 압박감을 줄이기 위해 낮은 confidence 축을 먼저 보여주고, 사용자가 원할 때 세부 리스크 카드로 들어가게 한다.

## 무한 질문 루프 방지 UX

- 질문 큐는 무한 목록처럼 보이면 안 된다.
- 기본 화면은 “남은 모든 질문”이 아니라 “다음으로 가장 중요한 질문 3~5개”를 보여준다.
- 질문 큐는 high/medium/low로 분리한다.
- low 질문은 완료 후보 상태에서 접을 수 있다.
- 사용자는 언제든 “현재 수준으로 Spec 고정”을 선택할 수 있다.
- 시스템은 완료 선언 전 남은 리스크를 명시한다.
- 모든 confidence 축이 75점 이상이고 gate를 통과하면 시스템은 반드시 완료 후보를 제안한다.
- “남은 리스크를 알고 시작한다”는 완료 감각을 Founder Brief로 연결한다.

## 세션 중단/재개

중단 시 저장되는 요약:

- 현재 SpecVersion.
- 현재 완성도 점수.
- 마지막으로 승인된 결정.
- 남은 high-risk 질문.
- 진행 중 research task.
- 다음 추천 행동.

재개 시 첫 화면:

- “지난 세션 이후 달라진 것”.
- “지금 답하면 가장 큰 효과가 있는 질문”.
- “완료까지 남은 핵심 리스크”.

## Founder Brief 진입점

사용자가 완료하거나 중단할 때 기본 export는 Founder Brief다. 화면은 다음 네 가지를 먼저 묶어 보여준다.

- Problem-Customer-Value Summary.
- Top Decisions.
- Known Risks.
- Next Validation Actions.

Founder Brief는 pitch deck이 아니라 다음 검증 행동을 시작하기 위한 실행 브리프다. 따라서 completion 화면은 축하 메시지보다 남은 리스크와 다음 행동을 더 크게 보여준다.
