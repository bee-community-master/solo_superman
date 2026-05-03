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
  runtimeAdapter: 'local' | 'openclaw' | 'playwright' | 'browser_use' | 'crewai';
  status: 'planned' | 'running' | 'completed' | 'failed' | 'cancelled';
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

## SourceRef

```ts
type SourceRef = {
  id: string;
  url: string;
  title: string;
  retrievedAt: string;
  sourceType: 'official_doc' | 'research_report' | 'competitor_site' | 'community' | 'news' | 'other';
  reliability: 'low' | 'medium' | 'high';
};
```

## 설계 메모

- Phase 1 DB는 SQLite에 위 모델을 직접 저장한다.
- sync가 켜지면 Project 단위로 cloud mirror를 만든다.
- `SpecVersion`은 immutable하게 다룬다.
- `LivingProductSpec`은 최신 version pointer와 working draft를 관리한다.
- `Decision`과 `EvidenceMatrix`는 분리한다. 근거가 있어도 사용자가 승인하지 않으면 결정이 아니다.
