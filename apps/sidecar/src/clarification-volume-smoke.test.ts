import { describe, expect, it } from "vitest";
import { CLARIFICATION_VOLUME_SMOKE, runClarificationVolumeSmoke } from "./clarification-volume-smoke";

describe("clarification volume smoke", () => {
  it("proves the founder clarification loop can answer 200+ questions while keeping active batches bounded", async () => {
    const evidence = await runClarificationVolumeSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: CLARIFICATION_VOLUME_SMOKE,
      mode: "fixture",
      volume: expect.objectContaining({
        targetAnsweredQuestionCount: 200,
        finalCompletionPercent: 100,
        finalFollowUpBudgetRemainingCount: 0,
        maxActiveQuestionCount: 1,
        maxRepeatDepth: 16
      })
    });
    expect(evidence.volume?.initialFollowUpBudgetRemainingCount).toBeGreaterThanOrEqual(200);
    expect(evidence.volume?.answeredQuestionCountAtTarget).toBeGreaterThanOrEqual(200);
    expect(evidence.volume?.finalAnsweredQuestionCount).toBeGreaterThanOrEqual(200);
    expect(evidence.volume?.finalFollowUpQuestionCount).toBeGreaterThanOrEqual(200);
    expect(evidence.volume?.researchTaskCount).toBeGreaterThanOrEqual(200);
    expect(evidence.volume?.minActiveQuestionCountBeforeTarget).toBeGreaterThanOrEqual(1);
    expect(evidence.checked).toEqual(
      expect.arrayContaining([
        "initial follow-up budget supports 200+ answerable questions",
        "active question flow stayed bounded to one visible question by default",
        "active batch refilled until at least 200 answers were accepted",
        "question progress reached 100% after answerable debt was exhausted"
      ])
    );
  });
});
