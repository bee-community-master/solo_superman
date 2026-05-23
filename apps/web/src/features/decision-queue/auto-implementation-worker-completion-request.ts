import {
  AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE,
  type AutoImplementationRun,
  type CompleteAutoImplementationWorkerJobRequest,
  type ImplementationStepLedgerProjection,
  type ImplementationStepRecord,
  type SessionId
} from "@solo-superman/contracts";
import { latestCurrentStageAutoImplementationWorkerJob } from "./auto-implementation-worker-job-selection";

function canBackendCompleteWorkerJob(job: AutoImplementationRun["workerJobs"][number]) {
  return job.status === "planned" ||
    (
      job.status === "blocked" &&
      job.missingEvidence.length === 1 &&
      job.missingEvidence[0] === AUTO_IMPLEMENTATION_WORKER_MISSING_EVIDENCE.completedLedgerStep
    );
}

function completedLedgerSteps(ledger: ImplementationStepLedgerProjection | null) {
  return [...(ledger?.steps ?? [])].filter((step) =>
    step.status === "completed" &&
    step.missingEvidence.length === 0 &&
    step.blocker === null
  );
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function stepMatchesPlannedWorkerLedgerDocs(input: {
  readonly ledger: ImplementationStepLedgerProjection;
  readonly step: ImplementationStepRecord;
  readonly workerJob: AutoImplementationRun["workerJobs"][number];
}) {
  const { ledger, step, workerJob } = input;
  const plannedTrackerDoc = workerJob.executionPlan.ledgerTrackerDoc;
  const plannedStepDoc = workerJob.executionPlan.ledgerStepDoc;

  return ledger.trackerDoc.trackerId === plannedTrackerDoc.trackerId &&
    ledger.trackerDoc.title === plannedTrackerDoc.title &&
    ledger.trackerDoc.goal === plannedTrackerDoc.goal &&
    sameStringArray(ledger.trackerDoc.sourceRefs, plannedTrackerDoc.sourceRefs) &&
    step.stepDoc.stepId === plannedStepDoc.stepId &&
    step.stepDoc.title === plannedStepDoc.title &&
    step.stepDoc.description === plannedStepDoc.description &&
    step.stepDoc.expectedChangeScope === plannedStepDoc.expectedChangeScope &&
    sameStringArray(step.stepDoc.sourceRefs, plannedStepDoc.sourceRefs);
}

export function selectAutoImplementationWorkerCompletionStepId(input: {
  readonly run: AutoImplementationRun | null;
  readonly ledger: ImplementationStepLedgerProjection | null;
}) {
  const { ledger, run } = input;
  const workerJob = latestCurrentStageAutoImplementationWorkerJob(run);

  if (!ledger || !run || !workerJob) {
    return null;
  }

  const completedSteps = completedLedgerSteps(ledger);
  const plannedStep = [...completedSteps].reverse().find((step) =>
    stepMatchesPlannedWorkerLedgerDocs({ ledger, step, workerJob })
  );

  return plannedStep?.stepDoc.stepId ?? null;
}

export function canCompleteAutoImplementationWorkerFromLedger(input: {
  readonly run: AutoImplementationRun | null;
  readonly ledger: ImplementationStepLedgerProjection | null;
}) {
  const { run } = input;
  const workerJob = latestCurrentStageAutoImplementationWorkerJob(run);

  return Boolean(
    run &&
    run.status !== "completed" &&
    workerJob &&
    canBackendCompleteWorkerJob(workerJob) &&
    selectAutoImplementationWorkerCompletionStepId(input)
  );
}

export function buildAutoImplementationWorkerCompletionRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly ledger: ImplementationStepLedgerProjection | null;
}): CompleteAutoImplementationWorkerJobRequest | null {
  const { ledger, run, sessionId } = input;
  const workerJob = latestCurrentStageAutoImplementationWorkerJob(run);
  const implementationStepId = selectAutoImplementationWorkerCompletionStepId({ run, ledger });

  if (!workerJob || !implementationStepId || !canBackendCompleteWorkerJob(workerJob)) {
    return null;
  }

  return {
    sessionId,
    runId: run.runId,
    jobId: workerJob.jobId,
    idempotencyKey: `auto-implementation-worker-complete:${sessionId}:${run.runId}:${workerJob.jobId}:${implementationStepId}:${workerJob.updatedAt}`,
    implementationStepId,
    evidenceRefs: [`ui-worker-complete-from-ledger:${workerJob.jobId}:${implementationStepId}`]
  };
}
