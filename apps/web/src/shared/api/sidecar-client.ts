import type {
  ApiError,
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
  CommandResponse,
  CodexRuntimeStatusDto,
  BlockRuntimeArtifactRequest,
  CompletionCandidateRequest,
  ConfidenceCompletionProjection,
  ConvertRuntimeArtifactRequest,
  ChangeBusinessCriticIntensityRequest,
  ChangeProjectPurposeModeRequest,
  ChatGptBrowserDelegationProjection,
  ServicePageUsePermissionProjection,
  CreateManualHandoffRequest,
  CreateChatGptBrowserDelegationRunRequest,
  CreateServicePageUsePermissionRequest,
  CreatePlanningHandoffRequest,
  CreateResearchAllowlistRequest,
  CreateRuntimePreviewRequest,
  DecisionQueueProjection,
  DeferQueueItemRequest,
  DismissQueueItemRequest,
  FounderBriefProjection,
  ImportResearchResultRequest,
  ImplementationStepLedgerProjection,
  LivingSpecProjection,
  PlanResearchRequest,
  Phase15bUpgradeHintExportDto,
  Phase15bUpgradeHintProjection,
  PlanningHandoffProjection,
  PrepareResearchDisclosureRequest,
  PrepareFounderBriefRequest,
  ProjectId,
  RecordImplementationStepLedgerRequest,
  CancelResearchRunRequest,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchDisclosureLogProjection,
  ResearchDisclosurePreparationResult,
  ResearchEvidenceProjection,
  ResearchRunControlProjection,
  ResearchRunControlResult,
  ResearchRunId,
  ResearchRunStatusDto,
  ResolveResearchQueueCardRequest,
  RuntimeActivityProjection,
  ScoreCompletenessRequest,
  SessionId,
  SessionShellProjection,
  StartResearchRunRequest,
  StartProjectRequest,
  SubmitAnswerRequest,
  SseEvent,
  SynthesizeEvidenceRequest,
  StateVersion,
  StatusEndpointDto,
  RetryResearchRunRequest,
  RevokeChatGptBrowserDelegationRunRequest,
  DeleteServicePageUsePermissionArtifactsRequest,
  RevokeServicePageUsePermissionRequest,
  UpdateResearchAllowlistRequest
} from "@solo-superman/contracts";

type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;
type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

const LOOPBACK_URL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export interface SidecarConnection {
  readonly baseUrl: string;
  readonly localCapabilityToken: string;
  readonly mode: string;
  readonly status: string;
  readonly tokenSource: string;
}

export interface SidecarClientOptions {
  readonly connection: SidecarConnection;
  readonly fetchImpl?: FetchImplementation;
}

export type SubmitAnswerInput = SubmitAnswerRequest;
export type ScoreCompletenessInput = ScoreCompletenessRequest;
export type CompletionCandidateInput = CompletionCandidateRequest;
export type PrepareFounderBriefInput = PrepareFounderBriefRequest;
export type PrepareResearchDisclosureInput = PrepareResearchDisclosureRequest;
export type ChangeProjectPurposeModeInput = ChangeProjectPurposeModeRequest;
export type ChangeBusinessCriticIntensityInput = ChangeBusinessCriticIntensityRequest;
export type DeferQueueItemInput = DeferQueueItemRequest;
export type DismissQueueItemInput = DismissQueueItemRequest;
export type StartResearchRunInput = StartResearchRunRequest;
export type CancelResearchRunInput = CancelResearchRunRequest;
export type RetryResearchRunInput = RetryResearchRunRequest;
export type ResolveResearchQueueCardInput = ResolveResearchQueueCardRequest;
export type CreatePlanningHandoffInput = CreatePlanningHandoffRequest;
export type CreateChatGptBrowserDelegationRunInput = CreateChatGptBrowserDelegationRunRequest;
export type RevokeChatGptBrowserDelegationRunInput = RevokeChatGptBrowserDelegationRunRequest;
export type CreateServicePageUsePermissionInput = CreateServicePageUsePermissionRequest;
export type RevokeServicePageUsePermissionInput = RevokeServicePageUsePermissionRequest;
export type DeleteServicePageUsePermissionArtifactsInput = DeleteServicePageUsePermissionArtifactsRequest;
export type RecordImplementationStepLedgerInput = RecordImplementationStepLedgerRequest;

export class SidecarClientError extends Error {
  readonly apiError: ApiError;
  readonly httpStatus: number;

