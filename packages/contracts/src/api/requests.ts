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
import {
  CHATGPT_BROWSER_DELEGATION_APPROVAL_DECISIONS,
  CHATGPT_BROWSER_DELEGATION_STATUSES
} from "../projections/chatgpt-browser-delegation";
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
  CreateChatGptBrowserDelegationRunPayload,
  ChatGptBrowserDelegationDataDisclosurePreview,
  ChatGptBrowserDelegationFallbackState,
  ChatGptBrowserDelegationRedactionSummary,
  ChatGptBrowserDelegationResultImportGate,
  ChatGptBrowserDelegationStatus,
  ChatGptBrowserDelegationApprovalDecision,
  ChatGptBrowserDelegationVerdictDto,
  RevokeChatGptBrowserDelegationRunPayload
} from "../projections/chatgpt-browser-delegation";
import type {
  ServicePageApprovalGranularity,
  ServicePageUsePermissionApprovalDecision,
  ServicePageBlockedActionClass,
  ServicePageDataCategory,
  ServicePageUseActionClass
} from "../projections/service-page-use-permission";
import type {
  CodeReviewRecord,
  CleanCodeReviewRecord,
  ImplementationStepBlocker,
  ImplementationStepDoc,
  ImplementationStepStatus,
  MissingTestAuditRecord,
  NoCodeStepEvidence,
  StepCommitRecord,
  TestEvidenceRecord,
  TrackerDoc
} from "../projections/implementation-step-ledger";
import type { PlanningHandoffRequestedScopeDto, PlanningHandoffSourceRefDto } from "../projections/planning-handoff";
import type { ResearchQueueTerminalOutcome } from "../projections/research-evidence";
import type { BlockedActionType, CodexTurnPurpose } from "../codex";
import type {
  BusinessCriticIntensity,
  ProjectPurposeMode,
  RequiredDecisionRef,
  ResearchAutomationPermission
} from "../product-engine";

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
  readonly initialResearchAutomationPermission?: ResearchAutomationPermission;
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

export interface GenerateInitialQuestionSetRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly rawIdea: string;
  readonly intakeGoal: string;
  readonly projectPurposeMode: ProjectPurposeMode;
  readonly businessCriticIntensity?: BusinessCriticIntensity | null;
  readonly reviewAxes?: readonly string[];
  readonly initialQuestionCount?: {
    readonly min?: number;
    readonly max?: number;
  };
  readonly ambiguityDimensions?: readonly string[];
  readonly language?: string;
  readonly domainKeywordExpansions?: Readonly<Record<string, readonly string[]>>;
}

export type GenerateInitialQuestionSetStatus = "generated" | "unavailable" | "invalid";

export interface GenerateInitialQuestionSetResponse {
  readonly status: GenerateInitialQuestionSetStatus;
  readonly promptTemplateRef: string;
  readonly schemaVersion: string;
  readonly source: "codex_runtime_preview" | "codex_runtime_unavailable" | "codex_runtime_invalid_json";
  readonly generatedQuestionSet?: unknown;
  readonly validationIssues?: readonly string[];
  readonly reason?: string;
}

export interface AnalyzeAmbiguityRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly targetRef: string;
  readonly generatedQuestionSet: unknown;
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
  readonly status?: ChatGptBrowserDelegationStatus;
  readonly userVisibleExplanation?: string;
  readonly nextAction?: string;
  readonly promptPreviewRef: string;
  readonly dataDisclosurePreview: ChatGptBrowserDelegationDataDisclosurePreview;
  readonly redactionSummary: ChatGptBrowserDelegationRedactionSummary;
  readonly policyRiskVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly sessionOwnershipVerdict: ChatGptBrowserDelegationVerdictDto;
  readonly approvalDecision: ChatGptBrowserDelegationApprovalDecision;
  readonly browserActionAuthorityRef?: string;
  readonly resultImportRef?: ResearchResultId;
  readonly resultImportGate?: ChatGptBrowserDelegationResultImportGate;
  readonly fallbackApplied?: ChatGptBrowserDelegationFallbackState;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly activityFeedRefs?: readonly string[];
}

export interface RevokeChatGptBrowserDelegationRunRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly runId: string;
  readonly reason: string;
  readonly auditRefs?: readonly string[];
}

export const CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "researchTaskId",
  "status",
  "userVisibleExplanation",
  "nextAction",
  "promptPreviewRef",
  "dataDisclosurePreview",
  "redactionSummary",
  "policyRiskVerdict",
  "sessionOwnershipVerdict",
  "approvalDecision",
  "browserActionAuthorityRef",
  "resultImportRef",
  "resultImportGate",
  "fallbackApplied",
  "screenshotRefs",
  "logRefs",
  "auditRefs",
  "activityFeedRefs"
] as const satisfies readonly (keyof CreateChatGptBrowserDelegationRunRequest)[];

