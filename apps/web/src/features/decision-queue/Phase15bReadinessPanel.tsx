import type { Phase15bReadinessViewModel } from "./decision-queue-view-model";
import { useDecisionQueueCopy, type DecisionQueueCopy } from "./shell/decision-queue-copy";

type Phase15bReadinessRecord = Phase15bReadinessViewModel["records"][number];

interface Phase15bReadinessPanelProps {
  readonly hasActiveProject: boolean;
  readonly isBusy: boolean;
  readonly readiness: Phase15bReadinessViewModel;
  readonly onRefreshReadiness: () => void;
}

function readinessRecordRows(record: Phase15bReadinessRecord, copy: DecisionQueueCopy) {
  return [
    { label: copy.phase15b.rows.summary, value: record.previewSummary },
    { label: copy.phase15b.rows.approval, value: record.approvalLabel },
    { label: copy.phase15b.rows.sandbox, value: record.sandboxLabel },
    { label: copy.phase15b.rows.rollback, value: record.rollbackLabel },
    { label: copy.phase15b.rows.evidence, value: record.evidenceLabel },
    { label: copy.phase15b.rows.risk, value: record.riskLabel },
    { label: copy.phase15b.rows.source, value: record.sourceRefLabel }
  ];
}

export function Phase15bReadinessPanel({
  hasActiveProject,
  isBusy,
  readiness,
  onRefreshReadiness
}: Phase15bReadinessPanelProps) {
  const copy = useDecisionQueueCopy();

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{copy.phase15b.title}</h2>
        <span>{readiness.statusLabel}</span>
      </div>
      <p className="operations-summary">{readiness.label}</p>
      <p className="operations-summary">{readiness.noExecutionLabel}</p>
      <p className="operations-summary">{readiness.exportLabel}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveProject} onClick={onRefreshReadiness}>
          {copy.phase15b.refresh}
        </button>
      </div>
      {readiness.records.length ? (
        <div className="operations-cards">
          {readiness.records.map((record) => (
            <article className="operations-card readiness-card" key={record.hintId}>
              <strong>{record.surfaceLabel}</strong>
              <span>{copy.phase15b.safeExecutionNote}</span>
              <small>{record.statusLabel}</small>
              {readinessRecordRows(record, copy).map((row) => (
                <small key={row.label}>
                  {row.label}: {row.value}
                </small>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">{readiness.emptyLabel}</p>
      )}
    </section>
  );
}
