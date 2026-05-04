# 18. Product Engine Orchestrator

## 목적

Product Engine Orchestrator는 Solo Superman Phase 1 세션의 최상위 제품 엔진 계약이다.

이 문서는 사용자의 막연한 아이디어가 `Living Product Spec` 완료 후보와 Founder Brief까지 도달하는 동안, 어떤 command가 어떤 event/state 전이를 만들고 어떤 Queue item을 방출하는지 정의한다.

핵심 결정은 다음과 같다.

- Phase 1의 최상위 상태 전이 주체는 `ProductEngine`이다.
- Spec Engine, Research Engine, Decision Queue, Completeness Scorer, Runtime Adapter는 ProductEngine이 호출하는 판단/산출 모듈이다.
- 각 모듈은 산출물을 만들 수 있지만, 전체 세션 상태와 다음 사용자 행동을 단독으로 확정하지 않는다.
- 모든 event 이후 ProductEngine은 Queue 우선순위를 재계산한다.
- 기본 UX는 현재 active batch를 유지하고, 새 high-priority item은 다음 batch 최상단에 반영한다.

## 범위와 non-goals

포함한다.

- Phase 1 전체 세션 라이프사이클.
- ProductEngine command/event/state 전이 계약.
- 모듈별 입력, 출력, precondition, postcondition, forbidden side effects.
- Queue item 방출과 재스케줄링 규칙.
- 구현 전 QA가 사용할 대표 인수 시나리오.

제외한다.

- 런타임 코드, 앱 scaffold, 실제 orchestrator class 구현.
- DB table, migration, API endpoint, request/response wire shape 상세.
- 화면별 layout, component, micro-interaction 상세.
- ChatGPT 웹 자동화, Browser-use/Playwright 실행, 로그인 자동화 구현.
- Supabase sync, mobile approval, push notification, cloud 운영 설계.

이 문서는 문서 계약이다. 타입명과 상태명은 구현 후보를 안내하지만, DB/API 스키마 상세가 아니다.

## 최상위 invariant

1. **ProductEngine owns transition**: 세션의 다음 상태와 다음 Queue item은 ProductEngine만 확정한다.
2. **Queue reprioritization first**: 답변, 리서치, runtime preview, approval, score 갱신 event가 생기면 ProductEngine은 Queue를 다시 계산한다.
3. **Active batch stability**: 재계산 결과가 바뀌어도 현재 active batch는 기본적으로 유지한다. 새 high-priority item은 다음 batch 최상단으로 보낸다.
4. **Modules do not commit**: Spec Engine, Research Engine, Scorer, Runtime Adapter는 확정 변경을 직접 적용하지 않는다.
5. **Approval gates high impact**: high-impact SpecUpdate와 핵심 Decision은 사용자 승인 전 SpecVersion 원인이 될 수 없다.
6. **Runtime preview is not execution**: Phase 1 RuntimePreviewArtifact는 실제 파일, shell, browser action으로 적용되지 않는다.
7. **Completion is explainable**: CompletionCandidate는 점수뿐 아니라 남은 risk, evidence gate, decision outcome을 설명해야 한다.

## 전체 세션 라이프사이클

```text
ProjectCreated
  -> IntakeCaptured
  -> InitialSpecDrafted
  -> AmbiguityAnalyzed
  -> QuestionBatchActive
  -> AnswerRouted
  -> ResearchOrRuntimePending
  -> EvidenceMatrixReady
  -> DecisionApprovalWaiting
  -> SpecVersionCreated
  -> CompletenessScored
  -> CompletionCandidateReady
  -> FounderBriefReady
```

이 흐름은 선형 waterfall이 아니다. `QuestionBatchActive` 이후에는 답변, 리서치, runtime preview, approval, scoring이 반복된다. 다만 모든 반복은 ProductEngine command/event/state 계약을 통해 traceable해야 한다.

