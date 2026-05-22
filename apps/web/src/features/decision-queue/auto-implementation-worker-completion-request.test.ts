import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
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

function stageMatchedLedger(): ImplementationStepLedgerProjection {
  const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;

  return {
    ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
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
        stepDoc: {
          ...step.stepDoc,
          stepId: "step_initial_pr",
          sourceRefs: ["auto-implementation-stage:initial_pr"]
        }
      }
    ]
  } as ImplementationStepLedgerProjection;
}

describe("auto implementation worker completion requests", () => {
  it("selects a completed ledger step matching the current auto implementation stage first", () => {
    expect(selectAutoImplementationWorkerCompletionStepId({
      run: plannedWorkerRun(),
      ledger: stageMatchedLedger()
    })).toBe("step_initial_pr");
  });

  it("falls back to the latest completed ledger step when no stage source ref matches", () => {
    expect(selectAutoImplementationWorkerCompletionStepId({
      run: plannedWorkerRun(),
      ledger: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE
    })).toBe("step_demo");
  });

  it("builds a worker completion request from the latest current-stage worker and selected ledger step", () => {
    const run = plannedWorkerRun();
    const request = buildAutoImplementationWorkerCompletionRequest({
      sessionId: "demo-session" as SessionId,
      run,
      ledger: stageMatchedLedger()
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      runId: run.runId,
      jobId: "auto-worker-job:auto_run_demo:initial_pr:planned",
      implementationStepId: "step_initial_pr",
      evidenceRefs: ["ui-worker-complete-from-ledger:auto-worker-job:auto_run_demo:initial_pr:planned:step_initial_pr"]
    });
    expect(request?.idempotencyKey).toContain("auto-implementation-worker-complete");
    expect(request?.idempotencyKey).toContain("step_initial_pr");
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
