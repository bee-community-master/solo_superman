import type {
  DecisionEvidencePackProjection,
  EvidenceItemProjection,
  EvidenceMatrixProjection,
  ResearchResultProjection,
  ResearchReviewCardProjection
} from "@solo-superman/contracts";
import { chatGptVisibleResearchImportHint } from "../chatgpt-visible-research-import";
import { visibleChatGptResearchHandoffForTask } from "../chatgpt-browser-delegation-request";
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

function latestResearchResultForTask(
  results: readonly ResearchResultProjection[],
  researchTaskId: ResearchResultProjection["researchTaskId"]
) {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];

    if (result?.researchTaskId === researchTaskId) {
      return result;
    }
  }

  return undefined;
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
                {copy.research.gateCheckCodeLabels[check.code]}:{" "}
                {copy.research.gateCheckStatusLabels[check.status]} — {check.reason}
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
        <span>{copy.research.gateStatus}: {copy.research.gateStatusLabels[pack.gateStatus]}</span>
        <span>
          {copy.research.sourceReliability}: {copy.research.sourceReliabilityLabels[pack.sourceReliability]}
        </span>
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
          {copy.research.balanceStatus}: {copy.research.balanceStatusLabels[matrix.balanceStatus]}
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

function VisibleChatGptResearchHandoff({
  copy,
  task
}: {
  readonly copy: DecisionQueueCopy;
  readonly task: Parameters<typeof visibleChatGptResearchHandoffForTask>[0];
}) {
  const handoff = visibleChatGptResearchHandoffForTask(task);

  return (
    <aside className="chatgpt-visible-research-handoff research-action-assist">
      <div className="research-evidence-matrix-heading">
        <strong>{copy.research.visibleChatGptHandoffTitle}</strong>
        <a href={handoff.openUrl} rel="noopener noreferrer" target="_blank">
          {copy.research.visibleChatGptOpen}
        </a>
      </div>
      <p className="mode-summary">{copy.research.visibleChatGptHandoffBoundary}</p>
      <label>
        {copy.research.visibleChatGptPromptLabel}
        <textarea readOnly rows={8} value={handoff.prompt} />
      </label>
      <p>{copy.research.visibleChatGptChecklistLabel}</p>
      <ul>
        {handoff.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}

function ImportedResearchResultPending({
  copy,
  result
}: {
  readonly copy: DecisionQueueCopy;
  readonly result: ResearchResultProjection;
}) {
  const sourceLabel = result.sourceTitle ?? result.sourceUrl ?? copy.research.unknown;
  const sourceUrl = safeExternalUrl(result.sourceUrl);
  const sourceReliability = result.sourceReliability ?? "unknown";

  return (
    <aside className="research-card-source-trace research-imported-result-pending" aria-label={copy.research.importedResultPendingTitle}>
      <strong>{copy.research.importedResultPendingTitle}</strong>
      <p>{copy.research.importedResultPendingDescription}</p>
      <dl className="research-evidence-grid">
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
        <div>
          <dt>{copy.research.sourceReliability}</dt>
          <dd>{copy.research.sourceReliabilityLabels[sourceReliability]}</dd>
        </div>
        <div>
          <dt>{copy.research.importedResultSummary}</dt>
          <dd>{result.resultSummary}</dd>
        </div>
        {result.limitationNotes ? (
          <div>
            <dt>{copy.research.importedResultLimitations}</dt>
            <dd>{result.limitationNotes}</dd>
          </div>
        ) : null}
        {result.questionRef ? (
          <div>
            <dt>{copy.research.importedResultQuestionRef}</dt>
            <dd>{result.questionRef}</dd>
          </div>
        ) : null}
        {result.implicationScope ? (
          <div>
            <dt>{copy.research.importedResultImplicationScope}</dt>
            <dd>{result.implicationScope}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
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
  const balanceStatusLabel = research?.proConBalanceStatus
    ? copy.research.balanceStatusLabels[research.proConBalanceStatus]
    : copy.research.unknown;

  return (
    <div className="view-grid research-view">
      <section className="panel research-main-panel">
        <div className="panel-heading">
          <h2>{copy.research.research}</h2>
          <span>{balanceStatusLabel}</span>
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
              const pendingImportedResult =
                task.status === "handoff_ready"
                  ? latestResearchResultForTask(research.results, task.researchTaskId)
                  : undefined;
              const canImportResearch =
                task.status === "planned" || card?.recoveryActions.includes("import_manual_result") === true;
              const canStartReadOnlyRun = readyReadOnlyResearchTaskIdSet.has(task.researchTaskId);
              const retainedSourceRefs = card ? retainedSourceRefsForResearchCard(card) : [];
              const statusLabel = card
                ? copy.research.reviewCardStateLabels[card.state]
                : copy.research.taskStatusLabels[task.status];
              const summaryLabel = card
                ? copy.research.reviewCardTypeLabels[card.cardType]
                : copy.research.routeOutcomeLabels[task.routeOutcome];
              const impactLabel = copy.research.researchImpactLabels[card?.impact ?? task.impact];
              const terminalOutcomeLabel = card?.terminalOutcome
                ? copy.research.terminalOutcomeLabels[card.terminalOutcome]
                : null;
              const recoveryActionLabels =
                card?.recoveryActions.map((action) => copy.research.recoveryActionLabels[action]) ?? [];
              const visibleChatGptImportHint = chatGptVisibleResearchImportHint({
                delegation: projections.chatGptDelegation,
                researchTaskId: task.researchTaskId,
                hint: copy.research.visibleChatGptImportHint
              });
              const canUseVisibleChatGptHandoff =
                projections.session?.initialResearchAutomationPermission === "allow_codex_and_chatgpt_visible" ||
                Boolean(visibleChatGptImportHint);

              return (
                <article className="research-card" key={task.researchTaskId}>
                  <div className="research-card-main">
                    <header className="research-card-header">
                      <h3>{task.objective}</h3>
                      <span className="research-status-badge">{statusLabel}</span>
                    </header>
                    <p className="research-card-summary">{card?.title ?? summaryLabel}</p>
                    <dl className="research-card-facts">
                      <div>
                        <dt>{copy.research.gateStatus}</dt>
                        <dd>{statusLabel}</dd>
                      </div>
                      <div>
                        <dt>{copy.research.decisionContext}</dt>
                        <dd>{summaryLabel}</dd>
                      </div>
                      <div>
                        <dt>{copy.research.researchImpact}</dt>
                        <dd>{impactLabel}</dd>
                      </div>
                      {terminalOutcomeLabel ? (
                        <div>
                          <dt>{copy.research.terminalOutcome}</dt>
                          <dd>{terminalOutcomeLabel}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {card?.blocksPlanning ? (
                      <p className="research-recovery">{copy.research.planningBlockedSuffix}</p>
                    ) : null}
                    {card?.terminalRationale ? <p className="research-recovery">{copy.research.rationale}: {card.terminalRationale}</p> : null}
                    {recoveryActionLabels.length ? <p className="research-recovery">{recoveryActionLabels.join(" / ")}</p> : null}
                    {retainedSourceRefs.length ? (
                      <aside className="research-card-source-trace" aria-label={copy.research.sourceTrace}>
                        <p>{copy.research.sourceTrace}</p>
                        <ul>
                          {retainedSourceRefs.map((sourceRef) => (
                            <li key={sourceRef}>{sourceRef}</li>
                          ))}
                        </ul>
                      </aside>
                    ) : null}
                    {card?.additionalQuestions?.length ? (
                      <aside className="research-additional-questions" aria-label={copy.research.additionalQuestions}>
                        <p>{copy.research.additionalQuestions}</p>
                        <ul>
                          {card.additionalQuestions.map((question) => (
                            <li key={question}>{question}</li>
                          ))}
                        </ul>
                      </aside>
                    ) : null}
                    {pendingImportedResult ? (
                      <ImportedResearchResultPending copy={copy} result={pendingImportedResult} />
                    ) : null}
                  </div>
                  {canImportResearch ? (
                    <div className="answer-box research-import-box">
                      {visibleChatGptImportHint ? (
                        <p className="research-recovery">{visibleChatGptImportHint}</p>
                      ) : null}
                      {canUseVisibleChatGptHandoff ? (
                        <VisibleChatGptResearchHandoff copy={copy} task={task} />
                      ) : null}
                      <label className="research-import-field">
                        <span>{copy.research.importResult}</span>
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
                      </label>
                      <div className="card-actions research-primary-actions">
                        <button type="button" disabled={isBusy} onClick={() => void importResearchResult(task.researchTaskId)}>
                          {copy.research.importResult}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <div className="research-card-action-zone">
                    <div className="card-actions research-primary-actions">
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveResearchAllowlist || !canStartReadOnlyRun}
                        onClick={() => void startReadOnlyResearchRun(task.researchTaskId)}
                      >
                        {copy.research.startReadOnlyRun}
                      </button>
                    </div>
                    {card && !card.terminalOutcome && card.availableOutcomes.length ? (
                      <div className="card-actions research-secondary-actions">
                        {card.availableOutcomes.map((outcome) => (
                          <button
                            type="button"
                            disabled={isBusy}
                            key={outcome}
                            onClick={() => void resolveResearchCard(card.cardId, outcome, card.title)}
                          >
                            {copy.research.terminalOutcomeLabels[outcome]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
