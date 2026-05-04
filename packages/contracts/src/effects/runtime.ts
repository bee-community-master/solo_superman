import type { RuntimeArtifactId, SchemaVersion } from "../ids";
import type { CodexApplyPolicy, CodexArtifactKind, CodexTurnPurpose } from "../codex";

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
  readonly summary: string;
  readonly createdAt: string;
  readonly schemaVersion: SchemaVersion;
}
