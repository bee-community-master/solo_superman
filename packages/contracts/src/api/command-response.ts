import type { EffectTaskDto } from "../effects";
import type { CommandId, EffectTaskId, StateVersion } from "../ids";
import type { ProjectionRefetchHint } from "../sse";
import type { ApiError } from "./errors";

export type CommandResponseCategory = "accepted" | "accepted_with_projection" | "rejected" | "blocked";

export interface CommandResponse<TProjection = unknown> {
  readonly category: CommandResponseCategory;
  readonly commandId: CommandId;
  readonly stateVersionAfter?: StateVersion;
  readonly effectTaskIds?: readonly EffectTaskId[];
  readonly statusUrl?: string;
  readonly queuedActivity?: unknown;
  readonly queueProjection?: TProjection;
  readonly pendingEffectSummary?: PendingEffectSummaryDto;
  readonly blockingCard?: unknown;
  readonly error?: ApiError;
}

export interface PendingEffectSummaryDto {
  readonly effectTaskIds: readonly EffectTaskId[];
  readonly summary: string;
}

export type CommandStatus = "pending" | "partially_complete" | "complete" | "failed" | "blocked";

export interface StatusEndpointDto {
  readonly commandId: CommandId;
  readonly commandStatus: CommandStatus;
  readonly effects: readonly EffectTaskDto[];
  readonly pendingSummary?: PendingEffectSummaryDto;
  readonly projectionHints: readonly ProjectionRefetchHint[];
}
