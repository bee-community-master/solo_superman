import type { ProjectionVersion, SessionId } from "../ids";

export interface LivingSpecProjection {
  readonly kind: "LivingSpecProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly sectionCount: number;
  readonly approvalStatus: "draft" | "pending_approval" | "approved";
}
