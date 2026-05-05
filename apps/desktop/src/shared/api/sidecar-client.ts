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
  CreateManualHandoffRequest,
  CreateResearchAllowlistRequest,
  CreateRuntimePreviewRequest,
  DecisionQueueProjection,
  FounderBriefProjection,
  ImportResearchResultRequest,
  LivingSpecProjection,
  PlanResearchRequest,
  PrepareFounderBriefRequest,
  ProjectId,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchEvidenceProjection,
  RuntimeActivityProjection,
  ScoreCompletenessRequest,
  SessionId,
  SessionShellProjection,
  StartProjectRequest,
  SubmitAnswerRequest,
  SynthesizeEvidenceRequest,
  StateVersion,
  StatusEndpointDto,
  UpdateResearchAllowlistRequest
} from "@solo-superman/contracts";

type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;
type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

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

export class SidecarClientError extends Error {
  readonly apiError: ApiError;
  readonly httpStatus: number;

  constructor(apiError: ApiError, httpStatus: number) {
    super(apiError.message);
    this.apiError = apiError;
    this.httpStatus = httpStatus;
  }
}

function ensureNoTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function apiUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${ensureNoTrailingSlash(baseUrl)}${normalizedPath}`;
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

function envValue(env: Readonly<Record<string, string | boolean | undefined>>, key: string) {
  const value = env[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function loopbackHttpBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const isLoopbackHost = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
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
  const baseUrl = envBaseUrl ? loopbackHttpBaseUrl(envBaseUrl) : "http://127.0.0.1:43110";

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
  const envConnection = sidecarConnectionFromEnv();

  if (envConnection) {
    return envConnection;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");

    return await invoke<SidecarConnection>("get_sidecar_base_url");
  } catch {
    return null;
  }
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

    getRuntimeStatus() {
      return getProjection<CodexRuntimeStatusDto>("/api/v1/runtime/status");
    },

    listResearchAllowlists(projectId: ProjectId) {
      return getProjection<ResearchAllowlistGovernanceProjection>(researchAllowlistCollectionPath(projectId));
    },

    getSession(projectId: string, sessionId: SessionId) {
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
