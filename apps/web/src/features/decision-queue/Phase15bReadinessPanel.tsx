import type { Phase15bReadinessViewModel } from "./decision-queue-view-model";

type Phase15bReadinessRecord = Phase15bReadinessViewModel["records"][number];

interface Phase15bReadinessPanelProps {
  readonly hasActiveProject: boolean;
  readonly isBusy: boolean;
  readonly readiness: Phase15bReadinessViewModel;
  readonly onRefreshReadiness: () => void;
}

function readinessRecordRows(record: Phase15bReadinessRecord) {
  return [
    { label: "preview summary", value: record.previewSummary },
    { label: "approvals", value: record.approvalLabel },
    { label: "sandbox", value: record.sandboxLabel },
    { label: "rollback", value: record.rollbackLabel },
    { label: "expected evidence", value: record.evidenceLabel },
    { label: "blocked risk", value: record.riskLabel },
    { label: "source refs", value: record.sourceRefLabel }
  ];
}

export function Phase15bReadinessPanel({
  hasActiveProject,
  isBusy,
  readiness,
  onRefreshReadiness
}: Phase15bReadinessPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>1.5B Readiness Handoff</h2>
        <span>{readiness.statusLabel}</span>
      </div>
      <p className="operations-summary">{readiness.label}</p>
      <p className="operations-summary">{readiness.noExecutionLabel}</p>
      <p className="operations-summary">{readiness.exportLabel}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveProject} onClick={onRefreshReadiness}>
          Refresh readiness metadata
        </button>
      </div>
      {readiness.records.length ? (
        <div className="operations-cards">
          {readiness.records.map((record) => (
            <article className="operations-card readiness-card" key={record.hintId}>
              <strong>{record.surfaceLabel}</strong>
              <span>readiness preview handoff</span>
              <small>{record.statusLabel}</small>
              {readinessRecordRows(record).map((row) => (
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
