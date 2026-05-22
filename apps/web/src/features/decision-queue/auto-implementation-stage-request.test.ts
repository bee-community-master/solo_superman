import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
  autoImplementationWorkerExpectedChangeScope,
  autoImplementationWorkerLedgerStepDescription,
  type AutoImplementationRun,
  type SessionId
} from "@solo-superman/contracts";
import {
  buildAutoImplementationStageLifecycleRequest,
  buildAutoImplementationStageTickRequest
} from "./auto-implementation-stage-request";

function readyRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("Auto implementation fixture must include latestRun.");
  }

  return run;
}

describe("auto implementation stage requests", () => {
  it("builds a current-stage tick request with stable run evidence", () => {
    const run = readyRun();
    const request = buildAutoImplementationStageTickRequest({
      sessionId: "demo-session" as SessionId,
      run,
      tickedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      runId: run.runId,
      stage: run.currentStage,
      action: "tick",
      tickedAt: "2026-05-23T00:00:00.000Z",
      evidenceRefs: [`ui-stage-tick:${run.runId}:${run.currentStage}`]
    });
    expect(request.idempotencyKey).toContain("auto-implementation-stage-tick");
    expect(request.idempotencyKey).toContain(run.currentStage);
    expect(request.idempotencyKey).toContain(run.nextTickAt);
  });

  it("builds start and pause lifecycle requests for the current stage", () => {
    const run = readyRun();
    const started = buildAutoImplementationStageLifecycleRequest({
      sessionId: "demo-session" as SessionId,
      run,
      action: "start",
      tickedAt: "2026-05-23T00:01:00.000Z"
    });
    const paused = buildAutoImplementationStageLifecycleRequest({
      sessionId: "demo-session" as SessionId,
      run,
      action: "pause",
      tickedAt: "2026-05-23T00:02:00.000Z"
    });

    expect(started).toMatchObject({
      stage: run.currentStage,
      action: "start",
      evidenceRefs: [`ui-stage-start:${run.runId}:${run.currentStage}`]
    });
    expect(started.idempotencyKey).toContain("auto-implementation-stage-start");
    expect(paused).toMatchObject({
      stage: run.currentStage,
      action: "pause",
      evidenceRefs: [`ui-stage-pause:${run.runId}:${run.currentStage}`]
    });
    expect(paused.idempotencyKey).toContain("auto-implementation-stage-pause");
  });

  it("builds a block request using current-stage worker blocker evidence when present", () => {
    const baseRun = readyRun();
    const run: AutoImplementationRun = {
      ...baseRun,
      workerJobs: [
        {
          jobId: "auto-worker-job:auto_run_demo:initial_pr:blocked",
          runId: baseRun.runId,
          stage: baseRun.currentStage,
          issueId: "local-001",
          issueTitle: "Workspace repo bootstrap and initial implementation PR",
          issueRelativePath: "implementation-issues/001-initial_pr.md",
          status: "blocked",
          executionPlan: {
            executionMode: "local_sandboxed_codex",
            workingDirectory: baseRun.generatedRepoPath,
            issueDocumentPath: "implementation-issues/001-initial_pr.md",
            executionAuthorityRef: "exec_auth_auto_worker_initial_pr",
            ledgerTrackerDoc: {
              trackerId: `auto-implementation-tracker:${baseRun.runId}`,
              title: "demo-project implementation tracker",
              goal: AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
              sourceRefs: [
                `auto-implementation-run:${baseRun.runId}`,
                "tracker-doc:implementation-tracker.md"
              ]
            },
            ledgerStepDoc: {
              stepId: `auto-implementation-step:${baseRun.runId}:${baseRun.currentStage}:local-001`,
              title: "Workspace repo bootstrap and initial implementation PR",
              description: autoImplementationWorkerLedgerStepDescription({
                stage: baseRun.currentStage,
                issueRelativePath: "implementation-issues/001-initial_pr.md"
              }),
              sourceRefs: [
                `auto-implementation-run:${baseRun.runId}`,
                `auto-implementation-stage:${baseRun.currentStage}`,
                "auto-implementation-worker-job:auto_run_demo:initial_pr:blocked",
                "auto-implementation-issue:local-001",
                "issue-doc:implementation-issues/001-initial_pr.md"
              ],
              expectedChangeScope: autoImplementationWorkerExpectedChangeScope(baseRun.currentStage)
            },
            allowedWriteScope: ["."],
            requiredEvidence: ["ImplementationStepLedger trackerDoc and stepDoc"],
            forbiddenActions: ["credential storage"],
            sourceRefs: [`auto-implementation-run:${baseRun.runId}`]
          },
          blockedReason: "Worker could not import completed ledger evidence.",
          missingEvidence: ["ImplementationStepLedger import"],
          nextRequiredAction: "Retry ledger import with completed evidence.",
          createdAt: "2026-05-23T00:02:00.000Z",
          updatedAt: "2026-05-23T00:02:00.000Z",
          evidenceRefs: ["worker-blocked:ledger-import"]
        }
      ]
    };
    const request = buildAutoImplementationStageLifecycleRequest({
      sessionId: "demo-session" as SessionId,
      run,
      action: "block",
      tickedAt: "2026-05-23T00:03:00.000Z"
    });

    expect(request).toMatchObject({
      stage: run.currentStage,
      action: "block",
      evidenceRefs: [`ui-stage-block:${run.runId}:${run.currentStage}`],
      blocker: {
        stage: run.currentStage,
        reason: "Worker could not import completed ledger evidence.",
        missingEvidence: ["ImplementationStepLedger import"],
        nextRequiredAction: "Retry ledger import with completed evidence.",
        evidenceRefs: [
          `ui-stage-block:${run.runId}:${run.currentStage}`,
          "worker-blocked:ledger-import"
        ]
      }
    });
    expect(request.idempotencyKey).toContain("auto-implementation-stage-block");
  });

  it("keeps a visible operator blocker when no worker blocker exists", () => {
    const run = readyRun();
    const request = buildAutoImplementationStageLifecycleRequest({
      sessionId: "demo-session" as SessionId,
      run,
      action: "block",
      tickedAt: "2026-05-23T00:04:00.000Z"
    });

    expect(request.blocker).toMatchObject({
      stage: run.currentStage,
      reason: expect.stringContaining("Operator marked"),
      missingEvidence: ["manual blocker review"],
      nextRequiredAction: expect.stringContaining("Resolve the current stage blocker")
    });
  });
});
