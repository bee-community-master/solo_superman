import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CODEX_APP_SERVER_GENERATED_VERSION,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  canCreateAutoImplementationGitHubIssues,
  canMergeAutoImplementationPullRequest,
  canOpenNewAutoImplementationPullRequest,
  type AutoImplementationRun,
  type BusinessCriticIntensity,
  type CodexRuntimeLoginStartDto,
  type CodexRuntimeStatusDto,
  type CreateAutoImplementationRunRequest,
  type ExecutionAuthorityLedgerProjection,
  type Phase15bUpgradeHintProjection,
  type ProjectPurposeMode,
  type RecordAutoImplementationPullRequestMutationRequest,
  type SessionId,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import { autoImplementationRunViewModel } from "../AutoImplementationRunPanel";
import {
  buildAutoImplementationGitHubIssueApprovedRequest,
  buildAutoImplementationGitHubIssueDryRunRequest
} from "../auto-implementation-github-issue-request";
import {
  buildAutoImplementationStageLifecycleRequest,
  buildAutoImplementationStageTickRequest
} from "../auto-implementation-stage-request";
import { buildAutoImplementationWorkerCompletionRequest } from "../auto-implementation-worker-completion-request";
import { buildAutoImplementationWorkerLedgerImportRequest } from "../auto-implementation-worker-ledger-import-request";
import {
  buildAutoImplementationPullRequestBodyApprovedRequest,
  buildAutoImplementationPullRequestDryRunRequest,
  buildAutoImplementationPullRequestMergeApprovedRequest,
  buildAutoImplementationPullRequestMergeDryRunRequest,
  buildAutoImplementationPullRequestOpenApprovedRequest,
  buildAutoImplementationPullRequestOpenDryRunRequest
} from "../auto-implementation-pr-mutation-request";
import {
  buildAutoImplementationWorkerAuthorityRequest,
  buildAutoImplementationWorkerJobRequest
} from "../auto-implementation-worker-authority-request";
import {
  canPlanCurrentStageAutoImplementationWorkerJob,
  latestCurrentStageAutoImplementationWorkerJob
} from "../auto-implementation-worker-job-selection";
import { chatGptDelegationViewModel } from "../ChatGptDelegationPanel";
import { implementationStepLedgerViewModel } from "../ImplementationStepLedgerPanel";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { servicePageUsePermissionViewModel } from "../ServicePageUsePermissionPanel";
import {
  confidencePlaceholder,
  decisionQueueRecoveryViewModel,
  phase15aOperationsViewModel,
  phase15bReadinessViewModel,
  planningHandoffViewModel,
  pendingEffectSummary,
  questionProgressViewModel,
  queueSections,
  runtimeActivityProjectionFromStatuses
} from "../decision-queue-view-model";
import { activeWebPublicResearchAllowlist } from "../phase15a-research-run-request";
import { readyReadOnlyResearchRunStartPlan } from "../ready-readonly-research-start-plan";
import {
  createSidecarClient,
  discoverSidecarConnection,
  type SidecarClient
} from "../../../shared/api/sidecar-client";
import { requiredCommandProjection } from "../../../shared/api/command-response-helpers";
import {
  DEFAULT_IDEA,
  DEFAULT_INTAKE,
  COMMAND_LOG_LIMIT,
  canStartInitialQueueFlow,
  displayError,
  emptyProjectionState,
  emptyResearchOperationsState,
  latestCommandBackedProjectionVersion,
  type CommandLogEntry,
  type ConnectionState,
  type DecisionQueuePageId,
  type InitialResearchPermission,
  type PageHealth,
  type ProjectionState
} from "./decision-queue-shell-model";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import { planningRadarAxes } from "./planning-radar-model";
import { useCommandLogActions } from "./useCommandLogActions";
import { useDecisionQueuePlanningPermissionActions } from "./useDecisionQueuePlanningPermissionActions";
import { useDecisionQueueRefreshers } from "./useDecisionQueueRefreshers";
import {
  MISSING_READY_RESEARCH_ALLOWLIST_MESSAGE,
  NO_READY_RESEARCH_TASKS_MESSAGE,
  useDecisionQueueResearchActions
} from "./useDecisionQueueResearchActions";
import { useDecisionQueueSessionActions } from "./useDecisionQueueSessionActions";

function unavailableCodexLoginStart(message: string): CodexRuntimeLoginStartDto {
  return {
    status: "unavailable",
    command: "codex auth login",
    statusCommand: "codex login status",
    startedAt: new Date().toISOString(),
    terminal: "none",
    message
  };
}

function unavailableRuntimeStatus(message: string): CodexRuntimeStatusDto {
  return {
    status: "unavailable",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: new Date().toISOString(),
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: false,
    executionMode: "manual_handoff",
    account: {
      status: "unknown",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      reason: message
    },
    reason: message
  };
}

function logRuntimeStatusDiagnostic(level: "info" | "warn", event: string, details: Readonly<Record<string, unknown>>) {
  if (typeof window === "undefined") {
    return;
  }

  console[level](`[solo-superman:runtime-status:${event}]`, details);
}

