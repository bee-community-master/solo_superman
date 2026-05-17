import { describe, expect, it } from "vitest";
import { DECISION_QUEUE_COPY, DECISION_QUEUE_PAGE_ORDER } from "./decision-queue-copy";

describe("decision queue language copy", () => {
  it("keeps every workflow page available in English, Japanese, and Korean", () => {
    for (const pageId of DECISION_QUEUE_PAGE_ORDER) {
      expect(DECISION_QUEUE_COPY.en.pageMeta[pageId].label).toBeTruthy();
      expect(DECISION_QUEUE_COPY.ja.pageMeta[pageId].label).toBeTruthy();
      expect(DECISION_QUEUE_COPY.ko.pageMeta[pageId].label).toBeTruthy();
    }
  });

  it("keeps the first-run language switch focused on supported setup languages", () => {
    expect(DECISION_QUEUE_COPY.en.questions.firstRunTitle).toBe("First run setup");
    expect(DECISION_QUEUE_COPY.ja.questions.firstRunTitle).toBe("最初の設定");
    expect(DECISION_QUEUE_COPY.ko.questions.firstRunTitle).toBe("첫 설정");
    expect(DECISION_QUEUE_COPY.ko.projectPurposeModeOptions.map((option) => option.mode)).toEqual([
      "business",
      "personal"
    ]);
    expect(DECISION_QUEUE_COPY.ja.projectPurposeModeOptions.map((option) => option.mode)).toEqual([
      "business",
      "personal"
    ]);
  });
});