| 단계 | Entry condition | ProductEngine 책임 | 호출 모듈 | Required output | Exit condition |
| --- | --- | --- | --- | --- | --- |
| `ProjectCreated` | raw idea와 privacy mode가 있음 | 프로젝트 세션을 열고 local-first boundary를 고정 | none | Project, Session, initial event | intake 입력 가능 |
| `IntakeCaptured` | raw idea, notes, links가 수집됨 | normalize 대상과 확인할 assumption을 분리 | Spec Generator | normalized idea, assumption list | initial spec 생성 가능 |
| `InitialSpecDrafted` | normalized idea가 있음 | draft임을 표시하고 미검증 claim을 section에 연결 | Spec Generator | Living Product Spec draft | ambiguity 분석 가능 |
| `AmbiguityAnalyzed` | draft 또는 SpecVersion이 있음 | open issue와 confidence axis impact를 정렬 | Ambiguity Analyzer | AmbiguityIssue list | question batch 후보 존재 |
| `QuestionBatchActive` | 질문 후보가 있음 | 3~5개 active batch를 고정하고 activity reason을 남김 | Question Batch Generator, Queue Scheduler | active Question Cards | 답변 수집 가능 |
| `AnswerRouted` | active Question에 Answer가 연결됨 | route outcome을 확정하고 다음 산출 후보를 만든다 | Spec Engine, Research Planner, Decision Graph | AnswerRouteOutcome, candidate outputs | research, decision, update, repeat-limit 중 하나로 수렴 |
| `ResearchOrRuntimePending` | evidence gap 또는 handoff 필요 | ResearchTask 또는 RuntimePreviewArtifact를 Queue item으로 방출 | Research Engine, Runtime Adapter | Research Review Card 또는 Runtime Handoff Card | 결과 import 또는 terminal outcome |
| `EvidenceMatrixReady` | ResearchResult가 도착함 | pro/con/uncertainty와 decision impact를 Queue에 반영 | Evidence Synthesizer | EvidenceMatrix, suggested updates/questions | decision/update/blocker 판단 가능 |
| `DecisionApprovalWaiting` | high-impact 후보 또는 risk acceptance가 필요 | approval card를 만들고 terminal outcome을 요구 | Decision Graph, Approval Manager | Decision status | approve/revise/reject/defer/risk_accepted |
| `SpecVersionCreated` | approved Decision과 적용 가능한 SpecUpdate가 있음 | immutable snapshot 원인을 기록 | Spec Version Manager | SpecVersion | scoring 가능 |
| `CompletenessScored` | spec/evidence/decision/open issue가 갱신됨 | completion 여부와 next best action을 계산 | Completeness Scorer | CompletenessSnapshot, Confidence Map | completion candidate 또는 next batch |
| `CompletionCandidateReady` | completion gates가 통과됨 | 남은 risk와 if-stop-now artifact를 노출 | Completion Scorer, Queue Scheduler | Completion Candidate Card | complete, deeper questions, research reinforcement |
| `FounderBriefReady` | completion 또는 stop-now export 선택 | Founder Brief package를 만든다 | Document Exporter later | Founder Brief draft | 세션 종료 또는 후속 실행 계획 |

## Command/Event/State 계약

ProductEngine은 command를 받으면 다음 순서를 따른다.

```text
command received
  -> validate preconditions
  -> append event
  -> call module services
  -> reduce session state
  -> recalculate queue priority
  -> emit user-visible queue/activity outputs
```

