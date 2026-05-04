import type { ConfidenceCompletionProjection, DecisionQueueProjection, ResearchEvidenceProjection, RuntimeActivityProjection } from "../projections";
import type { DecisionId, ProjectId, QueueItemId, SessionId, StateVersion } from "../ids";

export interface ProjectSnapshot {
  readonly projectId: ProjectId;
  readonly privacyMode: "local_only" | "local_with_manual_export";
}

export interface SessionSnapshot {
  readonly sessionId: SessionId;
  readonly phase: "intake" | "spec" | "question_loop" | "research" | "completion";
}

export interface CurrentSpecSnapshot {
  readonly draftRef: string;
  readonly versionRef?: string;
}

export interface AmbiguityIssueSnapshot {
  readonly queueItemId: QueueItemId;
  readonly summary: string;
  readonly status: "open" | "answered" | "deferred" | "resolved";
}

export interface DecisionSnapshot {
  readonly decisionId: DecisionId;
  readonly status: "active" | "approved" | "rejected" | "deferred";
}

export interface ProductEngineStateSnapshot {
  readonly stateVersion: StateVersion;
  readonly project: ProjectSnapshot;
  readonly session: SessionSnapshot;
  readonly currentSpec: CurrentSpecSnapshot;
  readonly openIssues: readonly AmbiguityIssueSnapshot[];
  readonly queueProjection: DecisionQueueProjection;
  readonly researchState: ResearchEvidenceProjection;
  readonly decisions: readonly DecisionSnapshot[];
  readonly runtimeState: RuntimeActivityProjection;
  readonly completeness: ConfidenceCompletionProjection;
}
