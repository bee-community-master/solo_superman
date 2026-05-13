import type {
  ImplementationStepLedgerProjection,
  ImplementationStepRecord
} from "@solo-superman/contracts";

export interface ImplementationStepLedgerViewModel {
  readonly status: string;
  readonly summary: string;
  readonly trackerLabel: string;
  readonly progressReport: string;
  readonly latestStepTitle: string;
  readonly latestStepScope: string;
  readonly commitLabel: string;
  readonly previousCommitLabel: string;
  readonly diffRangeLabel: string;
  readonly rollbackLabel: string;
  readonly codeReviewLabel: string;
  readonly cleanCodeReviewLabel: string;
  readonly testEvidenceLabel: string;
  readonly missingEvidenceItems: readonly string[];
  readonly blockerLabel: string | null;
  readonly nextAction: string;
  readonly evidenceRefs: readonly string[];
  readonly noCodeEvidenceLabel: string | null;
}

function latestStep(projection: ImplementationStepLedgerProjection | null) {
  return projection?.steps.at(-1) ?? null;
}

function reviewLabel(
  review: ImplementationStepRecord["codeReviewRecord"] | ImplementationStepRecord["cleanCodeReviewRecord"],
  kind: "Code review" | "Clean-code review"
) {
  return review
    ? `${kind}: ${review.verdict} by ${review.reviewer} (${review.comparedFromCommitSha}..${review.comparedToCommitSha})`
    : `${kind}: not recorded`;
}

function testLabel(step: ImplementationStepRecord | null) {
  const test = step?.testEvidenceRecord;

  if (!test) {
    return "Tests: not recorded";
  }

  const notTested = test.notTestedGaps.length ? `; Not-tested: ${test.notTestedGaps.join(", ")}` : "";

  return `Tests: ${test.outcome} (${test.commands.join(" | ")}), passed=${test.passedTestCount}, failed=${test.failedTestCount}${notTested}`;
}

export function implementationStepLedgerViewModel(
  projection: ImplementationStepLedgerProjection | null
): ImplementationStepLedgerViewModel {
  const step = latestStep(projection);

  if (!projection || !step) {
    return {
      status: "not_started",
      summary: "Implementation step ledger has not been recorded.",
      trackerLabel: "No tracker doc recorded",
      progressReport: "No implementation progress report is available yet.",
      latestStepTitle: "No step recorded",
      latestStepScope: "not set",
      commitLabel: "Commit: not recorded",
      previousCommitLabel: "Previous commit: not recorded",
      diffRangeLabel: "Diff range: not recorded",
      rollbackLabel: "Rollback/reference: not recorded",
      codeReviewLabel: "Code review: not recorded",
      cleanCodeReviewLabel: "Clean-code review: not recorded",
      testEvidenceLabel: "Tests: not recorded",
      missingEvidenceItems: ["StepCommitRecord", "CodeReviewRecord", "CleanCodeReviewRecord", "TestEvidenceRecord"],
      blockerLabel: "Cannot complete until implementation, review, clean-code review, and test evidence are recorded.",
      nextAction: "Record the implementation step ledger after the local step commit and evidence gates are available.",
      evidenceRefs: [],
      noCodeEvidenceLabel: null
    };
  }

  const commit = step.stepCommitRecord;
  const noCode = step.noCodeStepEvidence;
  const blocker = step.blocker;

  return {
    status: projection.currentStatus,
    summary: projection.summary,
    trackerLabel: `${projection.trackerDoc.title}: ${projection.trackerDoc.goal}`,
    progressReport: projection.progressReport,
    latestStepTitle: step.stepDoc.title,
    latestStepScope: step.stepDoc.expectedChangeScope,
    commitLabel: commit ? `Commit: ${commit.commitSha}` : "Commit: not recorded",
    previousCommitLabel: commit ? `Previous commit: ${commit.previousCommitSha}` : "Previous commit: not recorded",
    diffRangeLabel: commit ? `Diff range: ${commit.diffRange}` : "Diff range: not recorded",
    rollbackLabel: commit ? `Rollback/reference: ${commit.rollbackRef}` : "Rollback/reference: not recorded",
    codeReviewLabel: reviewLabel(step.codeReviewRecord, "Code review"),
    cleanCodeReviewLabel: reviewLabel(step.cleanCodeReviewRecord, "Clean-code review"),
    testEvidenceLabel: testLabel(step),
    missingEvidenceItems: step.missingEvidence,
    blockerLabel: blocker ? `${blocker.reason} Next: ${blocker.nextRequiredAction}` : null,
    nextAction: blocker?.nextRequiredAction ?? (
      projection.currentStatus === "completed"
        ? "Step can be reported as completed with local commit, reviews, and tests."
        : "Continue the linear ledger sequence until commit, reviews, and tests are present."
    ),
    evidenceRefs: step.evidenceRefs,
    noCodeEvidenceLabel: noCode
      ? `No-code evidence: ${noCode.noCodeReason}; baseline=${noCode.baselineCommitSha}; clean=${noCode.cleanTrackedState}; Not-tested gaps=${noCode.notTestedGaps.length}`
      : null
  };
}

interface ImplementationStepLedgerPanelProps {
  readonly ledger: ImplementationStepLedgerViewModel;
  readonly isBusy: boolean;
  readonly onRefreshLedger: () => void;
}

export function ImplementationStepLedgerPanel({
  ledger,
  isBusy,
  onRefreshLedger
}: ImplementationStepLedgerPanelProps) {
  return (
    <section className="panel implementation-step-ledger-panel">
      <div className="panel-heading">
        <h2>Implementation step ledger</h2>
        <span>{ledger.status}</span>
      </div>
      <p>{ledger.summary}</p>
      <p className="research-recovery">{ledger.trackerLabel}</p>
      <p className="mode-summary">Next action: {ledger.nextAction}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy} onClick={onRefreshLedger}>
          Refresh implementation ledger
        </button>
      </div>

      <h3>Latest step</h3>
      <ul>
        <li>Step: {ledger.latestStepTitle}</li>
        <li>Scope: {ledger.latestStepScope}</li>
        <li>{ledger.commitLabel}</li>
        <li>{ledger.previousCommitLabel}</li>
        <li>{ledger.diffRangeLabel}</li>
        <li>{ledger.rollbackLabel}</li>
        <li>{ledger.codeReviewLabel}</li>
        <li>{ledger.cleanCodeReviewLabel}</li>
        <li>{ledger.testEvidenceLabel}</li>
        {ledger.noCodeEvidenceLabel ? <li>{ledger.noCodeEvidenceLabel}</li> : null}
      </ul>

      <h3>Progress report</h3>
      <pre className="ledger-progress-report">{ledger.progressReport}</pre>

      {ledger.missingEvidenceItems.length ? (
        <>
          <h3>Missing or blocked evidence</h3>
          <ul>
            {ledger.missingEvidenceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {ledger.blockerLabel ? <p className="research-recovery">{ledger.blockerLabel}</p> : null}

      <h3>Evidence refs</h3>
      {ledger.evidenceRefs.length ? (
        <ul>
          {ledger.evidenceRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No implementation evidence refs recorded.</p>
      )}
    </section>
  );
}
