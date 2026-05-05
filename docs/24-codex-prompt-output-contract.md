# 24. Codex Prompt/Output Contract

## 목적

이 문서는 Phase 1의 `CodexRuntimeAdapter`가 Codex app-server 또는 manual handoff 경로를 통해 생성하는 prompt input, JSON output, parse/repair, artifact conversion, auto-apply, approval/block routing 계약을 고정한다.

`17-ai-runtime-access-strategy.md`가 AI 접근 전략과 권한 경계를 정의하고, `21-sidecar-api-runtime-contract.md`가 Hono/runtime route 경계를 정의하며, `23-product-engine-runtime-contract.md`가 `codex_runtime_preview_effect` 실행 모델을 정의한다면, 이 문서는 **Codex에게 무엇을 입력하고 어떤 구조의 출력을 받아 ProductEngine에 넘길지**의 canonical source다.

이 문서는 Codex Prompt/Output의 기준 계약이다. 런타임 코드, Zod schema 파일, Hono handler, Codex adapter, DB migration은 각 구현 PR과 현재 코드베이스가 소유하며, 이 문서는 turnPurpose/input/output/repair/failure taxonomy 경계를 정의한다.

Canonical path: `docs/24-codex-prompt-output-contract.md`.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Canonical source | Codex prompt/input/output/schema/repair/artifact 계약은 이 문서가 소유 |
| Contracts bridge | 25번 문서가 turnPurpose, artifact kind, applyPolicy, blocked action taxonomy re-export를 소유 |
| Phase 1 권한 | preview/spec/research 중심. 파일, shell, browser, network, credential, destructive action 실행 금지 |
| Phase 1.5B execution-readiness hints | 별도 phase. Phase 1에는 `phase15bUpgradeHints`와 blocked action taxonomy만 남김 |
| TurnPurpose | 6개 전부 1급 schema |
| Input context | `CoreContextPack` + turnPurpose별 `DeltaContextPack` |
| Output envelope | Hybrid trace + artifact envelope |
| Output format | JSON-first. 자연어는 JSON 내부 필드에만 허용 |
| Schema detail | 필드 표, required/optional, validation rule, target object, applyPolicy default, 예시 JSON skeleton까지 고정 |
| Repair pipeline | deterministic parser repair 1회 -> Codex self-repair 1회 -> severity별 실패 노출 |
| Artifact taxonomy | 7개 1급 artifact kind만 허용 |
| applyPolicy | 6개 enum만 허용 |
| Unknown kind/policy | `validation_failed`로 처리하고 severity routing에 따른 카드/Activity 생성 |
| 저위험 자동 반영 | 질문 배치, ambiguity/confidence projection, research prompt task, 조건 통과 evidence, implementation planning note |
| 고위험 gate | 결론 변경 evidence, 약한/불균형 evidence, 질문 반복/피로 위험 |

## Non-negotiable Phase 1 boundary

Phase 1에서 Codex는 다음을 할 수 있다.

- 제품 세션 상태를 읽고 질문, 리서치 프롬프트, evidence synthesis, spec update preview, implementation plan preview를 생성한다.
- `RuntimePreviewArtifact`, queue projection, planning note, manual handoff prompt, blocked action card를 만든다.
- 저위험 artifact를 ProductEngine command/effect completion을 통해 자동 반영한다.
- Phase 1.5B에서 실행 준비 정보로 재사용할 수 있는 `phase15bUpgradeHints`를 preview artifact에 보존한다.

Phase 1에서 Codex는 다음을 할 수 없다.

- repo 파일을 수정한다.
- shell command를 실행한다.
- browser action을 수행한다.
- ChatGPT 웹 UI를 자동 조작한다.
- credential, token, user account session을 가져오거나 저장한다.
- external service에 write action을 수행한다.
- `SpecVersion`을 직접 생성한다.
- implementation task commitment를 직접 확정한다.

## TurnPurpose taxonomy

Phase 1에서 허용되는 Codex turnPurpose는 다음 6개뿐이다.

| turnPurpose | Primary output artifact | Default applyPolicy | ProductEngine target | Notes |
| --- | --- | --- | --- | --- |
| `question_generation` | `QuestionBatchArtifact` | `auto_apply` | Decision Queue question cards | 3-5개 질문 배치를 생성하되 fatigue/repeat guard를 포함해야 함 |
| `ambiguity_analysis` | `AmbiguityAnalysisArtifact` | `auto_apply` | Completeness/Confidence projection | Spec 자체를 바꾸지 않고 낮은 신뢰 축과 next focus를 갱신 |
| `research_prompt` | `ResearchPromptArtifact` | `auto_apply` | ResearchTask or ManualHandoffPrompt | Phase 1은 외부 browser automation 없이 task/prompt만 생성 |
| `evidence_synthesis` | `EvidenceSynthesisArtifact` | `conditional_auto_apply` | EvidenceMatrix or Review/Risk card | quality/pro-con/source/impact gate를 통과해야 자동 반영 |
| `spec_update_preview` | `SpecUpdatePreviewArtifact` | `approval_required` | SpecUpdate candidate | Living Spec 직접 변경 금지 |
| `implementation_plan_preview` | `ImplementationPlanPreviewArtifact` or `BlockedActionArtifact` | `note_only` | PlanningNote or BlockedAction card | Phase 1.5B readiness hints는 저장하지만 실행하지 않음 |

## Input contract overview

