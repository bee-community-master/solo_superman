import type { IfStopNowArtifactProjection } from "@solo-superman/contracts";
import { useAppLanguage, type AppLanguage } from "../../../shared/i18n/app-language";
import { Phase15bReadinessPanel } from "../Phase15bReadinessPanel";
import { PlanningHandoffPanel } from "../PlanningHandoffPanel";
import { decisionQueueDisplayText } from "../text-formatting";
import { useDecisionQueueCopy, type DecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface PlanningViewProps {
  readonly controller: DecisionQueueShellController;
}

function PlanningTextList({
  ariaLabel,
  items,
  language
}: {
  readonly ariaLabel?: string;
  readonly items: readonly string[];
  readonly language: AppLanguage;
}) {
  const visibleItems = items.map((item) => decisionQueueDisplayText(item, language)).filter(Boolean);

  return (
    <ul aria-label={ariaLabel} className="effect-list">
      {visibleItems.map((item, index) => (
        <li key={`${index}:${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function IfStopNowArtifactCard({
  artifact,
  copy,
  language
}: {
  readonly artifact: IfStopNowArtifactProjection;
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
}) {
  return (
    <section className="if-stop-now-artifact" aria-label={copy.planning.ifStopNowArtifact}>
      <h4>{artifact.title ? decisionQueueDisplayText(artifact.title, language) : copy.planning.ifStopNowArtifact}</h4>
      <p>{decisionQueueDisplayText(artifact.summary, language)}</p>
      {artifact.knownRisks.length ? (
        <div>
          <strong>{copy.planning.ifStopNowKnownRisks}</strong>
          <PlanningTextList ariaLabel={copy.planning.ifStopNowKnownRisks} items={artifact.knownRisks} language={language} />
        </div>
      ) : null}
      {artifact.nextValidationActions.length ? (
        <div>
          <strong>{copy.planning.ifStopNowNextValidationActions}</strong>
          <PlanningTextList
            ariaLabel={copy.planning.ifStopNowNextValidationActions}
            items={artifact.nextValidationActions}
            language={language}
          />
        </div>
      ) : null}
    </section>
  );
}

function FounderBriefRiskActions({
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
    <section className="founder-brief-risk-actions" aria-label={copy.planning.founderBriefRiskActions}>
      <h3>{copy.planning.founderBriefRiskActions}</h3>
      {knownRisks.length ? (
        <div>
          <strong>{copy.planning.founderBriefKnownRisks}</strong>
          <PlanningTextList ariaLabel={copy.planning.founderBriefKnownRisks} items={knownRisks} language={language} />
        </div>
      ) : null}
      {nextValidationActions.length ? (
        <div>
          <strong>{copy.planning.founderBriefNextValidationActions}</strong>
          <PlanningTextList
            ariaLabel={copy.planning.founderBriefNextValidationActions}
            items={nextValidationActions}
            language={language}
          />
        </div>
      ) : null}
    </section>
  );
}

export function PlanningView({ controller }: PlanningViewProps) {
  const copy = useDecisionQueueCopy();
  const { language } = useAppLanguage();
  const {
    businessCriticIntensityChangeReason,
    changeBusinessCriticIntensity,
    changeProjectPurposeMode,
    confidence,
    isBusy,
    phase15bReadinessView,
    planningHandoffView,
    prepareFounderBrief,
    prepareImplementationContext,
    projections,
    purposeModeChangeReason,
    refreshPhase15bReadiness,
    refreshPlanningHandoff,
    runPlanningHandoffGate,
    scoreCompleteness,
    setBusinessCriticIntensityChangeReason,
    setPurposeModeChangeReason
  } = controller;
  const topRiskCards = confidence?.topRiskCards?.slice(0, 3) ?? [];
  const nextBestActions = confidence?.nextBestActions ?? [];
  const scoreBreakdownItems = confidence
    ? [
        ["sectionCompleteness", confidence.scoreBreakdown.sectionCompleteness],
        ["questionDebtResolution", confidence.scoreBreakdown.questionDebtResolution],
        ["evidenceQuality", confidence.scoreBreakdown.evidenceQuality],
        ["decisionApproval", confidence.scoreBreakdown.decisionApproval],
        ["consistencyAndConflict", confidence.scoreBreakdown.consistencyAndConflict]
      ] as const
    : [];
  const skippedCommercializationAxes = [
    projections.queue?.skippedCommercializationAxes,
    confidence?.skippedCommercializationAxes,
    projections.founderBrief?.skippedCommercializationAxes,
    projections.planningHandoff?.finalArtifact?.scopeSnapshot.skippedCommercializationAxes
  ].find((axes) => (axes?.length ?? 0) > 0) ?? [];
  const sessionStatusLabel = projections.session
    ? copy.planning.sessionStatusLabels[projections.session.phase]
    : copy.planning.sessionStatusLabels.none;

  return (
    <div className="view-grid planning-view">
      <section className="panel spec-panel">
        <div className="panel-heading">
          <h2>{copy.planning.spec}</h2>
          <span>{decisionQueueDisplayText(sessionStatusLabel, language)}</span>
        </div>
        {projections.spec?.title ? (
          <div className="spec-outline">
            <h3>{decisionQueueDisplayText(projections.spec.title, language)}</h3>
            {projections.spec.sections?.length ? (
              <ol>
                {projections.spec.sections.map((section) => (
                  <li key={section}>{decisionQueueDisplayText(section, language)}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : (
          <p className="empty-state">{copy.planning.noSpecDraft}</p>
        )}
        <dl className="metrics">
          <div>
            <dt>{copy.planning.sessionVersion}</dt>
            <dd>{projections.session?.version ?? 0}</dd>
          </div>
          <div>
            <dt>{copy.planning.specSections}</dt>
            <dd>{projections.spec?.sectionCount ?? 0}</dd>
          </div>
          <div>
            <dt>{copy.planning.approval}</dt>
            <dd>{projections.spec?.approvalStatus ?? "draft"}</dd>
          </div>
          <div>
            <dt>{copy.planning.projectPurpose}</dt>
            <dd>{projections.session?.projectPurposeModeLabel ?? copy.planning.notSelected}</dd>
          </div>
          <div>
            <dt>{copy.planning.businessCritic}</dt>
            <dd>{projections.session?.businessCriticIntensityLabel ?? copy.planning.notApplicable}</dd>
          </div>
        </dl>
        {projections.session?.projectPurposeModeEffect ? (
          <p className="mode-summary">{projections.session.projectPurposeModeEffect}</p>
        ) : null}
        {projections.session?.businessCriticIntensityEffect ? (
          <p className="mode-summary">{projections.session.businessCriticIntensityEffect}</p>
        ) : null}
        {skippedCommercializationAxes.length ? (
          <div className="skipped-commercialization-axes" aria-label={copy.planning.skippedCommercializationAxes}>
            <strong>{copy.planning.skippedCommercializationAxes}</strong>
            <p>{copy.planning.skippedCommercializationAxesHelp}</p>
            <ul className="effect-list">
              {skippedCommercializationAxes.map((axis) => (
                <li key={axis}>{copy.planning.commercializationAxisLabel(axis)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {projections.session?.projectPurposeMode === "business" ? (
          <div className="mode-change-panel">
            <label>
              {copy.planning.businessCriticChangeReason}
              <input
                value={businessCriticIntensityChangeReason}
                onChange={(event) => setBusinessCriticIntensityChangeReason(event.target.value)}
                placeholder={copy.planning.businessCriticChangeReasonPlaceholder}
              />
            </label>
            <div className="card-actions">
              {copy.businessCriticIntensityOptions.map((option) => (
                <button
                  type="button"
                  disabled={isBusy || projections.session?.businessCriticIntensity === option.intensity}
                  key={option.intensity}
                  onClick={() => void changeBusinessCriticIntensity(option.intensity)}
                >
                  {copy.planning.changeTo(option.label)}
                </button>
              ))}
            </div>
            <small>
              {copy.planning.businessCriticAuditHelp}
            </small>
          </div>
        ) : null}
        {projections.session ? (
          <div className="mode-change-panel">
            <label>
              {copy.planning.modeChangeReason}
              <input
                value={purposeModeChangeReason}
                onChange={(event) => setPurposeModeChangeReason(event.target.value)}
                placeholder={copy.planning.modeChangeReasonPlaceholder}
              />
            </label>
            <div className="card-actions">
              {copy.projectPurposeModeOptions.map((option) => (
                <button
                  type="button"
                  disabled={isBusy || projections.session?.projectPurposeMode === option.mode}
                  key={option.mode}
                  onClick={() => void changeProjectPurposeMode(option.mode)}
                >
                  {copy.planning.changeTo(option.label)}
                </button>
              ))}
            </div>
            <small>{copy.planning.modeAuditHelp}</small>
          </div>
        ) : null}
      </section>

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

      <section className="panel score-panel">
        <div className="panel-heading">
          <h2>{copy.planning.progress}</h2>
          <span>{confidence?.readinessLabel ?? copy.planning.pending}</span>
        </div>
        {topRiskCards.length ? (
          <section className="top-risk-card-stack" aria-label={copy.planning.topRiskCards}>
            <h3>{copy.planning.whyBuildNowRisky}</h3>
            <ol className="top-risk-card-list">
              {topRiskCards.map((risk) => (
                <li className={`top-risk-card severity-${risk.severity}`} key={risk.riskId}>
                  <div className="top-risk-card-heading">
                    <strong>{decisionQueueDisplayText(risk.title, language)}</strong>
                    <span>{copy.planning.riskSeverity}: {copy.planning.riskSeverityLabels[risk.severity]}</span>
                  </div>
                  <p aria-label={`${copy.planning.riskNextValidationAriaPrefix} ${decisionQueueDisplayText(risk.title, language)}`}>
                    {copy.planning.riskNextValidation}: {decisionQueueDisplayText(risk.nextValidationAction, language)}
                  </p>
                  <small>
                    {copy.planning.riskSourceRefs}: {
                      risk.sourceRefs.map((ref) => decisionQueueDisplayText(ref, language)).filter(Boolean).join(", ") ||
                      copy.planning.riskNoSourceRefs
                    }
                  </small>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="empty-state">{copy.planning.noRiskProjection}</p>
        )}
        {nextBestActions.length ? (
          <section className="confidence-next-actions" aria-label={copy.planning.thisWeekValidationActions}>
            <h3>{copy.planning.thisWeekValidationActions}</h3>
            <PlanningTextList
              ariaLabel={copy.planning.thisWeekValidationActions}
              items={nextBestActions}
              language={language}
            />
          </section>
        ) : null}
        <div className="score">{confidence?.compositeScore ?? 0}</div>
        <button type="button" disabled={isBusy || !projections.session} onClick={() => void scoreCompleteness()}>
          {copy.planning.scoreCompleteness}
        </button>
        <button type="button" disabled={isBusy || !projections.session} onClick={() => void prepareImplementationContext()}>
          {copy.handoff.planningActionLabels.prepareImplementationContext}
        </button>
        {confidence ? (
          <section className="confidence-map" aria-label={copy.planning.confidenceMap}>
            <div className="confidence-map-heading">
              <h3>{copy.planning.confidenceMap}</h3>
              <span className={`candidate-status status-${confidence.completionCandidate.status}`}>
                {copy.planning.completionCandidateStatusLabels[confidence.completionCandidate.status]}
              </span>
            </div>
            <p>{copy.planning.confidenceMapHelp}</p>
            <dl className="confidence-breakdown">
              {scoreBreakdownItems.map(([key, value]) => (
                <div key={key}>
                  <dt>{copy.planning.scoreBreakdownLabels[key]}</dt>
                  <dd>{value}%</dd>
                </div>
              ))}
            </dl>
            <div className="completion-candidate-summary">
              <strong>
                {copy.planning.completionCandidate}: {decisionQueueDisplayText(confidence.completionCandidate.summary, language)}
              </strong>
              {confidence.completionCandidate.gateFailures.length ? (
                <div className="confidence-gate-failures">
                  <span>{copy.planning.confidenceGateFailures}</span>
                  <PlanningTextList
                    ariaLabel={copy.planning.confidenceGateFailures}
                    items={confidence.completionCandidate.gateFailures}
                    language={language}
                  />
                </div>
              ) : (
                <p>{copy.planning.confidenceGatesReady}</p>
              )}
            </div>
            <IfStopNowArtifactCard
              artifact={confidence.completionCandidate.ifStopNowArtifact}
              copy={copy}
              language={language}
            />
          </section>
        ) : null}
      </section>

      <section className="panel founder-brief-panel">
        <div className="panel-heading">
          <h2>{copy.planning.founderBrief}</h2>
          <span>{projections.founderBrief?.exportReady ? copy.planning.ready : copy.planning.draft}</span>
        </div>
        <button type="button" disabled={isBusy || !projections.session} onClick={() => void prepareFounderBrief()}>
          {copy.planning.prepareExportMetadata}
        </button>
        {projections.founderBrief ? (
          <div className="spec-outline">
            {projections.founderBrief.briefSections.map((section) => (
              <section key={section.sectionId}>
                <h3>{decisionQueueDisplayText(section.title, language)}</h3>
                <p>{decisionQueueDisplayText(section.body, language)}</p>
              </section>
            ))}
            <FounderBriefRiskActions
              copy={copy}
              language={language}
              knownRisks={projections.founderBrief.knownRisks}
              nextValidationActions={projections.founderBrief.nextValidationActions}
            />
          </div>
        ) : (
          <p className="empty-state">{copy.planning.noFounderBrief}</p>
        )}
      </section>
    </div>
  );
}
