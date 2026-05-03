# 07. Composite Completeness Scoring

## 목적

복합 완성도 점수는 사용자가 긴 질문 세션에서 길을 잃지 않도록 하는 진행률 UX다. 단순 문서 분량이 아니라 **실행 가능한 창업 기획으로 얼마나 가까워졌는가**를 보여준다.

## 점수 구성

```text
completeness_score =
  section_completeness * 0.25
+ question_debt_resolution * 0.20
+ evidence_quality * 0.20
+ decision_approval * 0.20
+ consistency_and_conflict * 0.15
```

총점은 0~100으로 표시한다.

## 1. Section completeness (25%)

필수 section이 존재하고 기본 내용이 채워졌는지 본다.

| Section | 가중치 |
| --- | --- |
| Problem Statement | 15 |
| Target Customer | 15 |
| Value Proposition | 15 |
| Alternatives/Competition | 10 |
| Evidence Matrix | 15 |
| Validation Plan | 10 |
| MVP Scope | 10 |
| Success Criteria | 10 |

점수 기준:

- 0점: section 없음.
- 30점: placeholder 수준.
- 60점: 기본 내용 있음.
- 80점: 모호함 대부분 해소.
- 100점: 근거와 결정까지 연결.

## 2. Question debt resolution (20%)

남은 질문 부채를 측정한다.

```text
question_debt_score = 100 - min(100,
  high_open * 25
+ medium_open * 8
+ low_open * 2
+ stale_answer * 5
)
```

규칙:

- high-risk 질문이 1개라도 있으면 완료 후보가 될 수 없다. 단, 사용자가 명시적으로 risk accepted 처리하면 가능하다.
- low 질문은 완료를 막지 않지만 “더 깊게 하기” 후보로 남긴다.

## 3. Evidence quality (20%)

핵심 claim마다 찬성/반대 근거와 불확실성이 있는지 본다.

핵심 claim:

- problem is real.
- target customer is reachable.
- value proposition is differentiated.
- MVP scope can validate the main hypothesis.
- success criteria are measurable.

점수 기준:

- 0점: 근거 없음.
- 40점: 찬성 근거만 있음.
- 70점: 찬성/반대 근거 있음.
- 90점: 불확실성과 후속 질문까지 있음.
- 100점: 검증 실험까지 연결됨.

## 4. Decision approval (20%)

핵심 결정의 사용자 승인 여부를 본다.

필수 승인 결정:

- primary customer.
- problem statement.
- value proposition.
- validation target.
- MVP scope.
- success criteria.

점수 기준:

```text
approved_required_decisions / total_required_decisions * 100
```

단, 승인된 결정에 evidence matrix가 연결되어 있지 않으면 해당 결정은 0.5개로만 계산한다.

## 5. Consistency and conflict (15%)

Spec 내부 충돌과 애매한 경계를 본다.

감점 항목:

- primary customer와 buyer가 충돌.
- MVP scope와 success criteria가 맞지 않음.
- validation experiment가 problem statement와 연결되지 않음.
- 경쟁/대체재 분석이 value proposition과 연결되지 않음.
- phase boundary가 non-goal과 충돌.

충돌이 high severity이면 완료 후보가 될 수 없다.

## Readiness label

점수와 gate 상태를 조합해 표시한다.

| Label | 조건 | 의미 |
| --- | --- | --- |
| Draft | 0~39 | 구조화 초기 상태 |
| Clarifying | 40~59 | 질문으로 핵심 모호함 해소 중 |
| Researching | 60~74 | 근거와 반대근거 보강 중 |
| Decision-ready | 75~84 | 핵심 승인만 남은 상태 |
| Spec-ready | 85+ and gates passed | 완료 선언 가능 |

## 완료 후보 gate

점수만으로 완료할 수 없다. 다음 gate를 모두 통과해야 한다.

- high-risk open question 없음 또는 risk accepted.
- high severity conflict 없음.
- required decisions 승인 완료.
- 핵심 claim에 pro/con evidence 존재.
- MVP non-goals와 Phase boundary 충돌 없음.

## UX 표시 방식

Header에는 단순 점수를 보여준다.

```text
Completeness 78% · Decision-ready · High-risk questions 2 · Evidence gaps 3
```

상세 패널에는 왜 그 점수인지 보여준다.

```text
+ Problem section complete
+ Target customer approved
- Competition evidence has no counter-evidence
- MVP success criteria not approved
- 2 high-risk questions remain
```

## 무한 질문 루프 방지와의 관계

- 질문이 새로 생겨도 high/medium/low에 따라 완료 가능성을 분리한다.
- 점수가 85+이고 high-risk 질문이 없으면 시스템은 반드시 completion candidate를 제안한다.
- 사용자가 완료 선언을 거부하고 더 깊게 하기를 선택할 때만 low 질문을 계속 확장한다.
- 같은 주제 질문이 3회 이상 반복되면 시스템은 질문을 더 만들지 말고 “결정 보류” 또는 “리서치 부족”으로 상태를 바꾼다.

## 점수 해석 주의

복합 완성도는 진실 점수가 아니다. 이것은 “기획서가 실행 가능한 형태로 정리되었는가”를 보는 작업 점수다. 시장 성공 가능성을 보장하지 않는다.

