import type {
  AutoImplementationStageAction,
  AutoImplementationRun,
  RecordAutoImplementationStageRequest,
  SessionId
} from "@solo-superman/contracts";

type StageLifecycleAction = Extract<AutoImplementationStageAction, "start" | "pause" | "block">;

function stageActionIdempotencyKey(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly action: AutoImplementationStageAction;
}) {
  return `auto-implementation-stage-${input.action}:${input.sessionId}:${input.run.runId}:${input.run.currentStage}:${input.run.nextTickAt}:${input.run.updatedAt}`;
}

function currentStageBlockedWorkerJob(run: AutoImplementationRun) {
  return [...run.workerJobs]
    .reverse()
    .find((job) =>
      job.stage === run.currentStage &&
      (job.status === "blocked" || job.missingEvidence.length > 0 || job.blockedReason)
    ) ?? null;
}

export function buildAutoImplementationStageTickRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly tickedAt: string;
}): RecordAutoImplementationStageRequest {
  const { run, sessionId, tickedAt } = input;

  return {
    sessionId,
    runId: run.runId,
    stage: run.currentStage,
    action: "tick",
    idempotencyKey: stageActionIdempotencyKey({ sessionId, run, action: "tick" }),
    tickedAt,
    evidenceRefs: [`ui-stage-tick:${run.runId}:${run.currentStage}`]
  };
}

export function buildAutoImplementationStageLifecycleRequest(input: {
  readonly sessionId: SessionId;
  readonly run: AutoImplementationRun;
  readonly action: StageLifecycleAction;
  readonly tickedAt: string;
}): RecordAutoImplementationStageRequest {
  const { action, run, sessionId, tickedAt } = input;
  const evidenceRefs = [`ui-stage-${action}:${run.runId}:${run.currentStage}`];
  const workerJob = action === "block" ? currentStageBlockedWorkerJob(run) : null;

  return {
    sessionId,
    runId: run.runId,
    stage: run.currentStage,
    action,
    idempotencyKey: stageActionIdempotencyKey({ sessionId, run, action }),
    tickedAt,
    evidenceRefs,
    ...(action === "block"
      ? {
          blocker: {
            stage: run.currentStage,
            reason: workerJob?.blockedReason ??
              "Operator marked the current auto implementation stage blocked from the Implementation view.",
            missingEvidence: workerJob?.missingEvidence.length
              ? workerJob.missingEvidence
              : ["manual blocker review"],
            nextRequiredAction: workerJob?.nextRequiredAction ??
              "Resolve the current stage blocker, then start or tick the stage again.",
            evidenceRefs: [
              ...evidenceRefs,
              ...(workerJob?.evidenceRefs ?? [])
            ]
          }
        }
      : {})
  };
}
