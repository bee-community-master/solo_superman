import type { ProjectId, SessionId, StateVersion } from "../ids";

export interface ProductEngineStateSnapshot {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly stateVersion: StateVersion;
  readonly snapshotKind: "scaffold_placeholder" | "runtime_state";
}
