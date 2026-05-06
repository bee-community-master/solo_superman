# 06. Research Engine

## 역할

Research Engine은 창업자의 아이디어와 답변을 바탕으로 제품 판단에 필요한 근거를 생성한다. 단순 웹 요약기가 아니라 **결정별 찬반 근거 매트릭스 생성기**다.

Question Loop에서 `research_needed` 또는 `research_insufficient`로 수렴된 항목은 `14-ambiguity-question-lifecycle.md`의 반복 제한 정책을 따른다. Research Engine은 이 상태를 새 질문으로 되돌리는 것이 아니라, 새 evidence를 만들어 질문 재개 여부를 판단하게 한다.

Pro/Con Evidence Gate의 상세 기준은 `15-pro-con-evidence-gate.md`를 따른다. Research Engine은 외부 리서치 런타임 구현이 아니라, 수집된 근거가 decision에 쓰일 수 있는지 판단하는 품질 계약을 책임진다.

## Research Loop

```text
AmbiguityIssue
→ ResearchNeed
→ ResearchTask
→ SourceCollection
→ ClaimExtraction
→ Pro/Con Matrix
→ Pro/Con Evidence Gate
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
impact: high|medium|low
decision_context: "primary problem statement"
balance_status: no_evidence|pro_only|con_only|pro_con_present|missing_con_evidence|balanced|blocked_by_con_evidence|source_quality_insufficient
pro_evidence:
  - source: "..."
    stance: pro
    summary: "..."
    implication: "..."
    strength: high|medium|low
    relevance: high|medium|low
    source_reliability: high|medium|low
    limitations: []
con_evidence:
  - source: "..."
    stance: con
    summary: "..."
    implication: "..."
    strength: high|medium|low
    relevance: high|medium|low
    source_reliability: high|medium|low
    limitations: []
missing_con_evidence_reason: "skeptical search를 했지만 관련 반대근거를 아직 찾지 못함"
skeptical_search:
  attempted: true
  checked_source_categories:
    - competitor_site
    - community
    - official_doc
uncertainties:
  - "실제 지불 의사는 아직 확인되지 않음"
follow_up_questions:
  - "사용자는 이 문제를 해결하기 위해 현재 어떤 유료 도구를 쓰는가?"
recommended_decision: "..."
confidence: low|medium|high
```

## Evidence Pack contract

Evidence Pack은 source dump가 아니라 decision quality artifact다. 창업자에게 중요한 질문은 “근거가 있는가”가 아니라 “이 근거로 무엇을 결정해도 되고, 무엇은 아직 결정하면 안 되는가”다.

필수 구조:

```yaml
claim: "솔로 창업자는 구현 전에 spec과 다음 검증 행동을 정리할 필요가 있다"
source_type: official|blog|forum|dataset|academic|anecdotal|interview|competitor|unknown
source_freshness: fresh|acceptable|stale|not_time_sensitive|unknown
supporting_evidence:
  - summary: "..."
    source: "..."
    reliability: high|medium|low
counter_evidence:
  - summary: "..."
    source: "..."
    reliability: high|medium|low
uncertainty:
  - "실제 지불 의사는 아직 확인되지 않음"
what_this_does_not_prove:
  - "완성된 PRD export가 MVP의 핵심 가치라는 점은 증명하지 않음"
decision_implication: "MVP는 완성된 문서보다 15분 안에 다음 검증 행동을 정하는 데 집중해야 함"
strongest_disconfirming_signal: "사용자가 질문 품질보다 즉시 prototype 생성을 더 반복적으로 요구함"
next_validation_action: "5명의 솔로 창업자에게 problem interview와 지불의사 질문을 실행"
```

Evidence Pack은 반드시 Queue, Decision, Known Risks, Validation Plan 중 하나 이상으로 연결된다. 연결되지 않은 evidence는 Founder OS 제품 판단에 쓰지 않는다.

## Pro/Con Evidence Gate

핵심 claim은 다음 중 하나가 되기 전까지 decision-ready가 아니다.

- `pro_con_present`: 찬성 근거와 반대근거가 모두 존재한다.
- `balanced`: 찬반 근거, 불확실성, 한계, 다음 validation action이 함께 정리되어 있다.
- `missing_con_evidence`: 반대근거를 찾기 위한 skeptical search를 수행했지만 아직 찾지 못했고, 그 이유와 한계를 명시했다.

Gate 규칙:

- high impact claim이 `pro_only`이면 Decision Approval Card를 만들 수 없다.
- high impact claim이 `missing_con_evidence`이면 skeptical search 기록과 Known Risks 연결이 필요하다.
- medium impact claim의 `missing_con_evidence`는 completion을 막지 않을 수 있지만 Next Validation Actions에 연결되어야 한다.
- low impact claim은 Founder Brief Known Risks 또는 Open Questions에 남기고 완료를 막지 않는다.
- `blocked_by_con_evidence`는 Conflict Resolution Card 또는 Decision 재검토로 라우팅한다.

## skeptical search

skeptical search는 claim을 반박하기 위해 의도적으로 수행하는 리서치 단계다.

필수 기록:

- 반박하려는 claim.
- 확인한 source category.
- 발견한 `con_evidence`.
- 찾지 못했다면 `missing_con_evidence_reason`.
- 이 한계가 Known Risks와 Next Validation Actions에 연결되는 방식.

skeptical search 없이 “반대근거 없음”이라고 쓰면 안 된다. 그 상태는 `pro_only` 또는 `missing_con_evidence` 미해결로 남긴다.

## 근거 품질 기준

좋은 근거:

