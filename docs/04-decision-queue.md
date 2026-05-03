# 04. Decision Queue

## 역할

Decision Queue는 Solo Superman의 중심 작업면이다. 사용자는 긴 문서를 처음부터 끝까지 편집하는 대신, 지금 가장 중요한 질문과 결정을 처리한다.

Question/Ambiguity의 반복 제한과 수렴 정책은 `14-ambiguity-question-lifecycle.md`를 따른다. 이 문서는 사용자가 보는 카드와 큐 동작을 설명하고, 14번 문서는 엔진 계약의 source of truth다.

## Queue가 해결하는 문제

- 질문이 많아도 사용자가 어디서 시작할지 안다.
- 리서치 결과가 와도 어떤 결정에 영향을 주는지 안다.
- 시스템이 왜 특정 질문을 묻는지 설명한다.
- 무한 질문 루프를 방지한다.

## Queue item 유형

### Question Card

사용자의 답변이 필요한 카드.

필드:

- `question_id`.
- `title`.
- `spec_section`.
- `ambiguity_issue_id`.
- `topic_key`.
- `priority`.
- `current_understanding`.
- `why_it_matters`.
- `how_to_answer`.
- `options`.
- `allow_other`.
- `confidence_axis_impacts`.
- `possible_route_outcomes`.
- `repeat_count`.
- `repeat_limit`.
- `expected_score_impact`.

### Decision Approval Card

핵심 Spec 변경 승인이 필요한 카드.

필드:

- `decision_id`.
- `decision_type`.
- `recommended_decision`.
- `alternatives`.
- `pro_evidence`.
- `con_evidence`.
- `uncertainties`.
- `spec_diff_summary`.
- `approve`, `revise`, `reject`, `defer` actions.

### Research Review Card

리서치 결과를 검토하는 카드.

필드:

- `research_result_id`.
- `claim`.
- `source_summary`.
- `confidence`.
- `impacted_spec_sections`.
- `suggested_questions`.
- `suggested_spec_updates`.

### Conflict Resolution Card

Spec 내부 충돌을 해소하는 카드.

예시:

- “primary customer는 B2C 개인이라고 했지만, 결제자는 기업 HR이라고 되어 있음.”
- “MVP는 4주 안에 만든다고 했지만, 포함 기능이 12개 core workflow를 요구함.”

### Completion Candidate Card

완료 후보 상태에서 생성되는 카드.

표시 항목:

- 현재 완성도.
- 남은 high-risk 질문.
- 약한 evidence section.
- 승인되지 않은 결정.
- 완료 시 생성될 산출물.

## 우선순위 산정

Question/Decision priority는 다음 점수로 계산한다.

```text
priority_score =
  impact_on_core_decision * 0.35
+ downstream_rework_risk * 0.25
+ evidence_gap_severity * 0.20
+ contradiction_severity * 0.15
+ user_stated_importance * 0.05
```

### high priority 조건

- primary customer, problem, value proposition, MVP scope, success criteria에 직접 영향.
- 답하지 않으면 리서치 방향이 크게 달라짐.
- 반대근거가 강하지만 사용자의 결정이 없는 상태.
- Spec section 간 충돌이 존재.

### medium priority 조건

- validation plan, competitor positioning, pricing hypothesis, onboarding narrative에 영향.
- 답변이 없으면 구현은 가능하지만 기획 품질이 낮아짐.

### low priority 조건

- 문장 선호, 예시 보강, 후속 Phase 상세화.
- 완료 후보 상태에서 보류 가능.

## 배치 규칙

- 한 배치는 3~5개 질문으로 구성한다.
- 같은 section 질문만 몰아넣지 않는다.
- 단, 하나의 핵심 tradeoff가 아직 흐릿하면 같은 주제를 2회 이상 연속으로 파고들 수 있다.
- 배치마다 예상 완성도 상승을 표시한다.
- 답변 후 즉시 Spec에 반영하지 말고, 필요 시 Decision 또는 Research로 라우팅한다.

## 카드 상태

| 상태 | 의미 |
| --- | --- |
| `queued` | 생성되었지만 아직 사용자에게 제시되지 않음 |
| `active` | 현재 배치에 포함됨 |
| `answered` | 사용자가 답변함 |
| `research_waiting` | 답변은 있으나 리서치가 필요함 |
| `approval_waiting` | 핵심 결정 승인 대기 |
| `repeat_limit_reached` | 같은 issue/topic 질문이 반복 제한에 도달해 새 질문 생성이 중단됨 |
| `resolved` | Spec에 반영 또는 보류 결정 완료 |
| `deferred` | 사용자가 명시적으로 후순위로 미룸 |
| `dismissed` | 질문이 더 이상 유효하지 않음 |

