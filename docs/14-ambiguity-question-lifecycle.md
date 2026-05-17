# 14. Ambiguity/Question Lifecycle

## 목적

이 문서는 Solo Superman의 `AmbiguityIssue → QuestionBatch → Answer → Routing → Repeat Limit → Completion Candidate` 계약의 source of truth다. `04-decision-queue.md`는 화면 큐를 설명하고, `05-spec-engine.md`는 전체 상태머신을 설명하며, 이 문서는 질문 엔진이 **무한 질문 루프**에 빠지지 않고 수렴하는 규칙을 고정한다.

이번 계약은 문서 전용 설계다. **런타임/코드 구현 제외**를 전제로 하며, 실제 React/Vite web, local DB, migration, endpoint, LLM 호출 코드는 다루지 않는다. DB/API/DTO/route 세부 계약은 이 문서가 소유하지 않고 `20-data-storage-contract.md`, `21-sidecar-api-runtime-contract.md`, `25-contracts-dto-catalog.md`, `26-api-route-behavior-catalog.md`가 소유한다.

## 핵심 원칙

1. 질문은 항상 하나의 AmbiguityIssue 또는 하나의 `topicKey`를 겨냥한다.
2. 질문은 Spec의 핵심 결정을 더 명확하게 하거나, evidence/research/approval routing을 결정해야 한다.
3. 같은 주제를 반복해서 묻는 것은 기본 3회까지만 허용한다.
4. 3회 제한에 도달하면 새 질문을 만들지 않고 severity별 수렴 정책을 적용한다.
5. 수렴은 “문제가 사라졌다”는 뜻이 아니라 “더 묻지 않고 어떤 상태로 남길지 결정했다”는 뜻이다.
6. Completion Candidate는 질문이 고갈되어서가 아니라 남은 리스크가 명시되었을 때 생성된다.

## Lifecycle 개요

```text
AmbiguityIssue created
  → issue classified
  → topicKey assigned
  → priority scored
  → question eligible?
  → Question queued
  → QuestionBatch selected
  → Answer received
  → route outcome decided
      ├─ resolved
      ├─ research_needed
      ├─ decision_candidate
      ├─ spec_update_candidate
      ├─ deferred
      └─ repeat_limit_reached
  → convergence policy applied
  → scoring updated
  → completion candidate check
```

## AmbiguityIssue 생성 계약

AmbiguityIssue는 Spec이 실행 가능한 창업 기획으로 가는 데 방해되는 모호함이다. 단순히 “더 알면 좋음”은 AmbiguityIssue가 아니다.

생성 조건:

- 필수 Spec section이 비어 있다.
- 핵심 claim에 pro/con evidence가 없다.
- high impact claim이 `pro_only` 또는 `missing_con_evidence` 상태다.
- 사용자 답변이 기존 Spec과 충돌한다.
- primary customer, problem, value proposition, MVP scope, validation plan, success criteria 중 하나가 확정되지 않았다.
- confidence 축 중 하나가 낮고, 그 이유가 질문 또는 리서치로 줄일 수 있는 경우.

첫 ambiguity analysis는 최소 10개 이상의 issue를 만들어야 한다. 기본 coverage 축은 다음을 포함한다.

1. primary customer가 너무 넓은가.
2. 고객이 이 문제를 자주 겪는가.
3. 문제 강도가 충분한가.
4. 돈을 내는 사람과 쓰는 사람이 같은가.
5. 현재 대체재는 무엇인가.
6. 대체재의 불만족 지점은 무엇인가.
7. MVP에서 반드시 만들 기능은 무엇인가.
8. 이번 MVP에서 만들지 말아야 할 것은 무엇인가.
9. 성공 기준은 측정 가능한가.
10. 첫 검증 실험은 제품 없이 가능한가.
11. acquisition channel이 현실적인가.
12. 구현 난이도가 창업자의 리소스와 맞는가.
13. 보안/법률/운영 리스크가 있는가.
14. founder advantage가 있는가.

생성 금지 조건:

- 이미 같은 `topicKey`의 open issue가 있다.
- 사용자의 선호 표현만 다듬으면 되는 low-risk 문장 문제다.
- 이미 `risk_accepted`, `deferred`, `research_needed`로 수렴된 issue인데 새 evidence가 없다.
- 질문을 만들어도 어떤 decision, evidence, score, Spec section에도 영향을 주지 않는다.

## Taxonomy

