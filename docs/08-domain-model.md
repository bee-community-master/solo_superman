# 08. Domain Model

## 핵심 객체 관계

```text
Project
 ├─ LivingProductSpec
 │   └─ SpecVersion[]
 ├─ AmbiguityIssue[]
 │   └─ Question[]
 │       └─ Answer[]
 ├─ ResearchTask[]
 │   └─ ResearchResult[]
 │       └─ EvidenceMatrix[]
 ├─ Decision[]
 │   └─ SpecUpdate[]
 └─ CompletenessSnapshot[]
```

State/Event Contract 관점의 trace는 다음과 같이 읽는다.

```text
AmbiguityIssue
 → Question
 → Answer
 → ResearchTask / EvidenceMatrix / SpecUpdate / Decision
 → SpecVersion
 → CompletenessSnapshot
 → CompletionCandidate
```

이 관계는 DB/API 스키마 상세 제외 원칙에 따른 문서 계약이다. 실제 저장소 index, foreign key, API shape는 구현 설계 단계에서 확정한다.

## State/Event traceability 규칙

- 모든 `Question`은 하나의 primary `AmbiguityIssue`와 `topicKey`를 가진다.
- 모든 `Answer`는 하나의 `AnswerRouteOutcome`을 가진다.
- `research_needed` 또는 `missing_con_evidence`는 `ResearchTask` 또는 명시적 deferred/risk outcome으로 이어진다.
- high-impact `SpecUpdate`는 `Decision` approval 없이 `SpecVersion` 원인이 될 수 없다.
- `EvidenceMatrix`의 Known Risks와 Next Validation Actions는 Founder Brief와 CompletionCandidate에 연결된다.
- `CompletionCandidate`는 마지막 `CompletenessSnapshot`, 핵심 `Decision`, 남은 high severity `AmbiguityIssue`, Evidence gate 상태를 추적할 수 있어야 한다.


## Project

프로젝트는 하나의 창업 아이디어 구체화 작업 단위다.

필드:

```ts
type Project = {
  id: string;
  name: string;
  rawIdea: string;
  status: 'draft' | 'active' | 'completion_candidate' | 'completed' | 'archived';
  privacyMode: 'local_only' | 'sync_enabled';
  syncStatus: 'local_only' | 'sync_enabled' | 'sync_paused' | 'sync_error';
  createdAt: string;
  updatedAt: string;
};
```

## LivingProductSpec

현재 최신 spec의 논리적 container다.

```ts
type LivingProductSpec = {
  id: string;
  projectId: string;
  currentVersionId: string;
  sections: SpecSection[];
  status: 'draft' | 'clarifying' | 'researching' | 'decision_ready' | 'spec_ready';
};
```

## SpecSection

```ts
type SpecSection = {
  id: string;
  key:
    | 'idea_summary'
    | 'problem_statement'
    | 'target_customer'
    | 'value_proposition'
    | 'alternatives_competition'
    | 'evidence_matrix'
    | 'validation_plan'
    | 'mvp_scope'
    | 'success_criteria'
    | 'decision_log'
    | 'open_questions'
    | 'phase_plan';
  title: string;
  content: string;
  confidence: 'low' | 'medium' | 'high';
  completeness: number;
  hasConflict: boolean;
  evidenceCoverage: 'none' | 'pro_only' | 'pro_con' | 'pro_con_uncertainty';
};
```

## SpecVersion

승인된 Spec snapshot이다.

```ts
type SpecVersion = {
  id: string;
  projectId: string;
  versionNumber: number;
  sections: SpecSection[];
  changeSummary: string;
  linkedDecisionIds: string[];
  linkedResearchResultIds: string[];
  completenessScore: number;
  remainingHighRiskCount: number;
  createdAt: string;
};
```

## AmbiguityIssue

```ts
type AmbiguityIssue = {
  id: string;
  projectId: string;
  specSectionKey: SpecSection['key'];
  topicKey: string;
  type: 'missing' | 'conflict' | 'unsupported' | 'vague' | 'decision_required' | 'missing_con_evidence';
  severity: 'high' | 'medium' | 'low';
  description: string;
  whyItMatters: string;
  repeatCount: number;
  repeatLimit: number;
  status:
    | 'open'
    | 'question_queued'
    | 'research_needed'
    | 'research_insufficient'
    | 'repeat_limit_reached'
    | 'resolved'
    | 'deferred'
    | 'risk_accepted';
  closureReason?:
    | 'answered'
    | 'auto_resolved'
    | 'decision_approved'
    | 'research_needed'
    | 'repeat_limit_reached'
    | 'user_deferred'
    | 'risk_accepted';
  createdAt: string;
  resolvedAt?: string;
};
```

필드 규칙:

- `topicKey`는 같은 주제 반복 질문을 묶는 논리 키다.
- `repeatLimit` 기본값은 3이다.
- `repeatCount`는 같은 `topicKey`에서 사용자에게 제시된 질문 수를 센다.
- `repeat_limit_reached`는 영구 해결이 아니라 severity별 수렴 정책을 적용하기 위한 중간 상태다.
- `closureReason`은 why this issue stopped를 설명하며, 완료 후 Founder Brief Known Risks에 연결된다.

