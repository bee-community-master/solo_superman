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
    { label: "요약", value: record.previewSummary },
    { label: "승인", value: record.approvalLabel },
    { label: "실행 격리", value: record.sandboxLabel },
    { label: "되돌리기", value: record.rollbackLabel },
    { label: "확인 자료", value: record.evidenceLabel },
    { label: "차단 위험", value: record.riskLabel },
    { label: "출처", value: record.sourceRefLabel }
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
        <h2>실행 준비 노트</h2>
        <span>{readiness.statusLabel}</span>
      </div>
      <p className="operations-summary">{readiness.label}</p>
      <p className="operations-summary">{readiness.noExecutionLabel}</p>
      <p className="operations-summary">{readiness.exportLabel}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveProject} onClick={onRefreshReadiness}>
          실행 준비 새로고침
        </button>
      </div>
      {readiness.records.length ? (
        <div className="operations-cards">
          {readiness.records.map((record) => (
            <article className="operations-card readiness-card" key={record.hintId}>
              <strong>{record.surfaceLabel}</strong>
              <span>안전 실행 노트</span>
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
