import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BUSINESS_CRITIC_INTENSITY_LABELS,
  CONTRACT_SCHEMA_VERSION,
  PROJECT_PURPOSE_MODE_LABELS,
  type BusinessCriticIntensity,
  type CodexRuntimeStatusDto,
  type CommandResponse,
  type ConfidenceCompletionProjection,
  type DecisionQueueProjection,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type Phase15bUpgradeHintProjection,
  type PlanningHandoffProjection,
  type ProjectPurposeMode,
  type ProjectId,
  type QueueItemId,
  type ResearchAllowlistGovernanceProjection,
  type ResearchAllowlistId,
  type ResearchEvidenceProjection,
  type ResearchQueueTerminalOutcome,
  type ResearchRunControlResult,
  type ResearchRunId,
  type ResearchTaskId,
  type RuntimeActivityProjection,
  type SessionShellProjection,
  type StateVersion,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import { Phase15aOperationsPanel, type ResearchOperationsState } from "./Phase15aOperationsPanel";
import { Phase15bReadinessPanel } from "./Phase15bReadinessPanel";
import { PlanningHandoffPanel } from "./PlanningHandoffPanel";
import {
  commandResponseVersion,
  optionalCommandProjection,
  requiredCommandProjection
} from "../../shared/api/command-response-helpers";
import {
  createSidecarClient,
  discoverSidecarConnection,
  SidecarClientError,
  type SidecarClient,
  type SidecarConnection
} from "../../shared/api/sidecar-client";
import {
  confidencePlaceholder,
  decisionQueueRecoveryViewModel,
  phase15aOperationsViewModel,
  phase15bReadinessViewModel,
  planningHandoffViewModel,
  pendingEffectSummary,
  queueSections,
  runtimeActivityProjectionFromStatuses,
  shouldRefetchQueueForSseNotification
} from "./decision-queue-view-model";
import {
  buildWebResearchRunRequest,
  WEB_PUBLIC_SEARCH_CONNECTOR_ID
} from "./phase15a-research-run-request";
import { buildPlanningHandoffRequest } from "./phase2-planning-handoff-request";

type ConnectionState =
  | { readonly status: "connecting" }
  | { readonly status: "connected"; readonly connection: SidecarConnection }
  | { readonly status: "unavailable"; readonly message: string };

interface CommandLogEntry {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly response?: CommandResponse;
  readonly status?: StatusEndpointDto;
  readonly error?: string;
}

interface ProjectionState {
  readonly session: SessionShellProjection | null;
  readonly spec: LivingSpecProjection | null;
  readonly queue: DecisionQueueProjection | null;
  readonly research: ResearchEvidenceProjection | null;
  readonly activity: RuntimeActivityProjection | null;
  readonly confidence: ConfidenceCompletionProjection | null;
  readonly founderBrief: FounderBriefProjection | null;
  readonly planningHandoff: PlanningHandoffProjection | null;
}

const DEFAULT_IDEA = "A focused founder brief generator";
const DEFAULT_INTAKE =
  "Help solo founders turn a rough idea into a traceable product spec before they start building.";
const PROJECT_PURPOSE_MODE_OPTIONS = [
  {
    mode: "business",
    label: PROJECT_PURPOSE_MODE_LABELS.business,
    description: "고객, 문제 강도, 유료 의향, 경쟁, 채널, 법무/운영 리스크를 검증합니다."
  },
  {
    mode: "personal",
    label: PROJECT_PURPOSE_MODE_LABELS.personal,
    description: "시장/투자자 narrative 대신 개인 workflow, GUI, 구현 가능성, local data/security를 검증합니다."
  }
] as const satisfies readonly {
  readonly mode: ProjectPurposeMode;
  readonly label: string;
  readonly description: string;
}[];
const BUSINESS_CRITIC_INTENSITY_OPTIONS = [
  {
    intensity: "balanced",
    label: BUSINESS_CRITIC_INTENSITY_LABELS.balanced,
    description: "주요 decision group마다 최소 1개의 반대/비판 질문을 유지합니다."
  },
  {
    intensity: "strong",
    label: BUSINESS_CRITIC_INTENSITY_LABELS.strong,
    description: "high-impact business gap이 있으면 핵심 가설 반박 질문을 queued_next로 유지합니다."
  },
  {
    intensity: "investor_grade",
    label: BUSINESS_CRITIC_INTENSITY_LABELS.investor_grade,
    description: "가격, 채널, retention proxy, 법무/운영, 시장 타이밍, founder advantage를 압박 검증합니다."
  }
] as const satisfies readonly {
  readonly intensity: BusinessCriticIntensity;
  readonly label: string;
  readonly description: string;
}[];
const WEB_PUBLIC_SAFE_ALLOWLIST_ID = "research_allowlist_web_public_safe" as ResearchAllowlistId;

function displayError(error: unknown) {
  if (error instanceof SidecarClientError) {
    return `${error.apiError.code}: ${error.apiError.message}`;
  }

  return error instanceof Error ? error.message : "Unknown sidecar error.";
}

function latestProjectionVersion(projections: ProjectionState) {
  return Math.max(
    Number(projections.session?.version ?? 0),
    Number(projections.spec?.version ?? 0),
    Number(projections.queue?.version ?? 0),
    Number(projections.research?.version ?? 0),
    Number(projections.activity?.version ?? 0),
    Number(projections.confidence?.version ?? 0),
    Number(projections.founderBrief?.version ?? 0),
    Number(projections.planningHandoff?.version ?? 0)
  ) as StateVersion;
}