## Question

```ts
type Question = {
  id: string;
  projectId: string;
  ambiguityIssueId: string;
  topicKey: string;
  batchId?: string;
  title: string;
  currentUnderstanding: string;
  whyItMatters: string;
  howToAnswer: string;
  type: 'single_answerable' | 'multi_answerable' | 'free_text';
  options: QuestionOption[];
  confidenceAxisImpacts: ConfidenceAxisImpact[];
  possibleRouteOutcomes: AnswerRouteOutcome[];
  priorityScore: number;
  status:
    | 'queued'
    | 'active'
    | 'answered'
    | 'research_waiting'
    | 'approval_waiting'
    | 'repeat_limit_reached'
    | 'resolved'
    | 'deferred'
    | 'dismissed';
};
```

## Answer

```ts
type Answer = {
  id: string;
  questionId: string;
  projectId: string;
  value: string | string[];
  freeText?: string;
  routeOutcome: AnswerRouteOutcome;
  createdAt: string;
  interpretedDecisionCandidateIds: string[];
};
```

## AnswerRouteOutcome and ConfidenceAxisImpact

```ts
type AnswerRouteOutcome =
  | 'resolved'
  | 'research_needed'
  | 'missing_con_evidence'
  | 'decision_candidate'
  | 'spec_update_candidate'
  | 'conflict_detected'
  | 'deferred'
  | 'repeat_limit_reached';

type ConfidenceAxis =
  | 'problem_confidence'
  | 'customer_confidence'
  | 'value_prop_confidence'
  | 'validation_confidence'
  | 'implementation_confidence';

type ConfidenceAxisImpact = {
  axis: ConfidenceAxis;
  direction: 'increase' | 'decrease' | 'unknown';
  rationale: string;
};
```

## ResearchTask

```ts
type ResearchTask = {
  id: string;
  projectId: string;
  type: 'customer_segment' | 'competition' | 'problem_validity' | 'validation_experiment' | 'market_signal';
  prompt: string;
  relatedQuestionIds: string[];
  relatedAmbiguityIssueIds: string[];
  runtimeAdapter:
    | 'codex_app_server'
    | 'manual_prompt_handoff'
    | 'official_codex_path'
    | 'local'
    | 'openclaw'
    | 'playwright'
    | 'browser_use'
    | 'crewai';
  runtimeMode: 'sandbox_preview' | 'manual_handoff' | 'official_runtime' | 'browser_automation_later';
  status: 'planned' | 'handoff_ready' | 'running' | 'preview_ready' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
};
```

## ResearchResult

```ts
type ResearchResult = {
  id: string;
  researchTaskId: string;
  projectId: string;
  summary: string;
  sources: SourceRef[];
  claims: string[];
  confidence: 'low' | 'medium' | 'high';
  limitations: string[];
  status: 'needs_review' | 'accepted' | 'rejected' | 'stale' | 'evidence_gate_blocked';
};
```

## RuntimePreviewArtifact

Codex app-server가 Phase 1에서 만들 수 있는 실행 전 산출물이다. 실제 파일, shell, browser에는 적용하지 않는다.

```ts
type RuntimePreviewArtifact = {
  id: string;
  projectId: string;
  runtimeAdapter: 'codex_app_server' | 'official_codex_path' | 'manual_prompt_handoff';
  kind:
    | 'research_prompt_preview'
    | 'research_result_import_template'
    | 'spec_update_preview'
    | 'implementation_plan_preview'
    | 'diff_preview'
    | 'command_plan_preview'
    | 'browser_action_preview';
  sourceTaskId?: string;
  linkedQuestionIds: string[];
  linkedAmbiguityIssueIds: string[];
  summary: string;
  riskLevel: 'low' | 'high_impact';
  applicationStatus: 'preview_only' | 'converted_to_spec_update' | 'converted_to_research_result' | 'blocked';
  createdAt: string;
};
```

필드 규칙:

- `preview_only`는 실행이 아니라 검토 가능한 제안이다.
- `diff_preview`, `command_plan_preview`, `browser_action_preview`는 Phase 1에서 적용할 수 없다.
- high-impact preview는 Decision Approval Card 또는 Risk Card로 연결한다.
- preview artifact는 직접 `SpecVersion`의 원인이 될 수 없고, `SpecUpdate` 또는 `ResearchResult`로 변환되어야 한다.

## EvidenceMatrix

```ts
type EvidenceMatrix = {
  id: string;
  projectId: string;
  claim: string;
  impact: 'high' | 'medium' | 'low';
  decisionContext: string;
  balanceStatus:
    | 'no_evidence'
    | 'pro_only'
    | 'con_only'
    | 'pro_con_present'
    | 'missing_con_evidence'
    | 'balanced'
    | 'blocked_by_con_evidence'
    | 'source_quality_insufficient';
  proEvidence: EvidenceItem[];
  conEvidence: EvidenceItem[];
  missingConEvidenceReason?: string;
  skepticalSearch: SkepticalSearchRecord;
  uncertainties: string[];
  followUpQuestions: string[];
  knownRiskIds: string[];
  nextValidationActionIds: string[];
  recommendedDecision?: string;
  confidence: 'low' | 'medium' | 'high';
};
```

