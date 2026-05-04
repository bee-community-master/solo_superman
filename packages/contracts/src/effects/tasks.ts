import type { CommandId, CorrelationId, EffectTaskId, EventId, SchemaVersion } from "../ids";
import type { ProductEngineEventType } from "../product-engine";

export const EFFECT_TYPES = [
  "queue_projection_effect",
  "research_evidence_effect",
  "codex_runtime_preview_effect"
] as const;

export const EFFECT_STATUSES = ["queued", "leased", "running", "succeeded", "failed", "blocked", "cancelled"] as const;

export type EffectType = (typeof EFFECT_TYPES)[number];
export type EffectTaskStatus = (typeof EFFECT_STATUSES)[number];
export type EffectPriority = "low" | "normal" | "high" | "urgent";
export type ProductEnginePreviewPolicy =
  | "auto_low_risk"
  | "approval_required"
  | "manual_handoff_required"
  | "blocked";

export interface EffectInputRef {
  readonly refType: string;
  readonly refId: string;
}

export interface EffectOutputRef {
  readonly refType: string;
  readonly refId: string;
}

export interface ProductEngineEffectPlanItem {
  readonly effectType: EffectType;
  readonly idempotencyKey: string;
  readonly sourceCommandId: CommandId;
  readonly sourceEventTypes: readonly ProductEngineEventType[];
  readonly correlationId: CorrelationId;
  readonly priority: EffectPriority;
  readonly runAfter?: string;
  readonly inputRef: EffectInputRef;
  readonly previewPolicy: ProductEnginePreviewPolicy;
}

export interface EffectErrorDto {
  readonly code: string;
  readonly message: string;
  readonly retryAvailable: boolean;
}

export interface EffectTaskDto {
  readonly effectTaskId: EffectTaskId;
  readonly effectType: EffectType;
  readonly status: EffectTaskStatus;
  readonly sourceCommandId: CommandId;
  readonly sourceEventIds: readonly EventId[];
  readonly correlationId: CorrelationId;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly outputRef?: EffectOutputRef;
  readonly error?: EffectErrorDto;
  readonly queuedAt: string;
  readonly updatedAt: string;
  readonly schemaVersion: SchemaVersion;
}
