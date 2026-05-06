import type {
  DecisionEvidencePackGateStatus,
  EvidenceBalanceStatus,
  ResearchImpact,
  ResearchQueueTerminalOutcome,
  ResearchReviewCardProjection,
  ResearchUpdatedQueueCardType
} from "./research-evidence";

export interface ResearchReviewCardOutcomeMetadataInput {
  readonly impact: ResearchImpact;
  readonly gateStatus: DecisionEvidencePackGateStatus;
  readonly balanceStatus: EvidenceBalanceStatus | "unknown";
  readonly hasAdditionalQuestions: boolean;
}

export interface ResearchReviewCardOutcomeMetadata {
  readonly cardType: ResearchUpdatedQueueCardType;
  readonly availableOutcomes: readonly ResearchQueueTerminalOutcome[];
  readonly suggestedOutcome: ResearchQueueTerminalOutcome;
  readonly recoveryActions: ResearchReviewCardProjection["recoveryActions"];
}

function researchUpdatedQueueCardType(
  input: ResearchReviewCardOutcomeMetadataInput
): ResearchUpdatedQueueCardType {
  if (
    input.gateStatus === "needs_review" ||
    input.gateStatus === "stale" ||
    input.balanceStatus === "source_quality_insufficient"
  ) {
    return "research_review";
  }

  if (input.balanceStatus === "balanced" && input.gateStatus === "accepted") {
    return "decision_approval";
  }

  if (input.balanceStatus === "blocked_by_con_evidence") {
    return "conflict_resolution";
  }

  if (input.hasAdditionalQuestions && input.impact !== "high") {
    return "follow_up_question";
  }

  return "risk_acceptance";
}

function availableOutcomesForCardType(
  cardType: ResearchUpdatedQueueCardType,
  gateStatus: DecisionEvidencePackGateStatus
): readonly ResearchQueueTerminalOutcome[] {
  switch (cardType) {
    case "decision_approval":
      return ["approved", "revised", "rejected", "deferred"];
    case "risk_acceptance":
      return ["risk_accepted", "research_insufficient", "deferred", "rejected"];
    case "conflict_resolution":
      return ["revised", "rejected", "risk_accepted", "research_insufficient", "deferred"];
    case "follow_up_question":
      return ["revised", "research_insufficient", "deferred"];
    case "research_review":
      return gateStatus === "accepted"
        ? ["approved", "revised", "deferred"]
        : ["revised", "research_insufficient", "deferred"];
  }
}

function suggestedOutcomeForCardType(
  cardType: ResearchUpdatedQueueCardType,
  gateStatus: DecisionEvidencePackGateStatus
): ResearchQueueTerminalOutcome {
  if (gateStatus === "research_insufficient" || gateStatus === "stale") {
    return "research_insufficient";
  }

  switch (cardType) {
    case "decision_approval":
      return "approved";
    case "risk_acceptance":
      return "risk_accepted";
    case "conflict_resolution":
    case "follow_up_question":
      return "revised";
    case "research_review":
      return "deferred";
  }
}

function recoveryActionsForCard(
  cardType: ResearchUpdatedQueueCardType,
  input: ResearchReviewCardOutcomeMetadataInput
): ResearchReviewCardProjection["recoveryActions"] {
  if (input.gateStatus === "stale" || input.balanceStatus === "source_quality_insufficient") {
    return ["retry_synthesis", "import_manual_result", "defer_as_known_risk", "mark_research_insufficient"];
  }

  switch (cardType) {
    case "decision_approval":
      return ["approve_evidence", "revise_decision", "reject_decision"];
    case "risk_acceptance":
      return ["accept_risk", "import_manual_result", "mark_research_insufficient", "defer_as_known_risk"];
    case "conflict_resolution":
      return ["revise_decision", "reject_decision", "accept_risk", "import_manual_result"];
    case "follow_up_question":
      return ["revise_decision", "import_manual_result", "mark_research_insufficient"];
    case "research_review":
      return input.gateStatus === "needs_review" || input.gateStatus === "research_insufficient"
        ? ["import_manual_result", "defer_as_known_risk", "mark_research_insufficient"]
        : ["revise_decision", "defer_as_known_risk"];
  }
}

export function deriveResearchReviewCardOutcomeMetadata(
  input: ResearchReviewCardOutcomeMetadataInput
): ResearchReviewCardOutcomeMetadata {
  const cardType = researchUpdatedQueueCardType(input);

  return {
    cardType,
    availableOutcomes: availableOutcomesForCardType(cardType, input.gateStatus),
    suggestedOutcome: suggestedOutcomeForCardType(cardType, input.gateStatus),
    recoveryActions: recoveryActionsForCard(cardType, input)
  };
}

export function derivePendingResearchReviewCardOutcomeMetadata(): ResearchReviewCardOutcomeMetadata {
  return {
    cardType: "research_review",
    availableOutcomes: ["deferred", "research_insufficient"],
    suggestedOutcome: "deferred",
    recoveryActions: ["import_manual_result", "defer_as_known_risk", "mark_research_insufficient"]
  };
}
