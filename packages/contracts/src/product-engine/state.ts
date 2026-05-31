import type {
  ConfidenceCompletionProjection,
  ChatGptBrowserDelegationProjection,
  DecisionQueueProjection,
  ExecutionAuthorityLedgerProjection,
  ImplementationStepLedgerProjection,
  FounderBriefProjection,
  LivingSpecProjection,
  Phase25ResearchComparisonProjection,
  PlanningHandoffProjection,
  ResearchEvidenceProjection,
  RuntimeActivityProjection,
  ServicePageUsePermissionProjection,
  SessionShellProjection
} from "../projections";
import type { DecisionId, ProjectId, QueueItemId, SessionId, StateVersion } from "../ids";

export const PROJECT_PURPOSE_MODES = ["business", "personal"] as const;
export type ProjectPurposeMode = (typeof PROJECT_PURPOSE_MODES)[number];
export type ProjectPurposeModeSelectionStatus = "mode_required" | "confirmed";

export const BUSINESS_CRITIC_INTENSITIES = ["balanced", "strong", "investor_grade"] as const;
export type BusinessCriticIntensity = (typeof BUSINESS_CRITIC_INTENSITIES)[number];
export type BusinessCriticIntensitySelectionStatus = "not_applicable" | "intensity_required" | "confirmed";

export const RESEARCH_AUTOMATION_PERMISSIONS = [
  "manual_only",
  "allow_codex",
  "allow_codex_and_chatgpt_visible"
] as const;
export type ResearchAutomationPermission = (typeof RESEARCH_AUTOMATION_PERMISSIONS)[number];

export const BUSINESS_CRITIC_INTENSITY_LABELS = {
  balanced: "균형형 사업 검증",
  strong: "강한 사업 검증",
  investor_grade: "투자심사급 사업 검증"
} as const satisfies Record<BusinessCriticIntensity, string>;

export const BUSINESS_CRITIC_INTENSITY_EFFECTS = {
  balanced: "주요 decision group마다 최소 1개의 반대/비판 질문을 유지합니다.",
  strong: "high-impact business gap이 있으면 active batch마다 핵심 가설 반박 질문을 queued_next로 유지합니다.",
  investor_grade: "가격, 채널, retention proxy, 법무/운영, 시장 타이밍, founder advantage pressure pass를 요구합니다."
} as const satisfies Record<BusinessCriticIntensity, string>;

export const BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL = "상업성 검증 강도 선택 필요";

export const BUSINESS_CRITICAL_QUESTION_CATEGORIES = [
  "customer_pain",
  "paid_intent",
  "alternatives",
  "pricing",
  "acquisition",
  "mvp_validation",
  "legal_ops_security",
  "retention_proxy",
  "market_timing",
  "founder_advantage"
] as const;
export type BusinessCriticalQuestionCategory = (typeof BUSINESS_CRITICAL_QUESTION_CATEGORIES)[number];

export type BusinessCriticPressureKind = "balanced_con" | "core_assumption_challenge" | "investor_pressure_pass";

export const PROJECT_PURPOSE_MODE_LABELS = {
  business: "사업화 검증 중심",
  personal: "개인 workflow 구현 중심"
} as const satisfies Record<ProjectPurposeMode, string>;

export const PROJECT_PURPOSE_MODE_REQUIRED_LABEL = "프로젝트 목적 선택 필요";

export const PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES = {
  business: [] as readonly string[],
  personal: [
    "market_size",
    "investor_narrative",
    "willingness_to_pay",
    "acquisition_channel",
    "competition_pressure"
  ] as readonly string[]
} as const satisfies Record<ProjectPurposeMode, readonly string[]>;

export type ProjectPurposeModeAuditActor = "user" | "product_engine" | "system";

export interface ProjectPurposeModeAuditSnapshot {
  readonly previousMode?: ProjectPurposeMode;
  readonly newMode: ProjectPurposeMode;
  readonly reason: string;
  readonly actor: ProjectPurposeModeAuditActor;
  readonly changedAt: string;
  readonly suggestedMode?: ProjectPurposeMode;
}

export interface BusinessCriticIntensityAuditSnapshot {
  readonly previousIntensity?: BusinessCriticIntensity;
  readonly newIntensity: BusinessCriticIntensity;
  readonly reason: string;
  readonly actor: ProjectPurposeModeAuditActor;
  readonly changedAt: string;
}

