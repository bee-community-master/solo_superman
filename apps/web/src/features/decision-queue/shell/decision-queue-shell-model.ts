import {
  BUSINESS_CRITIC_INTENSITY_LABELS,
  PROJECT_PURPOSE_MODE_LABELS,
  type AutoImplementationRunProjection,
  type BusinessCriticIntensity,
  type ChatGptBrowserDelegationProjection,
  type CommandResponse,
  type ConfidenceCompletionProjection,
  type DecisionQueueProjection,
  type FounderBriefProjection,
  type ImplementationStepLedgerProjection,
  type LivingSpecProjection,
  type PlanningHandoffProjection,
  type ProjectPurposeMode,
  type ResearchAllowlistId,
  type ResearchEvidenceProjection,
  type ResearchRunControlResult,
  type RuntimeActivityProjection,
  type ServicePageUsePermissionProjection,
  type SessionShellProjection,
  type StateVersion,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { requiredCommandProjection } from "../../../shared/api/command-response-helpers";
import { SidecarClientError, type SidecarConnection } from "../../../shared/api/sidecar-client";

export type ConnectionState =
  | { readonly status: "connecting" }
  | { readonly status: "connected"; readonly connection: SidecarConnection }
  | { readonly status: "unavailable"; readonly message: string };

export type AppendCommand = <TProjection>(
  label: string,
  response: CommandResponse<TProjection>
) => Promise<CommandResponse<TProjection>>;

export interface CommandLogEntry {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly response?: CommandResponse;
  readonly status?: StatusEndpointDto;
  readonly message?: string;
  readonly error?: string;
}

export const COMMAND_LOG_LIMIT = 8;

export interface ProjectionState {
  readonly session: SessionShellProjection | null;
  readonly spec: LivingSpecProjection | null;
  readonly queue: DecisionQueueProjection | null;
  readonly research: ResearchEvidenceProjection | null;
  readonly activity: RuntimeActivityProjection | null;
  readonly confidence: ConfidenceCompletionProjection | null;
  readonly founderBrief: FounderBriefProjection | null;
  readonly planningHandoff: PlanningHandoffProjection | null;
  readonly chatGptDelegation: ChatGptBrowserDelegationProjection | null;
  readonly servicePageUsePermission: ServicePageUsePermissionProjection | null;
  readonly implementationStepLedger: ImplementationStepLedgerProjection | null;
  readonly autoImplementationRuns: AutoImplementationRunProjection | null;
}

export const DEFAULT_IDEA = "";
export const DEFAULT_INTAKE = "";

export const PROJECT_PURPOSE_MODE_OPTIONS = [
  {
    mode: "business" as ProjectPurposeMode,
    label: PROJECT_PURPOSE_MODE_LABELS.business,
    description: "고객, 문제 강도, 유료 의향, 경쟁, 채널, 법무/운영 리스크를 검증합니다."
  },
  {
    mode: "personal" as ProjectPurposeMode,
    label: PROJECT_PURPOSE_MODE_LABELS.personal,
    description: "시장/투자자 narrative 대신 개인 workflow, GUI, 구현 가능성, local data/security를 검증합니다."
  }
] as const;

export const BUSINESS_CRITIC_INTENSITY_OPTIONS = [
  {
    intensity: "balanced" as BusinessCriticIntensity,
    label: BUSINESS_CRITIC_INTENSITY_LABELS.balanced,
    description: "주요 decision group마다 최소 1개의 반대/비판 질문을 유지합니다."
  },
  {
    intensity: "strong" as BusinessCriticIntensity,
    label: BUSINESS_CRITIC_INTENSITY_LABELS.strong,
    description: "high-impact business gap이 있으면 핵심 가설 반박 질문을 queued_next로 유지합니다."
  },
  {
    intensity: "investor_grade" as BusinessCriticIntensity,
    label: BUSINESS_CRITIC_INTENSITY_LABELS.investor_grade,
    description: "가격, 채널, retention proxy, 법무/운영, 시장 타이밍, founder advantage를 압박 검증합니다."
  }
] as const;

export const WEB_PUBLIC_SAFE_ALLOWLIST_ID = "research_allowlist_web_public_safe" as ResearchAllowlistId;

export type InitialResearchPermission = "allow_public_web" | "not_now";

export type DecisionQueuePageId = "onboarding" | "questions" | "research" | "planning" | "implementation" | "permissions";
export type PageHealth = "done" | "active" | "pending" | "blocked";

export type ProjectionVersionSnapshot = {
  readonly [Key in keyof ProjectionState]: { readonly version?: unknown } | null;
};

export interface InitialQueueStartReadinessInput {
  readonly chatGptLoginAcknowledged: boolean;
  readonly codexLoginAuthenticated: boolean;
  readonly connectionStatus: ConnectionState["status"];
  readonly hasClient: boolean;
  readonly projectPurposeMode: ProjectPurposeMode | null;
  readonly businessCriticIntensity: BusinessCriticIntensity | null;
  readonly idea: string;
  readonly intake: string;
  readonly isBusy: boolean;
}

export type InitialQueueStartBlocker =
  | "busy"
  | "chatgpt_login"
  | "codex_login"
  | "sidecar_connection"
  | "project_purpose"
  | "business_critic_intensity"
  | "idea"
  | "intake";

export const INITIAL_QUEUE_START_BLOCKER_MESSAGES = {
  busy: "첫 질문 묶음을 이미 생성 중입니다.",
  chatgpt_login: "ChatGPT에 직접 로그인했다는 확인이 필요합니다.",
  codex_login: "로컬 Codex CLI 로그인이 확인되어야 backend 질문/리서치 준비를 시작할 수 있습니다.",
  sidecar_connection: "Local service is not connected.",
  project_purpose: "프로젝트 목적을 사업화 검증 중심 또는 개인 workflow 구현 중심 중 하나로 선택해야 합니다.",
  business_critic_intensity: "상업성 검증 강도를 선택해야 사업화 검증 큐를 확정할 수 있습니다.",
  idea: "아이디어 요약을 입력해야 합니다.",
  intake: "목표에 대한 서술을 입력해야 합니다."
} as const satisfies Record<InitialQueueStartBlocker, string>;

export function initialQueueStartBlocker({
  chatGptLoginAcknowledged,
  codexLoginAuthenticated,
  connectionStatus,
  hasClient,
  projectPurposeMode,
  businessCriticIntensity,
  idea,
  intake,
  isBusy
}: InitialQueueStartReadinessInput): InitialQueueStartBlocker | null {
  if (isBusy) {
    return "busy";
  }

  if (!chatGptLoginAcknowledged) {
    return "chatgpt_login";
  }

  if (connectionStatus !== "connected" || !hasClient) {
    return "sidecar_connection";
  }

  if (!codexLoginAuthenticated) {
    return "codex_login";
  }

  if (!projectPurposeMode) {
    return "project_purpose";
  }

  if (projectPurposeMode === "business" && !businessCriticIntensity) {
    return "business_critic_intensity";
  }

  if (!idea.trim()) {
    return "idea";
  }

  if (!intake.trim()) {
    return "intake";
  }

  return null;
}

export function canStartInitialQueueFlow(input: InitialQueueStartReadinessInput): boolean {
  return initialQueueStartBlocker(input) === null;
}

export function displayError(error: unknown) {
  if (error instanceof SidecarClientError) {
    return `${error.apiError.code}: ${error.apiError.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown local service error.";
}

const PROJECTION_VERSION_KEYS = [
  "session",
  "spec",
  "queue",
  "research",
  "activity",
  "confidence",
  "founderBrief",
  "planningHandoff",
  "chatGptDelegation",
  "servicePageUsePermission",
  "implementationStepLedger",
  "autoImplementationRuns"
] as const satisfies readonly (keyof ProjectionState)[];

export function latestProjectionVersion(projections: ProjectionVersionSnapshot) {
  return Math.max(
    ...PROJECTION_VERSION_KEYS.map((key) => Number(projections[key]?.version ?? 0))
  ) as StateVersion;
}

export function emptyProjectionState(): ProjectionState {
  return {
    session: null,
    spec: null,
    queue: null,
    research: null,
    activity: null,
    confidence: null,
    founderBrief: null,
    planningHandoff: null,
    chatGptDelegation: null,
    servicePageUsePermission: null,
    implementationStepLedger: null,
    autoImplementationRuns: null
  };
}

export function emptyResearchOperationsState(): ResearchOperationsState {
  return {
    allowlists: null,
    disclosures: null,
    runs: null
  };
}

export function researchRunProjectionFromResponse(response: CommandResponse<ResearchRunControlResult>) {
  return requiredCommandProjection<ResearchRunControlResult>(response, "ResearchRunControlResult").projection;
}

export function isBusinessCriticQueueItem(item: DecisionQueueProjection["active"][number]) {
  return Boolean(item.businessCriticCategory || item.businessCriticPressureKind);
}
