import type { CommandId, EffectTaskId, EventId, ProjectionVersion } from "../ids";
import type { CommandType } from "../product-engine";
import type { EffectOutputRef, EffectType } from "../effects";
import type { ProjectionKind } from "../projections";

export type SseEventName =
  | "command.accepted"
  | "command.rejected"
  | "effect.queued"
  | "effect.started"
  | "effect.succeeded"
  | "effect.failed"
  | "effect.blocked"
  | "projection.updated"
  | "runtime.status.changed";

export interface SseEventBase<TName extends SseEventName> {
  readonly event: TName;
  readonly emittedAt: string;
}

export interface CommandAcceptedSseEvent extends SseEventBase<"command.accepted"> {
  readonly commandId: CommandId;
  readonly commandType: CommandType;
  readonly eventIds: readonly EventId[];
  readonly effectTaskIds: readonly EffectTaskId[];
  readonly statusUrl?: string;
}

export interface CommandRejectedSseEvent extends SseEventBase<"command.rejected"> {
  readonly commandId: CommandId;
  readonly commandType: CommandType;
  readonly errorCode: string;
  readonly reason: string;
}

export interface EffectQueuedSseEvent extends SseEventBase<"effect.queued"> {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly sourceEventIds: readonly EventId[];
}

export interface EffectStartedSseEvent extends SseEventBase<"effect.started"> {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly attemptCount: number;
}

export interface EffectSucceededSseEvent extends SseEventBase<"effect.succeeded"> {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly outputRef: EffectOutputRef;
  readonly projectionHint: ProjectionRefetchHint;
}

export interface EffectFailedSseEvent extends SseEventBase<"effect.failed"> {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly errorCode: string;
  readonly retryAvailable: boolean;
}

export interface EffectBlockedSseEvent extends SseEventBase<"effect.blocked"> {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly blockReason: string;
  readonly userAction: string;
}

export interface ProjectionRefetchHint {
  readonly projectionKind: ProjectionKind;
  readonly refetchUrl: string;
}

export interface ProjectionUpdatedSseEvent extends SseEventBase<"projection.updated"> {
  readonly projectionKind: ProjectionKind;
  readonly version: ProjectionVersion;
  readonly affectedIds: readonly string[];
  readonly refetchUrl: string;
}

export interface RuntimeStatusChangedSseEvent extends SseEventBase<"runtime.status.changed"> {
  readonly adapterId: string;
  readonly status: "available" | "unavailable" | "blocked" | "scaffold_placeholder";
  readonly reason?: string;
}

export type SseEvent =
  | CommandAcceptedSseEvent
  | CommandRejectedSseEvent
  | EffectQueuedSseEvent
  | EffectStartedSseEvent
  | EffectSucceededSseEvent
  | EffectFailedSseEvent
  | EffectBlockedSseEvent
  | ProjectionUpdatedSseEvent
  | RuntimeStatusChangedSseEvent;
