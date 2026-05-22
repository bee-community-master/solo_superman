import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  type AutoImplementationRun,
  type SessionId
} from "@solo-superman/contracts";
import {
  buildAutoImplementationGitHubIssueApprovedRequest,
  buildAutoImplementationGitHubIssueDryRunRequest
} from "./auto-implementation-github-issue-request";

function readyRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("Auto implementation fixture must include latestRun.");
  }

  return run;
}

function withGitHubIssueDryRunReady(run: AutoImplementationRun): AutoImplementationRun {
  return {
    ...run,
    remoteStatus: "connected",
    issueManagement: {
      ...run.issueManagement,
      mode: "github_ready",
      githubIssueUrls: [],
      githubIssueMutation: {
        ...run.issueManagement.githubIssueMutation,
        status: "dry_run_ready",
        blockedReason: null,
        plannedIssues: run.issueManagement.issueDocs.map((issue) => ({
          issueId: issue.issueId,
          title: issue.title,
          bodyMarkdownPath: issue.relativePath,
          sourceStage: issue.stage
        })),
        auditEvidenceRefs: ["github-issue-mutation:dry_run_ready"]
      }
    }
  };
}

describe("auto implementation GitHub issue mutation requests", () => {
  it("builds a dry-run issue creation request for the existing generated workspace", () => {
    const run = readyRun();
    const request = buildAutoImplementationGitHubIssueDryRunRequest({
      sessionId: "demo-session" as SessionId,
      run
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      projectFolderName: run.projectFolderName,
      sourcePlanningRef: `auto-implementation-run:${run.runId}`,
      trackerTitle: `${run.projectFolderName} implementation tracker`,
      githubIssueCreation: {
        mode: "dry_run"
      }
    });
    expect(request.idempotencyKey).toContain("auto-implementation-github-issues:dry-run");
    expect(request.issueTitles).toEqual(run.issueManagement.issueDocs.map((issue) => issue.title));
  });

  it("builds an approved issue creation request with approval and verifier evidence", () => {
    const run = withGitHubIssueDryRunReady(readyRun());
    const request = buildAutoImplementationGitHubIssueApprovedRequest({
      sessionId: "demo-session" as SessionId,
      run,
      approvedAt: "2026-05-22T00:00:00.000Z"
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      projectFolderName: run.projectFolderName,
      githubIssueCreation: {
        mode: "approved",
        approval: {
          approvedBy: "local_operator",
          approvedAt: "2026-05-22T00:00:00.000Z",
          actionClass: "github_issue_create",
          approvalGranularity: "per_action",
          remoteStatusAtApproval: "connected",
          rollbackPlan: expect.stringContaining("Close the generated GitHub issues"),
          evidenceRefs: [`local-operator-click:github-issue-create:${run.runId}`]
        },
        verifierEvidenceRefs: [`verifier:github-issue-create-approved:${run.runId}`]
      }
    });
    expect(request.idempotencyKey).toContain("auto-implementation-github-issues:approved");
  });
});