  constructor(apiError: ApiError, httpStatus: number) {
    super(apiError.message);
    this.name = "SidecarClientError";
    this.apiError = apiError;
    this.httpStatus = httpStatus;
  }
}

function ensureNoTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function apiUrl(baseUrl: string, path: string) {
  const base = new URL(`${ensureNoTrailingSlash(baseUrl)}/`);
  const requestUrl = /^https?:\/\//iu.test(path) ? new URL(path) : new URL(path.startsWith("/") ? path : `/${path}`, base);

  if (requestUrl.origin !== base.origin) {
    throw new Error("Sidecar request URL must stay on the discovered sidecar origin.");
  }

  return requestUrl.toString();
}

function invalidApiResponse(response: Response, message: string) {
  return new SidecarClientError(
    {
      code: "SIDECAR_NOT_READY",
      message
    },
    response.status
  );
}

async function unwrapEnvelope<TData>(response: Response): Promise<TData> {
  let envelope: ApiEnvelope<TData>;

  try {
    envelope = (await response.json()) as ApiEnvelope<TData>;
  } catch {
    throw invalidApiResponse(response, "Sidecar returned a non-JSON response.");
  }

  if (envelope.ok) {
    return envelope.data;
  }

  throw new SidecarClientError(envelope.error, response.status);
}

export function parseSseEvents(text: string): readonly SseEvent[] {
  return text
    .split(/\n\n+/u)
    .map((frame) =>
      frame
        .split(/\n/u)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n")
    )
    .filter((payload) => payload.length > 0)
    .map((payload) => JSON.parse(payload) as SseEvent);
}

async function unwrapSseEvents(response: Response): Promise<readonly SseEvent[]> {
  if (!response.ok) {
    await unwrapEnvelope<never>(response);
  }

  return parseSseEvents(await response.text());
}

function jsonHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

function researchAllowlistCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/research-allowlists`;
}

function researchAllowlistMemberPath(projectId: ProjectId, allowlistId: ResearchAllowlistId) {
  return `${researchAllowlistCollectionPath(projectId)}/${encodeURIComponent(allowlistId)}`;
}

function researchDisclosureCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/research-disclosures`;
}

function researchRunCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/research-runs`;
}

function phase15bUpgradeHintCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/phase15b-upgrade-hints`;
}

function phase15bUpgradeHintExportPath(projectId: ProjectId) {
  return `${phase15bUpgradeHintCollectionPath(projectId)}/export`;
}

function planningHandoffPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/planning-handoff`;
}

function chatGptBrowserDelegationPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/chatgpt-browser-delegations`;
}

function chatGptBrowserDelegationRunRevokePath(sessionId: SessionId, runId: string) {
  return `${chatGptBrowserDelegationPath(sessionId)}/${encodeURIComponent(runId)}/revoke`;
}

function servicePageUsePermissionPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/service-page-use-permissions`;
}

function servicePageUsePermissionRevokePath(sessionId: SessionId, permissionId: string) {
  return `${servicePageUsePermissionPath(sessionId)}/${encodeURIComponent(permissionId)}/revoke`;
}

function servicePageUsePermissionArtifactDeletePath(sessionId: SessionId, permissionId: string) {
  return `${servicePageUsePermissionPath(sessionId)}/${encodeURIComponent(permissionId)}/artifacts/delete`;
}

function implementationStepLedgerPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/implementation-step-ledger`;
}

function sessionEventStreamPath(sessionId: SessionId) {
  return `/api/v1/events/stream?${new URLSearchParams({ sessionId }).toString()}`;
}

function researchRunStatusPath(projectId: ProjectId, researchRunId: ResearchRunId) {
  return `${researchRunCollectionPath(projectId)}/${encodeURIComponent(researchRunId)}/status`;
}

function researchRunControlPath(projectId: ProjectId, researchRunId: ResearchRunId, action: "cancel" | "retry") {
  return `${researchRunCollectionPath(projectId)}/${encodeURIComponent(researchRunId)}/${action}`;
}

function envValue(env: Readonly<Record<string, string | boolean | undefined>>, key: string) {
  const value = env[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function loopbackHttpBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const isLoopbackHost = LOOPBACK_URL_HOSTNAMES.has(url.hostname);
    const hasOnlyOriginParts =
      value === url.origin &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname === "/" &&
      url.search.length === 0 &&
      url.hash.length === 0;

    return url.protocol === "http:" && isLoopbackHost && url.port.length > 0 && hasOnlyOriginParts ? url.origin : null;
  } catch {
    return null;
  }
}

