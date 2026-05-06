import type {
  DecisionEvidencePackId,
  EvidenceItemId,
  ProjectionVersion,
  QueueItemId,
  ResearchResultId,
  ResearchRunId,
  ResearchTaskId,
  SessionId
} from "../ids";

export type ResearchRouteOutcome = "research_needed" | "missing_con_evidence";
export type ResearchImpact = "low" | "medium" | "high";
export type ResearchTaskStatus =
  | "planned"
  | "handoff_ready"
  | "evidence_ready"
  | "needs_review"
  | "research_insufficient"
  | "stale"
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
  | "quality_gate_review"
  | "ready_for_review"
  | "research_insufficient"
  | "stale"
  | "terminal_failure"
  | "resolved";
export type ResearchUpdatedQueueCardType =
  | "research_review"
  | "decision_approval"
  | "risk_acceptance"
  | "conflict_resolution"
  | "follow_up_question";
export type ResearchQueueTerminalOutcome =
  | "approved"
  | "revised"
  | "rejected"
  | "deferred"
  | "risk_accepted"
  | "research_insufficient";
export type ResearchSourceReliability = "high" | "medium" | "low" | "unknown";
export type DecisionEvidencePackGateStatus = "accepted" | "needs_review" | "research_insufficient" | "stale";
export type ResearchQualityGateCheckCode =
  | "source_metadata"
  | "source_reliability"
  | "pro_con_balance"
  | "limitations_linked"
  | "staleness"
  | "implication_scope";
export type ResearchQualityGateCheckStatus = "passed" | "failed" | "unknown";

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
  readonly researchRunId?: ResearchRunId;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly sourceReliability?: ResearchSourceReliability;
  readonly sourcePublishedAt?: string;
  readonly sourceRetrievedAt?: string;
  readonly resultSummary: string;
  readonly limitationNotes?: string;
  readonly claim?: string;
  readonly decisionContext?: string;
  readonly specSectionRef?: string;
  readonly questionRef?: string;
  readonly implicationScope?: string;
  readonly staleSensitive?: boolean;
  readonly sourceRequiredAfter?: string;
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

export interface ResearchQualityGateCheckProjection {
  readonly code: ResearchQualityGateCheckCode;
  readonly status: ResearchQualityGateCheckStatus;
  readonly reason: string;
}

export interface DecisionEvidencePackProjection {
  readonly evidencePackId: DecisionEvidencePackId;
  readonly researchTaskId: ResearchTaskId;
  readonly researchResultId: ResearchResultId;
  readonly researchRunId?: ResearchRunId;
  readonly claim: string;
  readonly decisionContext: string;
  readonly specSectionRef?: string;
  readonly questionRef?: string;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly sourceReliability: ResearchSourceReliability;
  readonly sourcePublishedAt?: string;
  readonly retrievedAt: string;
  readonly gateStatus: DecisionEvidencePackGateStatus;
  readonly gateChecks: readonly ResearchQualityGateCheckProjection[];
  readonly proEvidenceItemIds: readonly EvidenceItemId[];
  readonly conEvidenceItemIds: readonly EvidenceItemId[];
  readonly uncertaintyItemIds: readonly EvidenceItemId[];
  readonly limitationRefs: readonly string[];
  readonly implicationScope: string;
  readonly knownRisk?: string;
  readonly nextValidationAction?: string;
  readonly createdAt: string;
}

export interface ResearchReviewCardProjection {
  readonly cardId: QueueItemId;
  readonly researchTaskId: ResearchTaskId;
  readonly evidencePackId?: DecisionEvidencePackId;
  readonly cardType: ResearchUpdatedQueueCardType;
  readonly title: string;
  readonly state: ResearchReviewCardState;
  readonly impact: ResearchImpact;
  readonly gateStatus?: DecisionEvidencePackGateStatus;
  readonly decisionContext?: string;
  readonly reviewReason?: string;
  readonly retainedSourceRef?: string;
  readonly retainedSourceRefs?: readonly string[];
  readonly availableOutcomes: readonly ResearchQueueTerminalOutcome[];
  readonly suggestedOutcome?: ResearchQueueTerminalOutcome;
  readonly terminalOutcome?: ResearchQueueTerminalOutcome;
  readonly terminalRationale?: string;
  readonly blocksPlanning: boolean;
  readonly recoveryActions: readonly (
    | "import_manual_result"
    | "retry_synthesis"
    | "defer_as_known_risk"
    | "approve_evidence"
    | "revise_decision"
    | "reject_decision"
    | "accept_risk"
    | "mark_research_insufficient"
  )[];
}

export interface ResearchEvidenceProjection {
  readonly kind: "ResearchEvidenceProjection";
  readonly version: ProjectionVersion;
  readonly taskIds: readonly ResearchTaskId[];
  readonly tasks: readonly ResearchTaskProjection[];
  readonly results: readonly ResearchResultProjection[];
  readonly evidenceMatrices: readonly EvidenceMatrixProjection[];
  readonly evidencePacks: readonly DecisionEvidencePackProjection[];
  readonly reviewCards: readonly ResearchReviewCardProjection[];
  readonly knownRisks: readonly string[];
  readonly nextValidationActions: readonly string[];
  readonly proConBalanceStatus: EvidenceBalanceStatus;
}