| Command | Preconditions | ProductEngine event | Module calls | State/output | Queue effect | Forbidden shortcut |
| --- | --- | --- | --- | --- | --- | --- |
| `StartProject` | raw idea, privacy mode | `ProjectCreated` | none | Project, Session | Intake prompt 준비 | sync/cloud부터 시작 |
| `CaptureIntake` | Project exists | `IntakeCaptured` | Spec Generator | normalized idea, assumptions | Initial Spec draft activity | assumption을 fact로 확정 |
| `DraftInitialSpec` | normalized idea | `InitialSpecDrafted` | Spec Generator | draft SpecSection set | ambiguity analysis activity | confidence를 높게 초기화 |
| `AnalyzeAmbiguity` | draft 또는 SpecVersion | `AmbiguityAnalyzed` | Ambiguity Analyzer | AmbiguityIssue list | question candidates | 질문 불가능한 표현 문제를 high-risk로 승격 |
| `ActivateQuestionBatch` | open issue와 repeat guard 통과 | `QuestionBatchActivated` | Question Batch Generator, Queue Scheduler | 3~5 active questions | active batch 고정 | 같은 topicKey 다중 질문 삽입 |
| `SubmitAnswer` | active Question | `AnswerSubmitted` | Answer Interpreter | Answer record | active card answered | 답변만으로 high-impact 결정 확정 |
| `RouteAnswer` | Answer record | `AnswerRouted` | Research Planner, Decision Graph, Spec Engine | route outcome | Research/Decision/Update/Conflict/Deferred 후보 | route outcome 없이 다음 단계 진행 |
| `PlanResearch` | `research_needed` 또는 `missing_con_evidence` | `ResearchPlanned` | Research Engine | ResearchTask | Research Review 또는 Handoff 후보 | disclosure 없이 외부 호출 진행 |
| `CreateRuntimePreview` | Codex/manual handoff 필요 | `RuntimePreviewCreated` | Runtime Adapter | RuntimePreviewArtifact | Runtime Handoff/Preview Card | preview를 실제 실행으로 적용 |
| `ImportResearchResult` | ResearchTask or RuntimePreviewArtifact | `ResearchResultImported` | Research Engine | ResearchResult | queue 재계산 | 출처 없는 claim을 evidence로 사용 |
| `SynthesizeEvidence` | ResearchResult | `EvidenceMatrixCreated` | Evidence Synthesizer | EvidenceMatrix | Review/Decision/Conflict 후보 | pro-only high-impact claim을 decision-ready 처리 |
| `SuggestSpecUpdate` | Answer 또는 EvidenceMatrix | `SpecUpdateSuggested` | Spec Engine | SpecUpdate candidate | low-risk summary 또는 approval card | high-impact update 자동 반영 |
| `RequestDecisionApproval` | high-impact update, risk acceptance, conflict | `DecisionApprovalRequested` | Decision Graph, Approval Manager | Decision Approval Card | approval_waiting | 미승인 decision을 SpecVersion 원인으로 사용 |
| `ResolveDecision` | approval card answered | `DecisionResolved` | Approval Manager | approved/rejected/revised/deferred/risk_accepted | queue 재계산 | rejected/deferred로 version 생성 |
| `CreateSpecVersion` | approved decision and applicable update | `SpecVersionCreated` | Spec Version Manager | immutable SpecVersion | scoring activity | working draft만으로 완료 선언 |
| `ScoreCompleteness` | spec/evidence/decision/open issues changed | `CompletenessScored` | Completeness Scorer | CompletenessSnapshot | next batch 또는 Completion Candidate | 점수만으로 completion 생성 |
| `EmitCompletionCandidate` | all completion gates pass | `CompletionCandidateCreated` | Completeness Scorer, Queue Scheduler | CompletionCandidate | Completion Candidate Card | Known Risks 숨김 |
| `ExportFounderBrief` | completion candidate or stop-now export | `FounderBriefExported` | Exporter later | Founder Brief package | terminal or follow-up actions | unresolved risks 제거 |

## 모듈 소유권 맵

| 모듈 | 소유하는 결정 | 만들어도 되는 산출물 | ProductEngine에 반환해야 하는 것 | 금지되는 side effect |
| --- | --- | --- | --- | --- |
| ProductEngine | 세션 상태, event 순서, Queue 재계산, next action | session state, queue state, activity event | n/a | 모듈 결과 없이 임의 spec 확정 |
| Spec Engine | ambiguity 해석, spec update 후보, versioning 재료 | AmbiguityIssue, SpecUpdate, SpecVersion draft material | route candidates, update risk level | high-impact update 확정 반영 |
| Question Batch Generator | 질문 후보 생성과 batch 후보 점수 | Question candidates, batch rationale | confidence impact, repeat count, expected score impact | active batch 단독 교체 |
| Queue Scheduler | 카드 우선순위 산식과 표시 후보 | queued/active/next queue projections | recommended queue ordering | final session state 전이 |
| Research Engine | ResearchTask 계획과 EvidenceMatrix 합성 | ResearchTask, ResearchResult, EvidenceMatrix | pro/con/uncertainty, source quality, blockers | decision approval 우회 |
| Runtime Adapter | Codex/manual handoff preview 산출 | RuntimePreviewArtifact, runtime event summary | preview-only artifact, blocked outcome | file/shell/browser 실행 적용 |
| Decision Graph | Answer, Evidence, Decision, SpecUpdate 관계 | decision candidates, conflict edges | approval requirement, alternatives | 사용자 승인 없이 terminal approve |
| Completeness Scorer | score, confidence map, risk summary 계산 | CompletenessSnapshot, next best actions | completion gate result, weak axes | completion 선언 직접 수행 |
| Approval Manager | 승인 카드의 terminal outcome 기록 | approved/rejected/revised/deferred/risk_accepted | outcome and rationale | high-impact diff 자동 승인 |

