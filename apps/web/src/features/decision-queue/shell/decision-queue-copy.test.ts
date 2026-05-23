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
    expect(DECISION_QUEUE_COPY.en.questions.questionProgressActive).toBe("Active now");
    expect(DECISION_QUEUE_COPY.ja.questions.questionProgressActive).toBe("回答中");
    expect(DECISION_QUEUE_COPY.ko.questions.questionProgressActive).toBe("지금 답할 질문");
    expect(DECISION_QUEUE_COPY.en.questions.questionProgressUpcoming).toBe("Upcoming next");
    expect(DECISION_QUEUE_COPY.ja.questions.questionProgressUpcoming).toBe("次の質問");
    expect(DECISION_QUEUE_COPY.ko.questions.questionProgressUpcoming).toBe("다음 질문");
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
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerPlan).toBe("Local worker bounded plan");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerPlanExecutionAuthority).toBe("実行権限");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerPlanAllowedWriteScope).toBe("허용된 쓰기 범위");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeAdapterVersion).toBe("Runtime adapter");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeEvidenceDetails).toBe("Runtime evidence details");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeExecutionMode).toBe("Execution mode");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeLiveTurnStates.disabled).toBe("disabled");
    expect(DECISION_QUEUE_COPY.ja.implementation.runtimeGeneratedSchemaVersion).toBe("生成schema version");
    expect(DECISION_QUEUE_COPY.ja.implementation.runtimeManualHandoffStates.available).toBe("利用可能");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeTransport).toBe("Transport");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeManualHandoff).toBe("수동 인계");
    expect(DECISION_QUEUE_COPY.en.handoff.title).toBe("Planning Handoff");
    expect(DECISION_QUEUE_COPY.ja.handoff.title).toBe("計画引き継ぎ");
    expect(DECISION_QUEUE_COPY.ko.handoff.title).toBe("계획 인계");
    expect(DECISION_QUEUE_COPY.en.phase15b.viewModel.statusVisible).toBe("Execution readiness notes visible");
    expect(DECISION_QUEUE_COPY.ja.phase15b.viewModel.statusVisible).toBe("実行準備ノートあり");
    expect(DECISION_QUEUE_COPY.ko.phase15b.viewModel.statusVisible).toBe("실행 준비 노트 있음");
    expect(DECISION_QUEUE_COPY.en.phase15b.viewModel.summaryVisible(2)).toContain(
      "2 execution readiness notes"
    );
    expect(DECISION_QUEUE_COPY.ja.phase15b.viewModel.summaryVisible(2)).toContain("2 件の実行準備ノート");
    expect(DECISION_QUEUE_COPY.ko.phase15b.viewModel.summaryVisible(2)).toContain("2개 실행 준비 노트");
    expect(DECISION_QUEUE_COPY.en.phase15b.viewModel.noExecutionUnloaded).toContain("credentials");
    expect(DECISION_QUEUE_COPY.ja.phase15b.viewModel.noExecutionUnloaded).toContain("認証情報");
    expect(DECISION_QUEUE_COPY.ko.phase15b.viewModel.noExecutionUnloaded).toContain("인증 정보");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerRuntimeAdapterVersion).toBe("Runtime adapter");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerRuntimeGeneratedSchemaVersion).toBe("生成schema version");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerRuntimeTransport).toBe("Transport");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.missingExecutionAuthority).toContain("ExecutionAuthorityRecord");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordStageTick).toBe("Record current stage tick");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.startStage).toBe("Start current stage");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.pauseStage).toBe("Pause current stage");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.blockStage).toBe("Block current stage");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.completeWorkerJob).toBe("Complete worker from ledger");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordPullRequestOpenDryRun).toBe("Record PR open dry-run");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.recordPullRequestOpenDryRun).toContain("PR 생성");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.recordStageTick).toContain("현재 단계");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.blockStage).toContain("차단");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.completeWorkerJob).toContain("worker 완료");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordGitHubIssueDryRun).toBe("Record GitHub issue dry-run");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.applyGitHubIssueCreation).toContain("승인된 GitHub issue");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.applyPullRequestOpen).toBe("Apply approved PR open");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.applyPullRequestOpen).toContain("승인된 PR 생성");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordPullRequestMergeDryRun).toBe("Record PR merge dry-run");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.recordPullRequestMergeDryRun).toContain("PR merge");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.applyPullRequestBodyUpdate).toBe("Apply approved PR body update");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.applyPullRequestMerge).toContain("승인된 PR merge");
  });
});