| Type | 의미 | 예시 | 기본 route |
| --- | --- | --- | --- |
| `missing` | 필요한 정보가 없다 | primary customer 없음 | Question |
| `vague` | 표현이 넓거나 해석이 여러 개다 | “초기 창업자 전체” | Question |
| `unsupported` | 주장에 근거가 없다 | “사용자는 반드시 지불한다” | Research |
| `missing_con_evidence` | 찬성 근거만 있고 반대근거 탐색이 부족하다 | “대체재로 충분하지 않다는 반대근거 없음” | Research |
| `conflict` | Spec section 간 충돌이 있다 | 고객은 B2C인데 buyer는 HR | Decision |
| `decision_required` | 사용자의 선택이 필요하다 | MVP 포함/제외 범위 | Approval |

## AmbiguityIssue field contract

| Field | Required | Rule |
| --- | --- | --- |
| `issueId` | yes | stable id. Queue item과 trace 가능해야 한다 |
| `sectionRef` | yes | Living Product Spec의 section 이름 또는 section id |
| `severity` | yes | `high`, `medium`, `low` |
| `uncertaintyType` | yes | `missing`, `vague`, `unsupported`, `conflict`, `decision_required`, `missing_con_evidence` |
| `summary` | yes | founder-facing 한 줄 요약 |
| `whyItMatters` | yes | 답하지 않을 때 생기는 downstream decision/rework risk |
| `questionText` | yes | 하나의 핵심 질문 |
| `expectedAnswerType` | yes | `choice`, `text`, `rank`, `evidence`, `experiment` |
| `answerOptions` | yes | 2~4개 선택지. 각 선택지는 `label`, 제출용 `value`, 한 줄 `pro`, 한 줄 `con`을 가진다 |
| `decisionItUnlocks` | yes | 답변 후 잠기거나 열리는 decision, Spec section, Build Slice readiness |
| `suggestedResearchTask` | optional | 답변보다 근거 보강이 먼저 필요할 때만 연결 |

## Severity 기준

| Severity | 의미 | 완료 영향 | 반복 제한 도달 시 기본 수렴 |
| --- | --- | --- | --- |
| high | 답하지 않으면 핵심 방향이 바뀌거나 downstream rework가 큼 | 완료 gate를 막음 | Risk Accepted 요청 |
| medium | 기획 품질과 리서치 방향에 영향을 주지만 구현 시작 자체는 가능 | 점수와 Known Risks에 반영 | `research_needed` / `research_insufficient` |
| low | 품질 보강 또는 표현 개선 성격 | 완료 gate를 막지 않음 | `deferred` |

High severity 예시:

- 첫 고객이 정해지지 않음.
- 문제 정의와 가치제안이 충돌함.
- MVP scope가 validation goal과 맞지 않음.
- success criteria가 측정 불가능함.

Medium severity 예시:

- 경쟁 대체재의 반대근거가 부족함.
- 고객 접근 채널 근거가 약함.
- validation experiment 비용/기간이 불명확함.

Low severity 예시:

- Founder Brief 문장 표현 선호.
- 현재 Planning Handoff 범위 밖의 후속 phase 확장 아이디어.
- 완료 후 보강해도 되는 예시 부족.

## topicKey 계약

`topicKey`는 같은 주제를 반복 질문하지 않기 위한 논리적 묶음이다. 구현 시 문자열 또는 enum이 될 수 있지만, 문서 계약상 다음 속성을 가진다.

규칙:

- 하나의 AmbiguityIssue에는 하나의 primary `topicKey`가 있다.
- 같은 핵심 결정에 영향을 주는 질문은 같은 `topicKey`를 공유한다.
- `topicKey`는 Spec section 이름보다 좁고, 단일 질문보다 넓다.
- `topicKey`가 같으면 repeat count를 공유한다.

예시:

| topicKey | 관련 section | 포함되는 질문 |
| --- | --- | --- |
| `primary_customer_narrowing` | Target Customer | 첫 고객 단계, buyer/user 분리, 제외 고객 |
| `problem_pain_intensity` | Problem | 문제 빈도, 강도, 비용, 기존 행동 |
| `value_prop_switching_reason` | Value Proposition | 대체재 대비 전환 이유, 차별점 |
| `mvp_validation_scope` | MVP Scope / Validation Plan | MVP 포함 기능, 검증할 핵심 가설 |
| `success_metric_measurability` | Success Criteria | 성공/실패 기준, 측정 가능성 |

## Question 생성 가능 조건

Question은 다음 조건을 모두 만족할 때 생성한다.

