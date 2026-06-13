import {
  type ResearchAllowlistGovernanceProjection,
  type ResearchAllowlistId,
  type ResearchDisclosureLogProjection,
  type ResearchRunControlProjection,
  type ResearchRunId
} from "@solo-superman/contracts";
import { useState } from "react";
import { researchRunStatusPath } from "../../shared/api/sidecar-routes";
import { useAppLanguage, type AppLanguage } from "../../shared/i18n/app-language";
import type { Phase15aOperationsViewModel } from "./decision-queue-view-model";
import {
  joinPhase15aResearchLabels,
  phase15aAdapterKindLabel,
  phase15aAllowlistStatusLabel,
  phase15aConnectorLabels,
  phase15aContextModeLabel,
  phase15aQualityGateStatusLabel,
  phase15aRunStatusLabel,
  phase15aSourceCategoryLabels,
  phase15aTerminalReasonLabel
} from "./phase15a-operation-labels";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";
import { decisionQueueDisplayText } from "./text-formatting";

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
  readonly onUpdateAllowlistMaxConcurrentRuns: (allowlistId: ResearchAllowlistId, maxConcurrentRuns: number) => void;
  readonly onUpdateAllowlistMaxRunsPerSession: (allowlistId: ResearchAllowlistId, maxRunsPerSession: number) => void;
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

function researchRunProviderLabel(run: ResearchRunControlProjection["runs"][number], copy: ReturnType<typeof useDecisionQueueCopy>) {
  const adapterKind = run.provider?.adapterKind ?? "adapter_unavailable";
  const attempt = run.provider?.attempt ?? "?";
  const adapterLabel = phase15aAdapterKindLabel(copy.phase15a, adapterKind);

  return `${adapterLabel} · ${copy.phase15a.attempt} ${attempt}`;
}

function researchRunRecoveryUrl(run: ResearchRunControlProjection["runs"][number]) {
  return researchRunStatusPath(run.projectId, run.researchRunId);
}

function exitGateStatusLabel(status: Phase15aOperationsViewModel["exitGate"]["status"], copy: ReturnType<typeof useDecisionQueueCopy>) {
  return status === "ready_for_1_5b" ? copy.phase15a.ready : copy.phase15a.needsReview;
}

