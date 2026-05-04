import type { EffectTaskId, EventId, RuntimeArtifactId, SchemaVersion } from "../ids";

export type EffectType =
  | "queue_projection_effect"
  | "research_evidence_effect"
  | "codex_runtime_preview_effect"
  | "runtime_artifact_conversion_effect"
  | "founder_brief_effect";

export type EffectTaskStatus = "queued" | "running" | "succeeded" | "failed" | "blocked";

export interface ProductEngineEffectPlanItem {
  readonly effectType: EffectType;
  readonly sourceEventIds: readonly EventId[];
  readonly payload: Readonly<Record<string, unknown>>;
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
  readonly sourceEventIds: readonly EventId[];
  readonly outputArtifactId?: RuntimeArtifactId;
  readonly error?: EffectErrorDto;
  readonly queuedAt: string;
  readonly schemaVersion: SchemaVersion;
}
