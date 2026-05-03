# 05. Spec Engine

## 역할

Spec Engine은 아이디어, 답변, 리서치 결과, 결정 승인, 문서 버전을 연결하는 상태머신이다. 제품의 핵심은 LLM 호출 자체가 아니라 이 상태 전이와 guardrail이다.

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
  → ResearchInProgress
  → EvidenceMatrixReady
  → SpecUpdateSuggested
  → DecisionApprovalWaiting
  → SpecVersionCreated
  → CompletenessScored
  → CompletionCandidate
  → SpecCompleted
```

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

### AnsweringInProgress

입력:

- user answers.

출력:

- Answer records.
- possible Decision candidates.
- research task candidates.

### ResearchInProgress

입력:

- research task plan.

출력:

- ResearchResult records.
- source references.
- evidence candidates.

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

## Engine modules

### Constitution Manager

프로젝트별 기획 원칙을 저장한다.

예:

- AI는 핵심 결정을 대신하지 않는다.
- 근거 없는 확신은 금지한다.
- MVP 범위는 검증 목적에 종속된다.

### Spec Generator

초기 문서를 만든다. 단, 불확실한 내용은 확정하지 않는다.

### Ambiguity Analyzer

Spec section별 빈칸, 충돌, 근거 부족, 불명확한 표현을 찾는다.

### Question Batch Generator

AmbiguityIssue를 3~5개 질문 배치로 변환한다.

### Research Planner

답변과 모호함을 바탕으로 필요한 리서치 task를 만든다.

### Decision Graph

질문, 답변, 리서치, 결정, Spec 변경 사이 관계를 그래프로 저장한다.

### Spec Version Manager

승인된 변경만 version으로 고정한다.

### Completion Scorer

복합 완성도를 계산하고 완료 후보를 판단한다.

## Guardrails

- LLM이 만든 초기 Spec은 항상 draft다.
- 핵심 decision type은 사용자 승인 전 확정 상태가 될 수 없다.
- 반대근거 없는 핵심 결정은 completion gate를 통과할 수 없다.
- high-risk 질문이 계속 생성되면 큐가 아니라 root ambiguity를 재분석한다.
- 점수가 올라도 conflict가 남아 있으면 완료 후보가 될 수 없다.

