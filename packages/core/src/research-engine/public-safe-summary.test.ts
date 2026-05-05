import { describe, expect, it } from "vitest";
import {
  buildPublicSafeResearchSummary,
  containsPrivateResearchContext,
  redactPublicSafeResearchText
} from "./public-safe-summary";

describe("public-safe research summary builder", () => {
  it("builds a 1-3 sentence disclosure payload from high-level public fields only", () => {
    const payload = buildPublicSafeResearchSummary({
      researchObjective: "Compare public onboarding flows for solo-founder validation tools.",
      productCategory: "Founder workflow assistant",
      customerProblemHypothesis: "Early founders need safer validation research before committing roadmap scope."
    });

    expect(payload).toEqual({
      researchObjective: "Compare public onboarding flows for solo-founder validation tools.",
      publicSafeSummary:
        "Product category: Founder workflow assistant. Customer/problem hypothesis: Early founders need safer validation research before committing roadmap scope. Research objective: Compare public onboarding flows for solo-founder validation tools."
    });
    expect(payload.publicSafeSummary.split(". ").length).toBeLessThanOrEqual(3);
  });

  it("keeps the research objective in the disclosure summary when context fields contain multiple sentences", () => {
    const payload = buildPublicSafeResearchSummary({
      researchObjective: "Compare public onboarding proof for solo-founder validation tools.",
      productCategory:
        "Founder workflow assistant. Secondary operational note that should not displace the objective.",
      customerProblemHypothesis:
        "Early founders need safer validation research. Extra implementation detail should stay outside disclosure."
    });

    expect(payload.publicSafeSummary).toContain(
      "Research objective: Compare public onboarding proof for solo-founder validation tools."
    );
    expect(payload.publicSafeSummary).not.toContain("Secondary operational note");
    expect(payload.publicSafeSummary).not.toContain("Extra implementation detail");
    expect(payload.publicSafeSummary.split(". ").length).toBeLessThanOrEqual(3);
  });

  it("redacts secrets, contact details, private names, partners, and document refs", () => {
    const payload = buildPublicSafeResearchSummary({
      researchObjective:
        "Research ACME Ventures onboarding gap for founder@example.com with token=secret-value and partner StealthCo.",
      productCategory: "B2B workflow assistant",
      customerProblemHypothesis: "Pilot customer Jane Founder needs support from StealthCo research notes.",
      rawIdea: "Full raw idea should never be copied into automatic disclosure.",
      detailedAnswers: ["Jane Founder described private willingness-to-pay details."],
      privateCustomerNames: ["Jane Founder"],
      unreleasedPartnerNames: ["StealthCo"],
      contactDetails: ["founder@example.com"],
      privateDocumentRefs: ["doc_private_001"]
    });

    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain("founder@example.com");
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("Jane Founder");
    expect(serialized).not.toContain("StealthCo");
    expect(serialized).not.toContain("Full raw idea");
    expect(serialized).not.toContain("willingness-to-pay");
    expect(payload.publicSafeSummary).toContain("[redacted contact]");
    expect(payload.publicSafeSummary).toContain("[redacted secret]");
    expect(payload.publicSafeSummary).toContain("[redacted private context]");
  });

  it("flags private context material even when a safe summary can still be previewed", () => {
    expect(
      containsPrivateResearchContext({
        researchObjective: "Find public docs.",
        rawIdea: "Private founder idea"
      })
    ).toBe(true);

    expect(
      containsPrivateResearchContext({
        researchObjective: "Find public docs.",
        productCategory: "Public-safe category"
      })
    ).toBe(false);
  });

  it("redacts source refs and other audit strings with the same public-safe rules", () => {
    const redacted = redactPublicSafeResearchText(
      "https://docs.example.com/report?token=secret-value for Jane Founder at founder@example.com and doc_private_001",
      {
        researchObjective: "Find public docs.",
        privateCustomerNames: ["Jane Founder"],
        contactDetails: ["founder@example.com"],
        privateDocumentRefs: ["doc_private_001"]
      }
    );

    expect(redacted).toBe(
      "https://docs.example.com/report?[redacted secret] for [redacted private context] at [redacted contact] and [redacted private context]"
    );
  });
});
