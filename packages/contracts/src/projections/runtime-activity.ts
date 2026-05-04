import type { EffectTaskDto, RuntimePreviewArtifact } from "../effects";
import type { ProjectionVersion } from "../ids";

export interface RuntimeActivityProjection {
  readonly kind: "RuntimeActivityProjection";
  readonly version: ProjectionVersion;
  readonly effects: readonly EffectTaskDto[];
  readonly runtimeArtifacts: readonly RuntimePreviewArtifact[];
  readonly runtimeStatus: "scaffold_placeholder" | "available" | "unavailable" | "blocked";
}
