import type { CausationId, CommandId, CorrelationId, ProjectId, SchemaVersion, SessionId, StateVersion } from "../ids";

export const PRODUCT_ENGINE_COMMAND_TYPES = [
  "StartProject",
  "ChangeProjectPurposeMode",
  "ChangeBusinessCriticIntensity",
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
  "ResolveResearchQueueCard",
  "CreateRuntimePreview",
  "ConvertRuntimeArtifact",
  "CreateSpecUpdatePreview",
  "ResolveDecision",
  "CreateSpecVersion",
  "ScoreCompleteness",
  "PrepareFounderBrief",
  "CreatePlanningHandoff",
  "CreatePhase25ResearchComparison",
  "CreateExecutionAuthority"
] as const;

export const PROJECT_APPLICATION_COMMAND_TYPES = [
  "CreateResearchAllowlist",
  "UpdateResearchAllowlist",
  "PauseResearchAllowlist",
  "RevokeResearchAllowlist",
  "PrepareResearchDisclosure",
  "StartResearchRun",
  "CancelResearchRun",
  "RetryResearchRun"
] as const;

export const COMMAND_TYPES = [
  ...PRODUCT_ENGINE_COMMAND_TYPES,
  ...PROJECT_APPLICATION_COMMAND_TYPES
] as const;

export const COMMAND_ACTORS = ["user", "product_engine", "effect_executor", "codex_runtime", "system"] as const;

export type CommandType = (typeof COMMAND_TYPES)[number];
export type ProductEngineCommandType = (typeof PRODUCT_ENGINE_COMMAND_TYPES)[number];
export type ProjectApplicationCommandType = (typeof PROJECT_APPLICATION_COMMAND_TYPES)[number];
export type CommandActor = (typeof COMMAND_ACTORS)[number];
export type CommandPayload = Readonly<Record<string, unknown>>;

export interface ProductEngineCommand<TPayload extends CommandPayload = CommandPayload> {
  readonly commandId: CommandId;
  readonly commandType: ProductEngineCommandType;
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
