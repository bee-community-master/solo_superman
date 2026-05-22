import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  type AutoImplementationRun,
  type SessionId
} from "@solo-superman/contracts";
import {
  buildAutoImplementationPullRequestDryRunRequest,
  buildAutoImplementationPullRequestOpenDryRunRequest
} from "./auto-implementation-pr-mutation-request";

function readyRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("Auto implementation fixture must include latestRun.");
  }

  return run;
}

function withPrUrl(run: AutoImplementationRun): AutoImplementationRun {
  const record = {
    mutationId: "auto-pr-mutation:auto_run_demo:open_pr:open_1",
    action: "open_pr",
    requestMode: "dry_run",
    status: "dry_run_ready",
    requiredRemoteStatus: "connected",
    mutatesGitHub: false,
    pullRequestUrl: "https://github.com/bee-community-master/demo/pull/1",
    issueLinks: ["local-001"],
    implementationScope: "Open PR dry-run.",
    reviewStreakRefs: [],
    verificationCommands: ["pnpm verify"],
    knownGaps: [],
    rollbackNotes: "Dry-run only.",
    mergeEvidenceRefs: [],
    bodyEvidenceRefs: [],
    approval: null,
    blockedReason: null,
    auditEvidenceRefs: ["auto-pr-mutation:open_pr:open_1", "github-pr-mutation:dry_run_ready"],
    verifierEvidenceRefs: [],
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z"
  } as AutoImplementationRun["pullRequestMutations"]["records"][number];

  return {
    ...run,
    remoteStatus: "connected",
    pullRequestMutations: {
      records: [record],
      latestRecord: record
    }
  };
}

describe("buildAutoImplementationPullRequestDryRunRequest", () => {
  it("builds a read-only open PR dry-run before any PR URL exists", () => {
    const run = readyRun();
    const request = buildAutoImplementationPullRequestOpenDryRunRequest({
      sessionId: "demo-session" as SessionId,
      run
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      runId: run.runId,
      action: "open_pr",
      requestMode: "dry_run",
      pullRequestTitle: `Auto implementation ${run.projectFolderName}`,
      issueLinks: ["local-001", "local-002", "local-003", "local-004", "local-005", "local-006", "local-007"],
      implementationScope: `Dry-run PR creation for ${run.currentStage} using implementation-tracker.md.`,
      verificationCommands: ["pnpm verify"],
      verifierEvidenceRefs: [`verifier:pr-open-dry-run:${run.runId}:${run.currentStage}`]
    });
    expect(request.pullRequestUrl).toBeUndefined();
    expect(request.bodyEvidenceRefs).toBeUndefined();
    expect(request.approval).toBeUndefined();
    expect(request.knownGaps).toEqual(
      expect.arrayContaining([
        "Remote status is no_remote; mutation stays blocked until connected.",
        expect.stringContaining("open-PR dry-run readiness only")
      ])
    );
  });

  it("keeps an existing PR URL as a visible open-dry-run gap instead of targeting it", () => {
    const run = withPrUrl(readyRun());
    const request = buildAutoImplementationPullRequestOpenDryRunRequest({
      sessionId: "demo-session" as SessionId,
      run
    });

    expect(request.pullRequestUrl).toBeUndefined();
    expect(request.knownGaps).toContain(
      "A PR URL is already recorded; use the PR body dry-run to refresh the existing PR evidence."
    );
    expect(request.knownGaps).not.toContain("Remote status is connected; mutation stays blocked until connected.");
  });

  it("builds a read-only PR body update dry-run with visible blocked gaps when remote or PR URL is missing", () => {
    const run = readyRun();
    const request = buildAutoImplementationPullRequestDryRunRequest({
      sessionId: "demo-session" as SessionId,
      run
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      runId: run.runId,
      action: "update_pr_body",
      requestMode: "dry_run",
      pullRequestTitle: `Auto implementation ${run.projectFolderName}`,
      issueLinks: ["local-001", "local-002", "local-003", "local-004", "local-005", "local-006", "local-007"],
      verificationCommands: ["pnpm verify"],
      bodyEvidenceRefs: [`pr-body:dry-run:${run.runId}:${run.currentStage}`],
      verifierEvidenceRefs: [`verifier:pr-body-dry-run:${run.runId}:${run.currentStage}`]
    });
    expect(request.requestMode).toBe("dry_run");
    expect(request.approval).toBeUndefined();
    expect(request.pullRequestUrl).toBeUndefined();
    expect(request.knownGaps).toEqual(
      expect.arrayContaining([
        "Remote status is no_remote; mutation stays blocked until connected.",
        "No GitHub PR URL has been recorded yet.",
        expect.stringContaining("dry-run readiness only")
      ])
    );
  });

  it("reuses the latest PR URL when a previous mutation recorded one", () => {
    const run = withPrUrl(readyRun());
    const request = buildAutoImplementationPullRequestDryRunRequest({
      sessionId: "demo-session" as SessionId,
      run
    });

    expect(request.pullRequestUrl).toBe("https://github.com/bee-community-master/demo/pull/1");
    expect(request.knownGaps).not.toContain("No GitHub PR URL has been recorded yet.");
    expect(request.knownGaps).not.toContain("Remote status is connected; mutation stays blocked until connected.");
  });
});
