import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  type SessionId
} from "@solo-superman/contracts";
import { buildAutoImplementationStageTickRequest } from "./auto-implementation-stage-request";

function readyRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("Auto implementation fixture must include latestRun.");
  }

  return run;
}

describe("auto implementation stage requests", () => {
  it("builds a current-stage tick request with stable run evidence", () => {
    const run = readyRun();
    const request = buildAutoImplementationStageTickRequest({
      sessionId: "demo-session" as SessionId,
      run,
      tickedAt: "2026-05-23T00:00:00.000Z"
    });

    expect(request).toMatchObject({
      sessionId: "demo-session",
      runId: run.runId,
      stage: run.currentStage,
      action: "tick",
      tickedAt: "2026-05-23T00:00:00.000Z",
      evidenceRefs: [`ui-stage-tick:${run.runId}:${run.currentStage}`]
    });
    expect(request.idempotencyKey).toContain("auto-implementation-stage-tick");
    expect(request.idempotencyKey).toContain(run.currentStage);
    expect(request.idempotencyKey).toContain(run.nextTickAt);
  });
});
