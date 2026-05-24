import {
  AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX,
  AUTO_IMPLEMENTATION_STAGE_LABELS,
  AUTO_IMPLEMENTATION_STAGE_WORKER_REQUIRED_EVIDENCE,
  autoImplementationPlanningIssueFiles,
  canCreateAutoImplementationGitHubIssues,
  canImportAutoImplementationWorkerLedger,
  canMergeAutoImplementationPullRequest,
  canOpenNewAutoImplementationPullRequest,
  canPlanCurrentStageAutoImplementationWorkerJob,
  canRunAutoImplementationWorkerJob,
  hasAppliedAutoImplementationPullRequestMerge,
  autoImplementationGitHubIssueUrlForIssue,
  latestAutoImplementationWorkerJobForIssue,
  latestCurrentStageAutoImplementationWorkerJob,
  type AutoImplementationGitHubIssuePlan,
  type AutoImplementationIssueDocument,
  type AutoImplementationIssueStatusSummary,
  type AutoImplementationPullRequestMutationRecord,
  type AutoImplementationRun,
  type AutoImplementationRunProjection,
  type AutoImplementationStage,
  type AutoImplementationStageReviewGate,
  type AutoImplementationStageRecord,
  type AutoImplementationStageStatus,
  type AutoImplementationWorkerExecutionPlan,
  type AutoImplementationWorkerJob,
  type CodexRuntimeStatusDto,
  type ImplementationStepLedgerProjection,
  type ImplementationStepRecord
} from "@solo-superman/contracts";
import { canCompleteAutoImplementationWorkerFromLedger } from "./auto-implementation-worker-completion-request";
import {
  codexRuntimeEvidenceView,
  type CodexRuntimeEvidenceView
} from "./codex-runtime-status-view";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";

type AutoImplementationWorkerRuntimeNextAction =
  | "refreshRuntime"
  | "liveReady"
  | "fixture"
  | "codexLogin"
  | "enableLiveTurns"
  | "resolveBlocker";

interface AutoImplementationWorkerRuntimeView extends CodexRuntimeEvidenceView {
  readonly nextActionKey: AutoImplementationWorkerRuntimeNextAction;
}

interface AutoImplementationWorkerPlanView {
  readonly stage: AutoImplementationStage;
  readonly stageLabel: string;
  readonly executionMode: AutoImplementationWorkerExecutionPlan["executionMode"];
  readonly workingDirectory: string;
  readonly issueDocumentPath: string;
  readonly executionAuthorityRef: string | null;
  readonly ledgerTrackerDoc: AutoImplementationWorkerExecutionPlan["ledgerTrackerDoc"];
  readonly ledgerStepDoc: AutoImplementationWorkerExecutionPlan["ledgerStepDoc"];
  readonly allowedWriteScope: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly baseRequiredEvidence: readonly string[];
  readonly stageRequiredEvidence: readonly string[];
  readonly forbiddenActions: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly blockedReason: string | null;
  readonly missingEvidence: readonly string[];
  readonly evidenceRefs: readonly string[];
}

interface AutoImplementationStageProgressView {
  readonly completedStageCount: number;
  readonly totalStageCount: number;
  readonly currentStage: AutoImplementationStage | null;
  readonly currentStageStatus: AutoImplementationStageStatus | "not_started";
}

interface AutoImplementationReviewLoopProgressView {
  readonly completedReviewLoopCount: number;
  readonly totalReviewLoopCount: number;
  readonly nextReviewLoopStage: AutoImplementationStage | null;
}

export interface AutoImplementationIssueRowView {
  readonly issue: AutoImplementationIssueDocument;
  readonly githubIssueUrlLabel: string;
  readonly latestWorkerJobLabel: string;
  readonly latestWorkerJobId: string | null;
  readonly latestWorkerJobStatus: AutoImplementationWorkerJob["status"] | "none";
  readonly blockerLabel: string | null;
  readonly nextActionLabel: string;
  readonly stageGateLabel: string;
  readonly missingEvidenceLabel: string;
  readonly evidenceRefsLabel: string;
}

export interface AutoImplementationRunViewModel {
  readonly status: string;
  readonly summary: string;
  readonly workspaceLabel: string;
  readonly remoteLabel: string;
  readonly nextTickLabel: string;
  readonly issueModeLabel: string;
  readonly issueStatusSummaryLabel: string;
  readonly issueStatusSummary: AutoImplementationIssueStatusSummary | null;
  readonly remoteWarning: string | null;
  readonly remoteCommands: readonly string[];
  readonly remoteNextAction: string;
  readonly githubIssueMutationLabel: string;
  readonly githubIssuePlans: readonly AutoImplementationGitHubIssuePlan[];
  readonly githubCreatedIssueUrls: readonly string[];
  readonly pullRequestMutationLabel: string;
  readonly pullRequestMutationHistoryCount: number;
  readonly latestPullRequestMutation: AutoImplementationPullRequestMutationRecord | null;
  readonly stages: readonly AutoImplementationStageRecord[];
  readonly issueDocs: readonly AutoImplementationIssueDocument[];
  readonly issueRows: readonly AutoImplementationIssueRowView[];
  readonly planningIssueFiles: readonly string[];
  readonly deliveryGates: readonly string[];
  readonly stageReviewGates: readonly AutoImplementationStageReviewGate[];
  readonly evidenceRefs: readonly string[];
  readonly latestWorkerJobLabel: string;
  readonly latestWorkerJobNextAction: string;
  readonly latestWorkerJobId: string | null;
  readonly latestWorkerJobStatus: AutoImplementationWorkerJob["status"] | "not_planned";
  readonly latestWorkerJobStage: AutoImplementationStage | null;
  readonly latestWorkerJobIssueId: string | null;
  readonly stageProgress: AutoImplementationStageProgressView;
  readonly reviewLoopProgress: AutoImplementationReviewLoopProgressView;
  readonly currentStageGates: readonly string[];
  readonly workerStageAdvanceBlockerLabel: string | null;
  readonly workerRuntimeReadiness: AutoImplementationWorkerRuntimeView | null;
  readonly latestWorkerPlan: AutoImplementationWorkerPlanView | null;
  readonly canPlanWorkerJob: boolean;
  readonly canRecordStageTick: boolean;
  readonly canStartStage: boolean;
  readonly canPauseStage: boolean;
  readonly canBlockStage: boolean;
  readonly canCompleteWorkerJob: boolean;
  readonly canImportWorkerLedger: boolean;
  readonly canRecordGitHubIssueDryRun: boolean;
  readonly canApplyGitHubIssueCreation: boolean;
  readonly canRecordPullRequestDryRun: boolean;
  readonly canApplyPullRequestOpen: boolean;
  readonly canApplyPullRequestBodyUpdate: boolean;
  readonly canApplyPullRequestMerge: boolean;
  readonly canRunWorkerJob: boolean;
  readonly canAdvanceWorkerStage: boolean;
  readonly hasRun: boolean;
}

