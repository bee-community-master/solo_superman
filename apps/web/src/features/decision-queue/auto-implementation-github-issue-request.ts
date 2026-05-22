import type {
  AutoImplementationRun,
  CreateAutoImplementationRunRequest,
  SessionId
} from "@solo-superman/contracts";

function issueMutationBaseRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly idempotencyAction: "dry-run" | "approved";
}): Omit<CreateAutoImplementationRunRequest, "githubIssueCreation"> {
  const { idempotencyAction, run, sessionId } = input;

  return {
    sessionId,
    idempotencyKey: `auto-implementation-github-issues:${idempotencyAction}:${sessionId}:${run.runId}:${run.issueManagement.githubIssueMutation.status}:${run.updatedAt}`,
    projectFolderName: run.projectFolderName,
    sourcePlanningRef: `auto-implementation-run:${run.runId}`,
    trackerTitle: `${run.projectFolderName} implementation tracker`,
    trackerGoal: `Create traceable GitHub issues for ${run.projectFolderName} from the generated markdown issue plan.`,
    issueTitles: run.issueManagement.issueDocs.map((issue) => issue.title)
  };
}

export function buildAutoImplementationGitHubIssueDryRunRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
}): CreateAutoImplementationRunRequest {
  return {
    ...issueMutationBaseRequest({
      ...input,
      idempotencyAction: "dry-run"
    }),
    githubIssueCreation: {
      mode: "dry_run"
    }
  };
}

export function buildAutoImplementationGitHubIssueApprovedRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly approvedAt: string;
}): CreateAutoImplementationRunRequest {
  const { approvedAt, run } = input;

  return {
    ...issueMutationBaseRequest({
      ...input,
      idempotencyAction: "approved"
    }),
    githubIssueCreation: {
      mode: "approved",
      approval: {
        approvalId: `approval_github_issue_create_${run.runId}_${run.issueManagement.githubIssueMutation.plannedIssues.length}`,
        approvedBy: "local_operator",
        approvedAt,
        actionClass: "github_issue_create",
        approvalGranularity: "per_action",
        remoteStatusAtApproval: "connected",
        rollbackPlan: "Close the generated GitHub issues if the approved issue creation targets the wrong scope.",
        evidenceRefs: [`local-operator-click:github-issue-create:${run.runId}`]
      },
      verifierEvidenceRefs: [`verifier:github-issue-create-approved:${run.runId}`]
    }
  };
}
