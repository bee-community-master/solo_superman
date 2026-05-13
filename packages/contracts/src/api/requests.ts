import type {
  DecisionId,
  ProjectId,
  QueueItemId,
  ResearchResultId,
  ResearchRunId,
  ResearchTaskId,
  RuntimeArtifactId,
  SessionId,
  StateVersion
} from "../ids";
import type { ResearchImpact, ResearchRouteOutcome, ResearchSourceReliability } from "../projections";
import type {
  BoundedAgentOutputRecord,
  ExecutionApprovalDecision,
  ExecutionAuthorityActionClass,
  ExecutionAuthorityApprover,
  ExecutionAuthorityPreconditionChecks,
  ExecutionAuthorityRequestedScope,
  ExecutionRollbackReference,
  ExecutionSandboxBoundary
} from "../projections/execution-authority";
import type {
  ChatGptBrowserDelegationDataDisclosurePreview,
  ChatGptBrowserDelegationFallbackState,
  ChatGptBrowserDelegationRedactionSummary,
  ChatGptBrowserDelegationResultImportGate,
  ChatGptBrowserDelegationVerdictDto
} from "../projections/chatgpt-browser-delegation";
import type { PlanningHandoffRequestedScopeDto, PlanningHandoffSourceRefDto } from "../projections/planning-handoff";
import type { ResearchQueueTerminalOutcome } from "../projections/research-evidence";
import type { BlockedActionType, CodexTurnPurpose } from "../codex";
import type { BusinessCriticIntensity, ProjectPurposeMode, RequiredDecisionRef } from "../product-engine";

export interface ScaffoldRequestPlaceholder {
  readonly scaffoldOnly?: true;
}

export interface StartProjectRequest extends ScaffoldRequestPlaceholder {
  readonly rawIdea: string;
  readonly localPrivacyMode: "local_only" | "local_with_manual_export";
  readonly projectPurposeMode: ProjectPurposeMode;
  readonly suggestedProjectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeConfirmation: "user_confirmed";
  readonly projectPurposeModeReason?: string;
  readonly businessCriticIntensity?: BusinessCriticIntensity;
  readonly businessCriticIntensityConfirmation?: "user_confirmed";
  readonly businessCriticIntensityReason?: string;
  readonly sourceNote?: string;
}

export interface ChangeProjectPurposeModeRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly projectPurposeMode: ProjectPurposeMode;
  readonly reason: string;
  readonly suggestedProjectPurposeMode?: ProjectPurposeMode;
}

export interface ChangeBusinessCriticIntensityRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly businessCriticIntensity: BusinessCriticIntensity;
  readonly businessCriticIntensityConfirmation: "user_confirmed";
  readonly reason: string;
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
  readonly researchRouteHint?: ResearchRouteOutcome;
  readonly claimImpact?: ResearchImpact;
  readonly evidenceBalanceHint?: "unknown" | "pro_only" | "con_only" | "pro_con_present";
  readonly researchObjective?: string;
}

export interface DeferQueueItemRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly queueItemId: QueueItemId;
  readonly reason: string;
  readonly nextValidationAction?: string;
  readonly riskDisposition?: "known_risk_next_validation_action";
}

export interface DismissQueueItemRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly queueItemId: QueueItemId;
  readonly reason: string;
}

export interface PlanResearchRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly objective: string;
  readonly sourceQueueItemId: QueueItemId;
  readonly routeOutcome?: ResearchRouteOutcome;
  readonly impact?: ResearchImpact;
}

export interface ImportResearchResultRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly researchTaskId: ResearchTaskId;
  readonly expectedStateVersion: StateVersion;
  readonly result: string;
  readonly researchRunId?: ResearchRunId;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly sourceReliability?: ResearchSourceReliability;
  readonly sourcePublishedAt?: string;
  readonly sourceRetrievedAt?: string;
  readonly limitationNotes?: string;
  readonly claim?: string;
  readonly decisionContext?: string;
  readonly specSectionRef?: string;
  readonly questionRef?: string;
  readonly implicationScope?: string;
  readonly staleSensitive?: boolean;
  readonly sourceRequiredAfter?: string;
  readonly synthesisVersion?: number;
}

export interface SynthesizeEvidenceRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly researchResultId: ResearchResultId;
  readonly expectedStateVersion: StateVersion;
  readonly synthesisVersion?: number;
  readonly forceRetry?: boolean;
}

export interface ResolveResearchQueueCardRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly cardId: QueueItemId;
  readonly expectedStateVersion: StateVersion;
  readonly outcome: ResearchQueueTerminalOutcome;
  readonly rationale?: string;
}

export interface CreateSpecUpdatePreviewRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly sourceRef: string;
  readonly requiredDecisionRef?: RequiredDecisionRef;
  readonly title?: string;
  readonly sections?: readonly string[];
}

export interface CreateDecisionCardRequest extends ScaffoldRequestPlaceholder {
  readonly sourcePreviewRef: string;
}

export interface ResolveDecisionRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly decisionId: DecisionId;
  readonly expectedStateVersion: StateVersion;
  readonly outcome: "approved" | "rejected" | "deferred" | "risk_accepted";
  readonly rationale?: string;
}

export interface CreateSpecVersionRequest extends ScaffoldRequestPlaceholder {
  readonly expectedStateVersion: StateVersion;
  readonly approvedPreviewRef: string;
  readonly title?: string;
  readonly sections?: readonly string[];
}

export interface CreateRuntimePreviewRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly turnPurpose: CodexTurnPurpose;
  readonly contextHash: string;
  readonly prompt: string;
  readonly sourceRefs: readonly string[];
  readonly targetObject?: string;
  readonly requestedActionType?: BlockedActionType;
  readonly requestedActionReason?: string;
}

export interface CreateManualHandoffRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly turnPurpose: CodexTurnPurpose;
  readonly contextHash: string;
  readonly prompt: string;
  readonly sourceRefs: readonly string[];
  readonly targetObject?: string;
}

export interface ConvertRuntimeArtifactRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly artifactId: RuntimeArtifactId;
  readonly expectedStateVersion: StateVersion;
  readonly target: string;
}

export interface BlockRuntimeArtifactRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly artifactId: RuntimeArtifactId;
  readonly expectedStateVersion: StateVersion;
  readonly blockedActionType: BlockedActionType;
  readonly reason: string;
}

export interface ScoreCompletenessRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
}

export interface CompletionCandidateRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
}

export interface PrepareFounderBriefRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly requestedFormat?: "markdown";
  readonly fileWriteRequested?: boolean;
  readonly externalExportRequested?: boolean;
  readonly destinationPath?: string;
  readonly exportUrl?: string;
}

export interface CreatePlanningHandoffRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
  readonly requestedScope?: PlanningHandoffRequestedScopeDto;
}

export interface CreateExecutionAuthorityRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly sourcePlanningHandoffRef?: string;
  readonly boundedAgentOutput: BoundedAgentOutputRecord;
  readonly actionClass: ExecutionAuthorityActionClass;
  readonly previewArtifactRef?: string;
  readonly previewArtifactHash?: string;
  readonly reviewedPreviewArtifactHash?: string;
  readonly requestedScope: ExecutionAuthorityRequestedScope;
  readonly approvalDecision: ExecutionApprovalDecision;
  readonly approver?: ExecutionAuthorityApprover;
  readonly sandboxBoundary: ExecutionSandboxBoundary;
  readonly rollbackReference?: ExecutionRollbackReference;
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly preconditionChecks?: ExecutionAuthorityPreconditionChecks;
}

export interface CreateChatGptBrowserDelegationRunRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly researchTaskId: ResearchTaskId;
  readonly promptPreviewRef: string;
  readonly dataDisclosurePreview: ChatGptBrowserDelegationDataDisclosurePreview;
  readonly redactionSummary: ChatGptBrowserDelegationRedactionSummary;
  readonly policyRiskVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly sessionOwnershipVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly approvalDecision: "pending" | "approved" | "rejected" | "revision_requested";
  readonly browserActionAuthorityRef?: string;
  readonly resultImportRef?: ResearchResultId;
  readonly resultImportGate?: ChatGptBrowserDelegationResultImportGate;
  readonly fallbackApplied?: ChatGptBrowserDelegationFallbackState;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
}

export interface ValidateExecutionAuthorityPreflightRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly idempotencyKey: string;
  readonly actionClass: ExecutionAuthorityActionClass;
  readonly previewArtifactHash: string;
  readonly requestedAt: string;
  readonly approvalExpiresAt?: string;
}
