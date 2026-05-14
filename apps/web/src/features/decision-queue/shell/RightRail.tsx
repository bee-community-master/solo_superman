import { PlanningCompletenessRadar } from "./PlanningCompletenessRadar";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface RightRailProps {
  readonly controller: DecisionQueueShellController;
}

const RECENT_ACTIVITY_LIMIT = 5;

export function RightRail({ controller }: RightRailProps) {
  const {
    activeResearchRunCount,
    commandLog,
    phase15aOperations,
    planningCompletenessScore,
    planningReadinessLabel,
    projections
  } = controller;
  const recentCommandLog = commandLog.slice(0, RECENT_ACTIVITY_LIMIT);

  return (
    <aside className="right-rail" aria-label="Live project summary">
      <section className="summary-card completeness-card">
        <div className="radar-card-header">
          <p className="rail-label">기획 완성도</p>
          <div>
            <strong>{planningCompletenessScore}%</strong>
            <span>{planningReadinessLabel}</span>
          </div>
        </div>
        <PlanningCompletenessRadar controller={controller} />
      </section>

      <section className="summary-card">
        <p className="rail-label">리서치 현황</p>
        <div className="research-stats">
          <span>
            <strong>{projections.research?.tasks.length ?? 0}</strong>
            tasks
          </span>
          <span>
            <strong>{activeResearchRunCount}</strong>
            active runs
          </span>
        </div>
        <p className="mode-summary">{phase15aOperations.exitGate.label}</p>
      </section>

      <section className="summary-card">
        <p className="rail-label">최근 활동</p>
        <div className="activity-list compact">
          {recentCommandLog.length ? (
            recentCommandLog.map((entry) => (
              <article className="activity-item" key={entry.id}>
                <strong>{entry.label}</strong>
                <span>{entry.status?.commandStatus ?? entry.response?.category ?? entry.message ?? entry.error ?? "pending"}</span>
              </article>
            ))
          ) : (
            <p className="empty-state">No activity yet.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
