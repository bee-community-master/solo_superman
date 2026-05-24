import { autoImplementationPlanningIssueEvidenceRefs } from "@solo-superman/contracts";
import type {
  AutoImplementationRun,
  CreateAutoImplementationWorkerJobRequest,
  CreateExecutionAuthorityRequest,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";

function safeRefPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "") || "ref";
}

function currentStageIssue(run: AutoImplementationRun) {
  return run.issueManagement.issueDocs.find((issue) => issue.stage === run.currentStage) ??
    run.issueManagement.issueDocs[0] ??
    null;
}

export function buildAutoImplementationWorkerAuthorityRequest(input: {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly run: AutoImplementationRun;
  readonly sourcePlanningRef: string;
  readonly planningSourceExists: boolean;
  readonly approvedAt: string;
}): CreateExecutionAuthorityRequest {
  const { approvedAt, expectedStateVersion, planningSourceExists, run, sessionId, sourcePlanningRef } = input;
  const issue = currentStageIssue(run);
  const stageRef = safeRefPart(run.currentStage);
  const runRef = safeRefPart(run.runId);
  const issueRef = safeRefPart(issue?.issueId ?? "issue");
  const previewArtifactRef = `auto-worker-authority-preview:${run.runId}:${run.currentStage}:${issue?.issueId ?? "issue"}`;
  const previewArtifactHash = `auto_worker_authority_preview_${runRef}_${stageRef}_${issueRef}_${safeRefPart(run.updatedAt)}`;
  const authorityRef = `auto-worker-authority:${run.runId}:${run.currentStage}:${issue?.issueId ?? "issue"}`;
  const boundedOutputId = `bounded_output_auto_worker_${runRef}_${stageRef}_${issueRef}`;
  const issueSourceRef = issue ? `issue-doc:${issue.relativePath}` : `auto-implementation-stage:${run.currentStage}`;
  const planningIssueEvidenceRefs = autoImplementationPlanningIssueEvidenceRefs(run);

  return {
    sessionId,
    expectedStateVersion,
    idempotencyKey: `auto-worker-authority:${sessionId}:${run.runId}:${run.currentStage}:${issue?.issueId ?? "issue"}`,
    sourcePlanningHandoffRef: sourcePlanningRef,
    boundedAgentOutput: {
      outputId: boundedOutputId,
      sourceRefs: [
        `auto-implementation-run:${run.runId}`,
        `auto-implementation-stage:${run.currentStage}`,
        issueSourceRef,
        ...planningIssueEvidenceRefs
      ],
      intendedDecisionImpact:
        "Approve only the generated workspace file-diff boundary required to plan the next local Codex worker job.",
      proposedActionPreviewRefs: [previewArtifactRef],
      requiredApprovals: ["local-operator-click:auto-worker-authority"],
      evidenceRefs: [
        authorityRef,
        `workspace:${run.generatedRepoPath}`,
        issueSourceRef,
        ...planningIssueEvidenceRefs
      ],
      failureMode: "ready_for_preview",
      noExecutionPolicy: "controlled_execution_required"
    },
    actionClass: "file_diff",
    previewArtifactRef,
    previewArtifactHash,
    reviewedPreviewArtifactHash: previewArtifactHash,
    requestedScope: {
      workspaceRef: run.generatedRepoPath,
      filePathGlobs: ["**/*"]
    },
    approvalDecision: "approved",
    approver: {
      actorId: "local_operator",
      actorType: "local_operator",
      approvedAt,
      decidedAt: approvedAt
    },
    sandboxBoundary: {
      mode: "workspace_patch",
      networkPolicy: "blocked",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: "git_diff_reverse",
      ref: `rollback:auto-worker-authority:${run.runId}:${run.currentStage}`
    },
    evidenceRefs: [
      authorityRef,
      `auto-implementation-run:${run.runId}`,
      `workspace:${run.generatedRepoPath}`,
      issueSourceRef,
      ...planningIssueEvidenceRefs
    ],
    auditRefs: [`audit:auto-worker-authority:${run.runId}:${run.currentStage}`],
    preconditionChecks: {
      planningSourceExists,
      previewArtifactExists: true,
      previewHashMatches: true,
      rollbackAvailable: true,
      credentialValueRequired: false,
      sandboxEnforced: true
    }
  };
}

export function buildAutoImplementationWorkerJobRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly executionAuthorityRef: string;
}): CreateAutoImplementationWorkerJobRequest {
  const { executionAuthorityRef, run, sessionId } = input;

  return {
    sessionId,
    runId: run.runId,
    idempotencyKey: `auto-implementation-worker:${sessionId}:${run.runId}:${run.currentStage}:${executionAuthorityRef}`,
    executionAuthorityRef
  };
}
