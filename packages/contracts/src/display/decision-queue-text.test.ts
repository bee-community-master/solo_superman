import { describe, expect, it } from "vitest";
import {
  localizedUserFacingDecisionQueueText,
  plainUserFacingDecisionQueueText,
  stripInternalResearchMetaText
} from "./decision-queue-text";

describe("Decision Queue display text", () => {
  it("maps source quality markers and public snippets to user-facing Korean", () => {
    const text = localizedUserFacingDecisionQueueText(
      "source_quality_insufficient: no usable source-linked finding. 2 days ago - Use this divorce financial planning checklist to organize your cash flow, documents, insurance, account updates, and next-step planning during and after divorce.",
      "ko"
    );

    expect(text).toContain("출처 품질 부족");
    expect(text).toContain("출처와 연결된 유의미한 근거");
    expect(text).toContain("최근 공개 검색 요약");
    expect(text).toContain("이혼 전후의 현금 흐름");
  });

  it("strips browser adapter metadata before display", () => {
    const text = stripInternalResearchMetaText(
      [
        "Browser-based public web search only; no login, CAPTCHA, anti-bot bypass, paid-service access, or external search API was used.",
        "Source snippets and fetched page text require quality-gate review before accepted evidence.",
        "- [supports] Users completed onboarding faster after checklist setup."
      ].join("\n")
    );

    expect(text).not.toContain("Browser-based public web search only");
    expect(text).not.toContain("quality-gate review");
    expect(text).toContain("Users completed onboarding faster");
  });

  it("normalizes retained source clues without React-specific cleanup", () => {
    const text = plainUserFacingDecisionQueueText(
      "Source clue: usable source-linked finding with current public evidence and counterexamples"
    );

    expect(text).toContain("출처와 연결된 유의미한 근거");
    expect(text).toContain("현재 공개 근거");
    expect(text).toContain("반례");
  });

  it("removes internal ids and rewrites weak evidence gates for display", () => {
    const text = localizedUserFacingDecisionQueueText(
      "Research source was insufficient for research_task_abc123. Evidence has 0 usable finding(s), below configured minimum 1. Resolve the high-impact research-updated queue card before Planning-ready.",
      "ko"
    );

    expect(text).toContain("판단에 쓸 공개 근거가 부족합니다");
    expect(text).toContain("이번 검색에서 판단에 쓸 수 있는 공개 근거를 찾지 못했습니다");
    expect(text).toContain("중요 리서치 카드를 먼저 해결하세요");
    expect(text).not.toContain("research_task_abc123");
    expect(text).not.toContain("Planning-ready");
    expect(text).not.toContain("Evidence has 0 usable");

    const refText = localizedUserFacingDecisionQueueText(
      "answer_ab12 proj_demo sess_demo cmd_demo corr_demo research_run_public_web_1",
      "ko"
    );
    expect(refText).toBe("");
  });
});
