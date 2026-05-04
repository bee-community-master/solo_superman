import type { ProjectionVersion, SessionId } from "../ids";

export interface FounderBriefProjection {
  readonly kind: "FounderBriefProjection";
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly exportReady: boolean;
  readonly knownRisks: readonly string[];
}