const REVIEW_LOOP_STAGES = [
  "code_review_fix_1",
  "code_review_fix_2",
  "clean_code_fix_1",
  "clean_code_fix_2"
] as const satisfies readonly AutoImplementationStage[];

function latestRun(projection: AutoImplementationRunProjection | null) {
  return projection?.latestRun ?? null;
}

function codexWorkerRuntimeNextActionKey(
  runtimeStatus: CodexRuntimeStatusDto | null
): AutoImplementationWorkerRuntimeNextAction {
  if (!runtimeStatus) {
    return "refreshRuntime";
  }

  if (runtimeStatus.status === "available" && runtimeStatus.executionMode === "live" && runtimeStatus.liveTurnExecutionEnabled) {
    return "liveReady";
  }

  if (runtimeStatus.executionMode === "fixture") {
    return "fixture";
  }

  if (runtimeStatus.account.status !== "authenticated") {
    return "codexLogin";
  }

  if (runtimeStatus.executionMode === "manual_handoff" || !runtimeStatus.liveTurnExecutionEnabled) {
    return "enableLiveTurns";
  }

  return "resolveBlocker";
}

function autoImplementationWorkerRuntimeView(
  runtimeStatus: CodexRuntimeStatusDto | null
): AutoImplementationWorkerRuntimeView {
  return {
    ...codexRuntimeEvidenceView(runtimeStatus),
    nextActionKey: codexWorkerRuntimeNextActionKey(runtimeStatus)
  };
}

function formatIssueStatusSummaryLabel(summary: AutoImplementationIssueStatusSummary | null) {
  if (!summary) {
    return "Issue status summary: no issue documents";
  }

  return `Issue status summary: ${summary.completed} completed / ${summary.blocked} blocked / ${summary.open} open / ${summary.total} total`;
}

function autoImplementationStageRecordForIssue(
  run: AutoImplementationRun,
  issue: AutoImplementationIssueDocument
) {
  return run.stagePlan.find((stage) => stage.stage === issue.stage) ?? null;
}

function autoImplementationStageProgress(run: AutoImplementationRun): AutoImplementationStageProgressView {
  const currentStage = run.stagePlan.find((stage) => stage.stage === run.currentStage);

  return {
    completedStageCount: run.stagePlan.filter((stage) => stage.status === "completed").length,
    totalStageCount: run.stagePlan.length,
    currentStage: run.currentStage,
    currentStageStatus: currentStage?.status ?? "pending"
  };
}

function autoImplementationReviewLoopProgress(run: AutoImplementationRun): AutoImplementationReviewLoopProgressView {
  return {
    completedReviewLoopCount: REVIEW_LOOP_STAGES.filter((stage) =>
      run.stagePlan.find((record) => record.stage === stage)?.status === "completed"
    ).length,
    totalReviewLoopCount: REVIEW_LOOP_STAGES.length,
    nextReviewLoopStage: REVIEW_LOOP_STAGES.find((stage) =>
      run.stagePlan.find((record) => record.stage === stage)?.status !== "completed"
    ) ?? null
  };
}

function autoImplementationCurrentStageGates(run: AutoImplementationRun) {
  return run.reviewProtocol.stageGates.find((stageGate) => stageGate.stage === run.currentStage)?.gates ?? [];
}

function issueRowNextAction(input: {
  readonly stage: AutoImplementationStageRecord | null;
  readonly latestWorkerJob: AutoImplementationWorkerJob | null;
}) {
  if (input.latestWorkerJob?.nextRequiredAction) {
    return input.latestWorkerJob.nextRequiredAction;
  }

  if (input.stage?.blocker?.nextRequiredAction) {
    return input.stage.blocker.nextRequiredAction;
  }

  if (input.stage?.status === "completed") {
    return "Use the completed stage ledger evidence before advancing the next PR slice.";
  }

  return "Work this issue through the delivery protocol, review streaks, and test evidence checklist.";
}

function issueRowBlockerLabel(input: {
  readonly stage: AutoImplementationStageRecord | null;
  readonly latestWorkerJob: AutoImplementationWorkerJob | null;
}) {
  if (input.latestWorkerJob?.blockedReason) {
    return `worker blocker: ${input.latestWorkerJob.blockedReason}`;
  }

  if (input.stage?.blocker?.reason) {
    return `stage blocker: ${input.stage.blocker.reason}`;
  }

  return null;
}

function latestIssueWorkerJobLabel(latestWorkerJob: AutoImplementationWorkerJob | null) {
  return latestWorkerJob ? `latest worker ${latestWorkerJob.jobId} (${latestWorkerJob.status})` : "latest worker none";
}

function issueRowMissingEvidence(
  stage: AutoImplementationStageRecord | null,
  latestWorkerJob: AutoImplementationWorkerJob | null
) {
  if (latestWorkerJob?.missingEvidence.length) {
    return latestWorkerJob.missingEvidence;
  }

  return stage?.blocker?.missingEvidence ?? [];
}

function issueRowEvidenceRefs(
  stage: AutoImplementationStageRecord | null,
  latestWorkerJob: AutoImplementationWorkerJob | null
) {
  if (latestWorkerJob?.evidenceRefs.length) {
    return latestWorkerJob.evidenceRefs;
  }

  if (stage?.blocker?.evidenceRefs.length) {
    return stage.blocker.evidenceRefs;
  }

  return stage?.evidenceRefs ?? [];
}

function issueRowStageGates(run: AutoImplementationRun, issue: AutoImplementationIssueDocument) {
  return run.reviewProtocol.stageGates.find((stageGate) => stageGate.stage === issue.stage)?.gates ?? [];
}

