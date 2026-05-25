import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  automaticRunStartPolicyForResearchAllowlist,
  BACKGROUND_RESEARCH_ADAPTER_KINDS,
  buildResearchRunIdempotencyKey,
  canCreateManualResearchRunRetry,
  CONTRACT_SCHEMA_VERSION,
  CODEX_RUNTIME_ADAPTER_VERSION,
  DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY,
  DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
  DEFAULT_RESEARCH_STALENESS_POLICY,
  isExecutionAuthorityIsoTimestamp,
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  ResearchAllowlistValidationError,
  ResearchRunValidationError,
  assertSafeResearchConnectorId,
  AUTO_IMPLEMENTATION_WORKER_EXECUTION_MODE,
  AUTO_IMPLEMENTATION_SCHEMA_VERSION,
  AUTO_IMPLEMENTATION_STAGES,
  AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX,
  AUTO_IMPLEMENTATION_TICK_INTERVAL_MS,
  AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
  AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE,
  AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS,
  AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY,
  IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK,
  canCompleteAutoImplementationWorkerJob,
  canCreateAutoImplementationGitHubIssues,
  canImportAutoImplementationWorkerLedger,
  canMergeAutoImplementationPullRequest,
  canOpenNewAutoImplementationPullRequest,
  canPlanCurrentStageAutoImplementationWorkerJob,
  canRunAutoImplementationWorkerJob,
  hasAppliedAutoImplementationPullRequestMerge,
  autoImplementationFinalPrBodyEvidenceRefs,
  autoImplementationPlanningIssueEvidenceRefs,
  autoImplementationPlanningIssueFiles,
  autoImplementationGitHubIssueUrlForIssue,
  autoImplementationRunWithSynchronizedIssueDocs,
  autoImplementationWorkerExpectedChangeScope,
  autoImplementationWorkerLedgerStepDescription,
  autoImplementationWorkerRequiredEvidence,
  validateAutoImplementationRunProjection,
  ImplementationStepLedgerValidationError,
  validateImplementationStepLedgerProjection,
  isTerminalResearchRunStatus,
  type ApiErrorCode,
  type AutoImplementationStage,
  type AutoImplementationStageLedgerEvidence,
  type AutoImplementationStageRecord,
  type AutoImplementationStageStatus,
  type AutoImplementationRun,
  type AutoImplementationRunStatus,
  type AutoImplementationRunProjection,
  type AutoImplementationPullRequestMutationRecord,
  type AutoImplementationPlanningIssueDocument,
  type AutoImplementationWorkerJob,
  type AdvanceAutoImplementationWorkerStageRequest,
  type CompleteAutoImplementationWorkerJobRequest,
  type CreateAutoImplementationRunRequest,
  type CreateAutoImplementationWorkerJobRequest,
  type ImportAutoImplementationWorkerLedgerRequest,
  type RunAutoImplementationWorkerJobRequest,
  type RecordAutoImplementationPullRequestMutationRequest,
  type RecordImplementationStepLedgerPayload,
  type AutomaticResearchSourceCategory,
  type BlockedActionType,
  type CommandId,
  type CommandActor,
  type CommandResponse,
  type CommandResponseCategory,
  type CancelResearchRunRequest,
  type CreateResearchAllowlistRequest,
  type CorrelationId,
  type CausationId,
  type BrowserActionExecutionResult,
  type BrowserActionPreviewDto,
  type BrowserActionTargetDto,
  type ChatGptBrowserDelegationProjection,
  type CodexTurnPurpose,
  type CodexRuntimeSource,
  type ConfidenceCompletionProjection,
  type DecisionQueueProjection,
  type DecisionEvidencePackProjection,
  type EffectTaskDto,
  type EffectTaskId,
  type EventId,
  type ExecuteBrowserActionRequest,
  type ExecuteFileDiffRequest,
  type ExecuteShellCommandRequest,
  type ExecutionAuthorityBlockCode,
  type ExecutionAuthorityBlockReasonDto,
  type ExecutionAuthorityLedgerProjection,
  type ExecutionAuthorityPreflightResult,
  type ExecutionAuthorityRecord,
  type ImplementationStepDoc,
  type ImplementationStepRecord,
  type ImplementationStepLedgerProjection,
  type FileDiffChangedFileDto,
  type FileDiffExecutionResult,
  type FileDiffStatsDto,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type PendingEffectSummaryDto,
  type Phase15bUpgradeHintExportDto,
  type Phase15bUpgradeHintProjection,
  type Phase25ResearchComparisonProjection,
  type PlanningHandoffArtifactDto,
  type PlanningHandoffProjection,
  type PrepareResearchDisclosureRequest,
  type ProjectApplicationCommandType,
  type ProductEngineCommand,
  type ProductEngineCommandType,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineReduction,
  type ProductEngineStateSnapshot,
  type ProjectionRefetchHint,
  type ProjectId,
  type ProjectionVersion,
  type PublicSafeResearchDisclosurePayload,
  type ResearchAllowlistGovernanceProjection,
  type ResearchAllowlistId,
  type ResearchAllowlistProjection,
  type ResearchRunControlProjection,
  type ResearchRunControlResult,
  type ResearchRunId,
  type ResearchRunProjection,
  type ResearchRunStatusDto,
  type ResearchRunTerminalReason,
  type ResearchDisclosureBlockReason,
  type ResearchDisclosureLogEntry,
  type ResearchDisclosureLogId,
  type ResearchDisclosureLogProjection,
  type ResearchDisclosurePreparationResult,
  type ResearchEvidenceProjection,
  type ResearchResultId,
  type ResearchSourceCategory,
  type ResearchTaskId,
  type RuntimeActivityProjection,
  type ServicePageUsePermissionProjection,
  type RuntimePreviewArtifact,
  type SchemaVersion,
  type SessionId,
  type SessionShellProjection,
  type TrackerDoc,
  type ShellCommandExecutionResult,
  type ShellCommandRunSummaryDto,
  type StartResearchRunRequest,
  type StartProjectRequest,
  type StateVersion,
  type StatusEndpointDto,
  type RetryResearchRunRequest,
  type RecordAutoImplementationStageRequest,
  type UpdateResearchAllowlistRequest,
  type ValidateExecutionAuthorityPreflightRequest
} from "@solo-superman/contracts";
import {
  createEffectTaskRepository,
  createEventRepository,
  createExecutionAuthorityRepository,
  createPhase25ResearchComparisonRepository,
  createPlanningHandoffRepository,
  createProjectRepository,
  createProjectionRepository,
  createResearchAllowlistRepository,
  createResearchDisclosureLogRepository,
  createPhase15bUpgradeHintRepository,
  createResearchRunRepository,
  createResearchRepository,
  createRuntimeRepository,
  type EffectTaskRecord,
  type PersistedProjection,
  type SoloStorage
} from "@solo-superman/db";
import {
  createInitialProductEngineState,
  decisionQueueProjectionWithRecovery,
  projectPurposeModeEffect,
  projectPurposeModeSelectionStatus,
  reduceProductEngineCommand,
  replayProductEngineEvents,
  sessionPhaseForProductEngineEvent,
  sessionShellPhaseForProductEnginePhase,
  createFakeReadOnlyResearchAdapter,
  buildPublicSafeResearchSummary,
  containsPrivateResearchContext,
  redactPublicSafeResearchText,
  type BackgroundResearchAdapterResult,
  type BackgroundResearchRuntimeAdapter
} from "@solo-superman/core";
import {
  CodexRuntimeUnavailableError,
  assertCodexPreviewOutputMatchesInput,
  assertCodexWorkerExecutionOutputMatchesInput,
  createCodexRuntimeAdapter,
  fixtureCodexPreviewOutput,
  validateCodexWorkerExecutionOutput,
  type CodexRuntimeAdapter,
  type CodexRuntimePreviewInput,
  type CodexWorkerExecutionOutputEnvelope
} from "../runtime";
import {
  browserActionTargetFromUrl,
  hashBrowserActionPreview,
  runBrowserAction
} from "./browser-action-adapter";
import { applyFileDiff } from "./file-diff-adapter";
import { buildPhase15bHintExport, buildPhase15bHintProjection } from "./phase15b-hint-projection";
import { runShellCommand } from "./shell-command-adapter";
import {
  isResearchMemoryMarkdownSourceRef,
  listResearchMemoryMarkdownSourceRefs,
  writeResearchMemoryMarkdown
} from "./research-memory-markdown";
import {
  createWebSearchReadOnlyResearchAdapter,
  webSearchReadOnlyResearchAdapterOptionsFromEnv,
  webSearchReadOnlyAdapterFailureMessage
} from "./web-search-readonly-adapter";
import {
  DEFAULT_AUTO_IMPLEMENTATION_PROJECT_FOLDER_NAME,
  autoImplementationRunId,
  defaultAutoImplementationWorkspaceRoot,
  ghAutoImplementationPullRequestMutationAdapter,
  prepareAutoImplementationWorkspaceRun,
  sanitizeProjectFolderName,
  writeAutoImplementationIssueDocumentsState,
  writeAutoImplementationPlanningIssueSequenceTrackerState,
  writeAutoImplementationRunManifest,
  writeAutoImplementationRunTrackerState,
  type AutoImplementationGitHubIssueMutationAdapter,
  type AutoImplementationPullRequestMutationAdapter,
  type AutoImplementationRemoteStatusProvider
} from "./auto-implementation-workspace";

export class ProductEngineServiceError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: ApiErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.code = code;

    if (details) {
      this.details = details;
    }
  }
}

const LOCAL_FAKE_PROVIDER_RESULT_DELAY_MILLIS = 30_000;
const MOUNTED_RESEARCH_ADAPTER_KINDS = ["local_fake_readonly", "web_search_readonly"] as const;
type MountedResearchAdapterKind = (typeof MOUNTED_RESEARCH_ADAPTER_KINDS)[number];

function sessionProjectPurposeModeFields(project: ProductEngineStateSnapshot["project"]) {
  return {
    ...(project.projectPurposeMode ? { projectPurposeMode: project.projectPurposeMode } : {}),
    projectPurposeModeSelectionStatus:
      project.projectPurposeModeSelectionStatus ?? projectPurposeModeSelectionStatus(project.projectPurposeMode),
    projectPurposeModeLabel: project.projectPurposeModeLabel,
    projectPurposeModeEffect: projectPurposeModeEffect(project.projectPurposeMode),
    ...(project.businessCriticIntensity ? { businessCriticIntensity: project.businessCriticIntensity } : {}),
    ...(project.businessCriticIntensitySelectionStatus
      ? { businessCriticIntensitySelectionStatus: project.businessCriticIntensitySelectionStatus }
      : {}),
    ...(project.businessCriticIntensityLabel ? { businessCriticIntensityLabel: project.businessCriticIntensityLabel } : {}),
    ...(project.businessCriticIntensityEffect ? { businessCriticIntensityEffect: project.businessCriticIntensityEffect } : {})
  };
}

export interface RunSessionCommandInput {
  readonly sessionId: SessionId;
  readonly commandType: Extract<
    ProductEngineCommandType,
    | "CaptureIntake"
    | "ChangeProjectPurposeMode"
    | "ChangeBusinessCriticIntensity"
    | "DraftInitialSpec"
    | "AnalyzeAmbiguity"
    | "ActivateQuestionBatch"
    | "SubmitAnswer"
    | "DeferQueueItem"
    | "DismissQueueItem"
    | "PlanResearch"
    | "ImportResearchResult"
    | "SynthesizeEvidence"
    | "ResolveResearchQueueCard"
    | "CreateRuntimePreview"
    | "ConvertRuntimeArtifact"
    | "CreateSpecUpdatePreview"
    | "ResolveDecision"
    | "CreateSpecVersion"
    | "ScoreCompleteness"
    | "PrepareFounderBrief"
    | "CreatePlanningHandoff"
    | "CreatePhase25ResearchComparison"
    | "CreateExecutionAuthority"
    | "CreateChatGptBrowserDelegationRun"
    | "RevokeChatGptBrowserDelegationRun"
    | "CreateServicePageUsePermission"
    | "RevokeServicePageUsePermission"
    | "DeleteServicePageUsePermissionArtifacts"
    | "RecordImplementationStepLedger"
  >;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ValidateExecutionAuthorityPreflightInput extends ValidateExecutionAuthorityPreflightRequest {
  readonly authorityRecordId: string;
}

export interface ExecuteFileDiffInput extends ExecuteFileDiffRequest {
  readonly authorityRecordId: string;
}

export interface ExecuteShellCommandInput extends ExecuteShellCommandRequest {
  readonly authorityRecordId: string;
}

export interface ExecuteBrowserActionInput extends ExecuteBrowserActionRequest {
  readonly authorityRecordId: string;
}

function rawIdeaIdempotencyHash(rawIdea: string) {
  return `sha256:${createHash("sha256").update(rawIdea.trim()).digest("hex").slice(0, 32)}`;
}

export interface RunResearchAllowlistGovernanceInput<TRequest> {
  readonly projectId: ProjectId;
  readonly request: TRequest;
}

export interface RunResearchAllowlistLifecycleInput {
  readonly projectId: ProjectId;
  readonly allowlistId: ResearchAllowlistId;
  readonly reason?: string;
}

export interface RunResearchDisclosureInput {
  readonly projectId: ProjectId;
  readonly request: PrepareResearchDisclosureRequest;
}

export interface RunResearchRunStartInput {
  readonly projectId: ProjectId;
  readonly request: StartResearchRunRequest;
}

export interface RunResearchRunStatusInput {
  readonly projectId: ProjectId;
  readonly researchRunId: ResearchRunId;
}

export interface RunResearchRunCancelInput {
  readonly projectId: ProjectId;
  readonly researchRunId: ResearchRunId;
  readonly request: CancelResearchRunRequest;
}

export interface RunResearchRunRetryInput {
  readonly projectId: ProjectId;
  readonly researchRunId: ResearchRunId;
  readonly request: RetryResearchRunRequest;
}

function prefixedId<TId extends string>(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}` as TId;
}

function commandId() {
  return prefixedId<CommandId>("cmd");
}

function correlationId() {
  return prefixedId<CorrelationId>("corr");
}

function eventId() {
  return prefixedId<EventId>("evt");
}

function effectTaskId() {
  return prefixedId<EffectTaskId>("eft");
}

function projectId() {
  return prefixedId<ProjectId>("proj");
}

function sessionId() {
  return prefixedId<SessionId>("sess");
}

function researchAllowlistId() {
  return prefixedId<ResearchAllowlistId>("research_allowlist");
}

const RESEARCH_MEMORY_BASELINE_OBJECTIVE_PATTERN = new RegExp(
  [
    "Broaden research beyond existing notes",
    "existing research memory",
    "existing notes",
    String.raw`기존\s*(?:리서치|자료|메모|근거)`,
    String.raw`더\s*(?:넓은|깊은|추가)\s*(?:리서치|자료|근거|출처)`
  ].join("|"),
  "iu"
);

function researchDisclosureLogId() {
  return prefixedId<ResearchDisclosureLogId>("research_disclosure");
}

function zeroPendingEffectSummary(): PendingEffectSummaryDto {
  return {
    totalPending: 0,
    byType: {},
    visibleLabel: "No async ProductEngine effects are pending for this allowlist governance action."
  };
}

function allowlistRefetchUrl(projectIdValue: ProjectId) {
  return `/api/v1/projects/${projectIdValue}/research-allowlists`;
}

function allowlistProjectionHint(projectIdValue: ProjectId): ProjectionRefetchHint {
  return {
    projectionKind: "ResearchAllowlistProjection",
    refetchUrl: allowlistRefetchUrl(projectIdValue)
  };
}

function allowlistCollectionVersion(allowlists: readonly ResearchAllowlistProjection[]): ProjectionVersion {
  return allowlists.reduce(
    (collectionVersion, allowlist) => collectionVersion + Number(allowlist.version),
    0
  ) as ProjectionVersion;
}

function allowlistGovernanceProjection(
  projectIdValue: ProjectId,
  allowlists: readonly ResearchAllowlistProjection[],
  generatedAt: string,
  selectedAllowlist?: ResearchAllowlistProjection
): ResearchAllowlistGovernanceProjection {
  return {
    kind: "ResearchAllowlistGovernanceProjection",
    projectionKind: "ResearchAllowlistProjection",
    projectId: projectIdValue,
    version: allowlistCollectionVersion(allowlists),
    generatedAt,
    stale: false,
    refetchUrl: allowlistRefetchUrl(projectIdValue),
    pendingEffectSummary: zeroPendingEffectSummary(),
    allowlists,
    ...(selectedAllowlist ? { selectedAllowlist } : {}),
    automaticRunStartPolicies: allowlists.map(automaticRunStartPolicyForResearchAllowlist)
  };
}

function allowlistCommandResponse(
  commandType: ProjectApplicationCommandType,
  projectIdValue: ProjectId,
  stateVersionBefore: StateVersion,
  projection: ResearchAllowlistGovernanceProjection,
  governanceReason?: string
): CommandResponse<ResearchAllowlistGovernanceProjection> {
  const hint = allowlistProjectionHint(projectIdValue);

  return {
    category: "accepted_with_projection",
    commandId: commandId(),
    correlationId: correlationId(),
    stateVersionBefore,
    stateVersionAfter: projection.version as unknown as StateVersion,
    eventIds: [],
    effectTaskIds: [],
    immediateProjection: projection,
    pendingEffectSummary: zeroPendingEffectSummary(),
    projectionHints: [hint],
    deterministicOutputs: [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `${commandType}:${projectIdValue}:${projection.version}`,
        payload: {
          commandType,
          projectId: projectIdValue,
          refetchUrl: hint.refetchUrl,
          projectionKind: hint.projectionKind,
          productEngineReducerSideEffects: false,
          ...(governanceReason ? { governanceReason } : {})
        }
      }
    ]
  };
}

function disclosureRefetchUrl(projectIdValue: ProjectId) {
  return `/api/v1/projects/${projectIdValue}/research-disclosures`;
}

function disclosureProjectionHint(projectIdValue: ProjectId): ProjectionRefetchHint {
  return {
    projectionKind: "ResearchDisclosureLogProjection",
    refetchUrl: disclosureRefetchUrl(projectIdValue)
  };
}

function disclosureCollectionVersion(logs: readonly ResearchDisclosureLogEntry[]): ProjectionVersion {
  return logs.length as ProjectionVersion;
}

function disclosureProjection(
  projectIdValue: ProjectId,
  logs: readonly ResearchDisclosureLogEntry[],
  generatedAt: string,
  latestDisclosureLog?: ResearchDisclosureLogEntry
): ResearchDisclosureLogProjection {
  return {
    kind: "ResearchDisclosureLogProjection",
    version: disclosureCollectionVersion(logs),
    projectId: projectIdValue,
    generatedAt,
    stale: false,
    refetchUrl: disclosureRefetchUrl(projectIdValue),
    disclosureLogs: logs,
    ...(latestDisclosureLog ? { latestDisclosureLog } : {})
  };
}

function disclosureCommandResponse(
  stateVersionBefore: StateVersion,
  result: ResearchDisclosurePreparationResult
): CommandResponse<ResearchDisclosurePreparationResult> {
  const hint = disclosureProjectionHint(result.disclosureLog.projectId);
  const blocked = result.status === "blocked_manual_handoff";

  return {
    category: blocked ? "blocked" : "accepted_with_projection",
    commandId: commandId(),
    correlationId: correlationId(),
    stateVersionBefore,
    stateVersionAfter: result.projection.version as unknown as StateVersion,
    eventIds: [],
    effectTaskIds: [],
    immediateProjection: result,
    pendingEffectSummary: zeroPendingEffectSummary(),
    projectionHints: [hint],
    ...(blocked
      ? {
          blockingCard: {
            title: "Automatic research disclosure blocked",
            reason: result.manualHandoff?.reason,
            userAction: "task_level_approval_or_manual_handoff"
          }
        }
      : {}),
    deterministicOutputs: [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `PrepareResearchDisclosure:${result.disclosureLog.projectId}:${result.disclosureLog.logId}`,
        payload: {
          commandType: "PrepareResearchDisclosure",
          projectId: result.disclosureLog.projectId,
          refetchUrl: hint.refetchUrl,
          projectionKind: hint.projectionKind,
          publicSafePayload: result.publicSafePayload,
          disclosureLogId: result.disclosureLog.logId,
          disclosureStatus: result.status,
          productEngineReducerSideEffects: false,
          providerExecution: false,
          externalTransferPerformed: false,
          ...(result.manualHandoff ? { manualHandoff: result.manualHandoff } : {})
        }
      }
    ]
  };
}

function addMilliseconds(isoDate: string, durationMs: number) {
  return new Date(Date.parse(isoDate) + durationMs).toISOString();
}

function uniqueAutoImplementationRefs(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function autoImplementationStageActionRef(request: RecordAutoImplementationStageRequest) {
  return `auto-stage-action:${request.runId}:${request.stage}:${request.action}:${request.idempotencyKey}`;
}

function autoImplementationStageStatusForAction(
  action: RecordAutoImplementationStageRequest["action"],
  currentStatus: AutoImplementationStageStatus
): AutoImplementationStageStatus {
  switch (action) {
    case "start":
      return "running";
    case "pause":
      return "paused";
    case "block":
      return "blocked";
    case "complete":
      return "completed";
    case "tick":
      return currentStatus;
  }
}

function autoImplementationRunStatusForAction(
  action: RecordAutoImplementationStageRequest["action"],
  isFinalStageComplete: boolean,
  currentStatus: AutoImplementationRunStatus
): AutoImplementationRunStatus {
  if (isFinalStageComplete) {
    return "completed";
  }

  switch (action) {
    case "start":
    case "complete":
      return "running";
    case "pause":
      return "paused";
    case "block":
      return "blocked";
    case "tick":
      return currentStatus;
  }
}

const AUTO_IMPLEMENTATION_RUN_SOURCE_PREFIX = "auto-implementation-run:";

function autoImplementationRunSourceRunId(sourcePlanningRef: string | undefined) {
  return sourcePlanningRef?.startsWith(AUTO_IMPLEMENTATION_RUN_SOURCE_PREFIX)
    ? sourcePlanningRef.slice(AUTO_IMPLEMENTATION_RUN_SOURCE_PREFIX.length)
    : null;
}

async function autoImplementationRequestWithValidatedSource(
  request: CreateAutoImplementationRunRequest,
  existingProjection: AutoImplementationRunProjection | null,
  planningHandoffRepository: ReturnType<typeof createPlanningHandoffRepository>
): Promise<{
  readonly request: CreateAutoImplementationRunRequest;
  readonly planningHandoffArtifact?: PlanningHandoffArtifactDto;
}> {
  const sourceRunId = autoImplementationRunSourceRunId(request.sourcePlanningRef);

  if (sourceRunId !== null) {
    if (!sourceRunId || !existingProjection?.runs.some((run) => run.runId === sourceRunId)) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Auto implementation run-derived requests require an existing source run.",
        {
          sourcePlanningRef: request.sourcePlanningRef,
          sourceRunId,
          sessionId: request.sessionId
        }
      );
    }

    return { request };
  }

  const planningHandoff = await planningHandoffRepository.getLatestForSession(request.sessionId);

  if (planningHandoff?.currentStatus !== "planning_ready") {
    throw new ProductEngineServiceError(
      "COMMAND_PRECONDITION_FAILED",
      "Auto implementation workspace creation requires a planning_ready Planning Handoff.",
      {
        sessionId: request.sessionId,
        currentPlanningHandoffStatus: planningHandoff?.currentStatus ?? "missing",
        requiredStatus: "planning_ready"
      }
    );
  }

  const requiredSourcePlanningRef = planningHandoff.finalArtifact.artifactId;

  if (request.sourcePlanningRef && request.sourcePlanningRef !== requiredSourcePlanningRef) {
    throw new ProductEngineServiceError(
      "COMMAND_PRECONDITION_FAILED",
      "Auto implementation workspace sourcePlanningRef must match the latest planning_ready final artifact.",
      {
        sessionId: request.sessionId,
        sourcePlanningRef: request.sourcePlanningRef,
        requiredSourcePlanningRef
      }
    );
  }

  return {
    request: {
      ...request,
      sourcePlanningRef: requiredSourcePlanningRef
    },
    planningHandoffArtifact: planningHandoff.finalArtifact
  };
}

function validatedLedgerForAutoImplementationStage(
  ledger: ImplementationStepLedgerProjection | null
): ImplementationStepLedgerProjection | null {
  if (!ledger) {
    return null;
  }

  try {
    return validateImplementationStepLedgerProjection(ledger);
  } catch (error) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation stage completion requires a valid ImplementationStepLedger projection.",
      {
        issues: error instanceof ImplementationStepLedgerValidationError
          ? error.issues
          : [error instanceof Error ? error.message : String(error)]
      }
    );
  }
}

function completedLedgerStepForAutoImplementationStage(
  ledger: ImplementationStepLedgerProjection | null,
  implementationStepId: string | undefined,
  stage: AutoImplementationStage
): ImplementationStepRecord {
  if (!ledger) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation stage completion requires an ImplementationStepLedger projection."
    );
  }

  if (!implementationStepId) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "implementationStepId is required when completing an auto implementation stage."
    );
  }

  const step = [...ledger.steps].reverse().find((candidate) => candidate.stepDoc.stepId === implementationStepId);

  if (!step || step.status !== "completed" || step.missingEvidence.length > 0 || step.blocker) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation stage completion requires a completed ImplementationStepLedger step without blockers."
    );
  }

  const missingEvidence: string[] = [];

  if (!step.stepCommitRecord && !step.noCodeStepEvidence) {
    missingEvidence.push("StepCommitRecord or NoCodeStepEvidence");
  }
  if (!step.codeReviewStreaks.every((streak) => streak.satisfied)) {
    missingEvidence.push("two consecutive no-finding code-review passes for feature and repository scopes");
  }
  if (!step.cleanCodeReviewStreaks.every((streak) => streak.satisfied)) {
    missingEvidence.push("two consecutive no-finding clean-code-review passes for changed_code and repository scopes");
  }
  if (!step.testEvidenceRecord || step.testEvidenceRecord.outcome !== "passed" || step.testEvidenceRecord.failedTestCount !== 0 || step.testEvidenceRecord.notTestedGaps.length > 0) {
    missingEvidence.push("passing TestEvidenceRecord without failed tests or Not-tested gaps");
  }
  if (!step.missingTestAuditRecord || step.missingTestAuditRecord.missingTestGaps.length > 0) {
    missingEvidence.push("MissingTestAuditRecord without missing targeted-test gaps");
  }
  if (
    stage === "merge_main" &&
    !step.testEvidenceRecord?.evidenceRefs.some((ref) =>
      ref.startsWith(AUTO_IMPLEMENTATION_POST_MERGE_VERIFY_EVIDENCE_PREFIX)
    )
  ) {
    missingEvidence.push("post-merge verification evidence ref for merge_main");
  }

  if (missingEvidence.length) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation stage completion requires complete ledger evidence.",
      { missingEvidence }
    );
  }

  return step;
}

function assertAutoImplementationStageCompletionDoesNotPrecedeScheduledTick(
  stage: AutoImplementationStageRecord,
  recordedAt: string
) {
  if (stage.tickRecords.length === 0) {
    return;
  }

  if (!stage.nextScheduledAt) {
    return;
  }

  const recordedAtMs = Date.parse(recordedAt);
  const nextScheduledAtMs = Date.parse(stage.nextScheduledAt);

  if (!Number.isNaN(recordedAtMs) && !Number.isNaN(nextScheduledAtMs) && recordedAtMs < nextScheduledAtMs) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation stage completion cannot happen before the current 5-minute tick is due.",
      {
        stage: stage.stage,
        recordedAt,
        nextScheduledAt: stage.nextScheduledAt
      }
    );
  }
}

function assertMergeMainCompletionHasAppliedPullRequestMerge(
  run: AutoImplementationRun,
  request: RecordAutoImplementationStageRequest
) {
  if (
    request.action === "complete" &&
    request.stage === "merge_main" &&
    !hasAppliedAutoImplementationPullRequestMerge(run)
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation merge_main completion requires an applied GitHub PR merge mutation record."
    );
  }
}

function autoImplementationStageLedgerEvidence(
  ledger: ImplementationStepLedgerProjection,
  step: ImplementationStepRecord
): AutoImplementationStageLedgerEvidence {
  const implementationEvidenceRefs = step.stepCommitRecord?.evidenceRefs ??
    step.noCodeStepEvidence?.commandEvidenceRefs ??
    [];
  const codeReviewStreakRefs = step.codeReviewStreaks.flatMap((streak) =>
    streak.latestReviewIds.map((reviewId) => `code-review:${streak.reviewScope}:${reviewId}`)
  );
  const cleanCodeReviewStreakRefs = step.cleanCodeReviewStreaks.flatMap((streak) =>
    streak.latestReviewIds.map((reviewId) => `clean-code-review:${streak.reviewScope}:${reviewId}`)
  );
  const missingTestAuditRefs = [
    ...(step.missingTestAuditRecord?.evidenceRefs ?? []),
    ...(step.missingTestAuditRecord?.coverageEvidenceRefs ?? [])
  ];
  const testEvidenceRefs = step.testEvidenceRecord?.evidenceRefs ?? [];
  const blockerEvidenceRefs = ledger.blockedSteps
    .filter((blocker) => blocker.stepId === step.stepDoc.stepId)
    .flatMap((blocker) => blocker.evidenceRefs);

  return {
    implementationStepId: step.stepDoc.stepId,
    trackerDocRef: `implementation-step-ledger:tracker:${ledger.trackerDoc.trackerId}`,
    stepDocRef: `implementation-step-ledger:step:${step.stepDoc.stepId}`,
    implementationEvidenceRefs,
    codeReviewStreakRefs,
    cleanCodeReviewStreakRefs,
    codeReviewStreaks: step.codeReviewStreaks.map((streak) => ({
      reviewScope: streak.reviewScope,
      requiredNoFindingPasses: streak.requiredNoFindingPasses,
      currentNoFindingPasses: streak.currentNoFindingPasses,
      satisfied: streak.satisfied,
      latestReviewIds: streak.latestReviewIds,
      missingEvidenceLabel: streak.missingEvidenceLabel
    })),
    cleanCodeReviewStreaks: step.cleanCodeReviewStreaks.map((streak) => ({
      reviewScope: streak.reviewScope,
      requiredNoFindingPasses: streak.requiredNoFindingPasses,
      currentNoFindingPasses: streak.currentNoFindingPasses,
      satisfied: streak.satisfied,
      latestReviewIds: streak.latestReviewIds,
      missingEvidenceLabel: streak.missingEvidenceLabel
    })),
    ...(step.missingTestAuditRecord
      ? {
          missingTestAuditSummary: {
            auditId: step.missingTestAuditRecord.auditId,
            missingTestGapCount: step.missingTestAuditRecord.missingTestGaps.length,
            satisfied: step.missingTestAuditRecord.missingTestGaps.length === 0
          }
        }
      : {}),
    ...(step.testEvidenceRecord
      ? {
          testEvidenceSummary: {
            testEvidenceId: step.testEvidenceRecord.testEvidenceId,
            outcome: step.testEvidenceRecord.outcome,
            passedTestCount: step.testEvidenceRecord.passedTestCount,
            failedTestCount: step.testEvidenceRecord.failedTestCount,
            notTestedGapCount: step.testEvidenceRecord.notTestedGaps.length,
            satisfied: step.testEvidenceRecord.outcome === "passed" &&
              step.testEvidenceRecord.failedTestCount === 0 &&
              step.testEvidenceRecord.notTestedGaps.length === 0,
            commands: step.testEvidenceRecord.commands
          }
        }
      : {}),
    missingTestAuditRefs,
    testEvidenceRefs,
    blockerEvidenceRefs,
    evidenceRefs: uniqueAutoImplementationRefs([
      `implementation-step-ledger:${step.stepDoc.stepId}`,
      ...step.evidenceRefs,
      ...implementationEvidenceRefs,
      ...codeReviewStreakRefs,
      ...cleanCodeReviewStreakRefs,
      ...missingTestAuditRefs,
      ...testEvidenceRefs,
      ...blockerEvidenceRefs
    ])
  };
}

function autoImplementationWorkerJobId(request: CreateAutoImplementationWorkerJobRequest, stage: AutoImplementationRun["currentStage"]) {
  return `auto-worker-job:${request.runId}:${stage}:${request.idempotencyKey}`;
}

function assertAutoImplementationWorkerExecutionAuthorityRef(executionAuthorityRef: string | undefined) {
  if (executionAuthorityRef && !executionAuthorityRef.startsWith("exec_auth_")) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "executionAuthorityRef must reference an ExecutionAuthorityRecord id.",
      { expectedPrefix: "exec_auth_" }
    );
  }
}

function autoImplementationWorkerCompletionRef(request: CompleteAutoImplementationWorkerJobRequest) {
  return `auto-worker-job-complete:${request.jobId}:${request.idempotencyKey}`;
}

function autoImplementationWorkerLedgerImportRef(request: ImportAutoImplementationWorkerLedgerRequest) {
  return `auto-worker-ledger-import:${request.jobId}:${request.idempotencyKey}`;
}

function autoImplementationWorkerRunRef(request: RunAutoImplementationWorkerJobRequest) {
  return `auto-worker-run:${request.jobId}:${request.idempotencyKey}`;
}

function autoImplementationWorkerStageAdvanceRef(request: AdvanceAutoImplementationWorkerStageRequest) {
  return `auto-worker-stage-advance:${request.jobId}:${request.idempotencyKey}`;
}

function autoImplementationPullRequestMutationId(request: RecordAutoImplementationPullRequestMutationRequest) {
  return `auto-pr-mutation:${request.runId}:${request.action}:${request.idempotencyKey}`;
}

function autoImplementationPullRequestMutationRef(request: RecordAutoImplementationPullRequestMutationRequest) {
  return `auto-pr-mutation:${request.action}:${request.idempotencyKey}`;
}

function isGitHubPullRequestUrl(value: string) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/[1-9]\d*\/?$/iu.test(value.trim());
}

function finalVerifyStageCompleted(run: AutoImplementationRun) {
  return run.stagePlan.some((stage) =>
    stage.stage === "final_verify_pr_update" &&
    stage.status === "completed" &&
    stage.ledgerEvidence !== null
  );
}

function hasFinalVerificationPrBodyEvidence(run: AutoImplementationRun, bodyEvidenceRefs: readonly string[]) {
  const acceptedRefs = autoImplementationFinalPrBodyEvidenceRefs(run.runId);

  return acceptedRefs.some((ref) => bodyEvidenceRefs.includes(ref));
}

function initialImplementationStageCompleted(run: AutoImplementationRun) {
  return run.stagePlan.some((stage) =>
    stage.stage === "initial_pr" &&
    stage.status === "completed" &&
    stage.ledgerEvidence !== null
  );
}

function pullRequestMutationBlockedReason(input: {
  readonly request: RecordAutoImplementationPullRequestMutationRequest;
  readonly run: AutoImplementationRun;
}) {
  if (input.run.remoteStatus !== "connected") {
    return `GitHub PR mutation requires remote status connected; current status is ${input.run.remoteStatus}.`;
  }

  if (input.request.requestMode === "approved" && !input.request.approval) {
    return "GitHub PR mutation requires explicit per-action approval evidence before mutation.";
  }

  if (input.request.requestMode === "approved" && !(input.request.verifierEvidenceRefs ?? []).length) {
    return "GitHub PR mutation requires verifier evidence before mutation.";
  }

  if (
    input.request.approval &&
    (
      input.request.approval.actionClass !== AUTO_IMPLEMENTATION_PULL_REQUEST_ACTION_CLASS ||
      input.request.approval.approvalGranularity !== AUTO_IMPLEMENTATION_PULL_REQUEST_APPROVAL_GRANULARITY ||
      input.request.approval.remoteStatusAtApproval !== "connected" ||
      !input.request.approval.evidenceRefs.length
    )
  ) {
    return "GitHub PR mutation approval must be per-action approval for connected GitHub PR mutation.";
  }

  if (input.request.action !== "open_pr" && !input.request.pullRequestUrl) {
    return "GitHub PR body update and merge mutations require an existing pullRequestUrl.";
  }

  if (input.request.pullRequestUrl && !isGitHubPullRequestUrl(input.request.pullRequestUrl)) {
    return "GitHub PR mutation requires a canonical GitHub pull request URL.";
  }

  if (
    input.request.action === "open_pr" &&
    input.request.requestMode === "approved" &&
    !canOpenNewAutoImplementationPullRequest(input.run)
  ) {
    return "GitHub PR open is blocked because a pull request URL is already recorded for this auto implementation run.";
  }

  if (
    input.request.action === "open_pr" &&
    input.request.requestMode === "approved" &&
    !initialImplementationStageCompleted(input.run)
  ) {
    return "GitHub PR open is blocked until initial_pr has completed validated implementation ledger evidence.";
  }

  if (input.request.action === "update_pr_body" && !(input.request.bodyEvidenceRefs ?? []).length) {
    return "GitHub PR body update requires body evidence refs proving the PR description is current.";
  }

  if (
    input.request.action === "update_pr_body" &&
    finalVerifyStageCompleted(input.run) &&
    !hasFinalVerificationPrBodyEvidence(input.run, input.request.bodyEvidenceRefs ?? [])
  ) {
    return "GitHub PR body update is blocked until the PR body evidence references final_verify_pr_update.";
  }

  if (
    input.request.action === "merge_pr" &&
    input.request.requestMode === "approved" &&
    !canMergeAutoImplementationPullRequest(input.run)
  ) {
    return "GitHub PR merge is blocked because a pull request merge is already recorded for this auto implementation run.";
  }

  if (input.request.action === "merge_pr" && !finalVerifyStageCompleted(input.run)) {
    return "GitHub PR merge is blocked until final_verify_pr_update has completed validated final verification evidence.";
  }

  if (input.request.action === "merge_pr" && !(input.request.bodyEvidenceRefs ?? []).length) {
    return "GitHub PR merge is blocked until the PR body contains current evidence.";
  }

  if (
    input.request.action === "merge_pr" &&
    !hasFinalVerificationPrBodyEvidence(input.run, input.request.bodyEvidenceRefs ?? [])
  ) {
    return "GitHub PR merge is blocked until the PR body is refreshed after final_verify_pr_update evidence.";
  }

  if (input.request.action === "merge_pr" && !(input.request.mergeEvidenceRefs ?? []).length) {
    return "GitHub PR merge requires merge readiness evidence refs.";
  }

  return null;
}

function completedStageLedgerEvidenceRefs(
  run: AutoImplementationRun,
  evidenceKind: "implementationEvidenceRefs" | "missingTestAuditRefs" | "testEvidenceRefs"
) {
  return uniqueAutoImplementationRefs(
    run.stagePlan
      .filter((stage) => stage.status === "completed")
      .flatMap((stage) => stage.ledgerEvidence?.[evidenceKind] ?? [])
  );
}

function completedStageReviewStreakRefs(run: AutoImplementationRun) {
  return uniqueAutoImplementationRefs(
    run.stagePlan
      .filter((stage) => stage.status === "completed")
      .flatMap((stage) => [
        ...(stage.ledgerEvidence?.codeReviewStreakRefs ?? []),
        ...(stage.ledgerEvidence?.cleanCodeReviewStreakRefs ?? [])
      ])
  );
}

function evidenceLines(values: readonly string[], emptyLabel: string) {
  return values.length ? values.map((value) => `- ${value}`) : [`- ${emptyLabel}`];
}

function markdownInlineCode(value: string) {
  const longestBacktickRun = Math.max(0, ...[...value.matchAll(/`+/gu)].map((match) => match[0].length));
  const fence = "`".repeat(longestBacktickRun + 1);
  const needsPadding = value.startsWith("`") || value.endsWith("`");

  return `${fence}${needsPadding ? " " : ""}${value}${needsPadding ? " " : ""}${fence}`;
}