## 서비스 계약 수준의 모듈 I/O

### ProductEngine Orchestrator

입력:

- user command: idea, answer, approval, defer, stop-now export.
- module result: research result, runtime preview, evidence matrix, score snapshot.
- current session state: active batch, open issues, decisions, spec draft/version.

출력:

- append-only event summary.
- reduced session state.
- Queue projection: active, next, blocked, deferred.
- Activity Feed explanation.

Precondition:

- command가 Project/Session에 연결되어야 한다.
- command가 참조하는 객체가 current state에서 유효해야 한다.

Postcondition:

- 모든 state 변화는 event와 trace link를 가진다.
- Queue priority가 재계산된다.
- 사용자에게 보이는 다음 행동이 하나 이상 있거나 terminal outcome이 있다.

Forbidden side effects:

- 모듈을 거치지 않은 spec 변경.
- approval 없이 high-impact decision 확정.
- RuntimePreviewArtifact 실제 실행.

### Spec Engine

입력:

- current Spec draft/version.
- AnswerRouteOutcome.
- EvidenceMatrix.
- approved Decision.

출력:

- AmbiguityIssue.
- low-risk SpecUpdate candidate.
- high-impact SpecUpdate candidate.
- SpecVersion material.

Precondition:

- source Answer, EvidenceMatrix, Decision 중 하나 이상과 연결되어야 한다.

Postcondition:

- low-risk update와 high-impact update가 구분된다.
- high-impact update는 Decision Approval Card 후보로 반환된다.

Forbidden side effects:

- Decision 없이 핵심 section 확정.
- 근거 없는 confidence 상승.

### Research Engine

입력:

- AnswerRouteOutcome `research_needed` or `missing_con_evidence`.
- AmbiguityIssue.
- current Spec section and claim.
- allowed data refs and privacy mode.

출력:

- ResearchTask.
- ResearchResult.
- EvidenceMatrix.
- skeptical search summary.

Precondition:

- research 목적과 impacted section이 명시되어야 한다.
- 외부 전송이 필요한 경우 disclosure/approval 상태가 있어야 한다.

Postcondition:

- pro evidence, con evidence, uncertainty, source quality 중 무엇이 부족한지 표시한다.
- high-impact pro-only claim은 `missing_con_evidence` 또는 decision block으로 반환한다.

Forbidden side effects:

- source 없는 claim을 decision-ready로 반환.
- 사용자의 핵심 결정을 대신 확정.

### Queue Scheduler

입력:

- current active batch.
- open Queue item candidates.
- priority factors.
- fatigue/repeat-limit/completion signals.

출력:

- active batch 유지 여부.
- next batch ordering.
- blocked/deferred/dismissed item status.
- Activity Feed reason.

Precondition:

- candidate item은 source event와 affected confidence axis를 가져야 한다.

Postcondition:

- active batch는 기본적으로 유지된다.
- 새 high-priority item은 next batch 최상단에 반영된다.
- question을 새로 만들지 않는 이유도 표시 가능해야 한다.

Forbidden side effects:

- ProductEngine 승인 없이 active batch 교체.
- repeat limit topic을 새 evidence 없이 재활성화.

### Completeness Scorer

입력:

- current Spec state.
- CompletenessSnapshot history.
- EvidenceMatrix set.
- Decision outcomes.
- open/deferred/risk_accepted issues.

출력:

- composite completeness score.
- confidence map.
- weak axes.
- Top Risk candidates.
- completion gate result.

Precondition:

- score에 반영되는 evidence와 decision이 traceable해야 한다.

Postcondition:

- score 상승/하락 이유가 설명된다.
- completion이 차단되면 next best action이 제공된다.

Forbidden side effects:

- 점수만으로 CompletionCandidate 생성.
- missing con evidence 또는 high severity issue 숨김.

### Runtime Adapter

입력:

- RuntimeTaskInput equivalent: task type, prompt, allowed data refs, privacy mode, approval requirement.
- Codex app-server or manual handoff context.

