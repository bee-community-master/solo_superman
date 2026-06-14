import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CODEX_SDK_PACKAGE_VERSION,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  canCreateAutoImplementationGitHubIssues,
  canMergeAutoImplementationPullRequest,
  canOpenNewAutoImplementationPullRequest,
  type AutoImplementationRun,
  type AutoImplementationRunProjection,
  type BusinessCriticIntensity,
  type CodexRuntimeLoginStartDto,
  type CodexRuntimeStatusDto,
  type CreateAutoImplementationRunRequest,
  type ExecutionAuthorityLedgerProjection,
  type Phase15bUpgradeHintProjection,
  type ProjectId,
  type ProjectPurposeMode,
  type RecordAutoImplementationPullRequestMutationRequest,
  type ResearchRunControlProjection,
  type SessionId,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import { autoImplementationRunViewModel, type AutoImplementationRunViewModel } from "../AutoImplementationRunPanel";
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
import { chatGptDelegationViewModel, type ChatGptDelegationViewModel } from "../ChatGptDelegationPanel";
import {
  implementationStepLedgerViewModel,
  type ImplementationStepLedgerViewModel
} from "../ImplementationStepLedgerPanel";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import {
  servicePageUsePermissionViewModel,
  type ServicePageUsePermissionViewModel
} from "../ServicePageUsePermissionPanel";
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
  displayError,
  emptyProjectionState,
  emptyResearchOperationsState,
  initialQueueStartBlockerList,
  latestCommandBackedProjectionVersion,
  type CommandLogEntry,
  type ConnectionState,
  type DecisionQueuePageId,
  type InitialResearchAutomationPermission,
  type PageHealth,
  type ProjectionState
} from "./decision-queue-shell-model";
import { useDecisionQueueCopy, type DecisionQueueCopy } from "./decision-queue-copy";
import { useAppLanguage } from "../../../shared/i18n/app-language";
import { planningRadarAxes } from "./planning-radar-model";
import { useCommandLogActions } from "./useCommandLogActions";
import { useDecisionQueuePlanningPermissionActions } from "./useDecisionQueuePlanningPermissionActions";
import {
  loadResearchSettledDecisionQueueRefresh,
  useDecisionQueueRefreshers
} from "./useDecisionQueueRefreshers";
import { useDecisionQueueResearchActions } from "./useDecisionQueueResearchActions";
import { useDecisionQueueSessionActions } from "./useDecisionQueueSessionActions";

export const RESEARCH_RUN_BACKGROUND_POLL_INTERVAL_MS = 10_000;
const RESTORE_SESSION_STORAGE_KEY = "solo-superman:last-decision-queue-session";
const RESTORE_QUERY_PROJECT_ID = "projectId";
const RESTORE_QUERY_SESSION_ID = "sessionId";

interface RestorableDecisionQueueSession {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
}

