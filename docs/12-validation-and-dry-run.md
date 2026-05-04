# 12. Validation and Dry-run

## 문서 완료 검증 방식

이번 docs-only 작업의 완료 기준은 두 가지다.

1. 구현자 핸드오프 검토.
2. 샘플 아이디어 dry-run.

## 1. 구현자 핸드오프 검토

### 검토 질문

- Phase 1 구현자가 추가 제품 결정을 하지 않아도 시작할 수 있는가?
- MVP 포함/제외 범위가 명확한가?
- 핵심 객체와 상태가 정의되어 있는가?
- UI 중심 구조가 명확한가?
- completion score가 구현 가능한 수준으로 정의되어 있는가?
- Confidence Map과 5축 레이더가 사용자의 남은 리스크 이해에 연결되는가?
- 날카로운 제품 코치 톤이 이유 설명, 가설 언어, 반복 제한, 피로도 감지를 지키는가?
- Founder Brief가 완료/중단 시 기본 산출물로 정의되어 있는가?
- Ambiguity/Question Lifecycle이 무한 질문 루프를 막는 수렴 정책을 정의하는가?
- Pro/Con Evidence Gate가 confirmation bias를 막는 evidence 품질 기준을 정의하는가?
- State/Event Contract가 Question, Research, Approval, SpecVersion, Completion의 trace를 끊기지 않게 정의하는가?
- ProductEngine Orchestrator가 Phase 1 전체 세션 라이프사이클, 중앙 상태 전이, Queue 재계산, active batch 안정성을 정의하는가?
- AI Runtime Access Strategy가 Codex app-server, sandbox preview, manual handoff, Phase 2+ ChatGPT 웹 자동화 경계를 정의하는가?
- Research Loop의 입력/출력이 명확한가?
- approval boundary가 명확한가?
- runtime adapter와 core의 경계가 명확한가?
- Tauri + Node/Hono sidecar topology가 구현자가 다시 선택하지 않아도 될 만큼 고정되어 있는가?
- node_core_rust_native_boundary가 Rust/Tauri command와 Node sidecar 책임을 분리하는가?
- local embedded libSQL + Drizzle 저장소, migration, repository convention이 정의되어 있는가?
- remote sync가 Phase 1에서 구현되지 않고 remote config placeholder only로 제한되는가?
- Hono `/api/v1` route group, local auth, SSE event stream, error envelope가 정의되어 있는가?
- Codex app-server stdio, generated schema pinning, RuntimePreviewArtifact 변환 규칙이 정의되어 있는가?
- Phase 1 구현 PR sequence가 scaffold부터 E2E dry-run까지 순서와 acceptance를 제공하는가?

### Pass 기준

다음 질문에 모두 “예”라고 답할 수 있어야 한다.

| 항목 | Pass 기준 |
| --- | --- |
| 사용자 | 첫 target이 초기 창업자로 고정됨 |
| JTBD | 막연한 아이디어를 제품/시장 검증 가능한 Spec으로 구체화 |
| MVP | Research 포함 폐루프가 닫힌 범위로 정의됨 |
| Non-goals | 팀/모바일/결제/자동실행 제외 명확 |
| UI | Decision Queue 중심 레이아웃 정의 |
| Scoring | 복합 완성도 산식과 gate 정의 |
| UX Doctrine | 남은 리스크를 알고 시작한다는 완료 감각, 5축 레이더, 행동 신호 기반 피로도 개입 정의 |
| Ambiguity/Question | repeat_limit_reached, severity별 수렴 정책, completion 연결 정의 |
| Pro/Con Evidence | pro_evidence, con_evidence, missing_con_evidence, skeptical search, completion 연결 정의 |
| State/Event Contract | AmbiguityIssue에서 CompletionCandidate까지 trace link, terminal outcome, guardrail 정의 |
| ProductEngine | 전체 세션 라이프사이클, command/event/state, Queue 재계산, 모듈 소유권 정의 |
| AI Runtime | Codex app-server 우선, Phase 1 sandbox preview, ChatGPT 웹 자동화 Phase 2+ 정의 |
| Founder Brief | Problem-Customer-Value, Top Decisions, Known Risks, Next Validation Actions 정의 |
| Domain | 핵심 객체와 상태 정의 |
| Architecture | core와 runtime adapter 경계 정의 |
| Security | local-first와 승인 경계 정의 |
| Roadmap | Phase별 진입 조건과 제외 범위 정의 |
| Implementation Architecture | Tauri + Node/Hono sidecar, package layout, dev scripts, native boundary 정의 |
| Data Storage | local embedded libSQL, Drizzle migration, repository/projection, remote config placeholder 정의 |
| Sidecar API Runtime | Hono route shape, validation, SSE, Codex app-server preview boundary 정의 |
| Implementation Sequence | PR-01~PR-09 acceptance와 cross-PR dependency 정의 |

