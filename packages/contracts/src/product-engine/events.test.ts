import { describe, expect, it } from "vitest";
import { PRODUCT_ENGINE_EVENT_TYPES } from "./events";

describe("ProductEngine event contract placeholders", () => {
  it("uses the closed docs/25 Phase 1 event examples as placeholders", () => {
    expect(PRODUCT_ENGINE_EVENT_TYPES).toEqual([
      "ProjectStarted",
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
      "RuntimePreviewRequested",
      "RuntimeArtifactConverted",
      "CompletenessScored",
      "FounderBriefPrepared"
    ]);
  });
});
