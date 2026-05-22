import type {
  AutoImplementationRun,
  CompleteAutoImplementationWorkerJobRequest,
  ImplementationStepLedgerProjection,
  ImplementationStepRecord,
  SessionId
} from "@solo-superman/contracts";

function latestCurrentStageWorkerJob(run: AutoImplementationRun) {
  const workerJobs = Array.isArray((run as { readonly workerJobs?: unknown }).workerJobs)
    ? run.workerJobs
    : [];

  return [...workerJobs].reverse().find((job) => job.stage === run.currentStage) ?? null;
}

function canBackendCompleteWorkerJob(job: AutoImplementationRun["workerJobs"][number]) {
  return job.status === "planned" ||
    (
      job.status === "blocked" &&
      job.missingEvidence.length === 1 &&
      job.missingEvidence[0] === "ImplementationStepLedger completed step"
    );
}

function completedLedgerSteps(ledger: ImplementationStepLedgerProjection | null) {
  return [...(ledger?.steps ?? [])].filter((step) =>
    step.status === "completed" &&
    step.missingEvidence.length === 0 &&
    step.blocker === null
  );
}

function stepMatchesCurrentStage(step: ImplementationStepRecord, run: AutoImplementationRun) {
  return step.stepDoc.sourceRefs.includes(`auto-implementation-stage:${run.currentStage}`);
}

export function selectAutoImplementationWorkerCompletionStepId(input: {
  readonly run: AutoImplementationRun | null;
  readonly ledger: ImplementationStepLedgerProjection | null;
}) {
  const { ledger, run } = input;

  if (!run) {
    return null;
  }

  const completedSteps = completedLedgerSteps(ledger);
  const stageMatchedStep = [...completedSteps].reverse().find((step) =>
    stepMatchesCurrentStage(step, run)
  );
  const selectedStep = stageMatchedStep ?? completedSteps.at(-1) ?? null;

  return selectedStep?.stepDoc.stepId ?? null;
}

export function canCompleteAutoImplementationWorkerFromLedger(input: {
  readonly run: AutoImplementationRun | null;
  readonly ledger: ImplementationStepLedgerProjection | null;
}) {
  const { run } = input;
  const workerJob = run ? latestCurrentStageWorkerJob(run) : null;

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
  const workerJob = latestCurrentStageWorkerJob(run);
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