### Fail 시 조치

- 구현자가 다시 결정해야 하는 항목은 해당 문서에 “Implementation ADR 필요”로 표시한다.
- 문서 간 충돌은 roadmap 또는 PRD 중 더 구체적인 문서를 기준으로 정리한다.
- Phase 1 범위를 넓히는 충돌은 non-goal을 우선한다.

## 2. 샘플 아이디어 dry-run

### 샘플 아이디어

> “AI로 개인 창업자가 고객 인터뷰를 더 잘 준비하게 해주는 도구를 만들고 싶다.”

### Intake 결과 예시

Initial Spec Draft:

- Problem: 창업자가 고객 인터뷰 전에 어떤 질문을 해야 할지 모른다.
- Target Customer: 초기 창업자.
- Value Proposition: 인터뷰 질문과 가설을 더 촘촘하게 준비한다.
- Open Questions: 어떤 창업자 단계가 제일 아픈가, 기존 대체재는 무엇인가, 인터뷰 준비가 실제 유료 문제인가.

### AmbiguityIssue 예시

| 이슈 | 유형 | 심각도 | 이유 |
| --- | --- | --- | --- |
| “초기 창업자”가 너무 넓음 | vague | high | 질문 품질과 판매 채널이 달라짐 |
| 고객 인터뷰 준비 문제의 지불 의사 불명확 | unsupported | high | 제품화 가능성 판단에 중요 |
| 대체재 미정 | missing | medium | 차별화가 어려움 |
| MVP 성공 기준 없음 | missing | high | 검증 실험 설계 불가 |

### Question Batch 예시

1. 가장 먼저 만족시킬 창업자 단계는 무엇인가?
   - 아이디어만 있는 예비 창업자.
   - 고객 인터뷰를 앞둔 초기 창업자.
   - MVP 후 전환율을 개선하려는 창업자.
2. 사용자가 현재 쓰는 대체재는 무엇인가?
   - ChatGPT 프롬프트.
   - 노션 템플릿.
   - 멘토/액셀러레이터 피드백.
   - 아무것도 안 함.
3. 인터뷰 준비가 실패했다는 신호는 무엇인가?
   - 질문이 너무 일반적이다.
   - 답변이 제품 결정으로 이어지지 않는다.
   - 고객이 말한 내용을 해석하지 못한다.
4. MVP는 어떤 결과물을 만들어야 하는가?
   - 인터뷰 질문 리스트.
   - 가설/리스크 매트릭스.
   - 인터뷰 후 분석까지 포함.

### ResearchTask 예시

- Customer segment research: 초기 창업자가 고객 인터뷰 준비에 돈/시간을 쓰는지 조사.
- Alternatives research: ChatGPT prompts, interview templates, accelerator materials 비교.
- Validation experiment research: 컨시어지 방식으로 인터뷰 질문 개선 서비스를 제공할 수 있는지 설계.

### Evidence Matrix 예시

Claim:

> 초기 창업자는 고객 인터뷰 질문을 제품 결정과 연결하는 데 어려움을 겪는다.

Pro evidence:

- 창업 교육 자료들은 고객 discovery와 좋은 질문의 중요성을 반복적으로 강조한다.
- 많은 창업자가 ChatGPT/템플릿으로 질문 초안을 만들 수 있으나, 자신의 가설과 연결하는 구조화가 약할 수 있다.

Con evidence:

- 무료 템플릿과 LLM으로 충분하다고 느낄 수 있다.
- 실제 고통은 질문 작성이 아니라 인터뷰 대상 모집일 수 있다.

Uncertainties:

- 사용자가 이 문제에 지불할지 불명확.
- 어떤 창업 단계에서 pain이 가장 강한지 불명확.

Follow-up questions:

- 창업자가 고객 인터뷰 준비에 이미 돈을 쓰는가?
- 인터뷰 질문 품질이 실제로 MVP 방향 전환에 영향을 주는가?

### Suggested Spec Update 예시

변경 제안:

- Target Customer를 “고객 인터뷰를 1~2주 안에 앞둔 초기 창업자”로 좁힌다.
- MVP Scope를 “인터뷰 질문 생성”이 아니라 “가설 기반 질문 큐 + 인터뷰 후 결정 기록”으로 정의한다.

