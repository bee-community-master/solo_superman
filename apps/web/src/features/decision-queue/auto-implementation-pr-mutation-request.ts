import {
  autoImplementationFinalPrBodyEvidenceRefs,
  latestAutoImplementationPullRequestUrl,
  type AutoImplementationRun,
  type RecordAutoImplementationPullRequestMutationRequest,
  type SessionId
} from "@solo-superman/contracts";

function optionalLatestPullRequestUrl(run: AutoImplementationRun): string | undefined {
  return latestAutoImplementationPullRequestUrl(run) ?? undefined;
}

function latestPullRequestBodyEvidenceRefs(run: AutoImplementationRun) {
  return [...run.pullRequestMutations.records]
    .reverse()
    .find((record) => record.bodyEvidenceRefs.length > 0)
    ?.bodyEvidenceRefs ?? [];
}

function finalVerificationStageCompleted(run: AutoImplementationRun) {
  return run.stagePlan.some((stage) =>
    stage.stage === "final_verify_pr_update" &&
    stage.status === "completed" &&
    stage.ledgerEvidence !== null
  );
}

function finalVerificationMergeEvidenceRefs(run: AutoImplementationRun) {
  return run.stagePlan.find((stage) => stage.stage === "final_verify_pr_update" && stage.status === "completed")
    ?.ledgerEvidence?.evidenceRefs ?? [];
}

function hasFinalVerificationBodyEvidence(run: AutoImplementationRun, bodyEvidenceRefs: readonly string[]) {
  const acceptedRefs = autoImplementationFinalPrBodyEvidenceRefs(run.runId);

  return acceptedRefs.some((ref) => bodyEvidenceRefs.includes(ref));
}

function finalVerificationBodyEvidenceGap(run: AutoImplementationRun, bodyEvidenceRefs: readonly string[]) {
  return finalVerificationStageCompleted(run) && !hasFinalVerificationBodyEvidence(run, bodyEvidenceRefs)
    ? "PR body has not been refreshed after final_verify_pr_update evidence."
    : null;
}

function initialImplementationStageCompleted(run: AutoImplementationRun) {
  return run.stagePlan.some((stage) =>
    stage.stage === "initial_pr" &&
    stage.status === "completed" &&
    stage.ledgerEvidence !== null
  );
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
    initialImplementationStageCompleted(run)
      ? null
      : "initial_pr has not recorded completed implementation ledger evidence yet.",
    run.pullRequestMutations.records.some((record) => record.pullRequestUrl)
      ? "A PR URL is already recorded; use the PR body dry-run to refresh the existing PR evidence."
      : null,
    "This UI action records open-PR dry-run readiness only; approved GitHub mutation still requires explicit approval evidence."
  ].filter((gap): gap is string => gap !== null);
}

function knownGapsForApprovedOpen(run: AutoImplementationRun, pullRequestUrl: string | undefined) {
  return [
    run.remoteStatus === "connected" ? null : `Remote status is ${run.remoteStatus}; mutation stays blocked until connected.`,
    initialImplementationStageCompleted(run)
      ? null
      : "initial_pr has not recorded completed implementation ledger evidence yet.",
    pullRequestUrl
      ? "A PR URL is already recorded; approved PR open is blocked in the UI to avoid duplicate pull requests."
      : null
  ].filter((gap): gap is string => gap !== null);
}

function knownGapsForMergeDryRun(
  run: AutoImplementationRun,
  pullRequestUrl: string | undefined,
  bodyEvidenceRefs: readonly string[],
  mergeEvidenceRefs: readonly string[]
) {
  return [
    run.remoteStatus === "connected" ? null : `Remote status is ${run.remoteStatus}; mutation stays blocked until connected.`,
    pullRequestUrl ? null : "No GitHub PR URL has been recorded yet.",
    mergeEvidenceRefs.length
      ? null
      : "final_verify_pr_update has not recorded completed merge-readiness ledger evidence yet.",
    bodyEvidenceRefs.length ? null : "No current PR body evidence has been recorded yet.",
    bodyEvidenceRefs.length ? finalVerificationBodyEvidenceGap(run, bodyEvidenceRefs) : null,
    "This UI action records merge dry-run readiness only; approved GitHub mutation still requires explicit approval evidence."
  ].filter((gap): gap is string => gap !== null);
}

function knownGapsForApprovedBodyUpdate(
  run: AutoImplementationRun,
  pullRequestUrl: string | undefined,
  bodyEvidenceRefs: readonly string[]
) {
  return [
    run.remoteStatus === "connected" ? null : `Remote status is ${run.remoteStatus}; mutation stays blocked until connected.`,
    pullRequestUrl ? null : "No GitHub PR URL has been recorded yet.",
    bodyEvidenceRefs.length ? null : "No current PR body evidence has been recorded yet.",
    bodyEvidenceRefs.length ? finalVerificationBodyEvidenceGap(run, bodyEvidenceRefs) : null
  ].filter((gap): gap is string => gap !== null);
}

