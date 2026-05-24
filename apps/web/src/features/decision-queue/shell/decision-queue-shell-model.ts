import {
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

export function initialQueueStartBlockerList({
  chatGptLoginAcknowledged,
  codexLoginAuthenticated,
  connectionStatus,
  hasClient,
  projectPurposeMode,
  businessCriticIntensity,
  idea,
  intake,
  isBusy
}: InitialQueueStartReadinessInput): readonly InitialQueueStartBlocker[] {
  if (isBusy) {
    return ["busy"];
  }

  const blockers: InitialQueueStartBlocker[] = [];

  if (!chatGptLoginAcknowledged) {
    blockers.push("chatgpt_login");
  }

  if (connectionStatus !== "connected" || !hasClient) {
    blockers.push("sidecar_connection");
  }

  if (!codexLoginAuthenticated) {
    blockers.push("codex_login");
  }

  if (!projectPurposeMode) {
    blockers.push("project_purpose");
  }

  if (projectPurposeMode === "business" && !businessCriticIntensity) {
    blockers.push("business_critic_intensity");
  }

  if (!idea.trim()) {
    blockers.push("idea");
  }

  if (!intake.trim()) {
    blockers.push("intake");
  }

  return blockers;
}

export function initialQueueStartBlocker(input: InitialQueueStartReadinessInput): InitialQueueStartBlocker | null {
  return initialQueueStartBlockerList(input)[0] ?? null;
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

export function latestCommandBackedProjectionVersion(projections: ProjectionVersionSnapshot) {
  return latestProjectionVersion({
    ...projections,
    autoImplementationRuns: null
  });
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
  const result = requiredCommandProjection<ResearchRunControlResult>(response, "ResearchRunControlResult");

  if (!result.projection || result.projection.kind !== "ResearchRunControlProjection") {
    throw new Error("ResearchRunControlProjection was not returned by the sidecar command.");
  }

  return result.projection;
}

export function isBusinessCriticQueueItem(item: DecisionQueueProjection["active"][number]) {
  return Boolean(item.businessCriticCategory || item.businessCriticPressureKind);
}
