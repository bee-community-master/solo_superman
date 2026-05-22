import type {
  AutoImplementationIssueDocument,
  AutoImplementationRunProjection,
  AutoImplementationStageReviewGate,
  AutoImplementationStageRecord
} from "@solo-superman/contracts";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";

export interface AutoImplementationRunViewModel {
  readonly status: string;
  readonly summary: string;
  readonly workspaceLabel: string;
  readonly remoteLabel: string;
  readonly nextTickLabel: string;
  readonly issueModeLabel: string;
  readonly remoteWarning: string | null;
  readonly remoteCommands: readonly string[];
  readonly remoteNextAction: string;
  readonly stages: readonly AutoImplementationStageRecord[];
  readonly issueDocs: readonly AutoImplementationIssueDocument[];
  readonly deliveryGates: readonly string[];
  readonly stageReviewGates: readonly AutoImplementationStageReviewGate[];
  readonly evidenceRefs: readonly string[];
  readonly hasRun: boolean;
}

function latestRun(projection: AutoImplementationRunProjection | null) {
  return projection?.latestRun ?? null;
}

export function autoImplementationRunViewModel(
  projection: AutoImplementationRunProjection | null
): AutoImplementationRunViewModel {
  const run = latestRun(projection);

  if (!projection || !run) {
    return {
      status: "not_started",
      summary: "No auto implementation workspace has been prepared yet.",
      workspaceLabel: "workspace/<project> is not prepared",
      remoteLabel: "Remote: not checked",
      nextTickLabel: "Next 5-minute tick: not scheduled",
      issueModeLabel: "Issue mode: not selected",
      remoteWarning: "Start a run to create a local git repo, markdown fallback issues, and remote connection guidance.",
      remoteCommands: [],
      remoteNextAction: "Create the workspace run after the planning handoff is detailed enough.",
      stages: [],
      issueDocs: [],
      deliveryGates: [],
      stageReviewGates: [],
      evidenceRefs: [],
      hasRun: false
    };
  }

  return {
    status: run.status,
    summary: projection.summary,
    workspaceLabel: `Workspace: ${run.generatedRepoPath}`,
    remoteLabel: `Remote: ${run.remoteStatus}`,
    nextTickLabel: `Next 5-minute tick: ${run.nextTickAt}`,
    issueModeLabel: `Issue mode: ${run.issueManagement.mode}`,
    remoteWarning: run.remoteGuide.warning,
    remoteCommands: run.remoteGuide.commands,
    remoteNextAction: run.remoteGuide.nextAction,
    stages: run.stagePlan,
    issueDocs: run.issueManagement.issueDocs,
    deliveryGates: run.reviewProtocol.deliveryGates,
    stageReviewGates: run.reviewProtocol.stageGates,
    evidenceRefs: run.evidenceRefs,
    hasRun: true
  };
}

interface AutoImplementationRunPanelProps {
  readonly run: AutoImplementationRunViewModel;
  readonly isBusy: boolean;
  readonly onCreateRun: () => void;
  readonly onRefreshRun: () => void;
}

export function AutoImplementationRunPanel({
  run,
  isBusy,
  onCreateRun,
  onRefreshRun
}: AutoImplementationRunPanelProps) {
  const copy = useDecisionQueueCopy();

  return (
    <section className="panel auto-implementation-run-panel">
      <div className="panel-heading">
        <h2>{copy.autoImplementation.title}</h2>
        <span>{run.status}</span>
      </div>
      <p>{run.summary}</p>
      <p className="research-recovery">{run.workspaceLabel}</p>
      <p className="mode-summary">{run.remoteLabel} · {run.issueModeLabel}</p>
      <p className="mode-summary">{run.nextTickLabel}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy} onClick={onCreateRun}>
          {run.hasRun ? copy.autoImplementation.reprepare : copy.autoImplementation.create}
        </button>
        <button type="button" disabled={isBusy} onClick={onRefreshRun}>
          {copy.autoImplementation.refresh}
        </button>
      </div>

      <h3>{copy.autoImplementation.stagePlan}</h3>
      {run.stages.length ? (
        <ol>
          {run.stages.map((stage) => (
            <li key={stage.stage}>
              {stage.label}: {stage.status}
              {stage.nextScheduledAt ? ` · ${stage.nextScheduledAt}` : ""}
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noStages}</p>
      )}

      <h3>{copy.autoImplementation.reviewProtocol}</h3>
      {run.deliveryGates.length ? (
        <ul>
          {run.deliveryGates.map((gate) => (
            <li key={gate}>{gate}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noReviewGates}</p>
      )}
      {run.stageReviewGates.length ? (
        <div className="auto-implementation-stage-gates">
          {run.stageReviewGates.map((stageGate) => (
            <article className="operations-card" key={stageGate.stage}>
              <strong>{stageGate.stage}</strong>
              <ul>
                {stageGate.gates.map((gate) => (
                  <li key={gate}>{gate}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}

      <h3>{copy.autoImplementation.issueDocs}</h3>
      {run.issueDocs.length ? (
        <ul>
          {run.issueDocs.map((issue) => (
            <li key={issue.issueId}>
              {issue.issueId}: {issue.title} ({issue.relativePath})
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noIssueDocs}</p>
      )}

      <h3>{copy.autoImplementation.remoteGuide}</h3>
      <p>{run.remoteNextAction}</p>
      {run.remoteWarning ? <p className="research-recovery">{run.remoteWarning}</p> : null}
      {run.remoteCommands.length ? (
        <ul>
          {run.remoteCommands.map((command) => (
            <li key={command}><code>{command}</code></li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noRemoteCommands}</p>
      )}

      <h3>{copy.autoImplementation.evidenceRefs}</h3>
      {run.evidenceRefs.length ? (
        <ul>
          {run.evidenceRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.autoImplementation.noEvidenceRefs}</p>
      )}
    </section>
  );
}
