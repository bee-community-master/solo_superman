import type { DecisionEvidencePackId, ProjectionVersion, QueueItemId, ResearchTaskId, SessionId } from "../ids";
import type {
  AmbiguityExpectedAnswerType,
  AmbiguityAnswerOption,
  AmbiguityAnswerSelectionMode,
  AmbiguityReductionDimension,
  AmbiguityRoutingPath,
  AmbiguityIssueSeverity,
  AmbiguityPossibleRoute,
  BusinessCriticalQuestionCategory,
  BusinessCriticIntensity,
  BusinessCriticIntensitySelectionStatus,
  BusinessCriticPressureKind,
  AmbiguityQuestionContextSnapshot,
  ProjectPurposeMode,
  ProjectPurposeModeSelectionStatus
} from "../product-engine/state";
import type { ResearchQueueTerminalOutcome } from "./research-evidence";

export type QueueCardType =
  | "question"
  | "research_review"
  | "decision_approval"
  | "risk_acceptance"
  | "conflict_resolution"
  | "follow_up_question"
  | "runtime_preview"
  | "completion_candidate";

export type QueueTerminalOutcome = ResearchQueueTerminalOutcome;

export type DecisionQueueRecoveryStatus =
  | "fresh"
  | "pending_refetch"
  | "recovering"
  | "recovered_by_refetch"
  | "stale";

export interface DecisionQueueActiveBatchProjection {
  readonly batchId: string;
  readonly queueItemIds: readonly QueueItemId[];
  readonly selectedAt: string;
  readonly priorityReason: string;
  readonly stabilityPolicy: "preserve_active_batch_until_terminal_or_explicit_reactivation";
}

export interface DecisionQueueRecoveryProjection {
  readonly status: DecisionQueueRecoveryStatus;
  readonly refetchUrl: string;
  readonly sseStreamUrl: string;
  readonly sseEventNames: readonly ["projection.updated"];
  readonly pendingEffectCount: number;
  readonly lastRefetchedAt?: string;
  readonly staleReason?: string;
}

export interface DecisionQueueProgressProjection {
  readonly generatedQuestionCount: number;
  readonly openQuestionCount: number;
  readonly answeredQuestionCount: number;
  readonly deferredQuestionCount: number;
  readonly resolvedQuestionCount: number;
  readonly terminalQuestionCount: number;
  readonly followUpQuestionCount: number;
  readonly followUpOpenQuestionCount: number;
  readonly topicCoverageCount: number;
  readonly openTopicCoverageCount: number;
  readonly followUpBudgetRemainingCount: number;
  readonly visibleQuestionDebtCount: number;
  readonly activeQuestionCount: number;
  readonly upcomingQuestionCount: number;
  readonly blockedQuestionCount: number;
  readonly completionPercent: number;
}

export interface QueueItemProjection {
  readonly queueItemId: QueueItemId;
  readonly title: string;
  readonly state: "active" | "next" | "blocked" | "deferred" | "answered" | "resolved";
  readonly cardType?: QueueCardType;
  readonly sectionRef?: string;
  readonly topicKey?: string;
  readonly purposeModeAxis?: string;
  readonly purposeModeEffect?: string;
  readonly businessCriticCategory?: BusinessCriticalQuestionCategory;
  readonly businessCriticIntensity?: BusinessCriticIntensity;
  readonly businessCriticPressureKind?: BusinessCriticPressureKind;
  readonly knownRiskAccepted?: boolean;
  readonly nextValidationAction?: string;
  readonly severity?: AmbiguityIssueSeverity;
  readonly whyItMatters?: string;
  readonly decisionItUnlocks?: string;
  readonly ambiguityDimension?: AmbiguityReductionDimension;
  readonly ambiguityRoutingPath?: AmbiguityRoutingPath;
  readonly researchQuestion?: string;
  readonly suggestedResearchTask?: string;
  readonly expectedAnswerType?: AmbiguityExpectedAnswerType;
  readonly answerSelectionMode?: AmbiguityAnswerSelectionMode;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
  readonly possibleRoutes?: readonly AmbiguityPossibleRoute[];
  readonly sourceRef?: string;
  readonly questionContext?: AmbiguityQuestionContextSnapshot;
  readonly researchTaskId?: ResearchTaskId;
  readonly evidencePackId?: DecisionEvidencePackId;
  readonly additionalQuestions?: readonly string[];
  readonly blocksPlanning?: boolean;
  readonly availableOutcomes?: readonly QueueTerminalOutcome[];
  readonly terminalOutcome?: QueueTerminalOutcome;
  readonly terminalRationale?: string;
}

export interface DecisionQueueProjection {
  readonly kind: "DecisionQueueProjection";
  readonly projectionKind?: "DecisionQueueProjection";
  readonly sessionId?: SessionId;
  readonly version: ProjectionVersion;
  readonly generatedAt?: string;
  readonly stale?: boolean;
  readonly refetchUrl?: string;
  readonly projectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeSelectionStatus?: ProjectPurposeModeSelectionStatus;
  readonly modeEffectSummary?: string;
  readonly skippedCommercializationAxes?: readonly string[];
  readonly businessCriticIntensity?: BusinessCriticIntensity;
  readonly businessCriticIntensitySelectionStatus?: BusinessCriticIntensitySelectionStatus;
  readonly businessCriticIntensityLabel?: string;
  readonly businessCriticIntensityEffect?: string;
  readonly businessCriticPressureSummary?: string;
  readonly activeBatch?: DecisionQueueActiveBatchProjection;
  readonly progress?: DecisionQueueProgressProjection;
  readonly recovery?: DecisionQueueRecoveryProjection;
  readonly active: readonly QueueItemProjection[];
  readonly next: readonly QueueItemProjection[];
  readonly blocked: readonly QueueItemProjection[];
  readonly deferred: readonly QueueItemProjection[];
}