승인 필요 이유:

- Target Customer와 MVP 범위가 바뀌는 핵심 결정이다.

### Completeness 변화 예시

| 단계 | 점수 |
| --- | --- |
| Intake 직후 | 22% |
| 첫 질문 배치 답변 후 | 38% |
| 리서치 결과 연결 후 | 56% |
| 핵심 결정 승인 후 | 74% |
| validation plan 승인 후 | 86%, Spec-ready 후보 |

### Confidence Map 변화 예시

| 단계 | 문제 | 고객 | 가치제안 | 검증 | 구현 |
| --- | --- | --- | --- | --- | --- |
| Intake 직후 | 35 | 28 | 32 | 20 | 25 |
| 첫 질문 배치 답변 후 | 56 | 42 | 48 | 34 | 38 |
| 리서치 결과 연결 후 | 68 | 55 | 61 | 58 | 52 |
| 핵심 결정 승인 후 | 76 | 66 | 72 | 70 | 68 |
| validation plan 승인 후 | 80 | 76 | 78 | 82 | 77 |

마지막 단계는 모든 축 75점 이상이므로 completion candidate를 제안할 수 있다. 단, 복합 완성도 gate와 required decisions gate도 함께 통과해야 한다.

### Founder Brief dry-run

샘플 세션이 중단되거나 완료되면 기본 export는 Founder Brief다.

필수 section:

- Problem-Customer-Value Summary: 고객 인터뷰를 앞둔 초기 창업자의 질문/가설 연결 문제.
- Top Decisions: 첫 고객, MVP 범위, validation plan, success criteria.
- Known Risks: 지불 의사, 대체재 대비 전환 이유, 인터뷰 대상 모집 문제가 더 큰 pain일 가능성.
- Next Validation Actions: 컨시어지 실험, 대체재 사용자 인터뷰, 유료 의향 테스트.

완료 메시지는 “성공 가능성이 높다”가 아니라 “남은 리스크를 알고 시작한다”를 중심으로 작성한다.

### Adaptive session dry-run

샘플 세션에서 다음 trigger가 발생하면 추가 질문 또는 리서치가 생성되어야 한다.

- High confidence, low evidence: 사용자가 “창업자는 반드시 돈을 낼 것”이라고 답했지만 근거가 없을 때.
- Problem-Customer-Value misalignment: 고객은 예비 창업자인데 가치제안은 MVP 이후 분석에 맞춰져 있을 때.
- MVP scope too broad: 질문 생성, 인터뷰 기록, 분석, CRM 연동을 모두 Phase 1에 넣으려 할 때.
- Missing con evidence: ChatGPT 프롬프트나 무료 템플릿으로 충분하다는 반대근거가 없을 때.

다음 trigger가 발생하면 질문을 더 늘리지 않아야 한다.

- 모든 축 75점 이상이며 completion gate를 통과했을 때.
- 같은 주제 질문이 3회 반복되어 더 이상 새 정보를 만들지 못할 때.

### Fatigue intervention dry-run

사용자의 답변이 짧아지고 보류 답변이 늘어나는 행동 신호 기반 피로도 신호가 감지되면 다음 요약을 보여준다.

- 지금까지 확정된 결정.
- confidence delta.
- 지금 멈추면 받을 수 있는 산출물.
- 낮은 confidence 축.

이 상태에서는 Top 3 Risk Cards를 먼저 밀어붙이지 않고, 사용자가 계속 진행할지 판단할 수 있게 한다.

### Ambiguity/Question Lifecycle dry-run

샘플 세션에서 `primary_customer_narrowing` topic의 질문이 반복된다고 가정한다.

1. 첫 질문: “가장 먼저 만족시킬 창업자 단계는 무엇인가?”
2. 두 번째 질문: “구매자와 사용자가 같은 사람인가?”
3. 세 번째 질문: “이번 MVP에서 제외할 고객은 누구인가?”
4. 네 번째 질문 후보 생성 시점: `repeat_limit_reached` event가 발생해야 한다.

기대 결과:

- high severity이면 Risk Accepted Approval Card를 생성한다.
- 사용자가 승인하면 `risk_accepted`로 수렴하고 Founder Brief Known Risks에 남긴다.
- 사용자가 승인하지 않으면 `deferred` 또는 `research_needed`로 전환하고 Completion Candidate를 막는다.
- medium severity이면 `research_needed` 또는 `research_insufficient`로 전환하고 새 evidence 전까지 같은 topicKey 질문을 만들지 않는다.
- low severity이면 `deferred`로 접고 Open Questions에 남긴다.