- 출처가 확인 가능하다.
- 어떤 claim을 지지/반박하는지 명확하다.
- `summary`와 `implication`이 분리되어 있다.
- 최신성이 필요한 정보는 최신 source를 사용한다.
- 단일 출처만으로 과도한 결론을 내리지 않는다.
- 반대근거를 의도적으로 찾는다.
- limitations가 Known Risks 또는 Next Validation Actions에 연결된다.

나쁜 근거:

- “많은 사람들이 원한다”처럼 출처 없는 일반화.
- 경쟁 제품 marketing copy만 요약.
- 반대근거 없이 추천 결론만 제시.
- source와 implication이 연결되지 않음.
- 작은 source summary를 큰 시장/고객 결론으로 과장.
- `con_evidence`가 없는데 `missing_con_evidence`로도 표시하지 않음.

## Research result 상태

| 상태 | 의미 |
| --- | --- |
| `planned` | research task가 생성됨 |
| `running` | 수집/분석 중 |
| `needs_review` | 결과가 나왔으나 품질 확인 필요 |
| `accepted` | Spec/Decision에 연결 가능 |
| `rejected` | 출처 또는 관련성이 약함 |
| `stale` | 최신성이 필요한데 오래됨 |
| `evidence_gate_blocked` | Pro/Con Evidence Gate를 통과하지 못함 |

## 병렬 리서치 정책

사용자가 질문에 답하는 동안 Research Engine은 병렬로 실행된다. 단, 결과가 사용자를 방해하면 안 된다.

- 새 리서치 결과는 feed에 먼저 나타난다.
- high-impact 결과만 Decision Queue에 카드로 올라온다.
- 낮은 신뢰도의 리서치는 “추가 확인 필요”로 표시한다.
- 리서치 결과만으로 핵심 결정을 자동 확정하지 않는다.
- `repeat_limit_reached` 때문에 생성된 research task는 새 evidence가 나오기 전까지 같은 topicKey 질문을 다시 만들지 않는다.
- 새 evidence가 도착해도 자동 재질문하지 않고, 기존 질문 전제가 바뀌었는지 먼저 판단한다.
- high impact claim의 `pro_only` 결과는 Decision Queue에 바로 올리지 않고 Pro/Con Evidence Gate 보강으로 돌린다.
- `missing_con_evidence`가 발생하면 activity feed에 “반대근거 탐색 필요”로 표시한다.

## 런타임 adapter 위치

Phase 1의 Research Engine은 `17-ai-runtime-access-strategy.md`를 따른다. 핵심은 ChatGPT 웹 자동화가 아니라 **Codex app-server sandbox preview + manual prompt handoff + official Codex path fallback**이다.

- Phase 1 primary: CodexRuntimeAdapter.
- Phase 1 support: LocalResearchRuntime for manual prompt handoff/import.
- Phase 1.5A 후보: OpenClaw Background Task adapter.
- Phase 2+ 후보: ChatGPT Pro 웹 자동화, Browser-use/Playwright 고급 브라우저 자동화 adapter.
- v2+ 후보: CrewAI research flow adapter.

OpenClaw의 background task 개념은 detached work의 ledger로 적합하고, Task Flow는 여러 단계 리서치 pipeline을 durable하게 관리하는 후보로 둔다. Browser-use는 open-source agent와 cloud browser 성격을 분리해 고급 웹 조작 단계에 붙인다.

Phase 1.5A 구현자는 `30-phase1.5-research-runtime-and-readiness-contract.md`를 canonical source로 사용한다. Research Engine 문서의 Phase 1.5 체크리스트는 다음이다.

- read-only connector만 허용하고 external write/action은 금지한다.
- ResearchAllowlist, ResearchRun, ResearchDisclosureLog를 1급 projection/API/DB 후보로 둔다.
- automatic run은 public-safe summary + research objective까지만 외부 전송한다.
- private document, full raw idea, detailed answers, credentialed source는 task-level approval 또는 manual handoff로 라우팅한다.
- provider result는 Pro/Con Evidence Gate와 staleness/limitation gate를 통과하기 전 EvidenceMatrix에 accepted로 반영하지 않는다.

## Deep research routing

깊은 리서치가 필요하면 Research Engine은 다음 순서로 라우팅한다.

```text
ResearchNeed
→ Codex app-server sandbox preview
→ if deep external research needed: manual prompt handoff
→ if user still wants full automation: official Codex path only, as defined in `17-ai-runtime-access-strategy.md`
→ if still insufficient: Risk Card + Known Risk + Next Validation Action
```

Phase 1에서 Research Engine은 ChatGPT 웹 UI를 직접 자동 조작하지 않는다. ChatGPT Pro 웹 자동화는 Phase 2+의 project-level blanket delegation 기능이다.

Manual prompt handoff는 다음을 포함해야 한다.

- 리서치 목적.
- 포함할 project context 요약.
- 제외할 민감 정보.
- ChatGPT/Codex에 붙여넣을 prompt.
- 결과 import template.
- 기대 evidence type: pro, con, uncertainty, implication, source.
- 결과가 부족할 때 Known Risks와 Next Validation Actions에 남기는 방식.

## Suggested Spec Update 생성 규칙

Research Result는 직접 Spec을 바꾸지 않는다. 다음 단계를 거친다.

1. Research Result 생성.
2. Evidence Matrix에 연결.
3. Pro/Con Evidence Gate 통과 여부 확인.
4. 기존 Spec section과 충돌 여부 확인.
5. Suggested Spec Update 생성.
6. low-risk면 자동 반영.
7. high-impact면 Decision Approval Card 생성.

## 리서치 한계 표기

모든 리서치 결과는 한계를 포함해야 한다.

- 출처 수 부족.
- 편향 가능성.
- 최신성 문제.
- 지역/시장 차이.
- 실제 고객 인터뷰 부재.
