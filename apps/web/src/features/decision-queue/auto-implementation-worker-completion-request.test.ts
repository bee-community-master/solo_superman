import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  autoImplementationWorkerExpectedChangeScope,
  autoImplementationWorkerLedgerStepDescription,
  type AutoImplementationRun,
  type ImplementationStepLedgerProjection,
  type SessionId
} from "@solo-superman/contracts";
import {
  buildAutoImplementationWorkerCompletionRequest,
  canCompleteAutoImplementationWorkerFromLedger,
  selectAutoImplementationWorkerCompletionStepId
} from "./auto-implementation-worker-completion-request";

function readyRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("Auto implementation fixture must include latestRun.");
  }

  return run;
}

function plannedWorkerRun(): AutoImplementationRun {
  const run = readyRun();

  return {
    ...run,
    workerJobs: [
      {
        jobId: "auto-worker-job:auto_run_demo:initial_pr:planned",
        runId: run.runId,
        stage: run.currentStage,
        issueId: "local-001",
        issueTitle: "Workspace repo bootstrap and initial implementation PR",
        issueRelativePath: "implementation-issues/001-initial_pr.md",
        status: "planned",
        executionPlan: {
          executionMode: "local_sandboxed_codex",
          workingDirectory: run.generatedRepoPath,
          issueDocumentPath: "implementation-issues/001-initial_pr.md",
          executionAuthorityRef: "exec_auth_auto_worker_initial_pr",
          ledgerTrackerDoc: {
            trackerId: `auto-implementation-tracker:${run.runId}`,
            title: "demo-project implementation tracker",
            goal: AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
            sourceRefs: [
              `auto-implementation-run:${run.runId}`,
              "tracker-doc:implementation-tracker.md"
            ]
          },
          ledgerStepDoc: {
            stepId: `auto-implementation-step:${run.runId}:${run.currentStage}:local-001`,
            title: "Workspace repo bootstrap and initial implementation PR",
            description: autoImplementationWorkerLedgerStepDescription({
              stage: run.currentStage,
              issueRelativePath: "implementation-issues/001-initial_pr.md"
            }),
            sourceRefs: [
              `auto-implementation-run:${run.runId}`,
              `auto-implementation-stage:${run.currentStage}`,
              "auto-implementation-worker-job:auto_run_demo:initial_pr:planned",
              "auto-implementation-issue:local-001",
              "issue-doc:implementation-issues/001-initial_pr.md"
            ],
            expectedChangeScope: autoImplementationWorkerExpectedChangeScope(run.currentStage)
          },
          allowedWriteScope: ["."],
          requiredEvidence: ["ImplementationStepLedger trackerDoc and stepDoc"],
          forbiddenActions: ["credential storage"],
          sourceRefs: [`auto-implementation-run:${run.runId}`]
        },
        blockedReason: null,
        missingEvidence: [],
        nextRequiredAction: "Run the local Codex worker.",
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:01:00.000Z",
        evidenceRefs: ["worker-plan:initial_pr"]
      }
    ]
  };
}

function ledgerWithPlannedWorkerStep(run: AutoImplementationRun): ImplementationStepLedgerProjection {
  const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
  const workerJob = run.workerJobs[0]!;

  return {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
    trackerDoc: workerJob.executionPlan.ledgerTrackerDoc,
    steps: [
      {
        ...step,
        stepDoc: {
          ...step.stepDoc,
          stepId: "step_other",
          sourceRefs: ["auto-implementation-stage:merge_main"]
        }
      },
      {
        ...step,
        stepDoc: workerJob.executionPlan.ledgerStepDoc
      }
    ]
  } as ImplementationStepLedgerProjection;
}

describe("auto implementation worker completion requests", () => {
  it("selects only a completed ledger step matching the planned worker ledger docs", () => {
    const run = plannedWorkerRun();

    expect(selectAutoImplementationWorkerCompletionStepId({
      run,
      ledger: ledgerWithPlannedWorkerStep(run)
    })).toBe("auto-implementation-step:auto_run_demo:initial_pr:local-001");
  });

  it("does not fall back to unrelated completed ledger steps when planned docs do not match", () => {
    expect(selectAutoImplementationWorkerCompletionStepId({
      run: plannedWorkerRun(),
      ledger: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE
    })).toBeNull();
  });

  it("builds a worker completion request from the latest current-stage worker and selected ledger step", () => {
    const run = plannedWorkerRun();
    const request = buildAutoImplementationWorkerCompletionRequest({
      sessionId: "demo-session" as SessionId,
      run,
      ledger: ledgerWithPlannedWorkerStep(run)
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      runId: run.runId,
      jobId: "auto-worker-job:auto_run_demo:initial_pr:planned",
      implementationStepId: "auto-implementation-step:auto_run_demo:initial_pr:local-001",
      evidenceRefs: [
        "ui-worker-complete-from-ledger:auto-worker-job:auto_run_demo:initial_pr:planned:auto-implementation-step:auto_run_demo:initial_pr:local-001"
      ]
    });
    expect(request?.idempotencyKey).toContain("auto-implementation-worker-complete");
    expect(request?.idempotencyKey).toContain("auto-implementation-step:auto_run_demo:initial_pr:local-001");
  });

  it("keeps completion disabled without a completable worker or completed ledger step", () => {
    expect(canCompleteAutoImplementationWorkerFromLedger({
      run: readyRun(),
      ledger: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE
    })).toBe(false);
    expect(canCompleteAutoImplementationWorkerFromLedger({
      run: plannedWorkerRun(),
      ledger: null
    })).toBe(false);
    expect(buildAutoImplementationWorkerCompletionRequest({
      sessionId: "demo-session" as SessionId,
      run: {
        ...plannedWorkerRun(),
        workerJobs: [
          {
            ...plannedWorkerRun().workerJobs[0]!,
            status: "blocked",
            missingEvidence: ["ExecutionAuthorityRecord"]
          }
        ]
      },
      ledger: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE
    })).toBeNull();
  });
});
