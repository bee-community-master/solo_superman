import type { ProjectionVersion, SessionId } from "../ids";

export interface ConfidenceCompletionProjection {
  readonly kind: "ConfidenceCompletionProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly compositeScore: number;
  readonly topRisks: readonly string[];
}