const PR_BODY_CODE_REVIEW_EVIDENCE_GROUPS = [
  {
    heading: "feature",
    refPrefix: "code-review:feature:",
    emptyLabel: "no feature code-review streak evidence recorded"
  },
  {
    heading: "repository",
    refPrefix: "code-review:repository:",
    emptyLabel: "no repository code-review streak evidence recorded"
  }
] as const;

const PR_BODY_CLEAN_CODE_REVIEW_EVIDENCE_GROUPS = [
  {
    heading: "changed_code",
    refPrefix: "clean-code-review:changed_code:",
    emptyLabel: "no changed_code clean-code review streak evidence recorded"
  },
  {
    heading: "repository",
    refPrefix: "clean-code-review:repository:",
    emptyLabel: "no repository clean-code review streak evidence recorded"
  }
] as const;

function scopedReviewEvidenceLines(input: {
  readonly refs: readonly string[];
  readonly groups: typeof PR_BODY_CODE_REVIEW_EVIDENCE_GROUPS | typeof PR_BODY_CLEAN_CODE_REVIEW_EVIDENCE_GROUPS;
}) {
  return input.groups.flatMap((group) => [
    `#### ${group.heading}`,
    ...evidenceLines(input.refs.filter((ref) => ref.startsWith(group.refPrefix)), group.emptyLabel),
    ""
  ]);
}

function reviewGateSummaryLines(input: {
  readonly refs: readonly string[];
  readonly groups: typeof PR_BODY_CODE_REVIEW_EVIDENCE_GROUPS | typeof PR_BODY_CLEAN_CODE_REVIEW_EVIDENCE_GROUPS;
  readonly reviewLabel: string;
}) {
  return input.groups.map((group) => {
    const refCount = uniqueAutoImplementationRefs(
      input.refs.filter((ref) => ref.startsWith(group.refPrefix))
    ).length;
    const recordedPasses = Math.min(refCount, IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK);
    const statusLabel = refCount >= IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK ? "satisfied" : "missing";

    return `- ${group.heading}: ${statusLabel} (${recordedPasses}/${IMPLEMENTATION_REQUIRED_NO_FINDING_REVIEW_STREAK} no-finding ${input.reviewLabel} refs recorded)`;
  });
}

function pullRequestIssueTraceabilityLines(run: AutoImplementationRun) {
  const planningIssueLines = run.issueManagement.planningIssueDocs.length
    ? [
        `- Sequence tracker: ${run.issueManagement.planningIssueSequenceTrackerRelativePath ?? "none"}`,
        "",
        "### Planning-derived PR-sized issues",
        ...run.issueManagement.planningIssueDocs.map((issue) => {
          const taskIds = issue.includedTaskIds.length ? issue.includedTaskIds.join(", ") : "none";

          return `- ${issue.issueId}: ${issue.title} (${issue.relativePath}; status: ${issue.status}; tasks: ${taskIds})`;
        }),
        "",
        "### Delivery stage issues"
      ]
    : [];

  const stageIssueLines = run.issueManagement.issueDocs.length
    ? run.issueManagement.issueDocs.map((issue) => {
      const githubIssueUrl = autoImplementationGitHubIssueUrlForIssue(run, issue) ?? "none";

      return `- ${issue.issueId}: ${issue.title} (${issue.relativePath}; stage: ${issue.stage}; GitHub issue: ${githubIssueUrl})`;
    })
    : ["- no generated issue documents recorded"];

  return [...planningIssueLines, ...stageIssueLines];
}

function pullRequestIssueDocumentStatusSummaryLines(run: AutoImplementationRun) {
  const issueDocs = run.issueManagement.issueDocs;
  const completedIssueDocs = issueDocs.filter((issue) => issue.status === "completed");
  const blockedIssueDocs = issueDocs.filter((issue) => issue.status === "blocked");
  const openIssueDocs = issueDocs.filter((issue) => issue.status !== "completed" && issue.status !== "blocked");

  if (issueDocs.length === 0) {
    return [
      "- Total issue docs: 0",
      "- no generated issue documents recorded"
    ];
  }

  return [
    `- Total issue docs: ${issueDocs.length}`,
    `- Completed issue docs: ${completedIssueDocs.length}/${issueDocs.length}`,
    `- Blocked issue docs: ${blockedIssueDocs.length}`,
    `- Open issue docs: ${openIssueDocs.length}`,
    "",
    ...issueDocs.map((issue) => {
      const githubIssueUrl = autoImplementationGitHubIssueUrlForIssue(run, issue) ?? "none";

      return `- ${issue.issueId}: ${issue.status}; stage: ${issue.stage}; GitHub issue: ${githubIssueUrl}`;
    })
  ];
}

function pullRequestStageStatusSummaryLines(run: AutoImplementationRun) {
  const completedStages = run.stagePlan.filter((stage) => stage.status === "completed");
  const blockedStages = run.stagePlan.filter((stage) => stage.status === "blocked");
  const openStages = run.stagePlan.filter((stage) => stage.status !== "completed" && stage.status !== "blocked");

  return [
    `- Current stage: ${run.currentStage}`,
    `- Completed stages: ${completedStages.length}/${run.stagePlan.length}`,
    `- Blocked stages: ${blockedStages.length}`,
    `- Open stages: ${openStages.length}`,
    "",
    ...run.stagePlan.map((stage) => {
      const ledgerEvidenceLabel = stage.ledgerEvidence
        ? `ledger evidence: ${stage.ledgerEvidence.implementationStepId}`
        : "ledger evidence: none";

      return `- ${stage.stage}: ${stage.status}; ${ledgerEvidenceLabel}`;
    })
  ];
}

function evidenceGateSummaryLine(label: string, refs: readonly string[]) {
  const refCount = uniqueAutoImplementationRefs(refs).length;
  const statusLabel = refCount > 0 ? "present" : "missing";

  return `- ${label}: ${statusLabel} (${refCount} refs)`;
}

function pullRequestEvidenceGateSummaryLines(input: {
  readonly implementationEvidenceRefs: readonly string[];
  readonly testEvidenceRefs: readonly string[];
  readonly missingTestAuditRefs: readonly string[];
  readonly bodyEvidenceRefs: readonly string[];
  readonly mergeEvidenceRefs: readonly string[];
}) {
  return [
    evidenceGateSummaryLine("implementation evidence", input.implementationEvidenceRefs),
    evidenceGateSummaryLine("test evidence", input.testEvidenceRefs),
    evidenceGateSummaryLine("missing-test audit evidence", input.missingTestAuditRefs),
    evidenceGateSummaryLine("PR body evidence", input.bodyEvidenceRefs),
    evidenceGateSummaryLine("merge evidence", input.mergeEvidenceRefs)
  ];
}

function pullRequestMissingTestAuditSummaryLines(run: AutoImplementationRun) {
  const completedStages = run.stagePlan.filter((stage) => stage.status === "completed");
  const zeroGapCompletedAudits = completedStages.filter((stage) =>
    (stage.ledgerEvidence?.missingTestAuditRefs.length ?? 0) > 0
  );
  const blockedStages = run.stagePlan.filter((stage) => stage.status === "blocked");
  const pendingStages = run.stagePlan.filter((stage) => stage.status !== "completed" && stage.status !== "blocked");

  return [
    `- Completed stage audits: ${zeroGapCompletedAudits.length}/${run.stagePlan.length}`,
    `- Zero-gap completed audits: ${zeroGapCompletedAudits.length}/${completedStages.length}`,
    `- Blocked stage audits: ${blockedStages.length}`,
    `- Pending stage audits: ${pendingStages.length}`,
    "",
    ...run.stagePlan.map((stage) => {
      const ledgerEvidenceLabel = stage.ledgerEvidence
        ? `ledger evidence: ${stage.ledgerEvidence.implementationStepId}`
        : "ledger evidence: none";
      const missingTestAuditRefCount = stage.ledgerEvidence?.missingTestAuditRefs.length ?? 0;

      if (stage.status === "completed") {
        const auditStatusLabel = missingTestAuditRefCount > 0
          ? "passed (0 missing targeted-test gaps)"
          : "missing audit refs";

        return `- ${stage.stage}: ${auditStatusLabel}; refs: ${missingTestAuditRefCount}; ${ledgerEvidenceLabel}`;
      }

      if (stage.status === "blocked") {
        return `- ${stage.stage}: blocked; refs: ${missingTestAuditRefCount}; ${ledgerEvidenceLabel}`;
      }

      return `- ${stage.stage}: pending; refs: ${missingTestAuditRefCount}; ${ledgerEvidenceLabel}`;
    })
  ];
}

function pullRequestBodyMarkdown(input: {
  readonly request: RecordAutoImplementationPullRequestMutationRequest;
  readonly run: AutoImplementationRun;
}) {
  const implementationEvidenceRefs = completedStageLedgerEvidenceRefs(input.run, "implementationEvidenceRefs");
  const missingTestAuditRefs = completedStageLedgerEvidenceRefs(input.run, "missingTestAuditRefs");
  const testEvidenceRefs = completedStageLedgerEvidenceRefs(input.run, "testEvidenceRefs");
  const reviewStreakRefs = uniqueAutoImplementationRefs([
    ...input.request.reviewStreakRefs,
    ...completedStageReviewStreakRefs(input.run)
  ]);

  return [
    `## ${input.request.pullRequestTitle ?? "Auto implementation PR"}`,
    "",
    "### Issue links",
    ...input.request.issueLinks.map((link) => `- ${link}`),
    "",
    "### Issue traceability",
    ...pullRequestIssueTraceabilityLines(input.run),
    "",
    "### Issue document status summary",
    ...pullRequestIssueDocumentStatusSummaryLines(input.run),
    "",
    "### Stage status summary",
    ...pullRequestStageStatusSummaryLines(input.run),
    "",
    "### Implementation scope",
    input.request.implementationScope,
    "",
    "### Review gate summary",
    "",
    "#### Code review",
    ...reviewGateSummaryLines({
      refs: reviewStreakRefs,
      groups: PR_BODY_CODE_REVIEW_EVIDENCE_GROUPS,
      reviewLabel: "code-review"
    }),
    "",
    "#### Clean-code review",
    ...reviewGateSummaryLines({
      refs: reviewStreakRefs,
      groups: PR_BODY_CLEAN_CODE_REVIEW_EVIDENCE_GROUPS,
      reviewLabel: "clean-code review"
    }),
    "",
    "### Evidence gate summary",
    ...pullRequestEvidenceGateSummaryLines({
      implementationEvidenceRefs,
      testEvidenceRefs,
      missingTestAuditRefs,
      bodyEvidenceRefs: input.request.bodyEvidenceRefs ?? [],
      mergeEvidenceRefs: input.request.mergeEvidenceRefs ?? []
    }),
    "",
    "### Missing-test audit summary",
    ...pullRequestMissingTestAuditSummaryLines(input.run),
    "",
    "### Code review streak evidence",
    ...scopedReviewEvidenceLines({
      refs: reviewStreakRefs,
      groups: PR_BODY_CODE_REVIEW_EVIDENCE_GROUPS
    }),
    "### Clean-code review streak evidence",
    ...scopedReviewEvidenceLines({
      refs: reviewStreakRefs,
      groups: PR_BODY_CLEAN_CODE_REVIEW_EVIDENCE_GROUPS
    }),
    "",
    "### Implementation evidence",
    ...evidenceLines(implementationEvidenceRefs, "no completed stage implementation evidence recorded"),
    "",
    "### Test evidence",
    ...evidenceLines(testEvidenceRefs, "no completed stage test evidence recorded"),
    "",
    "### Missing-test audit evidence",
    ...evidenceLines(missingTestAuditRefs, "no completed stage missing-test audit evidence recorded"),
    "",
    "### Verification commands",
    ...input.request.verificationCommands.map((command) => `- ${markdownInlineCode(command)}`),
    "",
    "### Known gaps",
    ...((input.request.knownGaps ?? []).length
      ? (input.request.knownGaps ?? []).map((gap) => `- ${gap}`)
      : ["- none"]),
    "",
    "### Rollback notes",
    input.request.rollbackNotes,
    "",
    "### Merge evidence",
    ...((input.request.mergeEvidenceRefs ?? []).length
      ? (input.request.mergeEvidenceRefs ?? []).map((ref) => `- ${ref}`)
      : ["- not ready"]),
    "",
    "### Body evidence",
    ...((input.request.bodyEvidenceRefs ?? []).length
      ? (input.request.bodyEvidenceRefs ?? []).map((ref) => `- ${ref}`)
      : ["- not recorded"]),
    "",
    `Auto implementation run: ${input.run.runId}`,
    `Current stage: ${input.run.currentStage}`,
    ""
  ].join("\n");
}

function buildPullRequestMutationRecord(input: {
  readonly request: RecordAutoImplementationPullRequestMutationRequest;
  readonly run: AutoImplementationRun;
  readonly now: string;
  readonly status: AutoImplementationPullRequestMutationRecord["status"];
  readonly pullRequestUrl: string | null;
  readonly blockedReason: string | null;
  readonly adapterAuditEvidenceRefs?: readonly string[];
  readonly adapterMergeEvidenceRefs?: readonly string[];
}): AutoImplementationPullRequestMutationRecord {
  const requestRef = autoImplementationPullRequestMutationRef(input.request);
  const approvalEvidenceRefs = input.request.approval?.evidenceRefs ?? [];

  return {
    mutationId: autoImplementationPullRequestMutationId(input.request),
    action: input.request.action,
    requestMode: input.request.requestMode,
    status: input.status,
    requiredRemoteStatus: "connected",
    mutatesGitHub: input.status === "applied",
    pullRequestUrl: input.pullRequestUrl,
    issueLinks: input.request.issueLinks,
    implementationScope: input.request.implementationScope,
    reviewStreakRefs: input.request.reviewStreakRefs,
    verificationCommands: input.request.verificationCommands,
    knownGaps: input.request.knownGaps ?? [],
    rollbackNotes: input.request.rollbackNotes,
    mergeEvidenceRefs: uniqueAutoImplementationRefs([
      ...(input.request.mergeEvidenceRefs ?? []),
      ...(input.adapterMergeEvidenceRefs ?? [])
    ]),
    bodyEvidenceRefs: input.request.bodyEvidenceRefs ?? [],
    approval: input.status === "blocked" || input.request.requestMode === "dry_run"
      ? null
      : input.request.approval ?? null,
    blockedReason: input.blockedReason,
    auditEvidenceRefs: uniqueAutoImplementationRefs([
      requestRef,
      input.status === "applied"
        ? "github-pr-mutation:applied"
        : input.status === "dry_run_ready"
          ? "github-pr-mutation:dry_run_ready"
          : "github-pr-mutation:blocked",
      ...approvalEvidenceRefs,
      ...(input.adapterAuditEvidenceRefs ?? [])
    ]),
    verifierEvidenceRefs: input.status === "blocked" ? [] : input.request.verifierEvidenceRefs ?? [],
    createdAt: input.now,
    updatedAt: input.now
  };
}

function completedImplementationStepIdFromWorkerJob(job: AutoImplementationWorkerJob) {
  const stepEvidencePrefix = "implementation-step-ledger:";
  const stepIds = job.evidenceRefs
    .filter((ref) => ref.startsWith(stepEvidencePrefix))
    .map((ref) => ref.slice(stepEvidencePrefix.length))
    .filter((ref) => ref.length > 0 && ref !== "tracker" && !ref.startsWith("tracker:"));
  const uniqueStepIds = [...new Set(stepIds)];

  if (uniqueStepIds.length !== 1) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Completed auto implementation worker jobs must reference exactly one completed ImplementationStepLedger step.",
      { implementationStepIds: uniqueStepIds }
    );
  }

  return uniqueStepIds[0]!;
}

function autoImplementationWorkerLedgerImportCommandKey(input: {
  readonly request: ImportAutoImplementationWorkerLedgerRequest;
  readonly transition: RecordImplementationStepLedgerPayload;
  readonly index: number;
}) {
  return `${input.request.idempotencyKey}:ledger:${input.index + 1}:${input.transition.stepDoc.stepId}:${input.transition.targetStatus}`;
}

function isAutoImplementationWorkerLedgerRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameAutoImplementationWorkerLedgerStringArray(left: unknown, right: readonly string[]) {
  return Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sameAutoImplementationWorkerLedgerTrackerDoc(left: unknown, right: TrackerDoc) {
  if (!isAutoImplementationWorkerLedgerRecord(left)) {
    return false;
  }

  return left.trackerId === right.trackerId &&
    left.title === right.title &&
    left.goal === right.goal &&
    sameAutoImplementationWorkerLedgerStringArray(left.sourceRefs, right.sourceRefs);
}

function sameAutoImplementationWorkerLedgerStepDoc(left: unknown, right: ImplementationStepDoc) {
  if (!isAutoImplementationWorkerLedgerRecord(left)) {
    return false;
  }

  return left.stepId === right.stepId &&
    left.title === right.title &&
    left.description === right.description &&
    left.expectedChangeScope === right.expectedChangeScope &&
    sameAutoImplementationWorkerLedgerStringArray(left.sourceRefs, right.sourceRefs);
}

function autoImplementationWorkerGeneratedProductTargets(workerJob: AutoImplementationWorkerJob) {
  return workerJob.executionPlan.allowedWriteScope.filter((path) => path.startsWith("generated-product/"));
}

function assertAutoImplementationWorkerGeneratedProductLedgerMatchesPlan(input: {
  readonly ledgerStep: ImplementationStepRecord;
  readonly workerJob: AutoImplementationWorkerJob;
}) {
  const generatedProductTargets = autoImplementationWorkerGeneratedProductTargets(input.workerJob);

  if (generatedProductTargets.length === 0) {
    return;
  }

  const changedFiles = input.ledgerStep.stepCommitRecord?.changedFiles ?? [];

  if (!changedFiles.some((file) => file.startsWith("generated-product/"))) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation worker completion requires generated-product changed-file evidence for generated product targets.",
      {
        implementationStepId: input.ledgerStep.stepDoc.stepId,
        generatedProductTargets
      }
    );
  }
}

function autoImplementationWorkerLedgerImportMismatch(
  workerJob: AutoImplementationWorkerJob,
  transitions: readonly RecordImplementationStepLedgerPayload[]
) {
  for (const [index, transition] of transitions.entries()) {
    if (!sameAutoImplementationWorkerLedgerTrackerDoc(
      transition.trackerDoc,
      workerJob.executionPlan.ledgerTrackerDoc
    )) {
      return `ledger transition ${index + 1} trackerDoc must match the worker execution plan`;
    }

    if (!sameAutoImplementationWorkerLedgerStepDoc(
      transition.stepDoc,
      workerJob.executionPlan.ledgerStepDoc
    )) {
      return `ledger transition ${index + 1} stepDoc must match the worker execution plan`;
    }
  }

  return null;
}

function assertAutoImplementationWorkerCompletionLedgerMatchesPlan(input: {
  readonly ledger: ImplementationStepLedgerProjection;
  readonly ledgerStep: ImplementationStepRecord;
  readonly workerJob: AutoImplementationWorkerJob;
}) {
  const { ledger, ledgerStep, workerJob } = input;

  if (
    !sameAutoImplementationWorkerLedgerTrackerDoc(
      ledger.trackerDoc,
      workerJob.executionPlan.ledgerTrackerDoc
    ) ||
    !sameAutoImplementationWorkerLedgerStepDoc(
      ledgerStep.stepDoc,
      workerJob.executionPlan.ledgerStepDoc
    )
  ) {
    throw new ProductEngineServiceError(
      "VALIDATION_FAILED",
      "Auto implementation worker completion requires completed ledger evidence matching the planned worker ledger docs.",
      {
        implementationStepId: ledgerStep.stepDoc.stepId,
        plannedImplementationStepId: workerJob.executionPlan.ledgerStepDoc.stepId
      }
    );
  }

  assertAutoImplementationWorkerGeneratedProductLedgerMatchesPlan({ ledgerStep, workerJob });
}

function normalizeLegacyAutoImplementationWorkerJob(
  run: AutoImplementationRun,
  job: AutoImplementationWorkerJob
): AutoImplementationWorkerJob {
  const plan = job.executionPlan as AutoImplementationWorkerJob["executionPlan"] & {
    readonly ledgerTrackerDoc?: TrackerDoc;
    readonly ledgerStepDoc?: ImplementationStepDoc;
  };

  if (plan.ledgerTrackerDoc && plan.ledgerStepDoc) {
    return job;
  }

  return {
    ...job,
    executionPlan: {
      ...plan,
      ledgerTrackerDoc: plan.ledgerTrackerDoc ?? autoImplementationWorkerLedgerTrackerDoc(run),
      ledgerStepDoc: plan.ledgerStepDoc ?? autoImplementationWorkerLedgerStepDoc({
        run,
        stage: job.stage,
        issueId: job.issueId,
        issueTitle: job.issueTitle,
        issueRelativePath: job.issueRelativePath,
        jobId: job.jobId,
        sourceRefs: plan.sourceRefs
      })
    }
  };
}

function legacyPlanningIssueDocs(run: AutoImplementationRun): readonly AutoImplementationPlanningIssueDocument[] {
  const issueManagement = run.issueManagement as AutoImplementationRun["issueManagement"] & {
    readonly planningIssueDocs?: unknown;
  };

  if (Array.isArray(issueManagement.planningIssueDocs)) {
    return issueManagement.planningIssueDocs as readonly AutoImplementationPlanningIssueDocument[];
  }

  return autoImplementationPlanningIssueFiles(run).map((relativePath, index) => ({
    issueId: `planning-slice-${String(index + 1).padStart(3, "0")}`,
    title: relativePath,
    relativePath,
    includedTaskIds: [],
    status: index === 0 ? "active" as const : "planned" as const
  }));
}

function normalizeLegacyAutoImplementationRun(run: AutoImplementationRun): AutoImplementationRun {
  const workerJobs = (run as { readonly workerJobs?: unknown }).workerJobs;
  const pullRequestMutations = (run as { readonly pullRequestMutations?: unknown }).pullRequestMutations;
  const normalizedWorkerJobs = Array.isArray(workerJobs)
    ? run.workerJobs.map((job) => normalizeLegacyAutoImplementationWorkerJob(run, job))
    : [];

  return autoImplementationRunWithSynchronizedIssueDocs({
    ...run,
    issueManagement: {
      ...run.issueManagement,
      planningIssueSequenceTrackerRelativePath:
        (run.issueManagement as AutoImplementationRun["issueManagement"] & {
          readonly planningIssueSequenceTrackerRelativePath?: unknown;
        }).planningIssueSequenceTrackerRelativePath === undefined
          ? null
          : run.issueManagement.planningIssueSequenceTrackerRelativePath,
      planningIssueDocs: legacyPlanningIssueDocs(run)
    },
    workerJobs: normalizedWorkerJobs,
    pullRequestMutations: pullRequestMutations &&
      typeof pullRequestMutations === "object" &&
      Array.isArray((pullRequestMutations as { readonly records?: unknown }).records)
      ? run.pullRequestMutations
      : {
          records: [],
          latestRecord: null
        }
  });
}

function normalizeLegacyAutoImplementationProjection(
  projection: AutoImplementationRunProjection
): AutoImplementationRunProjection {
  const runs = projection.runs.map(normalizeLegacyAutoImplementationRun);
  const latestRun = projection.latestRun
    ? runs.find((run) => run.runId === projection.latestRun?.runId) ??
      normalizeLegacyAutoImplementationRun(projection.latestRun)
    : null;

  return {
    ...projection,
    latestRun,
    runs
  };
}

function autoImplementationWorkerMissingEvidence(input: {
  readonly executionAuthorityRef: string | null;
  readonly authorityProjection: ExecutionAuthorityLedgerProjection | null;
  readonly run: AutoImplementationRun;
}) {
  if (!input.executionAuthorityRef || !input.authorityProjection) {
    return [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.authority];
  }

  if (input.authorityProjection.currentStatus !== "ready_for_execution") {
    return [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.readyAuthority];
  }

  const record = input.authorityProjection.latestRecord;
  const missingEvidence: string[] = [];

  if (record.actionClass !== "file_diff") {
    missingEvidence.push(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.fileDiffAuthority);
  }

  if (record.requestedScope.workspaceRef !== input.run.generatedRepoPath) {
    missingEvidence.push(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.generatedWorkspaceScope);
  }

  if (record.sandboxBoundary.secretPolicy !== "no_secret_values") {
    missingEvidence.push(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.noSecretValues);
  }

  return missingEvidence;
}

function autoImplementationWorkerBlockedReason(missingEvidence: readonly string[]) {
  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.authority)) {
    return "Local Codex worker execution requires an explicit ExecutionAuthorityRecord boundary before the job can start.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.readyAuthority)) {
    return "Local Codex worker execution requires a ready_for_execution ExecutionAuthorityRecord before the job can start.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.generatedWorkspaceScope)) {
    return "Local Codex worker execution requires an ExecutionAuthorityRecord scoped to this generated workspace.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.fileDiffAuthority)) {
    return "Local Codex worker execution requires a file_diff ExecutionAuthorityRecord for generated workspace edits.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.noSecretValues)) {
    return "Local Codex worker execution requires an ExecutionAuthorityRecord with no_secret_values secret policy.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.ledgerImport)) {
    return "Local Codex worker ledger import must pass the existing ImplementationStepLedger reducer and validation gates.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution)) {
    return "Local Codex worker execution must produce a completed ImplementationStepLedger evidence envelope before the job can advance.";
  }

  return null;
}

function autoImplementationWorkerNextRequiredAction(missingEvidence: readonly string[]) {
  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.authority)) {
    return "Create or attach an ExecutionAuthorityRecord scoped to the generated workspace before starting this local Codex worker job.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.readyAuthority)) {
    return "Approve and validate the attached ExecutionAuthorityRecord until it is ready_for_execution before starting this local Codex worker job.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.generatedWorkspaceScope)) {
    return "Attach an ExecutionAuthorityRecord whose requestedScope.workspaceRef matches this generated workspace before starting the local worker job.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.fileDiffAuthority)) {
    return "Attach a file_diff ExecutionAuthorityRecord for generated workspace edits before starting the local worker job.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.noSecretValues)) {
    return "Attach an ExecutionAuthorityRecord that forbids secret values before starting the local worker job.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.ledgerImport)) {
    return "Retry the worker ledger import with valid ImplementationStepLedger transition payloads before advancing the stage.";
  }

  if (missingEvidence.includes(AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution)) {
    return "Retry the local Codex worker run after Codex runtime availability, worker output, and ledger evidence are fixed.";
  }

  return "Run the local Codex worker inside the bounded plan, then import ImplementationStepLedger evidence before advancing the stage.";
}

const AUTO_IMPLEMENTATION_GENERATED_PRODUCT_WORKER_TARGET_PATHS = [
  "generated-product/product-slice.json",
  "generated-product/src/product-slice.mjs",
  "generated-product/src/product-slice.test.mjs"
] as const;

const AUTO_IMPLEMENTATION_GENERATED_PRODUCT_WORKER_REQUIRED_EVIDENCE = [
  "generated-product product-slice JSON/module inspected as the implementation source artifact",
  "StepCommitRecord.changedFiles includes a generated-product path when the scaffold exists",
  "generated-product smoke test evidence is recorded or a blocker explains why product behavior could not be verified"
] as const;

