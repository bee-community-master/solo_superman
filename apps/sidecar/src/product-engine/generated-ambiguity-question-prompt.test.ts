import { describe, expect, it } from "vitest";
import { renderGeneratedAmbiguityQuestionPromptTemplate } from "./generated-ambiguity-question-prompt";

describe("generated ambiguity question prompt", () => {
  it("renders configured question count, axes, language, dimension priority, and keyword expansions", () => {
    const prompt = renderGeneratedAmbiguityQuestionPromptTemplate(
      [
        "Question count: {{minimumQuestionCount}}-{{maximumQuestionCount}}",
        "Language: {{preferredOutputLanguage}}",
        "Axes: {{reviewAxes}}",
        "Priority: {{ambiguityDimensionPriority}}",
        "Keywords:",
        "{{domainKeywordExpansions}}"
      ].join("\n"),
      {
        rawIdea: "반려동물 전생애주기 통합 관리 앱",
        intakeGoal: "한국 보호자 시장 검증",
        projectPurposeMode: "business",
        reviewAxes: ["buyer/user split", "insurance workflow"],
        initialQuestionCount: { min: 5, max: 8 },
        ambiguityDimensions: ["assumption_pressure", "scope", "goal"],
        language: "ko",
        domainKeywordExpansions: {
          반려동물: ["pet", "companion animal"]
        }
      }
    );

    expect(prompt).toContain("Question count: 5-8");
    expect(prompt).toContain("Language: ko");
    expect(prompt).toContain("buyer/user split, insurance workflow");
    expect(prompt).toContain("assumption_pressure -> scope -> goal");
    expect(prompt).toContain("- 반려동물: pet, companion animal");
  });
});