function splitWorkerRequiredEvidence(
  stage: AutoImplementationStage,
  requiredEvidence: readonly string[]
) {
  const stageEvidence = AUTO_IMPLEMENTATION_STAGE_WORKER_REQUIRED_EVIDENCE[stage];
  const stageEvidenceSet = new Set<string>(stageEvidence);

  return {
    baseRequiredEvidence: requiredEvidence.filter((evidence) => !stageEvidenceSet.has(evidence)),
    stageRequiredEvidence: requiredEvidence.filter((evidence) => stageEvidenceSet.has(evidence))
  };
}

function completedLedgerStepMatchesCurrentStage(
  step: ImplementationStepRecord,
  run: AutoImplementationRun,
  workerJob: AutoImplementationWorkerJob
) {
  return step.status === "completed" &&
    step.missingEvidence.length === 0 &&
    step.blocker === null &&
    step.stepDoc.stepId === workerJob.executionPlan.ledgerStepDoc.stepId &&
    step.stepDoc.sourceRefs.includes(`auto-implementation-stage:${run.currentStage}`);
}

function hasRequiredWorkerAdvanceLedgerEvidence(input: {
  readonly run: AutoImplementationRun;
  readonly ledger: ImplementationStepLedgerProjection | null;
  readonly workerJob: AutoImplementationWorkerJob;
}) {
  const { ledger, run, workerJob } = input;

  if (run.currentStage !== "merge_main") {
    return true;
  }

  const stageStep = [...(ledger?.steps ?? [])].reverse().find((step) =>
    completedLedgerStepMatchesCurrentStage(step, run, workerJob)
  );

  return Boolean(
    stageStep?.testEvidenceRecord?.evidenceRefs.some((ref) =>
      ref.startsWith(AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX)
    )
  );
}

function workerStageAdvanceBlockerLabel(input: {
  readonly run: AutoImplementationRun;
  readonly ledger: ImplementationStepLedgerProjection | null;
  readonly workerJob: AutoImplementationWorkerJob | null;
}) {
  const { ledger, run, workerJob } = input;

  if (!workerJob) {
    return "Plan and complete a current-stage local worker before advancing the stage.";
  }

  if (workerJob.status !== "completed") {
    return "Complete the current-stage local worker and import its ledger evidence before advancing the stage.";
  }

  if (run.currentStage !== "merge_main") {
    return null;
  }

  if (!hasAppliedAutoImplementationPullRequestMerge(run)) {
    return "Record the applied GitHub PR merge mutation before advancing merge_main.";
  }

  if (!hasRequiredWorkerAdvanceLedgerEvidence({ run, ledger, workerJob })) {
    return `Import completed ledger test evidence containing ${AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX}merge_main:<command> before advancing merge_main.`;
  }

  return null;
}

function autoImplementationIssueRowView(
  run: AutoImplementationRun,
  issue: AutoImplementationIssueDocument
): AutoImplementationIssueRowView {
  const stage = autoImplementationStageRecordForIssue(run, issue);
  const latestWorkerJob = latestAutoImplementationWorkerJobForIssue(run, issue);

  return {
    issue,
    githubIssueUrlLabel: autoImplementationGitHubIssueUrlForIssue(run, issue) ?? "none",
    latestWorkerJobLabel: latestIssueWorkerJobLabel(latestWorkerJob),
    latestWorkerJobId: latestWorkerJob?.jobId ?? null,
    latestWorkerJobStatus: latestWorkerJob?.status ?? "none",
    blockerLabel: issueRowBlockerLabel({ stage, latestWorkerJob }),
    nextActionLabel: issueRowNextAction({ stage, latestWorkerJob }),
    stageGateLabel: inlineList(issueRowStageGates(run, issue), "none"),
    missingEvidenceLabel: inlineList(issueRowMissingEvidence(stage, latestWorkerJob), "none"),
    evidenceRefsLabel: inlineList(issueRowEvidenceRefs(stage, latestWorkerJob), "none")
  };
}

