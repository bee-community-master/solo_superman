import { describe, expect, it } from "vitest";
import type { AutoImplementationRun, AutoImplementationRunProjection } from "./auto-implementation";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_STAGE_LABELS,
  AUTO_IMPLEMENTATION_STAGES,
  AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
  AutoImplementationRunValidationError,
  autoImplementationGitHubIssueUrlForIssue,
  autoImplementationIssueDocumentStatus,
  autoImplementationIssueStatusSummary,
  autoImplementationPlanningIssueDocumentStatus,
  autoImplementationPlanningIssueEvidenceRefs,
  autoImplementationPlanningIssueFiles,
  autoImplementationRunWithSynchronizedIssueDocs,
  autoImplementationWorkerExpectedChangeScope,
  autoImplementationWorkerLedgerStepDescription,
  autoImplementationWorkerRequiredEvidence,
  canCreateAutoImplementationGitHubIssues,
  canMergeAutoImplementationPullRequest,
  canOpenNewAutoImplementationPullRequest,
  hasAppliedAutoImplementationPullRequestMerge,
  isAutoImplementationPullRequestIssueLink,
  latestAutoImplementationPullRequestUrl,
  validateAutoImplementationRunProjection
} from "./auto-implementation";

function readyFixtureRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("AUTO_IMPLEMENTATION_RUN_READY_FIXTURE must include latestRun.");
  }

  return run;
}

function requiredFixtureItem<TItem>(items: readonly TItem[], index: number, label: string) {
  const item = items[index];

  if (!item) {
    throw new Error(`${label} fixture item ${index} must exist.`);
  }

  return item;
}

const readyRun = readyFixtureRun();
const connectedRemoteGuide = {
  status: "connected",
  warning: null,
  commands: [],
  nextAction: "Remote issue, PR, and merge automation can run when the later runner stage is enabled."
} as const;

function projectionWithLatestRun(run: AutoImplementationRun): AutoImplementationRunProjection {
  return {
    ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
    latestRun: run,
    runs: [run]
  } as AutoImplementationRunProjection;
}

function expectInvalidProjection(projection: unknown) {
  expect(() => validateAutoImplementationRunProjection(projection as AutoImplementationRunProjection)).toThrow(
    AutoImplementationRunValidationError
  );
}

function githubIssueApproval(evidenceRefs: readonly string[]) {
  return {
    approvalId: "approval_github_issue_create",
    approvedBy: "local_operator",
    approvedAt: "2026-05-05T00:00:00.000Z",
    actionClass: "github_issue_create",
    approvalGranularity: "per_action",
    remoteStatusAtApproval: "connected",
    rollbackPlan: "Close created issues and keep local markdown as source of truth.",
    evidenceRefs
  } as const;
}

function githubPullRequestApproval(evidenceRefs: readonly string[]) {
  return {
    approvalId: "approval_github_pr_mutation",
    approvedBy: "local_operator",
    approvedAt: "2026-05-05T00:00:00.000Z",
    actionClass: "github_pr_mutation",
    approvalGranularity: "per_action",
    remoteStatusAtApproval: "connected",
    rollbackPlan: "Restore the previous PR body or revert the merge commit.",
    evidenceRefs
  } as const;
}

function pullRequestMutationRecord(overrides: Readonly<Record<string, unknown>> = {}) {
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
    reviewStreakRefs: ["code-review:feature:clean-1", "code-review:feature:clean-2"],
    verificationCommands: ["pnpm verify"],
    knownGaps: [],
    rollbackNotes: "Use gh pr edit to restore the previous PR body.",
    mergeEvidenceRefs: [],
    bodyEvidenceRefs: ["pr-body:current-evidence"],
    approval: githubPullRequestApproval(["approval:github_pr_mutation:update_body"]),
    blockedReason: null,
    auditEvidenceRefs: ["github-pr-mutation:applied"],
    verifierEvidenceRefs: ["verifier:github_pr_mutation:ready"],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  } as AutoImplementationRun["pullRequestMutations"]["records"][number];
}