function phase15aDisplayText(value: string, language: AppLanguage) {
  return decisionQueueDisplayText(value, language)
    .replace(/\s*·\s*:\s*/gu, " · ")
    .replace(/^\s*[·:;,-]+\s*/u, "")
    .replace(/\s*[·:;,-]+\s*$/u, "")
    .replace(/\s{2,}/gu, " ")
    .trim();
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
  onUpdateAllowlistMaxConcurrentRuns,
  onUpdateAllowlistMaxRunsPerSession,
  onRefreshResearchRunStatus,
  onCancelResearchRun,
  onRetryResearchRun
}: Phase15aOperationsPanelProps) {
  const copy = useDecisionQueueCopy();
  const { language } = useAppLanguage();
  const [maxConcurrentDrafts, setMaxConcurrentDrafts] = useState<Record<string, string>>({});
  const [maxSessionDrafts, setMaxSessionDrafts] = useState<Record<string, string>>({});

  function maxConcurrentDraftFor(allowlist: ResearchAllowlistGovernanceProjection["allowlists"][number]) {
    return maxConcurrentDrafts[allowlist.allowlistId] ?? String(allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject);
  }

  function maxSessionDraftFor(allowlist: ResearchAllowlistGovernanceProjection["allowlists"][number]) {
    return maxSessionDrafts[allowlist.allowlistId] ?? String(allowlist.rateBudgetPolicy.maxRunsPerSession);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{copy.phase15a.title}</h2>
        <span>{exitGateStatusLabel(operations.exitGate.status, copy)}</span>
      </div>
      <p className="operations-summary">{phase15aDisplayText(operations.exitGate.label, language)}</p>
      {operations.exitGate.blockers.length ? (
        <ul className="effect-list">
          {operations.exitGate.blockers.map((blocker) => (
            <li key={blocker}>{phase15aDisplayText(blocker, language)}</li>
          ))}
        </ul>
      ) : null}
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onCreateOrReactivateAllowlist}>
          {copy.phase15a.enableResearchSources}
        </button>
        <button type="button" disabled={isBusy || !hasActiveSession} onClick={onRefreshOperations}>
          {copy.phase15a.refreshStatus}
        </button>
      </div>
      <div className="operations-list">
        <section>
          <h3>{copy.phase15a.allowlistScreen}</h3>
          <p className="operations-summary">{operations.allowlistPolicyLabel}</p>
          {researchOperations.allowlists?.allowlists.length ? (
            <div className="operations-cards">
              {researchOperations.allowlists.allowlists.map((allowlist) => {
                const maxConcurrentDraft = maxConcurrentDraftFor(allowlist);
                const maxSessionDraft = maxSessionDraftFor(allowlist);
                const parsedMaxConcurrentDraft = Number(maxConcurrentDraft);
                const parsedMaxSessionDraft = Number(maxSessionDraft);
                const connectorLabels = phase15aConnectorLabels(copy.phase15a, allowlist.connectorIds);
                const connectorLabel = joinPhase15aResearchLabels(connectorLabels);
                const sourceCategoryLabels = phase15aSourceCategoryLabels(copy.phase15a, allowlist.sourceCategories);
                const sourceCategoryLabel = joinPhase15aResearchLabels(sourceCategoryLabels);
                const contextModeLabel = phase15aContextModeLabel(copy.phase15a, allowlist.contextMode);
                const canApplyMaxConcurrentDraft =
                  !isBusy &&
                  hasActiveSession &&
                  allowlist.status !== "revoked" &&
                  Number.isInteger(parsedMaxConcurrentDraft) &&
                  parsedMaxConcurrentDraft >= 1 &&
                  parsedMaxConcurrentDraft !== allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject;
                const canApplyMaxSessionDraft =
                  !isBusy &&
                  hasActiveSession &&
                  allowlist.status !== "revoked" &&
                  Number.isInteger(parsedMaxSessionDraft) &&
                  parsedMaxSessionDraft >= allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject &&
                  parsedMaxSessionDraft !== allowlist.rateBudgetPolicy.maxRunsPerSession;

                return (
                  <article className="operations-card" key={allowlist.allowlistId}>
                    <strong>{connectorLabel}</strong>
                    <span>{phase15aAllowlistStatusLabel(copy.phase15a, allowlist.status)}</span>
                    <small>
                      {sourceCategoryLabel} · {contextModeLabel}
                    </small>
                    <small>
                      {copy.phase15a.limits}: {allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject} {copy.phase15a.concurrent} /{" "}
                      {allowlist.rateBudgetPolicy.maxRunsPerSession} {copy.phase15a.session} /{" "}
                      {allowlist.rateBudgetPolicy.maxAutomaticRetriesPerRun} {copy.phase15a.retries}
                    </small>
                    <div className="research-limit-control">
                      <label>
                        <span>{copy.phase15a.maxConcurrentRuns}</span>
                        <input
                          aria-label={`${copy.phase15a.maxConcurrentRuns} ${connectorLabel}`}
                          min={1}
                          type="number"
                          value={maxConcurrentDraft}
                          onChange={(event) =>
                            setMaxConcurrentDrafts((current) => ({
                              ...current,
                              [allowlist.allowlistId]: event.target.value
                            }))
                          }
                        />
                      </label>
                      <small>{copy.phase15a.maxConcurrentRunsHelp}</small>
                      <button
                        type="button"
                        disabled={!canApplyMaxConcurrentDraft}
                        onClick={() =>
                          onUpdateAllowlistMaxConcurrentRuns(
                            allowlist.allowlistId,
                            parsedMaxConcurrentDraft
                          )
                        }
                      >
                        {copy.phase15a.applyMaxConcurrentRuns}
                      </button>
                      <label>
                        <span>{copy.phase15a.maxSessionRuns}</span>
                        <input
                          aria-label={`${copy.phase15a.maxSessionRuns} ${connectorLabel}`}
                          min={allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject}
                          type="number"
                          value={maxSessionDraft}
                          onChange={(event) =>
                            setMaxSessionDrafts((current) => ({
                              ...current,
                              [allowlist.allowlistId]: event.target.value
                            }))
                          }
                        />
                      </label>
                      <small>{copy.phase15a.maxSessionRunsHelp}</small>
                      <button
                        type="button"
                        disabled={!canApplyMaxSessionDraft}
                        onClick={() =>
                          onUpdateAllowlistMaxRunsPerSession(
                            allowlist.allowlistId,
                            parsedMaxSessionDraft
                          )
                        }
                      >
                        {copy.phase15a.applyMaxSessionRuns}
                      </button>
                    </div>
                    <small>
                      {copy.phase15a.disclosure}:{" "}
                      {allowlist.disclosureLogPolicy.publicSafeSummaryRequired
                        ? copy.phase15a.publicSafeSummaryRequired
                        : copy.phase15a.policyMissing}
                    </small>
                    {allowlist.status !== "revoked" ? (
                      <div className="card-actions">
                        <button
                          type="button"
                          disabled={isBusy || !hasActiveSession || allowlist.status === "paused"}
                          onClick={() => onPauseAllowlist(allowlist.allowlistId)}
                        >
                          {copy.phase15a.pause}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || !hasActiveSession}
                          onClick={() => onRevokeAllowlist(allowlist.allowlistId)}
                        >
                          {copy.phase15a.revoke}
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">{copy.phase15a.noAllowlist}</p>
          )}
        </section>

        <section>
          <h3>{copy.phase15a.researchRunCards}</h3>
          <p className="operations-summary">{operations.runRecoveryLabel}</p>
          {operations.staleOrFailureReasons.length ? (
            <ul className="effect-list">
              {operations.staleOrFailureReasons.map((reason) => (
                <li key={reason}>{phase15aDisplayText(reason, language)}</li>
              ))}
            </ul>
          ) : null}
          {researchOperations.runs?.runs.length ? (
            <div className="operations-cards">
              {researchOperations.runs.runs.map((run, index) => {
                const recoveryUrl = researchRunRecoveryUrl(run);
                const recoveryLabel =
                  recoveryUrl === copy.phase15a.refetchUnavailable
                    ? copy.phase15a.refetchUnavailable
                    : copy.phase15a.refreshRunStatus;

                return (
                <article className="operations-card" key={run.researchRunId}>
                  <strong>{copy.phase15a.researchRunCards} {index + 1}</strong>
                  <span>{phase15aRunStatusLabel(copy.phase15a, run.status)}</span>
                  <small>{researchRunProviderLabel(run, copy)}</small>
                  <small>{copy.phase15a.sourceRefs}: {run.sourceRefs?.length ?? 0}</small>
                  <small>
                    {copy.phase15a.qualityGate}: {phase15aQualityGateStatusLabel(copy.phase15a, run.qualityGateStatus)}
                  </small>
                  {run.qualityGateReviewReason ? (
                    <small>{phase15aDisplayText(run.qualityGateReviewReason, language)}</small>
                  ) : null}
                  {run.terminalReason ? (
                    <small>
                      {copy.phase15a.terminal}: {phase15aTerminalReasonLabel(copy.phase15a, run.terminalReason)}
                    </small>
                  ) : null}
                  <small>{copy.phase15a.recovery}: {recoveryLabel}</small>
                  <div className="card-actions">
                    <button
                      type="button"
                      disabled={isBusy || !hasActiveSession}
                      onClick={() => onRefreshResearchRunStatus(run.researchRunId)}
                    >
                      {copy.phase15a.refreshRunStatus}
                    </button>
                    {isCancellableResearchRun(run.status) ? (
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveSession}
                        onClick={() => onCancelResearchRun(run.researchRunId)}
                      >
                        {copy.phase15a.cancel}
                      </button>
                    ) : null}
                    {isRetryableResearchRun(run.status) ? (
                      <button
                        type="button"
                        disabled={isBusy || !hasActiveSession}
                        onClick={() => onRetryResearchRun(run.researchRunId)}
                      >
                        {copy.phase15a.retry}
                      </button>
                    ) : null}
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">{copy.phase15a.noResearchRuns}</p>
          )}
        </section>

        <section>
          <h3>{copy.phase15a.qualityGateDisplay}</h3>
          <p className="operations-summary">{phase15aDisplayText(operations.qualityGateLabel, language)}</p>
        </section>
      </div>
    </section>
  );
}
