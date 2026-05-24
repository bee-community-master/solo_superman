import type { ProjectionVersion, SchemaVersion, SessionId } from "../ids";
import {
  IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES,
  IMPLEMENTATION_CODE_REVIEW_SCOPES,
  IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK,
  isImplementationStepLedgerStepDoc,
  isImplementationStepLedgerTrackerDoc,
  type ImplementationStepDoc,
  type RecordImplementationStepLedgerPayload,
  type TrackerDoc
} from "./implementation-step-ledger";
import { isProjectionRecord as isRecord } from "./validation-helpers";

export const AUTO_IMPLEMENTATION_SCHEMA_VERSION = "solo-superman.auto-implementation.v1" as SchemaVersion;
export const AUTO_IMPLEMENTATION_TICK_INTERVAL_MS = 5 * 60 * 1000;

export const AUTO_IMPLEMENTATION_STAGES = [
  "initial_pr",
  "code_review_fix_1",
  "code_review_fix_2",
  "clean_code_fix_1",
  "clean_code_fix_2",
  "final_verify_pr_update",
  "merge_main"
] as const;

export const AUTO_IMPLEMENTATION_STAGE_LABELS = {
  initial_pr: "Initial implementation and PR creation",
  code_review_fix_1: "PR code review and fix pass 1",
  code_review_fix_2: "PR code review and fix pass 2",
  clean_code_fix_1: "Clean-code review and fix pass 1",
  clean_code_fix_2: "Broader clean-code review and fix pass 2",
  final_verify_pr_update: "PR description update and final test pass",
  merge_main: "Merge to main"
} as const satisfies Record<AutoImplementationStage, string>;

export const AUTO_IMPLEMENTATION_RUN_STATUSES = [
  "pending",
  "running",
  "paused",
  "blocked",
  "completed",
  "failed"
] as const;

export const AUTO_IMPLEMENTATION_STAGE_STATUSES = [
  "pending",
  "ready",
  "running",
  "paused",
  "completed",
  "blocked",
  "failed"
] as const;

export const AUTO_IMPLEMENTATION_STAGE_ACTIONS = ["tick", "start", "pause", "block", "complete"] as const;
export const AUTO_IMPLEMENTATION_WORKER_JOB_STATUSES = ["planned", "blocked", "completed"] as const;
export const AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE = {
  authority: "ExecutionAuthorityRecord",
  readyAuthority: "ExecutionAuthorityRecord.ready_for_execution",
  fileDiffAuthority: "ExecutionAuthorityRecord.file_diff_action",
  generatedWorkspaceScope: "ExecutionAuthorityRecord.generated_workspace_scope",
  noSecretValues: "ExecutionAuthorityRecord.no_secret_values",
  completedLedgerStep: "ImplementationStepLedger completed step",
  ledgerImport: "ImplementationStepLedger import",
  workerExecution: "Local Codex worker execution"
} as const;
export const AUTO_IMPLEMENTATION_WORKER_EXECUTION_MODE = "local_sandboxed_codex" as const;
export const AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL =
  "Complete the staged auto implementation protocol with review, clean-code, test, PR, and merge evidence.";

export const AUTO_IMPLEMENTATION_REMOTE_STATUSES = [
  "connected",
  "not_authenticated",
  "no_remote",
  "permission_denied",
  "offline",
  "unsupported_remote"
] as const;

export const AUTO_IMPLEMENTATION_ISSUE_MODES = ["github_ready", "markdown_fallback"] as const;
export const AUTO_IMPLEMENTATION_GITHUB_ISSUE_REQUEST_MODES = ["not_requested", "dry_run", "approved"] as const;
export const AUTO_IMPLEMENTATION_GITHUB_ISSUE_MUTATION_STATUSES = [
  "not_requested",
  "blocked",
  "dry_run_ready",
  "approved_ready",
  "applied"
] as const;
export const AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS = "github_issue_create" as const;
export const AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY = "per_action" as const;
export const AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_ACTIONS = [
  "open_pr",
  "update_pr_body",
  "merge_pr"
] as const;
export const AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_MODES = [
  "dry_run",
  "approved"
] as const;
export const AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_STATUSES = [
  "blocked",
  "dry_run_ready",
  "applied"
] as const;
export const AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS = "github_pr_mutation" as const;
export const AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY = "per_action" as const;

export const DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES = [
  "Workspace repo bootstrap and initial implementation PR",
  "PR code review and fix pass 1",
  "PR code review and fix pass 2",
  "Clean-code review and fix pass 1",
  "Broader clean-code review and fix pass 2",
  "Final PR description update and full verification",
  "Merge verified PR to main"
] as const;

export const AUTO_IMPLEMENTATION_DELIVERY_PROTOCOL = [
  "Keep each implementation slice tied to one local markdown issue or GitHub issue before opening the PR.",
  "Record ImplementationStepLedger trackerDoc, stepDoc, commit/no-code, review, clean-code, test, blocker, and evidence refs before marking a stage complete.",
  "Do not merge until the feature PR code review reaches two consecutive no-finding passes after any fixes.",
  "Do not merge until the broader repo-level code review reaches two consecutive no-finding passes.",
  "Do not merge until the changed-code clean-code review reaches two consecutive no-finding passes.",
  "Do not merge until the repo-level clean-code review reaches two consecutive no-finding passes.",
  "Audit missing targeted tests, then run the full verification command before updating the PR body.",
  "Update the PR body with scope, review streak evidence, missing-test audit evidence, test evidence, remaining gaps, and merge readiness before merging."
] as const;

export const AUTO_IMPLEMENTATION_LEDGER_EVIDENCE_TEMPLATE = [
  "trackerDoc: trackerId, title, goal, and sourceRefs must match the implementation tracker.",
  "stepDoc: stepId, title, description, sourceRefs, and expectedChangeScope describe the single PR-sized slice.",
  "stepCommitRecord or noCodeStepEvidence: record commitSha/diffRange/rollbackRef or the clean no-code baseline.",
  "CodeReviewRecord.reviewScope: record two passed feature reviews and two passed repository reviews with findings=[].",
  "CleanCodeReviewRecord.reviewScope: record two passed changed_code reviews and two passed repository reviews with simplifications evidence.",
  "MissingTestAuditRecord: audit acceptance criteria against targeted coverage and record no missing targeted-test gaps.",
  "TestEvidenceRecord: record exact commands, outcome, pass/fail counts, verifiedCommitSha, notTestedGaps, and evidenceRefs.",
  "blocker: if any required record is missing, write reason, missingEvidence, nextRequiredAction, and evidenceRefs instead of advancing."
] as const;

export const AUTO_IMPLEMENTATION_REVIEW_EVIDENCE_CHECKLIST = [
  "Feature code review: record two consecutive no-finding passes for the current PR-sized feature slice.",
  "Repository code review: record two consecutive no-finding passes beyond the touched feature area.",
  "Changed-code clean-code review: record two consecutive no-finding passes for naming, boundaries, duplication, dead paths, and test shape.",
  "Repository clean-code review: record two consecutive no-finding passes for adjacent slop, stale abstractions, and consistency drift."
] as const;