function knownGapsForApprovedMerge(
  run: AutoImplementationRun,
  pullRequestUrl: string | undefined,
  bodyEvidenceRefs: readonly string[],
  mergeEvidenceRefs: readonly string[]
) {
  return [
    run.remoteStatus === "connected" ? null : `Remote status is ${run.remoteStatus}; mutation stays blocked until connected.`,
    pullRequestUrl ? null : "No GitHub PR URL has been recorded yet.",
    mergeEvidenceRefs.length
      ? null
      : "final_verify_pr_update has not recorded completed merge-readiness ledger evidence yet.",
    bodyEvidenceRefs.length ? null : "No current PR body evidence has been recorded yet.",
    bodyEvidenceRefs.length ? finalVerificationBodyEvidenceGap(run, bodyEvidenceRefs) : null
  ].filter((gap): gap is string => gap !== null);
}

function pullRequestTitle(run: AutoImplementationRun) {
  return `Auto implementation ${run.projectFolderName}`;
}

function currentStageBodyEvidenceRefs(run: AutoImplementationRun) {
  const refs = [`pr-body:dry-run:${run.runId}:${run.currentStage}`];

  return run.currentStage === "final_verify_pr_update" || finalVerificationStageCompleted(run)
    ? [...refs, `pr-body:final-verify:${run.runId}`]
    : refs;
}

function approvedPullRequestMutationApproval(input: {
  readonly run: AutoImplementationRun;
  readonly action: "open_pr" | "update_pr_body" | "merge_pr";
  readonly approvedAt: string;
}) {
  const actionSlug = input.action === "open_pr"
    ? "pr_open"
    : input.action === "update_pr_body"
      ? "pr_body_update"
      : "pr_merge";

  return {
    approvalId: `approval_${actionSlug}_${input.run.runId}_${input.run.currentStage}_${input.run.pullRequestMutations.records.length}`,
    approvedBy: "local_operator",
    approvedAt: input.approvedAt,
    actionClass: "github_pr_mutation",
    approvalGranularity: "per_action",
    remoteStatusAtApproval: "connected",
    rollbackPlan: input.action === "open_pr"
      ? "Close the generated pull request if the approved PR open action targets the wrong scope."
      : input.action === "update_pr_body"
        ? "Restore the previous PR body with gh pr edit if the approved body update is wrong."
        : "Revert the merge commit or reopen the PR if post-merge verification fails.",
    evidenceRefs: [`local-operator-click:github-pr-mutation:${input.action}:${input.run.runId}:${input.run.currentStage}`]
  } as const;
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

export function buildAutoImplementationPullRequestMergeDryRunRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { run, sessionId } = input;
  const pullRequestUrl = optionalLatestPullRequestUrl(run);
  const bodyEvidenceRefs = latestPullRequestBodyEvidenceRefs(run);
  const mergeEvidenceRefs = finalVerificationMergeEvidenceRefs(run);

  return {
    sessionId,
    runId: run.runId,
    action: "merge_pr",
    requestMode: "dry_run",
    idempotencyKey: `pr-merge-dry-run:${run.currentStage}:${run.pullRequestMutations.records.length}:${run.updatedAt}`,
    ...(pullRequestUrl ? { pullRequestUrl } : {}),
    pullRequestTitle: pullRequestTitle(run),
    issueLinks: issueLinksForRun(run),
    implementationScope: `Dry-run PR merge readiness for ${run.currentStage} using ${run.issueManagement.trackerRelativePath}.`,
    reviewStreakRefs: reviewStreakRefsForRun(run),
    verificationCommands: ["pnpm verify"],
    knownGaps: knownGapsForMergeDryRun(run, pullRequestUrl, bodyEvidenceRefs, mergeEvidenceRefs),
    rollbackNotes: "Dry-run only; no GitHub merge is attempted. Supersede this record after approved merge readiness evidence is captured.",
    ...(mergeEvidenceRefs.length ? { mergeEvidenceRefs } : {}),
    ...(bodyEvidenceRefs.length ? { bodyEvidenceRefs } : {}),
    verifierEvidenceRefs: [`verifier:pr-merge-dry-run:${run.runId}:${run.currentStage}`]
  };
}

