import type { CausationId, CommandId, CorrelationId, ProjectId, SchemaVersion, SessionId, StateVersion } from "../ids";

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
  "PrepareFounderBrief"
] as const;

export const COMMAND_ACTORS = ["user", "product_engine", "effect_executor", "codex_runtime", "system"] as const;

export type CommandType = (typeof COMMAND_TYPES)[number];
export type CommandActor = (typeof COMMAND_ACTORS)[number];
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
  readonly causationId: CausationId | null;
  readonly correlationId: CorrelationId;
  readonly schemaVersion: SchemaVersion;
  readonly payload: TPayload;
}
