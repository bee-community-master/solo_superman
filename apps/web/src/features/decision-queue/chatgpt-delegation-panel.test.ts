import { describe, expect, it } from "vitest";
import {
  CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE
} from "@solo-superman/contracts";
import { chatGptDelegationViewModel } from "./ChatGptDelegationPanel";

describe("chatGptDelegationViewModel", () => {
  it("surfaces running state, revoke control, artifacts, and ResearchTask activity links", () => {
    const view = chatGptDelegationViewModel(CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE);
    const artifactControlText = view.artifactControlLabels.join("\n");

    expect(view).toMatchObject({
      status: "running",
      canRevoke: true,
      runId: "chatgpt_delegation_ready_fixture",
      visibleHandoffLabel: expect.stringContaining("사용자가 볼 수 있는")
    });
    expect(view.activityFeedRefs).toContain("research_task:research_task_chatgpt_ready");
    expect(view.artifactRefs).toEqual(expect.arrayContaining([
      "prompt:prompt_preview_chatgpt_ready",
      "redaction:redaction_preview_chatgpt_ready",
      "screenshot:browser_action:screenshot:chatgpt-ready",
      "log:browser_action:log:chatgpt-ready"
    ]));
    expect(view.redactionPreviewRef).toBe("redaction_preview_chatgpt_ready");
    expect(artifactControlText).toContain("Export retained");
    expect(artifactControlText).toContain("Delete retained");
    expect(view.auditItems.join("\n")).toContain("DelegationRunApproved");
    expect(view.retentionLabel).toContain("export/delete controls");
  });

  it("surfaces blocked fallback copy without a revoke control", () => {
    const view = chatGptDelegationViewModel(CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE);

    expect(view.status).toBe("blocked");
    expect(view.canRevoke).toBe(false);
    expect(view.visibleHandoffLabel).toContain("완전 headless");
    expect(view.fallbackLabel).toContain("manual_prompt_handoff");
    expect(view.fallbackReason).toContain("Policy risk blocks");
    expect(view.blockReasonItems.join("\n")).toContain("policy_risk_blocked");
    expect(view.nextAction).toContain("Known Risk");
    expect(view.auditItems.join("\n")).toContain("DelegationFallbackApplied");
  });

  it("keeps not-started copy explicit", () => {
    const view = chatGptDelegationViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.canRevoke).toBe(false);
    expect(view.visibleHandoffLabel).toContain("사용자 소유 브라우저");
    expect(view.artifactRefs).toEqual([]);
    expect(view.artifactControlLabels).toEqual([]);
  });
});
