import type { DecisionEvidencePackId, ProjectionVersion, QueueItemId, ResearchTaskId, SessionId } from "../ids";
import type {
  AmbiguityExpectedAnswerType,
  AmbiguityIssueSeverity,
  AmbiguityPossibleRoute
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

export interface QueueItemProjection {
  readonly queueItemId: QueueItemId;
  readonly title: string;
  readonly state: "active" | "next" | "blocked" | "deferred" | "answered" | "resolved";
  readonly cardType?: QueueCardType;
  readonly sectionRef?: string;
  readonly topicKey?: string;
  readonly severity?: AmbiguityIssueSeverity;
  readonly whyItMatters?: string;
  readonly decisionItUnlocks?: string;
  readonly expectedAnswerType?: AmbiguityExpectedAnswerType;
  readonly possibleRoutes?: readonly AmbiguityPossibleRoute[];
  readonly researchTaskId?: ResearchTaskId;
  readonly evidencePackId?: DecisionEvidencePackId;
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
  readonly activeBatch?: DecisionQueueActiveBatchProjection;
  readonly recovery?: DecisionQueueRecoveryProjection;
  readonly active: readonly QueueItemProjection[];
  readonly next: readonly QueueItemProjection[];
  readonly blocked: readonly QueueItemProjection[];
  readonly deferred: readonly QueueItemProjection[];
}
