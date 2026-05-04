import type { CommandId, EventId, ProjectId, SchemaVersion, SessionId, StateVersion } from "../ids";

export const COMMAND_TYPES = [
  "StartProject",
  "CaptureIntake",
  "DraftInitialSpec",
  "AnalyzeAmbiguity",
  "ActivateQuestionBatch",
  "SubmitAnswer",
  "DeferQueueItem",
  "DismissQueueItem",
  "PlanResearch",
  "ImportResearchResult",
  "SynthesizeEvidence",
  "CreateRuntimePreview",
  "ConvertRuntimeArtifact",
  "CreateSpecUpdatePreview",
  "ResolveDecision",
  "CreateSpecVersion",
  "ScoreCompleteness",
  "PrepareFounderBrief",
  "effect_executor",
  "codex_runtime",
  "system"
] as const;

export type CommandType = (typeof COMMAND_TYPES)[number];
export type CommandActor = "user" | "system" | "effect_executor" | "codex_runtime";
export type CommandPayload = Readonly<Record<string, unknown>>;

export interface ProductEngineCommand<TPayload extends CommandPayload = CommandPayload> {
  readonly commandId: CommandId;
  readonly commandType: CommandType;
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly actor: CommandActor;
  readonly issuedAt: string;
  readonly idempotencyKey: string;
  readonly expectedStateVersion: StateVersion;
  readonly causationId: EventId | null;
  readonly correlationId: string;
  readonly schemaVersion: SchemaVersion;
  readonly payload: TPayload;
}
