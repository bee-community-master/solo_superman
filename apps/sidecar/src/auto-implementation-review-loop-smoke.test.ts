import { AUTO_IMPLEMENTATION_STAGES } from "@solo-superman/contracts";
import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
  runAutoImplementationReviewLoopSmoke
} from "./auto-implementation-review-loop-smoke";

describe("auto implementation review-loop smoke", () => {
  it("proves every staged review, clean-code, test, and merge gate can complete with fixture evidence", async () => {
    const evidence = await runAutoImplementationReviewLoopSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: AUTO_IMPLEMENTATION_REVIEW_LOOP_SMOKE,
      mode: "fixture",
      run: expect.objectContaining({
        finalStatus: "completed",
        finalStage: "merge_main",
        completedStageCount: AUTO_IMPLEMENTATION_STAGES.length
      })
    });
    expect(evidence.run?.stages.map((stage) => stage.stage)).toEqual(AUTO_IMPLEMENTATION_STAGES);
    for (const stage of evidence.run?.stages ?? []) {
      expect(stage.ledgerStatus).toBe("completed");
      expect(stage.stageStatusAfter).toBe("completed");
      expect(stage.codeReviewSatisfiedScopes).toEqual(expect.arrayContaining(["feature", "repository"]));
      expect(stage.cleanCodeReviewSatisfiedScopes).toEqual(expect.arrayContaining(["changed_code", "repository"]));
      expect(stage.testOutcome).toBe("passed");
    }
    expect(evidence.checked).toEqual(
      expect.arrayContaining([
        "ImplementationStepLedger completed with two no-finding code-review passes per feature/repository scope for every stage",
        "ImplementationStepLedger completed with two no-finding clean-code passes per changed-code/repository scope for every stage",
        "run reached completed status at merge_main without real GitHub writes"
      ])
    );
  }, 15_000);
});
