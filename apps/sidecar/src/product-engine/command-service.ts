import { createHash, randomUUID } from "node:crypto";
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
  MANUAL_RESEARCH_SOURCE_CATEGORIES,
  ResearchAllowlistValidationError,
  ResearchRunValidationError,
  assertSafeResearchConnectorId,
  isTerminalResearchRunStatus,
  type ApiErrorCode,
  type AutomaticResearchSourceCategory,
  type BlockedActionType,
  type CommandId,
  type CommandResponse,
  type CommandResponseCategory,
  type CancelResearchRunRequest,
  type CreateResearchAllowlistRequest,
  type CorrelationId,
  type CausationId,
  type CodexTurnPurpose,
  type ConfidenceCompletionProjection,
  type DecisionQueueProjection,
  type DecisionEvidencePackProjection,
  type EffectTaskDto,
  type EffectTaskId,
  type EventId,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type PendingEffectSummaryDto,
  type Phase15bUpgradeHintExportDto,
  type Phase15bUpgradeHintProjection,
  type PrepareResearchDisclosureRequest,
  type ProjectApplicationCommandType,
  type ProductEngineCommand,
  type ProductEngineCommandType,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineReduction,
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
  type RuntimePreviewArtifact,
  type SchemaVersion,
  type SessionId,
  type SessionShellProjection,
  type StartResearchRunRequest,
  type StartProjectRequest,
  type StateVersion,
  type StatusEndpointDto,
  type RetryResearchRunRequest,
  type UpdateResearchAllowlistRequest
} from "@solo-superman/contracts";
import {
  createEffectTaskRepository,
  createEventRepository,
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
  reduceProductEngineCommand,
  replayProductEngineEvents,
  sessionPhaseForProductEngineEvent,
  sessionShellPhaseForProductEnginePhase,
  createFakeReadOnlyResearchAdapter,
  buildPublicSafeResearchSummary,
  containsPrivateResearchContext,
  redactPublicSafeResearchText
} from "@solo-superman/core";
import {
  CodexRuntimeUnavailableError,
  assertCodexPreviewOutputMatchesInput,
  createCodexRuntimeAdapter,
  fixtureCodexPreviewOutput,
  type CodexRuntimeAdapter,
  type CodexRuntimePreviewInput
} from "../runtime";
import { buildPhase15bHintExport, buildPhase15bHintProjection } from "./phase15b-hint-projection";

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

