import {
  CONTRACT_SCHEMA_VERSION,
  BOUNDED_AGENT_FAILURE_MODES,
  BOUNDED_AGENT_NO_EXECUTION_POLICIES,
  EXECUTION_AUTHORITY_SCHEMA_VERSION,
  EXECUTION_APPROVAL_DECISIONS,
  EXECUTION_AUTHORITY_ACTION_CLASSES,
  EXECUTION_NETWORK_POLICIES,
  EXECUTION_ROLLBACK_KINDS,
  EXECUTION_SANDBOX_MODES,
  EXECUTION_SECRET_POLICIES,
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICY_BY_TURN_PURPOSE,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE,
  CODEX_ARTIFACT_KINDS,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_TURN_PURPOSES,
  CANONICAL_INITIAL_SPEC_SECTIONS,
  BUSINESS_CRITIC_INTENSITIES,
  BUSINESS_CRITIC_INTENSITY_EFFECTS,
  BUSINESS_CRITIC_INTENSITY_LABELS,
  BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL,
  SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES,
  SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES,
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  SERVICE_PAGE_BLOCKED_NEXT_ACTION,
  SERVICE_PAGE_FINAL_SUBMIT_BLOCKED_CONTRACT_LABEL,
  SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES,
  SERVICE_PAGE_USE_PERMISSION_SCHEMA_VERSION,
  PROJECT_PURPOSE_MODES,
  PROJECT_PURPOSE_MODE_LABELS,
  PROJECT_PURPOSE_MODE_REQUIRED_LABEL,
  PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES,
  RESEARCH_AUTOMATION_PERMISSIONS,
  PHASE25_CANDIDATE_LANES,
  PHASE25_DELEGATION_RISK_GATE_CHECKS,
  PHASE25_DELEGATION_RISK_GATE_VERDICTS,
  PHASE25_NO_EXECUTION_BOUNDARY,
  PHASE25_RESEARCH_COMPARISON_SCHEMA_VERSION,
  PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS,
  PHASE25_SOURCE_TYPES,
  assertPhase15bUpgradeHintsMatchBlockedAction,
  isPhase15bHintArtifactKind,
  containsExecutionAuthoritySecretValueLeak,
  executionAuthorityLedgerStatusForRecord,
  executionAuthorityLedgerSummaryForStatus,
  validatePhase15bUpgradeHints,
  validateExecutionAuthorityLedgerProjection,
  validateServicePageUsePermissionProjection,
  servicePageUsePermissionIsRevokableStatus,
  servicePageGrantedNextAction,
  servicePageUsePermissionRefHasForbiddenCustodyContent,
  servicePageUsePermissionStringHasUrlCredentials,
  servicePageUsePermissionSummaryForStatus,
  IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION,
  IMPLEMENTATION_STEP_STATUSES,
  IMPLEMENTATION_REVIEW_VERDICTS,
  IMPLEMENTATION_CODE_REVIEW_SCOPES,
  IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES,
  IMPLEMENTATION_CODE_REVIEW_STREAK_MISSING_EVIDENCE,
  IMPLEMENTATION_CLEAN_CODE_REVIEW_STREAK_MISSING_EVIDENCE,
  IMPLEMENTATION_TEST_OUTCOMES,
  implementationCodeReviewStreaks,
  implementationCleanCodeReviewStreaks,
  implementationStepLedgerProgressReport,
  validateImplementationStepLedgerProjection,
  validatePhase25ResearchComparisonReport,
  type ActiveBatchSafeProjection,
  type AmbiguityAnswerOption,
  type AmbiguityAnswerSelectionMode,
  type AmbiguityExpectedAnswerType,
  type AmbiguityIssueSnapshot,
  type BusinessCriticalQuestionCategory,
  type BusinessCriticIntensity,
  type BusinessCriticIntensityAuditSnapshot,
  type BusinessCriticIntensitySelectionStatus,
  type BusinessCriticPressureKind,
  type BlockedActionType,
  type CodexApplyPolicy,
  type CodexArtifactKind,
  type CodexRuntimeSource,
  type CodexTurnPurpose,
  type ConfidenceCompletionProjection,
  type DecisionId,
  type DecisionQueueProgressProjection,
  type QueueItemProjection,
  type RecordImplementationStepLedgerPayload,
  type DecisionQueueProjection,
  type BoundedAgentOutputRecord,
  type CodeReviewRecord,
  type CleanCodeReviewRecord,
  type CreateExecutionAuthorityPayload,
  type CreateServicePageUsePermissionPayload,
  type DeleteServicePageUsePermissionArtifactsPayload,
  type RevokeServicePageUsePermissionPayload,
  type EvidenceMatrixProjection,
  type ExecutionApprovalDecision,
  type ExecutionAuthorityApprover,
  type ExecutionAuthorityActionClass,
  type ExecutionAuthorityBlockCode,
  type ExecutionAuthorityBlockReasonDto,
  type ExecutionAuthorityLedgerProjection,
  type ExecutionAuthorityPreconditionChecks,
  type ExecutionAuthorityRecord,
  type ExecutionAuthorityRequestedScope,
  type ExecutionRollbackReference,
  type ExecutionSandboxBoundary,
  type ImplementationStepBlocker,
  type ImplementationStepDoc,
  type ImplementationStepLedgerProjection,
  type ImplementationStepRecord,
  type ImplementationStepStatus,
  type MissingTestAuditRecord,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type NoCodeStepEvidence,
  type Phase25BaselineResearchSummaryDto,
  type Phase25CandidateLane,
  type Phase25CandidateResearchSummaryDto,
  type Phase25FallbackLane,
  type Phase25DelegationRiskGateCheckDto,
  type Phase25DelegationRiskGateCheckName,
  type Phase25DelegationRiskGateDto,
  type Phase25DelegationRiskGateVerdict,
  type Phase25ResearchComparisonProjection,
  type Phase25ResearchComparisonStatus,
  type Phase25ResearchQualityComparisonReportDto,
  type Phase25ResearchQualityRubricScoreDto,
  type Phase25ResearchQualityRubricDimension,
  type Phase25SourceRefDto,
  type Phase25SourceType,
  type PlanningHandoffArtifactDto,
  type PlanningHandoffBlockerArtifactDto,
  type PlanningHandoffBlockerClass,
  type PlanningHandoffBlockerDto,
  type PlanningHandoffGateVerdictDto,
  type PlanningHandoffProjection,
  type PlanningHandoffQueueOutcome,
  type PlanningHandoffQueueOutcomeSummaryDto,
  type PlanningHandoffRequestedScopeDto,
  type PlanningHandoffRequiredUserAction,
  type PlanningHandoffResidualRiskClass,
  type PlanningHandoffResidualRiskDto,
  type PlanningHandoffSourceRefDto,
  type PlanningHandoffSourceType,
  type PlanningHandoffTaskDto,
  type PlanningHandoffVerdict,
  type ProductEngineCommand,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineEventDraft,
  type ProductEngineReduction,
  type ProductEngineStateSnapshot,
  type Phase15bUpgradeHints,
  type ProjectPurposeMode,
  type ProjectPurposeModeAuditActor,
  type ProjectPurposeModeAuditSnapshot,
  type ResearchAutomationPermission,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type EffectTaskId,
  type RequiredDecisionRef,
  type ResearchImpact,
  type ResearchEvidenceProjection,
  type ResearchQueueTerminalOutcome,
  type ResearchResultProjection,
  type ResearchResultId,
  type ResearchRunId,
  type ResearchRouteOutcome,
  type ResearchReviewCardProjection,
  type ResearchSourceReliability,
  type ResearchTaskId,
  type ResearchTaskProjection,
  type RuntimeActivityProjection,
  type RuntimeArtifactId,
  type RuntimePreviewArtifact,
  type ServicePageApprovalGranularity,
  type ServicePageBlockedActionClass,
  type ServicePageDataCategory,
  type ServicePageFinalSubmitBoundary,
  type ServicePageUsePermissionApprovalDecision,
  type ServicePageUseActionClass,
  type ServicePageUsePermissionAuditEntry,
  type ServicePageUsePermissionBlockCode,
  type ServicePageUsePermissionBlockReasonDto,
  type ServicePageUsePermissionProjection,
  type ServicePageUsePermissionRecord,
  type ServicePageUsePermissionStatus,
  type SessionShellProjection,
  type SessionId,
  type SpecVersionId,
  type SpecUpdatePreviewSnapshot,
  type StepCommitRecord,
  type TestEvidenceRecord,
  type TrackerDoc,
  type StateVersion
} from "@solo-superman/contracts";
import {
  buildConfidenceCompletionProjection,
  buildFounderBriefProjection
} from "../completeness";
import {
  addImportedResearchResultToProjection,
  addResearchResultToProjection,
  buildDecisionEvidencePack,
  addResearchTaskToProjection,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  resolveResearchReviewCardInProjection,
  stripInternalResearchMetaText,
  synthesizeEvidenceMatrix
} from "../research-engine";
import {
  reduceCreateChatGptBrowserDelegationRun,
  reduceRevokeChatGptBrowserDelegationRun
} from "./chatgpt-browser-delegation";
import { sha256Hex } from "./deterministic-hash";
import {
  answerOptionsForQuestion,
  answerOptionsForSeed,
  primaryCustomerContextProfileForText
} from "./answer-options";
import {
  GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
  GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
  parseGeneratedAmbiguityQuestionSet
} from "./generated-ambiguity-questions";
import {
  researchFollowUpAnswerOptions,
  researchFollowUpAnswerSelectionMode,
  researchFollowUpExpectedAnswerType
} from "./research-follow-up-answer-shape";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";
import {
  acceptedReduction,
  eventDraft,
  numericVersion,
  projectionVersionFor,
  reject,
  stableToken
} from "./reduction-helpers";
import {
  hasOnlyRecordKeys,
  hasOwnRecordKey,
  optionalStringArray,
  recordFromUnknown,
  requiredString,
  requiredStringArray,
  stringArray,
  uniqueStringRefs,
  uniqueStrings
} from "./value-helpers";

export const PACKAGE_SLICE_STATUS = "product-engine-e2e-dry-run-pr-09" as const;
export {
  GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
  GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
  parseGeneratedAmbiguityQuestionSet,
  parseGeneratedAmbiguityQuestionSetText
} from "./generated-ambiguity-questions";

type PrivacyMode = "local_only" | "local_with_manual_export";
const PROJECT_PURPOSE_MODE_REQUIRED_EFFECT =
  "사용자가 사업화 검증 중심 또는 개인 workflow 구현 중심을 명시 선택하기 전까지 mode-specific 질문·리서치·완성도·handoff gate를 확정하지 않습니다.";
const PROJECT_PURPOSE_MODE_DETAILS = {
  business: {
    label: PROJECT_PURPOSE_MODE_LABELS.business,
    effect:
      "고객, 문제 강도, 유료 의향, 대체재, 채널, 법무/운영 리스크를 질문·리서치·완성도 판단에 포함합니다.",
    skippedCommercializationAxes: PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES.business
  },
  personal: {
    label: PROJECT_PURPOSE_MODE_LABELS.personal,
    effect:
      "시장 규모나 투자자 narrative 대신 workflow 빈도, GUI 적합성, 구현 가능성, local data/security, 유지보수, 개인 성공 기준을 우선합니다.",
    skippedCommercializationAxes: PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES.personal
  }
} as const satisfies Record<
  ProjectPurposeMode,
  {
    readonly label: string;
    readonly effect: string;
    readonly skippedCommercializationAxes: readonly string[];
  }
>;

const BUSINESS_CRITIC_PRESSURE_SUMMARY = {
  balanced: "balanced: major decision group마다 최소 1개 con/critical question을 요구합니다.",
  strong: "strong: high-impact business gap이 있으면 core-assumption challenge를 active batch 교체 없이 queued_next로 보냅니다.",
  investor_grade:
    "investor_grade: pricing/channel/retention/legal-ops/market timing/founder advantage pressure item 또는 Known Risk + Next Validation Action을 요구합니다."
} as const satisfies Record<BusinessCriticIntensity, string>;

const EMPTY_RESEARCH_PROJECTION: ResearchEvidenceProjection = emptyResearchEvidenceProjection();

const EMPTY_RUNTIME_PROJECTION: RuntimeActivityProjection = {
  kind: "RuntimeActivityProjection",
  version: 0 as ProjectionVersion,
  effects: [],
  runtimeArtifacts: [],
  runtimeStatus: "scaffold_placeholder"
};

const DEFAULT_QUESTION_BATCH_SIZE = 5;
const DEFAULT_FOLLOW_UP_QUESTION_LIMIT = 16;
const BUSINESS_CRITIC_FOLLOW_UP_QUESTION_LIMIT = 6;
const ANSWER_EXCERPT_MAX_CHARS = 96;
const ANSWER_EXCERPT_REDACTED_VALUE = "[민감한 값 숨김]";

const ANSWER_EXCERPT_SENSITIVE_VALUE_PATTERNS = [
  /(?:api[_-]?key|client[_-]?secret|password|secret|token|credential)\s*[=:]\s*["']?[^\s,"']{4,}/giu,
  /\b(?:bearer|sk-[A-Za-z0-9_-]{8,})[A-Za-z0-9._~+/=-]*/giu,
  /https?:\/\/\S*(?:api[_-]?key|password|secret|token|credential)=\S*/giu
] as const;

interface FollowUpQuestionTemplate {
  readonly text: string;
  readonly expectedAnswerType: AmbiguityExpectedAnswerType;
  readonly answerSelectionMode?: AmbiguityAnswerSelectionMode;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
  readonly optionTopicKey?: string;
}

function followUpAnswerOption(
  id: string,
  label: string,
  value: string,
  primaryDetail: string,
  secondaryDetail: string
): AmbiguityAnswerOption {
  return {
    id,
    label,
    value,
    primaryDetail,
    secondaryDetail,
    pro: primaryDetail,
    con: secondaryDetail
  };
}

const FOLLOW_UP_BINARY_ANSWER_OPTIONS = [
  followUpAnswerOption(
    "agree_with_condition",
    "진행 후보로 둔다",
    "이 답을 현재 스펙이나 다음 검증 단계에 반영한다. 조건이 있으면 함께 적는다.",
    "결정을 닫고 다음 단계로 빠르게 이어갈 수 있습니다.",
    "조건이나 예외를 적지 않으면 너무 빨리 확정될 수 있습니다."
  ),
  followUpAnswerOption(
    "disagree_or_hold",
    "보류하거나 좁힌다",
    "이 답을 아직 반영하지 않고 범위 축소, 방향 전환, 추가 확인을 먼저 진행한다.",
    "잘못된 가정에 계속 투자하는 일을 줄입니다.",
    "유효한 기회를 너무 일찍 보류할 수 있습니다."
  ),
  followUpAnswerOption(
    "needs_more_context",
    "더 설명한 뒤 판단",
    "바로 고르기보다 부족한 맥락, 조건, 예외를 먼저 답변에 남긴다.",
    "단순 선택으로 사라질 수 있는 실제 제약을 보존합니다.",
    "이번 답변만으로는 결정이 바로 닫히지 않을 수 있습니다."
  )
] as const satisfies readonly AmbiguityAnswerOption[];

const FOLLOW_UP_SINGLE_DECISION_ANSWER_OPTIONS = [
  followUpAnswerOption(
    "focus_customer_first",
    "고객 기준 먼저 확정",
    "이 답을 가장 먼저 어떤 고객에게 맞출지 결정하는 기준으로 쓴다.",
    "다음 질문과 리서치가 실제 고객 후보로 좁혀집니다.",
    "기능이나 검증 방식 결정은 한 번 더 필요할 수 있습니다."
  ),
  followUpAnswerOption(
    "focus_problem_value_first",
    "문제/가치 기준 먼저 확정",
    "이 답을 사용자가 겪는 문제와 선택 이유를 더 선명하게 만드는 기준으로 쓴다.",
    "스펙의 문제 정의와 가치 제안이 흔들리지 않습니다.",
    "고객 후보가 넓으면 같은 문제라도 해석이 달라질 수 있습니다."
  ),
  followUpAnswerOption(
    "focus_validation_first",
    "검증 방법 먼저 확정",
    "이 답을 다음에 어떤 자료, 인터뷰, 행동 신호로 확인할지 정하는 기준으로 쓴다.",
    "답변이 바로 실행 가능한 검증 행동으로 이어집니다.",
    "제품 범위나 구현 순서는 아직 별도 결정이 필요합니다."
  ),
  followUpAnswerOption(
    "focus_build_scope_first",
    "구현 범위 먼저 확정",
    "이 답을 첫 구현 조각에 넣을 것과 뺄 것을 고르는 기준으로 쓴다.",
    "Build Slice가 작아지고 다음 작업으로 옮기기 쉽습니다.",
    "근거가 약한 상태에서 구현 범위를 먼저 잠글 수 있습니다."
  )
] as const satisfies readonly AmbiguityAnswerOption[];

const MISSING_CON_EVIDENCE_FOLLOW_UP_QUESTION_TEMPLATE = {
  text: "방금 답한 “{answer}”를 더 안전하게 판단하려면, 반례나 한계를 더 찾아야 할까요? 아니면 현재 단서로 조건부 진행해도 될까요?",
  expectedAnswerType: "evidence",
  answerSelectionMode: "single"
} as const satisfies FollowUpQuestionTemplate;

const FOLLOW_UP_QUESTION_TEMPLATES = [
  {
    text: "방금 답한 “{answer}”를 실제 판단 기준으로 바꾸려면, 누가 어떤 상황에서 이 답이 맞다고 확인할 수 있나요?",
    expectedAnswerType: "text"
  },
  {
    text: "방금 답한 “{answer}”를 다음 단계로 옮길 때 지금 하나만 먼저 확정해야 한다면 어떤 기준을 고르시겠습니까?",
    expectedAnswerType: "choice",
    answerSelectionMode: "single",
    answerOptions: FOLLOW_UP_SINGLE_DECISION_ANSWER_OPTIONS
  },
  {
    text: "방금 답한 “{answer}”를 지금 스펙이나 다음 검증 단계에 진행 후보로 둘지, 보류하거나 좁힐지, 조건을 붙여 진행할지 골라주세요.",
    expectedAnswerType: "choice",
    answerSelectionMode: "single",
    answerOptions: FOLLOW_UP_BINARY_ANSWER_OPTIONS
  },
  {
    text: "이 답을 첫 구현 범위에 반영하면 반드시 넣을 것과 의도적으로 뺄 후보를 하나 이상 선택하거나 적어주세요.",
    expectedAnswerType: "choice",
    answerSelectionMode: "multiple",
    optionTopicKey: "mvp_validation_scope"
  },
  {
    text: "이 답이 맞는지 공개 정보나 사용자 행동으로 확인하려면 어떤 검증 방법을 먼저 쓸까요?",
    expectedAnswerType: "experiment",
    answerSelectionMode: "single"
  },
  {
    text: "이 답을 기준으로 다음 결정을 내리기 전에 아직 애매한 단어, 숫자, 대상은 무엇인가요?",
    expectedAnswerType: "text"
  },
  {
    text: "이 답이 틀렸을 때 가장 빨리 드러나는 실패 신호는 무엇이고, 그때의 다음 행동은 무엇인가요?",
    expectedAnswerType: "experiment",
    answerSelectionMode: "single"
  },
  {
    text: "이 답을 실제 제작 순서로 옮기면 첫 1주일 안에 끝낼 검증/구현 조각의 우선순위는 무엇인가요?",
    expectedAnswerType: "rank",
    answerSelectionMode: "ranked"
  },
  {
    text: "이 답을 한 문장 제품 약속으로 바꾸면 무엇이며, 사용자가 그 약속을 믿지 않을 이유는 무엇인가요?",
    expectedAnswerType: "text"
  }
] as const satisfies readonly FollowUpQuestionTemplate[];

const AMBIGUITY_SEVERITY_PRIORITY = {
  high: 0,
  medium: 1,
  low: 2
} satisfies Record<NonNullable<AmbiguityIssueSnapshot["severity"]>, number>;

function emptyConfidenceCompletionProjection(
  sessionIdValue: SessionId,
  version: ProjectionVersion = 0 as ProjectionVersion
): ConfidenceCompletionProjection {
  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: sessionIdValue,
    version,
    compositeScore: 0,
    readinessLabel: "draft",
    axes: [],
    ambiguityDimensionCoverage: [],
    scoreBreakdown: {
      sectionCompleteness: 0,
      questionDebtResolution: 0,
      evidenceQuality: 0,
      decisionApproval: 0,
      consistencyAndConflict: 0
    },
    gates: [],
    topRisks: [],
    topRiskCards: [],
    nextBestActions: ["Capture intake and draft the initial spec."],
    completionCandidate: {
      status: "not_ready",
      summary: "Completeness has not been scored yet.",
      gateFailures: ["Completeness has not been scored yet."],
      ifStopNowArtifact: {
        title: "If stop now",
        summary: "No founder brief can be prepared before intake and scoring.",
        knownRisks: [],
        nextValidationActions: ["Capture intake and draft the initial spec."]
      }
    }
  };
}

function isRequiredDecisionRef(value: unknown): value is RequiredDecisionRef {
  return (
    value === "primary_customer" ||
    value === "problem" ||
    value === "value" ||
    value === "mvp_scope" ||
    value === "validation_plan" ||
    value === "success_criteria"
  );
}

function isPrivacyMode(value: unknown): value is PrivacyMode {
  return value === "local_only" || value === "local_with_manual_export";
}

function isProjectPurposeMode(value: unknown): value is ProjectPurposeMode {
  return typeof value === "string" && PROJECT_PURPOSE_MODES.includes(value as ProjectPurposeMode);
}

function projectPurposeModeFromPayload(value: unknown): ProjectPurposeMode | "invalid" | null {
  if (value === undefined) {
    return null;
  }

  return isProjectPurposeMode(value) ? value : "invalid";
}

function isBusinessCriticIntensity(value: unknown): value is BusinessCriticIntensity {
  return typeof value === "string" && BUSINESS_CRITIC_INTENSITIES.includes(value as BusinessCriticIntensity);
}

function businessCriticIntensityFromPayload(value: unknown): BusinessCriticIntensity | "invalid" | null {
  if (value === undefined) {
    return null;
  }

  return isBusinessCriticIntensity(value) ? value : "invalid";
}

function isResearchAutomationPermission(value: unknown): value is ResearchAutomationPermission {
  return (
    typeof value === "string" &&
    RESEARCH_AUTOMATION_PERMISSIONS.includes(value as ResearchAutomationPermission)
  );
}

function researchAutomationPermissionFromPayload(
  value: unknown
): ResearchAutomationPermission | "invalid" | undefined {
  if (value === undefined) {
    return undefined;
  }

  return isResearchAutomationPermission(value) ? value : "invalid";
}

export function businessCriticIntensityLabel(intensity: BusinessCriticIntensity | null | undefined) {
  return intensity ? BUSINESS_CRITIC_INTENSITY_LABELS[intensity] : BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL;
}

export function businessCriticIntensityEffect(intensity: BusinessCriticIntensity | null | undefined) {
  return intensity
    ? BUSINESS_CRITIC_INTENSITY_EFFECTS[intensity]
    : "사업화 모드에서는 사용자가 balanced, strong, investor_grade 중 하나를 명시 선택하기 전까지 business completion gate를 확정하지 않습니다.";
}

export function businessCriticIntensitySelectionStatus(
  mode: ProjectPurposeMode | null | undefined,
  intensity: BusinessCriticIntensity | null | undefined
): BusinessCriticIntensitySelectionStatus {
  if (mode !== "business") {
    return "not_applicable";
  }

  return intensity ? "confirmed" : "intensity_required";
}

function businessCriticProjectFields(
  mode: ProjectPurposeMode | null | undefined,
  intensity: BusinessCriticIntensity | null | undefined
) {
  const selectionStatus = businessCriticIntensitySelectionStatus(mode, intensity);

  return {
    businessCriticIntensitySelectionStatus: selectionStatus,
    ...(selectionStatus === "confirmed" && intensity
      ? {
          businessCriticIntensity: intensity,
          businessCriticIntensityLabel: businessCriticIntensityLabel(intensity),
          businessCriticIntensityEffect: businessCriticIntensityEffect(intensity)
        }
      : {}),
    ...(selectionStatus === "intensity_required"
      ? {
          businessCriticIntensityLabel: BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL,
          businessCriticIntensityEffect: businessCriticIntensityEffect(null)
        }
      : {})
  } as const;
}

export function projectPurposeModeLabel(mode: ProjectPurposeMode | null | undefined) {
  return mode ? PROJECT_PURPOSE_MODE_DETAILS[mode].label : PROJECT_PURPOSE_MODE_REQUIRED_LABEL;
}

export function projectPurposeModeEffect(mode: ProjectPurposeMode | null | undefined) {
  return mode ? PROJECT_PURPOSE_MODE_DETAILS[mode].effect : PROJECT_PURPOSE_MODE_REQUIRED_EFFECT;
}

function skippedCommercializationAxes(mode: ProjectPurposeMode | null | undefined) {
  return mode ? PROJECT_PURPOSE_MODE_DETAILS[mode].skippedCommercializationAxes : [];
}

function purposeModeReason(mode: ProjectPurposeMode, explicitReason?: string) {
  return explicitReason ?? `${projectPurposeModeLabel(mode)}으로 사용자 확인된 프로젝트 목적입니다.`;
}

export function projectPurposeModeSelectionStatus(mode: ProjectPurposeMode | null | undefined) {
  return mode ? "confirmed" : "mode_required";
}

function requireConfirmedProjectPurposeMode(
  state: ProductEngineStateSnapshot,
  commandName: string
): ProjectPurposeMode | ProductEngineReduction {
  if (state.project.projectPurposeMode) {
    return state.project.projectPurposeMode;
  }

  return reject(
    `${commandName} requires a user-confirmed projectPurposeMode before mode-specific gates can run.`,
    "COMMAND_PRECONDITION_FAILED",
    {
      projectPurposeModeSelectionStatus: "mode_required",
      requiredUserAction: "select_business_or_personal"
    }
  );
}

function isDecisionResolutionStatus(value: unknown): value is Exclude<
  ProductEngineStateSnapshot["decisions"][number]["status"],
  "active"
> {
  return value === "approved" || value === "rejected" || value === "deferred" || value === "risk_accepted";
}

function isResearchQueueTerminalOutcome(value: unknown): value is ResearchQueueTerminalOutcome {
  return (
    value === "approved" ||
    value === "revised" ||
    value === "rejected" ||
    value === "deferred" ||
    value === "risk_accepted" ||
    value === "research_insufficient"
  );
}

function mergeDecision(
  decisions: ProductEngineStateSnapshot["decisions"],
  decision: ProductEngineStateSnapshot["decisions"][number]
) {
  return [...decisions.filter((candidate) => candidate.decisionId !== decision.decisionId), decision];
}

function mergeSpecUpdatePreview(
  previews: readonly SpecUpdatePreviewSnapshot[],
  preview: SpecUpdatePreviewSnapshot
) {
  return [...previews.filter((candidate) => candidate.previewRef !== preview.previewRef), preview];
}

function optionalPayloadSections(value: unknown) {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return "invalid";
  }

  const sections = value.map((section) => (typeof section === "string" ? section.trim() : ""));

  return sections.every(Boolean) ? (sections as readonly string[]) : "invalid";
}

function stringArraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function queueItemIdSelection(value: unknown): readonly QueueItemId[] | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return "invalid";
  }

  const queueItemIds: QueueItemId[] = [];

  for (const item of value) {
    const queueItemId = requiredString(item);

    if (!queueItemId) {
      return "invalid";
    }

    queueItemIds.push(queueItemId as QueueItemId);
  }

  const uniqueQueueItemIds = new Set(queueItemIds);

  if (uniqueQueueItemIds.size !== queueItemIds.length) {
    return "invalid";
  }

  return queueItemIds as readonly QueueItemId[];
}

function queueRefetchUrl(sessionId: SessionId) {
  return `/api/v1/sessions/${sessionId}/queue`;
}

function queueSseStreamUrl(sessionId: SessionId) {
  return `/api/v1/events/stream?sessionId=${encodeURIComponent(sessionId)}`;
}

function activeBatchProjection(
  items: readonly QueueItemProjection[],
  generatedAt: string
): DecisionQueueProjection["activeBatch"] {
  if (!items.length) {
    return undefined;
  }

  const prioritySignals = [
    ...new Set(
      items.map((item) =>
        [
          item.severity ? `severity:${item.severity}` : null,
          item.topicKey ? `topic:${item.topicKey}` : null,
          item.cardType ? `card:${item.cardType}` : null
        ]
          .filter((part): part is string => Boolean(part))
          .join("/")
      )
    )
  ].filter(Boolean);

  return {
    batchId: `active-batch:${items.map((item) => item.queueItemId).join(",")}`,
    queueItemIds: items.map((item) => item.queueItemId),
    selectedAt: generatedAt,
    priorityReason: prioritySignals.length
      ? `severity_ordered_batch(${prioritySignals.join("; ")})`
      : "active_batch_preserved_without_additional_priority_metadata",
    stabilityPolicy: "preserve_active_batch_until_terminal_or_explicit_reactivation"
  };
}

function queueItemIsQuestionDebt(item: QueueItemProjection) {
  return item.cardType === undefined || item.cardType === "question" || item.cardType === "follow_up_question";
}

function countQuestionDebtItems(items: readonly QueueItemProjection[]) {
  return items.filter(queueItemIsQuestionDebt).length;
}

function progressTopicKey(issue: AmbiguityIssueSnapshot) {
  return issue.topicKey ?? issue.sectionRef ?? issue.queueItemId;
}

function progressTopicCount(issues: readonly AmbiguityIssueSnapshot[]) {
  return new Set(issues.map(progressTopicKey)).size;
}

function remainingFollowUpBudget(issue: AmbiguityIssueSnapshot) {
  return Math.max(0, (issue.repeatLimit ?? DEFAULT_FOLLOW_UP_QUESTION_LIMIT) - (issue.repeatCount ?? 0));
}

function queueQuestionProgressFromIssues(
  issues: readonly AmbiguityIssueSnapshot[],
  projection: DecisionQueueProjection
): DecisionQueueProgressProjection {
  const generatedQuestionCount = issues.length;
  const openQuestionCount = issues.filter((issue) => issue.status === "open").length;
  const answeredQuestionCount = issues.filter((issue) => issue.status === "answered").length;
  const deferredQuestionCount = issues.filter((issue) => issue.status === "deferred").length;
  const resolvedQuestionCount = issues.filter((issue) => issue.status === "resolved").length;
  const terminalQuestionCount = answeredQuestionCount + deferredQuestionCount + resolvedQuestionCount;
  const followUpIssues = issues.filter((issue) => (issue.repeatCount ?? 0) > 0);
  const openIssues = issues.filter((issue) => issue.status === "open");
  const activeQuestionCount = countQuestionDebtItems(projection.active);
  const upcomingQuestionCount = countQuestionDebtItems(projection.next);
  const blockedQuestionCount = countQuestionDebtItems(projection.blocked);
  const visibleQuestionDebtCount =
    activeQuestionCount +
    upcomingQuestionCount +
    blockedQuestionCount +
    countQuestionDebtItems(projection.deferred);

  return {
    generatedQuestionCount,
    openQuestionCount,
    answeredQuestionCount,
    deferredQuestionCount,
    resolvedQuestionCount,
    terminalQuestionCount,
    followUpQuestionCount: followUpIssues.length,
    followUpOpenQuestionCount: followUpIssues.filter((issue) => issue.status === "open").length,
    topicCoverageCount: progressTopicCount(issues),
    openTopicCoverageCount: progressTopicCount(openIssues),
    followUpBudgetRemainingCount: openIssues.reduce((total, issue) => total + remainingFollowUpBudget(issue), 0),
    visibleQuestionDebtCount,
    activeQuestionCount,
    upcomingQuestionCount,
    blockedQuestionCount,
    completionPercent: generatedQuestionCount
      ? Math.round((terminalQuestionCount / generatedQuestionCount) * 100)
      : 0
  };
}

function queueProjectionWithQuestionProgress(
  projection: DecisionQueueProjection,
  issues: readonly AmbiguityIssueSnapshot[]
): DecisionQueueProjection {
  return {
    ...projection,
    progress: queueQuestionProgressFromIssues(issues, projection)
  };
}

export function decisionQueueProjectionWithRecovery(
  projection: DecisionQueueProjection,
  sessionId: SessionId,
  generatedAt: string,
  pendingEffectCount = 0,
  staleReason?: string
): DecisionQueueProjection {
  const stale = Boolean(staleReason);
  const refetchUrl = queueRefetchUrl(sessionId);
  const activeBatch = activeBatchProjection(projection.active, generatedAt);

  return {
    kind: projection.kind,
    projectionKind: "DecisionQueueProjection",
    sessionId,
    version: projection.version,
    generatedAt,
    stale,
    refetchUrl,
    ...(projection.projectPurposeMode ? { projectPurposeMode: projection.projectPurposeMode } : {}),
    ...(projection.projectPurposeModeSelectionStatus
      ? { projectPurposeModeSelectionStatus: projection.projectPurposeModeSelectionStatus }
      : {}),
    ...(projection.modeEffectSummary ? { modeEffectSummary: projection.modeEffectSummary } : {}),
    ...(projection.skippedCommercializationAxes
      ? { skippedCommercializationAxes: projection.skippedCommercializationAxes }
      : {}),
    ...(projection.businessCriticIntensity ? { businessCriticIntensity: projection.businessCriticIntensity } : {}),
    ...(projection.businessCriticIntensitySelectionStatus
      ? { businessCriticIntensitySelectionStatus: projection.businessCriticIntensitySelectionStatus }
      : {}),
    ...(projection.businessCriticIntensityLabel
      ? { businessCriticIntensityLabel: projection.businessCriticIntensityLabel }
      : {}),
    ...(projection.businessCriticIntensityEffect
      ? { businessCriticIntensityEffect: projection.businessCriticIntensityEffect }
      : {}),
    ...(projection.businessCriticPressureSummary
      ? { businessCriticPressureSummary: projection.businessCriticPressureSummary }
      : {}),
    ...(activeBatch ? { activeBatch } : {}),
    ...(projection.progress ? { progress: projection.progress } : {}),
    active: projection.active,
    next: projection.next,
    blocked: projection.blocked,
    deferred: projection.deferred,
    recovery: {
      status: stale ? "stale" : pendingEffectCount > 0 ? "pending_refetch" : "fresh",
      refetchUrl,
      sseStreamUrl: queueSseStreamUrl(sessionId),
      sseEventNames: ["projection.updated"],
      pendingEffectCount,
      ...(pendingEffectCount > 0 || stale ? {} : { lastRefetchedAt: generatedAt }),
      ...(staleReason ? { staleReason } : {})
    }
  };
}

function refreshQueueProjectionMetadata(
  projection: DecisionQueueProjection,
  version: ProjectionVersion,
  generatedAt: string
): DecisionQueueProjection {
  if (!projection.sessionId) {
    return {
      ...projection,
      version
    };
  }

  return decisionQueueProjectionWithRecovery(
    {
      ...projection,
      version
    },
    projection.sessionId,
    generatedAt
  );
}

function emptyQueueProjection(
  version: ProjectionVersion = 0 as ProjectionVersion,
  sessionId?: SessionId,
  generatedAt = new Date(0).toISOString()
): DecisionQueueProjection {
  const projection: DecisionQueueProjection = {
    kind: "DecisionQueueProjection",
    version,
    progress: {
      generatedQuestionCount: 0,
      openQuestionCount: 0,
      answeredQuestionCount: 0,
      deferredQuestionCount: 0,
      resolvedQuestionCount: 0,
      terminalQuestionCount: 0,
      followUpQuestionCount: 0,
      followUpOpenQuestionCount: 0,
      topicCoverageCount: 0,
      openTopicCoverageCount: 0,
      followUpBudgetRemainingCount: 0,
      visibleQuestionDebtCount: 0,
      activeQuestionCount: 0,
      upcomingQuestionCount: 0,
      blockedQuestionCount: 0,
      completionPercent: 0
    },
    active: [],
    next: [],
    blocked: [],
    deferred: []
  };

  return sessionId ? decisionQueueProjectionWithRecovery(projection, sessionId, generatedAt) : projection;
}

export function createInitialProductEngineState(projectId: ProjectId, sessionId: SessionId): ProductEngineStateSnapshot {
  return {
    stateVersion: 0 as StateVersion,
    project: {
      projectId,
      privacyMode: "local_only",
      projectPurposeModeSelectionStatus: "mode_required",
      projectPurposeModeLabel: projectPurposeModeLabel(null),
      projectPurposeModeReason: "Project purpose mode must be user-confirmed before mode-specific gates run.",
      projectPurposeModeAudit: [],
      businessCriticIntensitySelectionStatus: "not_applicable",
      businessCriticIntensityAudit: []
    },
    session: {
      sessionId,
      phase: "intake"
    },
    currentSpec: {
      draftRef: ""
    },
    openIssues: [],
    queueProjection: emptyQueueProjection(0 as ProjectionVersion, sessionId),
    researchState: EMPTY_RESEARCH_PROJECTION,
    decisions: [],
    specUpdatePreviews: [],
    runtimeState: EMPTY_RUNTIME_PROJECTION,
    completeness: emptyConfidenceCompletionProjection(sessionId)
  };
}

function createSessionShellProjection(
  command: ProductEngineCommand,
  version: ProjectionVersion,
  mode: ProjectPurposeMode | null | undefined,
  phase: SessionShellProjection["phase"] = "intake",
  intensity?: BusinessCriticIntensity | null,
  initialResearchAutomationPermission?: ResearchAutomationPermission
) {
  return {
    kind: "SessionShellProjection",
    projectId: command.projectId,
    sessionId: command.sessionId,
    version,
    phase,
    ...(mode ? { projectPurposeMode: mode } : {}),
    projectPurposeModeSelectionStatus: projectPurposeModeSelectionStatus(mode),
    projectPurposeModeLabel: projectPurposeModeLabel(mode),
    projectPurposeModeEffect: projectPurposeModeEffect(mode),
    ...businessCriticProjectFields(mode, intensity),
    ...(initialResearchAutomationPermission ? { initialResearchAutomationPermission } : {})
  } as const;
}

function createLivingSpecProjection(
  command: ProductEngineCommand,
  version: ProjectionVersion,
  title: string,
  sections: readonly string[],
  approvalStatus: LivingSpecProjection["approvalStatus"] = "draft"
) {
  return {
    kind: "LivingSpecProjection",
    sessionId: command.sessionId,
    version,
    title,
    sections,
    sectionCount: sections.length,
    approvalStatus
  } as const;
}

type AmbiguityIssueSeed = {
  readonly sectionRef: string;
  readonly topicKey: string;
  readonly purposeModeAxis?: string;
  readonly purposeModeEffect?: string;
  readonly businessCriticCategory?: BusinessCriticalQuestionCategory;
  readonly businessCriticIntensityMinimum?: BusinessCriticIntensity;
  readonly businessCriticPressureKind?: BusinessCriticPressureKind;
  readonly businessCriticRepeatGroup?: string;
  readonly nextValidationAction?: string;
  readonly uncertaintyType: NonNullable<AmbiguityIssueSnapshot["uncertaintyType"]>;
  readonly severity: NonNullable<AmbiguityIssueSnapshot["severity"]>;
  readonly summary: string;
  readonly whyItMatters: string;
  readonly question: string;
  readonly expectedAnswerType: NonNullable<AmbiguityIssueSnapshot["expectedAnswerType"]>;
  readonly answerSelectionMode?: AmbiguityAnswerSelectionMode;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
  readonly decisionItUnlocks: string;
  readonly ambiguityDimension?: NonNullable<AmbiguityIssueSnapshot["ambiguityDimension"]>;
  readonly ambiguityRoutingPath?: NonNullable<AmbiguityIssueSnapshot["ambiguityRoutingPath"]>;
  readonly researchQuestion?: string;
  readonly routes: NonNullable<AmbiguityIssueSnapshot["possibleRoutes"]>;
  readonly suggestedResearchTask?: string;
  readonly sourceRef?: string;
};

function inferredAmbiguityDimensionForSeed(
  seed: AmbiguityIssueSeed
): NonNullable<AmbiguityIssueSnapshot["ambiguityDimension"]> {
  if (seed.ambiguityDimension) {
    return seed.ambiguityDimension;
  }

  const key = `${seed.sectionRef} ${seed.topicKey}`.toLowerCase();

  if (
    seed.businessCriticPressureKind ||
    seed.uncertaintyType === "missing_con_evidence" ||
    seed.routes.includes("missing_con_evidence")
  ) {
    return "assumption_pressure";
  }

  if (/(?:buyer_user|decision|decider|approval|payer|purchase|구매자|결정권|승인)/u.test(key)) {
    return "decision_authority";
  }

  if (/(?:target customer|customer|segment|mvp scope|non-goals|scope|boundary|범위|비목표|고객|세그먼트)/u.test(key)) {
    return "scope";
  }

  if (/(?:success|validation|metric|experiment|retention|criteria|성공|검증|실험|지표)/u.test(key)) {
    return "success_criteria";
  }

  if (/(?:constraint|risk|legal|ops|security|resource|policy|제약|위험|법무|운영|보안|리소스)/u.test(key)) {
    return "constraints";
  }

  if (/(?:problem|goal|value proposition|job|jtbd|문제|목표|가치)/u.test(key)) {
    return "goal";
  }

  return "context";
}

function inferredAmbiguityRoutingPathForSeed(
  seed: AmbiguityIssueSeed
): NonNullable<AmbiguityIssueSnapshot["ambiguityRoutingPath"]> {
  if (seed.ambiguityRoutingPath) {
    return seed.ambiguityRoutingPath;
  }

  if (
    seed.routes.includes("research_needed") ||
    seed.expectedAnswerType === "evidence" ||
    seed.uncertaintyType === "unsupported" ||
    seed.uncertaintyType === "missing_con_evidence"
  ) {
    return "current_research";
  }

  return "human_judgment";
}

interface OnboardingQuestionContext {
  readonly idea?: string;
  readonly goal?: string;
}

const QUESTION_CONTEXT_MAX_CHARS = 72;

function compactOnboardingContextText(value: string | undefined) {
  const compacted = value?.replace(/\s+/gu, " ").trim();

  if (!compacted) {
    return undefined;
  }

  return compacted.length > QUESTION_CONTEXT_MAX_CHARS
    ? `${compacted.slice(0, QUESTION_CONTEXT_MAX_CHARS - 1)}…`
    : compacted;
}

function onboardingQuestionContextFromState(state: ProductEngineStateSnapshot): OnboardingQuestionContext {
  const idea = compactOnboardingContextText(state.project.rawIdeaText);
  const goal = compactOnboardingContextText(state.intake?.answer);

  return {
    ...(idea ? { idea } : {}),
    ...(goal ? { goal } : {})
  };
}

function generatedQuestionSetContextText(context: OnboardingQuestionContext) {
  return [context.idea, context.goal].filter(Boolean).join("\n");
}

function ideaContextLabel(context: OnboardingQuestionContext) {
  return context.idea ? `“${context.idea}”` : "이 아이디어";
}

function goalContextLabel(context: OnboardingQuestionContext) {
  return context.goal ? `“${context.goal}”` : "이번 목표";
}

const BUSINESS_ONBOARDING_QUESTION_TEXT_BY_TOPIC: Readonly<Record<string, (context: OnboardingQuestionContext) => string>> = {
  primary_customer_narrowing: (context) => {
    const profile = primaryCustomerContextProfileForText(generatedQuestionSetContextText(context));

    return profile
      ? `${ideaContextLabel(context)}를 가장 먼저 테스트할 ${profile.questionSubject}은 누구이고, ${profile.personReference}은 지금 어떤 상황에 있나요?`
      : `${ideaContextLabel(context)}를 가장 먼저 써볼 사람은 누구이고, 그 사람은 지금 어떤 상황에 있나요?`;
  },
  buyer_user_split: () =>
    "그 사람이 직접 돈을 내거나 승인할 수 있나요? 아니라면 누가 결정하고 누가 실제로 쓰나요?",
  problem_pain_intensity: () =>
    "그 사람이 겪는 불편은 언제 생기고, 시간·돈·스트레스 중 무엇을 가장 크게 쓰게 하나요?",
  value_prop_switching_reason: (context) =>
    `그 사람이 지금 쓰는 방법을 두고 ${ideaContextLabel(context)}를 선택하게 만들 쉬운 이유 하나는 무엇인가요?`,
  alternative_dissatisfaction_gap: () =>
    "지금은 어떤 방법으로 버티고 있고, 그 방법이 괜찮을 때와 답답할 때는 각각 언제인가요?",
  mvp_validation_scope: (context) =>
    `${goalContextLabel(context)}에 가장 도움이 되는 첫 버전 기능 하나와 이번에 만들지 않을 기능 하나는 무엇인가요?`,
  first_validation_experiment: () =>
    "제품을 만들기 전에 “이게 필요하다”는 실제 반응을 어떻게 작게 확인할 수 있나요?"
};

const PERSONAL_ONBOARDING_QUESTION_TEXT_BY_TOPIC: Readonly<Record<string, (context: OnboardingQuestionContext) => string>> = {
  personal_workflow_context: (context) =>
    `${ideaContextLabel(context)}를 쓰기 바로 전과 후에 사용자는 실제로 어떤 일을 하나요?`,
  personal_usage_frequency: () =>
    "그 일이 얼마나 자주 반복되고, 매번 무엇이 가장 귀찮거나 오래 걸리나요?",
  personal_gui_fit: () =>
    "첫 버전에서 꼭 화면으로 보고 눌러야 하는 순간은 어디인가요?",
  personal_implementation_feasibility: (context) =>
    `${goalContextLabel(context)}에 맞춰 가장 작게 만든다면 어떤 입력을 받아 어떤 결과 하나만 내면 충분한가요?`,
  personal_local_data_security: () =>
    "어떤 파일, 계정, 개인정보, 비밀값은 읽거나 저장하면 안 되나요?",
  personal_maintainability_boundary: () =>
    "이번 버전에서 일부러 만들지 않을 기능과 나중에도 관리하고 싶지 않은 일은 무엇인가요?",
  personal_success_criteria: (context) =>
    `${goalContextLabel(context)}에 비춰, 첫 버전이 성공했다고 느낄 쉬운 기준은 무엇인가요?`
};

function contextualOnboardingQuestionText(seed: AmbiguityIssueSeed, context: OnboardingQuestionContext) {
  const topicQuestion =
    BUSINESS_ONBOARDING_QUESTION_TEXT_BY_TOPIC[seed.topicKey] ??
    PERSONAL_ONBOARDING_QUESTION_TEXT_BY_TOPIC[seed.topicKey];

  return topicQuestion ? topicQuestion(context) : undefined;
}

function contextualQuestionText(seed: AmbiguityIssueSeed, context: OnboardingQuestionContext) {
  const onboardingQuestion = contextualOnboardingQuestionText(seed, context);

  if (onboardingQuestion) {
    return onboardingQuestion;
  }

  const question = plainUserFacingDecisionQueueText(seed.question);

  if (context.idea && context.goal) {
    return `아이디어 “${context.idea}”와 목표 “${context.goal}”에 맞춰, ${question}`;
  }

  if (context.idea) {
    return `아이디어 “${context.idea}”에 맞춰, ${question}`;
  }

  if (context.goal) {
    return `목표 “${context.goal}”에 맞춰, ${question}`;
  }

  return question;
}

function contextualSuggestedResearchTask(seed: AmbiguityIssueSeed, context: OnboardingQuestionContext) {
  if (!seed.suggestedResearchTask) {
    return undefined;
  }

  const task = plainUserFacingDecisionQueueText(seed.suggestedResearchTask);
  const contextText = generatedQuestionSetContextText(context);

  if (seed.ambiguityRoutingPath === "current_research" || inferredAmbiguityRoutingPathForSeed(seed) === "current_research") {
    return contextualSourceSeekingResearchText({
      seed,
      context,
      target: task,
      contextText
    });
  }

  if (context.idea && context.goal) {
    return `아이디어 “${context.idea}”와 목표 “${context.goal}” 기준으로 ${task}`;
  }

  if (context.idea) {
    return `아이디어 “${context.idea}” 기준으로 ${task}`;
  }

  if (context.goal) {
    return `목표 “${context.goal}” 기준으로 ${task}`;
  }

  return task;
}

const PET_LIFECYCLE_RESEARCH_CONTEXT_PATTERN =
  /(?:반려\s*동물|반려견|반려묘|펫\b|pet\b|companion\s+animal|동물병원|수의|진료\s*기록|투약|의료비|급여|사료|보험|장례|말기\s*케어|전생애|생애\s*주기)/iu;
const HEALTHCARE_RESEARCH_CONTEXT_PATTERN =
  /(?:건강|헬스케어|의료|병원|환자|진료|복약|약\s*관리|만성\s*질환|혈당|혈압|검진|caregiver|health\s*care|healthcare|medical|patient|clinic)/iu;
const EDUCATION_RESEARCH_CONTEXT_PATTERN =
  /(?:교육|학습|공부|시험|수업|과외|학생|학부모|강의|러닝|러너|edtech|learning|study|student|tutor|course|classroom)/iu;
const FINANCE_RESEARCH_CONTEXT_PATTERN =
  /(?:가계부|예산|지출|소비|저축|보험|대출|투자|자산|월급|생활비|카드값|현금흐름|finance|budget|expense|saving|investment|loan|insurance)/iu;

function researchSourceAreaForContext(contextText: string) {
  if (PET_LIFECYCLE_RESEARCH_CONTEXT_PATTERN.test(contextText)) {
    return "동물병원 안내·후기, 펫보험 청구 가이드, 보호자 커뮤니티·리뷰, 장례·말기 케어 서비스 자료";
  }

  if (HEALTHCARE_RESEARCH_CONTEXT_PATTERN.test(contextText)) {
    return "진료·복약 안내, 환자/보호자 커뮤니티, 보험·비용 자료, 기존 건강관리 앱 리뷰";
  }

  if (EDUCATION_RESEARCH_CONTEXT_PATTERN.test(contextText)) {
    return "학습자/학부모 커뮤니티, 교육 서비스 리뷰, 시험·강의 자료, 기존 학습관리 도구 비교";
  }

  if (FINANCE_RESEARCH_CONTEXT_PATTERN.test(contextText)) {
    return "금융 서비스 도움말·가격/수수료 자료, 사용자 리뷰, 규제/보안 안내, 대체 가계부·자산관리 앱 비교";
  }

  return "공개 사용자 후기, 커뮤니티 글, 경쟁·대체재 페이지, 가격/정책 자료, 관련 리포트";
}

function weakeningCueForSeed(seed: AmbiguityIssueSeed) {
  switch (seed.topicKey) {
    case "primary_customer_narrowing":
      return "선택한 고객 후보보다 더 급한 후보가 있거나 해당 후보가 문제를 자주 겪지 않는 사례";
    case "buyer_user_split":
      return "돈을 내는 사람과 실제 사용자가 분리되어 인터뷰·가격·메시지가 달라지는 사례";
    case "problem_pain_intensity":
      return "문제가 드물거나 기존 방식으로 충분히 해결되어 시간·돈·스트레스 부담이 약한 사례";
    case "value_prop_switching_reason":
      return "현재 대체재를 계속 쓰는 편이 더 쉽거나 전환 비용이 큰 사례";
    case "alternative_dissatisfaction_gap":
      return "기존 대체재가 충분히 좋아서 새 제품 전환 이유가 약해지는 사례";
    case "mvp_validation_scope":
      return "첫 기능이 너무 넓거나 좁아 실제 검증 행동을 만들지 못하는 사례";
    case "first_validation_experiment":
      return "제품 없이 하는 실험이 실제 구매·반복 사용 신호를 만들지 못하는 사례";
    case "success_metric_measurability":
      return "성공 기준이 관찰 불가능하거나 좋은 반응처럼 보여도 행동 변화가 없는 사례";
    case "evidence_balance":
      return "핵심 주장을 반박하거나 아직 과신하면 안 된다는 다른 관점의 사례";
    case "acquisition_channel_realism":
      return "초기 채널 접근이 막히거나 응답률·비용 때문에 검증이 실패하는 사례";
    case "implementation_resource_fit":
      return "현재 시간·기술·운영 리소스로 첫 구현 범위가 감당되지 않는 사례";
    case "founder_advantage":
      return "창업자/팀의 유리함이 약하거나 경쟁자가 더 쉽게 풀 수 있는 사례";
    default:
      return "현재 가정을 약하게 만들거나 다른 범위·고객·검증 방식을 요구하는 반례";
  }
}

function residualJudgmentCueForSeed(seed: AmbiguityIssueSeed) {
  switch (inferredAmbiguityDimensionForSeed(seed)) {
    case "goal":
      return "최종 목표와 포기할 가치 판단";
    case "scope":
      return "이번 버전에 포함할 범위와 제외할 범위";
    case "constraints":
      return "시간·비용·정책·보안 제약 중 반드시 지킬 조건";
    case "success_criteria":
      return "완료를 판정할 관찰 가능한 성공 기준";
    case "decision_authority":
      return "사용자·구매자·승인자 중 누가 결정해야 하는지";
    case "assumption_pressure":
      return "가정이 틀렸을 때 보류하거나 방향을 바꿀 기준";
    case "context":
      return "기존 맥락에서 보존할 사실과 아직 추정인 부분";
  }
}

function contextualResearchPrefix(context: OnboardingQuestionContext) {
  if (context.idea && context.goal) {
    return `아이디어 “${context.idea}”와 목표 “${context.goal}” 기준으로`;
  }

  if (context.idea) {
    return `아이디어 “${context.idea}” 기준으로`;
  }

  if (context.goal) {
    return `목표 “${context.goal}” 기준으로`;
  }

  return "현재 아이디어 기준으로";
}

function contextualSourceSeekingResearchText(input: {
  readonly seed: AmbiguityIssueSeed;
  readonly context: OnboardingQuestionContext;
  readonly target: string;
  readonly contextText: string;
}) {
  return [
    `${contextualResearchPrefix(input.context)} ${researchSourceAreaForContext(input.contextText)}에서 ${input.target}에 관한 공개 단서를 찾습니다.`,
    `${weakeningCueForSeed(input.seed)}도 함께 확인합니다.`,
    `확인 가능한 사실과 사용자가 정해야 할 ${residualJudgmentCueForSeed(input.seed)}은 분리해서 남깁니다.`
  ].join(" ");
}

function contextualResearchQuestionForSeed(
  seed: AmbiguityIssueSeed,
  context: OnboardingQuestionContext,
  source: AmbiguityIssueSeedSource
) {
  if (seed.researchQuestion) {
    return source === "generated_json"
      ? plainUserFacingDecisionQueueText(seed.researchQuestion)
      : contextualSourceSeekingResearchText({
          seed,
          context,
          target: plainUserFacingDecisionQueueText(seed.researchQuestion),
          contextText: generatedQuestionSetContextText(context)
        });
  }

  if (source === "generated_json" || inferredAmbiguityRoutingPathForSeed(seed) !== "current_research") {
    return undefined;
  }

  const target = plainUserFacingDecisionQueueText(seed.suggestedResearchTask ?? seed.summary);

  return contextualSourceSeekingResearchText({
    seed,
    context,
    target,
    contextText: generatedQuestionSetContextText(context)
  });
}

const BUSINESS_AMBIGUITY_ISSUE_SEEDS: readonly AmbiguityIssueSeed[] = [
  {
    sectionRef: "Target Customer",
    topicKey: "primary_customer_narrowing",
    uncertaintyType: "vague",
    severity: "high",
    summary: "첫 고객 세그먼트가 너무 넓음",
    whyItMatters: "첫 고객이 좁혀지지 않으면 문제 강도, 채널, MVP scope 판단이 모두 흔들립니다.",
    question: "가장 먼저 검증할 primary customer는 어떤 상황의 누구인가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "primary_customer decision과 Target Customer section의 검증 채널을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Target Customer",
    topicKey: "buyer_user_split",
    uncertaintyType: "missing",
    severity: "high",
    summary: "구매자와 실제 사용자가 같은지 확인되지 않음",
    whyItMatters: "구매자와 사용자가 다르면 가격, 인터뷰 대상, 채널, 메시지가 모두 달라집니다.",
    question: "돈을 내는 사람과 실제 사용하는 사람은 같은가, 다르다면 각각 누구인가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "buyer/user split과 Target Customer section의 interview target을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Problem",
    topicKey: "problem_pain_intensity",
    uncertaintyType: "missing",
    severity: "high",
    summary: "문제 빈도와 강도가 아직 측정되지 않음",
    whyItMatters: "문제가 드물거나 약하면 value proposition과 validation plan이 재작성됩니다.",
    question: "이 문제가 얼마나 자주, 얼마나 큰 비용으로 발생하는가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "problem decision과 Success Criteria의 pain threshold를 잠급니다.",
    routes: ["question", "research_needed"]
  },
  {
    sectionRef: "Value Proposition",
    topicKey: "value_prop_switching_reason",
    uncertaintyType: "decision_required",
    severity: "high",
    summary: "대체재 대비 전환 이유가 결정되지 않음",
    whyItMatters: "전환 이유가 없으면 MVP 기능과 메시지가 경쟁 대체재를 이길 수 없습니다.",
    question: "사용자가 현재 대체재를 버리고 이 제품으로 전환할 이유는 무엇인가?",
    expectedAnswerType: "rank",
    decisionItUnlocks: "value decision과 Differentiation section의 핵심 claim을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Current Alternatives",
    topicKey: "alternative_dissatisfaction_gap",
    uncertaintyType: "missing_con_evidence",
    severity: "medium",
    summary: "현재 대체재와 불만족 지점이 균형 있게 검증되지 않음",
    whyItMatters: "대체재 만족/불만족 근거 없이 차별화를 확정하면 Founder Brief 신뢰도가 낮아집니다.",
    question: "현재 대체재는 무엇이고, 충분히 좋은 상황과 불만족이 생기는 상황은 각각 언제인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "alternatives claim의 pro/con evidence gate와 differentiation 판단을 엽니다.",
    routes: ["research_needed", "missing_con_evidence"],
    suggestedResearchTask: "대체재 만족/불만족 근거를 균형 있게 수집합니다."
  },
  {
    sectionRef: "MVP Scope",
    topicKey: "mvp_validation_scope",
    uncertaintyType: "decision_required",
    severity: "high",
    summary: "MVP에 반드시 포함할 기능과 제외할 기능이 불명확함",
    whyItMatters: "MVP scope가 흐리면 Build Slice가 커지고 Planning Handoff가 blocker 상태로 남습니다.",
    question: "첫 Build Slice에서 반드시 검증해야 할 기능과 제외할 기능은 무엇인가?",
    expectedAnswerType: "choice",
    answerSelectionMode: "multiple",
    decisionItUnlocks: "mvp_scope decision과 Build Slice readiness를 잠급니다.",
    routes: ["question", "decision_candidate", "deferred"]
  },
  {
    sectionRef: "Validation Plan",
    topicKey: "first_validation_experiment",
    uncertaintyType: "missing",
    severity: "high",
    summary: "제품 없이 가능한 첫 검증 실험이 정의되지 않음",
    whyItMatters: "실험이 없으면 evidence loop가 시작되지 않아 SpecVersion 승인 근거가 부족합니다.",
    question: "제품 구현 전에 수행할 수 있는 첫 검증 실험은 무엇인가?",
    expectedAnswerType: "experiment",
    decisionItUnlocks: "validation_plan decision과 Research/Evidence task 생성을 엽니다.",
    routes: ["question", "research_needed"]
  },
  {
    sectionRef: "Success Criteria",
    topicKey: "success_metric_measurability",
    uncertaintyType: "vague",
    severity: "high",
    summary: "성공/실패 기준이 측정 가능하지 않음",
    whyItMatters: "측정 기준이 없으면 completeness score와 pivot trigger를 신뢰할 수 없습니다.",
    question: "첫 실험의 성공과 실패를 어떤 수치 또는 관찰 신호로 판단할 것인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "success_criteria decision과 completion gate 판단을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Evidence Status",
    topicKey: "evidence_balance",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "핵심 claim의 리서치 단서와 반례 균형이 부족함",
    whyItMatters: "한쪽 단서만 있으면 중요한 claim을 완료 상태로 승격할 수 없습니다.",
    question: "핵심 claim을 뒷받침하는 단서와 흔들 수 있는 반례는 무엇이며 어느 쪽이 비어 있는가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Evidence Matrix와 반례 확인 route를 결정합니다.",
    routes: ["research_needed", "missing_con_evidence"],
    suggestedResearchTask: "핵심 claim별 지지 단서와 반례 coverage를 점검합니다."
  },
  {
    sectionRef: "Non-goals",
    topicKey: "non_goal_boundaries",
    uncertaintyType: "decision_required",
    severity: "medium",
    summary: "이번 MVP에서 하지 않을 범위가 충분히 잠기지 않음",
    whyItMatters: "non-goal이 명시되지 않으면 scope creep과 downstream rework가 생깁니다.",
    question: "이번 MVP에서 의도적으로 제외해야 하는 범위는 무엇인가?",
    expectedAnswerType: "choice",
    answerSelectionMode: "multiple",
    decisionItUnlocks: "Non-goals section과 Planning Handoff blocker 여부를 잠급니다.",
    routes: ["question", "deferred", "decision_candidate"]
  },
  {
    sectionRef: "Validation Plan",
    topicKey: "acquisition_channel_realism",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "첫 사용자 모집 채널의 현실성이 근거로 확인되지 않음",
    whyItMatters: "획득 채널이 막히면 제품 없이 하는 검증 실험과 초기 adoption evidence가 진행되지 않습니다.",
    question: "첫 검증 참여자를 어디서 어떻게 모집할 수 있으며, 그 채널은 현실적인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Validation Plan의 first channel과 acquisition risk 판단을 엽니다.",
    routes: ["research_needed", "spec_update_candidate"],
    suggestedResearchTask: "초기 사용자 모집 채널의 접근 가능성과 비용/응답률 근거를 확인합니다."
  },
  {
    sectionRef: "MVP Scope",
    topicKey: "implementation_resource_fit",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "구현 난이도와 창업자 리소스의 적합성이 검증되지 않음",
    whyItMatters: "리소스 대비 어려운 MVP는 Planning Handoff 이후에도 실행 불가능한 Build Slice가 됩니다.",
    question: "현재 리소스로 첫 Build Slice를 구현할 수 있는가, 줄여야 할 scope는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "MVP Scope와 Planning Handoff의 implementation fit blocker를 판단합니다.",
    routes: ["question", "deferred", "spec_update_candidate"]
  },
  {
    sectionRef: "Differentiation",
    topicKey: "founder_advantage",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "창업자만의 유리함이나 방어 가능성이 근거로 연결되지 않음",
    whyItMatters: "차별화 근거가 약하면 Founder Brief와 acquisition story가 설득력을 잃습니다.",
    question: "이 founder/team이 이 문제를 더 잘 풀 수 있는 근거는 무엇인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Differentiation section과 Founder Brief의 핵심 narrative를 엽니다.",
    routes: ["research_needed", "spec_update_candidate"]
  },
  {
    sectionRef: "JTBD / Use Case",
    topicKey: "job_context_specificity",
    uncertaintyType: "vague",
    severity: "medium",
    summary: "사용 맥락과 전후 행동 변화가 충분히 구체적이지 않음",
    whyItMatters: "use case가 흐리면 질문, 리서치, UI slice가 서로 다른 상황을 겨냥합니다.",
    question: "사용자가 어떤 상황에서 어떤 진전을 얻기 위해 이 제품을 쓰는가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "JTBD section과 첫 UX journey 가설을 잠급니다.",
    routes: ["question", "spec_update_candidate"]
  },
  {
    sectionRef: "Known Risks / Open Questions",
    topicKey: "operational_risk_boundary",
    uncertaintyType: "missing",
    severity: "low",
    summary: "보안/법률/운영 리스크와 보류 이유가 정리되지 않음",
    whyItMatters: "남은 리스크가 보이지 않으면 완료 선언과 Planning Handoff가 과신 상태가 됩니다.",
    question: "현 단계에서 명시적으로 남겨야 할 보안, 법률, 운영 리스크는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "Known Risks section과 residual risk register를 갱신합니다.",
    routes: ["question", "deferred", "repeat_limit_reached"]
  }
] satisfies readonly AmbiguityIssueSeed[];

const BUSINESS_CRITIC_CATEGORY_BY_TOPIC_KEY: Readonly<Record<string, BusinessCriticalQuestionCategory>> = {
  primary_customer_narrowing: "customer_pain",
  buyer_user_split: "paid_intent",
  problem_pain_intensity: "customer_pain",
  value_prop_switching_reason: "alternatives",
  alternative_dissatisfaction_gap: "alternatives",
  mvp_validation_scope: "mvp_validation",
  first_validation_experiment: "mvp_validation",
  success_metric_measurability: "mvp_validation",
  evidence_balance: "paid_intent",
  non_goal_boundaries: "legal_ops_security",
  acquisition_channel_realism: "acquisition",
  implementation_resource_fit: "legal_ops_security",
  founder_advantage: "founder_advantage",
  job_context_specificity: "customer_pain",
  operational_risk_boundary: "legal_ops_security"
} as const satisfies Record<string, BusinessCriticalQuestionCategory>;

const STRONG_BUSINESS_CRITIC_SEEDS: readonly AmbiguityIssueSeed[] = [
  {
    sectionRef: "Value Proposition",
    topicKey: "strong_paid_intent_core_assumption",
    businessCriticCategory: "paid_intent",
    businessCriticIntensityMinimum: "strong",
    businessCriticPressureKind: "core_assumption_challenge",
    businessCriticRepeatGroup: "paid_intent_core_assumption",
    nextValidationAction: "Run a willingness-to-pay test or explicitly carry this as a Known Risk.",
    uncertaintyType: "missing_con_evidence",
    severity: "high",
    summary: "유료 의향 핵심 가설이 반박 질문 없이 남아 있음",
    whyItMatters: "사업화 모드의 high-impact gap은 지불 의향이 틀렸을 때 계획 전체가 무너질 수 있습니다.",
    question: "사용자가 돈을 내지 않을 가장 강한 이유는 무엇이며, 이번 주에 어떻게 검증할 것인가?",
    expectedAnswerType: "experiment",
    decisionItUnlocks: "paid intent core-assumption risk를 Known Risk 또는 validation action으로 닫습니다.",
    routes: ["question", "missing_con_evidence", "deferred", "repeat_limit_reached"],
    suggestedResearchTask: "유료 의향 반대근거와 willingness-to-pay proxy를 확인합니다."
  },
  {
    sectionRef: "Validation Plan",
    topicKey: "strong_channel_core_assumption",
    businessCriticCategory: "acquisition",
    businessCriticIntensityMinimum: "strong",
    businessCriticPressureKind: "core_assumption_challenge",
    businessCriticRepeatGroup: "acquisition_core_assumption",
    nextValidationAction: "Identify one reachable channel and one fallback if it fails.",
    uncertaintyType: "unsupported",
    severity: "high",
    summary: "초기 획득 채널 핵심 가설이 반박되지 않음",
    whyItMatters: "첫 사용자에게 도달하지 못하면 MVP validation이 실행되지 않습니다.",
    question: "첫 사용자 모집 채널이 실패한다면 가장 가능성 높은 원인은 무엇인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "acquisition core-assumption risk와 validation plan fallback을 잠급니다.",
    routes: ["question", "research_needed", "deferred", "repeat_limit_reached"],
    suggestedResearchTask: "초기 획득 채널의 접근 가능성과 실패 패턴을 확인합니다."
  }
] satisfies readonly AmbiguityIssueSeed[];

const INVESTOR_GRADE_BUSINESS_CRITIC_SEEDS: readonly AmbiguityIssueSeed[] = [
  {
    sectionRef: "Value Proposition",
    topicKey: "investor_pricing_pressure",
    businessCriticCategory: "pricing",
    businessCriticIntensityMinimum: "investor_grade",
    businessCriticPressureKind: "investor_pressure_pass",
    businessCriticRepeatGroup: "pricing_pressure",
    nextValidationAction: "Define a price proxy test or carry pricing as a Known Risk with owner/date.",
    uncertaintyType: "missing_con_evidence",
    severity: "high",
    summary: "가격 검증 pressure item이 닫히지 않음",
    whyItMatters: "가격 저항을 모르면 매출 가능성과 target segment가 검증되지 않습니다.",
    question: "어떤 가격에서 누가 거절할 것이며, 그 거절 신호를 어떻게 수집할 것인가?",
    expectedAnswerType: "experiment",
    decisionItUnlocks: "pricing pressure pass를 evidence 또는 Known Risk + Next Validation Action으로 닫습니다.",
    routes: ["question", "missing_con_evidence", "deferred", "repeat_limit_reached"],
    suggestedResearchTask: "pricing proxy와 경쟁 대체재 가격 근거를 수집합니다."
  },
  {
    sectionRef: "Validation Plan",
    topicKey: "investor_retention_proxy_pressure",
    businessCriticCategory: "retention_proxy",
    businessCriticIntensityMinimum: "investor_grade",
    businessCriticPressureKind: "investor_pressure_pass",
    businessCriticRepeatGroup: "retention_proxy_pressure",
    nextValidationAction: "Define the smallest retention proxy before claiming repeat value.",
    uncertaintyType: "missing",
    severity: "high",
    summary: "retention proxy pressure item이 정의되지 않음",
    whyItMatters: "반복 사용 신호가 없으면 초기 관심이 지속 가치로 이어지는지 알 수 없습니다.",
    question: "첫 버전에서 반복 가치가 있음을 보여줄 retention proxy는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "retention proxy pressure pass를 success criteria에 연결합니다.",
    routes: ["question", "deferred", "repeat_limit_reached"]
  },
  {
    sectionRef: "Known Risks / Open Questions",
    topicKey: "investor_market_timing_pressure",
    businessCriticCategory: "market_timing",
    businessCriticIntensityMinimum: "investor_grade",
    businessCriticPressureKind: "investor_pressure_pass",
    businessCriticRepeatGroup: "market_timing_pressure",
    nextValidationAction: "Capture the market timing evidence or explicitly defer it as a Known Risk.",
    uncertaintyType: "unsupported",
    severity: "high",
    summary: "시장 타이밍 pressure item이 근거 없이 남아 있음",
    whyItMatters: "왜 지금인지 설명하지 못하면 Founder Brief의 urgency narrative가 약해집니다.",
    question: "왜 지금 이 문제가 더 급해졌고, 그 신호가 사라지면 어떤 검증이 실패하는가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "market timing pressure pass를 evidence 또는 Known Risk로 닫습니다.",
    routes: ["question", "research_needed", "deferred", "repeat_limit_reached"],
    suggestedResearchTask: "market timing 근거와 반대근거를 수집합니다."
  },
  {
    sectionRef: "Known Risks / Open Questions",
    topicKey: "investor_legal_ops_pressure",
    businessCriticCategory: "legal_ops_security",
    businessCriticIntensityMinimum: "investor_grade",
    businessCriticPressureKind: "investor_pressure_pass",
    businessCriticRepeatGroup: "legal_ops_pressure",
    nextValidationAction: "Name the legal/ops/security assumption and the next owner/date validation.",
    uncertaintyType: "missing",
    severity: "high",
    summary: "법무/운영/security pressure item이 명시되지 않음",
    whyItMatters: "법무·운영·보안 리스크가 숨겨지면 초기 판매/배포 가능성이 과신됩니다.",
    question: "가장 먼저 판매 또는 운영을 막을 법무/운영/security 리스크는 무엇이며, 다음 검증 행동은 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "legal/ops/security pressure pass를 Known Risk 또는 validation action으로 닫습니다.",
    routes: ["question", "deferred", "repeat_limit_reached"]
  },
  {
    sectionRef: "Differentiation",
    topicKey: "investor_founder_advantage_pressure",
    businessCriticCategory: "founder_advantage",
    businessCriticIntensityMinimum: "investor_grade",
    businessCriticPressureKind: "investor_pressure_pass",
    businessCriticRepeatGroup: "founder_advantage_pressure",
    nextValidationAction: "Validate the founder advantage or carry it as an explicit narrative risk.",
    uncertaintyType: "unsupported",
    severity: "high",
    summary: "founder advantage pressure item이 근거 없이 남아 있음",
    whyItMatters: "창업자 우위가 약하면 투자심사급 narrative에서 방어 가능성이 낮아집니다.",
    question: "왜 이 founder/team이 지금 이 문제를 더 잘 풀 수 있으며, 그 주장을 반박할 근거는 무엇인가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "founder advantage pressure pass를 evidence 또는 Known Risk로 닫습니다.",
    routes: ["question", "research_needed", "deferred", "repeat_limit_reached"],
    suggestedResearchTask: "founder advantage 주장과 반대근거를 수집합니다."
  }
] satisfies readonly AmbiguityIssueSeed[];

const PERSONAL_AMBIGUITY_ISSUE_SEEDS: readonly AmbiguityIssueSeed[] = [
  {
    sectionRef: "JTBD / Use Case",
    topicKey: "personal_workflow_context",
    purposeModeAxis: "workflow",
    purposeModeEffect: "개인 workflow 구현 중심에서는 실제 사용 흐름을 먼저 잠급니다.",
    uncertaintyType: "vague",
    severity: "high",
    summary: "개인이 반복해서 겪는 workflow가 충분히 구체적이지 않음",
    whyItMatters: "workflow가 흐리면 GUI, 데이터 입력, 자동화 범위가 서로 다른 문제를 겨냥합니다.",
    question: "이 도구를 쓰는 실제 개인 workflow는 어떤 순서로 진행되는가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "personal workflow와 첫 UX journey 가설을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "JTBD / Use Case",
    topicKey: "personal_usage_frequency",
    purposeModeAxis: "frequency",
    purposeModeEffect: "시장 규모 대신 사용 빈도와 반복 비용을 검증합니다.",
    uncertaintyType: "missing",
    severity: "high",
    summary: "개인 사용 빈도와 반복 비용이 정의되지 않음",
    whyItMatters: "자주 쓰지 않는 도구라면 자동화와 GUI 구현 범위를 줄여야 합니다.",
    question: "이 workflow는 얼마나 자주 발생하고, 매번 어떤 시간이 낭비되는가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "success_criteria decision과 개인 효용 기준을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "MVP Scope",
    topicKey: "personal_gui_fit",
    purposeModeAxis: "gui",
    purposeModeEffect: "개인 모드는 판매 narrative보다 직접 조작 가능한 GUI 필요성을 우선합니다.",
    uncertaintyType: "decision_required",
    severity: "high",
    summary: "GUI가 꼭 필요한지, CLI/문서/자동화로 충분한지 결정되지 않음",
    whyItMatters: "GUI 필요성이 잠기지 않으면 구현 slice가 과도하게 커집니다.",
    question: "첫 버전은 GUI가 필요한가, 아니면 CLI/문서/간단한 로컬 화면으로 충분한가?",
    expectedAnswerType: "choice",
    decisionItUnlocks: "mvp_scope decision과 UI/non-UI 구현 경계를 잠급니다.",
    routes: ["question", "decision_candidate", "deferred"]
  },
  {
    sectionRef: "MVP Scope",
    topicKey: "personal_implementation_feasibility",
    purposeModeAxis: "implementation",
    purposeModeEffect: "개인 모드는 구현 가능성과 유지 가능한 slice 크기를 completion 핵심 축으로 둡니다.",
    uncertaintyType: "unsupported",
    severity: "high",
    summary: "현재 리소스로 구현 가능한 첫 slice가 확인되지 않음",
    whyItMatters: "개인용 도구라도 첫 slice가 너무 크면 완성되지 못하고 유지보수 부채가 됩니다.",
    question: "현재 시간과 기술 스택으로 가장 작게 구현 가능한 첫 slice는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "implementation fit과 Build Slice readiness를 판단합니다.",
    routes: ["question", "spec_update_candidate"]
  },
  {
    sectionRef: "Known Risks / Open Questions",
    topicKey: "personal_local_data_security",
    purposeModeAxis: "local_data_security",
    purposeModeEffect: "개인 모드는 외부 시장 검증 대신 로컬 데이터와 보안 경계를 먼저 확인합니다.",
    uncertaintyType: "missing",
    severity: "high",
    summary: "로컬 데이터, 파일, 계정, secret 경계가 정리되지 않음",
    whyItMatters: "개인용 도구도 local data/security 경계를 놓치면 사용자가 실제로 쓰기 어렵습니다.",
    question: "이 도구가 읽거나 보관할 local data, 계정, secret, 파일 경계는 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "local data/security risk와 non-goal 경계를 잠급니다.",
    routes: ["question", "deferred", "decision_candidate"]
  },
  {
    sectionRef: "Non-goals",
    topicKey: "personal_maintainability_boundary",
    purposeModeAxis: "maintainability",
    purposeModeEffect: "개인 모드는 장기 운영 가능성과 유지보수 비용을 명시합니다.",
    uncertaintyType: "decision_required",
    severity: "medium",
    summary: "나중에 유지보수하지 않을 범위가 잠기지 않음",
    whyItMatters: "개인용 도구는 편해지려다 관리 부담이 더 커질 수 있습니다.",
    question: "이번 개인용 도구에서 의도적으로 만들지 않을 기능과 유지보수 한계는 무엇인가?",
    expectedAnswerType: "choice",
    answerSelectionMode: "multiple",
    decisionItUnlocks: "Non-goals section과 maintainability residual risk를 잠급니다.",
    routes: ["question", "deferred", "decision_candidate"]
  },
  {
    sectionRef: "Success Criteria",
    topicKey: "personal_success_criteria",
    purposeModeAxis: "personal_success",
    purposeModeEffect: "개인 모드는 유료화가 아니라 개인 성공 기준으로 completion을 판단합니다.",
    uncertaintyType: "vague",
    severity: "high",
    summary: "개인 성공 기준이 측정 가능하지 않음",
    whyItMatters: "성공 기준이 없으면 구현을 멈출 지점과 다음 개선 기준이 모호합니다.",
    question: "첫 버전이 성공했다고 판단할 개인 기준은 무엇인가?",
    expectedAnswerType: "text",
    decisionItUnlocks: "success_criteria decision과 completion gate 판단을 잠급니다.",
    routes: ["question", "decision_candidate"]
  },
  {
    sectionRef: "Evidence Status",
    topicKey: "personal_manual_baseline",
    purposeModeAxis: "workflow_baseline",
    purposeModeEffect: "개인 모드는 경쟁사 비교 대신 현재 수동 baseline과 개선 폭을 확인합니다.",
    uncertaintyType: "unsupported",
    severity: "medium",
    summary: "현재 수동 방식과 개선 폭이 근거로 연결되지 않음",
    whyItMatters: "수동 baseline이 없으면 자동화가 실제로 시간을 줄이는지 판단할 수 없습니다.",
    question: "현재 수동 방식은 무엇이고, 첫 버전은 어떤 단계를 얼마나 줄여야 하는가?",
    expectedAnswerType: "evidence",
    decisionItUnlocks: "Evidence Matrix와 personal success criteria를 연결합니다.",
    routes: ["question", "research_needed"],
    suggestedResearchTask: "현재 수동 workflow baseline과 자동화 후 개선 폭을 비교합니다."
  }
] satisfies readonly AmbiguityIssueSeed[];

function ambiguityIssueSeedsForMode(mode: ProjectPurposeMode, intensity?: BusinessCriticIntensity | null) {
  if (mode === "personal") {
    return PERSONAL_AMBIGUITY_ISSUE_SEEDS;
  }

  const pressureSeeds =
    intensity === "investor_grade"
      ? [...STRONG_BUSINESS_CRITIC_SEEDS, ...INVESTOR_GRADE_BUSINESS_CRITIC_SEEDS]
      : intensity === "strong"
        ? STRONG_BUSINESS_CRITIC_SEEDS
        : [];

  return [...BUSINESS_AMBIGUITY_ISSUE_SEEDS, ...pressureSeeds];
}

function queueProjectionPurposeMetadata(mode: ProjectPurposeMode, intensity?: BusinessCriticIntensity | null) {
  const skippedAxes = skippedCommercializationAxes(mode);
  const criticFields = businessCriticProjectFields(mode, intensity);

  return {
    projectPurposeMode: mode,
    projectPurposeModeSelectionStatus: "confirmed" as const,
    modeEffectSummary: projectPurposeModeEffect(mode),
    ...(skippedAxes.length ? { skippedCommercializationAxes: skippedAxes } : {}),
    ...criticFields,
    ...(mode === "business" && intensity ? { businessCriticPressureSummary: BUSINESS_CRITIC_PRESSURE_SUMMARY[intensity] } : {})
  };
}

function categoryForBusinessSeed(seed: AmbiguityIssueSeed): BusinessCriticalQuestionCategory | undefined {
  return seed.businessCriticCategory ?? BUSINESS_CRITIC_CATEGORY_BY_TOPIC_KEY[seed.topicKey];
}

type AmbiguityIssueSeedSource = "deterministic" | "generated_json";

function questionTextForSeed(
  seed: AmbiguityIssueSeed,
  context: OnboardingQuestionContext,
  source: AmbiguityIssueSeedSource
) {
  return source === "generated_json" ? plainUserFacingDecisionQueueText(seed.question) : contextualQuestionText(seed, context);
}

function suggestedResearchTaskForSeed(
  seed: AmbiguityIssueSeed,
  context: OnboardingQuestionContext,
  source: AmbiguityIssueSeedSource
) {
  if (!seed.suggestedResearchTask) {
    return undefined;
  }

  return source === "generated_json"
    ? plainUserFacingDecisionQueueText(seed.suggestedResearchTask)
    : contextualSuggestedResearchTask(seed, context);
}

function createAmbiguityIssuesFromSeeds(input: {
  readonly sessionId: SessionId;
  readonly specRef: string;
  readonly mode: ProjectPurposeMode;
  readonly intensity?: BusinessCriticIntensity | null | undefined;
  readonly context?: OnboardingQuestionContext;
  readonly seeds: readonly AmbiguityIssueSeed[];
  readonly source: AmbiguityIssueSeedSource;
}): readonly AmbiguityIssueSnapshot[] {
  const context = input.context ?? {};
  const token = stableToken(
    `${input.sessionId}:${input.specRef}:${input.mode}:${input.intensity ?? "none"}:${input.source}`
  );

  return input.seeds.map((seed, index) => {
    const businessCriticCategory = categoryForBusinessSeed(seed);
    const suggestedResearchTask = suggestedResearchTaskForSeed(seed, context, input.source);
    const researchQuestion = contextualResearchQuestionForSeed(seed, context, input.source);
    const answerSelectionMode = seed.answerSelectionMode ?? (seed.expectedAnswerType === "rank" ? "ranked" : undefined);
    const ambiguityDimension = inferredAmbiguityDimensionForSeed(seed);
    const ambiguityRoutingPath = inferredAmbiguityRoutingPathForSeed(seed);

    return {
      queueItemId: `queue_${token}_${index + 1}` as QueueItemId,
      sectionRef: seed.sectionRef,
      topicKey: seed.topicKey,
      ...(seed.purposeModeAxis ? { purposeModeAxis: seed.purposeModeAxis } : {}),
      ...(seed.purposeModeEffect ? { purposeModeEffect: seed.purposeModeEffect } : {}),
      ...(input.mode === "business" && businessCriticCategory ? { businessCriticCategory } : {}),
      ...(input.mode === "business"
        ? { businessCriticIntensityMinimum: seed.businessCriticIntensityMinimum ?? "balanced" }
        : {}),
      ...(seed.businessCriticPressureKind
        ? { businessCriticPressureKind: seed.businessCriticPressureKind }
        : input.mode === "business"
          ? { businessCriticPressureKind: "balanced_con" as const }
          : {}),
      ...(seed.businessCriticRepeatGroup ? { businessCriticRepeatGroup: seed.businessCriticRepeatGroup } : {}),
      ...(seed.nextValidationAction ? { nextValidationAction: seed.nextValidationAction } : {}),
      uncertaintyType: seed.uncertaintyType,
      severity: seed.severity,
      summary: seed.summary,
      whyItMatters: seed.whyItMatters,
      status: "open",
      questionText: questionTextForSeed(seed, context, input.source),
      expectedAnswerType: seed.expectedAnswerType,
      ...(answerSelectionMode ? { answerSelectionMode } : {}),
      answerOptions: seed.answerOptions ?? answerOptionsForSeed({
        ...seed,
        contextText: generatedQuestionSetContextText(context)
      }),
      decisionItUnlocks: seed.decisionItUnlocks,
      ambiguityDimension,
      ambiguityRoutingPath,
      ...(researchQuestion ? { researchQuestion } : {}),
      ...(suggestedResearchTask ? { suggestedResearchTask } : {}),
      repeatCount: 0,
      repeatLimit: seed.businessCriticPressureKind
        ? BUSINESS_CRITIC_FOLLOW_UP_QUESTION_LIMIT
        : DEFAULT_FOLLOW_UP_QUESTION_LIMIT,
      possibleRoutes: seed.routes,
      sourceRef: seed.sourceRef ?? (input.source === "generated_json" ? `generated_question:${seed.topicKey}` : seed.topicKey)
    };
  });
}

function createAmbiguityIssues(
  sessionId: SessionId,
  specRef: string,
  mode: ProjectPurposeMode,
  intensity?: BusinessCriticIntensity | null,
  context: OnboardingQuestionContext = {}
): readonly AmbiguityIssueSnapshot[] {
  return createAmbiguityIssuesFromSeeds({
    sessionId,
    specRef,
    mode,
    intensity,
    context,
    seeds: ambiguityIssueSeedsForMode(mode, intensity),
    source: "deterministic"
  });
}

function businessCriticQueuedNextIssues(
  allOpenIssues: readonly AmbiguityIssueSnapshot[],
  activeIssues: readonly AmbiguityIssueSnapshot[],
  intensity?: BusinessCriticIntensity | null
) {
  if (!intensity || intensity === "balanced") {
    return [] as readonly AmbiguityIssueSnapshot[];
  }

  const activeIds = new Set(activeIssues.map((issue) => issue.queueItemId));

  return allOpenIssues.filter(
    (issue) =>
      !activeIds.has(issue.queueItemId) &&
      isElevatedBusinessCriticIssue(issue) &&
      issue.status === "open" &&
      issue.businessCriticIntensityMinimum &&
      BUSINESS_CRITIC_INTENSITIES.indexOf(issue.businessCriticIntensityMinimum) <= BUSINESS_CRITIC_INTENSITIES.indexOf(intensity)
  );
}

function businessCriticIntensityRank(intensity: BusinessCriticIntensity) {
  return BUSINESS_CRITIC_INTENSITIES.indexOf(intensity);
}

function isBusinessCriticPressureAllowedAtIntensity(
  minimumIntensity: BusinessCriticIntensity | undefined,
  selectedIntensity: BusinessCriticIntensity
) {
  return minimumIntensity
    ? businessCriticIntensityRank(minimumIntensity) <= businessCriticIntensityRank(selectedIntensity)
    : true;
}

function isBusinessCriticIssueAllowedAtIntensity(
  issue: AmbiguityIssueSnapshot,
  selectedIntensity: BusinessCriticIntensity
) {
  return (
    !isElevatedBusinessCriticIssue(issue)
  ) || isBusinessCriticPressureAllowedAtIntensity(issue.businessCriticIntensityMinimum, selectedIntensity);
}

function retainedIssuesForBusinessCriticIntensity(
  issues: readonly AmbiguityIssueSnapshot[],
  activeItems: readonly QueueItemProjection[],
  selectedIntensity: BusinessCriticIntensity
) {
  const activeIds = new Set(activeItems.map((item) => item.queueItemId));

  return issues.filter(
    (issue) =>
      issue.status !== "open" ||
      activeIds.has(issue.queueItemId) ||
      isBusinessCriticIssueAllowedAtIntensity(issue, selectedIntensity)
  );
}

function isBusinessCriticQueueItemAllowedAtIntensity(
  item: QueueItemProjection,
  selectedIntensity: BusinessCriticIntensity
) {
  return (
    !isElevatedBusinessCriticQueueItem(item)
  ) || isBusinessCriticPressureAllowedAtIntensity(item.businessCriticIntensity, selectedIntensity);
}

function queueProjectionFromIssues(
  issues: readonly AmbiguityIssueSnapshot[],
  activeIssues: readonly AmbiguityIssueSnapshot[],
  version: ProjectionVersion,
  sessionId: SessionId,
  generatedAt: string,
  mode: ProjectPurposeMode,
  intensity?: BusinessCriticIntensity | null
): DecisionQueueProjection {
  const queuedNextIssues = businessCriticQueuedNextIssues(issues, activeIssues, intensity);
  const projection = {
    kind: "DecisionQueueProjection",
    version,
    ...queueProjectionPurposeMetadata(mode, intensity),
    active: activeIssues.map((issue) => queueItemProjectionFromIssue(issue, "active")),
    next: queuedNextIssues.map((issue) => queueItemProjectionFromIssue(issue, "next")),
    blocked: [],
    deferred: []
  } satisfies DecisionQueueProjection;

  return decisionQueueProjectionWithRecovery(
    queueProjectionWithQuestionProgress(projection, issues),
    sessionId,
    generatedAt
  );
}

function queueProjectionWithPurposeMetadata(
  projection: DecisionQueueProjection,
  version: ProjectionVersion,
  sessionId: SessionId,
  generatedAt: string,
  mode: ProjectPurposeMode,
  intensity?: BusinessCriticIntensity | null
): DecisionQueueProjection {
  return decisionQueueProjectionWithRecovery(
    {
      kind: "DecisionQueueProjection",
      version,
      ...queueProjectionPurposeMetadata(mode, intensity),
      ...(projection.activeBatch ? { activeBatch: projection.activeBatch } : {}),
      ...(projection.progress ? { progress: projection.progress } : {}),
      active: projection.active,
      next: projection.next,
      blocked: projection.blocked,
      deferred: projection.deferred
    },
    sessionId,
    generatedAt
  );
}

function queueProjectionWithBusinessCriticIntensity(
  projection: DecisionQueueProjection,
  version: ProjectionVersion,
  sessionId: SessionId,
  generatedAt: string,
  intensity: BusinessCriticIntensity
): DecisionQueueProjection {
  const withMetadata = queueProjectionWithPurposeMetadata(
    projection,
    version,
    sessionId,
    generatedAt,
    "business",
    intensity
  );

  return refreshQueueProjectionMetadata(
    {
      ...withMetadata,
      next: withMetadata.next.filter((item) => isBusinessCriticQueueItemAllowedAtIntensity(item, intensity)),
      blocked: withMetadata.blocked.filter((item) => isBusinessCriticQueueItemAllowedAtIntensity(item, intensity))
    },
    version,
    generatedAt
  );
}

function queueItemProjectionFromIssue(
  issue: AmbiguityIssueSnapshot,
  state: QueueItemProjection["state"] = "active"
): QueueItemProjection {
  const answerOptions = issue.answerOptions ?? answerOptionsForQuestion(issue.topicKey, issue.expectedAnswerType);
  const answerSelectionMode = issue.answerSelectionMode ?? (issue.expectedAnswerType === "rank" ? "ranked" : undefined);

  return {
    queueItemId: issue.queueItemId,
    title: issue.questionText ?? plainUserFacingDecisionQueueText(issue.summary),
    state,
    cardType: (issue.repeatCount ?? 0) > 0 ? "follow_up_question" : "question",
    ...(issue.sectionRef ? { sectionRef: issue.sectionRef } : {}),
    ...(issue.topicKey ? { topicKey: issue.topicKey } : {}),
    ...(issue.purposeModeAxis ? { purposeModeAxis: issue.purposeModeAxis } : {}),
    ...(issue.purposeModeEffect ? { purposeModeEffect: issue.purposeModeEffect } : {}),
    ...(issue.businessCriticCategory ? { businessCriticCategory: issue.businessCriticCategory } : {}),
    ...(issue.businessCriticIntensityMinimum
      ? { businessCriticIntensity: issue.businessCriticIntensityMinimum }
      : {}),
    ...(issue.businessCriticPressureKind ? { businessCriticPressureKind: issue.businessCriticPressureKind } : {}),
    ...(issue.knownRiskAccepted ? { knownRiskAccepted: issue.knownRiskAccepted } : {}),
    ...(issue.nextValidationAction
      ? { nextValidationAction: plainUserFacingDecisionQueueText(issue.nextValidationAction) }
      : {}),
    ...(issue.severity ? { severity: issue.severity } : {}),
    ...(issue.whyItMatters ? { whyItMatters: plainUserFacingDecisionQueueText(issue.whyItMatters) } : {}),
    ...(issue.decisionItUnlocks
      ? { decisionItUnlocks: plainUserFacingDecisionQueueText(issue.decisionItUnlocks) }
      : {}),
    ...(issue.ambiguityDimension ? { ambiguityDimension: issue.ambiguityDimension } : {}),
    ...(issue.ambiguityRoutingPath ? { ambiguityRoutingPath: issue.ambiguityRoutingPath } : {}),
    ...(issue.researchQuestion ? { researchQuestion: plainUserFacingDecisionQueueText(issue.researchQuestion) } : {}),
    ...(issue.suggestedResearchTask
      ? { suggestedResearchTask: plainUserFacingDecisionQueueText(issue.suggestedResearchTask) }
      : {}),
    ...(issue.expectedAnswerType ? { expectedAnswerType: issue.expectedAnswerType } : {}),
    ...(answerSelectionMode ? { answerSelectionMode } : {}),
    ...(answerOptions ? { answerOptions } : {}),
    ...(issue.possibleRoutes ? { possibleRoutes: issue.possibleRoutes } : {}),
    ...(issue.sourceRef ? { sourceRef: issue.sourceRef } : {})
  };
}

function isCoreAssumptionChallengeIssue(issue: AmbiguityIssueSnapshot) {
  return issue.businessCriticPressureKind === "core_assumption_challenge";
}

function isElevatedBusinessCriticPressureKind(kind: BusinessCriticPressureKind | undefined) {
  return kind === "core_assumption_challenge" || kind === "investor_pressure_pass";
}

function isElevatedBusinessCriticIssue(issue: AmbiguityIssueSnapshot) {
  return isElevatedBusinessCriticPressureKind(issue.businessCriticPressureKind);
}

function isElevatedBusinessCriticQueueItem(item: QueueItemProjection) {
  return isElevatedBusinessCriticPressureKind(item.businessCriticPressureKind);
}

function ambiguityIssueSeverityRank(issue: AmbiguityIssueSnapshot) {
  return issue.severity ? AMBIGUITY_SEVERITY_PRIORITY[issue.severity] : 3;
}

function defaultQuestionBatchIssues(openIssues: readonly AmbiguityIssueSnapshot[]) {
  const prioritizedIssues = openIssues
    .map((issue, index) => ({ issue, index }))
    .sort(
      (left, right) =>
        ambiguityIssueSeverityRank(left.issue) - ambiguityIssueSeverityRank(right.issue) || left.index - right.index
    )
    .map(({ issue }) => issue);
  const selectedIssues = prioritizedIssues.slice(0, DEFAULT_QUESTION_BATCH_SIZE);
  const requiredCoreChallenge = prioritizedIssues.find(isCoreAssumptionChallengeIssue);

  if (requiredCoreChallenge && !selectedIssues.some(isCoreAssumptionChallengeIssue)) {
    return [...selectedIssues.slice(0, DEFAULT_QUESTION_BATCH_SIZE - 1), requiredCoreChallenge];
  }

  return selectedIssues;
}

function hasDuplicateTopicKey(issues: readonly AmbiguityIssueSnapshot[]) {
  const topicKeys = new Set<string>();

  return issues.some((issue) => {
    if (!issue.topicKey) {
      return false;
    }

    if (topicKeys.has(issue.topicKey)) {
      return true;
    }

    topicKeys.add(issue.topicKey);

    return false;
  });
}

function queueProjectionWithoutItem(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId,
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const withoutItem = (items: readonly QueueItemProjection[]) =>
    items.filter((candidate) => candidate.queueItemId !== queueItemId);

  return refreshQueueProjectionMetadata(
    {
      ...projection,
      active: withoutItem(projection.active),
      next: withoutItem(projection.next),
      blocked: withoutItem(projection.blocked),
      deferred: withoutItem(projection.deferred)
    },
    version,
    generatedAt
  );
}

function queueProjectionWithNextOrBlockedItem(
  projection: DecisionQueueProjection,
  item: QueueItemProjection & { readonly state: "next" | "blocked" },
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const withoutItem = queueProjectionWithoutItem(projection, item.queueItemId, version, generatedAt);

  return refreshQueueProjectionMetadata(
    {
      ...withoutItem,
      next: item.state === "next" ? [...withoutItem.next, item] : withoutItem.next,
      blocked: item.state === "blocked" ? [...withoutItem.blocked, item] : withoutItem.blocked
    },
    version,
    generatedAt
  );
}

function queueProjectionWithDeferredItem(
  projection: DecisionQueueProjection,
  item: QueueItemProjection & { readonly state: "deferred" },
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const withoutItem = queueProjectionWithoutItem(projection, item.queueItemId, version, generatedAt);

  return refreshQueueProjectionMetadata(
    {
      ...withoutItem,
      deferred: [...withoutItem.deferred, item]
    },
    version,
    generatedAt
  );
}

function queueItemIdsInProjection(projection: DecisionQueueProjection) {
  return new Set(
    [
      ...projection.active,
      ...projection.next,
      ...projection.blocked,
      ...projection.deferred
    ].map((item) => item.queueItemId)
  );
}

function queueItemIsOpenQuestion(
  item: QueueItemProjection,
  openIssueById: ReadonlyMap<QueueItemId, AmbiguityIssueSnapshot>
) {
  return (
    item.cardType === undefined ||
    item.cardType === "question" ||
    item.cardType === "follow_up_question"
  ) && openIssueById.has(item.queueItemId);
}

function queueProjectionWithRefilledActiveQuestions(
  projection: DecisionQueueProjection,
  issues: readonly AmbiguityIssueSnapshot[],
  version: ProjectionVersion,
  generatedAt = projection.generatedAt ?? new Date(0).toISOString()
): DecisionQueueProjection {
  const openIssues = issues.filter((issue) => issue.status === "open");
  const openIssueById = new Map(openIssues.map((issue) => [issue.queueItemId, issue]));
  const activeQuestionCount = projection.active.filter((item) => queueItemIsOpenQuestion(item, openIssueById)).length;
  const slots = DEFAULT_QUESTION_BATCH_SIZE - activeQuestionCount;

  if (slots <= 0 || openIssues.length === 0) {
    return refreshQueueProjectionMetadata(queueProjectionWithQuestionProgress(projection, issues), version, generatedAt);
  }

  const promotedFromNext = projection.next
    .filter((item) => queueItemIsOpenQuestion(item, openIssueById))
    .slice(0, slots)
    .map((item) => ({
      ...item,
      state: "active" as const
    }));
  const promotedIds = new Set(promotedFromNext.map((item) => item.queueItemId));
  const queuedIds = queueItemIdsInProjection(projection);
  const fillerIssues = defaultQuestionBatchIssues(
    openIssues.filter((issue) => !queuedIds.has(issue.queueItemId) && !promotedIds.has(issue.queueItemId))
  ).slice(0, slots - promotedFromNext.length);
  const fillerItems = fillerIssues.map((issue) => queueItemProjectionFromIssue(issue, "active"));

  if (!promotedFromNext.length && !fillerItems.length) {
    return refreshQueueProjectionMetadata(queueProjectionWithQuestionProgress(projection, issues), version, generatedAt);
  }

  return refreshQueueProjectionMetadata(
    queueProjectionWithQuestionProgress(
      {
        ...projection,
        active: [...projection.active, ...promotedFromNext, ...fillerItems],
        next: projection.next.filter((item) => !promotedIds.has(item.queueItemId))
      },
      issues
    ),
    version,
    generatedAt
  );
}

function queueItemFromProjection(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId
): QueueItemProjection | null {
  return (
    [
      ...projection.active,
      ...projection.next,
      ...projection.blocked,
      ...projection.deferred
    ].find((item) => item.queueItemId === queueItemId) ?? null
  );
}

function compactAnswerExcerpt(answer: string) {
  const compacted = ANSWER_EXCERPT_SENSITIVE_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, ANSWER_EXCERPT_REDACTED_VALUE),
    answer.replace(/\s+/gu, " ").trim()
  );

  return compacted.length > ANSWER_EXCERPT_MAX_CHARS
    ? `${compacted.slice(0, ANSWER_EXCERPT_MAX_CHARS - 1)}…`
    : compacted;
}

function readableEvidenceContextExcerpt(value: string) {
  const userFacingValue = stripInternalResearchMetaText(value);
  const compacted = ANSWER_EXCERPT_SENSITIVE_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, ANSWER_EXCERPT_REDACTED_VALUE),
    userFacingValue.replace(/\s+/gu, " ").trim()
  );

  return compacted.length > 220 ? compacted.slice(0, 220).trimEnd() : compacted;
}

function researchSourceLabel(researchResult: ResearchResultProjection) {
  const sourceTitle = stripInternalResearchMetaText(researchResult.sourceTitle ?? "");
  const sourceUrl = stripInternalResearchMetaText(researchResult.sourceUrl ?? "");
  const titleLooksLikeCollapsedUrl =
    /https?:\/\//iu.test(sourceTitle) ||
    (sourceUrl.length > 0 &&
      sourceTitle.replace(/\s+/gu, "").toLowerCase().includes(sourceUrl.replace(/\s+/gu, "").toLowerCase().slice(0, 24)));

  if (sourceTitle && !titleLooksLikeCollapsedUrl) {
    return sourceTitle;
  }

  return sourceUrl || sourceTitle || researchResult.researchResultId;
}

function researchSynthesisContextText(
  researchTask: ResearchTaskProjection,
  sourceQuestion: AmbiguityIssueSnapshot | undefined
) {
  return [
    researchTask.objective,
    sourceQuestion?.summary,
    sourceQuestion?.questionText,
    sourceQuestion?.researchQuestion,
    sourceQuestion?.decisionItUnlocks,
    sourceQuestion?.suggestedResearchTask,
    ...(sourceQuestion?.answerOptions ?? []).flatMap((option) => [
      option.label,
      option.value,
      option.primaryDetail,
      option.secondaryDetail,
      option.pro,
      option.con
    ])
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function researchFollowUpEvidenceContext(input: {
  readonly proSummary: string | undefined;
  readonly conSummary: string | undefined;
  readonly uncertaintySummary: string | undefined;
  readonly sourceLabel: string;
}) {
  return [
    "리서치 근거 요약:",
    input.proSummary ? `- 확인된 단서: ${readableEvidenceContextExcerpt(input.proSummary)}` : null,
    input.conSummary ? `- 다른 관점/반례: ${readableEvidenceContextExcerpt(input.conSummary)}` : null,
    input.uncertaintySummary
      ? `- 한계/불확실성: ${readableEvidenceContextExcerpt(input.uncertaintySummary)}`
      : null,
    `- 출처 단서: ${readableEvidenceContextExcerpt(input.sourceLabel)}`
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

const BROADER_RESEARCH_REQUEST_PATTERN = new RegExp(
  [
    "(?:more|broader|wider|additional|deeper)\\s+research",
    "(?:추가|더|넓은|깊은)\\s*리서치",
    "리서치(?:가|는)?\\s*(?:더|추가로|넓게|깊게)\\s*필요",
    "(?:자료|근거|출처)(?:가|는)?\\s*(?:더|추가로|넓게|깊게)\\s*필요",
    "(?:need|needs|needed|require|requires|required)\\s+(?:more|additional|further|broader|wider|deeper)\\s+(?:research|sources?|evidence|references?)",
    "(?:more|additional|further|broader|wider|deeper)\\s+(?:research|sources?|evidence|references?)[^.\\n]{0,40}(?:needed|required|necessary)",
    "(?:자료|근거|출처|source|sources?|evidence)(?:를|을)?\\s*(?:더|추가로|넓게|깊게|많이)?\\s*(?:찾|모(?:으|아|은)|수집|확인|검토)",
    "(?:조사|리서치)(?:를|을)?\\s*(?:더|추가로|넓게|깊게|많이)?\\s*(?:하|해|진행|돌려)",
    "(?:find|collect|gather|check|review)\\s+(?:more|additional|broader|wider|deeper)\\s+(?:sources?|evidence|references?|research)",
    "더\\s*넓은\\s*자료(?:를|을)?\\s*(?:수집|모(?:은|으|아)|찾|확인)",
    "근거(?:가|는)?\\s*부족(?:하므로|해서|해)?[^.\\n]{0,40}(?:자료|리서치|근거)(?:를|을)?\\s*(?:더|추가로|넓게|깊게|모(?:은|으|아)|수집|찾|확인)",
    "더\\s*넓은\\s*근거(?:와|과|/)?\\s*반례(?:를|을)?[^.\\n]{0,40}(?:확인|찾|조사|수집)",
    "반례(?:와|과|/)\\s*한계(?:를|을)?\\s*더\\s*(?:조사|찾|확인|수집)"
  ].join("|"),
  "iu"
);

const BROADER_RESEARCH_REJECTION_PATTERN = new RegExp(
  [
    "(?:리서치|조사|자료|근거|출처)[^.\\n]{0,40}(?:필요\\s*없|불필요|그만|멈추|하지\\s*마|하지\\s*않|안\\s*(?:해|하|찾|모|수집))",
    "(?:리서치|조사|자료|근거|출처)[^.\\n]{0,40}(?:찾|모(?:으|아)|수집|확인|검토|하|해|진행|돌려)\\s*지\\s*않",
    "(?:더|추가로|넓게|깊게)[^.\\n]{0,40}(?:찾|모(?:으|아)|수집|조사|리서치)[^.\\n]{0,40}(?:필요\\s*없|불필요|하지\\s*마|하지\\s*않|안\\s*(?:해|하|찾|모|수집))",
    "(?:no|not|without)\\s+(?:more|additional|further|broader|wider|deeper)\\s+(?:research|sources?|evidence|references?)",
    "(?:do\\s+not|don't|dont|no\\s+need\\s+to|need\\s+not)\\s+(?:need\\s+)?(?:more|additional|further|broader|wider|deeper)\\s+(?:research|sources?|evidence|references?)",
    "(?:more|additional|further|broader|wider|deeper)\\s+(?:research|sources?|evidence|references?)[^.\\n]{0,40}(?:not\\s+needed|unnecessary|not\\s+necessary)",
    "(?:do\\s+not|don't|dont|stop)\\s+(?:find|collect|gather|research|search|look\\s+up)"
  ].join("|"),
  "iu"
);

function answerRequestsBroaderResearch(answer: string) {
  return BROADER_RESEARCH_REQUEST_PATTERN.test(answer) && !BROADER_RESEARCH_REJECTION_PATTERN.test(answer);
}

function ambiguityRoutingPathInstruction(path: AmbiguityIssueSnapshot["ambiguityRoutingPath"] | undefined) {
  if (path === "existing_fact_check") {
    return "First verify facts that can be checked from existing public records or known documents, then separate the user's remaining judgment.";
  }

  if (path === "current_research") {
    return "Collect current public evidence with source freshness, limitations, and counterexamples before treating the answer as implementation-ready.";
  }

  if (path === "human_judgment") {
    return "Do not replace the user's choice with research; use research only to clarify consequences, risks, and observable validation signals.";
  }

  return "Separate checkable facts, current research, and remaining user judgment before recommending the next question or spec update.";
}

function researchObjectiveForAnswer(input: {
  readonly activeItem: QueueItemProjection;
  readonly answer: string;
  readonly sourceQuestion: AmbiguityIssueSnapshot | undefined;
}) {
  const subject = input.sourceQuestion?.summary ?? input.activeItem.title;
  const researchTarget = input.sourceQuestion?.researchQuestion ?? input.sourceQuestion?.suggestedResearchTask;
  const broaden = answerRequestsBroaderResearch(input.answer);

  if (!researchTarget) {
    const baseObjective = `Validate evidence for: ${subject}`;

    if (!broaden) {
      return baseObjective;
    }

    return [
      `Broaden research beyond existing notes for: ${subject}`,
      `User asked for additional or wider research after answering: “${compactAnswerExcerpt(input.answer)}”.`,
      "Use any existing research memory as baseline context, but collect wider sources and counter-evidence instead of treating the previous memo as complete."
    ].join(" ");
  }

  return [
    broaden ? `Broaden research for: ${plainUserFacingDecisionQueueText(researchTarget)}` : `Find decision evidence for: ${plainUserFacingDecisionQueueText(researchTarget)}`,
    `Original ambiguity: ${plainUserFacingDecisionQueueText(subject)}`,
    `User answer to account for: “${compactAnswerExcerpt(input.answer)}”.`,
    input.sourceQuestion?.decisionItUnlocks
      ? `Decision this should inform: ${plainUserFacingDecisionQueueText(input.sourceQuestion.decisionItUnlocks)}`
      : null,
    input.sourceQuestion?.ambiguityDimension
      ? `Ambiguity dimension: ${input.sourceQuestion.ambiguityDimension}`
      : null,
    ambiguityRoutingPathInstruction(input.sourceQuestion?.ambiguityRoutingPath),
    broaden
      ? "Use existing research memory only as baseline context; look for wider sources, counterexamples, and stale assumptions."
      : "Return source-linked findings, limitations, other perspectives, and what still needs a human decision."
  ].filter(Boolean).join(" ");
}

function followUpQuestionTemplate(
  routeOutcome: ResearchRouteOutcome,
  nextRepeatCount: number
): FollowUpQuestionTemplate {
  if (routeOutcome === "missing_con_evidence") {
    return MISSING_CON_EVIDENCE_FOLLOW_UP_QUESTION_TEMPLATE;
  }

  return FOLLOW_UP_QUESTION_TEMPLATES[(nextRepeatCount - 1) % FOLLOW_UP_QUESTION_TEMPLATES.length] ?? FOLLOW_UP_QUESTION_TEMPLATES[0];
}

function followUpAnswerSelectionMode(
  template: FollowUpQuestionTemplate
): AmbiguityAnswerSelectionMode | undefined {
  if (template.answerSelectionMode) {
    return template.answerSelectionMode;
  }

  if (template.expectedAnswerType === "text") {
    return undefined;
  }

  return template.expectedAnswerType === "rank" ? "ranked" : "single";
}

function followUpAnswerOptions(template: FollowUpQuestionTemplate) {
  if (template.expectedAnswerType === "text") {
    return [];
  }

  return template.answerOptions ?? answerOptionsForQuestion(template.optionTopicKey, template.expectedAnswerType) ?? [];
}

function followUpQuestionText(answer: string, template: FollowUpQuestionTemplate) {
  return template.text.replace("{answer}", compactAnswerExcerpt(answer));
}

function followUpSuggestedResearchTask(
  sourceQuestion: AmbiguityIssueSnapshot,
  answer: string,
  routeOutcome: ResearchRouteOutcome
) {
  if (routeOutcome === "missing_con_evidence") {
    return `답변 “${compactAnswerExcerpt(answer)}”를 반박하거나 약하게 만드는 공개 근거를 우선 찾습니다.`;
  }

  const researchTarget = sourceQuestion.researchQuestion ?? sourceQuestion.suggestedResearchTask;

  if (!researchTarget) {
    return undefined;
  }

  return `답변 “${compactAnswerExcerpt(answer)}” 기준으로 ${plainUserFacingDecisionQueueText(researchTarget)}`;
}

const MAX_IMMEDIATE_FOLLOW_UP_BRANCHES = 3;

function normalizedFollowUpBranchText(value: string) {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)]|[가-힣a-z]\))\s*/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function answerFollowUpBranches(answer: string): readonly string[] {
  const lineBranches = answer
    .split(/\r?\n/gu)
    .map(normalizedFollowUpBranchText)
    .filter((line) => line.length >= 8);
  const semicolonBranches = answer
    .split(/[;；]/gu)
    .map(normalizedFollowUpBranchText)
    .filter((line) => line.length >= 8);
  const candidates = lineBranches.length >= 2 ? lineBranches : semicolonBranches.length >= 3 ? semicolonBranches : [answer];
  const uniqueBranches: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueBranches.push(candidate);
  }

  return uniqueBranches.slice(0, MAX_IMMEDIATE_FOLLOW_UP_BRANCHES);
}

function branchAnswerRef(answerRef: string, branchCount: number, branchIndex: number) {
  return branchCount === 1 ? answerRef : `${answerRef}:branch:${branchIndex + 1}`;
}

function researchObjectiveForAnswerBranch(input: {
  readonly explicitObjective: string | undefined;
  readonly activeItem: QueueItemProjection;
  readonly branchAnswer: string;
  readonly branchCount: number;
  readonly branchIndex: number;
  readonly sourceQuestion: AmbiguityIssueSnapshot | undefined;
}) {
  const { activeItem, branchAnswer, branchCount, branchIndex, explicitObjective, sourceQuestion } = input;
  const objective =
    explicitObjective ??
    researchObjectiveForAnswer({
      activeItem,
      answer: branchAnswer,
      sourceQuestion
    });

  if (branchCount === 1) {
    return objective;
  }

  return `답변의 ${branchIndex + 1}번째 판단 가지 “${compactAnswerExcerpt(branchAnswer)}” 기준으로 ${plainUserFacingDecisionQueueText(objective)}`;
}

function createFollowUpIssuesForAnswer(input: {
  readonly sessionId: SessionId;
  readonly sourceQuestion: AmbiguityIssueSnapshot | undefined;
  readonly answer: string;
  readonly answerRef: string;
  readonly routeOutcome: ResearchRouteOutcome;
  readonly impact: ResearchImpact;
}): readonly AmbiguityIssueSnapshot[] {
  const { answer, answerRef, impact, routeOutcome, sessionId, sourceQuestion } = input;

  if (!sourceQuestion || sourceQuestion.status !== "open") {
    return [];
  }

  const currentRepeatCount = sourceQuestion.repeatCount ?? 0;
  const repeatLimit = sourceQuestion.repeatLimit ?? DEFAULT_FOLLOW_UP_QUESTION_LIMIT;
  const branches = answerFollowUpBranches(answer);

  const sourceTopicKey = sourceQuestion.businessCriticRepeatGroup ?? sourceQuestion.topicKey ?? sourceQuestion.queueItemId;
  const severity =
    sourceQuestion.severity === "high" || impact === "high"
      ? "high"
      : sourceQuestion.severity === "medium" || impact === "medium"
        ? "medium"
        : "low";

  return branches.flatMap((branchAnswer, branchIndex) => {
    const nextRepeatCount = currentRepeatCount + branchIndex + 1;

    if (nextRepeatCount > repeatLimit) {
      return [];
    }

    const followUpTopicKey = `${sourceTopicKey}_follow_up_${nextRepeatCount}`;
    const followUpId = `queue_followup_${stableToken(
      branches.length === 1
        ? `${sessionId}:${sourceQuestion.queueItemId}:${answerRef}:${nextRepeatCount}`
        : `${sessionId}:${sourceQuestion.queueItemId}:${answerRef}:${nextRepeatCount}:${branchIndex}:${branchAnswer}`
    )}` as QueueItemId;
    const suggestedResearchTask = followUpSuggestedResearchTask(sourceQuestion, branchAnswer, routeOutcome);
    const followUpTemplate = followUpQuestionTemplate(routeOutcome, nextRepeatCount);
    const expectedAnswerType = followUpTemplate.expectedAnswerType;
    const answerSelectionMode = followUpAnswerSelectionMode(followUpTemplate);
    const answerOptions = followUpAnswerOptions(followUpTemplate);

    return [{
      queueItemId: followUpId,
      ...(sourceQuestion.sectionRef ? { sectionRef: sourceQuestion.sectionRef } : {}),
      topicKey: followUpTopicKey,
      ...(sourceQuestion.purposeModeAxis ? { purposeModeAxis: sourceQuestion.purposeModeAxis } : {}),
      ...(sourceQuestion.purposeModeEffect ? { purposeModeEffect: sourceQuestion.purposeModeEffect } : {}),
      ...(sourceQuestion.businessCriticCategory ? { businessCriticCategory: sourceQuestion.businessCriticCategory } : {}),
      ...(sourceQuestion.businessCriticIntensityMinimum
        ? { businessCriticIntensityMinimum: sourceQuestion.businessCriticIntensityMinimum }
        : {}),
      ...(sourceQuestion.businessCriticPressureKind ? { businessCriticPressureKind: sourceQuestion.businessCriticPressureKind } : {}),
      ...(sourceQuestion.businessCriticRepeatGroup ? { businessCriticRepeatGroup: sourceQuestion.businessCriticRepeatGroup } : {}),
      ...(sourceQuestion.ambiguityDimension ? { ambiguityDimension: sourceQuestion.ambiguityDimension } : {}),
      ...(sourceQuestion.ambiguityRoutingPath ? { ambiguityRoutingPath: sourceQuestion.ambiguityRoutingPath } : {}),
      ...(sourceQuestion.researchQuestion ? { researchQuestion: sourceQuestion.researchQuestion } : {}),
      uncertaintyType: routeOutcome === "missing_con_evidence" ? "missing_con_evidence" : "decision_required",
      severity,
      summary: branches.length === 1
        ? `이전 답변을 더 구체화해야 함: ${sourceQuestion.summary}`
        : `이전 답변의 ${branchIndex + 1}번째 판단 가지를 더 구체화해야 함: ${sourceQuestion.summary}`,
      whyItMatters:
        "답변이 다음 질문, 리서치, 구현 범위로 이어지려면 판단 기준과 반례를 더 좁혀야 합니다.",
      status: "open" as const,
      questionText: followUpQuestionText(branchAnswer, followUpTemplate),
      expectedAnswerType,
      ...(answerSelectionMode ? { answerSelectionMode } : {}),
      answerOptions,
      decisionItUnlocks:
        sourceQuestion.decisionItUnlocks ??
        "이전 답변을 스펙, 근거, 첫 구현 범위 판단으로 연결합니다.",
      ...(suggestedResearchTask ? { suggestedResearchTask } : {}),
      repeatCount: nextRepeatCount,
      repeatLimit,
      possibleRoutes:
        routeOutcome === "missing_con_evidence"
          ? ["question", "missing_con_evidence", "research_needed"]
          : ["question", "research_needed", "spec_update_candidate"],
      sourceRef: branches.length === 1
        ? `${sourceQuestion.sourceRef ?? sourceTopicKey}:follow_up:${nextRepeatCount}`
        : `${sourceQuestion.sourceRef ?? sourceTopicKey}:follow_up:${nextRepeatCount}:branch:${branchIndex + 1}`
    }];
  });
}

function createResearchFollowUpIssueForAdditionalQuestion(input: {
  readonly sessionId: SessionId;
  readonly sourceQuestion: AmbiguityIssueSnapshot | undefined;
  readonly researchTask: ResearchTaskProjection;
  readonly researchResult: ResearchResultProjection;
  readonly evidenceMatrix: EvidenceMatrixProjection;
  readonly question: string;
  readonly index: number;
  readonly existingResearchFollowUpCount: number;
}): AmbiguityIssueSnapshot | null {
  const {
    evidenceMatrix,
    existingResearchFollowUpCount,
    index,
    question,
    researchResult,
    researchTask,
    sessionId,
    sourceQuestion
  } = input;
  const repeatLimit = sourceQuestion?.repeatLimit ?? DEFAULT_FOLLOW_UP_QUESTION_LIMIT;
  const repeatCount = (sourceQuestion?.repeatCount ?? 0) + existingResearchFollowUpCount + index + 1;

  if (repeatCount > repeatLimit) {
    return null;
  }

  const sourceTopicKey =
    sourceQuestion?.businessCriticRepeatGroup ??
    sourceQuestion?.topicKey ??
    researchTask.sourceQueueItemId ??
    researchTask.researchTaskId;
  const questionToken = stableToken(
    `${sessionId}:${researchTask.researchTaskId}:${evidenceMatrix.evidenceMatrixId}:${index}:${question}`
  );
  const isConEvidenceGap =
    evidenceMatrix.balanceStatus === "missing_con_evidence" ||
    evidenceMatrix.balanceStatus === "needs_con_evidence" ||
    evidenceMatrix.balanceStatus === "blocked_by_con_evidence";
  const proSummary = evidenceMatrix.proEvidence[0]?.summary;
  const conSummary = evidenceMatrix.conEvidence[0]?.summary;
  const uncertaintySummary = evidenceMatrix.uncertainties[0]?.summary;
  const sourceLabel = researchSourceLabel(researchResult);
  const evidenceContext = researchFollowUpEvidenceContext({
    proSummary,
    conSummary,
    uncertaintySummary,
    sourceLabel
  });
  const answerInput = {
    question,
    researchTask,
    sourceQuestion,
    evidenceMatrix
  };
  const expectedAnswerType = researchFollowUpExpectedAnswerType(answerInput);
  const answerSelectionMode = researchFollowUpAnswerSelectionMode(answerInput);
  const answerOptions = researchFollowUpAnswerOptions(answerInput);

  return {
    queueItemId: `queue_research_followup_${questionToken}` as QueueItemId,
    ...(sourceQuestion?.sectionRef ? { sectionRef: sourceQuestion.sectionRef } : {}),
    topicKey: `${sourceTopicKey}_research_follow_up_${repeatCount}_${questionToken}`,
    ...(sourceQuestion?.purposeModeAxis ? { purposeModeAxis: sourceQuestion.purposeModeAxis } : {}),
    ...(sourceQuestion?.purposeModeEffect ? { purposeModeEffect: sourceQuestion.purposeModeEffect } : {}),
    ...(sourceQuestion?.businessCriticCategory
      ? { businessCriticCategory: sourceQuestion.businessCriticCategory }
      : researchTask.businessCriticCategory
        ? { businessCriticCategory: researchTask.businessCriticCategory }
        : {}),
    ...(sourceQuestion?.businessCriticIntensityMinimum
      ? { businessCriticIntensityMinimum: sourceQuestion.businessCriticIntensityMinimum }
      : researchTask.businessCriticIntensity
        ? { businessCriticIntensityMinimum: researchTask.businessCriticIntensity }
        : {}),
    ...(sourceQuestion?.businessCriticPressureKind
      ? { businessCriticPressureKind: sourceQuestion.businessCriticPressureKind }
      : {}),
    ...(sourceQuestion?.businessCriticRepeatGroup
      ? { businessCriticRepeatGroup: sourceQuestion.businessCriticRepeatGroup }
      : {}),
    ...(sourceQuestion?.ambiguityDimension ? { ambiguityDimension: sourceQuestion.ambiguityDimension } : {}),
    ambiguityRoutingPath: sourceQuestion?.ambiguityRoutingPath ?? "current_research",
    ...(sourceQuestion?.researchQuestion
      ? { researchQuestion: sourceQuestion.researchQuestion }
      : { researchQuestion: researchTask.objective }),
    uncertaintyType: isConEvidenceGap ? "missing_con_evidence" : "unsupported",
    severity: researchTask.impact,
    summary: `리서치가 생성한 후속 질문: ${compactAnswerExcerpt(question)}`,
    whyItMatters:
      `백그라운드/브라우저 리서치가 발견한 근거 공백을 사용자가 답변 가능한 질문으로 되돌려야 아이디어 구체화 루프가 계속됩니다.\n\n${evidenceContext}`,
    status: "open",
    questionText: question,
    expectedAnswerType,
    ...(answerSelectionMode ? { answerSelectionMode } : {}),
    answerOptions,
    decisionItUnlocks:
      `리서치 결과 “${readableEvidenceContextExcerpt(researchTask.objective)}”와 ${readableEvidenceContextExcerpt(sourceLabel)} 근거를 스펙, 근거, 구현 범위 판단으로 연결합니다.`,
    suggestedResearchTask: isConEvidenceGap
      ? `추가 질문 “${readableEvidenceContextExcerpt(question)}”에 답할 반대근거와 한계를 우선 확인합니다.`
      : `추가 질문 “${readableEvidenceContextExcerpt(question)}”에 답할 공개 근거와 사용자 신호를 확인합니다.`,
    repeatCount,
    repeatLimit,
    possibleRoutes: isConEvidenceGap
      ? ["question", "missing_con_evidence", "research_needed"]
      : ["question", "research_needed", "spec_update_candidate"],
    sourceRef: `research:${researchTask.researchTaskId}:${evidenceMatrix.evidenceMatrixId}:additional_question:${index + 1}`
  };
}

function createResearchFollowUpIssuesForAdditionalQuestions(input: {
  readonly sessionId: SessionId;
  readonly openIssues: readonly AmbiguityIssueSnapshot[];
  readonly researchTask: ResearchTaskProjection;
  readonly researchResult: ResearchResultProjection;
  readonly evidenceMatrix: EvidenceMatrixProjection;
}): readonly AmbiguityIssueSnapshot[] {
  const sourceQuestion = input.researchTask.sourceQueueItemId
    ? input.openIssues.find((issue) => issue.queueItemId === input.researchTask.sourceQueueItemId)
    : undefined;
  const researchFollowUpSourcePrefix = `research:${input.researchTask.researchTaskId}:`;
  const existingResearchFollowUpCount = input.openIssues.filter(
    (issue) =>
      issue.queueItemId.startsWith("queue_research_followup_") &&
      issue.sourceRef?.startsWith(researchFollowUpSourcePrefix)
  ).length;
  const existingResearchFollowUpQuestions = new Set(
    input.openIssues
      .flatMap((issue) =>
        issue.queueItemId.startsWith("queue_research_followup_") &&
        issue.sourceRef?.startsWith(researchFollowUpSourcePrefix) &&
        issue.questionText
          ? [issue.questionText.trim().toLowerCase()]
          : []
      )
  );
  const newAdditionalQuestions = input.evidenceMatrix.additionalQuestions.filter((question) => {
    const normalizedQuestion = question.trim().toLowerCase();

    if (existingResearchFollowUpQuestions.has(normalizedQuestion)) {
      return false;
    }

    existingResearchFollowUpQuestions.add(normalizedQuestion);
    return true;
  });

  return newAdditionalQuestions
    .map((question, index) =>
      createResearchFollowUpIssueForAdditionalQuestion({
        sessionId: input.sessionId,
        sourceQuestion,
        researchTask: input.researchTask,
        researchResult: input.researchResult,
        evidenceMatrix: input.evidenceMatrix,
        question,
        index,
        existingResearchFollowUpCount
      })
    )
    .filter((issue): issue is AmbiguityIssueSnapshot => Boolean(issue));
}

function researchRouteOutcomeForFollowUpIssue(issue: AmbiguityIssueSnapshot): ResearchRouteOutcome {
  return issue.uncertaintyType === "missing_con_evidence" ||
    issue.possibleRoutes?.includes("missing_con_evidence")
    ? "missing_con_evidence"
    : "research_needed";
}

function researchObjectiveForFollowUpIssue(issue: AmbiguityIssueSnapshot) {
  const objective =
    issue.suggestedResearchTask ??
    issue.researchQuestion ??
    (issue.questionText
      ? `추가 질문 “${compactAnswerExcerpt(issue.questionText)}”에 답할 공개 근거, 반례, 한계를 확인합니다.`
      : `리서치 후속 질문 ${issue.queueItemId}에 필요한 공개 근거, 반례, 한계를 확인합니다.`);

  return (
    issue.sourceRef?.startsWith("research:")
      ? `기존 리서치 메모와 source trace를 기준으로 ${objective}`
      : objective
  );
}

function createResearchTasksForResearchFollowUpIssues(input: {
  readonly sessionId: SessionId;
  readonly sourceResearchTask: ResearchTaskProjection;
  readonly researchFollowUpIssues: readonly AmbiguityIssueSnapshot[];
  readonly existingResearchTasks: readonly ResearchTaskProjection[];
  readonly createdAt: string;
}): readonly ResearchTaskProjection[] {
  const existingSourceQueueItemIds = new Set(
    input.existingResearchTasks.flatMap((task) => (task.sourceQueueItemId ? [task.sourceQueueItemId] : []))
  );

  return input.researchFollowUpIssues
    .filter((issue) => issue.status === "open" && !existingSourceQueueItemIds.has(issue.queueItemId))
    .map((issue) => {
      const routeOutcome = researchRouteOutcomeForFollowUpIssue(issue);
      const objective = researchObjectiveForFollowUpIssue(issue);
      const researchTaskId = `research_task_${stableToken(
        `${input.sessionId}:${issue.queueItemId}:${objective}:${routeOutcome}`
      )}` as ResearchTaskId;

      return planResearchTask({
        researchTaskId,
        sessionId: input.sessionId,
        sourceQueueItemId: issue.queueItemId,
        objective,
        ...(input.sourceResearchTask.projectPurposeMode
          ? { projectPurposeMode: input.sourceResearchTask.projectPurposeMode }
          : {}),
        ...(input.sourceResearchTask.projectPurposeModeLabel
          ? { projectPurposeModeLabel: input.sourceResearchTask.projectPurposeModeLabel }
          : {}),
        ...(input.sourceResearchTask.projectPurposeModeEffect
          ? { projectPurposeModeEffect: input.sourceResearchTask.projectPurposeModeEffect }
          : {}),
        ...(input.sourceResearchTask.skippedCommercializationAxes?.length
          ? { skippedCommercializationAxes: input.sourceResearchTask.skippedCommercializationAxes }
          : {}),
        routeOutcome,
        impact: validResearchImpact(issue.severity),
        createdAt: input.createdAt
      });
    });
}

function appendUniqueOpenIssues(
  openIssues: readonly AmbiguityIssueSnapshot[],
  newIssues: readonly AmbiguityIssueSnapshot[]
): readonly AmbiguityIssueSnapshot[] {
  const existingIds = new Set(openIssues.map((issue) => issue.queueItemId));
  const uniqueNewIssues = newIssues.filter((issue) => !existingIds.has(issue.queueItemId));

  return uniqueNewIssues.length ? [...openIssues, ...uniqueNewIssues] : openIssues;
}

function queueProjectionWithVisibleResearchFollowUps(
  projection: DecisionQueueProjection,
  openIssues: readonly AmbiguityIssueSnapshot[],
  researchFollowUpIssues: readonly AmbiguityIssueSnapshot[],
  version: ProjectionVersion,
  generatedAt: string
): DecisionQueueProjection {
  const existingQueueItemIds = queueItemIdsInProjection(projection);
  const followUpItems = researchFollowUpIssues
    .filter((issue) => issue.status === "open" && !existingQueueItemIds.has(issue.queueItemId))
    .map((issue) => queueItemProjectionFromIssue(issue, "next"));
  const projectionWithVisibleFollowUps = followUpItems.length
    ? refreshQueueProjectionMetadata(
        {
          ...projection,
          next: [...projection.next, ...followUpItems]
        },
        version,
        generatedAt
      )
    : projection;

  return queueProjectionWithRefilledActiveQuestions(projectionWithVisibleFollowUps, openIssues, version, generatedAt);
}

function queueItemRequiresKnownRiskDeferral(item: QueueItemProjection) {
  return (
    isElevatedBusinessCriticQueueItem(item) ||
    (item.businessCriticCategory !== undefined && item.severity === "high")
  );
}

function issuesWithQueueItemStatus(
  issues: readonly AmbiguityIssueSnapshot[],
  queueItemId: QueueItemId,
  status: AmbiguityIssueSnapshot["status"],
  patch: Partial<AmbiguityIssueSnapshot> = {}
): readonly AmbiguityIssueSnapshot[] {
  return issues.map((issue) =>
    issue.queueItemId === queueItemId
      ? {
          ...issue,
          ...patch,
          status
        }
      : issue
  );
}

function queueProjectionEffect(
  command: ProductEngineCommand,
  sourceEventType: ProductEngineEventDraft["eventType"],
  inputRef: ProductEngineEffectPlanItem["inputRef"],
  priority: ProductEngineEffectPlanItem["priority"]
): ProductEngineEffectPlanItem {
  return {
    effectType: "queue_projection_effect",
    idempotencyKey: `${command.commandId}:${sourceEventType}:decision_queue`,
    sourceCommandId: command.commandId,
    sourceEventTypes: [sourceEventType],
    correlationId: command.correlationId,
    priority,
    inputRef,
    previewPolicy: "auto_low_risk"
  };
}

function researchEvidenceEffect(
  command: ProductEngineCommand,
  sourceEventTypes: readonly ProductEngineEventDraft["eventType"][],
  inputRef: ProductEngineEffectPlanItem["inputRef"],
  priority: ProductEngineEffectPlanItem["priority"],
  idempotencyKey: string,
  runAfter?: string
): ProductEngineEffectPlanItem {
  return {
    effectType: "research_evidence_effect",
    idempotencyKey,
    sourceCommandId: command.commandId,
    sourceEventTypes,
    correlationId: command.correlationId,
    priority,
    inputRef,
    previewPolicy: "manual_handoff_required",
    ...(runAfter ? { runAfter } : {})
  };
}

function codexRuntimePreviewEffect(
  command: ProductEngineCommand,
  turnPurpose: CodexTurnPurpose,
  contextHash: string
): ProductEngineEffectPlanItem {
  return {
    effectType: "codex_runtime_preview_effect",
    idempotencyKey: `codex:${command.sessionId}:${turnPurpose}:${contextHash}:${CODEX_RUNTIME_ADAPTER_VERSION}`,
    sourceCommandId: command.commandId,
    sourceEventTypes: ["RuntimePreviewRequested"],
    correlationId: command.correlationId,
    priority: "normal",
    inputRef: {
      refType: "RuntimePreviewRequest",
      refId: `${turnPurpose}:${contextHash}`
    },
    previewPolicy: "manual_handoff_required"
  };
}

function isCodexTurnPurpose(value: unknown): value is CodexTurnPurpose {
  return typeof value === "string" && CODEX_TURN_PURPOSES.includes(value as CodexTurnPurpose);
}

function isCodexArtifactKind(value: unknown): value is CodexArtifactKind {
  return typeof value === "string" && CODEX_ARTIFACT_KINDS.includes(value as CodexArtifactKind);
}

function isCodexApplyPolicy(value: unknown): value is CodexApplyPolicy {
  return typeof value === "string" && CODEX_APPLY_POLICIES.includes(value as CodexApplyPolicy);
}

function isBlockedActionType(value: unknown): value is BlockedActionType {
  return typeof value === "string" && BLOCKED_ACTION_TYPES.includes(value as BlockedActionType);
}

function requiredNonEmptyStringArray(value: unknown): readonly string[] | "invalid" {
  if (!Array.isArray(value) || value.length === 0) {
    return "invalid";
  }

  const strings = value.map((item) => (typeof item === "string" ? item.trim() : ""));

  return strings.every(Boolean) ? strings : "invalid";
}

function runtimeArtifactIdFor(
  sessionIdValue: SessionId,
  turnPurpose: CodexTurnPurpose,
  contextHash: string,
  runtimeAdapterVersion: string
): RuntimeArtifactId {
  return `runtime_artifact_${stableToken(
    `${sessionIdValue}:${turnPurpose}:${contextHash}:${runtimeAdapterVersion}`
  )}` as RuntimeArtifactId;
}

function isRuntimeArtifactBlocked(artifact: RuntimePreviewArtifact) {
  return Boolean(artifact.blockedAction) || artifact.status === "blocked" || artifact.applyPolicy === "blocked";
}

function runtimePreviewQueueItem(artifact: RuntimePreviewArtifact) {
  const isBlocked = isRuntimeArtifactBlocked(artifact);

  return {
    queueItemId: `runtime_preview_${artifact.artifactId}` as QueueItemId,
    title: isBlocked ? `Runtime blocked: ${artifact.summary}` : `Runtime preview: ${artifact.summary}`,
    state: isBlocked ? ("blocked" as const) : ("next" as const)
  };
}

function queueProjectionWithRuntimePreviewItem(
  projection: DecisionQueueProjection,
  artifact: RuntimePreviewArtifact,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, runtimePreviewQueueItem(artifact), version, generatedAt);
}

function completionCandidateQueueItem(projection: ConfidenceCompletionProjection) {
  const isCandidate = projection.completionCandidate.status === "candidate";

  return {
    queueItemId: `completion_candidate_${projection.sessionId}` as QueueItemId,
    title: isCandidate
      ? `Completion candidate: Founder Brief ready (${projection.compositeScore})`
      : `Completion blocked: ${projection.completionCandidate.gateFailures[0] ?? "Gate failure"}`,
    state: isCandidate ? ("next" as const) : ("blocked" as const)
  };
}

function queueProjectionWithCompletionCandidate(
  projection: DecisionQueueProjection,
  confidenceProjection: ConfidenceCompletionProjection,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, completionCandidateQueueItem(confidenceProjection), version, generatedAt);
}

function decisionIdForSpecUpdatePreview(previewRef: string): DecisionId {
  const stablePreviewToken = previewRef.replace(/^spec_update_/, "");

  return `decision_${stablePreviewToken}` as DecisionId;
}

function decisionQueueItemId(decisionId: DecisionId): QueueItemId {
  return `decision_card_${decisionId}` as QueueItemId;
}

function specUpdateDecisionQueueItem(decisionId: DecisionId, title: string) {
  return {
    queueItemId: decisionQueueItemId(decisionId),
    title,
    state: "next" as const
  };
}

function queueProjectionWithSpecUpdateDecision(
  projection: DecisionQueueProjection,
  decisionId: DecisionId,
  title: string,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, specUpdateDecisionQueueItem(decisionId, title), version, generatedAt);
}

function completenessDeterministicOutputs(
  command: ProductEngineCommand,
  projection: ConfidenceCompletionProjection
): ProductEngineReduction["deterministicOutputs"] {
  return [
    {
      outputType: "completeness_snapshot",
      outputRef: `completeness:${command.sessionId}:${projection.version}`,
      payload: {
        compositeScore: projection.compositeScore,
        readinessLabel: projection.readinessLabel,
        gateFailures: projection.completionCandidate.gateFailures
      }
    },
    {
      outputType: "confidence_map",
      outputRef: `confidence:${command.sessionId}:${projection.version}`,
      payload: {
        axes: projection.axes
      }
    }
  ];
}

function runtimeProjectionWithArtifact(
  projection: RuntimeActivityProjection,
  artifact: RuntimePreviewArtifact,
  version: ProjectionVersion
): RuntimeActivityProjection {
  const artifacts = [
    ...projection.runtimeArtifacts.filter((candidate) => candidate.artifactId !== artifact.artifactId),
    artifact
  ];
  const hasBlocked = artifacts.some((candidate) => candidate.status === "blocked");
  const hasManualHandoff = artifacts.some((candidate) => candidate.status === "manual_handoff");

  return {
    ...projection,
    version,
    runtimeArtifacts: artifacts,
    runtimeStatus: hasBlocked ? "blocked" : hasManualHandoff ? "unavailable" : "available"
  };
}

function blockedArtifactFromConversion(
  command: ProductEngineCommand,
  artifact: RuntimePreviewArtifact
): RuntimePreviewArtifact {
  const blockReason =
    requiredString(command.payload.blockReason) ??
    artifact.blockedAction?.reason ??
    "Runtime artifact conversion was blocked by Phase 1 preview-only policy.";
  const blockedActionType = isBlockedActionType(command.payload.blockedActionType)
    ? command.payload.blockedActionType
    : artifact.blockedAction?.actionType;
  const payload = {
    ...artifact.payload,
    title: `Runtime artifact blocked: ${artifact.summary}`,
    body: blockReason,
    targetObject: "blocked_action",
    sourceRefs: artifact.sourceRefs,
    blockReason,
    originalArtifactId: artifact.artifactId
  };

  return {
    ...artifact,
    kind: "BlockedActionArtifact",
    applyPolicy: "blocked",
    status: "blocked",
    targetObject: "blocked_action",
    summary: `Runtime artifact blocked: ${artifact.summary}`,
    payload,
    ...(blockedActionType
      ? {
          blockedAction: {
            actionType: blockedActionType,
            reason: blockReason,
            ...(artifact.blockedAction?.suggestedSafeAlternative
              ? { suggestedSafeAlternative: artifact.blockedAction.suggestedSafeAlternative }
              : {})
          }
        }
      : {})
  };
}

function validResearchImpact(value: unknown): ResearchImpact {
  return value === "low" || value === "medium" || value === "high" ? value : "high";
}

function optionalResearchSourceReliability(value: unknown): ResearchSourceReliability | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  return value === "high" || value === "medium" || value === "low" || value === "unknown" ? value : "invalid";
}

function optionalPositiveInteger(value: unknown): number | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : "invalid";
}

function routeOutcomeForAnswer(command: ProductEngineCommand): ResearchRouteOutcome {
  if (command.payload.researchRouteHint === "research_needed" || command.payload.researchRouteHint === "missing_con_evidence") {
    return command.payload.researchRouteHint;
  }

  if (command.payload.evidenceBalanceHint === "pro_only") {
    return "missing_con_evidence";
  }

  const answer = typeof command.payload.answer === "string" ? command.payload.answer.toLowerCase() : "";

  return answer.includes("pro-only") || answer.includes("찬성만") || answer.includes("반대근거")
    ? "missing_con_evidence"
    : "research_needed";
}

function researchReviewQueueItem(researchTaskId: ResearchTaskId, title: string, state: "next" | "blocked") {
  return {
    queueItemId: `research_review_${researchTaskId}` as QueueItemId,
    title,
    state,
    cardType: "research_review" as const,
    researchTaskId
  };
}

function queueProjectionWithResearchReviewItem(
  projection: DecisionQueueProjection,
  researchTaskId: ResearchTaskId,
  title: string,
  state: "next" | "blocked",
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(
    projection,
    researchReviewQueueItem(researchTaskId, title, state),
    version,
    generatedAt
  );
}

function researchCardQueueMetadata(
  card: ResearchReviewCardProjection,
  overrides: {
    readonly blocksPlanning?: boolean;
    readonly terminalOutcome?: ResearchQueueTerminalOutcome;
    readonly terminalRationale?: string;
  } = {}
): Omit<QueueItemProjection, "queueItemId" | "title" | "state"> {
  const terminalOutcome = overrides.terminalOutcome ?? card.terminalOutcome;
  const terminalRationale = overrides.terminalRationale ?? card.terminalRationale;

  return {
    cardType: card.cardType,
    researchTaskId: card.researchTaskId,
    ...(card.evidencePackId ? { evidencePackId: card.evidencePackId } : {}),
    ...(card.additionalQuestions?.length ? { additionalQuestions: card.additionalQuestions } : {}),
    blocksPlanning: overrides.blocksPlanning ?? card.blocksPlanning,
    availableOutcomes: card.availableOutcomes,
    ...(terminalOutcome ? { terminalOutcome } : {}),
    ...(terminalRationale ? { terminalRationale } : {})
  };
}

function queueProjectionWithResearchCard(
  projection: DecisionQueueProjection,
  card: ResearchReviewCardProjection,
  state: "next" | "blocked",
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(
    projection,
    {
      queueItemId: card.cardId,
      title: card.title,
      state,
      ...researchCardQueueMetadata(card)
    },
    version,
    generatedAt
  );
}

function queueProjectionAfterResearchCardResolution(
  projection: DecisionQueueProjection,
  card: ResearchReviewCardProjection,
  outcome: ResearchQueueTerminalOutcome,
  rationale: string | undefined,
  version: ProjectionVersion,
  generatedAt?: string
): DecisionQueueProjection {
  if (outcome === "deferred") {
    return queueProjectionWithDeferredItem(
      projection,
      {
        queueItemId: card.cardId,
        title: `Research deferred: ${card.title}`,
        state: "deferred",
        ...researchCardQueueMetadata(card, {
          blocksPlanning: card.impact === "high",
          terminalOutcome: outcome,
          ...(rationale ? { terminalRationale: rationale } : {})
        })
      },
      version,
      generatedAt
    );
  }

  if (outcome === "research_insufficient") {
    return queueProjectionWithNextOrBlockedItem(
      projection,
      {
        queueItemId: card.cardId,
        title: `Research insufficient: ${card.title}`,
        state: "blocked",
        ...researchCardQueueMetadata(card, {
          blocksPlanning: card.impact === "high",
          terminalOutcome: outcome,
          ...(rationale ? { terminalRationale: rationale } : {})
        })
      },
      version,
      generatedAt
    );
  }

  return queueProjectionWithoutItem(projection, card.cardId, version, generatedAt);
}

function evidenceReviewQueueTitle(
  task: ResearchTaskProjection,
  matrix: EvidenceMatrixProjection,
  gateStatus?: "accepted" | "needs_review" | "research_insufficient" | "stale"
) {
  if (gateStatus === "stale") {
    return `Research stale: ${task.objective}`;
  }

  if (gateStatus === "needs_review") {
    return `Quality gate review required: ${task.objective}`;
  }

  if (gateStatus === "research_insufficient" && matrix.balanceStatus === "balanced") {
    return `Evidence still insufficient: ${task.objective}`;
  }

  if (matrix.balanceStatus === "balanced") {
    return `Evidence ready: ${task.objective}`;
  }

  return matrix.decisionBlocked ? `Decision blocked: ${task.objective}` : `Known risk: ${task.objective}`;
}

function evidenceReviewQueueState(
  matrix: EvidenceMatrixProjection,
  gateStatus?: "accepted" | "needs_review" | "research_insufficient" | "stale"
): "next" | "blocked" {
  return matrix.decisionBlocked || gateStatus === "needs_review" || gateStatus === "research_insufficient" || gateStatus === "stale"
    ? "blocked"
    : "next";
}

function acceptedMultiEventReduction(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  events: readonly ProductEngineEventDraft[],
  patch: ProductEngineReduction["nextState"],
  deterministicOutputs: ProductEngineReduction["deterministicOutputs"],
  effectPlan: readonly ProductEngineEffectPlanItem[] = [],
  immediateProjection?: ActiveBatchSafeProjection
): ProductEngineReduction {
  return {
    accepted: true,
    events,
    nextState: {
      stateVersion: (numericVersion(state.stateVersion) + events.length) as StateVersion,
      ...patch
    },
    effectPlan,
    deterministicOutputs,
    ...(immediateProjection ? { immediateProjection } : {})
  };
}

function projectionPayload<TProjection>(payload: ProductEngineEvent["payload"], fallback: TProjection): TProjection {
  return typeof payload.projection === "object" && payload.projection !== null
    ? (payload.projection as TProjection)
    : fallback;
}

function objectPayload<TValue>(payload: ProductEngineEvent["payload"], key: string): TValue | null {
  const value = payload[key];

  return typeof value === "object" && value !== null ? (value as TValue) : null;
}

function confidenceProjectionPayload(payload: ProductEngineEvent["payload"]) {
  return objectPayload<ConfidenceCompletionProjection>(payload, "confidenceProjection");
}

function queueProjectionPayload(payload: ProductEngineEvent["payload"]) {
  return objectPayload<DecisionQueueProjection>(payload, "queueProjection");
}

export function sessionPhaseForProductEngineEvent(
  event: ProductEngineEvent
): ProductEngineStateSnapshot["session"]["phase"] | null {
  switch (event.eventType) {
    case "ProjectStarted":
      return "intake";
    case "InitialSpecDrafted":
      return "spec";
    case "QuestionBatchActivated":
      return "question_loop";
    case "ResearchPlanned":
    case "ResearchResultImported":
    case "EvidenceSynthesisRequested":
    case "EvidenceSynthesized":
    case "ResearchQueueCardResolved":
      return "research";
    case "CompletenessScored":
      return event.payload.candidateStatus === "candidate" ? "completion" : null;
    case "FounderBriefPrepared":
      return event.payload.exportReady === true ? "completion" : null;
    default:
      return null;
  }
}

export function sessionShellPhaseForProductEnginePhase(
  phase: ProductEngineStateSnapshot["session"]["phase"]
): SessionShellProjection["phase"] {
  switch (phase) {
    case "spec":
      return "spec";
    case "question_loop":
    case "research":
      return "validation";
    case "completion":
      return "complete";
    case "intake":
      return "intake";
  }
}

function reduceStartProject(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const rawIdea = requiredString(command.payload.rawIdea);
  const localPrivacyMode = command.payload.localPrivacyMode;
  const requestedMode = projectPurposeModeFromPayload(command.payload.projectPurposeMode);
  const suggestedMode = projectPurposeModeFromPayload(command.payload.suggestedProjectPurposeMode);
  const requestedIntensity = businessCriticIntensityFromPayload(command.payload.businessCriticIntensity);
  const requestedResearchAutomationPermission = researchAutomationPermissionFromPayload(
    command.payload.initialResearchAutomationPermission
  );

  if (!rawIdea || !isPrivacyMode(localPrivacyMode)) {
    return reject("StartProject requires rawIdea and a valid local privacy mode.", "VALIDATION_FAILED");
  }

  if (requestedMode === "invalid" || suggestedMode === "invalid" || !requestedMode) {
    return reject("StartProject requires a supported user-confirmed projectPurposeMode.", "VALIDATION_FAILED");
  }

  if (requestedIntensity === "invalid") {
    return reject("StartProject businessCriticIntensity must be balanced, strong, or investor_grade.", "VALIDATION_FAILED");
  }

  if (requestedResearchAutomationPermission === "invalid") {
    return reject(
      "StartProject initialResearchAutomationPermission must be manual_only, allow_codex, or allow_codex_and_chatgpt_visible.",
      "VALIDATION_FAILED"
    );
  }

  if (requestedMode === "personal" && requestedIntensity) {
    return reject("StartProject accepts businessCriticIntensity only for business projects.", "VALIDATION_FAILED");
  }

  if (requestedMode === "business" && requestedIntensity && command.payload.businessCriticIntensityConfirmation !== "user_confirmed") {
    return reject(
      "StartProject requires businessCriticIntensityConfirmation to be user_confirmed when intensity is provided.",
      "VALIDATION_FAILED",
      { businessCriticIntensitySelectionStatus: "intensity_required" }
    );
  }

  if (command.payload.projectPurposeModeConfirmation !== "user_confirmed") {
    return reject("StartProject requires projectPurposeModeConfirmation to be user_confirmed.", "VALIDATION_FAILED", {
      projectPurposeModeSelectionStatus: "mode_required"
    });
  }

  if (numericVersion(state.stateVersion) !== 0) {
    return reject("StartProject can only initialize an empty ProductEngine state.");
  }

  const projectPurposeMode = requestedMode;
  const businessCriticIntensity = requestedMode === "business" ? requestedIntensity : null;
  const initialResearchAutomationPermission = requestedResearchAutomationPermission ?? "manual_only";
  const projectPurposeModeExplicitReason = requiredString(command.payload.projectPurposeModeReason) ?? undefined;
  const businessCriticIntensityExplicitReason =
    requiredString(command.payload.businessCriticIntensityReason) ??
    (businessCriticIntensity
      ? `${businessCriticIntensityLabel(businessCriticIntensity)}으로 사용자 확인된 사업 검증 강도입니다.`
      : undefined);
  const initialProjectPurposeModeAuditEntry: ProjectPurposeModeAuditSnapshot = {
    newMode: projectPurposeMode,
    reason: purposeModeReason(projectPurposeMode, projectPurposeModeExplicitReason),
    actor: "user",
    changedAt: command.issuedAt,
    ...(suggestedMode ? { suggestedMode } : {})
  };
  const projectPurposeModeAudit = [initialProjectPurposeModeAuditEntry] as const;
  const businessCriticIntensityAudit = businessCriticIntensity
    ? ([
        {
          newIntensity: businessCriticIntensity,
          reason: businessCriticIntensityExplicitReason ?? businessCriticIntensityEffect(businessCriticIntensity),
          actor: "user",
          changedAt: command.issuedAt
        } satisfies BusinessCriticIntensityAuditSnapshot
      ] as const)
    : ([] as const);
  const projection = createSessionShellProjection(
    command,
    projectionVersionFor(state),
    projectPurposeMode,
    "intake",
    businessCriticIntensity,
    initialResearchAutomationPermission
  );
  const event = eventDraft(command, "ProjectStarted", {
    rawIdea,
    localPrivacyMode,
    projectPurposeMode,
    projectPurposeModeLabel: projectPurposeModeLabel(projectPurposeMode),
    projectPurposeModeEffect: projectPurposeModeEffect(projectPurposeMode),
    projectPurposeModeReason: initialProjectPurposeModeAuditEntry.reason,
    projectPurposeModeConfirmation: "user_confirmed",
    ...(suggestedMode ? { suggestedProjectPurposeMode: suggestedMode } : {}),
    projectPurposeModeAudit,
    ...businessCriticProjectFields(projectPurposeMode, businessCriticIntensity),
    ...(businessCriticIntensity
      ? {
          businessCriticIntensityReason: businessCriticIntensityExplicitReason,
          businessCriticIntensityConfirmation: "user_confirmed",
          businessCriticIntensityAudit
        }
      : { businessCriticIntensityAudit }),
    initialResearchAutomationPermission,
    sourceNote: typeof command.payload.sourceNote === "string" ? command.payload.sourceNote : undefined,
    sessionPhase: "intake",
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      project: {
        projectId: command.projectId,
        privacyMode: localPrivacyMode,
        projectPurposeMode,
        projectPurposeModeSelectionStatus: "confirmed",
        projectPurposeModeLabel: projectPurposeModeLabel(projectPurposeMode),
        projectPurposeModeReason: initialProjectPurposeModeAuditEntry.reason,
        projectPurposeModeAudit,
        ...businessCriticProjectFields(projectPurposeMode, businessCriticIntensity),
        ...(businessCriticIntensityExplicitReason
          ? { businessCriticIntensityReason: businessCriticIntensityExplicitReason }
          : {}),
        businessCriticIntensityAudit,
        initialResearchAutomationPermission,
        rawIdeaText: rawIdea
      },
      session: {
        sessionId: command.sessionId,
        phase: "intake"
      },
      sessionShellProjection: projection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `project:${command.projectId}:session:${command.sessionId}`,
        payload: {
          rawIdea,
          localPrivacyMode,
          projectPurposeMode,
          projectPurposeModeLabel: projectPurposeModeLabel(projectPurposeMode),
          businessCriticIntensitySelectionStatus: businessCriticIntensitySelectionStatus(projectPurposeMode, businessCriticIntensity),
          ...(businessCriticIntensity ? { businessCriticIntensity } : {}),
          initialResearchAutomationPermission
        }
      }
    ],
    [],
    projection
  );
}

function reduceChangeProjectPurposeMode(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const requestedMode = projectPurposeModeFromPayload(command.payload.projectPurposeMode);
  const suggestedMode = projectPurposeModeFromPayload(command.payload.suggestedProjectPurposeMode);
  const reason = requiredString(command.payload.reason);

  if (numericVersion(state.stateVersion) < 1) {
    return reject("ChangeProjectPurposeMode requires an initialized project.");
  }

  if (requestedMode === "invalid" || suggestedMode === "invalid" || !requestedMode || !reason) {
    return reject("ChangeProjectPurposeMode requires a supported projectPurposeMode and a user-visible reason.", "VALIDATION_FAILED");
  }

  if (requestedMode === state.project.projectPurposeMode) {
    return reject("ChangeProjectPurposeMode requires a new mode different from the current project purpose mode.");
  }

  const auditActor: ProjectPurposeModeAuditActor =
    command.actor === "product_engine" || command.actor === "system" ? command.actor : "user";
  const auditEntry: ProjectPurposeModeAuditSnapshot = {
    newMode: requestedMode,
    reason,
    actor: auditActor,
    changedAt: command.issuedAt,
    ...(state.project.projectPurposeMode ? { previousMode: state.project.projectPurposeMode } : {}),
    ...(suggestedMode ? { suggestedMode } : {})
  };
  const retainedBusinessCriticIntensity =
    requestedMode === "business" ? state.project.businessCriticIntensity : null;
  const projection = createSessionShellProjection(
    command,
    projectionVersionFor(state),
    requestedMode,
    sessionShellPhaseForProductEnginePhase(state.session.phase),
    retainedBusinessCriticIntensity,
    state.project.initialResearchAutomationPermission
  );
  const queueProjection = queueProjectionWithPurposeMetadata(
    state.queueProjection,
    projectionVersionFor(state),
    command.sessionId,
    command.issuedAt,
    requestedMode,
    retainedBusinessCriticIntensity
  );
  const event = eventDraft(command, "ProjectPurposeModeChanged", {
    newMode: requestedMode,
    ...(state.project.projectPurposeMode ? { previousMode: state.project.projectPurposeMode } : {}),
    projectPurposeModeLabel: projectPurposeModeLabel(requestedMode),
    projectPurposeModeEffect: projectPurposeModeEffect(requestedMode),
    reason,
    actor: auditEntry.actor,
    changedAt: command.issuedAt,
    ...(suggestedMode ? { suggestedProjectPurposeMode: suggestedMode } : {}),
    ...businessCriticProjectFields(requestedMode, retainedBusinessCriticIntensity),
    projection,
    queueProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      project: {
        ...state.project,
        projectPurposeMode: requestedMode,
        projectPurposeModeSelectionStatus: "confirmed",
        projectPurposeModeLabel: projectPurposeModeLabel(requestedMode),
        projectPurposeModeReason: reason,
        projectPurposeModeAudit: [...state.project.projectPurposeModeAudit, auditEntry],
        ...businessCriticProjectFields(requestedMode, retainedBusinessCriticIntensity),
        businessCriticIntensity: retainedBusinessCriticIntensity ?? undefined,
        ...(requestedMode !== "business"
          ? {
              businessCriticIntensityLabel: undefined,
              businessCriticIntensityEffect: undefined
            }
          : {}),
        businessCriticIntensityReason:
          retainedBusinessCriticIntensity && state.project.businessCriticIntensityReason
            ? state.project.businessCriticIntensityReason
            : undefined,
        businessCriticIntensityAudit:
          requestedMode === "business" ? (state.project.businessCriticIntensityAudit ?? []) : []
      },
      queueProjection,
      sessionShellProjection: projection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `project-purpose-mode:${command.projectId}:${command.sessionId}:${requestedMode}`,
        payload: {
          newMode: requestedMode,
          ...(state.project.projectPurposeMode ? { previousMode: state.project.projectPurposeMode } : {}),
          projectPurposeModeLabel: projectPurposeModeLabel(requestedMode),
          businessCriticIntensitySelectionStatus: businessCriticIntensitySelectionStatus(
            requestedMode,
            retainedBusinessCriticIntensity
          ),
          ...(retainedBusinessCriticIntensity ? { businessCriticIntensity: retainedBusinessCriticIntensity } : {}),
          reason
        }
      }
    ],
    [],
    projection
  );
}

function reduceChangeBusinessCriticIntensity(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const requestedIntensity = businessCriticIntensityFromPayload(command.payload.businessCriticIntensity);
  const reason = requiredString(command.payload.reason);

  if (numericVersion(state.stateVersion) < 1) {
    return reject("ChangeBusinessCriticIntensity requires an initialized project.");
  }

  if (state.project.projectPurposeMode !== "business") {
    return reject("ChangeBusinessCriticIntensity requires business projectPurposeMode.", "COMMAND_PRECONDITION_FAILED", {
      projectPurposeMode: state.project.projectPurposeMode ?? "mode_required"
    });
  }

  if (requestedIntensity === "invalid" || !requestedIntensity || !reason) {
    return reject(
      "ChangeBusinessCriticIntensity requires balanced, strong, or investor_grade and a user-visible reason.",
      "VALIDATION_FAILED"
    );
  }

  if (command.payload.businessCriticIntensityConfirmation !== "user_confirmed") {
    return reject("ChangeBusinessCriticIntensity requires businessCriticIntensityConfirmation to be user_confirmed.", "VALIDATION_FAILED");
  }

  if (requestedIntensity === state.project.businessCriticIntensity) {
    return reject("ChangeBusinessCriticIntensity requires a different intensity.");
  }

  const auditActor: ProjectPurposeModeAuditActor =
    command.actor === "product_engine" || command.actor === "system" ? command.actor : "user";
  const auditEntry: BusinessCriticIntensityAuditSnapshot = {
    newIntensity: requestedIntensity,
    reason,
    actor: auditActor,
    changedAt: command.issuedAt,
    ...(state.project.businessCriticIntensity ? { previousIntensity: state.project.businessCriticIntensity } : {})
  };
  const version = projectionVersionFor(state);
  const projection = createSessionShellProjection(
    command,
    version,
    "business",
    sessionShellPhaseForProductEnginePhase(state.session.phase),
    requestedIntensity,
    state.project.initialResearchAutomationPermission
  );
  const hasAnalyzedAmbiguityIssueSet = state.openIssues.length > 0;
  const generatedPressureIssues = state.currentSpec.draftRef && hasAnalyzedAmbiguityIssueSet
    ? createAmbiguityIssues(
        command.sessionId,
        state.currentSpec.draftRef,
        "business",
        requestedIntensity,
        onboardingQuestionContextFromState(state)
      ).filter(isElevatedBusinessCriticIssue)
    : [];
  const retainedOpenIssues = retainedIssuesForBusinessCriticIntensity(
    state.openIssues,
    state.queueProjection.active,
    requestedIntensity
  );
  const existingTopicKeys = new Set(retainedOpenIssues.map((issue) => issue.topicKey).filter(Boolean));
  const newPressureIssues = generatedPressureIssues.filter((issue) => !existingTopicKeys.has(issue.topicKey));
  const nextOpenIssues = [...retainedOpenIssues, ...newPressureIssues];
  const queueWithMetadata = queueProjectionWithBusinessCriticIntensity(
    state.queueProjection,
    version,
    command.sessionId,
    command.issuedAt,
    requestedIntensity
  );
  const pressureQueueItems = nextOpenIssues
    .filter(
      (issue) =>
        issue.status === "open" &&
        isElevatedBusinessCriticIssue(issue) &&
        isBusinessCriticIssueAllowedAtIntensity(issue, requestedIntensity)
    )
    .map((issue) => queueItemProjectionFromIssue(issue, "next"));
  const existingQueueItemIds = new Set([
    ...queueWithMetadata.active,
    ...queueWithMetadata.next,
    ...queueWithMetadata.blocked,
    ...queueWithMetadata.deferred
  ].map((item) => item.queueItemId));
  const pressureQueueItemsToAppend = pressureQueueItems.filter((item) => !existingQueueItemIds.has(item.queueItemId));
  const queueProjectionWithoutProgress = pressureQueueItemsToAppend.length
    ? refreshQueueProjectionMetadata(
        {
          ...queueWithMetadata,
          next: [...queueWithMetadata.next, ...pressureQueueItemsToAppend]
        },
        version,
        command.issuedAt
      )
    : queueWithMetadata;
  const queueProjection = refreshQueueProjectionMetadata(
    queueProjectionWithQuestionProgress(queueProjectionWithoutProgress, nextOpenIssues),
    version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      project: {
        ...state.project,
        ...businessCriticProjectFields("business", requestedIntensity),
        businessCriticIntensity: requestedIntensity,
        businessCriticIntensityReason: reason,
        businessCriticIntensityAudit: [...(state.project.businessCriticIntensityAudit ?? []), auditEntry]
      },
      openIssues: nextOpenIssues,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "BusinessCriticIntensityChanged", {
    newIntensity: requestedIntensity,
    ...(state.project.businessCriticIntensity ? { previousIntensity: state.project.businessCriticIntensity } : {}),
    businessCriticIntensityLabel: businessCriticIntensityLabel(requestedIntensity),
    businessCriticIntensityEffect: businessCriticIntensityEffect(requestedIntensity),
    businessCriticPressureSummary: BUSINESS_CRITIC_PRESSURE_SUMMARY[requestedIntensity],
    reason,
    actor: auditEntry.actor,
    changedAt: command.issuedAt,
    queuedNextCriticalItemCount: pressureQueueItemsToAppend.length,
    openIssues: nextOpenIssues,
    ...(newPressureIssues.length ? { newPressureIssues } : {}),
    projection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      project: {
        ...state.project,
        ...businessCriticProjectFields("business", requestedIntensity),
        businessCriticIntensity: requestedIntensity,
        businessCriticIntensityReason: reason,
        businessCriticIntensityAudit: [...(state.project.businessCriticIntensityAudit ?? []), auditEntry]
      },
      openIssues: nextOpenIssues,
      queueProjection,
      completeness: confidenceProjection,
      sessionShellProjection: projection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `business-critic-intensity:${command.projectId}:${command.sessionId}:${requestedIntensity}`,
        payload: {
          businessCriticIntensity: requestedIntensity,
          queuedNextCriticalItemCount: pressureQueueItemsToAppend.length,
          businessCriticPressureSummary: BUSINESS_CRITIC_PRESSURE_SUMMARY[requestedIntensity]
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    pressureQueueItemsToAppend.length
      ? [
          queueProjectionEffect(
            command,
            "BusinessCriticIntensityChanged",
            {
              refType: "queue_item",
              refId: `business_critic_intensity:${requestedIntensity}`
            },
            "high"
          )
        ]
      : [],
    projection
  );
}

function reduceCaptureIntake(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const answer = requiredString(command.payload.answer);

  if (!answer) {
    return reject("CaptureIntake requires a non-empty answer.", "VALIDATION_FAILED");
  }

  if (numericVersion(state.stateVersion) < 1) {
    return reject("CaptureIntake requires an initialized project.");
  }

  const intakeRef = `intake_${stableToken(`${command.sessionId}:${answer}`)}`;
  const event = eventDraft(command, "IntakeCaptured", {
    intakeRef,
    answer,
    source: "user_intake"
  });

  return acceptedReduction(command, state, event, { intake: { intakeRef, answer } }, [
    {
      outputType: "reducer_deterministic_output",
      outputRef: intakeRef,
      payload: {
        normalizedAnswer: answer
      }
    }
  ]);
}

function reduceDraftInitialSpec(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (numericVersion(state.stateVersion) < 2 || !state.intake?.answer) {
    return reject("DraftInitialSpec requires captured intake.");
  }

  if (state.currentSpec.draftRef) {
    return reject("Initial spec draft already exists.");
  }

  const draftRef = `spec_draft_${stableToken(`${command.sessionId}:${state.intake.answer}`)}`;
  const sections = CANONICAL_INITIAL_SPEC_SECTIONS;
  const title = `초기 제품 스펙 초안: ${state.project.rawIdeaText ?? "Untitled idea"}`;
  const projection = createLivingSpecProjection(command, projectionVersionFor(state), title, sections);
  const event = eventDraft(command, "InitialSpecDrafted", {
    draftRef,
    title,
    sections,
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      currentSpec: {
        draftRef,
        title,
        sections
      },
      livingSpecProjection: projection
    },
    [
      {
        outputType: "initial_spec_draft",
        outputRef: draftRef,
        payload: {
          sections
        }
      }
    ],
    [],
    projection
  );
}

function reduceAnalyzeAmbiguity(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("AnalyzeAmbiguity requires an initial spec draft.");
  }

  if (state.openIssues.some((issue) => issue.status === "open")) {
    return reject("AnalyzeAmbiguity cannot run while open ambiguity issues already exist.");
  }

  const confirmedMode = requireConfirmedProjectPurposeMode(state, "AnalyzeAmbiguity");
  if (typeof confirmedMode !== "string") {
    return confirmedMode;
  }

  if (confirmedMode === "business" && !state.project.businessCriticIntensity) {
    return reject(
      "AnalyzeAmbiguity requires a user-confirmed businessCriticIntensity for business projects.",
      "COMMAND_PRECONDITION_FAILED",
      {
        businessCriticIntensitySelectionStatus: "intensity_required",
        requiredUserAction: "select_business_critic_intensity"
      }
    );
  }

  const context = onboardingQuestionContextFromState(state);
  const hasGeneratedQuestionSetPayload = hasOwnRecordKey(command.payload, "generatedQuestionSet");
  const generatedQuestionSet = hasGeneratedQuestionSetPayload
    ? parseGeneratedAmbiguityQuestionSet(command.payload.generatedQuestionSet, {
        contextText: generatedQuestionSetContextText(context)
      })
    : null;
  const usesGeneratedQuestionSet = generatedQuestionSet?.ok === true;
  const issues = usesGeneratedQuestionSet
    ? createAmbiguityIssuesFromSeeds({
        sessionId: command.sessionId,
        specRef: state.currentSpec.draftRef,
        mode: confirmedMode,
        intensity: state.project.businessCriticIntensity,
        context,
        seeds: generatedQuestionSet.questions,
        source: "generated_json"
      })
    : createAmbiguityIssues(
        command.sessionId,
        state.currentSpec.draftRef,
        confirmedMode,
        state.project.businessCriticIntensity,
        context
      );
  const questionGeneration = usesGeneratedQuestionSet
    ? {
        mode: "generated_json" as const,
        schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
        promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
        questionCount: issues.length
      }
    : {
        mode: "deterministic_fallback" as const,
        promptTemplateRef: GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF,
        reason: hasGeneratedQuestionSetPayload ? "generated_question_set_invalid" : "generated_question_set_missing",
        ...(generatedQuestionSet && generatedQuestionSet.issues.length
          ? { validationIssues: generatedQuestionSet.issues }
          : {})
      };
  const event = eventDraft(command, "AmbiguityAnalyzed", {
    targetRef: typeof command.payload.targetRef === "string" ? command.payload.targetRef : state.currentSpec.draftRef,
    issueCount: issues.length,
    issues,
    questionGeneration
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: issues
    },
    [
      {
        outputType: "ambiguity_analysis",
        outputRef: `ambiguity_${stableToken(`${command.sessionId}:${state.currentSpec.draftRef}`)}`,
        payload: {
          issueCount: issues.length,
          issues,
          questionGeneration
        }
      }
    ],
    [
      queueProjectionEffect(
        command,
        "AmbiguityAnalyzed",
        {
          refType: "ambiguity_issue_set",
          refId: state.currentSpec.draftRef
        },
        "normal"
      )
    ]
  );
}

function reduceActivateQuestionBatch(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const openIssues = state.openIssues.filter((issue) => issue.status === "open");
  const selectedQueueItemIds = queueItemIdSelection(command.payload.queueItemIds);

  if (selectedQueueItemIds === "invalid") {
    return reject("ActivateQuestionBatch queueItemIds must be unique non-empty strings.", "VALIDATION_FAILED");
  }

  const selectedIssues = selectedQueueItemIds
    ? selectedQueueItemIds.map((queueItemId) => openIssues.find((issue) => issue.queueItemId === queueItemId))
    : defaultQuestionBatchIssues(openIssues);

  if (selectedIssues.some((issue) => issue === undefined)) {
    return reject("ActivateQuestionBatch queueItemIds must reference open ambiguity issues.");
  }
  const candidateIssues = selectedIssues as readonly AmbiguityIssueSnapshot[];

  const minimumBatchSize = openIssues.length >= 3 ? 3 : 1;

  if (candidateIssues.length < minimumBatchSize || candidateIssues.length > DEFAULT_QUESTION_BATCH_SIZE) {
    return reject(
      openIssues.length >= 3
        ? "ActivateQuestionBatch requires 3 to 5 open ambiguity issues."
        : "ActivateQuestionBatch requires at least one remaining open ambiguity issue.",
      "VALIDATION_FAILED"
    );
  }

  if (hasDuplicateTopicKey(candidateIssues)) {
    return reject("ActivateQuestionBatch requires at most one open issue per topicKey.");
  }

  if (state.queueProjection.active.length > 0) {
    return reject("ActivateQuestionBatch cannot replace an already active batch.");
  }

  const confirmedMode = requireConfirmedProjectPurposeMode(state, "ActivateQuestionBatch");
  if (typeof confirmedMode !== "string") {
    return confirmedMode;
  }

  if (
    confirmedMode === "business" &&
    state.project.businessCriticIntensity &&
    businessCriticIntensityRank(state.project.businessCriticIntensity) >= businessCriticIntensityRank("strong") &&
    openIssues.some(isCoreAssumptionChallengeIssue) &&
    !candidateIssues.some(isCoreAssumptionChallengeIssue)
  ) {
    return reject(
      "ActivateQuestionBatch requires at least one core-assumption challenge for strong or investor-grade business critic intensity.",
      "COMMAND_PRECONDITION_FAILED",
      {
        businessCriticIntensity: state.project.businessCriticIntensity,
        requiredBusinessCriticPressureKind: "core_assumption_challenge"
      }
    );
  }

  const projection = queueProjectionFromIssues(
    openIssues,
    candidateIssues,
    projectionVersionFor(state),
    command.sessionId,
    command.issuedAt,
    confirmedMode,
    state.project.businessCriticIntensity
  );
  const event = eventDraft(command, "QuestionBatchActivated", {
    batchRef: `batch_${stableToken(`${command.sessionId}:${candidateIssues.map((issue) => issue.queueItemId).join(":")}`)}`,
    activeCount: projection.active.length,
    activeItems: projection.active,
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      queueProjection: projection
    },
    [
      {
        outputType: "active_question_batch",
        outputRef: String(event.payload.batchRef),
        payload: {
          activeItems: projection.active
        }
      }
    ],
    [
      queueProjectionEffect(
        command,
        "QuestionBatchActivated",
        {
          refType: "active_batch",
          refId: String(event.payload.batchRef)
        },
        "high"
      )
    ],
    projection
  );
}

interface QueueItemResolutionConfig {
  readonly commandType: "DeferQueueItem" | "DismissQueueItem";
  readonly eventType: "QueueItemDeferred" | "QueueItemDismissed";
  readonly issueStatus: Extract<AmbiguityIssueSnapshot["status"], "deferred" | "resolved">;
  readonly nextQueueProjection: (
    projection: DecisionQueueProjection,
    item: QueueItemProjection,
    version: ProjectionVersion,
    generatedAt: string
  ) => DecisionQueueProjection;
  readonly unavailableMessage: string;
}

function reduceQueueItemResolution(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  config: QueueItemResolutionConfig
): ProductEngineReduction {
  const queueItemId = requiredString(command.payload.queueItemId);
  const reason = requiredString(command.payload.reason);
  const nextValidationAction = requiredString(command.payload.nextValidationAction) ?? undefined;
  const riskDisposition = command.payload.riskDisposition;

  if (!queueItemId || !reason) {
    return reject(`${config.commandType} requires queueItemId and a non-empty reason.`, "VALIDATION_FAILED");
  }

  const typedQueueItemId = queueItemId as QueueItemId;
  const existingItem = queueItemFromProjection(state.queueProjection, typedQueueItemId);

  if (!existingItem) {
    return reject(`${config.commandType} requires an existing queue item.`, "RESOURCE_NOT_FOUND");
  }

  if (existingItem.state === config.issueStatus) {
    return reject(config.unavailableMessage, "COMMAND_PRECONDITION_FAILED");
  }

  if (
    config.commandType === "DeferQueueItem" &&
    riskDisposition === "known_risk_next_validation_action" &&
    !nextValidationAction
  ) {
    return reject(
      "DeferQueueItem requires nextValidationAction when riskDisposition is known_risk_next_validation_action.",
      "VALIDATION_FAILED"
    );
  }

  if (
    config.commandType === "DeferQueueItem" &&
    queueItemRequiresKnownRiskDeferral(existingItem) &&
    (riskDisposition !== "known_risk_next_validation_action" || !nextValidationAction)
  ) {
    return reject(
      "DeferQueueItem requires Known Risk + Next Validation Action for high-severity business critic items.",
      "COMMAND_PRECONDITION_FAILED",
      {
        queueItemId,
        businessCriticPressureKind: existingItem.businessCriticPressureKind,
        requiredRiskDisposition: "known_risk_next_validation_action"
      }
    );
  }

  if (config.commandType === "DismissQueueItem" && queueItemRequiresKnownRiskDeferral(existingItem)) {
    return reject(
      "DismissQueueItem cannot hide high-severity business critic items; defer with Known Risk + Next Validation Action instead.",
      "COMMAND_PRECONDITION_FAILED",
      {
        queueItemId,
        businessCriticPressureKind: existingItem.businessCriticPressureKind,
        businessCriticCategory: existingItem.businessCriticCategory,
        requiredRiskDisposition: "known_risk_next_validation_action"
      }
    );
  }

  const hasKnownRiskPatch =
    config.commandType === "DeferQueueItem" &&
    riskDisposition === "known_risk_next_validation_action" &&
    Boolean(nextValidationAction);
  const knownRiskPatch = hasKnownRiskPatch
    ? { knownRiskAccepted: true, nextValidationAction: nextValidationAction as string }
    : {};
  const projectionAfterResolution = config.nextQueueProjection(
    state.queueProjection,
    {
      ...existingItem,
      ...knownRiskPatch
    },
    projectionVersionFor(state),
    command.issuedAt
  );
  const nextOpenIssues = issuesWithQueueItemStatus(
    state.openIssues,
    typedQueueItemId,
    config.issueStatus,
    knownRiskPatch
  );
  const queueProjection = queueProjectionWithRefilledActiveQuestions(
    projectionAfterResolution,
    nextOpenIssues,
    projectionVersionFor(state),
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextOpenIssues,
      queueProjection
    },
    queueProjection.version
  );
  const event = eventDraft(command, config.eventType, {
    queueItemId,
    reason,
    ...(nextValidationAction ? { nextValidationAction } : {}),
    ...(hasKnownRiskPatch ? { knownRiskAccepted: true } : {}),
    ...(riskDisposition === "known_risk_next_validation_action" ? { riskDisposition } : {}),
    projection: queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: nextOpenIssues,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: queueItemId,
        payload: {
          queueItemId,
          reason,
          ...(nextValidationAction ? { nextValidationAction } : {}),
          ...(riskDisposition === "known_risk_next_validation_action" ? { riskDisposition } : {})
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        config.eventType,
        {
          refType: "queue_item",
          refId: queueItemId
        },
        "normal"
      )
    ],
    queueProjection
  );
}

function reduceDeferQueueItem(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  return reduceQueueItemResolution(command, state, {
    commandType: "DeferQueueItem",
    eventType: "QueueItemDeferred",
    issueStatus: "deferred",
    nextQueueProjection: (projection, item, version, generatedAt) =>
      queueProjectionWithDeferredItem(
        projection,
        {
          ...item,
          state: "deferred"
        },
        version,
        generatedAt
      ),
    unavailableMessage: "DeferQueueItem requires a queue item that is not already deferred."
  });
}

function reduceDismissQueueItem(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  return reduceQueueItemResolution(command, state, {
    commandType: "DismissQueueItem",
    eventType: "QueueItemDismissed",
    issueStatus: "resolved",
    nextQueueProjection: (projection, item, version, generatedAt) =>
      queueProjectionWithoutItem(projection, item.queueItemId, version, generatedAt),
    unavailableMessage: "DismissQueueItem requires a queue item that is not already resolved."
  });
}

function reduceSubmitAnswer(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const queueItemId = requiredString(command.payload.queueItemId);
  const answer = requiredString(command.payload.answer);

  if (!queueItemId || !answer) {
    return reject("SubmitAnswer requires queueItemId and a non-empty answer.", "VALIDATION_FAILED");
  }

  const activeItem = state.queueProjection.active.find((item) => item.queueItemId === queueItemId);

  if (!activeItem || activeItem.state !== "active") {
    return reject("SubmitAnswer requires an active question card.");
  }

  const confirmedMode = requireConfirmedProjectPurposeMode(state, "SubmitAnswer");
  if (typeof confirmedMode !== "string") {
    return confirmedMode;
  }

  const projectionAfterAnsweredItem = queueProjectionWithoutItem(
    state.queueProjection,
    queueItemId as QueueItemId,
    (numericVersion(state.stateVersion) + 2) as ProjectionVersion,
    command.issuedAt
  );
  const answerRef = `answer_${stableToken(`${command.sessionId}:${queueItemId}:${answer}`)}`;
  const routeOutcome = routeOutcomeForAnswer(command);
  const impact = validResearchImpact(command.payload.claimImpact);
  const sourceQuestion = state.openIssues.find((issue) => issue.queueItemId === queueItemId);
  const answerBranches = answerFollowUpBranches(answer);
  const explicitResearchObjective = requiredString(command.payload.researchObjective) ?? undefined;
  const researchTasks = answerBranches.map((branchAnswer, branchIndex) => {
    const branchCount = answerBranches.length;
    const branchSourceAnswerRef = branchAnswerRef(answerRef, branchCount, branchIndex);
    const objective = researchObjectiveForAnswerBranch({
      explicitObjective: explicitResearchObjective,
      activeItem,
      branchAnswer,
      branchCount,
      branchIndex,
      sourceQuestion
    });
    const researchTaskId = `research_task_${stableToken(
      branchCount === 1
        ? `${command.sessionId}:${queueItemId}:${answer}:${routeOutcome}`
        : `${command.sessionId}:${queueItemId}:${branchAnswer}:${routeOutcome}:${branchIndex}`
    )}` as ResearchTaskId;

    return planResearchTask({
      researchTaskId,
      sessionId: command.sessionId,
      sourceQueueItemId: queueItemId as QueueItemId,
      sourceAnswerRef: branchSourceAnswerRef,
      objective,
      projectPurposeMode: confirmedMode,
      projectPurposeModeLabel: projectPurposeModeLabel(confirmedMode),
      projectPurposeModeEffect: projectPurposeModeEffect(confirmedMode),
      skippedCommercializationAxes: skippedCommercializationAxes(confirmedMode),
      ...(state.project.businessCriticIntensity
        ? { businessCriticIntensity: state.project.businessCriticIntensity }
        : {}),
      ...(activeItem.businessCriticCategory ? { businessCriticCategory: activeItem.businessCriticCategory } : {}),
      routeOutcome,
      impact,
      createdAt: command.issuedAt
    });
  });
  const firstResearchTask = researchTasks[0];

  if (!firstResearchTask) {
    return reject("SubmitAnswer could not derive a research task from the answer.", "VALIDATION_FAILED");
  }

  const researchTaskId = firstResearchTask.researchTaskId;
  const queueProjectionWithReview = researchTasks.reduce((projection, researchTask, index) =>
    queueProjectionWithResearchReviewItem(
      projection,
      researchTask.researchTaskId,
      routeOutcome === "missing_con_evidence"
        ? `반대근거 탐색 필요${researchTasks.length > 1 ? ` ${index + 1}/${researchTasks.length}` : ""}: ${activeItem.title}`
        : `Research review${researchTasks.length > 1 ? ` ${index + 1}/${researchTasks.length}` : ""}: ${activeItem.title}`,
      routeOutcome === "missing_con_evidence" ? "blocked" : "next",
      projectionAfterAnsweredItem.version,
      command.issuedAt
    ), projectionAfterAnsweredItem);
  const nextOpenIssues = state.openIssues.map((issue) =>
    issue.queueItemId === queueItemId
      ? {
          ...issue,
          status: "answered" as const
        }
      : issue
  );
  const followUpIssues = createFollowUpIssuesForAnswer({
    sessionId: command.sessionId,
    sourceQuestion,
    answer,
    answerRef,
    routeOutcome,
    impact
  });
  const firstFollowUpIssue = followUpIssues[0] ?? null;
  const nextIssues = appendUniqueOpenIssues(nextOpenIssues, followUpIssues);
  const queueProjection = queueProjectionWithRefilledActiveQuestions(
    queueProjectionWithReview,
    nextIssues,
    queueProjectionWithReview.version,
    command.issuedAt
  );
  const researchProjection = researchTasks.reduce(
    (projection, researchTask) => addResearchTaskToProjection(projection, researchTask, queueProjection.version),
    state.researchState
  );
  const event = eventDraft(command, "AnswerSubmitted", {
    answerRef,
    queueItemId,
    answer,
    answerRouteOutcome: routeOutcome,
    researchTaskId,
    ...(researchTasks.length > 1
      ? { researchTaskIds: researchTasks.map((task) => task.researchTaskId) }
      : {}),
    ...(firstFollowUpIssue
      ? {
          followUpIssue: firstFollowUpIssue,
          followUpIssues,
          followUpQueueItemId: firstFollowUpIssue.queueItemId,
          followUpQueueItemIds: followUpIssues.map((issue) => issue.queueItemId),
          followUpRepeatCount: firstFollowUpIssue.repeatCount,
          followUpRepeatCounts: followUpIssues.map((issue) => issue.repeatCount),
          followUpRepeatLimit: firstFollowUpIssue.repeatLimit
        }
      : {}),
    projection: queueProjection
  });
  const researchEvent = eventDraft(command, "ResearchPlanned", {
    researchTask: firstResearchTask,
    ...(researchTasks.length > 1 ? { researchTasks } : {}),
    sourceAnswerRef: answerRef,
    ...(researchTasks.length > 1
      ? { sourceAnswerRefs: researchTasks.map((task) => task.sourceAnswerRef).filter(Boolean) }
      : {}),
    projection: researchProjection
  });
  const nextSession = {
    ...state.session,
    phase: "research" as const
  };
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextIssues,
      queueProjection,
      researchState: researchProjection,
      session: nextSession
    },
    queueProjection.version
  );
  const researchEventWithConfidence = {
    ...researchEvent,
    payload: {
      ...researchEvent.payload,
      confidenceProjection
    }
  };

  return acceptedMultiEventReduction(
    command,
    state,
    [event, researchEventWithConfidence],
    {
      openIssues: nextIssues,
      queueProjection,
      researchState: researchProjection,
      completeness: confidenceProjection,
      session: nextSession
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: answerRef,
        payload: {
          queueItemId,
          answer,
          answerRouteOutcome: routeOutcome,
          researchTaskId,
          ...(researchTasks.length > 1
            ? { researchTaskIds: researchTasks.map((task) => task.researchTaskId) }
            : {}),
          ...(firstFollowUpIssue
            ? {
                followUpQueueItemId: firstFollowUpIssue.queueItemId,
                followUpQueueItemIds: followUpIssues.map((issue) => issue.queueItemId)
              }
            : {})
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    researchTasks.map((researchTask) =>
      researchEvidenceEffect(
        command,
        ["ResearchPlanned"],
        {
          refType: "ResearchTask",
          refId: researchTask.researchTaskId
        },
        "normal",
        `research:${researchTask.researchTaskId}`
      )
    ),
    queueProjection
  );
}

function reducePlanResearch(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const objective = requiredString(command.payload.objective);

  if (!objective) {
    return reject("PlanResearch requires a non-empty objective.", "VALIDATION_FAILED");
  }

  const confirmedMode = requireConfirmedProjectPurposeMode(state, "PlanResearch");
  if (typeof confirmedMode !== "string") {
    return confirmedMode;
  }

  const sourceQueueItemId = requiredString(command.payload.sourceQueueItemId) as QueueItemId | null;
  const routeOutcome =
    command.payload.routeOutcome === "missing_con_evidence" ? "missing_con_evidence" : "research_needed";
  const impact = validResearchImpact(command.payload.impact);
  const researchTaskId = `research_task_${stableToken(`${command.sessionId}:${objective}:${sourceQueueItemId ?? "manual"}`)}` as ResearchTaskId;
  const researchTask = planResearchTask({
    researchTaskId,
    sessionId: command.sessionId,
    ...(sourceQueueItemId ? { sourceQueueItemId } : {}),
    objective,
    projectPurposeMode: confirmedMode,
    projectPurposeModeLabel: projectPurposeModeLabel(confirmedMode),
    projectPurposeModeEffect: projectPurposeModeEffect(confirmedMode),
    skippedCommercializationAxes: skippedCommercializationAxes(confirmedMode),
    ...(state.project.businessCriticIntensity
      ? { businessCriticIntensity: state.project.businessCriticIntensity }
      : {}),
    routeOutcome,
    impact,
    createdAt: command.issuedAt
  });
  const researchProjection = addResearchTaskToProjection(
    state.researchState,
    researchTask,
    projectionVersionFor(state)
  );
  const event = eventDraft(command, "ResearchPlanned", {
    researchTask,
    projection: researchProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      session: {
        ...state.session,
        phase: "research"
      }
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: researchTaskId,
        payload: {
          objective,
          routeOutcome,
          impact
        }
      }
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchPlanned"],
        {
          refType: "ResearchTask",
          refId: researchTaskId
        },
        "normal",
        `research:${researchTaskId}`
      )
    ],
    researchProjection
  );
}

function reduceImportResearchResult(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const researchTaskId = requiredString(command.payload.researchTaskId) as ResearchTaskId | null;
  const result = requiredString(command.payload.result);

  if (!researchTaskId || !result) {
    return reject("ImportResearchResult requires researchTaskId and non-empty result.", "VALIDATION_FAILED");
  }

  const researchTask = state.researchState.tasks.find((task) => task.researchTaskId === researchTaskId);

  if (!researchTask) {
    return reject("ImportResearchResult requires an existing ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const requestedSynthesisVersion = optionalPositiveInteger(command.payload.synthesisVersion);

  if (requestedSynthesisVersion === "invalid") {
    return reject("ImportResearchResult requires synthesisVersion to be a positive integer.", "VALIDATION_FAILED");
  }

  const sourceReliability = optionalResearchSourceReliability(command.payload.sourceReliability);

  if (sourceReliability === "invalid") {
    return reject("ImportResearchResult requires sourceReliability to be high, medium, low, or unknown.", "VALIDATION_FAILED");
  }

  const synthesisVersion = requestedSynthesisVersion ?? 1;
  const researchResultId = `research_result_${stableToken(`${researchTaskId}:${result}`)}` as ResearchResultId;
  const researchResult = importResearchResult({
    researchResultId,
    researchTaskId,
    result,
    importedAt: command.issuedAt,
    ...(typeof command.payload.researchRunId === "string"
      ? { researchRunId: command.payload.researchRunId as ResearchRunId }
      : {}),
    ...(typeof command.payload.sourceTitle === "string" ? { sourceTitle: command.payload.sourceTitle } : {}),
    ...(typeof command.payload.sourceUrl === "string" ? { sourceUrl: command.payload.sourceUrl } : {}),
    ...(sourceReliability ? { sourceReliability } : {}),
    ...(typeof command.payload.sourcePublishedAt === "string"
      ? { sourcePublishedAt: command.payload.sourcePublishedAt }
      : {}),
    ...(typeof command.payload.sourceRetrievedAt === "string"
      ? { sourceRetrievedAt: command.payload.sourceRetrievedAt }
      : {}),
    ...(typeof command.payload.limitationNotes === "string" ? { limitationNotes: command.payload.limitationNotes } : {}),
    ...(typeof command.payload.claim === "string" ? { claim: command.payload.claim } : {}),
    ...(typeof command.payload.decisionContext === "string" ? { decisionContext: command.payload.decisionContext } : {}),
    ...(typeof command.payload.specSectionRef === "string" ? { specSectionRef: command.payload.specSectionRef } : {}),
    ...(typeof command.payload.questionRef === "string" ? { questionRef: command.payload.questionRef } : {}),
    ...(typeof command.payload.implicationScope === "string" ? { implicationScope: command.payload.implicationScope } : {}),
    ...(typeof command.payload.staleSensitive === "boolean" ? { staleSensitive: command.payload.staleSensitive } : {}),
    ...(typeof command.payload.sourceRequiredAfter === "string"
      ? { sourceRequiredAfter: command.payload.sourceRequiredAfter }
      : {})
  });
  const researchProjection = addImportedResearchResultToProjection(
    state.researchState,
    researchTask,
    researchResult,
    projectionVersionFor(state)
  );
  const importedEvent = eventDraft(command, "ResearchResultImported", {
    researchTaskId,
    researchResult,
    synthesisVersion,
    projection: researchProjection
  });

  return acceptedReduction(
    command,
    state,
    importedEvent,
    {
      researchState: researchProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: researchResultId,
        payload: {
          researchTaskId,
          synthesisVersion
        }
      }
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchResultImported"],
        {
          refType: "ResearchResult",
          refId: researchResultId
        },
        "high",
        `research-result:${researchResultId}:v${synthesisVersion}`,
        `synthesisVersion:${synthesisVersion}`
      )
    ]
  );
}

function reduceSynthesizeEvidence(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const researchResultId = requiredString(command.payload.researchResultId) as ResearchResultId | null;

  if (!researchResultId) {
    return reject("SynthesizeEvidence requires researchResultId.", "VALIDATION_FAILED");
  }

  const researchResult = state.researchState.results.find((result) => result.researchResultId === researchResultId);

  if (!researchResult) {
    return reject("SynthesizeEvidence requires an imported ResearchResult.", "RESOURCE_NOT_FOUND");
  }

  const researchTask = state.researchState.tasks.find((task) => task.researchTaskId === researchResult.researchTaskId);

  if (!researchTask) {
    return reject("SynthesizeEvidence requires the source ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const requestedSynthesisVersion = optionalPositiveInteger(command.payload.synthesisVersion);

  if (requestedSynthesisVersion === "invalid") {
    return reject("SynthesizeEvidence requires synthesisVersion to be a positive integer.", "VALIDATION_FAILED");
  }

  const synthesisVersion =
    requestedSynthesisVersion ??
    Math.max(
      1,
      ...state.researchState.evidenceMatrices
        .filter((matrix) => matrix.researchResultId === researchResultId)
        .map((matrix) => matrix.synthesisVersion + 1)
    );

  if (command.actor !== "effect_executor") {
    const requestedEvent = eventDraft(command, "EvidenceSynthesisRequested", {
      researchTaskId: researchTask.researchTaskId,
      researchResultId,
      synthesisVersion
    });

    return acceptedReduction(
      command,
      state,
      requestedEvent,
      {},
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: `synthesis_request:${researchResultId}:v${synthesisVersion}`,
          payload: {
            researchResultId,
            synthesisVersion
          }
        }
      ],
      [
        researchEvidenceEffect(
          command,
          ["EvidenceSynthesisRequested"],
          {
            refType: "ResearchResult",
            refId: researchResultId
          },
          "high",
          `research-result:${researchResultId}:v${synthesisVersion}`,
          `synthesisVersion:${synthesisVersion}`
        )
      ]
    );
  }

  const sourceQuestionForSynthesis = researchTask.sourceQueueItemId
    ? state.openIssues.find((issue) => issue.queueItemId === researchTask.sourceQueueItemId)
    : undefined;
  const evidenceMatrix = synthesizeEvidenceMatrix({
    researchTask,
    researchResult,
    synthesisVersion,
    contextText: researchSynthesisContextText(researchTask, sourceQuestionForSynthesis)
  });
  const evidencePack = buildDecisionEvidencePack({
    researchTask,
    researchResult,
    synthesisVersion,
    matrix: evidenceMatrix
  });
  const researchProjection = addResearchResultToProjection(
    state.researchState,
    researchTask,
    researchResult,
    evidenceMatrix,
    evidencePack,
    projectionVersionFor(state)
  );
  const researchCard = researchProjection.reviewCards.find((card) => card.researchTaskId === researchTask.researchTaskId);
  const queueProjectionWithReviewCard = researchCard
    ? queueProjectionWithResearchCard(
        state.queueProjection,
        researchCard,
        evidenceReviewQueueState(evidenceMatrix, evidencePack.gateStatus),
        researchProjection.version,
        command.issuedAt
      )
    : queueProjectionWithResearchReviewItem(
        state.queueProjection,
        researchTask.researchTaskId,
        evidenceReviewQueueTitle(researchTask, evidenceMatrix, evidencePack.gateStatus),
        evidenceReviewQueueState(evidenceMatrix, evidencePack.gateStatus),
        researchProjection.version,
        command.issuedAt
      );
  const researchFollowUpIssues = createResearchFollowUpIssuesForAdditionalQuestions({
    sessionId: command.sessionId,
    openIssues: state.openIssues,
    researchTask,
    researchResult,
    evidenceMatrix
  });
  const newResearchFollowUpIssues = researchFollowUpIssues.filter((issue) =>
    !state.openIssues.some((existingIssue) => existingIssue.queueItemId === issue.queueItemId)
  );
  const researchFollowUpTasks = evidenceMatrix.balanceStatus === "source_quality_insufficient"
    ? []
    : createResearchTasksForResearchFollowUpIssues({
        sessionId: command.sessionId,
        sourceResearchTask: researchTask,
        researchFollowUpIssues: newResearchFollowUpIssues,
        existingResearchTasks: researchProjection.tasks,
        createdAt: command.issuedAt
      });
  const researchProjectionWithFollowUpTasks = researchFollowUpTasks.reduce(
    (projection, task) => addResearchTaskToProjection(projection, task, researchProjection.version),
    researchProjection
  );
  const nextOpenIssues = appendUniqueOpenIssues(state.openIssues, researchFollowUpIssues);
  const queueProjectionWithVisibleFollowUps = queueProjectionWithVisibleResearchFollowUps(
    queueProjectionWithReviewCard,
    nextOpenIssues,
    newResearchFollowUpIssues,
    researchProjectionWithFollowUpTasks.version,
    command.issuedAt
  );
  const queueProjection = researchFollowUpTasks.reduce((projection, task, index) =>
    queueProjectionWithResearchReviewItem(
      projection,
      task.researchTaskId,
      task.routeOutcome === "missing_con_evidence"
        ? `후속 반례 리서치 대기${researchFollowUpTasks.length > 1 ? ` ${index + 1}/${researchFollowUpTasks.length}` : ""}: ${compactAnswerExcerpt(task.objective)}`
        : `후속 리서치 대기${researchFollowUpTasks.length > 1 ? ` ${index + 1}/${researchFollowUpTasks.length}` : ""}: ${compactAnswerExcerpt(task.objective)}`,
      task.routeOutcome === "missing_con_evidence" ? "blocked" : "next",
      researchProjectionWithFollowUpTasks.version,
      command.issuedAt
    ), queueProjectionWithVisibleFollowUps);
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextOpenIssues,
      researchState: researchProjectionWithFollowUpTasks,
      queueProjection
    },
    researchProjectionWithFollowUpTasks.version
  );
  const event = eventDraft(command, "EvidenceSynthesized", {
    researchTaskId: researchTask.researchTaskId,
    researchResultId,
    evidenceMatrix,
    evidencePack,
    projection: researchProjectionWithFollowUpTasks,
    queueProjection,
    ...(newResearchFollowUpIssues.length
      ? {
          researchFollowUpIssues: newResearchFollowUpIssues,
          researchFollowUpQueueItemIds: newResearchFollowUpIssues.map((issue) => issue.queueItemId)
        }
      : {}),
    ...(researchFollowUpTasks.length
      ? {
          researchFollowUpResearchTasks: researchFollowUpTasks,
          researchFollowUpResearchTaskIds: researchFollowUpTasks.map((task) => task.researchTaskId)
        }
      : {}),
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: nextOpenIssues,
      researchState: researchProjectionWithFollowUpTasks,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: evidenceMatrix.evidenceMatrixId,
        payload: {
          balanceStatus: evidenceMatrix.balanceStatus,
          decisionBlocked: evidenceMatrix.decisionBlocked,
          evidencePackId: evidencePack.evidencePackId,
          qualityGateStatus: evidencePack.gateStatus,
          ...(researchFollowUpTasks.length
            ? { researchFollowUpResearchTaskIds: researchFollowUpTasks.map((task) => task.researchTaskId) }
            : {})
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "EvidenceSynthesized",
        {
          refType: "EvidenceMatrix",
          refId: evidenceMatrix.evidenceMatrixId
        },
        "normal"
      ),
      ...researchFollowUpTasks.map((task) =>
        researchEvidenceEffect(
          command,
          ["EvidenceSynthesized"],
          {
            refType: "ResearchTask",
            refId: task.researchTaskId
          },
          "normal",
          `research:${task.researchTaskId}`
        )
      )
    ]
  );
}

function reduceResolveResearchQueueCard(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const cardId = requiredString(command.payload.cardId) as QueueItemId | null;
  const outcome = isResearchQueueTerminalOutcome(command.payload.outcome) ? command.payload.outcome : null;
  const rationale = requiredString(command.payload.rationale) ?? undefined;

  if (!cardId || !outcome) {
    return reject("ResolveResearchQueueCard requires cardId and a supported terminal outcome.", "VALIDATION_FAILED");
  }

  const card = state.researchState.reviewCards.find((candidate) => candidate.cardId === cardId);

  if (!card) {
    return reject("ResolveResearchQueueCard requires an existing research-updated queue card.", "RESOURCE_NOT_FOUND");
  }

  if (card.terminalOutcome) {
    return reject("ResolveResearchQueueCard cannot resolve an already terminal research card.", "COMMAND_PRECONDITION_FAILED", {
      cardId,
      terminalOutcome: card.terminalOutcome
    });
  }

  if (!card.availableOutcomes.includes(outcome)) {
    return reject("ResolveResearchQueueCard outcome is not available for this card type.", "VALIDATION_FAILED", {
      cardId,
      cardType: card.cardType,
      availableOutcomes: card.availableOutcomes
    });
  }

  if ((outcome === "deferred" || outcome === "risk_accepted") && !rationale) {
    return reject("Deferred and risk_accepted research outcomes require a user-visible rationale.", "VALIDATION_FAILED", {
      outcome
    });
  }

  const version = projectionVersionFor(state);
  const researchProjection = resolveResearchReviewCardInProjection(
    state.researchState,
    cardId,
    outcome,
    rationale,
    version
  );
  const resolvedCard = researchProjection.reviewCards.find((candidate) => candidate.cardId === cardId) ?? card;
  const queueProjection = queueProjectionAfterResearchCardResolution(
    state.queueProjection,
    resolvedCard,
    outcome,
    rationale,
    version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      researchState: researchProjection,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "ResearchQueueCardResolved", {
    cardId,
    researchTaskId: card.researchTaskId,
    evidencePackId: card.evidencePackId,
    cardType: card.cardType,
    outcome,
    ...(rationale ? { rationale } : {}),
    projection: researchProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: cardId,
        payload: {
          outcome,
          ...(rationale ? { rationale } : {}),
          blocksPlanning: resolvedCard.blocksPlanning
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "ResearchQueueCardResolved",
        {
          refType: "queue_item",
          refId: cardId
        },
        "high"
      )
    ],
    queueProjection
  );
}

function runtimeArtifactFromPayload(
  command: ProductEngineCommand,
  source: CodexRuntimeSource
): RuntimePreviewArtifact | ProductEngineReduction {
  const turnPurpose = command.payload.turnPurpose;
  const contextHash = requiredString(command.payload.contextHash);
  const summary = requiredString(command.payload.summary) ?? requiredString(command.payload.prompt);
  const body = requiredString(command.payload.body) ?? requiredString(command.payload.prompt);
  const sourceRefs = requiredNonEmptyStringArray(command.payload.sourceRefs);

  if (!isCodexTurnPurpose(turnPurpose) || !contextHash || !summary || !body || sourceRefs === "invalid") {
    return reject("CreateRuntimePreview requires turnPurpose, contextHash, prompt/body, and valid sourceRefs.", "VALIDATION_FAILED");
  }

  const requestedBlockedActionType = command.payload.blockedActionType ?? command.payload.requestedActionType;
  const blockedActionReason =
    requiredString(command.payload.blockedActionReason) ??
    requiredString(command.payload.requestedActionReason) ??
    "Phase 1 converts forbidden runtime actions into blocked preview artifacts.";
  const blockedActionType = isBlockedActionType(requestedBlockedActionType) ? requestedBlockedActionType : null;
  const hasBlockedAction = blockedActionType !== null;
  const requestedKind = command.payload.artifactKind;
  const requestedPolicy = command.payload.applyPolicy;
  const kind = hasBlockedAction
    ? "BlockedActionArtifact"
    : isCodexArtifactKind(requestedKind)
      ? requestedKind
      : CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE[turnPurpose];
  const applyPolicy = hasBlockedAction
    ? "blocked"
    : isCodexApplyPolicy(requestedPolicy)
      ? requestedPolicy
      : source === "manual_prompt_handoff"
        ? "manual_handoff_required"
        : CODEX_APPLY_POLICY_BY_TURN_PURPOSE[turnPurpose];
  const status = hasBlockedAction ? "blocked" : source === "manual_prompt_handoff" ? "manual_handoff" : "preview_ready";
  const runtimeAdapterVersion =
    requiredString(command.payload.runtimeAdapterVersion) ?? CODEX_RUNTIME_ADAPTER_VERSION;
  const artifactId = runtimeArtifactIdFor(command.sessionId, turnPurpose, contextHash, runtimeAdapterVersion);
  const targetObject =
    requiredString(command.payload.targetObject) ?? (kind === "BlockedActionArtifact" ? "blocked_action" : turnPurpose);
  const phase15bUpgradeHints = phase15bUpgradeHintsFromPayload(command.payload);

  if (phase15bUpgradeHints.kind === "invalid") {
    return phase15bUpgradeHints.rejection;
  }

  if (phase15bUpgradeHints.kind === "valid" && !isPhase15bHintArtifactKind(kind)) {
    return reject(
      "CreateRuntimePreview phase15bUpgradeHints may only be attached to ImplementationPlanPreviewArtifact or BlockedActionArtifact.",
      "VALIDATION_FAILED"
    );
  }

  if (phase15bUpgradeHints.kind === "valid" && hasBlockedAction) {
    try {
      assertPhase15bUpgradeHintsMatchBlockedAction(phase15bUpgradeHints.hints, blockedActionType);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return reject(`CreateRuntimePreview phase15bUpgradeHints is invalid: ${message}`, "VALIDATION_FAILED");
    }
  }

  return {
    artifactId,
    turnPurpose,
    kind,
    applyPolicy,
    status,
    source,
    targetObject,
    summary,
    payload: {
      title: summary,
      body,
      targetObject,
      sourceRefs,
      ...(phase15bUpgradeHints.kind === "valid" ? { phase15bUpgradeHints: phase15bUpgradeHints.hints } : {})
    },
    sourceRefs,
    contextHash,
    runtimeAdapterVersion,
    ...(typeof command.payload.sourceEffectTaskId === "string"
      ? { sourceEffectTaskId: command.payload.sourceEffectTaskId as EffectTaskId }
      : {}),
    ...(hasBlockedAction
      ? {
          blockedAction: {
            actionType: blockedActionType,
            reason: blockedActionReason,
            ...(typeof command.payload.suggestedSafeAlternative === "string"
              ? { suggestedSafeAlternative: command.payload.suggestedSafeAlternative }
              : {})
          }
        }
      : {}),
    createdAt: command.issuedAt,
    schemaVersion: command.schemaVersion
  };
}

type Phase15bUpgradeHintsValidationResult =
  | { readonly kind: "absent" }
  | { readonly kind: "valid"; readonly hints: Phase15bUpgradeHints }
  | { readonly kind: "invalid"; readonly rejection: ProductEngineReduction };

function phase15bUpgradeHintsFromPayload(
  payload: ProductEngineCommand["payload"]
): Phase15bUpgradeHintsValidationResult {
  if (!hasOwnRecordKey(payload, "phase15bUpgradeHints")) {
    return { kind: "absent" };
  }

  try {
    return { kind: "valid", hints: validatePhase15bUpgradeHints(payload.phase15bUpgradeHints) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      kind: "invalid",
      rejection: reject(`CreateRuntimePreview phase15bUpgradeHints is invalid: ${message}`, "VALIDATION_FAILED")
    };
  }
}

function reduceCreateRuntimePreview(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const turnPurpose = command.payload.turnPurpose;
  const contextHash = requiredString(command.payload.contextHash);
  const prompt = requiredString(command.payload.prompt);
  const sourceRefs = requiredNonEmptyStringArray(command.payload.sourceRefs);

  if (!isCodexTurnPurpose(turnPurpose) || !contextHash || !prompt || sourceRefs === "invalid") {
    return reject("CreateRuntimePreview requires turnPurpose, contextHash, prompt, and valid sourceRefs.", "VALIDATION_FAILED");
  }

  const source =
    command.actor === "effect_executor"
      ? command.payload.source === "protocol_fixture"
        ? "protocol_fixture"
        : command.payload.source === "codex_app_server"
          ? "codex_app_server"
          : "manual_prompt_handoff"
      : command.payload.mode === "manual_handoff"
        ? "manual_prompt_handoff"
        : null;

  if (!source) {
    const requestedActionType = isBlockedActionType(command.payload.requestedActionType)
      ? command.payload.requestedActionType
      : null;
    const requestedActionReason = requiredString(command.payload.requestedActionReason);
    const event = eventDraft(command, "RuntimePreviewRequested", {
      turnPurpose,
      contextHash,
      prompt,
      sourceRefs,
      targetObject: requiredString(command.payload.targetObject) ?? turnPurpose,
      runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
      ...(requestedActionType ? { requestedActionType } : {}),
      ...(requestedActionReason ? { requestedActionReason } : {})
    });

    return acceptedReduction(
      command,
      state,
      event,
      {},
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: `runtime_preview_request:${turnPurpose}:${contextHash}`,
          payload: {
            turnPurpose,
            contextHash,
            runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION
          }
        }
      ],
      [codexRuntimePreviewEffect(command, turnPurpose, contextHash)]
    );
  }

  const artifactOrRejection = runtimeArtifactFromPayload(command, source);

  if (!("artifactId" in artifactOrRejection)) {
    return artifactOrRejection;
  }

  const runtimeProjection = runtimeProjectionWithArtifact(
    state.runtimeState,
    artifactOrRejection,
    projectionVersionFor(state)
  );
  const queueProjection = queueProjectionWithRuntimePreviewItem(
    state.queueProjection,
    artifactOrRejection,
    runtimeProjection.version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      runtimeState: runtimeProjection,
      queueProjection
    },
    runtimeProjection.version
  );
  const event = eventDraft(command, "RuntimePreviewRequested", {
    turnPurpose,
    contextHash,
    runtimeArtifact: artifactOrRejection,
    projection: runtimeProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      runtimeState: runtimeProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: artifactOrRejection.artifactId,
        payload: {
          turnPurpose,
          kind: artifactOrRejection.kind,
          applyPolicy: artifactOrRejection.applyPolicy,
          status: artifactOrRejection.status
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [],
    runtimeProjection
  );
}

function reduceConvertRuntimeArtifact(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const artifactId = requiredString(command.payload.artifactId) as RuntimeArtifactId | null;
  const artifact = artifactId
    ? state.runtimeState.runtimeArtifacts.find((candidate) => candidate.artifactId === artifactId)
    : null;

  if (!artifact) {
    return reject("ConvertRuntimeArtifact requires an existing RuntimePreviewArtifact.", "RESOURCE_NOT_FOUND");
  }

  const artifactRef = artifact.artifactId;
  const target = requiredString(command.payload.target);
  const blockReason = requiredString(command.payload.blockReason);

  if (!target) {
    return reject("ConvertRuntimeArtifact requires target.", "VALIDATION_FAILED");
  }

  if (isFinalPlanningHandoffConversionTarget(target)) {
    return reject(
      "ConvertRuntimeArtifact cannot create a final PlanningHandoffArtifact; use CreatePlanningHandoff gate instead.",
      "RUNTIME_ACTION_BLOCKED"
    );
  }

  const requestsBlockedTarget = target === "blocked_action" || Boolean(blockReason);
  const hasBlockedActionTaxonomy =
    isBlockedActionType(command.payload.blockedActionType) || Boolean(artifact.blockedAction?.actionType);

  if (requestsBlockedTarget && !hasBlockedActionTaxonomy) {
    return reject("Blocked runtime artifact conversion requires blockedActionType taxonomy.", "VALIDATION_FAILED");
  }

  if (isRuntimeArtifactBlocked(artifact) || requestsBlockedTarget) {
    const blockedArtifact = requestsBlockedTarget ? blockedArtifactFromConversion(command, artifact) : artifact;
    const runtimeProjection = runtimeProjectionWithArtifact(
      state.runtimeState,
      blockedArtifact,
      projectionVersionFor(state)
    );
    const queueProjection = queueProjectionWithRuntimePreviewItem(
      state.queueProjection,
      blockedArtifact,
      runtimeProjection.version,
      command.issuedAt
    );
    const confidenceProjection = buildConfidenceCompletionProjection(
      {
        ...state,
        runtimeState: runtimeProjection,
        queueProjection
      },
      runtimeProjection.version
    );
    const event = eventDraft(command, "RuntimeArtifactConverted", {
      artifactId: artifactRef,
      conversionStatus: "blocked",
      blockReason:
        blockedArtifact.blockedAction?.reason ??
        blockReason ??
        "Blocked runtime artifact cannot be converted into execution.",
      runtimeArtifact: blockedArtifact,
      projection: runtimeProjection,
      queueProjection,
      confidenceProjection
    });

    return acceptedReduction(
      command,
      state,
      event,
      {
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      },
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: artifactRef,
          payload: {
            conversionStatus: "blocked"
          }
        },
        ...completenessDeterministicOutputs(command, confidenceProjection)
      ],
      [],
      runtimeProjection
    );
  }

  const event = eventDraft(command, "RuntimeArtifactConverted", {
    artifactId: artifactRef,
    conversionStatus: "preview_only",
    target
  });

  return acceptedReduction(
    command,
    state,
    event,
    {},
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: artifactRef,
        payload: {
          conversionStatus: "preview_only",
          target
        }
      }
    ]
  );
}

type NonReadyPlanningHandoffVerdict = Exclude<PlanningHandoffVerdict, "planning_ready">;

const PLANNING_HANDOFF_SOURCE_TYPES = [
  "spec_version",
  "founder_brief",
  "completion_candidate",
  "decision_linked_evidence_pack",
  "research_updated_queue_item",
  "decision",
  "risk_acceptance",
  "known_risk",
  "open_question",
  "phase15b_hint",
  "runtime_preview_artifact",
  "activity_event"
] as const satisfies readonly PlanningHandoffSourceType[];

const PLANNING_HANDOFF_FATAL_BLOCKER_CLASSES = [
  "customer_problem_jtbd",
  "success_metrics_validation",
  "approval_security_execution_safety"
] as const satisfies readonly PlanningHandoffBlockerClass[];

const RESEARCH_QUEUE_FATAL_CLASS_KEYWORDS = {
  customer_problem_jtbd: ["customer", "problem", "jtbd", "target customer", "고객", "문제"] as const,
  success_metrics_validation: [
    "success metric",
    "success metrics",
    "metric",
    "metrics",
    "validation plan",
    "검증계획",
    "검증 계획",
    "성공기준",
    "성공 기준"
  ] as const,
  approval_security_execution_safety: [
    "approval",
    "security",
    "execution",
    "safety",
    "승인",
    "보안",
    "실행안전",
    "실행 안전"
  ] as const
} as const satisfies Record<PlanningHandoffBlockerClass, readonly string[]>;

const RESEARCH_QUEUE_RESIDUAL_RISK_KEYWORDS = {
  value_proposition_differentiation: [
    "value proposition",
    "differentiation",
    "차별화",
    "가치제안",
    "가치 제안"
  ] as const,
  mvp_scope_non_scope: ["mvp", "non-goal", "non goal", "non-scope", "non scope", "non_scope", "범위", "비범위"] as const
} as const satisfies Partial<Record<PlanningHandoffResidualRiskClass, readonly string[]>>;

const PLANNING_HANDOFF_REQUIRED_SOURCE_REQUIREMENTS = [
  {
    sourceTypes: ["spec_version"],
    blockerId: "blocker_source_trace_spec_version",
    whyFatal: "Planning Handoff requires a current SpecVersion or living spec source ref.",
    requiredNextAction: "revise"
  },
  {
    sourceTypes: ["completion_candidate", "founder_brief"],
    blockerId: "blocker_source_trace_completion_candidate",
    whyFatal: "Planning Handoff requires a current completion candidate or Founder Brief source ref.",
    requiredNextAction: "revise"
  },
  {
    sourceTypes: ["decision_linked_evidence_pack"],
    blockerId: "blocker_source_trace_evidence_pack",
    whyFatal: "Planning Handoff requires a current decision-linked Evidence Pack source ref.",
    requiredNextAction: "research_more"
  },
  {
    sourceTypes: ["research_updated_queue_item"],
    blockerId: "blocker_source_trace_research_queue",
    whyFatal: "Planning Handoff requires a current research-updated Queue source ref.",
    requiredNextAction: "research_more"
  }
] as const satisfies readonly {
  readonly sourceTypes: readonly PlanningHandoffSourceType[];
  readonly blockerId: string;
  readonly whyFatal: string;
  readonly requiredNextAction: PlanningHandoffRequiredUserAction;
}[];

const PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES = [
  "phase3_controlled_execution",
  "chatgpt_web_automation",
  "external_deploy"
] as const satisfies PlanningHandoffRequestedScopeDto["excludedInternalPhases"];

const PLANNING_HANDOFF_ALLOWED_PAYLOAD_KEYS = ["sourceRefs", "requestedScope"] as const;

const PLANNING_HANDOFF_ALLOWED_SOURCE_REF_KEYS = [
  "sourceType",
  "sourceId",
  "sourceLabel",
  "required",
  "stale"
] as const;

const PLANNING_HANDOFF_ALLOWED_REQUESTED_SCOPE_KEYS = [
  "productSlice",
  "userFacingJourneyLabel",
  "projectPurposeMode",
  "projectPurposeModeLabel",
  "projectPurposeModeEffect",
  "skippedCommercializationAxes",
  "nonGoals",
  "excludedInternalPhases",
  "assumptions"
] as const;

// Planning Handoff can surface Phase 1.5B readiness hints outside the dedicated
// query/export route, so reuse a conservative public-safe boundary here too:
// keep trace shape and deterministic refs, but never copy obvious private or
// credential-bearing hint payload text into the final handoff artifact.
const PHASE15B_NON_EXPORTABLE_TEXT_PATTERNS = [
  /sk-[A-Za-z0-9][A-Za-z0-9_-]{8,}/iu,
  /gh[pousr]_[A-Za-z0-9_]{20,}/iu,
  /AKIA[0-9A-Z]{16}/u,
  /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY)[A-Z0-9_]*\b\s*(?:[=:]|\s+)\s*["']?[A-Za-z0-9._~+/=-]{8,}/u,
  /(?:api[_-]?key|password|secret|token|credential)\s*[=:]\s*["']?[^\s,"']{4,}/iu,
  /\b(?:api[_-]?key|client[_-]?secret|password|secret|token|credential)\b\s+(?!values?\b|required\b|not\b|none\b|no\b)[A-Za-z0-9._~+/=-]{8,}/iu,
  /\bauthorization\s*:\s*(?:basic|bearer)\s+[A-Za-z0-9._~+/=-]{8,}/iu,
  /\bbasic\s+[A-Za-z0-9+/=-]{8,}/iu,
  /bearer\s+[A-Za-z0-9._~+/=-]{10,}/iu,
  /https?:\/\/\S*(?:api[_-]?key|password|secret|token|credential)=\S*/iu,
  /private\s+(?:customer|payload|context|document)/iu,
  /customer\s+[A-Z][A-Za-z0-9_-]+/iu,
  /raw[_-]?idea/iu,
  /internal\s+roadmap/iu
] as const satisfies readonly RegExp[];
const PHASE15B_NON_EXPORTABLE_SOURCE_REF_TEXT_PATTERN =
  /(?:private|customer|raw[_-]?idea|payload|internal|roadmap|secret|token|credential|password|bearer|sk-)/iu;
const PHASE15B_REDACTED_TEXT = "[redacted_phase15b_non_exportable_metadata]";
const PHASE15B_PUBLIC_SAFE_SECRET_BOUNDARY_PATTERN = /^(?:(?:no|none)\b|.*\bnot required\b)/iu;

const PHASE15B_SOURCE_REF_PATTERNS = {
  preview_artifact: /^runtime_artifact_[A-Za-z0-9_:-]+$/u,
  blocked_action: /^runtime_artifact_[A-Za-z0-9_:-]+(?::[A-Za-z0-9_:-]+)?$/u,
  research_run: /^research_run_[A-Za-z0-9_:-]+$/u,
  evidence_matrix: /^evidence_matrix_[A-Za-z0-9_:-]+$/u,
  decision_evidence_pack: /^(?:decision_evidence_pack|evidence_pack)_[A-Za-z0-9_:-]+$/u,
  research_allowlist: /^research_allowlist_[A-Za-z0-9_:-]+$/u,
  research_disclosure_log: /^research_disclosure(?:_log)?_[A-Za-z0-9_:-]+$/u,
  audit_log: /^audit_log_[A-Za-z0-9_:-]+$/u,
  spec_section: /^spec(?:_section)?_[A-Za-z0-9_:-]+$/u
} as const satisfies Record<Phase15bUpgradeHints["sourceRefs"][number]["kind"], RegExp>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlanningHandoffSourceType(value: unknown): value is PlanningHandoffSourceType {
  return (
    typeof value === "string" &&
    PLANNING_HANDOFF_SOURCE_TYPES.includes(value as PlanningHandoffSourceType)
  );
}

function isPlanningHandoffExcludedInternalPhase(
  value: unknown
): value is PlanningHandoffRequestedScopeDto["excludedInternalPhases"][number] {
  return (
    typeof value === "string" &&
    PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES.includes(
      value as PlanningHandoffRequestedScopeDto["excludedInternalPhases"][number]
    )
  );
}

function planningHandoffSourceRefFromValue(value: unknown): PlanningHandoffSourceRefDto | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!hasOnlyRecordKeys(value, PLANNING_HANDOFF_ALLOWED_SOURCE_REF_KEYS)) {
    return null;
  }

  const sourceId = requiredString(value.sourceId);

  if (!isPlanningHandoffSourceType(value.sourceType) || !sourceId) {
    return null;
  }

  if (typeof value.required !== "boolean" || typeof value.stale !== "boolean") {
    return null;
  }

  if (value.sourceLabel !== undefined && typeof value.sourceLabel !== "string") {
    return null;
  }

  return {
    sourceType: value.sourceType,
    sourceId,
    ...(typeof value.sourceLabel === "string" ? { sourceLabel: value.sourceLabel } : {}),
    required: value.required,
    stale: value.stale
  };
}

function planningHandoffSourceRefsFromPayload(
  command: ProductEngineCommand
): readonly PlanningHandoffSourceRefDto[] | ProductEngineReduction {
  if (!Array.isArray(command.payload.sourceRefs) || command.payload.sourceRefs.length === 0) {
    return reject("CreatePlanningHandoff requires at least one sourceRef.", "VALIDATION_FAILED");
  }

  const sourceRefs: PlanningHandoffSourceRefDto[] = [];

  for (const sourceRefValue of command.payload.sourceRefs) {
    const sourceRef = planningHandoffSourceRefFromValue(sourceRefValue);

    if (!sourceRef) {
      return reject(
        "CreatePlanningHandoff sourceRefs must be valid PlanningHandoffSourceRefDto objects.",
        "VALIDATION_FAILED"
      );
    }

    sourceRefs.push(sourceRef);
  }

  const dedupeKeys = sourceRefs.map((sourceRef) => `${sourceRef.sourceType}:${sourceRef.sourceId}`);

  if (new Set(dedupeKeys).size !== dedupeKeys.length) {
    return reject("CreatePlanningHandoff sourceRefs must be unique by sourceType and sourceId.", "VALIDATION_FAILED");
  }

  return sourceRefs;
}

function planningHandoffRequestedScopeFromValue(value: unknown): PlanningHandoffRequestedScopeDto | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (!hasOnlyRecordKeys(value, PLANNING_HANDOFF_ALLOWED_REQUESTED_SCOPE_KEYS)) {
    return null;
  }

  const productSlice = requiredString(value.productSlice);

  if (!productSlice || value.userFacingJourneyLabel !== "Planning-ready") {
    return null;
  }

  const nonGoals = requiredNonEmptyStringArray(value.nonGoals);
  const assumptions = requiredNonEmptyStringArray(value.assumptions);
  const requestedMode = projectPurposeModeFromPayload(value.projectPurposeMode);
  const skippedAxes =
    value.skippedCommercializationAxes === undefined
      ? null
      : requiredNonEmptyStringArray(value.skippedCommercializationAxes);

  if (nonGoals === "invalid" || assumptions === "invalid" || requestedMode === "invalid" || skippedAxes === "invalid") {
    return null;
  }

  if (!Array.isArray(value.excludedInternalPhases)) {
    return null;
  }

  const excludedInternalPhases = value.excludedInternalPhases.map((phase) =>
    isPlanningHandoffExcludedInternalPhase(phase) ? phase : null
  );

  if (excludedInternalPhases.some((phase) => phase === null)) {
    return null;
  }

  return {
    productSlice,
    userFacingJourneyLabel: "Planning-ready",
    ...(requestedMode ? { projectPurposeMode: requestedMode } : {}),
    ...(typeof value.projectPurposeModeLabel === "string" && value.projectPurposeModeLabel.trim()
      ? { projectPurposeModeLabel: value.projectPurposeModeLabel.trim() }
      : {}),
    ...(typeof value.projectPurposeModeEffect === "string" && value.projectPurposeModeEffect.trim()
      ? { projectPurposeModeEffect: value.projectPurposeModeEffect.trim() }
      : {}),
    ...(skippedAxes ? { skippedCommercializationAxes: skippedAxes } : {}),
    nonGoals,
    excludedInternalPhases: excludedInternalPhases as PlanningHandoffRequestedScopeDto["excludedInternalPhases"],
    assumptions
  };
}

function derivePlanningHandoffScope(state: ProductEngineStateSnapshot): PlanningHandoffRequestedScopeDto {
  return {
    productSlice:
      state.currentSpec.title ??
      state.founderBrief?.problemCustomerValue ??
      "Founder planning handoff",
    userFacingJourneyLabel: "Planning-ready",
    ...(state.project.projectPurposeMode ? { projectPurposeMode: state.project.projectPurposeMode } : {}),
    projectPurposeModeLabel: projectPurposeModeLabel(state.project.projectPurposeMode),
    projectPurposeModeEffect: projectPurposeModeEffect(state.project.projectPurposeMode),
    ...(skippedCommercializationAxes(state.project.projectPurposeMode).length
      ? { skippedCommercializationAxes: skippedCommercializationAxes(state.project.projectPurposeMode) }
      : {}),
    nonGoals: [
      "controlled execution",
      "file patches",
      "shell commands",
      "browser automation",
      "external deployment"
    ],
    excludedInternalPhases: PLANNING_HANDOFF_EXCLUDED_INTERNAL_PHASES,
    assumptions: [
      "Phase 2 computes a planning handoff from the loaded ProductEngine snapshot only.",
      "Execution remains out of scope until a separate Phase 3 controlled-execution contract is approved."
    ]
  };
}

function containsUnsupportedPlanningHandoffPayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, PLANNING_HANDOFF_ALLOWED_PAYLOAD_KEYS);
}

function isFinalPlanningHandoffConversionTarget(target: string) {
  const normalizedTarget = target.toLowerCase().replace(/[^a-z0-9]/g, "");

  return (
    normalizedTarget.includes("planninghandoff") ||
    normalizedTarget.includes("planningready") ||
    normalizedTarget.includes("finalhandoff") ||
    normalizedTarget.includes("handoffartifact")
  );
}

function allQueueItems(projection: DecisionQueueProjection): readonly QueueItemProjection[] {
  return [
    ...projection.active,
    ...projection.next,
    ...projection.blocked,
    ...projection.deferred
  ];
}

function sourceRefMatches(sourceRef: PlanningHandoffSourceRefDto, sourceType: PlanningHandoffSourceType, sourceId: string) {
  return sourceRef.sourceType === sourceType && sourceRef.sourceId === sourceId;
}

function uniquePlanningHandoffSourceRefs(
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffSourceRefDto[] {
  const seen = new Set<string>();
  const uniqueRefs: PlanningHandoffSourceRefDto[] = [];

  for (const sourceRef of sourceRefs) {
    const key = `${sourceRef.sourceType}:${sourceRef.sourceId}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueRefs.push(sourceRef);
    }
  }

  return uniqueRefs;
}

function evidencePackHasMatrix(
  state: ProductEngineStateSnapshot,
  pack: ProductEngineStateSnapshot["researchState"]["evidencePacks"][number]
) {
  return state.researchState.evidenceMatrices.some(
    (matrix) => matrix.researchTaskId === pack.researchTaskId && matrix.researchResultId === pack.researchResultId
  );
}

function evidencePackCanSourcePlanningHandoff(
  state: ProductEngineStateSnapshot,
  pack: ProductEngineStateSnapshot["researchState"]["evidencePacks"][number]
) {
  if (pack.gateStatus === "accepted") {
    return state.researchState.evidenceMatrices.some(
      (matrix) =>
        matrix.researchTaskId === pack.researchTaskId &&
        matrix.researchResultId === pack.researchResultId &&
        matrix.balanceStatus === "balanced" &&
        !matrix.decisionBlocked
    );
  }

  // `research_insufficient` packs are still current source traces: the linked
  // Research-updated Queue terminal outcome decides whether they are fatal
  // blockers or visible residual risks. Keep `needs_review`/`stale` out of
  // source traces so quality-gate-unknown or expired evidence cannot masquerade
  // as Planning-ready context.
  return pack.gateStatus === "research_insufficient" && evidencePackHasMatrix(state, pack);
}

function planningHandoffSourceExists(
  state: ProductEngineStateSnapshot,
  sourceRef: PlanningHandoffSourceRefDto
): boolean {
  switch (sourceRef.sourceType) {
    case "spec_version":
      return [
        state.currentSpec.versionRef,
        state.livingSpecProjection ? `living_spec:${state.session.sessionId}:${state.livingSpecProjection.version}` : undefined
      ].includes(sourceRef.sourceId);
    case "founder_brief":
      return Boolean(
        state.founderBrief &&
          state.founderBrief.exportReady &&
          [
            `founder_brief:${state.session.sessionId}:${state.founderBrief.version}`,
            `founder_brief:${state.session.sessionId}`
          ].includes(sourceRef.sourceId)
      );
    case "completion_candidate":
      return (
        state.completeness.completionCandidate.status === "candidate" &&
        [
          `completion_candidate:${state.session.sessionId}:${state.completeness.version}`,
          `completion_candidate:${state.session.sessionId}`
        ].includes(sourceRef.sourceId)
      );
    case "decision_linked_evidence_pack":
      return state.researchState.evidencePacks.some(
        (pack) => pack.evidencePackId === sourceRef.sourceId && evidencePackCanSourcePlanningHandoff(state, pack)
      );
    case "research_updated_queue_item":
      return (
        allQueueItems(state.queueProjection).some(
          (item) =>
            isResearchUpdatedQueueItem(item) && researchUpdatedQueueItemMatchesSourceId(item, sourceRef.sourceId)
        ) || state.researchState.reviewCards.some((card) => researchReviewCardMatchesSourceId(card, sourceRef.sourceId))
      );
    case "decision":
      return state.decisions.some((decision) => decision.decisionId === sourceRef.sourceId);
    case "risk_acceptance":
      return state.decisions.some(
        (decision) => decision.decisionId === sourceRef.sourceId && decision.status === "risk_accepted"
      );
    case "known_risk":
      return (
        state.completeness.topRiskCards.some((risk) => risk.riskId === sourceRef.sourceId) ||
        state.researchState.knownRisks.includes(sourceRef.sourceId) ||
        state.founderBrief?.knownRisks.includes(sourceRef.sourceId) === true
      );
    case "open_question":
      return state.openIssues.some((issue) => issue.queueItemId === sourceRef.sourceId);
    case "runtime_preview_artifact":
      return state.runtimeState.runtimeArtifacts.some((artifact) => artifact.artifactId === sourceRef.sourceId);
    case "phase15b_hint":
      return phase15bHintsForArtifact(state, sourceRef.sourceId as RuntimeArtifactId) !== null;
    case "activity_event":
      return false;
  }
}

function phase15bHintsForArtifact(
  state: ProductEngineStateSnapshot,
  artifactId: RuntimeArtifactId
): Phase15bUpgradeHints | null {
  const artifact = state.runtimeState.runtimeArtifacts.find((candidate) => candidate.artifactId === artifactId);

  if (!artifact || !hasOwnRecordKey(artifact.payload, "phase15bUpgradeHints")) {
    return null;
  }

  try {
    return validatePhase15bUpgradeHints(artifact.payload.phase15bUpgradeHints);
  } catch {
    return null;
  }
}

function phase15bSafeReadinessText(value: string) {
  return phase15bContainsNonExportableText(value) ? PHASE15B_REDACTED_TEXT : value;
}

function phase15bSafeReadinessStrings(values: readonly string[]) {
  return values.map(phase15bSafeReadinessText);
}

function phase15bSafeSecretBoundaryForHandoff(value: string) {
  return PHASE15B_PUBLIC_SAFE_SECRET_BOUNDARY_PATTERN.test(value.trim()) && !phase15bContainsNonExportableText(value)
    ? value
    : PHASE15B_REDACTED_TEXT;
}

function phase15bContainsNonExportableText(value: string) {
  return PHASE15B_NON_EXPORTABLE_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function phase15bContainsUnsafeSourceRefText(value: string) {
  return (
    phase15bContainsNonExportableText(value) ||
    PHASE15B_NON_EXPORTABLE_SOURCE_REF_TEXT_PATTERN.test(value)
  );
}

function isSafePhase15bSourceRef(sourceRef: Phase15bUpgradeHints["sourceRefs"][number]) {
  return (
    PHASE15B_SOURCE_REF_PATTERNS[sourceRef.kind].test(sourceRef.refId) &&
    !phase15bContainsUnsafeSourceRefText(sourceRef.refId)
  );
}

function redactedPhase15bSourceRefId(sourceRef: Phase15bUpgradeHints["sourceRefs"][number]) {
  const digest = sha256Hex(`${sourceRef.kind}\0${sourceRef.refId}`).slice(0, 16);

  return `redacted_ref:${sourceRef.kind}:${digest}`;
}

function phase15bSafeSourceTrace(sourceRef: Phase15bUpgradeHints["sourceRefs"][number]) {
  return {
    kind: sourceRef.kind,
    refId: isSafePhase15bSourceRef(sourceRef) ? sourceRef.refId : redactedPhase15bSourceRefId(sourceRef)
  };
}

function phase15bSafeHintSourceId(sourceId: string) {
  return isSafePhase15bSourceRef({ kind: "preview_artifact", refId: sourceId })
    ? sourceId
    : `redacted_ref:phase15b_hint:${sha256Hex(`phase15b_hint\0${sourceId}`).slice(0, 16)}`;
}

function phase15bSafeHintRef(sourceRef: PlanningHandoffSourceRefDto): PlanningHandoffSourceRefDto {
  return {
    ...sourceRef,
    sourceId: phase15bSafeHintSourceId(sourceRef.sourceId),
    ...(sourceRef.sourceLabel ? { sourceLabel: phase15bSafeReadinessText(sourceRef.sourceLabel) } : {})
  };
}

function planningHandoffOutputSourceRef(sourceRef: PlanningHandoffSourceRefDto): PlanningHandoffSourceRefDto {
  return sourceRef.sourceType === "phase15b_hint" ? phase15bSafeHintRef(sourceRef) : sourceRef;
}

function planningHandoffOutputSourceRefs(
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffSourceRefDto[] {
  return sourceRefs.map(planningHandoffOutputSourceRef);
}

function planningHandoffOutputQueueSummaries(
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[]
): readonly PlanningHandoffQueueOutcomeSummaryDto[] {
  return queueSummaries.map((summary) => ({
    ...summary,
    sourceRefs: planningHandoffOutputSourceRefs(summary.sourceRefs)
  }));
}

function planningHandoffOutputResidualRisks(
  residualRisks: readonly PlanningHandoffResidualRiskDto[]
): readonly PlanningHandoffResidualRiskDto[] {
  return residualRisks.map((risk) => ({
    ...risk,
    sourceRefs: planningHandoffOutputSourceRefs(risk.sourceRefs)
  }));
}

function planningHandoffOutputBlockers(
  blockers: readonly PlanningHandoffBlockerDto[]
): readonly PlanningHandoffBlockerDto[] {
  return blockers.map((blocker) => ({
    ...blocker,
    sourceRefs: planningHandoffOutputSourceRefs(blocker.sourceRefs)
  }));
}

function phase15bRequiredApprovalsForHandoff(hints: Phase15bUpgradeHints): readonly string[] {
  return hints.approvalRequirements.map(
    (requirement) =>
      `${requirement.approvalType}:${requirement.requiredActor}:${phase15bSafeReadinessText(
        requirement.scope
      )} — ${phase15bSafeReadinessText(requirement.reason)}; ${phase15bSafeReadinessText(requirement.reconfirmRule)}`
  );
}

function phase15bSandboxBoundaryForHandoff(hints: Phase15bUpgradeHints) {
  return [
    `isolatedWorktree=${hints.sandboxRequirements.isolatedWorktreeRequired}`,
    `browserSandbox=${hints.sandboxRequirements.browserSandboxRequired}`,
    `network=${hints.sandboxRequirements.networkMode}`,
    `commands=${phase15bSafeReadinessStrings(hints.sandboxRequirements.commandAllowlist).join(", ") || "none"}`,
    `secrets=${phase15bSafeSecretBoundaryForHandoff(hints.sandboxRequirements.secretGrantBoundary)}`,
    `environment=${phase15bSafeReadinessText(hints.sandboxRequirements.environmentPolicy)}`,
    `logCapture=${hints.sandboxRequirements.logCaptureRequired}`
  ].join("; ");
}

function phase15bRollbackReferenceForHandoff(hints: Phase15bUpgradeHints) {
  return [
    `base=${phase15bSafeReadinessText(hints.rollbackReference.baseRef)}`,
    hints.rollbackReference.diffRef ? `diff=${phase15bSafeReadinessText(hints.rollbackReference.diffRef)}` : null,
    hints.rollbackReference.reversible ? "reversible" : "not reversible",
    phase15bSafeReadinessText(hints.rollbackReference.rollbackNote),
    phase15bSafeReadinessText(hints.rollbackReference.cleanupExpectation)
  ]
    .filter((value): value is string => Boolean(value))
    .join("; ");
}

function phase15bExpectedEvidenceForHandoff(hints: Phase15bUpgradeHints): readonly string[] {
  return [
    ...phase15bSafeReadinessStrings(hints.expectedEvidence.tests),
    ...phase15bSafeReadinessStrings(hints.expectedEvidence.smokeChecks),
    ...phase15bSafeReadinessStrings(hints.expectedEvidence.artifactPaths),
    ...phase15bSafeReadinessStrings(hints.expectedEvidence.manualInspection),
    ...(hints.expectedEvidence.expectedLogs.length > 0
      ? [`${hints.expectedEvidence.expectedLogs.length} expected log pattern(s) captured as metadata only`]
      : [])
  ];
}

function phase15bHintMappingsForPlanningHandoff(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): PlanningHandoffArtifactDto["phase15bHintMapping"] {
  return sourceRefs
    .filter((sourceRef) => sourceRef.sourceType === "phase15b_hint" && !sourceRef.stale)
    .flatMap((sourceRef) => {
      const hints = phase15bHintsForArtifact(state, sourceRef.sourceId as RuntimeArtifactId);

      if (!hints) {
        return [];
      }

      return [
        {
          hintRef: phase15bSafeHintRef(sourceRef),
          requiredApprovals: phase15bRequiredApprovalsForHandoff(hints),
          sandboxBoundary: phase15bSandboxBoundaryForHandoff(hints),
          rollbackReference: phase15bRollbackReferenceForHandoff(hints),
          expectedEvidence: phase15bExpectedEvidenceForHandoff(hints),
          riskNormalization: {
            riskLevel: hints.riskNormalization.riskLevel,
            blockedActionType: hints.riskNormalization.blockedActionType,
            blockReason: phase15bSafeReadinessText(hints.riskNormalization.blockReason),
            userVisibleAction: phase15bSafeReadinessText(hints.riskNormalization.userVisibleAction),
            escalationTarget: phase15bSafeReadinessText(hints.riskNormalization.escalationTarget)
          },
          sourceTrace: hints.sourceRefs.map(phase15bSafeSourceTrace),
          noExecutionPolicy: "metadata_only_no_execution" as const
        }
      ];
    });
}

function sourceRefForStateSourceId(
  state: ProductEngineStateSnapshot,
  sourceId: string,
  fallbackLabel?: string
): PlanningHandoffSourceRefDto {
  const sourceLabel = fallbackLabel && fallbackLabel !== sourceId ? fallbackLabel : undefined;
  const base = {
    sourceId,
    ...(sourceLabel ? { sourceLabel } : {}),
    required: false,
    stale: false
  };

  if (state.decisions.some((decision) => decision.decisionId === sourceId && decision.status === "risk_accepted")) {
    return {
      ...base,
      sourceType: "risk_acceptance"
    };
  }

  if (state.decisions.some((decision) => decision.decisionId === sourceId)) {
    return {
      ...base,
      sourceType: "decision"
    };
  }

  if (state.researchState.evidencePacks.some((pack) => pack.evidencePackId === sourceId)) {
    return {
      ...base,
      sourceType: "decision_linked_evidence_pack"
    };
  }

  if (
    allQueueItems(state.queueProjection).some(
      (item) => isResearchUpdatedQueueItem(item) && researchUpdatedQueueItemMatchesSourceId(item, sourceId)
    ) ||
    state.researchState.reviewCards.some((card) => researchReviewCardMatchesSourceId(card, sourceId))
  ) {
    return {
      ...base,
      sourceType: "research_updated_queue_item"
    };
  }

  if (state.openIssues.some((issue) => issue.queueItemId === sourceId)) {
    return {
      ...base,
      sourceType: "open_question"
    };
  }

  return {
    ...base,
    sourceType: "known_risk"
  };
}

function isRiskAcceptedDecisionSource(
  state: ProductEngineStateSnapshot,
  sourceRef: PlanningHandoffSourceRefDto
) {
  if (sourceRef.stale || (sourceRef.sourceType !== "risk_acceptance" && sourceRef.sourceType !== "decision")) {
    return false;
  }

  return state.decisions.some(
    (decision) => decision.decisionId === sourceRef.sourceId && decision.status === "risk_accepted"
  );
}

function riskAcceptanceDecisionIds(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
) {
  return sourceRefs
    .filter((sourceRef) => isRiskAcceptedDecisionSource(state, sourceRef))
    .map((sourceRef) => sourceRef.sourceId);
}

function hasRiskAcceptanceLinkedTo(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  linkableSourceIds: readonly (string | undefined)[]
) {
  const linkableSourceIdSet = new Set(linkableSourceIds.filter((sourceId): sourceId is string => Boolean(sourceId)));

  return riskAcceptanceDecisionIds(state, sourceRefs).some((decisionId) => linkableSourceIdSet.has(decisionId));
}

function researchUpdatedQueueItemMatchesSourceId(item: QueueItemProjection, sourceId: string) {
  return item.queueItemId === sourceId || item.sourceRef === sourceId;
}

function researchReviewCardMatchesSourceId(card: ResearchReviewCardProjection, sourceId: string) {
  return card.cardId === sourceId;
}

function sourceRefForResearchUpdatedQueueItemSourceId(
  item: QueueItemProjection,
  sourceId: string
): PlanningHandoffSourceRefDto {
  return {
    sourceType: "research_updated_queue_item",
    sourceId,
    sourceLabel: sourceId === item.sourceRef ? `${item.title} source trace` : item.title,
    required: true,
    stale: false
  };
}

function sourceRefsForQueueItem(
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  item: QueueItemProjection
): readonly PlanningHandoffSourceRefDto[] {
  const sourceIds = uniqueStrings(
    [item.queueItemId, item.sourceRef].filter((sourceId): sourceId is string => Boolean(sourceId))
  );
  const matchingSourceRefs = sourceRefs.filter(
    (sourceRef) =>
      sourceRef.sourceType === "research_updated_queue_item" && sourceIds.includes(sourceRef.sourceId)
  );
  const fallbackSourceRefs = sourceIds
    .filter(
      (sourceId) =>
        !matchingSourceRefs.some((sourceRef) =>
          sourceRefMatches(sourceRef, "research_updated_queue_item", sourceId)
        )
    )
    .map((sourceId) => sourceRefForResearchUpdatedQueueItemSourceId(item, sourceId));

  return uniquePlanningHandoffSourceRefs([...matchingSourceRefs, ...fallbackSourceRefs]);
}

function sourceTraceBlockers(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffBlockerDto[] {
  const blockers: PlanningHandoffBlockerDto[] = [];
  const requiredCurrentRefs = sourceRefs.filter((sourceRef) => sourceRef.required && !sourceRef.stale);
  const requiredSourceTypes = new Set(requiredCurrentRefs.map((sourceRef) => sourceRef.sourceType));

  for (const requirement of PLANNING_HANDOFF_REQUIRED_SOURCE_REQUIREMENTS) {
    if (requirement.sourceTypes.some((sourceType) => requiredSourceTypes.has(sourceType))) {
      continue;
    }

    blockers.push({
      blockerId: requirement.blockerId,
      blockerClass: "source_trace",
      whyFatal: requirement.whyFatal,
      requiredNextAction: requirement.requiredNextAction,
      sourceRefs: []
    });
  }

  for (const sourceRef of sourceRefs) {
    if (sourceRef.required && (sourceRef.stale || !planningHandoffSourceExists(state, sourceRef))) {
      blockers.push({
        blockerId: `blocker_source_trace_${stableToken(`${sourceRef.sourceType}:${sourceRef.sourceId}`)}`,
        blockerClass: "source_trace",
        whyFatal: sourceRef.stale
          ? "Planning Handoff cannot use stale required source traces."
          : "Planning Handoff cannot use required source refs that are not present, accepted, and current in the loaded ProductEngine state.",
        requiredNextAction: sourceRef.sourceType === "research_updated_queue_item" ? "research_more" : "revise",
        sourceRefs: [sourceRef]
      });
    }
  }

  return blockers;
}

function isResearchUpdatedQueueItem(item: QueueItemProjection) {
  return (
    item.cardType === "research_review" ||
    item.cardType === "decision_approval" ||
    item.cardType === "risk_acceptance" ||
    item.cardType === "conflict_resolution" ||
    item.cardType === "follow_up_question" ||
    Boolean(item.researchTaskId) ||
    Boolean(item.evidencePackId) ||
    item.blocksPlanning === true
  );
}

function researchQueueClassificationText(
  item: QueueItemProjection,
  card: ResearchReviewCardProjection | undefined
) {
  return [
    item.title,
    item.sectionRef,
    item.topicKey,
    card?.title,
    card?.decisionContext,
    card?.reviewReason,
    card?.retainedSourceRef,
    ...(card?.retainedSourceRefs ?? [])
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function firstMatchingPlanningClass<TKeywordMap extends Readonly<Record<string, readonly string[]>>>(
  normalizedText: string,
  keywordMap: TKeywordMap
): (keyof TKeywordMap & string) | null {
  for (const planningClass of Object.keys(keywordMap) as readonly (keyof TKeywordMap & string)[]) {
    const keywords = keywordMap[planningClass] ?? [];

    if (keywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
      return planningClass;
    }
  }

  return null;
}

function fallbackBlockerClassForQueueItem(item: QueueItemProjection): PlanningHandoffBlockerClass {
  if (item.cardType === "risk_acceptance") {
    return "approval_security_execution_safety";
  }

  if (item.cardType === "decision_approval") {
    return "success_metrics_validation";
  }

  return "customer_problem_jtbd";
}

function planningClassForResearchQueueItem(
  item: QueueItemProjection,
  card: ResearchReviewCardProjection | undefined
):
  | { readonly kind: "fatal"; readonly blockerClass: PlanningHandoffBlockerClass }
  | { readonly kind: "residual"; readonly residualRiskClass: PlanningHandoffResidualRiskClass } {
  const normalizedText = researchQueueClassificationText(item, card);
  const fatalClass = firstMatchingPlanningClass(normalizedText, RESEARCH_QUEUE_FATAL_CLASS_KEYWORDS);

  if (fatalClass) {
    return {
      kind: "fatal",
      blockerClass: fatalClass
    };
  }

  const residualRiskClass = firstMatchingPlanningClass(
    normalizedText,
    RESEARCH_QUEUE_RESIDUAL_RISK_KEYWORDS
  );

  if (residualRiskClass) {
    return {
      kind: "residual",
      residualRiskClass
    };
  }

  return {
    kind: "fatal",
    blockerClass: fallbackBlockerClassForQueueItem(item)
  };
}

function highImpactPlanningQueueItems(state: ProductEngineStateSnapshot): readonly QueueItemProjection[] {
  const queueItems = allQueueItems(state.queueProjection).filter(isResearchUpdatedQueueItem);
  const cardIds = new Set(queueItems.map((item) => item.queueItemId));
  const itemsFromCards = state.researchState.reviewCards
    .filter((card) => !cardIds.has(card.cardId) && (card.impact === "high" || card.blocksPlanning))
    .map((card) => ({
      queueItemId: card.cardId,
      title: card.title,
      state: card.state === "resolved" ? ("resolved" as const) : ("blocked" as const),
      cardType: card.cardType,
      researchTaskId: card.researchTaskId,
      ...(card.evidencePackId ? { evidencePackId: card.evidencePackId } : {}),
      blocksPlanning: card.blocksPlanning,
      availableOutcomes: card.availableOutcomes,
      ...(card.terminalOutcome ? { terminalOutcome: card.terminalOutcome } : {}),
      ...(card.terminalRationale ? { terminalRationale: card.terminalRationale } : {})
    } satisfies QueueItemProjection));

  return [...queueItems, ...itemsFromCards].filter((item) => {
    const card = state.researchState.reviewCards.find((candidate) => candidate.cardId === item.queueItemId);

    return item.blocksPlanning === true || card?.impact === "high";
  });
}

function queueOutcomeSummary(
  item: QueueItemProjection,
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): PlanningHandoffQueueOutcomeSummaryDto | null {
  const card = state.researchState.reviewCards.find((candidate) => candidate.cardId === item.queueItemId);
  const terminalOutcome = item.terminalOutcome ?? card?.terminalOutcome;

  if (!terminalOutcome) {
    return null;
  }

  const planningClass = planningClassForResearchQueueItem(item, card);
  const riskAccepted =
    terminalOutcome === "risk_accepted" ||
    hasRiskAcceptanceLinkedTo(state, sourceRefs, [
      item.queueItemId,
      item.researchTaskId,
      item.evidencePackId,
      card?.cardId,
      card?.researchTaskId,
      card?.evidencePackId,
      card?.retainedSourceRef,
      ...(card?.retainedSourceRefs ?? [])
    ]);
  const carriesResidualRisk =
    terminalOutcome === "risk_accepted" ||
    ((terminalOutcome === "deferred" || terminalOutcome === "research_insufficient") &&
      (riskAccepted || planningClass.kind === "residual"));

  return {
    queueItemId: item.queueItemId,
    outcome: terminalOutcome as PlanningHandoffQueueOutcome,
    impact: card?.impact ?? (item.blocksPlanning ? "high" : "medium"),
    ...(terminalOutcome === "research_insufficient" || terminalOutcome === "deferred"
      ? planningClass.kind === "fatal"
        ? { blockerClass: planningClass.blockerClass }
        : {}
      : {}),
    ...(carriesResidualRisk
      ? {
          residualRiskClass:
            terminalOutcome === "risk_accepted" || riskAccepted
              ? ("known_low_medium_risk" as PlanningHandoffResidualRiskClass)
              : planningClass.kind === "residual"
                ? planningClass.residualRiskClass
                : ("known_low_medium_risk" as PlanningHandoffResidualRiskClass)
        }
      : {}),
    riskAccepted,
    sourceRefs: sourceRefsForQueueItem(sourceRefs, item)
  };
}

function queueReviewIncompleteBlockers(
  queueItems: readonly QueueItemProjection[],
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffBlockerDto[] {
  return queueItems
    .filter((item) => !queueOutcomeSummary(item, state, sourceRefs))
    .map((item) => ({
      blockerId: `blocker_queue_review_${stableToken(item.queueItemId)}`,
      blockerClass: "queue_review" as const,
      queueItemId: item.queueItemId,
      whyFatal: "High-impact research-updated queue cards need an explicit terminal outcome before final handoff.",
      requiredNextAction: "research_more" as const,
      sourceRefs: sourceRefsForQueueItem(sourceRefs, item)
    }));
}

function fatalQueueBlockersFromSummaries(
  summaries: readonly PlanningHandoffQueueOutcomeSummaryDto[]
): readonly PlanningHandoffBlockerDto[] {
  return summaries
    .filter(
      (summary) =>
        Boolean(summary.blockerClass) &&
        (summary.outcome === "research_insufficient" || summary.outcome === "deferred") &&
        !summary.riskAccepted
    )
    .map((summary) => ({
      blockerId: `blocker_fatal_queue_${stableToken(`${summary.queueItemId}:${summary.outcome}`)}`,
      blockerClass: summary.blockerClass ?? "customer_problem_jtbd",
      queueItemId: summary.queueItemId,
      currentOutcome: summary.outcome,
      whyFatal:
        summary.outcome === "deferred"
          ? "High-impact queue card is deferred without explicit risk acceptance."
          : "High-impact queue card remains research_insufficient.",
      requiredNextAction: summary.outcome === "deferred" ? ("risk_accept" as const) : ("research_more" as const),
      sourceRefs: summary.sourceRefs
    }));
}

function riskAcceptanceNeededBlockers(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
): readonly PlanningHandoffBlockerDto[] {
  return state.completeness.topRiskCards
    .filter(
      (risk) =>
        risk.severity === "high" &&
        !hasRiskAcceptanceLinkedTo(state, sourceRefs, [risk.riskId, ...risk.sourceRefs])
    )
    .map((risk) => {
      const riskSourceRef: PlanningHandoffSourceRefDto = {
        sourceType: "known_risk",
        sourceId: risk.riskId,
        sourceLabel: risk.title,
        required: false,
        stale: false
      };

      return {
        blockerId: `blocker_risk_acceptance_${stableToken(risk.riskId)}`,
        blockerClass: "approval_security_execution_safety" as const,
        whyFatal: "A high-severity known risk is visible but has not been explicitly risk-accepted.",
        requiredNextAction: "risk_accept" as const,
        sourceRefs: [riskSourceRef]
      };
    });
}

function residualRisksForPlanningHandoff(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[]
): readonly PlanningHandoffResidualRiskDto[] {
  const residualRisks = new Map<string, PlanningHandoffResidualRiskDto>();
  const addResidualRisk = (risk: PlanningHandoffResidualRiskDto) => {
    if (!residualRisks.has(risk.riskId)) {
      residualRisks.set(risk.riskId, risk);
    }
  };

  for (const summary of queueSummaries.filter((candidate) => candidate.residualRiskClass)) {
    const queueSourceRef = summary.sourceRefs.find((sourceRef) => sourceRef.sourceType === "research_updated_queue_item");
    const label = queueSourceRef?.sourceLabel ?? summary.queueItemId;
    const riskId = `research_queue_${summary.queueItemId}_${summary.outcome}`;

    addResidualRisk({
      riskId,
      riskClass: summary.residualRiskClass ?? "known_low_medium_risk",
      title: `Research-updated queue ${summary.outcome}: ${label}`,
      severity: summary.impact,
      sourceRefs: summary.sourceRefs,
      assumption: summary.riskAccepted
        ? "The residual research risk has an explicit risk-acceptance trace."
        : "The residual research risk is non-fatal only while it remains visible in the Planning Handoff.",
      prerequisite:
        summary.outcome === "research_insufficient"
          ? "Reviewer preserves the insufficient evidence boundary before planning downstream implementation."
          : "Reviewer preserves the deferred research rationale before planning downstream implementation.",
      validationDependency:
        summary.outcome === "research_insufficient"
          ? "Supplement or validate the carried research gap before controlled execution."
          : "Revisit the deferred research card before controlled execution or scope expansion.",
      ownerRole: "research",
      followUpTrigger: "Before Phase 3 controlled execution or any broader product scope commitment."
    });
  }

  for (const risk of state.completeness.topRiskCards) {
    addResidualRisk({
      riskId: risk.riskId,
      riskClass: "known_low_medium_risk",
      title: risk.title,
      severity: risk.severity,
      sourceRefs: risk.sourceRefs.length
        ? risk.sourceRefs.map((sourceId) => sourceRefForStateSourceId(state, sourceId, risk.title))
        : sourceRefs.filter((sourceRef) => sourceRef.sourceType === "known_risk"),
      assumption: "Risk is visible in the Planning Handoff and remains non-executing metadata.",
      prerequisite: "Reviewer keeps or resolves this risk before downstream execution scope.",
      validationDependency: risk.nextValidationAction,
      ownerRole: "product",
      followUpTrigger: "When the next build slice is accepted or rejected."
    });
  }

  for (const risk of [...state.researchState.knownRisks, ...(state.founderBrief?.knownRisks ?? [])]) {
    addResidualRisk({
      riskId: risk,
      riskClass: "known_low_medium_risk",
      title: risk,
      severity: "medium",
      sourceRefs: [sourceRefForStateSourceId(state, risk)],
      assumption: "Known risk is preserved from research or Founder Brief context.",
      prerequisite: "Reviewer keeps the risk visible until a later decision resolves or accepts it.",
      validationDependency: "Confirm whether this known risk affects the next build slice.",
      ownerRole: "product",
      followUpTrigger: "When the next build slice scope is narrowed, accepted, or rejected."
    });
  }

  for (const issue of state.openIssues.filter((candidate) => candidate.status === "open")) {
    addResidualRisk({
      riskId: `open_question_${issue.queueItemId}`,
      riskClass: "mvp_scope_non_scope",
      title: issue.summary,
      severity: "medium",
      sourceRefs: [
        {
          sourceType: "open_question",
          sourceId: issue.queueItemId,
          sourceLabel: issue.questionText ?? issue.summary,
          required: false,
          stale: false
        }
      ],
      assumption: "Open question is intentionally visible rather than hidden before downstream build work.",
      prerequisite: "Reviewer confirms the question can remain non-fatal for the next slice.",
      validationDependency: issue.questionText ?? "Resolve or explicitly carry this open question.",
      ownerRole: "product",
      followUpTrigger: "When the next build slice converts the open question into a decision, scope cut, or risk acceptance."
    });
  }

  return [...residualRisks.values()];
}

function uniqueRequiredUserActions(
  blockers: readonly PlanningHandoffBlockerDto[]
): readonly PlanningHandoffRequiredUserAction[] {
  return [...new Set(blockers.map((blocker) => blocker.requiredNextAction))];
}

function planningHandoffGateContext(
  state: ProductEngineStateSnapshot,
  sourceRefs: readonly PlanningHandoffSourceRefDto[]
) {
  const sourceBlockers = sourceTraceBlockers(state, sourceRefs);
  const queueItems = highImpactPlanningQueueItems(state);
  const queueSummaries = queueItems
    .map((item) => queueOutcomeSummary(item, state, sourceRefs))
    .filter((summary): summary is PlanningHandoffQueueOutcomeSummaryDto => Boolean(summary));
  const queueBlockers = queueReviewIncompleteBlockers(queueItems, state, sourceRefs);
  const fatalBlockers = fatalQueueBlockersFromSummaries(queueSummaries);
  const riskAcceptanceBlockers = riskAcceptanceNeededBlockers(state, sourceRefs);
  const residualRisks = residualRisksForPlanningHandoff(state, sourceRefs, queueSummaries);

  if (sourceBlockers.length > 0) {
    return {
      verdict: "source_trace_incomplete" as const,
      blockers: sourceBlockers,
      queueSummaries,
      residualRisks
    };
  }

  if (queueBlockers.length > 0) {
    return {
      verdict: "queue_review_incomplete" as const,
      blockers: queueBlockers,
      queueSummaries,
      residualRisks
    };
  }

  if (fatalBlockers.length > 0) {
    return {
      verdict: "blocked_by_fatal" as const,
      blockers: fatalBlockers,
      queueSummaries,
      residualRisks
    };
  }

  if (riskAcceptanceBlockers.length > 0) {
    return {
      verdict: "needs_risk_acceptance" as const,
      blockers: riskAcceptanceBlockers,
      queueSummaries,
      residualRisks
    };
  }

  return {
    verdict: "planning_ready" as const,
    blockers: [] as readonly PlanningHandoffBlockerDto[],
    queueSummaries,
    residualRisks
  };
}

function planningHandoffGateVerdict(
  verdict: PlanningHandoffVerdict,
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  rationale: string
): PlanningHandoffGateVerdictDto {
  return {
    verdict,
    reviewedQueueItemIds: queueSummaries.map((summary) => summary.queueItemId),
    terminalOutcomeSummary: queueSummaries,
    fatalBlockerClassesChecked: PLANNING_HANDOFF_FATAL_BLOCKER_CLASSES,
    residualRiskVisibilityCheck: verdict === "planning_ready" ? "passed" : "failed",
    rationale
  };
}

function planningHandoffCreatedBy(command: ProductEngineCommand): PlanningHandoffArtifactDto["createdBy"] {
  return command.actor === "user" || command.actor === "product_engine" || command.actor === "system"
    ? command.actor
    : "product_engine";
}

function sortedStrings(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function planningHandoffSourceRefHashMaterial(sourceRefs: readonly PlanningHandoffSourceRefDto[]) {
  return [...sourceRefs]
    .sort((left, right) =>
      `${left.sourceType}:${left.sourceId}:${left.sourceLabel ?? ""}`.localeCompare(
        `${right.sourceType}:${right.sourceId}:${right.sourceLabel ?? ""}`
      )
    )
    .map((sourceRef) => ({
      sourceType: sourceRef.sourceType,
      sourceId: sourceRef.sourceId,
      sourceLabel: sourceRef.sourceLabel ?? null,
      required: sourceRef.required,
      stale: sourceRef.stale
    }));
}

function planningHandoffScopeHashMaterial(scope: PlanningHandoffRequestedScopeDto) {
  return {
    productSlice: scope.productSlice,
    userFacingJourneyLabel: scope.userFacingJourneyLabel,
    projectPurposeMode: scope.projectPurposeMode ?? null,
    projectPurposeModeLabel: scope.projectPurposeModeLabel ?? null,
    projectPurposeModeEffect: scope.projectPurposeModeEffect ?? null,
    skippedCommercializationAxes: sortedStrings(scope.skippedCommercializationAxes ?? []),
    nonGoals: sortedStrings(scope.nonGoals),
    excludedInternalPhases: sortedStrings(scope.excludedInternalPhases),
    assumptions: sortedStrings(scope.assumptions)
  };
}

function planningHandoffArtifactIdentityKey(
  command: ProductEngineCommand,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto
) {
  const sourceRefsHash = sha256Hex(JSON.stringify(planningHandoffSourceRefHashMaterial(sourceRefs)));
  const scopeHash = sha256Hex(JSON.stringify(planningHandoffScopeHashMaterial(scope)));

  return `CreatePlanningHandoff:${command.sessionId}:${command.expectedStateVersion}:${sourceRefsHash}:${scopeHash}`;
}

function planningHandoffArtifactId(
  command: ProductEngineCommand,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto
) {
  return `handoff_${sha256Hex(planningHandoffArtifactIdentityKey(command, sourceRefs, scope)).slice(0, 32)}`;
}

function planningHandoffSourceRefsForTypes(
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  sourceTypes: readonly PlanningHandoffSourceType[]
) {
  const sourceTypeSet = new Set(sourceTypes);

  return sourceRefs.filter((sourceRef) => sourceTypeSet.has(sourceRef.sourceType));
}

function fallbackSourceRefs(
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  preferredSourceRefs: readonly PlanningHandoffSourceRefDto[]
) {
  return preferredSourceRefs.length ? preferredSourceRefs : sourceRefs;
}

function planningHandoffTaskId(artifactId: string, taskKey: string) {
  return `task_${stableToken(`${artifactId}:${taskKey}`)}`;
}

function sourceTraceLabels(sourceRefs: readonly PlanningHandoffSourceRefDto[]) {
  return sourceRefs.map((sourceRef) => `${sourceRef.sourceType}:${sourceRef.sourceId}`);
}

function queueOutcomeEvidence(queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[]) {
  return queueSummaries.map(
    (summary) => `Research-updated queue ${summary.queueItemId} terminal outcome is ${summary.outcome}.`
  );
}

function sourceDrivenPlanningHandoffTasks(
  artifactId: string,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto,
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  residualRisks: readonly PlanningHandoffResidualRiskDto[],
  phase15bExpectedEvidence: readonly string[]
): readonly PlanningHandoffTaskDto[] {
  const productContextSourceRefs = fallbackSourceRefs(
    sourceRefs,
    planningHandoffSourceRefsForTypes(sourceRefs, ["spec_version", "founder_brief", "completion_candidate"])
  );
  const decisionEvidenceSourceRefs = fallbackSourceRefs(
    sourceRefs,
    planningHandoffSourceRefsForTypes(sourceRefs, [
      "decision_linked_evidence_pack",
      "research_updated_queue_item",
      "decision",
      "risk_acceptance"
    ])
  );
  const readinessSourceRefs = fallbackSourceRefs(
    sourceRefs,
    planningHandoffSourceRefsForTypes(sourceRefs, [
      "known_risk",
      "open_question",
      "phase15b_hint",
      "runtime_preview_artifact",
      "activity_event"
    ])
  );
  const productContextTaskId = planningHandoffTaskId(artifactId, "product-context");
  const decisionEvidenceTaskId = planningHandoffTaskId(artifactId, "decision-evidence");
  const readinessTaskId = planningHandoffTaskId(artifactId, "readiness-risk");
  const riskRefs = residualRisks.map((risk) => risk.riskId);

  return [
    {
      taskId: productContextTaskId,
      title: `${scope.productSlice} product context와 non-goal source trace 고정`,
      intent:
        "Spec, Founder Brief, or Completion Candidate source refs define the implementation slice before downstream task planning starts.",
      sourceRefs: productContextSourceRefs,
      dependsOn: [],
      ownerRole: "product",
      acceptanceEvidence: uniqueStrings([
        "Living Product Spec source trace is current.",
        "Founder-facing summary or Completion Candidate is current.",
        ...sourceTraceLabels(productContextSourceRefs)
      ]),
      nonGoals: scope.nonGoals,
      riskRefs: []
    },
    {
      taskId: decisionEvidenceTaskId,
      title: `${scope.productSlice} evidence와 Research-updated Queue outcome을 task로 합성`,
      intent:
        "Decision-linked Evidence Pack and terminal Research-updated Queue outcomes drive the concrete PR-sized task and acceptance evidence.",
      sourceRefs: decisionEvidenceSourceRefs,
      dependsOn: [productContextTaskId],
      ownerRole: "research",
      acceptanceEvidence: uniqueStrings([
        "Decision-linked Evidence Pack remains accepted or explicitly marked research_insufficient.",
        ...queueOutcomeEvidence(queueSummaries),
        ...sourceTraceLabels(decisionEvidenceSourceRefs)
      ]),
      nonGoals: scope.nonGoals,
      riskRefs
    },
    {
      taskId: readinessTaskId,
      title: `${scope.productSlice} readiness, residual risk, no-execution boundary 검증`,
      intent:
        "Known risks, open questions, Phase 1.5B hints, and preview/activity refs stay visible as planning metadata without granting execution authority.",
      sourceRefs: readinessSourceRefs,
      dependsOn: [productContextTaskId, decisionEvidenceTaskId],
      ownerRole: phase15bExpectedEvidence.length ? "security" : "qa",
      acceptanceEvidence: uniqueStrings([
        "Residual risks are present in the handoff instead of hidden.",
        "No file, shell, browser, deploy, credential, external mutation, or active delegation authority is introduced.",
        "Blocker paths remain separate from final Planning-ready copy.",
        ...phase15bExpectedEvidence,
        ...sourceTraceLabels(readinessSourceRefs)
      ]),
      nonGoals: scope.nonGoals,
      riskRefs
    }
  ];
}

function planningHandoffPrIssuePlan(
  artifactId: string,
  tasks: readonly PlanningHandoffTaskDto[],
  phase15bRequiredApprovals: readonly string[],
  phase15bHintMapping: PlanningHandoffArtifactDto["phase15bHintMapping"],
  phase15bExpectedEvidence: readonly string[]
): PlanningHandoffArtifactDto["prIssuePlan"] {
  return tasks.map((task, index) => ({
    sequenceId: `phase2_${String(index + 1).padStart(2, "0")}_${stableToken(`${artifactId}:${task.taskId}`)}`,
    summary: `${task.title} 완료`,
    includedTaskIds: [task.taskId],
    entryPrerequisites: uniqueStrings([
      index === 0
        ? "Planning Handoff gate verdict is planning_ready."
        : `Previous source-driven task ${tasks[index - 1]!.taskId} is reviewed.`,
      ...task.sourceRefs.map((sourceRef) => `${sourceRef.sourceType}:${sourceRef.sourceId} source trace is current.`),
      ...phase15bRequiredApprovals,
      ...phase15bHintMapping.map((mapping) => `Phase 1.5B sandbox: ${mapping.sandboxBoundary}`),
      ...phase15bHintMapping.map((mapping) => `Phase 1.5B rollback: ${mapping.rollbackReference}`)
    ]),
    exitEvidence: uniqueStrings([
      ...task.acceptanceEvidence,
      "Tests and docs contract checks pass.",
      "No execution authority was introduced.",
      ...phase15bExpectedEvidence
    ]),
    blockedBy: task.dependsOn,
    phaseBoundary: "phase2_planning_handoff" as const
  }));
}

function buildSliceCapabilities(tasks: readonly PlanningHandoffTaskDto[]) {
  return uniqueStrings([
    "source-driven task synthesis",
    "deterministic planning handoff",
    "visible source trace",
    "visible residual risk",
    ...tasks.map((task) => `${task.ownerRole} task: ${task.title}`)
  ]);
}

function buildPlanningHandoffFinalArtifact(
  command: ProductEngineCommand,
  artifactId: string,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  scope: PlanningHandoffRequestedScopeDto,
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  residualRisks: readonly PlanningHandoffResidualRiskDto[],
  phase15bHintMapping: PlanningHandoffArtifactDto["phase15bHintMapping"]
): PlanningHandoffArtifactDto {
  const phase15bExpectedEvidence = uniqueStrings(
    phase15bHintMapping.flatMap((mapping) => mapping.expectedEvidence)
  );
  const phase15bRequiredApprovals = uniqueStrings(
    phase15bHintMapping.flatMap((mapping) => mapping.requiredApprovals)
  );
  const phase15bResidualRisks: readonly PlanningHandoffResidualRiskDto[] = phase15bHintMapping.map((mapping) => ({
    riskId: `phase15b_${stableToken(mapping.hintRef.sourceId)}`,
    riskClass: "phase15b_readiness_gap",
    title: `Phase 1.5B readiness hint preserved for ${mapping.riskNormalization.blockedActionType}`,
    severity:
      mapping.riskNormalization.riskLevel === "critical" || mapping.riskNormalization.riskLevel === "high"
        ? "high"
        : mapping.riskNormalization.riskLevel,
    sourceRefs: [mapping.hintRef],
    assumption: "Phase 1.5B hint metadata is reusable for planning but still grants no execution authority.",
    prerequisite: mapping.riskNormalization.userVisibleAction,
    validationDependency: mapping.riskNormalization.blockReason,
    ownerRole: "security",
    followUpTrigger: "Before Phase 3 controlled execution, delegation, browser automation, or external mutation."
  }));
  const residualRiskRegister = [...residualRisks, ...phase15bResidualRisks];
  const taskBreakdown = sourceDrivenPlanningHandoffTasks(
    artifactId,
    sourceRefs,
    scope,
    queueSummaries,
    residualRiskRegister,
    phase15bExpectedEvidence
  );
  const purposeModeCopy = scope.projectPurposeModeLabel ? `${scope.projectPurposeModeLabel} 기준으로 ` : "";
  const handoffSummary = `Planning-ready handoff가 준비됐습니다: ${purposeModeCopy}${scope.productSlice}. 실행 권한 없이 다음 구현 조각과 잔여 리스크만 고정합니다.`;

  return {
    artifactId,
    kind: "PlanningHandoffArtifact",
    schemaVersion: "solo-superman.phase2-planning-handoff.v1",
    createdAt: command.issuedAt,
    createdBy: planningHandoffCreatedBy(command),
    status: "planning_ready",
    sourceRefs,
    gateVerdict: planningHandoffGateVerdict(
      "planning_ready",
      queueSummaries,
      "All required source traces are current, high-impact queue cards are terminal, and residual risks are visible."
    ) as PlanningHandoffArtifactDto["gateVerdict"],
    scopeSnapshot: scope,
    taskBreakdown,
    prIssuePlan: planningHandoffPrIssuePlan(
      artifactId,
      taskBreakdown,
      phase15bRequiredApprovals,
      phase15bHintMapping,
      phase15bExpectedEvidence
    ),
    buildSlicePlan: {
      sliceGoal: scope.productSlice,
      includedCapabilities: buildSliceCapabilities(taskBreakdown),
      nonGoals: scope.nonGoals,
      sourceRefs,
      acceptanceCriteria: [
        "Final handoff exists only for planning_ready verdict.",
        "Spec/Evidence/Queue sources drive task and PR/issue breakdown instead of a generic scaffold.",
        "Blocker paths remain separate."
      ],
      smokeTests: uniqueStrings([
        "run ProductEngine reducer tests",
        "run Planning Handoff UI trigger smoke tests",
        "run docs verifier",
        ...phase15bExpectedEvidence
      ]),
      validationMetric:
        "Reviewer can trace each next PR-sized build slice back to Spec, Evidence Pack, Queue outcome, and visible residual risk sources.",
      residualRisks: residualRiskRegister.map((risk) => risk.riskId)
    },
    serveChecklist: {
      serveTarget: "local preview",
      envVars: [
        {
          envVarName: "SOLO_SUPERMAN_LOCAL_TOKEN",
          required: false,
          present: false,
          valueIncluded: false,
          note: "Token values are not included in Planning Handoff artifacts."
        }
      ],
      authAndPrivacyCheck: "Planning-ready remains local/read-only metadata and hides credential values.",
      smokeTestChecklist: ["Confirm final label appears only after planning_ready.", "Confirm no execution controls appear."],
      rollbackPlan: "Discard the handoff projection and return to queue review.",
      launchNote: "Planning-ready context is ready for review; execution remains out of scope.",
      learningMetrics: ["handoff understood", "next slice accepted", "blocker revisions requested"]
    },
    learningLoopHook: {
      signalsToCollect: ["reviewer questions", "accepted next-slice task", "blocker revision reasons"],
      interpretationFrame: "Signals update planning confidence and visible residual risk only.",
      decisionOptions: ["persevere", "narrow_scope", "next_slice"],
      recommendedNextSliceRule: "Recommend the next slice only while fatal blockers stay resolved or risk-accepted.",
      riskUpdateRule: "Convert repeated blocker feedback into Known Risks or queue items before retrying final handoff."
    },
    readinessChecklist: {
      requiredApprovals: uniqueStrings(["Reviewer confirms the Planning-ready handoff.", ...phase15bRequiredApprovals]),
      sandboxBoundary: [
        "No file, shell, browser, deploy, credential, or external mutation authority.",
        ...phase15bHintMapping.map((mapping) => `Phase 1.5B hint ${mapping.hintRef.sourceId}: ${mapping.sandboxBoundary}`)
      ].join(" "),
      rollbackReference: [
        `recompute CreatePlanningHandoff from stateVersion ${command.expectedStateVersion}`,
        ...phase15bHintMapping.map((mapping) => `Phase 1.5B hint ${mapping.hintRef.sourceId}: ${mapping.rollbackReference}`)
      ].join("; "),
      expectedEvidence: uniqueStrings([
        "pnpm --filter @solo-superman/core test -- product-engine",
        "pnpm verify:docs",
        ...phase15bExpectedEvidence
      ]),
      commandPreviewRequirements: ["Command previews remain non-executing."],
      filePreviewRequirements: ["File patches are future evidence only."],
      browserPreviewRequirements: ["Browser actions remain excluded from Phase 2 handoff."]
    },
    residualRiskRegister,
    phase15bHintMapping,
    noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation",
    handoffSummary
  };
}

function buildPlanningHandoffBlockerArtifact(
  command: ProductEngineCommand,
  artifactId: string,
  verdict: NonReadyPlanningHandoffVerdict,
  sourceRefs: readonly PlanningHandoffSourceRefDto[],
  blockers: readonly PlanningHandoffBlockerDto[],
  queueSummaries: readonly PlanningHandoffQueueOutcomeSummaryDto[],
  residualRisks: readonly PlanningHandoffResidualRiskDto[],
  phase15bHintMapping: PlanningHandoffArtifactDto["phase15bHintMapping"]
): PlanningHandoffBlockerArtifactDto {
  return {
    artifactId,
    kind: "PlanningHandoffBlockerArtifact",
    schemaVersion: "solo-superman.phase2-planning-handoff-blocker.v1",
    createdAt: command.issuedAt,
    createdBy: planningHandoffCreatedBy(command),
    status: verdict,
    sourceRefs,
    gateVerdict: planningHandoffGateVerdict(
      verdict,
      queueSummaries,
      "Planning Handoff gate failed, so the reducer emitted a durable blocker artifact instead of a transient rejection."
    ) as PlanningHandoffBlockerArtifactDto["gateVerdict"],
    blockers,
    residualRisks,
    requiredUserActions: uniqueRequiredUserActions(blockers),
    safePreviewRefs: sourceRefs.filter(
      (sourceRef) => sourceRef.sourceType === "runtime_preview_artifact" || sourceRef.sourceType === "phase15b_hint"
    ),
    phase15bHintMapping,
    noFinalLabelRule: "must_not_use_planning_ready_label"
  };
}

function planningHandoffProjection(
  command: ProductEngineCommand,
  artifact: PlanningHandoffArtifactDto | PlanningHandoffBlockerArtifactDto
): PlanningHandoffProjection {
  const projectionUrl = `/api/v1/sessions/${command.sessionId}/planning-handoff`;
  const version = (Number(command.expectedStateVersion) + 1) as ProjectionVersion;

  if (artifact.kind === "PlanningHandoffArtifact") {
    return {
      kind: "PlanningHandoffProjection",
      sessionId: command.sessionId,
      version,
      currentStatus: "planning_ready",
      finalArtifact: artifact,
      sourceRefs: artifact.sourceRefs,
      summary: artifact.handoffSummary,
      refetchUrl: projectionUrl
    } as PlanningHandoffProjection;
  }

  return {
    kind: "PlanningHandoffProjection",
    sessionId: command.sessionId,
    version,
    currentStatus: artifact.status,
    blockerArtifact: artifact,
    sourceRefs: artifact.sourceRefs,
    summary: "Planning handoff remains blocked until required source traces, queue outcomes, or risk decisions are resolved.",
    refetchUrl: projectionUrl
  } as PlanningHandoffProjection;
}

function reduceCreatePlanningHandoff(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const confirmedMode = requireConfirmedProjectPurposeMode(state, "CreatePlanningHandoff");
  if (typeof confirmedMode !== "string") {
    return confirmedMode;
  }

  if (containsUnsupportedPlanningHandoffPayload(command)) {
    return reject(
      "CreatePlanningHandoff payload must only include sourceRefs and optional requestedScope.",
      "VALIDATION_FAILED"
    );
  }

  const sourceRefsOrRejection = planningHandoffSourceRefsFromPayload(command);

  if ("accepted" in sourceRefsOrRejection) {
    return sourceRefsOrRejection;
  }

  const requestedScope = planningHandoffRequestedScopeFromValue(command.payload.requestedScope);

  if (command.payload.requestedScope !== undefined && !requestedScope) {
    return reject("CreatePlanningHandoff requestedScope is invalid.", "VALIDATION_FAILED");
  }

  const scope = requestedScope ?? derivePlanningHandoffScope(state);
  const gate = planningHandoffGateContext(state, sourceRefsOrRejection);
  const artifactId = planningHandoffArtifactId(command, sourceRefsOrRejection, scope);
  const phase15bHintMapping = phase15bHintMappingsForPlanningHandoff(state, sourceRefsOrRejection);
  const outputSourceRefs = planningHandoffOutputSourceRefs(sourceRefsOrRejection);
  const outputQueueSummaries = planningHandoffOutputQueueSummaries(gate.queueSummaries);
  const outputResidualRisks = planningHandoffOutputResidualRisks(gate.residualRisks);
  const outputBlockers = planningHandoffOutputBlockers(gate.blockers);
  const artifact =
    gate.verdict === "planning_ready"
      ? buildPlanningHandoffFinalArtifact(
          command,
          artifactId,
          outputSourceRefs,
          scope,
          outputQueueSummaries,
          outputResidualRisks,
          phase15bHintMapping
        )
      : buildPlanningHandoffBlockerArtifact(
          command,
          artifactId,
          gate.verdict,
          outputSourceRefs,
          outputBlockers,
          outputQueueSummaries,
          outputResidualRisks,
          phase15bHintMapping
        );
  const projection = planningHandoffProjection(command, artifact);
  const event = eventDraft(
    command,
    artifact.kind === "PlanningHandoffArtifact" ? "PlanningHandoffCreated" : "PlanningHandoffBlocked",
    {
      artifactId,
      verdict: gate.verdict,
      artifactKind: artifact.kind,
      sourceRefs: outputSourceRefs,
      projection,
      summary: projection.summary
    }
  );

  return acceptedReduction(
    command,
    state,
    event,
    {
      planningHandoff: projection
    },
    [
      {
        outputType: "planning_handoff_artifact",
        outputRef: artifactId,
        payload: {
          artifactId,
          verdict: gate.verdict,
          artifactKind: artifact.kind,
          sourceRefs: outputSourceRefs,
          summary: projection.summary
        }
      }
    ],
    [],
    projection
  );
}

const EXECUTION_AUTHORITY_ALLOWED_PAYLOAD_KEYS = [
  "sourcePlanningHandoffRef",
  "boundedAgentOutput",
  "actionClass",
  "previewArtifactRef",
  "previewArtifactHash",
  "reviewedPreviewArtifactHash",
  "requestedScope",
  "approvalDecision",
  "approver",
  "sandboxBoundary",
  "rollbackReference",
  "evidenceRefs",
  "auditRefs",
  "preconditionChecks"
] as const;

function containsUnsupportedExecutionAuthorityPayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, EXECUTION_AUTHORITY_ALLOWED_PAYLOAD_KEYS);
}

function isExecutionAuthorityActionClass(value: unknown): value is ExecutionAuthorityActionClass {
  return (
    typeof value === "string" &&
    EXECUTION_AUTHORITY_ACTION_CLASSES.includes(value as ExecutionAuthorityActionClass)
  );
}

function isExecutionApprovalDecision(value: unknown): value is ExecutionApprovalDecision {
  return typeof value === "string" && EXECUTION_APPROVAL_DECISIONS.includes(value as ExecutionApprovalDecision);
}

function boundedAgentOutputFromValue(value: unknown): BoundedAgentOutputRecord | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const outputId = requiredString(record.outputId);
  const sourceRefs = stringArray(record.sourceRefs, true);
  const intendedDecisionImpact = requiredString(record.intendedDecisionImpact);
  const proposedActionPreviewRefs = stringArray(record.proposedActionPreviewRefs, true);
  const requiredApprovals = stringArray(record.requiredApprovals, true);
  const evidenceRefs = stringArray(record.evidenceRefs, true);
  const failureMode = record.failureMode;
  const noExecutionPolicy = record.noExecutionPolicy;

  if (
    !outputId ||
    !sourceRefs ||
    !intendedDecisionImpact ||
    !proposedActionPreviewRefs ||
    !requiredApprovals ||
    !evidenceRefs ||
    !(
      typeof failureMode === "string" &&
      BOUNDED_AGENT_FAILURE_MODES.includes(failureMode as BoundedAgentOutputRecord["failureMode"])
    ) ||
    !(
      typeof noExecutionPolicy === "string" &&
      BOUNDED_AGENT_NO_EXECUTION_POLICIES.includes(
        noExecutionPolicy as BoundedAgentOutputRecord["noExecutionPolicy"]
      )
    )
  ) {
    return null;
  }

  return {
    outputId,
    sourceRefs,
    intendedDecisionImpact,
    proposedActionPreviewRefs,
    requiredApprovals,
    evidenceRefs,
    failureMode: failureMode as BoundedAgentOutputRecord["failureMode"],
    noExecutionPolicy: noExecutionPolicy as BoundedAgentOutputRecord["noExecutionPolicy"]
  };
}

function executionAuthorityRequestedScopeFromValue(value: unknown): ExecutionAuthorityRequestedScope | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const workspaceRef = record.workspaceRef === undefined ? undefined : requiredString(record.workspaceRef);
  const commandAllowlistRef =
    record.commandAllowlistRef === undefined ? undefined : requiredString(record.commandAllowlistRef);
  const browserTargetRef = record.browserTargetRef === undefined ? undefined : requiredString(record.browserTargetRef);
  const servicePagePermissionId =
    record.servicePagePermissionId === undefined ? undefined : requiredString(record.servicePagePermissionId);
  const servicePageActionClass =
    record.servicePageActionClass === undefined ? undefined : requiredString(record.servicePageActionClass);
  const serviceOrigin = record.serviceOrigin === undefined ? undefined : requiredString(record.serviceOrigin);
  const servicePageUrl = record.servicePageUrl === undefined ? undefined : requiredString(record.servicePageUrl);
  const filePathGlobs = record.filePathGlobs === undefined ? undefined : stringArray(record.filePathGlobs, true);
  const maxDurationMs = record.maxDurationMs;

  if (
    workspaceRef === null ||
    commandAllowlistRef === null ||
    browserTargetRef === null ||
    servicePagePermissionId === null ||
    servicePageActionClass === null ||
    serviceOrigin === null ||
    servicePageUrl === null ||
    (servicePageActionClass !== undefined &&
      !SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES.includes(servicePageActionClass as ServicePageUseActionClass)) ||
    ([
      servicePagePermissionId,
      servicePageActionClass,
      serviceOrigin,
      servicePageUrl
    ].some((field) => field !== undefined) &&
      (!servicePagePermissionId || !servicePageActionClass || !serviceOrigin || !servicePageUrl)) ||
    filePathGlobs === null ||
    (maxDurationMs !== undefined &&
      (typeof maxDurationMs !== "number" || !Number.isInteger(maxDurationMs) || maxDurationMs <= 0))
  ) {
    return null;
  }

  return {
    ...(workspaceRef ? { workspaceRef } : {}),
    ...(commandAllowlistRef ? { commandAllowlistRef } : {}),
    ...(browserTargetRef ? { browserTargetRef } : {}),
    ...(servicePagePermissionId ? { servicePagePermissionId } : {}),
    ...(servicePageActionClass ? { servicePageActionClass: servicePageActionClass as ServicePageUseActionClass } : {}),
    ...(serviceOrigin ? { serviceOrigin } : {}),
    ...(servicePageUrl ? { servicePageUrl } : {}),
    ...(filePathGlobs ? { filePathGlobs } : {}),
    ...(typeof maxDurationMs === "number" ? { maxDurationMs } : {})
  };
}

function executionApproverFromValue(value: unknown): ExecutionAuthorityApprover | null {
  if (value === undefined) {
    return null;
  }

  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const actorId = requiredString(record.actorId);
  const actorType = record.actorType === "user" || record.actorType === "local_operator" ? record.actorType : null;
  const approvedAt = record.approvedAt === undefined ? undefined : requiredString(record.approvedAt);
  const decidedAt = record.decidedAt === undefined ? undefined : requiredString(record.decidedAt);

  if (
    !actorId ||
    !actorType ||
    approvedAt === null ||
    decidedAt === null
  ) {
    return null;
  }

  return {
    actorId,
    actorType,
    ...(approvedAt ? { approvedAt } : {}),
    ...(decidedAt ? { decidedAt } : {})
  };
}

function executionSandboxBoundaryFromValue(value: unknown): ExecutionSandboxBoundary | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  if (
    !(
      typeof record.mode === "string" &&
      EXECUTION_SANDBOX_MODES.includes(record.mode as ExecutionSandboxBoundary["mode"])
    ) ||
    !(
      typeof record.networkPolicy === "string" &&
      EXECUTION_NETWORK_POLICIES.includes(record.networkPolicy as ExecutionSandboxBoundary["networkPolicy"])
    ) ||
    !(
      typeof record.secretPolicy === "string" &&
      EXECUTION_SECRET_POLICIES.includes(record.secretPolicy as ExecutionSandboxBoundary["secretPolicy"])
    )
  ) {
    return null;
  }

  return {
    mode: record.mode as ExecutionSandboxBoundary["mode"],
    networkPolicy: record.networkPolicy as ExecutionSandboxBoundary["networkPolicy"],
    secretPolicy: record.secretPolicy as ExecutionSandboxBoundary["secretPolicy"]
  };
}

function executionRollbackReferenceFromValue(value: unknown): ExecutionRollbackReference | null {
  if (value === undefined) {
    return null;
  }

  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const rollbackRef = requiredString(record.ref);

  if (
    !rollbackRef ||
    !(
      typeof record.kind === "string" &&
      EXECUTION_ROLLBACK_KINDS.includes(record.kind as ExecutionRollbackReference["kind"])
    )
  ) {
    return null;
  }

  return {
    kind: record.kind as ExecutionRollbackReference["kind"],
    ref: rollbackRef
  };
}

function executionAuthorityPreconditionChecksFromValue(value: unknown): ExecutionAuthorityPreconditionChecks | null {
  if (value === undefined) {
    return {};
  }

  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const booleanKeys = [
    "planningSourceExists",
    "previewArtifactExists",
    "previewHashMatches",
    "rollbackAvailable",
    "credentialValueRequired",
    "sandboxEnforced"
  ] as const;

  if (
    Object.keys(record).some((key) => !booleanKeys.includes(key as (typeof booleanKeys)[number])) ||
    booleanKeys.some((key) => record[key] !== undefined && typeof record[key] !== "boolean")
  ) {
    return null;
  }

  return {
    ...(typeof record.planningSourceExists === "boolean" ? { planningSourceExists: record.planningSourceExists } : {}),
    ...(typeof record.previewArtifactExists === "boolean" ? { previewArtifactExists: record.previewArtifactExists } : {}),
    ...(typeof record.previewHashMatches === "boolean" ? { previewHashMatches: record.previewHashMatches } : {}),
    ...(typeof record.rollbackAvailable === "boolean" ? { rollbackAvailable: record.rollbackAvailable } : {}),
    ...(typeof record.credentialValueRequired === "boolean"
      ? { credentialValueRequired: record.credentialValueRequired }
      : {}),
    ...(typeof record.sandboxEnforced === "boolean" ? { sandboxEnforced: record.sandboxEnforced } : {})
  };
}

function executionAuthorityBlockReason(
  code: ExecutionAuthorityBlockCode,
  message: string
): ExecutionAuthorityBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs: [`block:${code}`]
  };
}

function approvalBlockCode(decision: ExecutionApprovalDecision): ExecutionAuthorityBlockCode | null {
  switch (decision) {
    case "approved":
      return null;
    case "rejected":
      return "rejected_approval";
    case "revoked":
      return "revoked_approval";
    case "expired":
      return "expired_approval";
    case "pending":
      return "missing_approval";
  }
}

function executionAuthorityBlockReasons(input: {
  readonly sourcePlanningHandoffRef: string | null;
  readonly previewArtifactRef: string | null;
  readonly previewArtifactHash: string | null;
  readonly reviewedPreviewArtifactHash: string | null;
  readonly approvalDecision: ExecutionApprovalDecision;
  readonly approver: ReturnType<typeof executionApproverFromValue>;
  readonly actionClass: ExecutionAuthorityActionClass;
  readonly rollbackReference: ExecutionRollbackReference | null;
  readonly checks: ExecutionAuthorityPreconditionChecks;
}): readonly ExecutionAuthorityBlockReasonDto[] {
  const reasons: ExecutionAuthorityBlockReasonDto[] = [];
  const previewHashesMatch =
    Boolean(input.previewArtifactHash && input.reviewedPreviewArtifactHash) &&
    input.previewArtifactHash === input.reviewedPreviewArtifactHash;

  if (!input.sourcePlanningHandoffRef || input.checks.planningSourceExists === false) {
    reasons.push(
      executionAuthorityBlockReason(
        "missing_source",
        "Planning Handoff source is missing, so no adapter execution can start."
      )
    );
  }

  if (!input.previewArtifactRef || input.checks.previewArtifactExists === false) {
    reasons.push(
      executionAuthorityBlockReason(
        "missing_preview",
        "Preview artifact is missing, so no user-reviewed action can be approved."
      )
    );
  }

  if (
    input.previewArtifactRef &&
    (!previewHashesMatch || input.checks.previewHashMatches === false)
  ) {
    reasons.push(
      executionAuthorityBlockReason(
        "preview_hash_mismatch",
        "Preview hash does not match the user-reviewed artifact hash."
      )
    );
  }

  const approvalCode = approvalBlockCode(input.approvalDecision);

  if (approvalCode) {
    reasons.push(
      executionAuthorityBlockReason(
        approvalCode,
        "Approval decision is not an active approved state for execution start."
      )
    );
  } else if (!input.approver) {
    reasons.push(
      executionAuthorityBlockReason(
        "missing_approval",
        "Approved authority requires an approver record before execution start."
      )
    );
  }

  if (
    input.actionClass !== "external_mutation_preview_only" &&
    (!input.rollbackReference || input.checks.rollbackAvailable === false)
  ) {
    reasons.push(
      executionAuthorityBlockReason(
        "missing_rollback",
        "Rollback reference is mandatory before controlled execution can start."
      )
    );
  }

  if (input.checks.credentialValueRequired === true) {
    reasons.push(
      executionAuthorityBlockReason(
        "credential_value_required",
        "Execution would require a credential value, which is blocked by Phase 3 policy."
      )
    );
  }

  if (input.checks.sandboxEnforced !== true) {
    reasons.push(
      executionAuthorityBlockReason(
        "sandbox_failure",
        "Sandbox boundary is not confirmed as enforced, so the action must fail closed."
      )
    );
  }

  return reasons;
}

function executionAuthorityProjection(
  command: ProductEngineCommand,
  record: ExecutionAuthorityRecord,
  boundedOutput: BoundedAgentOutputRecord
): ExecutionAuthorityLedgerProjection {
  const currentStatus = executionAuthorityLedgerStatusForRecord(record);
  const summary = executionAuthorityLedgerSummaryForStatus(currentStatus);

  return validateExecutionAuthorityLedgerProjection({
    kind: "ExecutionAuthorityLedgerProjection",
    sessionId: command.sessionId,
    version: (Number(command.expectedStateVersion) + 1) as ProjectionVersion,
    currentStatus,
    records: [record],
    boundedOutputs: [boundedOutput],
    latestRecord: record,
    blockedPreconditions: record.blockReasons,
    summary,
    refetchUrl: `/api/v1/sessions/${command.sessionId}/execution-authority`
  });
}

function reduceCreateExecutionAuthority(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedExecutionAuthorityPayload(command)) {
    return reject(
      "CreateExecutionAuthority payload contains unsupported keys.",
      "VALIDATION_FAILED"
    );
  }

  const payload = command.payload as Partial<CreateExecutionAuthorityPayload>;
  const boundedOutput = boundedAgentOutputFromValue(payload.boundedAgentOutput);
  const requestedScope = executionAuthorityRequestedScopeFromValue(payload.requestedScope);
  const approver = executionApproverFromValue(payload.approver);
  const sandboxBoundary = executionSandboxBoundaryFromValue(payload.sandboxBoundary);
  const rollbackReference = executionRollbackReferenceFromValue(payload.rollbackReference);
  const checks = executionAuthorityPreconditionChecksFromValue(payload.preconditionChecks);
  const sourcePlanningHandoffRef = requiredString(payload.sourcePlanningHandoffRef);
  const previewArtifactRef = requiredString(payload.previewArtifactRef);
  const previewArtifactHash = requiredString(payload.previewArtifactHash);
  const reviewedPreviewArtifactHash = requiredString(payload.reviewedPreviewArtifactHash);
  const evidenceRefs = optionalStringArray(payload.evidenceRefs);
  const auditRefs = optionalStringArray(payload.auditRefs);

  if (
    !boundedOutput ||
    !requestedScope ||
    !isExecutionAuthorityActionClass(payload.actionClass) ||
    !isExecutionApprovalDecision(payload.approvalDecision) ||
    !sandboxBoundary ||
    !checks ||
    evidenceRefs === null ||
    auditRefs === null
  ) {
    return reject("CreateExecutionAuthority payload is invalid.", "VALIDATION_FAILED");
  }

  if (containsExecutionAuthoritySecretValueLeak(command.payload)) {
    return reject(
      "CreateExecutionAuthority payload must not contain credential or secret values.",
      "VALIDATION_FAILED"
    );
  }

  const blockReasons = executionAuthorityBlockReasons({
    sourcePlanningHandoffRef,
    previewArtifactRef,
    previewArtifactHash,
    reviewedPreviewArtifactHash,
    approvalDecision: payload.approvalDecision,
    approver,
    actionClass: payload.actionClass,
    rollbackReference,
    checks
  });
  const recordId = `exec_auth_${stableToken(
    JSON.stringify({
      sessionId: command.sessionId,
      expectedStateVersion: command.expectedStateVersion,
      sourcePlanningHandoffRef,
      outputId: boundedOutput.outputId,
      actionClass: payload.actionClass,
      previewArtifactRef,
      approvalDecision: payload.approvalDecision
    })
  )}`;
  const blockEvidenceRefs = blockReasons.flatMap((reason) => reason.evidenceRefs);
  const record: ExecutionAuthorityRecord = {
    recordId,
    sourcePlanningHandoffRef: sourcePlanningHandoffRef ?? "missing_planning_handoff_source",
    boundedAgentOutputId: boundedOutput.outputId,
    actionClass: payload.actionClass,
    previewArtifactRef,
    previewArtifactHash,
    reviewedPreviewArtifactHash,
    requestedScope,
    approvalDecision: payload.approvalDecision,
    approver,
    sandboxBoundary,
    rollbackReference,
    executionResult: blockReasons.length ? "blocked" : "not_run",
    blockReasons,
    evidenceRefs: uniqueStringRefs([...evidenceRefs, ...boundedOutput.evidenceRefs, ...blockEvidenceRefs]),
    auditRefs: uniqueStringRefs([
      ...auditRefs,
      `audit:${command.commandId}`,
      `event:ExecutionAuthority${blockReasons.length ? "Blocked" : "Recorded"}`
    ]),
    createdAt: command.issuedAt,
    schemaVersion: EXECUTION_AUTHORITY_SCHEMA_VERSION
  };
  let projection: ExecutionAuthorityLedgerProjection;

  try {
    projection = executionAuthorityProjection(command, record, boundedOutput);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const eventType = blockReasons.length ? "ExecutionAuthorityBlocked" : "ExecutionAuthorityRecorded";
  const event = eventDraft(command, eventType, {
    recordId,
    actionClass: record.actionClass,
    approvalDecision: record.approvalDecision,
    executionResult: record.executionResult,
    blockReasons,
    projection,
    boundedOutput,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      executionAuthorityLedger: projection
    },
    [
      {
        outputType: "execution_authority_record",
        outputRef: recordId,
        payload: {
          recordId,
          actionClass: record.actionClass,
          approvalDecision: record.approvalDecision,
          executionResult: record.executionResult,
          blockReasons
        }
      }
    ],
    [],
    projection
  );
}

const SERVICE_PAGE_USE_PERMISSION_ALLOWED_PAYLOAD_KEYS = [
  "serviceName",
  "serviceOrigin",
  "pageUrl",
  "purpose",
  "allowedActionClasses",
  "blockedActionClasses",
  "dataCategories",
  "approvalGranularity",
  "approvalDecision",
  "userApprovalRef",
  "promptPreviewRef",
  "redactionPreviewRef",
  "userExportDeleteControls",
  "finalSubmitRequested",
  "finalSubmitConfirmationRef",
  "finalSubmitExecutionAuthorityRef",
  "screenshotRefs",
  "logRefs",
  "evidenceRefs",
  "auditRefs",
  "activityFeedRefs"
] as const;

const SERVICE_PAGE_USE_PERMISSION_REVOKE_ALLOWED_PAYLOAD_KEYS = [
  "permissionId",
  "reason",
  "auditRefs"
] as const;

const SERVICE_PAGE_USE_PERMISSION_ARTIFACT_DELETE_ALLOWED_PAYLOAD_KEYS = [
  "permissionId",
  "reason",
  "auditRefs"
] as const;

function containsUnsupportedServicePageUsePermissionPayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, SERVICE_PAGE_USE_PERMISSION_ALLOWED_PAYLOAD_KEYS);
}

function containsUnsupportedServicePageUsePermissionRevokePayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, SERVICE_PAGE_USE_PERMISSION_REVOKE_ALLOWED_PAYLOAD_KEYS);
}

function containsUnsupportedServicePageUsePermissionArtifactDeletePayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, SERVICE_PAGE_USE_PERMISSION_ARTIFACT_DELETE_ALLOWED_PAYLOAD_KEYS);
}

function stringValuesFromPayloadFields(
  payload: Readonly<Partial<Record<string, unknown>>>,
  fields: readonly string[]
) {
  return fields.flatMap((field) => {
    const value = payload[field];

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }

    return typeof value === "string" ? [value] : [];
  });
}

const SERVICE_PAGE_USE_PERMISSION_CREATE_PRIVATE_REF_FIELDS = [
  "userApprovalRef",
  "promptPreviewRef",
  "redactionPreviewRef",
  "finalSubmitConfirmationRef",
  "finalSubmitExecutionAuthorityRef",
  "screenshotRefs",
  "logRefs",
  "evidenceRefs",
  "auditRefs",
  "activityFeedRefs"
] as const;

const SERVICE_PAGE_USE_PERMISSION_CREATE_URL_CREDENTIAL_FIELDS = [
  "serviceName",
  "serviceOrigin",
  "pageUrl",
  "purpose",
  ...SERVICE_PAGE_USE_PERMISSION_CREATE_PRIVATE_REF_FIELDS
] as const;

const SERVICE_PAGE_USE_PERMISSION_REASON_PRIVATE_REF_FIELDS = [
  "reason",
  "auditRefs"
] as const;

function containsServicePageUsePermissionForbiddenCustodyRef(
  payload: Readonly<Partial<Record<string, unknown>>>,
  fields: readonly string[]
) {
  return stringValuesFromPayloadFields(payload, fields).some(servicePageUsePermissionRefHasForbiddenCustodyContent);
}

function containsServicePageUsePermissionUrlCredentials(
  payload: Readonly<Partial<Record<string, unknown>>>,
  fields: readonly string[]
) {
  return stringValuesFromPayloadFields(payload, fields).some(servicePageUsePermissionStringHasUrlCredentials);
}

function uniqueTypedValues<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
  allowEmpty = false
): readonly TValue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value.map((item) => requiredString(item));

  if ((!allowEmpty && !values.length) || !values.every(Boolean)) {
    return null;
  }

  const uniqueValues = [...new Set(values)] as readonly string[];

  return uniqueValues.every((item): item is TValue => allowedValues.includes(item as TValue))
    ? uniqueValues
    : null;
}

function servicePageBlockReason(
  code: ServicePageUsePermissionBlockCode,
  message: string,
  evidenceRefs: readonly string[]
): ServicePageUsePermissionBlockReasonDto {
  return {
    code,
    message,
    evidenceRefs: uniqueStringRefs(evidenceRefs.length ? evidenceRefs : [`service-page:${code}`])
  };
}

function isValidServiceOrigin(origin: string) {
  return /^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/iu.test(origin);
}

function servicePageOriginFromPageUrl(pageUrl: string) {
  const match = pageUrl.match(/^(https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?)(?:[/?#]|$)/iu);

  return match?.[1] ?? null;
}

function servicePageUrlMatchesOrigin(serviceOrigin: string, pageUrl: string) {
  return servicePageOriginFromPageUrl(pageUrl) === serviceOrigin;
}

function servicePageActionRequiresPerActionApproval(action: ServicePageUseActionClass) {
  return action === "fill_draft" || action === "copy_generated_value" || action === "final_submit_request";
}

function servicePageUsePermissionBlockReasons(input: {
  readonly serviceOrigin: string;
  readonly pageUrl: string;
  readonly purpose: string;
  readonly allowedActionClasses: readonly ServicePageUseActionClass[];
  readonly blockedActionClasses: readonly ServicePageBlockedActionClass[];
  readonly approvalGranularity: ServicePageApprovalGranularity;
  readonly approvalDecision: ServicePageUsePermissionApprovalDecision;
  readonly userApprovalRef: string;
  readonly redactionPreviewRef: string;
  readonly userExportDeleteControls: true;
  readonly finalSubmitRequested: boolean;
  readonly finalSubmitConfirmationRef: string | null;
  readonly finalSubmitExecutionAuthorityRef: string | null;
  readonly evidenceRefs: readonly string[];
}): readonly ServicePageUsePermissionBlockReasonDto[] {
  const reasons: ServicePageUsePermissionBlockReasonDto[] = [];

  if (!isValidServiceOrigin(input.serviceOrigin)) {
    reasons.push(servicePageBlockReason(
      "invalid_service_origin",
      "Service page-use permission requires an explicit https service origin.",
      [...input.evidenceRefs, `origin:${input.serviceOrigin}`]
    ));
  }

  if (!servicePageUrlMatchesOrigin(input.serviceOrigin, input.pageUrl)) {
    reasons.push(servicePageBlockReason(
      "invalid_page_url",
      "Service page-use permission pageUrl must be an HTTPS URL on the approved service origin and must not include credentials.",
      [...input.evidenceRefs, `pageUrl:${input.pageUrl}`]
    ));
  }

  if (input.approvalDecision !== "approved" || !input.userApprovalRef) {
    reasons.push(servicePageBlockReason(
      "missing_user_approval",
      "User approval evidence is required after previewing service origin, purpose, data categories, allowed actions, blocked actions, and redaction controls.",
      input.evidenceRefs
    ));
  }

  if (!input.redactionPreviewRef) {
    reasons.push(servicePageBlockReason(
      "missing_redaction_preview",
      "A redaction preview must be shown before storing prompt/result/screenshot/log evidence refs.",
      input.evidenceRefs
    ));
  }

  if (input.userExportDeleteControls !== true) {
    reasons.push(servicePageBlockReason(
      "missing_export_delete_controls",
      "Artifact export/delete controls must be visible before page-use evidence is retained.",
      input.evidenceRefs
    ));
  }

  if (/unattended|background login|stored login|headless login/iu.test(input.purpose)) {
    reasons.push(servicePageBlockReason(
      "user_login_not_present",
      "External service login must remain user-present; unattended signup/login is blocked.",
      input.evidenceRefs
    ));
  }

  if (
    input.allowedActionClasses.some(servicePageActionRequiresPerActionApproval) &&
    input.approvalGranularity !== "per_action"
  ) {
    if (input.allowedActionClasses.includes("fill_draft")) {
      reasons.push(servicePageBlockReason(
        "fill_draft_requires_per_action",
        "Fill-draft permission is separate from page/setup-step approval and requires per-action approval.",
        input.evidenceRefs
      ));
    }

    if (input.allowedActionClasses.includes("copy_generated_value")) {
      reasons.push(servicePageBlockReason(
        "copy_generated_value_requires_per_action",
        "Copy-generated-value permission is separate from page/setup-step approval and requires per-action approval.",
        input.evidenceRefs
      ));
    }
  }

  const sensitiveBlockedClassesMissing = SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES.some(
    (actionClass) => !input.blockedActionClasses.includes(actionClass)
  );

  if (sensitiveBlockedClassesMissing) {
    reasons.push(servicePageBlockReason(
      "sensitive_or_production_action",
      "Payment/legal/medical/financial/privacy submit, production deploy, DNS cutover, and account deletion must stay blocked until a later explicit contract exists.",
      input.evidenceRefs
    ));
  }

  if (
    input.finalSubmitRequested ||
    input.allowedActionClasses.includes("final_submit_request")
  ) {
    reasons.push(servicePageBlockReason(
      "final_submit_requires_confirmation_and_authority",
      "Final submit remains blocked until production-mutation contract evidence passes confirmation-card, ExecutionAuthorityRecord, redaction, approval, rollback, audit, and no-secret checks.",
      input.evidenceRefs
    ));
  }

  return reasons;
}

function servicePagePermissionStatus(input: {
  readonly blockReasons: readonly ServicePageUsePermissionBlockReasonDto[];
  readonly finalSubmitRequested: boolean;
}): ServicePageUsePermissionStatus {
  if (input.blockReasons.length) {
    return "blocked";
  }

  return input.finalSubmitRequested ? "final_submit_requested" : "granted";
}

function servicePagePermissionEventType(status: ServicePageUsePermissionStatus) {
  switch (status) {
    case "blocked":
      return "ServicePageActionBlocked" as const;
    case "final_submit_requested":
      return "ServicePageFinalSubmitRequested" as const;
    case "revoked":
      return "ServicePagePermissionRevoked" as const;
    case "granted":
      return "ServicePagePermissionGranted" as const;
  }
}

function servicePageVisibleState(input: {
  readonly status: ServicePageUsePermissionStatus;
  readonly serviceName: string;
  readonly blockReasons: readonly ServicePageUsePermissionBlockReasonDto[];
}) {
  const defaultExplanation = input.blockReasons.map((reason) => reason.message).join(" ") ||
    servicePageUsePermissionSummaryForStatus(input.status);

  function defaultNextAction() {
    switch (input.status) {
      case "granted":
        return servicePageGrantedNextAction(input.serviceName);
      case "blocked":
        return SERVICE_PAGE_BLOCKED_NEXT_ACTION;
      case "final_submit_requested":
        return [
          SERVICE_PAGE_FINAL_SUBMIT_BLOCKED_CONTRACT_LABEL,
          "Keep the final confirmation card and linked ExecutionAuthorityRecord as evidence only until that contract exists."
        ].join(" ");
      case "revoked":
        return "Create a new service page-use permission before any further page action.";
    }
  }

  return {
    userVisibleExplanation: defaultExplanation,
    nextAction: defaultNextAction()
  };
}

function defaultServicePageAuditLog(input: {
  readonly status: ServicePageUsePermissionStatus;
  readonly serviceName: string;
  readonly serviceOrigin: string;
  readonly promptPreviewRef: string;
  readonly redactionPreviewRef: string;
  readonly auditRefs: readonly string[];
}): readonly ServicePageUsePermissionAuditEntry[] {
  const entries: ServicePageUsePermissionAuditEntry[] = [
    {
      eventType: "permission_preview",
      label: `${input.serviceName} page-use purpose, origin, data categories, allowed actions, and blocked actions were previewed.`,
      evidenceRefs: [input.promptPreviewRef, `origin:${input.serviceOrigin}`]
    },
    {
      eventType: "user_present_login_required",
      label: "Login and credential entry stay user-owned and visible; no credential/session custody is delegated.",
      evidenceRefs: input.auditRefs
    },
    {
      eventType: "redaction_preview",
      label: "Redaction preview and export/delete controls were shown before retaining evidence refs.",
      evidenceRefs: [input.redactionPreviewRef]
    }
  ];

  entries.push({
    eventType: servicePagePermissionEventType(input.status),
    label: servicePageUsePermissionSummaryForStatus(input.status),
    evidenceRefs: input.auditRefs
  });

  return entries;
}

interface ParsedServicePageUsePermissionPayload {
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
  readonly finalSubmitRequested: boolean;
  readonly finalSubmitConfirmationRef: string | null;
  readonly finalSubmitExecutionAuthorityRef: string | null;
  readonly screenshotRefs: readonly string[];
  readonly logRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly auditRefs: readonly string[];
  readonly activityFeedRefs: readonly string[];
}

function parseServicePageUsePermissionPayload(
  command: ProductEngineCommand
): ParsedServicePageUsePermissionPayload | null {
  const payload = command.payload as Partial<CreateServicePageUsePermissionPayload>;
  const serviceName = requiredString(payload.serviceName);
  const serviceOrigin = requiredString(payload.serviceOrigin);
  const pageUrl = requiredString(payload.pageUrl);
  const purpose = requiredString(payload.purpose);
  const allowedActionClasses = uniqueTypedValues(
    payload.allowedActionClasses,
    SERVICE_PAGE_USE_PERMISSION_ACTION_CLASSES
  );
  const blockedActionClasses = uniqueTypedValues(
    payload.blockedActionClasses,
    SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES
  );
  const dataCategories = uniqueTypedValues(
    payload.dataCategories,
    SERVICE_PAGE_USE_PERMISSION_DATA_CATEGORIES
  );
  const approvalGranularity = requiredString(payload.approvalGranularity);
  const approvalDecision = requiredString(payload.approvalDecision);
  const userApprovalRef = requiredString(payload.userApprovalRef);
  const promptPreviewRef = requiredString(payload.promptPreviewRef);
  const redactionPreviewRef = requiredString(payload.redactionPreviewRef);
  const finalSubmitConfirmationRef = requiredString(payload.finalSubmitConfirmationRef);
  const finalSubmitExecutionAuthorityRef = requiredString(payload.finalSubmitExecutionAuthorityRef);
  const screenshotRefs = optionalStringArray(payload.screenshotRefs);
  const logRefs = optionalStringArray(payload.logRefs);
  const evidenceRefs = optionalStringArray(payload.evidenceRefs);
  const auditRefs = optionalStringArray(payload.auditRefs);
  const activityFeedRefs = optionalStringArray(payload.activityFeedRefs);

  if (
    !serviceName ||
    !serviceOrigin ||
    !pageUrl ||
    !purpose ||
    !allowedActionClasses ||
    !blockedActionClasses ||
    !dataCategories ||
    !approvalGranularity ||
    !SERVICE_PAGE_USE_PERMISSION_APPROVAL_GRANULARITIES.includes(approvalGranularity as ServicePageApprovalGranularity) ||
    approvalDecision !== "approved" ||
    !userApprovalRef ||
    !promptPreviewRef ||
    !redactionPreviewRef ||
    payload.userExportDeleteControls !== true ||
    screenshotRefs === null ||
    logRefs === null ||
    evidenceRefs === null ||
    auditRefs === null ||
    activityFeedRefs === null
  ) {
    return null;
  }

  return {
    serviceName,
    serviceOrigin,
    pageUrl,
    purpose,
    allowedActionClasses,
    blockedActionClasses,
    dataCategories,
    approvalGranularity: approvalGranularity as ServicePageApprovalGranularity,
    approvalDecision: approvalDecision as ServicePageUsePermissionApprovalDecision,
    userApprovalRef,
    promptPreviewRef,
    redactionPreviewRef,
    userExportDeleteControls: true,
    finalSubmitRequested: payload.finalSubmitRequested === true,
    finalSubmitConfirmationRef,
    finalSubmitExecutionAuthorityRef,
    screenshotRefs,
    logRefs,
    evidenceRefs,
    auditRefs,
    activityFeedRefs
  };
}

function servicePageUsePermissionProjectionFromRecords(
  command: ProductEngineCommand,
  version: ProjectionVersion,
  permissions: readonly ServicePageUsePermissionRecord[]
): ServicePageUsePermissionProjection {
  const latestPermission = permissions.at(-1);

  if (!latestPermission) {
    throw new Error("ServicePageUsePermissionProjection requires at least one permission record.");
  }

  const currentStatus = latestPermission.status;

  return validateServicePageUsePermissionProjection({
    kind: "ServicePageUsePermissionProjection",
    sessionId: command.sessionId,
    version,
    currentStatus,
    permissions,
    latestPermission,
    blockedPreconditions: currentStatus === "blocked" || currentStatus === "revoked"
      ? latestPermission.blockReasons
      : [],
    summary: servicePageUsePermissionSummaryForStatus(currentStatus),
    refetchUrl: `/api/v1/sessions/${command.sessionId}/service-page-use-permissions`
  });
}

function servicePageUsePermissionProjection(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  permission: ServicePageUsePermissionRecord
): ServicePageUsePermissionProjection {
  return servicePageUsePermissionProjectionFromRecords(command, projectionVersionFor(state), [
    ...(state.servicePageUsePermission?.permissions ?? []),
    permission
  ]);
}

function reduceCreateServicePageUsePermission(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedServicePageUsePermissionPayload(command)) {
    return reject(
      "CreateServicePageUsePermission payload contains unsupported keys.",
      "VALIDATION_FAILED"
    );
  }

  if (
    containsExecutionAuthoritySecretValueLeak(command.payload) ||
    containsServicePageUsePermissionUrlCredentials(
      command.payload,
      SERVICE_PAGE_USE_PERMISSION_CREATE_URL_CREDENTIAL_FIELDS
    ) ||
    containsServicePageUsePermissionForbiddenCustodyRef(
      command.payload,
      SERVICE_PAGE_USE_PERMISSION_CREATE_PRIVATE_REF_FIELDS
    )
  ) {
    return reject(
      "CreateServicePageUsePermission payload must not contain credential, session, token, or secret values.",
      "VALIDATION_FAILED"
    );
  }

  const payload = parseServicePageUsePermissionPayload(command);

  if (!payload) {
    return reject("CreateServicePageUsePermission payload is invalid.", "VALIDATION_FAILED");
  }

  const evidenceRefs = uniqueStringRefs([
    ...payload.evidenceRefs,
    payload.promptPreviewRef,
    payload.redactionPreviewRef,
    ...payload.screenshotRefs,
    ...payload.logRefs
  ]);
  const blockReasons = servicePageUsePermissionBlockReasons({
    serviceOrigin: payload.serviceOrigin,
    pageUrl: payload.pageUrl,
    purpose: payload.purpose,
    allowedActionClasses: payload.allowedActionClasses,
    blockedActionClasses: payload.blockedActionClasses,
    approvalGranularity: payload.approvalGranularity,
    approvalDecision: payload.approvalDecision,
    userApprovalRef: payload.userApprovalRef,
    redactionPreviewRef: payload.redactionPreviewRef,
    userExportDeleteControls: payload.userExportDeleteControls,
    finalSubmitRequested: payload.finalSubmitRequested,
    finalSubmitConfirmationRef: payload.finalSubmitConfirmationRef,
    finalSubmitExecutionAuthorityRef: payload.finalSubmitExecutionAuthorityRef,
    evidenceRefs
  });
  const status = servicePagePermissionStatus({
    blockReasons,
    finalSubmitRequested: payload.finalSubmitRequested
  });
  const eventType = servicePagePermissionEventType(status);
  const visibleState = servicePageVisibleState({
    status,
    serviceName: payload.serviceName,
    blockReasons
  });
  const auditRefs = uniqueStringRefs([
    ...payload.auditRefs,
    `audit:${command.commandId}`,
    `event:${eventType}`
  ]);
  const permissionId = `service_page_permission_${stableToken(
    JSON.stringify({
      sessionId: command.sessionId,
      expectedStateVersion: command.expectedStateVersion,
      serviceName: payload.serviceName,
      serviceOrigin: payload.serviceOrigin,
      pageUrl: payload.pageUrl,
      purpose: payload.purpose,
      allowedActionClasses: payload.allowedActionClasses,
      userApprovalRef: payload.userApprovalRef,
      finalSubmitRequested: payload.finalSubmitRequested
    })
  )}`;
  const finalSubmitBoundary: ServicePageFinalSubmitBoundary = {
    requested: payload.finalSubmitRequested,
    confirmationCardRef: payload.finalSubmitConfirmationRef,
    executionAuthorityRef: payload.finalSubmitExecutionAuthorityRef,
    productionMutationPerformed: false
  };
  const permission: ServicePageUsePermissionRecord = {
    permissionId,
    serviceName: payload.serviceName,
    serviceOrigin: payload.serviceOrigin,
    pageUrl: payload.pageUrl,
    purpose: payload.purpose,
    allowedActionClasses: payload.allowedActionClasses,
    blockedActionClasses: payload.blockedActionClasses,
    dataCategories: payload.dataCategories,
    approvalGranularity: payload.approvalGranularity,
    approvalDecision: payload.approvalDecision,
    userApprovalRef: payload.userApprovalRef,
    status,
    userVisibleExplanation: visibleState.userVisibleExplanation,
    nextAction: visibleState.nextAction,
    userPresentLoginRequired: true,
    credentialEntryDelegated: false,
    fillDraftRequiresPerActionApproval: true,
    finalSubmitRequiresSeparateConfirmation: true,
    finalSubmitBoundary,
    artifactRetention: {
      promptResultScreenshotLogRetention: "default_evidence_refs_only",
      redactionPreviewRef: payload.redactionPreviewRef,
      userExportDeleteControls: true,
      deletionLeavesAuditMetadataOnly: true,
      artifactRefsDeletedAt: null,
      artifactRefsDeletionAuditRef: null,
      forbiddenRetentionPolicy:
        "no_credential_session_secret_2fa_payment_legal_medical_financial_privacy_values"
    },
    promptPreviewRef: payload.promptPreviewRef,
    screenshotRefs: uniqueStringRefs(payload.screenshotRefs),
    logRefs: uniqueStringRefs(payload.logRefs),
    evidenceRefs: uniqueStringRefs([...evidenceRefs, ...blockReasons.flatMap((reason) => reason.evidenceRefs)]),
    auditRefs,
    activityFeedRefs: uniqueStringRefs([
      `service:${payload.serviceName.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
      ...payload.activityFeedRefs
    ]),
    blockReasons,
    auditLog: defaultServicePageAuditLog({
      status,
      serviceName: payload.serviceName,
      serviceOrigin: payload.serviceOrigin,
      promptPreviewRef: payload.promptPreviewRef,
      redactionPreviewRef: payload.redactionPreviewRef,
      auditRefs
    }),
    canRevoke: servicePageUsePermissionIsRevokableStatus(status),
    createdAt: command.issuedAt,
    revokedAt: null,
    schemaVersion: SERVICE_PAGE_USE_PERMISSION_SCHEMA_VERSION
  };
  let projection: ServicePageUsePermissionProjection;

  try {
    projection = servicePageUsePermissionProjection(command, state, permission);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const event = eventDraft(command, eventType, {
    permissionId,
    serviceName: permission.serviceName,
    serviceOrigin: permission.serviceOrigin,
    pageUrl: permission.pageUrl,
    userApprovalRef: permission.userApprovalRef,
    allowedActionClasses: permission.allowedActionClasses,
    approvalGranularity: permission.approvalGranularity,
    status,
    blockReasons,
    finalSubmitBoundary,
    projection,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      servicePageUsePermission: projection
    },
    [
      {
        outputType: "service_page_use_permission",
        outputRef: permissionId,
        payload: {
          permissionId,
          serviceName: permission.serviceName,
          serviceOrigin: permission.serviceOrigin,
          status,
          allowedActionClasses: permission.allowedActionClasses,
          blockReasons
        }
      }
    ],
    [],
    projection
  );
}

function reduceRevokeServicePageUsePermission(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedServicePageUsePermissionRevokePayload(command)) {
    return reject(
      "RevokeServicePageUsePermission payload contains unsupported keys.",
      "VALIDATION_FAILED"
    );
  }

  const payload = command.payload as Partial<RevokeServicePageUsePermissionPayload>;
  const permissionId = requiredString(payload.permissionId);
  const reason = requiredString(payload.reason);
  const auditRefs = optionalStringArray(payload.auditRefs);
  const projectionBefore = state.servicePageUsePermission;

  if (!permissionId || !reason || auditRefs === null) {
    return reject("RevokeServicePageUsePermission payload is invalid.", "VALIDATION_FAILED");
  }

  if (
    containsExecutionAuthoritySecretValueLeak(command.payload) ||
    containsServicePageUsePermissionUrlCredentials(
      command.payload,
      SERVICE_PAGE_USE_PERMISSION_REASON_PRIVATE_REF_FIELDS
    ) ||
    containsServicePageUsePermissionForbiddenCustodyRef(
      command.payload,
      SERVICE_PAGE_USE_PERMISSION_REASON_PRIVATE_REF_FIELDS
    )
  ) {
    return reject(
      "RevokeServicePageUsePermission payload must not contain credential, session, token, or secret values.",
      "VALIDATION_FAILED"
    );
  }

  if (!projectionBefore) {
    return reject("RevokeServicePageUsePermission requires an existing service page-use projection.", "RESOURCE_NOT_FOUND");
  }

  const target = projectionBefore.latestPermission.permissionId === permissionId
    ? projectionBefore.latestPermission
    : null;

  if (!target) {
    return reject("RevokeServicePageUsePermission can only revoke the latest service page-use permission.", "RESOURCE_NOT_FOUND");
  }

  if (!servicePageUsePermissionIsRevokableStatus(target.status)) {
    return reject("RevokeServicePageUsePermission can only revoke granted or final-submit-requested permissions.", "COMMAND_PRECONDITION_FAILED");
  }

  const revokeAuditRefs = uniqueStringRefs([
    ...auditRefs,
    `audit:${command.commandId}`,
    "audit:service-page-use-permission:revoked"
  ]);
  const revokedReason = servicePageBlockReason(
    "revoked_by_user",
    "The user revoked this external service page-use permission before further page actions could continue.",
    revokeAuditRefs
  );
  const revokedPermission: ServicePageUsePermissionRecord = {
    ...target,
    status: "revoked",
    userVisibleExplanation: reason,
    nextAction: "Create a new purpose-limited service page-use permission before any further page action.",
    blockReasons: [...target.blockReasons, revokedReason],
    auditRefs: uniqueStringRefs([...target.auditRefs, ...revokeAuditRefs]),
    activityFeedRefs: uniqueStringRefs([...target.activityFeedRefs, "service-page-permission:revoked"]),
    auditLog: [
      ...target.auditLog,
      {
        eventType: "ServicePagePermissionRevoked",
        label: reason,
        evidenceRefs: revokeAuditRefs
      }
    ],
    canRevoke: false,
    revokedAt: command.issuedAt
  };
  let projection: ServicePageUsePermissionProjection;

  try {
    projection = servicePageUsePermissionProjectionFromRecords(command, projectionVersionFor(state), [
      ...projectionBefore.permissions.slice(0, -1),
      revokedPermission
    ]);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const event = eventDraft(command, "ServicePagePermissionRevoked", {
    permissionId,
    serviceName: revokedPermission.serviceName,
    serviceOrigin: revokedPermission.serviceOrigin,
    reason,
    projection,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      servicePageUsePermission: projection
    },
    [
      {
        outputType: "service_page_use_permission",
        outputRef: permissionId,
        payload: {
          permissionId,
          status: "revoked",
          blockReasons: revokedPermission.blockReasons
        }
      }
    ],
    [],
    projection
  );
}

function servicePageArtifactRefsForPermission(permission: ServicePageUsePermissionRecord) {
  return new Set([
    permission.promptPreviewRef,
    permission.artifactRetention.redactionPreviewRef,
    ...permission.screenshotRefs,
    ...permission.logRefs,
    ...permission.screenshotRefs.map((ref) => `screenshot:${ref}`),
    ...permission.logRefs.map((ref) => `log:${ref}`)
  ].filter((ref): ref is string => typeof ref === "string" && ref.length > 0));
}

function servicePageRefsWithoutArtifactRefs(
  refs: readonly string[],
  artifactRefs: ReadonlySet<string>
) {
  return uniqueStringRefs(refs.filter((ref) => !artifactRefs.has(ref)));
}

function servicePageEvidenceRefsWithoutArtifactRefs(
  refs: readonly string[],
  artifactRefs: ReadonlySet<string>,
  fallbackRefs: readonly string[]
) {
  const retainedRefs = servicePageRefsWithoutArtifactRefs(refs, artifactRefs);

  return retainedRefs.length ? retainedRefs : fallbackRefs;
}

function servicePageBlockReasonsWithoutArtifactRefs(
  reasons: readonly ServicePageUsePermissionBlockReasonDto[],
  artifactRefs: ReadonlySet<string>,
  fallbackRefs: readonly string[]
) {
  return reasons.map((reason) => ({
    ...reason,
    evidenceRefs: servicePageEvidenceRefsWithoutArtifactRefs(reason.evidenceRefs, artifactRefs, fallbackRefs)
  }));
}

function servicePageAuditLogWithoutArtifactRefs(
  auditLog: readonly ServicePageUsePermissionAuditEntry[],
  artifactRefs: ReadonlySet<string>,
  fallbackRefs: readonly string[]
) {
  return auditLog.map((entry) => ({
    ...entry,
    evidenceRefs: servicePageEvidenceRefsWithoutArtifactRefs(entry.evidenceRefs, artifactRefs, fallbackRefs)
  }));
}

function reduceDeleteServicePageUsePermissionArtifacts(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedServicePageUsePermissionArtifactDeletePayload(command)) {
    return reject(
      "DeleteServicePageUsePermissionArtifacts payload contains unsupported keys.",
      "VALIDATION_FAILED"
    );
  }

  const payload = command.payload as Partial<DeleteServicePageUsePermissionArtifactsPayload>;
  const permissionId = requiredString(payload.permissionId);
  const reason = requiredString(payload.reason);
  const auditRefs = optionalStringArray(payload.auditRefs);
  const projectionBefore = state.servicePageUsePermission;

  if (!permissionId || !reason || auditRefs === null) {
    return reject("DeleteServicePageUsePermissionArtifacts payload is invalid.", "VALIDATION_FAILED");
  }

  if (
    containsExecutionAuthoritySecretValueLeak(command.payload) ||
    containsServicePageUsePermissionUrlCredentials(
      command.payload,
      SERVICE_PAGE_USE_PERMISSION_REASON_PRIVATE_REF_FIELDS
    ) ||
    containsServicePageUsePermissionForbiddenCustodyRef(
      command.payload,
      SERVICE_PAGE_USE_PERMISSION_REASON_PRIVATE_REF_FIELDS
    )
  ) {
    return reject(
      "DeleteServicePageUsePermissionArtifacts payload must not contain credential, session, token, or secret values.",
      "VALIDATION_FAILED"
    );
  }

  if (!projectionBefore) {
    return reject(
      "DeleteServicePageUsePermissionArtifacts requires an existing service page-use projection.",
      "RESOURCE_NOT_FOUND"
    );
  }

  const targetIndex = projectionBefore.permissions.findIndex((permission) => permission.permissionId === permissionId);
  const target = targetIndex >= 0 ? projectionBefore.permissions[targetIndex] : null;

  if (!target) {
    return reject(
      "DeleteServicePageUsePermissionArtifacts requires an existing service page-use permission.",
      "RESOURCE_NOT_FOUND"
    );
  }

  if (target.artifactRetention.promptResultScreenshotLogRetention === "deleted_audit_metadata_only") {
    return reject(
      "DeleteServicePageUsePermissionArtifacts requires retained artifact refs.",
      "COMMAND_PRECONDITION_FAILED"
    );
  }

  const deletionAuditRef = `audit:service-page-use-permission:artifacts-deleted:${command.commandId}`;
  const deletionAuditRefs = uniqueStringRefs([
    ...auditRefs,
    `audit:${command.commandId}`,
    deletionAuditRef
  ]);
  const artifactRefs = servicePageArtifactRefsForPermission(target);
  const retainedEvidenceRefs = servicePageRefsWithoutArtifactRefs(target.evidenceRefs, artifactRefs);
  const retainedAuditRefs = servicePageRefsWithoutArtifactRefs(target.auditRefs, artifactRefs);
  const retainedActivityFeedRefs = servicePageRefsWithoutArtifactRefs(target.activityFeedRefs, artifactRefs);
  const retainedBlockReasons = servicePageBlockReasonsWithoutArtifactRefs(
    target.blockReasons,
    artifactRefs,
    deletionAuditRefs
  );
  const retainedAuditLog = servicePageAuditLogWithoutArtifactRefs(target.auditLog, artifactRefs, deletionAuditRefs);
  const deletedPermission: ServicePageUsePermissionRecord = {
    ...target,
    artifactRetention: {
      ...target.artifactRetention,
      promptResultScreenshotLogRetention: "deleted_audit_metadata_only",
      redactionPreviewRef: null,
      artifactRefsDeletedAt: command.issuedAt,
      artifactRefsDeletionAuditRef: deletionAuditRef
    },
    promptPreviewRef: null,
    screenshotRefs: [],
    logRefs: [],
    evidenceRefs: uniqueStringRefs([
      ...retainedEvidenceRefs,
      ...deletionAuditRefs,
      "service-page-permission:artifact-refs-deleted"
    ]),
    auditRefs: uniqueStringRefs([...retainedAuditRefs, ...deletionAuditRefs]),
    activityFeedRefs: uniqueStringRefs([...retainedActivityFeedRefs, "service-page-permission:artifacts-deleted"]),
    blockReasons: retainedBlockReasons,
    auditLog: [
      ...retainedAuditLog,
      {
        eventType: "ServicePageArtifactsDeleted",
        label: reason,
        evidenceRefs: deletionAuditRefs
      }
    ]
  };
  let projection: ServicePageUsePermissionProjection;

  try {
    projection = servicePageUsePermissionProjectionFromRecords(command, projectionVersionFor(state), [
      ...projectionBefore.permissions.slice(0, targetIndex),
      deletedPermission,
      ...projectionBefore.permissions.slice(targetIndex + 1)
    ]);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const event = eventDraft(command, "ServicePageArtifactsDeleted", {
    permissionId,
    serviceName: deletedPermission.serviceName,
    serviceOrigin: deletedPermission.serviceOrigin,
    reason,
    deletedArtifactKinds: ["prompt_preview_ref", "redaction_preview_ref", "screenshot_refs", "log_refs"],
    projection,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      servicePageUsePermission: projection
    },
    [
      {
        outputType: "service_page_use_permission",
        outputRef: permissionId,
        payload: {
          permissionId,
          status: deletedPermission.status,
          artifactRetention: deletedPermission.artifactRetention
        }
      }
    ],
    [],
    projection
  );
}

const IMPLEMENTATION_STEP_LEDGER_ALLOWED_PAYLOAD_KEYS = [
  "trackerDoc",
  "stepDoc",
  "targetStatus",
  "startedEvidenceRefs",
  "stepCommitRecord",
  "noCodeStepEvidence",
  "codeReviewRecord",
  "cleanCodeReviewRecord",
  "missingTestAuditRecord",
  "testEvidenceRecord",
  "blocker",
  "evidenceRefs"
] as const;

function containsUnsupportedImplementationStepLedgerPayload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, IMPLEMENTATION_STEP_LEDGER_ALLOWED_PAYLOAD_KEYS);
}

function stringValuesFromUnknown(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(stringValuesFromUnknown);
  }

  const record = recordFromUnknown(value);

  return record ? Object.values(record).flatMap(stringValuesFromUnknown) : [];
}

function containsImplementationStepLedgerForbiddenCustodyValue(payload: ProductEngineCommand["payload"]) {
  return stringValuesFromUnknown(payload).some((value) =>
    servicePageUsePermissionRefHasForbiddenCustodyContent(value) ||
    servicePageUsePermissionStringHasUrlCredentials(value)
  );
}

function stringArrayFromRecord(value: unknown, allowEmpty = false) {
  if (value === undefined && allowEmpty) {
    return [] as readonly string[];
  }

  const values = stringArray(value, allowEmpty);

  return values === null ? null : uniqueStringRefs([...values]);
}

function implementationStepStatusFromValue(value: unknown): ImplementationStepStatus | null {
  const status = requiredString(value);

  return status && IMPLEMENTATION_STEP_STATUSES.includes(status as ImplementationStepStatus)
    ? (status as ImplementationStepStatus)
    : null;
}

function implementationReviewVerdictFromValue(value: unknown) {
  const verdict = requiredString(value);

  return verdict && IMPLEMENTATION_REVIEW_VERDICTS.includes(verdict as CodeReviewRecord["verdict"])
    ? verdict as CodeReviewRecord["verdict"]
    : null;
}

function implementationTestOutcomeFromValue(value: unknown) {
  const outcome = requiredString(value);

  return outcome && IMPLEMENTATION_TEST_OUTCOMES.includes(outcome as TestEvidenceRecord["outcome"])
    ? outcome as TestEvidenceRecord["outcome"]
    : null;
}

function trackerDocFromValue(value: unknown): TrackerDoc | null {
  const record = recordFromUnknown(value);
  const trackerId = requiredString(record?.trackerId);
  const title = requiredString(record?.title);
  const goal = requiredString(record?.goal);
  const sourceRefs = stringArrayFromRecord(record?.sourceRefs);

  return trackerId && title && goal && sourceRefs?.length
    ? { trackerId, title, goal, sourceRefs }
    : null;
}

function sameImplementationStepStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameTrackerDoc(left: TrackerDoc, right: TrackerDoc) {
  return left.trackerId === right.trackerId &&
    left.title === right.title &&
    left.goal === right.goal &&
    sameImplementationStepStringArray(left.sourceRefs, right.sourceRefs);
}

function implementationStepDocFromValue(value: unknown): ImplementationStepDoc | null {
  const record = recordFromUnknown(value);
  const stepId = requiredString(record?.stepId);
  const title = requiredString(record?.title);
  const description = requiredString(record?.description);
  const sourceRefs = stringArrayFromRecord(record?.sourceRefs);
  const expectedChangeScope = requiredString(record?.expectedChangeScope);

  if (
    !stepId ||
    !title ||
    !description ||
    !sourceRefs?.length ||
    (expectedChangeScope !== "tracked_code_docs_config" && expectedChangeScope !== "verification_only" && expectedChangeScope !== "no_op_review")
  ) {
    return null;
  }

  return {
    stepId,
    title,
    description,
    sourceRefs,
    expectedChangeScope
  };
}

function sameImplementationStepDoc(left: ImplementationStepDoc, right: ImplementationStepDoc) {
  return left.stepId === right.stepId &&
    left.title === right.title &&
    left.description === right.description &&
    left.expectedChangeScope === right.expectedChangeScope &&
    sameImplementationStepStringArray(left.sourceRefs, right.sourceRefs);
}

function stepCommitRecordFromValue(value: unknown, stepId: string): StepCommitRecord | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const commitSha = requiredString(record?.commitSha);
  const previousCommitSha = requiredString(record?.previousCommitSha);
  const diffRange = requiredString(record?.diffRange);
  const changedFiles = stringArrayFromRecord(record?.changedFiles);
  const rollbackRef = requiredString(record?.rollbackRef);
  const evidenceRefs = stringArrayFromRecord(record?.evidenceRefs);

  if (!recordStepId || recordStepId !== stepId || !commitSha || !previousCommitSha || !diffRange || !changedFiles?.length || !rollbackRef || !evidenceRefs?.length) {
    return null;
  }

  return {
    stepId,
    commitSha,
    previousCommitSha,
    diffRange,
    changedFiles,
    rollbackRef,
    evidenceRefs
  };
}

function noCodeStepEvidenceFromValue(value: unknown, stepId: string): NoCodeStepEvidence | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const baselineCommitSha = requiredString(record?.baselineCommitSha);
  const cleanTrackedState = typeof record?.cleanTrackedState === "boolean" ? record.cleanTrackedState : null;
  const noCodeReason = requiredString(record?.noCodeReason);
  const commandEvidenceRefs = stringArrayFromRecord(record?.commandEvidenceRefs);
  const notTestedGaps = stringArrayFromRecord(record?.notTestedGaps, true);

  if (
    !recordStepId ||
    recordStepId !== stepId ||
    !baselineCommitSha ||
    cleanTrackedState === null ||
    record?.intendedTrackedDiff !== "none" ||
    !noCodeReason ||
    !commandEvidenceRefs?.length ||
    notTestedGaps === null
  ) {
    return null;
  }

  return {
    stepId,
    baselineCommitSha,
    cleanTrackedState,
    intendedTrackedDiff: "none",
    noCodeReason,
    commandEvidenceRefs,
    notTestedGaps
  };
}

function codeReviewRecordFromValue(value: unknown, stepId: string): CodeReviewRecord | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const reviewId = requiredString(record?.reviewId);
  const reviewer = requiredString(record?.reviewer);
  const reviewScope = requiredString(record?.reviewScope);
  const verdict = implementationReviewVerdictFromValue(record?.verdict);
  const comparedFromCommitSha = requiredString(record?.comparedFromCommitSha);
  const comparedToCommitSha = requiredString(record?.comparedToCommitSha);
  const findings = stringArrayFromRecord(record?.findings, true);
  const evidenceRefs = stringArrayFromRecord(record?.evidenceRefs);

  if (
    !recordStepId ||
    recordStepId !== stepId ||
    !reviewId ||
    !reviewer ||
    !reviewScope ||
    !IMPLEMENTATION_CODE_REVIEW_SCOPES.includes(reviewScope as CodeReviewRecord["reviewScope"]) ||
    !verdict ||
    !comparedFromCommitSha ||
    !comparedToCommitSha ||
    findings === null ||
    !evidenceRefs?.length
  ) {
    return null;
  }

  return {
    stepId,
    reviewId,
    reviewer,
    reviewScope: reviewScope as CodeReviewRecord["reviewScope"],
    verdict,
    comparedFromCommitSha,
    comparedToCommitSha,
    findings,
    evidenceRefs
  };
}

function cleanCodeReviewRecordFromValue(value: unknown, stepId: string): CleanCodeReviewRecord | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const reviewId = requiredString(record?.reviewId);
  const reviewer = requiredString(record?.reviewer);
  const reviewScope = requiredString(record?.reviewScope);
  const verdict = implementationReviewVerdictFromValue(record?.verdict);
  const comparedFromCommitSha = requiredString(record?.comparedFromCommitSha);
  const comparedToCommitSha = requiredString(record?.comparedToCommitSha);
  const simplifications = stringArrayFromRecord(record?.simplifications, true);
  const evidenceRefs = stringArrayFromRecord(record?.evidenceRefs);

  if (
    !recordStepId ||
    recordStepId !== stepId ||
    !reviewId ||
    !reviewer ||
    !reviewScope ||
    !IMPLEMENTATION_CLEAN_CODE_REVIEW_SCOPES.includes(reviewScope as CleanCodeReviewRecord["reviewScope"]) ||
    !verdict ||
    !comparedFromCommitSha ||
    !comparedToCommitSha ||
    simplifications === null ||
    !evidenceRefs?.length
  ) {
    return null;
  }

  return {
    stepId,
    reviewId,
    reviewer,
    reviewScope: reviewScope as CleanCodeReviewRecord["reviewScope"],
    verdict,
    comparedFromCommitSha,
    comparedToCommitSha,
    simplifications,
    evidenceRefs
  };
}

function testEvidenceRecordFromValue(value: unknown, stepId: string): TestEvidenceRecord | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const testEvidenceId = requiredString(record?.testEvidenceId);
  const commands = stringArrayFromRecord(record?.commands);
  const outcome = implementationTestOutcomeFromValue(record?.outcome);
  const verifiedCommitSha = record?.verifiedCommitSha === undefined ? undefined : requiredString(record.verifiedCommitSha);
  const passedTestCount =
    typeof record?.passedTestCount === "number" && Number.isInteger(record.passedTestCount) && record.passedTestCount >= 0
      ? record.passedTestCount
      : null;
  const failedTestCount =
    typeof record?.failedTestCount === "number" && Number.isInteger(record.failedTestCount) && record.failedTestCount >= 0
      ? record.failedTestCount
      : null;
  const notTestedGaps = stringArrayFromRecord(record?.notTestedGaps, true);
  const evidenceRefs = stringArrayFromRecord(record?.evidenceRefs);

  if (!recordStepId || recordStepId !== stepId || !testEvidenceId || !commands?.length || !outcome || verifiedCommitSha === null || passedTestCount === null || failedTestCount === null || notTestedGaps === null || !evidenceRefs?.length) {
    return null;
  }

  return {
    stepId,
    testEvidenceId,
    commands,
    outcome,
    ...(verifiedCommitSha ? { verifiedCommitSha } : {}),
    passedTestCount,
    failedTestCount,
    notTestedGaps,
    evidenceRefs
  };
}

function missingTestAuditRecordFromValue(value: unknown, stepId: string): MissingTestAuditRecord | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const auditId = requiredString(record?.auditId);
  const auditedCriteriaRefs = stringArrayFromRecord(record?.auditedCriteriaRefs);
  const coverageEvidenceRefs = stringArrayFromRecord(record?.coverageEvidenceRefs);
  const missingTestGaps = stringArrayFromRecord(record?.missingTestGaps, true);
  const evidenceRefs = stringArrayFromRecord(record?.evidenceRefs);

  if (
    !recordStepId ||
    recordStepId !== stepId ||
    !auditId ||
    !auditedCriteriaRefs?.length ||
    !coverageEvidenceRefs?.length ||
    missingTestGaps === null ||
    !evidenceRefs?.length
  ) {
    return null;
  }

  return {
    stepId,
    auditId,
    auditedCriteriaRefs,
    coverageEvidenceRefs,
    missingTestGaps,
    evidenceRefs
  };
}

function implementationStepBlockerFromValue(value: unknown, stepId: string): ImplementationStepBlocker | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = recordFromUnknown(value);
  const recordStepId = requiredString(record?.stepId);
  const reason = requiredString(record?.reason);
  const missingEvidence = stringArrayFromRecord(record?.missingEvidence);
  const nextRequiredAction = requiredString(record?.nextRequiredAction);
  const evidenceRefs = stringArrayFromRecord(record?.evidenceRefs);

  if (!recordStepId || recordStepId !== stepId || !reason || !missingEvidence?.length || !nextRequiredAction || !evidenceRefs?.length) {
    return null;
  }

  return {
    stepId,
    reason,
    missingEvidence,
    nextRequiredAction,
    evidenceRefs
  };
}

function implementationStepRequiredEvidence(input: {
  readonly stepDoc: ImplementationStepDoc;
  readonly stepCommitRecord: StepCommitRecord | null;
  readonly noCodeStepEvidence: NoCodeStepEvidence | null;
  readonly codeReviewRecord: CodeReviewRecord | null;
  readonly cleanCodeReviewRecord: CleanCodeReviewRecord | null;
  readonly codeReviewStreaks: ReturnType<typeof implementationCodeReviewStreaks>;
  readonly cleanCodeReviewStreaks: ReturnType<typeof implementationCleanCodeReviewStreaks>;
  readonly missingTestAuditRecord: MissingTestAuditRecord | null;
  readonly testEvidenceRecord: TestEvidenceRecord | null;
}) {
  const missing: string[] = [];
  const implementationEvidence = input.stepCommitRecord ?? input.noCodeStepEvidence;

  if (!implementationEvidence) {
    missing.push(input.stepDoc.expectedChangeScope === "tracked_code_docs_config" ? "StepCommitRecord" : "StepCommitRecord or NoCodeStepEvidence");
  }
  if (input.stepDoc.expectedChangeScope === "tracked_code_docs_config" && !input.stepCommitRecord) {
    missing.push("tracked step-local commit SHA");
  }
  if (input.noCodeStepEvidence && (!input.noCodeStepEvidence.cleanTrackedState || input.noCodeStepEvidence.notTestedGaps.length > 0)) {
    missing.push("clean NoCodeStepEvidence without Not-tested gaps");
  }
  if (input.codeReviewRecord?.verdict !== "passed" || !input.codeReviewStreaks.every((streak) => streak.satisfied)) {
    missing.push(IMPLEMENTATION_CODE_REVIEW_STREAK_MISSING_EVIDENCE);
  }
  if (
    input.cleanCodeReviewRecord?.verdict !== "passed" ||
    !input.cleanCodeReviewStreaks.every((streak) => streak.satisfied)
  ) {
    missing.push(IMPLEMENTATION_CLEAN_CODE_REVIEW_STREAK_MISSING_EVIDENCE);
  }
  if (!implementationTestEvidencePassed(input.testEvidenceRecord)) {
    missing.push("passing TestEvidenceRecord without failed tests or Not-tested gaps");
  }
  if (!implementationMissingTestAuditPassed(input.missingTestAuditRecord)) {
    missing.push("MissingTestAuditRecord without missing targeted-test gaps");
  }

  return uniqueStringRefs(missing);
}

function implementationTestEvidencePassed(record: TestEvidenceRecord | null) {
  return Boolean(
    record &&
    record.outcome === "passed" &&
    record.passedTestCount > 0 &&
    record.failedTestCount === 0 &&
    record.notTestedGaps.length === 0
  );
}

function implementationTestEvidenceHasFailureOrGap(record: TestEvidenceRecord | null) {
  return Boolean(record && (record.outcome === "failed" || record.failedTestCount > 0 || record.notTestedGaps.length > 0));
}

function implementationMissingTestAuditPassed(record: MissingTestAuditRecord | null) {
  return Boolean(record && record.missingTestGaps.length === 0);
}

function implementationMissingTestAuditHasGap(record: MissingTestAuditRecord | null) {
  return Boolean(record && record.missingTestGaps.length > 0);
}

function implementationStepStageEvidence(input: {
  readonly targetStatus: ImplementationStepStatus;
  readonly stepDoc: ImplementationStepDoc;
  readonly startedEvidenceRefs: readonly string[];
  readonly stepCommitRecord: StepCommitRecord | null;
  readonly noCodeStepEvidence: NoCodeStepEvidence | null;
  readonly codeReviewRecord: CodeReviewRecord | null;
  readonly cleanCodeReviewRecord: CleanCodeReviewRecord | null;
  readonly codeReviewStreaks: ReturnType<typeof implementationCodeReviewStreaks>;
  readonly cleanCodeReviewStreaks: ReturnType<typeof implementationCleanCodeReviewStreaks>;
  readonly missingTestAuditRecord: MissingTestAuditRecord | null;
  readonly testEvidenceRecord: TestEvidenceRecord | null;
}) {
  const missing: string[] = [];
  const implementationEvidence = input.stepCommitRecord ?? input.noCodeStepEvidence;
  const needsImplementationEvidence = [
    "committed",
    "review_required",
    "clean_code_review_required",
    "tests_required",
    "completed"
  ].includes(input.targetStatus);
  const needsCodeReview = ["clean_code_review_required", "tests_required", "completed"].includes(input.targetStatus);
  const needsCleanCodeReview = ["tests_required", "completed"].includes(input.targetStatus);
  const needsTests = input.targetStatus === "completed";

  if (input.targetStatus === "implementing" && input.startedEvidenceRefs.length === 0) {
    missing.push("started implementation evidence refs");
  }
  if (needsImplementationEvidence && !implementationEvidence) {
    missing.push(input.stepDoc.expectedChangeScope === "tracked_code_docs_config" ? "StepCommitRecord" : "StepCommitRecord or NoCodeStepEvidence");
  }
  if (needsImplementationEvidence && input.stepDoc.expectedChangeScope === "tracked_code_docs_config" && !input.stepCommitRecord) {
    missing.push("tracked step-local commit SHA");
  }
  if (input.noCodeStepEvidence && (!input.noCodeStepEvidence.cleanTrackedState || input.noCodeStepEvidence.notTestedGaps.length > 0)) {
    missing.push("clean NoCodeStepEvidence without Not-tested gaps");
  }
  if (needsCodeReview && (input.codeReviewRecord?.verdict !== "passed" || !input.codeReviewStreaks.every((streak) => streak.satisfied))) {
    missing.push(IMPLEMENTATION_CODE_REVIEW_STREAK_MISSING_EVIDENCE);
  }
  if (
    needsCleanCodeReview &&
    (
      input.cleanCodeReviewRecord?.verdict !== "passed" ||
      !input.cleanCodeReviewStreaks.every((streak) => streak.satisfied)
    )
  ) {
    missing.push(IMPLEMENTATION_CLEAN_CODE_REVIEW_STREAK_MISSING_EVIDENCE);
  }
  if (needsTests && !implementationTestEvidencePassed(input.testEvidenceRecord)) {
    missing.push("passing TestEvidenceRecord without failed tests or Not-tested gaps");
  }
  if (needsTests && !implementationMissingTestAuditPassed(input.missingTestAuditRecord)) {
    missing.push("MissingTestAuditRecord without missing targeted-test gaps");
  }

  return uniqueStringRefs(missing);
}

const IMPLEMENTATION_STEP_LINEAR_STATUSES = [
  "planned",
  "ready",
  "implementing",
  "committed",
  "review_required",
  "clean_code_review_required",
  "tests_required",
  "completed"
] as const satisfies readonly ImplementationStepStatus[];

function implementationStepLinearIndex(status: ImplementationStepStatus) {
  return IMPLEMENTATION_STEP_LINEAR_STATUSES.indexOf(status as (typeof IMPLEMENTATION_STEP_LINEAR_STATUSES)[number]);
}

function implementationStepLinearMissingEvidence(input: {
  readonly targetStatus: ImplementationStepStatus;
  readonly previousNonBlockedStep: ImplementationStepRecord | null;
}) {
  if (input.targetStatus === "blocked") {
    return [];
  }

  const targetIndex = implementationStepLinearIndex(input.targetStatus);

  if (!input.previousNonBlockedStep) {
    return targetIndex <= implementationStepLinearIndex("ready")
      ? []
      : [`linear status transition before ${input.targetStatus}`];
  }

  const previousIndex = implementationStepLinearIndex(input.previousNonBlockedStep.status);

  if (previousIndex < 0) {
    return targetIndex <= implementationStepLinearIndex("ready")
      ? []
      : [`linear status transition before ${input.targetStatus}`];
  }
  if (targetIndex === previousIndex || targetIndex === previousIndex + 1) {
    return [];
  }
  if (targetIndex < previousIndex) {
    return [`linear status regression from ${input.previousNonBlockedStep.status} to ${input.targetStatus}`];
  }

  return [`linear status transition: record ${IMPLEMENTATION_STEP_LINEAR_STATUSES[previousIndex + 1]} before ${input.targetStatus}`];
}

function implementationStepStatus(input: {
  readonly targetStatus: ImplementationStepStatus;
  readonly missingRequiredEvidence: readonly string[];
  readonly missingStageEvidence: readonly string[];
  readonly blocker: ImplementationStepBlocker | null;
  readonly codeReviewRecord: CodeReviewRecord | null;
  readonly cleanCodeReviewRecord: CleanCodeReviewRecord | null;
  readonly missingTestAuditRecord: MissingTestAuditRecord | null;
  readonly testEvidenceRecord: TestEvidenceRecord | null;
}): ImplementationStepStatus {
  if (input.blocker || input.codeReviewRecord?.verdict === "changes_requested" || input.codeReviewRecord?.verdict === "blocked" || input.cleanCodeReviewRecord?.verdict === "changes_requested" || input.cleanCodeReviewRecord?.verdict === "blocked" || implementationTestEvidenceHasFailureOrGap(input.testEvidenceRecord) || implementationMissingTestAuditHasGap(input.missingTestAuditRecord)) {
    return "blocked";
  }

  if (input.targetStatus === "completed") {
    return input.missingRequiredEvidence.length || input.missingStageEvidence.length ? "blocked" : "completed";
  }

  if (input.targetStatus !== "blocked" && input.missingStageEvidence.length > 0) {
    return "blocked";
  }

  return input.targetStatus;
}

function implementationStepBlocker(input: {
  readonly stepId: string;
  readonly status: ImplementationStepStatus;
  readonly explicitBlocker: ImplementationStepBlocker | null;
  readonly missingRequiredEvidence: readonly string[];
  readonly commandId: string;
}) {
  if (input.explicitBlocker) {
    return input.explicitBlocker;
  }

  if (input.status !== "blocked") {
    return null;
  }

  return {
    stepId: input.stepId,
    reason: "Implementation step cannot complete until required commit, review, clean-code review, missing-test audit, and test evidence is present and passing.",
    missingEvidence: input.missingRequiredEvidence.length ? input.missingRequiredEvidence : ["passing implementation step evidence"],
    nextRequiredAction: "Record the missing evidence or leave the step visible as blocked/Not-tested.",
    evidenceRefs: [`implementation-step-ledger:blocker:${input.commandId}`]
  } satisfies ImplementationStepBlocker;
}

function implementationStepLedgerSummaryForStatus(status: ImplementationStepStatus) {
  switch (status) {
    case "completed":
      return "Implementation step is completed with commit/review/test evidence.";
    case "blocked":
      return "Implementation step ledger is blocked by missing or failed evidence.";
    case "tests_required":
      return "Implementation step is waiting for test evidence.";
    case "clean_code_review_required":
      return "Implementation step is waiting for clean-code review.";
    case "review_required":
      return "Implementation step is waiting for code review.";
    case "committed":
      return "Implementation step has a local commit record.";
    case "implementing":
      return "Implementation step is in progress.";
    case "ready":
      return "Implementation step is ready with documented inputs.";
    case "planned":
      return "Implementation step is planned.";
  }
}

function uniqueImplementationReviewRecordsById<TRecord extends { readonly reviewId: string }>(
  records: readonly TRecord[]
) {
  const byId = new Map<string, TRecord>();

  for (const record of records) {
    byId.set(record.reviewId, record);
  }

  return [...byId.values()];
}

function implementationStepLedgerProjectionFromSteps(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  trackerDoc: TrackerDoc,
  steps: readonly ImplementationStepRecord[]
): ImplementationStepLedgerProjection {
  const currentStatus = steps.at(-1)?.status ?? "planned";
  const draft = {
    kind: "ImplementationStepLedgerProjection",
    sessionId: command.sessionId,
    version: projectionVersionFor(state),
    currentStatus,
    trackerDoc,
    steps,
    stepCommitRecords: steps.flatMap((step) => step.stepCommitRecord ? [step.stepCommitRecord] : []),
    noCodeStepEvidenceRecords: steps.flatMap((step) => step.noCodeStepEvidence ? [step.noCodeStepEvidence] : []),
    codeReviewRecords: uniqueImplementationReviewRecordsById(
      steps.flatMap((step) => step.codeReviewRecord ? [step.codeReviewRecord] : [])
    ),
    cleanCodeReviewRecords: uniqueImplementationReviewRecordsById(
      steps.flatMap((step) => step.cleanCodeReviewRecord ? [step.cleanCodeReviewRecord] : [])
    ),
    missingTestAuditRecords: steps.flatMap((step) => step.missingTestAuditRecord ? [step.missingTestAuditRecord] : []),
    testEvidenceRecords: steps.flatMap((step) => step.testEvidenceRecord ? [step.testEvidenceRecord] : []),
    blockedSteps: steps.flatMap((step) => step.blocker ? [step.blocker] : []),
    progressReport: "",
    summary: implementationStepLedgerSummaryForStatus(currentStatus),
    refetchUrl: `/api/v1/sessions/${command.sessionId}/implementation-step-ledger`,
    schemaVersion: IMPLEMENTATION_STEP_LEDGER_SCHEMA_VERSION
  } satisfies ImplementationStepLedgerProjection;

  return validateImplementationStepLedgerProjection({
    ...draft,
    progressReport: implementationStepLedgerProgressReport(draft)
  });
}

function reduceRecordImplementationStepLedger(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedImplementationStepLedgerPayload(command)) {
    return reject("RecordImplementationStepLedger payload contains unsupported keys.", "VALIDATION_FAILED");
  }
  if (containsImplementationStepLedgerForbiddenCustodyValue(command.payload)) {
    return reject(
      "RecordImplementationStepLedger payload must not contain credential, session, token, or secret values.",
      "VALIDATION_FAILED"
    );
  }

  const payload = command.payload as Partial<RecordImplementationStepLedgerPayload>;
  const trackerDoc = trackerDocFromValue(payload.trackerDoc);
  const stepDoc = implementationStepDocFromValue(payload.stepDoc);
  const targetStatus = implementationStepStatusFromValue(payload.targetStatus);
  const startedEvidenceRefs = stringArrayFromRecord(payload.startedEvidenceRefs, true);
  const evidenceRefs = stringArrayFromRecord(payload.evidenceRefs, true);

  if (!trackerDoc || !stepDoc || !targetStatus || startedEvidenceRefs === null || evidenceRefs === null) {
    return reject("RecordImplementationStepLedger payload is invalid.", "VALIDATION_FAILED");
  }

  const stepCommitRecord = stepCommitRecordFromValue(payload.stepCommitRecord, stepDoc.stepId);
  const noCodeStepEvidence = noCodeStepEvidenceFromValue(payload.noCodeStepEvidence, stepDoc.stepId);
  const codeReviewRecord = codeReviewRecordFromValue(payload.codeReviewRecord, stepDoc.stepId);
  const cleanCodeReviewRecord = cleanCodeReviewRecordFromValue(payload.cleanCodeReviewRecord, stepDoc.stepId);
  const missingTestAuditRecord = missingTestAuditRecordFromValue(payload.missingTestAuditRecord, stepDoc.stepId);
  const testEvidenceRecord = testEvidenceRecordFromValue(payload.testEvidenceRecord, stepDoc.stepId);
  const explicitBlocker = implementationStepBlockerFromValue(payload.blocker, stepDoc.stepId);

  if ([stepCommitRecord, noCodeStepEvidence, codeReviewRecord, cleanCodeReviewRecord, missingTestAuditRecord, testEvidenceRecord, explicitBlocker].some((record) => record === null)) {
    return reject("RecordImplementationStepLedger evidence records are invalid or do not match the step id.", "VALIDATION_FAILED");
  }

  const existingSteps = state.implementationStepLedger?.steps ?? [];
  const existingStepForId = existingSteps.find((step) => step.stepDoc.stepId === stepDoc.stepId) ?? null;
  const existingCodeReviewRecords = existingSteps.flatMap((step) =>
    step.codeReviewRecord?.stepId === stepDoc.stepId ? [step.codeReviewRecord] : []
  );
  const existingCleanCodeReviewRecords = existingSteps.flatMap((step) =>
    step.cleanCodeReviewRecord?.stepId === stepDoc.stepId ? [step.cleanCodeReviewRecord] : []
  );
  const nextCodeReviewRecords = codeReviewRecord
    ? [...existingCodeReviewRecords, codeReviewRecord]
    : existingCodeReviewRecords;
  const nextCleanCodeReviewRecords = cleanCodeReviewRecord
    ? [...existingCleanCodeReviewRecords, cleanCodeReviewRecord]
    : existingCleanCodeReviewRecords;
  const codeReviewStreaks = implementationCodeReviewStreaks(nextCodeReviewRecords);
  const cleanCodeReviewStreaks = implementationCleanCodeReviewStreaks(nextCleanCodeReviewRecords);
  const latestCodeReviewRecord = codeReviewRecord ?? nextCodeReviewRecords.at(-1) ?? null;
  const latestCleanCodeReviewRecord = cleanCodeReviewRecord ?? nextCleanCodeReviewRecords.at(-1) ?? null;

  if (state.implementationStepLedger && !sameTrackerDoc(state.implementationStepLedger.trackerDoc, trackerDoc)) {
    return reject("RecordImplementationStepLedger trackerDoc must match the existing ledger trackerDoc.", "VALIDATION_FAILED");
  }
  if (existingStepForId && !sameImplementationStepDoc(existingStepForId.stepDoc, stepDoc)) {
    return reject("RecordImplementationStepLedger stepDoc must match the existing step doc for the same step id.", "VALIDATION_FAILED");
  }

  const previousNonBlockedStep = [...existingSteps]
    .reverse()
    .find((step) => step.stepDoc.stepId === stepDoc.stepId && step.status !== "blocked") ?? null;
  const missingRequiredEvidence = implementationStepRequiredEvidence({
    stepDoc,
    stepCommitRecord: stepCommitRecord ?? null,
    noCodeStepEvidence: noCodeStepEvidence ?? null,
    codeReviewRecord: latestCodeReviewRecord,
    cleanCodeReviewRecord: latestCleanCodeReviewRecord,
    codeReviewStreaks,
    cleanCodeReviewStreaks,
    missingTestAuditRecord: missingTestAuditRecord ?? null,
    testEvidenceRecord: testEvidenceRecord ?? null
  });
  const missingStageEvidence = implementationStepStageEvidence({
    targetStatus,
    stepDoc,
    startedEvidenceRefs,
    stepCommitRecord: stepCommitRecord ?? null,
    noCodeStepEvidence: noCodeStepEvidence ?? null,
    codeReviewRecord: latestCodeReviewRecord,
    cleanCodeReviewRecord: latestCleanCodeReviewRecord,
    codeReviewStreaks,
    cleanCodeReviewStreaks,
    missingTestAuditRecord: missingTestAuditRecord ?? null,
    testEvidenceRecord: testEvidenceRecord ?? null
  });
  const missingLinearEvidence = implementationStepLinearMissingEvidence({
    targetStatus,
    previousNonBlockedStep
  });
  const status = implementationStepStatus({
    targetStatus,
    missingRequiredEvidence,
    missingStageEvidence: uniqueStringRefs([...missingStageEvidence, ...missingLinearEvidence]),
    blocker: explicitBlocker ?? null,
    codeReviewRecord: latestCodeReviewRecord,
    cleanCodeReviewRecord: latestCleanCodeReviewRecord,
    missingTestAuditRecord: missingTestAuditRecord ?? null,
    testEvidenceRecord: testEvidenceRecord ?? null
  });
  const visibleMissingEvidence = status === "completed" ? [] : uniqueStringRefs([
    ...missingStageEvidence,
    ...missingLinearEvidence,
    ...(status === "blocked" ? missingRequiredEvidence : [])
  ]);
  const blocker = implementationStepBlocker({
    stepId: stepDoc.stepId,
    status,
    explicitBlocker: explicitBlocker ?? null,
    missingRequiredEvidence: visibleMissingEvidence,
    commandId: command.commandId
  });
  const stepRecord: ImplementationStepRecord = {
    stepDoc,
    status,
    missingEvidence: visibleMissingEvidence,
    blocker,
    evidenceRefs: uniqueStringRefs([
      `implementation-step:${stepDoc.stepId}`,
      ...startedEvidenceRefs,
      ...evidenceRefs,
      ...(stepCommitRecord?.evidenceRefs ?? []),
      ...(noCodeStepEvidence?.commandEvidenceRefs ?? []),
      ...nextCodeReviewRecords.flatMap((record) => record.evidenceRefs),
      ...nextCleanCodeReviewRecords.flatMap((record) => record.evidenceRefs),
      ...(missingTestAuditRecord?.evidenceRefs ?? []),
      ...(missingTestAuditRecord?.coverageEvidenceRefs ?? []),
      ...(testEvidenceRecord?.evidenceRefs ?? []),
      ...(blocker?.evidenceRefs ?? [])
    ]),
    updatedAt: command.issuedAt,
    stepCommitRecord: stepCommitRecord ?? null,
    noCodeStepEvidence: noCodeStepEvidence ?? null,
    codeReviewRecord: latestCodeReviewRecord,
    cleanCodeReviewRecord: latestCleanCodeReviewRecord,
    codeReviewStreaks,
    cleanCodeReviewStreaks,
    missingTestAuditRecord: missingTestAuditRecord ?? null,
    testEvidenceRecord: testEvidenceRecord ?? null
  };
  let projection: ImplementationStepLedgerProjection;

  try {
    projection = implementationStepLedgerProjectionFromSteps(command, state, trackerDoc, [
      ...existingSteps,
      stepRecord
    ]);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const eventType = status === "completed"
    ? "ImplementationStepCompleted"
    : status === "blocked"
      ? "ImplementationStepBlocked"
      : "ImplementationStepLedgerRecorded";
  const event = eventDraft(command, eventType, {
    trackerId: trackerDoc.trackerId,
    stepId: stepDoc.stepId,
    status,
    projection,
    summary: projection.summary
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      implementationStepLedger: projection
    },
    [
      {
        outputType: "implementation_step_ledger",
        outputRef: stepDoc.stepId,
        payload: {
          trackerId: trackerDoc.trackerId,
          stepId: stepDoc.stepId,
          status,
          missingEvidence: stepRecord.missingEvidence,
          progressReport: projection.progressReport
        }
      }
    ],
    [],
    projection
  );
}

const PHASE25_ALLOWED_PAYLOAD_KEYS = [
  "researchQuestion",
  "decisionContext",
  "sourceRefs",
  "baseline",
  "candidate",
  "delegationRiskGate",
  "rubric"
] as const;

function containsUnsupportedPhase25Payload(command: ProductEngineCommand) {
  return !hasOnlyRecordKeys(command.payload, PHASE25_ALLOWED_PAYLOAD_KEYS);
}

function isPhase25SourceType(value: unknown): value is Phase25SourceType {
  return typeof value === "string" && PHASE25_SOURCE_TYPES.includes(value as Phase25SourceType);
}

function isPhase25CandidateLane(value: unknown): value is Phase25CandidateLane {
  return typeof value === "string" && PHASE25_CANDIDATE_LANES.includes(value as Phase25CandidateLane);
}

function isPhase25FallbackLane(value: unknown): value is Phase25FallbackLane {
  return value === "manual_prompt_handoff" || value === "official_codex_fallback";
}

function phase25OptionalFallbackLaneFromValue(value: unknown): Phase25FallbackLane | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  return isPhase25FallbackLane(value) ? value : null;
}

function isPhase25GateVerdict(value: unknown): value is Phase25DelegationRiskGateVerdict {
  return typeof value === "string" && PHASE25_DELEGATION_RISK_GATE_VERDICTS.includes(value as Phase25DelegationRiskGateVerdict);
}

function isPhase25GateCheckName(value: unknown): value is Phase25DelegationRiskGateCheckName {
  return typeof value === "string" && PHASE25_DELEGATION_RISK_GATE_CHECKS.includes(value as Phase25DelegationRiskGateCheckName);
}

function isPhase25RubricDimension(value: unknown): value is Phase25ResearchQualityRubricDimension {
  return (
    typeof value === "string" &&
    PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS.includes(value as Phase25ResearchQualityRubricDimension)
  );
}

function phase25SourceRefFromValue(value: unknown): Phase25SourceRefDto | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const sourceId = requiredString(record.sourceId);

  if (
    !isPhase25SourceType(record.sourceType) ||
    !sourceId ||
    typeof record.required !== "boolean" ||
    typeof record.stale !== "boolean"
  ) {
    return null;
  }

  const sourceLabel = record.sourceLabel === undefined ? undefined : requiredString(record.sourceLabel);

  if (sourceLabel === null) {
    return null;
  }

  return {
    sourceType: record.sourceType,
    sourceId,
    ...(sourceLabel ? { sourceLabel } : {}),
    required: record.required,
    stale: record.stale
  };
}

function phase25SourceRefsFromValue(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    return reject(`CreatePhase25ResearchComparison ${fieldName} must be an array.`, "VALIDATION_FAILED");
  }

  const sourceRefs = value.map(phase25SourceRefFromValue);

  if (!sourceRefs.every(Boolean)) {
    return reject(
      `CreatePhase25ResearchComparison ${fieldName} must contain valid Phase25SourceRefDto objects.`,
      "VALIDATION_FAILED"
    );
  }

  if (!sourceRefs.length) {
    return reject(`CreatePhase25ResearchComparison ${fieldName} must contain at least one sourceRef.`, "VALIDATION_FAILED");
  }

  return sourceRefs as readonly Phase25SourceRefDto[];
}

function uniquePhase25SourceRefs(sourceRefs: readonly Phase25SourceRefDto[]) {
  const byKey = new Map<string, Phase25SourceRefDto>();

  for (const sourceRef of sourceRefs) {
    byKey.set(`${sourceRef.sourceType}:${sourceRef.sourceId}`, sourceRef);
  }

  return [...byKey.values()];
}

function phase25BaselineFromValue(value: unknown): Phase25BaselineResearchSummaryDto | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const sourceRefs = phase25SourceRefsFromValue(record.sourceRefs, "baseline.sourceRefs");

  if ("accepted" in sourceRefs) {
    return null;
  }

  const baselineRef = requiredString(record.baselineRef);
  const summary = requiredString(record.summary);
  const proEvidence = requiredStringArray(record.proEvidence);
  const conEvidence = requiredStringArray(record.conEvidence);
  const uncertainties = requiredStringArray(record.uncertainties);
  const limitations = optionalStringArray(record.limitations);

  if (!baselineRef || !summary || !proEvidence || !conEvidence || !uncertainties || !limitations) {
    return null;
  }

  return {
    baselineRef,
    summary,
    proEvidence,
    conEvidence,
    uncertainties,
    limitations,
    sourceRefs
  };
}

function phase25CandidateFromValue(value: unknown): Phase25CandidateResearchSummaryDto | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const sourceTraceRefs = phase25SourceRefsFromValue(record.sourceTraceRefs, "candidate.sourceTraceRefs");

  if ("accepted" in sourceTraceRefs) {
    return null;
  }

  const candidateRef = requiredString(record.candidateRef);
  const summary = requiredString(record.summary);
  const proEvidence = optionalStringArray(record.proEvidence);
  const conEvidence = optionalStringArray(record.conEvidence);
  const uncertainties = optionalStringArray(record.uncertainties);
  const decisionImpacts = optionalStringArray(record.decisionImpacts);
  const policyNotes = optionalStringArray(record.policyNotes);

  if (
    !candidateRef ||
    !isPhase25CandidateLane(record.lane) ||
    !summary ||
    !proEvidence ||
    !conEvidence ||
    !uncertainties ||
    !decisionImpacts ||
    !policyNotes ||
    (record.staleRisk !== "low" && record.staleRisk !== "medium" && record.staleRisk !== "high")
  ) {
    return null;
  }

  return {
    candidateRef,
    lane: record.lane,
    summary,
    proEvidence,
    conEvidence,
    uncertainties,
    decisionImpacts,
    sourceTraceRefs,
    staleRisk: record.staleRisk,
    policyNotes
  };
}

function phase25GateCheckFromValue(value: unknown): Phase25DelegationRiskGateCheckDto | null {
  const record = recordFromUnknown(value);

  if (!record) {
    return null;
  }

  const sourceRefs = phase25SourceRefsFromValue(record.sourceRefs, "delegationRiskGate.checks.sourceRefs");
  const rationale = requiredString(record.rationale);

  if (
    "accepted" in sourceRefs ||
    !isPhase25GateCheckName(record.checkName) ||
    (record.status !== "pass" && record.status !== "block" && record.status !== "fallback") ||
    !rationale
  ) {
    return null;
  }

  return {
    checkName: record.checkName,
    status: record.status,
    rationale,
    sourceRefs
  };
}

function phase25GateFromValue(value: unknown, candidateLane: Phase25CandidateLane): Phase25DelegationRiskGateDto | null {
  const record = recordFromUnknown(value);

  if (
    !record ||
    !isPhase25GateVerdict(record.verdict) ||
    record.candidateLane !== candidateLane ||
    record.noExecutionBoundary !== PHASE25_NO_EXECUTION_BOUNDARY
  ) {
    return null;
  }

  const checks = Array.isArray(record.checks) ? record.checks.map(phase25GateCheckFromValue) : [];
  const blockedReasons = optionalStringArray(record.blockedReasons);
  const rationale = requiredString(record.rationale);
  const fallbackLane = phase25OptionalFallbackLaneFromValue(record.fallbackLane);

  if (
    !checks.length ||
    !checks.every(Boolean) ||
    !blockedReasons ||
    !rationale ||
    fallbackLane === null ||
    (record.verdict === "fallback_required" && !fallbackLane)
  ) {
    return null;
  }

  return {
    verdict: record.verdict,
    candidateLane,
    checks: checks as readonly Phase25DelegationRiskGateCheckDto[],
    blockedReasons,
    ...(fallbackLane ? { fallbackLane } : {}),
    noExecutionBoundary: PHASE25_NO_EXECUTION_BOUNDARY,
    rationale
  };
}

function phase25RubricFromValue(value: unknown): readonly Phase25ResearchQualityRubricScoreDto[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const scores = value.map((item): Phase25ResearchQualityRubricScoreDto | null => {
    const record = recordFromUnknown(item);

    if (!record) {
      return null;
    }

    const sourceRefs = phase25SourceRefsFromValue(record.sourceRefs, "rubric.sourceRefs");
    const rationale = requiredString(record.rationale);

    if (
      "accepted" in sourceRefs ||
      !isPhase25RubricDimension(record.dimension) ||
      (record.status !== "pass" && record.status !== "fail") ||
      !rationale
    ) {
      return null;
    }

    return {
      dimension: record.dimension,
      status: record.status,
      rationale,
      sourceRefs
    };
  });

  return scores.length && scores.every(Boolean) ? (scores as readonly Phase25ResearchQualityRubricScoreDto[]) : null;
}

function phase25GateCheckBlockers(gate: Phase25DelegationRiskGateDto) {
  return gate.checks
    .filter((check) => check.status !== "pass")
    .map((check) => `DelegationRiskGate check ${check.checkName} is ${check.status}: ${check.rationale}`);
}

function phase25RubricCoversEveryDimension(rubric: readonly Phase25ResearchQualityRubricScoreDto[]) {
  const dimensions = new Set(rubric.map((score) => score.dimension));

  return PHASE25_RESEARCH_QUALITY_RUBRIC_DIMENSIONS.every((dimension) => dimensions.has(dimension));
}

function phase25MaterialQualityLiftBlockers(
  candidate: Phase25CandidateResearchSummaryDto,
  gate: Phase25DelegationRiskGateDto,
  rubric: readonly Phase25ResearchQualityRubricScoreDto[]
) {
  const blockers: string[] = [];

  if (gate.verdict !== "allowed_for_comparative_preview") {
    blockers.push(`DelegationRiskGate verdict is ${gate.verdict}.`);
  }

  blockers.push(...gate.blockedReasons);
  blockers.push(...phase25GateCheckBlockers(gate));

  if (!candidate.proEvidence.length) {
    blockers.push("Candidate output lacks pro evidence.");
  }

  if (!candidate.conEvidence.length) {
    blockers.push("Candidate output is pro-only and lacks counter-evidence.");
  }

  if (!candidate.uncertainties.length) {
    blockers.push("Candidate output lacks explicit uncertainties.");
  }

  if (!candidate.decisionImpacts.length) {
    blockers.push("Candidate output lacks decision-impact evidence.");
  }

  if (!candidate.sourceTraceRefs.length) {
    blockers.push("Candidate output lacks source trace refs.");
  }

  if (!phase25RubricCoversEveryDimension(rubric)) {
    blockers.push("Rubric does not cover every Phase 2.5 quality dimension.");
  }

  if (!rubric.every((score) => score.status === "pass")) {
    blockers.push("At least one quality rubric dimension failed.");
  }

  return blockers;
}

function phase25ComparisonArtifactId(
  command: ProductEngineCommand,
  candidate: Phase25CandidateResearchSummaryDto,
  sourceRefs: readonly Phase25SourceRefDto[]
) {
  const refs = sourceRefs.map((sourceRef) => `${sourceRef.sourceType}:${sourceRef.sourceId}`).sort().join("|");

  return `phase25_cmp_${stableToken(`${command.sessionId}:${command.expectedStateVersion}:${candidate.candidateRef}:${refs}`)}`;
}

function phase25CreatedBy(command: ProductEngineCommand): Phase25ResearchQualityComparisonReportDto["createdBy"] {
  return command.actor === "user" || command.actor === "system" ? command.actor : "product_engine";
}

function phase25Projection(
  command: ProductEngineCommand,
  report: Phase25ResearchQualityComparisonReportDto
): Phase25ResearchComparisonProjection {
  return {
    kind: "Phase25ResearchComparisonProjection",
    sessionId: command.sessionId,
    version: (Number(command.expectedStateVersion) + 1) as ProjectionVersion,
    currentStatus: report.status,
    artifact: report,
    sourceRefs: report.sourceRefs,
    summary: report.decisionImpactSummary,
    refetchUrl: `/api/v1/sessions/${command.sessionId}/phase25/research-comparison`
  };
}

function reduceCreatePhase25ResearchComparison(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (containsUnsupportedPhase25Payload(command)) {
    return reject(
      "CreatePhase25ResearchComparison payload must only include researchQuestion, decisionContext, sourceRefs, baseline, candidate, delegationRiskGate, and rubric.",
      "VALIDATION_FAILED"
    );
  }

  const researchQuestion = requiredString(command.payload.researchQuestion);
  const decisionContext = requiredString(command.payload.decisionContext);
  const baseline = phase25BaselineFromValue(command.payload.baseline);
  const candidate = phase25CandidateFromValue(command.payload.candidate);
  const rubric = phase25RubricFromValue(command.payload.rubric);
  const payloadSourceRefs = phase25SourceRefsFromValue(command.payload.sourceRefs, "sourceRefs");

  if (!researchQuestion || !decisionContext || !baseline || !candidate || !rubric || "accepted" in payloadSourceRefs) {
    return reject(
      "CreatePhase25ResearchComparison requires a research question, decision context, baseline, candidate, rubric, and traceable sourceRefs.",
      "VALIDATION_FAILED"
    );
  }

  const payloadGate = phase25GateFromValue(command.payload.delegationRiskGate, candidate.lane);

  if (!payloadGate) {
    return reject("CreatePhase25ResearchComparison requires a valid DelegationRiskGate.", "VALIDATION_FAILED");
  }

  const sourceRefs = uniquePhase25SourceRefs([
    ...payloadSourceRefs,
    ...baseline.sourceRefs,
    ...candidate.sourceTraceRefs,
    ...payloadGate.checks.flatMap((check) => check.sourceRefs),
    ...rubric.flatMap((score) => score.sourceRefs)
  ]);
  const blockers = phase25MaterialQualityLiftBlockers(candidate, payloadGate, rubric);
  const status: Phase25ResearchComparisonStatus = blockers.length ? "safe_failure_blocked" : "quality_lift_ready";
  const delegationRiskGate: Phase25DelegationRiskGateDto = blockers.length
    ? {
        ...payloadGate,
        verdict: payloadGate.verdict === "allowed_for_comparative_preview" ? "fallback_required" : payloadGate.verdict,
        blockedReasons: uniqueStrings([...payloadGate.blockedReasons, ...blockers]),
        fallbackLane: payloadGate.fallbackLane ?? "manual_prompt_handoff",
        rationale: `${payloadGate.rationale} Safe failure: ${blockers.join(" ")}`
      }
    : payloadGate;
  const decisionImpactSummary =
    status === "quality_lift_ready"
      ? `Phase 2.5 comparison shows material research quality lift for: ${researchQuestion}`
      : `Phase 2.5 comparison failed safely for: ${researchQuestion}`;
  const report: Phase25ResearchQualityComparisonReportDto = {
    artifactId: phase25ComparisonArtifactId(command, candidate, sourceRefs),
    kind: "ResearchQualityComparisonReport",
    schemaVersion: PHASE25_RESEARCH_COMPARISON_SCHEMA_VERSION,
    createdAt: command.issuedAt,
    createdBy: phase25CreatedBy(command),
    status,
    researchQuestion,
    decisionContext,
    candidateLane: candidate.lane,
    sourceRefs,
    baseline,
    candidate,
    delegationRiskGate,
    rubric,
    qualityLiftStatus: status === "quality_lift_ready" ? "material_quality_lift" : "safe_failure_no_lift",
    qualityLiftClaimed: status === "quality_lift_ready",
    decisionImpactSummary,
    requiredFollowUps:
      status === "quality_lift_ready"
        ? ["Keep live adapter execution behind a separate Phase 3 approval gate."]
        : delegationRiskGate.blockedReasons,
    noExecutionPolicy: PHASE25_NO_EXECUTION_BOUNDARY
  };

  try {
    validatePhase25ResearchComparisonReport(report);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error), "VALIDATION_FAILED");
  }

  const projection = phase25Projection(command, report);
  const event = eventDraft(
    command,
    status === "quality_lift_ready" ? "Phase25ResearchComparisonCreated" : "Phase25ResearchComparisonBlocked",
    {
      artifactId: report.artifactId,
      artifactKind: report.kind,
      verdict: delegationRiskGate.verdict,
      status,
      sourceRefs,
      projection,
      summary: projection.summary
    }
  );

  return acceptedReduction(
    command,
    state,
    event,
    {
      phase25ResearchComparison: projection
    },
    [
      {
        outputType: "phase25_research_comparison_report",
        outputRef: report.artifactId,
        payload: {
          artifactId: report.artifactId,
          status,
          verdict: delegationRiskGate.verdict,
          qualityLiftClaimed: report.qualityLiftClaimed,
          candidateLane: report.candidateLane
        }
      }
    ],
    [],
    projection
  );
}

function reduceCreateSpecUpdatePreview(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("CreateSpecUpdatePreview requires an initial spec draft.");
  }

  const sourceRef =
    requiredString(command.payload.sourceRef) ??
    requiredString(command.payload.sourcePreviewRef) ??
    requiredString(command.payload.evidenceMatrixId) ??
    requiredString(command.payload.runtimeArtifactId);

  if (!sourceRef) {
    return reject("CreateSpecUpdatePreview requires a sourceRef trace link.", "VALIDATION_FAILED");
  }

  const requiredDecisionRef = isRequiredDecisionRef(command.payload.requiredDecisionRef)
    ? command.payload.requiredDecisionRef
    : "primary_customer";
  const payloadSections = optionalPayloadSections(command.payload.sections);

  if (payloadSections === "invalid") {
    return reject("CreateSpecUpdatePreview sections must be non-empty strings.", "VALIDATION_FAILED");
  }

  const previewRef = `spec_update_${stableToken(`${command.sessionId}:${sourceRef}:${requiredDecisionRef}`)}`;
  const decisionId = decisionIdForSpecUpdatePreview(previewRef);
  const existingDecision = state.decisions.find((decision) => decision.decisionId === decisionId);

  if (
    existingDecision &&
    existingDecision.status !== "active" &&
    existingDecision.status !== "deferred"
  ) {
    return reject("CreateSpecUpdatePreview cannot recreate a terminal decision card.", "COMMAND_PRECONDITION_FAILED", {
      decisionId,
      status: existingDecision.status
    });
  }

  const version = projectionVersionFor(state);
  const decision = {
    decisionId,
    requiredDecisionRef,
    status: "active" as const
  };
  const decisions = mergeDecision(state.decisions, decision);
  const title =
    requiredString(command.payload.title) ??
    state.currentSpec.title ??
    state.project.rawIdeaText ??
    "Spec update preview";
  const sections = payloadSections ?? state.currentSpec.sections ?? [];
  const specUpdatePreview = {
    previewRef,
    sourceRef,
    decisionId,
    requiredDecisionRef,
    title,
    sections
  } as const satisfies SpecUpdatePreviewSnapshot;
  const specUpdatePreviews = mergeSpecUpdatePreview(state.specUpdatePreviews ?? [], specUpdatePreview);
  const queueProjection = queueProjectionWithSpecUpdateDecision(
    state.queueProjection,
    decisionId,
    `Decision approval required: ${requiredDecisionRef}`,
    version,
    command.issuedAt
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      decisions,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "SpecUpdatePreviewCreated", {
    previewRef,
    sourceRef,
    requiredDecisionRef,
    title,
    sections,
    decision,
    specUpdatePreview,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      decisions,
      specUpdatePreviews,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: previewRef,
        payload: {
          previewRef,
          sourceRef,
          decisionId,
          requiredDecisionRef,
          title,
          sections
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "SpecUpdatePreviewCreated",
        {
          refType: "SpecUpdatePreview",
          refId: previewRef
        },
        "normal"
      )
    ],
    queueProjection
  );
}

function reduceResolveDecision(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const decisionId = requiredString(command.payload.decisionId) as DecisionId | null;
  const outcome = isDecisionResolutionStatus(command.payload.outcome) ? command.payload.outcome : null;

  if (!decisionId || !outcome) {
    return reject("ResolveDecision requires decisionId and a supported resolution outcome.", "VALIDATION_FAILED");
  }

  const existingDecision = state.decisions.find((decision) => decision.decisionId === decisionId);

  if (!existingDecision) {
    return reject("ResolveDecision requires an existing decision.", "RESOURCE_NOT_FOUND");
  }

  if (existingDecision.status !== "active" && existingDecision.status !== "deferred") {
    return reject("ResolveDecision requires an active or deferred decision.", "COMMAND_PRECONDITION_FAILED");
  }

  const version = projectionVersionFor(state);
  const decisions = state.decisions.map((decision) =>
    decision.decisionId === decisionId
      ? {
          ...decision,
          status: outcome
        }
      : decision
  );
  const queueItemId = decisionQueueItemId(decisionId);
  const queueProjection =
    outcome === "deferred"
      ? queueProjectionWithDeferredItem(
          state.queueProjection,
          {
            queueItemId,
            title: `Decision deferred: ${existingDecision.requiredDecisionRef}`,
            state: "deferred"
          },
          version,
          command.issuedAt
        )
      : queueProjectionWithoutItem(state.queueProjection, queueItemId, version, command.issuedAt);
  const updatedConfidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      decisions,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "DecisionResolved", {
    decisionId,
    outcome,
    requiredDecisionRef: existingDecision.requiredDecisionRef,
    queueProjection,
    confidenceProjection: updatedConfidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      decisions,
      queueProjection,
      completeness: updatedConfidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: decisionId,
        payload: {
          outcome
        }
      },
      ...completenessDeterministicOutputs(command, updatedConfidenceProjection)
    ],
    [],
    updatedConfidenceProjection
  );
}

function reduceCreateSpecVersion(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const approvedPreviewRef = requiredString(command.payload.approvedPreviewRef);

  if (!state.currentSpec.draftRef) {
    return reject("CreateSpecVersion requires an initial spec draft.");
  }

  if (!approvedPreviewRef) {
    return reject("CreateSpecVersion requires approvedPreviewRef.", "VALIDATION_FAILED");
  }

  const approvedDecisionId = decisionIdForSpecUpdatePreview(approvedPreviewRef);
  const approvedDecision = state.decisions.find(
    (decision) => decision.decisionId === approvedDecisionId && decision.status === "approved"
  );
  const approvedPreview = state.specUpdatePreviews?.find((preview) => preview.previewRef === approvedPreviewRef);

  if (!approvedDecision) {
    return reject("CreateSpecVersion requires an approved decision for the preview ref.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef,
      expectedDecisionId: approvedDecisionId
    });
  }

  if (!approvedPreview) {
    return reject("CreateSpecVersion requires approved spec update preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  const payloadSections = optionalPayloadSections(command.payload.sections);

  if (payloadSections === "invalid") {
    return reject("CreateSpecVersion sections must be non-empty strings.", "VALIDATION_FAILED");
  }

  const payloadTitle = requiredString(command.payload.title);

  if (payloadTitle && payloadTitle !== approvedPreview.title) {
    return reject("CreateSpecVersion title must match the approved preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  if (payloadSections && !stringArraysEqual(payloadSections, approvedPreview.sections)) {
    return reject("CreateSpecVersion sections must match the approved preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  const version = projectionVersionFor(state);
  const versionRef = `spec_version_${stableToken(`${command.sessionId}:${approvedPreviewRef}:${version}`)}` as SpecVersionId;
  const title = approvedPreview.title;
  const sections = approvedPreview.sections;
  const livingSpecProjection = createLivingSpecProjection(command, version, title, sections, "approved");
  const currentSpec = {
    ...state.currentSpec,
    versionRef,
    title,
    sections
  };
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      currentSpec,
      livingSpecProjection
    },
    version
  );
  const event = eventDraft(command, "SpecVersionCreated", {
    versionRef,
    approvedPreviewRef,
    title,
    sections,
    projection: livingSpecProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      currentSpec,
      livingSpecProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: versionRef,
        payload: {
          approvedPreviewRef,
          sectionCount: sections.length
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [],
    livingSpecProjection
  );
}

function reduceScoreCompleteness(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("ScoreCompleteness requires an initial spec draft.");
  }

  const version = projectionVersionFor(state);
  const confidenceProjection = buildConfidenceCompletionProjection(state, version);
  const candidateRequested = command.payload.candidateRequested === true;

  if (candidateRequested && confidenceProjection.completionCandidate.status !== "candidate") {
    return reject(
      `Completion candidate gates failed: ${confidenceProjection.completionCandidate.gateFailures.join("; ")}`,
      "COMMAND_PRECONDITION_FAILED",
      {
        axes: confidenceProjection.axes,
        gates: confidenceProjection.gates,
        topRisks: confidenceProjection.topRisks,
        topRiskCards: confidenceProjection.topRiskCards,
        completionCandidate: confidenceProjection.completionCandidate
      }
    );
  }

  const queueProjection = queueProjectionWithCompletionCandidate(
    state.queueProjection,
    confidenceProjection,
    version,
    command.issuedAt
  );
  const event = eventDraft(command, "CompletenessScored", {
    projection: confidenceProjection,
    queueProjection,
    compositeScore: confidenceProjection.compositeScore,
    readinessLabel: confidenceProjection.readinessLabel,
    candidateStatus: confidenceProjection.completionCandidate.status
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      completeness: confidenceProjection,
      queueProjection,
      session:
        confidenceProjection.completionCandidate.status === "candidate"
          ? {
              ...state.session,
              phase: "completion" as const
            }
          : state.session
    },
    completenessDeterministicOutputs(command, confidenceProjection),
    [],
    confidenceProjection
  );
}

function reducePrepareFounderBrief(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("PrepareFounderBrief requires an initial spec draft.");
  }

  const confirmedMode = requireConfirmedProjectPurposeMode(state, "PrepareFounderBrief");
  if (typeof confirmedMode !== "string") {
    return confirmedMode;
  }

  if (command.payload.requestedFormat !== undefined && command.payload.requestedFormat !== "markdown") {
    return reject("PrepareFounderBrief requestedFormat must be markdown.", "VALIDATION_FAILED");
  }

  if (
    command.payload.fileWriteRequested === true ||
    command.payload.writeFile === true ||
    command.payload.externalExportRequested === true ||
    typeof command.payload.destinationPath === "string" ||
    typeof command.payload.exportUrl === "string"
  ) {
    return reject(
      "PrepareFounderBrief can prepare export metadata only; file and external export side effects are blocked in Phase 1.",
      "RUNTIME_ACTION_BLOCKED"
    );
  }

  const version = projectionVersionFor(state);
  const confidenceProjection = buildConfidenceCompletionProjection(state, version);
  const founderBrief = buildFounderBriefProjection(state, confidenceProjection, version, command.issuedAt);
  const event = eventDraft(command, "FounderBriefPrepared", {
    projection: founderBrief,
    confidenceProjection,
    exportReady: founderBrief.exportReady,
    exportMetadata: founderBrief.exportMetadata
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      completeness: confidenceProjection,
      founderBrief,
      session: founderBrief.exportReady
        ? {
            ...state.session,
            phase: "completion" as const
          }
        : state.session
    },
    [
      {
        outputType: "founder_brief_draft",
        outputRef: `founder_brief:${command.sessionId}:${version}`,
        payload: {
          exportReady: founderBrief.exportReady,
          exportMetadata: founderBrief.exportMetadata
        }
      }
    ],
    [],
    founderBrief
  );
}

export function reduceProductEngineCommand(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (command.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    return reject("Unsupported ProductEngine command schema version.", "VALIDATION_FAILED");
  }

  if (command.expectedStateVersion !== state.stateVersion) {
    return reject("Command expectedStateVersion does not match the loaded ProductEngine state.", "STATE_VERSION_CONFLICT");
  }

  switch (command.commandType) {
    case "StartProject":
      return reduceStartProject(command, state);
    case "ChangeProjectPurposeMode":
      return reduceChangeProjectPurposeMode(command, state);
    case "ChangeBusinessCriticIntensity":
      return reduceChangeBusinessCriticIntensity(command, state);
    case "CaptureIntake":
      return reduceCaptureIntake(command, state);
    case "DraftInitialSpec":
      return reduceDraftInitialSpec(command, state);
    case "AnalyzeAmbiguity":
      return reduceAnalyzeAmbiguity(command, state);
    case "ActivateQuestionBatch":
      return reduceActivateQuestionBatch(command, state);
    case "DeferQueueItem":
      return reduceDeferQueueItem(command, state);
    case "DismissQueueItem":
      return reduceDismissQueueItem(command, state);
    case "SubmitAnswer":
      return reduceSubmitAnswer(command, state);
    case "PlanResearch":
      return reducePlanResearch(command, state);
    case "ImportResearchResult":
      return reduceImportResearchResult(command, state);
    case "SynthesizeEvidence":
      return reduceSynthesizeEvidence(command, state);
    case "ResolveResearchQueueCard":
      return reduceResolveResearchQueueCard(command, state);
    case "CreateRuntimePreview":
      return reduceCreateRuntimePreview(command, state);
    case "ConvertRuntimeArtifact":
      return reduceConvertRuntimeArtifact(command, state);
    case "CreateSpecUpdatePreview":
      return reduceCreateSpecUpdatePreview(command, state);
    case "ResolveDecision":
      return reduceResolveDecision(command, state);
    case "CreateSpecVersion":
      return reduceCreateSpecVersion(command, state);
    case "ScoreCompleteness":
      return reduceScoreCompleteness(command, state);
    case "PrepareFounderBrief":
      return reducePrepareFounderBrief(command, state);
    case "CreatePlanningHandoff":
      return reduceCreatePlanningHandoff(command, state);
    case "CreatePhase25ResearchComparison":
      return reduceCreatePhase25ResearchComparison(command, state);
    case "CreateExecutionAuthority":
      return reduceCreateExecutionAuthority(command, state);
    case "CreateChatGptBrowserDelegationRun":
      return reduceCreateChatGptBrowserDelegationRun(command, state);
    case "RevokeChatGptBrowserDelegationRun":
      return reduceRevokeChatGptBrowserDelegationRun(command, state);
    case "CreateServicePageUsePermission":
      return reduceCreateServicePageUsePermission(command, state);
    case "RevokeServicePageUsePermission":
      return reduceRevokeServicePageUsePermission(command, state);
    case "DeleteServicePageUsePermissionArtifacts":
      return reduceDeleteServicePageUsePermissionArtifacts(command, state);
    case "RecordImplementationStepLedger":
      return reduceRecordImplementationStepLedger(command, state);
    default:
      return reject(`${command.commandType} is outside the mounted PR-09 reducer slice.`);
  }
}

function applyEvent(state: ProductEngineStateSnapshot, event: ProductEngineEvent): ProductEngineStateSnapshot {
  const nextStateVersion = event.sequence as StateVersion;

  switch (event.eventType) {
    case "ProjectStarted": {
      const rawIdeaText = typeof event.payload.rawIdea === "string" ? event.payload.rawIdea : undefined;
      const projection = projectionPayload(event.payload, state.sessionShellProjection);
      const phase = sessionPhaseForProductEngineEvent(event) ?? "intake";
      const mode = isProjectPurposeMode(event.payload.projectPurposeMode)
        ? event.payload.projectPurposeMode
        : undefined;
      const audit =
        Array.isArray(event.payload.projectPurposeModeAudit) && mode
          ? (event.payload.projectPurposeModeAudit as ProductEngineStateSnapshot["project"]["projectPurposeModeAudit"])
          : mode
            ? [
              {
                newMode: mode,
                reason: purposeModeReason(
                  mode,
                  typeof event.payload.projectPurposeModeReason === "string"
                    ? event.payload.projectPurposeModeReason
                    : undefined
                ),
                actor: "user" as const,
                changedAt: event.occurredAt,
                ...(isProjectPurposeMode(event.payload.suggestedProjectPurposeMode)
                  ? { suggestedMode: event.payload.suggestedProjectPurposeMode }
                  : {})
              }
            ]
            : [];
      const projectPurposeModeReason =
        typeof event.payload.projectPurposeModeReason === "string"
          ? event.payload.projectPurposeModeReason
          : (mode
              ? (audit[0]?.reason ?? purposeModeReason(mode))
              : "Project purpose mode selection is required before mode-specific gates run.");
      const businessCriticIntensity = isBusinessCriticIntensity(event.payload.businessCriticIntensity)
        ? event.payload.businessCriticIntensity
        : undefined;
      const initialResearchAutomationPermission = isResearchAutomationPermission(
        event.payload.initialResearchAutomationPermission
      )
        ? event.payload.initialResearchAutomationPermission
        : undefined;
      const businessCriticIntensityAudit = Array.isArray(event.payload.businessCriticIntensityAudit)
        ? (event.payload.businessCriticIntensityAudit as ProductEngineStateSnapshot["project"]["businessCriticIntensityAudit"])
        : [];

      return {
        ...state,
        stateVersion: nextStateVersion,
        project: {
          projectId: event.projectId,
          privacyMode: isPrivacyMode(event.payload.localPrivacyMode) ? event.payload.localPrivacyMode : "local_only",
          ...(mode ? { projectPurposeMode: mode } : {}),
          projectPurposeModeSelectionStatus: projectPurposeModeSelectionStatus(mode),
          projectPurposeModeLabel: projectPurposeModeLabel(mode),
          projectPurposeModeReason,
          projectPurposeModeAudit: audit,
          ...businessCriticProjectFields(mode, businessCriticIntensity),
          ...(typeof event.payload.businessCriticIntensityReason === "string"
            ? { businessCriticIntensityReason: event.payload.businessCriticIntensityReason }
            : {}),
          businessCriticIntensityAudit,
          ...(initialResearchAutomationPermission ? { initialResearchAutomationPermission } : {}),
          ...(rawIdeaText ? { rawIdeaText } : {})
        },
        session: {
          sessionId: event.sessionId,
          phase
        },
        ...(projection ? { sessionShellProjection: projection } : {})
      };
    }
    case "ProjectPurposeModeChanged": {
      const newMode = isProjectPurposeMode(event.payload.newMode) ? event.payload.newMode : state.project.projectPurposeMode;
      if (!newMode) {
        return {
          ...state,
          stateVersion: nextStateVersion
        };
      }
      const reason =
        typeof event.payload.reason === "string"
          ? event.payload.reason
          : purposeModeReason(newMode, state.project.projectPurposeModeReason);
      const actor: ProjectPurposeModeAuditActor =
        event.payload.actor === "product_engine" || event.payload.actor === "system" ? event.payload.actor : "user";
      const auditEntry: ProjectPurposeModeAuditSnapshot = {
        newMode,
        reason,
        actor,
        changedAt: typeof event.payload.changedAt === "string" ? event.payload.changedAt : event.occurredAt,
        ...(state.project.projectPurposeMode ? { previousMode: state.project.projectPurposeMode } : {}),
        ...(isProjectPurposeMode(event.payload.suggestedProjectPurposeMode)
          ? { suggestedMode: event.payload.suggestedProjectPurposeMode }
          : {})
      };
      const projection = projectionPayload(event.payload, state.sessionShellProjection);
      const queueProjection = queueProjectionPayload(event.payload);
      const retainedBusinessCriticIntensity =
        newMode === "business" ? state.project.businessCriticIntensity : undefined;

      return {
        ...state,
        stateVersion: nextStateVersion,
        project: {
          ...state.project,
          projectPurposeMode: newMode,
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: projectPurposeModeLabel(newMode),
          projectPurposeModeReason: reason,
          projectPurposeModeAudit: [...state.project.projectPurposeModeAudit, auditEntry],
          ...businessCriticProjectFields(newMode, retainedBusinessCriticIntensity),
          businessCriticIntensity: retainedBusinessCriticIntensity,
          ...(newMode !== "business"
            ? {
                businessCriticIntensityLabel: undefined,
                businessCriticIntensityEffect: undefined
              }
            : {}),
          businessCriticIntensityReason:
            retainedBusinessCriticIntensity && state.project.businessCriticIntensityReason
              ? state.project.businessCriticIntensityReason
              : undefined,
          businessCriticIntensityAudit: newMode === "business" ? (state.project.businessCriticIntensityAudit ?? []) : []
        },
        ...(queueProjection ? { queueProjection } : {}),
        ...(projection ? { sessionShellProjection: projection } : {})
      };
    }
    case "BusinessCriticIntensityChanged": {
      const newIntensity = isBusinessCriticIntensity(event.payload.newIntensity)
        ? event.payload.newIntensity
        : state.project.businessCriticIntensity;
      if (!newIntensity) {
        return {
          ...state,
          stateVersion: nextStateVersion
        };
      }
      const reason = typeof event.payload.reason === "string" ? event.payload.reason : businessCriticIntensityEffect(newIntensity);
      const actor: ProjectPurposeModeAuditActor =
        event.payload.actor === "product_engine" || event.payload.actor === "system" ? event.payload.actor : "user";
      const auditEntry: BusinessCriticIntensityAuditSnapshot = {
        newIntensity,
        reason,
        actor,
        changedAt: typeof event.payload.changedAt === "string" ? event.payload.changedAt : event.occurredAt,
        ...(state.project.businessCriticIntensity ? { previousIntensity: state.project.businessCriticIntensity } : {})
      };
      const projection = projectionPayload(event.payload, state.sessionShellProjection);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const newPressureIssues = Array.isArray(event.payload.newPressureIssues)
        ? (event.payload.newPressureIssues as readonly AmbiguityIssueSnapshot[])
        : [];
      const replayedOpenIssues = Array.isArray(event.payload.openIssues)
        ? (event.payload.openIssues as readonly AmbiguityIssueSnapshot[])
        : [
            ...retainedIssuesForBusinessCriticIntensity(state.openIssues, state.queueProjection.active, newIntensity),
            ...newPressureIssues.filter(
              (issue) => !state.openIssues.some((existingIssue) => existingIssue.queueItemId === issue.queueItemId)
            )
          ];

      return {
        ...state,
        stateVersion: nextStateVersion,
        project: {
          ...state.project,
          ...businessCriticProjectFields("business", newIntensity),
          businessCriticIntensity: newIntensity,
          businessCriticIntensityReason: reason,
          businessCriticIntensityAudit: [...(state.project.businessCriticIntensityAudit ?? []), auditEntry]
        },
        openIssues: replayedOpenIssues,
        queueProjection,
        completeness: confidenceProjection,
        ...(projection ? { sessionShellProjection: projection } : {})
      };
    }
    case "IntakeCaptured":
      return {
        ...state,
        stateVersion: nextStateVersion,
        intake: {
          intakeRef: typeof event.payload.intakeRef === "string" ? event.payload.intakeRef : "intake_unknown",
          answer: typeof event.payload.answer === "string" ? event.payload.answer : ""
        }
      };
    case "InitialSpecDrafted": {
      const projection = projectionPayload(event.payload, state.livingSpecProjection);
      const title = typeof event.payload.title === "string" ? event.payload.title : state.currentSpec.title;
      const sections = Array.isArray(event.payload.sections)
        ? event.payload.sections.map(String)
        : state.currentSpec.sections;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        currentSpec: {
          draftRef: typeof event.payload.draftRef === "string" ? event.payload.draftRef : state.currentSpec.draftRef,
          ...(title ? { title } : {}),
          ...(sections ? { sections } : {})
        },
        session: {
          ...state.session,
          phase
        },
        ...(projection ? { livingSpecProjection: projection } : {})
      };
    }
    case "AmbiguityAnalyzed": {
      const issues = Array.isArray(event.payload.issues)
        ? (event.payload.issues as readonly AmbiguityIssueSnapshot[])
        : state.openIssues;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: issues
      };
    }
    case "QuestionBatchActivated": {
      const projection = projectionPayload(event.payload, state.queueProjection);
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        queueProjection: projection
      };
    }
    case "AnswerSubmitted": {
      const projection = projectionPayload(event.payload, state.queueProjection);
      const queueItemId = typeof event.payload.queueItemId === "string" ? event.payload.queueItemId : null;
      const followUpIssue = objectPayload<AmbiguityIssueSnapshot>(event.payload, "followUpIssue");
      const followUpIssues = Array.isArray(event.payload.followUpIssues)
        ? (event.payload.followUpIssues.filter((issue) =>
            typeof issue === "object" && issue !== null
          ) as AmbiguityIssueSnapshot[])
        : followUpIssue
          ? [followUpIssue]
          : [];
      const openIssues = queueItemId
        ? state.openIssues.map((issue) =>
            issue.queueItemId === queueItemId
              ? {
                  ...issue,
                  status: "answered" as const
                }
              : issue
          )
        : state.openIssues;
      const openIssuesWithFollowUp = appendUniqueOpenIssues(openIssues, followUpIssues);

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: openIssuesWithFollowUp,
        queueProjection: projection
      };
    }
    case "QueueItemDeferred": {
      const queueItemId = typeof event.payload.queueItemId === "string" ? (event.payload.queueItemId as QueueItemId) : null;
      const projection = projectionPayload(event.payload, state.queueProjection);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const nextValidationAction =
        typeof event.payload.nextValidationAction === "string" ? event.payload.nextValidationAction : undefined;
      const knownRiskPatch =
        (event.payload.knownRiskAccepted === true ||
          event.payload.riskDisposition === "known_risk_next_validation_action") &&
        nextValidationAction
          ? { knownRiskAccepted: true, nextValidationAction }
          : {};

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? issuesWithQueueItemStatus(state.openIssues, queueItemId, "deferred", knownRiskPatch)
          : state.openIssues,
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "QueueItemDismissed": {
      const queueItemId = typeof event.payload.queueItemId === "string" ? (event.payload.queueItemId as QueueItemId) : null;
      const projection = projectionPayload(event.payload, state.queueProjection);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? issuesWithQueueItemStatus(state.openIssues, queueItemId, "resolved")
          : state.openIssues,
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "SpecUpdatePreviewCreated": {
      const projection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const decision = objectPayload<ProductEngineStateSnapshot["decisions"][number]>(event.payload, "decision");
      const specUpdatePreview = objectPayload<SpecUpdatePreviewSnapshot>(event.payload, "specUpdatePreview");
      const decisions =
        decision && isRequiredDecisionRef(decision.requiredDecisionRef)
          ? mergeDecision(state.decisions, decision)
          : state.decisions;
      const specUpdatePreviews = specUpdatePreview
        ? mergeSpecUpdatePreview(state.specUpdatePreviews ?? [], specUpdatePreview)
        : state.specUpdatePreviews;
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            decisions,
            queueProjection: projection
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        decisions,
        ...(specUpdatePreviews ? { specUpdatePreviews } : {}),
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "DecisionResolved": {
      const decisionId = typeof event.payload.decisionId === "string" ? (event.payload.decisionId as DecisionId) : null;
      const outcome = isDecisionResolutionStatus(event.payload.outcome) ? event.payload.outcome : null;
      const requiredDecisionRef = isRequiredDecisionRef(event.payload.requiredDecisionRef)
        ? event.payload.requiredDecisionRef
        : null;
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const decisions =
        decisionId && outcome && requiredDecisionRef
          ? state.decisions.some((decision) => decision.decisionId === decisionId)
            ? state.decisions.map((decision) =>
                decision.decisionId === decisionId
                  ? {
                      ...decision,
                      status: outcome
                    }
                  : decision
              )
            : [
                ...state.decisions,
                {
                  decisionId,
                  requiredDecisionRef,
                  status: outcome
                }
              ]
          : state.decisions;
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            decisions,
            queueProjection
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        decisions,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "SpecVersionCreated": {
      const projection = projectionPayload<LivingSpecProjection | undefined>(
        event.payload,
        state.livingSpecProjection
      );
      const title =
        typeof event.payload.title === "string"
          ? event.payload.title
          : projection?.title ?? state.currentSpec.title;
      const sections = Array.isArray(event.payload.sections)
        ? event.payload.sections.map(String)
        : projection?.sections ?? state.currentSpec.sections;
      const versionRef =
        typeof event.payload.versionRef === "string" ? event.payload.versionRef : state.currentSpec.versionRef;
      const currentSpec = {
        ...state.currentSpec,
        ...(versionRef ? { versionRef } : {}),
        ...(title ? { title } : {}),
        ...(sections ? { sections } : {})
      };
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            currentSpec,
            ...(projection ? { livingSpecProjection: projection } : {})
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        currentSpec,
        ...(projection ? { livingSpecProjection: projection } : {}),
        completeness: confidenceProjection
      };
    }
    case "ResearchPlanned": {
      const projection = projectionPayload(event.payload, state.researchState);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;
      const researchTask = objectPayload<ResearchTaskProjection>(event.payload, "researchTask");
      const eventMode = isProjectPurposeMode(researchTask?.projectPurposeMode)
        ? researchTask.projectPurposeMode
        : undefined;
      const project =
        !state.project.projectPurposeMode && eventMode
          ? {
              ...state.project,
              projectPurposeMode: eventMode,
              projectPurposeModeSelectionStatus: "confirmed" as const,
              projectPurposeModeLabel: projectPurposeModeLabel(eventMode),
              projectPurposeModeReason:
                "Project purpose mode was recovered from a replayed ResearchPlanned event generated after user confirmation."
            }
          : state.project;

      return {
        ...state,
        stateVersion: nextStateVersion,
        project,
        session: {
          ...state.session,
          phase
        },
        researchState: projection,
        completeness: confidenceProjection
      };
    }
    case "ResearchResultImported":
      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: projectionPayload(event.payload, state.researchState)
      };
    case "EvidenceSynthesisRequested":
      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase: sessionPhaseForProductEngineEvent(event) ?? state.session.phase
        }
      };
    case "EvidenceSynthesized": {
      const researchProjection = projectionPayload(event.payload, state.researchState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const researchFollowUpIssues = Array.isArray(event.payload.researchFollowUpIssues)
        ? (event.payload.researchFollowUpIssues as readonly AmbiguityIssueSnapshot[])
        : [];

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: appendUniqueOpenIssues(state.openIssues, researchFollowUpIssues),
        researchState: researchProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "ResearchQueueCardResolved": {
      const researchProjection = projectionPayload(event.payload, state.researchState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: researchProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "RuntimePreviewRequested": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "RuntimeArtifactConverted": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "CompletenessScored": {
      const completeness = projectionPayload(event.payload, state.completeness);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        completeness,
        queueProjection
      };
    }
    case "FounderBriefPrepared": {
      const founderBrief = projectionPayload(event.payload, state.founderBrief);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        completeness: confidenceProjection,
        ...(founderBrief ? { founderBrief: founderBrief as FounderBriefProjection } : {})
      };
    }
    case "PlanningHandoffCreated":
    case "PlanningHandoffBlocked": {
      const planningHandoff = projectionPayload(event.payload, state.planningHandoff);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(planningHandoff ? { planningHandoff } : {})
      };
    }
    case "Phase25ResearchComparisonCreated":
    case "Phase25ResearchComparisonBlocked": {
      const phase25ResearchComparison = projectionPayload(event.payload, state.phase25ResearchComparison);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(phase25ResearchComparison ? { phase25ResearchComparison } : {})
      };
    }
    case "ExecutionAuthorityRecorded":
    case "ExecutionAuthorityBlocked": {
      const executionAuthorityLedger = projectionPayload(event.payload, state.executionAuthorityLedger);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(executionAuthorityLedger ? { executionAuthorityLedger } : {})
      };
    }
    case "ChatGptBrowserDelegationRunRecorded":
    case "ChatGptBrowserDelegationRunBlocked":
    case "ChatGptBrowserDelegationRunFailed":
    case "ChatGptBrowserDelegationRunRevoked": {
      const chatGptBrowserDelegation = projectionPayload(event.payload, state.chatGptBrowserDelegation);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(chatGptBrowserDelegation ? { chatGptBrowserDelegation } : {})
      };
    }
    case "ServicePagePermissionGranted":
    case "ServicePagePermissionRevoked":
    case "ServicePageArtifactsDeleted":
    case "ServicePageActionBlocked":
    case "ServicePageFinalSubmitRequested": {
      const servicePageUsePermission = projectionPayload(event.payload, state.servicePageUsePermission);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(servicePageUsePermission ? { servicePageUsePermission } : {})
      };
    }
    case "ImplementationStepLedgerRecorded":
    case "ImplementationStepBlocked":
    case "ImplementationStepCompleted": {
      const implementationStepLedger = projectionPayload(event.payload, state.implementationStepLedger);

      return {
        ...state,
        stateVersion: nextStateVersion,
        ...(implementationStepLedger ? { implementationStepLedger } : {})
      };
    }
    default:
      return {
        ...state,
        stateVersion: nextStateVersion
      };
  }
}

export function replayProductEngineEvents(
  projectId: ProjectId,
  sessionId: SessionId,
  events: readonly ProductEngineEvent[]
): ProductEngineStateSnapshot {
  return events.reduce(
    (state, event) => applyEvent(state, event),
    createInitialProductEngineState(projectId, sessionId)
  );
}