export function buildAutoImplementationPullRequestOpenApprovedRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly approvedAt: string;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { approvedAt, run, sessionId } = input;
  const pullRequestUrl = optionalLatestPullRequestUrl(run);

  return {
    sessionId,
    runId: run.runId,
    action: "open_pr",
    requestMode: "approved",
    idempotencyKey: `pr-open-approved:${run.currentStage}:${run.pullRequestMutations.records.length}:${run.updatedAt}`,
    pullRequestTitle: pullRequestTitle(run),
    issueLinks: issueLinksForRun(run),
    implementationScope: `Apply approved PR creation for ${run.currentStage} using ${run.issueManagement.trackerRelativePath}.`,
    reviewStreakRefs: reviewStreakRefsForRun(run),
    verificationCommands: ["pnpm verify"],
    knownGaps: knownGapsForApprovedOpen(run, pullRequestUrl),
    rollbackNotes: "Approved PR open may mutate GitHub through gh pr create when all reducer gates pass.",
    approval: approvedPullRequestMutationApproval({ run, action: "open_pr", approvedAt }),
    verifierEvidenceRefs: [`verifier:pr-open-approved:${run.runId}:${run.currentStage}`]
  };
}

export function buildAutoImplementationPullRequestBodyApprovedRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly approvedAt: string;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { approvedAt, run, sessionId } = input;
  const pullRequestUrl = optionalLatestPullRequestUrl(run);
  const bodyEvidenceRefs = latestPullRequestBodyEvidenceRefs(run);

  return {
    sessionId,
    runId: run.runId,
    action: "update_pr_body",
    requestMode: "approved",
    idempotencyKey: `pr-body-approved:${run.currentStage}:${run.pullRequestMutations.records.length}:${run.updatedAt}`,
    ...(pullRequestUrl ? { pullRequestUrl } : {}),
    pullRequestTitle: pullRequestTitle(run),
    issueLinks: issueLinksForRun(run),
    implementationScope: `Apply approved PR body update for ${run.currentStage} using ${run.issueManagement.trackerRelativePath}.`,
    reviewStreakRefs: reviewStreakRefsForRun(run),
    verificationCommands: ["pnpm verify"],
    knownGaps: knownGapsForApprovedBodyUpdate(run, pullRequestUrl, bodyEvidenceRefs),
    rollbackNotes: "Approved PR body update may mutate GitHub through gh pr edit when all reducer gates pass.",
    ...(bodyEvidenceRefs.length ? { bodyEvidenceRefs } : {}),
    approval: approvedPullRequestMutationApproval({ run, action: "update_pr_body", approvedAt }),
    verifierEvidenceRefs: [`verifier:pr-body-approved:${run.runId}:${run.currentStage}`]
  };
}

export function buildAutoImplementationPullRequestMergeApprovedRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly approvedAt: string;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { approvedAt, run, sessionId } = input;
  const pullRequestUrl = optionalLatestPullRequestUrl(run);
  const bodyEvidenceRefs = latestPullRequestBodyEvidenceRefs(run);
  const mergeEvidenceRefs = finalVerificationMergeEvidenceRefs(run);

  return {
    sessionId,
    runId: run.runId,
    action: "merge_pr",
    requestMode: "approved",
    idempotencyKey: `pr-merge-approved:${run.currentStage}:${run.pullRequestMutations.records.length}:${run.updatedAt}`,
    ...(pullRequestUrl ? { pullRequestUrl } : {}),
    pullRequestTitle: pullRequestTitle(run),
    issueLinks: issueLinksForRun(run),
    implementationScope: `Apply approved PR merge for ${run.currentStage} using ${run.issueManagement.trackerRelativePath}.`,
    reviewStreakRefs: reviewStreakRefsForRun(run),
    verificationCommands: ["pnpm verify"],
    knownGaps: knownGapsForApprovedMerge(run, pullRequestUrl, bodyEvidenceRefs, mergeEvidenceRefs),
    rollbackNotes: "Approved PR merge may mutate GitHub through gh pr merge when final verification and PR body gates pass.",
    ...(mergeEvidenceRefs.length ? { mergeEvidenceRefs } : {}),
    ...(bodyEvidenceRefs.length ? { bodyEvidenceRefs } : {}),
    approval: approvedPullRequestMutationApproval({ run, action: "merge_pr", approvedAt }),
    verifierEvidenceRefs: [`verifier:pr-merge-approved:${run.runId}:${run.currentStage}`]
  };
}

export function buildAutoImplementationPullRequestDryRunRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
}): RecordAutoImplementationPullRequestMutationRequest {
  const { run, sessionId } = input;
  const pullRequestUrl = optionalLatestPullRequestUrl(run);
  const bodyEvidenceRefs = currentStageBodyEvidenceRefs(run);

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
    bodyEvidenceRefs,
    verifierEvidenceRefs: [`verifier:pr-body-dry-run:${run.runId}:${run.currentStage}`]
  };
}