실패 결과:

- 같은 topicKey에서 네 번째 Question Card가 바로 생성됨.
- 반복 제한에 도달했지만 status가 open으로 남음.
- high severity issue가 risk accepted 없이 completion gate를 통과함.
- medium severity research_needed가 Known Risks나 Next Validation Actions에 연결되지 않음.

### Pro/Con Evidence Gate dry-run

샘플 claim:

> 초기 창업자는 고객 인터뷰 질문을 제품 결정과 연결하는 데 어려움을 겪는다.

통과 시나리오:

- `pro_evidence`: 창업 교육 자료와 멘토링 자료가 customer discovery와 좋은 질문 설계의 중요성을 반복적으로 강조한다.
- `con_evidence`: 무료 템플릿과 ChatGPT 프롬프트로 질문 초안을 충분히 만들 수 있다는 대체재 근거가 있다.
- uncertainties: 실제 지불 의사와 pain intensity는 아직 고객 인터뷰로 확인되지 않았다.
- balanceStatus: `balanced`.
- Known Risks: 단순 질문 생성만으로는 차별화가 약할 수 있음.
- Next Validation Actions: 대체재 사용 경험이 있는 창업자 5명에게 전환 이유를 인터뷰한다.

실패 시나리오:

- `pro_evidence`만 있고 `con_evidence`가 없다.
- `missing_con_evidence`로 표시하지 않았다.
- skeptical search 기록이 없다.
- “고객 인터뷰가 중요하다”는 근거를 “사용자가 유료 구매한다”로 과장했다.
- high impact claim인데 completion candidate가 생성되었다.

기대 결과:

- 실패 시나리오는 decision-ready가 아니다.
- high impact `pro_only` claim은 Evidence quality를 최대 40점으로 제한한다.
- `missing_con_evidence`가 있으면 Known Risks와 Next Validation Actions에 연결한다.
- 반대근거가 발견되면 Founder Brief의 Known Risks에 숨기지 않고 표시한다.

### State/Event Contract dry-run

샘플 세션의 end-to-end trace는 다음처럼 끊기지 않아야 한다.

| 순서 | 객체/상태 | Event 또는 판단 | 다음 연결 |
| --- | --- | --- | --- |
| 1 | `AmbiguityIssue` | “초기 창업자”가 너무 넓어 `primary_customer_narrowing` high severity issue 생성 | `Question` |
| 2 | `Question` | 첫 고객 단계를 좁히는 선택 질문이 batch에 포함됨 | `Answer` |
| 3 | `Answer` | 사용자가 “고객 인터뷰를 앞둔 초기 창업자”를 선택 | `decision_candidate`, `research_needed` |
| 4 | `ResearchTask` | 대체재와 지불 의사 근거를 조사 | `ResearchResult` |
| 5 | `EvidenceMatrix` | pro evidence, con evidence, uncertainties, skeptical search 기록 | `SpecUpdate` |
| 6 | `SpecUpdate` | Target Customer와 MVP Scope 변경 제안 생성 | `Decision Approval Card` |
| 7 | `Decision` | 사용자가 primary customer와 MVP scope 변경을 승인 | `SpecVersion` |
| 8 | `SpecVersion` | 승인된 변경만 immutable snapshot으로 고정 | `CompletenessSnapshot` |
| 9 | `CompletenessSnapshot` | 복합 완성도와 Confidence Map이 갱신됨 | `CompletionCandidate` 또는 next action |
| 10 | `CompletionCandidate` | 모든 gate 통과 시 Founder Brief와 남은 risk를 함께 제시 | 완료 선언 / 더 깊게 질문 / 리서치 보강 |

통과 조건:

- 각 행은 이전 객체의 id 또는 문서상 명시된 trace link를 가진다.
- `AnswerRouteOutcome`이 없는 Answer는 다음 단계로 넘어가지 않는다.
- high-impact `SpecUpdate`는 approval 없이 `SpecVersion`을 만들지 않는다.
- high impact claim이 `pro_only`이면 CompletionCandidate가 생성되지 않는다.
- `CompletionCandidate`는 남은 Known Risks와 Next Validation Actions를 Founder Brief에 연결한다.

실패 조건:

