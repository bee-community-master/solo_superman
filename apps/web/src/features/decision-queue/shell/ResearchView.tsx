import type {
  DecisionEvidencePackProjection,
  EvidenceItemProjection,
  EvidenceMatrixProjection,
  ResearchReviewCardProjection
} from "@solo-superman/contracts";
import { Phase15aOperationsPanel } from "../Phase15aOperationsPanel";
import type { ReadyReadOnlyResearchRunStartPlan } from "../ready-readonly-research-start-plan";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface ResearchViewProps {
  readonly controller: DecisionQueueShellController;
}

function retainedSourceRefsForResearchCard(card: ResearchReviewCardProjection) {
  const sourceRefs = [card.retainedSourceRef, ...(card.retainedSourceRefs ?? [])];

  return [...new Set(sourceRefs.filter((ref): ref is string => Boolean(ref)))];
}

type DecisionQueueCopy = ReturnType<typeof useDecisionQueueCopy>;

function safeExternalUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function TextList({ items }: { readonly items: readonly string[] }) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function ReadyReadOnlyResearchStartPlan({
  copy,
  plan
}: {
  readonly copy: DecisionQueueCopy;
  readonly plan: ReadyReadOnlyResearchRunStartPlan;
}) {
  const isReady = plan.status === "start";
  const summary = isReady
    ? copy.research.readyReadOnlyRunsPlanReady(plan.taskIds.length)
    : copy.research.readyReadOnlyRunsPlanBlocked[plan.reason];
  const toneClassName = isReady ? "research-batch-plan-start" : "research-batch-plan-blocked";

  return (
    <aside className={`research-batch-plan ${toneClassName}`} aria-live="polite">
      <p className="research-batch-plan-title">{copy.research.readyReadOnlyRunsPlanTitle}</p>
      <p>{summary}</p>
      {isReady ? (
        <div>
          <p>{copy.research.readyReadOnlyRunsPlanTaskIds}</p>
          <ul>
            {plan.taskIds.map((taskId) => (
              <li key={taskId}>{taskId}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function EvidenceItems({
  copy,
  items,
  label
}: {
  readonly copy: DecisionQueueCopy;
  readonly items: readonly EvidenceItemProjection[];
  readonly label: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.evidenceItemId}>{item.summary}</li>
            ))}
          </ul>
        ) : (
          copy.research.noEvidenceItems
        )}
      </dd>
    </div>
  );
}

function EvidencePackSource({
  copy,
  pack
}: {
  readonly copy: DecisionQueueCopy;
  readonly pack: DecisionEvidencePackProjection;
}) {
  const sourceLabel = pack.sourceTitle ?? pack.sourceUrl ?? copy.research.unknown;
  const sourceUrl = safeExternalUrl(pack.sourceUrl);

  return (
    <div>
      <dt>{copy.research.evidencePackSource}</dt>
      <dd>
        {sourceUrl ? (
          <a href={sourceUrl} rel="noreferrer" target="_blank">
            {sourceLabel}
          </a>
        ) : (
          sourceLabel
        )}
      </dd>
    </div>
  );
}

function EvidencePackGateChecks({
  copy,
  pack
}: {
  readonly copy: DecisionQueueCopy;
  readonly pack: DecisionEvidencePackProjection;
}) {
  return (
    <div>
      <dt>{copy.research.gateChecks}</dt>
      <dd>
        {pack.gateChecks.length ? (
          <ul>
            {pack.gateChecks.map((check) => (
              <li key={`${check.code}:${check.status}:${check.reason}`}>
                {check.code}: {check.status} — {check.reason}
              </li>
            ))}
          </ul>
        ) : (
          copy.research.noGateChecks
        )}
      </dd>
    </div>
  );
}

function EvidencePackCard({
  copy,
  pack
}: {
  readonly copy: DecisionQueueCopy;
  readonly pack: DecisionEvidencePackProjection;
}) {
  return (
    <article className="research-evidence-pack">
      <div className="research-evidence-matrix-heading">
        <strong>{pack.claim}</strong>
        <span>{copy.research.gateStatus}: {pack.gateStatus}</span>
        <span>{copy.research.sourceReliability}: {pack.sourceReliability}</span>
      </div>
      <dl className="research-evidence-grid">
        <div>
          <dt>{copy.research.decisionContext}</dt>
          <dd>{pack.decisionContext}</dd>
        </div>
        <EvidencePackSource copy={copy} pack={pack} />
        <EvidencePackGateChecks copy={copy} pack={pack} />
        {pack.knownRisk ? (
          <div>
            <dt>{copy.research.knownRisk}</dt>
            <dd>{pack.knownRisk}</dd>
          </div>
        ) : null}
        {pack.nextValidationAction ? (
          <div>
            <dt>{copy.research.nextValidationAction}</dt>
            <dd>{pack.nextValidationAction}</dd>
          </div>
        ) : null}
        {pack.limitationRefs.length ? (
          <div>
            <dt>{copy.research.limitationRefs}</dt>
            <dd>
              <TextList items={pack.limitationRefs} />
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function ResearchValidationSummary({
  copy,
  knownRisks,
  nextValidationActions
}: {
  readonly copy: DecisionQueueCopy;
  readonly knownRisks: readonly string[];
  readonly nextValidationActions: readonly string[];
}) {
  if (!knownRisks.length && !nextValidationActions.length) {
    return null;
  }

  return (
    <section className="research-validation-summary" aria-label={copy.research.validationSummary}>
      <h3>{copy.research.validationSummary}</h3>
      <dl className="research-evidence-grid">
        {knownRisks.length ? (
          <div>
            <dt>{copy.research.knownRisks}</dt>
            <dd>
              <TextList items={knownRisks} />
            </dd>
          </div>
        ) : null}
        {nextValidationActions.length ? (
          <div>
            <dt>{copy.research.nextValidationActions}</dt>
            <dd>
              <TextList items={nextValidationActions} />
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function EvidencePacksSection({
  copy,
  evidencePacks
}: {
  readonly copy: DecisionQueueCopy;
  readonly evidencePacks: readonly DecisionEvidencePackProjection[];
}) {
  if (!evidencePacks.length) {
    return null;
  }

  return (
    <section className="research-evidence-packs" aria-label={copy.research.evidencePacks}>
      <h3>{copy.research.evidencePacks}</h3>
      <div className="research-evidence-pack-list">
        {evidencePacks.map((pack) => (
          <EvidencePackCard copy={copy} key={pack.evidencePackId} pack={pack} />
        ))}
      </div>
    </section>
  );
}

function EvidenceMatrixCard({
  copy,
  matrix
}: {
  readonly copy: DecisionQueueCopy;
  readonly matrix: EvidenceMatrixProjection;
}) {
  return (
    <article className="research-evidence-matrix">
      <div className="research-evidence-matrix-heading">
        <strong>{matrix.evidenceMatrixId}</strong>
        <span>
          {copy.research.balanceStatus}: {matrix.balanceStatus}
        </span>
        <span>{matrix.decisionBlocked ? copy.research.decisionBlocked : copy.research.decisionReady}</span>
      </div>
      <dl className="research-evidence-grid">
        <EvidenceItems copy={copy} items={matrix.proEvidence} label={copy.research.proEvidence} />
        <EvidenceItems copy={copy} items={matrix.conEvidence} label={copy.research.conEvidence} />
        <EvidenceItems copy={copy} items={matrix.uncertainties} label={copy.research.uncertainties} />
        {matrix.missingConEvidenceReason ? (
          <div>
            <dt>{copy.research.missingConEvidenceReason}</dt>
            <dd>{matrix.missingConEvidenceReason}</dd>
          </div>
        ) : null}
        {matrix.knownRisk ? (
          <div>
            <dt>{copy.research.knownRisk}</dt>
            <dd>{matrix.knownRisk}</dd>
          </div>
        ) : null}
        {matrix.additionalQuestions.length ? (
          <div>
            <dt>{copy.research.additionalQuestions}</dt>
            <dd>
              <ul>
                {matrix.additionalQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
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
    readyReadOnlyResearchStartPlan,
    startReadyReadOnlyResearchRuns,
    updateAllowlistMaxConcurrentRuns,
    updateAllowlistMaxRunsPerSession
  } = controller;
  const research = projections.research;
  const evidencePacks = research?.evidencePacks ?? [];
  const knownRisks = research?.knownRisks ?? [];
  const nextValidationActions = research?.nextValidationActions ?? [];
  const readyReadOnlyResearchTaskIdSet = new Set(readyReadOnlyResearchTaskIds);

  return (
    <div className="view-grid research-view">
      <section className="panel research-main-panel">
        <div className="panel-heading">
          <h2>{copy.research.research}</h2>
          <span>{research?.proConBalanceStatus ?? copy.research.unknown}</span>
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
        <ReadyReadOnlyResearchStartPlan copy={copy} plan={readyReadOnlyResearchStartPlan} />
        {research?.tasks.length ? (
          <div className="research-list">
            {research.tasks.map((task) => {
              const card = research.reviewCards.find((item) => item.researchTaskId === task.researchTaskId);
              const canImportResearch = task.status === "planned" || card?.recoveryActions.includes("import_manual_result") === true;
              const canStartReadOnlyRun = readyReadOnlyResearchTaskIdSet.has(task.researchTaskId);
              const retainedSourceRefs = card ? retainedSourceRefsForResearchCard(card) : [];

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
                    {retainedSourceRefs.length ? (
                      <div className="research-card-source-trace">
                        <p>{copy.research.sourceTrace}</p>
                        <ul>
                          {retainedSourceRefs.map((sourceRef) => (
                            <li key={sourceRef}>{sourceRef}</li>
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
        <ResearchValidationSummary copy={copy} knownRisks={knownRisks} nextValidationActions={nextValidationActions} />
        <EvidencePacksSection copy={copy} evidencePacks={evidencePacks} />
        {research?.evidenceMatrices.length ? (
          <section className="research-evidence-matrices" aria-label={copy.research.evidenceMatrix}>
            <h3>{copy.research.evidenceMatrix}</h3>
            <div className="research-evidence-matrix-list">
              {research.evidenceMatrices.map((matrix) => (
                <EvidenceMatrixCard copy={copy} key={matrix.evidenceMatrixId} matrix={matrix} />
              ))}
            </div>
          </section>
        ) : null}
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
        onUpdateAllowlistMaxConcurrentRuns={(allowlistId, maxConcurrentRuns) =>
          void updateAllowlistMaxConcurrentRuns(allowlistId, maxConcurrentRuns)
        }
        onUpdateAllowlistMaxRunsPerSession={(allowlistId, maxRunsPerSession) =>
          void updateAllowlistMaxRunsPerSession(allowlistId, maxRunsPerSession)
        }
        onRefreshResearchRunStatus={(researchRunId) => void refreshResearchRunStatus(researchRunId)}
        onCancelResearchRun={(researchRunId) => void cancelResearchRun(researchRunId)}
        onRetryResearchRun={(researchRunId) => void retryResearchRun(researchRunId)}
      />
    </div>
  );
}
