import { describe, expect, it } from "vitest";
import { CLARIFICATION_PIPELINE_SMOKE, runClarificationPipelineSmoke } from "./clarification-pipeline-smoke";

describe("clarification pipeline smoke", () => {
  it("proves the idea to questions, answer, debt, and planning blocker path", async () => {
    const evidence = await runClarificationPipelineSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: CLARIFICATION_PIPELINE_SMOKE,
      mode: "fixture",
      clarification: expect.objectContaining({
        answeredQuestionCount: 1,
        completenessStatus: "not_ready",
        questionDebtGatePassed: false,
        planningHandoffStatus: "source_trace_incomplete"
      })
    });
    expect(evidence.clarification?.generatedQuestionCount).toBeGreaterThanOrEqual(10);
    expect(evidence.clarification?.activeQuestionCount).toBeGreaterThanOrEqual(1);
    expect(evidence.clarification?.followUpQuestionCount).toBeGreaterThanOrEqual(1);
    expect(evidence.clarification?.researchTaskCount).toBeGreaterThanOrEqual(1);
    expect(evidence.checked).toEqual(
      expect.arrayContaining([
        "initial Living Product Spec drafted and analyzed",
        "active question batch generated with progress metrics",
        "answer submission moved one active question and created follow-up debt",
        "completeness projection keeps question debt blocking planning readiness",
        "Planning Handoff blocker artifact stays non-final until source traces are complete"
      ])
    );
  });
});
