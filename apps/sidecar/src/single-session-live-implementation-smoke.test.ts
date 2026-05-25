import { describe, expect, it } from "vitest";
import {
  runSingleSessionLiveImplementationSmoke,
  singleSessionLiveImplementationEnvFromArgv,
  singleSessionLiveImplementationModeFromArgv
} from "./single-session-live-implementation-smoke";
import {
  LIVE_TURNS_ENV,
  LIVE_WORKER_JOB_VERIFY_ENV
} from "./auto-implementation-worker-smoke";

describe("single-session live implementation smoke", () => {
  it("maps CLI live and fixture flags without letting ambient env force live mode", () => {
    expect(singleSessionLiveImplementationModeFromArgv([])).toBe("fixture");
    expect(singleSessionLiveImplementationModeFromArgv(["--live"])).toBe("live_web_worker");
    expect(singleSessionLiveImplementationEnvFromArgv(["--live"], {})).toMatchObject({
      [LIVE_WORKER_JOB_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    });
    expect(
      singleSessionLiveImplementationEnvFromArgv(["--fixture"], {
        [LIVE_WORKER_JOB_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      })
    ).not.toHaveProperty(LIVE_WORKER_JOB_VERIFY_ENV);
  });

  it("proves the same session can move from idea input through worker-backed implementation evidence", async () => {
    const evidence = await runSingleSessionLiveImplementationSmoke({ mode: "fixture" });

    expect(evidence.status).toBe("passed");
    expect(evidence.singleSession?.status).toBe("passed");
    expect(evidence.singleSession?.loop?.planningHandoffStatus).toBe("planning_ready");
    expect(evidence.singleSession?.loop?.autoImplementationCurrentStage).toBe("initial_pr");
    expect(evidence.worker).toMatchObject({
      runId: evidence.singleSession?.loop?.autoImplementationRunId,
      sameSessionRunId: evidence.singleSession?.loop?.autoImplementationRunId,
      jobStatus: "completed",
      stageBefore: "initial_pr",
      stageAfter: "code_review_fix_1",
      ledgerStatus: "completed"
    });
    expect(evidence.checked).toContain(
      "same-session auto implementation run reused the Planning Handoff run instead of creating a detached worker smoke run"
    );
  });
});
