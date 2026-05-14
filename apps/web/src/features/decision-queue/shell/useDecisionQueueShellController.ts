import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BusinessCriticIntensity,
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
  emptyProjectionState,
  emptyResearchOperationsState,
  PAGE_META,
  type CommandLogEntry,
  type ConnectionState,
  type DecisionQueuePageId,
  type PageHealth,
  type ProjectionState
} from "./decision-queue-shell-model";
import { planningRadarAxes } from "./planning-radar-model";
import { useCommandLogActions } from "./useCommandLogActions";
import { useDecisionQueuePlanningPermissionActions } from "./useDecisionQueuePlanningPermissionActions";
import { useDecisionQueueRefreshers } from "./useDecisionQueueRefreshers";
import { useDecisionQueueResearchActions } from "./useDecisionQueueResearchActions";
import { useDecisionQueueSessionActions } from "./useDecisionQueueSessionActions";


export function useDecisionQueueShellController() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "connecting" });
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [intake, setIntake] = useState(DEFAULT_INTAKE);
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
  const [commandLog, setCommandLog] = useState<readonly CommandLogEntry[]>([]);
  const [statuses, setStatuses] = useState<readonly StatusEndpointDto[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<DecisionQueuePageId>("questions");

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

  const { recordCommandStatus, recordCommandStatusError, appendCommand } = useCommandLogActions({
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
    client,
    idea,
    initialBusinessCriticIntensityReason,
    intake,
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
    setWorkflowError
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

  const sections = useMemo(() => queueSections(projections.queue), [projections.queue]);
  const queueRecovery = useMemo(() => decisionQueueRecoveryViewModel(projections.queue), [projections.queue]);
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
  const planningRadarAxesView = useMemo(() => planningRadarAxes(confidence), [confidence]);
  const planningRadarPolygonPoints = planningRadarAxesView.map((axis) => axis.point).join(" ");
  const planningCompletenessScore = confidence?.compositeScore ?? 0;
  const planningReadinessLabel = confidence?.readinessLabel ?? "pending";
  const canStart =
    connectionState.status === "connected" &&
    Boolean(client) &&
    Boolean(projectPurposeMode) &&
    (projectPurposeMode !== "business" || Boolean(businessCriticIntensity)) &&
    Boolean(idea.trim()) &&
    Boolean(intake.trim()) &&
    !isBusy;
  const hasActiveResearchAllowlist =
    researchOperations.allowlists?.allowlists.some((allowlist) => allowlist.status === "active") ?? false;

  const activeQueueCount = sections.find((section) => section.id === "active")?.items.length ?? 0;
  const nextQueueCount = sections.find((section) => section.id === "next")?.items.length ?? 0;
  const blockedQueueCount = sections.find((section) => section.id === "blocked")?.items.length ?? 0;
  const totalQueueCount = sections.reduce((total, section) => total + section.items.length, 0);
  const activeResearchRunCount =
    researchOperations.runs?.runs.filter((run) => run.status === "queued" || run.status === "running" || run.status === "paused")
      .length ?? 0;
  const activePageMeta = PAGE_META[activePage];
  const connectionLabel = connectionState.status === "connected" ? connectionState.connection.mode : connectionState.status;
  const connectionTone = connectionState.status === "connected" ? "connected" : connectionState.status;
  const navItems = [
    {
      id: "questions" as const,
      label: PAGE_META.questions.label,
      sublabel: `${activeQueueCount} active · ${nextQueueCount} next`,
      badge: totalQueueCount,
      health: activeQueueCount ? "active" : projections.queue ? "done" : "pending"
    },
    {
      id: "research" as const,
      label: PAGE_META.research.label,
      sublabel: `${projections.research?.tasks.length ?? 0} tasks · ${activeResearchRunCount} runs`,
      badge: activeResearchRunCount || undefined,
      health: activeResearchRunCount ? "active" : projections.research ? "done" : "pending"
    },
    {
      id: "planning" as const,
      label: PAGE_META.planning.label,
      sublabel: planningHandoffView.statusLabel,
      health: planningHandoffView.status === "blocked" ? "blocked" : projections.spec ? "active" : "pending"
    },
    {
      id: "implementation" as const,
      label: PAGE_META.implementation.label,
      sublabel: implementationStepLedgerView.status,
      health: implementationStepLedgerView.status === "completed" ? "done" : projections.implementationStepLedger ? "active" : "pending"
    },
    {
      id: "permissions" as const,
      label: PAGE_META.permissions.label,
      sublabel: `${chatGptDelegationView.status} · ${servicePageUsePermissionView.status}`,
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
    client,
    idea,
    setIdea,
    intake,
    setIntake,
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
    commandLog,
    statuses,
    isBusy,
    workflowError,
    activePage,
    setActivePage,
    connect,
    refreshResearchOperations,
    refreshPhase15bReadiness,
    refreshPlanningHandoff,
    refreshChatGptDelegation,
    refreshServicePageUsePermission,
    refreshImplementationStepLedger,
    refreshProjections,
    refetchQueueAfterSseNotification,
    recordCommandStatus,
    recordCommandStatusError,
    appendCommand,
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
    navItems
  };
}

export type DecisionQueueShellController = ReturnType<typeof useDecisionQueueShellController>;
