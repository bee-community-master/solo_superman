import {
  BUSINESS_CRITIC_INTENSITY_LABELS,
  PROJECT_PURPOSE_MODE_LABELS,
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
}

export const DEFAULT_IDEA = "A focused founder brief generator";
export const DEFAULT_INTAKE =
  "Help solo founders turn a rough idea into a traceable product spec before they start building.";

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

export type DecisionQueuePageId = "questions" | "research" | "planning" | "implementation" | "permissions";
export type PageHealth = "done" | "active" | "pending" | "blocked";

export interface PageMeta {
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly description: string;
}

export const PAGE_META: Record<DecisionQueuePageId, PageMeta> = {
  questions: {
    label: "질문 큐",
    shortLabel: "Q",
    title: "Decision Queue",
    description: "사업 목적, 리서치 필요성, 알려진 리스크를 한 화면에서 처리합니다."
  },
  research: {
    label: "리서치",
    shortLabel: "R",
    title: "Research Evidence",
    description: "허용된 public-safe 리서치 실행과 수동 근거 import를 관리합니다."
  },
  planning: {
    label: "기획",
    shortLabel: "P",
    title: "Planning Readiness",
    description: "Spec, completeness score, Founder Brief, handoff gate를 확인합니다."
  },
  implementation: {
    label: "구현",
    shortLabel: "I",
    title: "Implementation Runtime",
    description: "런타임 activity와 implementation ledger를 한 흐름으로 추적합니다."
  },
  permissions: {
    label: "권한",
    shortLabel: "A",
    title: "Delegation & Permissions",
    description: "외부 브라우저 위임과 service page-use 권한을 별도 audit 흐름으로 관리합니다."
  }
};

export function displayError(error: unknown) {
  if (error instanceof SidecarClientError) {
    return `${error.apiError.code}: ${error.apiError.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown sidecar error.";
}

export function latestProjectionVersion(projections: ProjectionState) {
  return Math.max(
    Number(projections.session?.version ?? 0),
    Number(projections.spec?.version ?? 0),
    Number(projections.queue?.version ?? 0),
    Number(projections.research?.version ?? 0),
    Number(projections.activity?.version ?? 0),
    Number(projections.confidence?.version ?? 0),
    Number(projections.founderBrief?.version ?? 0),
    Number(projections.planningHandoff?.version ?? 0),
    Number(projections.chatGptDelegation?.version ?? 0),
    Number(projections.servicePageUsePermission?.version ?? 0),
    Number(projections.implementationStepLedger?.version ?? 0)
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
    implementationStepLedger: null
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
