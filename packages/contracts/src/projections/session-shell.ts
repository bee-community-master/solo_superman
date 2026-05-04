import type { ProjectId, ProjectionVersion, SessionId } from "../ids";

export interface SessionShellProjection {
  readonly kind: "SessionShellProjection";
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly phase: "scaffold" | "intake" | "spec" | "validation" | "complete";
}
