import { describe, expect, it } from "vitest";
import { SERVICE_PAGE_PIPELINE_SMOKE, runServicePagePipelineSmoke } from "./service-page-pipeline-smoke";

describe("service page-use pipeline smoke", () => {
  it("proves credential-free service page permission, browser action, artifact delete, revoke, and final-submit gates", async () => {
    const evidence = await runServicePagePipelineSmoke();

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: SERVICE_PAGE_PIPELINE_SMOKE,
      mode: "fixture",
      permission: expect.objectContaining({
        artifactRetention: "deleted_audit_metadata_only",
        revokeStatus: "revoked",
        finalSubmitStatus: "blocked"
      }),
      browser: expect.objectContaining({
        readStatus: "completed",
        fillDraftStatus: "completed",
        missingPermissionStatus: "blocked",
        replayWithoutEchoStatus: "blocked",
        afterRevokeStatus: "blocked",
        finalSubmitBrowserStatus: "blocked"
      })
    });
    expect(evidence.browser?.readScreenshotRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.browser?.readLogRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.browser?.readAuditRefCount).toBeGreaterThanOrEqual(1);
    expect(evidence.checked).toEqual(
      expect.arrayContaining([
        "service page browser action blocks before matching permission exists",
        "scoped browser action requires permission/action echo and loopback no-secret boundary",
        "artifact delete switches retained refs to audit-metadata-only",
        "final-submit request remains blocked without a production-mutation contract"
      ])
    );
  });
});
