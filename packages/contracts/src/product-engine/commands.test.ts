import { describe, expect, it } from "vitest";
import {
  COMMAND_ACTORS,
  COMMAND_TYPES,
  PRODUCT_ENGINE_COMMAND_TYPES,
  PROJECT_APPLICATION_COMMAND_TYPES
} from "./commands";

const DOCS_25_PRODUCT_ENGINE_COMMAND_TYPES = [
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

const DOCS_25_PROJECT_APPLICATION_COMMAND_TYPES = [
  "CreateResearchAllowlist",
  "UpdateResearchAllowlist",
  "PauseResearchAllowlist",
  "RevokeResearchAllowlist",
  "PrepareResearchDisclosure",
  "StartResearchRun",
  "CancelResearchRun",
  "RetryResearchRun"
] as const;

const DOCS_25_COMMAND_TYPES = [
  ...DOCS_25_PRODUCT_ENGINE_COMMAND_TYPES,
  ...DOCS_25_PROJECT_APPLICATION_COMMAND_TYPES
] as const;

describe("ProductEngine command contract surface", () => {
  it("keeps docs/25 CommandActor values available", () => {
    expect(COMMAND_ACTORS).toEqual(["user", "product_engine", "effect_executor", "codex_runtime", "system"]);
  });

  it("keeps docs/25 CommandType values closed and unique", () => {
    expect(new Set(COMMAND_TYPES).size).toBe(COMMAND_TYPES.length);
    expect(COMMAND_TYPES).toEqual(DOCS_25_COMMAND_TYPES);
  });

  it("keeps project-level application commands out of the session-scoped reducer taxonomy", () => {
    expect(PRODUCT_ENGINE_COMMAND_TYPES).toEqual(DOCS_25_PRODUCT_ENGINE_COMMAND_TYPES);
    expect(PROJECT_APPLICATION_COMMAND_TYPES).toEqual(DOCS_25_PROJECT_APPLICATION_COMMAND_TYPES);
  });
});
