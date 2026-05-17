import { describe, expect, it } from "vitest";
import { DECISION_QUEUE_COPY, DECISION_QUEUE_PAGE_ORDER } from "./decision-queue-copy";

describe("decision queue language copy", () => {
  it("keeps every workflow page available in English and Japanese", () => {
    for (const pageId of DECISION_QUEUE_PAGE_ORDER) {
      expect(DECISION_QUEUE_COPY.en.pageMeta[pageId].label).toBeTruthy();
      expect(DECISION_QUEUE_COPY.ja.pageMeta[pageId].label).toBeTruthy();
    }
  });

  it("keeps the first-run language switch focused on English and Japanese setup", () => {
    expect(DECISION_QUEUE_COPY.en.questions.firstRunTitle).toBe("First run setup");
    expect(DECISION_QUEUE_COPY.ja.questions.firstRunTitle).toBe("最初の設定");
    expect(DECISION_QUEUE_COPY.ja.projectPurposeModeOptions.map((option) => option.mode)).toEqual([
      "business",
      "personal"
    ]);
  });
});