export function readRestorableSession(): RestorableDecisionQueueSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const query = new URLSearchParams(window.location.search);
  const queryProjectId = query.get(RESTORE_QUERY_PROJECT_ID);
  const querySessionId = query.get(RESTORE_QUERY_SESSION_ID);

  if (queryProjectId && querySessionId) {
    return {
      projectId: queryProjectId as ProjectId,
      sessionId: querySessionId as SessionId
    };
  }

  try {
    const stored = window.localStorage.getItem(RESTORE_SESSION_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<RestorableDecisionQueueSession>;

    if (typeof parsed.projectId === "string" && typeof parsed.sessionId === "string") {
      return {
        projectId: parsed.projectId as ProjectId,
        sessionId: parsed.sessionId as SessionId
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function persistRestorableSession(session: RestorableDecisionQueueSession) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RESTORE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Local storage can be unavailable in private or locked-down browsers.
  }

  const url = new URL(window.location.href);
  url.searchParams.set(RESTORE_QUERY_PROJECT_ID, session.projectId);
  url.searchParams.set(RESTORE_QUERY_SESSION_ID, session.sessionId);
  window.history.replaceState(window.history.state, "", url);
}

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
    sdkPackageVersion: CODEX_SDK_PACKAGE_VERSION,
    codexCliVersion: null,
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

export function connectionStatusLabel(connectionState: ConnectionState, copy: DecisionQueueCopy) {
  return connectionState.status === "connected"
    ? copy.layout.localServiceConnected
    : copy.layout.localServiceUnavailableStatus;
}

export function planningNavSublabel(
  status: ReturnType<typeof planningHandoffViewModel>["status"],
  copy: DecisionQueueCopy
) {
  if (status === "final") {
    return copy.nav.planningReady;
  }

  if (status === "blocked") {
    return copy.nav.planningBlocked;
  }

  return copy.nav.planningPending;
}

export function implementationNavSublabel(
  runStatus: AutoImplementationRunViewModel["status"] | null,
  ledgerStatus: ImplementationStepLedgerViewModel["status"],
  copy: DecisionQueueCopy
) {
  if (runStatus) {
    return copy.autoImplementation.runStatusLabels[runStatus];
  }

  return copy.nav.implementationLedgerStatusLabels[ledgerStatus];
}

export function permissionNavStatusLabel(
  status: ChatGptDelegationViewModel["status"] | ServicePageUsePermissionViewModel["status"],
  copy: DecisionQueueCopy
) {
  return copy.nav.permissionStatusLabels[status];
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

function nextPlanningIssueIdForAutoImplementationRun(input: {
  readonly planningHandoff: PlanningReadyHandoffProjection;
  readonly autoImplementationRuns: ProjectionState["autoImplementationRuns"];
}) {
  const completedPlanningIssueIds = new Set(
    (input.autoImplementationRuns?.runs ?? []).flatMap((run) =>
      run.issueManagement.planningIssueDocs
        .filter((issue) => issue.status === "completed")
        .map((issue) => issue.issueId)
    )
  );
  const nextPlan = input.planningHandoff.finalArtifact.prIssuePlan.find((plan) =>
    !completedPlanningIssueIds.has(plan.sequenceId)
  ) ?? input.planningHandoff.finalArtifact.prIssuePlan.at(-1) ?? null;

  return nextPlan?.sequenceId ?? null;
}

export function buildAutoImplementationRunCreateRequest(input: {
  readonly session: NonNullable<ProjectionState["session"]>;
  readonly spec: ProjectionState["spec"];
  readonly planningHandoff: PlanningReadyHandoffProjection;
  readonly autoImplementationRuns: AutoImplementationRunProjection | null;
}): CreateAutoImplementationRunRequest {
  const sourcePlanningRef = input.planningHandoff.finalArtifact.artifactId;
  const planningIssueId = nextPlanningIssueIdForAutoImplementationRun({
    planningHandoff: input.planningHandoff,
    autoImplementationRuns: input.autoImplementationRuns
  });
  const projectName = input.spec?.title ?? `solo-superman-${input.session.sessionId}`;

  return {
    sessionId: input.session.sessionId,
    idempotencyKey: `auto-implementation:${input.session.sessionId}:${sourcePlanningRef}:${planningIssueId ?? "all"}`,
    projectName,
    sourcePlanningRef,
    ...(planningIssueId ? { planningIssueId } : {}),
    trackerTitle: `${projectName} implementation tracker`,
    trackerGoal: input.planningHandoff.summary ?? "Move the planning handoff into a reviewed local program repo."
  };
}

export function researchRunControlHasPollableRuns(runs: ResearchRunControlProjection | null | undefined) {
  return runs?.runs.some((run) => run.status === "queued" || run.status === "running") ?? false;
}

type AutoImplementationActionErrors = DecisionQueueCopy["autoImplementation"]["actionErrors"];

export function autoImplementationWorkspaceCreateBlocker(
  planningHandoff: ProjectionState["planningHandoff"],
  actionErrors: Pick<AutoImplementationActionErrors, "planningHandoffMustBeReady" | "planningHandoffRequired">
) {
  if (planningHandoffIsReady(planningHandoff)) {
    return null;
  }

  return planningHandoff ? actionErrors.planningHandoffMustBeReady : actionErrors.planningHandoffRequired;
}

export function autoImplementationWorkspaceCreateFailureMessage(
  error: unknown,
  actionErrors: Pick<AutoImplementationActionErrors, "workspaceCreationFailed">
) {
  return actionErrors.workspaceCreationFailed(displayError(error));
}

export function useDecisionQueueShellController() {
  const copy = useDecisionQueueCopy();
  const { language } = useAppLanguage();
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "connecting" });
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [intake, setIntake] = useState(DEFAULT_INTAKE);
  const [chatGptLoginAcknowledged, setChatGptLoginAcknowledged] = useState(false);
  const [initialResearchAutomationPermission, setInitialResearchAutomationPermission] =
    useState<InitialResearchAutomationPermission>("allow_codex");
  const [projectPurposeMode, setProjectPurposeMode] = useState<ProjectPurposeMode | null>(null);
  const [purposeModeChangeReason, setPurposeModeChangeReason] = useState("");
  const [businessCriticIntensity, setBusinessCriticIntensity] = useState<BusinessCriticIntensity | null>(null);
  const [initialBusinessCriticIntensityReason, setInitialBusinessCriticIntensityReason] = useState("");
  const [businessCriticIntensityChangeReason, setBusinessCriticIntensityChangeReason] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [recentResearchAnswers, setRecentResearchAnswers] = useState<readonly string[]>([]);
  const [questionBatchSize, setQuestionBatchSize] = useState(1);
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
    const restorableSession = readRestorableSession();

    if (restorableSession) {
      loadResearchSettledDecisionQueueRefresh(nextClient, restorableSession.projectId, restorableSession.sessionId)
        .then(({ projections: restoredProjections, researchOperations: restoredResearchOperations }) => {
          if (!restoredProjections.session) {
            throw new Error("복구할 세션 정보를 찾을 수 없습니다.");
          }

          setProjections((current) => ({
            ...current,
            ...restoredProjections
          }));
          setResearchOperations(restoredResearchOperations);
          setProjectPurposeMode(restoredProjections.session.projectPurposeMode ?? null);
          setBusinessCriticIntensity(restoredProjections.session.businessCriticIntensity ?? null);
          setInitialResearchAutomationPermission(
            restoredProjections.session.initialResearchAutomationPermission ?? "allow_codex"
          );
          setActivePage("questions");
          persistRestorableSession(restorableSession);
        })
        .catch((error) => {
          const message = displayError(error);

          setWorkflowError(`이전 작업을 다시 여는 데 실패했습니다: ${message}`);
        });
    }
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
    updateAllowlistMaxConcurrentRuns,
    updateAllowlistMaxRunsPerSession,
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
    copy,
    projections,
    recentResearchAnswers,
    refreshProjections,
    refreshResearchOperations,
    researchOperations,
    setIsBusy,
    setProjections,
    setResearchOperations,
    setWorkflowError
  });

  const {
    initialQuestionGeneration,
    keepWaitingForInitialQuestionGeneration,
    requestInitialQuestionFallback,
    retryInitialQuestionGeneration,
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
    initialResearchAutomationPermission,
    initialBusinessCriticIntensityReason,
    intake,
    isBusy,
    knownRiskDrafts,
    projectPurposeMode,
    projections,
    purposeModeChangeReason,
    questionBatchSize,
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
    onSessionCreatedForRestore: (session) => persistRestorableSession({
      projectId: session.projectId,
      sessionId: session.sessionId
    }),
    onInitialQueueCreated: () => setActivePage("questions"),
    onAnswerSubmittedForResearchContext: (answer) => {
      setRecentResearchAnswers((current) => [answer, ...current.filter((item) => item !== answer)].slice(0, 5));
    }
  });

  const {
    scoreCompleteness,
    prepareFounderBrief,
    runPlanningHandoffGate,
    prepareImplementationContext,
    revokeChatGptDelegation,
    revokeServicePageUsePermission,
    exportServicePageArtifacts,
    deleteServicePageArtifacts
  } = useDecisionQueuePlanningPermissionActions({
    appendCommand,
    client,
    copy,
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
      runtimeStatus,
      language
    ),
    [language, projections.autoImplementationRuns, projections.implementationStepLedger, runtimeStatus]
  );
  const autoImplementationCopy = copy.autoImplementation;
  const autoImplementationActionErrors = autoImplementationCopy.actionErrors;
  const canCreateAutoImplementationRun = planningHandoffIsReady(projections.planningHandoff);
  const createAutoImplementationRunFromHandoff = useCallback(async (planningHandoff: PlanningReadyHandoffProjection) => {
    if (!client || !projections.session) {
      setWorkflowError(autoImplementationActionErrors.activeSessionRequiredCreateWorkspace);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const autoImplementationRuns = await client.createAutoImplementationRun(buildAutoImplementationRunCreateRequest({
        session: projections.session,
        spec: projections.spec,
        planningHandoff,
        autoImplementationRuns: projections.autoImplementationRuns
      }));

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
      setCommandLog((current) => [
        {
          id: `auto-implementation:${autoImplementationRuns.latestRun?.runId ?? Date.now()}`,
          label: autoImplementationCopy.create,
          createdAt: new Date().toISOString(),
          message: autoImplementationRuns.summary
        },
        ...current
      ].slice(0, COMMAND_LOG_LIMIT));
    } catch (error) {
      setWorkflowError(autoImplementationWorkspaceCreateFailureMessage(error, autoImplementationActionErrors));
    } finally {
      setIsBusy(false);
    }
  }, [autoImplementationActionErrors, autoImplementationCopy.create, client, projections]);
  const createAutoImplementationRun = useCallback(async () => {
    const planningHandoff = projections.planningHandoff;

    if (!planningHandoffIsReady(planningHandoff)) {
      setWorkflowError(autoImplementationWorkspaceCreateBlocker(planningHandoff, autoImplementationActionErrors));
      return;
    }

    await createAutoImplementationRunFromHandoff(planningHandoff);
  }, [autoImplementationActionErrors, createAutoImplementationRunFromHandoff, projections.planningHandoff]);
  const prepareImplementationContextAndCreateRun = useCallback(async () => {
    const planningHandoff = await prepareImplementationContext();

    if (!planningHandoff) {
      return;
    }

    if (!planningHandoffIsReady(planningHandoff)) {
      setWorkflowError(autoImplementationWorkspaceCreateBlocker(planningHandoff, autoImplementationActionErrors));
      return;
    }

    await createAutoImplementationRunFromHandoff(planningHandoff);
  }, [autoImplementationActionErrors, createAutoImplementationRunFromHandoff, prepareImplementationContext]);
  const planAutoImplementationWorkerJob = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(autoImplementationActionErrors.activeRunRequiredPlanWorker);
      return;
    }

    if (!canPlanCurrentStageAutoImplementationWorkerJob(run)) {
      setWorkflowError(autoImplementationActionErrors.currentStageWorkerMustContinue);
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
        autoImplementationCopy.approveLocalWorkerAuthority,
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
          label: autoImplementationCopy.planWorkerJob,
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
  }, [
    appendCommand,
    autoImplementationActionErrors,
    autoImplementationCopy.planWorkerJob,
    client,
    projections
  ]);
  const recordAutoImplementationStageTick = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(autoImplementationActionErrors.activeRunRequiredStageTick);
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
          label: autoImplementationCopy.recordStageTick,
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
  }, [
    autoImplementationActionErrors.activeRunRequiredStageTick,
    autoImplementationCopy.recordStageTick,
    client,
    projections
  ]);

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
      label: autoImplementationCopy.startStage,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredStartStage
    }),
    [
      autoImplementationActionErrors.activeRunRequiredStartStage,
      autoImplementationCopy.startStage,
      recordAutoImplementationStageLifecycleAction
    ]
  );

  const pauseAutoImplementationStage = useCallback(
    () => recordAutoImplementationStageLifecycleAction({
      action: "pause",
      label: autoImplementationCopy.pauseStage,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredPauseStage
    }),
    [
      autoImplementationActionErrors.activeRunRequiredPauseStage,
      autoImplementationCopy.pauseStage,
      recordAutoImplementationStageLifecycleAction
    ]
  );

  const blockAutoImplementationStage = useCallback(
    () => recordAutoImplementationStageLifecycleAction({
      action: "block",
      label: autoImplementationCopy.blockStage,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredBlockStage
    }),
    [
      autoImplementationActionErrors.activeRunRequiredBlockStage,
      autoImplementationCopy.blockStage,
      recordAutoImplementationStageLifecycleAction
    ]
  );

  const completeAutoImplementationWorkerJobFromLedger = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(autoImplementationActionErrors.activeRunRequiredCompleteWorker);
      return;
    }

    const request = buildAutoImplementationWorkerCompletionRequest({
      sessionId,
      run,
      ledger: projections.implementationStepLedger
    });

    if (!request) {
      setWorkflowError(autoImplementationActionErrors.completedLedgerRequiredCompleteWorker);
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
          label: autoImplementationCopy.completeWorkerJob,
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
  }, [
    autoImplementationActionErrors.activeRunRequiredCompleteWorker,
    autoImplementationActionErrors.completedLedgerRequiredCompleteWorker,
    autoImplementationCopy.completeWorkerJob,
    client,
    projections
  ]);

  const runAutoImplementationWorkerJob = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;
    const workerJob = latestCurrentStageAutoImplementationWorkerJob(run ?? null);

    if (!client || !sessionId || !run || !workerJob) {
      setWorkflowError(autoImplementationActionErrors.plannedWorkerRequiredRunWorker);
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
          label: autoImplementationCopy.runWorkerJob,
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
  }, [
    autoImplementationActionErrors.plannedWorkerRequiredRunWorker,
    autoImplementationCopy.runWorkerJob,
    client,
    projections
  ]);

  const importAutoImplementationWorkerLedgerFromDraft = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;

    if (!client || !sessionId || !run) {
      setWorkflowError(autoImplementationActionErrors.activeRunRequiredImportWorkerLedger);
      return;
    }

    const { error, request } = buildAutoImplementationWorkerLedgerImportRequest({
      sessionId,
      run,
      draft: workerLedgerImportDraft,
      importedAt: new Date().toISOString()
    });

    if (!request) {
      setWorkflowError(error ?? autoImplementationActionErrors.workerLedgerImportPrepareFailed);
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
          label: autoImplementationCopy.importWorkerLedger,
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
  }, [
    autoImplementationActionErrors.activeRunRequiredImportWorkerLedger,
    autoImplementationActionErrors.workerLedgerImportPrepareFailed,
    autoImplementationCopy.importWorkerLedger,
    client,
    projections,
    workerLedgerImportDraft
  ]);

  const advanceAutoImplementationWorkerStage = useCallback(async () => {
    const sessionId = projections.session?.sessionId;
    const run = projections.autoImplementationRuns?.latestRun;
    const workerJob = latestCurrentStageAutoImplementationWorkerJob(run ?? null);

    if (!client || !sessionId || !run || !workerJob) {
      setWorkflowError(autoImplementationActionErrors.completedWorkerRequiredAdvanceStage);
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
          label: autoImplementationCopy.advanceWorkerStage,
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
  }, [
    autoImplementationActionErrors.completedWorkerRequiredAdvanceStage,
    autoImplementationCopy.advanceWorkerStage,
    client,
    projections
  ]);

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
      setWorkflowError(input.blockedMessage ?? autoImplementationActionErrors.githubIssueMutationUnavailable);
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
  }, [autoImplementationActionErrors.githubIssueMutationUnavailable, client, projections]);

  const recordAutoImplementationGitHubIssueDryRun = useCallback(
    () => recordAutoImplementationGitHubIssueMutationRun({
      buildRequest: buildAutoImplementationGitHubIssueDryRunRequest,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredRecordGitHubIssueDryRun,
      logIdPrefix: "auto-implementation-github-issue-dry-run",
      label: autoImplementationCopy.recordGitHubIssueDryRun
    }),
    [
      autoImplementationActionErrors.activeRunRequiredRecordGitHubIssueDryRun,
      autoImplementationCopy.recordGitHubIssueDryRun,
      recordAutoImplementationGitHubIssueMutationRun
    ]
  );

  const applyAutoImplementationGitHubIssueCreation = useCallback(
    () => recordAutoImplementationGitHubIssueMutationRun({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationGitHubIssueApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredApplyGitHubIssueCreation,
      logIdPrefix: "auto-implementation-github-issue-approved",
      label: autoImplementationCopy.applyGitHubIssueCreation,
      canSubmit: canCreateAutoImplementationGitHubIssues,
      blockedMessage: autoImplementationActionErrors.githubIssueAlreadyRecorded
    }),
    [
      autoImplementationActionErrors.activeRunRequiredApplyGitHubIssueCreation,
      autoImplementationActionErrors.githubIssueAlreadyRecorded,
      autoImplementationCopy.applyGitHubIssueCreation,
      recordAutoImplementationGitHubIssueMutationRun
    ]
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
      setWorkflowError(input.blockedMessage ?? autoImplementationActionErrors.pullRequestMutationUnavailable);
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
  }, [autoImplementationActionErrors.pullRequestMutationUnavailable, client, projections]);

  const recordAutoImplementationPullRequestOpenDryRun = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: buildAutoImplementationPullRequestOpenDryRunRequest,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredRecordPullRequestOpenDryRun,
      logIdPrefix: "auto-implementation-pr-open-dry-run",
      label: autoImplementationCopy.recordPullRequestOpenDryRun
    }),
    [
      autoImplementationActionErrors.activeRunRequiredRecordPullRequestOpenDryRun,
      autoImplementationCopy.recordPullRequestOpenDryRun,
      recordAutoImplementationPullRequestMutationAction
    ]
  );

  const applyAutoImplementationPullRequestOpen = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationPullRequestOpenApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredApplyPullRequestOpen,
      logIdPrefix: "auto-implementation-pr-open-approved",
      label: autoImplementationCopy.applyPullRequestOpen,
      canSubmit: canOpenNewAutoImplementationPullRequest,
      blockedMessage: autoImplementationActionErrors.pullRequestAlreadyRecorded
    }),
    [
      autoImplementationActionErrors.activeRunRequiredApplyPullRequestOpen,
      autoImplementationActionErrors.pullRequestAlreadyRecorded,
      autoImplementationCopy.applyPullRequestOpen,
      recordAutoImplementationPullRequestMutationAction
    ]
  );

  const recordAutoImplementationPullRequestDryRun = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: buildAutoImplementationPullRequestDryRunRequest,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredRecordPullRequestDryRun,
      logIdPrefix: "auto-implementation-pr-dry-run",
      label: autoImplementationCopy.recordPullRequestDryRun
    }),
    [
      autoImplementationActionErrors.activeRunRequiredRecordPullRequestDryRun,
      autoImplementationCopy.recordPullRequestDryRun,
      recordAutoImplementationPullRequestMutationAction
    ]
  );

  const recordAutoImplementationPullRequestMergeDryRun = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: buildAutoImplementationPullRequestMergeDryRunRequest,
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredRecordPullRequestMergeDryRun,
      logIdPrefix: "auto-implementation-pr-merge-dry-run",
      label: autoImplementationCopy.recordPullRequestMergeDryRun
    }),
    [
      autoImplementationActionErrors.activeRunRequiredRecordPullRequestMergeDryRun,
      autoImplementationCopy.recordPullRequestMergeDryRun,
      recordAutoImplementationPullRequestMutationAction
    ]
  );

  const applyAutoImplementationPullRequestBodyUpdate = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationPullRequestBodyApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredApplyPullRequestBodyUpdate,
      logIdPrefix: "auto-implementation-pr-body-approved",
      label: autoImplementationCopy.applyPullRequestBodyUpdate
    }),
    [
      autoImplementationActionErrors.activeRunRequiredApplyPullRequestBodyUpdate,
      autoImplementationCopy.applyPullRequestBodyUpdate,
      recordAutoImplementationPullRequestMutationAction
    ]
  );

  const applyAutoImplementationPullRequestMerge = useCallback(
    () => recordAutoImplementationPullRequestMutationAction({
      buildRequest: ({ run, sessionId }) =>
        buildAutoImplementationPullRequestMergeApprovedRequest({
          run,
          sessionId,
          approvedAt: new Date().toISOString()
        }),
      missingRunMessage: autoImplementationActionErrors.activeRunRequiredApplyPullRequestMerge,
      logIdPrefix: "auto-implementation-pr-merge-approved",
      label: autoImplementationCopy.applyPullRequestMerge,
      canSubmit: canMergeAutoImplementationPullRequest,
      blockedMessage: autoImplementationActionErrors.pullRequestMergeAlreadyRecorded
    }),
    [
      autoImplementationActionErrors.activeRunRequiredApplyPullRequestMerge,
      autoImplementationActionErrors.pullRequestMergeAlreadyRecorded,
      autoImplementationCopy.applyPullRequestMerge,
      recordAutoImplementationPullRequestMutationAction
    ]
  );

  const planningRadarAxesView = useMemo(
    () => planningRadarAxes(confidence, copy.rightRail.radarAxes),
    [confidence, copy.rightRail.radarAxes]
  );
  const planningRadarPolygonPoints = planningRadarAxesView.map((axis) => axis.point).join(" ");
  const planningCompletenessScore = confidence?.compositeScore ?? 0;
  const planningReadinessLabel = confidence?.readinessLabel ?? copy.rightRail.pending;
  const initialQueueStartReadinessInput = {
    chatGptLoginAcknowledged,
    codexLoginAuthenticated: runtimeStatus?.account?.status === "authenticated",
    connectionStatus: connectionState.status,
    hasClient: Boolean(client),
    initialResearchAutomationPermission,
    projectPurposeMode,
    businessCriticIntensity,
    idea,
    intake,
    isBusy
  };
  const initialQueueStartBlockers = initialQueueStartBlockerList(initialQueueStartReadinessInput);
  const initialQueueStartBlockerMessages = initialQueueStartBlockers.map((blocker) => copy.questions.initialQueueStartBlockers[blocker]);
  const canStart = initialQueueStartBlockers.length === 0;
  const activeResearchAllowlist = activeWebPublicResearchAllowlist(researchOperations.allowlists);
  const hasActiveResearchAllowlist = Boolean(activeResearchAllowlist);
  const readyReadOnlyResearchStartPlan = readyReadOnlyResearchRunStartPlan({
    research: projections.research,
    runs: researchOperations.runs,
    allowlist: activeResearchAllowlist,
    missingAllowlistMessage: copy.research.researchActionErrors.readyRunsMissingAllowlist,
    noReadyTasksMessage: copy.research.researchActionErrors.readyRunsNoReadyTasks,
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
  const shouldPollResearchRuns = researchRunControlHasPollableRuns(researchOperations.runs);

  useEffect(() => {
    if (!shouldPollResearchRuns || !projections.session) {
      return undefined;
    }

    const { projectId, sessionId } = projections.session;
    const intervalId = window.setInterval(() => {
      void refreshProjections(projectId, sessionId);
    }, RESEARCH_RUN_BACKGROUND_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [projections.session, refreshProjections, shouldPollResearchRuns]);

  const activePageMeta = copy.pageMeta[activePage];
  const connectionLabel = connectionStatusLabel(connectionState, copy);
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
      sublabel: planningNavSublabel(planningHandoffView.status, copy),
      health: planningHandoffView.status === "blocked" ? "blocked" : projections.spec ? "active" : "pending"
    },
    {
      id: "implementation" as const,
      label: copy.pageMeta.implementation.label,
      sublabel: implementationNavSublabel(
        autoImplementationRunView.hasRun ? autoImplementationRunView.status : null,
        implementationStepLedgerView.status,
        copy
      ),
      health: implementationStepLedgerView.status === "completed"
        ? "done"
        : projections.autoImplementationRuns || projections.implementationStepLedger
          ? "active"
          : "pending"
    },
    {
      id: "permissions" as const,
      label: copy.pageMeta.permissions.label,
      sublabel: copy.nav.permissionsSublabel(
        permissionNavStatusLabel(chatGptDelegationView.status, copy),
        permissionNavStatusLabel(servicePageUsePermissionView.status, copy)
      ),
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
    initialResearchAutomationPermission,
    setInitialResearchAutomationPermission,
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
    questionBatchSize,
    setQuestionBatchSize,
    knownRiskDrafts,
    setKnownRiskDrafts,
    researchDrafts,
    setResearchDrafts,
    recentResearchAnswers,
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
    initialQuestionGeneration,
    keepWaitingForInitialQuestionGeneration,
    requestInitialQuestionFallback,
    retryInitialQuestionGeneration,
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
    updateAllowlistMaxConcurrentRuns,
    updateAllowlistMaxRunsPerSession,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
    startReadyReadOnlyResearchRuns,
    refreshResearchRunStatus,
    cancelResearchRun,
    retryResearchRun,
    scoreCompleteness,
    prepareFounderBrief,
    runPlanningHandoffGate,
    prepareImplementationContext,
    revokeChatGptDelegation,
    revokeServicePageUsePermission,
    exportServicePageArtifacts,
    deleteServicePageArtifacts,
    createAutoImplementationRun,
    prepareImplementationContextAndCreateRun,
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
    initialQueueStartBlockerMessages,
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
