import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX,
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_SDK_PACKAGE_VERSION,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  autoImplementationWorkerExpectedChangeScope,
  autoImplementationWorkerLedgerStepDescription,
  autoImplementationWorkerRequiredEvidence,
  type AutoImplementationRun,
  type AutoImplementationRunProjection,
  type CodexRuntimeStatusDto,
  type ImplementationStepLedgerProjection
} from "@solo-superman/contracts";
import {
  AutoImplementationRunPanel,
  autoImplementationRunViewModel
} from "./AutoImplementationRunPanel";
import { renderMarkup } from "./test-rendering";
import type { AppLanguage } from "../../shared/i18n/app-language";

const FIXTURE_CODEX_CLI_VERSION = "0.137.0" as const;

function codexRuntimeStatus(
  overrides: Partial<Omit<CodexRuntimeStatusDto, "account">> & {
    readonly account?: Partial<CodexRuntimeStatusDto["account"]>;
  } = {}
): CodexRuntimeStatusDto {
  return {
    status: "unavailable",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    sdkPackageVersion: CODEX_SDK_PACKAGE_VERSION,
    codexCliVersion: FIXTURE_CODEX_CLI_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: "2026-05-23T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: false,
    executionMode: "manual_handoff",
    reason: "Codex CLI login is available, but set SOLO_CODEX_SDK_LIVE_TURNS=1 to enable preview-only live turn execution; manual handoff fallback is required until then.",
    ...overrides,
    account: {
      status: "authenticated",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      accountType: "chatgpt",
      planType: "plus",
      ...overrides.account
    }
  };
}

function prMutationRecord(
  overrides: Partial<AutoImplementationRun["pullRequestMutations"]["records"][number]> = {}
): AutoImplementationRun["pullRequestMutations"]["records"][number] {
  return {
    mutationId: "auto-pr-mutation:auto_run_demo:update_pr_body:update_1",
    action: "update_pr_body",
    requestMode: "approved",
    status: "applied",
    requiredRemoteStatus: "connected",
    mutatesGitHub: true,
    pullRequestUrl: "https://github.com/bee-community-master/demo/pull/1",
    issueLinks: ["local-001", "https://github.com/bee-community-master/demo/issues/1"],
    implementationScope: "Update the generated PR body with current review and verification evidence.",
    reviewStreakRefs: ["code-review:feature:clean-1", "code-review:repo:clean-2"],
    verificationCommands: ["pnpm verify"],
    knownGaps: ["Live browser screenshot not captured."],
    rollbackNotes: "Use gh pr edit to restore the previous PR body.",
    mergeEvidenceRefs: ["github-pr-mutation:merge:completed"],
    bodyEvidenceRefs: ["pr-body:current-evidence"],
    approval: {
      approvalId: "approval_github_pr_mutation",
      approvedBy: "local_operator",
      approvedAt: "2026-05-05T00:00:00.000Z",
      actionClass: "github_pr_mutation",
      approvalGranularity: "per_action",
      remoteStatusAtApproval: "connected",
      rollbackPlan: "Restore the previous PR body or revert the merge commit.",
      evidenceRefs: ["approval:github_pr_mutation:update_body"]
    },
    blockedReason: null,
    auditEvidenceRefs: ["github-pr-mutation:applied"],
    verifierEvidenceRefs: ["verifier:github_pr_mutation:ready"],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  };
}

type WorkerJobOverrides = Partial<Omit<AutoImplementationRun["workerJobs"][number], "executionPlan">> & {
  readonly executionPlan?: Partial<AutoImplementationRun["workerJobs"][number]["executionPlan"]>;
};

function workerJob(overrides: WorkerJobOverrides = {}): AutoImplementationRun["workerJobs"][number] {
  const { executionPlan, ...jobOverrides } = overrides;
  const base: AutoImplementationRun["workerJobs"][number] = {
    jobId: "auto-worker-job:auto_run_demo:initial_pr:job_planned",
    runId: "auto_run_demo",
    stage: "initial_pr",
    issueId: "local-001",
    issueTitle: "Workspace repo bootstrap and initial implementation PR",
    issueRelativePath: "implementation-issues/001-initial_pr.md",
    status: "planned",
    executionPlan: {
      executionMode: "local_sandboxed_codex",
      workingDirectory: "/repo/workspace/demo-project",
      issueDocumentPath: "implementation-issues/001-initial_pr.md",
      executionAuthorityRef: "exec_auth_auto_worker_initial_pr",
      ledgerTrackerDoc: {
        trackerId: "auto-implementation-tracker:auto_run_demo",
        title: "demo-project implementation tracker",
        goal: AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
        sourceRefs: [
          "auto-implementation-run:auto_run_demo",
          "tracker-doc:implementation-tracker.md"
        ]
      },
      ledgerStepDoc: {
        stepId: "auto-implementation-step:auto_run_demo:initial_pr:local-001",
        title: "Workspace repo bootstrap and initial implementation PR",
        description: autoImplementationWorkerLedgerStepDescription({
          stage: "initial_pr",
          issueRelativePath: "implementation-issues/001-initial_pr.md"
        }),
        sourceRefs: [
          "auto-implementation-run:auto_run_demo",
          "auto-implementation-stage:initial_pr",
          "auto-implementation-worker-job:auto_run_demo:initial_pr:job_planned",
          "auto-implementation-issue:local-001",
          "issue-doc:implementation-issues/001-initial_pr.md"
        ],
        expectedChangeScope: autoImplementationWorkerExpectedChangeScope("initial_pr")
      },
      allowedWriteScope: ["."],
      requiredEvidence: ["ImplementationStepLedger trackerDoc and stepDoc"],
      forbiddenActions: ["credential storage"],
      sourceRefs: ["auto-implementation-run:auto_run_demo"]
    },
    blockedReason: null,
    missingEvidence: [],
    nextRequiredAction: "Run the local Codex task.",
    createdAt: "2026-05-19T00:01:00.000Z",
    updatedAt: "2026-05-19T00:01:00.000Z",
    evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_planned"]
  };

  return {
    ...base,
    ...jobOverrides,
    executionPlan: {
      ...base.executionPlan,
      ...executionPlan
    }
  };
}

function renderPanelMarkup(
  run: ReturnType<typeof autoImplementationRunViewModel>,
  options: { readonly canCreateRun?: boolean; readonly language?: AppLanguage } = {}
) {
  return renderMarkup(
    createElement(AutoImplementationRunPanel, {
      run,
      isBusy: false,
      canCreateRun: options.canCreateRun ?? true,
      onCreateRun: () => undefined,
      onPlanWorkerJob: () => undefined,
      onRecordStageTick: () => undefined,
      onStartStage: () => undefined,
      onPauseStage: () => undefined,
      onBlockStage: () => undefined,
      onCompleteWorkerJob: () => undefined,
      workerLedgerImportDraft: "",
      onWorkerLedgerImportDraftChange: () => undefined,
      onImportWorkerLedger: () => undefined,
      onRecordGitHubIssueDryRun: () => undefined,
      onApplyGitHubIssueCreation: () => undefined,
      onRecordPullRequestOpenDryRun: () => undefined,
      onRecordPullRequestDryRun: () => undefined,
      onRecordPullRequestMergeDryRun: () => undefined,
      onApplyPullRequestOpen: () => undefined,
      onApplyPullRequestBodyUpdate: () => undefined,
      onApplyPullRequestMerge: () => undefined,
      onRunWorkerJob: () => undefined,
      onAdvanceWorkerStage: () => undefined,
      onRefreshRun: () => undefined
    }),
    options.language ?? "en"
  );
}

function ledgerForWorkerJob(
  worker: AutoImplementationRun["workerJobs"][number],
  testEvidenceRefs: readonly string[]
): ImplementationStepLedgerProjection {
  const baseStep = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
  const baseTestEvidence = baseStep.testEvidenceRecord!;
  const stepId = worker.executionPlan.ledgerStepDoc.stepId;

  return {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
    trackerDoc: worker.executionPlan.ledgerTrackerDoc,
    steps: [
      {
        ...baseStep,
        stepDoc: worker.executionPlan.ledgerStepDoc,
        testEvidenceRecord: {
          ...baseTestEvidence,
          stepId,
          evidenceRefs: testEvidenceRefs
        }
      }
    ],
    testEvidenceRecords: [
      {
        ...baseTestEvidence,
        stepId,
        evidenceRefs: testEvidenceRefs
      }
    ]
  } as ImplementationStepLedgerProjection;
}

