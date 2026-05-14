import { ImplementationStepLedgerPanel } from "../ImplementationStepLedgerPanel";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface ImplementationViewProps {
  readonly controller: DecisionQueueShellController;
}

export function ImplementationView({ controller }: ImplementationViewProps) {
  const {
    client,
    commandLog,
    implementationStepLedgerView,
    isBusy,
    pendingSummary,
    projections,
    recordCommandStatus,
    recordCommandStatusError,
    refreshImplementationStepLedger,
    runtimeActivity,
    runtimeStatus,
    statuses
  } = controller;

  return (
    <div className="view-grid implementation-view">
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
          <h2>Runtime evidence</h2>
          <span>{runtimeActivity.runtimeStatus}</span>
        </div>
        <p>{runtimeStatus ? `Adapter ${runtimeStatus.status}. ${pendingSummary.visibleLabel}` : pendingSummary.visibleLabel}</p>
        {statuses.length ? (
          <ul className="effect-list">
            {statuses.map((status) => (
              <li key={status.commandId}>
                {status.commandStatus}: {status.effects.length} effect(s)
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No command status records yet.</p>
        )}
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <h2>Activity</h2>
          <span>{commandLog.length}</span>
        </div>
        <div className="activity-list">
          {commandLog.length ? (
            commandLog.map((entry) => (
              <article className="activity-item" key={entry.id}>
                <strong>{entry.label}</strong>
                <span>{entry.status?.commandStatus ?? entry.response?.category ?? entry.message ?? entry.error ?? "pending"}</span>
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
                    disabled={isBusy || !entry.response?.statusUrl || !client}
                    onClick={() => {
                      if (entry.response?.statusUrl && client) {
                        const { commandId, statusUrl } = entry.response;

                        void client
                          .getCommandStatus(statusUrl)
                          .then(recordCommandStatus)
                          .catch((error) => recordCommandStatusError(commandId, error));
                      }
                    }}
                  >
                    Refresh status
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p className="empty-state">No activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