function autoImplementationWorkerPlan(input: {
  readonly run: AutoImplementationRun;
  readonly issue: AutoImplementationRun["issueManagement"]["issueDocs"][number];
  readonly executionAuthorityRef: string | null;
  readonly jobId: string;
}) {
  const planningPlanEvidenceRef = input.run.evidenceRefs.find((ref) => ref.startsWith("planning-handoff-plan:"));
  const planningIssueEvidenceRefs = autoImplementationPlanningIssueEvidenceRefs(input.run);
  const generatedProductArtifactRefs = input.run.evidenceRefs.filter((ref) =>
    ref.startsWith("generated-software-artifact:generated-product/")
  );
  const activePlanningIssueDocRefs = input.run.issueManagement.planningIssueDocs
    .filter((issue) => issue.status === "active")
    .map((issue) => `planning-issue-doc:${issue.relativePath}`);
  const generatedProductTargetPaths = generatedProductArtifactRefs.length
    ? AUTO_IMPLEMENTATION_GENERATED_PRODUCT_WORKER_TARGET_PATHS
    : [];
  const sourceRefs = [
    `auto-implementation-run:${input.run.runId}`,
    `auto-implementation-stage:${input.issue.stage}`,
    `auto-implementation-issue:${input.issue.issueId}`,
    `issue-doc:${input.issue.relativePath}`,
    ...(planningPlanEvidenceRef ? [planningPlanEvidenceRef] : []),
    ...planningIssueEvidenceRefs,
    ...generatedProductArtifactRefs,
    ...activePlanningIssueDocRefs
  ];

  return {
    executionMode: AUTO_IMPLEMENTATION_WORKER_EXECUTION_MODE,
    workingDirectory: input.run.generatedRepoPath,
    issueDocumentPath: input.issue.relativePath,
    executionAuthorityRef: input.executionAuthorityRef,
    ledgerTrackerDoc: autoImplementationWorkerLedgerTrackerDoc(input.run),
    ledgerStepDoc: autoImplementationWorkerLedgerStepDoc({
      run: input.run,
      stage: input.issue.stage,
      issueId: input.issue.issueId,
      issueTitle: input.issue.title,
      issueRelativePath: input.issue.relativePath,
      jobId: input.jobId,
      sourceRefs
    }),
    allowedWriteScope: [
      ".",
      input.issue.relativePath,
      ...generatedProductTargetPaths,
      ".solo-superman/auto-implementation-run.json",
      "implementation-tracker.md"
    ],
    requiredEvidence: [
      ...autoImplementationWorkerRequiredEvidence(input.issue.stage),
      ...(
        generatedProductTargetPaths.length
          ? AUTO_IMPLEMENTATION_GENERATED_PRODUCT_WORKER_REQUIRED_EVIDENCE
          : []
      )
    ],
    forbiddenActions: [
      "credential, token, session cookie, or secret storage",
      "network writes outside an explicit future contract",
      "production deploy, final-submit, or external service mutation",
      "account, billing, or permission changes",
      "destructive filesystem writes outside the generated workspace repo"
    ],
    sourceRefs
  };
}

function autoImplementationWorkerLedgerTrackerDoc(run: AutoImplementationRun): TrackerDoc {
  return {
    trackerId: `auto-implementation-tracker:${run.runId}`,
    title: `${run.projectFolderName} implementation tracker`,
    goal: AUTO_IMPLEMENTATION_WORKER_LEDGER_TRACKER_GOAL,
    sourceRefs: [
      `auto-implementation-run:${run.runId}`,
      `tracker-doc:${run.issueManagement.trackerRelativePath}`
    ]
  };
}

function autoImplementationWorkerLedgerStepDoc(input: {
  readonly run: AutoImplementationRun;
  readonly stage: AutoImplementationRun["currentStage"];
  readonly issueId: string;
  readonly issueTitle: string;
  readonly issueRelativePath: string;
  readonly jobId: string;
  readonly sourceRefs: readonly string[];
}): ImplementationStepDoc {
  const { run } = input;

  return {
    stepId: `auto-implementation-step:${run.runId}:${input.stage}:${input.issueId}`,
    title: input.issueTitle,
    description: autoImplementationWorkerLedgerStepDescription({
      stage: input.stage,
      issueRelativePath: input.issueRelativePath
    }),
    sourceRefs: uniqueAutoImplementationRefs([
      `auto-implementation-run:${run.runId}`,
      `auto-implementation-stage:${input.stage}`,
      `auto-implementation-worker-job:${input.jobId}`,
      `auto-implementation-issue:${input.issueId}`,
      `issue-doc:${input.issueRelativePath}`,
      ...input.sourceRefs
    ]),
    expectedChangeScope: autoImplementationWorkerExpectedChangeScope(input.stage)
  };
}

function autoImplementationWorkerJob(input: {
  readonly request: CreateAutoImplementationWorkerJobRequest;
  readonly run: AutoImplementationRun;
  readonly issue: AutoImplementationRun["issueManagement"]["issueDocs"][number];
  readonly authorityProjection: ExecutionAuthorityLedgerProjection | null;
  readonly now: string;
}): AutoImplementationWorkerJob {
  const executionAuthorityRef = input.request.executionAuthorityRef ?? null;
  const missingEvidence = autoImplementationWorkerMissingEvidence({
    executionAuthorityRef,
    authorityProjection: input.authorityProjection,
    run: input.run
  });
  const status = missingEvidence.length ? "blocked" as const : "planned" as const;
  const jobId = autoImplementationWorkerJobId(input.request, input.issue.stage);
  const blockedReason = autoImplementationWorkerBlockedReason(missingEvidence);
  const planningIssueEvidenceRefs = autoImplementationPlanningIssueEvidenceRefs(input.run);

  return {
    jobId,
    runId: input.run.runId,
    stage: input.issue.stage,
    issueId: input.issue.issueId,
    issueTitle: input.issue.title,
    issueRelativePath: input.issue.relativePath,
    status,
    executionPlan: autoImplementationWorkerPlan({
      run: input.run,
      issue: input.issue,
      executionAuthorityRef,
      jobId
    }),
    blockedReason,
    missingEvidence,
    nextRequiredAction: autoImplementationWorkerNextRequiredAction(missingEvidence),
    createdAt: input.now,
    updatedAt: input.now,
    evidenceRefs: uniqueAutoImplementationRefs([
      jobId,
      `worker-plan:${input.run.runId}:${input.issue.stage}`,
      `issue-doc:${input.issue.relativePath}`,
      ...planningIssueEvidenceRefs,
      ...(executionAuthorityRef ? [`execution-authority:${executionAuthorityRef}`] : []),
      ...(missingEvidence.length ? [`worker-blocked:${missingEvidence.join("+")}`] : [])
    ])
  };
}

function autoImplementationStageTickRecord(input: {
  readonly request: RecordAutoImplementationStageRequest;
  readonly status: AutoImplementationStageStatus;
  readonly recordedAt: string;
  readonly nextTickAt: string;
  readonly evidenceRefs: readonly string[];
}) {
  return {
    tickId: `auto-stage-tick:${input.request.runId}:${input.request.stage}:${input.request.action}:${input.request.idempotencyKey}`,
    stage: input.request.stage,
    action: input.request.action,
    status: input.status,
    recordedAt: input.recordedAt,
    nextTickAt: input.nextTickAt,
    evidenceRefs: input.evidenceRefs
  } satisfies AutoImplementationStageRecord["tickRecords"][number];
}

function researchRunId() {
  return prefixedId<ResearchRunId>("research_run");
}

function researchRunCollectionRefetchUrl(projectIdValue: ProjectId) {
  return `/api/v1/projects/${projectIdValue}/research-runs`;
}

function researchRunStatusUrl(projectIdValue: ProjectId, researchRunIdValue: ResearchRunId) {
  return `${researchRunCollectionRefetchUrl(projectIdValue)}/${researchRunIdValue}/status`;
}

function researchRunProjectionHint(
  projectIdValue: ProjectId,
  researchRunIdValue?: ResearchRunId
): ProjectionRefetchHint {
  return {
    projectionKind: "ResearchRunProjection",
    refetchUrl: researchRunIdValue
      ? researchRunStatusUrl(projectIdValue, researchRunIdValue)
      : researchRunCollectionRefetchUrl(projectIdValue)
  };
}

function researchRunRecoveryHint(projectIdValue: ProjectId, researchRunIdValue?: ResearchRunId) {
  const hint = researchRunProjectionHint(projectIdValue, researchRunIdValue);

  return {
    ...(researchRunIdValue ? { statusUrl: researchRunStatusUrl(projectIdValue, researchRunIdValue) } : {}),
    refetchUrl: hint.refetchUrl,
    sseEventNames: ["projection.updated" as const],
    projectionHints: [hint]
  };
}

function researchRunCollectionVersion(runs: readonly ResearchRunProjection[]): ProjectionVersion {
  return runs.reduce((collectionVersion, run) => collectionVersion + Number(run.version), 0) as ProjectionVersion;
}

function researchRunControlProjection(
  projectIdValue: ProjectId,
  runs: readonly ResearchRunProjection[],
  generatedAt: string,
  selectedRun?: ResearchRunProjection
): ResearchRunControlProjection {
  const recovery = researchRunRecoveryHint(projectIdValue, selectedRun?.researchRunId);

  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId: projectIdValue,
    version: researchRunCollectionVersion(runs),
    generatedAt,
    stale: false,
    refetchUrl: researchRunCollectionRefetchUrl(projectIdValue),
    ...(selectedRun ? { statusUrl: researchRunStatusUrl(projectIdValue, selectedRun.researchRunId) } : {}),
    pendingEffectSummary: zeroPendingEffectSummary(),
    runs,
    ...(selectedRun ? { selectedRun } : {}),
    recovery
  };
}

function researchRunCommandResponse(
  commandType: ProjectApplicationCommandType,
  stateVersionBefore: StateVersion,
  result: ResearchRunControlResult
): CommandResponse<ResearchRunControlResult> {
  const blocked = result.status === "blocked_manual_handoff" || result.status === "blocked_precondition";

  return {
    category: blocked ? "blocked" : "accepted_with_projection",
    commandId: commandId(),
    correlationId: correlationId(),
    stateVersionBefore,
    stateVersionAfter: result.projection.version as unknown as StateVersion,
    eventIds: [],
    effectTaskIds: [],
    ...(result.statusUrl ? { statusUrl: result.statusUrl } : {}),
    immediateProjection: result,
    pendingEffectSummary: zeroPendingEffectSummary(),
    projectionHints: result.recovery.projectionHints,
    ...(blocked
      ? {
          blockingCard: {
            title: "Automatic research run blocked",
            reason: result.blocker?.reason ?? result.manualHandoff?.reason,
            userAction: result.manualHandoff?.route ?? "refetch_research_run_status_or_update_allowlist"
          }
        }
      : {}),
    deterministicOutputs: [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `${commandType}:${result.projectId}:${result.researchRunId ?? result.disclosureLogId ?? result.status}`,
        payload: {
          commandType,
          projectId: result.projectId,
          researchRunId: result.researchRunId,
          action: result.action,
          status: result.status,
          refetchUrl: result.recovery.refetchUrl,
          statusUrl: result.statusUrl,
          projectionKind: "ResearchRunProjection",
          sseEventHints: result.recovery.sseEventNames,
          productEngineReducerSideEffects: false,
          providerExecution:
            result.status === "started" || result.status === "retry_started"
              ? result.researchRun?.provider.adapterKind ?? true
              : false,
          externalMutationPerformed: false,
          ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
          ...(result.priorFailure ? { priorFailure: result.priorFailure } : {}),
          ...(result.blocker ? { blocker: result.blocker } : {})
        }
      }
    ]
  };
}

function isPersistedProjection(value: unknown): value is PersistedProjection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const kind = (value as { readonly kind?: unknown }).kind;

  return (
    kind === "ConfidenceCompletionProjection" ||
    kind === "DecisionQueueProjection" ||
    kind === "FounderBriefProjection" ||
    kind === "LivingSpecProjection" ||
    kind === "PlanningHandoffProjection" ||
    kind === "Phase25ResearchComparisonProjection" ||
    kind === "ExecutionAuthorityLedgerProjection" ||
    kind === "ChatGptBrowserDelegationProjection" ||
    kind === "ServicePageUsePermissionProjection" ||
    kind === "ImplementationStepLedgerProjection" ||
    kind === "AutoImplementationRunProjection" ||
    kind === "ResearchEvidenceProjection" ||
    kind === "RuntimeActivityProjection" ||
    kind === "SessionShellProjection"
  );
}

function maxAttemptsFor(effect: ProductEngineEffectPlanItem) {
  switch (effect.effectType) {
    case "queue_projection_effect":
      return 3;
    case "research_evidence_effect":
      return 2;
    case "codex_runtime_preview_effect":
      return 1;
  }
}

function pendingEffectSummary(effects: readonly EffectTaskDto[]): PendingEffectSummaryDto {
  const byType = effects.reduce<Record<string, number>>((summary, effect) => {
    summary[effect.effectType] = (summary[effect.effectType] ?? 0) + 1;

    return summary;
  }, {});

  return {
    totalPending: effects.length,
    byType,
    visibleLabel: effects.length
      ? `${effects.length} persisted async effect task(s) queued.`
      : "No persisted async effects are pending."
  };
}

function queueProjectionPendingEffectCount(effects: readonly EffectTaskDto[]) {
  return effects.filter((effect) => effect.effectType === "queue_projection_effect" && isPendingEffect(effect)).length;
}

function decisionQueueProjectionForRecovery(
  projection: DecisionQueueProjection,
  sessionIdValue: SessionId,
  effects: readonly EffectTaskDto[],
  generatedAt: string
) {
  return decisionQueueProjectionWithRecovery(
    projection,
    sessionIdValue,
    generatedAt,
    queueProjectionPendingEffectCount(effects)
  );
}

function isPendingEffect(effect: EffectTaskDto) {
  return effect.status === "queued" || effect.status === "leased" || effect.status === "running";
}

function hasBlockedRuntimeConversion(events: readonly ProductEngineEvent[]) {
  return events.some(
    (event) => event.eventType === "RuntimeArtifactConverted" && event.payload.conversionStatus === "blocked"
  );
}

function commandCategoryFromEvents(events: readonly ProductEngineEvent[]): CommandResponseCategory {
  if (hasBlockedRuntimeConversion(events)) {
    return "blocked";
  }

  return events.some((event) => isPersistedProjection(event.payload.projection)) ? "accepted_with_projection" : "accepted";
}

function effectTaskIdempotencyKey(plannedEffect: ProductEngineEffectPlanItem, primarySourceEvent: ProductEngineEvent) {
  if (plannedEffect.effectType === "queue_projection_effect") {
    return `${primarySourceEvent.eventId}:decision_queue`;
  }

  if (plannedEffect.effectType === "research_evidence_effect") {
    return plannedEffect.inputRef.refType === "ResearchTask" || plannedEffect.inputRef.refType === "ResearchResult"
      ? plannedEffect.idempotencyKey
      : `research:${plannedEffect.inputRef.refId}`;
  }

  return plannedEffect.idempotencyKey;
}

function projectionHintsForEffects(sessionIdValue: SessionId, effects: readonly EffectTaskDto[]): readonly ProjectionRefetchHint[] {
  const hints = new Map<string, ProjectionRefetchHint>();

  for (const effect of effects) {
    if (effect.effectType === "queue_projection_effect") {
      hints.set("DecisionQueueProjection", {
        projectionKind: "DecisionQueueProjection",
        refetchUrl: `/api/v1/sessions/${sessionIdValue}/queue`
      });
    } else if (effect.effectType === "research_evidence_effect") {
      hints.set("ResearchEvidenceProjection", {
        projectionKind: "ResearchEvidenceProjection",
        refetchUrl: `/api/v1/sessions/${sessionIdValue}/research`
      });
    } else if (effect.effectType === "codex_runtime_preview_effect") {
      hints.set("RuntimeActivityProjection", {
        projectionKind: "RuntimeActivityProjection",
        refetchUrl: `/api/v1/sessions/${sessionIdValue}/activity`
      });
    }
  }

  return [...hints.values()];
}

function responseForRejected(command: ProductEngineCommand, stateVersionBefore: StateVersion, reduction: ProductEngineReduction) {
  return {
    category: "rejected",
    commandId: command.commandId,
    correlationId: command.correlationId,
    stateVersionBefore,
    error: {
      code: reduction.rejectionReason?.code ?? "COMMAND_PRECONDITION_FAILED",
      message: reduction.rejectionReason?.message ?? "ProductEngine command was rejected.",
      ...(reduction.rejectionReason?.details ? { details: reduction.rejectionReason.details } : {})
    }
  } satisfies CommandResponse;
}

function responseForIdempotencyConflict(
  command: ProductEngineCommand,
  stateVersionBefore: StateVersion,
  idempotencyKey: string
) {
  return {
    category: "rejected",
    commandId: command.commandId,
    correlationId: command.correlationId,
    stateVersionBefore,
    error: {
      code: "IDEMPOTENCY_CONFLICT",
      message: "ProductEngine command would create a duplicate persisted effect task.",
      details: {
        idempotencyKey
      }
    }
  } satisfies CommandResponse;
}

function responseForAccepted(
  command: ProductEngineCommand,
  stateVersionBefore: StateVersion,
  stateVersionAfter: StateVersion,
  events: readonly ProductEngineEvent[],
  effects: readonly EffectTaskDto[],
  reduction: ProductEngineReduction
): CommandResponse {
  const eventIds = events.map((event) => event.eventId);
  const effectTaskIds = effects.map((effect) => effect.effectTaskId);
  const immediateProjection = reduction.immediateProjection;
  const hasImmediateProjection = Boolean(immediateProjection);
  const hasDecisionQueueProjection =
    isPersistedProjection(immediateProjection) && immediateProjection.kind === "DecisionQueueProjection";
  const queueProjection = hasDecisionQueueProjection ? immediateProjection : decisionQueueProjectionFromEvents(events);
  const generatedAt = events.at(-1)?.occurredAt ?? new Date(0).toISOString();
  const recoveredQueueProjection = queueProjection
    ? decisionQueueProjectionForRecovery(queueProjection, command.sessionId, effects, generatedAt)
    : null;
  const responseImmediateProjection = hasDecisionQueueProjection ? recoveredQueueProjection : immediateProjection;
  const category = hasBlockedRuntimeConversion(events)
    ? "blocked"
    : hasImmediateProjection
      ? "accepted_with_projection"
      : "accepted";

  return {
    category,
    commandId: command.commandId,
    correlationId: command.correlationId,
    stateVersionBefore,
    stateVersionAfter,
    eventIds,
    effectTaskIds,
    ...(effects.length ? { statusUrl: `/api/v1/commands/${command.commandId}/status` } : {}),
    ...(effects.length
      ? {
          queuedActivity: {
            eventIds,
            effectTaskIds
          },
          pendingEffectSummary: pendingEffectSummary(effects)
        }
      : {}),
    ...(responseImmediateProjection ? { immediateProjection: responseImmediateProjection } : {}),
    ...(recoveredQueueProjection ? { queueProjection: recoveredQueueProjection } : {}),
    ...(reduction.deterministicOutputs.length ? { deterministicOutputs: reduction.deterministicOutputs } : {})
  };
}

function latestEvent(events: readonly ProductEngineEvent[]) {
  return events.at(-1) ?? null;
}

function persistedProjectionsFromEvent(event: ProductEngineEvent): readonly PersistedProjection[] {
  const candidates = [
    event.payload.projection,
    event.payload.queueProjection,
    event.payload.confidenceProjection
  ];

  return candidates.filter(isPersistedProjection);
}

function researchProjectionFromEvent(event: ProductEngineEvent): ResearchEvidenceProjection | null {
  const projection = event.payload.projection;

  return isPersistedProjection(projection) && projection.kind === "ResearchEvidenceProjection"
    ? projection
    : null;
}

function runtimeProjectionFromEvent(event: ProductEngineEvent): RuntimeActivityProjection | null {
  const projection = event.payload.projection;

  return isPersistedProjection(projection) && projection.kind === "RuntimeActivityProjection"
    ? projection
    : null;
}

function runtimeArtifactFromEvent(event: ProductEngineEvent): RuntimePreviewArtifact | null {
  const runtimeArtifact = event.payload.runtimeArtifact;

  return runtimeArtifact && typeof runtimeArtifact === "object" && !Array.isArray(runtimeArtifact)
    ? (runtimeArtifact as RuntimePreviewArtifact)
    : null;
}

function runtimeArtifactsFromEvent(event: ProductEngineEvent): readonly RuntimePreviewArtifact[] {
  const artifacts = new Map<string, RuntimePreviewArtifact>();
  const runtimeProjection = runtimeProjectionFromEvent(event);
  const runtimeArtifact = runtimeArtifactFromEvent(event);

  for (const artifact of runtimeProjection?.runtimeArtifacts ?? []) {
    artifacts.set(artifact.artifactId, artifact);
  }

  if (runtimeArtifact) {
    artifacts.set(runtimeArtifact.artifactId, runtimeArtifact);
  }

  return [...artifacts.values()];
}

function planningHandoffProjectionFromEvent(event: ProductEngineEvent): PlanningHandoffProjection | null {
  const projection = event.payload.projection;

  return isPersistedProjection(projection) && projection.kind === "PlanningHandoffProjection"
    ? projection
    : null;
}

function phase25ResearchComparisonProjectionFromEvent(
  event: ProductEngineEvent
): Phase25ResearchComparisonProjection | null {
  const projection = event.payload.projection;

  return isPersistedProjection(projection) && projection.kind === "Phase25ResearchComparisonProjection"
    ? projection
    : null;
}

function executionAuthorityLedgerProjectionFromEvent(event: ProductEngineEvent): ExecutionAuthorityLedgerProjection | null {
  const projection = event.payload.projection;

  return isPersistedProjection(projection) && projection.kind === "ExecutionAuthorityLedgerProjection"
    ? projection
    : null;
}

async function persistExecutionAuthorityProjectionForEvent(input: {
  readonly command: ProductEngineCommand;
  readonly event: ProductEngineEvent;
  readonly repository: ReturnType<typeof createExecutionAuthorityRepository>;
}): Promise<void> {
  const executionAuthorityLedgerProjection = executionAuthorityLedgerProjectionFromEvent(input.event);

  if (!executionAuthorityLedgerProjection) {
    return;
  }

  await input.repository.saveFromProjection({
    projectId: input.command.projectId,
    sessionId: input.command.sessionId,
    sourceCommandId: input.command.commandId,
    sourceEventId: input.event.eventId,
    sourceStateVersion: input.command.expectedStateVersion,
    projection: executionAuthorityLedgerProjection
  });
}

function executionAuthorityPreflightBlockReason(
  code: ExecutionAuthorityBlockCode,
  message: string,
  evidenceRefs: readonly string[] = [`preflight:${code}`]
): ExecutionAuthorityBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs
  };
}

function approvalDecisionPreflightBlockCode(
  decision: ExecutionAuthorityRecord["approvalDecision"]
): ExecutionAuthorityBlockCode | null {
  switch (decision) {
    case "approved":
      return null;
    case "rejected":
      return "rejected_approval";
    case "revoked":
      return "revoked_approval";
    case "expired":
      return "expired_approval";
    case "pending":
      return "missing_approval";
  }
}

