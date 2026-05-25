import type { ProjectionVersion, SessionId } from "../ids";
import type {
  AmbiguityReductionDimension,
  AmbiguityRoutingPath,
  BusinessCriticIntensity,
  BusinessCriticIntensitySelectionStatus,
  ProjectPurposeMode,
  ProjectPurposeModeSelectionStatus
} from "../product-engine";

export type ConfidenceAxisId = "problem" | "customer" | "value" | "validation" | "implementation";
export type ReadinessLabel = "draft" | "clarifying" | "researching" | "decision_ready" | "spec_ready";
export type CompletionCandidateStatus = "not_ready" | "candidate";
export type CompletionGateId =
  | "project_purpose_mode"
  | "business_critic_intensity"
  | "business_critic_pressure"
  | "score_threshold"
  | "confidence_axes"
  | "ambiguity_dimension_floor"
  | "question_debt"
  | "evidence_balance"
  | "research_queue_cards"
  | "required_decisions"
  | "blocking_incidents"
  | "implementation_closeout";

export interface ConfidenceAxisScore {
  readonly axisId: ConfidenceAxisId;
  readonly label: string;
  readonly score: number;
  readonly rationale: string;
}

export interface CompletenessScoreBreakdown {
  readonly sectionCompleteness: number;
  readonly questionDebtResolution: number;
  readonly evidenceQuality: number;
  readonly decisionApproval: number;
  readonly consistencyAndConflict: number;
}

export interface CompletionGateStatus {
  readonly gateId: CompletionGateId;
  readonly label: string;
  readonly passed: boolean;
  readonly blockingReason?: string;
}

export interface AmbiguityDimensionCoverageScore {
  readonly dimension: AmbiguityReductionDimension;
  readonly label: string;
  readonly score: number;
  readonly rationale: string;
  readonly routingPaths: readonly AmbiguityRoutingPath[];
  readonly openIssueCount: number;
  readonly answeredIssueCount: number;
  readonly researchQuestionRefs: readonly string[];
  readonly requiredForImplementation: boolean;
}

export interface TopRiskCardProjection {
  readonly riskId: string;
  readonly title: string;
  readonly severity: "low" | "medium" | "high";
  readonly sourceRefs: readonly string[];
  readonly nextValidationAction: string;
}

export interface IfStopNowArtifactProjection {
  readonly title: string;
  readonly summary: string;
  readonly knownRisks: readonly string[];
  readonly nextValidationActions: readonly string[];
}

export interface CompletionCandidateProjection {
  readonly status: CompletionCandidateStatus;
  readonly summary: string;
  readonly gateFailures: readonly string[];
  readonly ifStopNowArtifact: IfStopNowArtifactProjection;
}

export interface ConfidenceCompletionProjection {
  readonly kind: "ConfidenceCompletionProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly projectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeSelectionStatus?: ProjectPurposeModeSelectionStatus;
  readonly projectPurposeModeLabel?: string;
  readonly projectPurposeModeEffect?: string;
  readonly skippedCommercializationAxes?: readonly string[];
  readonly businessCriticIntensity?: BusinessCriticIntensity;
  readonly businessCriticIntensitySelectionStatus?: BusinessCriticIntensitySelectionStatus;
  readonly businessCriticIntensityLabel?: string;
  readonly businessCriticIntensityEffect?: string;
  readonly compositeScore: number;
  readonly readinessLabel: ReadinessLabel;
  readonly axes: readonly ConfidenceAxisScore[];
  readonly ambiguityDimensionCoverage?: readonly AmbiguityDimensionCoverageScore[];
  readonly scoreBreakdown: CompletenessScoreBreakdown;
  readonly gates: readonly CompletionGateStatus[];
  readonly topRisks: readonly string[];
  readonly topRiskCards: readonly TopRiskCardProjection[];
  readonly nextBestActions: readonly string[];
  readonly completionCandidate: CompletionCandidateProjection;
}
