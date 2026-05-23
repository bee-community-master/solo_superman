import { describe, expect, it } from "vitest";
import {
  BROWSER_DELEGATION_PIPELINE_SMOKE,
  runBrowserDelegationPipelineSmoke
} from "./browser-delegation-pipeline-smoke";

describe("browser delegation pipeline smoke", () => {
  it("proves the credential-free browser action to ChatGPT delegation and revoke path", async () => {
    const evidence = await runBrowserDelegationPipelineSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: BROWSER_DELEGATION_PIPELINE_SMOKE,
      mode: "fixture",
      browser: expect.objectContaining({
        status: "completed",
        hostname: "127.0.0.1"
      }),
      delegation: expect.objectContaining({
        statusBeforeRevoke: "running",
        statusAfterRevoke: "revoked",
        approvalDecision: "approved",
        blockReasonCountBeforeRevoke: 0
      })
    });
    expect(evidence.browser?.screenshotRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.browser?.logRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.browser?.auditRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.delegation?.blockReasonCountAfterRevoke).toBeGreaterThanOrEqual(1);
    expect(evidence.delegation?.auditEventTypes).toEqual(expect.arrayContaining(["DelegationRunRevoked", "revoke"]));
    expect(evidence.checked).toEqual(
      expect.arrayContaining([
        "loopback mock ChatGPT page served without credentials",
        "approved browser_action ExecutionAuthorityRecord preserved loopback and no-secret sandbox",
        "ChatGPT browser delegation run retained disclosure, redaction, policy, session ownership, approval, and authority refs",
        "revoke records revoked_by_user and disables further revoke"
      ])
    );
  });
});
