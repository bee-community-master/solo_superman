import type { PlanningHandoffDetailGroup, PlanningHandoffViewModel } from "./decision-queue-view-model";
import { useAppLanguage, type AppLanguage } from "../../shared/i18n/app-language";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";
import { decisionQueueDisplayText } from "./text-formatting";

interface PlanningHandoffPanelProps {
  readonly hasActiveSession: boolean;
  readonly isBusy: boolean;
  readonly handoff: PlanningHandoffViewModel;
  readonly onRunHandoffGate: () => void;
  readonly onRefreshHandoff: () => void;
}

function PlanningHandoffGroup({
  group,
  language
}: {
  readonly group: PlanningHandoffDetailGroup;
  readonly language: AppLanguage;
}) {
  const title = decisionQueueDisplayText(group.title, language);
  const items = group.items.map((item) => decisionQueueDisplayText(item, language)).filter(Boolean);

  if (!title && !items.length) {
    return null;
  }

  return (
    <section>
      {title ? <strong>{title}</strong> : null}
      <ul className="handoff-detail-list">
        {items.map((item) => (
          <li key={`${title}:${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PlanningHandoffPanel({
  hasActiveSession,
  isBusy,
  handoff,
  onRunHandoffGate,
  onRefreshHandoff
}: PlanningHandoffPanelProps) {
  const copy = useDecisionQueueCopy();
  const { language } = useAppLanguage();
  const artifact = handoff.final ?? handoff.blocker;
  const label = decisionQueueDisplayText(handoff.label, language);
  const summary = decisionQueueDisplayText(handoff.summary, language);
  const noExecutionLabel = decisionQueueDisplayText(handoff.noExecutionLabel, language);
  const refetchLabel = decisionQueueDisplayText(handoff.refetchLabel, language);
  const sourceRefsLabel = decisionQueueDisplayText(handoff.sourceRefsLabel, language);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{copy.handoff.title}</h2>
        <span>{decisionQueueDisplayText(handoff.statusLabel, language)}</span>
      </div>
      {label ? <p className="operations-summary">{label}</p> : null}
      {summary ? <p className="operations-summary">{summary}</p> : null}
      {noExecutionLabel ? <p className="operations-summary">{noExecutionLabel}</p> : null}
      {refetchLabel ? <p className="operations-summary">{refetchLabel}</p> : null}
      <p className="operations-summary">
        {copy.handoff.sourceRefs}: {sourceRefsLabel || decisionQueueDisplayText("no source references", language)}
      </p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onRunHandoffGate}>
          {copy.handoff.runGate}
        </button>
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onRefreshHandoff}>
          {copy.handoff.refresh}
        </button>
      </div>
      {artifact ? (
        <article className={`operations-card handoff-card ${handoff.status}`}>
          <strong>{decisionQueueDisplayText(artifact.heading, language)}</strong>
          {artifact.groups.map((group) => (
            <PlanningHandoffGroup group={group} key={group.title} language={language} />
          ))}
        </article>
      ) : (
        <p className="empty-state">{decisionQueueDisplayText(handoff.emptyLabel, language)}</p>
      )}
    </section>
  );
}