export function autoImplementationRunViewModel(
  projection: AutoImplementationRunProjection | null,
  implementationStepLedger: ImplementationStepLedgerProjection | null = null,
  runtimeStatus: CodexRuntimeStatusDto | null = null
): AutoImplementationRunViewModel {
  const run = latestRun(projection);

  if (!projection || !run) {
    return {
      status: "not_started",
      summary: "No auto implementation workspace has been prepared yet.",
      workspaceLabel: "workspace/<project> is not prepared",
      remoteLabel: "Remote: not checked",
      nextTickLabel: "Next 5-minute tick: not scheduled",
      issueModeLabel: "Issue mode: not selected",
      issueStatusSummaryLabel: formatIssueStatusSummaryLabel(null),
      issueStatusSummary: null,
      remoteWarning: "Start a run to create a local git repo, markdown fallback issues, and remote connection guidance.",
      remoteCommands: [],
      remoteNextAction: "Create the workspace run after the planning handoff is detailed enough.",
      githubIssueMutationLabel: "GitHub issue mutation: not requested",
      githubIssuePlans: [],
      githubCreatedIssueUrls: [],
      pullRequestMutationLabel: "GitHub PR mutation: no records",
      pullRequestMutationHistoryCount: 0,
      latestPullRequestMutation: null,
      stages: [],
      issueDocs: [],
      issueRows: [],
      planningIssueFiles: [],
      deliveryGates: [],
      stageReviewGates: [],
      evidenceRefs: [],
      latestWorkerJobLabel: "Local Codex worker: not planned",
      latestWorkerJobNextAction: "Create a workspace run before planning a local Codex worker.",
      latestWorkerJobId: null,
      latestWorkerJobStatus: "not_planned",
      latestWorkerJobStage: null,
      latestWorkerJobIssueId: null,
      stageProgress: {
        completedStageCount: 0,
        totalStageCount: 0,
        currentStage: null,
        currentStageStatus: "not_started"
      },
      reviewLoopProgress: {
        completedReviewLoopCount: 0,
        totalReviewLoopCount: REVIEW_LOOP_STAGES.length,
        nextReviewLoopStage: null
      },
      currentStageGates: [],
      workerStageAdvanceBlockerLabel: null,
      workerRuntimeReadiness: null,
      latestWorkerPlan: null,
      canPlanWorkerJob: false,
      canRecordStageTick: false,
      canStartStage: false,
      canPauseStage: false,
      canBlockStage: false,
      canCompleteWorkerJob: false,
      canImportWorkerLedger: false,
      canRecordGitHubIssueDryRun: false,
      canApplyGitHubIssueCreation: false,
      canRecordPullRequestDryRun: false,
      canApplyPullRequestOpen: false,
      canApplyPullRequestBodyUpdate: false,
      canApplyPullRequestMerge: false,
      canRunWorkerJob: false,
      canAdvanceWorkerStage: false,
      hasRun: false
    };
  }

  const githubIssueMutation = run.issueManagement.githubIssueMutation;
  const githubIssueBlockedReason = githubIssueMutation.blockedReason ? ` · ${githubIssueMutation.blockedReason}` : "";
  const pullRequestMutationState = (run as { readonly pullRequestMutations?: unknown }).pullRequestMutations;
  const pullRequestMutationRecords = pullRequestMutationState &&
    typeof pullRequestMutationState === "object" &&
    Array.isArray((pullRequestMutationState as { readonly records?: unknown }).records)
    ? (pullRequestMutationState as { readonly records: readonly AutoImplementationPullRequestMutationRecord[] }).records
    : [];
  const latestPullRequestMutation = pullRequestMutationState &&
    typeof pullRequestMutationState === "object" &&
    (pullRequestMutationState as { readonly latestRecord?: unknown }).latestRecord
    ? (pullRequestMutationState as { readonly latestRecord: AutoImplementationPullRequestMutationRecord }).latestRecord
    : pullRequestMutationRecords.at(-1) ?? null;
  const latestWorkerJob = latestCurrentStageAutoImplementationWorkerJob(run);
  const currentStageRecord = run.stagePlan.find((stage) => stage.stage === run.currentStage) ?? null;
  const latestWorkerPlan = latestWorkerJob
    ? {
        stage: latestWorkerJob.stage,
        stageLabel: AUTO_IMPLEMENTATION_STAGE_LABELS[latestWorkerJob.stage],
        executionMode: latestWorkerJob.executionPlan.executionMode,
        workingDirectory: latestWorkerJob.executionPlan.workingDirectory,
        issueDocumentPath: latestWorkerJob.executionPlan.issueDocumentPath,
        executionAuthorityRef: latestWorkerJob.executionPlan.executionAuthorityRef,
        ledgerTrackerDoc: latestWorkerJob.executionPlan.ledgerTrackerDoc,
        ledgerStepDoc: latestWorkerJob.executionPlan.ledgerStepDoc,
        allowedWriteScope: latestWorkerJob.executionPlan.allowedWriteScope,
        requiredEvidence: latestWorkerJob.executionPlan.requiredEvidence,
        ...splitWorkerRequiredEvidence(latestWorkerJob.stage, latestWorkerJob.executionPlan.requiredEvidence),
        forbiddenActions: latestWorkerJob.executionPlan.forbiddenActions,
        sourceRefs: latestWorkerJob.executionPlan.sourceRefs,
        blockedReason: latestWorkerJob.blockedReason,
        missingEvidence: latestWorkerJob.missingEvidence,
        evidenceRefs: latestWorkerJob.evidenceRefs
      }
    : null;
  const planningIssueFiles = autoImplementationPlanningIssueFiles(run);
  const canRunWorkerJob = canRunAutoImplementationWorkerJob(latestWorkerJob);
  const canAdvanceWorkerStage = latestWorkerJob?.status === "completed" &&
    hasRequiredWorkerAdvanceLedgerEvidence({
      run,
      ledger: implementationStepLedger,
      workerJob: latestWorkerJob
    }) &&
    (run.currentStage !== "merge_main" || hasAppliedAutoImplementationPullRequestMerge(run));
  const workerStageAdvanceBlocker = canAdvanceWorkerStage
    ? null
    : workerStageAdvanceBlockerLabel({
        run,
        ledger: implementationStepLedger,
        workerJob: latestWorkerJob
      });
  const hasReadyPullRequestDryRun = (action: AutoImplementationPullRequestMutationRecord["action"]) =>
    pullRequestMutationRecords.some((record) =>
      record.action === action &&
      record.requestMode === "dry_run" &&
      record.status === "dry_run_ready"
    );

  return {
    status: run.status,
    summary: projection.summary,
    workspaceLabel: `Workspace: ${run.generatedRepoPath}`,
    remoteLabel: `Remote: ${run.remoteStatus}`,
    nextTickLabel: `Next 5-minute tick: ${run.nextTickAt}`,
    issueModeLabel: `Issue mode: ${run.issueManagement.mode}`,
    issueStatusSummaryLabel: formatIssueStatusSummaryLabel(run.issueManagement.issueStatusSummary),
    issueStatusSummary: run.issueManagement.issueStatusSummary,
    remoteWarning: run.remoteGuide.warning,
    remoteCommands: run.remoteGuide.commands,
    remoteNextAction: run.remoteGuide.nextAction,
    githubIssueMutationLabel: `GitHub issue mutation: ${githubIssueMutation.status}${githubIssueBlockedReason}`,
    githubIssuePlans: githubIssueMutation.plannedIssues,
    githubCreatedIssueUrls: run.issueManagement.githubIssueUrls,
    pullRequestMutationLabel: latestPullRequestMutation
      ? `GitHub PR mutation: ${latestPullRequestMutation.action} ${latestPullRequestMutation.status}`
      : "GitHub PR mutation: no records",
    pullRequestMutationHistoryCount: pullRequestMutationRecords.length,
    latestPullRequestMutation,
    stages: run.stagePlan,
    issueDocs: run.issueManagement.issueDocs,
    issueRows: run.issueManagement.issueDocs.map((issue) => autoImplementationIssueRowView(run, issue)),
    planningIssueFiles,
    deliveryGates: run.reviewProtocol.deliveryGates,
    stageReviewGates: run.reviewProtocol.stageGates,
    evidenceRefs: run.evidenceRefs,
    latestWorkerJobLabel: latestWorkerJob
      ? `Local Codex worker: ${latestWorkerJob.status} for ${latestWorkerJob.stage} (${latestWorkerJob.issueId})`
      : "Local Codex worker: not planned",
    latestWorkerJobNextAction: latestWorkerJob?.nextRequiredAction ??
      "Create a bounded local worker job after the current stage issue document is ready.",
    latestWorkerJobId: latestWorkerJob?.jobId ?? null,
    latestWorkerJobStatus: latestWorkerJob?.status ?? "not_planned",
    latestWorkerJobStage: latestWorkerJob?.stage ?? null,
    latestWorkerJobIssueId: latestWorkerJob?.issueId ?? null,
    stageProgress: autoImplementationStageProgress(run),
    reviewLoopProgress: autoImplementationReviewLoopProgress(run),
    currentStageGates: autoImplementationCurrentStageGates(run),
    workerStageAdvanceBlockerLabel: workerStageAdvanceBlocker,
    workerRuntimeReadiness: autoImplementationWorkerRuntimeView(runtimeStatus),
    latestWorkerPlan,
    canPlanWorkerJob: canPlanCurrentStageAutoImplementationWorkerJob(run),
    canRecordStageTick: run.status !== "completed",
    canStartStage: run.status !== "completed" &&
      currentStageRecord !== null &&
      currentStageRecord?.status !== "running" &&
      currentStageRecord?.status !== "completed",
    canPauseStage: run.status !== "completed" && currentStageRecord?.status === "running",
    canBlockStage: run.status !== "completed" &&
      currentStageRecord !== null &&
      currentStageRecord?.status !== "blocked" &&
      currentStageRecord?.status !== "completed",
    canCompleteWorkerJob: canCompleteAutoImplementationWorkerFromLedger({
      run,
      ledger: implementationStepLedger
    }),
    canImportWorkerLedger: canImportAutoImplementationWorkerLedger(latestWorkerJob),
    canRecordGitHubIssueDryRun: run.status !== "completed" &&
      canCreateAutoImplementationGitHubIssues(run) &&
      (githubIssueMutation.status === "not_requested" || githubIssueMutation.status === "blocked"),
    canApplyGitHubIssueCreation: run.status !== "completed" &&
      githubIssueMutation.status === "dry_run_ready" &&
      canCreateAutoImplementationGitHubIssues(run),
    canRecordPullRequestDryRun: run.status !== "completed",
    canApplyPullRequestOpen: run.status !== "completed" &&
      hasReadyPullRequestDryRun("open_pr") &&
      canOpenNewAutoImplementationPullRequest(run),
    canApplyPullRequestBodyUpdate: run.status !== "completed" && hasReadyPullRequestDryRun("update_pr_body"),
    canApplyPullRequestMerge: run.status !== "completed" &&
      hasReadyPullRequestDryRun("merge_pr") &&
      canMergeAutoImplementationPullRequest(run),
    canRunWorkerJob,
    canAdvanceWorkerStage,
    hasRun: true
  };
}