- 연결된 AmbiguityIssue가 open 또는 question_queued 상태다.
- `repeatCount < repeatLimit`이다.
- 질문 하나가 하나의 핵심 결정을 겨냥한다.
- 답변이 최소 하나의 Spec section, confidence axis, route outcome에 영향을 준다.
- 선택지는 실제 tradeoff를 만든다.
- “왜 중요한가”와 “답변 방법”이 설명 가능하다.

Question 생성 금지 조건:

- 같은 `topicKey`가 `repeat_limit_reached` 상태다.
- 답변해도 Spec, Research, Decision, Scoring 중 아무 것도 바뀌지 않는다.
- 같은 질문을 표현만 바꿔 다시 묻는다.
- low severity issue만 남았는데 Completion Candidate를 아직 제안하지 않았다.
- fatigue intervention 상태에서 사용자가 계속 진행을 선택하지 않았다.

## QuestionBatch 구성 규칙

기본 배치는 3~5개 질문이다.

Batch selection 순서:

1. high severity open issue 중 core decision 영향이 큰 항목.
2. confidence axis가 75점 미만인 항목.
3. downstream rework risk가 큰 항목.
4. research가 막혀 있는 항목.
5. medium issue 중 batch diversity를 높이는 항목.

Batch guardrail:

- 같은 `topicKey` 질문은 한 배치에 1개만 넣는다.
- 같은 Spec section 질문은 한 배치에 최대 2개까지만 넣는다.
- high severity issue가 남아 있으면 low severity 질문은 기본 배치에 넣지 않는다.
- 사용자가 피로 상태이면 새 batch 대신 요약 후 계속 여부를 먼저 묻는다.
- batch마다 “이 배치가 올릴 confidence 축”을 표시한다.

## Question anatomy

모든 Question Card는 다음 구조를 가져야 한다.

```text
현재 이해
- 현재 Spec과 답변에서 시스템이 이해한 내용.

왜 중요한가
- 이 질문이 줄이는 ambiguity와 downstream decision.

답변 방법
- 선택 기준, tradeoff, 좋은 답변 예시.

질문
- 하나의 핵심 질문.

선택지
- 2~4개 meaningful option.
- 객관식 선택지가 주관식 입력보다 위에 표시된다.
- 각 option은 장점(`pro`)과 단점(`con`)을 한 줄씩 같이 보여준다.
- 보기 중 맞는 답이 없으면 아래 텍스트박스에 직접 서술할 수 있다.

예상 영향
- 영향을 받는 Spec section.
- 영향을 받는 confidence axis.
- 가능한 route outcome.
```

좋은 질문:

- “가장 먼저 좁힐 첫 고객은 누구인가?”
- “이 문제가 실패했다는 행동 신호는 무엇인가?”
- “MVP에서 검증할 가설 하나만 남긴다면 무엇인가?”

나쁜 질문:

- “더 구체적으로 설명해 주세요.”
- “타깃을 알려주세요.”
- “이 아이디어가 좋은 이유는 무엇인가요?”

## Answer routing 계약

Answer가 도착하면 즉시 Spec 본문을 확정 변경하지 않는다. 먼저 route outcome을 결정한다.

| route outcome | 조건 | 다음 상태 |
| --- | --- | --- |
| `resolved` | 답변만으로 모호함이 충분히 해소되고 low-risk 반영만 필요 | SpecUpdate suggested 또는 auto-applied |
| `research_needed` | 답변이 가설을 만들었지만 근거가 부족함 | ResearchNeed 생성 |
| `missing_con_evidence` | 찬성 근거만 있고 skeptical search가 부족함 | Pro/Con Evidence Gate 보강 |
| `decision_candidate` | 핵심 결정 후보가 생김 | Decision Approval Card 생성 |
| `spec_update_candidate` | 기존 Spec 문장 변경이 필요함 | Suggested Spec Update 생성 |
| `conflict_detected` | 답변이 기존 결정 또는 evidence와 충돌 | Conflict Resolution Card 생성 |
| `deferred` | 사용자가 지금 결정하지 않음 | Open Questions / Known Risks |
| `repeat_limit_reached` | 같은 issue/topic이 반복 제한에 도달 | severity별 수렴 정책 적용 |

자동 확정 금지:

- primary customer 변경.
- problem statement 변경.
- value proposition 변경.
- MVP scope 변경.
- validation plan 변경.
- success criteria 변경.
- evidence 없는 high-impact claim 확정.
- `pro_only` high impact claim 확정.
- `missing_con_evidence`가 Known Risks에 연결되지 않은 상태로 완료 선언.

