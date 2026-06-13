import type { Phase15bReadinessViewModel } from "./decision-queue-view-model";
import { useAppLanguage } from "../../shared/i18n/app-language";
import { useDecisionQueueCopy, type DecisionQueueCopy } from "./shell/decision-queue-copy";
import { decisionQueueDisplayText } from "./text-formatting";

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
  const { language } = useAppLanguage();
  const summaryText = decisionQueueDisplayText(readiness.label, language);
  const noExecutionText = decisionQueueDisplayText(readiness.noExecutionLabel, language);
  const exportText = decisionQueueDisplayText(readiness.exportLabel, language);
  const visibleRowsByRecord = readiness.records.map((record) =>
    readinessRecordRows(record, copy)
      .map((row) => ({ ...row, value: decisionQueueDisplayText(row.value, language) }))
      .filter((row) => row.value)
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{copy.phase15b.title}</h2>
        <span>{decisionQueueDisplayText(readiness.statusLabel, language)}</span>
      </div>
      {summaryText ? <p className="operations-summary">{summaryText}</p> : null}
      {noExecutionText ? <p className="operations-summary">{noExecutionText}</p> : null}
      {exportText ? <p className="operations-summary">{exportText}</p> : null}
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveProject} onClick={onRefreshReadiness}>
          {copy.phase15b.refresh}
        </button>
      </div>
      {readiness.records.length ? (
        <div className="operations-cards">
          {readiness.records.map((record, recordIndex) => (
            <article className="operations-card readiness-card" key={record.hintId}>
              <strong>{decisionQueueDisplayText(record.surfaceLabel, language)}</strong>
              <span>{copy.phase15b.safeExecutionNote}</span>
              <small>{decisionQueueDisplayText(record.statusLabel, language)}</small>
              {visibleRowsByRecord[recordIndex]?.map((row) => (
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
