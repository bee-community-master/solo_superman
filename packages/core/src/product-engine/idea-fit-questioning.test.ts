import { describe, expect, it } from "vitest";
import {
  domainDerivedAnswerOptionsForTopic,
  extractIdeaFitDomainSignals,
  ideaFitDomainAnchorTerms,
  scoreIdeaFitDimensions,
  selectWeakestExecutionChangingDimension,
  textHasDisallowedGenericPersona,
  textHasIdeaFitDomainAnchor
} from "./idea-fit-questioning";

describe("Idea-Fit Single-Judgment Questioning helpers", () => {
  it("extracts apartment ingredient exchange domain signals without relying on registered profiles", () => {
    const signals = extractIdeaFitDomainSignals({
      rawIdea: "아파트 주민이 남은 식재료를 교환하는 앱",
      intakeGoal: "주민들이 버리는 식재료를 줄이고 안전하게 교환할 첫 사용자를 정한다."
    });

    expect(ideaFitDomainAnchorTerms(signals).join("\n")).toMatch(/아파트|주민|식재료|교환/u);
    expect(textHasIdeaFitDomainAnchor("식재료를 내놓는 아파트 주민", signals)).toBe(true);
    expect(textHasDisallowedGenericPersona("초기 창업자", signals)).toBe(true);
  });

  it("derives concrete domain options only when enough idea anchors exist", () => {
    const apartmentSignals = extractIdeaFitDomainSignals({
      rawIdea: "아파트 주민이 남은 식재료를 교환하는 앱"
    });
    const apartmentOptions = domainDerivedAnswerOptionsForTopic(
      "primary_customer_narrowing",
      "choice",
      apartmentSignals
    );

    expect(apartmentOptions).toHaveLength(3);
    expect(apartmentOptions.map((option) => option.label).join("\n")).toMatch(/주민/u);
    expect(apartmentOptions.map((option) => option.label).join("\n")).toMatch(/식재료|교환/u);

    const vagueSignals = extractIdeaFitDomainSignals({ rawIdea: "더 좋은 앱" });

    expect(domainDerivedAnswerOptionsForTopic("primary_customer_narrowing", "choice", vagueSignals)).toEqual([]);
  });

  it("selects the weakest execution-changing floor gate from dimension scores", () => {
    const signals = extractIdeaFitDomainSignals({
      rawIdea: "아파트 주민이 남은 식재료를 교환하는 앱",
      intakeGoal: "첫 검증 범위와 성공 기준은 아직 정하지 않았다."
    });
    const weakest = selectWeakestExecutionChangingDimension(scoreIdeaFitDimensions(signals));

    expect(weakest?.dimension).toBe("scope");
  });
});