async function getRuntimeStatusBestEffort(activeClient: SidecarClient, fallback: CodexRuntimeStatusDto | null) {
  try {
    return await activeClient.getRuntimeStatus();
  } catch (error) {
    const message = displayError(error);

    logRuntimeStatusDiagnostic("warn", "best-effort-failed", { message });

    return fallback ?? unavailableRuntimeStatus(message);
  }
}

type PlanningHandoffProjectionState = NonNullable<ProjectionState["planningHandoff"]>;
type PlanningReadyHandoffProjection = Extract<PlanningHandoffProjectionState, { readonly currentStatus: "planning_ready" }>;

function planningHandoffIsReady(
  planningHandoff: ProjectionState["planningHandoff"]
): planningHandoff is PlanningReadyHandoffProjection {
  return planningHandoff?.currentStatus === "planning_ready";
}

export function autoImplementationWorkspaceCreateBlocker(planningHandoff: ProjectionState["planningHandoff"]) {
  if (planningHandoffIsReady(planningHandoff)) {
    return null;
  }

  return planningHandoff
    ? "Planning handoff must be planning_ready before creating or reprovisioning an auto implementation workspace."
    : "Run the planning handoff gate and reach planning_ready before creating an auto implementation workspace.";
}

export function autoImplementationWorkspaceCreateFailureMessage(error: unknown) {
  return `Auto implementation workspace creation failed: ${displayError(error)}`;
}

