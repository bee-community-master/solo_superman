import type {
  DecisionEvidencePackProjection,
  EvidenceItemProjection,
  EvidenceMatrixProjection,
  LivingSpecProjection,
  ResearchResultProjection,
  ResearchRunControlProjection,
  ResearchTaskProjection,
  ResearchReviewCardProjection
} from "@solo-superman/contracts";
import { localizedUserFacingDecisionQueueText } from "@solo-superman/contracts";
import { chatGptVisibleResearchImportHint } from "../chatgpt-visible-research-import";
import { visibleChatGptResearchHandoffForTask } from "../chatgpt-browser-delegation-request";
import { localizedResearchReviewCardTitle } from "../decision-queue-operations-view-model";
import { phase15aRunStatusLabel } from "../phase15a-operation-labels";
import { Phase15aOperationsPanel } from "../Phase15aOperationsPanel";
import type { ReadyReadOnlyResearchRunStartPlan } from "../ready-readonly-research-start-plan";
import {
  researchRoutingReadinessForTask,
  taskShouldUseBrowserDeepResearch
} from "../research-routing-readiness";
import { compactDecisionQueueDisplayText as compactUserFacingText } from "../text-formatting";
import { useAppLanguage, type AppLanguage } from "../../../shared/i18n/app-language";
import { useDecisionQueueCopy, type DecisionQueueCopy } from "./decision-queue-copy";
import { uniqueTextItems } from "./list-values";
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

function latestEvidenceMatrixForTask(
  matrices: readonly EvidenceMatrixProjection[],
  researchTaskId: ResearchTaskProjection["researchTaskId"]
) {
  return [...matrices]
    .filter((matrix) => matrix.researchTaskId === researchTaskId)
    .sort((left, right) => right.synthesisVersion - left.synthesisVersion)[0];
}

function latestEvidencePackForTask(
  packs: readonly DecisionEvidencePackProjection[],
  researchTaskId: ResearchTaskProjection["researchTaskId"]
) {
  return [...packs].filter((pack) => pack.researchTaskId === researchTaskId).at(-1);
}

function researchRunTimestamp(run: ResearchRunControlProjection["runs"][number]) {
  const updatedAt = Date.parse(run.updatedAt);

  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  const createdAt = Date.parse(run.createdAt);

  return Number.isNaN(createdAt) ? 0 : createdAt;
}

function latestResearchRunForTask(
  runs: readonly ResearchRunControlProjection["runs"][number][],
  researchTaskId: ResearchTaskProjection["researchTaskId"]
) {
  return [...runs]
    .filter((run) => run.researchTaskId === researchTaskId)
    .sort((left, right) => researchRunTimestamp(right) - researchRunTimestamp(left))[0];
}

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

function researchSourceDisplay(input: {
  readonly sourceTitle: string | undefined;
  readonly sourceUrl: string | undefined;
  readonly copy: DecisionQueueCopy;
}) {
  const sourceUrl = safeExternalUrl(input.sourceUrl);
  const sourceLabel =
    input.sourceTitle ?? (sourceUrl ? input.copy.research.evidencePackSource : input.copy.research.noPublicSourceConfirmed);

  return {
    sourceLabel,
    sourceUrl
  };
}

function userFacingText(value: string | undefined, language: AppLanguage) {
  return value ? localizedUserFacingDecisionQueueText(value, language) : "";
}