## 질문 생성 원칙

좋은 질문은 다음을 만족한다.

- 하나의 결정만 겨냥한다.
- 하나의 AmbiguityIssue 또는 하나의 `topic_key`에 연결된다.
- 답변 선택지가 실제 tradeoff를 만든다.
- 사용자가 왜 답해야 하는지 이해할 수 있다.
- 답변 결과가 어떤 Spec section에 영향을 주는지 명확하다.
- 답변 결과가 어떤 confidence axis를 올리거나 낮출 수 있는지 명확하다.
- 답변 후 가능한 route outcome이 `resolved`, `research_needed`, `decision_candidate`, `spec_update_candidate`, `conflict_detected`, `deferred` 중 어디인지 예상 가능하다.
- “더 구체적으로 말해 주세요” 같은 추상 질문을 피한다.

## 질문 생성 금지 조건

다음 조건에서는 새 Question Card를 만들지 않는다.

- 같은 `topic_key`가 `repeat_limit_reached` 상태다.
- 답변해도 Spec, Research, Decision, Scoring 중 아무 것도 바뀌지 않는다.
- 같은 질문을 표현만 바꿔 다시 묻는다.
- high priority 질문이 남아 있는데 low priority 질문만 batch에 넣으려 한다.
- fatigue intervention 상태인데 사용자가 계속 진행을 선택하지 않았다.

## Answer routing

Question Card가 답변되면 큐는 즉시 Spec 본문을 확정 변경하지 않는다. 먼저 route outcome을 결정한다.

| route outcome | Queue 처리 | 사용자에게 보이는 결과 |
| --- | --- | --- |
| `resolved` | low-risk SpecUpdate 또는 issue resolved | 자동 정리 또는 간단한 변경 요약 |
| `research_needed` | Research Review Card 후보 생성 | “근거 보강 중” 상태 |
| `decision_candidate` | Decision Approval Card 생성 | 승인/수정/거절/보류 선택 |
| `spec_update_candidate` | Suggested Spec Update 생성 | Spec diff preview |
| `conflict_detected` | Conflict Resolution Card 생성 | 충돌 설명과 선택지 |
| `deferred` | Open Questions로 이동 | Founder Brief Known Risks에 반영 가능 |
| `repeat_limit_reached` | severity별 수렴 정책 적용 | 더 묻지 않는 이유와 다음 상태 표시 |

## 반복 제한 UX

- 같은 `topic_key`의 질문은 기본 3회까지만 허용한다.
- 4번째 질문을 만들기 전에 `repeat_limit_reached`가 발생해야 한다.
- high severity는 Risk Accepted Approval Card로 전환한다.
- medium severity는 `research_needed` 또는 `research_insufficient`로 전환하고 새 evidence 전까지 질문을 만들지 않는다.
- low severity는 `deferred`로 접고 Open Questions에 남긴다.
- 반복 제한으로 접힌 항목은 “해결됨”이 아니라 “더 묻지 않는 상태”로 표시한다.

## 무한 질문 루프 방지 정책

- high priority 질문이 0개가 되면 완료 후보를 제안한다.
- medium/low 질문은 “더 깊게 하기” 모드에서만 계속 확장한다.
- 질문 큐가 늘어나는 이유를 activity feed에 설명한다.
- 리서치가 만든 새 질문은 자동으로 high가 되지 않는다.
- 사용자가 “현재 수준으로 고정”을 선택하면 남은 질문은 Open Questions로 이동한다.
- `repeat_limit_reached` 상태인 topic은 새 evidence, 사용자의 명시적 재개, 강한 반대근거가 없으면 batch 후보로 돌아오지 않는다.
- Completion Candidate는 남은 `deferred`, `research_needed`, `risk_accepted` 항목을 숨기지 않고 Known Risks로 보여준다.

## Decision 권한 정책

- low-risk 문서 정리는 자동 반영 가능하다.
- 핵심 결정은 반드시 Approval Card를 거친다.
- 승인되지 않은 결정은 Spec 본문에서 `추천안` 또는 `가설` 상태로 남는다.
