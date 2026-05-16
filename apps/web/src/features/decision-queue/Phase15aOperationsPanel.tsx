import type {
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchDisclosureLogProjection,
  ResearchRunControlProjection,
  ResearchRunId
} from "@solo-superman/contracts";
import type { Phase15aOperationsViewModel } from "./decision-queue-view-model";

export interface ResearchOperationsState {
  readonly allowlists: ResearchAllowlistGovernanceProjection | null;
  readonly disclosures: ResearchDisclosureLogProjection | null;
  readonly runs: ResearchRunControlProjection | null;
}

interface Phase15aOperationsPanelProps {
  readonly hasActiveSession: boolean;
  readonly isBusy: boolean;
  readonly operations: Phase15aOperationsViewModel;
  readonly researchOperations: ResearchOperationsState;
  readonly onCreateOrReactivateAllowlist: () => void;
  readonly onRefreshOperations: () => void;
  readonly onPauseAllowlist: (allowlistId: ResearchAllowlistId) => void;
  readonly onRevokeAllowlist: (allowlistId: ResearchAllowlistId) => void;
  readonly onRefreshResearchRunStatus: (researchRunId: ResearchRunId) => void;
  readonly onCancelResearchRun: (researchRunId: ResearchRunId) => void;
  readonly onRetryResearchRun: (researchRunId: ResearchRunId) => void;
}

type ResearchRunStatus = ResearchRunControlProjection["runs"][number]["status"];

function isCancellableResearchRun(status: ResearchRunStatus) {
  return status === "queued" || status === "running" || status === "paused";
}

function isRetryableResearchRun(status: ResearchRunStatus) {
  return status === "failed" || status === "stale" || status === "research_insufficient";
}

function exitGateStatusLabel(status: Phase15aOperationsViewModel["exitGate"]["status"]) {
  return status === "ready_for_1_5b" ? "준비됨" : "검토 필요";
}

export function Phase15aOperationsPanel({
  hasActiveSession,
  isBusy,
  operations,
  researchOperations,
  onCreateOrReactivateAllowlist,
  onRefreshOperations,
  onPauseAllowlist,
  onRevokeAllowlist,
  onRefreshResearchRunStatus,
  onCancelResearchRun,
  onRetryResearchRun
}: Phase15aOperationsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>리서치 운영</h2>
        <span>{exitGateStatusLabel(operations.exitGate.status)}</span>
      </div>
      <p className="operations-summary">{operations.exitGate.label}</p>
      {operations.exitGate.blockers.length ? (
        <ul className="effect-list">
          {operations.exitGate.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onCreateOrReactivateAllowlist}>
          리서치 소스 켜기
        </button>
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onRefreshOperations}>
          상태 새로고침
        </button>
      </div>
      <div className="operations-list">
        <section>
          <h3>Allowlist screen</h3>
          <p className="operations-summary">{operations.allowlistPolicyLabel}</p>
          {researchOperations.allowlists?.allowlists.length ? (
            <div className="operations-cards">
              {researchOperations.allowlists.allowlists.map((allowlist) => (
                <article className="operations-card" key={allowlist.allowlistId}>
                  <strong>{allowlist.allowlistId}</strong>
                  <span>{allowlist.status}</span>
                  <small>
                    {allowlist.connectorIds.join(", ")} · {allowlist.sourceCategories.join(", ")} ·{" "}
                    {allowlist.contextMode}
                  </small>
                  <small>
                    limits: {allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject} concurrent /{" "}
                    {allowlist.rateBudgetPolicy.maxRunsPerSession} session /{" "}
                    {allowlist.rateBudgetPolicy.maxAutomaticRetriesPerRun} retries
                  </small>
                  <small>
                    disclosure:{" "}
                    {allowlist.disclosureLogPolicy.publicSafeSummaryRequired
                      ? "public-safe summary required"
                      : "policy missing"}
                  </small>
                  {allowlist.status !== "revoked" ? (
                    <div className="card-actions">
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveSession || allowlist.status === "paused"}
                        onClick={() => onPauseAllowlist(allowlist.allowlistId)}
                      >
                        Pause
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveSession}
                        onClick={() => onRevokeAllowlist(allowlist.allowlistId)}
                      >
                        Revoke
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">No allowlist loaded yet.</p>
          )}
        </section>

        <section>
          <h3>Research run cards</h3>
          <p className="operations-summary">{operations.runRecoveryLabel}</p>
          {operations.staleOrFailureReasons.length ? (
            <ul className="effect-list">
              {operations.staleOrFailureReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {researchOperations.runs?.runs.length ? (
            <div className="operations-cards">
              {researchOperations.runs.runs.map((run) => (
                <article className="operations-card" key={run.researchRunId}>
                  <strong>{run.researchTaskId}</strong>
                  <span>{run.status}</span>
                  <small>
                    run {run.researchRunId} · {run.provider.adapterKind} · attempt {run.provider.attempt}
                  </small>
                  <small>quality gate: {run.qualityGateStatus}</small>
                  {run.qualityGateReviewReason ? <small>{run.qualityGateReviewReason}</small> : null}
                  {run.terminalReason ? <small>terminal: {run.terminalReason}</small> : null}
                  <small>recovery: {researchOperations.runs?.recovery.refetchUrl ?? "refetch unavailable"}</small>
                  <div className="card-actions">
                    <button
                      type="button"
                      disabled={isBusy || !hasActiveSession}
                      onClick={() => onRefreshResearchRunStatus(run.researchRunId)}
                    >
                      Refresh status
                    </button>
                    {isCancellableResearchRun(run.status) ? (
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveSession}
                        onClick={() => onCancelResearchRun(run.researchRunId)}
                      >
                        Cancel
                      </button>
                    ) : null}
                    {isRetryableResearchRun(run.status) ? (
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveSession}
                        onClick={() => onRetryResearchRun(run.researchRunId)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">No research runs loaded yet.</p>
          )}
        </section>

        <section>
          <h3>Quality gate display</h3>
          <p className="operations-summary">{operations.qualityGateLabel}</p>
        </section>
      </div>
    </section>
  );
}
