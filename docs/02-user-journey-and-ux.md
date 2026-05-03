# 02. User Journey and UX

## UX 핵심 문장

Solo Superman의 화면은 문서 편집기가 아니라 **창업자의 결정 관제실**이어야 한다. 중심은 긴 문서가 아니라 지금 답해야 할 질문과 승인해야 할 결정이다.

## 기본 레이아웃

Phase 1 기본 레이아웃은 `Decision Queue 중심`이다.

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
- 직접 입력을 허용하되, 기본 선택지가 충분히 의미 있어야 한다.

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
- 리서치가 아직 기다리는 항목.
- 지금 멈추면 어떤 품질의 Spec이 되는지.

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
- readiness label: Draft, Researching, Decision-ready, Spec-ready.
- 세션 경과 시간.
- sync 상태.
- 남은 high-risk 질문 수.

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
- 선택지 또는 입력란.
- 답변 후 기대 효과.

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
- 2~4개 추천 선택지.
- 각 선택지의 tradeoff 설명.
- 직접 입력 허용.
```

## 무한 질문 루프 방지 UX

- 질문 큐는 무한 목록처럼 보이면 안 된다.
- 기본 화면은 “남은 모든 질문”이 아니라 “다음으로 가장 중요한 질문 3~5개”를 보여준다.
- 질문 큐는 high/medium/low로 분리한다.
- low 질문은 완료 후보 상태에서 접을 수 있다.
- 사용자는 언제든 “현재 수준으로 Spec 고정”을 선택할 수 있다.
- 시스템은 완료 선언 전 남은 리스크를 명시한다.

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

