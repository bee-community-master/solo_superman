import type { ProjectionVersion, ResearchTaskId } from "../ids";

export interface ResearchEvidenceProjection {
  readonly kind: "ResearchEvidenceProjection";
  readonly version: ProjectionVersion;
  readonly taskIds: readonly ResearchTaskId[];
  readonly proConBalanceStatus: "unknown" | "balanced" | "needs_con_evidence";
}
