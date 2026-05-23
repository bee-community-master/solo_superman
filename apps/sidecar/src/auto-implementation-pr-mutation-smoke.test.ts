import { describe, expect, it } from "vitest";
import {
  AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
  runAutoImplementationPrMutationSmoke
} from "./auto-implementation-pr-mutation-smoke";

describe("auto implementation PR mutation smoke", () => {
  it("runs a credential-free fixture PR mutation lifecycle through open, body update, and merge guards", async () => {
    const evidence = await runAutoImplementationPrMutationSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: AUTO_IMPLEMENTATION_PR_MUTATION_SMOKE,
      mode: "fixture",
      prMutation: {
        projectFolderName: "pr-mutation-smoke-demo",
        pullRequestUrl: "https://github.com/bee-community-master/generated-demo/pull/210",
        blockedOpenReason: "GitHub PR open is blocked until initial_pr has completed validated implementation ledger evidence.",
        openStatus: "applied",
        bodyUpdateStatus: "applied",
        blockedBeforeFinalVerifyReason:
          "GitHub PR merge is blocked until final_verify_pr_update has completed validated final verification evidence.",
        blockedMissingBodyReason: "GitHub PR merge is blocked until the PR body contains current evidence.",
        mergeStatus: "applied",
        duplicateMergeReason: "GitHub PR merge is blocked because a pull request merge is already recorded for this auto implementation run.",
        adapterActions: ["open_pr", "update_pr_body", "merge_pr"],
        bodyMarkdownChecks: [
          "open body includes issue traceability",
          "open body includes issue document status summary",
          "open body includes stage status summary",
          "open body includes review gate summary",
          "open body includes evidence gate summary",
          "open body includes implementation evidence",
          "open body includes missing-test audit evidence",
          "update body includes verification commands"
        ]
      }
    });
    expect(evidence.checked).toContain("default smoke remains credential-free and does not call gh");
    expect(evidence.checked).toContain("duplicate PR merge blocked after applied merge");
  });
});