function inlineList(items: readonly string[], fallback: string) {
  return items.length ? items.join(", ") : fallback;
}

function RequiredEvidenceList({
  fallback,
  items
}: {
  readonly fallback: string;
  readonly items: readonly string[];
}) {
  return items.length ? (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : (
    <span>{fallback}</span>
  );
}

interface AutoImplementationRunPanelProps {
  readonly run: AutoImplementationRunViewModel;
  readonly isBusy: boolean;
  readonly canCreateRun: boolean;
  readonly onCreateRun: () => void;
  readonly onPlanWorkerJob: () => void;
  readonly onRecordStageTick: () => void;
  readonly onStartStage: () => void;
  readonly onPauseStage: () => void;
  readonly onBlockStage: () => void;
  readonly onCompleteWorkerJob: () => void;
  readonly workerLedgerImportDraft: string;
  readonly onWorkerLedgerImportDraftChange: (value: string) => void;
  readonly onImportWorkerLedger: () => void;
  readonly onRecordGitHubIssueDryRun: () => void;
  readonly onApplyGitHubIssueCreation: () => void;
  readonly onRecordPullRequestOpenDryRun: () => void;
  readonly onRecordPullRequestDryRun: () => void;
  readonly onRecordPullRequestMergeDryRun: () => void;
  readonly onApplyPullRequestOpen: () => void;
  readonly onApplyPullRequestBodyUpdate: () => void;
  readonly onApplyPullRequestMerge: () => void;
  readonly onRunWorkerJob: () => void;
  readonly onAdvanceWorkerStage: () => void;
  readonly onRefreshRun: () => void;
}

export function AutoImplementationRunPanel({
  run,
  isBusy,
  canCreateRun,
  onCreateRun,
  onPlanWorkerJob,
  onRecordStageTick,
  onStartStage,
  onPauseStage,
  onBlockStage,
  onCompleteWorkerJob,
  workerLedgerImportDraft,
  onWorkerLedgerImportDraftChange,
  onImportWorkerLedger,
  onRecordGitHubIssueDryRun,
  onApplyGitHubIssueCreation,
  onRecordPullRequestOpenDryRun,
  onRecordPullRequestDryRun,
  onRecordPullRequestMergeDryRun,
  onApplyPullRequestOpen,
  onApplyPullRequestBodyUpdate,
  onApplyPullRequestMerge,
  onRunWorkerJob,
  onAdvanceWorkerStage,
  onRefreshRun
}: AutoImplementationRunPanelProps) {
  const copy = useDecisionQueueCopy();
  const latestPullRequestMutation = run.latestPullRequestMutation;
  const workerRuntimeNextAction = run.workerRuntimeReadiness
    ? copy.autoImplementation.workerRuntimeNextActions[run.workerRuntimeReadiness.nextActionKey]
    : null;
  const workerRuntimeLiveTurns = run.workerRuntimeReadiness
    ? copy.autoImplementation.workerRuntimeLiveTurnStates[run.workerRuntimeReadiness.liveTurnsState]
    : null;
  const workerRuntimeManualHandoff = run.workerRuntimeReadiness
    ? copy.autoImplementation.workerRuntimeManualHandoffStates[run.workerRuntimeReadiness.manualHandoffState]
    : null;
  const currentStageLabel = run.stageProgress.currentStage
    ? copy.autoImplementation.stageLabels[run.stageProgress.currentStage]
    : copy.autoImplementation.none;
  const currentStageStatusLabel = copy.autoImplementation.stageStatusLabels[run.stageProgress.currentStageStatus];
  const nextReviewLoopLabel = run.reviewLoopProgress.nextReviewLoopStage
    ? copy.autoImplementation.stageLabels[run.reviewLoopProgress.nextReviewLoopStage]
    : null;
  const currentStageGateLabels = run.stageProgress.currentStage
    ? copy.autoImplementation.stageGateLabels[run.stageProgress.currentStage]
    : run.currentStageGates;
  const latestWorkerJobStageLabel = run.latestWorkerJobStage
    ? copy.autoImplementation.stageLabels[run.latestWorkerJobStage]
    : null;
  const latestWorkerJobLabel = copy.autoImplementation.latestWorkerJobLabel(
    run.latestWorkerJobStatus === "not_planned" ? null : run.latestWorkerJobStatus,
    latestWorkerJobStageLabel,
    run.latestWorkerJobIssueId
  );
  const latestWorkerJobNextAction = run.latestWorkerJobId
    ? run.latestWorkerJobNextAction
    : copy.autoImplementation.latestWorkerJobNextActionNotPlanned(run.hasRun);

  return (
    <section className="panel auto-implementation-run-panel">
      <div className="panel-heading">
        <h2>{copy.autoImplementation.title}</h2>
        <span>{run.status}</span>
      </div>
      <p>{run.summary}</p>
      <p className="research-recovery">{run.workspaceLabel}</p>
      <p className="mode-summary">{run.remoteLabel} · {run.issueModeLabel}</p>
      <p className="mode-summary">{copy.autoImplementation.issueStatusSummary(run.issueStatusSummary)}</p>
      <p className="mode-summary">{run.nextTickLabel}</p>
      <p className="mode-summary">{latestWorkerJobLabel}</p>
      <p className="research-recovery">{latestWorkerJobNextAction}</p>
      <article className="operations-card" aria-label={copy.autoImplementation.deliveryProgress}>
        <h3>{copy.autoImplementation.deliveryProgress}</h3>
        <dl className="readiness-grid">
          <div>
            <dt>{copy.autoImplementation.stageProgress}</dt>
            <dd>{copy.autoImplementation.stageProgressSummary(
              run.stageProgress.completedStageCount,
              run.stageProgress.totalStageCount,
              currentStageLabel,
              currentStageStatusLabel
            )}</dd>
          </div>
          <div>
            <dt>{copy.autoImplementation.reviewLoopProgress}</dt>
            <dd>{copy.autoImplementation.reviewLoopProgressSummary(
              run.reviewLoopProgress.completedReviewLoopCount,
              run.reviewLoopProgress.totalReviewLoopCount,
              nextReviewLoopLabel
            )}</dd>
          </div>
          <div>
            <dt>{copy.autoImplementation.currentStageGate}</dt>
            <dd>{inlineList(currentStageGateLabels, copy.autoImplementation.none)}</dd>
          </div>
        </dl>
      </article>
      {run.workerStageAdvanceBlockerLabel ? (
        <p className="research-recovery">
          {copy.autoImplementation.workerStageAdvanceBlocker}: {run.workerStageAdvanceBlockerLabel}
        </p>
      ) : null}
      {run.workerRuntimeReadiness ? (
        <article className="operations-card" aria-label={copy.autoImplementation.workerRuntimeReadiness}>
          <h3>{copy.autoImplementation.workerRuntimeReadiness}</h3>
          <dl className="readiness-grid">
            <div>
              <dt>{copy.autoImplementation.workerRuntimeStatus}</dt>
              <dd>{run.workerRuntimeReadiness.statusLabel}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.workerRuntimeExecutionMode}</dt>
              <dd>{run.workerRuntimeReadiness.executionModeLabel}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.workerRuntimeAccount}</dt>
              <dd>{run.workerRuntimeReadiness.accountLabel}</dd>
            </div>
            {run.workerRuntimeReadiness.checkedAtLabel ? (
              <div>
                <dt>{copy.autoImplementation.workerRuntimeCheckedAt}</dt>
                <dd>{run.workerRuntimeReadiness.checkedAtLabel}</dd>
              </div>
            ) : null}
            {run.workerRuntimeReadiness.adapterVersionLabel ? (
              <div>
                <dt>{copy.autoImplementation.workerRuntimeAdapterVersion}</dt>
                <dd>{run.workerRuntimeReadiness.adapterVersionLabel}</dd>
              </div>
            ) : null}
            {run.workerRuntimeReadiness.generatedSchemaVersionLabel ? (
              <div>
                <dt>{copy.autoImplementation.workerRuntimeGeneratedSchemaVersion}</dt>
                <dd>{run.workerRuntimeReadiness.generatedSchemaVersionLabel}</dd>
              </div>
            ) : null}
            {run.workerRuntimeReadiness.transportLabel ? (
              <div>
                <dt>{copy.autoImplementation.workerRuntimeTransport}</dt>
                <dd>{run.workerRuntimeReadiness.transportLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>{copy.autoImplementation.workerRuntimeLiveTurns}</dt>
              <dd>{workerRuntimeLiveTurns}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.workerRuntimeManualHandoff}</dt>
              <dd>{workerRuntimeManualHandoff}</dd>
            </div>
            {run.workerRuntimeReadiness.reasonLabel ? (
              <div>
                <dt>{copy.autoImplementation.workerRuntimeReason}</dt>
                <dd>{run.workerRuntimeReadiness.reasonLabel}</dd>
              </div>
            ) : null}
          </dl>
          <p className="mode-summary">
            {copy.autoImplementation.workerRuntimeNextAction}: {workerRuntimeNextAction}
          </p>
        </article>
      ) : null}
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !canCreateRun} onClick={onCreateRun}>
          {run.hasRun ? copy.autoImplementation.reprepare : copy.autoImplementation.create}
        </button>
        <button type="button" disabled={isBusy || !run.canPlanWorkerJob} onClick={onPlanWorkerJob}>
          {copy.autoImplementation.planWorkerJob}
        </button>
        <button type="button" disabled={isBusy || !run.canRecordStageTick} onClick={onRecordStageTick}>
          {copy.autoImplementation.recordStageTick}
        </button>
        <button type="button" disabled={isBusy || !run.canStartStage} onClick={onStartStage}>
          {copy.autoImplementation.startStage}
        </button>
        <button type="button" disabled={isBusy || !run.canPauseStage} onClick={onPauseStage}>
          {copy.autoImplementation.pauseStage}
        </button>
        <button type="button" disabled={isBusy || !run.canBlockStage} onClick={onBlockStage}>
          {copy.autoImplementation.blockStage}
        </button>
        <button type="button" disabled={isBusy || !run.canCompleteWorkerJob} onClick={onCompleteWorkerJob}>
          {copy.autoImplementation.completeWorkerJob}
        </button>
        <button type="button" disabled={isBusy || !run.canImportWorkerLedger} onClick={onImportWorkerLedger}>
          {copy.autoImplementation.importWorkerLedger}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canRecordGitHubIssueDryRun}
          onClick={onRecordGitHubIssueDryRun}
        >
          {copy.autoImplementation.recordGitHubIssueDryRun}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canApplyGitHubIssueCreation}
          onClick={onApplyGitHubIssueCreation}
        >
          {copy.autoImplementation.applyGitHubIssueCreation}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canRecordPullRequestDryRun}
          onClick={onRecordPullRequestOpenDryRun}
        >
          {copy.autoImplementation.recordPullRequestOpenDryRun}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canApplyPullRequestOpen}
          onClick={onApplyPullRequestOpen}
        >
          {copy.autoImplementation.applyPullRequestOpen}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canRecordPullRequestDryRun}
          onClick={onRecordPullRequestDryRun}
        >
          {copy.autoImplementation.recordPullRequestDryRun}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canRecordPullRequestDryRun}
          onClick={onRecordPullRequestMergeDryRun}
        >
          {copy.autoImplementation.recordPullRequestMergeDryRun}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canApplyPullRequestBodyUpdate}
          onClick={onApplyPullRequestBodyUpdate}
        >
          {copy.autoImplementation.applyPullRequestBodyUpdate}
        </button>
        <button
          type="button"
          disabled={isBusy || !run.canApplyPullRequestMerge}
          onClick={onApplyPullRequestMerge}
        >
          {copy.autoImplementation.applyPullRequestMerge}
        </button>
        <button type="button" disabled={isBusy || !run.canRunWorkerJob} onClick={onRunWorkerJob}>
          {copy.autoImplementation.runWorkerJob}
        </button>
        <button type="button" disabled={isBusy || !run.canAdvanceWorkerStage} onClick={onAdvanceWorkerStage}>
          {copy.autoImplementation.advanceWorkerStage}
        </button>
        <button type="button" disabled={isBusy} onClick={onRefreshRun}>
          {copy.autoImplementation.refresh}
        </button>
      </div>
      {run.latestWorkerJobId ? (
        <label className="answer-box">
          <span>{copy.autoImplementation.workerLedgerImport}</span>
          <textarea
            aria-label={copy.autoImplementation.workerLedgerImport}
            disabled={isBusy || !run.canImportWorkerLedger}
            onChange={(event) => onWorkerLedgerImportDraftChange(event.target.value)}
            placeholder={copy.autoImplementation.workerLedgerImportPlaceholder}
            value={workerLedgerImportDraft}
          />
        </label>
      ) : null}

      {run.latestWorkerPlan ? (
        <>
          <h3>{copy.autoImplementation.workerPlan}</h3>
          <article className="operations-card">
            <dl className="readiness-grid">
              <div>
                <dt>{copy.autoImplementation.workerPlanExecutionMode}</dt>
                <dd>{run.latestWorkerPlan.executionMode}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanWorkingDirectory}</dt>
                <dd>{run.latestWorkerPlan.workingDirectory}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanIssueDocument}</dt>
                <dd>{run.latestWorkerPlan.issueDocumentPath}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanExecutionAuthority}</dt>
                <dd>{run.latestWorkerPlan.executionAuthorityRef ?? copy.autoImplementation.missingExecutionAuthority}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanLedgerTrackerDoc}</dt>
                <dd>
                  {run.latestWorkerPlan.ledgerTrackerDoc.trackerId}: {run.latestWorkerPlan.ledgerTrackerDoc.title}
                </dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanLedgerStepDoc}</dt>
                <dd>
                  {run.latestWorkerPlan.ledgerStepDoc.stepId}: {run.latestWorkerPlan.ledgerStepDoc.title} ({run.latestWorkerPlan.ledgerStepDoc.expectedChangeScope})
                </dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanLedgerDocSourceRefs}</dt>
                <dd>{inlineList([
                  ...run.latestWorkerPlan.ledgerTrackerDoc.sourceRefs,
                  ...run.latestWorkerPlan.ledgerStepDoc.sourceRefs
                ], copy.autoImplementation.none)}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanAllowedWriteScope}</dt>
                <dd>{inlineList(run.latestWorkerPlan.allowedWriteScope, copy.autoImplementation.none)}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanRequiredEvidence}</dt>
                <dd>
                  <p className="mode-summary">
                    {copy.autoImplementation.workerPlanRequiredEvidenceHelp(run.latestWorkerPlan.stageLabel)}
                  </p>
                  <strong>{copy.autoImplementation.workerPlanBaseRequiredEvidence}</strong>
                  <RequiredEvidenceList
                    fallback={copy.autoImplementation.none}
                    items={run.latestWorkerPlan.baseRequiredEvidence}
                  />
                  <strong>{copy.autoImplementation.workerPlanStageRequiredEvidence}</strong>
                  <RequiredEvidenceList
                    fallback={copy.autoImplementation.none}
                    items={run.latestWorkerPlan.stageRequiredEvidence}
                  />
                </dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanForbiddenActions}</dt>
                <dd>{inlineList(run.latestWorkerPlan.forbiddenActions, copy.autoImplementation.none)}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanSourceRefs}</dt>
                <dd>{inlineList(run.latestWorkerPlan.sourceRefs, copy.autoImplementation.none)}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanBlocker}</dt>
                <dd>{run.latestWorkerPlan.blockedReason ?? copy.autoImplementation.notBlocked}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanMissingEvidence}</dt>
                <dd>{inlineList(run.latestWorkerPlan.missingEvidence, copy.autoImplementation.none)}</dd>
              </div>
              <div>
                <dt>{copy.autoImplementation.workerPlanEvidenceRefs}</dt>
                <dd>{inlineList(run.latestWorkerPlan.evidenceRefs, copy.autoImplementation.none)}</dd>
              </div>
            </dl>
          </article>
        </>
      ) : null}

      <h3>{copy.autoImplementation.stagePlan}</h3>
      {run.stages.length ? (
        <ol>
          {run.stages.map((stage) => (
            <li key={stage.stage}>
              {stage.label}: {stage.status}
              {stage.nextScheduledAt ? ` · ${stage.nextScheduledAt}` : ""}
              {stage.tickRecords.length ? ` · ticks ${stage.tickRecords.length}` : ""}
              {stage.ledgerEvidence ? ` · ledger ${stage.ledgerEvidence.implementationStepId}` : ""}
              {stage.blocker ? ` · blocked: ${stage.blocker.reason}` : ""}
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noStages}</p>
      )}

      <h3>{copy.autoImplementation.reviewProtocol}</h3>
      {run.deliveryGates.length ? (
        <ul>
          {run.deliveryGates.map((gate) => (
            <li key={gate}>{gate}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noReviewGates}</p>
      )}
      {run.stageReviewGates.length ? (
        <div className="auto-implementation-stage-gates">
          {run.stageReviewGates.map((stageGate) => (
            <article className="operations-card" key={stageGate.stage}>
              <strong>{copy.autoImplementation.stageLabels[stageGate.stage]}</strong>
              <ul>
                {copy.autoImplementation.stageGateLabels[stageGate.stage].map((gate) => (
                  <li key={gate}>{gate}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}

      <h3>{copy.autoImplementation.planningIssueFiles}</h3>
      {run.planningIssueFiles.length ? (
        <ul>
          {run.planningIssueFiles.map((path) => (
            <li key={path}>{path}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noPlanningIssueFiles}</p>
      )}

      <h3>{copy.autoImplementation.issueDocs}</h3>
      {run.issueRows.length ? (
        <ul>
          {run.issueRows.map((row) => (
            <li key={row.issue.issueId}>
              {row.issue.issueId}: {row.issue.title} — {copy.autoImplementation.issueRowStage}: {copy.autoImplementation.stageLabels[row.issue.stage]} / {copy.autoImplementation.issueRowStatus}: {row.issue.status} ({row.issue.relativePath})
              {" · "}
              {copy.autoImplementation.issueRowGithubIssue}: {row.githubIssueUrlLabel}
              {" · "}
              {copy.autoImplementation.issueRowLatestWorkerJob(row.latestWorkerJobId, row.latestWorkerJobStatus)}
              {" · "}
              {copy.autoImplementation.issueRowNextAction}: {row.nextActionLabel}
              {" · "}
              {copy.autoImplementation.issueRowStageGate}: {inlineList(
                copy.autoImplementation.stageGateLabels[row.issue.stage],
                row.stageGateLabel
              )}
              {" · "}
              {copy.autoImplementation.issueRowMissingEvidence}: {row.missingEvidenceLabel}
              {" · "}
              {copy.autoImplementation.issueRowEvidenceRefs}: {row.evidenceRefsLabel}
              {row.blockerLabel ? ` · ${row.blockerLabel}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noIssueDocs}</p>
      )}

      <h3>{copy.autoImplementation.githubIssueMutation}</h3>
      <p>{run.githubIssueMutationLabel}</p>
      {run.githubIssuePlans.length ? (
        <ul>
          {run.githubIssuePlans.map((issue) => (
            <li key={issue.issueId}>
              {issue.issueId}: {issue.title} ({issue.bodyMarkdownPath})
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noGithubIssuePlans}</p>
      )}
      {run.githubCreatedIssueUrls.length ? (
        <ul>
          {run.githubCreatedIssueUrls.map((url) => (
            <li key={url}>{url}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noGithubIssueUrls}</p>
      )}

      <h3>{copy.autoImplementation.githubPullRequestMutation}</h3>
      <p>{run.pullRequestMutationLabel}</p>
      <p className="mode-summary">{copy.autoImplementation.pullRequestMutationHistory(run.pullRequestMutationHistoryCount)}</p>
      {latestPullRequestMutation ? (
        <article className="operations-card">
          <dl className="readiness-grid">
            <div>
              <dt>{copy.autoImplementation.prMutationRequestMode}</dt>
              <dd>{latestPullRequestMutation.requestMode}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationMutatesGitHub}</dt>
              <dd>
                {latestPullRequestMutation.mutatesGitHub
                  ? copy.autoImplementation.yes
                  : copy.autoImplementation.no}
              </dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationPullRequest}</dt>
              <dd>{latestPullRequestMutation.pullRequestUrl ?? copy.autoImplementation.noPullRequestUrl}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationBlockedReason}</dt>
              <dd>{latestPullRequestMutation.blockedReason ?? copy.autoImplementation.notBlocked}</dd>
            </div>
          </dl>
          <p>{latestPullRequestMutation.implementationScope}</p>
          <p className="mode-summary">
            {copy.autoImplementation.prMutationRollbackNotes}: {latestPullRequestMutation.rollbackNotes}
          </p>
          <dl className="readiness-grid">
            <div>
              <dt>{copy.autoImplementation.prMutationIssueLinks}</dt>
              <dd>{inlineList(latestPullRequestMutation.issueLinks, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationReviewStreaks}</dt>
              <dd>{inlineList(latestPullRequestMutation.reviewStreakRefs, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationVerificationCommands}</dt>
              <dd>{inlineList(latestPullRequestMutation.verificationCommands, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationKnownGaps}</dt>
              <dd>{inlineList(latestPullRequestMutation.knownGaps, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationApprovalEvidence}</dt>
              <dd>
                {latestPullRequestMutation.approval
                  ? inlineList(latestPullRequestMutation.approval.evidenceRefs, copy.autoImplementation.none)
                  : copy.autoImplementation.none}
              </dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationApprovalRollback}</dt>
              <dd>{latestPullRequestMutation.approval?.rollbackPlan ?? copy.autoImplementation.none}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationBodyEvidence}</dt>
              <dd>{inlineList(latestPullRequestMutation.bodyEvidenceRefs, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationMergeEvidence}</dt>
              <dd>{inlineList(latestPullRequestMutation.mergeEvidenceRefs, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationVerifierEvidence}</dt>
              <dd>{inlineList(latestPullRequestMutation.verifierEvidenceRefs, copy.autoImplementation.none)}</dd>
            </div>
            <div>
              <dt>{copy.autoImplementation.prMutationAuditEvidence}</dt>
              <dd>{inlineList(latestPullRequestMutation.auditEvidenceRefs, copy.autoImplementation.none)}</dd>
            </div>
          </dl>
        </article>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noGithubPullRequestMutations}</p>
      )}

      <h3>{copy.autoImplementation.remoteGuide}</h3>
      <p>{run.remoteNextAction}</p>
      {run.remoteWarning ? <p className="research-recovery">{run.remoteWarning}</p> : null}
      {run.remoteCommands.length ? (
        <ul>
          {run.remoteCommands.map((command) => (
            <li key={command}><code>{command}</code></li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noRemoteCommands}</p>
      )}

      <h3>{copy.autoImplementation.evidenceRefs}</h3>
      {run.evidenceRefs.length ? (
        <ul>
          {run.evidenceRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noEvidenceRefs}</p>
      )}
    </section>
  );
}
