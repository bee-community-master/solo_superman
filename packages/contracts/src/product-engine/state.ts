import type {
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  FounderBriefProjection,
  LivingSpecProjection,
  PlanningHandoffProjection,
  ResearchEvidenceProjection,
  RuntimeActivityProjection,
  SessionShellProjection
} from "../projections";
import type { DecisionId, ProjectId, QueueItemId, SessionId, StateVersion } from "../ids";

export interface ProjectSnapshot {
  readonly projectId: ProjectId;
  readonly privacyMode: "local_only" | "local_with_manual_export";
  readonly rawIdeaText?: string;
}

export interface SessionSnapshot {
  readonly sessionId: SessionId;
  readonly phase: "intake" | "spec" | "question_loop" | "research" | "completion";
}

export interface CurrentSpecSnapshot {
  readonly draftRef: string;
  readonly versionRef?: string;
  readonly title?: string;
  readonly sections?: readonly string[];
}

export interface AmbiguityIssueSnapshot {
  readonly queueItemId: QueueItemId;
  readonly summary: string;
  readonly status: "open" | "answered" | "deferred" | "resolved";
  readonly questionText?: string;
  readonly sourceRef?: string;
}

export type RequiredDecisionRef =
  | "primary_customer"
  | "problem"
  | "value"
  | "mvp_scope"
  | "validation_plan"
  | "success_criteria";

export interface DecisionSnapshot {
  readonly decisionId: DecisionId;
  readonly requiredDecisionRef: RequiredDecisionRef;
  readonly status: "active" | "approved" | "rejected" | "deferred" | "risk_accepted";
}

export interface SpecUpdatePreviewSnapshot {
  readonly previewRef: string;
  readonly sourceRef: string;
  readonly decisionId: DecisionId;
  readonly requiredDecisionRef: RequiredDecisionRef;
  readonly title: string;
  readonly sections: readonly string[];
}

export interface ProductEngineStateSnapshot {
  readonly stateVersion: StateVersion;
  readonly project: ProjectSnapshot;
  readonly session: SessionSnapshot;
  readonly intake?: {
    readonly intakeRef: string;
    readonly answer: string;
  };
  readonly currentSpec: CurrentSpecSnapshot;
  readonly openIssues: readonly AmbiguityIssueSnapshot[];
  readonly queueProjection: DecisionQueueProjection;
  readonly sessionShellProjection?: SessionShellProjection;
  readonly livingSpecProjection?: LivingSpecProjection;
  readonly researchState: ResearchEvidenceProjection;
  readonly decisions: readonly DecisionSnapshot[];
  readonly specUpdatePreviews?: readonly SpecUpdatePreviewSnapshot[];
  readonly runtimeState: RuntimeActivityProjection;
  readonly completeness: ConfidenceCompletionProjection;
  readonly founderBrief?: FounderBriefProjection;
  readonly planningHandoff?: PlanningHandoffProjection;
}