## EvidenceItem and SkepticalSearchRecord

```ts
type EvidenceItem = {
  id: string;
  sourceId: string;
  kind: 'qualitative' | 'quantitative' | 'market_signal' | 'competitor_signal' | 'expert_signal' | 'other';
  stance: 'pro' | 'con' | 'neutral';
  summary: string;
  implication: string;
  strength: 'low' | 'medium' | 'high';
  relevance: 'low' | 'medium' | 'high';
  sourceReliability: 'low' | 'medium' | 'high';
  limitations: string[];
};

type SkepticalSearchRecord = {
  attempted: boolean;
  checkedSourceTypes: SourceRef['sourceType'][];
  foundConEvidence: boolean;
  missingConEvidenceReason?: string;
};
```

필드 규칙:

- `balanceStatus`는 Pro/Con Evidence Gate의 현재 상태다.
- `missingConEvidenceReason`은 `balanceStatus`가 `missing_con_evidence`일 때 필요하다.
- `summary`는 source가 말한 내용이고 `implication`은 claim에 미치는 해석이다.
- `stance: neutral`은 decision-ready 핵심 근거로 쓰지 않는다.
- DB/API 스키마 상세 제외 원칙에 따라 이 타입은 문서 계약이며 테이블 DDL이 아니다.

## Decision

```ts
type Decision = {
  id: string;
  projectId: string;
  type:
    | 'primary_customer'
    | 'problem_statement'
    | 'value_proposition'
    | 'mvp_scope'
    | 'validation_plan'
    | 'success_criteria'
    | 'phase_boundary';
  statement: string;
  rationale: string;
  alternatives: string[];
  evidenceMatrixIds: string[];
  status: 'proposed' | 'approved' | 'rejected' | 'revised' | 'deferred';
  approvedAt?: string;
};
```

## SpecUpdate

```ts
type SpecUpdate = {
  id: string;
  projectId: string;
  decisionId?: string;
  riskLevel: 'low' | 'high_impact';
  targetSectionKey: SpecSection['key'];
  beforeSummary: string;
  afterSummary: string;
  diffText: string;
  status: 'suggested' | 'auto_applied' | 'approval_waiting' | 'approved_applied' | 'rejected';
};
```

## CompletenessSnapshot

```ts
type CompletenessSnapshot = {
  id: string;
  projectId: string;
  score: number;
  readinessLabel: 'draft' | 'clarifying' | 'researching' | 'decision_ready' | 'spec_ready';
  sectionCompleteness: number;
  questionDebtResolution: number;
  evidenceQuality: number;
  decisionApproval: number;
  consistencyAndConflict: number;
  highRiskOpenCount: number;
  createdAt: string;
};
```

## CompletionCandidate

State/Event Contract에서 완료 후보를 표현하는 문서 객체다.

```ts
type CompletionCandidate = {
  id: string;
  projectId: string;
  completenessSnapshotId: string;
  linkedDecisionIds: string[];
  linkedEvidenceMatrixIds: string[];
  remainingHighRiskIssueIds: string[];
  founderBriefSections: ('problem_customer_value' | 'top_decisions' | 'known_risks' | 'next_validation_actions')[];
  availableActions: ('declare_complete' | 'ask_deeper_questions' | 'reinforce_research' | 'export_founder_brief')[];
  status: 'candidate' | 'accepted' | 'continued' | 'research_reinforcement_requested';
};
```

필드 규칙:

- `remainingHighRiskIssueIds`는 비어 있거나, `risk_accepted` 또는 blocker 설명과 연결되어야 한다.
- `availableActions`는 완료 선언만 강요하지 않고 더 깊게 질문하거나 리서치를 보강하는 선택지를 유지한다.
- 이 타입은 State/Event Contract 검증을 위한 문서 계약이며 DB/API 스키마 상세가 아니다.

## SourceRef

```ts
type SourceRef = {
  id: string;
  url: string;
  title: string;
  retrievedAt: string;
  sourceType:
    | 'official_doc'
    | 'research_report'
    | 'competitor_site'
    | 'community'
    | 'news'
    | 'codex_result'
    | 'manual_handoff'
    | 'other';
  reliability: 'low' | 'medium' | 'high';
};
```

## 설계 메모

- Phase 1 DB는 SQLite에 위 모델을 직접 저장한다.
- AI Runtime 관련 추가 상태와 권한 경계는 `17-ai-runtime-access-strategy.md`를 따른다.
- sync가 켜지면 Project 단위로 cloud mirror를 만든다.
- `SpecVersion`은 immutable하게 다룬다.
- `LivingProductSpec`은 최신 version pointer와 working draft를 관리한다.
- `Decision`과 `EvidenceMatrix`는 분리한다. 근거가 있어도 사용자가 승인하지 않으면 결정이 아니다.