모든 Codex turn은 다음 구조의 input JSON을 받는다.

```json
{
  "schemaVersion": "solo-superman.codex-input.v1",
  "turnPurpose": "question_generation",
  "trace": {
    "projectId": "project_demo_001",
    "sessionId": "session_demo_001",
    "sourceEventIds": ["event_001"],
    "sourceIssueIds": ["ambiguity_problem_001"],
    "idempotencyKey": "question_generation:abc123",
    "runtimeAdapterVersion": "codex-runtime-adapter-v1"
  },
  "core": {},
  "delta": {}
}
```

### CoreContextPack

`CoreContextPack`은 모든 turnPurpose에 공통으로 들어간다. 구현자는 turnPurpose별로 core field를 임의로 빼지 않는다. token budget 때문에 축약이 필요할 때도 field key는 유지하고 `summary`, `truncated`, `sourceRefs`로 축약 사실을 남긴다.

| Field | Required | Type | Validation rule | Purpose |
| --- | --- | --- | --- | --- |
| `project` | yes | object | `id`, `name`, `createdAt` 필요 | 프로젝트 trace |
| `session` | yes | object | `id`, `mode`, `startedAt`, `phase` 필요 | 세션 trace |
| `currentSpec` | yes | object | `specVersionId` 또는 `draftId` 필요 | 현재 Living Product Spec snapshot |
| `confirmedDecisions` | yes | array | 최신순 최대 20개, 각 항목은 `decisionId`, `summary`, `impactArea` 필요 | 이미 확정된 결정 재질문 방지 |
| `openAmbiguityIssues` | yes | array | active/open issue만 포함 | 질문/분석 대상 |
| `confidenceMap` | yes | object | `problem`, `customer`, `valueProp`, `validation`, `implementation` 축 포함 | 완성도와 낮은 축 추적 |
| `knownRisks` | yes | array | top risk 우선, 최대 10개 | 반복 질문과 리스크 카드 연결 |
| `recentQuestionHistory` | yes | array | 최근 3개 batch 또는 최근 15개 question | repeat/fatigue guard |
| `recentResearchSummary` | yes | array | sourceRefs 포함 | evidence synthesis와 research planning 근거 |
| `policy` | yes | object | Phase 1 permission, applyPolicy enum, blocked taxonomy 포함 | Codex 권한 경계 주입 |
| `outputContract` | yes | object | expected artifact kind와 applyPolicy default 포함 | JSON output self-check |

### DeltaContextPack summary

| turnPurpose | Delta field | Required | Purpose |
| --- | --- | --- | --- |
| `question_generation` | `questionTargets` | yes | 이번 배치가 해결해야 할 ambiguity/risk axes |
| `question_generation` | `batchConstraints` | yes | 3-5개, no three repeats, fatigue rules |
| `ambiguity_analysis` | `analysisTargets` | yes | 점검할 spec section, evidence, answers |
| `research_prompt` | `researchNeed` | yes | 리서치 질문, expected evidence type, handoff format |
| `evidence_synthesis` | `researchResult` | yes | imported result, source snippets, source metadata |
| `spec_update_preview` | `updateTarget` | yes | spec section, proposed decision, evidence refs |
| `implementation_plan_preview` | `implementationTarget` | yes | spec-ready section, requested handoff/dry-run depth |

## Output envelope contract

모든 Codex turn은 다음 hybrid trace + artifact envelope를 반환한다.

```json
{
  "schemaVersion": "solo-superman.codex-output.v1",
  "turnPurpose": "question_generation",
  "trace": {
    "projectId": "project_demo_001",
    "sessionId": "session_demo_001",
    "sourceEventIds": ["event_001"],
    "sourceIssueIds": ["ambiguity_problem_001"],
    "idempotencyKey": "question_generation:abc123",
    "runtimeAdapterVersion": "codex-runtime-adapter-v1",
    "codexThreadId": "thread_demo_001",
    "codexTurnId": "turn_demo_001"
  },
  "summary": "문제 정의 축의 고객 세그먼트 불확실성을 줄이기 위한 질문 배치입니다.",
  "confidence": {
    "selfRated": 0.74,
    "reason": "confirmed decisions와 open ambiguity issues가 충분하지만 고객 인터뷰 evidence는 부족합니다."
  },
  "artifacts": []
}
```

### Envelope fields

| Field | Required | Type | Validation rule | Notes |
| --- | --- | --- | --- | --- |
| `schemaVersion` | yes | string | exactly `solo-superman.codex-output.v1` | incompatible이면 validation failure |
| `turnPurpose` | yes | enum | 6개 허용 turnPurpose 중 하나 | input turnPurpose와 일치해야 함 |
| `trace` | yes | object | 아래 trace field 필요 | ProductEngine/event/effect 추적 |
| `summary` | yes | string | 40-600 chars | UI summary와 Activity Feed에 사용 |
| `confidence` | yes | object | `selfRated` 0-1, `reason` 필요 | Codex self confidence이며 제품 score와 동일하지 않음 |
| `artifacts` | yes | array | 1-5개. 모든 kind는 허용 taxonomy 안에 있어야 함 | unknown kind 금지 |
| `warnings` | no | array | known limitation만 허용 | warning은 blocked action을 대체하지 못함 |