function parseExecutionAuthorityTimestamp(value: string, fieldName: string) {
  if (!isExecutionAuthorityIsoTimestamp(value)) {
    throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an ISO timestamp.`);
  }

  return Date.parse(value);
}

function isExecutionAuthorityApprovalExpired(input: ValidateExecutionAuthorityPreflightInput) {
  if (!input.approvalExpiresAt) {
    return false;
  }

  return (
    parseExecutionAuthorityTimestamp(input.requestedAt, "requestedAt") >=
    parseExecutionAuthorityTimestamp(input.approvalExpiresAt, "approvalExpiresAt")
  );
}

function executionAuthorityPreflightResult(input: {
  readonly request: ValidateExecutionAuthorityPreflightInput;
  readonly checkedAt: string;
  readonly record?: ExecutionAuthorityRecord;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
}): ExecutionAuthorityPreflightResult {
  const evidenceRefs = input.record
    ? [...new Set([...input.record.evidenceRefs, ...input.blockReasons.flatMap((reason) => reason.evidenceRefs)])]
    : input.blockReasons.flatMap((reason) => reason.evidenceRefs);
  const auditRefs = input.record
    ? [...new Set([...input.record.auditRefs, `audit:preflight:${input.request.idempotencyKey}`])]
    : [`audit:preflight:${input.request.idempotencyKey}`];

  return {
    kind: "ExecutionAuthorityPreflightResult",
    authorityRecordId: input.request.authorityRecordId,
    idempotencyKey: input.request.idempotencyKey,
    actionClass: input.request.actionClass,
    previewArtifactHash: input.request.previewArtifactHash,
    requestedAt: input.request.requestedAt,
    checkedAt: input.checkedAt,
    status: input.blockReasons.length ? "blocked" : "ready_for_execution",
    blockReasons: input.blockReasons,
    evidenceRefs,
    auditRefs,
    refetchUrl: `/api/v1/execution-authorities/${input.request.authorityRecordId}/preflight`
  };
}

function fileDiffStats(changedFiles: readonly FileDiffChangedFileDto[]): FileDiffStatsDto {
  return changedFiles.reduce<FileDiffStatsDto>(
    (stats, file) => ({
      fileCount: stats.fileCount + 1,
      additions: stats.additions + file.additions,
      deletions: stats.deletions + file.deletions
    }),
    {
      fileCount: 0,
      additions: 0,
      deletions: 0
    }
  );
}

function uniqueRefs(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function fileDiffExecutionResult(input: {
  readonly request: ExecuteFileDiffInput;
  readonly checkedAt: string;
  readonly record?: ExecutionAuthorityRecord;
  readonly status: FileDiffExecutionResult["status"];
  readonly changedFiles?: readonly FileDiffChangedFileDto[];
  readonly diffStats?: FileDiffStatsDto;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly includeRequestAuditRef?: boolean;
}): FileDiffExecutionResult {
  const changedFiles = input.changedFiles ?? [];
  const blockEvidenceRefs = input.blockReasons.flatMap((reason) => reason.evidenceRefs);
  const requestAuditRefs = input.includeRequestAuditRef === false
    ? []
    : [`audit:file_diff:${input.request.idempotencyKey}`];
  const evidenceRefs = input.record
    ? uniqueRefs([...(input.record.evidenceRefs ?? []), ...(input.evidenceRefs ?? []), ...blockEvidenceRefs])
    : uniqueRefs([...(input.evidenceRefs ?? []), ...blockEvidenceRefs]);
  const auditRefs = input.record
    ? uniqueRefs([...(input.record.auditRefs ?? []), ...requestAuditRefs, ...(input.auditRefs ?? [])])
    : uniqueRefs([...requestAuditRefs, ...(input.auditRefs ?? [])]);

  return {
    kind: "FileDiffExecutionResult",
    authorityRecordId: input.request.authorityRecordId,
    idempotencyKey: input.request.idempotencyKey,
    previewArtifactHash: input.request.previewArtifactHash,
    requestedAt: input.request.requestedAt,
    checkedAt: input.checkedAt,
    status: input.status,
    changedFiles,
    diffStats: input.diffStats ?? fileDiffStats(changedFiles),
    blockReasons: input.blockReasons,
    rollbackReference: input.record?.rollbackReference ?? null,
    evidenceRefs,
    auditRefs,
    refetchUrl: `/api/v1/sessions/${input.request.sessionId}/execution-authority`
  };
}

function shellCommandExecutionResult(input: {
  readonly request: ExecuteShellCommandInput;
  readonly checkedAt: string;
  readonly record?: ExecutionAuthorityRecord;
  readonly status: ShellCommandExecutionResult["status"];
  readonly command?: ShellCommandRunSummaryDto;
  readonly exitCode?: number | null;
  readonly durationMs?: number;
  readonly stdoutSummary?: string;
  readonly stderrSummary?: string;
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly includeRequestAuditRef?: boolean;
}): ShellCommandExecutionResult {
  const blockEvidenceRefs = input.blockReasons.flatMap((reason) => reason.evidenceRefs);
  const requestAuditRefs = input.includeRequestAuditRef === false
    ? []
    : [`audit:shell_command:${input.request.idempotencyKey}`];
  const evidenceRefs = input.record
    ? uniqueRefs([...(input.record.evidenceRefs ?? []), ...(input.evidenceRefs ?? []), ...blockEvidenceRefs])
    : uniqueRefs([...(input.evidenceRefs ?? []), ...blockEvidenceRefs]);
  const auditRefs = input.record
    ? uniqueRefs([...(input.record.auditRefs ?? []), ...requestAuditRefs, ...(input.auditRefs ?? [])])
    : uniqueRefs([...requestAuditRefs, ...(input.auditRefs ?? [])]);

  return {
    kind: "ShellCommandExecutionResult",
    authorityRecordId: input.request.authorityRecordId,
    idempotencyKey: input.request.idempotencyKey,
    previewArtifactHash: input.request.previewArtifactHash,
    requestedAt: input.request.requestedAt,
    checkedAt: input.checkedAt,
    status: input.status,
    command: input.command ?? shellCommandSummaryFromRequest({
      request: input.request,
      ...(input.record ? { record: input.record } : {})
    }),
    exitCode: input.exitCode ?? null,
    durationMs: input.durationMs ?? 0,
    stdoutSummary: input.stdoutSummary ?? "",
    stderrSummary: input.stderrSummary ?? "",
    blockReasons: input.blockReasons,
    rollbackReference: input.record?.rollbackReference ?? null,
    evidenceRefs,
    auditRefs,
    refetchUrl: `/api/v1/sessions/${input.request.sessionId}/execution-authority`
  };
}

function browserActionTargetFromRequest(targetUrl: string): BrowserActionTargetDto | null {
  const target = browserActionTargetFromUrl(targetUrl);

  return "code" in target ? null : target;
}

function browserActionExecutionResult(input: {
  readonly request: ExecuteBrowserActionInput;
  readonly checkedAt: string;
  readonly record?: ExecutionAuthorityRecord;
  readonly status: BrowserActionExecutionResult["status"];
  readonly target?: BrowserActionTargetDto | null;
  readonly action?: BrowserActionPreviewDto;
  readonly httpStatusCode?: number | null;
  readonly durationMs?: number;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly blockReasons: readonly ExecutionAuthorityBlockReasonDto[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly includeRequestAuditRef?: boolean;
}): BrowserActionExecutionResult {
  const blockEvidenceRefs = input.blockReasons.flatMap((reason) => reason.evidenceRefs);
  const requestAuditRefs = input.includeRequestAuditRef === false
    ? []
    : [`audit:browser_action:${input.request.idempotencyKey}`];
  const evidenceRefs = input.record
    ? uniqueRefs([...(input.record.evidenceRefs ?? []), ...(input.evidenceRefs ?? []), ...blockEvidenceRefs])
    : uniqueRefs([...(input.evidenceRefs ?? []), ...blockEvidenceRefs]);
  const auditRefs = input.record
    ? uniqueRefs([...(input.record.auditRefs ?? []), ...requestAuditRefs, ...(input.auditRefs ?? [])])
    : uniqueRefs([...requestAuditRefs, ...(input.auditRefs ?? [])]);
  const target = input.target === undefined
    ? browserActionTargetFromRequest(input.request.targetUrl)
    : input.target;

  return {
    kind: "BrowserActionExecutionResult",
    authorityRecordId: input.request.authorityRecordId,
    idempotencyKey: input.request.idempotencyKey,
    previewArtifactHash: input.request.previewArtifactHash,
    requestedAt: input.request.requestedAt,
    checkedAt: input.checkedAt,
    status: input.status,
    target,
    action: input.action ?? input.request.action,
    httpStatusCode: input.httpStatusCode ?? null,
    durationMs: input.durationMs ?? 0,
    screenshotRefs: input.screenshotRefs ?? [],
    logRefs: input.logRefs ?? [],
    blockReasons: input.blockReasons,
    rollbackReference: input.record?.rollbackReference ?? null,
    evidenceRefs,
    auditRefs,
    refetchUrl: `/api/v1/sessions/${input.request.sessionId}/execution-authority`
  };
}

async function servicePageUsePermissionBrowserActionBlockReasons(
  storage: SoloStorage,
  record: ExecutionAuthorityRecord,
  input: ExecuteBrowserActionInput
): Promise<readonly ExecutionAuthorityBlockReasonDto[]> {
  const scope = record.requestedScope;
  const scopedServicePageFields = [
    scope.servicePagePermissionId,
    scope.servicePageActionClass,
    scope.serviceOrigin,
    scope.servicePageUrl
  ].filter(Boolean);
  const requestHasServicePageMetadata = Boolean(input.servicePagePermissionId || input.servicePageActionClass);
  const servicePagePermissionId = scope.servicePagePermissionId;
  const servicePageActionClass = scope.servicePageActionClass;
  const serviceOrigin = scope.serviceOrigin;
  const servicePageUrl = scope.servicePageUrl;

  if (
    !requestHasServicePageMetadata &&
    !scopedServicePageFields.length
  ) {
    return [];
  }

  if (!servicePagePermissionId || !servicePageActionClass || !serviceOrigin || !servicePageUrl) {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_required",
        "Service page-use browser actions must be approved with permission id, action class, service origin, and page URL.",
        ["service_page_permission:authority_scope_missing"]
      )
    ];
  }

  if (
    input.servicePagePermissionId !== servicePagePermissionId ||
    input.servicePageActionClass !== servicePageActionClass
  ) {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_scope_mismatch",
        "Service page-use browser action request does not match the approved authority scope.",
        ["service_page_permission:request_scope_mismatch"]
      )
    ];
  }

  const serviceProjection = await createProjectionRepository(storage.db).get<ServicePageUsePermissionProjection>(
    input.sessionId,
    "ServicePageUsePermissionProjection"
  );
  const permission = serviceProjection?.latestPermission;

  if (!permission || permission.permissionId !== servicePagePermissionId) {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_required",
        "Service page-use browser action requires the latest service page-use permission.",
        [`service_page_permission:${servicePagePermissionId}`]
      )
    ];
  }

  if (permission.status === "revoked") {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_revoked",
        "The referenced service page-use permission was revoked; further page-use actions are blocked.",
        [`service_page_permission:${permission.permissionId}:revoked`]
      )
    ];
  }

  if (permission.status !== "granted" && permission.status !== "final_submit_requested") {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_required",
        "The referenced service page-use permission is not active.",
        [`service_page_permission:${permission.permissionId}:${permission.status}`]
      )
    ];
  }

  if (!permission.allowedActionClasses.includes(servicePageActionClass)) {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_scope_mismatch",
        "The referenced service page-use permission does not allow this page action class.",
        [`service_page_permission:${permission.permissionId}:${servicePageActionClass}`]
      )
    ];
  }

  if (
    (servicePageActionClass === "fill_draft" ||
      servicePageActionClass === "copy_generated_value" ||
      servicePageActionClass === "final_submit_request") &&
    permission.approvalGranularity !== "per_action"
  ) {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_scope_mismatch",
        "Fill, copy, and final-submit service page-use actions require per-action permission.",
        [`service_page_permission:${permission.permissionId}:approval:${permission.approvalGranularity}`]
      )
    ];
  }

  if (
    serviceOrigin !== permission.serviceOrigin ||
    servicePageUrl !== permission.pageUrl
  ) {
    return [
      executionAuthorityPreflightBlockReason(
        "service_page_permission_scope_mismatch",
        "The approved browser authority service origin/page URL does not match the service page-use permission.",
        [
          `service_page_permission:${permission.permissionId}:origin:${permission.serviceOrigin}`,
          `authority_scope:service_origin:${serviceOrigin}`,
          `authority_scope:service_page_url:${servicePageUrl}`
        ]
      )
    ];
  }

  return [];
}

function shellCommandSummaryFromRequest(input: {
  readonly request: ExecuteShellCommandInput;
  readonly record?: ExecutionAuthorityRecord;
  readonly commandClass?: ShellCommandRunSummaryDto["commandClass"];
  readonly timedOut?: boolean;
}): ShellCommandRunSummaryDto {
  return {
    executable: input.request.command[0] ?? "",
    args: input.request.command.slice(1),
    workingDirectory: input.request.workingDirectory ?? ".",
    commandClass: input.commandClass ?? "diagnostic",
    timeoutMs: input.record?.requestedScope.maxDurationMs ?? 0,
    timedOut: input.timedOut ?? false
  };
}

function existingExecutionStatus(
  record: ExecutionAuthorityRecord
): Extract<ExecutionAuthorityRecord["executionResult"], "blocked" | "completed" | "failed" | "partial"> | null {
  switch (record.executionResult) {
    case "blocked":
    case "completed":
    case "failed":
    case "partial":
      return record.executionResult;
    case "not_run":
    case "running":
      return null;
  }
}

function browserActionRequestPreviewHashBlockReason(
  input: ExecuteBrowserActionInput
): ExecutionAuthorityBlockReasonDto | null {
  const computedHash = hashBrowserActionPreview({
    targetUrl: input.targetUrl,
    action: input.action
  });

  if (computedHash === input.previewArtifactHash) {
    return null;
  }

  return executionAuthorityPreflightBlockReason(
    "preview_hash_mismatch",
    "Browser action request targetUrl and action must match the supplied previewArtifactHash.",
    ["preflight:browser_action_request_preview_hash_mismatch"]
  );
}

function executionAuthorityPreflightBlockReasons(
  input: ValidateExecutionAuthorityPreflightInput,
  projection: ExecutionAuthorityLedgerProjection | null
): readonly ExecutionAuthorityBlockReasonDto[] {
  if (!projection) {
    return [
      executionAuthorityPreflightBlockReason(
        "missing_source",
        "Execution authority record was not found, so no adapter execution can start."
      )
    ];
  }

  const record = projection.latestRecord;
  const reasons: ExecutionAuthorityBlockReasonDto[] = [...record.blockReasons];
  const approvalBlockCode = approvalDecisionPreflightBlockCode(record.approvalDecision);

  if (record.actionClass !== input.actionClass) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "sandbox_failure",
        "Requested adapter action class does not match the stored ExecutionAuthorityRecord action class."
      )
    );
  }

  if (record.previewArtifactHash !== input.previewArtifactHash) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "preview_hash_mismatch",
        "Adapter preflight preview hash does not match the approved authority preview hash."
      )
    );
  }

  if (approvalBlockCode) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        approvalBlockCode,
        "Stored approval decision is not an active approved state for adapter execution."
      )
    );
  }

  if (record.actionClass === "external_mutation_preview_only") {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "sandbox_failure",
        "Preview-only external mutation authorities cannot start adapter execution."
      )
    );
  }

  if (isExecutionAuthorityApprovalExpired(input)) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "expired_approval",
        "Adapter preflight requestedAt is at or after the approval expiry timestamp."
      )
    );
  }

  if (record.executionResult !== "not_run") {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        record.executionResult === "blocked" ? "sandbox_failure" : "missing_approval",
        "Adapter preflight requires an approved authority that has not started execution yet."
      )
    );
  }

  if (record.actionClass !== "external_mutation_preview_only" && !record.rollbackReference) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "missing_rollback",
        "Adapter preflight requires a rollback reference before execution can start."
      )
    );
  }

  if (!record.evidenceRefs.length) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "missing_source",
        "Adapter preflight requires evidence refs linked to the authority record."
      )
    );
  }

  if (!record.auditRefs.length) {
    reasons.push(
      executionAuthorityPreflightBlockReason(
        "missing_source",
        "Adapter preflight requires audit refs linked to the authority record."
      )
    );
  }

  return reasons;
}

function decisionQueueProjectionFromEvents(events: readonly ProductEngineEvent[]): DecisionQueueProjection | null {
  for (const event of [...events].reverse()) {
    const projection = event.payload.queueProjection;

    if (isPersistedProjection(projection) && projection.kind === "DecisionQueueProjection") {
      return projection;
    }
  }

  return null;
}

export interface ProductEngineCommandServiceOptions {
  readonly autoImplementationWorkspaceRoot?: string;
  readonly researchMemoryMarkdownRoot?: string;
  readonly autoImplementationRemoteStatusProvider?: AutoImplementationRemoteStatusProvider;
  readonly autoImplementationGitHubIssueMutationAdapter?: AutoImplementationGitHubIssueMutationAdapter;
  readonly autoImplementationPullRequestMutationAdapter?: AutoImplementationPullRequestMutationAdapter;
  readonly researchRuntimeAdapterFactory?: (adapterKind: MountedResearchAdapterKind) => BackgroundResearchRuntimeAdapter;
}

export function createProductEngineCommandService(
  storage: SoloStorage,
  codexRuntimeAdapter: CodexRuntimeAdapter = createCodexRuntimeAdapter(),
  options: ProductEngineCommandServiceOptions = {}
) {
  const sessionCommandQueues = new Map<SessionId, Promise<void>>();
  const autoImplementationWorkspaceRoot = options.autoImplementationWorkspaceRoot ?? defaultAutoImplementationWorkspaceRoot();
  const researchMemoryMarkdownRoot =
    options.researchMemoryMarkdownRoot ?? resolve(autoImplementationWorkspaceRoot, "research-memory");
  const autoImplementationRemoteStatusProvider = options.autoImplementationRemoteStatusProvider;
  const autoImplementationGitHubIssueMutationAdapter = options.autoImplementationGitHubIssueMutationAdapter;
  const autoImplementationPullRequestMutationAdapter =
    options.autoImplementationPullRequestMutationAdapter ?? ghAutoImplementationPullRequestMutationAdapter;
  const researchRuntimeAdapterFactory = options.researchRuntimeAdapterFactory;

  async function synchronizeAutoImplementationRunWorkspaceState(run: AutoImplementationRun) {
    try {
      await writeAutoImplementationRunManifest({
        workspaceRoot: autoImplementationWorkspaceRoot,
        run
      });
      await writeAutoImplementationRunTrackerState({
        workspaceRoot: autoImplementationWorkspaceRoot,
        run
      });
      await writeAutoImplementationPlanningIssueSequenceTrackerState({
        workspaceRoot: autoImplementationWorkspaceRoot,
        run
      });
      await writeAutoImplementationIssueDocumentsState({
        workspaceRoot: autoImplementationWorkspaceRoot,
        run
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workspace-state synchronization failure.";

      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "Auto implementation workspace state could not be synchronized safely.",
        { runId: run.runId, message }
      );
    }
  }

  async function saveAutoImplementationRunProjection(input: {
    readonly projectionRepository: ReturnType<typeof createProjectionRepository>;
    readonly projectId: ProjectId;
    readonly sessionId: SessionId;
    readonly projection: AutoImplementationRunProjection;
    readonly latestRun: AutoImplementationRun;
    readonly updatedAt: string;
  }) {
    const latestRun = autoImplementationRunWithSynchronizedIssueDocs(input.latestRun);
    const projection = validateAutoImplementationRunProjection({
      ...input.projection,
      latestRun,
      runs: input.projection.runs.map((run) => run.runId === latestRun.runId ? latestRun : run)
    });

    await synchronizeAutoImplementationRunWorkspaceState(latestRun);

    return input.projectionRepository.save({
      projectId: input.projectId,
      sessionId: input.sessionId,
      projection,
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      updatedAt: input.updatedAt
    });
  }

  function assertSupportedReductionPersistence(reduction: ProductEngineReduction) {
    const nextStateVersion = reduction.nextState.stateVersion;

    if (typeof nextStateVersion !== "number" || !Number.isInteger(nextStateVersion) || nextStateVersion < 1) {
      throw new Error("Accepted ProductEngine reductions must provide a positive nextState.stateVersion.");
    }

    for (const output of reduction.deterministicOutputs) {
      switch (output.outputType) {
        case "reducer_deterministic_output":
        case "initial_spec_draft":
        case "ambiguity_analysis":
        case "active_question_batch":
        case "completeness_snapshot":
        case "confidence_map":
        case "founder_brief_draft":
        case "planning_handoff_artifact":
        case "phase25_research_comparison_report":
        case "execution_authority_record":
          break;
        case "spec_version_material":
          throw new Error(`${output.outputType} requires a persistence interpreter before it can be emitted.`);
      }
    }
  }

  function nextSessionPhaseFromEvents(events: readonly ProductEngineEvent[]) {
    return events.reduce<ReturnType<typeof sessionPhaseForProductEngineEvent>>(
      (phase, event) => sessionPhaseForProductEngineEvent(event) ?? phase,
      null
    );
  }

  function synthesisVersionFromEffectInput(input: Readonly<Record<string, unknown>> | null) {
    const runAfter = typeof input?.runAfter === "string" ? input.runAfter : "";
    const match = /^synthesisVersion:(\d+)$/.exec(runAfter);
    const version = match ? Number(match[1]) : 1;

    return Number.isInteger(version) && version > 0 ? version : 1;
  }

  function researchResultIdFromEffectInput(input: Readonly<Record<string, unknown>> | null) {
    const inputRef = input?.inputRef;

    if (!inputRef || typeof inputRef !== "object") {
      return null;
    }

    const ref = inputRef as Readonly<Record<string, unknown>>;

    return ref.refType === "ResearchResult" && typeof ref.refId === "string"
      ? (ref.refId as ResearchResultId)
      : null;
  }

  async function cancelQueuedResearchTaskWait(
    effectRepository: ReturnType<typeof createEffectTaskRepository>,
    researchTaskId: ResearchTaskId,
    updatedAt: string
  ) {
    const waitingEffect = await effectRepository.findByIdempotencyKey(`research:${researchTaskId}`);

    if (!waitingEffect || waitingEffect.status !== "queued") {
      return null;
    }

    return effectRepository.updateStatus({
      effectTaskId: waitingEffect.effectTaskId,
      status: "cancelled",
      updatedAt
    });
  }

  function terminalResearchRunPatchForEvidencePack(pack: DecisionEvidencePackProjection) {
    switch (pack.gateStatus) {
      case "accepted":
        return {
          status: "accepted" as const,
          qualityGateStatus: "passed" as const,
          terminalReason: "quality_gate_accepted" as const
        };
      case "research_insufficient":
        return {
          status: "research_insufficient" as const,
          qualityGateStatus: "insufficient" as const,
          terminalReason: "quality_gate_insufficient" as const
        };
      case "stale":
        return {
          status: "stale" as const,
          qualityGateStatus: "stale" as const,
          terminalReason: "staleness_policy_failed" as const
        };
      case "needs_review":
        return null;
    }
  }

  function qualityGateReviewReasonForEvidencePack(pack: DecisionEvidencePackProjection) {
    return (
      pack.gateChecks.find((check) => check.status === "failed")?.reason ??
      pack.gateChecks.find((check) => check.status === "unknown")?.reason ??
      "Research result requires quality-gate review before EvidenceMatrix acceptance."
    );
  }

  async function ensureResearchRunNeedsReview(
    repository: ReturnType<typeof createResearchRunRepository>,
    run: ResearchRunProjection,
    pack: DecisionEvidencePackProjection,
    occurredAt: string,
    schemaVersion: SchemaVersion
  ) {
    if (run.status === "needs_review") {
      return run;
    }

    if (run.status !== "running") {
      return null;
    }

    const updated = await repository.update({
      run: {
        ...run,
        version: (Number(run.version) + 1) as ProjectionVersion,
        status: "needs_review",
        provider: {
          ...run.provider,
          completedAt: run.provider.completedAt ?? occurredAt
        },
        qualityGateStatus: "pending_review",
        qualityGateReviewReason: qualityGateReviewReasonForEvidencePack(pack),
        updatedAt: occurredAt
      },
      expectedVersion: run.version,
      schemaVersion
    });

    if (!updated) {
      throw new Error("Research run changed before quality-gate review state could be saved.");
    }

    return updated;
  }

  function withoutQualityGateReviewReason(run: ResearchRunProjection): ResearchRunProjection {
    const runWithoutReviewReason = { ...run };

    delete runWithoutReviewReason.qualityGateReviewReason;

    return runWithoutReviewReason;
  }

  async function applyEvidencePackToResearchRun(input: {
    readonly projectId: ProjectId;
    readonly pack: DecisionEvidencePackProjection;
    readonly occurredAt: string;
    readonly schemaVersion: SchemaVersion;
    readonly repository: ReturnType<typeof createResearchRunRepository>;
  }) {
    if (!input.pack.researchRunId) {
      return;
    }

    const current = await input.repository.getById(input.projectId, input.pack.researchRunId);

    if (!current || isTerminalResearchRunStatus(current.status)) {
      return;
    }

    const reviewed = await ensureResearchRunNeedsReview(
      input.repository,
      current,
      input.pack,
      input.occurredAt,
      input.schemaVersion
    );

    if (!reviewed || input.pack.gateStatus === "needs_review") {
      return;
    }

    const terminalPatch = terminalResearchRunPatchForEvidencePack(input.pack);

    if (!terminalPatch) {
      return;
    }
    const reviewedWithoutReviewReason = withoutQualityGateReviewReason(reviewed);

    const updated = await input.repository.update({
      run: {
        ...reviewedWithoutReviewReason,
        version: (Number(reviewed.version) + 1) as ProjectionVersion,
        status: terminalPatch.status,
        qualityGateStatus: terminalPatch.qualityGateStatus,
        terminalReason: terminalPatch.terminalReason,
        updatedAt: input.occurredAt
      },
      expectedVersion: reviewed.version,
      schemaVersion: input.schemaVersion
    });

    if (!updated) {
      throw new Error("Research run changed before quality-gate terminal state could be saved.");
    }
  }

  function runtimePreviewRequestFromEvent(event: ProductEngineEvent) {
    const turnPurpose = typeof event.payload.turnPurpose === "string" ? event.payload.turnPurpose : null;
    const contextHash = typeof event.payload.contextHash === "string" ? event.payload.contextHash : null;
    const prompt = typeof event.payload.prompt === "string" ? event.payload.prompt : null;
    const sourceRefs = Array.isArray(event.payload.sourceRefs)
      ? event.payload.sourceRefs.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];

    if (!turnPurpose || !contextHash || !prompt) {
      return null;
    }

    const requestedActionType =
      typeof event.payload.requestedActionType === "string" ? event.payload.requestedActionType : null;
    const requestedActionReason =
      typeof event.payload.requestedActionReason === "string" ? event.payload.requestedActionReason : null;

    return {
      turnPurpose,
      contextHash,
      prompt,
      sourceRefs,
      targetObject: typeof event.payload.targetObject === "string" ? event.payload.targetObject : turnPurpose,
      ...(requestedActionType ? { requestedActionType } : {}),
      ...(requestedActionReason ? { requestedActionReason } : {})
    };
  }

  function runtimePreviewRequestForEffect(effect: EffectTaskRecord, events: readonly ProductEngineEvent[]) {
    const sourceEvent = events.find(
      (event) => effect.sourceEventIds.includes(event.eventId) && event.eventType === "RuntimePreviewRequested"
    );

    return sourceEvent ? runtimePreviewRequestFromEvent(sourceEvent) : null;
  }

  function codexPreviewInputFromRequest(
    request: NonNullable<ReturnType<typeof runtimePreviewRequestFromEvent>>
  ): CodexRuntimePreviewInput {
    return {
      turnPurpose: request.turnPurpose as CodexTurnPurpose,
      contextHash: request.contextHash,
      prompt: request.prompt,
      sourceRefs: request.sourceRefs,
      targetObject: request.targetObject,
      ...(request.requestedActionType ? { requestedActionType: request.requestedActionType as BlockedActionType } : {}),
      ...(request.requestedActionReason ? { requestedActionReason: request.requestedActionReason } : {})
    };
  }

  function terminalLeaseExpiresAt() {
    return new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  async function runSessionCommandSerialized<TOutput>(
    sessionIdValue: SessionId,
    operation: () => Promise<TOutput>
  ): Promise<TOutput> {
    const previous = sessionCommandQueues.get(sessionIdValue) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);

    sessionCommandQueues.set(sessionIdValue, queued);
    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent();

      if (sessionCommandQueues.get(sessionIdValue) === queued) {
        sessionCommandQueues.delete(sessionIdValue);
      }
    }
  }

  async function stateForSession(projectIdValue: ProjectId, sessionIdValue: SessionId) {
    const events = await createEventRepository(storage.db).listForSession(sessionIdValue);

    return replayProductEngineEvents(projectIdValue, sessionIdValue, events);
  }

  async function persistReduction(
    command: ProductEngineCommand,
    reduction: ProductEngineReduction
  ): Promise<{
    readonly events: readonly ProductEngineEvent[];
    readonly effects: readonly EffectTaskDto[];
    readonly stateVersionAfter: StateVersion;
  }> {
    assertSupportedReductionPersistence(reduction);

    return storage.db.transaction(async (transaction) => {
      const eventRepository = createEventRepository(transaction);
      const effectRepository = createEffectTaskRepository(transaction);
      const projectionRepository = createProjectionRepository(transaction);
      const projectRepository = createProjectRepository(transaction);
      const researchRepository = createResearchRepository(transaction);
      const runtimeRepository = createRuntimeRepository(transaction);
      const planningHandoffRepository = createPlanningHandoffRepository(transaction);
      const phase25ResearchComparisonRepository = createPhase25ResearchComparisonRepository(transaction);
      const executionAuthorityRepository = createExecutionAuthorityRepository(transaction);
      const persistedEvents: ProductEngineEvent[] = [];

      for (const event of reduction.events) {
        persistedEvents.push(
          await eventRepository.append({
            ...event,
            eventId: eventId()
          })
        );
      }

      const nextSessionPhase = nextSessionPhaseFromEvents(persistedEvents);

      if (command.commandType === "StartProject") {
        const startPayload = command.payload as unknown as StartProjectRequest;

        await projectRepository.createProject({
          projectId: command.projectId,
          rawIdeaText: startPayload.rawIdea,
          privacyMode: startPayload.localPrivacyMode,
          now: command.issuedAt
        });
        await projectRepository.createSession({
          projectId: command.projectId,
          sessionId: command.sessionId,
          status: "active",
          currentPhase: nextSessionPhase ?? "intake",
          now: command.issuedAt
        });
      } else if (nextSessionPhase) {
        await projectRepository.updateSessionPhase({
          sessionId: command.sessionId,
          status: "active",
          currentPhase: nextSessionPhase,
          updatedAt: command.issuedAt
        });
      }

      for (const event of persistedEvents) {
        for (const projection of persistedProjectionsFromEvent(event)) {
          await projectionRepository.save({
            projectId: command.projectId,
            sessionId: command.sessionId,
            projection,
            schemaVersion: command.schemaVersion,
            updatedAt: event.occurredAt
          });
        }

        const researchProjection = researchProjectionFromEvent(event);

        if (researchProjection) {
          for (const task of researchProjection.tasks) {
            await researchRepository.saveTask({
              projectId: command.projectId,
              task,
              schemaVersion: command.schemaVersion,
              updatedAt: event.occurredAt
            });
          }

          for (const result of researchProjection.results) {
            await researchRepository.saveResult({
              projectId: command.projectId,
              sessionId: command.sessionId,
              result,
              schemaVersion: command.schemaVersion
            });
          }

          for (const matrix of researchProjection.evidenceMatrices) {
            await researchRepository.saveEvidenceMatrix({
              projectId: command.projectId,
              sessionId: command.sessionId,
              matrix,
              schemaVersion: command.schemaVersion,
              createdAt: event.occurredAt
            });
          }

          for (const pack of researchProjection.evidencePacks) {
            await researchRepository.saveDecisionEvidencePack({
              projectId: command.projectId,
              sessionId: command.sessionId,
              pack,
              schemaVersion: command.schemaVersion
            });
            await applyEvidencePackToResearchRun({
              projectId: command.projectId,
              pack,
              occurredAt: event.occurredAt,
              schemaVersion: command.schemaVersion,
              repository: createResearchRunRepository(transaction)
            });
          }
        }

        for (const artifact of runtimeArtifactsFromEvent(event)) {
          await runtimeRepository.saveArtifact({
            projectId: command.projectId,
            sessionId: command.sessionId,
            artifact,
            schemaVersion: command.schemaVersion
          });
        }

        const planningHandoffProjection = planningHandoffProjectionFromEvent(event);

        if (planningHandoffProjection) {
          await planningHandoffRepository.saveFromProjection({
            projectId: command.projectId,
            sessionId: command.sessionId,
            sourceCommandId: command.commandId,
            sourceEventId: event.eventId,
            sourceStateVersion: command.expectedStateVersion,
            projection: planningHandoffProjection
          });
        }

        const phase25ResearchComparisonProjection = phase25ResearchComparisonProjectionFromEvent(event);

        if (phase25ResearchComparisonProjection) {
          await phase25ResearchComparisonRepository.saveFromProjection({
            projectId: command.projectId,
            sessionId: command.sessionId,
            sourceCommandId: command.commandId,
            sourceEventId: event.eventId,
            sourceStateVersion: command.expectedStateVersion,
            projection: phase25ResearchComparisonProjection
          });
        }

        await persistExecutionAuthorityProjectionForEvent({
          command,
          event,
          repository: executionAuthorityRepository
        });
      }

      if (isPersistedProjection(reduction.immediateProjection)) {
        await projectionRepository.save({
          projectId: command.projectId,
          sessionId: command.sessionId,
          projection: reduction.immediateProjection,
          schemaVersion: command.schemaVersion
        });
      }

      const effects: EffectTaskDto[] = [];

      for (const plannedEffect of reduction.effectPlan) {
        const sourceEvents = persistedEvents.filter((event) =>
          plannedEffect.sourceEventTypes.includes(event.eventType)
        );
        const primarySourceEvent = sourceEvents[0] ?? persistedEvents[0];

        if (!primarySourceEvent) {
          throw new Error(`Effect ${plannedEffect.effectType} has no source ProductEngine event.`);
        }

        const baseIdempotencyKey = effectTaskIdempotencyKey(plannedEffect, primarySourceEvent);
        const existingEffect =
          plannedEffect.effectType === "codex_runtime_preview_effect"
            ? await effectRepository.findByIdempotencyKey(baseIdempotencyKey)
            : null;
        const createdEffect = await effectRepository.create({
          effectTaskId: effectTaskId(),
          effectType: plannedEffect.effectType,
          projectId: command.projectId,
          sessionId: command.sessionId,
          sourceEventId: primarySourceEvent.eventId,
          sourceEventIds: sourceEvents.length ? sourceEvents.map((event) => event.eventId) : [primarySourceEvent.eventId],
          sourceCommandId: command.commandId,
          correlationId: command.correlationId,
          idempotencyKey:
            existingEffect && !isPendingEffect(existingEffect)
              ? `${baseIdempotencyKey}:retry:${primarySourceEvent.eventId}`
              : baseIdempotencyKey,
          maxAttempts: maxAttemptsFor(plannedEffect),
          input: {
            inputRef: plannedEffect.inputRef,
            previewPolicy: plannedEffect.previewPolicy,
            sourceEventTypes: plannedEffect.sourceEventTypes,
            ...(plannedEffect.runAfter ? { runAfter: plannedEffect.runAfter } : {})
          },
          schemaVersion: command.schemaVersion
        });
        effects.push(createdEffect);
      }

      return {
        events: persistedEvents,
        effects,
        stateVersionAfter: (Number(command.expectedStateVersion) + persistedEvents.length) as StateVersion
      };
    });
  }

  async function runCommand(command: ProductEngineCommand, existingEvents: readonly ProductEngineEvent[]) {
    const state = replayProductEngineEvents(command.projectId, command.sessionId, existingEvents);
    const reduction = reduceProductEngineCommand(command, state);

    if (!reduction.accepted) {
      return responseForRejected(command, state.stateVersion, reduction);
    }

    const effectRepository = createEffectTaskRepository(storage.db);

    for (const plannedEffect of reduction.effectPlan) {
      if (plannedEffect.effectType !== "research_evidence_effect" && plannedEffect.effectType !== "codex_runtime_preview_effect") {
        continue;
      }

      const idempotencyKey =
        plannedEffect.effectType === "codex_runtime_preview_effect"
          ? plannedEffect.idempotencyKey
          : plannedEffect.inputRef.refType === "ResearchTask" || plannedEffect.inputRef.refType === "ResearchResult"
          ? plannedEffect.idempotencyKey
          : `research:${plannedEffect.inputRef.refId}`;

      const existingEffect = await effectRepository.findByIdempotencyKey(idempotencyKey);

      if (existingEffect && (plannedEffect.effectType !== "codex_runtime_preview_effect" || isPendingEffect(existingEffect))) {
        return responseForIdempotencyConflict(command, state.stateVersion, idempotencyKey);
      }
    }

    const result = await persistReduction(command, reduction);

    return responseForAccepted(
      command,
      state.stateVersion,
      result.stateVersionAfter,
      result.events,
      result.effects,
      reduction
    );
  }

  async function writeResearchMemoryForMatrix(input: {
    readonly state: ProductEngineStateSnapshot;
    readonly matrix: ProductEngineStateSnapshot["researchState"]["evidenceMatrices"][number];
  }) {
    const { matrix, state } = input;
    const task = state.researchState.tasks.find((candidate) => candidate.researchTaskId === matrix.researchTaskId);
    const result = state.researchState.results.find((candidate) => candidate.researchResultId === matrix.researchResultId);

    if (!task || !result) {
      throw new Error("Research memory markdown requires the synthesized task and result.");
    }

    const pack = state.researchState.evidencePacks.find(
      (candidate) =>
        candidate.researchTaskId === matrix.researchTaskId &&
        candidate.researchResultId === matrix.researchResultId
    );

    return writeResearchMemoryMarkdown({
      root: researchMemoryMarkdownRoot,
      projectId: state.project.projectId,
      sessionId: state.session.sessionId,
      task,
      result,
      matrix,
      pack
    });
  }

  async function runResearchEvidenceEffect(effect: EffectTaskRecord) {
    const effectRepository = createEffectTaskRepository(storage.db);
    const input = await effectRepository.getInput(effect.effectTaskId);
    const researchResultId = researchResultIdFromEffectInput(input);

    if (!researchResultId) {
      return {
        effectTaskId: effect.effectTaskId,
        status: "skipped" as const,
        reason: "research_evidence_effect is waiting for a ResearchResult input."
      };
    }

    const attemptCount = effect.attemptCount + 1;

    await effectRepository.updateStatus({
      effectTaskId: effect.effectTaskId,
      status: "running",
      attemptCount,
      leaseOwner: "research-evidence-effect-executor",
      leaseExpiresAt: terminalLeaseExpiresAt()
    });

    try {
      const existingEvents = await createEventRepository(storage.db).listForSession(effect.sessionId);
      const currentState = replayProductEngineEvents(effect.projectId, effect.sessionId, existingEvents);
      const synthesisVersion = synthesisVersionFromEffectInput(input);
      const alreadySynthesized = currentState.researchState.evidenceMatrices.find(
        (candidate) =>
          candidate.researchResultId === researchResultId && candidate.synthesisVersion === synthesisVersion
      );

      if (alreadySynthesized) {
        if (alreadySynthesized.balanceStatus === "source_quality_insufficient") {
          await cancelQueuedResearchTaskWait(
            effectRepository,
            alreadySynthesized.researchTaskId,
            new Date().toISOString()
          );
          await effectRepository.updateStatus({
            effectTaskId: effect.effectTaskId,
            status: "failed",
            attemptCount: effect.maxAttempts,
            error: {
              code: "RESEARCH_SOURCE_QUALITY_INSUFFICIENT",
              message: "Research synthesis could not produce usable pro/con evidence from the retained result.",
              retryAvailable: false
            }
          });

          return {
            effectTaskId: effect.effectTaskId,
            status: "failed" as const,
            balanceStatus: alreadySynthesized.balanceStatus
          };
        }

        await cancelQueuedResearchTaskWait(
          effectRepository,
          alreadySynthesized.researchTaskId,
          new Date().toISOString()
        );
        const memoryMarkdown = await writeResearchMemoryForMatrix({
          state: currentState,
          matrix: alreadySynthesized
        });
        await effectRepository.updateStatus({
          effectTaskId: effect.effectTaskId,
          status: "succeeded",
          attemptCount,
          output: {
            evidenceMatrixId: alreadySynthesized.evidenceMatrixId,
            balanceStatus: alreadySynthesized.balanceStatus,
            researchMemoryMarkdownPath: memoryMarkdown.relativePath
          }
        });

        return {
          effectTaskId: effect.effectTaskId,
          status: "succeeded" as const,
          balanceStatus: alreadySynthesized.balanceStatus,
          researchMemoryMarkdownPath: memoryMarkdown.relativePath
        };
      }

      const command: ProductEngineCommand = {
        commandId: commandId(),
        commandType: "SynthesizeEvidence",
        projectId: effect.projectId,
        sessionId: effect.sessionId,
        actor: "effect_executor",
        issuedAt: new Date().toISOString(),
        idempotencyKey: `EffectExecutor:${effect.idempotencyKey}`,
        expectedStateVersion: currentState.stateVersion,
        causationId: (effect.sourceEventIds[0] ?? null) as CausationId | null,
        correlationId: effect.correlationId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: {
          researchResultId,
          synthesisVersion,
          sourceEffectTaskId: effect.effectTaskId
        }
      };
      const response = await runCommand(command, existingEvents);

      if (response.category === "rejected") {
        throw new Error(response.error?.message ?? "Effect executor command was rejected.");
      }

      const stateAfter = await stateForSession(effect.projectId, effect.sessionId);
      const matrix = stateAfter.researchState.evidenceMatrices.find(
        (candidate) =>
          candidate.researchResultId === researchResultId && candidate.synthesisVersion === synthesisVersion
      );

      if (!matrix) {
        throw new Error("Effect executor did not persist an EvidenceMatrix.");
      }

      if (matrix.balanceStatus === "source_quality_insufficient") {
        await cancelQueuedResearchTaskWait(
          effectRepository,
          matrix.researchTaskId,
          new Date().toISOString()
        );
        await effectRepository.updateStatus({
          effectTaskId: effect.effectTaskId,
          status: "failed",
          attemptCount: effect.maxAttempts,
          error: {
            code: "RESEARCH_SOURCE_QUALITY_INSUFFICIENT",
            message: "Research synthesis could not produce usable pro/con evidence from the retained result.",
            retryAvailable: false
          }
        });

        return {
          effectTaskId: effect.effectTaskId,
          status: "failed" as const,
          balanceStatus: matrix.balanceStatus
        };
      }

      await cancelQueuedResearchTaskWait(
        effectRepository,
        matrix.researchTaskId,
        new Date().toISOString()
      );
      const memoryMarkdown = await writeResearchMemoryForMatrix({
        state: stateAfter,
        matrix
      });
      await effectRepository.updateStatus({
        effectTaskId: effect.effectTaskId,
        status: "succeeded",
        attemptCount,
        output: {
          evidenceMatrixId: matrix.evidenceMatrixId,
          balanceStatus: matrix.balanceStatus,
          researchMemoryMarkdownPath: memoryMarkdown.relativePath
        }
      });

      return {
        effectTaskId: effect.effectTaskId,
        status: "succeeded" as const,
        balanceStatus: matrix.balanceStatus,
        researchMemoryMarkdownPath: memoryMarkdown.relativePath
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research evidence effect failed.";

      if (attemptCount < effect.maxAttempts) {
        await effectRepository.updateStatus({
          effectTaskId: effect.effectTaskId,
          status: "queued",
          attemptCount
        });

        return {
          effectTaskId: effect.effectTaskId,
          status: "queued" as const,
          error: message
        };
      }

      await effectRepository.updateStatus({
        effectTaskId: effect.effectTaskId,
        status: "failed",
        attemptCount,
        error: {
          code: "RESEARCH_EFFECT_EXECUTION_FAILED",
          message,
          retryAvailable: false
        }
      });

      return {
        effectTaskId: effect.effectTaskId,
        status: "failed" as const,
        error: message
      };
    }
  }

  async function codexRuntimeSourceForPreview(input: CodexRuntimePreviewInput): Promise<CodexRuntimeSource> {
    if (input.requestedActionType) {
      return "protocol_fixture";
    }

    const status = await codexRuntimeAdapter.getStatus();

    return status.executionMode === "live" ? "codex_app_server" : "protocol_fixture";
  }

  async function runCodexRuntimePreviewEffect(effect: EffectTaskRecord) {
    const effectRepository = createEffectTaskRepository(storage.db);
    const attemptCount = effect.attemptCount + 1;

    await effectRepository.updateStatus({
      effectTaskId: effect.effectTaskId,
      status: "running",
      attemptCount,
      leaseOwner: "codex-runtime-preview-effect-executor",
      leaseExpiresAt: terminalLeaseExpiresAt()
    });

    try {
      const existingEvents = await createEventRepository(storage.db).listForSession(effect.sessionId);
      const currentState = replayProductEngineEvents(effect.projectId, effect.sessionId, existingEvents);
      const request = runtimePreviewRequestForEffect(effect, existingEvents);

      if (!request) {
        throw new Error("codex_runtime_preview_effect requires a RuntimePreviewRequested source event.");
      }

      const previewInput = codexPreviewInputFromRequest(request);
      const issuedAt = new Date().toISOString();
      const previewSource = await codexRuntimeSourceForPreview(previewInput);
      const previewOutput = previewInput.requestedActionType
        ? fixtureCodexPreviewOutput(previewInput, { createdAt: issuedAt })
        : await codexRuntimeAdapter.createPreview(previewInput);
      assertCodexPreviewOutputMatchesInput(previewInput, previewOutput);
      const command: ProductEngineCommand = {
        commandId: commandId(),
        commandType: "CreateRuntimePreview",
        projectId: effect.projectId,
        sessionId: effect.sessionId,
        actor: "effect_executor",
        issuedAt,
        idempotencyKey: `EffectExecutor:${effect.idempotencyKey}`,
        expectedStateVersion: currentState.stateVersion,
        causationId: (effect.sourceEventIds[0] ?? null) as CausationId | null,
        correlationId: effect.correlationId,
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: {
          source: previewSource,
          sourceEffectTaskId: effect.effectTaskId,
          runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
          turnPurpose: previewOutput.turnPurpose,
          contextHash: request.contextHash,
          prompt: request.prompt,
          summary: previewOutput.summary,
          body: previewOutput.payload.body,
          sourceRefs: previewOutput.payload.sourceRefs,
          targetObject: previewOutput.payload.targetObject,
          artifactKind: previewOutput.artifactKind,
          applyPolicy: previewOutput.applyPolicy,
          ...(previewOutput.payload.blockedAction
            ? {
                blockedActionType: previewOutput.payload.blockedAction.actionType,
                blockedActionReason: previewOutput.payload.blockedAction.reason,
                suggestedSafeAlternative: previewOutput.payload.blockedAction.suggestedSafeAlternative
              }
            : {}),
          ...(previewOutput.payload.phase15bUpgradeHints
            ? { phase15bUpgradeHints: previewOutput.payload.phase15bUpgradeHints }
            : {})
        }
      };
      const response = await runCommand(command, existingEvents);

      if (response.category === "rejected") {
        throw new Error(response.error?.message ?? "Codex runtime effect executor command was rejected.");
      }

      const stateAfter = await stateForSession(effect.projectId, effect.sessionId);
      const artifact = stateAfter.runtimeState.runtimeArtifacts.find(
        (candidate) => candidate.sourceEffectTaskId === effect.effectTaskId
      );

      if (!artifact) {
        throw new Error("Codex runtime effect did not persist a RuntimePreviewArtifact.");
      }

      if (artifact.blockedAction) {
        await effectRepository.updateStatus({
          effectTaskId: effect.effectTaskId,
          status: "blocked",
          attemptCount,
          output: {
            artifactId: artifact.artifactId,
            blockedActionType: artifact.blockedAction.actionType
          },
          error: {
            code: "RUNTIME_ACTION_BLOCKED",
            message: artifact.blockedAction.reason,
            retryAvailable: false
          }
        });

        return {
          effectTaskId: effect.effectTaskId,
          status: "blocked" as const,
          artifactId: artifact.artifactId,
          blockedActionType: artifact.blockedAction.actionType
        };
      }

      await effectRepository.updateStatus({
        effectTaskId: effect.effectTaskId,
        status: "succeeded",
        attemptCount,
        output: {
          artifactId: artifact.artifactId,
          kind: artifact.kind,
          applyPolicy: artifact.applyPolicy
        }
      });

      return {
        effectTaskId: effect.effectTaskId,
        status: "succeeded" as const,
        artifactId: artifact.artifactId,
        kind: artifact.kind
      };
    } catch (error) {
      const isUnavailable = error instanceof CodexRuntimeUnavailableError;
      const message = error instanceof Error ? error.message : "Codex runtime preview effect failed.";

      if (isUnavailable) {
        const existingEvents = await createEventRepository(storage.db).listForSession(effect.sessionId);
        const currentState = replayProductEngineEvents(effect.projectId, effect.sessionId, existingEvents);
        const request = runtimePreviewRequestForEffect(effect, existingEvents);

        if (!request) {
          throw error;
        }

        const command: ProductEngineCommand = {
          commandId: commandId(),
          commandType: "CreateRuntimePreview",
          projectId: effect.projectId,
          sessionId: effect.sessionId,
          actor: "effect_executor",
          issuedAt: new Date().toISOString(),
          idempotencyKey: `ManualHandoff:${effect.idempotencyKey}`,
          expectedStateVersion: currentState.stateVersion,
          causationId: (effect.sourceEventIds[0] ?? null) as CausationId | null,
          correlationId: effect.correlationId,
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          payload: {
            source: "manual_prompt_handoff",
            sourceEffectTaskId: effect.effectTaskId,
            runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
            turnPurpose: request.turnPurpose,
            contextHash: request.contextHash,
            prompt: request.prompt,
            summary: "Manual handoff prompt ready",
            body: request.prompt,
            sourceRefs: request.sourceRefs,
            targetObject: request.targetObject,
            artifactKind: request.turnPurpose === "implementation_plan_preview" ? "ImplementationPlanPreviewArtifact" : undefined,
            applyPolicy: "manual_handoff_required"
          }
        };
        const response = await runCommand(command, existingEvents);

        if (response.category === "rejected") {
          throw new Error(response.error?.message ?? "Manual handoff fallback command was rejected.", {
            cause: error
          });
        }

        const stateAfter = await stateForSession(effect.projectId, effect.sessionId);
        const artifact = stateAfter.runtimeState.runtimeArtifacts.find(
          (candidate) => candidate.sourceEffectTaskId === effect.effectTaskId
        );

        if (!artifact) {
          throw new Error("Manual handoff fallback did not persist a RuntimePreviewArtifact.", {
            cause: error
          });
        }

        await effectRepository.updateStatus({
          effectTaskId: effect.effectTaskId,
          status: "succeeded",
          attemptCount,
          output: {
            artifactId: artifact.artifactId,
            fallback: "manual_prompt_handoff",
            reason: message
          }
        });

        return {
          effectTaskId: effect.effectTaskId,
          status: "succeeded" as const,
          artifactId: artifact.artifactId,
          fallback: "manual_prompt_handoff"
        };
      }

      await effectRepository.updateStatus({
        effectTaskId: effect.effectTaskId,
        status: "failed",
        attemptCount: effect.maxAttempts,
        error: {
          code: "CODEX_RUNTIME_PREVIEW_FAILED",
          message,
          retryAvailable: false
        }
      });

      return {
        effectTaskId: effect.effectTaskId,
        status: "failed" as const,
        error: message
      };
    }
  }

  async function commandForExistingSession(input: RunSessionCommandInput, actor: CommandActor = "user") {
    const projectRepository = createProjectRepository(storage.db);
    const session = await projectRepository.getSession(input.sessionId);

    if (!session) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
        sessionId: input.sessionId
      });
    }

    const events = await createEventRepository(storage.db).listForSession(input.sessionId);
    const lastEvent = latestEvent(events);

    return {
      command: {
        commandId: commandId(),
        commandType: input.commandType,
        projectId: session.projectId,
        sessionId: input.sessionId,
        actor,
        issuedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey ?? `${input.commandType}:${input.sessionId}:${input.expectedStateVersion}`,
        expectedStateVersion: input.expectedStateVersion,
        causationId: (lastEvent?.eventId ?? null) as CausationId | null,
        correlationId: lastEvent?.correlationId ?? correlationId(),
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: input.payload
      } satisfies ProductEngineCommand,
      events
    };
  }

  async function requireProject(projectIdValue: ProjectId) {
    const project = await createProjectRepository(storage.db).getProject(projectIdValue);

    if (!project) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Project was not found.", {
        projectId: projectIdValue
      });
    }

    return project;
  }

  function assertRequestProjectMatchesRoute(projectIdValue: ProjectId, requestProjectId: ProjectId | undefined) {
    if (requestProjectId && requestProjectId !== projectIdValue) {
      throw new ProductEngineServiceError("VALIDATION_FAILED", "projectId must match the route param.", {
        routeProjectId: projectIdValue,
        bodyProjectId: requestProjectId
      });
    }
  }

  function requireNonEmptyList<TValue>(values: readonly TValue[] | undefined, fieldName: string): readonly TValue[] {
    if (!values?.length) {
      throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must include at least one value.`);
    }

    return values;
  }

  function validationError(error: unknown) {
    if (error instanceof ProductEngineServiceError) {
      return error;
    }

    if (error instanceof ResearchAllowlistValidationError) {
      return new ProductEngineServiceError("VALIDATION_FAILED", error.message);
    }

    if (error instanceof ResearchRunValidationError) {
      return new ProductEngineServiceError("VALIDATION_FAILED", error.message);
    }

    throw error;
  }

  async function listProjectAllowlists(projectIdValue: ProjectId) {
    return createResearchAllowlistRepository(storage.db).listForProject(projectIdValue);
  }

  async function allowlistCollectionStateVersion(projectIdValue: ProjectId) {
    return allowlistCollectionVersion(await listProjectAllowlists(projectIdValue)) as unknown as StateVersion;
  }

  async function listAllowlistProjection(projectIdValue: ProjectId, selectedAllowlist?: ResearchAllowlistProjection) {
    const allowlists = await listProjectAllowlists(projectIdValue);

    return allowlistGovernanceProjection(projectIdValue, allowlists, new Date().toISOString(), selectedAllowlist);
  }

  async function listProjectDisclosureLogs(projectIdValue: ProjectId) {
    return createResearchDisclosureLogRepository(storage.db).listForProject(projectIdValue);
  }

  async function listDisclosureProjection(projectIdValue: ProjectId, latestDisclosureLog?: ResearchDisclosureLogEntry) {
    const logs = await listProjectDisclosureLogs(projectIdValue);

    return disclosureProjection(projectIdValue, logs, new Date().toISOString(), latestDisclosureLog ?? logs.at(-1));
  }

  async function listProjectResearchRuns(projectIdValue: ProjectId) {
    return createResearchRunRepository(storage.db).listForProject(projectIdValue);
  }

  async function researchRunCollectionStateVersion(projectIdValue: ProjectId) {
    return researchRunCollectionVersion(await listProjectResearchRuns(projectIdValue)) as unknown as StateVersion;
  }

  async function listResearchRunProjection(projectIdValue: ProjectId, selectedRun?: ResearchRunProjection) {
    return researchRunControlProjection(
      projectIdValue,
      await listProjectResearchRuns(projectIdValue),
      new Date().toISOString(),
      selectedRun
    );
  }

  async function pollReadyProjectResearchRuns(projectIdValue: ProjectId) {
    const runs = await listProjectResearchRuns(projectIdValue);

    for (const run of runs) {
      await pollMountedResearchRunResultIfReady(run);
    }
  }

  async function readPhase15bHintCollection(projectIdValue: ProjectId) {
    const repository = createPhase15bUpgradeHintRepository(storage.db);

    return {
      records: await repository.listForProject(projectIdValue),
      version: await repository.collectionVersion(projectIdValue),
      generatedAt: new Date().toISOString()
    };
  }

  async function listPhase15bHintProjection(projectIdValue: ProjectId) {
    const collection = await readPhase15bHintCollection(projectIdValue);

    return buildPhase15bHintProjection(
      projectIdValue,
      collection.records,
      collection.generatedAt,
      collection.version
    );
  }

  async function exportPhase15bHintProjection(projectIdValue: ProjectId) {
    const collection = await readPhase15bHintCollection(projectIdValue);

    return buildPhase15bHintExport(
      projectIdValue,
      collection.records,
      collection.generatedAt,
      collection.version
    );
  }

  async function findProjectResearchRun(projectIdValue: ProjectId, researchRunIdValue: ResearchRunId) {
    const run = await createResearchRunRepository(storage.db).getById(projectIdValue, researchRunIdValue);

    if (!run) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Research run was not found.", {
        projectId: projectIdValue,
        researchRunId: researchRunIdValue
      });
    }

    return run;
  }

  async function findDisclosureLogForRun(run: ResearchRunProjection) {
    const logs = await listProjectDisclosureLogs(run.projectId);

    return logs.find((log) => log.logId === run.disclosureLogId) ?? null;
  }

  async function pauseResearchRunsForAllowlist(
    projectIdValue: ProjectId,
    allowlistIdValue: ResearchAllowlistId,
    pausedAt: string,
    reason: string
  ) {
    const repository = createResearchRunRepository(storage.db);
    const activeRuns = (await repository.listForProject(projectIdValue)).filter(
      (run) => run.allowlistId === allowlistIdValue && (run.status === "queued" || run.status === "running")
    );

    for (const run of activeRuns) {
      if (run.status === "running") {
        await cancelResearchRunWithMountedAdapter(run, reason);
        continue;
      }

      const updated = await repository.update({
        run: {
          ...run,
          version: (Number(run.version) + 1) as ProjectionVersion,
          status: "paused",
          updatedAt: pausedAt
        },
        expectedVersion: run.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      if (!updated) {
        throw new ProductEngineServiceError(
          "COMMAND_PRECONDITION_FAILED",
          "Research run changed before allowlist pause recovery could be saved; refetch and retry.",
          {
            projectId: projectIdValue,
            allowlistId: allowlistIdValue,
            researchRunId: run.researchRunId
          }
        );
      }
    }
  }

  async function resumePausedResearchRunsForAllowlist(
    projectIdValue: ProjectId,
    allowlist: ResearchAllowlistProjection,
    resumedAt: string
  ) {
    const repository = createResearchRunRepository(storage.db);
    const pausedRuns = (await repository.listForProject(projectIdValue)).filter(
      (run) => run.allowlistId === allowlist.allowlistId && run.status === "paused"
    );

    for (const run of pausedRuns) {
      if (!allowlistPermitsResearchRun(allowlist, run)) {
        await cancelResearchRunWithMountedAdapter(
          run,
          "Research allowlist was reactivated with policy that no longer permits this paused run; restart with fresh approval if needed."
        );
        continue;
      }

      const disclosureLog = await findDisclosureLogForRun(run);
      const resumed = await repository.update({
        run: {
          ...run,
          version: (Number(run.version) + 1) as ProjectionVersion,
          status: "queued",
          updatedAt: resumedAt
        },
        expectedVersion: run.version,
        schemaVersion: CONTRACT_SCHEMA_VERSION
      });

      if (!resumed) {
        throw new ProductEngineServiceError(
          "COMMAND_PRECONDITION_FAILED",
          "Research run changed before allowlist resume recovery could be saved; refetch and retry.",
          {
            projectId: projectIdValue,
            allowlistId: allowlist.allowlistId,
            researchRunId: run.researchRunId
          }
        );
      }

      await startMountedResearchRunIfQueued(resumed, {
        researchObjective: disclosureLog?.researchObjective ?? resumed.researchTaskId,
        publicSafeSummary:
          disclosureLog?.publicSafeSummarySent ?? "Resumed allowlisted run uses the prior public-safe disclosure summary."
      });
    }
  }

  async function cancelActiveResearchRunsForRevokedAllowlist(
    projectIdValue: ProjectId,
    allowlistIdValue: ResearchAllowlistId,
    reason: string
  ) {
    const repository = createResearchRunRepository(storage.db);
    const activeRuns = (await repository.listForProject(projectIdValue)).filter(
      (run) =>
        run.allowlistId === allowlistIdValue &&
        (run.status === "queued" || run.status === "running" || run.status === "paused")
    );

    for (const run of activeRuns) {
      await cancelResearchRunWithMountedAdapter(run, reason);
    }
  }

  function allowlistVersionAfter(allowlist: ResearchAllowlistProjection | null) {
    return ((allowlist ? Number(allowlist.version) : 0) + 1) as ProjectionVersion;
  }

  function isManualResearchSourceCategory(
    sourceCategory: ResearchSourceCategory
  ): sourceCategory is Exclude<ResearchSourceCategory, AutomaticResearchSourceCategory> {
    return MANUAL_RESEARCH_SOURCE_CATEGORIES.includes(sourceCategory as (typeof MANUAL_RESEARCH_SOURCE_CATEGORIES)[number]);
  }

  function automaticResearchSourceCategoryOrNull(
    sourceCategory: ResearchSourceCategory
  ): AutomaticResearchSourceCategory | null {
    return isManualResearchSourceCategory(sourceCategory) ? null : sourceCategory;
  }

  function allowlistIncludesSourceCategory(
    allowlist: ResearchAllowlistProjection,
    sourceCategory: ResearchSourceCategory
  ) {
    const automaticSourceCategory = automaticResearchSourceCategoryOrNull(sourceCategory);

    return automaticSourceCategory ? allowlist.sourceCategories.includes(automaticSourceCategory) : false;
  }

  function allowlistPermitsResearchRun(allowlist: ResearchAllowlistProjection, run: ResearchRunProjection) {
    return (
      allowlist.status === "active" &&
      allowlist.connectorIds.includes(run.connectorId) &&
      allowlistIncludesSourceCategory(allowlist, run.sourceCategory)
    );
  }

  function sourceRefsFromDisclosureRequest(request: PrepareResearchDisclosureRequest) {
    return [
      ...new Set(
        (request.sourceRefs ?? [])
          .map((sourceRef) =>
            isResearchMemoryMarkdownSourceRef(sourceRef)
              ? sourceRef
              : redactPublicSafeResearchText(sourceRef, request)
          )
          .filter(Boolean)
      )
    ];
  }

  function manualHandoffReason(blockReason: ResearchDisclosureBlockReason, sourceCategory: ResearchSourceCategory) {
    switch (blockReason) {
      case "manual_source_category":
        return `${sourceCategory} requires task-level approval or manual handoff.`;
      case "private_context_material":
        return "Raw idea, detailed answers, private documents, contacts, private customer names, or unreleased partner names require task-level approval or manual handoff.";
      case "allowlist_missing":
        return "No active allowlist matches this disclosure request; create or reactivate an allowlist before automatic research.";
      case "allowlist_paused":
        return "The selected research allowlist is paused; resume with fresh approval before automatic research.";
      case "allowlist_revoked":
        return "The selected research allowlist is revoked and cannot authorize automatic research.";
      case "connector_not_allowed":
        return "The selected connector is not approved by the active allowlist.";
      case "source_category_not_allowed":
        return "The selected source category is not approved by the active allowlist.";
    }
  }

  function blockReasonForDisclosure(
    request: PrepareResearchDisclosureRequest,
    allowlist: ResearchAllowlistProjection | null
  ): ResearchDisclosureBlockReason | null {
    if (isManualResearchSourceCategory(request.sourceCategory)) {
      return "manual_source_category";
    }

    if (containsPrivateResearchContext(request)) {
      return "private_context_material";
    }

    if (!allowlist) {
      return "allowlist_missing";
    }

    if (allowlist.status === "paused") {
      return "allowlist_paused";
    }

    if (allowlist.status === "revoked") {
      return "allowlist_revoked";
    }

    if (!allowlist.connectorIds.includes(request.connectorId)) {
      return "connector_not_allowed";
    }

    return allowlistIncludesSourceCategory(allowlist, request.sourceCategory) ? null : "source_category_not_allowed";
  }

  function researchDisclosureLogFromRequest(
    projectIdValue: ProjectId,
    request: PrepareResearchDisclosureRequest,
    publicSafePayload: PublicSafeResearchDisclosurePayload,
    allowlist: ResearchAllowlistProjection | null,
    blockReason: ResearchDisclosureBlockReason | null,
    now: string
  ): ResearchDisclosureLogEntry {
    const manualReason = blockReason ? manualHandoffReason(blockReason, request.sourceCategory) : null;

    return {
      logId: researchDisclosureLogId(),
      projectId: projectIdValue,
      ...(allowlist ? { allowlistId: allowlist.allowlistId } : {}),
      connectorId: request.connectorId,
      sourceCategory: request.sourceCategory,
      researchObjective: publicSafePayload.researchObjective,
      objectiveSummary: publicSafePayload.researchObjective,
      publicSafeSummarySent: publicSafePayload.publicSafeSummary,
      sourceRefs: sourceRefsFromDisclosureRequest(request),
      automaticExternalTransferAllowed: blockReason === null,
      status: blockReason === null ? "automatic_payload_ready" : "blocked_manual_handoff",
      ...(blockReason ? { blockReason, manualHandoffReason: manualReason ?? "Manual handoff required." } : {}),
      createdAt: now
    } satisfies ResearchDisclosureLogEntry;
  }

  function assertRequestResearchRunProjectMatchesRoute(projectIdValue: ProjectId, requestProjectId: ProjectId | undefined) {
    assertRequestProjectMatchesRoute(projectIdValue, requestProjectId);
  }

  function isKnownResearchAdapterKind(value: string): value is NonNullable<StartResearchRunRequest["adapterKind"]> {
    return (BACKGROUND_RESEARCH_ADAPTER_KINDS as readonly string[]).includes(value);
  }

  function isMountedResearchAdapterKind(
    value: NonNullable<StartResearchRunRequest["adapterKind"]>
  ): value is MountedResearchAdapterKind {
    return (MOUNTED_RESEARCH_ADAPTER_KINDS as readonly string[]).includes(value);
  }

  function defaultResearchAdapterKindForSourceCategory(
    sourceCategory: StartResearchRunRequest["sourceCategory"]
  ): MountedResearchAdapterKind {
    return sourceCategory === "public_web" ? "web_search_readonly" : "local_fake_readonly";
  }

  function effectiveResearchAdapterKind(request: StartResearchRunRequest): NonNullable<StartResearchRunRequest["adapterKind"]> {
    return request.adapterKind ?? defaultResearchAdapterKindForSourceCategory(request.sourceCategory);
  }

  function createMountedResearchAdapter(adapterKind: MountedResearchAdapterKind): BackgroundResearchRuntimeAdapter {
    if (researchRuntimeAdapterFactory) {
      return researchRuntimeAdapterFactory(adapterKind);
    }

    return adapterKind === "web_search_readonly"
      ? createWebSearchReadOnlyResearchAdapter(webSearchReadOnlyResearchAdapterOptionsFromEnv())
      : createFakeReadOnlyResearchAdapter();
  }

  function mountedResearchSourceCategoryBlocker(
    adapterKind: MountedResearchAdapterKind,
    sourceCategory: ResearchSourceCategory | AutomaticResearchSourceCategory | undefined
  ) {
    return adapterKind === "web_search_readonly" && sourceCategory !== "public_web"
      ? "The web_search_readonly adapter only supports public_web read-only sources."
      : null;
  }

  function mountedResearchAdapterConfigBlocker(adapterKind: MountedResearchAdapterKind) {
    if (adapterKind !== "web_search_readonly") {
      return null;
    }

    try {
      webSearchReadOnlyResearchAdapterOptionsFromEnv();

      return null;
    } catch (error) {
      return `The web_search_readonly adapter is unavailable: ${webSearchReadOnlyAdapterFailureMessage(error)}`;
    }
  }

  function mountedResearchAdapterBlocker(request: StartResearchRunRequest) {
    const adapterKind = effectiveResearchAdapterKind(request);

    if (!isMountedResearchAdapterKind(adapterKind)) {
      return "Requested adapter is not mounted in the local sidecar.";
    }

    return (
      mountedResearchSourceCategoryBlocker(adapterKind, request.sourceCategory) ??
      mountedResearchAdapterConfigBlocker(adapterKind)
    );
  }

  function mountedResearchRunAdapterBlocker(run: ResearchRunProjection) {
    const adapterKind = run.provider.adapterKind;

    if (!isMountedResearchAdapterKind(adapterKind)) {
      return "Requested research adapter is not mounted in the local sidecar.";
    }

    return (
      mountedResearchSourceCategoryBlocker(adapterKind, run.sourceCategory) ??
      mountedResearchAdapterConfigBlocker(adapterKind)
    );
  }

  function contextHashFromPublicSafePayload(
    request: Pick<StartResearchRunRequest, "contextHash" | "sourceRefs">,
    publicSafePayload: PublicSafeResearchDisclosurePayload
  ) {
    if (request.contextHash?.trim()) {
      return request.contextHash.trim();
    }

    return `sha256:${createHash("sha256")
      .update(publicSafePayload.researchObjective)
      .update("\0")
      .update(publicSafePayload.publicSafeSummary)
      .update("\0")
      .update((request.sourceRefs ?? []).join("\0"))
      .digest("hex")
      .slice(0, 32)}`;
  }

  function researchObjectiveRequestsExistingMemoryBaseline(request: Pick<StartResearchRunRequest, "researchObjective">) {
    return RESEARCH_MEMORY_BASELINE_OBJECTIVE_PATTERN.test(request.researchObjective);
  }

  async function requestWithResearchMemorySourceRefs(
    projectIdValue: ProjectId,
    request: StartResearchRunRequest
  ): Promise<StartResearchRunRequest> {
    if (!researchObjectiveRequestsExistingMemoryBaseline(request)) {
      return request;
    }

    const task = await createResearchRepository(storage.db).getTask(request.researchTaskId);
    const memorySourceRefs = await listResearchMemoryMarkdownSourceRefs({
      root: researchMemoryMarkdownRoot,
      projectId: projectIdValue,
      ...(task?.sessionId ? { sessionId: task.sessionId } : {})
    });

    if (!memorySourceRefs.length) {
      return request;
    }

    return {
      ...request,
      sourceRefs: [...new Set([...(request.sourceRefs ?? []), ...memorySourceRefs])]
    };
  }

  function decodedIdempotencyKeyPart(idempotencyKey: string, fieldName: string) {
    const match =
      fieldName === "context"
        ? /context=(.*):allowlistVersion=/.exec(idempotencyKey)
        : new RegExp(`${fieldName}=([^:]+)`).exec(idempotencyKey);

    if (!match?.[1]) {
      return null;
    }

    return decodeURIComponent(match[1].replaceAll("+", "%20"));
  }

  function attemptRetryBackoffSeconds(allowlist: ResearchAllowlistProjection, nextAttempt: number) {
    const index = Math.max(0, nextAttempt - 2);

    return allowlist.rateBudgetPolicy.retryBackoffSeconds[index] ?? allowlist.rateBudgetPolicy.retryBackoffSeconds.at(-1);
  }

  function isoTimestampMillis(value: string, fieldName: string) {
    const parsed = Date.parse(value);

    if (!/^\d{4}-\d{2}-\d{2}T/u.test(value) || Number.isNaN(parsed)) {
      throw new ProductEngineServiceError("VALIDATION_FAILED", `${fieldName} must be an ISO timestamp.`);
    }

    return parsed;
  }

  function optionalIsoTimestampMillis(value: string | undefined, fieldName: string) {
    return value ? isoTimestampMillis(value, fieldName) : null;
  }

  function stalePolicyBlocker(request: StartResearchRunRequest, now: string) {
    const nowMillis = isoTimestampMillis(now, "now");
    const taskFreshnessDeadlineMillis = optionalIsoTimestampMillis(
      request.taskFreshnessDeadline,
      "taskFreshnessDeadline"
    );
    const sourcePublishedAtMillis = optionalIsoTimestampMillis(request.sourcePublishedAt, "sourcePublishedAt");
    const sourceRequiredAfterMillis = optionalIsoTimestampMillis(request.sourceRequiredAfter, "sourceRequiredAfter");

    if (taskFreshnessDeadlineMillis !== null && nowMillis > taskFreshnessDeadlineMillis) {
      return "Task freshness window has already expired; automatic research run start is stale.";
    }

    if (
      sourcePublishedAtMillis !== null &&
      sourceRequiredAfterMillis !== null &&
      sourcePublishedAtMillis < sourceRequiredAfterMillis
    ) {
      return "Source timestamp predates the task freshness requirement.";
    }

    return null;
  }

  async function rateBudgetBlocker(
    projectIdValue: ProjectId,
    allowlist: ResearchAllowlistProjection,
    researchTaskId: ResearchTaskId
  ) {
    const projectRuns = await listProjectResearchRuns(projectIdValue);
    const activeRuns = projectRuns.filter((run) => !isTerminalResearchRunStatus(run.status));

    if (activeRuns.length >= allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject) {
      return `Project already has ${activeRuns.length} non-terminal research run(s), meeting the allowlist concurrency budget.`;
    }

    const researchRepository = createResearchRepository(storage.db);
    const researchTask = await researchRepository.getTask(researchTaskId);

    if (!researchTask) {
      return null;
    }

    const sessionResearch = await researchRepository.getProjection(researchTask.sessionId);
    const sessionTaskIds = new Set(sessionResearch.taskIds);
    const sessionAllowlistRunCount = projectRuns.filter(
      (run) => run.allowlistId === allowlist.allowlistId && sessionTaskIds.has(run.researchTaskId)
    ).length;

    return sessionAllowlistRunCount >= allowlist.rateBudgetPolicy.maxRunsPerSession
      ? `Session already has ${sessionAllowlistRunCount} research run(s) for this allowlist, meeting the per-session run budget.`
      : null;
  }

  async function blockedResearchRunControlResult(
    projectIdValue: ProjectId,
    action: ResearchRunControlResult["action"],
    status: ResearchRunControlResult["status"],
    reason: string,
    code: NonNullable<ResearchRunControlResult["blocker"]>["code"],
    disclosureLog: ResearchDisclosureLogEntry | undefined,
    publicSafePayload?: ResearchRunControlResult["publicSafePayload"],
    manualHandoff?: ResearchRunControlResult["manualHandoff"],
    selectedRun?: ResearchRunProjection
  ): Promise<ResearchRunControlResult> {
    const projection = await listResearchRunProjection(projectIdValue, selectedRun);
    const recovery = researchRunRecoveryHint(projectIdValue, selectedRun?.researchRunId);

    return {
      kind: "ResearchRunControlResult",
      action,
      status,
      projectId: projectIdValue,
      ...(selectedRun
        ? {
            researchRun: selectedRun,
            researchRunId: selectedRun.researchRunId,
            researchTaskId: selectedRun.researchTaskId,
            allowlistId: selectedRun.allowlistId,
            disclosureLogId: selectedRun.disclosureLogId,
            statusUrl: researchRunStatusUrl(projectIdValue, selectedRun.researchRunId)
          }
        : {}),
      ...(disclosureLog ? { disclosureLog, disclosureLogId: disclosureLog.logId } : {}),
      ...(publicSafePayload ? { publicSafePayload } : {}),
      projection,
      recovery,
      ...(manualHandoff ? { manualHandoff } : {}),
      blocker: { reason, code }
    };
  }

  async function blockedResearchRunStartResult(
    projectIdValue: ProjectId,
    status: ResearchRunControlResult["status"],
    reason: string,
    code: NonNullable<ResearchRunControlResult["blocker"]>["code"],
    disclosureLog: ResearchDisclosureLogEntry | undefined,
    publicSafePayload?: ResearchRunControlResult["publicSafePayload"],
    manualHandoff?: ResearchRunControlResult["manualHandoff"]
  ): Promise<ResearchRunControlResult> {
    return blockedResearchRunControlResult(
      projectIdValue,
      "start",
      status,
      reason,
      code,
      disclosureLog,
      publicSafePayload,
      manualHandoff
    );
  }

  async function persistResearchRunDisclosureLog(
    projectIdValue: ProjectId,
    request: StartResearchRunRequest,
    publicSafePayload: PublicSafeResearchDisclosurePayload,
    allowlist: ResearchAllowlistProjection | null,
    blockReason: ResearchDisclosureBlockReason | null,
    now: string
  ) {
    return createResearchDisclosureLogRepository(storage.db).create({
      log: researchDisclosureLogFromRequest(projectIdValue, request, publicSafePayload, allowlist, blockReason, now),
      schemaVersion: CONTRACT_SCHEMA_VERSION
    });
  }

  function researchRunFromStartRequest(
    projectIdValue: ProjectId,
    request: StartResearchRunRequest,
    allowlist: ResearchAllowlistProjection,
    disclosureLog: ResearchDisclosureLogEntry,
    publicSafePayload: PublicSafeResearchDisclosurePayload,
    now: string
  ): ResearchRunProjection {
    const nextResearchRunId = request.researchRunId ?? researchRunId();
    const adapterKind = effectiveResearchAdapterKind(request);
    const sourceCategory = automaticResearchSourceCategoryOrNull(request.sourceCategory);

    if (!sourceCategory) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Automatic research runs require a public-safe source category."
      );
    }

    if (!isMountedResearchAdapterKind(adapterKind)) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Requested research adapter is not mounted in the local sidecar.",
        {
          requestedAdapterKind: adapterKind
        }
      );
    }

    const adapterSourceCategoryBlocker = mountedResearchSourceCategoryBlocker(adapterKind, sourceCategory);

    if (adapterSourceCategoryBlocker) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        adapterSourceCategoryBlocker,
        {
          requestedAdapterKind: adapterKind,
          sourceCategory
        }
      );
    }

    const adapter = createMountedResearchAdapter(adapterKind);

    return {
      kind: "ResearchRunProjection",
      version: 1 as ProjectionVersion,
      researchRunId: nextResearchRunId,
      projectId: projectIdValue,
      researchTaskId: request.researchTaskId,
      allowlistId: allowlist.allowlistId,
      disclosureLogId: disclosureLog.logId,
      connectorId: request.connectorId,
      sourceCategory,
      status: "queued",
      provider: {
        researchRunId: nextResearchRunId,
        researchTaskId: request.researchTaskId,
        adapterKind,
        adapterVersion: adapter.adapterVersion,
        sourceCategory,
        idempotencyKey: researchRunStartIdempotencyKey(request, allowlist, publicSafePayload),
        attempt: 1
      },
      qualityGateStatus: "not_evaluated",
      sourceRefs: disclosureLog.sourceRefs,
      createdAt: now,
      updatedAt: now
    } satisfies ResearchRunProjection;
  }

  function researchRunStartIdempotencyKey(
    request: StartResearchRunRequest,
    allowlist: ResearchAllowlistProjection,
    publicSafePayload: PublicSafeResearchDisclosurePayload
  ) {
    return buildResearchRunIdempotencyKey({
      taskObjective: publicSafePayload.researchObjective,
      connectorId: request.connectorId,
      contextHash: contextHashFromPublicSafePayload(request, publicSafePayload),
      allowlistVersion: allowlist.version,
      attempt: 1
    });
  }

  async function startMountedResearchRunIfQueued(
    run: ResearchRunProjection,
    publicSafePayload: PublicSafeResearchDisclosurePayload
  ) {
    if (run.status !== "queued" || run.provider.providerRunId || !isMountedResearchAdapterKind(run.provider.adapterKind)) {
      return run;
    }

    const adapter = createMountedResearchAdapter(run.provider.adapterKind);
    const started = await adapter.start({
      researchRun: run,
      disclosurePayload: publicSafePayload
    });
    const updated = await createResearchRunRepository(storage.db).update({
      run: {
        ...run,
        version: (Number(run.version) + 1) as ProjectionVersion,
        status: "running",
        provider: {
          ...run.provider,
          providerRunId: started.providerRunId,
          startedAt: started.startedAt
        },
        updatedAt: started.startedAt
      },
      expectedVersion: run.version,
      schemaVersion: CONTRACT_SCHEMA_VERSION
    });

    if (!updated) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Research run changed before provider start could be recorded; refetch and retry.",
        {
          projectId: run.projectId,
          researchRunId: run.researchRunId
        }
      );
    }

    return updated;
  }

  function providerHasObservedResultWindow(run: ResearchRunProjection, now: string) {
    if (
      run.status !== "running" ||
      !isMountedResearchAdapterKind(run.provider.adapterKind) ||
      !run.provider.providerRunId ||
      !run.provider.startedAt
    ) {
      return false;
    }

    if (run.provider.adapterKind === "web_search_readonly") {
      return true;
    }

    const elapsedMillis = isoTimestampMillis(now, "now") - isoTimestampMillis(run.provider.startedAt, "provider.startedAt");

    return elapsedMillis >= LOCAL_FAKE_PROVIDER_RESULT_DELAY_MILLIS;
  }

  function limitationNotesFromProviderResult(providerResult: BackgroundResearchAdapterResult) {
    return providerResult.limitations.join(" ");
  }

  async function importProviderResultIntoResearchEvidence(
    run: ResearchRunProjection,
    providerResult: BackgroundResearchAdapterResult
  ) {
    const researchRepository = createResearchRepository(storage.db);
    const task = await researchRepository.getTask(run.researchTaskId);

    if (!task) {
      return run;
    }

    const existingProjection = await researchRepository.getProjection(task.sessionId);
    const existingResult = existingProjection.results.find((result) => result.researchRunId === run.researchRunId);
    let effectTaskIds: readonly EffectTaskId[] = [];

    if (!existingResult) {
      effectTaskIds = await runSessionCommandSerialized(task.sessionId, async () => {
        const events = await createEventRepository(storage.db).listForSession(task.sessionId);
        const currentState = replayProductEngineEvents(run.projectId, task.sessionId, events);
        const alreadyImported = currentState.researchState.results.some(
          (result) => result.researchRunId === run.researchRunId
        );

        if (alreadyImported) {
          return [];
        }

        const command: ProductEngineCommand = {
          commandId: commandId(),
          commandType: "ImportResearchResult",
          projectId: run.projectId,
          sessionId: task.sessionId,
          actor: "effect_executor",
          issuedAt: providerResult.completedAt,
          idempotencyKey: `ProviderResultIngest:${run.researchRunId}:${providerResult.providerRunId}`,
          expectedStateVersion: currentState.stateVersion,
          causationId: null,
          correlationId: correlationId(),
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          payload: {
            researchTaskId: task.researchTaskId,
            researchRunId: run.researchRunId,
            result: providerResult.summary,
            ...(providerResult.sourceTitle ? { sourceTitle: providerResult.sourceTitle } : {}),
            ...(providerResult.sourceUrl ? { sourceUrl: providerResult.sourceUrl } : {}),
            sourceReliability: "medium",
            sourceRetrievedAt: providerResult.completedAt,
            limitationNotes: limitationNotesFromProviderResult(providerResult),
            claim: task.objective,
            decisionContext: task.routeOutcome,
            ...(task.sourceQueueItemId ? { questionRef: task.sourceQueueItemId } : {}),
            implicationScope:
              "Read-only provider result is retained as Evidence Pack input and does not update SpecVersion automatically.",
            synthesisVersion: 1
          }
        };
        const response = await runCommand(command, events);

        if (response.category === "rejected") {
          throw new ProductEngineServiceError(
            "COMMAND_PRECONDITION_FAILED",
            response.error?.message ?? "Provider result import was rejected.",
            {
              researchRunId: run.researchRunId,
              researchTaskId: task.researchTaskId
            }
          );
        }

        return response.effectTaskIds ?? [];
      });
    }

    const queuedEffects = await createEffectTaskRepository(storage.db).listQueuedByType("research_evidence_effect");
    const relevantEffects = queuedEffects.filter((effect) => {
      if (effect.sessionId !== task.sessionId) {
        return false;
      }

      if (effectTaskIds.includes(effect.effectTaskId)) {
        return true;
      }

      return existingResult
        ? effect.idempotencyKey.startsWith(`research-result:${existingResult.researchResultId}:`)
        : false;
    });

    for (const effect of relevantEffects) {
      await runResearchEvidenceEffect(effect);
    }

    return (await createResearchRunRepository(storage.db).getById(run.projectId, run.researchRunId)) ?? run;
  }

  async function markResearchRunProviderFailed(run: ResearchRunProjection, failedAt: string) {
    const repository = createResearchRunRepository(storage.db);
    const updated = await repository.update({
      run: {
        ...run,
        version: (Number(run.version) + 1) as ProjectionVersion,
        status: "failed",
        provider: {
          ...run.provider,
          completedAt: failedAt
        },
        terminalReason: "provider_failed",
        qualityGateStatus: "not_evaluated",
        updatedAt: failedAt
      },
      expectedVersion: run.version,
      schemaVersion: CONTRACT_SCHEMA_VERSION
    });

    if (updated) {
      return updated;
    }

    return (await repository.getById(run.projectId, run.researchRunId)) ?? run;
  }

  async function disclosurePayloadForRun(run: ResearchRunProjection): Promise<PublicSafeResearchDisclosurePayload> {
    const disclosureLog = await findDisclosureLogForRun(run);

    return {
      researchObjective: disclosureLog?.researchObjective ?? run.researchTaskId,
      publicSafeSummary:
        disclosureLog?.publicSafeSummarySent ?? "Read-only provider result uses the prior public-safe disclosure summary."
    };
  }

  async function pollMountedResearchRunResultIfReady(run: ResearchRunProjection) {
    const now = new Date().toISOString();

    if (!providerHasObservedResultWindow(run, now)) {
      return run;
    }

    if (!isMountedResearchAdapterKind(run.provider.adapterKind)) {
      return run;
    }

    let providerResult: BackgroundResearchAdapterResult;

    try {
      const adapter = createMountedResearchAdapter(run.provider.adapterKind);

      providerResult = await adapter.pollResult({
        researchRun: run,
        disclosurePayload: await disclosurePayloadForRun(run)
      });
    } catch {
      return markResearchRunProviderFailed(run, now);
    }

    const repository = createResearchRunRepository(storage.db);
    const updated = await repository.update({
      run: {
        ...run,
        version: (Number(run.version) + 1) as ProjectionVersion,
        status: providerResult.status,
        provider: {
          ...run.provider,
          providerRunId: providerResult.providerRunId,
          completedAt: providerResult.completedAt
        },
        qualityGateStatus: "pending_review",
        qualityGateReviewReason:
          "Read-only provider result is complete and requires Evidence Pack quality-gate review before acceptance.",
        sourceRefs: [...new Set([...run.sourceRefs, ...providerResult.sourceRefs])],
        updatedAt: providerResult.completedAt
      },
      expectedVersion: run.version,
      schemaVersion: CONTRACT_SCHEMA_VERSION
    });

    if (!updated) {
      const latest = await repository.getById(run.projectId, run.researchRunId);

      if (latest) {
        return latest;
      }

      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Research run changed before provider result polling could be saved; refetch and retry.",
        {
          researchRunId: run.researchRunId
        }
      );
    }

    return importProviderResultIntoResearchEvidence(updated, providerResult);
  }

  function isResearchRunStartInProgress(run: ResearchRunProjection) {
    return run.status === "queued" || run.status === "running";
  }

  async function cancelResearchRunWithMountedAdapter(run: ResearchRunProjection, reason: string) {
    if (isTerminalResearchRunStatus(run.status)) {
      throw new ProductEngineServiceError("COMMAND_PRECONDITION_FAILED", "Terminal research runs cannot be cancelled.", {
        researchRunId: run.researchRunId,
        status: run.status
      });
    }

    if (run.status === "cancel_requested") {
      return run;
    }

    const now = new Date().toISOString();
    const fallbackCancellation = (): Awaited<ReturnType<BackgroundResearchRuntimeAdapter["cancel"]>> => {
      if (run.status === "queued" || run.status === "paused") {
        return {
          status: "cancelled" as const,
          completedAt: now,
          reason
        };
      }

      if (run.status === "running") {
        return {
          status: "cancel_requested" as const,
          reason
        };
      }

      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        `Research run status ${run.status} cannot be cancelled.`,
        {
          researchRunId: run.researchRunId,
          status: run.status
        }
      );
    };
    const cancellation =
      run.provider.adapterKind === "local_fake_readonly"
        ? await createMountedResearchAdapter(run.provider.adapterKind).cancel({
            researchRun: run,
            reason
          })
        : fallbackCancellation();
    const cancelled = cancellation.status === "cancelled";
    const updated = await createResearchRunRepository(storage.db).update({
      run: {
        ...run,
        version: (Number(run.version) + 1) as ProjectionVersion,
        status: cancellation.status,
        provider: {
          ...run.provider,
          ...(cancellation.providerRunId ? { providerRunId: cancellation.providerRunId } : {}),
          ...(cancellation.completedAt ? { completedAt: cancellation.completedAt } : {})
        },
        ...(cancelled ? { terminalReason: "cancelled_by_user" as const } : {}),
        updatedAt: cancellation.completedAt ?? now
      },
      expectedVersion: run.version,
      schemaVersion: CONTRACT_SCHEMA_VERSION
    });

    if (!updated) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Research run changed before cancellation could be saved; refetch and retry.",
        {
          researchRunId: run.researchRunId
        }
      );
    }

    return updated;
  }

  function priorRunFailureSummary(run: ResearchRunProjection) {
    return {
      researchRunId: run.researchRunId,
      ...(run.terminalReason ? { terminalReason: run.terminalReason as ResearchRunTerminalReason } : {}),
      status: run.status
    };
  }

  function retrySourceContextHash(priorRun: ResearchRunProjection, request: RetryResearchRunRequest) {
    return (
      request.contextHash?.trim() ??
      decodedIdempotencyKeyPart(priorRun.provider.idempotencyKey, "context") ??
      `retry-of-${priorRun.researchRunId}`
    );
  }

  function retrySourceAllowlistVersion(priorRun: ResearchRunProjection, currentAllowlist: ResearchAllowlistProjection) {
    const decoded = decodedIdempotencyKeyPart(priorRun.provider.idempotencyKey, "allowlistVersion");
    const parsed = decoded ? Number(decoded) : Number.NaN;

    return Number.isInteger(parsed) && parsed >= 0
      ? (parsed as ProjectionVersion)
      : currentAllowlist.version;
  }

  function baseResearchRunForRetry(
    priorRun: ResearchRunProjection
  ): Omit<ResearchRunProjection, "retryOfRunId" | "retryReason" | "terminalReason"> {
    return {
      kind: priorRun.kind,
      version: priorRun.version,
      researchRunId: priorRun.researchRunId,
      projectId: priorRun.projectId,
      researchTaskId: priorRun.researchTaskId,
      allowlistId: priorRun.allowlistId,
      disclosureLogId: priorRun.disclosureLogId,
      connectorId: priorRun.connectorId,
      sourceCategory: priorRun.sourceCategory,
      status: priorRun.status,
      provider: priorRun.provider,
      qualityGateStatus: priorRun.qualityGateStatus,
      sourceRefs: priorRun.sourceRefs,
      createdAt: priorRun.createdAt,
      updatedAt: priorRun.updatedAt
    };
  }

  function researchRunRetryFromPrior(
    priorRun: ResearchRunProjection,
    allowlist: ResearchAllowlistProjection,
    disclosureLog: ResearchDisclosureLogEntry | null,
    request: RetryResearchRunRequest,
    now: string
  ): ResearchRunProjection {
    const nextAttempt = priorRun.provider.attempt + 1;
    const nextResearchRunId = researchRunId();
    const objective = disclosureLog?.researchObjective ?? priorRun.researchTaskId;
    const baseRun = baseResearchRunForRetry(priorRun);

    return {
      ...baseRun,
      version: 1 as ProjectionVersion,
      researchRunId: nextResearchRunId,
      status: "queued",
      provider: {
        researchRunId: nextResearchRunId,
        researchTaskId: priorRun.researchTaskId,
        adapterKind: priorRun.provider.adapterKind,
        adapterVersion: priorRun.provider.adapterVersion,
        sourceCategory: priorRun.provider.sourceCategory,
        idempotencyKey: buildResearchRunIdempotencyKey({
          taskObjective: objective,
          connectorId: priorRun.connectorId,
          contextHash: retrySourceContextHash(priorRun, request),
          allowlistVersion: retrySourceAllowlistVersion(priorRun, allowlist),
          attempt: nextAttempt
        }),
        attempt: nextAttempt
      },
      qualityGateStatus: "not_evaluated",
      retryOfRunId: priorRun.researchRunId,
      retryReason: request.retryReason,
      createdAt: now,
      updatedAt: now
    } satisfies ResearchRunProjection;
  }

  async function matchingAllowlistForDisclosure(
    projectIdValue: ProjectId,
    request: PrepareResearchDisclosureRequest
  ): Promise<ResearchAllowlistProjection | null> {
    if (request.allowlistId) {
      return findProjectAllowlist(projectIdValue, request.allowlistId);
    }

    const allowlists = await listProjectAllowlists(projectIdValue);

    return (
      allowlists.find(
        (allowlist) =>
          allowlist.status === "active" &&
          allowlist.connectorIds.includes(request.connectorId) &&
          allowlistIncludesSourceCategory(allowlist, request.sourceCategory)
      ) ??
      allowlists.find((allowlist) => allowlist.status === "active") ??
      allowlists[0] ??
      null
    );
  }

  function createAllowlistFromRequest(
    projectIdValue: ProjectId,
    request: CreateResearchAllowlistRequest,
    now: string
  ): ResearchAllowlistProjection {
    return {
      kind: "ResearchAllowlistProjection",
      version: 1 as ProjectionVersion,
      allowlistId: request.allowlistId ?? researchAllowlistId(),
      projectId: projectIdValue,
      status: "active",
      connectorIds: requireNonEmptyList(request.connectorIds, "connectorIds"),
      sourceCategories: requireNonEmptyList(request.sourceCategories, "sourceCategories"),
      contextMode: request.contextMode ?? "public_safe_summary",
      rateBudgetPolicy: request.rateBudgetPolicy ?? DEFAULT_RESEARCH_RATE_BUDGET_POLICY,
      stalenessPolicy: request.stalenessPolicy ?? DEFAULT_RESEARCH_STALENESS_POLICY,
      disclosureLogPolicy: request.disclosureLogPolicy ?? DEFAULT_RESEARCH_DISCLOSURE_LOG_POLICY,
      approvedBy: request.approvedBy,
      approvedAt: now,
      createdAt: now,
      updatedAt: now
    };
  }

  function updateAllowlistFromRequest(
    current: ResearchAllowlistProjection,
    request: UpdateResearchAllowlistRequest,
    now: string
  ): ResearchAllowlistProjection {
    if (current.status === "revoked") {
      throw new ProductEngineServiceError("COMMAND_PRECONDITION_FAILED", "Revoked research allowlists are immutable.", {
        allowlistId: current.allowlistId,
        status: current.status
      });
    }

    if (request.status !== undefined && request.status !== "active") {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Use the dedicated pause/revoke endpoints for paused or revoked transitions.",
        {
          allowlistId: current.allowlistId,
          requestedStatus: request.status
        }
      );
    }

    const touchesPolicy =
      request.connectorIds !== undefined ||
      request.sourceCategories !== undefined ||
      request.contextMode !== undefined ||
      request.rateBudgetPolicy !== undefined ||
      request.stalenessPolicy !== undefined ||
      request.disclosureLogPolicy !== undefined;
    const reactivatesPausedAllowlist = current.status === "paused" && request.status === "active";
    const hasUpdateIntent = touchesPolicy || reactivatesPausedAllowlist;

    if (!hasUpdateIntent) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "UpdateResearchAllowlistRequest must include at least one allowlist update field.",
        {
          allowlistId: current.allowlistId
        }
      );
    }

    if ((touchesPolicy || reactivatesPausedAllowlist) && !request.approvedBy?.trim()) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "approvedBy is required when updating allowlist policy or activating automatic research.",
        {
          allowlistId: current.allowlistId,
          requiresFreshApproval: true
        }
      );
    }

    const nextStatus = reactivatesPausedAllowlist ? "active" : current.status;

    const nextAllowlist = {
      kind: current.kind,
      version: allowlistVersionAfter(current),
      allowlistId: current.allowlistId,
      projectId: current.projectId,
      connectorIds: request.connectorIds ?? current.connectorIds,
      sourceCategories: request.sourceCategories ?? current.sourceCategories,
      contextMode: request.contextMode ?? current.contextMode,
      rateBudgetPolicy: request.rateBudgetPolicy ?? current.rateBudgetPolicy,
      stalenessPolicy: request.stalenessPolicy ?? current.stalenessPolicy,
      disclosureLogPolicy: request.disclosureLogPolicy ?? current.disclosureLogPolicy,
      approvedBy: request.approvedBy ?? current.approvedBy,
      approvedAt: request.approvedBy ? now : current.approvedAt,
      createdAt: current.createdAt,
      updatedAt: now
    };

    if (nextStatus === "active") {
      return {
        ...nextAllowlist,
        status: "active"
      };
    }

    return {
      ...nextAllowlist,
      status: "paused",
      pausedAt: current.pausedAt ?? now
    };
  }

  async function findProjectAllowlist(projectIdValue: ProjectId, allowlistIdValue: ResearchAllowlistId) {
    const repository = createResearchAllowlistRepository(storage.db);
    const allowlist = await repository.getById(projectIdValue, allowlistIdValue);

    if (!allowlist) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Research allowlist was not found.", {
        projectId: projectIdValue,
        allowlistId: allowlistIdValue
      });
    }

    return allowlist;
  }

  async function updatePersistedAllowlist(allowlist: ResearchAllowlistProjection) {
    const expectedVersion = (Number(allowlist.version) - 1) as ProjectionVersion;
    const saved = await createResearchAllowlistRepository(storage.db).update({
      allowlist,
      expectedVersion,
      schemaVersion: CONTRACT_SCHEMA_VERSION
    });

    if (!saved) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Research allowlist changed before the governance update could be saved; refetch and retry.",
        {
          projectId: allowlist.projectId,
          allowlistId: allowlist.allowlistId,
          expectedVersion
        }
      );
    }

    return saved;
  }

  async function recordAutoImplementationStageProjection(
    request: RecordAutoImplementationStageRequest
  ): Promise<AutoImplementationRunProjection> {
    const session = await createProjectRepository(storage.db).getSession(request.sessionId);

    if (!session) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
        sessionId: request.sessionId
      });
    }

    const projectionRepository = createProjectionRepository(storage.db);
    const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
      request.sessionId,
      "AutoImplementationRunProjection"
    );
    const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

    if (!existingProjection) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
        sessionId: request.sessionId
      });
    }

    const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

    if (!run) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
        runId: request.runId
      });
    }

    const actionRef = autoImplementationStageActionRef(request);

    if (run.evidenceRefs.includes(actionRef)) {
      return existingProjection;
    }

    if (run.status === "completed" && request.action !== "tick") {
      throw new ProductEngineServiceError("VALIDATION_FAILED", "Completed auto implementation runs cannot be advanced.");
    }

    if (run.currentStage !== request.stage) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "Auto implementation stages must advance in the canonical sequence.",
        { currentStage: run.currentStage, requestedStage: request.stage }
      );
    }

    if (request.action === "block" && !request.blocker) {
      throw new ProductEngineServiceError("VALIDATION_FAILED", "blocker is required when blocking an auto implementation stage.");
    }

    const stageIndex = run.stagePlan.findIndex((stage) => stage.stage === request.stage);
    const currentStage = run.stagePlan[stageIndex];

    if (!currentStage) {
      throw new ProductEngineServiceError("VALIDATION_FAILED", "Requested auto implementation stage is not in the run plan.");
    }

    if (
      request.action === "complete" &&
      request.implementationStepId &&
      run.stagePlan.some((stage) =>
        stage.stage !== request.stage &&
        stage.ledgerEvidence?.implementationStepId === request.implementationStepId
      )
    ) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "Auto implementation stage completion requires an implementation step that has not completed another stage."
      );
    }

    assertMergeMainCompletionHasAppliedPullRequestMerge(run, request);

    const recordedAt = request.tickedAt ?? new Date().toISOString();
    const nextTickAt = addMilliseconds(recordedAt, AUTO_IMPLEMENTATION_TICK_INTERVAL_MS);
    const requestEvidenceRefs = request.evidenceRefs ?? [];
    const ledger = request.action === "complete"
      ? validatedLedgerForAutoImplementationStage(
        await projectionRepository.get<ImplementationStepLedgerProjection>(
          request.sessionId,
          "ImplementationStepLedgerProjection"
        )
      )
      : null;
    const ledgerStep = request.action === "complete"
      ? completedLedgerStepForAutoImplementationStage(ledger, request.implementationStepId, request.stage)
      : null;
    if (request.action === "complete") {
      assertAutoImplementationStageCompletionDoesNotPrecedeScheduledTick(currentStage, recordedAt);
    }
    const ledgerEvidence = ledger && ledgerStep ? autoImplementationStageLedgerEvidence(ledger, ledgerStep) : null;
    const nextStageStatus = autoImplementationStageStatusForAction(request.action, currentStage.status);
    const stageEvidenceRefs = uniqueAutoImplementationRefs([
      ...currentStage.evidenceRefs,
      actionRef,
      ...requestEvidenceRefs,
      ...(ledgerEvidence?.evidenceRefs ?? []),
      ...(request.blocker?.evidenceRefs ?? [])
    ]);
    const tick = autoImplementationStageTickRecord({
      request,
      status: nextStageStatus,
      recordedAt,
      nextTickAt,
      evidenceRefs: uniqueAutoImplementationRefs([actionRef, ...requestEvidenceRefs])
    });
    const updatedStage: AutoImplementationStageRecord = {
      ...currentStage,
      status: nextStageStatus,
      nextScheduledAt: nextTickAt,
      evidenceRefs: stageEvidenceRefs,
      tickRecords: [...currentStage.tickRecords, tick],
      ledgerEvidence: request.action === "complete" ? ledgerEvidence : currentStage.ledgerEvidence,
      blocker: request.action === "block"
        ? request.blocker ?? null
        : (nextStageStatus === "blocked" ? currentStage.blocker : null)
    };
    const isFinalStageComplete =
      request.action === "complete" && request.stage === AUTO_IMPLEMENTATION_STAGES.at(-1);
    const stagePlan = run.stagePlan.map((stage, index) => {
      if (index === stageIndex) {
        return updatedStage;
      }

      if (request.action === "complete" && index === stageIndex + 1) {
        const readyRef = `auto-stage-ready:${request.runId}:${stage.stage}:${request.idempotencyKey}`;
        const readyTick = autoImplementationStageTickRecord({
          request: {
            ...request,
            stage: stage.stage,
            action: "tick"
          },
          status: "ready",
          recordedAt,
          nextTickAt,
          evidenceRefs: [readyRef]
        });

        return {
          ...stage,
          status: "ready" as const,
          nextScheduledAt: nextTickAt,
          evidenceRefs: uniqueAutoImplementationRefs([...stage.evidenceRefs, readyRef]),
          tickRecords: [...stage.tickRecords, readyTick]
        };
      }

      return stage;
    });
    const nextStage = request.action === "complete" && !isFinalStageComplete
      ? stagePlan[stageIndex + 1]?.stage ?? request.stage
      : request.stage;
    const runStatus = autoImplementationRunStatusForAction(request.action, Boolean(isFinalStageComplete), run.status);
    const updatedRun: AutoImplementationRun = {
      ...run,
      currentStage: nextStage,
      status: runStatus,
      nextTickAt,
      stagePlan,
      updatedAt: recordedAt,
      evidenceRefs: uniqueAutoImplementationRefs([...run.evidenceRefs, actionRef, ...stageEvidenceRefs])
    };
    const runs = existingProjection.runs.map((candidate) =>
      candidate.runId === request.runId ? updatedRun : candidate
    );
    const projection = validateAutoImplementationRunProjection({
      ...existingProjection,
      version: (existingProjection.version + 1) as ProjectionVersion,
      latestRun: updatedRun,
      runs,
      summary: `Auto implementation stage ${request.stage} is ${nextStageStatus}; current stage is ${updatedRun.currentStage}.`
    });

    return saveAutoImplementationRunProjection({
      projectionRepository,
      projectId: session.projectId,
      sessionId: request.sessionId,
      projection,
      latestRun: updatedRun,
      updatedAt: recordedAt
    });
  }

  async function importAutoImplementationWorkerLedgerProjectionWithinSessionLock(
    request: ImportAutoImplementationWorkerLedgerRequest
  ): Promise<AutoImplementationRunProjection> {
    const session = await createProjectRepository(storage.db).getSession(request.sessionId);

    if (!session) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
        sessionId: request.sessionId
      });
    }

    const projectionRepository = createProjectionRepository(storage.db);
    const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
      request.sessionId,
      "AutoImplementationRunProjection"
    );
    const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

    if (!existingProjection) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
        sessionId: request.sessionId
      });
    }

    const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

    if (!run) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
        runId: request.runId
      });
    }

    const workerJob = run.workerJobs.find((job) => job.jobId === request.jobId);

    if (!workerJob) {
      throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation worker job was not found.", {
        jobId: request.jobId
      });
    }

    if (workerJob.status === "completed") {
      return existingProjection;
    }

    if (!canImportAutoImplementationWorkerLedger(workerJob)) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "Only planned worker jobs or ledger-blocked worker jobs can import ImplementationStepLedger evidence."
      );
    }

    if (run.currentStage !== workerJob.stage) {
      throw new ProductEngineServiceError(
        "VALIDATION_FAILED",
        "Auto implementation worker ledger imports can only target the current stage.",
        { currentStage: run.currentStage, workerStage: workerJob.stage }
      );
    }

    const now = new Date().toISOString();
    const importRef = autoImplementationWorkerLedgerImportRef(request);
    let importedJob: AutoImplementationWorkerJob;
    let importFailure: ProductEngineServiceError | null = null;
    const ledgerDocMismatch = autoImplementationWorkerLedgerImportMismatch(workerJob, request.ledgerTransitions);

    if (ledgerDocMismatch) {
      importFailure = new ProductEngineServiceError(
        "VALIDATION_FAILED",
        `Auto implementation worker ledger import must use the planned worker ledger docs: ${ledgerDocMismatch}.`,
        { mismatch: ledgerDocMismatch }
      );
    }

    if (!importFailure) {
      for (const [index, transition] of request.ledgerTransitions.entries()) {
        const state = await stateForSession(session.projectId, request.sessionId);
        const { command, events } = await commandForExistingSession(
          {
            sessionId: request.sessionId,
            commandType: "RecordImplementationStepLedger",
            expectedStateVersion: state.stateVersion,
            idempotencyKey: autoImplementationWorkerLedgerImportCommandKey({ request, transition, index }),
            payload: transition as unknown as Readonly<Record<string, unknown>>
          },
          "product_engine"
        );
        const response = await runCommand(command, events);

        if (response.category === "rejected" || response.category === "blocked") {
          const responseMessage = response.error?.message;
          importFailure = new ProductEngineServiceError(
            "VALIDATION_FAILED",
            responseMessage
              ? `Auto implementation worker ledger import was rejected by ImplementationStepLedger validation: ${responseMessage}`
              : "Auto implementation worker ledger import was rejected by ImplementationStepLedger validation.",
            {
              category: response.category,
              code: response.error?.code,
              message: response.error?.message
            }
          );
          break;
        }
      }
    }

    const completedTransition = [...request.ledgerTransitions]
      .reverse()
      .find((transition) => transition.targetStatus === "completed");

    try {
      if (importFailure) {
        throw importFailure;
      }

      if (!completedTransition) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation worker ledger import requires a completed ImplementationStepLedger transition."
        );
      }

      const ledger = validatedLedgerForAutoImplementationStage(
        await projectionRepository.get<ImplementationStepLedgerProjection>(
          request.sessionId,
          "ImplementationStepLedgerProjection"
        )
      );

      if (!ledger) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation worker ledger import requires an ImplementationStepLedger projection."
        );
      }

      const ledgerStep = completedLedgerStepForAutoImplementationStage(
        ledger,
        completedTransition.stepDoc.stepId,
        workerJob.stage
      );
      assertAutoImplementationWorkerGeneratedProductLedgerMatchesPlan({ ledgerStep, workerJob });
      const ledgerEvidence = autoImplementationStageLedgerEvidence(ledger, ledgerStep);

      importedJob = {
        ...workerJob,
        status: "completed",
        blockedReason: null,
        missingEvidence: [],
        nextRequiredAction: "Advance the current auto implementation stage through the existing stage endpoint with the imported ImplementationStepLedger evidence.",
        updatedAt: now,
        evidenceRefs: uniqueAutoImplementationRefs([
          ...workerJob.evidenceRefs,
          importRef,
          ...ledgerEvidence.evidenceRefs,
          ...(request.evidenceRefs ?? [])
        ])
      };
    } catch (error) {
      if (!(error instanceof ProductEngineServiceError)) {
        throw error;
      }

      importedJob = {
        ...workerJob,
        status: "blocked",
        blockedReason: error.message,
        missingEvidence: [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.ledgerImport],
        nextRequiredAction: "Retry the worker ledger import with valid completed ImplementationStepLedger evidence before advancing the stage.",
        updatedAt: now,
        evidenceRefs: uniqueAutoImplementationRefs([
          ...workerJob.evidenceRefs,
          importRef,
          "worker-blocked:ledger-import",
          ...(request.evidenceRefs ?? [])
        ])
      };
    }

    const updatedRun: AutoImplementationRun = {
      ...run,
      status: importedJob.status === "blocked" ? "blocked" : "running",
      workerJobs: run.workerJobs.map((job) => job.jobId === request.jobId ? importedJob : job),
      updatedAt: now,
      evidenceRefs: uniqueAutoImplementationRefs([...run.evidenceRefs, ...importedJob.evidenceRefs])
    };
    const runs = existingProjection.runs.map((candidate) =>
      candidate.runId === request.runId ? updatedRun : candidate
    );
    const projection = validateAutoImplementationRunProjection({
      ...existingProjection,
      version: (existingProjection.version + 1) as ProjectionVersion,
      latestRun: updatedRun,
      runs,
      summary: `Auto implementation worker ledger import ${importedJob.status} for ${importedJob.stage}.`
    });

    return saveAutoImplementationRunProjection({
      projectionRepository,
      projectId: session.projectId,
      sessionId: request.sessionId,
      projection,
      latestRun: updatedRun,
      updatedAt: now
    });
  }
  async function importAutoImplementationWorkerLedgerProjection(
    request: ImportAutoImplementationWorkerLedgerRequest
  ): Promise<AutoImplementationRunProjection> {
    return runSessionCommandSerialized(request.sessionId, () =>
      importAutoImplementationWorkerLedgerProjectionWithinSessionLock(request)
    );
  }

  async function runAutoImplementationWorkerJobProjection(
    request: RunAutoImplementationWorkerJobRequest
  ): Promise<AutoImplementationRunProjection> {
    return runSessionCommandSerialized(request.sessionId, async () => {
      const session = await createProjectRepository(storage.db).getSession(request.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: request.sessionId
        });
      }

      const projectionRepository = createProjectionRepository(storage.db);
      const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
        request.sessionId,
        "AutoImplementationRunProjection"
      );
      const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

      if (!existingProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
          sessionId: request.sessionId
        });
      }

      const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

      if (!run) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
          runId: request.runId
        });
      }

      const workerJob = run.workerJobs.find((job) => job.jobId === request.jobId);

      if (!workerJob) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation worker job was not found.", {
          jobId: request.jobId
        });
      }

      if (workerJob.status === "completed") {
        return existingProjection;
      }

      if (!canRunAutoImplementationWorkerJob(workerJob)) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Only planned worker jobs or execution-blocked worker jobs can run a local Codex worker."
        );
      }

      if (run.currentStage !== workerJob.stage) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation worker jobs can only run for the current stage.",
          { currentStage: run.currentStage, workerStage: workerJob.stage }
        );
      }

      const activeSession = session;
      const activeProjection = existingProjection;
      const activeRun = run;
      const activeWorkerJob = workerJob;
      const now = new Date().toISOString();
      const runRef = autoImplementationWorkerRunRef(request);
      const authorityProjection = activeWorkerJob.executionPlan.executionAuthorityRef
        ? await createExecutionAuthorityRepository(storage.db).getById(activeWorkerJob.executionPlan.executionAuthorityRef)
        : null;

      if (authorityProjection && authorityProjection.sessionId !== request.sessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "executionAuthorityRef must belong to the request session.", {
          executionAuthorityRef: activeWorkerJob.executionPlan.executionAuthorityRef,
          routeSessionId: request.sessionId,
          authoritySessionId: authorityProjection.sessionId
        });
      }

      const authorityMissingEvidence = autoImplementationWorkerMissingEvidence({
        executionAuthorityRef: activeWorkerJob.executionPlan.executionAuthorityRef,
        authorityProjection,
        run: activeRun
      });

      function blockedProjection(input: {
        readonly missingEvidence: readonly string[];
        readonly blockedReason: string;
        readonly nextRequiredAction: string;
        readonly evidenceRefs?: readonly string[];
      }) {
        const blockedJob: AutoImplementationWorkerJob = {
          ...activeWorkerJob,
          status: "blocked",
          blockedReason: input.blockedReason,
          missingEvidence: input.missingEvidence,
          nextRequiredAction: input.nextRequiredAction,
          updatedAt: now,
          evidenceRefs: uniqueAutoImplementationRefs([
            ...activeWorkerJob.evidenceRefs,
            runRef,
            ...(input.evidenceRefs ?? []),
            ...(request.evidenceRefs ?? [])
          ])
        };
        const updatedRun: AutoImplementationRun = {
          ...activeRun,
          status: "blocked",
          workerJobs: activeRun.workerJobs.map((job) => job.jobId === request.jobId ? blockedJob : job),
          updatedAt: now,
          evidenceRefs: uniqueAutoImplementationRefs([...activeRun.evidenceRefs, ...blockedJob.evidenceRefs])
        };
        const runs = activeProjection.runs.map((candidate) =>
          candidate.runId === request.runId ? updatedRun : candidate
        );

        return validateAutoImplementationRunProjection({
          ...activeProjection,
          version: (activeProjection.version + 1) as ProjectionVersion,
          latestRun: updatedRun,
          runs,
          summary: `Auto implementation worker execution blocked for ${activeWorkerJob.stage}.`
        });
      }

      async function saveProjection(projection: AutoImplementationRunProjection) {
        if (!projection.latestRun) {
          throw new ProductEngineServiceError(
            "VALIDATION_FAILED",
            "Auto implementation worker execution must save a projection with a latest run."
          );
        }

        return saveAutoImplementationRunProjection({
          projectionRepository,
          projectId: activeSession.projectId,
          sessionId: request.sessionId,
          projection,
          latestRun: projection.latestRun,
          updatedAt: now
        });
      }

      if (authorityMissingEvidence.length > 0) {
        return saveProjection(blockedProjection({
          missingEvidence: authorityMissingEvidence,
          blockedReason:
            autoImplementationWorkerBlockedReason(authorityMissingEvidence) ??
            "Local Codex worker execution requires a ready bounded execution authority.",
          nextRequiredAction: autoImplementationWorkerNextRequiredAction(authorityMissingEvidence),
          evidenceRefs: ["worker-blocked:execution-authority"]
        }));
      }

      let output: CodexWorkerExecutionOutputEnvelope;
      const workerExecutionInput = {
        jobId: activeWorkerJob.jobId,
        runId: activeRun.runId,
        stage: activeWorkerJob.stage,
        workingDirectory: activeWorkerJob.executionPlan.workingDirectory,
        issueDocumentPath: activeWorkerJob.executionPlan.issueDocumentPath,
        executionAuthorityRef: activeWorkerJob.executionPlan.executionAuthorityRef ?? "",
        allowedWriteScope: activeWorkerJob.executionPlan.allowedWriteScope,
        requiredEvidence: activeWorkerJob.executionPlan.requiredEvidence,
        forbiddenActions: activeWorkerJob.executionPlan.forbiddenActions,
        sourceRefs: activeWorkerJob.executionPlan.sourceRefs,
        ledgerTrackerDoc: activeWorkerJob.executionPlan.ledgerTrackerDoc,
        ledgerStepDoc: activeWorkerJob.executionPlan.ledgerStepDoc
      };

      try {
        output = validateCodexWorkerExecutionOutput(await codexRuntimeAdapter.executeWorker(workerExecutionInput));
      } catch (error) {
        const reason = error instanceof CodexRuntimeUnavailableError
          ? error.message
          : error instanceof Error
            ? `Local Codex worker execution failed before importable ledger evidence was produced: ${error.message}`
            : "Local Codex worker execution failed before importable ledger evidence was produced.";

        return saveProjection(blockedProjection({
          missingEvidence: [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution],
          blockedReason: reason,
          nextRequiredAction: autoImplementationWorkerNextRequiredAction([
            AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution
          ]),
          evidenceRefs: ["worker-blocked:codex-runtime"]
        }));
      }

      try {
        assertCodexWorkerExecutionOutputMatchesInput(workerExecutionInput, output);
      } catch (error) {
        return saveProjection(blockedProjection({
          missingEvidence: [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution],
          blockedReason: `Local Codex worker output did not match the planned ledger contract: ${error instanceof Error ? error.message : String(error)}`,
          nextRequiredAction: autoImplementationWorkerNextRequiredAction([
            AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution
          ]),
          evidenceRefs: [
            "worker-blocked:ledger-contract",
            ...output.evidenceRefs
          ]
        }));
      }

      if (output.status === "blocked") {
        const missingEvidence = output.missingEvidence?.length
          ? output.missingEvidence
          : [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.workerExecution];

        return saveProjection(blockedProjection({
          missingEvidence,
          blockedReason:
            output.blockedReason ??
            autoImplementationWorkerBlockedReason(missingEvidence) ??
            "Local Codex worker execution was blocked before completed ledger evidence could be imported.",
          nextRequiredAction: output.nextRequiredAction ?? autoImplementationWorkerNextRequiredAction(missingEvidence),
          evidenceRefs: [
            "worker-blocked:codex-runtime",
            ...output.evidenceRefs
          ]
        }));
      }

      return importAutoImplementationWorkerLedgerProjectionWithinSessionLock({
        sessionId: request.sessionId,
        runId: request.runId,
        jobId: request.jobId,
        idempotencyKey: `${request.idempotencyKey}:ledger-import`,
        ledgerTransitions: output.ledgerTransitions,
        evidenceRefs: uniqueAutoImplementationRefs([
          runRef,
          ...output.evidenceRefs,
          ...(request.evidenceRefs ?? [])
        ])
      });
    });
  }

  return {
    async startProject(input: StartProjectRequest): Promise<CommandResponse> {
      const nextProjectId = projectId();
      const nextSessionId = sessionId();
      const command: ProductEngineCommand = {
        commandId: commandId(),
        commandType: "StartProject",
        projectId: nextProjectId,
        sessionId: nextSessionId,
        actor: "user",
        issuedAt: new Date().toISOString(),
        idempotencyKey: `StartProject:${rawIdeaIdempotencyHash(input.rawIdea)}:${input.localPrivacyMode}:${input.projectPurposeMode}:${
          input.businessCriticIntensity ?? "intensity_required"
        }`,
        expectedStateVersion: 0 as StateVersion,
        causationId: null,
        correlationId: correlationId(),
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        payload: input as unknown as Readonly<Record<string, unknown>>
      };
      const state = createInitialProductEngineState(nextProjectId, nextSessionId);
      const reduction = reduceProductEngineCommand(command, state);

      if (!reduction.accepted) {
        return responseForRejected(command, state.stateVersion, reduction);
      }

      const result = await persistReduction(command, reduction);

      return responseForAccepted(command, state.stateVersion, result.stateVersionAfter, result.events, result.effects, reduction);
    },

    async listResearchAllowlists(projectIdValue: ProjectId): Promise<ResearchAllowlistGovernanceProjection> {
      await requireProject(projectIdValue);

      return listAllowlistProjection(projectIdValue);
    },

    async createResearchAllowlist(
      input: RunResearchAllowlistGovernanceInput<CreateResearchAllowlistRequest>
    ): Promise<CommandResponse<ResearchAllowlistGovernanceProjection>> {
      try {
        await requireProject(input.projectId);
        assertRequestProjectMatchesRoute(input.projectId, input.request.projectId);

        const now = new Date().toISOString();
        const allowlist = createAllowlistFromRequest(input.projectId, input.request, now);
        const allowlistsBefore = await listProjectAllowlists(input.projectId);
        const created = await createResearchAllowlistRepository(storage.db).create({
          allowlist,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        });

        if (!created) {
          throw new ProductEngineServiceError(
            "COMMAND_PRECONDITION_FAILED",
            "Research allowlist already exists for this project.",
            {
              projectId: input.projectId,
              allowlistId: allowlist.allowlistId
            }
          );
        }
        const projection = await listAllowlistProjection(input.projectId, created);

        return allowlistCommandResponse(
          "CreateResearchAllowlist",
          input.projectId,
          allowlistCollectionVersion(allowlistsBefore) as unknown as StateVersion,
          projection
        );
      } catch (error) {
        throw validationError(error);
      }
    },

    async updateResearchAllowlist(
      input: RunResearchAllowlistGovernanceInput<UpdateResearchAllowlistRequest> & {
        readonly allowlistId: ResearchAllowlistId;
      }
    ): Promise<CommandResponse<ResearchAllowlistGovernanceProjection>> {
      try {
        await requireProject(input.projectId);
        assertRequestProjectMatchesRoute(input.projectId, input.request.projectId);

        if (input.request.allowlistId && input.request.allowlistId !== input.allowlistId) {
          throw new ProductEngineServiceError("VALIDATION_FAILED", "allowlistId must match the route param.", {
            routeAllowlistId: input.allowlistId,
            bodyAllowlistId: input.request.allowlistId
          });
        }

        const current = await findProjectAllowlist(input.projectId, input.allowlistId);
        const stateVersionBefore = await allowlistCollectionStateVersion(input.projectId);
        const now = new Date().toISOString();
        const updated = await updatePersistedAllowlist(
          updateAllowlistFromRequest(current, input.request, now)
        );

        if (current.status === "paused" && updated.status === "active") {
          await resumePausedResearchRunsForAllowlist(input.projectId, updated, now);
        }

        const projection = await listAllowlistProjection(input.projectId, updated);

        return allowlistCommandResponse(
          "UpdateResearchAllowlist",
          input.projectId,
          stateVersionBefore,
          projection
        );
      } catch (error) {
        throw validationError(error);
      }
    },

    async pauseResearchAllowlist(
      input: RunResearchAllowlistLifecycleInput
    ): Promise<CommandResponse<ResearchAllowlistGovernanceProjection>> {
      try {
        await requireProject(input.projectId);

        const current = await findProjectAllowlist(input.projectId, input.allowlistId);
        const stateVersionBefore = await allowlistCollectionStateVersion(input.projectId);

        if (current.status === "revoked") {
          throw new ProductEngineServiceError("COMMAND_PRECONDITION_FAILED", "Revoked research allowlists cannot be paused.", {
            allowlistId: input.allowlistId,
            status: current.status
          });
        }

        const now = new Date().toISOString();
        const paused =
          current.status === "paused"
            ? current
            : await updatePersistedAllowlist({
                ...current,
                version: allowlistVersionAfter(current),
                status: "paused",
                pausedAt: now,
                updatedAt: now
              });
        await pauseResearchRunsForAllowlist(
          input.projectId,
          input.allowlistId,
          now,
          input.reason ?? "Research allowlist paused; pause queued runs and stop in-flight automatic research."
        );
        const projection = await listAllowlistProjection(input.projectId, paused);

        return allowlistCommandResponse(
          "PauseResearchAllowlist",
          input.projectId,
          stateVersionBefore,
          projection,
          input.reason
        );
      } catch (error) {
        throw validationError(error);
      }
    },

    async revokeResearchAllowlist(
      input: RunResearchAllowlistLifecycleInput
    ): Promise<CommandResponse<ResearchAllowlistGovernanceProjection>> {
      try {
        await requireProject(input.projectId);

        const current = await findProjectAllowlist(input.projectId, input.allowlistId);
        const stateVersionBefore = await allowlistCollectionStateVersion(input.projectId);
        const now = new Date().toISOString();
        const revoked =
          current.status === "revoked"
            ? current
            : await updatePersistedAllowlist({
                kind: current.kind,
                version: allowlistVersionAfter(current),
                allowlistId: current.allowlistId,
                projectId: current.projectId,
                status: "revoked",
                connectorIds: current.connectorIds,
                sourceCategories: current.sourceCategories,
                contextMode: current.contextMode,
                rateBudgetPolicy: current.rateBudgetPolicy,
                stalenessPolicy: current.stalenessPolicy,
                disclosureLogPolicy: current.disclosureLogPolicy,
                approvedBy: current.approvedBy,
                approvedAt: current.approvedAt,
                revokedAt: now,
                createdAt: current.createdAt,
                updatedAt: now
              });
        await cancelActiveResearchRunsForRevokedAllowlist(
          input.projectId,
          input.allowlistId,
          input.reason ?? "Research allowlist revoked; stop automatic read-only research runs."
        );
        const projection = await listAllowlistProjection(input.projectId, revoked);

        return allowlistCommandResponse(
          "RevokeResearchAllowlist",
          input.projectId,
          stateVersionBefore,
          projection,
          input.reason
        );
      } catch (error) {
        throw validationError(error);
      }
    },

    async listResearchDisclosures(projectIdValue: ProjectId): Promise<ResearchDisclosureLogProjection> {
      await requireProject(projectIdValue);

      return listDisclosureProjection(projectIdValue);
    },

    async prepareResearchDisclosure(
      input: RunResearchDisclosureInput
    ): Promise<CommandResponse<ResearchDisclosurePreparationResult>> {
      try {
        await requireProject(input.projectId);
        assertRequestProjectMatchesRoute(input.projectId, input.request.projectId);
        assertSafeResearchConnectorId(input.request.connectorId);

        const publicSafePayload = buildPublicSafeResearchSummary(input.request);
        const allowlist = await matchingAllowlistForDisclosure(input.projectId, input.request);
        const blockReason = blockReasonForDisclosure(input.request, allowlist);
        const stateVersionBefore = disclosureCollectionVersion(await listProjectDisclosureLogs(input.projectId)) as unknown as StateVersion;
        const now = new Date().toISOString();
        const saved = await createResearchDisclosureLogRepository(storage.db).create({
          log: researchDisclosureLogFromRequest(input.projectId, input.request, publicSafePayload, allowlist, blockReason, now),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        });
        const projection = await listDisclosureProjection(input.projectId, saved);
        const result = {
          kind: "ResearchDisclosurePreparationResult",
          status: saved.status,
          automaticExternalTransferAllowed: saved.automaticExternalTransferAllowed,
          publicSafePayload,
          disclosureLog: saved,
          projection,
          ...(saved.manualHandoffReason
            ? {
                manualHandoff: {
                  required: true,
                  reason: saved.manualHandoffReason,
                  route: "task_level_approval_or_manual_handoff"
                }
              }
            : {})
        } satisfies ResearchDisclosurePreparationResult;

        return disclosureCommandResponse(stateVersionBefore, result);
      } catch (error) {
        throw validationError(error);
      }
    },

    async listResearchRuns(projectIdValue: ProjectId): Promise<ResearchRunControlProjection> {
      await requireProject(projectIdValue);
      await pollReadyProjectResearchRuns(projectIdValue);

      return listResearchRunProjection(projectIdValue);
    },

    async getResearchRunStatus(input: RunResearchRunStatusInput): Promise<ResearchRunStatusDto> {
      await requireProject(input.projectId);

      const run = await pollMountedResearchRunResultIfReady(
        await findProjectResearchRun(input.projectId, input.researchRunId)
      );
      const projection = await listResearchRunProjection(input.projectId, run);

      return {
        ...projection,
        selectedRun: run,
        statusUrl: researchRunStatusUrl(input.projectId, input.researchRunId)
      };
    },

    async listPhase15bUpgradeHints(projectIdValue: ProjectId): Promise<Phase15bUpgradeHintProjection> {
      await requireProject(projectIdValue);

      return listPhase15bHintProjection(projectIdValue);
    },

    async exportPhase15bUpgradeHints(projectIdValue: ProjectId): Promise<Phase15bUpgradeHintExportDto> {
      await requireProject(projectIdValue);

      return exportPhase15bHintProjection(projectIdValue);
    },

    async startResearchRun(
      input: RunResearchRunStartInput
    ): Promise<CommandResponse<ResearchRunControlResult>> {
      try {
        await requireProject(input.projectId);
        assertRequestResearchRunProjectMatchesRoute(input.projectId, input.request.projectId);
        assertSafeResearchConnectorId(input.request.connectorId);

        if (input.request.adapterKind && !isKnownResearchAdapterKind(input.request.adapterKind)) {
          throw new ProductEngineServiceError("VALIDATION_FAILED", "adapterKind must be a provider-neutral adapter kind.");
        }

        const request = await requestWithResearchMemorySourceRefs(input.projectId, input.request);
        const stateVersionBefore = await researchRunCollectionStateVersion(input.projectId);
        const now = new Date().toISOString();
        const publicSafePayload = buildPublicSafeResearchSummary(request);
        const allowlist = await matchingAllowlistForDisclosure(input.projectId, request);
        const blockReason = blockReasonForDisclosure(request, allowlist);

        if (blockReason || !allowlist) {
          const disclosureLog = await persistResearchRunDisclosureLog(
            input.projectId,
            request,
            publicSafePayload,
            allowlist,
            blockReason,
            now
          );
          const reason =
            disclosureLog.manualHandoffReason ?? "No active allowlist matches this research run start request.";
          const result = await blockedResearchRunStartResult(
            input.projectId,
            "blocked_manual_handoff",
            reason,
            "allowlist_or_context_blocked",
            disclosureLog,
            publicSafePayload,
            {
              required: true,
              reason,
              route: "task_level_approval_or_manual_handoff"
            }
          );

          return researchRunCommandResponse("StartResearchRun", stateVersionBefore, result);
        }

        const staleBlocker = stalePolicyBlocker(request, now);
        const adapterBlocker = mountedResearchAdapterBlocker(request);
        const preconditionBlocker = staleBlocker ?? adapterBlocker;

        if (preconditionBlocker) {
          const disclosureLog = await persistResearchRunDisclosureLog(
            input.projectId,
            request,
            publicSafePayload,
            allowlist,
            blockReason,
            now
          );
          const result = await blockedResearchRunStartResult(
            input.projectId,
            "blocked_precondition",
            preconditionBlocker,
            staleBlocker ? "staleness_policy_failed" : "adapter_unavailable",
            disclosureLog,
            publicSafePayload
          );

          return researchRunCommandResponse("StartResearchRun", stateVersionBefore, result);
        }

        const repository = createResearchRunRepository(storage.db);
        const existingRun = await repository.getByProjectIdAndIdempotencyKey(
          input.projectId,
          researchRunStartIdempotencyKey(request, allowlist, publicSafePayload)
        );

        if (existingRun) {
          const started = await startMountedResearchRunIfQueued(existingRun, publicSafePayload);
          const existingDisclosureLog = await findDisclosureLogForRun(started);
          const projection = await listResearchRunProjection(input.projectId, started);
          const recovery = researchRunRecoveryHint(input.projectId, started.researchRunId);
          const result = {
            kind: "ResearchRunControlResult",
            action: "start",
            status: isResearchRunStartInProgress(started) ? "started" : "status",
            projectId: input.projectId,
            researchRun: started,
            researchRunId: started.researchRunId,
            researchTaskId: started.researchTaskId,
            allowlistId: started.allowlistId,
            disclosureLogId: started.disclosureLogId,
            ...(existingDisclosureLog ? { disclosureLog: existingDisclosureLog } : {}),
            publicSafePayload,
            projection,
            statusUrl: researchRunStatusUrl(input.projectId, started.researchRunId),
            recovery
          } satisfies ResearchRunControlResult;

          return researchRunCommandResponse("StartResearchRun", stateVersionBefore, result);
        }

        const budgetBlocker = await rateBudgetBlocker(input.projectId, allowlist, request.researchTaskId);

        if (budgetBlocker) {
          const disclosureLog = await persistResearchRunDisclosureLog(
            input.projectId,
            request,
            publicSafePayload,
            allowlist,
            blockReason,
            now
          );
          const result = await blockedResearchRunStartResult(
            input.projectId,
            "blocked_precondition",
            budgetBlocker,
            "rate_budget_exhausted",
            disclosureLog,
            publicSafePayload
          );

          return researchRunCommandResponse("StartResearchRun", stateVersionBefore, result);
        }

        const disclosureLog = await persistResearchRunDisclosureLog(
          input.projectId,
          request,
          publicSafePayload,
          allowlist,
          blockReason,
          now
        );
        const created = await repository.create({
          run: researchRunFromStartRequest(input.projectId, request, allowlist, disclosureLog, publicSafePayload, now),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        });

        if (!created) {
          throw new ProductEngineServiceError(
            "IDEMPOTENCY_CONFLICT",
            "Research run id conflicts with a different idempotency key.",
            {
              projectId: input.projectId,
              researchRunId: request.researchRunId
            }
          );
        }

        const started = await startMountedResearchRunIfQueued(created, publicSafePayload);
        const projection = await listResearchRunProjection(input.projectId, started);
        const recovery = researchRunRecoveryHint(input.projectId, started.researchRunId);
        const result = {
          kind: "ResearchRunControlResult",
          action: "start",
          status: "started",
          projectId: input.projectId,
          researchRun: started,
          researchRunId: started.researchRunId,
          researchTaskId: started.researchTaskId,
          allowlistId: started.allowlistId,
          disclosureLogId: disclosureLog.logId,
          disclosureLog,
          publicSafePayload,
          projection,
          statusUrl: researchRunStatusUrl(input.projectId, started.researchRunId),
          recovery
        } satisfies ResearchRunControlResult;

        return researchRunCommandResponse("StartResearchRun", stateVersionBefore, result);
      } catch (error) {
        throw validationError(error);
      }
    },

    async cancelResearchRun(
      input: RunResearchRunCancelInput
    ): Promise<CommandResponse<ResearchRunControlResult>> {
      try {
        await requireProject(input.projectId);
        assertRequestResearchRunProjectMatchesRoute(input.projectId, input.request.projectId);

        if (input.request.researchRunId && input.request.researchRunId !== input.researchRunId) {
          throw new ProductEngineServiceError("VALIDATION_FAILED", "researchRunId must match the route param.", {
            routeResearchRunId: input.researchRunId,
            bodyResearchRunId: input.request.researchRunId
          });
        }

        const stateVersionBefore = await researchRunCollectionStateVersion(input.projectId);
        const current = await findProjectResearchRun(input.projectId, input.researchRunId);
        const cancelled = await cancelResearchRunWithMountedAdapter(
          current,
          input.request.reason ?? "User requested cancellation for the read-only research run."
        );
        const projection = await listResearchRunProjection(input.projectId, cancelled);
        const recovery = researchRunRecoveryHint(input.projectId, cancelled.researchRunId);
        const result = {
          kind: "ResearchRunControlResult",
          action: "cancel",
          status: cancelled.status === "cancelled" ? "cancelled" : "cancel_requested",
          projectId: input.projectId,
          researchRun: cancelled,
          researchRunId: cancelled.researchRunId,
          researchTaskId: cancelled.researchTaskId,
          allowlistId: cancelled.allowlistId,
          disclosureLogId: cancelled.disclosureLogId,
          projection,
          statusUrl: researchRunStatusUrl(input.projectId, cancelled.researchRunId),
          recovery
        } satisfies ResearchRunControlResult;

        return researchRunCommandResponse("CancelResearchRun", stateVersionBefore, result);
      } catch (error) {
        throw validationError(error);
      }
    },

    async retryResearchRun(
      input: RunResearchRunRetryInput
    ): Promise<CommandResponse<ResearchRunControlResult>> {
      try {
        await requireProject(input.projectId);
        assertRequestResearchRunProjectMatchesRoute(input.projectId, input.request.projectId);

        if (input.request.researchRunId && input.request.researchRunId !== input.researchRunId) {
          throw new ProductEngineServiceError("VALIDATION_FAILED", "researchRunId must match the route param.", {
            routeResearchRunId: input.researchRunId,
            bodyResearchRunId: input.request.researchRunId
          });
        }

        const stateVersionBefore = await researchRunCollectionStateVersion(input.projectId);
        const priorRun = await findProjectResearchRun(input.projectId, input.researchRunId);
        const allowlist = await findProjectAllowlist(input.projectId, priorRun.allowlistId);
        const disclosureLog = await findDisclosureLogForRun(priorRun);

        if (!canCreateManualResearchRunRetry(priorRun.status)) {
          const projection = await listResearchRunProjection(input.projectId, priorRun);
          const recovery = researchRunRecoveryHint(input.projectId, priorRun.researchRunId);
          const result = {
            kind: "ResearchRunControlResult",
            action: "retry",
            status: "blocked_precondition",
            projectId: input.projectId,
            researchRun: priorRun,
            researchRunId: priorRun.researchRunId,
            researchTaskId: priorRun.researchTaskId,
            allowlistId: priorRun.allowlistId,
            disclosureLogId: priorRun.disclosureLogId,
            projection,
            statusUrl: researchRunStatusUrl(input.projectId, priorRun.researchRunId),
            recovery,
            blocker: {
              reason: "Only failed, stale, or research_insufficient runs can be manually retried.",
              code: "retry_not_allowed"
            }
          } satisfies ResearchRunControlResult;

          return researchRunCommandResponse("RetryResearchRun", stateVersionBefore, result);
        }

        const disclosurePayload = disclosureLog
          ? {
              researchObjective: disclosureLog.researchObjective,
              publicSafeSummary: disclosureLog.publicSafeSummarySent
            }
          : undefined;
        const publicSafePayload = disclosurePayload ?? {
          researchObjective: priorRun.researchTaskId,
          publicSafeSummary: "Manual retry uses the prior public-safe disclosure summary."
        };
        const retryPolicyBlocker =
          allowlist.status !== "active"
            ? `The research allowlist is ${allowlist.status}; reactivate with fresh approval before retrying.`
            : !allowlist.connectorIds.includes(priorRun.connectorId)
              ? "The research allowlist no longer permits the prior run connector; refresh approval before retrying."
              : !allowlist.sourceCategories.includes(priorRun.sourceCategory)
                ? "The research allowlist no longer permits the prior run source category; refresh approval before retrying."
                : null;

        if (retryPolicyBlocker) {
          const result = await blockedResearchRunControlResult(
            input.projectId,
            "retry",
            "blocked_precondition",
            retryPolicyBlocker,
            "allowlist_or_context_blocked",
            disclosureLog ?? undefined,
            disclosurePayload,
            undefined,
            priorRun
          );

          return researchRunCommandResponse("RetryResearchRun", stateVersionBefore, result);
        }

        const retryAdapterBlocker = mountedResearchRunAdapterBlocker(priorRun);

        if (retryAdapterBlocker) {
          const result = await blockedResearchRunControlResult(
            input.projectId,
            "retry",
            "blocked_precondition",
            retryAdapterBlocker,
            "adapter_unavailable",
            disclosureLog ?? undefined,
            publicSafePayload,
            undefined,
            priorRun
          );

          return researchRunCommandResponse("RetryResearchRun", stateVersionBefore, result);
        }

        const maxAttempt = allowlist.rateBudgetPolicy.maxAutomaticRetriesPerRun + 1;

        if (priorRun.provider.attempt >= maxAttempt) {
          const result = await blockedResearchRunControlResult(
            input.projectId,
            "retry",
            "blocked_precondition",
            `Retry budget exhausted at attempt ${priorRun.provider.attempt}; max allowed attempt is ${maxAttempt}.`,
            "retry_not_allowed",
            disclosureLog ?? undefined,
            disclosurePayload,
            undefined,
            priorRun
          );

          return researchRunCommandResponse("RetryResearchRun", stateVersionBefore, result);
        }

        const retryRun = researchRunRetryFromPrior(
          priorRun,
          allowlist,
          disclosureLog,
          input.request,
          new Date().toISOString()
        );
        const repository = createResearchRunRepository(storage.db);
        const existingRetry = await repository.getByProjectIdAndIdempotencyKey(
          input.projectId,
          retryRun.provider.idempotencyKey
        );
        let retryCandidate = existingRetry;

        if (!retryCandidate) {
          const budgetBlocker = await rateBudgetBlocker(input.projectId, allowlist, retryRun.researchTaskId);

          if (budgetBlocker) {
            const result = await blockedResearchRunControlResult(
              input.projectId,
              "retry",
              "blocked_precondition",
              budgetBlocker,
              "rate_budget_exhausted",
              disclosureLog ?? undefined,
              publicSafePayload,
              undefined,
              priorRun
            );

            return researchRunCommandResponse("RetryResearchRun", stateVersionBefore, result);
          }
        }

        retryCandidate ??= await repository.create({
          run: retryRun,
          schemaVersion: CONTRACT_SCHEMA_VERSION
        });

        if (!retryCandidate) {
          throw new ProductEngineServiceError("IDEMPOTENCY_CONFLICT", "Manual retry conflicts with an existing research run.", {
            retryOfRunId: priorRun.researchRunId
          });
        }

        const started = await startMountedResearchRunIfQueued(retryCandidate, publicSafePayload);
        const projection = await listResearchRunProjection(input.projectId, started);
        const recovery = researchRunRecoveryHint(input.projectId, started.researchRunId);
        const retryStarted = isResearchRunStartInProgress(started);
        const retryAfterSeconds = retryStarted ? attemptRetryBackoffSeconds(allowlist, started.provider.attempt) : undefined;
        const result = {
          kind: "ResearchRunControlResult",
          action: "retry",
          status: retryStarted ? "retry_started" : "status",
          projectId: input.projectId,
          researchRun: started,
          researchRunId: started.researchRunId,
          researchTaskId: started.researchTaskId,
          allowlistId: started.allowlistId,
          disclosureLogId: started.disclosureLogId,
          ...(disclosureLog ? { disclosureLog } : {}),
          publicSafePayload,
          projection,
          statusUrl: researchRunStatusUrl(input.projectId, started.researchRunId),
          recovery,
          ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
          priorFailure: {
            ...priorRunFailureSummary(priorRun),
            ...(disclosureLog ? { disclosureSummary: disclosureLog.publicSafeSummarySent } : {})
          }
        } satisfies ResearchRunControlResult;

        return researchRunCommandResponse("RetryResearchRun", stateVersionBefore, result);
      } catch (error) {
        throw validationError(error);
      }
    },

    async runSessionCommand(input: RunSessionCommandInput): Promise<CommandResponse> {
      return runSessionCommandSerialized(input.sessionId, async () => {
        const { command, events } = await commandForExistingSession(input);

        return runCommand(command, events);
      });
    },

    async runPendingResearchEvidenceEffects(limit = 10) {
      const effectRepository = createEffectTaskRepository(storage.db);
      const queuedEffects = await effectRepository.listQueuedByType("research_evidence_effect");
      const results = [];

      for (const effect of queuedEffects.slice(0, limit)) {
        results.push(await runResearchEvidenceEffect(effect));
      }

      return results;
    },

    async runPendingCodexRuntimePreviewEffects(limit = 10) {
      const effectRepository = createEffectTaskRepository(storage.db);
      const queuedEffects = await effectRepository.listQueuedByType("codex_runtime_preview_effect");
      const results = [];

      for (const effect of queuedEffects.slice(0, limit)) {
        results.push(await runCodexRuntimePreviewEffect(effect));
      }

      return results;
    },

    getRuntimeStatus() {
      return codexRuntimeAdapter.getStatus();
    },

    async getSession(projectIdValue: ProjectId, sessionIdValue: SessionId): Promise<SessionShellProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session || session.projectId !== projectIdValue) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          projectId: projectIdValue,
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<SessionShellProjection>(
        sessionIdValue,
        "SessionShellProjection"
      );

      const state = await stateForSession(session.projectId, sessionIdValue);
      const phase = sessionShellPhaseForProductEnginePhase(state.session.phase);

      if (projection) {
        return {
          ...projection,
          phase,
          ...sessionProjectPurposeModeFields(state.project),
          version:
            projection.phase === phase
              ? projection.version
              : (Number(state.stateVersion) as SessionShellProjection["version"])
        };
      }

      return {
        kind: "SessionShellProjection",
        projectId: session.projectId,
        sessionId: session.sessionId,
        version: Number(state.stateVersion) as SessionShellProjection["version"],
        phase,
        ...sessionProjectPurposeModeFields(state.project)
      };
    },

    async getSpec(sessionIdValue: SessionId): Promise<LivingSpecProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<LivingSpecProjection>(
        sessionIdValue,
        "LivingSpecProjection"
      );

      if (projection) {
        return projection;
      }

      const state = await stateForSession(session.projectId, sessionIdValue);

      return {
        kind: "LivingSpecProjection",
        sessionId: sessionIdValue,
        version: Number(state.stateVersion) as LivingSpecProjection["version"],
        ...(state.currentSpec.title ? { title: state.currentSpec.title } : {}),
        ...(state.currentSpec.sections ? { sections: state.currentSpec.sections } : {}),
        sectionCount: state.currentSpec.sections?.length ?? 0,
        approvalStatus: "draft"
      };
    },

    async listSpecVersions(sessionIdValue: SessionId) {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const state = await stateForSession(session.projectId, sessionIdValue);

      if (!state.currentSpec.versionRef) {
        return [];
      }

      return [
        {
          specVersionId: state.currentSpec.versionRef,
          sessionId: sessionIdValue,
          title: state.currentSpec.title ?? "Untitled product idea",
          sectionCount: state.currentSpec.sections?.length ?? 0,
          approved: state.decisions.some((decision) => decision.status === "approved")
        }
      ];
    },

    async getQueue(sessionIdValue: SessionId): Promise<DecisionQueueProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<DecisionQueueProjection>(
        sessionIdValue,
        "DecisionQueueProjection"
      );
      const effects = await createEffectTaskRepository(storage.db).listForSession(sessionIdValue);

      if (projection) {
        return decisionQueueProjectionForRecovery(
          projection,
          sessionIdValue,
          effects,
          projection.generatedAt ?? new Date(0).toISOString()
        );
      }

      const stateProjection = (await stateForSession(session.projectId, sessionIdValue)).queueProjection;

      return decisionQueueProjectionForRecovery(
        stateProjection,
        sessionIdValue,
        effects,
        stateProjection.generatedAt ?? new Date(0).toISOString()
      );
    },

    async getResearch(sessionIdValue: SessionId): Promise<ResearchEvidenceProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<ResearchEvidenceProjection>(
        sessionIdValue,
        "ResearchEvidenceProjection"
      );

      if (projection) {
        return projection;
      }

      return (await stateForSession(session.projectId, sessionIdValue)).researchState;
    },

    async getActivity(sessionIdValue: SessionId): Promise<RuntimeActivityProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<RuntimeActivityProjection>(
        sessionIdValue,
        "RuntimeActivityProjection"
      );

      if (projection) {
        return projection;
      }

      return createRuntimeRepository(storage.db).getProjection(sessionIdValue);
    },

    async getCompleteness(sessionIdValue: SessionId): Promise<ConfidenceCompletionProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<ConfidenceCompletionProjection>(
        sessionIdValue,
        "ConfidenceCompletionProjection"
      );

      if (projection) {
        return projection;
      }

      return (await stateForSession(session.projectId, sessionIdValue)).completeness;
    },

    async getFounderBrief(sessionIdValue: SessionId): Promise<FounderBriefProjection> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<FounderBriefProjection>(
        sessionIdValue,
        "FounderBriefProjection"
      );

      if (!projection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Founder Brief has not been prepared yet.", {
          sessionId: sessionIdValue
        });
      }

      return projection;
    },

    async getPlanningHandoff(sessionIdValue: SessionId): Promise<PlanningHandoffProjection | null> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      return createPlanningHandoffRepository(storage.db).getLatestForSession(sessionIdValue);
    },

    async getExecutionAuthority(sessionIdValue: SessionId): Promise<ExecutionAuthorityLedgerProjection | null> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      return createExecutionAuthorityRepository(storage.db).getLatestForSession(sessionIdValue);
    },

    async getChatGptBrowserDelegation(sessionIdValue: SessionId): Promise<ChatGptBrowserDelegationProjection | null> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      return createProjectionRepository(storage.db).get<ChatGptBrowserDelegationProjection>(
        sessionIdValue,
        "ChatGptBrowserDelegationProjection"
      );
    },

    async getServicePageUsePermission(sessionIdValue: SessionId): Promise<ServicePageUsePermissionProjection | null> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      return createProjectionRepository(storage.db).get<ServicePageUsePermissionProjection>(
        sessionIdValue,
        "ServicePageUsePermissionProjection"
      );
    },

    async getImplementationStepLedger(sessionIdValue: SessionId): Promise<ImplementationStepLedgerProjection | null> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      return createProjectionRepository(storage.db).get<ImplementationStepLedgerProjection>(
        sessionIdValue,
        "ImplementationStepLedgerProjection"
      );
    },


    async createAutoImplementationRun(
      request: CreateAutoImplementationRunRequest
    ): Promise<AutoImplementationRunProjection> {
      const session = await createProjectRepository(storage.db).getSession(request.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: request.sessionId
        });
      }

      const projectionRepository = createProjectionRepository(storage.db);
      const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
        request.sessionId,
        "AutoImplementationRunProjection"
      );
      const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;
      const runId = autoImplementationRunId(request.sessionId, request.idempotencyKey);

      if (existingProjection?.runs.some((run) => run.runId === runId)) {
        return existingProjection;
      }

      const sourceValidation = await autoImplementationRequestWithValidatedSource(
        request,
        existingProjection,
        createPlanningHandoffRepository(storage.db)
      );
      const sourceValidatedRequest = sourceValidation.request;

      if (sourceValidatedRequest.githubIssueCreation?.mode === "approved" && existingProjection) {
        const requestedProjectFolderName = sanitizeProjectFolderName(
          sourceValidatedRequest.projectFolderName ??
            sourceValidatedRequest.projectName ??
            DEFAULT_AUTO_IMPLEMENTATION_PROJECT_FOLDER_NAME
        );
        const hasExistingGitHubIssuesForWorkspace = existingProjection.runs.some((run) =>
          run.projectFolderName === requestedProjectFolderName &&
          !canCreateAutoImplementationGitHubIssues(run)
        );

        if (hasExistingGitHubIssuesForWorkspace) {
          return existingProjection;
        }
      }

      const now = new Date().toISOString();
      let run: AutoImplementationRun;

      try {
        run = await prepareAutoImplementationWorkspaceRun({
          sessionId: request.sessionId,
          runId,
          request: sourceValidatedRequest,
          ...(sourceValidation.planningHandoffArtifact
            ? { planningHandoffArtifact: sourceValidation.planningHandoffArtifact }
            : {}),
          workspaceRoot: autoImplementationWorkspaceRoot,
          now,
          ...(autoImplementationRemoteStatusProvider ? { remoteStatusProvider: autoImplementationRemoteStatusProvider } : {}),
          ...(autoImplementationGitHubIssueMutationAdapter
            ? { githubIssueMutationAdapter: autoImplementationGitHubIssueMutationAdapter }
            : {})
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown workspace preparation failure.";

        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation workspace could not be prepared safely.",
          { message }
        );
      }
      const runs = [...(existingProjection?.runs ?? []), run];
      const projection = validateAutoImplementationRunProjection({
        kind: "AutoImplementationRunProjection",
        sessionId: request.sessionId,
        version: ((existingProjection?.version ?? 0) + 1) as ProjectionVersion,
        latestRun: run,
        runs,
        summary: `Auto implementation workspace is ready for ${run.projectFolderName}; remote status is ${run.remoteStatus}.`,
        refetchUrl: `/api/v1/sessions/${request.sessionId}/auto-implementation-runs`,
        schemaVersion: AUTO_IMPLEMENTATION_SCHEMA_VERSION
      });

      return saveAutoImplementationRunProjection({
        projectionRepository,
        projectId: session.projectId,
        sessionId: request.sessionId,
        projection,
        latestRun: run,
        updatedAt: now
      });
    },

    async createAutoImplementationWorkerJob(
      request: CreateAutoImplementationWorkerJobRequest
    ): Promise<AutoImplementationRunProjection> {
      assertAutoImplementationWorkerExecutionAuthorityRef(request.executionAuthorityRef);

      const session = await createProjectRepository(storage.db).getSession(request.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: request.sessionId
        });
      }

      const projectionRepository = createProjectionRepository(storage.db);
      const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
        request.sessionId,
        "AutoImplementationRunProjection"
      );
      const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

      if (!existingProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
          sessionId: request.sessionId
        });
      }

      const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

      if (!run) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
          runId: request.runId
        });
      }

      const jobId = autoImplementationWorkerJobId(request, run.currentStage);

      if (run.workerJobs.some((job) => job.jobId === jobId)) {
        return existingProjection;
      }

      if (run.status === "completed") {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "Completed auto implementation runs cannot create worker jobs.");
      }

      const issue = run.issueManagement.issueDocs.find((candidate) => candidate.stage === run.currentStage);

      if (!issue) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation worker jobs require a current-stage issue document."
        );
      }

      if (!canPlanCurrentStageAutoImplementationWorkerJob(run)) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "The current auto implementation stage already has a usable local Codex worker job; run, import, complete, or advance it before planning another worker job.",
          { runId: run.runId, currentStage: run.currentStage }
        );
      }

      const now = new Date().toISOString();
      const authorityProjection = request.executionAuthorityRef
        ? await createExecutionAuthorityRepository(storage.db).getById(request.executionAuthorityRef)
        : null;

      if (authorityProjection && authorityProjection.sessionId !== request.sessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "executionAuthorityRef must belong to the request session.", {
          executionAuthorityRef: request.executionAuthorityRef,
          routeSessionId: request.sessionId,
          authoritySessionId: authorityProjection.sessionId
        });
      }

      const workerJob = autoImplementationWorkerJob({ request, run, issue, authorityProjection, now });
      const updatedRun: AutoImplementationRun = {
        ...run,
        status: workerJob.status === "blocked" ? "blocked" : "running",
        workerJobs: [...run.workerJobs, workerJob],
        updatedAt: now,
        evidenceRefs: uniqueAutoImplementationRefs([...run.evidenceRefs, ...workerJob.evidenceRefs])
      };
      const runs = existingProjection.runs.map((candidate) =>
        candidate.runId === request.runId ? updatedRun : candidate
      );
      const projection = validateAutoImplementationRunProjection({
        ...existingProjection,
        version: (existingProjection.version + 1) as ProjectionVersion,
        latestRun: updatedRun,
        runs,
        summary: `Auto implementation worker job ${workerJob.status} for ${workerJob.stage}.`
      });

      return saveAutoImplementationRunProjection({
        projectionRepository,
        projectId: session.projectId,
        sessionId: request.sessionId,
        projection,
        latestRun: updatedRun,
        updatedAt: now
      });
    },

    async completeAutoImplementationWorkerJob(
      request: CompleteAutoImplementationWorkerJobRequest
    ): Promise<AutoImplementationRunProjection> {
      const session = await createProjectRepository(storage.db).getSession(request.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: request.sessionId
        });
      }

      const projectionRepository = createProjectionRepository(storage.db);
      const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
        request.sessionId,
        "AutoImplementationRunProjection"
      );
      const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

      if (!existingProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
          sessionId: request.sessionId
        });
      }

      const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

      if (!run) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
          runId: request.runId
        });
      }

      const workerJob = run.workerJobs.find((job) => job.jobId === request.jobId);

      if (!workerJob) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation worker job was not found.", {
          jobId: request.jobId
        });
      }

      if (workerJob.status === "completed") {
        return existingProjection;
      }

      if (!canCompleteAutoImplementationWorkerJob(workerJob)) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Only planned worker jobs or worker jobs blocked by missing ledger evidence can be completed."
        );
      }

      if (run.currentStage !== workerJob.stage) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation worker jobs can only complete the current stage.",
          { currentStage: run.currentStage, workerStage: workerJob.stage }
        );
      }

      const completionRef = autoImplementationWorkerCompletionRef(request);
      const now = new Date().toISOString();
      let completedJob: AutoImplementationWorkerJob;

      try {
        const ledger = validatedLedgerForAutoImplementationStage(
          await projectionRepository.get<ImplementationStepLedgerProjection>(
            request.sessionId,
            "ImplementationStepLedgerProjection"
          )
        );

        if (!ledger) {
          throw new ProductEngineServiceError(
            "VALIDATION_FAILED",
            "Auto implementation worker completion requires an ImplementationStepLedger projection."
          );
        }

        const ledgerStep = completedLedgerStepForAutoImplementationStage(
          ledger,
          request.implementationStepId,
          workerJob.stage
        );
        assertAutoImplementationWorkerCompletionLedgerMatchesPlan({ ledger, ledgerStep, workerJob });
        const ledgerEvidence = autoImplementationStageLedgerEvidence(ledger, ledgerStep);

        completedJob = {
          ...workerJob,
          status: "completed",
          blockedReason: null,
          missingEvidence: [],
          nextRequiredAction: "Advance the current auto implementation stage through the existing stage endpoint with the validated ImplementationStepLedger evidence.",
          updatedAt: now,
          evidenceRefs: uniqueAutoImplementationRefs([
            ...workerJob.evidenceRefs,
            completionRef,
            ...ledgerEvidence.evidenceRefs,
            ...(request.evidenceRefs ?? [])
          ])
        };
      } catch (error) {
        if (!(error instanceof ProductEngineServiceError)) {
          throw error;
        }

        completedJob = {
          ...workerJob,
          status: "blocked",
          blockedReason: error.message,
          missingEvidence: [AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.completedLedgerStep],
          nextRequiredAction: "Record a completed ImplementationStepLedger step for this worker job before marking it complete.",
          updatedAt: now,
          evidenceRefs: uniqueAutoImplementationRefs([
            ...workerJob.evidenceRefs,
            completionRef,
            "worker-blocked:missing-implementation-ledger",
            ...(request.evidenceRefs ?? [])
          ])
        };
      }

      const updatedRun: AutoImplementationRun = {
        ...run,
        status: completedJob.status === "blocked" ? "blocked" : "running",
        workerJobs: run.workerJobs.map((job) => job.jobId === request.jobId ? completedJob : job),
        updatedAt: now,
        evidenceRefs: uniqueAutoImplementationRefs([...run.evidenceRefs, ...completedJob.evidenceRefs])
      };
      const runs = existingProjection.runs.map((candidate) =>
        candidate.runId === request.runId ? updatedRun : candidate
      );
      const projection = validateAutoImplementationRunProjection({
        ...existingProjection,
        version: (existingProjection.version + 1) as ProjectionVersion,
        latestRun: updatedRun,
        runs,
        summary: `Auto implementation worker job ${completedJob.status} for ${completedJob.stage}.`
      });

      return saveAutoImplementationRunProjection({
        projectionRepository,
        projectId: session.projectId,
        sessionId: request.sessionId,
        projection,
        latestRun: updatedRun,
        updatedAt: now
      });
    },

    async importAutoImplementationWorkerLedger(
      request: ImportAutoImplementationWorkerLedgerRequest
    ): Promise<AutoImplementationRunProjection> {
      return importAutoImplementationWorkerLedgerProjection(request);
    },

    async runAutoImplementationWorkerJob(
      request: RunAutoImplementationWorkerJobRequest
    ): Promise<AutoImplementationRunProjection> {
      return runAutoImplementationWorkerJobProjection(request);
    },

    async advanceAutoImplementationWorkerStage(
      request: AdvanceAutoImplementationWorkerStageRequest
    ): Promise<AutoImplementationRunProjection> {
      const session = await createProjectRepository(storage.db).getSession(request.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: request.sessionId
        });
      }

      const projectionRepository = createProjectionRepository(storage.db);
      const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
        request.sessionId,
        "AutoImplementationRunProjection"
      );
      const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

      if (!existingProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
          sessionId: request.sessionId
        });
      }

      const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

      if (!run) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
          runId: request.runId
        });
      }

      const workerJob = run.workerJobs.find((job) => job.jobId === request.jobId);

      if (!workerJob) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation worker job was not found.", {
          jobId: request.jobId
        });
      }

      if (workerJob.status !== "completed") {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Only completed auto implementation worker jobs can advance their stage."
        );
      }

      if (run.currentStage !== workerJob.stage) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Completed worker jobs can only advance the current auto implementation stage.",
          { currentStage: run.currentStage, workerStage: workerJob.stage }
        );
      }

      const implementationStepId = completedImplementationStepIdFromWorkerJob(workerJob);
      const ledger = validatedLedgerForAutoImplementationStage(
        await projectionRepository.get<ImplementationStepLedgerProjection>(
          request.sessionId,
          "ImplementationStepLedgerProjection"
        )
      );

      if (!ledger) {
        throw new ProductEngineServiceError(
          "VALIDATION_FAILED",
          "Auto implementation worker stage advance requires an ImplementationStepLedger projection."
        );
      }

      const ledgerStep = completedLedgerStepForAutoImplementationStage(
        ledger,
        implementationStepId,
        workerJob.stage
      );
      assertAutoImplementationWorkerCompletionLedgerMatchesPlan({ ledger, ledgerStep, workerJob });

      return recordAutoImplementationStageProjection({
        sessionId: request.sessionId,
        runId: request.runId,
        stage: workerJob.stage,
        action: "complete",
        idempotencyKey: request.idempotencyKey,
        implementationStepId,
        evidenceRefs: uniqueAutoImplementationRefs([
          autoImplementationWorkerStageAdvanceRef(request),
          ...workerJob.evidenceRefs,
          ...(request.evidenceRefs ?? [])
        ]),
        ...(request.tickedAt ? { tickedAt: request.tickedAt } : {})
      });
    },

    async recordAutoImplementationPullRequestMutation(
      request: RecordAutoImplementationPullRequestMutationRequest
    ): Promise<AutoImplementationRunProjection> {
      const session = await createProjectRepository(storage.db).getSession(request.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: request.sessionId
        });
      }

      const projectionRepository = createProjectionRepository(storage.db);
      const persistedProjection = await projectionRepository.get<AutoImplementationRunProjection>(
        request.sessionId,
        "AutoImplementationRunProjection"
      );
      const existingProjection = persistedProjection ? normalizeLegacyAutoImplementationProjection(persistedProjection) : null;

      if (!existingProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run projection was not found.", {
          sessionId: request.sessionId
        });
      }

      const run = existingProjection.runs.find((candidate) => candidate.runId === request.runId);

      if (!run) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Auto implementation run was not found.", {
          runId: request.runId
        });
      }

      const existingRecord = run.pullRequestMutations.records.find(
        (record) => record.mutationId === autoImplementationPullRequestMutationId(request)
      );

      if (existingRecord) {
        return existingProjection;
      }

      const now = new Date().toISOString();
      const blockedReason = pullRequestMutationBlockedReason({ request, run });
      let record: AutoImplementationPullRequestMutationRecord;

      if (blockedReason) {
        record = buildPullRequestMutationRecord({
          request,
          run,
          now,
          status: "blocked",
          pullRequestUrl: request.pullRequestUrl ?? null,
          blockedReason
        });
      } else if (request.requestMode === "dry_run") {
        record = buildPullRequestMutationRecord({
          request,
          run,
          now,
          status: "dry_run_ready",
          pullRequestUrl: request.pullRequestUrl ?? null,
          blockedReason: null
        });
      } else {
        const mutationResult = await autoImplementationPullRequestMutationAdapter.mutate({
          projectDir: run.generatedRepoPath,
          action: request.action,
          pullRequestTitle: request.pullRequestTitle ?? `Auto implementation ${run.projectFolderName}`,
          pullRequestUrl: request.pullRequestUrl ?? null,
          bodyMarkdown: pullRequestBodyMarkdown({ request, run })
        });

        record = buildPullRequestMutationRecord({
          request,
          run,
          now,
          status: "applied",
          pullRequestUrl: mutationResult.pullRequestUrl,
          blockedReason: null,
          adapterAuditEvidenceRefs: mutationResult.auditEvidenceRefs,
          adapterMergeEvidenceRefs: mutationResult.mergeEvidenceRefs
        });
      }

      const pullRequestMutations = {
        records: [...run.pullRequestMutations.records, record],
        latestRecord: record
      };
      const updatedRun: AutoImplementationRun = {
        ...run,
        status: record.status === "blocked" ? "blocked" : run.status,
        pullRequestMutations,
        updatedAt: now,
        evidenceRefs: uniqueAutoImplementationRefs([...run.evidenceRefs, ...record.auditEvidenceRefs])
      };
      const runs = existingProjection.runs.map((candidate) =>
        candidate.runId === request.runId ? updatedRun : candidate
      );
      const projection = validateAutoImplementationRunProjection({
        ...existingProjection,
        version: (existingProjection.version + 1) as ProjectionVersion,
        latestRun: updatedRun,
        runs,
        summary: `Auto implementation PR mutation ${record.status} for ${request.action}.`
      });

      return saveAutoImplementationRunProjection({
        projectionRepository,
        projectId: session.projectId,
        sessionId: request.sessionId,
        projection,
        latestRun: updatedRun,
        updatedAt: now
      });
    },

    async recordAutoImplementationStage(
      request: RecordAutoImplementationStageRequest
    ): Promise<AutoImplementationRunProjection> {
      return recordAutoImplementationStageProjection(request);
    },

    async getAutoImplementationRuns(sessionIdValue: SessionId): Promise<AutoImplementationRunProjection | null> {
      const session = await createProjectRepository(storage.db).getSession(sessionIdValue);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: sessionIdValue
        });
      }

      const projection = await createProjectionRepository(storage.db).get<AutoImplementationRunProjection>(
        sessionIdValue,
        "AutoImplementationRunProjection"
      );

      return projection ? normalizeLegacyAutoImplementationProjection(projection) : null;
    },

    async validateExecutionAuthorityPreflight(
      input: ValidateExecutionAuthorityPreflightInput
    ): Promise<ExecutionAuthorityPreflightResult> {
      const session = await createProjectRepository(storage.db).getSession(input.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: input.sessionId
        });
      }

      parseExecutionAuthorityTimestamp(input.requestedAt, "requestedAt");
      if (input.approvalExpiresAt) {
        parseExecutionAuthorityTimestamp(input.approvalExpiresAt, "approvalExpiresAt");
      }

      const projection = await createExecutionAuthorityRepository(storage.db).getById(input.authorityRecordId);

      if (projection && projection.sessionId !== input.sessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "authorityRecordId must belong to the request session.", {
          authorityRecordId: input.authorityRecordId,
          routeSessionId: input.sessionId,
          authoritySessionId: projection.sessionId
        });
      }

      return executionAuthorityPreflightResult({
        request: input,
        checkedAt: new Date().toISOString(),
        ...(projection ? { record: projection.latestRecord } : {}),
        blockReasons: executionAuthorityPreflightBlockReasons(input, projection)
      });
    },

    async executeFileDiff(input: ExecuteFileDiffInput): Promise<FileDiffExecutionResult> {
      const session = await createProjectRepository(storage.db).getSession(input.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: input.sessionId
        });
      }

      parseExecutionAuthorityTimestamp(input.requestedAt, "requestedAt");
      if (input.approvalExpiresAt) {
        parseExecutionAuthorityTimestamp(input.approvalExpiresAt, "approvalExpiresAt");
      }

      const repository = createExecutionAuthorityRepository(storage.db);
      const projection = await repository.getById(input.authorityRecordId);

      if (projection && projection.sessionId !== input.sessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "authorityRecordId must belong to the request session.", {
          authorityRecordId: input.authorityRecordId,
          routeSessionId: input.sessionId,
          authoritySessionId: projection.sessionId
        });
      }

      const preflightInput: ValidateExecutionAuthorityPreflightInput = {
        authorityRecordId: input.authorityRecordId,
        sessionId: input.sessionId,
        idempotencyKey: input.idempotencyKey,
        actionClass: "file_diff",
        previewArtifactHash: input.previewArtifactHash,
        requestedAt: input.requestedAt,
        ...(input.approvalExpiresAt ? { approvalExpiresAt: input.approvalExpiresAt } : {})
      };
      const preflightBlockReasons = executionAuthorityPreflightBlockReasons(preflightInput, projection);
      const checkedAt = new Date().toISOString();

      if (!projection) {
        return fileDiffExecutionResult({
          request: input,
          checkedAt,
          status: "blocked",
          blockReasons: preflightBlockReasons
        });
      }

      const existingStatus = existingExecutionStatus(projection.latestRecord);

      if (existingStatus) {
        if (
          projection.latestRecord.actionClass !== "file_diff" ||
          projection.latestRecord.previewArtifactHash !== input.previewArtifactHash
        ) {
          return fileDiffExecutionResult({
            request: input,
            checkedAt,
            record: projection.latestRecord,
            status: "blocked",
            blockReasons: preflightBlockReasons,
            includeRequestAuditRef: false
          });
        }

        return fileDiffExecutionResult({
          request: input,
          checkedAt,
          record: projection.latestRecord,
          status: existingStatus,
          blockReasons: existingStatus === "blocked" ? projection.latestRecord.blockReasons : [],
          includeRequestAuditRef: false
        });
      }

      if (projection.latestRecord.executionResult !== "not_run") {
        return fileDiffExecutionResult({
          request: input,
          checkedAt,
          record: projection.latestRecord,
          status: "blocked",
          blockReasons: preflightBlockReasons,
          includeRequestAuditRef: false
        });
      }

      const fileDiffOutput = preflightBlockReasons.length
        ? {
            status: "blocked" as const,
            changedFiles: [],
            diffStats: fileDiffStats([]),
            blockReasons: preflightBlockReasons,
            evidenceRefs: [],
            auditRefs: []
          }
        : await applyFileDiff({
            record: projection.latestRecord,
            idempotencyKey: input.idempotencyKey,
            workspaceRoot: input.workspaceRoot,
            unifiedDiff: input.unifiedDiff
          });
      const result = fileDiffExecutionResult({
        request: input,
        checkedAt,
        record: projection.latestRecord,
        status: fileDiffOutput.status,
        changedFiles: fileDiffOutput.changedFiles,
        diffStats: fileDiffOutput.diffStats,
        blockReasons: fileDiffOutput.blockReasons,
        evidenceRefs: fileDiffOutput.evidenceRefs,
        auditRefs: fileDiffOutput.auditRefs
      });
      const updatedProjection = await repository.updateExecutionOutcome({
        recordId: input.authorityRecordId,
        executionResult: result.status,
        blockReasons: result.status === "blocked" ? result.blockReasons : [],
        evidenceRefs: result.evidenceRefs,
        auditRefs: result.auditRefs
      });

      if (!updatedProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Execution authority record was not found.", {
          authorityRecordId: input.authorityRecordId
        });
      }

      return result;
    },

    async executeShellCommand(input: ExecuteShellCommandInput): Promise<ShellCommandExecutionResult> {
      const session = await createProjectRepository(storage.db).getSession(input.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: input.sessionId
        });
      }

      parseExecutionAuthorityTimestamp(input.requestedAt, "requestedAt");
      if (input.approvalExpiresAt) {
        parseExecutionAuthorityTimestamp(input.approvalExpiresAt, "approvalExpiresAt");
      }

      const repository = createExecutionAuthorityRepository(storage.db);
      const projection = await repository.getById(input.authorityRecordId);

      if (projection && projection.sessionId !== input.sessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "authorityRecordId must belong to the request session.", {
          authorityRecordId: input.authorityRecordId,
          routeSessionId: input.sessionId,
          authoritySessionId: projection.sessionId
        });
      }

      const preflightInput: ValidateExecutionAuthorityPreflightInput = {
        authorityRecordId: input.authorityRecordId,
        sessionId: input.sessionId,
        idempotencyKey: input.idempotencyKey,
        actionClass: "shell_command",
        previewArtifactHash: input.previewArtifactHash,
        requestedAt: input.requestedAt,
        ...(input.approvalExpiresAt ? { approvalExpiresAt: input.approvalExpiresAt } : {})
      };
      const preflightBlockReasons = executionAuthorityPreflightBlockReasons(preflightInput, projection);
      const checkedAt = new Date().toISOString();

      if (!projection) {
        return shellCommandExecutionResult({
          request: input,
          checkedAt,
          status: "blocked",
          blockReasons: preflightBlockReasons
        });
      }

      const existingStatus = existingExecutionStatus(projection.latestRecord);

      if (existingStatus) {
        if (
          projection.latestRecord.actionClass !== "shell_command" ||
          projection.latestRecord.previewArtifactHash !== input.previewArtifactHash
        ) {
          return shellCommandExecutionResult({
            request: input,
            checkedAt,
            record: projection.latestRecord,
            status: "blocked",
            blockReasons: preflightBlockReasons,
            includeRequestAuditRef: false
          });
        }

        return shellCommandExecutionResult({
          request: input,
          checkedAt,
          record: projection.latestRecord,
          status: existingStatus,
          blockReasons: existingStatus === "blocked" ? projection.latestRecord.blockReasons : [],
          includeRequestAuditRef: false
        });
      }

      if (projection.latestRecord.executionResult !== "not_run") {
        return shellCommandExecutionResult({
          request: input,
          checkedAt,
          record: projection.latestRecord,
          status: "blocked",
          blockReasons: preflightBlockReasons,
          includeRequestAuditRef: false
        });
      }

      const shellCommandOutput = preflightBlockReasons.length
        ? {
            status: "blocked" as const,
            command: shellCommandSummaryFromRequest({
              request: input,
              record: projection.latestRecord
            }),
            exitCode: null,
            durationMs: 0,
            stdoutSummary: "",
            stderrSummary: "",
            blockReasons: preflightBlockReasons,
            evidenceRefs: [],
            auditRefs: []
          }
        : await runShellCommand({
            record: projection.latestRecord,
            idempotencyKey: input.idempotencyKey,
            workspaceRoot: input.workspaceRoot,
            command: input.command,
            ...(input.workingDirectory ? { workingDirectory: input.workingDirectory } : {})
          });
      const result = shellCommandExecutionResult({
        request: input,
        checkedAt,
        record: projection.latestRecord,
        status: shellCommandOutput.status,
        command: shellCommandOutput.command,
        exitCode: shellCommandOutput.exitCode,
        durationMs: shellCommandOutput.durationMs,
        stdoutSummary: shellCommandOutput.stdoutSummary,
        stderrSummary: shellCommandOutput.stderrSummary,
        blockReasons: shellCommandOutput.blockReasons,
        evidenceRefs: shellCommandOutput.evidenceRefs,
        auditRefs: shellCommandOutput.auditRefs
      });
      const updatedProjection = await repository.updateExecutionOutcome({
        recordId: input.authorityRecordId,
        executionResult: result.status,
        blockReasons: result.status === "blocked" ? result.blockReasons : [],
        evidenceRefs: result.evidenceRefs,
        auditRefs: result.auditRefs
      });

      if (!updatedProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Execution authority record was not found.", {
          authorityRecordId: input.authorityRecordId
        });
      }

      return result;
    },

    async executeBrowserAction(input: ExecuteBrowserActionInput): Promise<BrowserActionExecutionResult> {
      const session = await createProjectRepository(storage.db).getSession(input.sessionId);

      if (!session) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Session was not found.", {
          sessionId: input.sessionId
        });
      }

      parseExecutionAuthorityTimestamp(input.requestedAt, "requestedAt");
      if (input.approvalExpiresAt) {
        parseExecutionAuthorityTimestamp(input.approvalExpiresAt, "approvalExpiresAt");
      }

      const repository = createExecutionAuthorityRepository(storage.db);
      const projection = await repository.getById(input.authorityRecordId);

      if (projection && projection.sessionId !== input.sessionId) {
        throw new ProductEngineServiceError("VALIDATION_FAILED", "authorityRecordId must belong to the request session.", {
          authorityRecordId: input.authorityRecordId,
          routeSessionId: input.sessionId,
          authoritySessionId: projection.sessionId
        });
      }

      const preflightInput: ValidateExecutionAuthorityPreflightInput = {
        authorityRecordId: input.authorityRecordId,
        sessionId: input.sessionId,
        idempotencyKey: input.idempotencyKey,
        actionClass: "browser_action",
        previewArtifactHash: input.previewArtifactHash,
        requestedAt: input.requestedAt,
        ...(input.approvalExpiresAt ? { approvalExpiresAt: input.approvalExpiresAt } : {})
      };
      const basePreflightBlockReasons = executionAuthorityPreflightBlockReasons(preflightInput, projection);
      const requestPreviewHashBlockReason = browserActionRequestPreviewHashBlockReason(input);
      const servicePagePermissionBlockReasons =
        projection
          ? await servicePageUsePermissionBrowserActionBlockReasons(storage, projection.latestRecord, input)
          : [];
      const preflightBlockReasons = [
        ...basePreflightBlockReasons,
        ...(requestPreviewHashBlockReason ? [requestPreviewHashBlockReason] : []),
        ...servicePagePermissionBlockReasons
      ];
      const checkedAt = new Date().toISOString();

      if (!projection) {
        return browserActionExecutionResult({
          request: input,
          checkedAt,
          status: "blocked",
          blockReasons: preflightBlockReasons
        });
      }

      const existingStatus = existingExecutionStatus(projection.latestRecord);

      if (existingStatus) {
        const recordReplayBlockReasons =
          projection.latestRecord.actionClass !== "browser_action" ||
          projection.latestRecord.previewArtifactHash !== input.previewArtifactHash
            ? basePreflightBlockReasons
            : [];
        const replayGuardBlockReasons = [
          ...recordReplayBlockReasons,
          ...(requestPreviewHashBlockReason ? [requestPreviewHashBlockReason] : []),
          ...servicePagePermissionBlockReasons
        ];

        if (replayGuardBlockReasons.length) {
          return browserActionExecutionResult({
            request: input,
            checkedAt,
            record: projection.latestRecord,
            status: "blocked",
            blockReasons: replayGuardBlockReasons,
            includeRequestAuditRef: false
          });
        }

        return browserActionExecutionResult({
          request: input,
          checkedAt,
          record: projection.latestRecord,
          status: existingStatus,
          blockReasons: existingStatus === "blocked" ? projection.latestRecord.blockReasons : [],
          includeRequestAuditRef: false
        });
      }

      if (projection.latestRecord.executionResult !== "not_run") {
        return browserActionExecutionResult({
          request: input,
          checkedAt,
          record: projection.latestRecord,
          status: "blocked",
          blockReasons: preflightBlockReasons,
          includeRequestAuditRef: false
        });
      }

      const browserActionOutput = preflightBlockReasons.length
        ? {
            status: "blocked" as const,
            target: browserActionTargetFromRequest(input.targetUrl),
            action: input.action,
            httpStatusCode: null,
            durationMs: 0,
            screenshotRefs: [],
            logRefs: [],
            blockReasons: preflightBlockReasons,
            evidenceRefs: [],
            auditRefs: []
          }
        : await runBrowserAction({
            record: projection.latestRecord,
            idempotencyKey: input.idempotencyKey,
            targetUrl: input.targetUrl,
            action: input.action
          });
      const result = browserActionExecutionResult({
        request: input,
        checkedAt,
        record: projection.latestRecord,
        status: browserActionOutput.status,
        target: browserActionOutput.target,
        action: browserActionOutput.action,
        httpStatusCode: browserActionOutput.httpStatusCode,
        durationMs: browserActionOutput.durationMs,
        screenshotRefs: browserActionOutput.screenshotRefs,
        logRefs: browserActionOutput.logRefs,
        blockReasons: browserActionOutput.blockReasons,
        evidenceRefs: browserActionOutput.evidenceRefs,
        auditRefs: browserActionOutput.auditRefs
      });
      const updatedProjection = await repository.updateExecutionOutcome({
        recordId: input.authorityRecordId,
        executionResult: result.status,
        blockReasons: result.status === "blocked" ? result.blockReasons : [],
        evidenceRefs: result.evidenceRefs,
        auditRefs: result.auditRefs
      });

      if (!updatedProjection) {
        throw new ProductEngineServiceError("RESOURCE_NOT_FOUND", "Execution authority record was not found.", {
          authorityRecordId: input.authorityRecordId
        });
      }

      return result;
    },

    async getCommandStatus(commandIdValue: CommandId): Promise<StatusEndpointDto | null> {
      const eventRepository = createEventRepository(storage.db);
      const effectRepository = createEffectTaskRepository(storage.db);
      const events = await eventRepository.listForCommand(commandIdValue);
      const effects = await effectRepository.listForCommand(commandIdValue);

      if (!events.length && !effects.length) {
        return null;
      }

      const pendingEffects = effects.filter(isPendingEffect);
      const hasBlocked = effects.some((effect) => effect.status === "blocked");
      const hasFailed = effects.some((effect) => effect.status === "failed");
      const hasPending = pendingEffects.length > 0;

      return {
        commandId: commandIdValue,
        category: commandCategoryFromEvents(events),
        commandStatus: hasBlocked ? "blocked" : hasFailed ? "failed" : hasPending ? "pending" : "complete",
        eventIds: events.map((event) => event.eventId),
        effects,
        pendingEffectSummary: pendingEffectSummary(pendingEffects),
        projectionHints: events[0] ? projectionHintsForEffects(events[0].sessionId, effects) : [],
        lastUpdatedAt: effects.at(-1)?.updatedAt ?? events.at(-1)?.occurredAt ?? new Date(0).toISOString()
      };
    },

    schemaVersion: CONTRACT_SCHEMA_VERSION as SchemaVersion
  };
}
