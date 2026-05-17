import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BusinessCriticIntensity,
  type CodexRuntimeLoginStartDto,
  type CodexRuntimeStatusDto,
  type Phase15bUpgradeHintProjection,
  type ProjectPurposeMode,
  type StatusEndpointDto
} from "@solo-superman/contracts";
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
  queueSections,
  runtimeActivityProjectionFromStatuses
} from "../decision-queue-view-model";
import {
  createSidecarClient,
  discoverSidecarConnection,
  type SidecarClient
} from "../../../shared/api/sidecar-client";
import {
  DEFAULT_IDEA,
  DEFAULT_INTAKE,
  canStartInitialQueueFlow,
  displayError,
  emptyProjectionState,
  emptyResearchOperationsState,
  type CommandLogEntry,
  type ConnectionState,
  type DecisionQueuePageId,
  type PageHealth,
  type ProjectionState
} from "./decision-queue-shell-model";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import { planningRadarAxes } from "./planning-radar-model";
import { useCommandLogActions } from "./useCommandLogActions";
import { useDecisionQueuePlanningPermissionActions } from "./useDecisionQueuePlanningPermissionActions";
import { useDecisionQueueRefreshers } from "./useDecisionQueueRefreshers";
import { useDecisionQueueResearchActions } from "./useDecisionQueueResearchActions";
import { useDecisionQueueSessionActions } from "./useDecisionQueueSessionActions";


export function useDecisionQueueShellController() {
  const copy = useDecisionQueueCopy();
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "connecting" });
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [intake, setIntake] = useState(DEFAULT_INTAKE);
  const [chatGptLoginAcknowledged, setChatGptLoginAcknowledged] = useState(false);
  const [projectPurposeMode, setProjectPurposeMode] = useState<ProjectPurposeMode | null>(null);
  const [purposeModeChangeReason, setPurposeModeChangeReason] = useState("");
  const [businessCriticIntensity, setBusinessCriticIntensity] = useState<BusinessCriticIntensity | null>(null);
  const [initialBusinessCriticIntensityReason, setInitialBusinessCriticIntensityReason] = useState("");
  const [businessCriticIntensityChangeReason, setBusinessCriticIntensityChangeReason] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [knownRiskDrafts, setKnownRiskDrafts] = useState<Record<string, string>>({});
  const [researchDrafts, setResearchDrafts] = useState<Record<string, string>>({});
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
      setClient(null);
      setConnectionState({
        status: "unavailable",
        message: "Sidecar connection is unavailable."
      });
      return;
    }

    const nextClient = createSidecarClient({ connection });

    setClient(nextClient);
    setConnectionState({ status: "connected", connection });
    nextClient.getRuntimeStatus().then(setRuntimeStatus).catch(() => setRuntimeStatus(null));
  }, []);

  useEffect(() => {
    void connect();
  }, [connect]);

  const refreshRuntimeStatus = useCallback(async () => {
    if (!client) {
      await connect();
      return;
    }

    setWorkflowError(null);
    try {
      setRuntimeStatus(await client.getRuntimeStatus());
    } catch {
      setRuntimeStatus(null);
    }
  }, [client, connect]);

  const startCodexLogin = useCallback(async () => {
    if (!client) {
      await connect();
      return;
    }

    setWorkflowError(null);
    try {
      const loginStart = await client.startCodexLogin();
      setCodexLoginStart(loginStart);
      setRuntimeStatus(await client.getRuntimeStatus().catch(() => runtimeStatus));
    } catch (error) {
      setWorkflowError(displayError(error));
    }
  }, [client, connect, runtimeStatus]);

  const {
    refreshResearchOperations,
    refreshPhase15bReadiness,
    refreshPlanningHandoff,
    refreshChatGptDelegation,
    refreshServicePageUsePermission,
    refreshImplementationStepLedger,
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
    runInitialQueueFlow,
    changeProjectPurposeMode,
    changeBusinessCriticIntensity,
    submitAnswer,
    carryQueueItemAsKnownRisk,
    importResearchResult,
    resolveResearchCard
  } = useDecisionQueueSessionActions({
    answerDrafts,
    appendCommand,
    businessCriticIntensity,
    businessCriticIntensityChangeReason,
    chatGptLoginAcknowledged,
    codexLoginAuthenticated: runtimeStatus?.account.status === "authenticated",
    client,
    connectionStatus: connectionState.status,
    idea,
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
    onInitialQueueCreated: () => setActivePage("questions")
  });

  const {
    createOrReactivateAllowlist,
    pauseAllowlist,
    revokeAllowlist,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
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
      phase15aOperationsViewModel({
        allowlists: researchOperations.allowlists,
        disclosures: researchOperations.disclosures,
        runs: researchOperations.runs,
        research: projections.research
      }),
    [projections.research, researchOperations]
  );
  const phase15bReadinessView = useMemo(
    () => phase15bReadinessViewModel(phase15bReadiness),
    [phase15bReadiness]
  );
  const planningHandoffView = useMemo(
    () => planningHandoffViewModel(projections.planningHandoff),
    [projections.planningHandoff]
  );
  const chatGptDelegationView = useMemo(
    () => chatGptDelegationViewModel(projections.chatGptDelegation),
    [projections.chatGptDelegation]
  );
  const servicePageUsePermissionView = useMemo(
    () => servicePageUsePermissionViewModel(projections.servicePageUsePermission),
    [projections.servicePageUsePermission]
  );
  const implementationStepLedgerView = useMemo(
    () => implementationStepLedgerViewModel(projections.implementationStepLedger),
    [projections.implementationStepLedger]
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
    codexLoginAuthenticated: runtimeStatus?.account.status === "authenticated",
    connectionStatus: connectionState.status,
    hasClient: Boolean(client),
    projectPurposeMode,
    businessCriticIntensity,
    idea,
    intake,
    isBusy
  });
  const hasActiveResearchAllowlist =
    researchOperations.allowlists?.allowlists.some((allowlist) => allowlist.status === "active") ?? false;

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
      sublabel: implementationStepLedgerView.status,
      health: implementationStepLedgerView.status === "completed" ? "done" : projections.implementationStepLedger ? "active" : "pending"
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
    refreshProjections,
    refetchQueueAfterSseNotification,
    refreshCommandStatus,
    runInitialQueueFlow,
    changeProjectPurposeMode,
    changeBusinessCriticIntensity,
    submitAnswer,
    carryQueueItemAsKnownRisk,
    importResearchResult,
    resolveResearchCard,
    createOrReactivateAllowlist,
    pauseAllowlist,
    revokeAllowlist,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
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
    sections,
    queueRecovery,
    pendingSummary,
    runtimeActivity,
    confidence,
    phase15aOperations,
    phase15bReadinessView,
    planningHandoffView,
    chatGptDelegationView,
    servicePageUsePermissionView,
    implementationStepLedgerView,
    planningRadarAxesView,
    planningRadarPolygonPoints,
    planningCompletenessScore,
    planningReadinessLabel,
    canStart,
    hasActiveResearchAllowlist,
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
