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
    expect(DECISION_QUEUE_COPY.en.pageMeta.onboarding.shortLabel).toBe("Onboard");
    expect(DECISION_QUEUE_COPY.en.pageMeta.implementation.shortLabel).toBe("Build");
    expect(DECISION_QUEUE_COPY.ko.pageMeta.onboarding.shortLabel).toBe("시작");
    expect(DECISION_QUEUE_COPY.ko.pageMeta.implementation.shortLabel).toBe("구현");
    expect(
      DECISION_QUEUE_PAGE_ORDER.map((pageId) => DECISION_QUEUE_COPY.en.pageMeta[pageId].shortLabel)
    ).not.toEqual(["O", "Q", "R", "P", "I", "A"]);
    expect(DECISION_QUEUE_COPY.ko.layout.localServiceConnected).toBe("로컬 서비스 연결됨");
    expect(DECISION_QUEUE_COPY.ko.layout.localServiceUnavailableStatus).toBe("로컬 서비스 연결 필요");
    expect(DECISION_QUEUE_COPY.ko.layout.workspaceStatus).toBe("작업공간");
    expect(DECISION_QUEUE_COPY.ko.nav.planningPending).toBe("인계 대기");
    expect(DECISION_QUEUE_COPY.ko.nav.implementationLedgerStatusLabels.not_started).toBe("시작 전");
    expect(DECISION_QUEUE_COPY.ko.layout.diagnosticDetails).toBe("진단 세부 정보");
    expect(DECISION_QUEUE_COPY.ja.pageMeta.onboarding.label).toBe("オンボーディング");
    expect(DECISION_QUEUE_COPY.ko.pageMeta.onboarding.label).toBe("온보딩");
    expect(DECISION_QUEUE_COPY.en.pageMeta.questions.description).toBe(
      "Answer active questions, review upcoming questions, and keep known risks visible."
    );
    expect(DECISION_QUEUE_COPY.ko.pageMeta.questions.description).toBe(
      "현재 질문, 다음 질문, 나중에 확인할 항목을 한곳에서 정리합니다."
    );
    expect(DECISION_QUEUE_COPY.en.questions.firstRunTitle).toBe("Goal setup");
    expect(DECISION_QUEUE_COPY.ja.questions.firstRunTitle).toBe("目標設定");
    expect(DECISION_QUEUE_COPY.ko.questions.firstRunTitle).toBe("목표 설정");
    expect(DECISION_QUEUE_COPY.en.questions.chatGptLoginTitle).toBe("Sign in to ChatGPT in your browser first");
    expect(DECISION_QUEUE_COPY.ko.questions.chatGptLoginTitle).toBe("먼저 브라우저에서 ChatGPT에 로그인");
    expect(DECISION_QUEUE_COPY.en.questions.codexLoginTitle).toBe(
      "Confirm Codex CLI login for question and research prep"
    );
    expect(DECISION_QUEUE_COPY.en.questions.codexLoginStart).toBe("Open Codex login");
    expect(DECISION_QUEUE_COPY.ja.questions.codexLoginStart).toBe("Codexログインを開く");
    expect(DECISION_QUEUE_COPY.ko.questions.codexLoginStart).toBe("Codex 로그인 열기");
    expect(DECISION_QUEUE_COPY.ko.questions.codexLoginStatusLabels.authenticated).toBe("로그인됨");
    expect(DECISION_QUEUE_COPY.en.questions.initialQueueStartBlockers.chatgpt_login).toContain("ChatGPT");
    expect(DECISION_QUEUE_COPY.en.questions.initialQueueStartBlockers.project_purpose).not.toMatch(/[가-힣]/u);
    expect(DECISION_QUEUE_COPY.ja.questions.initialQueueStartBlockers.codex_login).toContain("Codex CLI");
    expect(DECISION_QUEUE_COPY.ko.questions.initialQueueStartBlockers.idea).toContain("아이디어 요약");
    expect(DECISION_QUEUE_COPY.en.questions.sessionActionErrors.businessCriticIntensityBusinessOnly).not.toMatch(
      /[가-힣]/u
    );
    expect(DECISION_QUEUE_COPY.ja.questions.sessionActionErrors.activeSessionRequiredSubmitAnswer).toContain(
      "セッション"
    );
    expect(DECISION_QUEUE_COPY.ko.questions.sessionActionErrors.answerTextRequired).toContain("답변");
    expect(DECISION_QUEUE_COPY.en.questions.sessionActionLabels.createProject).not.toMatch(/[가-힣]/u);
    expect(DECISION_QUEUE_COPY.ja.questions.sessionActionLabels.resolveResearchCard("revised")).toContain(
      "リサーチカード"
    );
    expect(DECISION_QUEUE_COPY.ko.questions.sessionActionLabels.loadNextQuestions).toContain("다음 질문");
    expect(
      DECISION_QUEUE_COPY.en.questions.sessionActionReasons.projectPurposeConfirmed("Business validation")
    ).not.toMatch(/[가-힣]/u);
    expect(
      DECISION_QUEUE_COPY.ja.questions.sessionActionReasons.businessCriticIntensityChanged("強い事業レビュー")
    ).toContain("強い事業レビュー");
    expect(
      DECISION_QUEUE_COPY.ko.questions.sessionActionReasons.businessCriticKnownRiskDeferred
    ).toContain("나중에 확인");
    expect(DECISION_QUEUE_COPY.en.layout.sidecarUnavailableRecovery).toContain("pnpm start:local");
    expect(DECISION_QUEUE_COPY.ja.layout.sidecarUnavailableRecovery).toContain("pnpm start:local");
    expect(DECISION_QUEUE_COPY.ko.layout.sidecarUnavailableRecovery).toContain("pnpm start:local");
    expect(DECISION_QUEUE_COPY.en.questions.rawIdea).toBe("Idea summary");
    expect(DECISION_QUEUE_COPY.ja.questions.rawIdea).toBe("アイデア概要");
    expect(DECISION_QUEUE_COPY.ko.questions.rawIdea).toBe("아이디어 요약");
    expect(DECISION_QUEUE_COPY.en.questions.intakeAnswer).toBe("Goal description");
    expect(DECISION_QUEUE_COPY.ja.questions.intakeAnswer).toBe("目標の説明");
    expect(DECISION_QUEUE_COPY.ko.questions.intakeAnswer).toBe("목표에 대한 서술");
    expect(DECISION_QUEUE_COPY.en.questions.initialResearchAutomationPermission).toBe("Research setup");
    expect(DECISION_QUEUE_COPY.ko.questions.initialResearchAutomationPermission).toBe("리서치 설정");
    expect(DECISION_QUEUE_COPY.ko.questions.initialResearchAutomationPermissionHelp).toContain("이 한 가지 설정");
    expect(DECISION_QUEUE_COPY.en.research.researchActionErrors.readyRunsMissingAllowlist).toContain("public web research sources");
    expect(DECISION_QUEUE_COPY.en.research.researchActionErrors.activeProjectRequiredStartRun).not.toMatch(
      /[가-힣]/u
    );
    expect(DECISION_QUEUE_COPY.ja.research.researchActionErrors.plannedTaskRequiredStartRun).toContain(
      "リサーチ"
    );
    expect(DECISION_QUEUE_COPY.ko.research.researchActionErrors.backgroundStartAfterAnswerFailed("boom")).toContain(
      "자동 공개 웹 리서치"
    );
    expect(DECISION_QUEUE_COPY.en.research.researchActionLabels.startPublicWebResearchRun).not.toMatch(/[가-힣]/u);
    expect(DECISION_QUEUE_COPY.ja.research.researchActionLabels.cancelRun).toContain("リサーチ");
    expect(DECISION_QUEUE_COPY.ko.research.researchActionLabels.retryRun).toContain("재시도");
    expect(DECISION_QUEUE_COPY.ko.research.researchActionLabels.updateMaxSessionRuns).toContain("세션");
    expect(DECISION_QUEUE_COPY.ko.research.researchActionErrors.maxSessionRunsInvalid).toContain(
      "세션당 최대 리서치 실행 수"
    );
    expect(DECISION_QUEUE_COPY.ko.research.researchActionReasons.cancelRun).toContain("취소");
    expect(DECISION_QUEUE_COPY.en.research.taskStatusLabels.needs_review).toBe("Needs review");
    expect(DECISION_QUEUE_COPY.ko.research.taskStatusLabels.needs_review).toBe("검토 필요");
    expect(DECISION_QUEUE_COPY.en.research.reviewCardTypeLabels.follow_up_question).toBe("Follow-up question");
    expect(DECISION_QUEUE_COPY.ko.research.reviewCardTypeLabels.follow_up_question).toBe("후속 질문");
    expect(DECISION_QUEUE_COPY.en.research.terminalOutcomeLabels.risk_accepted).toBe("Accept risk");
    expect(DECISION_QUEUE_COPY.ko.research.terminalOutcomeLabels.risk_accepted).toBe("리스크 수용");
    expect(DECISION_QUEUE_COPY.en.research.balanceStatusLabels.missing_con_evidence).toBe("Missing counter-evidence");
    expect(DECISION_QUEUE_COPY.ko.research.balanceStatusLabels.missing_con_evidence).toBe("다른 관점 부족");
    expect(DECISION_QUEUE_COPY.en.research.gateCheckCodeLabels.source_reliability).toBe("Source reliability");
    expect(DECISION_QUEUE_COPY.ko.research.gateCheckStatusLabels.passed).toBe("통과");
    expect(DECISION_QUEUE_COPY.ko.questions.refreshQuestionList).toBe("질문 목록 새로고침");
    expect(DECISION_QUEUE_COPY.ko.questions.loadNextQuestions).toBe("다음 질문 불러오기");
    expect(DECISION_QUEUE_COPY.ko.questions.questionBatchSizeLabel).toBe("한 번에 볼 질문 수");
    expect(DECISION_QUEUE_COPY.en.questions.questionBatchSizeOption(4)).toBe("4 questions");
    expect(DECISION_QUEUE_COPY.ko.questions.answerFormatLabels.open_text).toBe("주관식/서술형 답변");
    expect(DECISION_QUEUE_COPY.ko.questions.answerFormatLabels.binary_choice).toBe("진행/보류 선택");
    expect(DECISION_QUEUE_COPY.ko.questions.answerFormatLabels.multi_select).toBe("하나 이상 선택");
    expect(DECISION_QUEUE_COPY.en.questions.suggestedAnswersRankedHelp).toContain("priority order");
    expect(DECISION_QUEUE_COPY.ko.questions.suggestedAnswersRankedHelp).toContain("우선순위");
    expect(DECISION_QUEUE_COPY.en.questions.answerChoiceLabels.binary_choice).toBe("Stance choices");
    expect(DECISION_QUEUE_COPY.ko.questions.answerOptionDetailLabels.single_choice).toEqual({
      primary: "정해지는 후보",
      secondary: "추가 확인할 점"
    });
    expect(DECISION_QUEUE_COPY.en.questions.answerOptionDetailLabels.multi_select).toEqual({
      primary: "Keeps in scope",
      secondary: "Check next"
    });
    expect(DECISION_QUEUE_COPY.en.phase15a.maxSessionRuns).toBe("Max research runs per session");
    expect(DECISION_QUEUE_COPY.en.phase15a.connectorLabels.public_search).toBe("Public web search");
    expect(DECISION_QUEUE_COPY.ja.phase15a.contextModeLabels.public_safe_summary).toBe("公開してよい要約のみ");
    expect(DECISION_QUEUE_COPY.ko.phase15a.sourceCategoryLabels.public_web).toBe("공개 웹사이트");
    expect(DECISION_QUEUE_COPY.en.phase15a.qualityGateStatusLabels.pending_review).toBe("Review needed");
    expect(DECISION_QUEUE_COPY.ja.phase15a.disclosureStatusLabels.automatic_payload_ready).toContain("自動リサーチ");
    expect(DECISION_QUEUE_COPY.ko.phase15a.runStatusLabels.needs_review).toBe("검토 필요");
    expect(DECISION_QUEUE_COPY.en.questions.questionProgressActive).toBe("Active now");
    expect(DECISION_QUEUE_COPY.ja.questions.questionProgressActive).toBe("回答中");
    expect(DECISION_QUEUE_COPY.ko.questions.questionProgressActive).toBe("지금 답할 질문");
    expect(DECISION_QUEUE_COPY.ko.questions.questionProgressBacklog).toBe("나중에 볼 질문");
    expect(DECISION_QUEUE_COPY.en.questions.questionProgressBacklog).toBe("Later backlog");
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
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerPlan).toBe("Local Codex task plan");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerRuntimeNextActions.enableLiveTurns).not.toContain(
      "SOLO_CODEX"
    );
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerPlanExecutionAuthority).toBe("実行権限");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerPlanAllowedWriteScope).toBe("허용된 쓰기 범위");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerExecutionModeLabels.local_sandboxed_codex).toBe(
      "local sandboxed Codex"
    );
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerExecutionModeLabels.local_sandboxed_codex).toContain(
      "ローカル"
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerExecutionModeLabels.local_sandboxed_codex).toContain(
      "로컬"
    );
    expect(DECISION_QUEUE_COPY.en.autoImplementation.actionErrors.activeRunRequiredPlanWorker).not.toMatch(
      /[가-힣]/u
    );
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.actionErrors.activeRunRequiredStartStage).toContain(
      "ワークスペース"
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.actionErrors.workspaceCreationFailed("boom")).toContain(
      "자동 구현 작업공간"
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.actionErrors.pullRequestMergeAlreadyRecorded).toContain(
      "다시 merge하지"
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.remoteStatusLabels.no_remote).toBe("원격 저장소 없음");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.runSummary(
      true,
      "/repo/workspace/demo-project",
      "no_remote"
    )).toContain("demo-project 프로젝트의 자동 구현 작업공간이 준비되었습니다");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.issueModeLabels.markdown_fallback).toBe("로컬 markdown 이슈");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.remoteStatusLabels.no_remote).toBe("リモート未接続");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.issueModeLabels.github_ready).toBe("GitHub issues ready");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.issueDocumentStatusLabels.open).toBe("열림");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.issueDocumentStatusLabels.blocked).toBe("차단됨");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerJobStatusLabels.planned).toBe("계획됨");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerJobStatusLabels.blocked).toBe("ブロック中");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.deliveryGateLabels).toContain(
      "기능 PR 코드 리뷰에서 수정할 내용 없음이 2회 연속 확인되기 전에는 merge하지 않습니다."
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.issueRowDefaultNextAction).toContain(
      "리뷰 연속 통과"
    );
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.issueRowCompletedNextAction).toContain(
      "次の小さなPR単位"
    );
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeAdapterVersion).toBe("Runtime adapter");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeEvidenceDetails).toBe("Runtime evidence details");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeExecutionMode).toBe("Execution mode");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeCodexCliVersion).toBe("Codex CLI version");
    expect(DECISION_QUEUE_COPY.en.implementation.runtimeLiveTurnStates.disabled).toBe("disabled");
    expect(DECISION_QUEUE_COPY.ja.implementation.runtimeSdkPackageVersion).toBe("SDKパッケージバージョン");
    expect(DECISION_QUEUE_COPY.ja.implementation.runtimeManualHandoffStates.available).toBe("利用可能");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeTransport).toBe("연결 방식");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeManualHandoff).toBe("수동 대체 경로");
    expect(DECISION_QUEUE_COPY.en.handoff.title).toBe("Planning Handoff");
    expect(DECISION_QUEUE_COPY.en.handoff.planningActionErrors.activeSessionRequiredScoreCompleteness).not.toMatch(
      /[가-힣]/u
    );
    expect(DECISION_QUEUE_COPY.ja.handoff.title).toBe("計画引き継ぎ");
    expect(DECISION_QUEUE_COPY.ja.handoff.planningActionErrors.activeSessionRequiredPlanningHandoff).toContain(
      "セッション"
    );
    expect(DECISION_QUEUE_COPY.ko.handoff.planningActionLabels.runPlanningHandoffGate).toContain("계획 인계");
    expect(DECISION_QUEUE_COPY.ko.handoff.title).toBe("계획 인계");
    expect(DECISION_QUEUE_COPY.ko.permissions.permissionActionErrors.activeSessionRequiredRevokeWorkspace).toContain(
      "활성 세션"
    );
    expect(DECISION_QUEUE_COPY.ja.permissions.permissionActionLabels.exportArtifactRefs).toContain("サービスページ");
    expect(DECISION_QUEUE_COPY.ko.permissions.permissionActionLabels.deleteServicePageArtifacts).toContain("삭제");
    expect(DECISION_QUEUE_COPY.en.permissions.permissionActionReasons.exportArtifactRefsNote).toContain("2FA");
    expect(
      DECISION_QUEUE_COPY.ko.permissions.permissionActionReasons.exportArtifactRefsLogMessage(3, "perm_1")
    ).toContain("3개");
    expect(DECISION_QUEUE_COPY.ja.research.visibleChatGptHandoffTitle).toBe("ChatGPT Deep Research依頼");
    expect(DECISION_QUEUE_COPY.ja.research.visibleChatGptImportHint).not.toMatch(/引き継ぎ|allowlist/u);
    expect(DECISION_QUEUE_COPY.ja.research.visibleChatGptHandoffBoundary).not.toMatch(/引き継ぎ/u);
    expect(DECISION_QUEUE_COPY.ja.research.gateStatus).toBe("確認状態");
    expect(DECISION_QUEUE_COPY.ja.phase15a.terminalReasonLabels.provider_failed).toBe("リサーチ実行失敗");
    expect(DECISION_QUEUE_COPY.ja.phase15a.qualityGateDisplay).toBe("根拠品質の確認");
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
    expect(DECISION_QUEUE_COPY.en.permissions.chatGptDelegationViewModel.visibleHandoffLabels.running).toContain(
      "visible local browser"
    );
    expect(DECISION_QUEUE_COPY.ja.permissions.chatGptDelegationViewModel.visibleHandoffLabels.running).toContain(
      "ローカルブラウザ"
    );
    expect(DECISION_QUEUE_COPY.ko.permissions.chatGptDelegationViewModel.visibleHandoffLabels.running).toContain(
      "로컬 브라우저"
    );
    expect(DECISION_QUEUE_COPY.en.permissions.artifactControlTitle).toContain("artifact control surface");
    expect(DECISION_QUEUE_COPY.ja.permissions.artifactControlTitle).toContain("資料コントロール");
    expect(DECISION_QUEUE_COPY.ko.permissions.artifactControlTitle).toContain("자료 제어");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerRuntimeAdapterVersion).toBe("Codex runtime adapter");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.workerRuntimeCodexCliVersion).toBe("Codex CLI version");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerRuntimeSdkPackageVersion).toBe(
      "SDKパッケージバージョン"
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerRuntimeTransport).toBe("연결 방식");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeStatusLabels.unavailable).toBe("사용 불가");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeExecutionModeLabels.manual_handoff).toBe("수동 대체 경로");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeAccountStatusLabels.authenticated).toBe("로그인됨");
    expect(DECISION_QUEUE_COPY.ko.implementation.startGuideHandoff).toBe("구현 계획 전달");
    expect(DECISION_QUEUE_COPY.ko.implementation.startGuideNextWorker).toContain("작은 PR 단위 작업");
    expect(DECISION_QUEUE_COPY.ko.implementation.runtimeEvidenceDetails).toBe("실행 환경 세부 정보");
    expect(DECISION_QUEUE_COPY.ja.implementation.startGuideHandoff).toBe("実装計画の引き渡し");
    expect(DECISION_QUEUE_COPY.ja.implementation.runtimeEvidenceDetails).toBe("実行環境の詳細");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerRuntimeStatusLabels.available).toBe("利用可能");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.workerRuntimeExecutionModeLabels.manual_handoff).toBe(
      "手動の代替経路"
    );
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.approveLocalWorkerAuthority).toContain("작업 승인");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.missingExecutionAuthority).toContain("ExecutionAuthorityRecord");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordStageTick).toBe("Record current stage check-in");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.startStage).toBe("Start current stage");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.pauseStage).toBe("Pause current stage");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.blockStage).toBe("Block current stage");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.completeWorkerJob).toBe("Mark task complete from result");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.importWorkerLedger).toBe("Import task result");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordPullRequestOpenDryRun).toBe("Preview PR creation");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.recordPullRequestOpenDryRun).toContain("PR 생성");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.recordStageTick).toContain("현재 단계");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.blockStage).toContain("차단");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.completeWorkerJob).toContain("작업 결과");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.workerLedgerImport).toBe("로컬 Codex 작업 결과 JSON");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.runWorkerJob).toBe("ローカルCodex作業を実行");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordGitHubIssueDryRun).toBe("Preview GitHub issue creation");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.applyGitHubIssueCreation).toContain("승인된 GitHub issue");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.githubIssueMutationStatusLabels.not_requested).toBe("not requested yet");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.githubIssueMutationStatusLabels.dry_run_ready).toBe("preview ready");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.githubIssueMutationStatusLabels.approved_ready).toBe("승인되어 생성 준비됨");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.githubIssueMutationSummary("ブロック中", "権限なし")).toBe(
      "GitHub issue作成: ブロック中 · 権限なし"
    );
    expect(DECISION_QUEUE_COPY.en.autoImplementation.applyPullRequestOpen).toBe("Apply approved PR open");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.applyPullRequestOpen).toContain("승인된 PR 생성");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.recordPullRequestMergeDryRun).toBe("Preview PR merge");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.recordPullRequestMergeDryRun).toContain("PR merge");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.applyPullRequestBodyUpdate).toBe("Apply approved PR body update");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.applyPullRequestMerge).toContain("승인된 PR merge");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.noPlanningIssueFiles).toContain("구현 계획");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.noGithubIssueUrls).toContain("로컬 markdown 이슈");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.remoteNextActionLabel(
      "Connect a GitHub remote when remote issue/PR automation is desired."
    )).toContain("GitHub 원격 저장소");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.remoteWarningLabel(
      "Remote is not connected; local markdown issues are the source of truth."
    )).toContain("원격 저장소가 연결되지 않아");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.remoteWarningLabel(
      "Remote is not connected; local markdown issues are the source of truth."
    )).toContain("ローカルMarkdown Issue");
    expect(DECISION_QUEUE_COPY.en.autoImplementation.prMutationActionLabels.update_pr_body).toBe("update PR description");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.prMutationStatusLabels.applied).toBe("적용됨");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.prMutationRequestModeLabels.dry_run).toBe("プレビューのみ");
    expect(DECISION_QUEUE_COPY.ja.autoImplementation.prMutationRequestModeLabels.approved).toBe("承認済みlive操作");
    expect(DECISION_QUEUE_COPY.ko.autoImplementation.pullRequestMutationSummary("PR 설명 업데이트", "적용됨")).toBe(
      "GitHub PR 작업: PR 설명 업데이트 · 적용됨"
    );
  });
});
