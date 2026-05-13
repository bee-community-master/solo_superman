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

export const PROJECT_PURPOSE_MODES = ["business", "personal"] as const;
export type ProjectPurposeMode = (typeof PROJECT_PURPOSE_MODES)[number];
export type ProjectPurposeModeSelectionStatus = "mode_required" | "confirmed";

export const PROJECT_PURPOSE_MODE_LABELS = {
  business: "사업화 검증 중심",
  personal: "개인 workflow 구현 중심"
} as const satisfies Record<ProjectPurposeMode, string>;

export const PROJECT_PURPOSE_MODE_REQUIRED_LABEL = "프로젝트 목적 선택 필요";

export const PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES = {
  business: [] as readonly string[],
  personal: [
    "market_size",
    "investor_narrative",
    "willingness_to_pay",
    "acquisition_channel",
    "competition_pressure"
  ] as readonly string[]
} as const satisfies Record<ProjectPurposeMode, readonly string[]>;

export type ProjectPurposeModeAuditActor = "user" | "product_engine" | "system";

export interface ProjectPurposeModeAuditSnapshot {
  readonly previousMode?: ProjectPurposeMode;
  readonly newMode: ProjectPurposeMode;
  readonly reason: string;
  readonly actor: ProjectPurposeModeAuditActor;
  readonly changedAt: string;
  readonly suggestedMode?: ProjectPurposeMode;
}

export interface ProjectSnapshot {
  readonly projectId: ProjectId;
  readonly privacyMode: "local_only" | "local_with_manual_export";
  readonly projectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeSelectionStatus?: ProjectPurposeModeSelectionStatus;
  readonly projectPurposeModeLabel: string;
  readonly projectPurposeModeReason?: string;
  readonly projectPurposeModeAudit: readonly ProjectPurposeModeAuditSnapshot[];
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
  readonly purposeModeAxis?: string;
  readonly purposeModeEffect?: string;
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