function workerExecutionPlan(input: {
  readonly jobId?: string;
  readonly stage?: AutoImplementationRun["currentStage"];
  readonly issueId?: string;
  readonly issueTitle?: string;
  readonly issueRelativePath?: string;
  readonly executionAuthorityRef?: string | null;
  readonly overrides?: Partial<AutoImplementationRun["workerJobs"][number]["executionPlan"]>;
} = {}): AutoImplementationRun["workerJobs"][number]["executionPlan"] {
  const stage = input.stage ?? "initial_pr";
  const issueId = input.issueId ?? "local-001";
  const issueTitle = input.issueTitle ?? "Workspace repo bootstrap and initial implementation PR";
  const issueRelativePath = input.issueRelativePath ?? "implementation-issues/001-initial_pr.md";
  const jobId = input.jobId ?? "auto-worker-job:auto_run_demo:initial_pr:job_1";

  return {
    executionMode: "local_sandboxed_codex",
    workingDirectory: readyRun.generatedRepoPath,
    issueDocumentPath: issueRelativePath,
    executionAuthorityRef: input.executionAuthorityRef === undefined ? "exec_auth_1" : input.executionAuthorityRef,
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
      stepId: `auto-implementation-step:auto_run_demo:${stage}:${issueId}`,
      title: issueTitle,
      description: autoImplementationWorkerLedgerStepDescription({ stage, issueRelativePath }),
      sourceRefs: [
        "auto-implementation-run:auto_run_demo",
        `auto-implementation-stage:${stage}`,
        `auto-implementation-worker-job:${jobId}`,
        `auto-implementation-issue:${issueId}`,
        `issue-doc:${issueRelativePath}`
      ],
      expectedChangeScope: autoImplementationWorkerExpectedChangeScope(stage)
    },
    allowedWriteScope: [".", issueRelativePath],
    requiredEvidence: ["ImplementationStepLedger trackerDoc and stepDoc"],
    forbiddenActions: ["production deploy"],
    sourceRefs: ["auto-implementation-run:auto_run_demo", `auto-implementation-stage:${stage}`],
    ...input.overrides
  };
}

function projectionWithAppliedGitHubIssueMutation(input: {
  readonly createdIssueUrls?: readonly string[];
  readonly githubIssueUrls?: readonly string[];
  readonly auditEvidenceRefs?: readonly string[];
  readonly blockedReason?: string | null;
} = {}) {
  const createdIssueUrls = input.createdIssueUrls ?? readyRun.issueManagement.issueDocs.map(
    (_issue, index) => `https://github.com/bee-community-master/demo/issues/${index + 1}`
  );

  return projectionWithLatestRun({
    ...readyRun,
    remoteStatus: "connected",
    remoteGuide: connectedRemoteGuide,
    issueManagement: {
      ...readyRun.issueManagement,
      mode: "github_ready",
      warning: null,
      githubIssueUrls: input.githubIssueUrls ?? createdIssueUrls,
      githubIssueMutation: {
        ...readyRun.issueManagement.githubIssueMutation,
        status: "applied",
        mutatesGitHub: true,
        approval: githubIssueApproval(["approval:github_issue_create:applied"]),
        blockedReason: input.blockedReason ?? null,
        createdIssueUrls,
        auditEvidenceRefs: input.auditEvidenceRefs ?? ["github-issue-mutation:applied"],
        verifierEvidenceRefs: ["verifier:github_issue_create:ready"]
      }
    }
  });
}

