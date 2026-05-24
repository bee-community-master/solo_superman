import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  containsExecutionAuthoritySecretValueLeak,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  buildAutoImplementationWorkerAuthorityRequest,
  buildAutoImplementationWorkerJobRequest
} from "./auto-implementation-worker-authority-request";

describe("auto implementation worker authority request builder", () => {
  it("builds an approved file-diff authority scoped to the generated workspace", () => {
    const planningIssueEvidenceRef =
      "planning-handoff-pr-issue:planning-handoff-pr-issues/001-phase2-api-ready.md";
    const run = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
      evidenceRefs: [
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.evidenceRefs,
        planningIssueEvidenceRef
      ]
    };
    const request = buildAutoImplementationWorkerAuthorityRequest({
      sessionId: "sess_auto_worker" as SessionId,
      expectedStateVersion: 7 as StateVersion,
      run,
      sourcePlanningRef: "planning_handoff_ready_demo",
      planningSourceExists: true,
      approvedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(request).toMatchObject({
      sessionId: "sess_auto_worker",
      expectedStateVersion: 7,
      sourcePlanningHandoffRef: "planning_handoff_ready_demo",
      actionClass: "file_diff",
      approvalDecision: "approved",
      requestedScope: {
        workspaceRef: "/repo/workspace/demo-project",
        filePathGlobs: ["**/*"]
      },
      sandboxBoundary: {
        mode: "workspace_patch",
        networkPolicy: "blocked",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: {
        kind: "git_diff_reverse",
        ref: "rollback:auto-worker-authority:auto_run_demo:initial_pr"
      },
      preconditionChecks: {
        planningSourceExists: true,
        previewArtifactExists: true,
        previewHashMatches: true,
        rollbackAvailable: true,
        credentialValueRequired: false,
        sandboxEnforced: true
      }
    });
    expect(request.previewArtifactHash).toBe(request.reviewedPreviewArtifactHash);
    expect(request.boundedAgentOutput.outputId).toMatch(/^bounded_output_auto_worker_/u);
    expect(request.boundedAgentOutput.sourceRefs).toEqual(
      expect.arrayContaining([
        "auto-implementation-run:auto_run_demo",
        "auto-implementation-stage:initial_pr",
        "issue-doc:implementation-issues/001-initial_pr.md",
        planningIssueEvidenceRef
      ])
    );
    expect(request.boundedAgentOutput.evidenceRefs).toEqual(expect.arrayContaining([planningIssueEvidenceRef]));
    expect(request.evidenceRefs).toEqual(expect.arrayContaining([planningIssueEvidenceRef]));
    expect(request.boundedAgentOutput.requiredApprovals).toEqual([
      "local-operator-click:auto-worker-authority"
    ]);
    expect(containsExecutionAuthoritySecretValueLeak(request)).toBe(false);
  });

  it("keeps the authority preflight blockable when the planning source is not ready", () => {
    const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!;
    const request = buildAutoImplementationWorkerAuthorityRequest({
      sessionId: "sess_auto_worker" as SessionId,
      expectedStateVersion: 7 as StateVersion,
      run,
      sourcePlanningRef: "auto-implementation-run:auto_run_demo",
      planningSourceExists: false,
      approvedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(request.sourcePlanningHandoffRef).toBe("auto-implementation-run:auto_run_demo");
    expect(request.preconditionChecks?.planningSourceExists).toBe(false);
  });

  it("passes the approved authority record id into the worker job request", () => {
    const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!;
    const request = buildAutoImplementationWorkerJobRequest({
      sessionId: "sess_auto_worker" as SessionId,
      run,
      executionAuthorityRef: "exec_auth_auto_worker_initial_pr"
    });

    expect(request).toEqual({
      sessionId: "sess_auto_worker",
      runId: "auto_run_demo",
      idempotencyKey:
        "auto-implementation-worker:sess_auto_worker:auto_run_demo:initial_pr:exec_auth_auto_worker_initial_pr",
      executionAuthorityRef: "exec_auth_auto_worker_initial_pr"
    });
  });
});
