import { PlanningCompletenessRadar } from "./PlanningCompletenessRadar";
import { userFacingCommandLogStatus } from "./command-log-display";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface RightRailProps {
  readonly controller: DecisionQueueShellController;
}

const RECENT_ACTIVITY_LIMIT = 5;

export function RightRail({ controller }: RightRailProps) {
  const copy = useDecisionQueueCopy();
  const {
    activeResearchRunCount,
    commandLog,
    phase15aOperations,
    planningCompletenessScore,
    planningRadarAxesView,
    planningRadarPolygonPoints,
    planningReadinessLabel,
    projections
  } = controller;
  const recentCommandLog = commandLog.slice(0, RECENT_ACTIVITY_LIMIT);

  return (
    <aside className="right-rail" aria-label={copy.rightRail.aria}>
      <section className="summary-card completeness-card">
        <div className="radar-card-header">
          <p className="rail-label">{copy.rightRail.planningCompleteness}</p>
          <div>
            <strong>{planningCompletenessScore}%</strong>
            <span>{planningReadinessLabel}</span>
          </div>
        </div>
        <PlanningCompletenessRadar
          axes={planningRadarAxesView}
          polygonPoints={planningRadarPolygonPoints}
          readinessLabel={planningReadinessLabel}
          score={planningCompletenessScore}
        />
      </section>

      <section className="summary-card">
        <p className="rail-label">{copy.rightRail.researchStatus}</p>
        <div className="research-stats">
          <span>
            <strong>{projections.research?.tasks.length ?? 0}</strong>
            {" "}
            {copy.rightRail.tasks}
          </span>
          <span>
            <strong>{activeResearchRunCount}</strong>
            {" "}
            {copy.rightRail.activeRuns}
          </span>
        </div>
        <p className="mode-summary">{projections.research ? phase15aOperations.exitGate.label : copy.rightRail.researchNeedsReview}</p>
      </section>

      <section className="summary-card">
        <p className="rail-label">{copy.rightRail.recentActivity}</p>
        <div className="activity-list compact">
          {recentCommandLog.length ? (
            recentCommandLog.map((entry) => (
              <article className="activity-item" key={entry.id}>
                <strong>{entry.label}</strong>
                <span>{userFacingCommandLogStatus(entry, copy.rightRail)}</span>
              </article>
            ))
          ) : (
            <p className="empty-state">{copy.rightRail.noActivity}</p>
          )}
        </div>
      </section>
    </aside>
  );
}