출력:

- RuntimePreviewArtifact.
- blocked outcome.
- import-ready research result template.

Precondition:

- Phase 1 권한은 sandbox preview 또는 manual handoff로 제한된다.
- 실제 file/shell/browser execution은 disabled다.

Postcondition:

- artifact가 어떤 Question, AmbiguityIssue, ResearchTask에서 왔는지 연결된다.
- artifact는 ResearchResult, SpecUpdate candidate, Risk Card, blocked outcome 중 하나로 변환 가능해야 한다.

Forbidden side effects:

- 파일 patch 적용.
- shell command 실행.
- browser action 수행.
- ChatGPT 웹 자동화 실행.

## Queue 방출과 스케줄링 규칙

### 재계산 trigger

ProductEngine은 다음 event 이후 Queue를 재계산한다.

- `AmbiguityAnalyzed`.
- `QuestionBatchActivated`.
- `AnswerSubmitted`.
- `AnswerRouted`.
- `ResearchPlanned`.
- `RuntimePreviewCreated`.
- `ResearchResultImported`.
- `EvidenceMatrixCreated`.
- `SpecUpdateSuggested`.
- `DecisionApprovalRequested`.
- `DecisionResolved`.
- `SpecVersionCreated`.
- `CompletenessScored`.
- `CompletionCandidateCreated`.

### Active batch 안정성

- 현재 active batch는 사용자가 답변 중인 사고 흐름이다.
- ProductEngine은 새 evidence 또는 conflict가 도착해도 active batch를 기본적으로 교체하지 않는다.
- 새 high-priority item은 `queued_next`로 표시하고 다음 batch 최상단에 둔다.
- activity feed는 “다음 batch에 반영됨”을 설명한다.
- 사용자가 현재 batch를 끝내거나 stop-now를 선택하면 ProductEngine은 next batch를 다시 계산해 활성화한다.

### Queue item 방출 규칙

| Source event | Emitted item | Priority hint | Timing | Block condition |
| --- | --- | --- | --- | --- |
| `AmbiguityAnalyzed` | Question Card | severity and core decision impact | first or next batch | repeat limit, no actionable route |
| `AnswerRouted: research_needed` | Research Review Card or Handoff Card | evidence gap severity | next queue or activity pending | privacy disclosure missing |
| `AnswerRouted: missing_con_evidence` | skeptical search item | high for core claims | next queue | existing con evidence sufficient |
| `AnswerRouted: decision_candidate` | Decision Approval Card | high for core decisions | next queue after active batch | missing evidence gate |
| `AnswerRouted: conflict_detected` | Conflict Resolution Card | high | next queue after active batch | conflict already resolved |
| `RuntimePreviewCreated` | Runtime Handoff/Preview Card | risk level and affected axis | next queue or activity pending | Phase 1 execution request blocked |
| `EvidenceMatrixCreated: balanced` | Research Review or SpecUpdate candidate | depends on impacted section | next queue | source quality insufficient |
| `EvidenceMatrixCreated: blocked_by_con_evidence` | Risk/Conflict Card | high | next queue | none |
| `DecisionResolved: approved` | SpecVersion activity | high | immediate activity, score recalculation | trace missing |
| `CompletenessScored: blocked` | Next Question/Research/Approval | weak axis severity | next batch | fatigue intervention active |
| `CompletenessScored: spec_ready` | Completion Candidate Card | terminal | after current batch or stop-now | hidden high severity risk |
| `RepeatLimitReached` | Risk Accepted, research_insufficient, or deferred card | severity-based | next queue | new evidence allows reopening |

## 대표 인수 시나리오

### Scenario 1. 아이디어 -> 초기 Spec -> 첫 배치

Given:

- 사용자가 막연한 아이디어를 입력한다.
- privacy mode는 local-first다.

When:

- ProductEngine이 `StartProject`, `CaptureIntake`, `DraftInitialSpec`, `AnalyzeAmbiguity`, `ActivateQuestionBatch`를 순서대로 처리한다.

Then:

- Initial Spec은 draft로 표시된다.
- 모든 핵심 claim은 verified가 아니라 assumption 또는 unknown으로 표시된다.
- AmbiguityIssue가 SpecSection과 confidence axis에 연결된다.
- 첫 active batch는 3~5개 Question Card다.
- Activity Feed는 왜 이 질문들이 먼저 필요한지 설명한다.