- `ResearchTask` 또는 `EvidenceMatrix`가 어떤 Question/Answer에서 왔는지 모른다.
- Decision이 승인됐지만 alternatives, evidence, rationale이 없다.
- Completeness score만 높고 high severity issue 상태가 열려 있는데 완료 후보가 생성된다.
- State/Event Contract가 README, Spec Engine, Domain Model과 다른 용어를 사용한다.

## 정적 일관성 검토 체크리스트

- [ ] 모든 문서가 Phase 1을 Research 포함 폐루프로 정의한다.
- [ ] 자동 코드 실행은 Phase 1에서 제외된다.
- [ ] 모바일 앱은 Phase 1에서 제외된다.
- [ ] 팀 협업은 Phase 1에서 제외된다.
- [ ] 결제/과금은 Phase 1에서 제외된다.
- [ ] local-first + optional sync 정책이 일관된다.
- [ ] Decision Queue 중심 UX가 UX/PRD/Scoring 문서에서 충돌하지 않는다.
- [ ] Living Product Spec 완료 기준이 evidence + decision gate와 일치한다.
- [ ] 복합 완성도 점수와 무한 질문 루프 방지 정책이 연결된다.
- [ ] UX Doctrine이 2~5시간 세션의 핵심 감각과 질문 톤을 정의한다.
- [ ] Confidence Map은 5축 레이더, Top 3 Risk Cards, Next Question Batch, Score History로 정의된다.
- [ ] Spec-ready 후보는 모든 축 75점 이상과 completion gate를 함께 요구한다.
- [ ] Pro/Con Evidence Gate는 high impact claim이 pro_only 상태일 때 decision-ready를 막는다.
- [ ] missing_con_evidence는 skeptical search 기록과 Known Risks 연결을 요구한다.
- [ ] confirmation bias 방지를 위해 반대근거 없는 핵심 claim은 확정 문장으로 들어가지 않는다.
- [ ] Ambiguity/Question Lifecycle은 같은 topicKey의 4번째 질문 전에 repeat_limit_reached를 발생시킨다.
- [ ] high severity 반복 제한은 risk_accepted 승인 전까지 completion gate를 막는다.
- [ ] medium severity 반복 제한은 research_needed 또는 research_insufficient로 수렴하고 새 evidence 전까지 재질문하지 않는다.
- [ ] low severity 반복 제한은 deferred로 접히며 Open Questions와 Known Risks에 남는다.
- [ ] 무한 질문 루프 방지 정책이 Decision Queue, Spec Engine, Scoring 문서에서 충돌하지 않는다.
- [ ] 날카로운 제품 코치 톤은 이유 설명, 3회 반복 제한, 가설 언어, 피로도 감지를 지킨다.
- [ ] 행동 신호 기반 피로도 개입은 확정된 결정, confidence delta, if-stop-now 산출물, 낮은 confidence 축을 요약한다.
- [ ] Founder Brief는 Problem-Customer-Value, Top Decisions, Known Risks, Next Validation Actions를 포함한다.
- [ ] RuntimeAdapter는 core가 아니라 확장 경계로 정의된다.
- [ ] Codex app-server는 Phase 1 primary AI runtime으로 정의된다.
- [ ] Codex app-server는 Phase 1에서 sandbox preview 권한만 가진다.
- [ ] Phase 1에서 실제 파일 patch, shell command, browser action은 실행되지 않는다.
- [ ] Phase 1에서 ChatGPT 웹 자동화는 구현 범위 밖이다.
- [ ] 깊은 리서치 fallback은 수동 프롬프트 핸드오프 후 공식 Codex 경로로 정의된다.
- [ ] ChatGPT Pro 웹 자동화는 Phase 2+에서 project-level blanket delegation, revoke, audit, fallback chain이 있을 때만 가능하다.
- [ ] State/Event Contract는 AmbiguityIssue, Question, Answer, ResearchTask, EvidenceMatrix, SpecUpdate, Decision, SpecVersion, CompletenessSnapshot, CompletionCandidate trace를 정의한다.
- [ ] State/Event Contract는 런타임/코드 구현 제외와 DB/API 스키마 상세 제외를 명시한다.
- [ ] State/Event Contract dry-run은 샘플 아이디어가 end-to-end event trace로 이어지는지 검증한다.
- [ ] README, Spec Engine, Domain Model, Validation 문서는 같은 State/Event Contract 범위를 공유한다.
- [ ] README, Architecture, Decision Queue, Spec Engine, State/Event Contract는 같은 ProductEngine Orchestrator 경계를 공유한다.
- [ ] Tauri + Node/Hono sidecar 결정이 README, Architecture, Implementation Architecture에서 일치한다.
- [ ] Rust/Tauri native boundary는 secret reference, app data dir, file picker/export, sidecar lifecycle에 한정된다.
- [ ] ProductEngine, DB repository, Codex adapter, Hono API는 Node sidecar 소유로 일관된다.
- [ ] local embedded libSQL + Drizzle 선택이 Architecture, Domain Model, Data Storage에서 일치한다.
- [ ] remote config placeholder only 정책이 README, Architecture, Data Storage, Security/Phase boundary와 충돌하지 않는다.
- [ ] Hono route group은 ProductEngine command/event/state를 우회하지 않는다.
- [ ] Codex app-server는 stdio/schema pinning/preview-only runtime으로 정의된다.
- [ ] Phase 1 implementation sequence는 문서 계약을 새로 선택하지 않고 구현 순서로만 전환한다.
- [ ] ProductEngine runtime contract는 `pure reducer + effect plan`을 구현 패턴으로 고정한다.
- [ ] ProductEngine reducer는 DB, Hono, Codex, filesystem, shell, browser, network를 직접 호출하지 않는다.
- [ ] ProductEngine effect 실행은 `persisted async effect queue`를 사용하고 in-memory-only queue를 금지한다.
- [ ] `active batch projection exception`은 즉시 projection의 유일한 예외로 정의된다.
- [ ] `queue_projection_effect`, `research_evidence_effect`, `codex_runtime_preview_effect`가 Phase 1 1급 Effect Type으로 반복 정의된다.
- [ ] `scoring_effect`와 `spec_export_effect`는 Phase 1 1급 async effect가 아니며, scoring/export는 `reducer_deterministic_output`으로 유지된다.
- [ ] `conservative_ai_retry_matrix`가 README, 20, 21, 23에서 같은 의미로 반복된다.
- [ ] 중복 원문 허용 정책에 따라 18/20/21/22/23 문서의 stable keyword가 서로 충돌하지 않는다.