export const AUTO_IMPLEMENTATION_STAGE_REVIEW_GATES = {
  initial_pr: [
    "Create the smallest behavior-complete implementation for this issue slice.",
    "Open or prepare the PR with the issue link, acceptance criteria, rollback notes, and targeted test plan.",
    "Record the first targeted test evidence before requesting review."
  ],
  code_review_fix_1: [
    "Run feature-scope code review and fix every actionable finding.",
    "Repeat review until two consecutive feature-scope passes report no findings.",
    "Record both clean pass timestamps or reviewer refs in the PR body."
  ],
  code_review_fix_2: [
    "Run repo-wide code review beyond the touched feature.",
    "Fix any cross-repo consistency, architecture, or safety findings.",
    "Repeat repo-wide review until two consecutive passes report no findings."
  ],
  clean_code_fix_1: [
    "Run changed-code clean-code review for naming, boundaries, duplication, dead paths, and test shape.",
    "Prefer deletion, existing utilities, and simpler boundaries over new abstractions.",
    "Repeat clean-code review until two consecutive changed-code passes report no findings."
  ],
  clean_code_fix_2: [
    "Run repo-level clean-code review for adjacent slop, stale abstractions, and consistency drift.",
    "Fix only findings that are necessary for this implementation slice or split follow-up issues.",
    "Repeat repo-level clean-code review until two consecutive passes report no findings."
  ],
  final_verify_pr_update: [
    "Audit missing tests against the issue acceptance criteria and add targeted coverage where gaps remain.",
    "Run targeted tests first, then the full final verification command.",
    "Update the PR description with scope, review streaks, exact verification commands, and known gaps."
  ],
  merge_main: [
    "Verify the PR is mergeable and its body contains final review/test evidence.",
    "Merge only after the final verification evidence is fresh and record the applied PR merge mutation.",
    "Sync main after merge and rerun the full verification command on main with post-merge verification evidence."
  ]
} as const satisfies Record<AutoImplementationStage, readonly string[]>;

export const AUTO_IMPLEMENTATION_RESERVED_PROJECT_FOLDER_NAMES = [
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
] as const;

export type AutoImplementationStage = (typeof AUTO_IMPLEMENTATION_STAGES)[number];
export type AutoImplementationRunStatus = (typeof AUTO_IMPLEMENTATION_RUN_STATUSES)[number];
export type AutoImplementationStageStatus = (typeof AUTO_IMPLEMENTATION_STAGE_STATUSES)[number];
export type AutoImplementationStageAction = (typeof AUTO_IMPLEMENTATION_STAGE_ACTIONS)[number];
export type AutoImplementationWorkerJobStatus = (typeof AUTO_IMPLEMENTATION_WORKER_JOB_STATUSES)[number];
export type AutoImplementationRemoteStatus = (typeof AUTO_IMPLEMENTATION_REMOTE_STATUSES)[number];
export type AutoImplementationIssueMode = (typeof AUTO_IMPLEMENTATION_ISSUE_MODES)[number];
export type AutoImplementationGitHubIssueRequestMode = (typeof AUTO_IMPLEMENTATION_GITHUB_ISSUE_REQUEST_MODES)[number];
export type AutoImplementationGitHubIssueMutationStatus =
  (typeof AUTO_IMPLEMENTATION_GITHUB_ISSUE_MUTATION_STATUSES)[number];
export type AutoImplementationPullRequestMutationAction =
  (typeof AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_ACTIONS)[number];
export type AutoImplementationPullRequestMutationRequestMode =
  (typeof AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_MODES)[number];
export type AutoImplementationPullRequestMutationStatus =
  (typeof AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_STATUSES)[number];

export interface AutoImplementationStageRecord {
  readonly stage: AutoImplementationStage;
  readonly label: string;
  readonly status: AutoImplementationStageStatus;
  readonly sequenceOrder: number;
  readonly nextScheduledAt: string | null;
  readonly evidenceRefs: readonly string[];
  readonly tickRecords: readonly AutoImplementationStageTickRecord[];
  readonly ledgerEvidence: AutoImplementationStageLedgerEvidence | null;
  readonly blocker: AutoImplementationStageBlocker | null;
}

