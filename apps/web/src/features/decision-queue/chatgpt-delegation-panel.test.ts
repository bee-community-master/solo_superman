import { describe, expect, it } from "vitest";
import { createElement } from "react";
import {
  CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE
} from "@solo-superman/contracts";
import {
  ChatGptDelegationPanel,
  chatGptDelegationViewModel
} from "./ChatGptDelegationPanel";
import { DECISION_QUEUE_COPY } from "./shell/decision-queue-copy";
import { renderEnglishMarkup, renderMarkup } from "./test-rendering";

describe("chatGptDelegationViewModel", () => {
  it("surfaces running state, revoke control, artifacts, and ResearchTask activity links", () => {
    const view = chatGptDelegationViewModel(CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE);
    const artifactControlText = view.artifactControlLabels.join("\n");

    expect(view).toMatchObject({
      status: "running",
      canRevoke: true,
      runId: "chatgpt_delegation_ready_fixture",
      visibleHandoffLabel: expect.stringContaining("visible local browser")
    });
    expect(view.activityFeedRefs).toContain("research_task:research_task_chatgpt_ready");
    expect(view.artifactRefs).toEqual(expect.arrayContaining([
      "prompt:prompt_preview_chatgpt_ready",
      "redaction:redaction_preview_chatgpt_ready",
      "screenshot:browser_action:screenshot:chatgpt-ready",
      "log:browser_action:log:chatgpt-ready"
    ]));
    expect(view.redactionPreviewRef).toBe("redaction_preview_chatgpt_ready");
    expect(view.dataDisclosureItems.join("\n")).toContain("disclosure_preview_chatgpt_ready");
    expect(view.dataDisclosureItems.join("\n")).toContain("Excluded sensitive fields");
    expect(view.policyRiskVerdictLabel).toContain("pass");
    expect(view.policyRiskEvidenceRefs).toContain("policy:chatgpt-pro:per-run");
    expect(view.sessionOwnershipVerdictLabel).toContain("User confirms they signed into the local browser profile directly");
    expect(view.sessionOwnershipEvidenceRefs).toContain("session:owner-confirmed");
    expect(view.approvalDecisionLabel).toBe("approved");
    expect(view.browserActionAuthorityLabel).toBe("exec_auth_chatgpt_ready");
    expect(view.resultImportLabel).toContain("No result import");
    expect(view.resultImportGateItems).toContain("No result import gate has been evaluated yet.");
    expect(artifactControlText).toContain("Export retained");
    expect(artifactControlText).toContain("Delete retained");
    expect(view.auditItems.join("\n")).toContain("DelegationRunApproved");
    expect(view.retentionLabel).toContain("export/delete controls");
  });

  it("surfaces blocked fallback copy without a revoke control", () => {
    const view = chatGptDelegationViewModel(CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE);

    expect(view.status).toBe("blocked");
    expect(view.canRevoke).toBe(false);
    expect(view.visibleHandoffLabel).toContain("fully headless");
    expect(view.fallbackLabel).toContain("manual_prompt_handoff");
    expect(view.fallbackReason).toContain("Policy risk blocks");
    expect(view.blockReasonItems.join("\n")).toContain("policy_risk_blocked");
    expect(view.policyRiskVerdictLabel).toContain("block");
    expect(view.policyRiskEvidenceRefs).toContain("policy:blocked:unattended-queue");
    expect(view.browserActionAuthorityLabel).toContain("missing browser action authority");
    expect(view.nextAction).toContain("Known Risk");
    expect(view.auditItems.join("\n")).toContain("DelegationFallbackApplied");
  });

  it("keeps not-started copy explicit", () => {
    const view = chatGptDelegationViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.canRevoke).toBe(false);
    expect(view.visibleHandoffLabel).toContain("user-owned browser");
    expect(view.artifactRefs).toEqual([]);
    expect(view.artifactControlLabels).toEqual([]);
    expect(view.dataDisclosureItems).toEqual([]);
    expect(view.policyRiskVerdictLabel).toBeNull();
  });

  it("renders safety verdict and disclosure details only after a delegation run exists", () => {
    const view = chatGptDelegationViewModel(CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE);
    const readyMarkup = renderEnglishMarkup(
      createElement(ChatGptDelegationPanel, {
        delegation: view,
        isBusy: false,
        onRefreshDelegation: () => undefined,
        onRevokeDelegation: () => undefined
      })
    );
    const emptyMarkup = renderEnglishMarkup(
      createElement(ChatGptDelegationPanel, {
        delegation: chatGptDelegationViewModel(null),
        isBusy: false,
        onRefreshDelegation: () => undefined,
        onRevokeDelegation: () => undefined
      })
    );

    expect(readyMarkup).toContain("ChatGPT delegation safety");
    expect(readyMarkup).toContain("Data disclosure preview");
    expect(readyMarkup).toContain("Prompt context summary: context_summary_chatgpt_ready");
    expect(readyMarkup).toContain("Policy risk verdict");
    expect(readyMarkup).toContain("policy:chatgpt-pro:per-run");
    expect(readyMarkup).toContain("Session ownership verdict");
    expect(readyMarkup).toContain("session:owner-confirmed");
    expect(readyMarkup).toContain("Approval decision: approved");
    expect(readyMarkup).toContain("Browser action authority: exec_auth_chatgpt_ready");
    expect(readyMarkup).toContain("Result import: No result import has been captured yet.");
    expect(readyMarkup).toContain("Result import gate");
    expect(readyMarkup).toContain("No result import gate has been evaluated yet.");
    expect(readyMarkup).not.toMatch(/[가-힣]/u);
    expect(emptyMarkup).not.toContain("ChatGPT delegation safety");
  });

  it("renders Korean ChatGPT delegation view-model copy in the Korean shell", () => {
    const view = chatGptDelegationViewModel(
      CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
      DECISION_QUEUE_COPY.ko.permissions.chatGptDelegationViewModel
    );
    const markup = renderMarkup(
      createElement(ChatGptDelegationPanel, {
        delegation: view,
        isBusy: false,
        onRefreshDelegation: () => undefined,
        onRevokeDelegation: () => undefined
      }),
      "ko"
    );

    expect(view.visibleHandoffLabel).toContain("사용자가 볼 수 있는");
    expect(view.dataDisclosureItems.join("\n")).toContain("제외된 민감 필드");
    expect(view.resultImportGateItems).toContain("결과 가져오기 게이트가 아직 평가되지 않았습니다.");
    expect(view.artifactControlLabels.join("\n")).toContain("보관된 prompt/result/screenshot/log");
    expect(markup).toContain("ChatGPT 위임 안전 확인");
    expect(markup).toContain("결과 가져오기: 아직 결과 가져오기가 기록되지 않았습니다.");
    expect(markup).not.toContain("ChatGPT delegation safety");
  });
});
