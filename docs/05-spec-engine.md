# 05. Spec Engine

## 역할

Spec Engine은 아이디어, 답변, 리서치 결과, 결정 승인, 문서 버전을 Spec 관점에서 연결하는 상태/산출 모듈이다. 제품의 핵심은 LLM 호출 자체가 아니라 ProductEngine이 소유하는 상태 전이와 guardrail이다.

AmbiguityIssue와 QuestionBatch의 상세 수렴 계약은 `14-ambiguity-question-lifecycle.md`를 따른다. Spec Engine은 이 계약을 Spec 산출물 후보로 변환하고, ProductEngine은 이를 전체 세션 라이프사이클에 연결한다.

Question, ResearchTask, EvidenceMatrix, Decision, SpecUpdate, SpecVersion, CompletionCandidate가 끊기지 않는 end-to-end trace는 `16-state-event-contract.md`의 State/Event Contract를 따른다. Phase 1 전체 세션 라이프사이클과 command/event/state reduce의 최상위 계약은 `18-product-engine-orchestrator.md`를 따른다. 이 계약들은 구현 전 문서 계약이며 런타임/코드 구현 제외 원칙을 유지한다. 저장소/API/DTO/route 세부 계약은 이 문서가 재정의하지 않고 `20-data-storage-contract.md`, `21-sidecar-api-runtime-contract.md`, `25-contracts-dto-catalog.md`, `26-api-route-behavior-catalog.md`가 소유한다.

## ProductEngine과의 경계

Spec Engine은 ProductEngine 아래의 spec-focused module이다.

Spec Engine이 할 수 있는 일:

- 초기 Spec draft 생성.
- AmbiguityIssue 분류.
- AnswerRouteOutcome에 따른 SpecUpdate 후보 생성.
- approved Decision을 SpecVersion 재료로 변환.

Spec Engine이 할 수 없는 일:

- 세션의 다음 상태를 단독으로 확정한다.
- active batch를 교체한다.
- high-impact SpecUpdate를 approval 없이 확정한다.
- CompletionCandidate를 직접 생성한다.

ProductEngine은 Spec Engine의 산출물을 받아 event를 남기고 Queue를 재계산한 뒤 다음 사용자 행동을 확정한다.

## Spec Kit 차용 방식

GitHub Spec Kit은 spec을 구현 전 중심 산출물로 다루는 Spec-Driven Development 흐름을 제안한다. Solo Superman은 그 철학을 창업 기획으로 확장한다.

```text
constitution → specify → clarify → plan → tasks → analyze → implement
```

Solo Superman Phase 1은 이를 다음처럼 변형한다.

```text
constitution → intake → specify → clarify → research → decide → update → score → complete
```

구현 실행 단계는 Phase 1 밖이며, docs에는 Phase별 아키텍처로만 설계한다.

## 상태머신

```text
ProjectCreated
  → IntakeCaptured
  → InitialSpecDrafted
  → AmbiguityAnalyzed
  → QuestionBatchReady
  → AnsweringInProgress
  → AnswerRouted
      ├─ RepeatLimitReached
      ├─ ResearchInProgress
      ├─ RuntimePreviewReady
      ├─ SpecUpdateSuggested
      └─ DecisionApprovalWaiting
  → EvidenceMatrixReady
  → SpecVersionCreated
  → CompletenessScored
  → CompletionCandidate
  → SpecCompleted
```

State/Event Contract 관점에서는 이 상태머신을 다음 trace로도 검토한다.

```text
AmbiguityIssue
  → Question
  → Answer
  → AnswerRouteOutcome
  → ResearchTask / EvidenceMatrix / SpecUpdate / Decision
  → SpecVersion
  → CompletenessSnapshot
  → CompletionCandidate
```

이 trace는 상태머신의 대체물이 아니라 문서 간 연결 검증 기준이다. 어떤 상태도 원인 객체와 후속 outcome 없이 독립적으로 완료될 수 없다.

### ProjectCreated

입력:

- project name.
- raw idea text.
- privacy mode.

출력:

- Project record.
- local storage initialized.

### IntakeCaptured

입력:

- raw idea.
- optional notes/links.

출력:

- normalized idea summary.
- extracted assumptions.
- initial unknowns.

### InitialSpecDrafted

입력:

- normalized idea.

출력:

- Living Product Spec draft.
- section-level confidence.
- assumptions marked as unverified.

### AmbiguityAnalyzed

입력:

- draft spec.

출력:

- AmbiguityIssue list.
- missing/conflict/unsupported/vague/decision_required tags.

### QuestionBatchReady

입력:

- AmbiguityIssue list.
- existing answers.
- research status.

출력:

- next 3~5 Question Cards.
- topicKey별 repeat count.
- confidence axis impact preview.
- possible route outcomes.

### AnsweringInProgress

입력:

- user answers.

출력:

- Answer records.
- possible Decision candidates.
- research task candidates.

### AnswerRouted

입력:

- Answer records.
- linked AmbiguityIssue.
- linked topicKey.
- current Spec state.

