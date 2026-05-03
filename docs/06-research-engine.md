# 06. Research Engine

## 역할

Research Engine은 창업자의 아이디어와 답변을 바탕으로 제품 판단에 필요한 근거를 생성한다. 단순 웹 요약기가 아니라 **결정별 찬반 근거 매트릭스 생성기**다.

Question Loop에서 `research_needed` 또는 `research_insufficient`로 수렴된 항목은 `14-ambiguity-question-lifecycle.md`의 반복 제한 정책을 따른다. Research Engine은 이 상태를 새 질문으로 되돌리는 것이 아니라, 새 evidence를 만들어 질문 재개 여부를 판단하게 한다.

## Research Loop

```text
AmbiguityIssue
→ ResearchNeed
→ ResearchTask
→ SourceCollection
→ ClaimExtraction
→ Pro/Con Matrix
→ Uncertainty
→ SuggestedQuestion
→ SuggestedSpecUpdate
```

## Question Loop에서 오는 ResearchNeed

Ambiguity/Question Lifecycle은 다음 상황에서 ResearchNeed를 생성한다.

- 사용자의 답변이 가설은 만들었지만 근거가 부족하다.
- `unsupported` issue가 answer만으로 해결되지 않는다.
- medium severity issue가 `repeat_limit_reached`에 도달했다.
- 사용자가 같은 질문에 반복 답변했지만 confidence delta가 충분히 오르지 않는다.
- 반대근거가 없는 상태에서 핵심 decision candidate가 생겼다.

ResearchNeed 생성 시 Research Engine은 다음을 기록해야 한다.

- 어떤 `topicKey`의 반복을 멈추기 위해 생성되었는가.
- 어떤 claim의 pro/con evidence가 부족한가.
- 새 evidence가 도착하면 질문을 재개할 수 있는 조건은 무엇인가.
- 사용자가 지금 멈추면 Founder Brief의 Known Risks에 어떻게 남는가.

Medium severity의 `research_needed`는 완료를 무조건 막지 않는다. 다만 Known Risks와 Next Validation Actions에 연결되어야 하며, evidence quality와 confidence 축에는 감점으로 반영된다.

## ResearchTask 유형

### Customer segment research

목적:

- 고객 세그먼트가 실제로 의미 있는지 확인한다.
- 문제 강도와 구매/사용 맥락을 추정한다.

출력:

- segment evidence.
- likely pain intensity.
- 접근 가능한 채널.
- 반대근거.

### Competition and alternatives research

목적:

- 경쟁 제품뿐 아니라 workaround와 “아무것도 안 함”을 파악한다.

출력:

- direct competitors.
- indirect competitors.
- current alternatives.
- differentiation pressure.
- switching barriers.

### Problem validity research

목적:

- 사용자가 말한 문제가 실제 빈도/강도/비용을 갖는지 본다.

출력:

- supporting signals.
- skeptical signals.
- missing evidence.
- interview questions.

### Validation experiment research

목적:

- 어떤 실험으로 가장 빠르게 가설을 검증할 수 있는지 제안한다.

출력:

- experiment candidates.
- expected cost/time.
- success criteria.
- failure criteria.

## Evidence Matrix schema

```yaml
claim: "초기 창업자는 아이디어를 구현 전 촘촘한 spec으로 바꾸는 데 어려움을 겪는다"
decision_context: "primary problem statement"
pro_evidence:
  - source: "..."
    summary: "..."
    strength: high|medium|low
    relevance: high|medium|low
con_evidence:
  - source: "..."
    summary: "..."
    strength: high|medium|low
    relevance: high|medium|low
uncertainties:
  - "실제 지불 의사는 아직 확인되지 않음"
follow_up_questions:
  - "사용자는 이 문제를 해결하기 위해 현재 어떤 유료 도구를 쓰는가?"
recommended_decision: "..."
confidence: low|medium|high
```

## 근거 품질 기준

좋은 근거:

- 출처가 확인 가능하다.
- 어떤 claim을 지지/반박하는지 명확하다.
- 최신성이 필요한 정보는 최신 source를 사용한다.
- 단일 출처만으로 과도한 결론을 내리지 않는다.
- 반대근거를 의도적으로 찾는다.

나쁜 근거:

- “많은 사람들이 원한다”처럼 출처 없는 일반화.
- 경쟁 제품 marketing copy만 요약.
- 반대근거 없이 추천 결론만 제시.
- source와 implication이 연결되지 않음.

## Research result 상태

| 상태 | 의미 |
| --- | --- |
| `planned` | research task가 생성됨 |
| `running` | 수집/분석 중 |
| `needs_review` | 결과가 나왔으나 품질 확인 필요 |
| `accepted` | Spec/Decision에 연결 가능 |
| `rejected` | 출처 또는 관련성이 약함 |
| `stale` | 최신성이 필요한데 오래됨 |

## 병렬 리서치 정책

사용자가 질문에 답하는 동안 Research Engine은 병렬로 실행된다. 단, 결과가 사용자를 방해하면 안 된다.

- 새 리서치 결과는 feed에 먼저 나타난다.
- high-impact 결과만 Decision Queue에 카드로 올라온다.
- 낮은 신뢰도의 리서치는 “추가 확인 필요”로 표시한다.
- 리서치 결과만으로 핵심 결정을 자동 확정하지 않는다.
- `repeat_limit_reached` 때문에 생성된 research task는 새 evidence가 나오기 전까지 같은 topicKey 질문을 다시 만들지 않는다.
- 새 evidence가 도착해도 자동 재질문하지 않고, 기존 질문 전제가 바뀌었는지 먼저 판단한다.

## 런타임 adapter 위치

Phase 1에서는 Research Engine의 core contract만 확정한다. 실제 실행 adapter는 단계별로 붙인다.

- MVP 기본: local research runner + web search/browser fetch adapter.
- v1.5: OpenClaw Background Task adapter.
- v2: Browser-use/Playwright 고급 브라우저 자동화 adapter.
- v2+: CrewAI research flow adapter.

OpenClaw의 background task 개념은 detached work의 ledger로 적합하고, Task Flow는 여러 단계 리서치 pipeline을 durable하게 관리하는 후보로 둔다. Browser-use는 open-source agent와 cloud browser 성격을 분리해 고급 웹 조작 단계에 붙인다.

## Suggested Spec Update 생성 규칙

Research Result는 직접 Spec을 바꾸지 않는다. 다음 단계를 거친다.

1. Research Result 생성.
2. Evidence Matrix에 연결.
3. 기존 Spec section과 충돌 여부 확인.
4. Suggested Spec Update 생성.
5. low-risk면 자동 반영.
6. high-impact면 Decision Approval Card 생성.

## 리서치 한계 표기

모든 리서치 결과는 한계를 포함해야 한다.

- 출처 수 부족.
- 편향 가능성.
- 최신성 문제.
- 지역/시장 차이.
- 실제 고객 인터뷰 부재.