export interface AutoImplementationStageTickRecord {
  readonly tickId: string;
  readonly stage: AutoImplementationStage;
  readonly action: AutoImplementationStageAction;
  readonly status: AutoImplementationStageStatus;
  readonly recordedAt: string;
  readonly nextTickAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationStageBlocker {
  readonly stage: AutoImplementationStage;
  readonly reason: string;
  readonly missingEvidence: readonly string[];
  readonly nextRequiredAction: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationStageLedgerEvidence {
  readonly implementationStepId: string;
  readonly trackerDocRef: string;
  readonly stepDocRef: string;
  readonly implementationEvidenceRefs: readonly string[];
  readonly codeReviewStreakRefs: readonly string[];
  readonly cleanCodeReviewStreakRefs: readonly string[];
  readonly missingTestAuditRefs: readonly string[];
  readonly testEvidenceRefs: readonly string[];
  readonly blockerEvidenceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationRemoteGuide {
  readonly status: AutoImplementationRemoteStatus;
  readonly warning: string | null;
  readonly commands: readonly string[];
  readonly nextAction: string;
}

export interface AutoImplementationIssueDocument {
  readonly issueId: string;
  readonly title: string;
  readonly relativePath: string;
  readonly stage: AutoImplementationStage;
  readonly status: "open" | "completed" | "blocked";
}

export interface AutoImplementationIssueStatusSummary {
  readonly total: number;
  readonly open: number;
  readonly completed: number;
  readonly blocked: number;
}

export interface AutoImplementationGitHubIssuePlan {
  readonly issueId: string;
  readonly title: string;
  readonly bodyMarkdownPath: string;
  readonly sourceStage: AutoImplementationStage;
}

export interface AutoImplementationGitHubIssueApproval {
  readonly approvalId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly actionClass: typeof AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS;
  readonly approvalGranularity: typeof AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY;
  readonly remoteStatusAtApproval: "connected";
  readonly rollbackPlan: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationGitHubIssueMutationContract {
  readonly status: AutoImplementationGitHubIssueMutationStatus;
  readonly requiredRemoteStatus: "connected";
  readonly mutatesGitHub: boolean;
  readonly perActionApprovalRequired: true;
  readonly approval: AutoImplementationGitHubIssueApproval | null;
  readonly blockedReason: string | null;
  readonly plannedIssues: readonly AutoImplementationGitHubIssuePlan[];
  readonly createdIssueUrls: readonly string[];
  readonly auditEvidenceRefs: readonly string[];
  readonly verifierEvidenceRefs: readonly string[];
}

export interface AutoImplementationPullRequestMutationApproval {
  readonly approvalId: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly actionClass: typeof AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS;
  readonly approvalGranularity: typeof AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY;
  readonly remoteStatusAtApproval: "connected";
  readonly rollbackPlan: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationPullRequestMutationRecord {
  readonly mutationId: string;
  readonly action: AutoImplementationPullRequestMutationAction;
  readonly requestMode: AutoImplementationPullRequestMutationRequestMode;
  readonly status: AutoImplementationPullRequestMutationStatus;
  readonly requiredRemoteStatus: "connected";
  readonly mutatesGitHub: boolean;
  readonly pullRequestUrl: string | null;
  readonly issueLinks: readonly string[];
  readonly implementationScope: string;
  readonly reviewStreakRefs: readonly string[];
  readonly verificationCommands: readonly string[];
  readonly knownGaps: readonly string[];
  readonly rollbackNotes: string;
  readonly mergeEvidenceRefs: readonly string[];
  readonly bodyEvidenceRefs: readonly string[];
  readonly approval: AutoImplementationPullRequestMutationApproval | null;
  readonly blockedReason: string | null;
  readonly auditEvidenceRefs: readonly string[];
  readonly verifierEvidenceRefs: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AutoImplementationPullRequestMutationState {
  readonly records: readonly AutoImplementationPullRequestMutationRecord[];
  readonly latestRecord: AutoImplementationPullRequestMutationRecord | null;
}

function autoImplementationPullRequestMutationRecords(
  run: AutoImplementationRun
): readonly AutoImplementationPullRequestMutationRecord[] {
  return Array.isArray((run as { readonly pullRequestMutations?: { readonly records?: unknown } }).pullRequestMutations?.records)
    ? run.pullRequestMutations.records
    : [];
}

export function latestAutoImplementationPullRequestUrl(run: AutoImplementationRun): string | null {
  return run.pullRequestMutations.latestRecord?.pullRequestUrl ??
    [...autoImplementationPullRequestMutationRecords(run)].reverse().find((record) => record.pullRequestUrl)
      ?.pullRequestUrl ??
    null;
}

export function canOpenNewAutoImplementationPullRequest(run: AutoImplementationRun): boolean {
  return latestAutoImplementationPullRequestUrl(run) === null;
}

export function canCreateAutoImplementationGitHubIssues(run: AutoImplementationRun): boolean {
  return run.issueManagement.githubIssueUrls.length === 0 &&
    run.issueManagement.githubIssueMutation.createdIssueUrls.length === 0 &&
    run.issueManagement.githubIssueMutation.status !== "applied";
}

export function hasAppliedAutoImplementationPullRequestMerge(run: AutoImplementationRun): boolean {
  const records = autoImplementationPullRequestMutationRecords(run);
  const latestRecord = run.pullRequestMutations.latestRecord;
  const recordsToScan = latestRecord && !records.some((record) => record.mutationId === latestRecord.mutationId)
    ? [...records, latestRecord]
    : records;

  return recordsToScan.some((record) =>
    record.action === "merge_pr" &&
    record.requestMode === "approved" &&
    record.status === "applied" &&
    record.mutatesGitHub
  );
}

export function canMergeAutoImplementationPullRequest(run: AutoImplementationRun): boolean {
  return !hasAppliedAutoImplementationPullRequestMerge(run);
}

export interface AutoImplementationIssueManagement {
  readonly mode: AutoImplementationIssueMode;
  readonly trackerRelativePath: string;
  readonly issueDocs: readonly AutoImplementationIssueDocument[];
  readonly issueStatusSummary: AutoImplementationIssueStatusSummary;
  readonly githubIssueUrls: readonly string[];
  readonly githubIssueMutation: AutoImplementationGitHubIssueMutationContract;
  readonly warning: string | null;
}

export interface AutoImplementationStageReviewGate {
  readonly stage: AutoImplementationStage;
  readonly gates: readonly string[];
}

export interface AutoImplementationReviewProtocol {
  readonly deliveryGates: readonly string[];
  readonly stageGates: readonly AutoImplementationStageReviewGate[];
}

export function defaultAutoImplementationReviewProtocol(): AutoImplementationReviewProtocol {
  return {
    deliveryGates: AUTO_IMPLEMENTATION_DELIVERY_PROTOCOL,
    stageGates: AUTO_IMPLEMENTATION_STAGES.map((stage) => ({
      stage,
      gates: AUTO_IMPLEMENTATION_STAGE_REVIEW_GATES[stage]
    }))
  };
}

export interface AutoImplementationWorkerExecutionPlan {
  readonly executionMode: typeof AUTO_IMPLEMENTATION_WORKER_EXECUTION_MODE;
  readonly workingDirectory: string;
  readonly issueDocumentPath: string;
  readonly executionAuthorityRef: string | null;
  readonly ledgerTrackerDoc: TrackerDoc;
  readonly ledgerStepDoc: ImplementationStepDoc;
  readonly allowedWriteScope: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly forbiddenActions: readonly string[];
  readonly sourceRefs: readonly string[];
}

export interface AutoImplementationWorkerJob {
  readonly jobId: string;
  readonly runId: string;
  readonly stage: AutoImplementationStage;
  readonly issueId: string;
  readonly issueTitle: string;
  readonly issueRelativePath: string;
  readonly status: AutoImplementationWorkerJobStatus;
  readonly executionPlan: AutoImplementationWorkerExecutionPlan;
  readonly blockedReason: string | null;
  readonly missingEvidence: readonly string[];
  readonly nextRequiredAction: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationRun {
  readonly runId: string;
  readonly projectFolderName: string;
  readonly workspaceRoot: string;
  readonly generatedRepoPath: string;
  readonly gitDefaultBranch: "main";
  readonly currentStage: AutoImplementationStage;
  readonly status: AutoImplementationRunStatus;
  readonly remoteStatus: AutoImplementationRemoteStatus;
  readonly nextTickAt: string;
  readonly stagePlan: readonly AutoImplementationStageRecord[];
  readonly issueManagement: AutoImplementationIssueManagement;
  readonly remoteGuide: AutoImplementationRemoteGuide;
  readonly reviewProtocol: AutoImplementationReviewProtocol;
  readonly pullRequestMutations: AutoImplementationPullRequestMutationState;
  readonly workerJobs: readonly AutoImplementationWorkerJob[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface AutoImplementationRunProjection {
  readonly kind: "AutoImplementationRunProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly latestRun: AutoImplementationRun | null;
  readonly runs: readonly AutoImplementationRun[];
  readonly summary: string;
  readonly refetchUrl: string;
  readonly schemaVersion: SchemaVersion;
}

function autoImplementationWorkerJobs(run: AutoImplementationRun): readonly AutoImplementationWorkerJob[] {
  return Array.isArray((run as { readonly workerJobs?: unknown }).workerJobs)
    ? run.workerJobs
    : [];
}

export function latestCurrentStageAutoImplementationWorkerJob(
  run: AutoImplementationRun | null
): AutoImplementationWorkerJob | null {
  if (!run) {
    return null;
  }

  return [...autoImplementationWorkerJobs(run)].reverse().find((job) => job.stage === run.currentStage) ?? null;
}

export function canImportAutoImplementationWorkerLedger(job: AutoImplementationWorkerJob | null): boolean {
  return job?.status === "planned" ||
    (
      job?.status === "blocked" &&
      job.missingEvidence.length === 1 &&
      (
        job.missingEvidence[0] === AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.completedLedgerStep ||
        job.missingEvidence[0] === AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.ledgerImport ||
        job.missingEvidence[0] === AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution
      )
    );
}

export function canRunAutoImplementationWorkerJob(job: AutoImplementationWorkerJob | null): boolean {
  return job?.status === "planned" ||
    (
      job?.status === "blocked" &&
      job.missingEvidence.length === 1 &&
      job.missingEvidence[0] === AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution
    );
}

export function canCompleteAutoImplementationWorkerJob(job: AutoImplementationWorkerJob | null): boolean {
  return job?.status === "planned" ||
    (
      job?.status === "blocked" &&
      job.missingEvidence.length === 1 &&
      job.missingEvidence[0] === AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.completedLedgerStep
    );
}

export function canPlanCurrentStageAutoImplementationWorkerJob(run: AutoImplementationRun | null): boolean {
  if (!run || run.status === "completed") {
    return false;
  }

  const latestWorkerJob = latestCurrentStageAutoImplementationWorkerJob(run);

  return !latestWorkerJob ||
    (
      latestWorkerJob.status === "blocked" &&
      !canImportAutoImplementationWorkerLedger(latestWorkerJob) &&
      !canRunAutoImplementationWorkerJob(latestWorkerJob) &&
      !canCompleteAutoImplementationWorkerJob(latestWorkerJob)
    );
}

export function latestAutoImplementationWorkerJobForIssue(
  run: AutoImplementationRun,
  issue: AutoImplementationIssueDocument
): AutoImplementationWorkerJob | null {
  return [...autoImplementationWorkerJobs(run)]
    .reverse()
    .find((job) => job.stage === issue.stage && job.issueId === issue.issueId) ?? null;
}

export function autoImplementationGitHubIssueUrlForIssue(
  run: AutoImplementationRun,
  issue: AutoImplementationIssueDocument
): string | null {
  const issueIndex = run.issueManagement.githubIssueMutation.plannedIssues.findIndex((plan) =>
    plan.issueId === issue.issueId && plan.bodyMarkdownPath === issue.relativePath
  );

  if (issueIndex < 0) {
    return null;
  }

  return run.issueManagement.githubIssueUrls[issueIndex] ??
    run.issueManagement.githubIssueMutation.createdIssueUrls[issueIndex] ??
    null;
}

export function autoImplementationIssueDocumentStatus(
  run: AutoImplementationRun,
  issue: AutoImplementationIssueDocument
): AutoImplementationIssueDocument["status"] {
  const stage = run.stagePlan.find((candidate) => candidate.stage === issue.stage) ?? null;
  const latestWorkerJob = latestAutoImplementationWorkerJobForIssue(run, issue);

  if (stage?.status === "completed") {
    return "completed";
  }

  if (stage?.status === "blocked" || stage?.status === "failed" || latestWorkerJob?.status === "blocked") {
    return "blocked";
  }

  return "open";
}

export function autoImplementationIssueStatusSummary(
  issueDocs: readonly AutoImplementationIssueDocument[]
): AutoImplementationIssueStatusSummary {
  return issueDocs.reduce<AutoImplementationIssueStatusSummary>((summary, issue) => ({
    total: summary.total + 1,
    open: summary.open + (issue.status === "open" ? 1 : 0),
    completed: summary.completed + (issue.status === "completed" ? 1 : 0),
    blocked: summary.blocked + (issue.status === "blocked" ? 1 : 0)
  }), {
    total: 0,
    open: 0,
    completed: 0,
    blocked: 0
  });
}

function sameAutoImplementationIssueStatusSummary(
  left: AutoImplementationIssueStatusSummary,
  right: AutoImplementationIssueStatusSummary | undefined
) {
  if (!right) {
    return false;
  }

  return left.total === right.total &&
    left.open === right.open &&
    left.completed === right.completed &&
    left.blocked === right.blocked;
}

export function autoImplementationRunWithSynchronizedIssueDocs(run: AutoImplementationRun): AutoImplementationRun {
  const issueDocs = run.issueManagement.issueDocs.map((issue) => ({
    ...issue,
    status: autoImplementationIssueDocumentStatus(run, issue)
  }));
  const issueStatusSummary = autoImplementationIssueStatusSummary(issueDocs);

  if (
    issueDocs.every((issue, index) => issue.status === run.issueManagement.issueDocs[index]?.status) &&
    sameAutoImplementationIssueStatusSummary(issueStatusSummary, run.issueManagement.issueStatusSummary)
  ) {
    return run;
  }

  return {
    ...run,
    issueManagement: {
      ...run.issueManagement,
      issueDocs,
      issueStatusSummary
    }
  };
}

export interface CreateAutoImplementationRunRequest {
  readonly sessionId: SessionId;
  readonly idempotencyKey: string;
  readonly projectFolderName?: string;
  readonly projectName?: string;
  readonly sourcePlanningRef?: string;
  readonly trackerTitle?: string;
  readonly trackerGoal?: string;
  readonly issueTitles?: readonly string[];
  readonly githubIssueCreation?: {
    readonly mode: AutoImplementationGitHubIssueRequestMode;
    readonly approval?: AutoImplementationGitHubIssueApproval;
    readonly verifierEvidenceRefs?: readonly string[];
  };
}

export interface RecordAutoImplementationStageRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly stage: AutoImplementationStage;
  readonly action: AutoImplementationStageAction;
  readonly idempotencyKey: string;
  readonly implementationStepId?: string;
  readonly blocker?: AutoImplementationStageBlocker;
  readonly evidenceRefs?: readonly string[];
  readonly tickedAt?: string;
}

export interface RecordAutoImplementationPullRequestMutationRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly action: AutoImplementationPullRequestMutationAction;
  readonly requestMode: AutoImplementationPullRequestMutationRequestMode;
  readonly idempotencyKey: string;
  readonly pullRequestUrl?: string;
  readonly pullRequestTitle?: string;
  readonly issueLinks: readonly string[];
  readonly implementationScope: string;
  readonly reviewStreakRefs: readonly string[];
  readonly verificationCommands: readonly string[];
  readonly knownGaps?: readonly string[];
  readonly rollbackNotes: string;
  readonly mergeEvidenceRefs?: readonly string[];
  readonly bodyEvidenceRefs?: readonly string[];
  readonly approval?: AutoImplementationPullRequestMutationApproval;
  readonly verifierEvidenceRefs?: readonly string[];
}

export interface CreateAutoImplementationWorkerJobRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly idempotencyKey: string;
  readonly executionAuthorityRef?: string;
}

export interface CompleteAutoImplementationWorkerJobRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly implementationStepId: string;
  readonly evidenceRefs?: readonly string[];
}

export interface ImportAutoImplementationWorkerLedgerRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly ledgerTransitions: readonly RecordImplementationStepLedgerPayload[];
  readonly evidenceRefs?: readonly string[];
}

export interface AdvanceAutoImplementationWorkerStageRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly evidenceRefs?: readonly string[];
  readonly tickedAt?: string;
}

export interface RunAutoImplementationWorkerJobRequest {
  readonly sessionId: SessionId;
  readonly runId: string;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly evidenceRefs?: readonly string[];
}

export class AutoImplementationRunValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid AutoImplementationRunProjection: ${issues.join("; ")}`);
    this.name = "AutoImplementationRunValidationError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isOneOf<TValue extends string>(value: unknown, values: readonly TValue[]): value is TValue {
  return typeof value === "string" && values.includes(value as TValue);
}

export function isAutoImplementationReservedProjectFolderName(value: string) {
  const baseName = value.toLowerCase().split(".")[0] ?? "";

  return AUTO_IMPLEMENTATION_RESERVED_PROJECT_FOLDER_NAMES.includes(
    baseName as (typeof AUTO_IMPLEMENTATION_RESERVED_PROJECT_FOLDER_NAMES)[number]
  );
}

function validFolderName(value: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/u.test(value) &&
    value !== "." &&
    value !== ".." &&
    value !== ".git" &&
    !isAutoImplementationReservedProjectFolderName(value);
}

function isStageRecord(value: unknown): value is AutoImplementationStageRecord {
  return isRecord(value) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isNonEmptyString(value.label) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_STAGE_STATUSES) &&
    typeof value.sequenceOrder === "number" &&
    Number.isInteger(value.sequenceOrder) &&
    value.sequenceOrder >= 1 &&
    (value.nextScheduledAt === null || isNonEmptyString(value.nextScheduledAt)) &&
    isStringArray(value.evidenceRefs) &&
    Array.isArray(value.tickRecords) &&
    value.tickRecords.every((record) => isStageTickRecord(record) && record.stage === value.stage) &&
    (value.ledgerEvidence === null || isStageLedgerEvidence(value.ledgerEvidence)) &&
    (value.blocker === null || (isStageBlocker(value.blocker) && value.blocker.stage === value.stage));
}

function isRemoteGuide(value: unknown): value is AutoImplementationRemoteGuide {
  return isRecord(value) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_REMOTE_STATUSES) &&
    (value.warning === null || isNonEmptyString(value.warning)) &&
    isStringArray(value.commands) &&
    isNonEmptyString(value.nextAction);
}

function isStageTickRecord(value: unknown): value is AutoImplementationStageTickRecord {
  return isRecord(value) &&
    isNonEmptyString(value.tickId) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isOneOf(value.action, AUTO_IMPLEMENTATION_STAGE_ACTIONS) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_STAGE_STATUSES) &&
    isNonEmptyString(value.recordedAt) &&
    isNonEmptyString(value.nextTickAt) &&
    isStringArray(value.evidenceRefs);
}

function isStageBlocker(value: unknown): value is AutoImplementationStageBlocker {
  return isRecord(value) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isNonEmptyString(value.reason) &&
    isStringArray(value.missingEvidence) &&
    value.missingEvidence.length > 0 &&
    isNonEmptyString(value.nextRequiredAction) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function reviewStreakRefsCoverScopes(
  refs: readonly string[],
  prefix: string,
  scopes: readonly string[]
) {
  return scopes.every((scope) =>
    refs.filter((ref) => ref.startsWith(`${prefix}:${scope}:`)).length >=
      IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK
  );
}

function isStageLedgerEvidence(value: unknown): value is AutoImplementationStageLedgerEvidence {
  return isRecord(value) &&
    isNonEmptyString(value.implementationStepId) &&
    isNonEmptyString(value.trackerDocRef) &&
    isNonEmptyString(value.stepDocRef) &&
    isStringArray(value.implementationEvidenceRefs) &&
    value.implementationEvidenceRefs.length > 0 &&
    isStringArray(value.codeReviewStreakRefs) &&
    reviewStreakRefsCoverScopes(value.codeReviewStreakRefs, "code-review", IMPLEMENTATION_CODE_REVIEW_SCOPES) &&
    isStringArray(value.cleanCodeReviewStreakRefs) &&
    reviewStreakRefsCoverScopes(
      value.cleanCodeReviewStreakRefs,
      "clean-code-review",
      IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES
    ) &&
    isStringArray(value.missingTestAuditRefs) &&
    value.missingTestAuditRefs.length > 0 &&
    isStringArray(value.testEvidenceRefs) &&
    value.testEvidenceRefs.length > 0 &&
    isStringArray(value.blockerEvidenceRefs) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isWorkerExecutionPlan(value: unknown): value is AutoImplementationWorkerExecutionPlan {
  return isRecord(value) &&
    value.executionMode === AUTO_IMPLEMENTATION_WORKER_EXECUTION_MODE &&
    isNonEmptyString(value.workingDirectory) &&
    isNonEmptyString(value.issueDocumentPath) &&
    (value.executionAuthorityRef === null ||
      (isNonEmptyString(value.executionAuthorityRef) && value.executionAuthorityRef.startsWith("exec_auth_"))) &&
    isImplementationStepLedgerTrackerDoc(value.ledgerTrackerDoc) &&
    isImplementationStepLedgerStepDoc(value.ledgerStepDoc) &&
    isStringArray(value.allowedWriteScope) &&
    value.allowedWriteScope.length > 0 &&
    isStringArray(value.requiredEvidence) &&
    value.requiredEvidence.length > 0 &&
    isStringArray(value.forbiddenActions) &&
    value.forbiddenActions.length > 0 &&
    isStringArray(value.sourceRefs) &&
    value.sourceRefs.length > 0;
}

function isWorkerJob(value: unknown): value is AutoImplementationWorkerJob {
  return isRecord(value) &&
    isNonEmptyString(value.jobId) &&
    isNonEmptyString(value.runId) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isNonEmptyString(value.issueId) &&
    isNonEmptyString(value.issueTitle) &&
    isNonEmptyString(value.issueRelativePath) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_WORKER_JOB_STATUSES) &&
    isWorkerExecutionPlan(value.executionPlan) &&
    (value.blockedReason === null || isNonEmptyString(value.blockedReason)) &&
    isStringArray(value.missingEvidence) &&
    (value.status === "blocked"
      ? value.missingEvidence.length > 0 && value.blockedReason !== null
      : value.missingEvidence.length === 0 && value.blockedReason === null) &&
    isNonEmptyString(value.nextRequiredAction) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isIssueDoc(value: unknown): value is AutoImplementationIssueDocument {
  return isRecord(value) &&
    isNonEmptyString(value.issueId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.relativePath) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    isOneOf(value.status, ["open", "completed", "blocked"] as const);
}

function isIssueStatusSummary(value: unknown): value is AutoImplementationIssueStatusSummary {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.total) ||
    !Number.isInteger(value.open) ||
    !Number.isInteger(value.completed) ||
    !Number.isInteger(value.blocked)
  ) {
    return false;
  }

  const total = value.total as number;
  const open = value.open as number;
  const completed = value.completed as number;
  const blocked = value.blocked as number;

  return total >= 0 &&
    open >= 0 &&
    completed >= 0 &&
    blocked >= 0 &&
    open + completed + blocked === total;
}

function isGitHubIssuePlan(value: unknown): value is AutoImplementationGitHubIssuePlan {
  return isRecord(value) &&
    isNonEmptyString(value.issueId) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.bodyMarkdownPath) &&
    isOneOf(value.sourceStage, AUTO_IMPLEMENTATION_STAGES);
}

function isGitHubIssueUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const trimmed = value.trim();

  return value === trimmed &&
    /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/[1-9]\d*\/?$/iu.test(trimmed);
}

function isGitHubPullRequestUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const trimmed = value.trim();

  return value === trimmed &&
    /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/[1-9]\d*\/?$/iu.test(trimmed);
}

export function isAutoImplementationPullRequestIssueLink(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const trimmed = value.trim();
  const isCanonicalLocalIssueId = value === trimmed && /^local-\d{3}$/u.test(trimmed);

  return isGitHubIssueUrl(value) || isCanonicalLocalIssueId;
}

function isGitHubIssueApproval(value: unknown): value is AutoImplementationGitHubIssueApproval {
  return isRecord(value) &&
    isNonEmptyString(value.approvalId) &&
    isNonEmptyString(value.approvedBy) &&
    isNonEmptyString(value.approvedAt) &&
    value.actionClass === AUTO_IMPLEMENTATION_GITHUB_ISSUE_ACTION_CLASS &&
    value.approvalGranularity === AUTO_IMPLEMENTATION_GITHUB_ISSUE_APPROVAL_GRANULARITY &&
    value.remoteStatusAtApproval === "connected" &&
    isNonEmptyString(value.rollbackPlan) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isPullRequestMutationApproval(value: unknown): value is AutoImplementationPullRequestMutationApproval {
  return isRecord(value) &&
    isNonEmptyString(value.approvalId) &&
    isNonEmptyString(value.approvedBy) &&
    isNonEmptyString(value.approvedAt) &&
    value.actionClass === AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS &&
    value.approvalGranularity === AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY &&
    value.remoteStatusAtApproval === "connected" &&
    isNonEmptyString(value.rollbackPlan) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

function isPullRequestMutationRecord(value: unknown): value is AutoImplementationPullRequestMutationRecord {
  if (!isRecord(value)) {
    return false;
  }

  const issueLinks = isStringArray(value.issueLinks) ? value.issueLinks : null;
  const mergeEvidenceRefs = isStringArray(value.mergeEvidenceRefs) ? value.mergeEvidenceRefs : null;
  const bodyEvidenceRefs = isStringArray(value.bodyEvidenceRefs) ? value.bodyEvidenceRefs : null;
  const appliedRequiresPullRequestUrl = value.status !== "applied" ||
    isGitHubPullRequestUrl(value.pullRequestUrl);
  const nonAppliedCanOmitPullRequestUrl = value.pullRequestUrl === null ||
    isGitHubPullRequestUrl(value.pullRequestUrl);
  const statusMatchesMutationFlag = value.mutatesGitHub === (value.status === "applied");
  const approvalMatchesMode = value.requestMode === "approved"
    ? value.approval === null || isPullRequestMutationApproval(value.approval)
    : value.approval === null;
  const appliedBodyUpdateHasEvidence = value.status !== "applied" ||
    value.action !== "update_pr_body" ||
    Boolean(bodyEvidenceRefs?.length);
  const appliedMergeHasReadinessEvidence = value.status !== "applied" ||
    value.action !== "merge_pr" ||
    (Boolean(bodyEvidenceRefs?.length) && Boolean(mergeEvidenceRefs?.length));

  return isNonEmptyString(value.mutationId) &&
    isOneOf(value.action, AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_ACTIONS) &&
    isOneOf(value.requestMode, AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_REQUEST_MODES) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_PULL_REQUEST_MUTATION_STATUSES) &&
    value.requiredRemoteStatus === "connected" &&
    statusMatchesMutationFlag &&
    appliedRequiresPullRequestUrl &&
    nonAppliedCanOmitPullRequestUrl &&
    issueLinks !== null &&
    issueLinks.length > 0 &&
    issueLinks.every(isAutoImplementationPullRequestIssueLink) &&
    isNonEmptyString(value.implementationScope) &&
    isStringArray(value.reviewStreakRefs) &&
    isStringArray(value.verificationCommands) &&
    value.verificationCommands.length > 0 &&
    isStringArray(value.knownGaps) &&
    isNonEmptyString(value.rollbackNotes) &&
    mergeEvidenceRefs !== null &&
    bodyEvidenceRefs !== null &&
    appliedBodyUpdateHasEvidence &&
    appliedMergeHasReadinessEvidence &&
    approvalMatchesMode &&
    (value.blockedReason === null || isNonEmptyString(value.blockedReason)) &&
    (value.status === "blocked" ? value.blockedReason !== null : value.blockedReason === null) &&
    isStringArray(value.auditEvidenceRefs) &&
    value.auditEvidenceRefs.length > 0 &&
    isStringArray(value.verifierEvidenceRefs) &&
    (value.requestMode === "approved" ? value.verifierEvidenceRefs.length > 0 || value.status === "blocked" : true) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt);
}

function isPullRequestMutationState(value: unknown): value is AutoImplementationPullRequestMutationState {
  return isRecord(value) &&
    Array.isArray(value.records) &&
    value.records.every(isPullRequestMutationRecord) &&
    (value.latestRecord === null || isPullRequestMutationRecord(value.latestRecord)) &&
    (
      value.latestRecord === null
        ? value.records.length === 0
        : value.records.length > 0 &&
          value.records.at(-1)?.mutationId === value.latestRecord.mutationId
    );
}

function isGitHubIssueMutationContract(value: unknown): value is AutoImplementationGitHubIssueMutationContract {
  return isRecord(value) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_GITHUB_ISSUE_MUTATION_STATUSES) &&
    value.requiredRemoteStatus === "connected" &&
    typeof value.mutatesGitHub === "boolean" &&
    value.perActionApprovalRequired === true &&
    (value.approval === null || isGitHubIssueApproval(value.approval)) &&
    (value.blockedReason === null || isNonEmptyString(value.blockedReason)) &&
    Array.isArray(value.plannedIssues) &&
    value.plannedIssues.every(isGitHubIssuePlan) &&
    Array.isArray(value.createdIssueUrls) &&
    value.createdIssueUrls.every(isGitHubIssueUrl) &&
    isStringArray(value.auditEvidenceRefs) &&
    value.auditEvidenceRefs.length > 0 &&
    isStringArray(value.verifierEvidenceRefs);
}

function isIssueManagement(value: unknown): value is AutoImplementationIssueManagement {
  return isRecord(value) &&
    isOneOf(value.mode, AUTO_IMPLEMENTATION_ISSUE_MODES) &&
    isNonEmptyString(value.trackerRelativePath) &&
    Array.isArray(value.issueDocs) &&
    value.issueDocs.every(isIssueDoc) &&
    isIssueStatusSummary(value.issueStatusSummary) &&
    sameAutoImplementationIssueStatusSummary(value.issueStatusSummary, autoImplementationIssueStatusSummary(value.issueDocs)) &&
    Array.isArray(value.githubIssueUrls) &&
    value.githubIssueUrls.every(isGitHubIssueUrl) &&
    isGitHubIssueMutationContract(value.githubIssueMutation) &&
    (value.warning === null || isNonEmptyString(value.warning));
}

function hasCanonicalStagePlan(stagePlan: readonly AutoImplementationStageRecord[]) {
  return stagePlan.every((record, index) => {
    const expectedStage = AUTO_IMPLEMENTATION_STAGES[index];

    return record.stage === expectedStage &&
      record.sequenceOrder === index + 1 &&
      record.label === AUTO_IMPLEMENTATION_STAGE_LABELS[record.stage];
  });
}

function stageRecordStateConsistent(record: AutoImplementationStageRecord) {
  if (record.status === "completed") {
    return record.ledgerEvidence !== null && record.blocker === null;
  }

  if (record.status === "blocked") {
    return record.blocker !== null && record.ledgerEvidence === null;
  }

  return record.ledgerEvidence === null;
}

function hasCanonicalIssueDocs(issueDocs: readonly AutoImplementationIssueDocument[]) {
  return issueDocs.length === AUTO_IMPLEMENTATION_STAGES.length &&
    issueDocs.every((issue, index) => issue.stage === AUTO_IMPLEMENTATION_STAGES[index]);
}

function arraysMatch(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function hasUniqueStrings(values: readonly string[]) {
  return new Set(values).size === values.length;
}

export function autoImplementationWorkerExpectedChangeScope(
  stage: AutoImplementationStage
): ImplementationStepDoc["expectedChangeScope"] {
  if (stage === "merge_main") {
    return "no_op_review";
  }

  if (stage === "final_verify_pr_update") {
    return "verification_only";
  }

  return "tracked_code_docs_config";
}

export function autoImplementationWorkerLedgerStepDescription(input: {
  readonly stage: AutoImplementationStage;
  readonly issueRelativePath: string;
}) {
  return `Execute ${AUTO_IMPLEMENTATION_STAGE_LABELS[input.stage]} for ${input.issueRelativePath}.`;
}

function workerPlanLedgerDocsMatchJob(input: {
  readonly runId: string;
  readonly projectFolderName: string;
  readonly trackerRelativePath: string;
  readonly job: AutoImplementationWorkerJob;
}) {
  const { job } = input;

  return job.executionPlan.ledgerTrackerDoc.trackerId === `auto-implementation-tracker:${input.runId}` &&
    job.executionPlan.ledgerTrackerDoc.title === `${input.projectFolderName} implementation tracker` &&
    job.executionPlan.ledgerTrackerDoc.goal === AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL &&
    job.executionPlan.ledgerTrackerDoc.sourceRefs.includes(`auto-implementation-run:${input.runId}`) &&
    job.executionPlan.ledgerTrackerDoc.sourceRefs.includes(`tracker-doc:${input.trackerRelativePath}`) &&
    job.executionPlan.ledgerStepDoc.stepId === `auto-implementation-step:${input.runId}:${job.stage}:${job.issueId}` &&
    job.executionPlan.ledgerStepDoc.title === job.issueTitle &&
    job.executionPlan.ledgerStepDoc.description === autoImplementationWorkerLedgerStepDescription({
      stage: job.stage,
      issueRelativePath: job.issueRelativePath
    }) &&
    job.executionPlan.ledgerStepDoc.expectedChangeScope === autoImplementationWorkerExpectedChangeScope(job.stage) &&
    job.executionPlan.ledgerStepDoc.sourceRefs.includes(`auto-implementation-run:${input.runId}`) &&
    job.executionPlan.ledgerStepDoc.sourceRefs.includes(`auto-implementation-stage:${job.stage}`) &&
    job.executionPlan.ledgerStepDoc.sourceRefs.includes(`auto-implementation-worker-job:${job.jobId}`) &&
    job.executionPlan.ledgerStepDoc.sourceRefs.includes(`auto-implementation-issue:${job.issueId}`) &&
    job.executionPlan.ledgerStepDoc.sourceRefs.includes(`issue-doc:${job.issueRelativePath}`);
}

function mutationPlansMatchIssueDocs(
  plans: readonly AutoImplementationGitHubIssuePlan[],
  issueDocs: readonly AutoImplementationIssueDocument[]
) {
  return plans.length === issueDocs.length &&
    plans.every((plan, index) => {
      const issue = issueDocs[index];

      if (!issue) {
        return false;
      }

      return (
        plan.issueId === issue.issueId &&
        plan.title === issue.title &&
        plan.bodyMarkdownPath === issue.relativePath &&
        plan.sourceStage === issue.stage
      );
    });
}

function isStageReviewGate(value: unknown): value is AutoImplementationStageReviewGate {
  return isRecord(value) &&
    isOneOf(value.stage, AUTO_IMPLEMENTATION_STAGES) &&
    Array.isArray(value.gates) &&
    isStringArray(value.gates) &&
    arraysMatch(value.gates, AUTO_IMPLEMENTATION_STAGE_REVIEW_GATES[value.stage]);
}

function isReviewProtocol(value: unknown): value is AutoImplementationReviewProtocol {
  if (!isRecord(value) || !Array.isArray(value.deliveryGates) || !Array.isArray(value.stageGates)) {
    return false;
  }

  const stageGates = value.stageGates as readonly AutoImplementationStageReviewGate[];

  return isStringArray(value.deliveryGates) &&
    arraysMatch(value.deliveryGates, AUTO_IMPLEMENTATION_DELIVERY_PROTOCOL) &&
    stageGates.length === AUTO_IMPLEMENTATION_STAGES.length &&
    stageGates.every((record, index) => isStageReviewGate(record) && record.stage === AUTO_IMPLEMENTATION_STAGES[index]);
}

function hasConsistentRemoteIssueState(
  remoteStatus: AutoImplementationRemoteStatus,
  issueManagement: AutoImplementationIssueManagement,
  remoteGuide: AutoImplementationRemoteGuide
) {
  const expectedIssueMode = remoteStatus === "connected" ? "github_ready" : "markdown_fallback";
  const mutation = issueManagement.githubIssueMutation;
  const nonAppliedMutationHasNoCreatedUrls = mutation.status === "applied" || mutation.createdIssueUrls.length === 0;
  const mutationUrlsMatchIssueUrls = arraysMatch(mutation.createdIssueUrls, issueManagement.githubIssueUrls);
  const mutationUrlsAreUnique = hasUniqueStrings(mutation.createdIssueUrls) && hasUniqueStrings(issueManagement.githubIssueUrls);
  const appliedMutationCreatedAllPlannedIssues =
    mutation.status !== "applied" || mutation.createdIssueUrls.length === mutation.plannedIssues.length;
  const blockedReasonMatchesStatus = mutation.status === "blocked"
    ? Boolean(mutation.blockedReason)
    : mutation.blockedReason === null;
  const nonConnectedCannotBeReady =
    remoteStatus === "connected" ||
    (mutation.status !== "dry_run_ready" && mutation.status !== "approved_ready" && mutation.status !== "applied");
  const approvalMatchesStatus =
    (mutation.status === "approved_ready" || mutation.status === "applied")
      ? mutation.approval !== null
      : mutation.approval === null;
  const mutationFlagMatchesStatus = mutation.mutatesGitHub === (mutation.status === "applied");
  const mutationPlansMatch = mutationPlansMatchIssueDocs(mutation.plannedIssues, issueManagement.issueDocs);
  const verifierEvidenceMatchesStatus =
    (mutation.status === "approved_ready" || mutation.status === "applied")
      ? mutation.verifierEvidenceRefs.length > 0
      : mutation.verifierEvidenceRefs.length === 0;

  return remoteGuide.status === remoteStatus &&
    issueManagement.mode === expectedIssueMode &&
    issueManagement.warning === remoteGuide.warning &&
    nonAppliedMutationHasNoCreatedUrls &&
    mutationUrlsMatchIssueUrls &&
    mutationUrlsAreUnique &&
    appliedMutationCreatedAllPlannedIssues &&
    blockedReasonMatchesStatus &&
    nonConnectedCannotBeReady &&
    approvalMatchesStatus &&
    mutationFlagMatchesStatus &&
    mutationPlansMatch &&
    verifierEvidenceMatchesStatus;
}

function hasValidWorkerJobs(value: Readonly<Record<string, unknown>>) {
  const issueManagement = value.issueManagement;

  if (
    !isNonEmptyString(value.runId) ||
    !isNonEmptyString(value.generatedRepoPath) ||
    !isNonEmptyString(value.projectFolderName) ||
    !isIssueManagement(issueManagement) ||
    !Array.isArray(value.workerJobs)
  ) {
    return false;
  }

  const runId = value.runId;
  const generatedRepoPath = value.generatedRepoPath;
  const projectFolderName = value.projectFolderName;
  const issueDocs = issueManagement.issueDocs;

  return value.workerJobs.every((job) =>
    isWorkerJob(job) &&
    job.runId === runId &&
    job.executionPlan.workingDirectory === generatedRepoPath &&
    job.executionPlan.issueDocumentPath === job.issueRelativePath &&
    workerPlanLedgerDocsMatchJob({
      runId,
      projectFolderName,
      trackerRelativePath: issueManagement.trackerRelativePath,
      job
    }) &&
    issueDocs.some((issue) =>
      issue.issueId === job.issueId &&
      issue.stage === job.stage &&
      issue.relativePath === job.issueRelativePath &&
      issue.title === job.issueTitle
    )
  );
}

function isRun(value: unknown): value is AutoImplementationRun {
  return isRecord(value) &&
    isNonEmptyString(value.runId) &&
    isNonEmptyString(value.projectFolderName) &&
    validFolderName(value.projectFolderName) &&
    isNonEmptyString(value.workspaceRoot) &&
    isNonEmptyString(value.generatedRepoPath) &&
    value.gitDefaultBranch === "main" &&
    isOneOf(value.currentStage, AUTO_IMPLEMENTATION_STAGES) &&
    isOneOf(value.status, AUTO_IMPLEMENTATION_RUN_STATUSES) &&
    isOneOf(value.remoteStatus, AUTO_IMPLEMENTATION_REMOTE_STATUSES) &&
    isNonEmptyString(value.nextTickAt) &&
    Array.isArray(value.stagePlan) &&
    value.stagePlan.length === AUTO_IMPLEMENTATION_STAGES.length &&
    value.stagePlan.every(isStageRecord) &&
    value.stagePlan.every(stageRecordStateConsistent) &&
    hasCanonicalStagePlan(value.stagePlan) &&
    isIssueManagement(value.issueManagement) &&
    hasCanonicalIssueDocs(value.issueManagement.issueDocs) &&
    isRemoteGuide(value.remoteGuide) &&
    hasConsistentRemoteIssueState(value.remoteStatus, value.issueManagement, value.remoteGuide) &&
    isReviewProtocol(value.reviewProtocol) &&
    isPullRequestMutationState(value.pullRequestMutations) &&
    hasValidWorkerJobs(value) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isStringArray(value.evidenceRefs) &&
    value.evidenceRefs.length > 0;
}

export function validateAutoImplementationRunProjection(
  projection: AutoImplementationRunProjection
): AutoImplementationRunProjection {
  const issues: string[] = [];

  if (projection.kind !== "AutoImplementationRunProjection") {
    issues.push("kind must be AutoImplementationRunProjection");
  }
  if (!isNonEmptyString(projection.sessionId)) {
    issues.push("sessionId must be set");
  }
  if (typeof projection.version !== "number" || projection.version < 1) {
    issues.push("version must be a positive projection version");
  }
  if (projection.latestRun !== null && !isRun(projection.latestRun)) {
    issues.push("latestRun must be a valid auto implementation run or null");
  }
  if (!Array.isArray(projection.runs) || !projection.runs.every(isRun)) {
    issues.push("runs must be valid auto implementation run records");
  }
  if (projection.latestRun && projection.runs.at(-1)?.runId !== projection.latestRun.runId) {
    issues.push("latestRun must match the last run record");
  }
  if (!isNonEmptyString(projection.summary)) {
    issues.push("summary must be set");
  }
  if (!isNonEmptyString(projection.refetchUrl)) {
    issues.push("refetchUrl must be set");
  }
  if (projection.schemaVersion !== AUTO_IMPLEMENTATION_SCHEMA_VERSION) {
    issues.push("schemaVersion must match AUTO_IMPLEMENTATION_SCHEMA_VERSION");
  }

  if (issues.length) {
    throw new AutoImplementationRunValidationError(issues);
  }

  return projection;
}

const AUTO_IMPLEMENTATION_RUN_READY_ISSUE_DOCS: readonly AutoImplementationIssueDocument[] = AUTO_IMPLEMENTATION_STAGES.map(
  (stage, index) => ({
    issueId: `local-${String(index + 1).padStart(3, "0")}`,
    title: DEFAULT_AUTO_IMPLEMENTATION_ISSUE_TITLES[index]!,
    relativePath: `implementation-issues/${String(index + 1).padStart(3, "0")}-${stage}.md`,
    stage,
    status: "open" as const
  })
);

function githubIssuePlansForIssueDocs(
  issueDocs: readonly AutoImplementationIssueDocument[]
): readonly AutoImplementationGitHubIssuePlan[] {
  return issueDocs.map((issue) => ({
    issueId: issue.issueId,
    title: issue.title,
    bodyMarkdownPath: issue.relativePath,
    sourceStage: issue.stage
  }));
}

const AUTO_IMPLEMENTATION_RUN_READY_FIXTURE_RUN: AutoImplementationRun = {
  runId: "auto_run_demo",
  projectFolderName: "demo-project",
  workspaceRoot: "/repo/workspace",
  generatedRepoPath: "/repo/workspace/demo-project",
  gitDefaultBranch: "main",
  currentStage: "initial_pr",
  status: "pending",
  remoteStatus: "no_remote",
  nextTickAt: "2026-05-19T00:05:00.000Z",
  stagePlan: AUTO_IMPLEMENTATION_STAGES.map((stage, index) => ({
    stage,
    label: AUTO_IMPLEMENTATION_STAGE_LABELS[stage],
    status: index === 0 ? "ready" : "pending",
    sequenceOrder: index + 1,
    nextScheduledAt: index === 0 ? "2026-05-19T00:05:00.000Z" : null,
    evidenceRefs: [],
    tickRecords: [],
    ledgerEvidence: null,
    blocker: null
  })),
  issueManagement: {
    mode: "markdown_fallback",
    trackerRelativePath: "implementation-tracker.md",
    issueDocs: AUTO_IMPLEMENTATION_RUN_READY_ISSUE_DOCS,
    issueStatusSummary: autoImplementationIssueStatusSummary(AUTO_IMPLEMENTATION_RUN_READY_ISSUE_DOCS),
    githubIssueUrls: [],
    githubIssueMutation: {
      status: "not_requested",
      requiredRemoteStatus: "connected",
      mutatesGitHub: false,
      perActionApprovalRequired: true,
      approval: null,
      blockedReason: null,
      plannedIssues: githubIssuePlansForIssueDocs(AUTO_IMPLEMENTATION_RUN_READY_ISSUE_DOCS),
      createdIssueUrls: [],
      auditEvidenceRefs: ["github-issue-mutation:not_requested"],
      verifierEvidenceRefs: []
    },
    warning: "Remote is not connected; local markdown issues are the source of truth."
  },
  remoteGuide: {
    status: "no_remote",
    warning: "Remote is not connected; local markdown issues are the source of truth.",
    commands: ["git remote add origin <github-repo-url>", "git push -u origin main", "gh auth login"],
    nextAction: "Connect a GitHub remote when remote issue/PR automation is desired."
  },
  reviewProtocol: defaultAutoImplementationReviewProtocol(),
  pullRequestMutations: {
    records: [],
    latestRecord: null
  },
  workerJobs: [],
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z",
  evidenceRefs: ["workspace:demo-project", "git:init:main", "issues:markdown_fallback"]
};

export const AUTO_IMPLEMENTATION_RUN_READY_FIXTURE: AutoImplementationRunProjection =
  validateAutoImplementationRunProjection({
    kind: "AutoImplementationRunProjection",
    sessionId: "demo-session" as SessionId,
    version: 1 as ProjectionVersion,
    latestRun: AUTO_IMPLEMENTATION_RUN_READY_FIXTURE_RUN,
    runs: [AUTO_IMPLEMENTATION_RUN_READY_FIXTURE_RUN],
    summary: "Auto implementation workspace is ready for demo-project; remote status is no_remote.",
    refetchUrl: "/api/v1/sessions/demo-session/auto-implementation-runs",
    schemaVersion: AUTO_IMPLEMENTATION_SCHEMA_VERSION
  });