출력:

- route outcome: `resolved`, `research_needed`, `missing_con_evidence`, `decision_candidate`, `spec_update_candidate`, `conflict_detected`, `deferred`, `repeat_limit_reached`.
- affected Spec sections.
- affected confidence axes.
- next queue item candidates.

### RepeatLimitReached

조건:

- 같은 AmbiguityIssue 또는 같은 `topicKey` 질문이 기본 3회 반복됨.
- 4번째 질문을 만들기 직전임.
- 새 evidence, 사용자 명시 재개, 강한 반대근거가 없음.

출력:

- high severity: Risk Accepted Approval Card.
- medium severity: `research_needed` 또는 `research_insufficient`.
- low severity: `deferred`.
- Completion Scorer에 전달할 Known Risk marker.

### ResearchInProgress

입력:

- research task plan.

출력:

- ResearchResult records.
- source references.
- evidence candidates.

### RuntimePreviewReady

입력:

- Codex app-server sandbox preview result.
- manual prompt handoff draft.
- `17-ai-runtime-access-strategy.md`가 정의한 official Codex path fallback result.

출력:

- RuntimePreviewArtifact.
- Research Handoff Card 또는 Runtime Preview Card.
- 적용 금지된 file/shell/browser action의 preview-only marker.

규칙:

- Phase 1에서 RuntimePreviewArtifact는 직접 SpecVersion을 만들 수 없다.
- high-impact preview는 Decision Approval Card를 거쳐야 한다.
- file patch, shell command, browser action 요청은 실제 실행하지 않고 preview 또는 blocked outcome으로 라우팅한다.

### EvidenceMatrixReady

입력:

- research results.
- answers.

출력:

- EvidenceMatrix.
- suggested questions.
- suggested spec updates.

### SpecUpdateSuggested

입력:

- evidence matrix.
- answers.
- existing spec.

출력:

- low-risk automatic updates.
- high-impact approval cards.

### DecisionApprovalWaiting

입력:

- approval card.

출력:

- approved/rejected/revised/deferred decision.

### SpecVersionCreated

입력:

- approved decision.
- applied update.

출력:

- immutable SpecVersion snapshot.

### CompletenessScored

입력:

- current spec.
- open issues.
- evidence matrix.
- decision log.

출력:

- composite completeness score.
- next best actions.

### CompletionCandidate

조건:

- score threshold satisfied.
- high-risk questions resolved or explicitly deferred.
- 핵심 decisions approved.

출력:

- completion card.
- remaining risks.

## State/Event Contract 연결 규칙

| 상태머신 단계 | State/Event Contract에서 확인할 것 |
| --- | --- |
| `AmbiguityAnalyzed` | 최소 10개 issue가 생성되고 각 `AmbiguityIssue`가 `sectionRef`, severity, uncertainty type, `topicKey`, `whyItMatters`, `decisionItUnlocks`, expected answer type, 가능한 route를 가진다 |
| `QuestionBatchReady` | 각 `Question`이 하나의 핵심 decision 또는 evidence gap을 겨냥하고 `whyItMatters`, `decisionItUnlocks`, confidence axis impact를 가진다 |
| `AnswerRouted` | 모든 `Answer`가 `resolved`, `research_needed`, `missing_con_evidence`, `decision_candidate`, `spec_update_candidate`, `conflict_detected`, `deferred`, `repeat_limit_reached` 중 하나로 수렴한다 |
| `ResearchInProgress` / `RuntimePreviewReady` / `EvidenceMatrixReady` | `ResearchTask`, `RuntimePreviewArtifact`, `EvidenceMatrix`가 pro/con/uncertainty, skeptical search, Known Risks 연결을 만든다 |
| `SpecUpdateSuggested` | low-risk update와 high-impact approval request가 분리된다 |
| `DecisionApprovalWaiting` | `Decision`이 승인, 거절, 수정, 보류, risk accepted 중 하나의 terminal outcome을 가진다 |
| `SpecVersionCreated` | 승인된 `Decision`과 적용된 `SpecUpdate`만 immutable snapshot의 원인이 된다 |
| `CompletenessScored` / `CompletionCandidate` | 점수, Confidence Map, evidence gate, approval gate, high severity issue 상태가 함께 검토된다 |

State/Event Contract 위반은 다음과 같다.

- route outcome 없는 답변을 Decision 후보로 사용한다.
- high-impact `SpecUpdate`를 approval 없이 SpecVersion에 반영한다.
- RuntimePreviewArtifact를 실제 파일/쉘/브라우저 실행으로 적용한다.
- high impact `pro_only` claim을 decision-ready로 표시한다.
- 같은 `topicKey`의 4번째 질문 전에 `repeat_limit_reached`를 발생시키지 않는다.
- `CompletionCandidate`가 어떤 `CompletenessSnapshot`, `Decision`, `EvidenceMatrix`에서 왔는지 추적할 수 없다.

## Engine modules

### Constitution Manager

프로젝트별 기획 원칙을 저장한다.

