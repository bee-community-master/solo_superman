import { describe, expect, it } from "vitest";
import {
  READINESS_TO_IMPLEMENTATION_SMOKE,
  runReadinessToImplementationSmoke
} from "./readiness-to-implementation-smoke";

describe("readiness-to-implementation smoke", () => {
  it("proves a spec-ready completion candidate can become a planning handoff and auto implementation run", async () => {
    const evidence = await runReadinessToImplementationSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: READINESS_TO_IMPLEMENTATION_SMOKE,
      mode: "fixture",
      readiness: {
        compositeScore: 92,
        readinessLabel: "spec_ready",
        completionCandidateStatus: "candidate",
        planningHandoffStatus: "planning_ready"
      },
      implementation: {
        status: "pending",
        currentStage: "initial_pr",
        initialStageStatus: "ready",
        projectFolderName: "readiness-to-implementation-smoke-demo",
        remoteStatus: "no_remote"
      }
    });
    expect(evidence.readiness?.planningSourceRefTypes).toEqual(expect.arrayContaining([
      "spec_version",
      "completion_candidate",
      "decision_linked_evidence_pack",
      "research_updated_queue_item"
    ]));
    expect(evidence.implementation?.stageCount).toBeGreaterThanOrEqual(7);
    expect(evidence.checked).toEqual(expect.arrayContaining([
      "completeness projection reports score >=85, spec_ready label, candidate status, and passed gates",
      "Planning Handoff reaches planning_ready with spec, completion, evidence-pack, and research-queue source refs",
      "auto implementation run starts only after matching planning_ready artifact"
    ]));
  });
});
