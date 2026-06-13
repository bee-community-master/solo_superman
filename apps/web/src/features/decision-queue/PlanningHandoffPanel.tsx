import type { PlanningHandoffDetailGroup, PlanningHandoffViewModel } from "./decision-queue-view-model";
import { localizedUserFacingDecisionQueueText } from "@solo-superman/contracts";
import { useAppLanguage, type AppLanguage } from "../../shared/i18n/app-language";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";

interface PlanningHandoffPanelProps {
  readonly hasActiveSession: boolean;
  readonly isBusy: boolean;
  readonly handoff: PlanningHandoffViewModel;
  readonly onRunHandoffGate: () => void;
  readonly onRefreshHandoff: () => void;
}

function planningHandoffDisplayText(value: string, language: AppLanguage) {
  return localizedUserFacingDecisionQueueText(value, language).replace(/\s+/gu, " ").trim();
}

function PlanningHandoffGroup({
  group,
  language
}: {
  readonly group: PlanningHandoffDetailGroup;
  readonly language: AppLanguage;
}) {
  const title = planningHandoffDisplayText(group.title, language);
  const items = group.items.map((item) => planningHandoffDisplayText(item, language)).filter(Boolean);

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
  const label = planningHandoffDisplayText(handoff.label, language);
  const summary = planningHandoffDisplayText(handoff.summary, language);
  const noExecutionLabel = planningHandoffDisplayText(handoff.noExecutionLabel, language);
  const refetchLabel = planningHandoffDisplayText(handoff.refetchLabel, language);
  const sourceRefsLabel = planningHandoffDisplayText(handoff.sourceRefsLabel, language);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{copy.handoff.title}</h2>
        <span>{planningHandoffDisplayText(handoff.statusLabel, language)}</span>
      </div>
      {label ? <p className="operations-summary">{label}</p> : null}
      {summary ? <p className="operations-summary">{summary}</p> : null}
      {noExecutionLabel ? <p className="operations-summary">{noExecutionLabel}</p> : null}
      {refetchLabel ? <p className="operations-summary">{refetchLabel}</p> : null}
      <p className="operations-summary">
        {copy.handoff.sourceRefs}: {sourceRefsLabel || planningHandoffDisplayText("no source references", language)}
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
          <strong>{planningHandoffDisplayText(artifact.heading, language)}</strong>
          {artifact.groups.map((group) => (
            <PlanningHandoffGroup group={group} key={group.title} language={language} />
          ))}
        </article>
      ) : (
        <p className="empty-state">{planningHandoffDisplayText(handoff.emptyLabel, language)}</p>
      )}
    </section>
  );
}
