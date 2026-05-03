# 15. Pro/Con Evidence Gate

## 목적

이 문서는 Solo Superman의 Research/Evidence 품질 체계, 특히 **Pro/Con Evidence Gate**의 source of truth다. 목표는 사용자가 찬성 근거만 보고 확신하는 **confirmation bias**에 빠지지 않도록, 핵심 claim마다 `pro_evidence`, `con_evidence`, uncertainty, `missing_con_evidence` 상태를 명확히 남기는 것이다.

이 문서는 실행 구현이 아니라 제품/문서 계약이다. **외부 리서치 런타임 구현 제외**, **고객 인터뷰 방법론 깊은 설계 제외**, **DB/API 스키마 상세 제외**를 전제로 한다. Playwright, Browser-use, OpenClaw, 웹 검색 호출, 크롤링 방식, 고객 인터뷰 모집/분석 방법론, DB DDL, API endpoint는 다루지 않는다.

## 핵심 원칙

1. 좋은 근거는 claim을 무조건 지지하는 자료가 아니라, claim을 지지하거나 반박하는 방향이 명확한 자료다.
2. 핵심 claim은 `pro_evidence`만으로 확정될 수 없다.
3. `con_evidence`가 아직 없으면 “반대근거 없음”이 아니라 `missing_con_evidence`로 명시한다.
4. `missing_con_evidence`는 실패가 아니라 아직 skeptical search가 끝나지 않았다는 상태다.
5. Evidence summary와 product implication은 분리한다.
6. 반대근거는 삭제하거나 약화하지 않고 Decision Log, Known Risks, Next Validation Actions에 연결한다.
7. completion은 낙관적 자료의 양이 아니라 균형 잡힌 판단 가능성으로 결정한다.

## Evidence 대상 claim

Pro/Con Evidence Gate는 모든 문장에 적용하지 않는다. 다음 핵심 claim에 우선 적용한다.

| Claim category | 예시 | Gate 강도 |
| --- | --- | --- |
| Problem validity | “초기 창업자는 spec 작성에 어려움을 겪는다” | high |
| Customer reachability | “첫 고객은 2주 내 고객 인터뷰를 앞둔 창업자다” | high |
| Value differentiation | “기존 ChatGPT/템플릿보다 더 나은 가치를 준다” | high |
| Willingness or behavior change | “사용자는 이 문제에 시간/돈을 쓴다” | high |
| MVP validation fit | “이 MVP 범위로 핵심 가설을 검증할 수 있다” | high |
| Implementation readiness | “Phase 1 범위는 작고 명확하다” | medium |
| Market trend context | “AI 창업 도구 시장이 성장 중이다” | medium |
| Copy or narrative polish | “이 표현이 더 설득력 있다” | low |

High gate claim은 `pro_evidence`와 `con_evidence`가 모두 있거나, `missing_con_evidence` 상태가 명시되어야 한다. High gate claim의 `missing_con_evidence`가 해소되지 않으면 decision-ready와 Spec-ready를 막는다.

## Evidence 상태

| 상태 | 의미 | 사용 가능성 |
| --- | --- | --- |
| `no_evidence` | 근거가 없음 | claim을 확정할 수 없음 |
| `pro_only` | 찬성 근거만 있음 | hypothesis로만 사용 가능 |
| `con_only` | 반대근거만 있음 | claim 재검토 또는 pivot 필요 |
| `pro_con_present` | 찬반 근거가 모두 있음 | decision review 가능 |
| `missing_con_evidence` | 반대근거를 찾으려 했지만 아직 없음 | high claim은 completion 차단, medium은 Known Risks 연결 필요 |
| `balanced` | 찬반 근거, 불확실성, 한계가 함께 정리됨 | decision-ready 후보 |
| `blocked_by_con_evidence` | 반대근거가 핵심 claim을 심각하게 약화함 | Decision Approval 전 conflict 해결 필요 |
| `source_quality_insufficient` | 출처 품질이 낮아 판단에 쓰기 어려움 | rejected 또는 추가 research 필요 |

## Evidence item 계약

Evidence item은 source 요약이 아니라 claim과 연결된 판단 단위다.

필수 필드:

```yaml
claim_id: "problem_pain_intensity"
stance: pro|con|neutral
summary: "출처가 실제로 말한 내용"
implication: "이 claim에 미치는 영향"
strength: high|medium|low
relevance: high|medium|low
source_reliability: high|medium|low
limitations:
  - "표본이 작음"
  - "지역이 다름"
  - "마케팅 문구라 편향 가능성 있음"
```

규칙:

- `summary`는 출처가 말한 내용이고, `implication`은 제품 판단에 미치는 해석이다.
- `summary`만으로 `implication`을 과장하면 안 된다.
- `stance`가 neutral이면 decision gate를 통과시키는 핵심 근거로 쓰지 않는다.
- `strength`가 high여도 `relevance`가 low이면 핵심 claim을 지지하지 못한다.
- `source_reliability`가 low이면 최소 하나의 보강 source가 필요하다.

## skeptical search 계약

skeptical search는 claim을 반박하기 위해 의도적으로 찾는 리서치 단계다. 이것은 선택 기능이 아니라 Pro/Con Evidence Gate의 필수 단계다.

skeptical search 질문 예시:

- 이 문제가 실제로 중요하지 않을 가능성은 무엇인가?
- 사용자가 이미 충분히 해결하고 있는 대체재는 무엇인가?
- 무료 LLM, 템플릿, 멘토링이 충분하다는 근거는 무엇인가?
- 사용자의 진짜 pain이 우리가 정의한 문제가 아닐 가능성은 무엇인가?
- 이 MVP로는 핵심 가설을 검증할 수 없다는 반대근거는 무엇인가?

