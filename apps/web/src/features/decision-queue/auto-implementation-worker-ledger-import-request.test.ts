import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
  type AutoImplementationRun,
  type RecordImplementationStepLedgerPayload,
  type SessionId
} from "@solo-superman/contracts";
import { buildAutoImplementationWorkerLedgerImportRequest } from "./auto-implementation-worker-ledger-import-request";

function workerJob(overrides: Partial<AutoImplementationRun["workerJobs"][number]> = {}): AutoImplementationRun["workerJobs"][number] {
  const baseRun = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!;

  return {
    jobId: "auto-worker-job:auto_run_demo:initial_pr:job_planned",
    runId: baseRun.runId,
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
      ledgerTrackerDoc: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.trackerDoc,
      ledgerStepDoc: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!.stepDoc,
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
    evidenceRefs: ["auto-worker-job:auto_run_demo:initial_pr:job_planned"],
    ...overrides
  };
}

function transition(): RecordImplementationStepLedgerPayload {
  const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;

  return {
    trackerDoc: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.trackerDoc,
    stepDoc: step.stepDoc,
    targetStatus: "ready"
  };
}

describe("auto implementation worker ledger import request builder", () => {
  it("builds an import request for the latest current-stage worker from an envelope", () => {
    const currentStageJob = workerJob({
      jobId: "auto-worker-job:auto_run_demo:code_review_fix_1:job_planned",
      stage: "code_review_fix_1",
      issueId: "local-002",
      updatedAt: "2026-05-19T00:02:00.000Z"
    });
    const run = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      currentStage: "code_review_fix_1",
      workerJobs: [
        workerJob({ status: "completed" }),
        currentStageJob
      ]
    } as AutoImplementationRun;
    const result = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId: "sess_import" as SessionId,
      run,
      draft: JSON.stringify({
        ledgerTransitions: [transition()],
        evidenceRefs: ["operator:manual-ledger"]
      }),
      importedAt: "2026-05-19T00:03:00.000Z"
    });

    expect(result.error).toBeNull();
    expect(result.request).toMatchObject({
      sessionId: "sess_import",
      runId: "auto_run_demo",
      jobId: "auto-worker-job:auto_run_demo:code_review_fix_1:job_planned",
      ledgerTransitions: [transition()],
      evidenceRefs: ["operator:manual-ledger"]
    });
    expect(result.request?.idempotencyKey).toContain("code_review_fix_1:job_planned");
  });

  it("accepts a raw ledger transition array and adds UI evidence", () => {
    const run = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      workerJobs: [workerJob()]
    } as AutoImplementationRun;
    const result = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId: "sess_import" as SessionId,
      run,
      draft: JSON.stringify([transition()]),
      importedAt: "2026-05-19T00:03:00.000Z"
    });

    expect(result.request).toMatchObject({
      jobId: "auto-worker-job:auto_run_demo:initial_pr:job_planned",
      evidenceRefs: ["ui-worker-ledger-import:auto-worker-job:auto_run_demo:initial_pr:job_planned"]
    });
  });

  it("rejects invalid JSON before calling the sidecar route", () => {
    const run = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      workerJobs: [workerJob()]
    } as AutoImplementationRun;
    const result = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId: "sess_import" as SessionId,
      run,
      draft: "not json",
      importedAt: "2026-05-19T00:03:00.000Z"
    });

    expect(result.request).toBeNull();
    expect(result.error).toContain("Paste worker ledger JSON");
  });

  it("rejects previous-stage worker jobs as stale import targets", () => {
    const run = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      currentStage: "code_review_fix_1",
      workerJobs: [workerJob({ status: "completed" })]
    } as AutoImplementationRun;
    const result = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId: "sess_import" as SessionId,
      run,
      draft: JSON.stringify([transition()]),
      importedAt: "2026-05-19T00:03:00.000Z"
    });

    expect(result.request).toBeNull();
    expect(result.error).toContain("current-stage local Codex worker job");
  });

  it("rejects workers blocked on non-importable evidence before calling the route", () => {
    const run = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      workerJobs: [
        workerJob({
          status: "blocked",
          missingEvidence: ["ExecutionAuthorityRecord"],
          blockedReason: "ExecutionAuthorityRecord is missing."
        })
      ]
    } as AutoImplementationRun;
    const result = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId: "sess_import" as SessionId,
      run,
      draft: JSON.stringify([transition()]),
      importedAt: "2026-05-19T00:03:00.000Z"
    });

    expect(result.request).toBeNull();
    expect(result.error).toContain("planned or blocked on ledger/worker-output evidence");
  });
});
