import { describe, expect, it } from "vitest";
import { expectTypeOf } from "vitest";
import {
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
  servicePageUsePermissionSummaryForStatus,
  validateServicePageUsePermissionProjection,
  type CreateServicePageUsePermissionPayload,
  type DeleteServicePageUsePermissionArtifactsPayload,
  type RevokeServicePageUsePermissionPayload
} from "./service-page-use-permission";

describe("Service page-use permission projection contract", () => {
  it("keeps create/revoke payload keys explicit", () => {
    expectTypeOf<keyof CreateServicePageUsePermissionPayload>().toEqualTypeOf<
      | "serviceName"
      | "serviceOrigin"
      | "pageUrl"
      | "purpose"
      | "allowedActionClasses"
      | "blockedActionClasses"
      | "dataCategories"
      | "approvalGranularity"
      | "approvalDecision"
      | "userApprovalRef"
      | "promptPreviewRef"
      | "redactionPreviewRef"
      | "userExportDeleteControls"
      | "finalSubmitRequested"
      | "finalSubmitConfirmationRef"
      | "finalSubmitExecutionAuthorityRef"
      | "screenshotRefs"
      | "logRefs"
      | "evidenceRefs"
      | "auditRefs"
      | "activityFeedRefs"
    >();
    expectTypeOf<keyof RevokeServicePageUsePermissionPayload>().toEqualTypeOf<
      "permissionId" | "reason" | "auditRefs"
    >();
    expectTypeOf<keyof DeleteServicePageUsePermissionArtifactsPayload>().toEqualTypeOf<
      "permissionId" | "reason" | "auditRefs"
    >();
  });

  it("validates the ready fixture with user-owned login and sensitive actions blocked", () => {
    const projection = validateServicePageUsePermissionProjection(
      SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE
    );

    expect(projection.latestPermission.credentialEntryDelegated).toBe(false);
    expect(projection.latestPermission.userPresentLoginRequired).toBe(true);
    expect(projection.latestPermission.blockedActionClasses).toEqual(
      SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES
    );
    expect(projection.latestPermission.artifactRetention.userExportDeleteControls).toBe(true);
    expect(projection.latestPermission.artifactRetention.promptResultScreenshotLogRetention).toBe(
      "default_evidence_refs_only"
    );
    expect(projection.latestPermission.nextAction).toContain("Request fill-draft per-action approval separately");
    expect(projection.latestPermission.nextAction).toContain("Final submit remains blocked");
    expect(projection.latestPermission.finalSubmitBoundary.productionMutationPerformed).toBe(false);
  });

  it("keeps final-submit requested summary tied to the production-mutation contract", () => {
    const summary = servicePageUsePermissionSummaryForStatus("final_submit_requested");

    expect(summary).toContain("production-mutation contract");
    expect(summary).toContain("Final submit remains blocked");
  });

  it("validates projections after JSON persistence/API round-trip", () => {
    const roundTripped = JSON.parse(
      JSON.stringify(SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE)
    ) as typeof SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE;
    const projection = validateServicePageUsePermissionProjection(roundTripped);

    expect(projection.latestPermission).not.toBe(projection.permissions.at(-1));
    expect(projection.latestPermission.permissionId).toBe(projection.permissions.at(-1)?.permissionId);
  });

  it("accepts durable artifact deletion while audit metadata remains", () => {
    const deletedPermission = {
      ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission,
      promptPreviewRef: null,
      screenshotRefs: [],
      logRefs: [],
      artifactRetention: {
        ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission.artifactRetention,
        promptResultScreenshotLogRetention: "deleted_audit_metadata_only",
        redactionPreviewRef: null,
        artifactRefsDeletedAt: "2026-05-13T00:01:00.000Z",
        artifactRefsDeletionAuditRef: "audit:service-page-artifacts-deleted"
      },
      auditLog: [
        ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission.auditLog,
        {
          eventType: "ServicePageArtifactsDeleted",
          label: "Artifact refs were deleted while audit metadata was retained.",
          evidenceRefs: ["audit:service-page-artifacts-deleted"]
        }
      ]
    } as const;
    const projection = validateServicePageUsePermissionProjection({
      ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
      permissions: [deletedPermission],
      latestPermission: deletedPermission
    });

    expect(projection.latestPermission.promptPreviewRef).toBeNull();
    expect(projection.latestPermission.artifactRetention.promptResultScreenshotLogRetention).toBe(
      "deleted_audit_metadata_only"
    );
  });

  it("rejects ref-shaped credential/session/secret values", () => {
    const unsafePermission = {
      ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission,
      screenshotRefs: ["screenshot:session_cookie_abcd1234567890"],
      auditRefs: ["audit:password-abcd1234567890"]
    } as const;

    expect(() =>
      validateServicePageUsePermissionProjection({
        ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
        permissions: [unsafePermission],
        latestPermission: unsafePermission
      })
    ).toThrow(/refs must not contain credential.*secret-bearing values/iu);
  });

  it("rejects credential-bearing URL userinfo before projection persistence", () => {
    const unsafePermission = {
      ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission,
      pageUrl: "https://user:hunter2@vercel.com/new"
    } as const;

    expect(() =>
      validateServicePageUsePermissionProjection({
        ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
        permissions: [unsafePermission],
        latestPermission: unsafePermission
      })
    ).toThrow(/strings must not contain credential-bearing URL userinfo/iu);
  });

  it("rejects records that omit the user-owned login boundary", () => {
    expect(() =>
      validateServicePageUsePermissionProjection({
        ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
        permissions: [
          {
            ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission,
            credentialEntryDelegated: true as false
          }
        ],
        latestPermission: {
          ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission,
          credentialEntryDelegated: true as false
        }
      })
    ).toThrow(/login credentials must stay user-owned/iu);
  });
});