export function sidecarConnectionFromEnv(
  env: Readonly<Record<string, string | boolean | undefined>> = import.meta.env
): SidecarConnection | null {
  const localCapabilityToken = envValue(env, "VITE_SOLO_LOCAL_CAPABILITY_TOKEN");

  if (!localCapabilityToken) {
    return null;
  }

  const envBaseUrl = envValue(env, "VITE_SOLO_SIDECAR_BASE_URL");
  const baseUrl = envBaseUrl ? loopbackHttpBaseUrl(envBaseUrl) : null;

  if (!baseUrl) {
    return null;
  }

  return {
    baseUrl,
    localCapabilityToken,
    mode: "vite_env",
    status: "discovered",
    tokenSource: "vite_env"
  };
}

export async function discoverSidecarConnection(): Promise<SidecarConnection | null> {
  return sidecarConnectionFromEnv();
}

export function createSidecarClient({ connection, fetchImpl = fetch }: SidecarClientOptions) {
  async function request<TData>(path: string, init: RequestInit = {}) {
    return unwrapEnvelope<TData>(await fetchImpl(apiUrl(connection.baseUrl, path), init));
  }

  async function postCommand<TProjection = unknown>(path: string, body: unknown) {
    return request<CommandResponse<TProjection>>(path, {
      method: "POST",
      headers: jsonHeaders(connection.localCapabilityToken),
      body: JSON.stringify(body)
    });
  }

  async function getProjection<TProjection>(path: string) {
    return request<TProjection>(path, {
      method: "GET",
      headers: authHeaders(connection.localCapabilityToken)
    });
  }

  return {
    createProject(input: StartProjectRequest) {
      return postCommand<SessionShellProjection>("/api/v1/projects", input);
    },

    changeProjectPurposeMode(input: ChangeProjectPurposeModeInput) {
      return postCommand<SessionShellProjection>(
        `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/project-purpose-mode`,
        input
      );
    },

    changeBusinessCriticIntensity(input: ChangeBusinessCriticIntensityInput) {
      return postCommand<SessionShellProjection>(
        `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/business-critic-intensity`,
        input
      );
    },

    captureIntake(sessionId: SessionId, expectedStateVersion: StateVersion, answer: string) {
      return postCommand(`/api/v1/sessions/${encodeURIComponent(sessionId)}/intake`, {
        expectedStateVersion,
        answer
      });
    },

    draftInitialSpec(sessionId: SessionId, expectedStateVersion: StateVersion) {
      return postCommand<LivingSpecProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spec/initial`, {
        expectedStateVersion
      });
    },

    analyzeAmbiguity(sessionId: SessionId, expectedStateVersion: StateVersion, targetRef: string) {
      return postCommand(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spec/analyze`, {
        expectedStateVersion,
        targetRef
      });
    },

    activateQuestionBatch(sessionId: SessionId, expectedStateVersion: StateVersion) {
      return postCommand<DecisionQueueProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/queue/activate`, {
        expectedStateVersion
      });
    },

    submitAnswer(input: SubmitAnswerInput) {
      return postCommand<DecisionQueueProjection>(
        `/api/v1/questions/${encodeURIComponent(input.queueItemId)}/answers`,
        input
      );
    },

    deferQueueItem(input: DeferQueueItemInput) {
      return postCommand<DecisionQueueProjection>(
        `/api/v1/queue-items/${encodeURIComponent(input.queueItemId)}/defer`,
        input
      );
    },

    dismissQueueItem(input: DismissQueueItemInput) {
      return postCommand<DecisionQueueProjection>(
        `/api/v1/queue-items/${encodeURIComponent(input.queueItemId)}/dismiss`,
        input
      );
    },

    planResearch(input: PlanResearchRequest) {
      return postCommand<ResearchEvidenceProjection>(
        `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/research-tasks`,
        input
      );
    },

    importResearchResult(input: ImportResearchResultRequest) {
      return postCommand<ResearchEvidenceProjection>(
        `/api/v1/research-tasks/${encodeURIComponent(input.researchTaskId)}/results`,
        input
      );
    },

    synthesizeEvidence(input: SynthesizeEvidenceRequest) {
      return postCommand<ResearchEvidenceProjection>(
        `/api/v1/research-results/${encodeURIComponent(input.researchResultId)}/synthesize`,
        input
      );
    },

    resolveResearchQueueCard(input: ResolveResearchQueueCardInput) {
      return postCommand<DecisionQueueProjection>(
        `/api/v1/research-cards/${encodeURIComponent(input.cardId)}/resolve`,
        input
      );
    },

    createRuntimePreview(input: CreateRuntimePreviewRequest) {
      return postCommand<RuntimeActivityProjection>("/api/v1/runtime/codex/preview", input);
    },

    createManualHandoff(input: CreateManualHandoffRequest) {
      return postCommand<RuntimeActivityProjection>("/api/v1/runtime/manual-handoff", input);
    },

    convertRuntimeArtifact(input: ConvertRuntimeArtifactRequest) {
      return postCommand<RuntimeActivityProjection>(
        `/api/v1/runtime/artifacts/${encodeURIComponent(input.artifactId)}/convert`,
        input
      );
    },

    blockRuntimeArtifact(input: BlockRuntimeArtifactRequest) {
      return postCommand<RuntimeActivityProjection>(
        `/api/v1/runtime/artifacts/${encodeURIComponent(input.artifactId)}/block`,
        input
      );
    },

    scoreCompleteness(input: ScoreCompletenessInput) {
      return postCommand<ConfidenceCompletionProjection>(
        `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/completeness/score`,
        input
      );
    },

    createCompletionCandidate(input: CompletionCandidateInput) {
      return postCommand<ConfidenceCompletionProjection>(
        `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/completion-candidate`,
        input
      );
    },

    prepareFounderBriefExport(input: PrepareFounderBriefInput) {
      return postCommand<FounderBriefProjection>(
        `/api/v1/sessions/${encodeURIComponent(input.sessionId)}/founder-brief/export`,
        input
      );
    },

    createResearchAllowlist(projectId: ProjectId, input: CreateResearchAllowlistRequest) {
      return postCommand<ResearchAllowlistGovernanceProjection>(researchAllowlistCollectionPath(projectId), input);
    },

    updateResearchAllowlist(
      projectId: ProjectId,
      allowlistId: ResearchAllowlistId,
      input: UpdateResearchAllowlistRequest
    ) {
      return postCommand<ResearchAllowlistGovernanceProjection>(
        researchAllowlistMemberPath(projectId, allowlistId),
        input
      );
    },

    pauseResearchAllowlist(projectId: ProjectId, allowlistId: ResearchAllowlistId, reason?: string) {
      return postCommand<ResearchAllowlistGovernanceProjection>(
        `${researchAllowlistMemberPath(projectId, allowlistId)}/pause`,
        {
          projectId,
          allowlistId,
          ...(reason ? { reason } : {})
        }
      );
    },

    revokeResearchAllowlist(projectId: ProjectId, allowlistId: ResearchAllowlistId, reason?: string) {
      return postCommand<ResearchAllowlistGovernanceProjection>(
        `${researchAllowlistMemberPath(projectId, allowlistId)}/revoke`,
        {
          projectId,
          allowlistId,
          ...(reason ? { reason } : {})
        }
      );
    },

    prepareResearchDisclosure(projectId: ProjectId, input: PrepareResearchDisclosureInput) {
      return postCommand<ResearchDisclosurePreparationResult>(researchDisclosureCollectionPath(projectId), input);
    },

    startResearchRun(projectId: ProjectId, input: StartResearchRunInput) {
      return postCommand<ResearchRunControlResult>(researchRunCollectionPath(projectId), input);
    },

    cancelResearchRun(projectId: ProjectId, researchRunId: ResearchRunId, input: CancelResearchRunInput = {}) {
      return postCommand<ResearchRunControlResult>(researchRunControlPath(projectId, researchRunId, "cancel"), {
        projectId,
        researchRunId,
        ...input
      });
    },

    retryResearchRun(projectId: ProjectId, researchRunId: ResearchRunId, input: RetryResearchRunInput) {
      return postCommand<ResearchRunControlResult>(researchRunControlPath(projectId, researchRunId, "retry"), {
        projectId,
        researchRunId,
        ...input
      });
    },

    getRuntimeStatus() {
      return getProjection<CodexRuntimeStatusDto>("/api/v1/runtime/status");
    },

    listResearchAllowlists(projectId: ProjectId) {
      return getProjection<ResearchAllowlistGovernanceProjection>(researchAllowlistCollectionPath(projectId));
    },

    listResearchDisclosures(projectId: ProjectId) {
      return getProjection<ResearchDisclosureLogProjection>(researchDisclosureCollectionPath(projectId));
    },

    listResearchRuns(projectId: ProjectId) {
      return getProjection<ResearchRunControlProjection>(researchRunCollectionPath(projectId));
    },

    getResearchRunStatus(projectId: ProjectId, researchRunId: ResearchRunId) {
      return getProjection<ResearchRunStatusDto>(researchRunStatusPath(projectId, researchRunId));
    },

    listPhase15bUpgradeHints(projectId: ProjectId) {
      return getProjection<Phase15bUpgradeHintProjection>(phase15bUpgradeHintCollectionPath(projectId));
    },

    exportPhase15bUpgradeHints(projectId: ProjectId) {
      return getProjection<Phase15bUpgradeHintExportDto>(phase15bUpgradeHintExportPath(projectId));
    },

    createPlanningHandoff(input: CreatePlanningHandoffInput) {
      return postCommand<PlanningHandoffProjection>(planningHandoffPath(input.sessionId), input);
    },

    getPlanningHandoff(sessionId: SessionId) {
      return getProjection<PlanningHandoffProjection | null>(planningHandoffPath(sessionId));
    },

    createChatGptBrowserDelegationRun(input: CreateChatGptBrowserDelegationRunInput) {
      return postCommand<ChatGptBrowserDelegationProjection>(chatGptBrowserDelegationPath(input.sessionId), input);
    },

    revokeChatGptBrowserDelegationRun(input: RevokeChatGptBrowserDelegationRunInput) {
      return postCommand<ChatGptBrowserDelegationProjection>(
        chatGptBrowserDelegationRunRevokePath(input.sessionId, input.runId),
        input
      );
    },

    getChatGptBrowserDelegation(sessionId: SessionId) {
      return getProjection<ChatGptBrowserDelegationProjection | null>(chatGptBrowserDelegationPath(sessionId));
    },

    createServicePageUsePermission(input: CreateServicePageUsePermissionInput) {
      return postCommand<ServicePageUsePermissionProjection>(servicePageUsePermissionPath(input.sessionId), input);
    },

    revokeServicePageUsePermission(input: RevokeServicePageUsePermissionInput) {
      return postCommand<ServicePageUsePermissionProjection>(
        servicePageUsePermissionRevokePath(input.sessionId, input.permissionId),
        input
      );
    },

    deleteServicePageUsePermissionArtifacts(input: DeleteServicePageUsePermissionArtifactsInput) {
      return postCommand<ServicePageUsePermissionProjection>(
        servicePageUsePermissionArtifactDeletePath(input.sessionId, input.permissionId),
        input
      );
    },

    getServicePageUsePermission(sessionId: SessionId) {
      return getProjection<ServicePageUsePermissionProjection | null>(servicePageUsePermissionPath(sessionId));
    },

    recordImplementationStepLedger(input: RecordImplementationStepLedgerInput) {
      return postCommand<ImplementationStepLedgerProjection>(implementationStepLedgerPath(input.sessionId), input);
    },

    getImplementationStepLedger(sessionId: SessionId) {
      return getProjection<ImplementationStepLedgerProjection | null>(implementationStepLedgerPath(sessionId));
    },

    getSession(projectId: ProjectId, sessionId: SessionId) {
      return getProjection<SessionShellProjection>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`
      );
    },

    getSpec(sessionId: SessionId) {
      return getProjection<LivingSpecProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spec`);
    },

    getQueue(sessionId: SessionId) {
      return getProjection<DecisionQueueProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/queue`);
    },

    async readSessionEventStreamSnapshot(sessionId: SessionId) {
      return unwrapSseEvents(
        await fetchImpl(apiUrl(connection.baseUrl, sessionEventStreamPath(sessionId)), {
          method: "GET",
          headers: authHeaders(connection.localCapabilityToken)
        })
      );
    },

    getResearch(sessionId: SessionId) {
      return getProjection<ResearchEvidenceProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/research`);
    },

    getActivity(sessionId: SessionId) {
      return getProjection<RuntimeActivityProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/activity`);
    },

    getCompleteness(sessionId: SessionId) {
      return getProjection<ConfidenceCompletionProjection>(
        `/api/v1/sessions/${encodeURIComponent(sessionId)}/completeness`
      );
    },

    getFounderBrief(sessionId: SessionId) {
      return getProjection<FounderBriefProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/founder-brief`);
    },

    getCommandStatus(statusUrl: string) {
      return getProjection<StatusEndpointDto>(statusUrl);
    }
  };
}

export type SidecarClient = ReturnType<typeof createSidecarClient>;
