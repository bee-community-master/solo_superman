import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CONTRACT_SCHEMA_VERSION,
  type CodexRuntimeStatusDto,
  type CommandResponse,
  type ConfidenceCompletionProjection,
  type DecisionQueueProjection,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type Phase15bUpgradeHintProjection,
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
  phase15aOperationsViewModel,
  phase15bReadinessViewModel,
  pendingEffectSummary,
  queueSections,
  runtimeActivityProjectionFromStatuses
} from "./decision-queue-view-model";
import {
  buildDesktopResearchRunRequest,
  DESKTOP_PUBLIC_SEARCH_CONNECTOR_ID
} from "./phase15a-research-run-request";

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
}

const DEFAULT_IDEA = "A focused founder brief generator";
const DEFAULT_INTAKE =
  "Help solo founders turn a rough idea into a traceable product spec before they start building.";
const DESKTOP_PUBLIC_SAFE_ALLOWLIST_ID = "research_allowlist_desktop_public_safe" as ResearchAllowlistId;

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
    Number(projections.founderBrief?.version ?? 0)
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
    founderBrief: null
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

export function DecisionQueueShell() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "connecting" });
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [intake, setIntake] = useState(DEFAULT_INTAKE);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
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

  const refreshProjections = useCallback(
    async (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const [session, spec, queue, research, activity, confidence, founderBrief] = await Promise.all([
        client.getSession(projectId, sessionId),
        client.getSpec(sessionId),
        client.getQueue(sessionId),
        client.getResearch(sessionId),
        client.getActivity(sessionId),
        client.getCompleteness(sessionId),
        client.getFounderBrief(sessionId).catch(() => null)
      ]);

      setProjections({
        session,
        spec,
        queue,
        research,
        activity,
        confidence,
        founderBrief
      });
      await Promise.all([refreshResearchOperations(projectId), refreshPhase15bReadiness(projectId)]);
    },
    [client, refreshPhase15bReadiness, refreshResearchOperations]
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
            localPrivacyMode: "local_only"
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

        setProjections((current) => ({
          ...current,
          queue: requiredCommandProjection<DecisionQueueProjection>(activateResponse, "DecisionQueueProjection")
        }));
        await refreshProjections(session.projectId, session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, idea, intake, refreshProjections]
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
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [answerDrafts, appendCommand, client, projections, refreshProjections]
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
          (allowlist) => allowlist.allowlistId === DESKTOP_PUBLIC_SAFE_ALLOWLIST_ID
        ) ?? false;
      const policy = {
        connectorIds: [DESKTOP_PUBLIC_SEARCH_CONNECTOR_ID],
        sourceCategories: ["public_web" as const],
        approvedBy: "desktop_ui_founder"
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
              ...(defaultAllowlistIdExists ? {} : { allowlistId: DESKTOP_PUBLIC_SAFE_ALLOWLIST_ID })
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
          buildDesktopResearchRunRequest({
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
            contextHash: `${researchRunId}_desktop_retry`
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

  const sections = useMemo(() => queueSections(projections.queue), [projections.queue]);
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
  const canStart = connectionState.status === "connected" && Boolean(client) && !isBusy;
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
          <button type="submit" disabled={!canStart}>
            {isBusy ? "Running" : "Create first batch"}
          </button>
        </form>

        <section className="panel queue-panel">
          <div className="panel-heading">
            <h2>Queue</h2>
            <span>v{projections.queue?.version ?? 0}</span>
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
            </dl>
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
