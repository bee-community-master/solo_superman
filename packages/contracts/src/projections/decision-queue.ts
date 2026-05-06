import type { DecisionEvidencePackId, ProjectionVersion, QueueItemId, ResearchTaskId } from "../ids";
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

export interface QueueItemProjection {
  readonly queueItemId: QueueItemId;
  readonly title: string;
  readonly state: "active" | "next" | "blocked" | "deferred" | "answered" | "resolved";
  readonly cardType?: QueueCardType;
  readonly researchTaskId?: ResearchTaskId;
  readonly evidencePackId?: DecisionEvidencePackId;
  readonly blocksPlanning?: boolean;
  readonly availableOutcomes?: readonly QueueTerminalOutcome[];
  readonly terminalOutcome?: QueueTerminalOutcome;
  readonly terminalRationale?: string;
}

export interface DecisionQueueProjection {
  readonly kind: "DecisionQueueProjection";
  readonly version: ProjectionVersion;
  readonly active: readonly QueueItemProjection[];
  readonly next: readonly QueueItemProjection[];
  readonly blocked: readonly QueueItemProjection[];
  readonly deferred: readonly QueueItemProjection[];
}