export function useDecisionQueueShellController() {
  const copy = useDecisionQueueCopy();
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "connecting" });
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [intake, setIntake] = useState(DEFAULT_INTAKE);
  const [chatGptLoginAcknowledged, setChatGptLoginAcknowledged] = useState(false);
  const [initialResearchPermission, setInitialResearchPermission] = useState<InitialResearchPermission>("not_now");
  const [projectPurposeMode, setProjectPurposeMode] = useState<ProjectPurposeMode | null>(null);
  const [purposeModeChangeReason, setPurposeModeChangeReason] = useState("");
  const [businessCriticIntensity, setBusinessCriticIntensity] = useState<BusinessCriticIntensity | null>(null);
  const [initialBusinessCriticIntensityReason, setInitialBusinessCriticIntensityReason] = useState("");
  const [businessCriticIntensityChangeReason, setBusinessCriticIntensityChangeReason] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [knownRiskDrafts, setKnownRiskDrafts] = useState<Record<string, string>>({});
  const [researchDrafts, setResearchDrafts] = useState<Record<string, string>>({});
  const [workerLedgerImportDraft, setWorkerLedgerImportDraft] = useState("");
  const [projections, setProjections] = useState<ProjectionState>(emptyProjectionState);
  const [researchOperations, setResearchOperations] = useState<ResearchOperationsState>(emptyResearchOperationsState);
  const [phase15bReadiness, setPhase15bReadiness] = useState<Phase15bUpgradeHintProjection | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<CodexRuntimeStatusDto | null>(null);
  const [codexLoginStart, setCodexLoginStart] = useState<CodexRuntimeLoginStartDto | null>(null);
  const [commandLog, setCommandLog] = useState<readonly CommandLogEntry[]>([]);
  const [statuses, setStatuses] = useState<readonly StatusEndpointDto[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<DecisionQueuePageId>("onboarding");

  const connect = useCallback(async () => {
    setConnectionState({ status: "connecting" });
    setWorkflowError(null);

    const connection = await discoverSidecarConnection();

    if (!connection) {
      const message = copy.layout.sidecarUnavailableRecovery;

      setClient(null);
      setConnectionState({
        status: "unavailable",
        message
      });
      setRuntimeStatus(unavailableRuntimeStatus(message));
      logRuntimeStatusDiagnostic("warn", "connection-unavailable", { message });
      return null;
    }

    const nextClient = createSidecarClient({ connection });

    setClient(nextClient);
    setConnectionState({ status: "connected", connection });
    nextClient
      .getRuntimeStatus()
      .then((status) => {
        setRuntimeStatus(status);
        logRuntimeStatusDiagnostic("info", "initial-status", {
          status: status.status,
          accountStatus: status.account.status,
          reason: status.account.reason ?? status.reason ?? null
        });
      })
      .catch((error) => {
        const message = displayError(error);

        setRuntimeStatus(unavailableRuntimeStatus(message));
        setWorkflowError(message);
        logRuntimeStatusDiagnostic("warn", "initial-status-failed", { message });
      });
    return nextClient;
  }, [copy.layout.sidecarUnavailableRecovery]);

  useEffect(() => {
    void connect();
  }, [connect]);

  const refreshRuntimeStatus = useCallback(async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);
    try {
      const activeClient = client ?? await connect();

      if (!activeClient) {
        setRuntimeStatus(unavailableRuntimeStatus(copy.layout.sidecarUnavailableRecovery));
        setWorkflowError(copy.layout.sidecarUnavailableRecovery);
        return;
      }

      const status = await activeClient.getRuntimeStatus();

      setRuntimeStatus(status);
      logRuntimeStatusDiagnostic("info", "refresh-status", {
        status: status.status,
        accountStatus: status.account.status,
        reason: status.account.reason ?? status.reason ?? null
      });
    } catch (error) {
      const message = displayError(error);

      setRuntimeStatus(unavailableRuntimeStatus(message));
      setWorkflowError(message);
      logRuntimeStatusDiagnostic("warn", "refresh-status-failed", { message });
    } finally {
      setIsBusy(false);
    }
  }, [client, connect, copy.layout.sidecarUnavailableRecovery, isBusy]);

  const startCodexLogin = useCallback(async () => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);
    setCodexLoginStart(null);
    try {
      const activeClient = client ?? await connect();

      if (!activeClient) {
        const loginStart = unavailableCodexLoginStart(copy.layout.sidecarUnavailableRecovery);
        setCodexLoginStart(loginStart);
        setRuntimeStatus(unavailableRuntimeStatus(loginStart.message));
        setWorkflowError(loginStart.message);
        return;
      }

      const loginStart = await activeClient.startCodexLogin();
      setCodexLoginStart(loginStart);
      setRuntimeStatus(await getRuntimeStatusBestEffort(activeClient, runtimeStatus));
    } catch (error) {
      const message = displayError(error);
      setCodexLoginStart(unavailableCodexLoginStart(message));
      setWorkflowError(message);
    } finally {
      setIsBusy(false);
    }
  }, [client, connect, copy.layout.sidecarUnavailableRecovery, isBusy, runtimeStatus]);

  const {
    refreshResearchOperations,
    refreshPhase15bReadiness,
    refreshPlanningHandoff,
    refreshChatGptDelegation,
    refreshServicePageUsePermission,
    refreshImplementationStepLedger,
    refreshAutoImplementationRuns,
    refreshProjections,
    refetchQueueAfterSseNotification
  } = useDecisionQueueRefreshers({
    client,
    setPhase15bReadiness,
    setProjections,
    setResearchOperations
  });

  const { refreshCommandStatus, appendCommand } = useCommandLogActions({
    client,
    setCommandLog,
    setStatuses
  });

  const {
    createOrReactivateAllowlist,
    pauseAllowlist,
    revokeAllowlist,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
    startReadyReadOnlyResearchRunsAfterAnswer,
    startReadyReadOnlyResearchRuns,
    refreshResearchRunStatus,
    cancelResearchRun,
    retryResearchRun
  } = useDecisionQueueResearchActions({
    appendCommand,
    client,
    projections,
    refreshProjections,
    refreshResearchOperations,
    researchOperations,
    setIsBusy,
    setProjections,
    setResearchOperations,
    setWorkflowError
  });

  const {
    runInitialQueueFlow,
    changeProjectPurposeMode,
    changeBusinessCriticIntensity,
    submitAnswer,
    submitDraftedActiveAnswers,
    refreshQuestionList,
    loadNextQuestionBatch,
    carryQueueItemAsKnownRisk,
    importResearchResult,
    resolveResearchCard
  } = useDecisionQueueSessionActions({
    answerDrafts,
    appendCommand,
    businessCriticIntensity,
    businessCriticIntensityChangeReason,
    chatGptLoginAcknowledged,
    codexLoginAuthenticated: runtimeStatus?.account?.status === "authenticated",
    client,
    connectionStatus: connectionState.status,
    copy,
    idea,
    initialResearchPermission,
    initialBusinessCriticIntensityReason,
    intake,
    isBusy,
    knownRiskDrafts,
    projectPurposeMode,
    projections,
    purposeModeChangeReason,
    refetchQueueAfterSseNotification,
    refreshProjections,
    researchDrafts,
    setAnswerDrafts,
    setBusinessCriticIntensity,
    setBusinessCriticIntensityChangeReason,
    setCommandLog,
    setIsBusy,
    setKnownRiskDrafts,
    setPhase15bReadiness,
    setProjectPurposeMode,
    setProjections,
    setPurposeModeChangeReason,
    setResearchDrafts,
    setResearchOperations,
    setStatuses,
    setWorkflowError,
    startReadyReadOnlyResearchRunsAfterAnswer,
    onInitialQueueCreated: () => setActivePage("questions")
  });

  const {
    scoreCompleteness,
    prepareFounderBrief,
    runPlanningHandoffGate,
    revokeChatGptDelegation,
    revokeServicePageUsePermission,
    exportServicePageArtifacts,
    deleteServicePageArtifacts
  } = useDecisionQueuePlanningPermissionActions({
    appendCommand,
    client,
    phase15bReadiness,
    projections,
    refreshChatGptDelegation,
    refreshProjections,
    refreshServicePageUsePermission,
    setCommandLog,
    setIsBusy,
    setProjections,
    setWorkflowError
  });

  const sections = useMemo(
    () =>
      queueSections(projections.queue).map((section) => ({
        ...section,
        ...copy.questions.queueSections[section.id]
      })),
    [copy, projections.queue]
  );
  const queueRecovery = useMemo(() => {
    const recovery = decisionQueueRecoveryViewModel(projections.queue);

    if (projections.queue) {
      return {
        ...recovery,
        label: copy.questions.queueRecoveryMessages[recovery.status],
        refetchLabel: projections.queue.refetchUrl
          ? copy.questions.queueRefetchReady(projections.queue.refetchUrl)
          : copy.questions.queueRefetchMissing,
        sseLabel: projections.queue.recovery?.sseStreamUrl
          ? copy.questions.queueSseReady(projections.queue.recovery.sseStreamUrl)
          : copy.questions.queueSseMissing,
        activeBatchLabel: projections.queue.activeBatch
          ? copy.questions.queueActiveBatchReady(projections.queue.activeBatch.queueItemIds.length)
          : copy.questions.queueActiveBatchMissing
      };
    }

    return {
      ...recovery,
      label: copy.questions.queueRecoveryFresh,
      refetchLabel: copy.questions.queueRefetchMissing,
      sseLabel: copy.questions.queueSseMissing,
      activeBatchLabel: copy.questions.queueActiveBatchMissing
    };
  }, [copy, projections.queue]);
  const questionProgress = useMemo(() => questionProgressViewModel(projections.queue), [projections.queue]);
  const pendingSummary = useMemo(() => pendingEffectSummary(statuses), [statuses]);
  const runtimeActivity = useMemo(
    () => projections.activity ?? runtimeActivityProjectionFromStatuses(statuses),
    [projections.activity, statuses]
  );
  const confidence = useMemo(
    () =>
      projections.confidence ??
      confidencePlaceholder(projections.session?.sessionId ?? null, projections.research?.knownRisks ?? []),
    [projections.confidence, projections.research, projections.session]
  );
  const phase15aOperations = useMemo(
    () =>
      phase15aOperationsViewModel(
        {
          allowlists: researchOperations.allowlists,
          disclosures: researchOperations.disclosures,
          runs: researchOperations.runs,
          research: projections.research
        },
        copy.phase15a
      ),
    [copy.phase15a, projections.research, researchOperations]
  );
  const phase15bReadinessView = useMemo(
    () => phase15bReadinessViewModel(phase15bReadiness, copy.phase15b.viewModel),
    [copy.phase15b.viewModel, phase15bReadiness]
  );
  const planningHandoffView = useMemo(
    () => planningHandoffViewModel(projections.planningHandoff),
    [projections.planningHandoff]
  );
  const chatGptDelegationView = useMemo(
    () => chatGptDelegationViewModel(projections.chatGptDelegation, copy.permissions.chatGptDelegationViewModel),
    [copy.permissions.chatGptDelegationViewModel, projections.chatGptDelegation]
  );
  const servicePageUsePermissionView = useMemo(
    () => servicePageUsePermissionViewModel(projections.servicePageUsePermission),
    [projections.servicePageUsePermission]
  );
  const implementationStepLedgerView = useMemo(
    () => implementationStepLedgerViewModel(projections.implementationStepLedger),
    [projections.implementationStepLedger]
  );
  const autoImplementationRunView = useMemo(
    () => autoImplementationRunViewModel(
      projections.autoImplementationRuns,
      projections.implementationStepLedger,
      runtimeStatus
    ),
    [projections.autoImplementationRuns, projections.implementationStepLedger, runtimeStatus]
  );
  const canCreateAutoImplementationRun = planningHandoffIsReady(projections.planningHandoff);
  const createAutoImplementationRun = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before creating an auto implementation workspace.");
      return;
    }

    const planningHandoff = projections.planningHandoff;

    if (!planningHandoffIsReady(planningHandoff)) {
      setWorkflowError(autoImplementationWorkspaceCreateBlocker(planningHandoff));
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const sourcePlanningRef = planningHandoff.finalArtifact.artifactId;
      const projectName = projections.spec?.title ?? `solo-superman-${projections.session.sessionId}`;
      const autoImplementationRuns = await client.createAutoImplementationRun({
        sessionId: projections.session.sessionId,
        idempotencyKey: `auto-implementation:${projections.session.sessionId}:${sourcePlanningRef}`,
        projectName,
        sourcePlanningRef,
        trackerTitle: `${projectName} implementation tracker`,
        trackerGoal: projections.planningHandoff?.summary ?? "Move the planning handoff into a reviewed local program repo."
      });

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation:${autoImplementationRuns.latestRun?.runId ?? Date.now()}`,
          label: "Create auto implementation workspace",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(autoImplementationWorkspaceCreateFailureMessage(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);
  const planAutoImplementationWorkerJob = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError("An active auto implementation workspace run is required before planning a local worker job.");
      return;
    }

    if (!canPlanCurrentStageAutoImplementationWorkerJob(run)) {
      setWorkflowError("Continue the latest current-stage worker with run, import, complete, or advance before planning another local worker job.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const hasReadyPlanningHandoff = projections.planningHandoff?.currentStatus === "planning_ready";
      const sourcePlanningRef = hasReadyPlanningHandoff
        ? projections.planningHandoff.finalArtifact.artifactId
        : projections.planningHandoff?.blockerArtifact.artifactId ?? `auto-implementation-run:${run.runId}`;
      const authorityResponse = await appendCommand(
        "Approve local worker authority",
        await client.createExecutionAuthority(
          buildAutoImplementationWorkerAuthorityRequest({
            sessionId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            run,
            sourcePlanningRef,
            planningSourceExists: hasReadyPlanningHandoff,
            approvedAt: new Date().toISOString()
          })
        )
      );
      const executionAuthority = requiredCommandProjection<ExecutionAuthorityLedgerProjection>(
        authorityResponse,
        "ExecutionAuthorityLedgerProjection"
      );
      const autoImplementationRuns = await client.createAutoImplementationWorkerJob({
        ...buildAutoImplementationWorkerJobRequest({
          sessionId,
          run,
          executionAuthorityRef: executionAuthority.latestRecord.recordId
        })
      });

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-worker:${autoImplementationRuns.latestRun?.runId ?? run.runId}:${Date.now()}`,
          label: "Plan authorized local Codex worker job",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections]);
  const recordAutoImplementationStageTick = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError("An active auto implementation workspace run is required before recording a stage tick.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.recordAutoImplementationStage(
        buildAutoImplementationStageTickRequest({
          sessionId,
          run,
          tickedAt: new Date().toISOString()
        })
      );

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-stage-tick:${run.runId}:${run.currentStage}:${Date.now()}`,
          label: "Record auto implementation stage tick",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const recordAutoImplementationStageLifecycleAction = useCallback(async (input: {
    readonly action: "start" | "pause" | "block";
    readonly label: string;
    readonly missingRunMessage: string;
  }) => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(input.missingRunMessage);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.recordAutoImplementationStage(
        buildAutoImplementationStageLifecycleRequest({
          sessionId,
          run,
          action: input.action,
          tickedAt: new Date().toISOString()
        })
      );

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-stage-${input.action}:${run.runId}:${run.currentStage}:${Date.now()}`,
          label: input.label,
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const startAutoImplementationStage = useCallback(
    () => recordAutoImplementationStageLifecycleAction({
      action: "start",
      label: "Start auto implementation stage",
      missingRunMessage: "An active auto implementation workspace run is required before starting a stage."
    }),
    [recordAutoImplementationStageLifecycleAction]
  );

  const pauseAutoImplementationStage = useCallback(
    () => recordAutoImplementationStageLifecycleAction({
      action: "pause",
      label: "Pause auto implementation stage",
      missingRunMessage: "An active auto implementation workspace run is required before pausing a stage."
    }),
    [recordAutoImplementationStageLifecycleAction]
  );

  const blockAutoImplementationStage = useCallback(
    () => recordAutoImplementationStageLifecycleAction({
      action: "block",
      label: "Block auto implementation stage",
      missingRunMessage: "An active auto implementation workspace run is required before blocking a stage."
    }),
    [recordAutoImplementationStageLifecycleAction]
  );

  const completeAutoImplementationWorkerJobFromLedger = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError("An active auto implementation workspace run is required before completing a worker from ledger evidence.");
      return;
    }

    const request = buildAutoImplementationWorkerCompletionRequest({
      sessionId,
      run,
      ledger: projections.implementationStepLedger
    });

    if (!request) {
      setWorkflowError("A planned or ledger-blocked current-stage worker and a completed ImplementationStepLedger step are required before completing the worker.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.completeAutoImplementationWorkerJob(request);
      const implementationStepLedger = await client.getImplementationStepLedger(sessionId);

      setProjections((current) => ({
        ...current,
        autoImplementationRuns,
        implementationStepLedger
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-worker-complete:${request.jobId}:${Date.now()}`,
          label: "Complete worker from ledger",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const runAutoImplementationWorkerJob = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;
    const workerJob = latestCurrentStageAutoImplementationWorkerJob(run ?? null);

    if (!client || !sessionId || !run || !workerJob) {
      setWorkflowError("A planned local Codex worker job is required before running the worker.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.runAutoImplementationWorkerJob({
        sessionId,
        runId: run.runId,
        jobId: workerJob.jobId,
        idempotencyKey: `auto-implementation-worker-run:${sessionId}:${workerJob.jobId}:${workerJob.updatedAt}`,
        evidenceRefs: [`ui-worker-run:${workerJob.jobId}`]
      });
      const implementationStepLedger = await client.getImplementationStepLedger(sessionId);

      setProjections((current) => ({
        ...current,
        autoImplementationRuns,
        implementationStepLedger
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-worker-run:${workerJob.jobId}:${Date.now()}`,
          label: "Run local Codex worker job",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const importAutoImplementationWorkerLedgerFromDraft = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError("An active auto implementation workspace run is required before importing worker ledger evidence.");
      return;
    }

    const { error, request } = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId,
      run,
      draft: workerLedgerImportDraft,
      importedAt: new Date().toISOString()
    });

    if (!request) {
      setWorkflowError(error ?? "Worker ledger import request could not be prepared.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.importAutoImplementationWorkerLedger(request);
      const implementationStepLedger = await client.getImplementationStepLedger(sessionId);

      setWorkerLedgerImportDraft("");
      setProjections((current) => ({
        ...current,
        autoImplementationRuns,
        implementationStepLedger
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-worker-ledger-import:${request.jobId}:${Date.now()}`,
          label: "Import worker ledger evidence",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (caughtError) {
      setWorkflowError(displayError(caughtError));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections, workerLedgerImportDraft]);

  const advanceAutoImplementationWorkerStage = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;
    const workerJob = latestCurrentStageAutoImplementationWorkerJob(run ?? null);

    if (!client || !sessionId || !run || !workerJob) {
      setWorkflowError("A completed local Codex worker job is required before advancing the worker stage.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.advanceAutoImplementationWorkerStage({
        sessionId,
        runId: run.runId,
        jobId: workerJob.jobId,
        idempotencyKey: `auto-implementation-worker-stage:${sessionId}:${workerJob.jobId}:${workerJob.updatedAt}`,
        evidenceRefs: [`ui-worker-stage-advance:${workerJob.jobId}`]
      });

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation-worker-stage:${workerJob.jobId}:${Date.now()}`,
          label: "Advance worker stage",
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const recordAutoImplementationGitHubIssueMutationRun = useCallback(async (input: {
    readonly buildRequest: (
      requestInput: {
        readonly sessionId: SessionId;
        readonly run: AutoImplementationRun;
      }
    ) => CreateAutoImplementationRunRequest;
    readonly missingRunMessage: string;
    readonly logIdPrefix: string;
    readonly label: string;
    readonly canSubmit?: (run: AutoImplementationRun) => boolean;
    readonly blockedMessage?: string;
  }) => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(input.missingRunMessage);
      return;
    }

    if (input.canSubmit && !input.canSubmit(run)) {
      setWorkflowError(input.blockedMessage ?? "This auto implementation GitHub issue mutation is not available for the current run state.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.createAutoImplementationRun(
        input.buildRequest({ sessionId, run })
      );

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `${input.logIdPrefix}:${run.runId}:${Date.now()}`,
          label: input.label,
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const recordAutoImplementationGitHubIssueDryRun = useCallback(
    () => recordAutoImplementationGitHubIssueMutationRun({
      buildRequest: buildAutoImplementationGitHubIssueDryRunRequest,
      missingRunMessage: "An active auto implementation workspace run is required before recording a GitHub issue dry-run.",
      logIdPrefix: "auto-implementation-github-issue-dry-run",
      label: "Record GitHub issue dry-run"
    }),
    [recordAutoImplementationGitHubIssueMutationRun]
  );

  const applyAutoImplementationGitHubIssueCreation = useCallback(
    () => recordAutoImplementationGitHubIssueMutationRun({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationGitHubIssueApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: "An active auto implementation workspace run is required before applying approved GitHub issue creation.",
      logIdPrefix: "auto-implementation-github-issue-approved",
      label: "Apply approved GitHub issues",
      canSubmit: canCreateAutoImplementationGitHubIssues,
      blockedMessage: "GitHub issue URLs are already recorded; continue with the existing generated issues instead of creating duplicates."
    }),
    [recordAutoImplementationGitHubIssueMutationRun]
  );

  const recordAutoImplementationPullRequestMutationAction = useCallback(async (input: {
    readonly buildRequest: (
      requestInput: {
        readonly sessionId: SessionId;
        readonly run: AutoImplementationRun;
      }
    ) => RecordAutoImplementationPullRequestMutationRequest;
    readonly missingRunMessage: string;
    readonly logIdPrefix: string;
    readonly label: string;
    readonly canSubmit?: (run: AutoImplementationRun) => boolean;
    readonly blockedMessage?: string;
  }) => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(input.missingRunMessage);
      return;
    }

    if (input.canSubmit && !input.canSubmit(run)) {
      setWorkflowError(input.blockedMessage ?? "This auto implementation PR mutation is not available for the current run state.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.recordAutoImplementationPullRequestMutation(
        input.buildRequest({ sessionId, run })
      );

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `${input.logIdPrefix}:${run.runId}:${Date.now()}`,
          label: input.label,
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [client, projections]);

  const recordAutoImplementationPullRequestOpenDryRun = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: buildAutoImplementationPullRequestOpenDryRunRequest,
      missingRunMessage: "An active auto implementation workspace run is required before recording a PR open dry-run.",
      logIdPrefix: "auto-implementation-pr-open-dry-run",
      label: "Record PR open dry-run"
    }),
    [recordAutoImplementationPullRequestMutationAction]
  );

  const applyAutoImplementationPullRequestOpen = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationPullRequestOpenApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: "An active auto implementation workspace run is required before applying an approved PR open.",
      logIdPrefix: "auto-implementation-pr-open-approved",
      label: "Apply approved PR open",
      canSubmit: canOpenNewAutoImplementationPullRequest,
      blockedMessage: "A pull request URL is already recorded; update or merge the existing PR instead of opening another one."
    }),
    [recordAutoImplementationPullRequestMutationAction]
  );

  const recordAutoImplementationPullRequestDryRun = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: buildAutoImplementationPullRequestDryRunRequest,
      missingRunMessage: "An active auto implementation workspace run is required before recording a PR body dry-run.",
      logIdPrefix: "auto-implementation-pr-dry-run",
      label: "Record PR body dry-run"
    }),
    [recordAutoImplementationPullRequestMutationAction]
  );

  const recordAutoImplementationPullRequestMergeDryRun = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: buildAutoImplementationPullRequestMergeDryRunRequest,
      missingRunMessage: "An active auto implementation workspace run is required before recording a PR merge dry-run.",
      logIdPrefix: "auto-implementation-pr-merge-dry-run",
      label: "Record PR merge dry-run"
    }),
    [recordAutoImplementationPullRequestMutationAction]
  );

  const applyAutoImplementationPullRequestBodyUpdate = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationPullRequestBodyApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: "An active auto implementation workspace run is required before applying an approved PR body update.",
      logIdPrefix: "auto-implementation-pr-body-approved",
      label: "Apply approved PR body update"
    }),
    [recordAutoImplementationPullRequestMutationAction]
  );

  const applyAutoImplementationPullRequestMerge = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationPullRequestMergeApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: "An active auto implementation workspace run is required before applying an approved PR merge.",
      logIdPrefix: "auto-implementation-pr-merge-approved",
      label: "Apply approved PR merge",
      canSubmit: canMergeAutoImplementationPullRequest,
      blockedMessage: "A pull request merge is already recorded; do not merge the same auto implementation PR again."
    }),
    [recordAutoImplementationPullRequestMutationAction]
  );

  const planningRadarAxesView = useMemo(
    () =>
      planningRadarAxes(confidence).map((axis) => ({
        ...axis,
        label: copy.rightRail.radarAxes[axis.axisId as keyof typeof copy.rightRail.radarAxes] ?? axis.label
      })),
    [confidence, copy]
  );
  const planningRadarPolygonPoints = planningRadarAxesView.map((axis) => axis.point).join(" ");
  const planningCompletenessScore = confidence?.compositeScore ?? 0;
  const planningReadinessLabel = confidence?.readinessLabel ?? copy.rightRail.pending;
  const canStart = canStartInitialQueueFlow({
    chatGptLoginAcknowledged,
    codexLoginAuthenticated: runtimeStatus?.account?.status === "authenticated",
    connectionStatus: connectionState.status,
    hasClient: Boolean(client),
    projectPurposeMode,
    businessCriticIntensity,
    idea,
    intake,
    isBusy
  });
  const activeResearchAllowlist = activeWebPublicResearchAllowlist(researchOperations.allowlists);
  const hasActiveResearchAllowlist = Boolean(activeResearchAllowlist);
  const readyReadOnlyResearchStartPlan = readyReadOnlyResearchRunStartPlan({
    research: projections.research,
    runs: researchOperations.runs,
    allowlist: activeResearchAllowlist,
    missingAllowlistMessage: MISSING_READY_RESEARCH_ALLOWLIST_MESSAGE,
    noReadyTasksMessage: NO_READY_RESEARCH_TASKS_MESSAGE,
    quietNoop: false
  });
  const readyReadOnlyResearchTaskIds =
    readyReadOnlyResearchStartPlan.status === "start" ? readyReadOnlyResearchStartPlan.taskIds : [];

  const activeQueueCount = sections.find((section) => section.id === "active")?.items.length ?? 0;
  const nextQueueCount = sections.find((section) => section.id === "next")?.items.length ?? 0;
  const blockedQueueCount = sections.find((section) => section.id === "blocked")?.items.length ?? 0;
  const totalQueueCount = sections.reduce((total, section) => total + section.items.length, 0);
  const activeResearchRunCount =
    researchOperations.runs?.runs.filter((run) => run.status === "queued" || run.status === "running" || run.status === "paused")
      .length ?? 0;
  const activePageMeta = copy.pageMeta[activePage];
  const connectionLabel = connectionState.status === "connected" ? connectionState.connection.mode : connectionState.status;
  const connectionTone = connectionState.status === "connected" ? "connected" : connectionState.status;
  const navItems = [
    {
      id: "onboarding" as const,
      label: copy.pageMeta.onboarding.label,
      sublabel: projections.queue ? copy.nav.onboardingComplete : copy.nav.onboardingReady,
      health: projections.queue ? "done" : canStart ? "active" : "pending"
    },
    {
      id: "questions" as const,
      label: copy.pageMeta.questions.label,
      sublabel: copy.nav.questionsSublabel(activeQueueCount, nextQueueCount),
      badge: totalQueueCount,
      health: activeQueueCount ? "active" : projections.queue ? "done" : "pending"
    },
    {
      id: "research" as const,
      label: copy.pageMeta.research.label,
      sublabel: copy.nav.researchSublabel(projections.research?.tasks.length ?? 0, activeResearchRunCount),
      badge: activeResearchRunCount || undefined,
      health: activeResearchRunCount ? "active" : projections.research ? "done" : "pending"
    },
    {
      id: "planning" as const,
      label: copy.pageMeta.planning.label,
      sublabel: planningHandoffView.statusLabel,
      health: planningHandoffView.status === "blocked" ? "blocked" : projections.spec ? "active" : "pending"
    },
    {
      id: "implementation" as const,
      label: copy.pageMeta.implementation.label,
      sublabel: autoImplementationRunView.hasRun ? autoImplementationRunView.status : implementationStepLedgerView.status,
      health: implementationStepLedgerView.status === "completed"
        ? "done"
        : projections.autoImplementationRuns || projections.implementationStepLedger
          ? "active"
          : "pending"
    },
    {
      id: "permissions" as const,
      label: copy.pageMeta.permissions.label,
      sublabel: copy.nav.permissionsSublabel(chatGptDelegationView.status, servicePageUsePermissionView.status),
      health:
        chatGptDelegationView.status !== "not_started" || servicePageUsePermissionView.status !== "not_started"
          ? "active"
          : "pending"
    }
  ] satisfies readonly {
    readonly id: DecisionQueuePageId;
    readonly label: string;
    readonly sublabel: string;
    readonly badge?: number | undefined;
    readonly health: PageHealth;
  }[];


  return {
    connectionState,
    idea,
    setIdea,
    intake,
    setIntake,
    chatGptLoginAcknowledged,
    setChatGptLoginAcknowledged,
    initialResearchPermission,
    setInitialResearchPermission,
    projectPurposeMode,
    setProjectPurposeMode,
    purposeModeChangeReason,
    setPurposeModeChangeReason,
    businessCriticIntensity,
    setBusinessCriticIntensity,
    initialBusinessCriticIntensityReason,
    setInitialBusinessCriticIntensityReason,
    businessCriticIntensityChangeReason,
    setBusinessCriticIntensityChangeReason,
    answerDrafts,
    setAnswerDrafts,
    knownRiskDrafts,
    setKnownRiskDrafts,
    researchDrafts,
    setResearchDrafts,
    workerLedgerImportDraft,
    setWorkerLedgerImportDraft,
    projections,
    researchOperations,
    phase15bReadiness,
    runtimeStatus,
    codexLoginStart,
    commandLog,
    statuses,
    isBusy,
    workflowError,
    activePage,
    setActivePage,
    connect,
    refreshRuntimeStatus,
    startCodexLogin,
    refreshResearchOperations,
    refreshPhase15bReadiness,
    refreshPlanningHandoff,
    refreshChatGptDelegation,
    refreshServicePageUsePermission,
    refreshImplementationStepLedger,
    refreshAutoImplementationRuns,
    refreshProjections,
    refetchQueueAfterSseNotification,
    refreshCommandStatus,
    runInitialQueueFlow,
    changeProjectPurposeMode,
    changeBusinessCriticIntensity,
    submitAnswer,
    submitDraftedActiveAnswers,
    refreshQuestionList,
    loadNextQuestionBatch,
    carryQueueItemAsKnownRisk,
    importResearchResult,
    resolveResearchCard,
    createOrReactivateAllowlist,
    pauseAllowlist,
    revokeAllowlist,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
    startReadyReadOnlyResearchRuns,
    refreshResearchRunStatus,
    cancelResearchRun,
    retryResearchRun,
    scoreCompleteness,
    prepareFounderBrief,
    runPlanningHandoffGate,
    revokeChatGptDelegation,
    revokeServicePageUsePermission,
    exportServicePageArtifacts,
    deleteServicePageArtifacts,
    createAutoImplementationRun,
    planAutoImplementationWorkerJob,
    recordAutoImplementationStageTick,
    startAutoImplementationStage,
    pauseAutoImplementationStage,
    blockAutoImplementationStage,
    completeAutoImplementationWorkerJobFromLedger,
    importAutoImplementationWorkerLedgerFromDraft,
    recordAutoImplementationGitHubIssueDryRun,
    applyAutoImplementationGitHubIssueCreation,
    recordAutoImplementationPullRequestOpenDryRun,
    applyAutoImplementationPullRequestOpen,
    recordAutoImplementationPullRequestDryRun,
    recordAutoImplementationPullRequestMergeDryRun,
    applyAutoImplementationPullRequestBodyUpdate,
    applyAutoImplementationPullRequestMerge,
    runAutoImplementationWorkerJob,
    advanceAutoImplementationWorkerStage,
    sections,
    queueRecovery,
    questionProgress,
    pendingSummary,
    runtimeActivity,
    confidence,
    phase15aOperations,
    phase15bReadinessView,
    planningHandoffView,
    chatGptDelegationView,
    servicePageUsePermissionView,
    implementationStepLedgerView,
    autoImplementationRunView,
    canCreateAutoImplementationRun,
    planningRadarAxesView,
    planningRadarPolygonPoints,
    planningCompletenessScore,
    planningReadinessLabel,
    canStart,
    hasActiveResearchAllowlist,
    readyReadOnlyResearchStartPlan,
    readyReadOnlyResearchTaskIds,
    activeQueueCount,
    nextQueueCount,
    blockedQueueCount,
    totalQueueCount,
    activeResearchRunCount,
    activePageMeta,
    connectionLabel,
    connectionTone,
    navItems,
    pageMeta: copy.pageMeta
  };
}

export type DecisionQueueShellController = ReturnType<typeof useDecisionQueueShellController>;
