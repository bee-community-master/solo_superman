import { Phase15bReadinessPanel } from "../Phase15bReadinessPanel";
import { PlanningHandoffPanel } from "../PlanningHandoffPanel";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface PlanningViewProps {
  readonly controller: DecisionQueueShellController;
}

export function PlanningView({ controller }: PlanningViewProps) {
  const copy = useDecisionQueueCopy();
  const {
    businessCriticIntensityChangeReason,
    changeBusinessCriticIntensity,
    changeProjectPurposeMode,
    confidence,
    isBusy,
    phase15bReadinessView,
    planningHandoffView,
    prepareFounderBrief,
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
          <span>{sessionStatusLabel}</span>
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
        <div className="score">{confidence?.compositeScore ?? 0}</div>
        <button type="button" disabled={isBusy || !projections.session} onClick={() => void scoreCompleteness()}>
          {copy.planning.scoreCompleteness}
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
              <strong>{copy.planning.completionCandidate}: {confidence.completionCandidate.summary}</strong>
              {confidence.completionCandidate.gateFailures.length ? (
                <div className="confidence-gate-failures">
                  <span>{copy.planning.confidenceGateFailures}</span>
                  <ul className="effect-list" aria-label={copy.planning.confidenceGateFailures}>
                    {confidence.completionCandidate.gateFailures.map((failure) => (
                      <li key={failure}>{failure}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>{copy.planning.confidenceGatesReady}</p>
              )}
            </div>
            {nextBestActions.length ? (
              <div className="confidence-next-actions">
                <strong>{copy.planning.nextBestActions}</strong>
                <ul className="effect-list" aria-label={copy.planning.nextBestActions}>
                  {nextBestActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
        {topRiskCards.length ? (
          <section className="top-risk-card-stack" aria-label={copy.planning.topRiskCards}>
            <h3>{copy.planning.topRiskCards}</h3>
            <ol className="top-risk-card-list">
              {topRiskCards.map((risk) => (
                <li className={`top-risk-card severity-${risk.severity}`} key={risk.riskId}>
                  <div className="top-risk-card-heading">
                    <strong>{risk.title}</strong>
                    <span>{copy.planning.riskSeverity}: {copy.planning.riskSeverityLabels[risk.severity]}</span>
                  </div>
                  <p aria-label={`${copy.planning.riskNextValidationAriaPrefix} ${risk.title}`}>
                    {copy.planning.riskNextValidation}: {risk.nextValidationAction}
                  </p>
                  <small>
                    {copy.planning.riskSourceRefs}: {risk.sourceRefs.length ? risk.sourceRefs.join(", ") : copy.planning.riskNoSourceRefs}
                  </small>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="empty-state">{copy.planning.noRiskProjection}</p>
        )}
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
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        ) : (
          <p className="empty-state">{copy.planning.noFounderBrief}</p>
        )}
      </section>
    </div>
  );
}
