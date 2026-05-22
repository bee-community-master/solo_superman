import { Phase15aOperationsPanel } from "../Phase15aOperationsPanel";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface ResearchViewProps {
  readonly controller: DecisionQueueShellController;
}

export function ResearchView({ controller }: ResearchViewProps) {
  const copy = useDecisionQueueCopy();
  const {
    cancelResearchRun,
    createOrReactivateAllowlist,
    hasActiveResearchAllowlist,
    importResearchResult,
    isBusy,
    pauseAllowlist,
    phase15aOperations,
    planPhase15aResearchTask,
    projections,
    readyReadOnlyResearchTaskIds,
    refreshResearchOperations,
    refreshResearchRunStatus,
    researchDrafts,
    researchOperations,
    resolveResearchCard,
    retryResearchRun,
    revokeAllowlist,
    setResearchDrafts,
    startReadOnlyResearchRun,
    startReadyReadOnlyResearchRuns
  } = controller;
  const readyReadOnlyResearchTaskIdSet = new Set(readyReadOnlyResearchTaskIds);

  return (
    <div className="view-grid research-view">
      <section className="panel research-main-panel">
        <div className="panel-heading">
          <h2>{copy.research.research}</h2>
          <span>{projections.research?.proConBalanceStatus ?? copy.research.unknown}</span>
        </div>
        <div className="card-actions panel-actions">
          <button type="button" disabled={isBusy || !projections.session} onClick={() => void planPhase15aResearchTask()}>
            {copy.research.planResearchTask}
          </button>
          <button
            type="button"
            disabled={isBusy || !hasActiveResearchAllowlist || readyReadOnlyResearchTaskIds.length === 0}
            onClick={() => void startReadyReadOnlyResearchRuns()}
          >
            {copy.research.startReadyReadOnlyRuns(readyReadOnlyResearchTaskIds.length)}
          </button>
        </div>
        {projections.research?.tasks.length ? (
          <div className="research-list">
            {projections.research.tasks.map((task) => {
              const card = projections.research?.reviewCards.find((item) => item.researchTaskId === task.researchTaskId);
              const canImportResearch = task.status === "planned" || card?.recoveryActions.includes("import_manual_result") === true;
              const canStartReadOnlyRun = readyReadOnlyResearchTaskIdSet.has(task.researchTaskId);

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
                    {card?.terminalRationale ? <p className="research-recovery">{copy.research.rationale}: {card.terminalRationale}</p> : null}
                    {card?.recoveryActions.length ? <p className="research-recovery">{card.recoveryActions.join(" / ")}</p> : null}
                    {card?.additionalQuestions?.length ? (
                      <div className="research-additional-questions">
                        <p>{copy.research.additionalQuestions}</p>
                        <ul>
                          {card.additionalQuestions.map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  {canImportResearch ? (
                    <div className="answer-box">
                      <textarea
                        aria-label={`${copy.research.importResearchAriaPrefix} ${task.objective}`}
                        value={researchDrafts[task.researchTaskId] ?? ""}
                        onChange={(event) =>
                          setResearchDrafts((current) => ({
                            ...current,
                            [task.researchTaskId]: event.target.value
                          }))
                        }
                        rows={3}
                      />
                      <button type="button" disabled={isBusy} onClick={() => void importResearchResult(task.researchTaskId)}>
                        {copy.research.importResult}
                      </button>
                    </div>
                  ) : null}
                  <div className="card-actions">
                    <button
                      type="button"
                      disabled={isBusy || !hasActiveResearchAllowlist || !canStartReadOnlyRun}
                      onClick={() => void startReadOnlyResearchRun(task.researchTaskId)}
                    >
                      {copy.research.startReadOnlyRun}
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
          <p className="empty-state">{copy.research.noResearchTasks}</p>
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
    </div>
  );
}