export interface RunSessionCommandInput {
  readonly sessionId: SessionId;
  readonly commandType: Extract<
    ProductEngineCommandType,
    | "CaptureIntake"
    | "DraftInitialSpec"
    | "AnalyzeAmbiguity"
    | "ActivateQuestionBatch"
    | "SubmitAnswer"
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
  >;
  readonly expectedStateVersion: StateVersion;
  readonly payload: Readonly<Record<string, unknown>>;
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
          providerExecution: result.status === "started" || result.status === "retry_started" ? "local_fake_readonly" : false,
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
    ...(immediateProjection ? { immediateProjection } : {}),
    ...(queueProjection ? { queueProjection } : {}),
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

function decisionQueueProjectionFromEvents(events: readonly ProductEngineEvent[]): DecisionQueueProjection | null {
  for (const event of [...events].reverse()) {
    const projection = event.payload.queueProjection;

    if (isPersistedProjection(projection) && projection.kind === "DecisionQueueProjection") {
      return projection;
    }
  }

  return null;
}

export function createProductEngineCommandService(
  storage: SoloStorage,
  codexRuntimeAdapter: CodexRuntimeAdapter = createCodexRuntimeAdapter()
) {
  const sessionCommandQueues = new Map<SessionId, Promise<void>>();

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
        await effectRepository.updateStatus({
          effectTaskId: effect.effectTaskId,
          status: "succeeded",
          attemptCount,
          output: {
            evidenceMatrixId: alreadySynthesized.evidenceMatrixId,
            balanceStatus: alreadySynthesized.balanceStatus
          }
        });

        return {
          effectTaskId: effect.effectTaskId,
          status: "succeeded" as const,
          balanceStatus: alreadySynthesized.balanceStatus
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
      await effectRepository.updateStatus({
        effectTaskId: effect.effectTaskId,
        status: "succeeded",
        attemptCount,
        output: {
          evidenceMatrixId: matrix.evidenceMatrixId,
          balanceStatus: matrix.balanceStatus
        }
      });

      return {
        effectTaskId: effect.effectTaskId,
        status: "succeeded" as const,
        balanceStatus: matrix.balanceStatus
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
          source: "protocol_fixture",
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

  async function commandForExistingSession(input: RunSessionCommandInput) {
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
        actor: "user",
        issuedAt: new Date().toISOString(),
        idempotencyKey: `${input.commandType}:${input.sessionId}:${input.expectedStateVersion}`,
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
        await cancelResearchRunWithLocalAdapter(run, reason);
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
      await cancelResearchRunWithLocalAdapter(run, reason);
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

  function sourceRefsFromDisclosureRequest(request: PrepareResearchDisclosureRequest) {
    return [
      ...new Set(
        (request.sourceRefs ?? [])
          .map((sourceRef) => redactPublicSafeResearchText(sourceRef, request))
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

  async function rateBudgetBlocker(projectIdValue: ProjectId, allowlist: ResearchAllowlistProjection) {
    const activeRuns = (await listProjectResearchRuns(projectIdValue)).filter(
      (run) => !isTerminalResearchRunStatus(run.status)
    );

    return activeRuns.length >= allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject
      ? `Project already has ${activeRuns.length} non-terminal research run(s), meeting the allowlist concurrency budget.`
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
    const adapter = createFakeReadOnlyResearchAdapter();
    const adapterKind = request.adapterKind ?? adapter.adapterKind;
    const sourceCategory = automaticResearchSourceCategoryOrNull(request.sourceCategory);

    if (!sourceCategory) {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Automatic research runs require a public-safe source category."
      );
    }

    if (adapterKind !== "local_fake_readonly") {
      throw new ProductEngineServiceError(
        "COMMAND_PRECONDITION_FAILED",
        "Only the local fake read-only research adapter is mounted for Phase 1.5A PR-05 run controls.",
        {
          requestedAdapterKind: adapterKind
        }
      );
    }

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

  async function startLocalFakeRunIfQueued(
    run: ResearchRunProjection,
    publicSafePayload: PublicSafeResearchDisclosurePayload
  ) {
    if (run.status !== "queued" || run.provider.providerRunId || run.provider.adapterKind !== "local_fake_readonly") {
      return run;
    }

    const adapter = createFakeReadOnlyResearchAdapter();
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

  function isResearchRunStartInProgress(run: ResearchRunProjection) {
    return run.status === "queued" || run.status === "running";
  }

  async function cancelResearchRunWithLocalAdapter(run: ResearchRunProjection, reason: string) {
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
    const cancellation =
      run.provider.adapterKind === "local_fake_readonly"
        ? await createFakeReadOnlyResearchAdapter({ now: () => now }).cancel({
            researchRun: run,
            reason
          })
        : {
            status: run.status === "queued" ? ("cancelled" as const) : ("cancel_requested" as const),
            ...(run.status === "queued" ? { completedAt: now } : {}),
            reason
          };
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
        idempotencyKey: `StartProject:${input.rawIdea.trim()}:${input.localPrivacyMode}`,
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
        const updated = await updatePersistedAllowlist(
          updateAllowlistFromRequest(current, input.request, new Date().toISOString())
        );
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

      return listResearchRunProjection(projectIdValue);
    },

    async getResearchRunStatus(input: RunResearchRunStatusInput): Promise<ResearchRunStatusDto> {
      await requireProject(input.projectId);

      const run = await findProjectResearchRun(input.projectId, input.researchRunId);
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

        const stateVersionBefore = await researchRunCollectionStateVersion(input.projectId);
        const now = new Date().toISOString();
        const publicSafePayload = buildPublicSafeResearchSummary(input.request);
        const allowlist = await matchingAllowlistForDisclosure(input.projectId, input.request);
        const blockReason = blockReasonForDisclosure(input.request, allowlist);

        if (blockReason || !allowlist) {
          const disclosureLog = await persistResearchRunDisclosureLog(
            input.projectId,
            input.request,
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

        const staleBlocker = stalePolicyBlocker(input.request, now);
        const adapterBlocker =
          input.request.adapterKind && input.request.adapterKind !== "local_fake_readonly"
            ? "Requested adapter is not mounted in Phase 1.5A PR-05."
            : null;
        const preconditionBlocker = staleBlocker ?? adapterBlocker;

        if (preconditionBlocker) {
          const disclosureLog = await persistResearchRunDisclosureLog(
            input.projectId,
            input.request,
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
          researchRunStartIdempotencyKey(input.request, allowlist, publicSafePayload)
        );

        if (existingRun) {
          const started = await startLocalFakeRunIfQueued(existingRun, publicSafePayload);
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

        const budgetBlocker = await rateBudgetBlocker(input.projectId, allowlist);

        if (budgetBlocker) {
          const disclosureLog = await persistResearchRunDisclosureLog(
            input.projectId,
            input.request,
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
          input.request,
          publicSafePayload,
          allowlist,
          blockReason,
          now
        );
        const created = await repository.create({
          run: researchRunFromStartRequest(input.projectId, input.request, allowlist, disclosureLog, publicSafePayload, now),
          schemaVersion: CONTRACT_SCHEMA_VERSION
        });

        if (!created) {
          throw new ProductEngineServiceError(
            "IDEMPOTENCY_CONFLICT",
            "Research run id conflicts with a different idempotency key.",
            {
              projectId: input.projectId,
              researchRunId: input.request.researchRunId
            }
          );
        }

        const started = await startLocalFakeRunIfQueued(created, publicSafePayload);
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
        const cancelled = await cancelResearchRunWithLocalAdapter(
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
          const budgetBlocker = await rateBudgetBlocker(input.projectId, allowlist);

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

        const started = await startLocalFakeRunIfQueued(retryCandidate, publicSafePayload);
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
        phase
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

      if (projection) {
        return projection;
      }

      return (await stateForSession(session.projectId, sessionIdValue)).queueProjection;
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
