import type {
  EvidenceItemId,
  ProjectionVersion,
  QueueItemId,
  ResearchResultId,
  ResearchTaskId,
  SessionId
} from "../ids";

export type ResearchRouteOutcome = "research_needed" | "missing_con_evidence";
export type ResearchImpact = "low" | "medium" | "high";
export type ResearchTaskStatus =
  | "planned"
  | "handoff_ready"
  | "evidence_ready"
  | "research_insufficient"
  | "failed";
export type EvidenceBalanceStatus =
  | "unknown"
  | "balanced"
  | "needs_con_evidence"
  | "missing_con_evidence"
  | "source_quality_insufficient"
  | "blocked_by_con_evidence";
export type ResearchReviewCardState =
  | "pending_manual_result"
  | "ready_for_review"
  | "research_insufficient"
  | "terminal_failure";

export interface ResearchTaskProjection {
  readonly researchTaskId: ResearchTaskId;
  readonly sessionId: SessionId;
  readonly sourceQueueItemId?: QueueItemId;
  readonly sourceAnswerRef?: string;
  readonly objective: string;
  readonly routeOutcome: ResearchRouteOutcome;
  readonly impact: ResearchImpact;
  readonly status: ResearchTaskStatus;
  readonly createdAt: string;
}

export interface ResearchResultProjection {
  readonly researchResultId: ResearchResultId;
  readonly researchTaskId: ResearchTaskId;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly resultSummary: string;
  readonly limitationNotes?: string;
  readonly importedAt: string;
}

export interface EvidenceItemProjection {
  readonly evidenceItemId: EvidenceItemId;
  readonly kind: "pro" | "con" | "uncertainty";
  readonly summary: string;
}

export interface EvidenceMatrixProjection {
  readonly evidenceMatrixId: string;
  readonly researchTaskId: ResearchTaskId;
  readonly researchResultId: ResearchResultId;
  readonly synthesisVersion: number;
  readonly proEvidence: readonly EvidenceItemProjection[];
  readonly conEvidence: readonly EvidenceItemProjection[];
  readonly uncertainties: readonly EvidenceItemProjection[];
  readonly additionalQuestions: readonly string[];
  readonly balanceStatus: EvidenceBalanceStatus;
  readonly decisionBlocked: boolean;
  readonly missingConEvidenceReason?: string;
  readonly knownRisk?: string;
}

export interface ResearchReviewCardProjection {
  readonly cardId: QueueItemId;
  readonly researchTaskId: ResearchTaskId;
  readonly title: string;
  readonly state: ResearchReviewCardState;
  readonly retainedSourceRef?: string;
  readonly recoveryActions: readonly ("import_manual_result" | "retry_synthesis" | "defer_as_known_risk")[];
}

export interface ResearchEvidenceProjection {
  readonly kind: "ResearchEvidenceProjection";
  readonly version: ProjectionVersion;
  readonly taskIds: readonly ResearchTaskId[];
  readonly tasks: readonly ResearchTaskProjection[];
  readonly results: readonly ResearchResultProjection[];
  readonly evidenceMatrices: readonly EvidenceMatrixProjection[];
  readonly reviewCards: readonly ResearchReviewCardProjection[];
  readonly knownRisks: readonly string[];
  readonly nextValidationActions: readonly string[];
  readonly proConBalanceStatus: EvidenceBalanceStatus;
}
