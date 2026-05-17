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
    expect(DECISION_QUEUE_COPY.en.questions.firstRunTitle).toBe("Goal setup");
    expect(DECISION_QUEUE_COPY.ja.questions.firstRunTitle).toBe("目標設定");
    expect(DECISION_QUEUE_COPY.ko.questions.firstRunTitle).toBe("목표 설정");
    expect(DECISION_QUEUE_COPY.en.questions.chatGptLoginTitle).toBe("Sign in to ChatGPT in your browser first");
    expect(DECISION_QUEUE_COPY.ko.questions.chatGptLoginTitle).toBe("먼저 브라우저에서 ChatGPT에 로그인");
    expect(DECISION_QUEUE_COPY.en.questions.rawIdea).toBe("Idea summary");
    expect(DECISION_QUEUE_COPY.ja.questions.rawIdea).toBe("アイデア概要");
    expect(DECISION_QUEUE_COPY.ko.questions.rawIdea).toBe("아이디어 요약");
    expect(DECISION_QUEUE_COPY.en.questions.intakeAnswer).toBe("Goal description");
    expect(DECISION_QUEUE_COPY.ja.questions.intakeAnswer).toBe("目標の説明");
    expect(DECISION_QUEUE_COPY.ko.questions.intakeAnswer).toBe("목표에 대한 서술");
    expect(DECISION_QUEUE_COPY.en.questions.queueRecoveryStatusLabels.pending_refetch).toBe("Refresh pending");
    expect(DECISION_QUEUE_COPY.ja.questions.queueRecoveryStatusLabels.pending_refetch).toBe("更新待ち");
    expect(DECISION_QUEUE_COPY.ko.questions.queueRecoveryStatusLabels.pending_refetch).toBe("새로고침 대기");
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