## repeat_limit_reached 정책

기본 repeat limit은 `3`이다. 같은 `topicKey`에서 다음 질문을 만들면 4번째가 되는 순간 `repeat_limit_reached` event가 발생한다.

반복으로 계산하는 경우:

- 같은 AmbiguityIssue에 연결된 질문.
- 같은 `topicKey`를 공유하는 질문.
- 표현만 다르고 같은 결정을 묻는 질문.
- 사용자가 같은 선택을 반복했고 confidence delta가 낮은 질문.

반복으로 계산하지 않는 경우:

- 새 evidence가 들어와 질문의 전제가 바뀐 경우.
- 사용자가 명시적으로 더 깊게 묻기를 선택한 경우.
- 다른 Spec section의 별도 decision을 묻는 경우.
- 기존 질문의 답변 오류를 수정하는 경우.

### severity별 수렴 정책

| Severity | repeat_limit_reached 후 정책 | completion 영향 |
| --- | --- | --- |
| high | Risk Accepted Approval Card 생성. 승인되면 `risk_accepted`, 거절하면 `decision_deferred` 또는 추가 리서치로 전환 | 승인 전 completion gate 차단 |
| medium | `research_needed` 또는 `research_insufficient`로 전환. 새 evidence 전까지 추가 질문 생성 금지 | evidence quality와 confidence 축에 감점 |
| low | `deferred`로 전환. Open Questions와 Founder Brief Known Risks에 남김 | 완료 gate는 막지 않음 |

Risk Accepted Card는 다음을 포함해야 한다.

- 남은 ambiguity.
- 지금까지 물은 질문 수.
- 왜 더 묻지 않는지.
- 이 리스크를 안고 진행할 때의 영향.
- 다음 검증 행동.

## Completion Candidate 연결

Completion Candidate는 다음을 모두 만족할 때 생성한다.

- 모든 high severity issue가 resolved 또는 `risk_accepted`다.
- medium issue 중 `research_needed`가 남아 있으면 Known Risks와 Next Validation Actions에 연결되어 있다.
- low issue는 `deferred`로 접혀 있으며 Open Questions에 남아 있다.
- 복합 완성도 gate를 통과한다.
- Confidence Map의 **모든 축 75점 이상** 기준을 만족한다.
- Founder Brief가 Known Risks를 포함할 수 있다.

Completion Candidate 생성 금지:

- high severity issue가 open 또는 question_queued 상태다.
- `repeat_limit_reached` high issue에 대한 사용자 승인 기록이 없다.
- pro evidence만 있고 con evidence가 없는 핵심 claim이 확정 결정으로 들어갔다.
- high impact `missing_con_evidence`가 skeptical search 없이 남아 있다.
- 같은 주제 질문을 3회 넘게 만들었지만 수렴 상태가 없다.

## 무한 질문 루프 방지 acceptance

후속 구현 또는 dry-run은 다음을 만족해야 한다.

- 같은 `topicKey`에서 4번째 질문을 만들기 전에 `repeat_limit_reached`가 발생한다.
- high severity 반복 제한은 사용자 승인 없이는 완료되지 않는다.
- medium severity 반복 제한은 새 evidence 전까지 추가 질문을 만들지 않는다.
- low severity 반복 제한은 Open Questions로 접히고 batch를 계속 막지 않는다.
- Completion Candidate는 남은 리스크를 숨기지 않는다.
- 질문 batch는 항상 수렴 조건과 다음 행동을 표시한다.

## 다른 문서와의 관계

- `04-decision-queue.md`는 이 lifecycle을 사용자가 보는 카드와 큐 상태로 표현한다.
- `05-spec-engine.md`는 이 lifecycle을 전체 상태머신에 연결한다.
- `06-research-engine.md`는 `research_needed`로 수렴된 medium issue의 근거 보강을 책임진다.
- `15-pro-con-evidence-gate.md`는 `missing_con_evidence`와 confirmation bias 방지의 evidence 품질 기준을 책임진다.
- `07-completeness-scoring.md`는 반복 제한과 수렴 상태를 점수와 completion gate에 반영한다.
- `08-domain-model.md`는 이 계약을 구현하기 위한 최소 타입 필드를 정의한다.
- `13-ux-doctrine-and-session-dynamics.md`는 이 계약의 사용자 경험 원칙을 정의한다.
