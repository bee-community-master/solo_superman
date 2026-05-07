import type { PlanningHandoffDetailGroup, PlanningHandoffViewModel } from "./decision-queue-view-model";

interface PlanningHandoffPanelProps {
  readonly hasActiveSession: boolean;
  readonly isBusy: boolean;
  readonly handoff: PlanningHandoffViewModel;
  readonly onRefreshHandoff: () => void;
}

function PlanningHandoffGroup({ group }: { readonly group: PlanningHandoffDetailGroup }) {
  return (
    <section>
      <strong>{group.title}</strong>
      <ul className="handoff-detail-list">
        {group.items.map((item) => (
          <li key={`${group.title}:${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PlanningHandoffPanel({
  hasActiveSession,
  isBusy,
  handoff,
  onRefreshHandoff
}: PlanningHandoffPanelProps) {
  const artifact = handoff.final ?? handoff.blocker;

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Planning Handoff</h2>
        <span>{handoff.statusLabel}</span>
      </div>
      <p className="operations-summary">{handoff.label}</p>
      <p className="operations-summary">{handoff.summary}</p>
      <p className="operations-summary">{handoff.noExecutionLabel}</p>
      <p className="operations-summary">{handoff.refetchLabel}</p>
      <p className="operations-summary">source refs: {handoff.sourceRefsLabel}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onRefreshHandoff}>
          Refresh handoff
        </button>
      </div>
      {artifact ? (
        <article className={`operations-card handoff-card ${handoff.status}`}>
          <strong>{artifact.heading}</strong>
          {artifact.groups.map((group) => (
            <PlanningHandoffGroup group={group} key={group.title} />
          ))}
        </article>
      ) : (
        <p className="empty-state">{handoff.emptyLabel}</p>
      )}
    </section>
  );
}
