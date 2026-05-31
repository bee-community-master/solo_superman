import { describe, expect, it } from "vitest";
import { buildGeneratedAmbiguityQuestionPrompt } from "./generated-ambiguity-question-prompt";

describe("generated ambiguity question prompt", () => {
  it("asks generated questions to keep idea and goal context separate from short beginner-friendly question text", () => {
    const prompt = buildGeneratedAmbiguityQuestionPrompt({
      rawIdea: "반려동물의 요람에서 무덤까지 관리하는 앱",
      intakeGoal: "보호자가 한곳에서 정보를 관리하고 운영자는 돈을 벌고 싶다.",
      projectPurposeMode: "business",
      reviewAxes: []
    });

    expect(prompt).toContain("Do not prefix questionText with the full idea or goal");
    expect(prompt).toContain("the UI shows idea and goal separately");
    expect(prompt).toContain("who to ask or show this to this week");
    expect(prompt).toContain("why someone would hesitate to pay");
    expect(prompt).toContain("paid intent, proxy, or validation experiment");
  });
});