function emptyProjectionState(): ProjectionState {
  return {
    session: null,
    spec: null,
    queue: null,
    research: null,
    activity: null,
    confidence: null,
    founderBrief: null,
    planningHandoff: null
  };
}

function emptyResearchOperationsState(): ResearchOperationsState {
  return {
    allowlists: null,
    disclosures: null,
    runs: null
  };
}

function researchRunProjectionFromResponse(response: CommandResponse<ResearchRunControlResult>) {
  return requiredCommandProjection<ResearchRunControlResult>(response, "ResearchRunControlResult").projection;
}

function isBusinessCriticQueueItem(item: DecisionQueueProjection["active"][number]) {
  return Boolean(item.businessCriticCategory || item.businessCriticPressureKind);
}

export function DecisionQueueShell() {
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

  const refreshResearchOperations = useCallback(
    async (projectId: ProjectId) => {
      if (!client) {
        return;
      }

      const [allowlists, disclosures, runs] = await Promise.all([
        client.listResearchAllowlists(projectId),
        client.listResearchDisclosures(projectId),
        client.listResearchRuns(projectId)
      ]);

      setResearchOperations({
        allowlists,
        disclosures,
        runs
      });
    },
    [client]
  );

  const refreshPhase15bReadiness = useCallback(
    async (projectId: ProjectId) => {
      if (!client) {
        return;
      }

      setPhase15bReadiness(await client.listPhase15bUpgradeHints(projectId));
    },
    [client]
  );

  const refreshPlanningHandoff = useCallback(
    async (sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const planningHandoff = await client.getPlanningHandoff(sessionId);

      setProjections((current) => ({
        ...current,
        planningHandoff
      }));
    },
    [client]
  );

  const refreshProjections = useCallback(
    async (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const [session, spec, queue, research, activity, confidence, founderBrief, planningHandoff] = await Promise.all([
        client.getSession(projectId, sessionId),
        client.getSpec(sessionId),
        client.getQueue(sessionId),
        client.getResearch(sessionId),
        client.getActivity(sessionId),
        client.getCompleteness(sessionId),
        client.getFounderBrief(sessionId).catch(() => null),
        client.getPlanningHandoff(sessionId)
      ]);

      setProjections({
        session,
        spec,
        queue,
        research,
        activity,
        confidence,
        founderBrief,
        planningHandoff
      });
      await Promise.all([refreshResearchOperations(projectId), refreshPhase15bReadiness(projectId)]);
    },
    [client, refreshPhase15bReadiness, refreshResearchOperations]
  );

  const refetchQueueAfterSseNotification = useCallback(
    async (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"], currentQueue: DecisionQueueProjection | null) => {
      if (!client) {
        return;
      }

      try {
        const notifications = await client.readSessionEventStreamSnapshot(sessionId);
        const queueNeedsCanonicalRefetch = notifications.some((notification) =>
          shouldRefetchQueueForSseNotification(notification, currentQueue)
        );

        if (queueNeedsCanonicalRefetch) {
          await refreshProjections(projectId, sessionId);
        }
      } catch {
        // SSE snapshots are best-effort refetch hints; the command-driven refresh above remains canonical.
      }
    },
    [client, refreshProjections]
  );

  const recordCommandStatus = useCallback((status: StatusEndpointDto) => {
    setStatuses((previous) => [status, ...previous.filter((item) => item.commandId !== status.commandId)]);
    setCommandLog((previous) =>
      previous.map((item) =>
        item.response?.commandId === status.commandId
          ? {
              id: item.id,
              label: item.label,
              createdAt: item.createdAt,
              ...(item.response ? { response: item.response } : {}),
              status
            }
          : item
      )
    );
  }, []);

  const recordCommandStatusError = useCallback((commandId: CommandResponse["commandId"], error: unknown) => {
    setCommandLog((previous) =>
      previous.map((item) =>
        item.response?.commandId === commandId
          ? {
              ...item,
              error: displayError(error)
            }
          : item
      )
    );
  }, []);

  const appendCommand = useCallback(
    async <TProjection,>(label: string, response: CommandResponse<TProjection>) => {
      const id = response.commandId;
      const entry: CommandLogEntry = {
        id,
        label,
        createdAt: new Date().toISOString(),
        response: response as CommandResponse
      };

      setCommandLog((previous) => [entry, ...previous].slice(0, 8));

      if (!client || !response.statusUrl) {
        return response;
      }

      try {
        const status = await client.getCommandStatus(response.statusUrl);

        recordCommandStatus(status);
      } catch (error) {
        setCommandLog((previous) =>
          previous.map((item) =>
            item.id === id
              ? {
                  ...item,
                  error: displayError(error)
                }
              : item
          )
        );
      }

      return response;
    },
    [client, recordCommandStatus]
  );

  const runInitialQueueFlow = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!client) {
        setWorkflowError("Sidecar client is not connected.");
        return;
      }

      if (!projectPurposeMode) {
        setWorkflowError("프로젝트 목적을 사업화 검증 중심 또는 개인 workflow 구현 중심 중 하나로 선택해야 합니다.");
        return;
      }

      if (projectPurposeMode === "business" && !businessCriticIntensity) {
        setWorkflowError("상업성 검증 강도를 선택해야 사업화 검증 큐를 확정할 수 있습니다.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);
      setAnswerDrafts({});
      setCommandLog([]);
      setStatuses([]);
      setProjections(emptyProjectionState());
      setResearchOperations(emptyResearchOperationsState());
      setPhase15bReadiness(null);

      try {
        const start = await appendCommand(
          "Create project",
          await client.createProject({
            rawIdea: idea,
            localPrivacyMode: "local_only",
            projectPurposeMode,
            projectPurposeModeConfirmation: "user_confirmed",
            projectPurposeModeReason: `${PROJECT_PURPOSE_MODE_LABELS[projectPurposeMode]}으로 사용자가 시작 전에 확인했습니다.`,
            ...(projectPurposeMode === "business" && businessCriticIntensity
              ? {
                  businessCriticIntensity,
                  businessCriticIntensityConfirmation: "user_confirmed" as const,
                  businessCriticIntensityReason:
                    initialBusinessCriticIntensityReason.trim() ||
                    `${BUSINESS_CRITIC_INTENSITY_LABELS[businessCriticIntensity]}으로 사용자가 시작 전에 확인했습니다.`
                }
              : {})
          })
        );
        const session = requiredCommandProjection<SessionShellProjection>(start, "SessionShellProjection");
        setProjections({
          ...emptyProjectionState(),
          session,
        });

        const intakeResponse = await appendCommand(
          "Capture intake",
          await client.captureIntake(session.sessionId, commandResponseVersion(start), intake)
        );
        const draftResponse = await appendCommand(
          "Draft initial spec",
          await client.draftInitialSpec(session.sessionId, commandResponseVersion(intakeResponse))
        );
        const analyzeResponse = await appendCommand(
          "Analyze ambiguity",
          await client.analyzeAmbiguity(session.sessionId, commandResponseVersion(draftResponse), "current_spec")
        );
        const activateResponse = await appendCommand(
          "Activate question batch",
          await client.activateQuestionBatch(session.sessionId, commandResponseVersion(analyzeResponse))
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(activateResponse, "DecisionQueueProjection");

        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(session.projectId, session.sessionId);
        await refetchQueueAfterSseNotification(session.projectId, session.sessionId, queue);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      businessCriticIntensity,
      initialBusinessCriticIntensityReason,
      client,
      idea,
      intake,
      projectPurposeMode,
      refetchQueueAfterSseNotification,
      refreshProjections
    ]
  );

  const changeProjectPurposeMode = useCallback(
    async (nextMode: ProjectPurposeMode) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before changing the project purpose mode.");
        return;
      }

      if (nextMode === projections.session.projectPurposeMode) {
        setWorkflowError("Project purpose mode is already set to the selected value.");
        return;
      }

      const selectedOption = PROJECT_PURPOSE_MODE_OPTIONS.find((option) => option.mode === nextMode);
      const reason =
        purposeModeChangeReason.trim() ||
        `사용자가 프로젝트 목적을 ${selectedOption?.label ?? nextMode}으로 변경했습니다.`;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Change project purpose mode",
          await client.changeProjectPurposeMode({
            sessionId: projections.session.sessionId,
            expectedStateVersion: latestProjectionVersion(projections),
            projectPurposeMode: nextMode,
            suggestedProjectPurposeMode: nextMode,
            reason
          })
        );
        const session = requiredCommandProjection<SessionShellProjection>(response, "SessionShellProjection");

        setProjectPurposeMode(nextMode);
        setPurposeModeChangeReason("");
        setProjections((current) => ({
          ...current,
          session
        }));
        await refreshProjections(session.projectId, session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections, purposeModeChangeReason, refreshProjections]
  );

  const changeBusinessCriticIntensity = useCallback(
    async (nextIntensity: BusinessCriticIntensity) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before changing the business critic intensity.");
        return;
      }

      if (projections.session.projectPurposeMode !== "business") {
        setWorkflowError("상업성 검증 강도는 사업화 검증 중심 프로젝트에서만 변경할 수 있습니다.");
        return;
      }

      const selectedOption = BUSINESS_CRITIC_INTENSITY_OPTIONS.find((option) => option.intensity === nextIntensity);
      const reason =
        businessCriticIntensityChangeReason.trim() ||
        `사용자가 상업성 검증 강도를 ${selectedOption?.label ?? nextIntensity}으로 변경했습니다.`;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Change business critic intensity",
          await client.changeBusinessCriticIntensity({
            sessionId: projections.session.sessionId,
            expectedStateVersion: latestProjectionVersion(projections),
            businessCriticIntensity: nextIntensity,
            businessCriticIntensityConfirmation: "user_confirmed",
            reason
          })
        );
        const session = requiredCommandProjection<SessionShellProjection>(response, "SessionShellProjection");

        setBusinessCriticIntensity(nextIntensity);
        setBusinessCriticIntensityChangeReason("");
        setProjections((current) => ({
          ...current,
          session
        }));
        await refreshProjections(session.projectId, session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, businessCriticIntensityChangeReason, client, projections, refreshProjections]
  );

  const submitAnswer = useCallback(
    async (queueItemId: QueueItemId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before submitting an answer.");
        return;
      }

      const answer = answerDrafts[queueItemId]?.trim();

      if (!answer) {
        setWorkflowError("Answer text is required.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Submit answer",
          await client.submitAnswer({
            sessionId: projections.session.sessionId,
            queueItemId,
            expectedStateVersion: latestProjectionVersion(projections),
            answer
          })
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

        setAnswerDrafts((current) => ({
          ...current,
          [queueItemId]: ""
        }));
        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
        await refetchQueueAfterSseNotification(projections.session.projectId, projections.session.sessionId, queue);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [answerDrafts, appendCommand, client, projections, refetchQueueAfterSseNotification, refreshProjections]
  );

  const carryQueueItemAsKnownRisk = useCallback(
    async (queueItemId: QueueItemId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before carrying a queue item as a Known Risk.");
        return;
      }

      const nextValidationAction = knownRiskDrafts[queueItemId]?.trim();

      if (!nextValidationAction) {
        setWorkflowError("Next Validation Action is required to carry a business critic item as a Known Risk.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Carry as Known Risk",
          await client.deferQueueItem({
            sessionId: projections.session.sessionId,
            queueItemId,
            expectedStateVersion: latestProjectionVersion(projections),
            reason: "사용자가 business critic item을 Known Risk로 이관했습니다.",
            riskDisposition: "known_risk_next_validation_action",
            nextValidationAction
          })
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

        setKnownRiskDrafts((current) => ({
          ...current,
          [queueItemId]: ""
        }));
        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
        await refetchQueueAfterSseNotification(projections.session.projectId, projections.session.sessionId, queue);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, knownRiskDrafts, projections, refetchQueueAfterSseNotification, refreshProjections]
  );

  const importResearchResult = useCallback(
    async (researchTaskId: ResearchTaskId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before importing research.");
        return;
      }

      const result = researchDrafts[researchTaskId]?.trim();

      if (!result) {
        setWorkflowError("Research result text is required.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Import research result",
          await client.importResearchResult({
            sessionId: projections.session.sessionId,
            researchTaskId,
            expectedStateVersion: latestProjectionVersion(projections),
            result,
            sourceTitle: "Manual desk research",
            limitationNotes: "Manual import from founder-provided source."
          })
        );
        const research = optionalCommandProjection<ResearchEvidenceProjection>(response, "ResearchEvidenceProjection");

        setResearchDrafts((current) => ({
          ...current,
          [researchTaskId]: ""
        }));
        if (research) {
          setProjections((current) => ({
            ...current,
            research
          }));
        }
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections, refreshProjections, researchDrafts]
  );

  const resolveResearchCard = useCallback(
    async (cardId: QueueItemId, outcome: ResearchQueueTerminalOutcome, title: string) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before resolving a research card.");
        return;
      }

      const needsRationale = outcome === "deferred" || outcome === "risk_accepted";
      const rationale = needsRationale
        ? `${outcome} from Research card: ${title}`
        : outcome === "revised" || outcome === "research_insufficient"
          ? `Resolved as ${outcome}: ${title}`
          : undefined;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          `Resolve research card: ${outcome}`,
          await client.resolveResearchQueueCard({
            sessionId: projections.session.sessionId,
            cardId,
            expectedStateVersion: latestProjectionVersion(projections),
            outcome,
            ...(rationale ? { rationale } : {})
          })
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections, refreshProjections]
  );

  const createOrReactivateAllowlist = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active project is required before changing research allowlists.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const projectId = projections.session.projectId;
      const reusableAllowlist = researchOperations.allowlists?.allowlists.find(
        (allowlist) => allowlist.status !== "revoked"
      );
      const defaultAllowlistIdExists =
        researchOperations.allowlists?.allowlists.some(
          (allowlist) => allowlist.allowlistId === WEB_PUBLIC_SAFE_ALLOWLIST_ID
        ) ?? false;
      const policy = {
        connectorIds: [WEB_PUBLIC_SEARCH_CONNECTOR_ID],
        sourceCategories: ["public_web" as const],
        approvedBy: "web_ui_founder"
      };
      const response = await appendCommand(
        reusableAllowlist ? "Reactivate research allowlist" : "Create research allowlist",
        reusableAllowlist
          ? await client.updateResearchAllowlist(projectId, reusableAllowlist.allowlistId, {
              ...policy,
              status: "active"
            })
          : await client.createResearchAllowlist(projectId, {
              ...policy,
              ...(defaultAllowlistIdExists ? {} : { allowlistId: WEB_PUBLIC_SAFE_ALLOWLIST_ID })
            })
      );
      const allowlists = requiredCommandProjection<ResearchAllowlistGovernanceProjection>(
        response,
        "ResearchAllowlistGovernanceProjection"
      );

      setResearchOperations((current) => ({
        ...current,
        allowlists
      }));
      await refreshResearchOperations(projectId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections.session, refreshResearchOperations, researchOperations.allowlists]);

  const pauseAllowlist = useCallback(
    async (allowlistId: ResearchAllowlistId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before pausing a research allowlist.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Pause research allowlist",
          await client.pauseResearchAllowlist(
            projections.session.projectId,
            allowlistId,
            "Paused from the Phase 1.5A operations screen."
          )
        );
        const allowlists = requiredCommandProjection<ResearchAllowlistGovernanceProjection>(
          response,
          "ResearchAllowlistGovernanceProjection"
        );

        setResearchOperations((current) => ({
          ...current,
          allowlists
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const revokeAllowlist = useCallback(
    async (allowlistId: ResearchAllowlistId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before revoking a research allowlist.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Revoke research allowlist",
          await client.revokeResearchAllowlist(
            projections.session.projectId,
            allowlistId,
            "Revoked from the Phase 1.5A operations screen."
          )
        );
        const allowlists = requiredCommandProjection<ResearchAllowlistGovernanceProjection>(
          response,
          "ResearchAllowlistGovernanceProjection"
        );

        setResearchOperations((current) => ({
          ...current,
          allowlists
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const planPhase15aResearchTask = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before planning Phase 1.5A research.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Plan Phase 1.5A research task",
        await client.planResearch({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestProjectionVersion(projections),
          objective: "Validate public onboarding evidence and quality-gate readiness for Phase 1.5A.",
          sourceQueueItemId: "phase15a_operations_acceptance" as QueueItemId,
          routeOutcome: "research_needed",
          impact: "high"
        })
      );
      const research = requiredCommandProjection<ResearchEvidenceProjection>(response, "ResearchEvidenceProjection");

      setProjections((current) => ({
        ...current,
        research
      }));
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections, refreshProjections]);

  const startReadOnlyResearchRun = useCallback(async (researchTaskId: ResearchTaskId) => {
    if (!client || !projections.session) {
      setWorkflowError("An active project is required before starting a research run.");
      return;
    }

    const task = projections.research?.tasks.find((item) => item.researchTaskId === researchTaskId);
    const allowlist = researchOperations.allowlists?.allowlists.find((item) => item.status === "active");

    if (!task) {
      setWorkflowError("Select a planned research task before starting a read-only research run.");
      return;
    }

    if (!allowlist) {
      setWorkflowError("Create or reactivate an active public-safe allowlist before starting a research run.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Start read-only research run",
        await client.startResearchRun(
          projections.session.projectId,
          buildWebResearchRunRequest({
            allowlist,
            specTitle: projections.spec?.title,
            task
          })
        )
      );

      setResearchOperations((current) => ({
        ...current,
        runs: researchRunProjectionFromResponse(response)
      }));
      await refreshResearchOperations(projections.session.projectId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    appendCommand,
    client,
    projections.research,
    projections.session,
    projections.spec,
    refreshResearchOperations,
    researchOperations.allowlists
  ]);

  const refreshResearchRunStatus = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before refreshing research run status.");
        return;
      }

      setWorkflowError(null);

      try {
        const runs = await client.getResearchRunStatus(projections.session.projectId, researchRunId);

        setResearchOperations((current) => ({
          ...current,
          runs
        }));
      } catch (error) {
        setWorkflowError(displayError(error));
      }
    },
    [client, projections.session]
  );

  const cancelResearchRun = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before cancelling a research run.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Cancel research run",
          await client.cancelResearchRun(projections.session.projectId, researchRunId, {
            reason: "Cancelled from the Phase 1.5A operations screen."
          })
        );

        setResearchOperations((current) => ({
          ...current,
          runs: researchRunProjectionFromResponse(response)
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const retryResearchRun = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before retrying a research run.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Retry research run",
          await client.retryResearchRun(projections.session.projectId, researchRunId, {
            retryReason: "Manual retry from the Phase 1.5A operations screen.",
            contextHash: `${researchRunId}_web_retry`
          })
        );

        setResearchOperations((current) => ({
          ...current,
          runs: researchRunProjectionFromResponse(response)
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const scoreCompleteness = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before scoring completeness.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Score completeness",
        await client.scoreCompleteness({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestProjectionVersion(projections)
        })
      );
      const confidence = requiredCommandProjection<ConfidenceCompletionProjection>(
        response,
        "ConfidenceCompletionProjection"
      );
      const maybeQueueProjection = (response as CommandResponse<unknown>).queueProjection;

      setProjections((current) => ({
        ...current,
        confidence,
        queue:
          maybeQueueProjection &&
          typeof maybeQueueProjection === "object" &&
          "kind" in maybeQueueProjection &&
          maybeQueueProjection.kind === "DecisionQueueProjection"
            ? (maybeQueueProjection as DecisionQueueProjection)
            : current.queue
      }));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections]);

  const prepareFounderBrief = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before preparing a Founder Brief.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Prepare Founder Brief",
        await client.prepareFounderBriefExport({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestProjectionVersion(projections),
          requestedFormat: "markdown"
        })
      );
      const founderBrief = requiredCommandProjection<FounderBriefProjection>(response, "FounderBriefProjection");

      setProjections((current) => ({
        ...current,
        founderBrief
      }));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections]);

  const runPlanningHandoffGate = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before running the Planning Handoff gate.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const request = buildPlanningHandoffRequest({
        session: projections.session,
        spec: projections.spec,
        queue: projections.queue,
        research: projections.research,
        confidence: projections.confidence,
        founderBrief: projections.founderBrief,
        phase15bReadiness,
        expectedStateVersion: latestProjectionVersion(projections)
      });
      const response = await appendCommand("Run Planning Handoff gate", await client.createPlanningHandoff(request));
      const planningHandoff = requiredCommandProjection<PlanningHandoffProjection>(response, "PlanningHandoffProjection");

      setProjections((current) => ({
        ...current,
        planningHandoff
      }));
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, phase15bReadiness, projections, refreshProjections]);

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Solo Superman</h1>
          <p>Decision Queue</p>
        </div>
        <div className={`connection ${connectionState.status}`}>
          {connectionState.status === "connected" ? connectionState.connection.mode : connectionState.status}
        </div>
      </header>

      {connectionState.status === "unavailable" ? (
        <section className="notice-panel">
          <h2>Sidecar unavailable</h2>
          <p>{connectionState.message}</p>
          <button type="button" onClick={connect}>
            Retry connection
          </button>
        </section>
      ) : null}

      {workflowError ? (
        <section className="notice-panel error">
          <h2>Command failed</h2>
          <p>{workflowError}</p>
        </section>
      ) : null}

      <section className="workspace-grid">
        <form className="panel start-panel" onSubmit={runInitialQueueFlow}>
          <div className="panel-heading">
            <h2>Session start</h2>
            <span>{CONTRACT_SCHEMA_VERSION}</span>
          </div>
          <label>
            Raw idea
            <textarea value={idea} onChange={(event) => setIdea(event.target.value)} rows={4} />
          </label>
          <label>
            Intake answer
            <textarea value={intake} onChange={(event) => setIntake(event.target.value)} rows={5} />
          </label>
          <fieldset className="mode-fieldset">
            <legend>Project purpose</legend>
            {PROJECT_PURPOSE_MODE_OPTIONS.map((option) => (
              <label className="mode-option" key={option.mode}>
                <input
                  checked={projectPurposeMode === option.mode}
                  name="project-purpose-mode"
                  onChange={() => setProjectPurposeMode(option.mode)}
                  type="radio"
                  value={option.mode}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
            <p className="mode-help">
              AI가 모드를 제안할 수 있어도 확정은 사용자가 선택합니다. 선택 전에는 mode_required 상태로 두며 이후 변경은 auditable event로 남습니다.
            </p>
          </fieldset>
          {projectPurposeMode === "business" ? (
            <fieldset className="mode-fieldset">
              <legend>Business critic intensity</legend>
              {BUSINESS_CRITIC_INTENSITY_OPTIONS.map((option) => (
                <label className="mode-option" key={option.intensity}>
                  <input
                    checked={businessCriticIntensity === option.intensity}
                    name="business-critic-intensity"
                    onChange={() => setBusinessCriticIntensity(option.intensity)}
                    type="radio"
                    value={option.intensity}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
              <label>
                Intensity reason
                <input
                  value={initialBusinessCriticIntensityReason}
                  onChange={(event) => setInitialBusinessCriticIntensityReason(event.target.value)}
                  placeholder="검증 강도를 선택한 이유를 audit에 남깁니다."
                />
              </label>
              <p className="mode-help">
                사업화 모드는 기본 강도를 자동 선택하지 않습니다. 선택 전에는 상업성 검증 강도 선택 필요 상태로 남습니다.
              </p>
            </fieldset>
          ) : null}
          <button type="submit" disabled={!canStart}>
            {isBusy ? "Running" : "Create first batch"}
          </button>
        </form>

        <section className="panel queue-panel">
          <div className="panel-heading">
            <h2>Queue</h2>
            <span>{queueRecovery.status} · v{projections.queue?.version ?? 0}</span>
          </div>
          <div className="queue-recovery">
            <p>{queueRecovery.label}</p>
            <small>{queueRecovery.activeBatchLabel}</small>
            <small>{queueRecovery.refetchLabel}</small>
            <small>{queueRecovery.sseLabel}</small>
          </div>
          <div className="queue-sections">
            {sections.map((section) => (
              <section className="queue-section" key={section.id}>
                <div className="queue-section-heading">
                  <h3>{section.title}</h3>
                  <span>{section.items.length}</span>
                </div>
                {section.items.length ? (
                  <div className="queue-list">
                    {section.items.map((item) => (
                      <article className={`queue-card ${item.state}`} key={item.queueItemId}>
                        <div>
                          <span>{item.state}</span>
                          <h4>{item.title}</h4>
                          {isBusinessCriticQueueItem(item) ? (
                            <p className="mode-summary">
                              {[item.businessCriticCategory, item.businessCriticPressureKind, item.businessCriticIntensity]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          {item.nextValidationAction ? (
                            <p className="research-recovery">Next validation: {item.nextValidationAction}</p>
                          ) : null}
                        </div>
                        {section.id === "active" && item.state === "active" ? (
                          <div className="answer-box">
                            <textarea
                              aria-label={`Answer ${item.title}`}
                              value={answerDrafts[item.queueItemId] ?? ""}
                              onChange={(event) =>
                                setAnswerDrafts((current) => ({
                                  ...current,
                                  [item.queueItemId]: event.target.value
                                }))
                              }
                              rows={3}
                            />
                            <button type="button" disabled={isBusy} onClick={() => void submitAnswer(item.queueItemId)}>
                              Submit answer
                            </button>
                          </div>
                        ) : null}
                        {isBusinessCriticQueueItem(item) && item.state !== "deferred" ? (
                          <div className="answer-box">
                            <textarea
                              aria-label={`Next validation action for ${item.title}`}
                              value={knownRiskDrafts[item.queueItemId] ?? ""}
                              onChange={(event) =>
                                setKnownRiskDrafts((current) => ({
                                  ...current,
                                  [item.queueItemId]: event.target.value
                                }))
                              }
                              placeholder="Known Risk로 남길 때 다음 검증 행동을 적어주세요."
                              rows={2}
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void carryQueueItemAsKnownRisk(item.queueItemId)}
                            >
                              Carry as Known Risk
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">{section.emptyLabel}</p>
                )}
              </section>
            ))}
          </div>
        </section>

        <aside className="side-panels">
          <section className="panel">
            <div className="panel-heading">
              <h2>Spec</h2>
              <span>{projections.session?.phase ?? "none"}</span>
            </div>
            {projections.spec?.title ? (
              <div className="spec-outline">
                <h3>{projections.spec.title}</h3>
                {projections.spec.sections?.length ? (
                  <ol>
                    {projections.spec.sections.map((section) => (
                      <li key={section}>{section}</li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : (
              <p className="empty-state">No spec draft yet.</p>
            )}
            <dl className="metrics">
              <div>
                <dt>Session version</dt>
                <dd>{projections.session?.version ?? 0}</dd>
              </div>
              <div>
                <dt>Spec sections</dt>
                <dd>{projections.spec?.sectionCount ?? 0}</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{projections.spec?.approvalStatus ?? "draft"}</dd>
              </div>
              <div>
                <dt>Project purpose</dt>
                <dd>{projections.session?.projectPurposeModeLabel ?? "not selected"}</dd>
              </div>
              <div>
                <dt>Business critic</dt>
                <dd>{projections.session?.businessCriticIntensityLabel ?? "not applicable"}</dd>
              </div>
            </dl>
            {projections.session?.projectPurposeModeEffect ? (
              <p className="mode-summary">{projections.session.projectPurposeModeEffect}</p>
            ) : null}
            {projections.session?.businessCriticIntensityEffect ? (
              <p className="mode-summary">{projections.session.businessCriticIntensityEffect}</p>
            ) : null}
            {projections.session?.projectPurposeMode === "business" ? (
              <div className="mode-change-panel">
                <label>
                  Business critic change reason
                  <input
                    value={businessCriticIntensityChangeReason}
                    onChange={(event) => setBusinessCriticIntensityChangeReason(event.target.value)}
                    placeholder="상업성 검증 강도를 바꾸는 이유를 기록합니다."
                  />
                </label>
                <div className="card-actions">
                  {BUSINESS_CRITIC_INTENSITY_OPTIONS.map((option) => (
                    <button
                      type="button"
                      disabled={isBusy || projections.session?.businessCriticIntensity === option.intensity}
                      key={option.intensity}
                      onClick={() => void changeBusinessCriticIntensity(option.intensity)}
                    >
                      {option.label}으로 변경
                    </button>
                  ))}
                </div>
                <small>
                  변경은 `BusinessCriticIntensityChanged` 이벤트로 audit되며 새 critical pressure는 active batch를
                  교체하지 않고 queued_next에 추가됩니다.
                </small>
              </div>
            ) : null}
            {projections.session ? (
              <div className="mode-change-panel">
                <label>
                  Mode change reason
                  <input
                    value={purposeModeChangeReason}
                    onChange={(event) => setPurposeModeChangeReason(event.target.value)}
                    placeholder="왜 질문/리서치 기준을 바꾸는지 기록합니다."
                  />
                </label>
                <div className="card-actions">
                  {PROJECT_PURPOSE_MODE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      disabled={isBusy || projections.session?.projectPurposeMode === option.mode}
                      key={option.mode}
                      onClick={() => void changeProjectPurposeMode(option.mode)}
                    >
                      {option.label}으로 변경
                    </button>
                  ))}
                </div>
                <small>변경은 `ProjectPurposeModeChanged` 이벤트로 audit되고 기존 active batch는 유지됩니다.</small>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Research</h2>
              <span>{projections.research?.proConBalanceStatus ?? "unknown"}</span>
            </div>
            <div className="card-actions panel-actions">
              <button type="button" disabled={isBusy || !projections.session} onClick={() => void planPhase15aResearchTask()}>
                Plan 1.5A task
              </button>
            </div>
            {projections.research?.tasks.length ? (
              <div className="research-list">
                {projections.research.tasks.map((task) => {
                  const card = projections.research?.reviewCards.find(
                    (item) => item.researchTaskId === task.researchTaskId
                  );
                  const canImportResearch =
                    task.status === "planned" || card?.recoveryActions.includes("import_manual_result") === true;

                  return (
                    <article className="research-card" key={task.researchTaskId}>
                      <div>
                        <span>{card?.state ?? task.status}</span>
                        <h3>{task.objective}</h3>
                        <p>{card?.title ?? task.routeOutcome}</p>
                        {card?.cardType ? (
                          <p className="research-recovery">
                            {card.cardType}
                            {card.blocksPlanning ? " · blocks Planning-ready" : ""}
                            {card.terminalOutcome ? ` · ${card.terminalOutcome}` : ""}
                          </p>
                        ) : null}
                        {card?.terminalRationale ? (
                          <p className="research-recovery">Rationale: {card.terminalRationale}</p>
                        ) : null}
                        {card?.recoveryActions.length ? (
                          <p className="research-recovery">{card.recoveryActions.join(" / ")}</p>
                        ) : null}
                      </div>
                      {canImportResearch ? (
                        <div className="answer-box">
                          <textarea
                            aria-label={`Import research for ${task.objective}`}
                            value={researchDrafts[task.researchTaskId] ?? ""}
                            onChange={(event) =>
                              setResearchDrafts((current) => ({
                                ...current,
                                [task.researchTaskId]: event.target.value
                              }))
                            }
                            rows={3}
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void importResearchResult(task.researchTaskId)}
                          >
                            Import result
                          </button>
                        </div>
                      ) : null}
                      <div className="card-actions">
                        <button
                          type="button"
                          disabled={isBusy || !hasActiveResearchAllowlist}
                          onClick={() => void startReadOnlyResearchRun(task.researchTaskId)}
                        >
                          Start read-only run
                        </button>
                      </div>
                      {card && !card.terminalOutcome && card.availableOutcomes.length ? (
                        <div className="card-actions">
                          {card.availableOutcomes.map((outcome) => (
                            <button
                              type="button"
                              disabled={isBusy}
                              key={outcome}
                              onClick={() => void resolveResearchCard(card.cardId, outcome, card.title)}
                            >
                              {outcome}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">No research tasks yet.</p>
            )}
          </section>

          <Phase15aOperationsPanel
            hasActiveSession={Boolean(projections.session)}
            isBusy={isBusy}
            operations={phase15aOperations}
            researchOperations={researchOperations}
            onCreateOrReactivateAllowlist={() => void createOrReactivateAllowlist()}
            onRefreshOperations={() => {
              if (projections.session) {
                void refreshResearchOperations(projections.session.projectId);
              }
            }}
            onPauseAllowlist={(allowlistId) => void pauseAllowlist(allowlistId)}
            onRevokeAllowlist={(allowlistId) => void revokeAllowlist(allowlistId)}
            onRefreshResearchRunStatus={(researchRunId) => void refreshResearchRunStatus(researchRunId)}
            onCancelResearchRun={(researchRunId) => void cancelResearchRun(researchRunId)}
            onRetryResearchRun={(researchRunId) => void retryResearchRun(researchRunId)}
          />

          <Phase15bReadinessPanel
            hasActiveProject={Boolean(projections.session)}
            isBusy={isBusy}
            readiness={phase15bReadinessView}
            onRefreshReadiness={() => {
              if (projections.session) {
                void refreshPhase15bReadiness(projections.session.projectId);
              }
            }}
          />

          <PlanningHandoffPanel
            hasActiveSession={Boolean(projections.session)}
            isBusy={isBusy}
            handoff={planningHandoffView}
            onRunHandoffGate={() => void runPlanningHandoffGate()}
            onRefreshHandoff={() => {
              if (projections.session) {
                void refreshPlanningHandoff(projections.session.sessionId);
              }
            }}
          />

          <section className="panel">
            <div className="panel-heading">
              <h2>Progress</h2>
              <span>{confidence?.readinessLabel ?? "pending"}</span>
            </div>
            <div className="score">{confidence?.compositeScore ?? 0}</div>
            <button type="button" disabled={isBusy || !projections.session} onClick={() => void scoreCompleteness()}>
              Score completeness
            </button>
            {confidence?.topRisks.length ? (
              <ul>
                {confidence.topRisks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No risk projection yet.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Founder Brief</h2>
              <span>{projections.founderBrief?.exportReady ? "ready" : "draft"}</span>
            </div>
            <button type="button" disabled={isBusy || !projections.session} onClick={() => void prepareFounderBrief()}>
              Prepare export metadata
            </button>
            {projections.founderBrief ? (
              <div className="spec-outline">
                {projections.founderBrief.briefSections.map((section) => (
                  <section key={section.sectionId}>
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </section>
                ))}
              </div>
            ) : (
              <p className="empty-state">No Founder Brief prepared yet.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Activity</h2>
              <span>{runtimeActivity.runtimeStatus}</span>
            </div>
            <p>{runtimeStatus ? `Adapter ${runtimeStatus.status}. ${pendingSummary.visibleLabel}` : pendingSummary.visibleLabel}</p>
            {researchOperations.disclosures?.disclosureLogs.length ? (
              <div className="activity-list disclosure-activity">
                {researchOperations.disclosures.disclosureLogs.map((log) => (
                  <article className="activity-item" key={log.logId}>
                    <strong>Research disclosure</strong>
                    <span>{log.status}</span>
                    <small>
                      {log.connectorId} · {log.sourceCategory} · {log.researchObjective}
                    </small>
                    <small>{log.publicSafeSummarySent}</small>
                    {log.blockReason ? <small>blocked: {log.blockReason}</small> : null}
                    {log.manualHandoffReason ? <small>{log.manualHandoffReason}</small> : null}
                  </article>
                ))}
              </div>
            ) : null}
            <div className="activity-list">
              {commandLog.length ? (
                commandLog.map((entry) => (
                  <article className="activity-item" key={entry.id}>
                    <strong>{entry.label}</strong>
                    <span>{entry.status?.commandStatus ?? entry.response?.category ?? entry.error ?? "pending"}</span>
                    {entry.status?.effects.length ? (
                      <ul className="effect-list">
                        {entry.status.effects.map((effect) => (
                          <li key={effect.effectTaskId}>
                            {effect.effectType}: {effect.status}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {entry.error ? <small>{entry.error}</small> : null}
                    {entry.response?.statusUrl ? (
                      <button
                        type="button"
                        disabled={isBusy || !entry.response?.statusUrl || !client}
                        onClick={() => {
                          if (entry.response?.statusUrl && client) {
                            const { commandId, statusUrl } = entry.response;

                            void client
                              .getCommandStatus(statusUrl)
                              .then(recordCommandStatus)
                              .catch((error) => recordCommandStatusError(commandId, error));
                          }
                        }}
                      >
                        Refresh status
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="empty-state">No activity yet.</p>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