skeptical search 기록에는 다음이 포함되어야 한다.

- 어떤 claim을 반박하려 했는가.
- 어떤 query 또는 source category를 확인했는가.
- `con_evidence`를 찾았는가.
- 찾지 못했다면 왜 `missing_con_evidence`인지.
- 이 한계가 Known Risks 또는 Next Validation Actions에 어떻게 연결되는가.

## Gate 통과 규칙

### Decision-ready 가능

다음 중 하나를 만족해야 한다.

- `pro_con_present` 또는 `balanced` 상태다.
- `missing_con_evidence`지만 claim impact가 medium 이하이고 Known Risks에 연결되어 있다.
- `con_evidence`가 약하거나 관련성이 낮으며, limitation이 명시되어 있다.

### Decision-ready 불가

다음 중 하나라도 해당하면 decision-ready가 아니다.

- high impact claim이 `pro_only`다.
- high impact claim이 `missing_con_evidence`인데 skeptical search 기록이 없다.
- source reliability low인 evidence만으로 decision candidate를 만든다.
- `blocked_by_con_evidence` 상태인데 Conflict Resolution Card가 없다.
- evidence summary가 implication을 과장한다.

### Completion Candidate 가능

다음이 모두 필요하다.

- 모든 high impact claim에 `con_evidence` 또는 검증된 `missing_con_evidence` 기록이 있다.
- high impact `missing_con_evidence`가 남아 있으면 `risk_accepted` 승인 또는 명시적 validation action이 있다.
- medium impact `missing_con_evidence`는 Founder Brief의 Known Risks에 연결되어 있다.
- Evidence Matrix summary에 찬성/반대/불확실성이 모두 보인다.

### Completion Candidate 불가

- 핵심 claim이 `pro_only` 상태다.
- 반대근거가 없는 이유가 기록되지 않았다.
- 반대근거가 발견되었지만 Decision Log 또는 Known Risks에 연결되지 않았다.
- 리서치 한계를 숨기고 confidence만 높게 표시한다.

## 좋은 Evidence Matrix

```yaml
claim: "초기 창업자는 고객 인터뷰 질문을 제품 결정과 연결하는 데 어려움을 겪는다"
impact: high
balance_status: balanced
pro_evidence:
  - summary: "창업 교육 자료들이 customer discovery와 좋은 질문 설계를 반복적으로 강조한다"
    implication: "인터뷰 질문 품질이 초기 창업자에게 중요한 과제일 가능성을 지지한다"
    strength: medium
    relevance: high
con_evidence:
  - summary: "무료 템플릿과 ChatGPT 프롬프트로 질문 초안을 쉽게 만들 수 있다"
    implication: "단순 질문 생성만으로는 차별화가 약할 수 있다"
    strength: medium
    relevance: high
uncertainties:
  - "실제 지불 의사는 확인되지 않았다"
  - "진짜 pain이 질문 작성이 아니라 인터뷰 대상 모집일 수 있다"
known_risk_links:
  - "대체재 대비 전환 이유가 약할 수 있음"
next_validation_actions:
  - "ChatGPT/템플릿 사용자 5명에게 전환 이유 인터뷰"
```

## 나쁜 Evidence Matrix

```yaml
claim: "초기 창업자는 반드시 이 도구에 돈을 낼 것이다"
balance_status: pro_only
pro_evidence:
  - summary: "창업자들은 고객 인터뷰가 중요하다고 말한다"
    implication: "유료 구매 의사가 높다"
con_evidence: []
uncertainties: []
```

문제:

- 중요성 근거를 지불 의사로 과장했다.
- `con_evidence`가 없다.
- `missing_con_evidence`로도 표시하지 않았다.
- skeptical search 기록이 없다.
- 이 상태로는 decision-ready나 Spec-ready가 될 수 없다.

## Source 신뢰성 최소 기준

이번 wave는 Source 신뢰성 세부 산식은 만들지 않는다. 다만 Pro/Con Gate에 필요한 최소 기준은 둔다.

High reliability 예시:

- 공식 문서 또는 원자료.
- 고객 인터뷰 원문 또는 직접 사용자 evidence.
- 신뢰 가능한 리서치 리포트.
- 제품 사용 데이터 또는 실험 결과.

Medium reliability 예시:

- 경쟁사 공개 자료.
- 커뮤니티의 반복 관찰.
- 전문가 글 또는 강의 자료.
- 관련 시장 기사.

Low reliability 예시:

- 단일 익명 댓글.
- 출처 없는 블로그 요약.
- 경쟁사 marketing copy만 있는 자료.
- AI가 출처 없이 생성한 일반화.

Low reliability evidence는 단독으로 high impact decision을 만들 수 없다.

## 다른 문서와의 관계

- `06-research-engine.md`는 이 gate를 Research Loop 안에서 실행하는 흐름을 설명한다.
- `03-living-product-spec.md`는 Evidence Matrix가 Spec 완료 조건에 어떻게 들어가는지 정의한다.
- `07-completeness-scoring.md`는 missing con evidence와 evidence balance를 점수/gate에 반영한다.
- `08-domain-model.md`는 타입 수준의 최소 필드를 정의한다.
- `12-validation-and-dry-run.md`는 confirmation bias 방지 dry-run을 검증한다.
- `14-ambiguity-question-lifecycle.md`는 missing con evidence가 새로운 질문 또는 research_needed로 이어지는 방식을 연결한다.