Event trace:

```text
ProjectCreated -> IntakeCaptured -> InitialSpecDrafted -> AmbiguityAnalyzed -> QuestionBatchActivated
```

Expected Queue:

- active: first 3~5 Question Cards.
- next: research or decision 없음.
- blocked: none.

Completion impact:

- CompletionCandidate는 생성되지 않는다.
- Confidence Map은 낮은 초기값과 known risk를 표시한다.

### Scenario 2. 답변 -> 리서치 -> EvidenceMatrix

Given:

- active Question이 primary customer 또는 value proposition gap에 연결되어 있다.
- 사용자가 선택지와 직접 입력으로 답변한다.

When:

- ProductEngine이 `SubmitAnswer`와 `RouteAnswer`를 처리한다.
- route outcome이 `research_needed` 또는 `missing_con_evidence`다.
- ResearchResult가 import되고 EvidenceMatrix가 만들어진다.

Then:

- Answer는 linked Question, AmbiguityIssue, topicKey를 가진다.
- ResearchTask는 source intent와 impacted section을 가진다.
- EvidenceMatrix는 pro/con/uncertainty와 source quality를 표시한다.
- ProductEngine은 Queue를 재계산하지만 현재 active batch는 유지한다.
- 새 Research Review Card 또는 Decision candidate는 다음 batch 최상단 후보가 된다.

Event trace:

```text
AnswerSubmitted -> AnswerRouted -> ResearchPlanned -> ResearchResultImported -> EvidenceMatrixCreated -> QueueRecalculated
```

Expected Queue:

- active: 기존 batch 유지.
- queued_next: Research Review Card or Decision Approval Card.
- activity: “리서치 결과가 다음 batch에 반영됨”.

Completion impact:

- evidence gap이 줄면 관련 confidence axis가 상승할 수 있다.
- con evidence가 없으면 high-impact decision은 아직 ready가 아니다.

### Scenario 3. 반대근거/충돌 -> Decision 차단

Given:

- 사용자가 특정 MVP 범위 또는 고객 세그먼트를 강하게 선호한다.
- Research Engine이 강한 반대근거 또는 기존 Spec 충돌을 발견한다.

When:

- EvidenceMatrix 상태가 `blocked_by_con_evidence` 또는 route outcome이 `conflict_detected`가 된다.

Then:

- ProductEngine은 DecisionApproval Card를 바로 ready로 표시하지 않는다.
- Conflict Resolution Card 또는 Risk Card를 다음 batch 최상단 후보로 둔다.
- SpecUpdate는 high-impact approval 전까지 working draft의 추천안 또는 가설 상태로 남는다.
- Completion Scorer는 해당 axis를 block 또는 low confidence로 표시한다.

Event trace:

```text
EvidenceMatrixCreated -> ConflictDetected -> QueueRecalculated -> CompletionScored(blocked)
```

Expected Queue:

- active: 기존 batch 유지.
- queued_next: Conflict Resolution Card or Risk Card.
- blocked: Decision approval until conflict is resolved, revised, deferred, or risk accepted.

Completion impact:

- hidden risk 없이 Known Risks에 반영된다.
- risk accepted 없이 Spec-ready 후보가 될 수 없다.

### Scenario 4. RuntimePreview/Handoff 반환

Given:

- ResearchTask가 deep research prompt 또는 Codex sandbox preview를 필요로 한다.
- Phase 1 권한은 sandbox preview 또는 manual handoff뿐이다.

When:

- Runtime Adapter가 RuntimePreviewArtifact를 반환한다.
- 사용자가 handoff 결과를 import하거나 preview를 SpecUpdate candidate로 변환한다.

Then:

- artifact는 preview-only marker를 가진다.
- file patch, shell command, browser action은 적용되지 않는다.
- artifact는 ResearchResult, SpecUpdate candidate, Risk Card, blocked outcome 중 하나로 변환된다.
- ProductEngine은 Queue를 재계산하고 active batch를 유지한다.

Event trace:

```text
ResearchPlanned -> RuntimePreviewCreated -> RuntimePreviewConverted -> ResearchResultImported or SpecUpdateSuggested -> QueueRecalculated
```

Expected Queue:

