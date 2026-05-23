import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_PIPELINE_SMOKE,
  credentialFreePipelineSmokeEnv,
  runAutoImplementationPipelineSmoke
} from "./auto-implementation-pipeline-smoke";
import { RUNTIME_PREVIEW_TURN_SMOKE, type RuntimePreviewTurnSmokeEvidence } from "./runtime-preview-smoke";
import {
  AUTO_IMPLEMENTATION_WORKER_SMOKE,
  type AutoImplementationWorkerSmokeEvidence
} from "./auto-implementation-worker-smoke";
import {
  AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
  type AutoImplementationPrMutationSmokeEvidence
} from "./auto-implementation-pr-mutation-smoke";
import {
  AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
  type AutoImplementationReviewLoopSmokeEvidence
} from "./auto-implementation-review-loop-smoke";

function previewEvidence(status: RuntimePreviewTurnSmokeEvidence["status"] = "passed"): RuntimePreviewTurnSmokeEvidence {
  return {
    status,
    smoke: RUNTIME_PREVIEW_TURN_SMOKE,
    mode: "fixture",
    ...(status === "blocked" ? { reason: "preview blocker" } : {}),
    checked: ["preview checked"]
  };
}

function workerEvidence(status: AutoImplementationWorkerSmokeEvidence["status"] = "passed"): AutoImplementationWorkerSmokeEvidence {
  return {
    status,
    smoke: AUTO_IMPLEMENTATION_WORKER_SMOKE,
    mode: "fixture",
    ...(status === "blocked" ? { reason: "worker blocker" } : {}),
    checked: ["worker checked"]
  };
}

function prMutationEvidence(
  status: AutoImplementationPrMutationSmokeEvidence["status"] = "passed"
): AutoImplementationPrMutationSmokeEvidence {
  return {
    status,
    smoke: AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
    mode: "fixture",
    ...(status === "blocked" ? { reason: "pr blocker" } : {}),
    checked: ["pr checked"]
  };
}

function reviewLoopEvidence(
  status: AutoImplementationReviewLoopSmokeEvidence["status"] = "passed"
): AutoImplementationReviewLoopSmokeEvidence {
  return {
    status,
    smoke: AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
    mode: "fixture",
    ...(status === "blocked" ? { reason: "review blocker" } : {}),
    checked: ["review checked"]
  };
}

describe("auto implementation pipeline smoke", () => {
  it("passes only after preview, worker, PR mutation, and review-loop fixture smokes all pass", async () => {
    const evidence = await runAutoImplementationPipelineSmoke({
      runRuntimePreviewTurn: async () => previewEvidence(),
      runWorkerJob: async () => workerEvidence(),
      runPrMutation: async () => prMutationEvidence(),
      runReviewLoop: async () => reviewLoopEvidence()
    });

    expect(evidence.status).toBe("passed");
    expect(evidence.smoke).toBe(AUTO_IMPLEMENTATION_PIPELINE_SMOKE);
    expect(evidence.checked).toEqual([
      "credential-free aggregate smoke forced fixture mode for preview, worker, PR, and review-loop checks",
      "runtime-preview-turn: preview checked",
      "worker-job: worker checked",
      "pr-mutation: pr checked",
      "review-loop: review checked"
    ]);
  });

  it("blocks the aggregate smoke when a critical-path stage blocks", async () => {
    const evidence = await runAutoImplementationPipelineSmoke({
      runRuntimePreviewTurn: async () => previewEvidence(),
      runWorkerJob: async () => workerEvidence("blocked"),
      runPrMutation: async () => prMutationEvidence(),
      runReviewLoop: async () => reviewLoopEvidence()
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.reason).toContain("did not satisfy every critical-path fixture stage");
    expect(evidence.blockers).toEqual(["worker-job smoke reported blocked: worker blocker"]);
  });

  it("converts child smoke failures into blocked aggregate evidence", async () => {
    const evidence = await runAutoImplementationPipelineSmoke({
      runRuntimePreviewTurn: async () => previewEvidence(),
      runWorkerJob: async () => {
        throw new Error("worker runner failed");
      },
      runPrMutation: async () => prMutationEvidence(),
      runReviewLoop: async () => reviewLoopEvidence()
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.stages.workerJob).toMatchObject({
      status: "blocked",
      reason: "Worker-job smoke failed before it could return evidence.",
      blockers: ["worker runner failed"]
    });
    expect(evidence.blockers).toEqual([
      "worker-job smoke reported blocked: Worker-job smoke failed before it could return evidence."
    ]);
  });

  it("blocks the aggregate smoke when the review loop blocks", async () => {
    const evidence = await runAutoImplementationPipelineSmoke({
      runRuntimePreviewTurn: async () => previewEvidence(),
      runWorkerJob: async () => workerEvidence(),
      runPrMutation: async () => prMutationEvidence(),
      runReviewLoop: async () => reviewLoopEvidence("blocked")
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual(["review-loop smoke reported blocked: review blocker"]);
  });

  it("strips live-runtime opt-in flags so the aggregate smoke stays credential-free by default", () => {
    const env = credentialFreePipelineSmokeEnv({
      SOLO_VERIFY_CODEX_LIVE_PREVIEW_TURN: "1",
      SOLO_VERIFY_CODEX_LIVE_WORKER_JOB: "1",
      SOLO_CODEX_APP_SERVER_LIVE_TURNS: "1",
      KEEP_ME: "yes"
    });

    expect(env).toEqual({ KEEP_ME: "yes" });
  });
});
