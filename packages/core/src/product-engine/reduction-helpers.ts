import type {
  ActiveBatchSafeProjection,
  ProductEngineCommand,
  ProductEngineEventDraft,
  ProductEngineEffectPlanItem,
  ProductEngineReduction,
  ProductEngineRejectionCode,
  ProductEngineStateSnapshot,
  ProjectionVersion,
  StateVersion
} from "@solo-superman/contracts";

export function reject(
  message: string,
  code: ProductEngineRejectionCode = "COMMAND_PRECONDITION_FAILED",
  details?: Readonly<Record<string, unknown>>
): ProductEngineReduction {
  return {
    accepted: false,
    rejectionReason: {
      code,
      message,
      ...(details ? { details } : {})
    },
    events: [],
    nextState: {},
    effectPlan: [],
    deterministicOutputs: []
  };
}

export function numericVersion(version: StateVersion) {
  return Number(version);
}

export function nextVersion(state: ProductEngineStateSnapshot) {
  return (numericVersion(state.stateVersion) + 1) as StateVersion;
}

export function projectionVersionFor(state: ProductEngineStateSnapshot) {
  return Number(nextVersion(state)) as ProjectionVersion;
}

export function eventDraft(
  command: ProductEngineCommand,
  eventType: ProductEngineEventDraft["eventType"],
  payload: ProductEngineEventDraft["payload"]
): ProductEngineEventDraft {
  return {
    eventType,
    projectId: command.projectId,
    sessionId: command.sessionId,
    sourceCommandId: command.commandId,
    correlationId: command.correlationId,
    causationId: command.causationId,
    schemaVersion: command.schemaVersion,
    payload
  };
}

export function stableToken(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

export function acceptedReduction(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  event: ProductEngineEventDraft,
  patch: ProductEngineReduction["nextState"],
  deterministicOutputs: ProductEngineReduction["deterministicOutputs"],
  effectPlan: readonly ProductEngineEffectPlanItem[] = [],
  immediateProjection?: ActiveBatchSafeProjection
): ProductEngineReduction {
  return {
    accepted: true,
    events: [event],
    nextState: {
      stateVersion: nextVersion(state),
      ...patch
    },
    effectPlan,
    deterministicOutputs,
    ...(immediateProjection ? { immediateProjection } : {})
  };
}