### Trace fields

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `projectId` | yes | string | input과 일치 |
| `sessionId` | yes | string | input과 일치 |
| `sourceEventIds` | yes | string[] | empty 허용, input subset 또는 equal |
| `sourceIssueIds` | yes | string[] | empty 허용, input subset 또는 equal |
| `idempotencyKey` | yes | string | `turnPurpose + contextHash + runtimeAdapterVersion` 기반 |
| `runtimeAdapterVersion` | yes | string | sidecar adapter version |
| `codexThreadId` | no | string | Codex app-server 사용 시 필요 |
| `codexTurnId` | no | string | Codex app-server 사용 시 필요 |
| `manualHandoffId` | no | string | manual handoff import일 때 필요 |

## Artifact common fields

모든 artifact는 다음 공통 필드를 가진다.

| Field | Required | Type | Validation rule | Notes |
| --- | --- | --- | --- | --- |
| `artifactId` | yes | string | local unique id or deterministic generated id | effect outputRef 대상 |
| `kind` | yes | enum | 7개 artifact kind 중 하나 | unknown kind 금지 |
| `title` | yes | string | 8-120 chars | card title |
| `summary` | yes | string | 40-800 chars | user-visible summary |
| `applyPolicy` | yes | enum | 6개 applyPolicy 중 하나 | 아래 applyPolicy table 참조 |
| `riskLevel` | yes | enum | `low`, `medium`, `high`, `blocked` | approval/severity routing |
| `targetObject` | yes | enum | `queue`, `confidence_projection`, `research_task`, `evidence_matrix`, `spec_update`, `planning_note`, `blocked_action`, `activity_only` | ProductEngine 변환 대상 |
| `sourceRefs` | yes | array | confirmed decision, ambiguity issue, research source, event id 참조 | traceability |
| `requiredApprovals` | yes | array | none이면 empty array | Phase 1.5B readiness field와 공유 가능 |
| `phase15bUpgradeHints` | no | object | preview-only. 실행 금지 | Phase 1.5B/Phase 2+ migration 대비 |

## applyPolicy enum

| applyPolicy | Meaning | Allowed targetObject | Phase 1 behavior |
| --- | --- | --- | --- |
| `auto_apply` | 검증 통과 시 자동 반영 | `queue`, `confidence_projection`, `research_task` | effect completion command가 projection/task를 생성 |
| `conditional_auto_apply` | gate 통과 시 자동 반영 | `evidence_matrix` | gate 실패 시 review/risk/follow-up card |
| `note_only` | 읽기용 note만 저장 | `planning_note`, `activity_only` | task commitment 금지 |
| `approval_required` | 사용자 Decision/Approval 필요 | `spec_update`, `evidence_matrix`, `planning_note` | preview/candidate만 저장 |
| `blocked` | Phase 1 금지 또는 safety block | `blocked_action` | 실제 실행 금지, blocked card 생성 |
| `manual_handoff_required` | 사용자 외부 입력 필요 | `research_task`, `activity_only` | handoff prompt/card 생성 |

Unknown applyPolicy는 `validation_failed`로 처리한다.

## Artifact field contracts

### QuestionBatchArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = QuestionBatchArtifact`, `applyPolicy = auto_apply`, `targetObject = queue` |
| `questions` | yes | array | 3-5개 |
| `questions[].questionId` | yes | string | deterministic or temporary id |
| `questions[].topicKey` | yes | string | ambiguity issue나 confidence axis와 연결 |
| `questions[].questionText` | yes | string | Korean-first, direct, one decision per question |
| `questions[].whyThisMatters` | yes | string | 사용자가 왜 답해야 하는지 설명 |
| `questions[].answerType` | yes | enum | `single_choice`, `multi_choice`, `free_text`, `ranked_choice` |
| `questions[].options` | no | array | choice type일 때 2-5개 |
| `questions[].routingHints` | yes | object | answer to research/spec/next question hints |
| `fatigueGuard` | yes | object | `repeatCount`, `shouldSummarizeInstead`, `reason` |
| `priority` | yes | object | `score`, `axis`, `reason` |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_question_batch_001",
  "kind": "QuestionBatchArtifact",
  "title": "문제-고객 축 질문 배치",
  "summary": "초기 창업자의 문제 정의와 고객 세그먼트 가설을 분리하기 위한 3개 질문입니다.",
  "applyPolicy": "auto_apply",
  "riskLevel": "low",
  "targetObject": "queue",
  "sourceRefs": [{ "type": "ambiguityIssue", "id": "amb_problem_001" }],
  "requiredApprovals": [],
  "questions": [
    {
      "questionId": "q_customer_001",
      "topicKey": "customer_segment",
      "questionText": "가장 먼저 좁혀야 할 고객 세그먼트는 누구인가요?",
      "whyThisMatters": "고객 세그먼트가 정해져야 리서치와 MVP 범위가 흔들리지 않습니다.",
      "answerType": "single_choice",
      "options": [
        { "label": "초기 1인 창업자", "value": "solo_founder" },
        { "label": "초기 공동창업팀", "value": "small_founder_team" }
      ],
      "routingHints": { "ifAnswered": "update_customer_confidence" }
    }
  ],
  "fatigueGuard": { "repeatCount": 0, "shouldSummarizeInstead": false, "reason": "새 topic입니다." },
  "priority": { "score": 0.86, "axis": "customer", "reason": "customer confidence가 낮습니다." }
}
```

### AmbiguityAnalysisArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = AmbiguityAnalysisArtifact`, `applyPolicy = auto_apply`, `targetObject = confidence_projection` |
| `axisScores` | yes | object | 5축: problem, customer, valueProp, validation, implementation |
| `confidenceDelta` | yes | object | axis별 -1 to 1 |
| `lowConfidenceAxes` | yes | array | empty 허용 |
| `topRisks` | yes | array | 최대 3개 |
| `nextFocusRecommendation` | yes | object | axis, reason, suggestedTurnPurpose |
| `stopReadiness` | yes | object | all axes threshold 여부 |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_ambiguity_001",
  "kind": "AmbiguityAnalysisArtifact",
  "title": "신뢰도 분석",
  "summary": "problem/customer 축은 개선되었지만 validation evidence가 부족합니다.",
  "applyPolicy": "auto_apply",
  "riskLevel": "low",
  "targetObject": "confidence_projection",
  "sourceRefs": [{ "type": "answer", "id": "answer_001" }],
  "requiredApprovals": [],
  "axisScores": { "problem": 0.78, "customer": 0.71, "valueProp": 0.67, "validation": 0.42, "implementation": 0.62 },
  "confidenceDelta": { "problem": 0.08, "customer": 0.04, "valueProp": 0.01, "validation": 0.0, "implementation": 0.0 },
  "lowConfidenceAxes": ["validation"],
  "topRisks": [{ "riskId": "risk_validation_001", "summary": "검증 실험이 아직 관찰 가능한 행동으로 정의되지 않았습니다." }],
  "nextFocusRecommendation": { "axis": "validation", "reason": "증거 축이 75점 미만입니다.", "suggestedTurnPurpose": "research_prompt" },
  "stopReadiness": { "allAxesAboveThreshold": false, "threshold": 0.75 }
}
```

### ResearchPromptArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = ResearchPromptArtifact`, `applyPolicy = auto_apply` or `manual_handoff_required`, `targetObject = research_task` |
| `researchQuestions` | yes | array | 1-5개 |
| `handoffPrompt` | yes | string | ChatGPT/Codex에 붙여넣을 수 있는 완성 prompt |
| `expectedSources` | yes | array | source quality expectation |
| `importTemplate` | yes | object | answer/result pasteback fields |
| `successCriteria` | yes | array | evidence gate 통과 기준 |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_research_prompt_001",
  "kind": "ResearchPromptArtifact",
  "title": "대체재 리서치 프롬프트",
  "summary": "초기 창업자가 현재 쓰는 대체재와 구매/시간 투입 신호를 확인하기 위한 리서치 프롬프트입니다.",
  "applyPolicy": "auto_apply",
  "riskLevel": "low",
  "targetObject": "research_task",
  "sourceRefs": [{ "type": "ambiguityIssue", "id": "amb_competition_001" }],
  "requiredApprovals": [],
  "researchQuestions": ["초기 창업자가 아이디어 검증에 쓰는 대체재는 무엇인가요?"],
  "handoffPrompt": "다음 제품 가설에 대해 대체재와 구매/시간 투입 신호를 조사해주세요...",
  "expectedSources": [{ "sourceType": "public_web", "qualityExpectation": "최근 24개월 이내의 직접 사례 우선" }],
  "importTemplate": { "requiredFields": ["claims", "sources", "counterEvidence", "openQuestions"] },
  "successCriteria": ["pro evidence와 con evidence가 모두 있어야 합니다."]
}
```

### EvidenceSynthesisArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = EvidenceSynthesisArtifact`, `applyPolicy = conditional_auto_apply`, `targetObject = evidence_matrix` |
| `claims` | yes | array | 각 claim은 sourceRefs 필요 |
| `proEvidence` | yes | array | empty면 gate fail |
| `conEvidence` | yes | array | empty면 `missing_con_evidence` |
| `sourceQuality` | yes | object | score 0-1, reason |
| `balanceCheck` | yes | object | pro/con 균형 결과 |
| `impactAssessment` | yes | object | conclusionChanging boolean 포함 |
| `gateResult` | yes | enum | `pass`, `review_required`, `blocked` |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_evidence_001",
  "kind": "EvidenceSynthesisArtifact",
  "title": "창업자 검증 대체재 evidence",
  "summary": "대체재 사용 신호는 있으나 반대 근거가 부족해 review가 필요합니다.",
  "applyPolicy": "conditional_auto_apply",
  "riskLevel": "medium",
  "targetObject": "evidence_matrix",
  "sourceRefs": [{ "type": "researchResult", "id": "research_result_001" }],
  "requiredApprovals": [{ "approvalType": "evidence_review", "reason": "conEvidence가 부족합니다." }],
  "claims": [{ "claimId": "claim_001", "text": "초기 창업자는 검증 도구를 조합해서 사용합니다.", "sourceRefIds": ["src_001"] }],
  "proEvidence": [{ "sourceRefId": "src_001", "summary": "검증 체크리스트 사용 사례가 확인됩니다." }],
  "conEvidence": [],
  "sourceQuality": { "score": 0.62, "reason": "공식 통계보다 블로그/커뮤니티 사례 중심입니다." },
  "balanceCheck": { "hasPro": true, "hasCon": false, "status": "missing_con_evidence" },
  "impactAssessment": { "conclusionChanging": false, "affectedAxes": ["validation"] },
  "gateResult": "review_required"
}
```

### SpecUpdatePreviewArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = SpecUpdatePreviewArtifact`, `applyPolicy = approval_required`, `targetObject = spec_update` |
| `targetSection` | yes | string | Living Product Spec section id |
| `beforeSummary` | yes | string | 현재 spec 요약 |
| `afterSummary` | yes | string | 제안 후 요약 |
| `changeRationale` | yes | string | sourceRefs 기반 설명 |
| `impactLevel` | yes | enum | `low`, `medium`, `high` |
| `requiresDecision` | yes | boolean | true이면 Decision Gate 필요 |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_spec_update_001",
  "kind": "SpecUpdatePreviewArtifact",
  "title": "고객 세그먼트 문구 수정 제안",
  "summary": "초기 창업자 중 '검증 실험을 아직 구조화하지 못한 사람'으로 세그먼트를 좁히는 제안입니다.",
  "applyPolicy": "approval_required",
  "riskLevel": "medium",
  "targetObject": "spec_update",
  "sourceRefs": [{ "type": "evidence", "id": "evidence_001" }],
  "requiredApprovals": [{ "approvalType": "spec_update", "reason": "고객 세그먼트 정의가 바뀝니다." }],
  "targetSection": "customer_segment",
  "beforeSummary": "초기 창업자 전반",
  "afterSummary": "검증 실험을 구조화하지 못한 초기 창업자",
  "changeRationale": "최근 답변과 리서치가 더 좁은 세그먼트를 지지합니다.",
  "impactLevel": "medium",
  "requiresDecision": true
}
```

### ImplementationPlanPreviewArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = ImplementationPlanPreviewArtifact`, `applyPolicy = note_only`, `targetObject = planning_note` |
| `implementationSteps` | yes | array | no direct execution |
| `prSequence` | yes | array | suggested only |
| `dryRunHandoff` | yes | object | handoff text and expected outputs |
| `risks` | yes | array | implementation risk notes |
| `phase15bUpgradeHints` | yes | object | executionIntent, requiredApprovals, riskLevel, sandboxRequirements |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_impl_plan_001",
  "kind": "ImplementationPlanPreviewArtifact",
  "title": "Phase 1 구현 계획 preview",
  "summary": "Codex 계약 구현을 위한 schema, adapter, fixture 순서 제안입니다. Phase 1에서는 실행하지 않고 planning note로 저장합니다.",
  "applyPolicy": "note_only",
  "riskLevel": "low",
  "targetObject": "planning_note",
  "sourceRefs": [{ "type": "specSection", "id": "codex_prompt_output_contract" }],
  "requiredApprovals": [],
  "implementationSteps": ["contracts package에 Zod schema 추가", "Codex adapter fixture parser 추가"],
  "prSequence": [{ "prId": "PR-07", "summary": "Codex preview adapter 구현" }],
  "dryRunHandoff": { "handoffText": "이 계획은 preview이며 실행하지 않습니다.", "expectedOutputs": ["schema tests", "fixture tests"] },
  "risks": [{ "riskId": "risk_schema_drift", "summary": "Codex generated schema와 내부 schema 불일치 가능성" }],
  "phase15bUpgradeHints": {
    "executionIntent": "candidate_only",
    "requiredApprovals": ["project_level_delegation", "workspace_sandbox_ready"],
    "riskLevel": "medium",
    "sandboxRequirements": ["isolated_worktree", "command_allowlist", "rollback_reference"]
  }
}
```

### BlockedActionArtifact

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| common fields | yes | object | `kind = BlockedActionArtifact`, `applyPolicy = blocked`, `targetObject = blocked_action` |
| `blockedActionType` | yes | enum | taxonomy below |
| `requestedActionSummary` | yes | string | requested action 요약 |
| `blockReason` | yes | string | Phase 1 boundary 위반 이유 |
| `userVisibleAction` | yes | enum | `manual_handoff`, `ignore`, `phase1_5b_candidate`, `revise_prompt` |
| `phase15bUpgradeHints` | yes | object | required approvals/sandbox requirements |

Example JSON skeleton:

```json
{
  "artifactId": "artifact_blocked_001",
  "kind": "BlockedActionArtifact",
  "title": "Shell 실행 요청 차단",
  "summary": "Codex가 테스트 명령 실행을 제안했지만 Phase 1 제품 기능에서는 shell 실행을 수행하지 않습니다.",
  "applyPolicy": "blocked",
  "riskLevel": "blocked",
  "targetObject": "blocked_action",
  "sourceRefs": [{ "type": "codexTurn", "id": "turn_demo_001" }],
  "requiredApprovals": [{ "approvalType": "phase1_5b_delegation", "reason": "실행 준비 metadata는 Phase 1.5B 범위이며 실제 실행은 Phase 3 Safe Execution Adapter (Controlled Execution) 단계입니다." }],
  "blockedActionType": "shell_command",
  "requestedActionSummary": "pnpm test -- --run runtime 실행 제안",
  "blockReason": "Phase 1은 RuntimePreviewArtifact만 생성하고 shell command를 실행하지 않습니다.",
  "userVisibleAction": "phase1_5b_candidate",
  "phase15bUpgradeHints": {
    "executionIntent": "shell_command_preview",
    "requiredApprovals": ["project_level_delegation", "command_allowlist"],
    "riskLevel": "medium",
    "sandboxRequirements": ["isolated_worktree", "audit_log", "rollback_reference"]
  }
}
```

## Blocked action taxonomy

| blockedActionType | Examples | Phase 1 output | Phase 1.5B hint |
| --- | --- | --- | --- |
| `file_patch` | edit repo files, create migration, write config | `BlockedActionArtifact` | isolated worktree, diff preview, rollback reference |
| `shell_command` | run tests, install packages, execute script | `BlockedActionArtifact` | command allowlist, timeout, audit log |
| `browser_action` | click/type/submit in browser | `BlockedActionArtifact` | browser sandbox, user approval, replay log |
| `network_write` | POST to external API, create cloud resource | `BlockedActionArtifact` | explicit credential scope, dry-run proof |
| `credential_access` | read API key, use ChatGPT session outside allowed path | `BlockedActionArtifact` | explicit secret grant and revocation |
| `destructive_operation` | delete files, reset DB, force push | `BlockedActionArtifact` | separate high-risk approval, rollback plan |
| `chatgpt_web_automation` | automate ChatGPT Pro web UI | `BlockedActionArtifact` | Phase 2+ only, policy review required |

## Auto-apply and gate matrix

| Artifact | Auto behavior | Gate behavior |
| --- | --- | --- |
| `QuestionBatchArtifact` | automatically adds queue candidates | fatigue/repeat limit creates summarize/convergence card instead |
| `AmbiguityAnalysisArtifact` | automatically updates confidence/completeness projection | cannot directly change SpecVersion |
| `ResearchPromptArtifact` | automatically creates ResearchTask or handoff-ready prompt | external browser automation remains blocked |
| `EvidenceSynthesisArtifact` | conditionally writes EvidenceMatrix when quality gate passes | conclusion-changing, weak source, missing con evidence routes to review/risk/follow-up |
| `SpecUpdatePreviewArtifact` | stores preview/candidate | Living Spec change requires approval |
| `ImplementationPlanPreviewArtifact` | stores PlanningNote | implementation commitment is Phase 2; execution is Phase 3+; Phase 1.5B stores readiness hints only |
| `BlockedActionArtifact` | stores blocked card | never executes in Phase 1 |

## Parse, repair, and validation pipeline

`codex_runtime_preview_effect` executor follows this sequence.

```text
1. Build CoreContextPack + DeltaContextPack.
2. Invoke Codex turn with expected schemaVersion, turnPurpose, artifact kind, and applyPolicy hints.
3. Parse JSON.
4. If parse fails, run deterministic parser repair once.
5. Validate against turnPurpose output schema.
6. If parse or validation still fails, run Codex self-repair once with original output and validation errors.
7. Validate repaired JSON.
8. If validation passes, persist RuntimePreviewArtifact/artifacts and route applyPolicy.
9. If validation fails, emit failure by severity.
```

Deterministic parser repair may only do the following:

- extract a single fenced JSON code block.
- trim non-JSON prefix/suffix around one object.
- remove trailing commas where unambiguous.
- normalize smart quotes only when JSON parsing can prove the affected token is a string boundary.

Deterministic parser repair must not:

- invent missing required fields.
- change enum values.
- infer sourceRefs.
- rewrite user-visible reasoning.
- call Codex or any network service.

Codex self-repair prompt must include:

- original turnPurpose.
- expected schemaVersion.
- validation error list.
- original raw output.
- instruction to return JSON only.

Codex self-repair may run at most once per `codex_runtime_preview_effect` attempt. The overall effect still follows `conservative_ai_retry_matrix`: max 1 automatic effect retry after the first attempt fails.

## Failure severity routing

| Failure class | Severity | ProductEngine output | UI surface | Session behavior |
| --- | --- | --- | --- | --- |
| parser repair succeeded | info | ActivityEvent | Activity Feed | continue |
| self-repair succeeded | info | ActivityEvent + repaired outputRef | Activity Feed and artifact badge | continue |
| transient Codex unavailable before output | recoverable | effect failed with retryAvailable | Activity Feed retry badge | continue other lanes |
| validation failed after self-repair | user_action_needed | ManualRetryCard | Decision Queue | continue other lanes |
| manual handoff required | user_action_needed | ManualHandoffCard | Decision Queue | continue other lanes |
| blocked action requested | safety_block | RuntimeBlockedCard + BlockedActionArtifact | Decision Queue and Activity Feed | continue, no execution |
| unknown artifact kind or applyPolicy | user_action_needed | ValidationFailedCard | Decision Queue | continue other lanes |
| repeated question/fatigue limit hit | convergence_guard | SummarizeThenContinueCard or ConvergenceCard | Decision Queue | pause only that topic |

No failure path may silently retry indefinitely. No failure path may mark an effect as succeeded without a persisted outputRef, card, or ActivityEvent.

## TurnPurpose field tables and examples

### question_generation

Input delta fields:

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `questionTargets` | yes | array | 1-5 active ambiguity/risk targets |
| `batchConstraints.minQuestions` | yes | number | 3 |
| `batchConstraints.maxQuestions` | yes | number | 5 |
| `batchConstraints.noThreeRepeats` | yes | boolean | true |
| `batchConstraints.fatigueSignals` | yes | array | can be empty |
| `preferredQuestionTone` | yes | enum | `sharp_product_coach` for Phase 1 |

Output requirements:

| Requirement | Rule |
| --- | --- |
| artifact kind | exactly `QuestionBatchArtifact` |
| applyPolicy | `auto_apply` unless fatigue guard blocks |
| questions count | 3-5 unless summarize/convergence card is required |
| repeat guard | same topic cannot repeat 3 times without summarizing |
| why explanation | every question must include whyThisMatters |

Example output envelope:

```json
{
  "schemaVersion": "solo-superman.codex-output.v1",
  "turnPurpose": "question_generation",
  "trace": {
    "projectId": "project_demo_001",
    "sessionId": "session_demo_001",
    "sourceEventIds": ["event_answer_001"],
    "sourceIssueIds": ["amb_customer_001"],
    "idempotencyKey": "question_generation:hash_customer_001:codex-runtime-adapter-v1",
    "runtimeAdapterVersion": "codex-runtime-adapter-v1",
    "codexThreadId": "thread_demo_001",
    "codexTurnId": "turn_question_001"
  },
  "summary": "고객 세그먼트와 검증 행동을 좁히기 위한 질문 배치입니다.",
  "confidence": { "selfRated": 0.78, "reason": "최근 답변과 낮은 customer axis가 일치합니다." },
  "artifacts": [
    {
      "artifactId": "artifact_question_batch_001",
      "kind": "QuestionBatchArtifact",
      "title": "고객 세그먼트 질문 배치",
      "summary": "가장 먼저 좁힐 고객과 관찰 가능한 행동을 묻습니다.",
      "applyPolicy": "auto_apply",
      "riskLevel": "low",
      "targetObject": "queue",
      "sourceRefs": [{ "type": "ambiguityIssue", "id": "amb_customer_001" }],
      "requiredApprovals": [],
      "questions": [
        {
          "questionId": "q_customer_001",
          "topicKey": "customer_segment",
          "questionText": "처음 검증할 고객은 어떤 초기 창업자 그룹인가요?",
          "whyThisMatters": "고객이 좁혀져야 리서치와 MVP 범위가 결정됩니다.",
          "answerType": "single_choice",
          "options": [
            { "label": "막 아이디어를 정리하는 1인 창업자", "value": "idea_stage_solo_founder" },
            { "label": "이미 MVP를 만들려는 초기 창업자", "value": "mvp_stage_founder" }
          ],
          "routingHints": { "ifAnswered": "run_ambiguity_analysis" }
        },
        {
          "questionId": "q_behavior_001",
          "topicKey": "validation_behavior",
          "questionText": "이 고객이 이미 시간을 쓰는 대체 행동은 무엇인가요?",
          "whyThisMatters": "대체 행동은 문제 강도의 초기 evidence가 됩니다.",
          "answerType": "free_text",
          "routingHints": { "ifAnswered": "plan_research_prompt" }
        },
        {
          "questionId": "q_success_001",
          "topicKey": "success_criteria",
          "questionText": "첫 세션이 성공했다고 느끼는 최소 산출물은 무엇인가요?",
          "whyThisMatters": "성공 기준은 MVP 범위와 Founder Brief 구성을 결정합니다.",
          "answerType": "single_choice",
          "options": [
            { "label": "문제/고객/가치제안 정리", "value": "pcv_summary" },
            { "label": "검증 실험 계획까지", "value": "validation_plan" }
          ],
          "routingHints": { "ifAnswered": "update_completion_projection" }
        }
      ],
      "fatigueGuard": { "repeatCount": 1, "shouldSummarizeInstead": false, "reason": "topic 반복 제한 내에 있습니다." },
      "priority": { "score": 0.91, "axis": "customer", "reason": "customer confidence가 가장 낮습니다." }
    }
  ]
}
```

### ambiguity_analysis

Input delta fields:

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `analysisTargets` | yes | array | spec sections, answers, evidence refs |
| `scoringRubric` | yes | object | five confidence axes 포함 |
| `knownRiskCards` | yes | array | top 3 current risk cards |

Output requirements:

| Requirement | Rule |
| --- | --- |
| artifact kind | exactly `AmbiguityAnalysisArtifact` |
| applyPolicy | `auto_apply` |
| axisScores | 5축 모두 포함 |
| spec mutation | forbidden |

### research_prompt

Input delta fields:

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `researchNeed` | yes | object | question, hypothesis, evidence gap |
| `handoffMode` | yes | enum | `manual_prompt_handoff`, `codex_official_path` |
| `sourceExpectations` | yes | array | preferred source types |

Output requirements:

| Requirement | Rule |
| --- | --- |
| artifact kind | exactly `ResearchPromptArtifact` |
| applyPolicy | `auto_apply` or `manual_handoff_required` |
| browser automation | forbidden |
| import template | required |

### evidence_synthesis

Input delta fields:

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `researchResult` | yes | object | imported raw text/sourceRefs |
| `evidenceRubric` | yes | object | source quality, pro/con, implication fields |
| `currentConclusion` | yes | object | current spec/evidence conclusion |

Output requirements:

| Requirement | Rule |
| --- | --- |
| artifact kind | exactly `EvidenceSynthesisArtifact` |
| applyPolicy | `conditional_auto_apply` |
| source quality | score and reason required |
| pro/con | both checked; missing con evidence routes to review |
| conclusion-changing | approval/review required |

### spec_update_preview

Input delta fields:

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `updateTarget` | yes | object | section id and current content summary |
| `supportingEvidenceRefs` | yes | array | at least one evidence/decision/source ref |
| `impactRubric` | yes | object | low/medium/high criteria |

Output requirements:

| Requirement | Rule |
| --- | --- |
| artifact kind | exactly `SpecUpdatePreviewArtifact` |
| applyPolicy | `approval_required` |
| direct SpecVersion creation | forbidden |
| before/after summary | required |

### implementation_plan_preview

Input delta fields:

| Field | Required | Type | Validation rule |
| --- | --- | --- | --- |
| `implementationTarget` | yes | object | spec section or phase implementation goal |
| `phaseBoundary` | yes | object | Phase 1 no execution, Phase 1.5B execution-readiness hints |
| `dryRunExpectations` | yes | array | expected validation evidence |

Output requirements:

| Requirement | Rule |
| --- | --- |
| artifact kind | `ImplementationPlanPreviewArtifact` or `BlockedActionArtifact` |
| applyPolicy | `note_only` or `blocked` |
| task commitment | forbidden in Phase 1 |
| phase15bUpgradeHints | required on implementation plan preview |


## Contracts DTO bridge

`25-contracts-dto-catalog.md` defines how this document's Codex turnPurpose, artifact kind, applyPolicy, and blocked action taxonomy are exposed through `packages/contracts/src/codex/`.

Rules:

- This document remains canonical for Codex Prompt/Output semantics.
- 25번 문서는 TypeScript public export path와 API/UI DTO 연결만 소유한다.
- Enum values must match exactly across 24번 and 25번.
- `packages/contracts` must not import Codex app-server runtime client modules to expose these values.

## Acceptance scenarios

### Scenario A. Six turnPurpose happy paths

Given a valid `CoreContextPack` and each required `DeltaContextPack`.

When each of the 6 turnPurpose turns completes.

Then:

- output envelope uses `solo-superman.codex-output.v1`.
- output turnPurpose equals input turnPurpose.
- trace contains projectId, sessionId, idempotencyKey, runtimeAdapterVersion.
- output artifact kind matches the allowed turnPurpose matrix.
- applyPolicy is one of the 6 allowed enum values.
- unknown artifact kind or applyPolicy never appears.

### Scenario B. JSON repair pipeline

Given Codex returns malformed JSON.

When parser repair can deterministically recover one JSON object.

Then:

- repaired output is validated.
- ActivityEvent records parser repair success.
- no Codex self-repair is called.

Given parser repair cannot recover valid schema output.

When Codex self-repair runs once.

Then:

- self-repair receives original output and validation errors.
- if validation passes, output is persisted with repaired outputRef.
- if validation fails, severity routing creates a user-action-needed card.
- no hidden second self-repair occurs.

### Scenario C. Low-risk auto apply

Given `QuestionBatchArtifact`, `AmbiguityAnalysisArtifact`, `ResearchPromptArtifact`, or `ImplementationPlanPreviewArtifact` with valid schema.

When effect completion routes applyPolicy.

Then:

- question batch is queued without separate approval.
- confidence projection updates without changing SpecVersion.
- research prompt creates ResearchTask or manual handoff-ready prompt.
- implementation plan preview stores PlanningNote only.
- no file/shell/browser action is applied.

### Scenario D. Evidence conditional gate

Given `EvidenceSynthesisArtifact` passes source quality, has pro and con evidence, and does not change a conclusion.

When effect completion routes applyPolicy.

Then EvidenceMatrix can be updated by conditional auto apply.

Given evidence changes a conclusion, has weak sources, or lacks con evidence.

Then:

- EvidenceMatrix is not silently updated.
- review/risk/follow-up card is created.
- source/result raw reference is preserved.

### Scenario E. Blocked action taxonomy

Given Codex requests file patch, shell command, browser action, network write, credential access, destructive operation, or ChatGPT web automation.

When the adapter converts output.

Then:

- `BlockedActionArtifact` is created.
- `applyPolicy = blocked`.
- no requested action is executed.
- Phase 1.5B upgrade hints may be stored.
- UI shows RuntimeBlockedCard or equivalent blocked queue card.

### Scenario F. Phase 1.5B upgrade fields preserved

Given `ImplementationPlanPreviewArtifact` includes `phase15bUpgradeHints`.

When Phase 1 stores it.

Then:

- executionIntent, requiredApprovals, riskLevel, sandboxRequirements are preserved.
- Phase 1 does not execute the plan.
- future Phase 1.5B/Phase 2+ implementation can read the hints without migrating the artifact shape.

### Scenario G. Severity routing

Given Codex output fails after allowed repair.

When failure is classified.

Then:

- recoverable failures show Activity Feed and retry badge.
- user-action-needed failures create Decision Queue card.
- safety/block failures create RuntimeBlockedCard and BlockedActionArtifact.
- only the failed topic/lane pauses; the whole 2-5 hour session does not stop.

## Implementation checklist

- Create Zod schemas for input envelope, core context, delta context, output envelope, artifact common fields, 7 artifact kinds, 6 applyPolicy values, and blocked action taxonomy.
- Build fixture JSON for all 6 turnPurpose happy paths.
- Build malformed JSON fixtures for parser repair and self-repair.
- Build validation failure fixtures for unknown artifact kind and unknown applyPolicy.
- Build evidence gate fixtures for pass, conclusion-changing, weak source, and missing con evidence.
- Build blocked action fixtures for file, shell, browser, network, credential, destructive, and ChatGPT web automation requests.
- Assert Phase 1 never executes file/shell/browser actions from Codex output.
- Assert Phase 1.5B upgrade hints are stored but not executed.
