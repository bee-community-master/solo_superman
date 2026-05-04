import { randomUUID } from "node:crypto";
import {
  CONTRACT_SCHEMA_VERSION,
  type ApiErrorCode,
  type CommandId,
  type CommandResponse,
  type CommandResponseCategory,
  type CommandType,
  type CorrelationId,
  type CausationId,
  type DecisionQueueProjection,
  type EffectTaskDto,
  type EffectTaskId,
  type EventId,
  type LivingSpecProjection,
  type PendingEffectSummaryDto,
  type ProductEngineCommand,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineReduction,
  type ProjectionRefetchHint,
  type ProjectId,
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
  readonly commandType: Extract<CommandType, "CaptureIntake" | "DraftInitialSpec" | "AnalyzeAmbiguity" | "ActivateQuestionBatch">;
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

  return kind === "DecisionQueueProjection" || kind === "LivingSpecProjection" || kind === "SessionShellProjection";
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

function commandCategoryFromEvents(events: readonly ProductEngineEvent[]): CommandResponseCategory {
  return events.some((event) => isPersistedProjection(event.payload.projection)) ? "accepted_with_projection" : "accepted";
}

function effectTaskIdempotencyKey(plannedEffect: ProductEngineEffectPlanItem, primarySourceEvent: ProductEngineEvent) {
  if (plannedEffect.effectType === "queue_projection_effect") {
    return `${primarySourceEvent.eventId}:decision_queue`;
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
      message: reduction.rejectionReason?.message ?? "ProductEngine command was rejected."
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

  return {
    category: hasImmediateProjection ? "accepted_with_projection" : "accepted",
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
    ...(hasDecisionQueueProjection ? { queueProjection: immediateProjection } : {})
  };
}

function latestEvent(events: readonly ProductEngineEvent[]) {
  return events.at(-1) ?? null;
}

export function createProductEngineCommandService(storage: SoloStorage) {
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
          break;
        case "completeness_snapshot":
        case "confidence_map":
        case "spec_version_material":
        case "founder_brief_draft":
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

        effects.push(
          await effectRepository.create({
            effectTaskId: effectTaskId(),
            effectType: plannedEffect.effectType,
            projectId: command.projectId,
            sessionId: command.sessionId,
            sourceEventId: primarySourceEvent.eventId,
            sourceEventIds: sourceEvents.length ? sourceEvents.map((event) => event.eventId) : [primarySourceEvent.eventId],
            sourceCommandId: command.commandId,
            correlationId: command.correlationId,
            idempotencyKey: effectTaskIdempotencyKey(plannedEffect, primarySourceEvent),
            maxAttempts: maxAttemptsFor(plannedEffect),
            input: {
              inputRef: plannedEffect.inputRef,
              previewPolicy: plannedEffect.previewPolicy,
              sourceEventTypes: plannedEffect.sourceEventTypes
            },
            schemaVersion: command.schemaVersion
          })
        );
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
              : (state.stateVersion as unknown as SessionShellProjection["version"])
        };
      }

      return {
        kind: "SessionShellProjection",
        projectId: session.projectId,
        sessionId: session.sessionId,
        version: state.stateVersion as unknown as SessionShellProjection["version"],
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
        version: state.stateVersion as unknown as LivingSpecProjection["version"],
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
