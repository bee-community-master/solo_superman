import type {
  DecisionId,
  ProjectId,
  QueueItemId,
  ResearchResultId,
  ResearchTaskId,
  RuntimeArtifactId,
  SessionId,
  StateVersion
} from "../ids";

export interface ScaffoldRequestPlaceholder {
  readonly scaffoldOnly?: true;
}

export interface StartProjectRequest extends ScaffoldRequestPlaceholder {
  readonly rawIdea: string;
  readonly localPrivacyMode: "local_only" | "local_with_manual_export";
  readonly sourceNote?: string;
}

export interface StartOrResumeSessionRequest extends ScaffoldRequestPlaceholder {
  readonly projectId: ProjectId;
}

export interface CaptureIntakeRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly answer: string;
}

export interface DraftInitialSpecRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
}

export interface AnalyzeAmbiguityRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly targetRef: string;
}

export interface ActivateQuestionBatchRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly queueItemIds?: readonly QueueItemId[];
}

export interface SubmitAnswerRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly queueItemId: QueueItemId;
  readonly expectedStateVersion: StateVersion;
  readonly answer: string;
}

export interface DeferQueueItemRequest extends ScaffoldRequestPlaceholder {
  readonly queueItemId: QueueItemId;
  readonly reason: string;
}

export interface DismissQueueItemRequest extends ScaffoldRequestPlaceholder {
  readonly queueItemId: QueueItemId;
  readonly reason: string;
}

export interface PlanResearchRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly objective: string;
}

export interface ImportResearchResultRequest extends ScaffoldRequestPlaceholder {
  readonly researchTaskId: ResearchTaskId;
  readonly result: string;
}

export interface SynthesizeEvidenceRequest extends ScaffoldRequestPlaceholder {
  readonly researchResultId: ResearchResultId;
}

export interface CreateSpecUpdatePreviewRequest extends ScaffoldRequestPlaceholder {
  readonly sourceRef: string;
}

export interface CreateDecisionCardRequest extends ScaffoldRequestPlaceholder {
  readonly sourcePreviewRef: string;
}

export interface ResolveDecisionRequest extends ScaffoldRequestPlaceholder {
  readonly decisionId: DecisionId;
  readonly outcome: "approved" | "rejected" | "deferred";
}

export interface CreateSpecVersionRequest extends ScaffoldRequestPlaceholder {
  readonly approvedPreviewRef: string;
}

export interface CreateRuntimePreviewRequest extends ScaffoldRequestPlaceholder {
  readonly turnPurpose: string;
  readonly contextHash: string;
}

export interface CreateManualHandoffRequest extends ScaffoldRequestPlaceholder {
  readonly promptContextRef: string;
}

export interface ConvertRuntimeArtifactRequest extends ScaffoldRequestPlaceholder {
  readonly artifactId: RuntimeArtifactId;
  readonly target: string;
}

export interface BlockRuntimeArtifactRequest extends ScaffoldRequestPlaceholder {
  readonly artifactId: RuntimeArtifactId;
  readonly reason: string;
}

export interface ScoreCompletenessRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
}

export interface CompletionCandidateRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
}

export interface PrepareFounderBriefRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
}
