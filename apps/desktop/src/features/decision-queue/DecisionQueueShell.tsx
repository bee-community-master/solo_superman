import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CONTRACT_SCHEMA_VERSION,
  type CodexRuntimeStatusDto,
  type CommandResponse,
  type DecisionQueueProjection,
  type LivingSpecProjection,
  type QueueItemId,
  type ResearchEvidenceProjection,
  type ResearchTaskId,
  type RuntimeActivityProjection,
  type SessionShellProjection,
  type StateVersion,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import {
  createSidecarClient,
  discoverSidecarConnection,
  SidecarClientError,
  type SidecarClient,
  type SidecarConnection
} from "../../shared/api/sidecar-client";
import {
  confidencePlaceholder,
  pendingEffectSummary,
  queueSections,
  runtimeActivityProjectionFromStatuses
} from "./decision-queue-view-model";

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
}

const DEFAULT_IDEA = "A focused founder brief generator";
const DEFAULT_INTAKE =
  "Help solo founders turn a rough idea into a traceable product spec before they start building.";

function responseVersion(response: CommandResponse) {
  if (typeof response.stateVersionAfter !== "number") {
    const message = response.error?.message ?? "Command did not return a next state version.";

    throw new Error(message);
  }

  return response.stateVersionAfter as StateVersion;
}

function responseProjection<TProjection>(response: CommandResponse<TProjection>, kind: string) {
  const projection = response.immediateProjection ?? response.queueProjection;

  if (!projection || typeof projection !== "object" || !("kind" in projection) || projection.kind !== kind) {
    throw new Error(`${kind} was not returned by the sidecar command.`);
  }

  return projection as TProjection;
}

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
    Number(projections.activity?.version ?? 0)
  ) as StateVersion;
}

export function DecisionQueueShell() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "connecting" });
  const [client, setClient] = useState<SidecarClient | null>(null);
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [intake, setIntake] = useState(DEFAULT_INTAKE);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [researchDrafts, setResearchDrafts] = useState<Record<string, string>>({});
  const [projections, setProjections] = useState<ProjectionState>({
    session: null,
    spec: null,
    queue: null,
    research: null,
    activity: null
  });
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

  const refreshProjections = useCallback(
    async (projectId: string, sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const [session, spec, queue, research, activity] = await Promise.all([
        client.getSession(projectId, sessionId),
        client.getSpec(sessionId),
        client.getQueue(sessionId),
        client.getResearch(sessionId),
        client.getActivity(sessionId)
      ]);

      setProjections({
        session,
        spec,
        queue,
        research,
        activity
      });
    },
    [client]
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
      setProjections({
        session: null,
        spec: null,
        queue: null,
        research: null,
        activity: null
      });

      try {
        const start = await appendCommand(
          "Create project",
          await client.createProject({
            rawIdea: idea,
            localPrivacyMode: "local_only"
          })
        );
        const session = responseProjection<SessionShellProjection>(start, "SessionShellProjection");
        setProjections({
          session,
          spec: null,
          queue: null,
          research: null,
          activity: null
        });

        const intakeResponse = await appendCommand(
          "Capture intake",
          await client.captureIntake(session.sessionId, responseVersion(start), intake)
        );
        const draftResponse = await appendCommand(
          "Draft initial spec",
          await client.draftInitialSpec(session.sessionId, responseVersion(intakeResponse))
        );
        const analyzeResponse = await appendCommand(
          "Analyze ambiguity",
          await client.analyzeAmbiguity(session.sessionId, responseVersion(draftResponse), "current_spec")
        );
        const activateResponse = await appendCommand(
          "Activate question batch",
          await client.activateQuestionBatch(session.sessionId, responseVersion(analyzeResponse))
        );

        setProjections((current) => ({
          ...current,
          queue: responseProjection<DecisionQueueProjection>(activateResponse, "DecisionQueueProjection")
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
        const queue = responseProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

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
        const research = responseProjection<ResearchEvidenceProjection>(response, "ResearchEvidenceProjection");

        setResearchDrafts((current) => ({
          ...current,
          [researchTaskId]: ""
        }));
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
    },
    [appendCommand, client, projections, refreshProjections, researchDrafts]
  );

  const sections = useMemo(() => queueSections(projections.queue), [projections.queue]);
  const pendingSummary = useMemo(() => pendingEffectSummary(statuses), [statuses]);
  const runtimeActivity = useMemo(
    () => projections.activity ?? runtimeActivityProjectionFromStatuses(statuses),
    [projections.activity, statuses]
  );
  const confidence = useMemo(
    () => confidencePlaceholder(projections.session?.sessionId ?? null, projections.research?.knownRisks ?? []),
    [projections.research, projections.session]
  );
  const canStart = connectionState.status === "connected" && Boolean(client) && !isBusy;

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
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">No research tasks yet.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Progress</h2>
              <span>{confidence?.kind ?? "pending"}</span>
            </div>
            <div className="score">{confidence?.compositeScore ?? 0}</div>
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
              <h2>Activity</h2>
              <span>{runtimeActivity.runtimeStatus}</span>
            </div>
            <p>{runtimeStatus ? `Adapter ${runtimeStatus.status}. ${pendingSummary.visibleLabel}` : pendingSummary.visibleLabel}</p>
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