- active: 기존 batch 유지.
- queued_next: Runtime Handoff/Preview Card, Research Review Card, or Decision Approval Card.
- blocked: any execution request in Phase 1.

Completion impact:

- import된 근거가 EvidenceMatrix에 연결되기 전에는 score를 확정 상승시키지 않는다.
- high-impact preview는 approval gate를 거친다.

### Scenario 5. 반복 제한 -> 수렴/보류

Given:

- 같은 `topicKey`에서 질문이 3회 사용되었다.
- 새 evidence 없이 4번째 질문 후보가 생성된다.

When:

- ProductEngine이 `RepeatLimitReached`를 발생시킨다.

Then:

- 새 Question Card는 생성되지 않는다.
- high severity는 Risk Accepted Approval Card 또는 research_needed로 수렴한다.
- medium severity는 research_insufficient 또는 research_needed로 수렴한다.
- low severity는 deferred/Open Questions로 이동한다.
- Queue는 “더 묻지 않는 이유”를 표시한다.

Event trace:

```text
QuestionCandidateGenerated -> RepeatLimitReached -> QueueRecalculated -> RiskAcceptedRequested or ResearchInsufficient or Deferred
```

Expected Queue:

- active: 기존 batch 유지.
- queued_next: severity별 수렴 카드.
- dismissed: duplicate 4th question.

Completion impact:

- high severity는 risk accepted 또는 blocker 처리 전까지 completion gate를 막는다.
- medium/low는 Known Risks와 Next Validation Actions에 남을 수 있다.

### Scenario 6. Spec-ready 후보 -> Founder Brief

Given:

- 모든 confidence axis가 threshold를 통과한다.
- high severity issue가 resolved, risk_accepted, 또는 명시적 blocker로 분류되어 있다.
- high-impact claim이 pro-only로 남아 있지 않다.
- 핵심 Decision type이 승인되었거나 Known Risks에 명시되어 있다.

When:

- ProductEngine이 `ScoreCompleteness`와 `EmitCompletionCandidate`를 처리한다.

Then:

- Completion Candidate Card가 생성된다.
- Founder Brief draft에는 problem/customer/value, top decisions, known risks, next validation actions가 포함된다.
- 사용자는 complete, deeper questions, research reinforcement, Founder Brief export 중 하나를 선택할 수 있다.
- 남은 risk는 숨겨지지 않는다.

Event trace:

```text
SpecVersionCreated -> CompletenessScored(spec_ready) -> CompletionCandidateCreated -> FounderBriefExported
```

Expected Queue:

- active: 현재 batch가 끝났거나 stop-now가 선택된 뒤 Completion Candidate Card.
- queued_next: optional deeper questions or research reinforcement.
- blocked: hidden high severity risk, missing con evidence, approval waiting.

Completion impact:

- 완료는 “모든 질문이 사라짐”이 아니라 “남은 리스크를 알고 시작 가능함”이다.

## 기존 문서와의 관계

- `04-decision-queue.md`는 사용자가 보는 카드 유형, priority score, batch UX를 책임진다.
- `05-spec-engine.md`는 Spec 중심 상태머신과 module 설명을 책임진다.
- `06-research-engine.md`는 research need, evidence matrix, deep research routing을 책임진다.
- `07-completeness-scoring.md`는 composite score와 confidence map 산식을 책임진다.
- `09-system-architecture.md`는 ProductEngine이 들어갈 Application Core와 Runtime Adapter boundary를 책임진다.
- `16-state-event-contract.md`는 객체 간 trace link와 terminal outcome의 source of truth다.
- `17-ai-runtime-access-strategy.md`는 Codex app-server, manual handoff, browser automation keepout을 책임진다.

## 구현 전 검증 체크리스트

- ProductEngine이 아닌 모듈이 세션 상태를 직접 확정하는 문장이 없는가.
- Queue 재계산 trigger가 모든 핵심 event에 연결되어 있는가.
- active batch 안정성과 next batch 재정렬 정책이 충돌하지 않는가.
- RuntimePreviewArtifact가 실행으로 오해될 수 있는 표현이 없는가.
- high-impact update와 핵심 decision이 approval gate를 거치는가.
- 6개 대표 시나리오가 event trace, queue 변화, spec/score/completion 영향을 모두 가진다.
