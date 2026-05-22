import type {
  AutoImplementationRun,
  RecordAutoImplementationStageRequest,
  SessionId
} from "@solo-superman/contracts";

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
    idempotencyKey: `auto-implementation-stage-tick:${sessionId}:${run.runId}:${run.currentStage}:${run.nextTickAt}:${run.updatedAt}`,
    tickedAt,
    evidenceRefs: [`ui-stage-tick:${run.runId}:${run.currentStage}`]
  };
}
