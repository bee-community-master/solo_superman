import type {
  ApiError,
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
  CommandResponse,
  CodexRuntimeStatusDto,
  BlockRuntimeArtifactRequest,
  ConvertRuntimeArtifactRequest,
  CreateManualHandoffRequest,
  CreateRuntimePreviewRequest,
  DecisionQueueProjection,
  ImportResearchResultRequest,
  LivingSpecProjection,
  PlanResearchRequest,
  ResearchEvidenceProjection,
  RuntimeActivityProjection,
  SessionId,
  SessionShellProjection,
  StartProjectRequest,
  SubmitAnswerRequest,
  SynthesizeEvidenceRequest,
  StateVersion,
  StatusEndpointDto
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

async function unwrapEnvelope<TData>(response: Response): Promise<TData> {
  const envelope = (await response.json()) as ApiEnvelope<TData>;

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

function envValue(env: Readonly<Record<string, string | boolean | undefined>>, key: string) {
  const value = env[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function sidecarConnectionFromEnv(
  env: Readonly<Record<string, string | boolean | undefined>> = import.meta.env
): SidecarConnection | null {
  const localCapabilityToken = envValue(env, "VITE_SOLO_LOCAL_CAPABILITY_TOKEN");

  if (!localCapabilityToken) {
    return null;
  }

  return {
    baseUrl: envValue(env, "VITE_SOLO_SIDECAR_BASE_URL") ?? "http://127.0.0.1:43110",
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

    getRuntimeStatus() {
      return getProjection<CodexRuntimeStatusDto>("/api/v1/runtime/status");
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

    getCommandStatus(statusUrl: string) {
      return getProjection<StatusEndpointDto>(statusUrl);
    }
  };
}

export type SidecarClient = ReturnType<typeof createSidecarClient>;
