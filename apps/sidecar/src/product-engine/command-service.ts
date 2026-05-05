import { randomUUID } from "node:crypto";
import {
  CONTRACT_SCHEMA_VERSION,
  CODEX_RUNTIME_ADAPTER_VERSION,
  type ApiErrorCode,
  type BlockedActionType,
  type CommandId,
  type CommandResponse,
  type CommandResponseCategory,
  type CommandType,
  type CorrelationId,
  type CausationId,
  type CodexTurnPurpose,
  type ConfidenceCompletionProjection,
  type DecisionQueueProjection,
  type EffectTaskDto,
  type EffectTaskId,
  type EventId,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type PendingEffectSummaryDto,
  type ProductEngineCommand,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineReduction,
  type ProjectionRefetchHint,
  type ProjectId,
  type ResearchEvidenceProjection,
  type ResearchResultId,
  type RuntimeActivityProjection,
  type RuntimePreviewArtifact,
  type SchemaVersion,
  type SessionId,
  type SessionShellProjection,
  type StartProjectRequest,
  type StateVersion,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import {
  createEffectTaskRepository,
  createEventRepository,
  createProjectRepository,
  createProjectionRepository,
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
  sessionShellPhaseForProductEnginePhase
} from "@solo-superman/core";
import {
  CodexRuntimeUnavailableError,
  assertCodexPreviewOutputMatchesInput,
  createCodexRuntimeAdapter,
  fixtureCodexPreviewOutput,
  type CodexRuntimeAdapter,
  type CodexRuntimePreviewInput
} from "../runtime";

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
    CommandType,
    | "CaptureIntake"
    | "DraftInitialSpec"
    | "AnalyzeAmbiguity"
    | "ActivateQuestionBatch"
    | "SubmitAnswer"
    | "PlanResearch"
    | "ImportResearchResult"
    | "SynthesizeEvidence"
    | "CreateRuntimePreview"
    | "ConvertRuntimeArtifact"
    | "ScoreCompleteness"
    | "PrepareFounderBrief"
  >;
  readonly expectedStateVersion: StateVersion;
  readonly payload: Readonly<Record<string, unknown>>;
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
    ...(queueProjection ? { queueProjection } : {})
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
        const runtimeProjection = runtimeProjectionFromEvent(event);
        const runtimeArtifact = runtimeArtifactFromEvent(event);

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
        }

        if (runtimeProjection) {
          for (const artifact of runtimeProjection.runtimeArtifacts) {
            await runtimeRepository.saveArtifact({
              projectId: command.projectId,
              sessionId: command.sessionId,
              artifact,
              schemaVersion: command.schemaVersion
            });
          }
        }

        if (runtimeArtifact) {
          await runtimeRepository.saveArtifact({
            projectId: command.projectId,
            sessionId: command.sessionId,
            artifact: runtimeArtifact,
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
      const previewOutput = previewInput.requestedActionType
        ? fixtureCodexPreviewOutput(previewInput)
        : await codexRuntimeAdapter.createPreview(previewInput);
      assertCodexPreviewOutputMatchesInput(previewInput, previewOutput);
      const command: ProductEngineCommand = {
        commandId: commandId(),
        commandType: "CreateRuntimePreview",
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
