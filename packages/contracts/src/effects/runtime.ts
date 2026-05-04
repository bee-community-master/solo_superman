import type { EffectTaskId, RuntimeArtifactId, SchemaVersion } from "../ids";
import type {
  BlockedActionSummary,
  CodexApplyPolicy,
  CodexArtifactKind,
  CodexRuntimeSource,
  CodexTurnPurpose,
  RuntimePreviewStatus
} from "../codex";

export interface RuntimeArtifactRef {
  readonly artifactId: RuntimeArtifactId;
  readonly kind: CodexArtifactKind;
  readonly schemaVersion: SchemaVersion;
}

export interface RuntimePreviewArtifact {
  readonly artifactId: RuntimeArtifactId;
  readonly turnPurpose: CodexTurnPurpose;
  readonly kind: CodexArtifactKind;
  readonly applyPolicy: CodexApplyPolicy;
  readonly status: RuntimePreviewStatus;
  readonly source: CodexRuntimeSource;
  readonly targetObject: string;
  readonly summary: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly sourceRefs: readonly string[];
  readonly contextHash: string;
  readonly runtimeAdapterVersion: string;
  readonly sourceEffectTaskId?: EffectTaskId;
  readonly blockedAction?: BlockedActionSummary;
  readonly createdAt: string;
  readonly schemaVersion: SchemaVersion;
}
