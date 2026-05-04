import type { EffectTaskDto } from "../effects";
import type { CommandId, CorrelationId, EffectTaskId, EventId, StateVersion } from "../ids";
import type { ProjectionRefetchHint } from "../sse";
import type { ApiError } from "./errors";

export type CommandResponseCategory = "accepted" | "accepted_with_projection" | "rejected" | "blocked";

export interface CommandResponse<TProjection = unknown> {
  readonly category: CommandResponseCategory;
  readonly commandId: CommandId;
  readonly correlationId: CorrelationId;
  readonly stateVersionBefore: StateVersion;
  readonly stateVersionAfter?: StateVersion;
  readonly eventIds?: readonly EventId[];
  readonly effectTaskIds?: readonly EffectTaskId[];
  readonly statusUrl?: string;
  readonly queuedActivity?: unknown;
  readonly immediateProjection?: TProjection;
  readonly queueProjection?: TProjection;
  readonly pendingEffectSummary?: PendingEffectSummaryDto;
  readonly blockingCard?: unknown;
  readonly error?: ApiError;
}

export interface PendingEffectSummaryDto {
  readonly totalPending: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly visibleLabel: string;
}

export type CommandStatus = "pending" | "partially_complete" | "complete" | "failed" | "blocked";

export interface StatusEndpointDto {
  readonly commandId: CommandId;
  readonly category: CommandResponseCategory;
  readonly commandStatus: CommandStatus;
  readonly eventIds: readonly EventId[];
  readonly effects: readonly EffectTaskDto[];
  readonly pendingEffectSummary: PendingEffectSummaryDto;
  readonly projectionHints: readonly ProjectionRefetchHint[];
  readonly lastUpdatedAt: string;
}
