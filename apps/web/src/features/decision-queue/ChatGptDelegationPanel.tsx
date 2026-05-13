import type {
  ChatGptBrowserDelegationProjection,
  ChatGptBrowserDelegationRun
} from "@solo-superman/contracts";

export interface ChatGptDelegationViewModel {
  readonly status: string;
  readonly summary: string;
  readonly explanation: string;
  readonly nextAction: string;
  readonly canRevoke: boolean;
  readonly runId: string | null;
  readonly activityFeedRefs: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly redactionPreviewRef: string | null;
  readonly artifactControlLabels: readonly string[];
  readonly auditItems: readonly string[];
  readonly fallbackLabel: string | null;
  readonly fallbackReason: string | null;
  readonly blockReasonItems: readonly string[];
  readonly retentionLabel: string;
}

function artifactRefsForRun(run: ChatGptBrowserDelegationRun) {
  return [
    `prompt:${run.promptPreviewRef}`,
    `redaction:${run.redactionSummary.redactionPreviewRef}`,
    ...run.screenshotRefs.map((ref) => `screenshot:${ref}`),
    ...run.logRefs.map((ref) => `log:${ref}`),
    ...(run.resultImportRef ? [`result:${run.resultImportRef}`] : [])
  ];
}

export function chatGptDelegationViewModel(
  projection: ChatGptBrowserDelegationProjection | null
): ChatGptDelegationViewModel {
  if (!projection) {
    return {
      status: "not_started",
      summary: "ChatGPT delegation run has not started.",
      explanation: "No ChatGPT Pro local browser delegation projection has been recorded for this session.",
      nextAction: "Plan a research task and create a per-run delegation preview before using ChatGPT browser delegation.",
      canRevoke: false,
      runId: null,
      activityFeedRefs: [],
      artifactRefs: [],
      redactionPreviewRef: null,
      artifactControlLabels: [],
      auditItems: [],
      fallbackLabel: null,
      fallbackReason: null,
      blockReasonItems: [],
      retentionLabel: "No prompt/result/screenshot/log artifacts are stored yet."
    };
  }

  const run = projection.latestRun;
  const artifactRefs = artifactRefsForRun(run);
  const artifactControlLabels = run.redactionSummary.userExportDeleteControls
    ? [
        "Export retained prompt/result/screenshot/log artifact refs",
        "Delete retained artifacts while leaving audit metadata only"
      ]
    : [];

  return {
    status: projection.currentStatus,
    summary: projection.summary,
    explanation: run.userVisibleExplanation,
    nextAction: run.nextAction,
    canRevoke: run.canRevoke,
    runId: run.runId,
    activityFeedRefs: run.activityFeedRefs,
    artifactRefs,
    redactionPreviewRef: run.redactionSummary.redactionPreviewRef,
    artifactControlLabels,
    auditItems: run.auditLog.map((entry) => `${entry.eventType}: ${entry.label}`),
    fallbackLabel: run.fallbackApplied ? `${run.fallbackApplied.lane}: ${run.fallbackApplied.userAction}` : null,
    fallbackReason: run.fallbackApplied?.reason ?? null,
    blockReasonItems: run.blockReasons.map((reason) => `${reason.code}: ${reason.message}`),
    retentionLabel: run.redactionSummary.userExportDeleteControls
      ? "Prompt/result/screenshot/log artifacts are retained by default with export/delete controls; deleting artifacts leaves audit metadata only."
      : "Artifact retention controls are unavailable for this run."
  };
}

interface ChatGptDelegationPanelProps {
  readonly delegation: ChatGptDelegationViewModel;
  readonly isBusy: boolean;
  readonly onRefreshDelegation: () => void;
  readonly onRevokeDelegation: (runId: string) => void;
}

export function ChatGptDelegationPanel({
  delegation,
  isBusy,
  onRefreshDelegation,
  onRevokeDelegation
}: ChatGptDelegationPanelProps) {
  const revokableRunId = delegation.canRevoke ? delegation.runId : null;

  return (
    <section className="panel chatgpt-delegation-panel">
      <div className="panel-heading">
        <h2>ChatGPT delegation</h2>
        <span>{delegation.status}</span>
      </div>
      <p>{delegation.summary}</p>
      <p className="research-recovery">{delegation.explanation}</p>
      <p className="mode-summary">Next action: {delegation.nextAction}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy} onClick={onRefreshDelegation}>
          Refresh delegation
        </button>
        {revokableRunId ? (
          <button type="button" disabled={isBusy} onClick={() => onRevokeDelegation(revokableRunId)}>
            Revoke run
          </button>
        ) : null}
      </div>
      {delegation.fallbackLabel ? <p className="research-recovery">Fallback: {delegation.fallbackLabel}</p> : null}
      {delegation.fallbackReason ? <p className="mode-summary">Fallback reason: {delegation.fallbackReason}</p> : null}
      {delegation.blockReasonItems.length ? (
        <ul>
          {delegation.blockReasonItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <h3>Stored artifacts</h3>
      <p className="mode-summary">{delegation.retentionLabel}</p>
      {delegation.redactionPreviewRef ? (
        <p className="mode-summary">Redaction preview: {delegation.redactionPreviewRef}</p>
      ) : null}
      {delegation.artifactControlLabels.length ? (
        <div className="card-actions panel-actions">
          {delegation.artifactControlLabels.map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title="This PR exposes the artifact control surface and retained refs; artifact content export/delete execution remains separate from revoke."
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {delegation.artifactRefs.length ? (
        <ul>
          {delegation.artifactRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No retained artifact refs.</p>
      )}
      <h3>Activity feed links</h3>
      {delegation.activityFeedRefs.length ? (
        <ul>
          {delegation.activityFeedRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No linked ResearchTask/Decision refs.</p>
      )}
      <h3>Audit log</h3>
      {delegation.auditItems.length ? (
        <ul>
          {delegation.auditItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No audit entries yet.</p>
      )}
    </section>
  );
}
