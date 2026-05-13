import { describe, expect, it } from "vitest";
import {
  CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS,
  CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS,
  CHATGPT_BROWSER_DELEGATION_REVOKE_PAYLOAD_KEYS,
  CHATGPT_BROWSER_DELEGATION_REVOKE_REQUEST_KEYS,
  isChatGptBrowserDelegationApprovalDecision,
  isChatGptBrowserDelegationStatus
} from "./requests";

describe("ChatGPT delegation request helpers", () => {
  it("keeps route and ProductEngine payload keys intentionally separate", () => {
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS).toContain("sessionId");
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS).toContain("idempotencyKey");
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_REQUEST_KEYS).toContain("scaffoldOnly");
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS).not.toContain("sessionId");
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS).not.toContain("idempotencyKey");
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS).not.toContain("scaffoldOnly");
    expect(CHATGPT_BROWSER_DELEGATION_CREATE_PAYLOAD_KEYS).toEqual([
      "researchTaskId",
      "status",
      "userVisibleExplanation",
      "nextAction",
      "promptPreviewRef",
      "dataDisclosurePreview",
      "redactionSummary",
      "policyRiskVerdict",
      "sessionOwnershipVerdict",
      "approvalDecision",
      "browserActionAuthorityRef",
      "resultImportRef",
      "resultImportGate",
      "fallbackApplied",
      "screenshotRefs",
      "logRefs",
      "auditRefs",
      "activityFeedRefs"
    ]);
  });

  it("keeps revoke route and ProductEngine payload keys intentionally separate", () => {
    expect(CHATGPT_BROWSER_DELEGATION_REVOKE_REQUEST_KEYS).toEqual([
      "scaffoldOnly",
      "sessionId",
      "expectedStateVersion",
      "idempotencyKey",
      "runId",
      "reason",
      "auditRefs"
    ]);
    expect(CHATGPT_BROWSER_DELEGATION_REVOKE_PAYLOAD_KEYS).toEqual(["runId", "reason", "auditRefs"]);
  });

  it("shares ChatGPT delegation enum validation across route and reducer boundaries", () => {
    expect(isChatGptBrowserDelegationStatus("running")).toBe(true);
    expect(isChatGptBrowserDelegationStatus("cancelled")).toBe(false);
    expect(isChatGptBrowserDelegationApprovalDecision("approved")).toBe(true);
    expect(isChatGptBrowserDelegationApprovalDecision("auto_approved")).toBe(false);
  });
});
