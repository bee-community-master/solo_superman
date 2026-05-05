import type { ProjectionVersion, SessionId } from "../ids";

export type ConfidenceAxisId = "problem" | "customer" | "value" | "validation" | "implementation";
export type ReadinessLabel = "draft" | "clarifying" | "researching" | "decision_ready" | "spec_ready";
export type CompletionCandidateStatus = "not_ready" | "candidate";
export type CompletionGateId =
  | "score_threshold"
  | "confidence_axes"
  | "question_debt"
  | "evidence_balance"
  | "required_decisions"
  | "blocking_incidents";

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
  readonly compositeScore: number;
  readonly readinessLabel: ReadinessLabel;
  readonly axes: readonly ConfidenceAxisScore[];
  readonly scoreBreakdown: CompletenessScoreBreakdown;
  readonly gates: readonly CompletionGateStatus[];
  readonly topRisks: readonly string[];
  readonly topRiskCards: readonly TopRiskCardProjection[];
  readonly nextBestActions: readonly string[];
  readonly completionCandidate: CompletionCandidateProjection;
}
