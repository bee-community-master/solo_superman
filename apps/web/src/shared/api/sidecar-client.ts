import type {
  CommandResponse,
  CodexRuntimeLoginStartDto,
  CodexRuntimeStatusDto,
  AutoImplementationRunProjection,
  BlockRuntimeArtifactRequest,
  CompletionCandidateRequest,
  ConfidenceCompletionProjection,
  ConvertRuntimeArtifactRequest,
  ChangeBusinessCriticIntensityRequest,
  ChangeProjectPurposeModeRequest,
  ChatGptBrowserDelegationProjection,
  CreateExecutionAuthorityRequest,
  ServicePageUsePermissionProjection,
  CreateAutoImplementationRunRequest,
  CreateAutoImplementationWorkerJobRequest,
  AdvanceAutoImplementationWorkerStageRequest,
  CompleteAutoImplementationWorkerJobRequest,
  ImportAutoImplementationWorkerLedgerRequest,
  RecordAutoImplementationPullRequestMutationRequest,
  RunAutoImplementationWorkerJobRequest,
  CreateManualHandoffRequest,
  CreateChatGptBrowserDelegationRunRequest,
  CreateServicePageUsePermissionRequest,
  CreatePlanningHandoffRequest,
  CreateResearchAllowlistRequest,
  CreateRuntimePreviewRequest,
  DecisionQueueProjection,
  DeferQueueItemRequest,
  DismissQueueItemRequest,
  ExecutionAuthorityLedgerProjection,
  FounderBriefProjection,
  GenerateInitialQuestionSetRequest,
  GenerateInitialQuestionSetResponse,
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
  QueueItemId,
  RecordImplementationStepLedgerRequest,
  RecordAutoImplementationStageRequest,
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
  SynthesizeEvidenceRequest,
  StateVersion,
  StatusEndpointDto,
  RetryResearchRunRequest,
  RevokeChatGptBrowserDelegationRunRequest,
  DeleteServicePageUsePermissionArtifactsRequest,
  RevokeServicePageUsePermissionRequest,
  UpdateResearchAllowlistRequest
} from "@solo-superman/contracts";
import {
  chatGptBrowserDelegationPath,
  chatGptBrowserDelegationRunRevokePath,
  autoImplementationPullRequestMutationPath,
  autoImplementationStagePath,
  autoImplementationRunPath,
  autoImplementationWorkerJobPath,
  autoImplementationWorkerJobCompletePath,
  autoImplementationWorkerJobRunPath,
  autoImplementationWorkerLedgerImportPath,
  autoImplementationWorkerStageAdvancePath,
  executionAuthorityPath,
  generatedInitialQuestionSetPath,
  implementationStepLedgerPath,
  phase15bUpgradeHintCollectionPath,
  phase15bUpgradeHintExportPath,
  planningHandoffPath,
  researchAllowlistCollectionPath,
  researchAllowlistMemberPath,
  researchAllowlistPausePath,
  researchAllowlistRevokePath,
  researchDisclosureCollectionPath,
  researchRunCollectionPath,
  researchRunControlPath,
  researchRunStatusPath,
  servicePageUsePermissionArtifactDeletePath,
  servicePageUsePermissionPath,
  servicePageUsePermissionRevokePath,
  sessionEventStreamPath
} from "./sidecar-routes";
import {
  apiUrl,
  authHeaders,
  diagnoseSidecarConnectionFromEnv,
  discoverSidecarConnection,
  jsonHeaders,
  parseSseEvents,
  sidecarConnectionFromEnv,
  SidecarClientError,
  unwrapEnvelope,
  unwrapSseEvents,
  type SidecarClientOptions,
  type SidecarConnection
} from "./sidecar-transport";