## 현재 문서 검증 결과

- Phase 1 범위: 일관됨.
- Non-goals: 일관됨.
- Core stack: Tauri/React/local embedded libSQL/Spec Engine으로 일관됨.
- Runtime: Codex app-server primary와 adapter 후보로 일관됨.
- UX 중심: Decision Queue 중심으로 일관됨.
- Completion: 복합 완성도 + gate로 일관됨.
- UX Doctrine: confidence map, adaptive session, Founder Brief 기준으로 일관됨.
- State/Event Contract: Question, Research, Approval, SpecVersion, Completion trace 기준으로 일관됨.
- Implementation Architecture: Tauri + Node/Hono sidecar, package layout, dev scripts, native boundary 기준으로 일관됨.
- Data Storage: local embedded libSQL + Drizzle, repository/projection, remote config placeholder 기준으로 일관됨.
- Sidecar API Runtime: Hono `/api/v1`, local auth, SSE, Codex app-server preview boundary 기준으로 일관됨.
- Implementation Sequence: PR-01~PR-09 순서와 acceptance 기준으로 일관됨.
- ProductEngine Runtime Contract: pure reducer + effect plan, persisted async effect queue, active batch projection exception, effect type taxonomy, conservative AI retry matrix 기준으로 일관됨.

이번 문서에서 고정된 구현 결정:

- Tauri 내부 core 구현 방식은 Rust command 중심이 아니라 Node/Hono sidecar 중심이다.
- SQLite binding은 local embedded libSQL via `@libsql/client`다.
- schema/migration은 Drizzle schema와 generated SQL migration이다.
- Codex app-server는 stdio 기본값과 generated schema pinning을 사용한다.
- ChatGPT/Codex secret value는 DB에 저장하지 않고 Rust/Tauri native boundary가 secret reference만 다룬다.
- 첫 LLM provider abstraction은 `CodexRuntimeAdapter`이며, API key provider abstraction은 후속 후보로 둔다.
- Phase 1 source cache는 app data dir 격리와 export prohibition을 우선하고, 파일 암호화는 후속 hardening 후보로 둔다.
- ProductEngine core는 pure reducer + effect plan이다.
- Effect queue는 persisted async effect queue이며, active batch projection exception만 즉시 projection 예외다.
- First-class effect types는 queue_projection_effect, research_evidence_effect, codex_runtime_preview_effect다.
- Completeness/Scoring, SpecVersion, Founder Brief draft는 reducer_deterministic_output이다.
- Retry policy는 conservative_ai_retry_matrix다.
