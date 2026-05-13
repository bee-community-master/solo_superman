import { describe, expect, it } from "vitest";
import { expectTypeOf } from "vitest";
import {
  SERVICE_PAGE_USE_PERMISSION_BLOCKED_ACTION_CLASSES,
  SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
  validateServicePageUsePermissionProjection,
  type CreateServicePageUsePermissionPayload,
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
    expect(projection.latestPermission.finalSubmitBoundary.productionMutationPerformed).toBe(false);
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