describe("AutoImplementationRunProjection contract", () => {
  it("accepts the ready fixture with seven 5-minute implementation stages and markdown fallback issues", () => {
    expect(validateAutoImplementationRunProjection(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE)).toBe(
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE
    );
    expect(readyRun.stagePlan).toHaveLength(AUTO_IMPLEMENTATION_STAGES.length);
    expect(readyRun.stagePlan[0]).toMatchObject({
      stage: "initial_pr",
      label: AUTO_IMPLEMENTATION_STAGE_LABELS.initial_pr,
      status: "ready"
    });
    expect(readyRun.issueManagement.mode).toBe("markdown_fallback");
    expect(readyRun.issueManagement.githubIssueUrls).toEqual([]);
    expect(readyRun.issueManagement.githubIssueMutation).toMatchObject({
      status: "not_requested",
      requiredRemoteStatus: "connected",
      mutatesGitHub: false,
      perActionApprovalRequired: true,
      approval: null,
      blockedReason: null,
      createdIssueUrls: [],
      auditEvidenceRefs: ["github-issue-mutation:not_requested"],
      verifierEvidenceRefs: []
    });
    expect(readyRun.issueManagement.githubIssueMutation.plannedIssues).toHaveLength(AUTO_IMPLEMENTATION_STAGES.length);
    expect(readyRun.issueManagement.githubIssueMutation.plannedIssues[0]).toMatchObject({
      issueId: "local-001",
      bodyMarkdownPath: "implementation-issues/001-initial_pr.md",
      sourceStage: "initial_pr"
    });
    expect(readyRun.issueManagement.issueDocs.map((issue) => issue.title)).toEqual([
      "Workspace repo bootstrap and initial implementation PR",
      "Feature PR code review and fix loop",
      "Repository-wide code review and fix loop",
      "Changed-code clean-code review and fix loop",
      "Repository-wide clean-code review and fix loop",
      "Final PR description update and full verification",
      "Merge verified PR to main"
    ]);
    expect(readyRun.reviewProtocol.deliveryGates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("two consecutive no-finding passes"),
        expect.stringContaining("resets that scope's two-pass no-finding streak")
      ])
    );
    expect(readyRun.reviewProtocol.stageGates.find((gate) => gate.stage === "merge_main")?.gates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rerun the full verification command on main")
      ])
    );
    expect(readyRun.remoteGuide.commands).toContain("gh auth login");
    expect(readyRun.pullRequestMutations).toEqual({
      records: [],
      latestRecord: null
    });
  });

  it("extracts Planning Handoff PR-sized issue evidence refs and markdown files", () => {
    const planningIssueRef = "planning-handoff-pr-issue:planning-handoff-pr-issues/001-phase2-api-ready.md";
    const run = {
      ...readyRun,
      evidenceRefs: [
        "planning-handoff-plan:planning-handoff-implementation-plan.md",
        planningIssueRef,
        "issue-doc:implementation-issues/001-initial_pr.md"
      ]
    };

    expect(autoImplementationPlanningIssueEvidenceRefs(run)).toEqual([planningIssueRef]);
    expect(autoImplementationPlanningIssueFiles(run)).toEqual([
      "planning-handoff-pr-issues/001-phase2-api-ready.md"
    ]);
  });

  it("synchronizes the active Planning Handoff PR-sized issue with run completion", () => {
    const planningIssueRef = "planning-handoff-pr-issue:planning-handoff-pr-issues/001-phase2-api-ready.md";
    const run = {
      ...readyRun,
      status: "completed" as const,
      issueManagement: {
        ...readyRun.issueManagement,
        planningIssueDocs: [
          {
            issueId: "phase2-api-ready",
            title: "Phase 2 API-ready implementation slice",
            relativePath: "planning-handoff-pr-issues/001-phase2-api-ready.md",
            includedTaskIds: ["task_api_ready"],
            status: "active" as const
          },
          {
            issueId: "phase2-review-ready",
            title: "Phase 2 review-ready implementation slice",
            relativePath: "planning-handoff-pr-issues/002-phase2-review-ready.md",
            includedTaskIds: ["task_review_ready"],
            status: "planned" as const
          }
        ]
      },
      evidenceRefs: [
        ...readyRun.evidenceRefs,
        planningIssueRef,
        "planning-handoff-pr-issue:planning-handoff-pr-issues/002-phase2-review-ready.md"
      ]
    };

    expect(autoImplementationPlanningIssueDocumentStatus(run, run.issueManagement.planningIssueDocs[0]!)).toBe("completed");
    expect(autoImplementationRunWithSynchronizedIssueDocs(run).issueManagement.planningIssueDocs).toMatchObject([
      { issueId: "phase2-api-ready", status: "completed" },
      { issueId: "phase2-review-ready", status: "planned" }
    ]);
  });

  it("prefers first-class Planning Handoff PR-sized issue docs when they are available", () => {
    const planningIssueRef = "planning-handoff-pr-issue:planning-handoff-pr-issues/001-phase2-api-ready.md";
    const run = {
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        planningIssueDocs: [
          {
            issueId: "phase2-api-ready",
            title: "Phase 2 API-ready implementation slice",
            relativePath: "planning-handoff-pr-issues/001-phase2-api-ready.md",
            includedTaskIds: ["task_api_ready"],
            status: "active" as const
          }
        ]
      },
      evidenceRefs: [
        ...readyRun.evidenceRefs,
        planningIssueRef
      ]
    };

    expect(autoImplementationPlanningIssueFiles(run)).toEqual([
      "planning-handoff-pr-issues/001-phase2-api-ready.md"
    ]);
    expect(validateAutoImplementationRunProjection(projectionWithLatestRun(run))).toBeTruthy();
  });

  it("adds stage-specific required evidence to local Codex worker plans", () => {
    expect(autoImplementationWorkerRequiredEvidence("initial_pr")).toEqual(
      expect.arrayContaining([
        "ImplementationStepLedger trackerDoc and stepDoc",
        expect.stringContaining("initial implementation PR evidence")
      ])
    );
    expect(autoImplementationWorkerRequiredEvidence("final_verify_pr_update")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("final missing-test audit records zero"),
        expect.stringContaining("final PR body evidence refs")
      ])
    );
    expect(autoImplementationWorkerRequiredEvidence("merge_main")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("applied GitHub PR merge mutation record"),
        expect.stringContaining("post-merge-verify:<stage>:<command>")
      ])
    );
  });

  it("accepts current-stage worker jobs that carry a bounded local Codex execution plan", () => {
    const valid = projectionWithLatestRun({
      ...readyRun,
      status: "blocked",
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:initial_pr:job_1",
          runId: readyRun.runId,
          stage: "initial_pr",
          issueId: "local-001",
          issueTitle: "Workspace repo bootstrap and initial implementation PR",
          issueRelativePath: "implementation-issues/001-initial_pr.md",
          status: "blocked",
          executionPlan: workerExecutionPlan({
            executionAuthorityRef: null,
            overrides: {
              forbiddenActions: ["credential, token, session cookie, or secret storage"]
            }
          }),
          blockedReason: "ExecutionAuthorityRecord is missing.",
          missingEvidence: ["ExecutionAuthorityRecord"],
          nextRequiredAction: "Create a bounded ExecutionAuthorityRecord before local worker execution.",
          createdAt: "2026-05-19T00:01:00.000Z",
          updatedAt: "2026-05-19T00:01:00.000Z",
          evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
        }
      ]
    });

    expect(validateAutoImplementationRunProjection(valid)).toBe(valid);
  });

  it("derives issue document status from stage and worker state", () => {
    const issue = requiredFixtureItem(readyRun.issueManagement.issueDocs, 0, "issue doc");
    const blockedWorkerJob: AutoImplementationRun["workerJobs"][number] = {
      jobId: "auto-worker-job:auto_run_demo:initial_pr:blocked_1",
      runId: readyRun.runId,
      stage: "initial_pr",
      issueId: issue.issueId,
      issueTitle: issue.title,
      issueRelativePath: issue.relativePath,
      status: "blocked",
      executionPlan: workerExecutionPlan(),
      blockedReason: "ExecutionAuthorityRecord is missing.",
      missingEvidence: ["ExecutionAuthorityRecord"],
      nextRequiredAction: "Create a bounded ExecutionAuthorityRecord before local worker execution.",
      createdAt: "2026-05-19T00:01:00.000Z",
      updatedAt: "2026-05-19T00:01:00.000Z",
      evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:blocked_1"]
    };
    const plannedWorkerJob: AutoImplementationRun["workerJobs"][number] = {
      ...blockedWorkerJob,
      jobId: "auto-worker-job:auto_run_demo:initial_pr:planned_2",
      status: "planned",
      blockedReason: null,
      missingEvidence: [],
      nextRequiredAction: "Run the bounded worker.",
      updatedAt: "2026-05-19T00:02:00.000Z"
    };
    const blockedWorkerRun: AutoImplementationRun = {
      ...readyRun,
      workerJobs: [blockedWorkerJob]
    };
    const retryableRun: AutoImplementationRun = {
      ...readyRun,
      workerJobs: [blockedWorkerJob, plannedWorkerJob]
    };
    const completedRun: AutoImplementationRun = {
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
            ...stage,
            status: "completed" as const,
            ledgerEvidence: {
              implementationStepId: "step_demo",
              trackerDocRef: "implementation-step-ledger:tracker:tracker_demo",
              stepDocRef: "implementation-step-ledger:step:step_demo",
              implementationEvidenceRefs: ["commit:abcdef1"],
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
              missingTestAuditRefs: ["missing-test-audit:verify"],
              testEvidenceRefs: ["test:verify"],
              blockerEvidenceRefs: [],
              evidenceRefs: ["implementation-step-ledger:step_demo"]
            },
            blocker: null
          }
        : stage)
    };

    expect(autoImplementationIssueDocumentStatus(blockedWorkerRun, issue)).toBe("blocked");
    const synchronizedBlockedRun = autoImplementationRunWithSynchronizedIssueDocs(blockedWorkerRun);
    expect(synchronizedBlockedRun.issueManagement.issueDocs[0]).toMatchObject({
      issueId: issue.issueId,
      status: "blocked"
    });
    expect(synchronizedBlockedRun.issueManagement.issueStatusSummary).toEqual({
      total: 7,
      open: 6,
      completed: 0,
      blocked: 1
    });
    expect(autoImplementationIssueDocumentStatus(retryableRun, issue)).toBe("open");
    expect(autoImplementationIssueDocumentStatus(completedRun, issue)).toBe("completed");
    expect(autoImplementationIssueStatusSummary(autoImplementationRunWithSynchronizedIssueDocs(completedRun).issueManagement.issueDocs))
      .toMatchObject({
        total: 7,
        open: 6,
        completed: 1,
        blocked: 0
      });
  });

  it("maps applied GitHub issue URLs back to their local issue documents", () => {
    const projection = projectionWithAppliedGitHubIssueMutation();
    const run = projection.latestRun!;
    const firstIssue = requiredFixtureItem(run.issueManagement.issueDocs, 0, "issue doc");
    const secondIssue = requiredFixtureItem(run.issueManagement.issueDocs, 1, "issue doc");

    expect(autoImplementationGitHubIssueUrlForIssue(run, firstIssue)).toBe(
      "https://github.com/bee-community-master/demo/issues/1"
    );
    expect(autoImplementationGitHubIssueUrlForIssue(run, secondIssue)).toBe(
      "https://github.com/bee-community-master/demo/issues/2"
    );
    expect(autoImplementationGitHubIssueUrlForIssue(readyRun, firstIssue)).toBeNull();
  });

  it("rejects worker execution plans that omit the exact planned ledger docs", () => {
    const executionPlanWithoutLedgerDocs = { ...workerExecutionPlan() } as Record<string, unknown>;

    delete executionPlanWithoutLedgerDocs.ledgerTrackerDoc;
    delete executionPlanWithoutLedgerDocs.ledgerStepDoc;
    const invalid = projectionWithLatestRun({
      ...readyRun,
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:initial_pr:job_1",
          runId: readyRun.runId,
          stage: "initial_pr",
          issueId: "local-001",
          issueTitle: "Workspace repo bootstrap and initial implementation PR",
          issueRelativePath: "implementation-issues/001-initial_pr.md",
          status: "planned",
          executionPlan: executionPlanWithoutLedgerDocs,
          blockedReason: null,
          missingEvidence: [],
          nextRequiredAction: "Run the bounded worker.",
          createdAt: "2026-05-19T00:01:00.000Z",
          updatedAt: "2026-05-19T00:01:00.000Z",
          evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
        }
      ]
    } as unknown as AutoImplementationRun);

    expectInvalidProjection(invalid);
  });

  it("accepts completed worker jobs only after missing evidence is cleared", () => {
    const valid = projectionWithLatestRun({
      ...readyRun,
      status: "running",
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:initial_pr:job_1",
          runId: readyRun.runId,
          stage: "initial_pr",
          issueId: "local-001",
          issueTitle: "Workspace repo bootstrap and initial implementation PR",
          issueRelativePath: "implementation-issues/001-initial_pr.md",
          status: "completed",
          executionPlan: workerExecutionPlan(),
          blockedReason: null,
          missingEvidence: [],
          nextRequiredAction: "Advance the stage through the existing stage endpoint.",
          createdAt: "2026-05-19T00:01:00.000Z",
          updatedAt: "2026-05-19T00:02:00.000Z",
          evidenceRefs: [
            "auto-worker-job:auto_run_demo:initial_pr:job_1",
            "implementation-step-ledger:step_demo"
          ]
        }
      ]
    });

    expect(validateAutoImplementationRunProjection(valid)).toBe(valid);
  });

  it("rejects worker jobs that are not tied to a canonical issue document", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:unknown:job_1",
          runId: readyRun.runId,
          stage: "initial_pr",
          issueId: "local-999",
          issueTitle: "Not a planned issue",
          issueRelativePath: "implementation-issues/999-unknown.md",
          status: "planned",
          executionPlan: workerExecutionPlan({
            jobId: "auto-worker-job:auto_run_demo:unknown:job_1",
            issueId: "local-999",
            issueTitle: "Not a planned issue",
            issueRelativePath: "implementation-issues/999-unknown.md"
          }),
          blockedReason: null,
          missingEvidence: [],
          nextRequiredAction: "Run the bounded worker.",
          createdAt: "2026-05-19T00:01:00.000Z",
          updatedAt: "2026-05-19T00:01:00.000Z",
          evidenceRefs: ["auto-worker-job:auto_run_demo:unknown:job_1"]
        }
      ]
    });

    expectInvalidProjection(invalid);
  });

  it("rejects planned worker jobs that still report missing evidence", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:initial_pr:job_1",
          runId: readyRun.runId,
          stage: "initial_pr",
          issueId: "local-001",
          issueTitle: "Workspace repo bootstrap and initial implementation PR",
          issueRelativePath: "implementation-issues/001-initial_pr.md",
          status: "planned",
          executionPlan: workerExecutionPlan(),
          blockedReason: null,
          missingEvidence: ["ExecutionAuthorityRecord"],
          nextRequiredAction: "Run the bounded worker.",
          createdAt: "2026-05-19T00:01:00.000Z",
          updatedAt: "2026-05-19T00:01:00.000Z",
          evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
        }
      ]
    });

    expectInvalidProjection(invalid);
  });

  it("rejects worker execution plans that drift from the selected workspace or issue document", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:initial_pr:job_1",
          runId: readyRun.runId,
          stage: "initial_pr",
          issueId: "local-001",
          issueTitle: "Workspace repo bootstrap and initial implementation PR",
          issueRelativePath: "implementation-issues/001-initial_pr.md",
          status: "planned",
          executionPlan: workerExecutionPlan({
            overrides: {
              workingDirectory: "/repo/workspace/other-project",
              issueDocumentPath: "implementation-issues/002_review_feature.md"
            }
          }),
          blockedReason: null,
          missingEvidence: [],
          nextRequiredAction: "Run the bounded worker.",
          createdAt: "2026-05-19T00:01:00.000Z",
          updatedAt: "2026-05-19T00:01:00.000Z",
          evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_1"]
        }
      ]
    });

    expectInvalidProjection(invalid);
  });

  it("rejects generated repo folders outside the safe slug shape", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      projectFolderName: "../escape"
    });

    expectInvalidProjection(invalid);
  });

  it("rejects generated repo folders that are reserved on Windows", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      projectFolderName: "con"
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when the stage plan is not the canonical runner sequence", () => {
    const outOfOrderStagePlan = [
      requiredFixtureItem(readyRun.stagePlan, 1, "stagePlan"),
      requiredFixtureItem(readyRun.stagePlan, 0, "stagePlan"),
      ...readyRun.stagePlan.slice(2)
    ];
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: outOfOrderStagePlan
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when issue documents do not cover the canonical stages in order", () => {
    const outOfOrderIssueDocs = [
      requiredFixtureItem(readyRun.issueManagement.issueDocs, 1, "issueDocs"),
      requiredFixtureItem(readyRun.issueManagement.issueDocs, 0, "issueDocs"),
      ...readyRun.issueManagement.issueDocs.slice(2)
    ];
    const invalid = projectionWithLatestRun({
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        issueDocs: outOfOrderIssueDocs
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects completed stages that do not include implementation ledger evidence", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
          ...stage,
          status: "completed",
          evidenceRefs: ["stage:complete:initial_pr"]
        }
        : stage)
    });

    expectInvalidProjection(invalid);
  });

  it("rejects completed stages when review streak refs do not cover every required review scope twice", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
            ...stage,
            status: "completed",
            evidenceRefs: ["stage:complete:initial_pr"],
            ledgerEvidence: {
              implementationStepId: "step_demo",
              trackerDocRef: "implementation-step-ledger:tracker:tracker_demo",
              stepDocRef: "implementation-step-ledger:step:step_demo",
              implementationEvidenceRefs: ["commit:abcdef1"],
              codeReviewStreakRefs: ["code-review:feature:clean-1", "code-review:feature:clean-2"],
              cleanCodeReviewStreakRefs: [
                "clean-code-review:changed_code:clean-1",
                "clean-code-review:changed_code:clean-2"
              ],
              missingTestAuditRefs: ["missing-test-audit:verify"],
              testEvidenceRefs: ["test:verify"],
              blockerEvidenceRefs: [],
              evidenceRefs: ["implementation-step-ledger:step_demo"]
            }
          }
        : stage)
    });

    expectInvalidProjection(invalid);
  });

  it("rejects malformed structured stage ledger evidence summaries", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
            ...stage,
            status: "completed",
            evidenceRefs: ["stage:complete:initial_pr"],
            ledgerEvidence: {
              implementationStepId: "step_demo",
              trackerDocRef: "implementation-step-ledger:tracker:tracker_demo",
              stepDocRef: "implementation-step-ledger:step:step_demo",
              implementationEvidenceRefs: ["commit:abcdef1"],
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
                }
              ],
              missingTestAuditSummary: {
                auditId: "missing_test_audit_demo",
                missingTestGapCount: -1,
                satisfied: false
              },
              missingTestAuditRefs: ["missing-test-audit:verify"],
              testEvidenceRefs: ["test:verify"],
              blockerEvidenceRefs: [],
              evidenceRefs: ["implementation-step-ledger:step_demo"]
            }
          }
        : stage)
    });

    expectInvalidProjection(invalid);
  });

  it("rejects blocked stages that do not preserve a visible blocker", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
          ...stage,
          status: "blocked",
          evidenceRefs: ["stage:block:initial_pr"]
        }
        : stage)
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when review gates do not cover the canonical delivery protocol", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      reviewProtocol: {
        ...readyRun.reviewProtocol,
        deliveryGates: readyRun.reviewProtocol.deliveryGates.slice(1)
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects malformed review gate entries without crashing validation", () => {
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...readyRun,
        reviewProtocol: {
          ...readyRun.reviewProtocol,
          stageGates: [null, ...readyRun.reviewProtocol.stageGates.slice(1)]
        }
      },
      runs: [
        {
          ...readyRun,
          reviewProtocol: {
            ...readyRun.reviewProtocol,
            stageGates: [null, ...readyRun.reviewProtocol.stageGates.slice(1)]
          }
        }
      ]
    };

    expectInvalidProjection(invalid);
  });

  it("rejects projections when remote status, guide, and issue mode drift apart", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      remoteStatus: "connected",
      remoteGuide: {
        ...readyRun.remoteGuide,
        status: "connected",
        warning: null,
        commands: []
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when the GitHub issue mutation contract implies external writes without matching issue URLs", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        githubIssueMutation: {
          ...readyRun.issueManagement.githubIssueMutation,
          status: "applied",
          mutatesGitHub: true,
          approval: {
            approvalId: "approval_123",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close created issues and keep local markdown as source of truth.",
            evidenceRefs: ["approval:github_issue_create:123"]
          },
          createdIssueUrls: ["https://github.com/bee-community-master/demo/issues/1"],
          verifierEvidenceRefs: ["verifier:github_issue_create:ready"]
        }
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when disconnected remotes are marked ready for GitHub issue mutation", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        githubIssueMutation: {
          ...readyRun.issueManagement.githubIssueMutation,
          status: "dry_run_ready",
          auditEvidenceRefs: ["github-issue-mutation:dry_run_ready"]
        }
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects approved GitHub issue mutation contracts without approval evidence refs", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      remoteStatus: "connected",
      remoteGuide: connectedRemoteGuide,
      issueManagement: {
        ...readyRun.issueManagement,
        mode: "github_ready",
        warning: null,
        githubIssueMutation: {
          ...readyRun.issueManagement.githubIssueMutation,
          status: "approved_ready",
          approval: {
            approvalId: "approval_without_evidence",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close created issues and keep local markdown as source of truth.",
            evidenceRefs: []
          },
          auditEvidenceRefs: ["github-issue-mutation:approved_ready"],
          verifierEvidenceRefs: ["verifier:github_issue_create:ready"]
        }
      }
    });

    expectInvalidProjection(invalid);
  });

  it("accepts applied GitHub issue mutation contracts with approval, audit, verifier, and created URL evidence", () => {
    const valid = projectionWithAppliedGitHubIssueMutation();

    expect(validateAutoImplementationRunProjection(valid)).toBe(valid);
  });

  it("rejects applied GitHub issue mutation contracts with non-GitHub issue URLs", () => {
    const invalidIssueUrls = ["https://example.com/not-a-github-issue"];
    const invalid = projectionWithAppliedGitHubIssueMutation({
      createdIssueUrls: invalidIssueUrls,
      githubIssueUrls: invalidIssueUrls
    });

    expectInvalidProjection(invalid);
  });

  it("rejects applied GitHub issue mutation contracts with non-canonical URL whitespace", () => {
    const invalidIssueUrls = readyRun.issueManagement.issueDocs.map(
      (_issue, index) => ` https://github.com/bee-community-master/demo/issues/${index + 1}`
    );
    const invalid = projectionWithAppliedGitHubIssueMutation({
      createdIssueUrls: invalidIssueUrls,
      githubIssueUrls: invalidIssueUrls
    });

    expectInvalidProjection(invalid);
  });

  it("rejects applied GitHub issue mutation contracts without created URL evidence", () => {
    const invalid = projectionWithAppliedGitHubIssueMutation({
      createdIssueUrls: [],
      githubIssueUrls: []
    });

    expectInvalidProjection(invalid);
  });

  it("rejects partially applied GitHub issue mutation contracts", () => {
    const invalid = projectionWithAppliedGitHubIssueMutation({
      createdIssueUrls: ["https://github.com/bee-community-master/demo/issues/1"],
      githubIssueUrls: ["https://github.com/bee-community-master/demo/issues/1"]
    });

    expectInvalidProjection(invalid);
  });

  it("rejects applied GitHub issue mutation contracts with duplicate created URLs", () => {
    const duplicateIssueUrls = readyRun.issueManagement.issueDocs.map(
      () => "https://github.com/bee-community-master/demo/issues/1"
    );
    const invalid = projectionWithAppliedGitHubIssueMutation({
      createdIssueUrls: duplicateIssueUrls,
      githubIssueUrls: duplicateIssueUrls
    });

    expectInvalidProjection(invalid);
  });

  it("rejects GitHub issue mutation contracts without audit evidence refs", () => {
    const invalid = projectionWithAppliedGitHubIssueMutation({
      auditEvidenceRefs: []
    });

    expectInvalidProjection(invalid);
  });

  it("accepts GitHub PR mutation records with approval, body evidence, and verifier refs", () => {
    const record = pullRequestMutationRecord();
    const valid = projectionWithLatestRun({
      ...readyRun,
      pullRequestMutations: {
        records: [record],
        latestRecord: record
      }
    });

    expect(validateAutoImplementationRunProjection(valid)).toBe(valid);
  });

  it("accepts only canonical generated local issue ids or GitHub issue URLs in PR mutation issue links", () => {
    expect(isAutoImplementationPullRequestIssueLink("local-001")).toBe(true);
    expect(isAutoImplementationPullRequestIssueLink("https://github.com/bee-community-master/demo/issues/1")).toBe(true);
    expect(isAutoImplementationPullRequestIssueLink("local-1")).toBe(false);
    expect(isAutoImplementationPullRequestIssueLink("local-001\n### injected heading")).toBe(false);

    const record = pullRequestMutationRecord({
      issueLinks: ["local-001\n### injected heading"]
    });
    const invalid = projectionWithLatestRun({
      ...readyRun,
      pullRequestMutations: {
        records: [record],
        latestRecord: record
      }
    });

    expectInvalidProjection(invalid);
  });

  it("detects whether an auto implementation run can create GitHub issues", () => {
    const appliedMutation = {
      ...readyRun.issueManagement.githubIssueMutation,
      status: "applied" as const,
      mutatesGitHub: true,
      createdIssueUrls: readyRun.issueManagement.githubIssueMutation.plannedIssues.map((_, index) =>
        `https://github.com/bee-community-master/demo/issues/${index + 1}`
      )
    };
    const runWithCreatedIssues = {
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        githubIssueUrls: appliedMutation.createdIssueUrls,
        githubIssueMutation: appliedMutation
      }
    };

    expect(canCreateAutoImplementationGitHubIssues(readyRun)).toBe(true);
    expect(canCreateAutoImplementationGitHubIssues(runWithCreatedIssues)).toBe(false);
  });

  it("detects whether an auto implementation run can open a new pull request", () => {
    const record = pullRequestMutationRecord();
    const runWithPrUrl = {
      ...readyRun,
      pullRequestMutations: {
        records: [record],
        latestRecord: record
      }
    };

    expect(latestAutoImplementationPullRequestUrl(readyRun)).toBeNull();
    expect(canOpenNewAutoImplementationPullRequest(readyRun)).toBe(true);
    expect(latestAutoImplementationPullRequestUrl(runWithPrUrl)).toBe("https://github.com/bee-community-master/demo/pull/1");
    expect(canOpenNewAutoImplementationPullRequest(runWithPrUrl)).toBe(false);
  });

  it("detects whether an auto implementation run can merge a pull request", () => {
    const mergeDryRun = pullRequestMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:dry_run_1",
      action: "merge_pr",
      requestMode: "dry_run",
      status: "dry_run_ready",
      mutatesGitHub: false
    });
    const mergeApplied = pullRequestMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:applied_1",
      action: "merge_pr",
      requestMode: "approved",
      status: "applied",
      mutatesGitHub: true
    });
    const runWithMergeDryRun = {
      ...readyRun,
      pullRequestMutations: {
        records: [mergeDryRun],
        latestRecord: mergeDryRun
      }
    };
    const runWithAppliedMerge = {
      ...readyRun,
      pullRequestMutations: {
        records: [mergeDryRun, mergeApplied],
        latestRecord: mergeApplied
      }
    };
    const runWithLatestAppliedMerge = {
      ...readyRun,
      pullRequestMutations: {
        records: [],
        latestRecord: mergeApplied
      }
    };

    expect(hasAppliedAutoImplementationPullRequestMerge(readyRun)).toBe(false);
    expect(canMergeAutoImplementationPullRequest(readyRun)).toBe(true);
    expect(hasAppliedAutoImplementationPullRequestMerge(runWithMergeDryRun)).toBe(false);
    expect(canMergeAutoImplementationPullRequest(runWithMergeDryRun)).toBe(true);
    expect(hasAppliedAutoImplementationPullRequestMerge(runWithAppliedMerge)).toBe(true);
    expect(canMergeAutoImplementationPullRequest(runWithAppliedMerge)).toBe(false);
    expect(hasAppliedAutoImplementationPullRequestMerge(runWithLatestAppliedMerge)).toBe(true);
    expect(canMergeAutoImplementationPullRequest(runWithLatestAppliedMerge)).toBe(false);
  });

  it("rejects applied GitHub PR body updates without current body evidence refs", () => {
    const record = pullRequestMutationRecord({
      bodyEvidenceRefs: []
    });
    const invalid = projectionWithLatestRun({
      ...readyRun,
      pullRequestMutations: {
        records: [record],
        latestRecord: record
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects applied GitHub PR merges without merge readiness evidence refs", () => {
    const record = pullRequestMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:merge_pr:merge_1",
      action: "merge_pr",
      mergeEvidenceRefs: []
    });
    const invalid = projectionWithLatestRun({
      ...readyRun,
      pullRequestMutations: {
        records: [record],
        latestRecord: record
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects GitHub PR mutation state when latestRecord does not match the last record", () => {
    const firstRecord = pullRequestMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:update_pr_body:update_1"
    });
    const lastRecord = pullRequestMutationRecord({
      mutationId: "auto-pr-mutation:auto_run_demo:update_pr_body:update_2"
    });
    const invalid = projectionWithLatestRun({
      ...readyRun,
      pullRequestMutations: {
        records: [firstRecord, lastRecord],
        latestRecord: firstRecord
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects non-blocked GitHub issue mutation contracts that still carry blocker reasons", () => {
    const invalid = projectionWithAppliedGitHubIssueMutation({
      blockedReason: "Stale blocker text should not remain after mutation is applied."
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when latestRun does not match the last run", () => {
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      runs: [
        readyRun,
        {
          ...readyRun,
          runId: "auto_run_other"
        }
      ]
    } as AutoImplementationRunProjection;

    expectInvalidProjection(invalid);
  });
});
