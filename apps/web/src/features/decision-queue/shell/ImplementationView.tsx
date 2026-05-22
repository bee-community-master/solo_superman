import { AutoImplementationRunPanel } from "../AutoImplementationRunPanel";
import { ImplementationStepLedgerPanel } from "../ImplementationStepLedgerPanel";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface ImplementationViewProps {
  readonly controller: DecisionQueueShellController;
}

export function ImplementationView({ controller }: ImplementationViewProps) {
  const copy = useDecisionQueueCopy();
  const {
    commandLog,
    autoImplementationRunView,
    advanceAutoImplementationWorkerStage,
    createAutoImplementationRun,
    implementationStepLedgerView,
    isBusy,
    pendingSummary,
    planAutoImplementationWorkerJob,
    projections,
    recordAutoImplementationPullRequestOpenDryRun,
    recordAutoImplementationPullRequestDryRun,
    recordAutoImplementationPullRequestMergeDryRun,
    refreshCommandStatus,
    refreshAutoImplementationRuns,
    refreshImplementationStepLedger,
    runAutoImplementationWorkerJob,
    runtimeActivity,
    runtimeStatus,
    statuses
  } = controller;

  return (
    <div className="view-grid implementation-view">
      <AutoImplementationRunPanel
        run={autoImplementationRunView}
        isBusy={isBusy}
        onCreateRun={() => {
          void createAutoImplementationRun();
        }}
        onPlanWorkerJob={() => {
          void planAutoImplementationWorkerJob();
        }}
        onRecordPullRequestOpenDryRun={() => {
          void recordAutoImplementationPullRequestOpenDryRun();
        }}
        onRecordPullRequestDryRun={() => {
          void recordAutoImplementationPullRequestDryRun();
        }}
        onRecordPullRequestMergeDryRun={() => {
          void recordAutoImplementationPullRequestMergeDryRun();
        }}
        onRunWorkerJob={() => {
          void runAutoImplementationWorkerJob();
        }}
        onAdvanceWorkerStage={() => {
          void advanceAutoImplementationWorkerStage();
        }}
        onRefreshRun={() => {
          if (projections.session) {
            void refreshAutoImplementationRuns(projections.session.sessionId);
          }
        }}
      />

      <ImplementationStepLedgerPanel
        ledger={implementationStepLedgerView}
        isBusy={isBusy}
        onRefreshLedger={() => {
          if (projections.session) {
            void refreshImplementationStepLedger(projections.session.sessionId);
          }
        }}
      />

      <section className="panel runtime-panel">
        <div className="panel-heading">
          <h2>{copy.implementation.runtimeEvidence}</h2>
          <span>{runtimeActivity.runtimeStatus}</span>
        </div>
        <p>{runtimeStatus ? `${copy.implementation.adapterPrefix} ${runtimeStatus.status}. ${pendingSummary.visibleLabel}` : pendingSummary.visibleLabel}</p>
        {runtimeStatus?.reason ? <p className="research-recovery">{runtimeStatus.reason}</p> : null}
        {statuses.length ? (
          <ul className="effect-list">
            {statuses.map((status) => (
              <li key={status.commandId}>
                {status.commandStatus}: {status.effects.length} {copy.implementation.effectSuffix}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">{copy.implementation.noCommandStatus}</p>
        )}
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <h2>{copy.implementation.activity}</h2>
          <span>{commandLog.length}</span>
        </div>
        <div className="activity-list">
          {commandLog.length ? (
            commandLog.map((entry) => (
              <article className="activity-item" key={entry.id}>
                <strong>{entry.label}</strong>
                <span>{entry.status?.commandStatus ?? entry.response?.category ?? entry.message ?? entry.error ?? copy.implementation.pending}</span>
                {entry.status?.effects.length ? (
                  <ul className="effect-list">
                    {entry.status.effects.map((effect) => (
                      <li key={effect.effectTaskId}>
                        {effect.effectType}: {effect.status}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {entry.error ? <small>{entry.error}</small> : null}
                {entry.message ? <small>{entry.message}</small> : null}
                {entry.response?.statusUrl ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void refreshCommandStatus(entry)}
                  >
                    {copy.implementation.refreshStatus}
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p className="empty-state">{copy.implementation.noActivity}</p>
          )}
        </div>
      </section>
    </div>
  );
}
