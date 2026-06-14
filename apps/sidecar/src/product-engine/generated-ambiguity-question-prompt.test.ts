import { describe, expect, it } from "vitest";
import {
  buildGeneratedAmbiguityQuestionPrompt,
  renderGeneratedAmbiguityQuestionPromptTemplate
} from "./generated-ambiguity-question-prompt";

describe("generated ambiguity question prompt", () => {
  it("renders configured question count, axes, language, dimension priority, and keyword expansions", () => {
    const prompt = renderGeneratedAmbiguityQuestionPromptTemplate(
      [
        "Question count: {{minimumQuestionCount}}-{{maximumQuestionCount}}",
        "Language: {{preferredOutputLanguage}}",
        "Axes: {{reviewAxes}}",
        "Critic: {{businessCriticIntensity}}",
        "Priority: {{ambiguityDimensionPriority}}",
        "Keywords:",
        "{{domainKeywordExpansions}}"
      ].join("\n"),
      {
        rawIdea: "반려동물 전생애주기 통합 관리 앱",
        intakeGoal: "한국 보호자 시장 검증",
        projectPurposeMode: "business",
        businessCriticIntensity: "strong",
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
    expect(prompt).toContain("Critic: strong");
    expect(prompt).toContain("buyer/user split, insurance workflow");
    expect(prompt).toContain("assumption_pressure -> scope -> goal");
    expect(prompt).toContain("- 반려동물: pet, companion animal");
  });

  it("asks generated questions to keep idea and goal context separate from short beginner-friendly question text", () => {
    const prompt = buildGeneratedAmbiguityQuestionPrompt({
      rawIdea: "반려동물의 요람에서 무덤까지 관리하는 앱",
      intakeGoal: "보호자가 한곳에서 정보를 관리하고 운영자는 돈을 벌고 싶다.",
      projectPurposeMode: "business",
      businessCriticIntensity: "investor_grade",
      reviewAxes: []
    });

    expect(prompt).toContain("Do not prefix questionText with the full idea or goal");
    expect(prompt).toContain("the UI shows idea and goal separately");
    expect(prompt).toContain("usage situation, expected planning artifact");
    expect(prompt).toContain("Do not force a pressure question into the first set");
    expect(prompt).toContain("Business critic intensity: investor_grade");
    expect(prompt).not.toContain('businessCriticPressureKind "investor_pressure_pass"');
    expect(prompt).toContain('Avoid standalone jargon like "paid intent", "pricing pressure", "retention proxy", or "validation experiment"');
  });
});
