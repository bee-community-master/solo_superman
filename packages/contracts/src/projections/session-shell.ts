import type { ProjectId, ProjectionVersion, SessionId } from "../ids";
import type { ProjectPurposeMode, ProjectPurposeModeSelectionStatus } from "../product-engine";

export interface SessionShellProjection {
  readonly kind: "SessionShellProjection";
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly version: ProjectionVersion;
  readonly phase: "scaffold" | "intake" | "spec" | "validation" | "complete";
  readonly projectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeSelectionStatus?: ProjectPurposeModeSelectionStatus;
  readonly projectPurposeModeLabel: string;
  readonly projectPurposeModeEffect: string;
}
