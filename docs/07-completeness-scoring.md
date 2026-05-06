# 07. Composite Completeness Scoring

## 목적

복합 완성도 점수는 사용자가 긴 질문 세션에서 길을 잃지 않도록 하는 진행률 UX다. 단순 문서 분량이 아니라 **실행 가능한 창업 기획으로 얼마나 가까워졌는가**를 보여준다.

복합 완성도는 `13-ux-doctrine-and-session-dynamics.md`의 Confidence Map과 함께 해석한다. 복합 완성도는 “문서와 결정이 실행 가능한 형태인가”를 보고, Confidence Map은 “문제, 고객, 가치제안, 검증, 구현 준비도 중 어디에 리스크가 남았는가”를 보여준다.

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

## Confidence Map과의 관계

Phase 1은 Header에 복합 완성도 점수와 5축 레이더를 함께 표시한다.

| 항목 | 역할 | 사용자가 얻는 답 |
| --- | --- | --- |
| 복합 완성도 | Spec 산출물이 실행 가능한 구조로 정리되었는지 측정 | “문서가 어느 정도 완성되었는가?” |
| Confidence Map | 핵심 창업 가정의 축별 리스크를 측정 | “무엇이 아직 위험한가?” |

Confidence Map의 5축은 다음과 같다.

- 문제 확신도.
- 고객 세그먼트 확신도.
- 가치제안 확신도.
- 검증 가능성 확신도.
- 구현 준비도 확신도.

Spec-ready 후보가 되려면 복합 완성도 gate와 함께 **모든 축 75점 이상**을 만족해야 한다. 복합 완성도가 높아도 특정 confidence 축이 75점 미만이면 완료 대신 해당 축을 올리는 질문 배치나 리서치 보강을 제안한다.

반대로 모든 축이 75점 이상이어도 required decisions, evidence gate, high severity conflict gate를 통과하지 못하면 완료 선언은 막힌다. 이 경우 화면은 “confidence는 충분하지만 문서 계약이 아직 닫히지 않았다”고 설명해야 한다.

## 1. Section completeness (25%)

필수 section이 존재하고 기본 내용이 채워졌는지 본다. 초기 Living Product Spec의 section set은 `03-living-product-spec.md`의 12개 section 계약을 따른다.

| Section | 가중치 |
| --- | --- |
| Problem | 10 |
| Target Customer | 10 |
| JTBD / Use Case | 8 |
| Current Alternatives | 8 |
| Value Proposition | 10 |
| Differentiation | 8 |
| MVP Scope | 10 |
| Non-goals | 8 |
| Validation Plan | 10 |
| Success Criteria | 8 |
| Evidence Status | 5 |
| Known Risks / Open Questions | 5 |

Decision Log와 Phase Plan은 SpecVersion metadata, export projection, Planning Handoff sourceRefs에서 추적하지만, 아래 12개 section의 판단 상태를 대체할 수 없다.

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
- 같은 `topicKey`가 `repeat_limit_reached`에 도달하면 더 이상 open question으로 계속 누적하지 않고 severity별 수렴 상태로 계산한다.
- high severity `repeat_limit_reached`는 `risk_accepted` 전까지 high open과 동일하게 completion gate를 막는다.
- medium severity `research_needed`는 high open은 아니지만 evidence quality와 관련 confidence axis에 감점으로 반영한다.
- low severity `deferred`는 question debt에 낮은 감점만 남기고 completion candidate 생성을 막지 않는다.

## 3. Evidence quality (20%)

핵심 claim마다 찬성/반대 근거와 불확실성이 있는지 본다.

핵심 claim:

- problem is real.
- target customer is reachable and narrow enough.
- JTBD/use case is specific enough to test.
- current alternatives and differentiation are understood.
- MVP scope and non-goals can validate the main hypothesis without scope creep.
- validation plan and success criteria are measurable.

점수 기준:

- 0점: 근거 없음.
- 40점: 찬성 근거만 있음.
- 70점: 찬성/반대 근거 있음.
- 90점: 불확실성과 후속 질문까지 있음.
- 100점: 검증 실험까지 연결됨.

Pro/Con Evidence Gate 반영:

- high impact claim이 `pro_only`이면 evidence quality는 최대 40점이다.
- high impact claim이 `missing_con_evidence`이고 skeptical search 기록이 없으면 최대 50점이다.
- `missing_con_evidence`가 Known Risks와 Next Validation Actions에 연결되면 medium impact claim은 최대 80점까지 가능하다.
- `balanced` claim은 찬반 근거, uncertainties, limitations, next validation action이 모두 있을 때만 90점 이상 가능하다.
- `blocked_by_con_evidence`가 있으면 관련 confidence axis를 낮추고 conflict gate를 확인한다.

## 4. Decision approval (20%)

핵심 결정의 사용자 승인 여부를 본다.

필수 승인 결정:

- primary customer.
- problem.
- value proposition.
- validation target.
- MVP scope and explicit non-goals.
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
| Spec-ready | 85+ and gates passed and 모든 축 75점 이상 | 완료 선언 가능 |

## 완료 후보 gate

점수만으로 완료할 수 없다. 다음 gate를 모두 통과해야 한다.

- high-risk open question 없음 또는 risk accepted.
- high severity conflict 없음.
- required decisions 승인 완료.
- 핵심 claim에 pro/con evidence 존재.
- high impact claim이 `pro_only` 상태가 아님.
- high impact `missing_con_evidence`가 있으면 skeptical search 기록과 `risk_accepted` 또는 validation action 존재.
- MVP non-goals와 Phase boundary 충돌 없음.
- Confidence Map의 모든 축 75점 이상.
- high severity `repeat_limit_reached` issue가 있으면 `risk_accepted` 승인 기록 존재.
- medium severity `research_needed` issue가 남아 있으면 Known Risks와 Next Validation Actions에 연결.

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
- Problem claim is pro_only and needs con evidence
```

## 무한 질문 루프 방지와의 관계

- 질문이 새로 생겨도 high/medium/low에 따라 완료 가능성을 분리한다.
- 점수가 85+이고 high-risk 질문이 없으면 시스템은 반드시 completion candidate를 제안한다.
- 모든 축 75점 이상이고 completion gate를 통과하면 시스템은 질문을 더 늘리지 않고 completion candidate를 제안한다.
- 사용자가 완료 선언을 거부하고 더 깊게 하기를 선택할 때만 low 질문을 계속 확장한다.
- 같은 주제 질문이 3회 이상 반복되면 시스템은 질문을 더 만들지 말고 “결정 보류”, “리서치 부족”, “risk accepted” 중 하나로 상태를 바꾼다.
- `repeat_limit_reached` 자체는 실패가 아니다. 실패는 반복 제한에 도달했는데도 수렴 상태 없이 질문을 계속 만드는 것이다.

## 점수 해석 주의

복합 완성도는 진실 점수가 아니다. 이것은 “기획서가 실행 가능한 형태로 정리되었는가”를 보는 작업 점수다. 시장 성공 가능성을 보장하지 않는다.
