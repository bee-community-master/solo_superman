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
    expect(DECISION_QUEUE_PAGE_ORDER[0]).toBe("onboarding");
    expect(DECISION_QUEUE_COPY.en.pageMeta.onboarding.label).toBe("Onboarding");
    expect(DECISION_QUEUE_COPY.ja.pageMeta.onboarding.label).toBe("オンボーディング");
    expect(DECISION_QUEUE_COPY.ko.pageMeta.onboarding.label).toBe("온보딩");
    expect(DECISION_QUEUE_COPY.en.pageMeta.questions.description).toBe(
      "Answer active questions, review upcoming questions, and keep known risks visible."
    );
    expect(DECISION_QUEUE_COPY.ko.pageMeta.questions.description).toBe(
      "현재 질문, 다음 질문, 알려진 리스크를 한곳에서 정리합니다."
    );
    expect(DECISION_QUEUE_COPY.en.questions.firstRunTitle).toBe("Goal setup");
    expect(DECISION_QUEUE_COPY.ja.questions.firstRunTitle).toBe("目標設定");
    expect(DECISION_QUEUE_COPY.ko.questions.firstRunTitle).toBe("목표 설정");
    expect(DECISION_QUEUE_COPY.en.questions.chatGptLoginTitle).toBe("Sign in to ChatGPT in your browser first");
    expect(DECISION_QUEUE_COPY.ko.questions.chatGptLoginTitle).toBe("먼저 브라우저에서 ChatGPT에 로그인");
    expect(DECISION_QUEUE_COPY.en.questions.codexLoginTitle).toBe(
      "Sign in to Codex CLI for backend questions and research"
    );
    expect(DECISION_QUEUE_COPY.en.questions.codexLoginStart).toBe("Open Codex login");
    expect(DECISION_QUEUE_COPY.ja.questions.codexLoginStart).toBe("Codexログインを開く");
    expect(DECISION_QUEUE_COPY.ko.questions.codexLoginStart).toBe("Codex 로그인 열기");
    expect(DECISION_QUEUE_COPY.ko.questions.codexLoginStatusLabels.authenticated).toBe("로그인됨");
    expect(DECISION_QUEUE_COPY.en.layout.sidecarUnavailableRecovery).toContain("pnpm start:local");
    expect(DECISION_QUEUE_COPY.ja.layout.sidecarUnavailableRecovery).toContain("pnpm start:local");
    expect(DECISION_QUEUE_COPY.ko.layout.sidecarUnavailableRecovery).toContain("pnpm start:local");
    expect(DECISION_QUEUE_COPY.en.questions.rawIdea).toBe("Idea summary");
    expect(DECISION_QUEUE_COPY.ja.questions.rawIdea).toBe("アイデア概要");
    expect(DECISION_QUEUE_COPY.ko.questions.rawIdea).toBe("아이디어 요약");
    expect(DECISION_QUEUE_COPY.en.questions.intakeAnswer).toBe("Goal description");
    expect(DECISION_QUEUE_COPY.ja.questions.intakeAnswer).toBe("目標の説明");
    expect(DECISION_QUEUE_COPY.ko.questions.intakeAnswer).toBe("목표에 대한 서술");
    expect(DECISION_QUEUE_COPY.en.questions.initialResearchPermission).toBe("Research permission");
    expect(DECISION_QUEUE_COPY.ko.questions.initialResearchPermission).toBe("리서치 권한");
    expect(DECISION_QUEUE_COPY.ko.questions.refreshQuestionList).toBe("질문 목록 새로고침");
    expect(DECISION_QUEUE_COPY.ko.questions.loadNextQuestions).toBe("다음 질문 불러오기");
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
