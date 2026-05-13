import { describe, expect, it } from "vitest";
import { PRODUCT_ENGINE_EVENT_TYPES } from "./events";

describe("ProductEngine event contract surface", () => {
  it("uses the closed docs/25 event examples", () => {
    expect(PRODUCT_ENGINE_EVENT_TYPES).toEqual([
      "ProjectStarted",
      "ProjectPurposeModeChanged",
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
      "ExecutionAuthorityBlocked"
    ]);
  });
});