function TextList({ items, language }: { readonly items: readonly string[]; readonly language: AppLanguage }) {
  const visibleItems = uniqueTextItems(items)
    .map((item) => compactUserFacingText(item, language))
    .filter(Boolean);

  return (
    <ul>
      {visibleItems.map((item) => (
        <li key={item}>{item}</li>
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
    </aside>
  );
}

function EvidenceItems({
  copy,
  items,
  language,
  label
}: {
  readonly copy: DecisionQueueCopy;
  readonly items: readonly EvidenceItemProjection[];
  readonly language: AppLanguage;
  readonly label: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.evidenceItemId}>{compactUserFacingText(item.summary, language)}</li>
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
  language,
  pack
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly pack: DecisionEvidencePackProjection;
}) {
  const { sourceLabel, sourceUrl } = researchSourceDisplay({
    sourceTitle: pack.sourceTitle,
    sourceUrl: pack.sourceUrl,
    copy
  });

  return (
    <div>
      <dt>{copy.research.evidencePackSource}</dt>
      <dd>
        {sourceUrl ? (
          <a href={sourceUrl} rel="noreferrer" target="_blank">
            {userFacingText(sourceLabel, language)}
          </a>
        ) : (
          userFacingText(sourceLabel, language)
        )}
      </dd>
    </div>
  );
}

function EvidencePackGateChecks({
  copy,
  language,
  pack
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
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
                {copy.research.gateCheckStatusLabels[check.status]} — {compactUserFacingText(check.reason, language)}
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
  language,
  pack
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly pack: DecisionEvidencePackProjection;
}) {
  return (
    <article className="research-evidence-pack">
      <div className="research-evidence-matrix-heading">
        <strong>{compactUserFacingText(pack.claim, language)}</strong>
        <span>{copy.research.gateStatus}: {copy.research.gateStatusLabels[pack.gateStatus]}</span>
        <span>
          {copy.research.sourceReliability}: {copy.research.sourceReliabilityLabels[pack.sourceReliability]}
        </span>
      </div>
      <dl className="research-evidence-grid">
        <div>
          <dt>{copy.research.decisionContext}</dt>
          <dd>{compactUserFacingText(pack.decisionContext, language)}</dd>
        </div>
        <EvidencePackSource copy={copy} language={language} pack={pack} />
        <EvidencePackGateChecks copy={copy} language={language} pack={pack} />
        {pack.knownRisk ? (
          <div>
            <dt>{copy.research.knownRisk}</dt>
            <dd>{compactUserFacingText(pack.knownRisk, language)}</dd>
          </div>
        ) : null}
        {pack.nextValidationAction ? (
          <div>
            <dt>{copy.research.nextValidationAction}</dt>
            <dd>{compactUserFacingText(pack.nextValidationAction, language)}</dd>
          </div>
        ) : null}
        {pack.limitationRefs.length ? (
          <div>
            <dt>{copy.research.limitationRefs}</dt>
            <dd>
              <TextList items={pack.limitationRefs} language={language} />
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function ResearchValidationSummary({
  copy,
  language,
  knownRisks,
  nextValidationActions
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
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
              <TextList items={knownRisks} language={language} />
            </dd>
          </div>
        ) : null}
        {nextValidationActions.length ? (
          <div>
            <dt>{copy.research.nextValidationActions}</dt>
            <dd>
              <TextList items={nextValidationActions} language={language} />
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function EvidencePacksSection({
  copy,
  evidencePacks,
  language
}: {
  readonly copy: DecisionQueueCopy;
  readonly evidencePacks: readonly DecisionEvidencePackProjection[];
  readonly language: AppLanguage;
}) {
  if (!evidencePacks.length) {
    return null;
  }

  return (
    <section className="research-evidence-packs" aria-label={copy.research.evidencePacks}>
      <h3>{copy.research.evidencePacks}</h3>
      <div className="research-evidence-pack-list">
        {evidencePacks.map((pack) => (
          <EvidencePackCard copy={copy} key={pack.evidencePackId} language={language} pack={pack} />
        ))}
      </div>
    </section>
  );
}

function EvidenceMatrixCard({
  copy,
  language,
  matrix
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly matrix: EvidenceMatrixProjection;
}) {
  const matrixTitle =
    matrix.knownRisk ??
    matrix.missingConEvidenceReason ??
    (matrix.decisionBlocked ? copy.research.decisionBlocked : copy.research.decisionReady);

  return (
    <article className="research-evidence-matrix">
      <div className="research-evidence-matrix-heading">
        <strong>{compactUserFacingText(matrixTitle, language)}</strong>
        <span>
          {copy.research.balanceStatus}: {copy.research.balanceStatusLabels[matrix.balanceStatus]}
        </span>
        <span>{matrix.decisionBlocked ? copy.research.decisionBlocked : copy.research.decisionReady}</span>
      </div>
      <dl className="research-evidence-grid">
        <EvidenceItems copy={copy} items={matrix.proEvidence} label={copy.research.proEvidence} language={language} />
        <EvidenceItems copy={copy} items={matrix.conEvidence} label={copy.research.conEvidence} language={language} />
        <EvidenceItems copy={copy} items={matrix.uncertainties} label={copy.research.uncertainties} language={language} />
        {matrix.missingConEvidenceReason ? (
          <div>
            <dt>{copy.research.missingConEvidenceReason}</dt>
            <dd>{compactUserFacingText(matrix.missingConEvidenceReason, language)}</dd>
          </div>
        ) : null}
        {matrix.knownRisk ? (
          <div>
            <dt>{copy.research.knownRisk}</dt>
            <dd>{compactUserFacingText(matrix.knownRisk, language)}</dd>
          </div>
        ) : null}
        {matrix.additionalQuestions.length ? (
          <div>
            <dt>{copy.research.additionalQuestions}</dt>
            <dd>
              <ul>
                {uniqueTextItems(matrix.additionalQuestions).map((question) => (
                  <li key={question}>{compactUserFacingText(question, language)}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function ResearchInsufficientSummary({
  card,
  copy,
  language,
  result,
  task
}: {
  readonly card: ResearchReviewCardProjection | undefined;
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly result: ResearchResultProjection | undefined;
  readonly task: ResearchTaskProjection;
}) {
  const isInsufficient =
    task.status === "research_insufficient" ||
    card?.state === "research_insufficient" ||
    card?.terminalOutcome === "research_insufficient";

  if (!isInsufficient) {
    return null;
  }

  const checkedScope = result?.sourceTitle || result?.sourceUrl
    ? userFacingText(result.sourceTitle ?? copy.research.evidencePackSource, language)
    : copy.research.noPublicSourceConfirmed;
  const weakReason =
    card?.terminalRationale ??
    result?.limitationNotes ??
    result?.resultSummary ??
    "판단에 쓸 공개 근거가 부족합니다.";
  const visibleWeakReason =
    compactUserFacingText(weakReason, language) || copy.research.defaultInsufficientReason;

  return (
    <aside className="research-insufficient-summary" aria-label={copy.research.insufficientSummaryTitle}>
      <strong>{copy.research.insufficientSummaryTitle}</strong>
      <dl className="research-evidence-grid">
        <div>
          <dt>{copy.research.insufficientSearchedFor}</dt>
          <dd>{compactUserFacingText(task.objective, language)}</dd>
        </div>
        <div>
          <dt>{copy.research.insufficientCheckedScope}</dt>
          <dd>{checkedScope}</dd>
        </div>
        <div>
          <dt>{copy.research.insufficientReason}</dt>
          <dd>{visibleWeakReason}</dd>
        </div>
        <div>
          <dt>{copy.research.insufficientNextAction}</dt>
          <dd>{copy.research.manualValidationFallback}</dd>
        </div>
      </dl>
    </aside>
  );
}

function evidenceText(items: readonly EvidenceItemProjection[], language: AppLanguage, fallback: string) {
  const summaries = uniqueTextItems(items.map((item) => compactUserFacingText(item.summary, language)).filter(Boolean));

  return summaries.length ? summaries.join(" / ") : fallback;
}

function hasAlternativeOrCompetitorSignal(values: readonly (string | undefined)[]) {
  return values.some((value) =>
    /(?:대안|경쟁|경쟁사|대체재|기존\s*제품|alternative|competitor|competing|substitute|既存|代替|競合)/iu.test(value ?? "")
  );
}

function ResearchDecisionSummary({
  card,
  copy,
  language,
  matrix,
  pack,
  result,
  task
}: {
  readonly card: ResearchReviewCardProjection | undefined;
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly matrix: EvidenceMatrixProjection | undefined;
  readonly pack: DecisionEvidencePackProjection | undefined;
  readonly result: ResearchResultProjection | undefined;
  readonly task: ResearchTaskProjection;
}) {
  if (!matrix && !pack && !result && !card) {
    return null;
  }

  const evidence = matrix
    ? evidenceText(matrix.proEvidence, language, compactUserFacingText(result?.resultSummary ?? task.objective, language))
    : compactUserFacingText(pack?.claim ?? result?.resultSummary ?? task.objective, language);
  const counterEvidence = matrix
    ? evidenceText(matrix.conEvidence, language, matrix.missingConEvidenceReason ?? copy.research.decisionUnitNoCounterEvidence)
    : compactUserFacingText(card?.terminalRationale ?? copy.research.decisionUnitNoCounterEvidence, language);
  const uncertainty = matrix
    ? evidenceText(matrix.uncertainties, language, matrix.knownRisk ?? copy.research.decisionUnitNoUncertainty)
    : compactUserFacingText(result?.limitationNotes ?? pack?.knownRisk ?? copy.research.decisionUnitNoUncertainty, language);
  const nextDecision = compactUserFacingText(
    pack?.nextValidationAction ??
      result?.implicationScope ??
      copy.research.decisionUnitFallbackNextDecision,
    language
  );
  const isInsufficient =
    task.status === "research_insufficient" ||
    card?.state === "research_insufficient" ||
    card?.terminalOutcome === "research_insufficient" ||
    matrix?.decisionBlocked === true;
  const competitorFound = hasAlternativeOrCompetitorSignal([
    result?.resultSummary,
    result?.claim,
    result?.decisionContext,
    result?.implicationScope,
    pack?.claim,
    pack?.decisionContext,
    pack?.knownRisk,
    matrix?.knownRisk,
    matrix?.missingConEvidenceReason,
    ...(matrix?.proEvidence.map((item) => item.summary) ?? []),
    ...(matrix?.conEvidence.map((item) => item.summary) ?? [])
  ]);

  return (
    <aside className="research-decision-summary" aria-label={copy.research.decisionUnitSummaryTitle}>
      <strong>{copy.research.decisionUnitSummaryTitle}</strong>
      <dl className="research-evidence-grid">
        <div>
          <dt>{copy.research.decisionUnitEvidence}</dt>
          <dd>{evidence}</dd>
        </div>
        <div>
          <dt>{copy.research.decisionUnitCounterEvidence}</dt>
          <dd>{counterEvidence}</dd>
        </div>
        <div>
          <dt>{copy.research.decisionUnitUncertainty}</dt>
          <dd>{uncertainty}</dd>
        </div>
        <div>
          <dt>{copy.research.decisionUnitNextDecision}</dt>
          <dd>{nextDecision}</dd>
        </div>
        {competitorFound ? (
          <div>
            <dt>{copy.research.decisionUnitMvpNarrowing}</dt>
            <dd>{copy.research.decisionUnitMvpNarrowingSuggestion}</dd>
          </div>
        ) : null}
        {isInsufficient ? (
          <>
            <div>
              <dt>{copy.research.decisionUnitMissingEvidence}</dt>
              <dd>{copy.research.decisionUnitInsufficientMissingEvidence}</dd>
            </div>
            <div>
              <dt>{copy.research.decisionUnitNextSearchOrQuestion}</dt>
              <dd>{copy.research.decisionUnitInsufficientNextSearch}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </aside>
  );
}

function VisibleChatGptResearchHandoff({
  copy,
  language,
  planningContext,
  spec,
  task
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly planningContext?: string | null | undefined;
  readonly spec?: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
  readonly task: ResearchTaskProjection;
}) {
  const handoff = visibleChatGptResearchHandoffForTask({ language, planningContext, spec, task });

  return (
    <aside className="chatgpt-visible-research-handoff research-action-assist">
      <div className="research-evidence-matrix-heading">
        <strong>{copy.research.visibleChatGptHandoffTitle}</strong>
        <a href={handoff.openUrl} rel="noopener noreferrer" target="_blank">
          {copy.research.visibleChatGptOpen}
        </a>
      </div>
      <p className="mode-summary">{copy.research.visibleChatGptHandoffBoundary}</p>
      <ol className="research-handoff-steps">
        {copy.research.visibleChatGptSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
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

function researchPlanningContext(input: {
  readonly queue: DecisionQueueShellController["projections"]["queue"];
  readonly recentAnswers: readonly string[];
  readonly spec: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
}) {
  const visibleQuestions = [
    ...(input.queue?.active ?? []),
    ...(input.queue?.next ?? []),
    ...(input.queue?.blocked ?? [])
  ]
    .map((item) => item.title)
    .filter(Boolean)
    .slice(0, 4);
  const specContext = [input.spec?.title, ...(input.spec?.sections ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  const answerContext = input.recentAnswers
    .map((answer) => answer.trim())
    .filter(Boolean)
    .slice(0, 5);

  return [
    answerContext.length ? `최근 사용자 답변: ${answerContext.join(" / ")}` : null,
    visibleQuestions.length ? `현재 질문 맥락: ${visibleQuestions.join(" / ")}` : null,
    specContext ? `현재 기획 초안: ${specContext}` : null
  ].filter((value): value is string => Boolean(value)).join(" ");
}

function ImportedResearchResultPending({
  copy,
  language,
  result
}: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly result: ResearchResultProjection;
}) {
  const { sourceLabel, sourceUrl } = researchSourceDisplay({
    sourceTitle: result.sourceTitle,
    sourceUrl: result.sourceUrl,
    copy
  });
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
                {userFacingText(sourceLabel, language)}
              </a>
            ) : (
              userFacingText(sourceLabel, language)
            )}
          </dd>
        </div>
        <div>
          <dt>{copy.research.sourceReliability}</dt>
          <dd>{copy.research.sourceReliabilityLabels[sourceReliability]}</dd>
        </div>
        <div>
          <dt>{copy.research.importedResultSummary}</dt>
          <dd>{compactUserFacingText(result.resultSummary, language)}</dd>
        </div>
        {result.limitationNotes ? (
          <div>
            <dt>{copy.research.importedResultLimitations}</dt>
            <dd>{compactUserFacingText(result.limitationNotes, language)}</dd>
          </div>
        ) : null}
        {result.questionRef ? (
          <div>
            <dt>{copy.research.importedResultQuestionRef}</dt>
            <dd>{compactUserFacingText(result.questionRef, language)}</dd>
          </div>
        ) : null}
        {result.implicationScope ? (
          <div>
            <dt>{copy.research.importedResultImplicationScope}</dt>
            <dd>{compactUserFacingText(result.implicationScope, language)}</dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}

export function ResearchView({ controller }: ResearchViewProps) {
  const copy = useDecisionQueueCopy();
  const { language } = useAppLanguage();
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
    recentResearchAnswers = [],
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
  const planningContextForResearch = researchPlanningContext({
    queue: projections.queue,
    recentAnswers: recentResearchAnswers,
    spec: projections.spec
  });
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
              const routingReadiness = researchRoutingReadinessForTask({ task });
              const canImportResearch =
                routingReadiness !== "needs_more_clarification" &&
                (task.status === "planned" || card?.recoveryActions.includes("import_manual_result") === true);
              const canStartReadOnlyRun = readyReadOnlyResearchTaskIdSet.has(task.researchTaskId);
              const latestRun = latestResearchRunForTask(researchOperations.runs?.runs ?? [], task.researchTaskId);
              const latestResult = latestResearchResultForTask(research.results, task.researchTaskId);
              const latestMatrix = latestEvidenceMatrixForTask(research.evidenceMatrices, task.researchTaskId);
              const latestPack = latestEvidencePackForTask(evidencePacks, task.researchTaskId);
              const runStatusLabel = latestRun
                ? phase15aRunStatusLabel(copy.phase15a, latestRun.status)
                : canStartReadOnlyRun
                  ? copy.research.researchRunNotStarted
                  : copy.research.researchRunUnavailable;
              const retainedSourceRefs = card ? retainedSourceRefsForResearchCard(card) : [];
              const visibleSourceRefs = retainedSourceRefs
                .map((sourceRef) => compactUserFacingText(sourceRef, language))
                .filter(Boolean);
              const statusLabel = card
                ? copy.research.reviewCardStateLabels[card.state]
                : copy.research.taskStatusLabels[task.status];
              const summaryLabel = card
                ? copy.research.reviewCardTypeLabels[card.cardType]
                : copy.research.routeOutcomeLabels[task.routeOutcome];
              const impactLabel = copy.research.researchImpactLabels[card?.impact ?? task.impact];
              const headingLabel = card ? localizedResearchReviewCardTitle(card, statusLabel) : task.objective;
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
                taskShouldUseBrowserDeepResearch({ task }) &&
                (projections.session?.initialResearchAutomationPermission === "allow_codex_and_chatgpt_visible" ||
                  Boolean(visibleChatGptImportHint));

              return (
                <article className="research-card" key={task.researchTaskId}>
                  <div className="research-card-main">
                    <header className="research-card-header">
                      <h3>{compactUserFacingText(headingLabel, language)}</h3>
                      <span className="research-status-badge">{statusLabel}</span>
                    </header>
                    <p className="research-card-summary">{compactUserFacingText(summaryLabel, language)}</p>
                    <dl className="research-card-facts">
                      <div>
                        <dt>{copy.research.routingReadiness}</dt>
                        <dd>{copy.research.routingReadinessLabels[routingReadiness]}</dd>
                      </div>
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
                      <div>
                        <dt>{copy.research.researchRunStatus}</dt>
                        <dd>{runStatusLabel}</dd>
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
                    {card?.terminalRationale ? (
                      <p className="research-recovery">
                        {copy.research.rationale}: {compactUserFacingText(card.terminalRationale, language)}
                      </p>
                    ) : null}
                    {recoveryActionLabels.length ? <p className="research-recovery">{recoveryActionLabels.join(" / ")}</p> : null}
                    {visibleSourceRefs.length ? (
                      <aside className="research-card-source-trace" aria-label={copy.research.sourceTrace}>
                        <p>{copy.research.sourceTrace}</p>
                        <ul>
                          {visibleSourceRefs.map((sourceRef) => (
                            <li key={sourceRef}>{sourceRef}</li>
                          ))}
                        </ul>
                      </aside>
                    ) : null}
                    <ResearchDecisionSummary
                      card={card}
                      copy={copy}
                      language={language}
                      matrix={latestMatrix}
                      pack={latestPack}
                      result={latestResult}
                      task={task}
                    />
                    {card?.additionalQuestions?.length ? (
                      <aside className="research-additional-questions" aria-label={copy.research.additionalQuestions}>
                        <p>{copy.research.additionalQuestions}</p>
                        <ul>
                          {uniqueTextItems(card.additionalQuestions).map((question) => (
                            <li key={question}>{compactUserFacingText(question, language)}</li>
                          ))}
                        </ul>
                      </aside>
                    ) : null}
                    {pendingImportedResult ? (
                      <ImportedResearchResultPending copy={copy} language={language} result={pendingImportedResult} />
                    ) : null}
                    <ResearchInsufficientSummary
                      card={card}
                      copy={copy}
                      language={language}
                      result={latestResult}
                      task={task}
                    />
                  </div>
                  {canImportResearch ? (
                    <div className="answer-box research-import-box">
                      {visibleChatGptImportHint ? (
                        <p className="research-recovery">{visibleChatGptImportHint}</p>
                      ) : null}
                      {canUseVisibleChatGptHandoff ? (
                        <VisibleChatGptResearchHandoff
                          copy={copy}
                          language={language}
                          planningContext={planningContextForResearch}
                          spec={projections.spec}
                          task={task}
                        />
                      ) : null}
                      <label className="research-import-field">
                        <span>{copy.research.importResult}</span>
                        <textarea
                          aria-label={`${copy.research.importResearchAriaPrefix} ${compactUserFacingText(task.objective, language, 120)}`}
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
        <ResearchValidationSummary
          copy={copy}
          knownRisks={knownRisks}
          language={language}
          nextValidationActions={nextValidationActions}
        />
        <EvidencePacksSection copy={copy} evidencePacks={evidencePacks} language={language} />
        {research?.evidenceMatrices.length ? (
          <section className="research-evidence-matrices" aria-label={copy.research.evidenceMatrix}>
            <h3>{copy.research.evidenceMatrix}</h3>
            <div className="research-evidence-matrix-list">
              {research.evidenceMatrices.map((matrix) => (
                <EvidenceMatrixCard copy={copy} key={matrix.evidenceMatrixId} language={language} matrix={matrix} />
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