export {
  diagnoseSidecarConnectionFromEnv,
  discoverSidecarConnection,
  parseSseEvents,
  sidecarConnectionFromEnv,
  SidecarClientError,
  type SidecarClientOptions,
  type SidecarConnection
};

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
export type CreateExecutionAuthorityInput = CreateExecutionAuthorityRequest;
export type CreateAutoImplementationRunInput = CreateAutoImplementationRunRequest;
export type CreateAutoImplementationWorkerJobInput = CreateAutoImplementationWorkerJobRequest;
export type RecordAutoImplementationPullRequestMutationInput = RecordAutoImplementationPullRequestMutationRequest;
export type CompleteAutoImplementationWorkerJobInput = CompleteAutoImplementationWorkerJobRequest;
export type ImportAutoImplementationWorkerLedgerInput = ImportAutoImplementationWorkerLedgerRequest;
export type RunAutoImplementationWorkerJobInput = RunAutoImplementationWorkerJobRequest;
export type AdvanceAutoImplementationWorkerStageInput = AdvanceAutoImplementationWorkerStageRequest;
export type RecordAutoImplementationStageInput = RecordAutoImplementationStageRequest;
export type CreateChatGptBrowserDelegationRunInput = CreateChatGptBrowserDelegationRunRequest;
export type RevokeChatGptBrowserDelegationRunInput = RevokeChatGptBrowserDelegationRunRequest;
export type CreateServicePageUsePermissionInput = CreateServicePageUsePermissionRequest;
export type RevokeServicePageUsePermissionInput = RevokeServicePageUsePermissionRequest;
export type DeleteServicePageUsePermissionArtifactsInput = DeleteServicePageUsePermissionArtifactsRequest;
export type RecordImplementationStepLedgerInput = RecordImplementationStepLedgerRequest;
export type GenerateInitialQuestionSetInput = GenerateInitialQuestionSetRequest;

export interface SidecarRequestOptions {
  readonly signal?: AbortSignal;
}

function shouldLogSidecarClientDiagnostics() {
  return typeof window !== "undefined";
}

function nowMillis() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function logSidecarClientDiagnostic(level: "info" | "warn", event: string, details: Readonly<Record<string, unknown>>) {
  if (!shouldLogSidecarClientDiagnostics()) {
    return;
  }

  console[level](`[solo-superman:sidecar-client:${event}]`, details);
}

function isFounderBriefProjectionPath(path: string) {
  return /^\/api\/v1\/sessions\/[^/]+\/founder-brief$/u.test(path);
}

export function isFounderBriefNotReadyError(error: unknown) {
  return (
    error instanceof SidecarClientError &&
    error.httpStatus === 404 &&
    error.apiError.code === "RESOURCE_NOT_FOUND" &&
    /Founder Brief has not been prepared yet/u.test(error.apiError.message)
  );
}

