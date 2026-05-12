import type {
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  ExecutionAuthorityLedgerProjection,
  FounderBriefProjection,
  LivingSpecProjection,
  Phase25ResearchComparisonProjection,
  PlanningHandoffProjection,
  ResearchEvidenceProjection,
  RuntimeActivityProjection,
  SessionShellProjection
} from "../projections";
import type { DecisionId, ProjectId, QueueItemId, SessionId, StateVersion } from "../ids";

export interface ProjectSnapshot {
  readonly projectId: ProjectId;
  readonly privacyMode: "local_only" | "local_with_manual_export";
  readonly rawIdeaText?: string;
}

export interface SessionSnapshot {
  readonly sessionId: SessionId;
  readonly phase: "intake" | "spec" | "question_loop" | "research" | "completion";
}

export interface CurrentSpecSnapshot {
  readonly draftRef: string;
  readonly versionRef?: string;
  readonly title?: string;
  readonly sections?: readonly string[];
}

export const CANONICAL_INITIAL_SPEC_SECTIONS = [
  "Problem",
  "Target Customer",
  "JTBD / Use Case",
  "Current Alternatives",
  "Value Proposition",
  "Differentiation",
  "MVP Scope",
  "Non-goals",
  "Validation Plan",
  "Success Criteria",
  "Evidence Status",
  "Known Risks / Open Questions"
] as const;

export type AmbiguityIssueUncertaintyType =
  | "missing"
  | "vague"
  | "unsupported"
  | "conflict"
  | "decision_required"
  | "missing_con_evidence";

export type AmbiguityIssueSeverity = "high" | "medium" | "low";

export type AmbiguityExpectedAnswerType = "choice" | "text" | "rank" | "evidence" | "experiment";

export type AmbiguityPossibleRoute =
  | "question"
  | "research_needed"
  | "missing_con_evidence"
  | "decision_candidate"
  | "spec_update_candidate"
  | "conflict_detected"
  | "deferred"
  | "repeat_limit_reached";

export interface AmbiguityIssueSnapshot {
  readonly queueItemId: QueueItemId;
  readonly sectionRef?: string;
  readonly topicKey?: string;
  readonly uncertaintyType?: AmbiguityIssueUncertaintyType;
  readonly severity?: AmbiguityIssueSeverity;
  readonly summary: string;
  readonly whyItMatters?: string;
  readonly status: "open" | "answered" | "deferred" | "resolved";
  readonly questionText?: string;
  readonly expectedAnswerType?: AmbiguityExpectedAnswerType;
  readonly decisionItUnlocks?: string;
  readonly suggestedResearchTask?: string;
  readonly repeatCount?: number;
  readonly repeatLimit?: number;
  readonly possibleRoutes?: readonly AmbiguityPossibleRoute[];
  readonly sourceRef?: string;
}

export type RequiredDecisionRef =
  | "primary_customer"
  | "problem"
  | "value"
  | "mvp_scope"
  | "validation_plan"
  | "success_criteria";

export interface DecisionSnapshot {
  readonly decisionId: DecisionId;
  readonly requiredDecisionRef: RequiredDecisionRef;
  readonly status: "active" | "approved" | "rejected" | "deferred" | "risk_accepted";
}

export interface SpecUpdatePreviewSnapshot {
  readonly previewRef: string;
  readonly sourceRef: string;
  readonly decisionId: DecisionId;
  readonly requiredDecisionRef: RequiredDecisionRef;
  readonly title: string;
  readonly sections: readonly string[];
}

export interface ProductEngineStateSnapshot {
  readonly stateVersion: StateVersion;
  readonly project: ProjectSnapshot;
  readonly session: SessionSnapshot;
  readonly intake?: {
    readonly intakeRef: string;
    readonly answer: string;
  };
  readonly currentSpec: CurrentSpecSnapshot;
  readonly openIssues: readonly AmbiguityIssueSnapshot[];
  readonly queueProjection: DecisionQueueProjection;
  readonly sessionShellProjection?: SessionShellProjection;
  readonly livingSpecProjection?: LivingSpecProjection;
  readonly researchState: ResearchEvidenceProjection;
  readonly decisions: readonly DecisionSnapshot[];
  readonly specUpdatePreviews?: readonly SpecUpdatePreviewSnapshot[];
  readonly runtimeState: RuntimeActivityProjection;
  readonly completeness: ConfidenceCompletionProjection;
  readonly founderBrief?: FounderBriefProjection;
  readonly planningHandoff?: PlanningHandoffProjection;
  readonly phase25ResearchComparison?: Phase25ResearchComparisonProjection;
  readonly executionAuthorityLedger?: ExecutionAuthorityLedgerProjection;
}
