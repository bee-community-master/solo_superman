import type {
  AutoImplementationRun,
  RecordAutoImplementationPullRequestMutationRequest,
  SessionId
} from "@solo-superman/contracts";

function latestPullRequestUrl(run: AutoImplementationRun): string | undefined {
  return run.pullRequestMutations.latestRecord?.pullRequestUrl ??
    [...run.pullRequestMutations.records].reverse().find((record) => record.pullRequestUrl)?.pullRequestUrl ??
    undefined;
}

function issueLinksForRun(run: AutoImplementationRun) {
  return run.issueManagement.githubIssueUrls.length
    ? run.issueManagement.githubIssueUrls
    : run.issueManagement.issueDocs.map((issue) => issue.issueId);
}

function reviewStreakRefsForRun(run: AutoImplementationRun) {
  return run.stagePlan.flatMap((stage) => [
    ...(stage.ledgerEvidence?.codeReviewStreakRefs ?? []),
    ...(stage.ledgerEvidence?.cleanCodeReviewStreakRefs ?? [])
  ]);
}

function knownGapsForDryRun(run: AutoImplementationRun, pullRequestUrl: string | undefined) {
  return [
    run.remoteStatus === "connected" ? null : `Remote status is ${run.remoteStatus}; mutation stays blocked until connected.`,
    pullRequestUrl ? null : "No GitHub PR URL has been recorded yet.",
    "This UI action records dry-run readiness only; approved GitHub mutation still requires explicit approval evidence."
  ].filter((gap): gap is string => gap !== null);
}

function knownGapsForOpenDryRun(run: AutoImplementationRun) {
  return [
    run.remoteStatus === "connected" ? null : `Remote status is ${run.remoteStatus}; mutation stays blocked until connected.`,
    run.pullRequestMutations.records.some((record) => record.pullRequestUrl)
      ? "A PR URL is already recorded; use the PR body dry-run to refresh the existing PR evidence."
      : null,
    "This UI action records open-PR dry-run readiness only; approved GitHub mutation still requires explicit approval evidence."
  ].filter((gap): gap is string => gap !== null);
}

function pullRequestTitle(run: AutoImplementationRun) {
  return `Auto implementation ${run.projectFolderName}`;
}

function currentStageBodyEvidenceRef(run: AutoImplementationRun) {
  return `pr-body:dry-run:${run.runId}:${run.currentStage}`;
}

export function buildAutoImplementationPullRequestOpenDryRunRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { run, sessionId } = input;

  return {
    sessionId,
    runId: run.runId,
    action: "open_pr",
    requestMode: "dry_run",
    idempotencyKey: `pr-open-dry-run:${run.currentStage}:${run.pullRequestMutations.records.length}:${run.updatedAt}`,
    pullRequestTitle: pullRequestTitle(run),
    issueLinks: issueLinksForRun(run),
    implementationScope: `Dry-run PR creation for ${run.currentStage} using ${run.issueManagement.trackerRelativePath}.`,
    reviewStreakRefs: reviewStreakRefsForRun(run),
    verificationCommands: ["pnpm verify"],
    knownGaps: knownGapsForOpenDryRun(run),
    rollbackNotes: "Dry-run only; no GitHub PR is opened. Supersede this record after approved PR creation evidence is captured.",
    verifierEvidenceRefs: [`verifier:pr-open-dry-run:${run.runId}:${run.currentStage}`]
  };
}

export function buildAutoImplementationPullRequestDryRunRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { run, sessionId } = input;
  const pullRequestUrl = latestPullRequestUrl(run);
  const bodyEvidenceRef = currentStageBodyEvidenceRef(run);

  return {
    sessionId,
    runId: run.runId,
    action: "update_pr_body",
    requestMode: "dry_run",
    idempotencyKey: `pr-body-dry-run:${run.currentStage}:${run.pullRequestMutations.records.length}:${run.updatedAt}`,
    ...(pullRequestUrl ? { pullRequestUrl } : {}),
    pullRequestTitle: pullRequestTitle(run),
    issueLinks: issueLinksForRun(run),
    implementationScope: `Dry-run PR body update for ${run.currentStage} using ${run.issueManagement.trackerRelativePath}.`,
    reviewStreakRefs: reviewStreakRefsForRun(run),
    verificationCommands: ["pnpm verify"],
    knownGaps: knownGapsForDryRun(run, pullRequestUrl),
    rollbackNotes: "Dry-run only; no GitHub mutation is attempted. Supersede this record after approved PR body evidence is captured.",
    bodyEvidenceRefs: [bodyEvidenceRef],
    verifierEvidenceRefs: [`verifier:pr-body-dry-run:${run.runId}:${run.currentStage}`]
  };
}