describe("AutoImplementationRunPanel view model", () => {
  it("shows workspace, five-minute stages, markdown issues, and remote guide", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);

    expect(view.status).toBe("pending");
    expect(view.workspaceLabel).toContain("/repo/workspace/demo-project");
    expect(view.nextTickLabel).toContain("2026-05-19T00:05:00.000Z");
    expect(view.issueModeLabel).toContain("local markdown issues");
    expect(view.issueStatusSummaryLabel).toBe("Issue status summary: 0 completed / 0 need attention / 7 open / 7 total");
    expect(view.githubIssueMutationLabel).toContain("not_requested");
    expect(view.githubIssueMutationStatus).toBe("not_requested");
    expect(view.githubIssueMutationBlockedReason).toBeNull();
    expect(view.githubIssuePlans[0]!.bodyMarkdownPath).toContain("implementation-issues/001-initial_pr.md");
    expect(view.githubCreatedIssueUrls).toEqual([]);
    expect(view.pullRequestMutationLabel).toBe("GitHub PR action: no records");
    expect(view.pullRequestMutationHistoryCount).toBe(0);
    expect(view.latestPullRequestMutation).toBeNull();
    expect(view.latestWorkerJobLabel).toBe("Local Codex task: not planned");
    expect(view.latestWorkerJobNextAction).toContain("current stage issue document");
    expect(view.latestWorkerPlan).toBeNull();
    expect(view.stageProgress).toEqual({
      completedStageCount: 0,
      totalStageCount: 7,
      currentStage: "initial_pr",
      currentStageStatus: "ready"
    });
    expect(view.reviewLoopProgress).toEqual({
      completedReviewLoopCount: 0,
      totalReviewLoopCount: 4,
      nextReviewLoopStage: "code_review_fix_1"
    });
    expect(view.currentStageGates).toEqual(
      expect.arrayContaining([expect.stringContaining("Create the smallest behavior-complete implementation")])
    );
    expect(view.canPlanWorkerJob).toBe(true);
    expect(view.canRecordStageTick).toBe(true);
    expect(view.canStartStage).toBe(true);
    expect(view.canPauseStage).toBe(false);
    expect(view.canBlockStage).toBe(true);
    expect(view.canCompleteWorkerJob).toBe(false);
    expect(view.canRecordGitHubIssueDryRun).toBe(true);
    expect(view.canApplyGitHubIssueCreation).toBe(false);
    expect(view.canRecordPullRequestDryRun).toBe(true);
    expect(view.canApplyPullRequestOpen).toBe(false);
    expect(view.canApplyPullRequestBodyUpdate).toBe(false);
    expect(view.canApplyPullRequestMerge).toBe(false);
    expect(view.canRunWorkerJob).toBe(false);
    expect(view.canAdvanceWorkerStage).toBe(false);
    expect(view.stages).toHaveLength(7);
    expect(view.stages[0]!.status).toBe("ready");
    expect(view.issueDocs[0]!.relativePath).toContain("implementation-issues/001-initial_pr.md");
    expect(view.issueRows[0]).toMatchObject({
      latestWorkerJobLabel: "latest local Codex task none",
      nextActionLabel: "Work this issue through the delivery protocol, review streaks, and test evidence checklist.",
      stageGateLabel: expect.stringContaining("Record the first targeted test evidence"),
      missingEvidenceLabel: "none",
      evidenceRefsLabel: "none"
    });
    const markup = renderPanelMarkup(view);

    expect(markup).toContain(
      "local-001: Initial implementation and PR creation — stage: Initial implementation and PR creation / status: open (implementation-issues/001-initial_pr.md)"
    );
    expect(markup).toContain("current requirement: Create the smallest behavior-complete implementation for this issue slice.");
    expect(markup).toContain("Record the first targeted test evidence before requesting review.");
    expect(markup).toContain("Delivery progress");
    expect(markup).toContain("Stage progress");
    expect(markup).toContain("Review loop progress");
    expect(markup).toContain("Current stage requirement");
    expect(markup).toContain("0/7 stages completed · current stage: Initial implementation and PR creation (ready)");
    expect(markup).toContain(
      "0/4 review/clean-code loops completed · next: Feature PR code review and fix loop"
    );
    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });
    expect(koreanMarkup).toContain("제작 진행 상황");
    expect(koreanMarkup).toContain("<span>시작 기다림</span>");
    expect(koreanMarkup).toContain("demo-project 프로젝트의 자동 구현 작업공간이 준비되었습니다. 원격 저장소 상태: 원격 저장소 없음.");
    expect(koreanMarkup).toContain("초기 구현 및 PR 생성: 준비됨");
    expect(koreanMarkup).toContain("기능 PR 코드 리뷰 및 수정 루프: 시작 기다림");
    expect(koreanMarkup).not.toContain("Initial implementation and PR creation: ready");
    expect(koreanMarkup).toContain("작업공간: /repo/workspace/demo-project");
    expect(koreanMarkup).toContain("원격 저장소: 원격 저장소 없음 · 이슈 모드: 로컬 markdown 이슈");
    expect(koreanMarkup).not.toContain("원격 저장소: no_remote");
    expect(koreanMarkup).not.toContain("이슈 모드: markdown_fallback");
    expect(koreanMarkup).toContain("다음 5분 진행 확인: 2026-05-19T00:05:00.000Z");
    expect(koreanMarkup).toContain("이슈 상태 요약: 완료 0개 / 확인 필요 0개 / 열림 7개 / 전체 7개");
    expect(koreanMarkup).toContain("로컬 Codex 작업: 아직 계획되지 않음");
    expect(koreanMarkup).toContain("최신 로컬 Codex 작업 없음");
    expect(koreanMarkup).toContain(
      "local-001: 초기 구현 및 PR 생성 — 단계: 초기 구현 및 PR 생성 / 상태: 열림"
    );
    expect(koreanMarkup).toContain("단계: 초기 구현 및 PR 생성 / 상태: 열림");
    expect(koreanMarkup).not.toContain("Workspace repo bootstrap and initial implementation PR");
    expect(koreanMarkup).not.toContain("상태: open");
    expect(koreanMarkup).not.toContain("Workspace:");
    expect(koreanMarkup).not.toContain("Remote:");
    expect(koreanMarkup).not.toContain("Next 5-minute tick:");
    expect(koreanMarkup).not.toContain("Issue mode:");
    expect(koreanMarkup).not.toContain("Issue status summary");
    expect(koreanMarkup).not.toContain("remote status is no_remote");
    expect(koreanMarkup).not.toContain("Local Codex task: not planned");
    expect(koreanMarkup).toContain("0/7 단계 완료 · 현재 단계: 초기 구현 및 PR 생성 (준비됨)");
    expect(koreanMarkup).toContain("0/4 리뷰/클린코드 루프 완료 · 다음: 기능 PR 코드 리뷰 및 수정 루프");
    expect(koreanMarkup).toContain("이 이슈 범위에서 가장 작고 동작이 완성된 구현을 만듭니다.");
    expect(koreanMarkup).not.toContain("Create the smallest behavior-complete implementation");
    expect(view.deliveryGates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("two consecutive no-finding passes")
      ])
    );
    expect(view.stageReviewGates.find((stage) => stage.stage === "merge_main")?.gates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rerun the full verification command on main")
      ])
    );
    expect(view.remoteWarning).toContain("Remote is not connected");
    expect(view.remoteCommands).toContain("git remote add origin <github-repo-url>");
  });

  it("renders structured ledger gate summaries on completed stages", () => {
    const ledgerEvidence = {
      implementationStepId: "step_initial_pr",
      trackerDocRef: "implementation-step-ledger:tracker:tracker_demo",
      stepDocRef: "implementation-step-ledger:step:step_initial_pr",
      implementationEvidenceRefs: ["commit:initial-pr"],
      codeReviewStreakRefs: [
        "code-review:feature:clean-1",
        "code-review:feature:clean-2",
        "code-review:repository:clean-1",
        "code-review:repository:clean-2"
      ],
      cleanCodeReviewStreakRefs: [
        "clean-code-review:changed_code:clean-1",
        "clean-code-review:changed_code:clean-2",
        "clean-code-review:repository:clean-1",
        "clean-code-review:repository:clean-2"
      ],
      codeReviewStreaks: [
        {
          reviewScope: "feature",
          requiredNoFindingPasses: 2,
          currentNoFindingPasses: 2,
          satisfied: true,
          latestReviewIds: ["clean-1", "clean-2"],
          missingEvidenceLabel: "feature code review requires 2 consecutive no-finding passes"
        },
        {
          reviewScope: "repository",
          requiredNoFindingPasses: 2,
          currentNoFindingPasses: 2,
          satisfied: true,
          latestReviewIds: ["clean-1", "clean-2"],
          missingEvidenceLabel: "repository code review requires 2 consecutive no-finding passes"
        }
      ],
      cleanCodeReviewStreaks: [
        {
          reviewScope: "changed_code",
          requiredNoFindingPasses: 2,
          currentNoFindingPasses: 2,
          satisfied: true,
          latestReviewIds: ["clean-1", "clean-2"],
          missingEvidenceLabel: "changed_code clean-code review requires 2 consecutive no-finding passes"
        },
        {
          reviewScope: "repository",
          requiredNoFindingPasses: 2,
          currentNoFindingPasses: 2,
          satisfied: true,
          latestReviewIds: ["clean-1", "clean-2"],
          missingEvidenceLabel: "repository clean-code review requires 2 consecutive no-finding passes"
        }
      ],
      missingTestAuditSummary: {
        auditId: "missing_test_audit_initial_pr",
        missingTestGapCount: 0,
        satisfied: true
      },
      testEvidenceSummary: {
        testEvidenceId: "test_verify_initial_pr",
        outcome: "passed",
        passedTestCount: 1286,
        failedTestCount: 0,
        notTestedGapCount: 0,
        satisfied: true,
        commands: ["pnpm verify"]
      },
      missingTestAuditRefs: ["missing-test-audit:initial-pr"],
      testEvidenceRefs: ["test:initial-pr"],
      blockerEvidenceRefs: [],
      evidenceRefs: ["implementation-step-ledger:step_initial_pr", "missing-test-audit:initial-pr", "test:initial-pr"]
    } satisfies NonNullable<AutoImplementationRun["stagePlan"][number]["ledgerEvidence"]>;
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        stagePlan: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan.map((stage) =>
          stage.stage === "initial_pr"
            ? {
                ...stage,
                status: "completed" as const,
                ledgerEvidence
              }
            : stage
        )
      }
    } as AutoImplementationRunProjection;
    const markup = renderPanelMarkup(autoImplementationRunViewModel(projection));

    expect(markup).toContain("implementation record step_initial_pr");
    expect(markup).toContain("feature code review: 2/2 no-finding passes satisfied");
    expect(markup).toContain("changed_code clean-code review: 2/2 no-finding passes satisfied");
    expect(markup).toContain("missing-test audit gaps: 0 (satisfied)");
    expect(markup).toContain("tests passed: passed 1286 / failed 0; not-tested gaps 0");
  });

  it("surfaces Planning Handoff PR-sized markdown files before stage issue docs", () => {
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        issueManagement: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
          planningIssueSequenceTrackerRelativePath: "planning-handoff-pr-issue-sequence.md",
          planningIssueDocs: [
            {
              issueId: "phase2-api-ready",
              title: "Phase 2 API-ready implementation slice",
              relativePath: "planning-handoff-pr-issues/001-phase2-api-ready.md",
              includedTaskIds: ["task_api_ready"],
              status: "active"
            },
            {
              issueId: "phase2-review-ready",
              title: "Phase 2 review-ready implementation slice",
              relativePath: "planning-handoff-pr-issues/002-phase2-review-ready.md",
              includedTaskIds: ["task_review_ready"],
              status: "planned"
            }
          ]
        },
        evidenceRefs: [
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.evidenceRefs,
          "planning-handoff-pr-issue:planning-handoff-pr-issues/001-phase2-api-ready.md",
          "planning-handoff-pr-issue:planning-handoff-pr-issues/002-phase2-review-ready.md"
        ]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);
    const markup = renderPanelMarkup(view);
    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });

    expect(view.planningIssueFiles).toEqual([
      "planning-handoff-pr-issues/001-phase2-api-ready.md",
      "planning-handoff-pr-issues/002-phase2-review-ready.md"
    ]);
    expect(view.planningIssueSequenceTrackerPath).toBe("planning-handoff-pr-issue-sequence.md");
    expect(view.planningIssueRows[0]).toMatchObject({
      statusLabel: "active",
      taskIdsLabel: "task_api_ready"
    });
    expect(markup).toContain("Planning-derived PR/issue files");
    expect(markup).toContain("Sequence tracker: planning-handoff-pr-issue-sequence.md");
    expect(markup).toContain(
      "0/2 planning PR slice(s) completed · active slice: phase2-api-ready: Phase 2 API-ready implementation slice"
    );
    expect(markup).toContain("phase2-api-ready: Phase 2 API-ready implementation slice — slice status: active");
    expect(markup).toContain("tasks: task_api_ready");
    expect(markup).toContain("planning-handoff-pr-issues/001-phase2-api-ready.md");
    expect(markup.indexOf("Planning-derived PR/issue files")).toBeLessThan(markup.indexOf("Issue documents"));
    expect(koreanMarkup).toContain("계획에서 나온 PR/이슈 파일");
    expect(koreanMarkup).toContain("순서 추적 파일: planning-handoff-pr-issue-sequence.md");
    expect(koreanMarkup).toContain(
      "계획 PR 단위 2개 중 0개 완료 · 현재 단위: phase2-api-ready: Phase 2 API-ready implementation slice"
    );
    expect(koreanMarkup).toContain("phase2-api-ready: Phase 2 API-ready implementation slice — 단위 상태: 진행 중");
    expect(koreanMarkup).toContain("계획 작업: task_api_ready");
    expect(koreanMarkup).not.toContain("— active");
  });

  it("uses a visible not-started state before the workspace run exists", () => {
    const view = autoImplementationRunViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.hasRun).toBe(false);
    expect(view.workspaceLabel).toContain("workspace/<project>");
    expect(view.remoteNextAction).toContain("planning handoff");
    expect(view.issueStatusSummaryLabel).toBe("Issue status summary: no issue documents");
    expect(view.githubIssueMutationLabel).toContain("not requested");
    expect(view.githubIssueMutationStatus).toBe("not_requested");
    expect(view.githubIssueMutationBlockedReason).toBeNull();
    expect(view.pullRequestMutationLabel).toContain("no records");
    expect(view.latestPullRequestMutation).toBeNull();
    expect(view.latestWorkerJobLabel).toContain("not planned");
    expect(view.latestWorkerPlan).toBeNull();
    expect(view.workerRuntimeReadiness).toBeNull();
    expect(view.stageProgress).toEqual({
      completedStageCount: 0,
      totalStageCount: 0,
      currentStage: null,
      currentStageStatus: "not_started"
    });
    expect(view.reviewLoopProgress).toEqual({
      completedReviewLoopCount: 0,
      totalReviewLoopCount: 4,
      nextReviewLoopStage: null
    });
    expect(view.currentStageGates).toEqual([]);
    expect(view.issueRows).toEqual([]);
    expect(view.planningIssueFiles).toEqual([]);
    expect(view.canPlanWorkerJob).toBe(false);
    expect(view.canRecordStageTick).toBe(false);
    expect(view.canStartStage).toBe(false);
    expect(view.canPauseStage).toBe(false);
    expect(view.canBlockStage).toBe(false);
    expect(view.canCompleteWorkerJob).toBe(false);
    expect(view.canRecordGitHubIssueDryRun).toBe(false);
    expect(view.canApplyGitHubIssueCreation).toBe(false);
    expect(view.canRecordPullRequestDryRun).toBe(false);
    expect(view.canApplyPullRequestOpen).toBe(false);
    expect(view.canApplyPullRequestBodyUpdate).toBe(false);
    expect(view.canApplyPullRequestMerge).toBe(false);
  });

  it("keeps workspace creation disabled until planning handoff is ready", () => {
    const view = autoImplementationRunViewModel(null);
    const blockedMarkup = renderPanelMarkup(view, { canCreateRun: false });
    const readyMarkup = renderPanelMarkup(view, { canCreateRun: true });

    expect(blockedMarkup).toContain('<button type="button" disabled="">Create workspace run</button>');
    expect(readyMarkup).toContain('<button type="button">Create workspace run</button>');
    expect(blockedMarkup).not.toContain("Local Codex runtime readiness");
  });

  it("surfaces manual handoff runtime readiness beside worker controls", () => {
    const view = autoImplementationRunViewModel(
      {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
        latestRun: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
          workerJobs: [workerJob()]
        }
      } as AutoImplementationRunProjection,
      null,
      codexRuntimeStatus()
    );
    const markup = renderPanelMarkup(view);

    expect(view.workerRuntimeReadiness).toMatchObject({
      statusLabel: "unavailable",
      executionModeLabel: "manual_handoff",
      accountLabel: "authenticated (chatgpt / plus)",
      checkedAtLabel: "2026-05-23T00:00:00.000Z",
      adapterVersionLabel: CODEX_RUNTIME_ADAPTER_VERSION,
      sdkPackageVersionLabel: CODEX_SDK_PACKAGE_VERSION,
      codexCliVersionLabel: FIXTURE_CODEX_CLI_VERSION,
      transportLabel: CODEX_RUNTIME_TRANSPORT,
      liveTurnsState: "disabled",
      manualHandoffState: "available"
    });
    expect(view.workerRuntimeReadiness?.nextActionKey).toBe("enableLiveTurns");
    expect(markup).toContain("Local Codex runtime readiness");
    expect(markup).toContain("Codex runtime status");
    expect(markup).toContain("unavailable");
    expect(markup).toContain("Execution mode");
    expect(markup).toContain("manual handoff");
    expect(markup).not.toContain("manual_handoff");
    expect(markup).toContain("Codex account");
    expect(markup).toContain("authenticated (ChatGPT / plus)");
    expect(markup).toContain("Checked at");
    expect(markup).toContain("2026-05-23T00:00:00.000Z");
    expect(markup).toContain("Codex runtime adapter");
    expect(markup).toContain(CODEX_RUNTIME_ADAPTER_VERSION);
    expect(markup).toContain("SDK package version");
    expect(markup).toContain(CODEX_SDK_PACKAGE_VERSION);
    expect(markup).toContain("Codex CLI version");
    expect(markup).toContain("Connection transport");
    expect(markup).toContain(CODEX_RUNTIME_TRANSPORT);
    expect(markup).toContain("Automatic runs");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Manual fallback path");
    expect(markup).toContain("available");
    expect(markup).toContain('<details class="runtime-diagnostics">');
    expect(markup).toContain("Enable automatic local Codex execution in local settings");
    expect(markup).toContain("import its result evidence");

    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });

    expect(koreanMarkup).toContain("사용 불가");
    expect(koreanMarkup).toContain("로그인됨 (ChatGPT / plus)");
    expect(koreanMarkup).not.toContain("manual_handoff");
  });

  it("shows live worker execution readiness when Codex runtime is enabled", () => {
    const view = autoImplementationRunViewModel(
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      null,
      codexRuntimeStatus({
        status: "available",
        liveTurnExecutionEnabled: true,
        executionMode: "live",
        reason: "Live Codex SDK turn execution is enabled for preview-only artifacts."
      })
    );

    expect(view.workerRuntimeReadiness).toMatchObject({
      statusLabel: "available",
      executionModeLabel: "live",
      checkedAtLabel: "2026-05-23T00:00:00.000Z",
      adapterVersionLabel: CODEX_RUNTIME_ADAPTER_VERSION,
      sdkPackageVersionLabel: CODEX_SDK_PACKAGE_VERSION,
      codexCliVersionLabel: FIXTURE_CODEX_CLI_VERSION,
      transportLabel: CODEX_RUNTIME_TRANSPORT,
      liveTurnsState: "enabled",
      manualHandoffState: "available",
      reasonLabel: "Live Codex question and research preview execution is enabled."
    });
    expect(view.workerRuntimeReadiness?.nextActionKey).toBe("liveReady");
  });

  it("renders synchronized issue status details from the run", () => {
    const blockedWorker = workerJob({
      jobId: "auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked",
      stage: "code_review_fix_1",
      issueId: "local-002",
      issueTitle: "Feature PR code review and fix loop",
      issueRelativePath: "implementation-issues/002-code_review_fix_1.md",
      status: "blocked",
      blockedReason: "execution authority record is missing.",
      missingEvidence: ["execution authority record"],
      nextRequiredAction: "Create a scoped execution authority record before local Codex task execution.",
      evidenceRefs: ["auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked"],
      executionPlan: {
        issueDocumentPath: "implementation-issues/002-code_review_fix_1.md"
      }
    });
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        stagePlan: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan.map((stage, index) =>
          index === 0
            ? { ...stage, status: "completed" as const }
            : index === 2
              ? {
                  ...stage,
                  status: "blocked" as const,
                  blocker: {
                    stage: "code_review_fix_2" as const,
                    reason: "Repository review evidence is missing.",
                    missingEvidence: ["Repository code-review pass 2"],
                    nextRequiredAction: "Record the second repository code-review clean pass.",
                    evidenceRefs: ["stage-blocker:repository-review"]
                  }
                }
              : stage
        ),
        workerJobs: [blockedWorker],
        issueManagement: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
          issueDocs: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement.issueDocs.map((issue, index) =>
            index === 0
              ? { ...issue, status: "completed" as const }
              : index === 1
                ? { ...issue, status: "blocked" as const }
                : index === 2
                  ? { ...issue, status: "blocked" as const }
                : issue
          ),
          issueStatusSummary: {
            total: 7,
            open: 4,
            completed: 1,
            blocked: 2
          }
        }
      }
    } as AutoImplementationRunProjection);
    const markup = renderPanelMarkup(view);

    expect(view.issueStatusSummaryLabel).toBe("Issue status summary: 1 completed / 2 need attention / 4 open / 7 total");
    expect(view.stageProgress).toMatchObject({
      completedStageCount: 1,
      totalStageCount: 7,
      currentStage: "initial_pr",
      currentStageStatus: "completed"
    });
    expect(view.reviewLoopProgress).toMatchObject({
      completedReviewLoopCount: 0,
      totalReviewLoopCount: 4,
      nextReviewLoopStage: "code_review_fix_1"
    });
    expect(view.issueRows[0]).toMatchObject({
      latestWorkerJobLabel: "latest local Codex task none",
      nextActionLabel: "Use the completed stage implementation record before advancing the next PR slice.",
      missingEvidenceLabel: "none",
      evidenceRefsLabel: "none"
    });
    expect(view.issueRows[1]).toMatchObject({
      latestWorkerJobLabel: "latest local Codex task auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked (waiting for evidence)",
      blockerLabel: "local Codex task needs attention: execution authority record is missing.",
      nextActionLabel: "Create a scoped execution authority record before local Codex task execution.",
      missingEvidenceLabel: "execution authority record",
      evidenceRefsLabel: "auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked"
    });
    expect(view.issueRows[2]).toMatchObject({
      latestWorkerJobLabel: "latest local Codex task none",
      blockerLabel: "stage needs attention: Repository review evidence is missing.",
      nextActionLabel: "Record the second repository code-review clean pass.",
      missingEvidenceLabel: "Repository code-review pass 2",
      evidenceRefsLabel: "stage-blocker:repository-review"
    });
    expect(markup).toContain("Issue status summary: 1 completed / 2 need attention / 4 open / 7 total");
    expect(markup).toContain("1/7 stages completed · current stage: Initial implementation and PR creation (completed)");
    expect(markup).toContain(
      "local-001: Initial implementation and PR creation — stage: Initial implementation and PR creation / status: completed (implementation-issues/001-initial_pr.md)"
    );
    expect(markup).toContain(
      "local-002: Feature PR code review and fix loop — stage: Feature PR code review and fix loop / status: needs attention (implementation-issues/002-code_review_fix_1.md)"
    );
    expect(markup).toContain(
      "local-003: Repository-wide code review and fix loop — stage: Repository-wide code review and fix loop / status: needs attention (implementation-issues/003-code_review_fix_2.md)"
    );
    expect(markup).toContain("latest local Codex task auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked (waiting for evidence)");
    expect(markup).toContain("next: Create a scoped execution authority record before local Codex task execution.");
    expect(markup).toContain("missing: execution authority record");
    expect(markup).toContain("evidence: auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked");
    expect(markup).toContain("local Codex task needs attention: execution authority record is missing.");
    expect(markup).toContain("next: Record the second repository code-review clean pass.");
    expect(markup).toContain("missing: Repository code-review pass 2");
    expect(markup).toContain("evidence: stage-blocker:repository-review");
    expect(markup).toContain("stage needs attention: Repository review evidence is missing.");

    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });
    expect(koreanMarkup).toContain("단계: 초기 구현 및 PR 생성 / 상태: 완료");
    expect(koreanMarkup).toContain("단계: 기능 PR 코드 리뷰 및 수정 루프 / 상태: 확인 필요");
    expect(koreanMarkup).toContain("최신 로컬 Codex 작업 auto-worker-job:auto_run_demo:code_review_fix_1:job_blocked (근거 기다림)");
    expect(koreanMarkup).not.toContain("상태: completed");
    expect(koreanMarkup).not.toContain("상태: blocked");
  });

  it("shows the latest GitHub PR action evidence and history count", () => {
    const record = prMutationRecord();
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [
            prMutationRecord({
              mutationId: "auto-pr-mutation:auto_run_demo:open_pr:open_1",
              action: "open_pr",
              status: "dry_run_ready",
              requestMode: "dry_run",
              mutatesGitHub: false,
              pullRequestUrl: null,
              bodyEvidenceRefs: [],
              mergeEvidenceRefs: [],
              blockedReason: null
            }),
            record
          ],
          latestRecord: record
        }
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.pullRequestMutationLabel).toBe("GitHub PR action: update_pr_body applied");
    expect(view.pullRequestMutationHistoryCount).toBe(2);
    expect(view.latestPullRequestMutation).toMatchObject({
      action: "update_pr_body",
      status: "applied",
      pullRequestUrl: "https://github.com/bee-community-master/demo/pull/1"
    });
  });

  it("enables approved PR actions only after their matching dry-run is ready", () => {
    const openDryRun = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:open_pr:dry_run_1",
      action: "open_pr",
      requestMode: "dry_run",
      status: "dry_run_ready",
      mutatesGitHub: false,
      pullRequestUrl: null,
      bodyEvidenceRefs: [],
      mergeEvidenceRefs: [],
      approval: null,
      auditEvidenceRefs: ["github-pr-mutation:dry_run_ready"]
    });
    const bodyDryRun = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:update_pr_body:dry_run_1",
      action: "update_pr_body",
      requestMode: "dry_run",
      status: "dry_run_ready",
      mutatesGitHub: false,
      mergeEvidenceRefs: [],
      approval: null,
      auditEvidenceRefs: ["github-pr-mutation:dry_run_ready"]
    });
    const mergeDryRun = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:dry_run_1",
      action: "merge_pr",
      requestMode: "dry_run",
      status: "dry_run_ready",
      mutatesGitHub: false,
      approval: null,
      auditEvidenceRefs: ["github-pr-mutation:dry_run_ready"]
    });
    const openReadyView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [openDryRun],
          latestRecord: openDryRun
        }
      }
    } as AutoImplementationRunProjection);
    const bodyReadyView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [openDryRun, bodyDryRun],
          latestRecord: bodyDryRun
        }
      }
    } as AutoImplementationRunProjection);
    const mergeReadyView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [openDryRun, bodyDryRun, mergeDryRun],
          latestRecord: mergeDryRun
        }
      }
    } as AutoImplementationRunProjection);

    expect(openReadyView.canApplyPullRequestOpen).toBe(true);
    expect(openReadyView.canApplyPullRequestBodyUpdate).toBe(false);
    expect(openReadyView.canApplyPullRequestMerge).toBe(false);
    expect(bodyReadyView.canApplyPullRequestOpen).toBe(false);
    expect(bodyReadyView.canApplyPullRequestBodyUpdate).toBe(true);
    expect(bodyReadyView.canApplyPullRequestMerge).toBe(false);
    expect(mergeReadyView.canApplyPullRequestOpen).toBe(false);
    expect(mergeReadyView.canApplyPullRequestBodyUpdate).toBe(true);
    expect(mergeReadyView.canApplyPullRequestMerge).toBe(true);
  });

  it("keeps approved PR merge disabled after a merge has already been recorded", () => {
    const mergeDryRun = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:dry_run_1",
      action: "merge_pr",
      requestMode: "dry_run",
      status: "dry_run_ready",
      mutatesGitHub: false,
      approval: null,
      auditEvidenceRefs: ["github-pr-mutation:dry_run_ready"]
    });
    const mergeApplied = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:applied_1",
      action: "merge_pr",
      requestMode: "approved",
      status: "applied",
      mutatesGitHub: true,
      auditEvidenceRefs: ["github-pr-mutation:applied"],
      mergeEvidenceRefs: ["github-pr-mutation:merge-completed"]
    });
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [mergeDryRun, mergeApplied],
          latestRecord: mergeApplied
        }
      }
    } as AutoImplementationRunProjection);

    expect(view.canApplyPullRequestMerge).toBe(false);
  });

  it("enables approved GitHub issue creation only after issue dry-run readiness", () => {
    const issueDryRunReady = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement.githubIssueMutation,
      status: "dry_run_ready" as const,
      blockedReason: null,
      auditEvidenceRefs: ["github-issue-mutation:dry_run_ready"]
    };
    const dryRunView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        issueManagement: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
          githubIssueMutation: issueDryRunReady
        }
      }
    } as AutoImplementationRunProjection);
    const appliedView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        issueManagement: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
          githubIssueUrls: ["https://github.com/bee-community-master/demo/issues/1"],
          githubIssueMutation: {
            ...issueDryRunReady,
            status: "applied" as const,
            mutatesGitHub: true,
            createdIssueUrls: ["https://github.com/bee-community-master/demo/issues/1"]
          }
        }
      }
    } as AutoImplementationRunProjection);

    expect(dryRunView.canRecordGitHubIssueDryRun).toBe(false);
    expect(dryRunView.canApplyGitHubIssueCreation).toBe(true);
    expect(dryRunView.issueRows[0]?.githubIssueUrlLabel).toBe("none");
    expect(appliedView.canRecordGitHubIssueDryRun).toBe(false);
    expect(appliedView.canApplyGitHubIssueCreation).toBe(false);
    expect(appliedView.issueRows[0]?.githubIssueUrlLabel).toBe("https://github.com/bee-community-master/demo/issues/1");
    expect(renderPanelMarkup(appliedView)).toContain("GitHub issue: https://github.com/bee-community-master/demo/issues/1");
  });

  it("keeps approved GitHub issue creation disabled after issue URLs are recorded", () => {
    const issueDryRunReady = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement.githubIssueMutation,
      status: "dry_run_ready" as const,
      blockedReason: null,
      auditEvidenceRefs: ["github-issue-mutation:dry_run_ready"]
    };
    const appliedUrls = ["https://github.com/bee-community-master/demo/issues/1"];
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        issueManagement: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
          githubIssueUrls: appliedUrls,
          githubIssueMutation: {
            ...issueDryRunReady,
            status: "applied" as const,
            mutatesGitHub: true,
            createdIssueUrls: appliedUrls
          }
        }
      }
    } as AutoImplementationRunProjection);

    expect(view.canApplyGitHubIssueCreation).toBe(false);
  });

  it("keeps stage tick recording disabled after the run is completed", () => {
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        status: "completed"
      }
    } as AutoImplementationRunProjection);

    expect(view.canRecordStageTick).toBe(false);
    expect(view.canStartStage).toBe(false);
    expect(view.canPauseStage).toBe(false);
    expect(view.canBlockStage).toBe(false);
    expect(view.canCompleteWorkerJob).toBe(false);
  });

  it("gates current-stage start, pause, and block actions from stage status", () => {
    const runningProjection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        status: "running",
        stagePlan: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan.map((stage, index) =>
          index === 0 ? { ...stage, status: "running" as const } : stage
        )
      }
    } as AutoImplementationRunProjection;
    const blockedProjection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        status: "blocked",
        stagePlan: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan.map((stage, index) =>
          index === 0
            ? {
                ...stage,
                status: "blocked" as const,
                blocker: {
                  stage: "initial_pr" as const,
                  reason: "Local Codex task result evidence is missing.",
                  missingEvidence: ["ImplementationStepLedger import"],
                  nextRequiredAction: "Retry the local Codex task result import.",
                  evidenceRefs: ["worker-blocked:ledger-import"]
                }
              }
            : stage
        )
      }
    } as AutoImplementationRunProjection;
    const runningView = autoImplementationRunViewModel(runningProjection);
    const blockedView = autoImplementationRunViewModel(blockedProjection);

    expect(runningView.canStartStage).toBe(false);
    expect(runningView.canPauseStage).toBe(true);
    expect(runningView.canBlockStage).toBe(true);
    expect(blockedView.canStartStage).toBe(true);
    expect(blockedView.canPauseStage).toBe(false);
    expect(blockedView.canBlockStage).toBe(false);
  });

  it("keeps approved PR open disabled after any PR URL has been recorded", () => {
    const openDryRun = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:open_pr:dry_run_1",
      action: "open_pr",
      requestMode: "dry_run",
      status: "dry_run_ready",
      mutatesGitHub: false,
      pullRequestUrl: null,
      bodyEvidenceRefs: [],
      mergeEvidenceRefs: [],
      approval: null
    });
    const openApplied = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:open_pr:applied_1",
      action: "open_pr",
      status: "applied",
      requestMode: "approved",
      pullRequestUrl: "https://github.com/bee-community-master/demo/pull/1"
    });
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [openDryRun, openApplied],
          latestRecord: openApplied
        }
      }
    } as AutoImplementationRunProjection);

    expect(view.canApplyPullRequestOpen).toBe(false);
  });


  it("uses the projection latestRecord when the mutation state carries one", () => {
    const openRecord = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:open_pr:open_1",
      action: "open_pr",
      status: "dry_run_ready",
      requestMode: "dry_run",
      mutatesGitHub: false,
      pullRequestUrl: null,
      bodyEvidenceRefs: [],
      mergeEvidenceRefs: [],
      blockedReason: null
    });
    const updateRecord = prMutationRecord();
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [updateRecord, openRecord],
          latestRecord: updateRecord
        }
      }
    } as AutoImplementationRunProjection);

    expect(view.pullRequestMutationLabel).toBe("GitHub PR action: update_pr_body applied");
    expect(view.latestPullRequestMutation).toMatchObject({
      mutationId: "auto-pr-mutation:auto_run_demo:update_pr_body:update_1"
    });
  });

  it("shows the latest local worker blocker when a bounded Codex job exists", () => {
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        status: "blocked",
        workerJobs: [
          workerJob({
            jobId: "auto-worker-job:auto_run_demo:initial_pr:job_1",
            status: "blocked",
            executionPlan: {
              executionAuthorityRef: null,
            },
            blockedReason: "ExecutionAuthorityRecord is missing.",
            missingEvidence: ["ExecutionAuthorityRecord"],
            nextRequiredAction: "Create a scoped execution authority record before local Codex task execution.",
            evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
          })
        ]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.latestWorkerJobLabel).toContain("blocked for initial_pr (local-001)");
    expect(view.latestWorkerJobNextAction).toContain("execution authority record");
    expect(view.latestWorkerJobId).toBe("auto-worker-job:auto_run_demo:initial_pr:job_1");
    expect(view.latestWorkerPlan).toMatchObject({
      workingDirectory: "/repo/workspace/demo-project",
      issueDocumentPath: "implementation-issues/001-initial_pr.md",
      executionAuthorityRef: null,
      blockedReason: "execution authority record is missing.",
      missingEvidence: ["execution authority record"],
      evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
    });
    expect(view.canPlanWorkerJob).toBe(true);
    expect(view.canRunWorkerJob).toBe(false);
    expect(view.canImportWorkerLedger).toBe(false);
  });

  it("splits worker required evidence into base and current-stage gate lists", () => {
    const currentStageWorkerJob = workerJob({
      jobId: "auto-worker-job:auto_run_demo:code_review_fix_1:job_planned",
      stage: "code_review_fix_1",
      issueId: "local-002",
      issueTitle: "Feature PR code review and fix loop",
      issueRelativePath: "implementation-issues/002-code_review_fix_1.md",
      executionPlan: {
        issueDocumentPath: "implementation-issues/002-code_review_fix_1.md",
        requiredEvidence: autoImplementationWorkerRequiredEvidence("code_review_fix_1")
      }
    });
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        currentStage: "code_review_fix_1" as const,
        workerJobs: [currentStageWorkerJob]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);
    const markup = renderPanelMarkup(view);

    expect(view.latestWorkerPlan).toMatchObject({
      stage: "code_review_fix_1",
      stageLabel: "Feature PR code review and fix loop",
      stageRequiredEvidence: [
        "feature-scope CodeReviewRecord ids prove two consecutive no-finding passes after any fixes"
      ]
    });
    expect(view.latestWorkerPlan?.baseRequiredEvidence).toContain("implementation record tracker document and step document");
    expect(markup).toContain("Base delivery evidence");
    expect(markup).toContain("Current stage evidence");
    expect(markup).toContain(
      "feature-scope CodeReviewRecord ids prove two consecutive no-finding passes after any fixes"
    );

    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });

    expect(koreanMarkup).toContain("로컬 샌드박스 Codex");
    expect(koreanMarkup).toContain("기능 PR 코드 리뷰 및 수정 루프 단계를 진행하려면");
    expect(koreanMarkup).not.toContain("local_sandboxed_codex");
  });

  it("enables run, ledger completion, and advance controls from the latest local worker status", () => {
    const plannedWorkerJob = workerJob();
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        workerJobs: [plannedWorkerJob]
      }
    } as AutoImplementationRunProjection;
    const plannedView = autoImplementationRunViewModel(projection);
    const ledgerReadyView = autoImplementationRunViewModel(
      projection,
      ledgerForWorkerJob(plannedWorkerJob, ["test:verify"])
    );
    const completedView = autoImplementationRunViewModel({
      ...projection,
      latestRun: {
        ...projection.latestRun!,
        workerJobs: [
          {
            ...plannedWorkerJob,
            status: "completed",
            nextRequiredAction: "Advance the current auto implementation stage.",
            evidenceRefs: [
              ...plannedWorkerJob.evidenceRefs,
              "implementation-step-ledger:step_demo"
            ]
          }
        ]
      }
    } as AutoImplementationRunProjection);

    expect(plannedView.canRunWorkerJob).toBe(true);
    expect(plannedView.canPlanWorkerJob).toBe(false);
    expect(plannedView.canImportWorkerLedger).toBe(true);
    expect(plannedView.canCompleteWorkerJob).toBe(false);
    expect(ledgerReadyView.canCompleteWorkerJob).toBe(true);
    expect(ledgerReadyView.latestWorkerLedgerEvidence).toMatchObject({
      stepId: plannedWorkerJob.executionPlan.ledgerStepDoc.stepId,
      status: "completed",
      missingTestAuditLabel: expect.stringContaining("missing-test audit gaps: 0"),
      testEvidenceLabel: expect.stringContaining("tests passed: pnpm verify"),
      missingEvidenceLabel: "none"
    });
    expect(ledgerReadyView.latestWorkerLedgerEvidence?.codeReviewStreakLabels).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature code review: 2/2 no-finding passes satisfied"),
        expect.stringContaining("repository code review: 2/2 no-finding passes satisfied")
      ])
    );
    expect(ledgerReadyView.latestWorkerLedgerEvidence?.cleanCodeReviewStreakLabels).toEqual(
      expect.arrayContaining([
        expect.stringContaining("changed_code clean-code review: 2/2 no-finding passes satisfied"),
        expect.stringContaining("repository clean-code review: 2/2 no-finding passes satisfied")
      ])
    );
    expect(plannedView.canAdvanceWorkerStage).toBe(false);
    expect(plannedView.workerStageAdvanceBlockerLabel).toContain("Complete the current-stage local Codex task");
    expect(plannedView.latestWorkerPlan?.executionAuthorityRef).toBe("exec_auth_auto_worker_initial_pr");
    expect(completedView.canPlanWorkerJob).toBe(false);
    expect(completedView.canRunWorkerJob).toBe(false);
    expect(completedView.canImportWorkerLedger).toBe(false);
    expect(completedView.canCompleteWorkerJob).toBe(false);
    expect(completedView.canAdvanceWorkerStage).toBe(true);
    expect(completedView.workerStageAdvanceBlockerLabel).toBeNull();

    const markup = renderPanelMarkup(ledgerReadyView);

    expect(markup).toContain("Imported implementation evidence");
    expect(markup).toContain("feature code review: 2/2 no-finding passes satisfied");
    expect(markup).toContain("missing-test audit gaps: 0");
  });

  it("keeps merge_main worker advance disabled until applied PR merge and post-merge verification evidence exist", () => {
    const mergeMainWorkerJob = workerJob({
      jobId: "auto-worker-job:auto_run_demo:merge_main:job_completed",
      stage: "merge_main",
      issueId: "local-007",
      issueTitle: "Merge verified PR to main",
      issueRelativePath: "implementation-issues/007-merge_main.md",
      status: "completed",
      nextRequiredAction: "Advance the merge_main stage after the applied PR merge is recorded.",
      evidenceRefs: ["implementation-step-ledger:merge_main"],
      executionPlan: {
        issueDocumentPath: "implementation-issues/007-merge_main.md",
        ledgerStepDoc: {
          stepId: "auto-implementation-step:auto_run_demo:merge_main:local-007",
          title: "Merge verified PR to main",
          description: autoImplementationWorkerLedgerStepDescription({
            stage: "merge_main",
            issueRelativePath: "implementation-issues/007-merge_main.md"
          }),
          sourceRefs: [
            "auto-implementation-run:auto_run_demo",
            "auto-implementation-stage:merge_main",
            "auto-implementation-worker-job:auto_run_demo:merge_main:job_completed",
            "auto-implementation-issue:local-007",
            "issue-doc:implementation-issues/007-merge_main.md"
          ],
          expectedChangeScope: autoImplementationWorkerExpectedChangeScope("merge_main")
        }
      }
    });
    const mergeMainRun = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      currentStage: "merge_main" as const,
      workerJobs: [mergeMainWorkerJob],
      stagePlan: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan.map((stage) =>
        stage.stage === "merge_main"
          ? { ...stage, status: "ready" as const }
          : { ...stage, status: "completed" as const }
      ),
      pullRequestMutations: {
        records: [],
        latestRecord: null
      }
    };
    const appliedMerge = prMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:applied_1",
      action: "merge_pr",
      requestMode: "approved",
      status: "applied",
      mutatesGitHub: true
    });
    const withoutMergeEvidenceView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: mergeMainRun
    } as AutoImplementationRunProjection);
    const withMergeEvidenceButNoLedgerView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...mergeMainRun,
        pullRequestMutations: {
          records: [appliedMerge],
          latestRecord: appliedMerge
        }
      }
    } as AutoImplementationRunProjection);
    const withMergeEvidenceButMissingPostMergeView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...mergeMainRun,
        pullRequestMutations: {
          records: [appliedMerge],
          latestRecord: appliedMerge
        }
      }
    } as AutoImplementationRunProjection, ledgerForWorkerJob(mergeMainWorkerJob, ["test:pnpm-verify"]));
    const withPostMergeEvidenceView = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...mergeMainRun,
        pullRequestMutations: {
          records: [appliedMerge],
          latestRecord: appliedMerge
        }
      }
    } as AutoImplementationRunProjection, ledgerForWorkerJob(mergeMainWorkerJob, [
      `${AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX}merge_main:pnpm-verify`
    ]));

    expect(withoutMergeEvidenceView.canAdvanceWorkerStage).toBe(false);
    expect(withoutMergeEvidenceView.workerStageAdvanceBlockerLabel).toBe(
      "Record the applied GitHub PR merge mutation before advancing merge_main."
    );
    expect(withMergeEvidenceButNoLedgerView.canAdvanceWorkerStage).toBe(false);
    expect(withMergeEvidenceButNoLedgerView.workerStageAdvanceBlockerLabel).toContain(
      "post-merge-verify:merge_main:<command>"
    );
    expect(withMergeEvidenceButMissingPostMergeView.canAdvanceWorkerStage).toBe(false);
    expect(withMergeEvidenceButMissingPostMergeView.workerStageAdvanceBlockerLabel).toContain(
      "post-merge-verify:merge_main:<command>"
    );
    expect(withPostMergeEvidenceView.canAdvanceWorkerStage).toBe(true);
    expect(withPostMergeEvidenceView.workerStageAdvanceBlockerLabel).toBeNull();
    expect(renderPanelMarkup(withMergeEvidenceButNoLedgerView)).toContain("Stage advance issue");
    expect(renderPanelMarkup(withMergeEvidenceButNoLedgerView)).toContain("post-merge-verify:merge_main:&lt;command&gt;");
  });

  it("keeps worker controls scoped to the current auto implementation stage", () => {
    const previousStageCompletedJob = workerJob({
      status: "completed",
      nextRequiredAction: "Advance the current auto implementation stage.",
      evidenceRefs: ["implementation-step-ledger:initial_pr"]
    });
    const currentStagePlannedJob = workerJob({
      jobId: "auto-worker-job:auto_run_demo:code_review_fix_1:job_planned",
      stage: "code_review_fix_1",
      issueId: "local-002",
      issueTitle: "Feature code-review and fix pass",
      issueRelativePath: "implementation-issues/002-code_review_fix_1.md",
      executionPlan: {
        issueDocumentPath: "implementation-issues/002-code_review_fix_1.md"
      },
      evidenceRefs: ["auto-worker-job:auto_run_demo:code_review_fix_1:job_planned"]
    });
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        currentStage: "code_review_fix_1",
        workerJobs: [previousStageCompletedJob, currentStagePlannedJob]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.latestWorkerJobId).toBe("auto-worker-job:auto_run_demo:code_review_fix_1:job_planned");
    expect(view.latestWorkerJobLabel).toContain("planned for code_review_fix_1 (local-002)");
    expect(view.latestWorkerPlan?.issueDocumentPath).toBe("implementation-issues/002-code_review_fix_1.md");
    expect(view.canPlanWorkerJob).toBe(false);
    expect(view.canRunWorkerJob).toBe(true);
    expect(view.canAdvanceWorkerStage).toBe(false);
  });

  it("does not expose stale previous-stage worker completion as current-stage advance", () => {
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        currentStage: "code_review_fix_1",
        workerJobs: [
          workerJob({
            status: "completed",
            nextRequiredAction: "Advance the current auto implementation stage.",
            evidenceRefs: ["implementation-step-ledger:initial_pr"]
          })
        ]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.latestWorkerJobId).toBeNull();
    expect(view.latestWorkerJobLabel).toBe("Local Codex task: not planned");
    expect(view.latestWorkerPlan).toBeNull();
    expect(view.canPlanWorkerJob).toBe(true);
    expect(view.canRunWorkerJob).toBe(false);
    expect(view.canImportWorkerLedger).toBe(false);
    expect(view.canAdvanceWorkerStage).toBe(false);
  });

  it("allows manual ledger import for current-stage worker execution blockers", () => {
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        workerJobs: [
          workerJob({
            status: "blocked",
            missingEvidence: ["Local Codex worker execution"],
            blockedReason: "Live Codex worker output was unavailable.",
            nextRequiredAction: "Import completed task-result JSON."
          })
        ]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.canPlanWorkerJob).toBe(false);
    expect(view.canImportWorkerLedger).toBe(true);
    expect(view.canRunWorkerJob).toBe(true);
  });

  it("keeps legacy projections without workerJobs renderable", () => {
    const legacyLatestRun = { ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun! } as Record<string, unknown>;

    delete legacyLatestRun.workerJobs;
    delete legacyLatestRun.pullRequestMutations;
    const projection = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: legacyLatestRun,
      runs: [legacyLatestRun]
    } as unknown as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.latestWorkerJobLabel).toBe("Local Codex task: not planned");
    expect(view.pullRequestMutationLabel).toBe("GitHub PR action: no records");
    expect(view.latestPullRequestMutation).toBeNull();
    expect(view.latestWorkerPlan).toBeNull();
    expect(view.latestWorkerJobNextAction).toContain("scoped local Codex task");
  });

  it("renders the latest local worker bounded plan details", () => {
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        workerJobs: [workerJob()]
      }
    } as AutoImplementationRunProjection);
    const markup = renderPanelMarkup(view);
    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });

    expect(markup).toContain("Local Codex task plan");
    expect(markup).toContain("Local Codex task result JSON");
    expect(koreanMarkup).toContain("로컬 Codex 작업 결과 JSON");
    expect(markup).toContain("local sandboxed Codex");
    expect(markup).not.toContain("local_sandboxed_codex");
    expect(markup).toContain("/repo/workspace/demo-project");
    expect(markup).toContain("implementation-issues/001-initial_pr.md");
    expect(markup).toContain("exec_auth_auto_worker_initial_pr");
    expect(markup).toContain("Implementation plan tracker");
    expect(markup).toContain("auto-implementation-tracker:auto_run_demo");
    expect(markup).toContain("Current implementation step");
    expect(markup).toContain("auto-implementation-step:auto_run_demo:initial_pr:local-001");
    expect(markup).toContain("tracked_code_docs_config");
    expect(markup).toContain("Allowed write scope");
    expect(markup).toContain("implementation record tracker document and step document");
    expect(markup).toContain("credential storage");
    expect(markup).toContain("auto-implementation-run:auto_run_demo");
    expect(markup).toContain("auto-worker-job:auto_run_demo:initial_pr:job_planned");
  });

  it("renders missing authority and blocker details for blocked worker plans", () => {
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        workerJobs: [
          workerJob({
            status: "blocked",
            executionPlan: { executionAuthorityRef: null },
            blockedReason: "ExecutionAuthorityRecord is missing.",
            missingEvidence: ["ExecutionAuthorityRecord"],
            nextRequiredAction: "Create a scoped execution authority record before local Codex task execution."
          })
        ]
      }
    } as AutoImplementationRunProjection);
    const markup = renderPanelMarkup(view);

    expect(markup).toContain("Missing ExecutionAuthorityRecord");
    expect(markup).toContain("execution authority record is missing.");
    expect(markup).toContain("Missing evidence");
    expect(markup).toContain("ExecutionAuthorityRecord");
  });

  it("keeps the worker plan section hidden until a local worker job exists", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);
    const markup = renderPanelMarkup(view);

    expect(markup).not.toContain("Local Codex task plan");
  });

  it("renders the latest GitHub PR action evidence", () => {
    const record = prMutationRecord();
    const view = autoImplementationRunViewModel({
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        pullRequestMutations: {
          records: [record],
          latestRecord: record
        }
      }
    } as AutoImplementationRunProjection);
    const markup = renderPanelMarkup(view);

    expect(markup).toContain("GitHub PR action evidence");
    expect(markup).toContain("GitHub PR action: update PR description · applied");
    expect(markup).toContain("approved live action");
    expect(markup).not.toContain("GitHub PR action: update_pr_body applied");
    expect(markup).toContain("1 PR action record(s) captured.");
    expect(markup).toContain("https://github.com/bee-community-master/demo/pull/1");
    expect(markup).toContain("Update the generated PR body with current review and verification evidence.");
    expect(markup).toContain("code-review:feature:clean-1");
    expect(markup).toContain("pnpm verify");
    expect(markup).toContain("approval:github_pr_mutation:update_body");
    expect(markup).toContain("Restore the previous PR body or revert the merge commit.");
    expect(markup).toContain("pr-body:current-evidence");
    expect(markup).toContain("github-pr-mutation:merge:completed");
    expect(markup).toContain("verifier:github_pr_mutation:ready");
    expect(markup).toContain("Use gh pr edit to restore the previous PR body.");

    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });

    expect(koreanMarkup).toContain("GitHub PR 작업: PR 설명 업데이트 · 적용됨");
    expect(koreanMarkup).toContain("승인된 실제 작업");
    expect(koreanMarkup).not.toContain("GitHub PR action: update_pr_body applied");
  });

  it("renders the remote warning and local issue documents", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);
    const markup = renderPanelMarkup(view);

    expect(markup).toContain("Auto implementation workspace");
    expect(markup).toContain("Initial implementation and PR creation");
    expect(markup).toContain("Review and merge protocol");
    expect(markup).toContain("Do not merge until the feature PR code review reaches two consecutive no-finding passes");
    expect(markup).toContain(
      "Sync main after merge and rerun the full verification command on main with post-merge verification evidence."
    );
    expect(markup).toContain("implementation-issues/001-initial_pr.md");
    expect(markup).toContain("GitHub issue: none");
    expect(markup).toContain("GitHub issue creation plan");
    expect(markup).toContain("GitHub issue creation: not requested yet");
    expect(markup).not.toContain("GitHub issue action: not_requested");
    expect(markup).toContain("GitHub PR action evidence");
    expect(markup).toContain("No GitHub PR action records yet");
    expect(markup).toContain("No GitHub PR action records yet");
    const koreanMarkup = renderPanelMarkup(view, { language: "ko" });
    expect(koreanMarkup).toContain("GitHub 이슈 생성 계획");
    expect(koreanMarkup).toContain("GitHub 이슈 생성: 아직 요청되지 않음");
    expect(koreanMarkup).not.toContain("GitHub issue action: not_requested");
    expect(koreanMarkup).toContain("GitHub PR 작업 근거");
    expect(koreanMarkup).toContain("아직 GitHub PR 작업 기록이 없습니다.");
    expect(koreanMarkup).not.toContain("mutation contract");
    expect(koreanMarkup).not.toContain("mutation evidence");
    expect(koreanMarkup).not.toContain("PR action 기록");
    expect(koreanMarkup).toContain("기능 PR 코드 리뷰에서 수정할 내용 없음이 2회 연속 확인되기 전에는 merge하지 않습니다.");
    expect(koreanMarkup).toContain("이 이슈를 리뷰 연속 통과, 클린코드 확인, 테스트 근거 체크리스트에 맞춰 진행하세요.");
    expect(koreanMarkup).not.toContain("Work this issue through the delivery protocol");
    expect(koreanMarkup).not.toContain("Do not merge until the feature PR code review reaches");
    expect(markup).toContain("Local Codex task: not planned");
    expect(markup).toContain("Plan approved local Codex task");
    expect(markup).toContain("Record current stage check-in");
    expect(markup).toContain("Start current stage");
    expect(markup).toContain("Pause current stage");
    expect(markup).toContain("Mark current stage needs attention");
    expect(markup).toContain("Mark task complete from result");
    expect(markup).toContain("Import task result");
    expect(markup).toContain("Preview GitHub issue creation");
    expect(markup).toContain("Apply approved GitHub issues");
    expect(markup).toContain("Preview PR creation");
    expect(markup).toContain("Apply approved PR open");
    expect(markup).toContain("Preview PR description update");
    expect(markup).toContain("Preview PR merge");
    expect(markup).toContain("Apply approved PR body update");
    expect(markup).toContain("Apply approved PR merge");
    expect(markup).toContain("Run local Codex task");
    expect(markup).toContain("Advance implementation stage");
    expect(markup).toContain("local markdown issue paths remain the source of truth");
    expect(markup).toContain("git remote add origin");

    expect(koreanMarkup).toContain("승인된 로컬 Codex 작업 계획");
    expect(koreanMarkup).toContain("작업 결과 가져오기");
    expect(koreanMarkup).toContain("GitHub 이슈 생성 미리보기");
    expect(koreanMarkup).toContain("아직 구현 계획에서 쪼개진 PR/이슈 파일이 생성되지 않았습니다.");
    expect(koreanMarkup).toContain("지금은 로컬 markdown 이슈를 기준으로 진행합니다.");
    expect(koreanMarkup).toContain("원격 이슈/PR 자동화를 사용하려면 GitHub 원격 저장소를 연결하세요.");
    expect(koreanMarkup).not.toContain("Worker ledger import JSON");
    expect(koreanMarkup).not.toContain("Worker job 실행");
    expect(koreanMarkup).not.toContain("local markdown issue path가 source of truth");
    expect(koreanMarkup).not.toContain("Connect a GitHub remote");
  });
});