export const CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS = [
  "researchTaskId",
  "status",
  "userVisibleExplanation",
  "nextAction",
  "promptPreviewRef",
  "dataDisclosurePreview",
  "redactionSummary",
  "policyRiskVerdict",
  "sessionOwnershipVerdict",
  "approvalDecision",
  "browserActionAuthorityRef",
  "resultImportRef",
  "resultImportGate",
  "fallbackApplied",
  "screenshotRefs",
  "logRefs",
  "auditRefs",
  "activityFeedRefs"
] as const satisfies readonly (keyof CreateChatGptBrowserDelegationRunPayload)[];

export const CHATGPT_BROWSER_DELEGATION_REVOKE_REQUEST_KEYS = [
  "scaffoldOnly",
  "sessionId",
  "expectedStateVersion",
  "idempotencyKey",
  "runId",
  "reason",
  "auditRefs"
] as const satisfies readonly (keyof RevokeChatGptBrowserDelegationRunRequest)[];

export const CHATGPT_BROWSER_DELEGATION_REVOKE_PAYLOAD_KEYS = [
  "runId",
  "reason",
  "auditRefs"
] as const satisfies readonly (keyof RevokeChatGptBrowserDelegationRunPayload)[];

export function isChatGptBrowserDelegationStatus(value: unknown): value is ChatGptBrowserDelegationStatus {
  return (
    typeof value === "string" &&
    CHATGPT_BROWSER_DELEGATION_STATUSES.includes(value as ChatGptBrowserDelegationStatus)
  );
}

export function isChatGptBrowserDelegationApprovalDecision(
  value: unknown
): value is ChatGptBrowserDelegationApprovalDecision {
  return (
    typeof value === "string" &&
    CHATGPT_BROWSER_DELEGATION_APPROVAL_DECISIONS.includes(value as ChatGptBrowserDelegationApprovalDecision)
  );
}

export interface CreateServicePageUsePermissionRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly serviceName: string;
  readonly serviceOrigin: string;
  readonly pageUrl: string;
  readonly purpose: string;
  readonly allowedActionClasses: readonly ServicePageUseActionClass[];
  readonly blockedActionClasses: readonly ServicePageBlockedActionClass[];
  readonly dataCategories: readonly ServicePageDataCategory[];
  readonly approvalGranularity: ServicePageApprovalGranularity;
  readonly approvalDecision: ServicePageUsePermissionApprovalDecision;
  readonly userApprovalRef: string;
  readonly promptPreviewRef: string;
  readonly redactionPreviewRef: string;
  readonly userExportDeleteControls: true;
  readonly finalSubmitRequested?: boolean;
  readonly finalSubmitConfirmationRef?: string;
  readonly finalSubmitExecutionAuthorityRef?: string;
  readonly screenshotRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly auditRefs?: readonly string[];
  readonly activityFeedRefs?: readonly string[];
}

export interface RevokeServicePageUsePermissionRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly permissionId: string;
  readonly reason: string;
  readonly auditRefs?: readonly string[];
}

export interface DeleteServicePageUsePermissionArtifactsRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly permissionId: string;
  readonly reason: string;
  readonly auditRefs?: readonly string[];
}

export interface RecordImplementationStepLedgerRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly expectedStateVersion: StateVersion;
  readonly idempotencyKey: string;
  readonly trackerDoc: TrackerDoc;
  readonly stepDoc: ImplementationStepDoc;
  readonly targetStatus: ImplementationStepStatus;
  readonly startedEvidenceRefs?: readonly string[];
  readonly stepCommitRecord?: StepCommitRecord;
  readonly noCodeStepEvidence?: NoCodeStepEvidence;
  readonly codeReviewRecord?: CodeReviewRecord;
  readonly cleanCodeReviewRecord?: CleanCodeReviewRecord;
  readonly missingTestAuditRecord?: MissingTestAuditRecord;
  readonly testEvidenceRecord?: TestEvidenceRecord;
  readonly blocker?: ImplementationStepBlocker;
  readonly evidenceRefs?: readonly string[];
}

export interface ValidateExecutionAuthorityPreflightRequest extends ScaffoldRequestPlaceholder {
  readonly sessionId: SessionId;
  readonly idempotencyKey: string;
  readonly actionClass: ExecutionAuthorityActionClass;
  readonly previewArtifactHash: string;
  readonly requestedAt: string;
  readonly approvalExpiresAt?: string;
}
