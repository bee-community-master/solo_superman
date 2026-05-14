import { Phase15bReadinessPanel } from "../Phase15bReadinessPanel";
import { PlanningHandoffPanel } from "../PlanningHandoffPanel";
import {
  BUSINESS_CRITIC_INTENSITY_OPTIONS,
  PROJECT_PURPOSE_MODE_OPTIONS
} from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface PlanningViewProps {
  readonly controller: DecisionQueueShellController;
}

export function PlanningView({ controller }: PlanningViewProps) {
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
              변경은 `BusinessCriticIntensityChanged` 이벤트로 audit되며 새 critical pressure는 active batch를 교체하지 않고 queued_next에 추가됩니다.
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

      <section className="panel founder-brief-panel">
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
    </div>
  );
}