export function createSidecarClient({ connection, fetchImpl = fetch }: SidecarClientOptions) {
  function logResponse(method: string, path: string, response: Response, startedAt: number, error?: unknown) {
    const expectedOptionalMiss =
      method === "GET" &&
      response.status === 404 &&
      isFounderBriefProjectionPath(path) &&
      isFounderBriefNotReadyError(error);
    const level = response.ok || expectedOptionalMiss ? "info" : "warn";

    logSidecarClientDiagnostic(level, "response", {
      method,
      path,
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? null,
      elapsedMs: Math.round(nowMillis() - startedAt),
      expectedOptionalMiss
    });
  }

  async function request<TData>(path: string, init: RequestInit = {}) {
    const method = init.method ?? "GET";
    const url = apiUrl(connection.baseUrl, path);
    const startedAt = nowMillis();

    logSidecarClientDiagnostic("info", "request", {
      method,
      path,
      baseUrl: connection.baseUrl,
      mode: connection.mode
    });

    let response: Response;

    try {
      response = await fetchImpl(url, init);
    } catch (error) {
      logSidecarClientDiagnostic("warn", "network-error", {
        method,
        path,
        baseUrl: connection.baseUrl,
        elapsedMs: Math.round(nowMillis() - startedAt),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    try {
      const data = await unwrapEnvelope<TData>(response);

      logResponse(method, path, response, startedAt);

      return data;
    } catch (error) {
      logResponse(method, path, response, startedAt, error);
      throw error;
    }
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

  async function postProjection<TProjection>(path: string, body?: unknown, options: SidecarRequestOptions = {}) {
    return request<TProjection>(path, {
      method: "POST",
      headers: body === undefined ? authHeaders(connection.localCapabilityToken) : jsonHeaders(connection.localCapabilityToken),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
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

    generateInitialQuestionSet(input: GenerateInitialQuestionSetInput, options?: SidecarRequestOptions) {
      return postProjection<GenerateInitialQuestionSetResponse>(
        generatedInitialQuestionSetPath(input.sessionId),
        input,
        options
      );
    },

    analyzeAmbiguity(
      sessionId: SessionId,
      expectedStateVersion: StateVersion,
      targetRef: string,
      generatedQuestionSet: unknown
    ) {
      return postCommand(`/api/v1/sessions/${encodeURIComponent(sessionId)}/spec/analyze`, {
        expectedStateVersion,
        targetRef,
        generatedQuestionSet
      });
    },

    activateQuestionBatch(sessionId: SessionId, expectedStateVersion: StateVersion, queueItemIds?: readonly QueueItemId[]) {
      return postCommand<DecisionQueueProjection>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/queue/activate`, {
        expectedStateVersion,
        ...(queueItemIds ? { queueItemIds } : {})
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
        researchAllowlistPausePath(projectId, allowlistId),
        {
          projectId,
          allowlistId,
          ...(reason ? { reason } : {})
        }
      );
    },

    revokeResearchAllowlist(projectId: ProjectId, allowlistId: ResearchAllowlistId, reason?: string) {
      return postCommand<ResearchAllowlistGovernanceProjection>(
        researchAllowlistRevokePath(projectId, allowlistId),
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
      const normalizedInput: StartResearchRunInput =
        input.sourceCategory === "public_web" && !input.adapterKind
          ? { ...input, adapterKind: "web_search_readonly" }
          : input;

      return postCommand<ResearchRunControlResult>(researchRunCollectionPath(projectId), normalizedInput);
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

    startCodexLogin() {
      return postProjection<CodexRuntimeLoginStartDto>("/api/v1/runtime/codex/login/start");
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

    createExecutionAuthority(input: CreateExecutionAuthorityInput) {
      return postCommand<ExecutionAuthorityLedgerProjection>(executionAuthorityPath(input.sessionId), input);
    },

    getExecutionAuthority(sessionId: SessionId) {
      return getProjection<ExecutionAuthorityLedgerProjection | null>(executionAuthorityPath(sessionId));
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

    createAutoImplementationRun(input: CreateAutoImplementationRunInput) {
      return postProjection<AutoImplementationRunProjection>(autoImplementationRunPath(input.sessionId), input);
    },

    createAutoImplementationWorkerJob(input: CreateAutoImplementationWorkerJobInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationWorkerJobPath(input.sessionId, input.runId),
        input
      );
    },

    recordAutoImplementationPullRequestMutation(input: RecordAutoImplementationPullRequestMutationInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationPullRequestMutationPath(input.sessionId, input.runId),
        input
      );
    },

    completeAutoImplementationWorkerJob(input: CompleteAutoImplementationWorkerJobInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationWorkerJobCompletePath(input.sessionId, input.runId, input.jobId),
        input
      );
    },

    importAutoImplementationWorkerLedger(input: ImportAutoImplementationWorkerLedgerInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationWorkerLedgerImportPath(input.sessionId, input.runId, input.jobId),
        input
      );
    },

    runAutoImplementationWorkerJob(input: RunAutoImplementationWorkerJobInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationWorkerJobRunPath(input.sessionId, input.runId, input.jobId),
        input
      );
    },

    advanceAutoImplementationWorkerStage(input: AdvanceAutoImplementationWorkerStageInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationWorkerStageAdvancePath(input.sessionId, input.runId, input.jobId),
        input
      );
    },

    recordAutoImplementationStage(input: RecordAutoImplementationStageInput) {
      return postProjection<AutoImplementationRunProjection>(
        autoImplementationStagePath(input.sessionId, input.runId, input.stage),
        input
      );
    },

    getAutoImplementationRuns(sessionId: SessionId) {
      return getProjection<AutoImplementationRunProjection | null>(autoImplementationRunPath(sessionId));
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
