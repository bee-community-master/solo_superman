import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  autoImplementationWorkerExpectedChangeScope,
  autoImplementationWorkerLedgerStepDescription,
  type AutoImplementationRun,
  type AutoImplementationRunProjection
} from "@solo-superman/contracts";
import {
  AutoImplementationRunPanel,
  autoImplementationRunViewModel
} from "./AutoImplementationRunPanel";
import { renderEnglishMarkup } from "./test-rendering";

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
    nextRequiredAction: "Run the local Codex worker.",
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

function renderPanelMarkup(run: ReturnType<typeof autoImplementationRunViewModel>) {
  return renderEnglishMarkup(
    createElement(AutoImplementationRunPanel, {
      run,
      isBusy: false,
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
    })
  );
}

describe("AutoImplementationRunPanel view model", () => {
  it("shows workspace, five-minute stages, markdown issues, and remote guide", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);

    expect(view.status).toBe("pending");
    expect(view.workspaceLabel).toContain("/repo/workspace/demo-project");
    expect(view.nextTickLabel).toContain("2026-05-19T00:05:00.000Z");
    expect(view.issueModeLabel).toContain("markdown_fallback");
    expect(view.githubIssueMutationLabel).toContain("not_requested");
    expect(view.githubIssuePlans[0]!.bodyMarkdownPath).toContain("implementation-issues/001-initial_pr.md");
    expect(view.githubCreatedIssueUrls).toEqual([]);
    expect(view.pullRequestMutationLabel).toBe("GitHub PR mutation: no records");
    expect(view.pullRequestMutationHistoryCount).toBe(0);
    expect(view.latestPullRequestMutation).toBeNull();
    expect(view.latestWorkerJobLabel).toBe("Local Codex worker: not planned");
    expect(view.latestWorkerJobNextAction).toContain("current stage issue document");
    expect(view.latestWorkerPlan).toBeNull();
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

  it("uses a visible not-started state before the workspace run exists", () => {
    const view = autoImplementationRunViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.hasRun).toBe(false);
    expect(view.workspaceLabel).toContain("workspace/<project>");
    expect(view.remoteNextAction).toContain("planning handoff");
    expect(view.githubIssueMutationLabel).toContain("not requested");
    expect(view.pullRequestMutationLabel).toContain("no records");
    expect(view.latestPullRequestMutation).toBeNull();
    expect(view.latestWorkerJobLabel).toContain("not planned");
    expect(view.latestWorkerPlan).toBeNull();
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

  it("shows the latest GitHub PR mutation evidence and history count", () => {
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

    expect(view.pullRequestMutationLabel).toBe("GitHub PR mutation: update_pr_body applied");
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
    expect(appliedView.canRecordGitHubIssueDryRun).toBe(false);
    expect(appliedView.canApplyGitHubIssueCreation).toBe(false);
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
                  reason: "Worker ledger evidence is missing.",
                  missingEvidence: ["ImplementationStepLedger import"],
                  nextRequiredAction: "Retry the worker ledger import.",
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

    expect(view.pullRequestMutationLabel).toBe("GitHub PR mutation: update_pr_body applied");
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
            nextRequiredAction: "Create a bounded ExecutionAuthorityRecord before local worker execution.",
            evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
          })
        ]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

    expect(view.latestWorkerJobLabel).toContain("blocked for initial_pr (local-001)");
    expect(view.latestWorkerJobNextAction).toContain("ExecutionAuthorityRecord");
    expect(view.latestWorkerJobId).toBe("auto-worker-job:auto_run_demo:initial_pr:job_1");
    expect(view.latestWorkerPlan).toMatchObject({
      workingDirectory: "/repo/workspace/demo-project",
      issueDocumentPath: "implementation-issues/001-initial_pr.md",
      executionAuthorityRef: null,
      blockedReason: "ExecutionAuthorityRecord is missing.",
      missingEvidence: ["ExecutionAuthorityRecord"],
      evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
    });
    expect(view.canRunWorkerJob).toBe(false);
    expect(view.canImportWorkerLedger).toBe(false);
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
    const ledgerReadyView = autoImplementationRunViewModel(projection, IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE);
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
    expect(plannedView.canImportWorkerLedger).toBe(true);
    expect(plannedView.canCompleteWorkerJob).toBe(false);
    expect(ledgerReadyView.canCompleteWorkerJob).toBe(true);
    expect(plannedView.canAdvanceWorkerStage).toBe(false);
    expect(plannedView.latestWorkerPlan?.executionAuthorityRef).toBe("exec_auth_auto_worker_initial_pr");
    expect(completedView.canRunWorkerJob).toBe(false);
    expect(completedView.canImportWorkerLedger).toBe(false);
    expect(completedView.canCompleteWorkerJob).toBe(false);
    expect(completedView.canAdvanceWorkerStage).toBe(true);
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
    expect(view.latestWorkerJobLabel).toBe("Local Codex worker: not planned");
    expect(view.latestWorkerPlan).toBeNull();
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
            nextRequiredAction: "Import a completed worker ledger envelope."
          })
        ]
      }
    } as AutoImplementationRunProjection;
    const view = autoImplementationRunViewModel(projection);

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

    expect(view.latestWorkerJobLabel).toBe("Local Codex worker: not planned");
    expect(view.pullRequestMutationLabel).toBe("GitHub PR mutation: no records");
    expect(view.latestPullRequestMutation).toBeNull();
    expect(view.latestWorkerPlan).toBeNull();
    expect(view.latestWorkerJobNextAction).toContain("bounded local worker job");
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

    expect(markup).toContain("Local worker bounded plan");
    expect(markup).toContain("Worker ledger import JSON");
    expect(markup).toContain("local_sandboxed_codex");
    expect(markup).toContain("/repo/workspace/demo-project");
    expect(markup).toContain("implementation-issues/001-initial_pr.md");
    expect(markup).toContain("exec_auth_auto_worker_initial_pr");
    expect(markup).toContain("Ledger tracker doc");
    expect(markup).toContain("auto-implementation-tracker:auto_run_demo");
    expect(markup).toContain("Ledger step doc");
    expect(markup).toContain("auto-implementation-step:auto_run_demo:initial_pr:local-001");
    expect(markup).toContain("tracked_code_docs_config");
    expect(markup).toContain("Allowed write scope");
    expect(markup).toContain("ImplementationStepLedger trackerDoc and stepDoc");
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
            nextRequiredAction: "Create a bounded ExecutionAuthorityRecord before local worker execution."
          })
        ]
      }
    } as AutoImplementationRunProjection);
    const markup = renderPanelMarkup(view);

    expect(markup).toContain("Missing ExecutionAuthorityRecord");
    expect(markup).toContain("ExecutionAuthorityRecord is missing.");
    expect(markup).toContain("Missing evidence");
    expect(markup).toContain("ExecutionAuthorityRecord");
  });

  it("keeps the worker plan section hidden until a local worker job exists", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);
    const markup = renderPanelMarkup(view);

    expect(markup).not.toContain("Local worker bounded plan");
  });

  it("renders the latest GitHub PR mutation evidence", () => {
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

    expect(markup).toContain("GitHub PR mutation evidence");
    expect(markup).toContain("GitHub PR mutation: update_pr_body applied");
    expect(markup).toContain("1 PR mutation record(s) captured.");
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
  });

  it("renders the remote warning and local issue documents", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);
    const markup = renderPanelMarkup(view);

    expect(markup).toContain("Auto implementation workspace");
    expect(markup).toContain("Initial implementation and PR creation");
    expect(markup).toContain("Review and merge protocol");
    expect(markup).toContain("Do not merge until the feature PR code review reaches two consecutive no-finding passes");
    expect(markup).toContain("Sync main after merge and rerun the full verification command on main.");
    expect(markup).toContain("implementation-issues/001-initial_pr.md");
    expect(markup).toContain("GitHub issue mutation contract");
    expect(markup).toContain("GitHub issue mutation: not_requested");
    expect(markup).toContain("GitHub PR mutation evidence");
    expect(markup).toContain("GitHub PR mutation: no records");
    expect(markup).toContain("No GitHub PR mutation records yet");
    expect(markup).toContain("Local Codex worker: not planned");
    expect(markup).toContain("Approve worker authority + plan job");
    expect(markup).toContain("Record current stage tick");
    expect(markup).toContain("Start current stage");
    expect(markup).toContain("Pause current stage");
    expect(markup).toContain("Block current stage");
    expect(markup).toContain("Complete worker from ledger");
    expect(markup).toContain("Import worker ledger");
    expect(markup).toContain("Record GitHub issue dry-run");
    expect(markup).toContain("Apply approved GitHub issues");
    expect(markup).toContain("Record PR open dry-run");
    expect(markup).toContain("Apply approved PR open");
    expect(markup).toContain("Record PR body dry-run");
    expect(markup).toContain("Record PR merge dry-run");
    expect(markup).toContain("Apply approved PR body update");
    expect(markup).toContain("Apply approved PR merge");
    expect(markup).toContain("Run worker job");
    expect(markup).toContain("Advance worker stage");
    expect(markup).toContain("local markdown issue paths remain the source of truth");
    expect(markup).toContain("git remote add origin");
  });
});
