import type { CausationId, CommandId, CorrelationId, EventId, ProjectId, SchemaVersion, SessionId } from "../ids";

export const PRODUCT_ENGINE_EVENT_TYPES = [
  "ProjectStarted",
  "ProjectPurposeModeChanged",
  "BusinessCriticIntensityChanged",
  "IntakeCaptured",
  "SessionPhaseChanged",
  "InitialSpecDrafted",
  "SpecUpdatePreviewCreated",
  "SpecVersionCreated",
  "AmbiguityAnalyzed",
  "QuestionBatchActivated",
  "QueueItemDeferred",
  "QueueItemDismissed",
  "AnswerSubmitted",
  "DecisionResolved",
  "ResearchPlanned",
  "ResearchResultImported",
  "EvidenceSynthesisRequested",
  "EvidenceSynthesized",
  "ResearchQueueCardResolved",
  "RuntimePreviewRequested",
  "RuntimeArtifactConverted",
  "CompletenessScored",
  "FounderBriefPrepared",
  "PlanningHandoffCreated",
  "PlanningHandoffBlocked",
  "Phase25ResearchComparisonCreated",
  "Phase25ResearchComparisonBlocked",
  "ExecutionAuthorityRecorded",
  "ExecutionAuthorityBlocked",
  "ChatGptBrowserDelegationRunRecorded",
  "ChatGptBrowserDelegationRunBlocked",
  "ChatGptBrowserDelegationRunFailed",
  "ChatGptBrowserDelegationRunRevoked",
  "ServicePagePermissionGranted",
  "ServicePagePermissionRevoked",
  "ServicePageActionBlocked",
  "ServicePageFinalSubmitRequested"
] as const;

export type ProductEngineEventType = (typeof PRODUCT_ENGINE_EVENT_TYPES)[number];

export interface ProductEngineEventDraft {
  readonly eventType: ProductEngineEventType;
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly sourceCommandId: CommandId;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId | null;
  readonly schemaVersion: SchemaVersion;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ProductEngineEvent extends ProductEngineEventDraft {
  readonly eventId: EventId;
  readonly sequence: number;
  readonly occurredAt: string;
}