export interface ProjectSnapshot {
  readonly projectId: ProjectId;
  readonly privacyMode: "local_only" | "local_with_manual_export";
  readonly projectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeSelectionStatus?: ProjectPurposeModeSelectionStatus;
  readonly projectPurposeModeLabel: string;
  readonly projectPurposeModeReason?: string;
  readonly projectPurposeModeAudit: readonly ProjectPurposeModeAuditSnapshot[];
  readonly businessCriticIntensity?: BusinessCriticIntensity | undefined;
  readonly businessCriticIntensitySelectionStatus?: BusinessCriticIntensitySelectionStatus | undefined;
  readonly businessCriticIntensityLabel?: string | undefined;
  readonly businessCriticIntensityEffect?: string | undefined;
  readonly businessCriticIntensityReason?: string | undefined;
  readonly businessCriticIntensityAudit?: readonly BusinessCriticIntensityAuditSnapshot[] | undefined;
  readonly initialResearchAutomationPermission?: ResearchAutomationPermission | undefined;
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

export const CANONICAL_INITIAL_SPEC_SECTIONS = [
  "Problem",
  "Target Customer",
  "JTBD / Use Case",
  "Current Alternatives",
  "Value Proposition",
  "Differentiation",
  "MVP Scope",
  "Non-goals",
  "Validation Plan",
  "Success Criteria",
  "Evidence Status",
  "Known Risks / Open Questions"
] as const;

export type AmbiguityIssueUncertaintyType =
  | "missing"
  | "vague"
  | "unsupported"
  | "conflict"
  | "decision_required"
  | "missing_con_evidence";

export type AmbiguityIssueSeverity = "high" | "medium" | "low";

export type AmbiguityExpectedAnswerType = "choice" | "text" | "rank" | "evidence" | "experiment";
export type AmbiguityAnswerSelectionMode = "single" | "multiple" | "ranked";

export type AmbiguityPossibleRoute =
  | "question"
  | "research_needed"
  | "missing_con_evidence"
  | "decision_candidate"
  | "spec_update_candidate"
  | "conflict_detected"
  | "deferred"
  | "repeat_limit_reached";

export const AMBIGUITY_REDUCTION_DIMENSIONS = [
  "goal",
  "scope",
  "constraints",
  "success_criteria",
  "context",
  "decision_authority",
  "assumption_pressure"
] as const;
export type AmbiguityReductionDimension = (typeof AMBIGUITY_REDUCTION_DIMENSIONS)[number];

export const AMBIGUITY_ROUTING_PATHS = [
  "human_judgment",
  "existing_fact_check",
  "current_research"
] as const;
export type AmbiguityRoutingPath = (typeof AMBIGUITY_ROUTING_PATHS)[number];

export interface AmbiguityAnswerOption {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly primaryDetail?: string;
  readonly secondaryDetail?: string;
  readonly pro: string;
  readonly con: string;
}

export interface AmbiguityQuestionContextSnapshot {
  readonly idea?: string;
  readonly goal?: string;
}

export interface AmbiguityIssueSnapshot {
  readonly queueItemId: QueueItemId;
  readonly sectionRef?: string;
  readonly topicKey?: string;
  readonly purposeModeAxis?: string;
  readonly purposeModeEffect?: string;
  readonly businessCriticCategory?: BusinessCriticalQuestionCategory;
  readonly businessCriticIntensityMinimum?: BusinessCriticIntensity;
  readonly businessCriticPressureKind?: BusinessCriticPressureKind;
  readonly businessCriticRepeatGroup?: string;
  readonly knownRiskAccepted?: boolean;
  readonly nextValidationAction?: string;
  readonly uncertaintyType?: AmbiguityIssueUncertaintyType;
  readonly severity?: AmbiguityIssueSeverity;
  readonly summary: string;
  readonly whyItMatters?: string;
  readonly status: "open" | "answered" | "deferred" | "resolved";
  readonly questionText?: string;
  readonly expectedAnswerType?: AmbiguityExpectedAnswerType;
  readonly answerSelectionMode?: AmbiguityAnswerSelectionMode;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
  readonly decisionItUnlocks?: string;
  readonly ambiguityDimension?: AmbiguityReductionDimension;
  readonly ambiguityRoutingPath?: AmbiguityRoutingPath;
  readonly researchQuestion?: string;
  readonly suggestedResearchTask?: string;
  readonly repeatCount?: number;
  readonly repeatLimit?: number;
  readonly possibleRoutes?: readonly AmbiguityPossibleRoute[];
  readonly sourceRef?: string;
  readonly questionContext?: AmbiguityQuestionContextSnapshot;
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
  readonly phase25ResearchComparison?: Phase25ResearchComparisonProjection;
  readonly executionAuthorityLedger?: ExecutionAuthorityLedgerProjection;
  readonly chatGptBrowserDelegation?: ChatGptBrowserDelegationProjection;
  readonly servicePageUsePermission?: ServicePageUsePermissionProjection;
  readonly implementationStepLedger?: ImplementationStepLedgerProjection;
}
