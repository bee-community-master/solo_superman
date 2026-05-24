import { AutoImplementationRunPanel } from "../AutoImplementationRunPanel";
import { ImplementationStepLedgerPanel } from "../ImplementationStepLedgerPanel";
import { codexRuntimeEvidenceView } from "../codex-runtime-status-view";
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
    blockAutoImplementationStage,
    canCreateAutoImplementationRun,
    completeAutoImplementationWorkerJobFromLedger,
    createAutoImplementationRun,
    confidence,
    implementationStepLedgerView,
    importAutoImplementationWorkerLedgerFromDraft,
    isBusy,
    pendingSummary,
    pauseAutoImplementationStage,
    planningHandoffView,
    prepareFounderBrief,
    planAutoImplementationWorkerJob,
    recordAutoImplementationStageTick,
    startAutoImplementationStage,
    recordAutoImplementationGitHubIssueDryRun,
    applyAutoImplementationGitHubIssueCreation,
    applyAutoImplementationPullRequestOpen,
    applyAutoImplementationPullRequestBodyUpdate,
    applyAutoImplementationPullRequestMerge,
    projections,
    recordAutoImplementationPullRequestOpenDryRun,
    recordAutoImplementationPullRequestDryRun,
    recordAutoImplementationPullRequestMergeDryRun,
    refreshCommandStatus,
    refreshRuntimeStatus,
    refreshAutoImplementationRuns,
    refreshImplementationStepLedger,
    runPlanningHandoffGate,
    runAutoImplementationWorkerJob,
    runtimeActivity,
    runtimeStatus,
    scoreCompleteness,
    statuses,
    workerLedgerImportDraft,
    setWorkerLedgerImportDraft
  } = controller;
  const runtimeEvidence = codexRuntimeEvidenceView(runtimeStatus);
  const runtimeEvidenceItems = runtimeStatus
    ? [
        [copy.implementation.runtimeCheckedAt, runtimeEvidence.checkedAtLabel],
        [copy.implementation.runtimeAdapterVersion, runtimeEvidence.adapterVersionLabel],
        [copy.implementation.runtimeGeneratedSchemaVersion, runtimeEvidence.generatedSchemaVersionLabel],
        [copy.implementation.runtimeTransport, runtimeEvidence.transportLabel],
        [copy.implementation.runtimeExecutionMode, runtimeEvidence.executionModeLabel],
        [copy.implementation.runtimeAccount, runtimeEvidence.accountLabel],
        [
          copy.implementation.runtimeLiveTurns,
          copy.implementation.runtimeLiveTurnStates[runtimeEvidence.liveTurnsState]
        ],
        [
          copy.implementation.runtimeManualHandoff,
          copy.implementation.runtimeManualHandoffStates[runtimeEvidence.manualHandoffState]
        ]
      ]
    : [];
  const hasActiveSession = Boolean(projections.session);
  const hasCompletionSource =
    confidence?.completionCandidate.status === "candidate" || projections.founderBrief?.exportReady === true;
  const implementationStartSteps = [
    {
      label: copy.implementation.startGuideSession,
      state: hasActiveSession ? copy.implementation.startGuideDone : copy.implementation.startGuideBlocked,
      ready: hasActiveSession,
      detail: hasActiveSession ? copy.implementation.startGuideSessionReady : copy.implementation.startGuideSessionBlocked
    },
    {
      label: copy.implementation.startGuideReadiness,
      state: hasCompletionSource ? copy.implementation.startGuideDone : copy.implementation.startGuideBlocked,
      ready: hasCompletionSource,
      detail: hasCompletionSource
        ? copy.implementation.startGuideReadinessReady
        : confidence
          ? copy.implementation.startGuideReadinessBlocked(confidence.completionCandidate.gateFailures.length)
          : copy.implementation.startGuideReadinessMissing
    },
    {
      label: copy.implementation.startGuideHandoff,
      state: planningHandoffView.status === "final" ? copy.implementation.startGuideDone : copy.implementation.startGuideBlocked,
      ready: planningHandoffView.status === "final",
      detail: planningHandoffView.status === "final"
        ? copy.implementation.startGuideHandoffReady
        : planningHandoffView.status === "blocked"
          ? planningHandoffView.summary
          : copy.implementation.startGuideHandoffMissing
    },
    {
      label: copy.implementation.startGuideWorkspace,
      state: autoImplementationRunView.hasRun ? copy.implementation.startGuideDone : copy.implementation.startGuideBlocked,
      ready: autoImplementationRunView.hasRun,
      detail: autoImplementationRunView.hasRun
        ? copy.implementation.startGuideWorkspaceReady
        : canCreateAutoImplementationRun
          ? copy.implementation.startGuideWorkspaceReadyToCreate
          : copy.implementation.startGuideWorkspaceBlocked
    }
  ];
  const implementationStartNextAction = !hasActiveSession
    ? copy.implementation.startGuideNextSession
    : !confidence
      ? copy.implementation.startGuideNextScore
      : !hasCompletionSource
        ? copy.implementation.startGuideNextBrief
        : planningHandoffView.status !== "final"
          ? copy.implementation.startGuideNextHandoff
          : !autoImplementationRunView.hasRun
            ? copy.implementation.startGuideNextWorkspace
            : copy.implementation.startGuideNextWorker;
  const implementationReadinessMetricItems = confidence
    ? [
        [copy.planning.scoreBreakdownLabels.sectionCompleteness, confidence.scoreBreakdown.sectionCompleteness],
        [copy.planning.scoreBreakdownLabels.questionDebtResolution, confidence.scoreBreakdown.questionDebtResolution],
        [copy.planning.scoreBreakdownLabels.evidenceQuality, confidence.scoreBreakdown.evidenceQuality],
        [copy.planning.scoreBreakdownLabels.decisionApproval, confidence.scoreBreakdown.decisionApproval],
        [copy.planning.scoreBreakdownLabels.consistencyAndConflict, confidence.scoreBreakdown.consistencyAndConflict]
      ] as const
    : [];

  return (
    <div className="view-grid implementation-view">
      <section className="panel implementation-start-guide">
        <div className="panel-heading">
          <h2>{copy.implementation.startGuideTitle}</h2>
          <span>{autoImplementationRunView.hasRun ? copy.implementation.startGuideDone : copy.implementation.pending}</span>
        </div>
        <p className="operations-summary">{copy.implementation.startGuideSummary}</p>
        <p className="research-recovery">{copy.implementation.startGuideNextAction}: {implementationStartNextAction}</p>
        <ol className="implementation-start-steps">
          {implementationStartSteps.map((step) => (
            <li className={step.ready ? "ready" : "blocked"} key={step.label}>
              <strong>{step.label}</strong>
              <span>{step.state}</span>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
        {confidence ? (
          <section className="operations-card" aria-label={copy.implementation.startGuideMetricsTitle}>
            <h3>{copy.implementation.startGuideMetricsTitle}</h3>
            <dl className="readiness-grid">
              <div>
                <dt>{copy.implementation.startGuideCompositeScore}</dt>
                <dd>{confidence.compositeScore}% · {confidence.readinessLabel}</dd>
              </div>
              <div>
                <dt>{copy.implementation.startGuideGateFailures}</dt>
                <dd>{confidence.completionCandidate.gateFailures.length}</dd>
              </div>
              {implementationReadinessMetricItems.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}%</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <div className="card-actions panel-actions">
          <button type="button" disabled={isBusy || !hasActiveSession} onClick={() => void scoreCompleteness()}>
            {copy.planning.scoreCompleteness}
          </button>
          <button type="button" disabled={isBusy || !hasActiveSession} onClick={() => void prepareFounderBrief()}>
            {copy.handoff.planningActionLabels.prepareFounderBrief}
          </button>
          <button type="button" disabled={isBusy || !hasActiveSession} onClick={() => void runPlanningHandoffGate()}>
            {copy.handoff.runGate}
          </button>
          <button type="button" disabled={isBusy || !canCreateAutoImplementationRun} onClick={() => void createAutoImplementationRun()}>
            {autoImplementationRunView.hasRun ? copy.autoImplementation.reprepare : copy.autoImplementation.create}
          </button>
        </div>
      </section>

      <AutoImplementationRunPanel
        run={autoImplementationRunView}
        isBusy={isBusy}
        canCreateRun={canCreateAutoImplementationRun}
        onCreateRun={() => {
          void createAutoImplementationRun();
        }}
        onPlanWorkerJob={() => {
          void planAutoImplementationWorkerJob();
        }}
        onRecordStageTick={() => {
          void recordAutoImplementationStageTick();
        }}
        onStartStage={() => {
          void startAutoImplementationStage();
        }}
        onPauseStage={() => {
          void pauseAutoImplementationStage();
        }}
        onBlockStage={() => {
          void blockAutoImplementationStage();
        }}
        onCompleteWorkerJob={() => {
          void completeAutoImplementationWorkerJobFromLedger();
        }}
        workerLedgerImportDraft={workerLedgerImportDraft}
        onWorkerLedgerImportDraftChange={setWorkerLedgerImportDraft}
        onImportWorkerLedger={() => {
          void importAutoImplementationWorkerLedgerFromDraft();
        }}
        onRecordGitHubIssueDryRun={() => {
          void recordAutoImplementationGitHubIssueDryRun();
        }}
        onApplyGitHubIssueCreation={() => {
          void applyAutoImplementationGitHubIssueCreation();
        }}
        onRecordPullRequestOpenDryRun={() => {
          void recordAutoImplementationPullRequestOpenDryRun();
        }}
        onApplyPullRequestOpen={() => {
          void applyAutoImplementationPullRequestOpen();
        }}
        onRecordPullRequestDryRun={() => {
          void recordAutoImplementationPullRequestDryRun();
        }}
        onRecordPullRequestMergeDryRun={() => {
          void recordAutoImplementationPullRequestMergeDryRun();
        }}
        onApplyPullRequestBodyUpdate={() => {
          void applyAutoImplementationPullRequestBodyUpdate();
        }}
        onApplyPullRequestMerge={() => {
          void applyAutoImplementationPullRequestMerge();
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
        <div className="card-actions panel-actions">
          <button type="button" disabled={isBusy} onClick={() => void refreshRuntimeStatus()}>
            {copy.implementation.refreshRuntimeStatus}
          </button>
        </div>
        <p>{runtimeStatus ? `${copy.implementation.adapterPrefix} ${runtimeStatus.status}. ${pendingSummary.visibleLabel}` : pendingSummary.visibleLabel}</p>
        {runtimeStatus ? (
          <dl className="readiness-grid" aria-label={copy.implementation.runtimeEvidenceDetails}>
            {runtimeEvidenceItems.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? copy.implementation.unknown}</dd>
              </div>
            ))}
          </dl>
        ) : null}
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
