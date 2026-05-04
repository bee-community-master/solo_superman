import { describe, expect, it } from "vitest";
import { COMMAND_ACTORS, COMMAND_TYPES } from "./commands";

const DOCS_25_COMMAND_TYPES = [
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

describe("ProductEngine command contract placeholders", () => {
  it("keeps docs/25 CommandActor values available", () => {
    expect(COMMAND_ACTORS).toEqual(["user", "product_engine", "effect_executor", "codex_runtime", "system"]);
  });

  it("keeps docs/25 CommandType values closed and unique", () => {
    expect(new Set(COMMAND_TYPES).size).toBe(COMMAND_TYPES.length);
    expect(COMMAND_TYPES).toEqual(DOCS_25_COMMAND_TYPES);
  });
});