예:

- AI는 핵심 결정을 대신하지 않는다.
- 근거 없는 확신은 금지한다.
- Phase 1 Codex 권한은 sandbox preview에 한정한다.
- MVP 범위는 검증 목적에 종속된다.

### Spec Generator

초기 문서를 만든다. 단, 불확실한 내용은 확정하지 않는다.

계약:

- 초기 draft는 최소 10개, 기본 12개 Living Product Spec section을 만든다.
- section이 비어 있어도 숨기지 않고 `현재 가설`, `불확실성`, `필요한 결정`, `다음 질문 / 다음 검증` 상태로 표시한다.
- `Problem`, `Target Customer`, `JTBD / Use Case`, `Current Alternatives`, `Value Proposition`, `Differentiation`, `MVP Scope`, `Non-goals`, `Validation Plan`, `Success Criteria`, `Evidence Status`, `Known Risks / Open Questions`가 기본 section이다.
- AI가 추정한 문장은 `가설` 또는 `미확인`으로 표시하고, 사용자 승인 전에는 확정된 product decision으로 올리지 않는다.

### Ambiguity Analyzer

Spec section별 빈칸, 충돌, 근거 부족, 불명확한 표현을 찾는다.

계약:

- 첫 분석은 최소 10개 이상의 AmbiguityIssue를 생성한다.
- AmbiguityIssue는 단순 문장 개선이 아니라 core decision, evidence, score, Spec section, Build Slice readiness 중 하나 이상에 영향을 주어야 한다.
- 각 issue는 `sectionRef`, `severity`, `uncertaintyType`, `summary`, `whyItMatters`, `questionText`, `expectedAnswerType`, `decisionItUnlocks`, optional `suggestedResearchTask`를 가진다.
- 기본 축은 primary customer narrowing, pain intensity, buyer/user split, current alternatives, alternative dissatisfaction, MVP must-have, MVP non-goal, measurable success criteria, no-product validation experiment, acquisition channel realism, implementation resource fit, security/legal/operations risk, founder advantage를 포함한다.

### Question Batch Generator

AmbiguityIssue를 3~5개 질문 배치로 변환한다.

계약:

- 같은 `topicKey`는 한 batch에 1개만 포함한다.
- high severity open issue가 남아 있으면 low severity issue를 기본 batch에 넣지 않는다.
- batch마다 confidence axis impact와 expected score impact를 표시한다.
- `repeat_limit_reached` topic은 새 evidence가 없으면 batch 후보에서 제외한다.
- 질문은 하나의 decision만 겨냥해야 한다.
- 질문마다 `whyItMatters`, `decisionItUnlocks`, `sectionRef`, `expectedAnswerType`을 유지한다.

### Research Planner

답변과 모호함을 바탕으로 필요한 리서치 task를 만든다.

### Decision Graph

질문, 답변, 리서치, 결정, Spec 변경 사이 관계를 그래프로 저장한다.

### Spec Version Manager

승인된 변경만 version으로 고정한다.

### Completion Scorer

복합 완성도를 계산하고 완료 후보를 판단한다.

## Ambiguity/Question 전이표

| 현재 상태 | Event | Guard | 다음 상태 |
| --- | --- | --- | --- |
| `open` | issue classified | question으로 줄일 수 있음 | `question_queued` |
| `question_queued` | batch selected | repeat count < 3 | `active` Question |
| `active` Question | answer received | 답변만으로 해소 | `resolved` |
| `active` Question | answer received | 근거 부족 | `research_needed` |
| `active` Question | answer received | 반대근거 탐색 부족 | `missing_con_evidence` |
| `active` Question | answer received | 핵심 결정 후보 발생 | `decision_candidate` |
| `active` Question | answer received | Spec 문장 변경 필요 | `spec_update_candidate` |
| `active` Question | answer received | 기존 Spec과 충돌 | `conflict_detected` |
| `question_queued` | next question would be 4th | same topicKey, no new evidence | `repeat_limit_reached` |
| `repeat_limit_reached` | severity high | user accepts risk | `risk_accepted` |
| `repeat_limit_reached` | severity high | user rejects risk | `deferred` 또는 `research_needed` |
| `repeat_limit_reached` | severity medium | default | `research_needed` |
| `repeat_limit_reached` | severity low | default | `deferred` |

## Guardrails

- LLM이 만든 초기 Spec은 항상 draft다.
- 핵심 decision type은 사용자 승인 전 확정 상태가 될 수 없다.
- 반대근거 없는 핵심 결정은 completion gate를 통과할 수 없다.
- high-risk 질문이 계속 생성되면 큐가 아니라 root ambiguity를 재분석한다.
- 점수가 올라도 conflict가 남아 있으면 완료 후보가 될 수 없다.
- 같은 topicKey에서 4번째 질문을 만들 수 없다.
- `repeat_limit_reached`는 해결 상태가 아니라 수렴 event다.
- high severity issue는 `risk_accepted` 승인 없이 completion gate를 통과할 수 없다.
