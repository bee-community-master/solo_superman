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

  return (
    <div className="view-grid planning-view">
      <section className="panel spec-panel">
        <div className="panel-heading">
          <h2>{copy.planning.spec}</h2>
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
        {confidence?.topRisks.length ? (
          <ul>
            {confidence.topRisks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
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
