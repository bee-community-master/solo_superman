declare const brand: unique symbol;

export type Brand<TValue, TBrand extends string> = TValue & { readonly [brand]: TBrand };

export type ProjectId = Brand<string, "ProjectId">;
export type SessionId = Brand<string, "SessionId">;
export type QueueItemId = Brand<string, "QueueItemId">;
export type QuestionId = Brand<string, "QuestionId">;
export type DecisionId = Brand<string, "DecisionId">;
export type ResearchTaskId = Brand<string, "ResearchTaskId">;
export type ResearchResultId = Brand<string, "ResearchResultId">;
export type ResearchAllowlistId = Brand<string, "ResearchAllowlistId">;
export type ResearchConnectorId = Brand<string, "ResearchConnectorId">;
export type EvidenceItemId = Brand<string, "EvidenceItemId">;
export type SpecVersionId = Brand<string, "SpecVersionId">;
export type RuntimeArtifactId = Brand<string, "RuntimeArtifactId">;
export type EffectTaskId = Brand<string, "EffectTaskId">;
export type EventId = Brand<string, "EventId">;
export type CommandId = Brand<string, "CommandId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type CausationId = CommandId | EventId;
export type StateVersion = Brand<number, "StateVersion">;
export type ProjectionVersion = Brand<number, "ProjectionVersion">;
export type SchemaVersion = Brand<string, "SchemaVersion">;

export * from "./schemas";
