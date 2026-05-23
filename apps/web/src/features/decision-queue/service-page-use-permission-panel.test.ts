import { describe, expect, it } from "vitest";
import { createElement } from "react";
import {
  SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
  servicePageUsePermissionSummaryForStatus,
  type ServicePageUsePermissionProjection
} from "@solo-superman/contracts";
import {
  ServicePageUsePermissionPanel,
  servicePageUsePermissionViewModel
} from "./ServicePageUsePermissionPanel";
import { renderEnglishMarkup } from "./test-rendering";

describe("ServicePageUsePermissionPanel view model", () => {
  it("shows the service origin, allowed and blocked actions, login boundary, and artifact controls", () => {
    const view = servicePageUsePermissionViewModel(SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE);

    expect(view.status).toBe("granted");
    expect(view.summary).toBe(servicePageUsePermissionSummaryForStatus("granted"));
    expect(view.serviceLabel).toContain("Vercel");
    expect(view.serviceLabel).toContain("https://vercel.com");
    expect(view.pageUrl).toBe("https://vercel.com/new");
    expect(view.purpose).toContain("Prepare a deployment settings draft");
    expect(view.allowedActionsLabel).toContain("read");
    expect(view.blockedActionsLabel).toContain("credential_entry");
    expect(view.dataCategoriesLabel).toContain("user_provided_project_context");
    expect(view.approvalLabel).toContain("user_approval_service_page_vercel");
    expect(view.loginBoundaryLabel).toContain("User logs in directly");
    expect(view.finalSubmitBoundaryLabel).toContain("Final submit remains blocked");
    expect(view.finalSubmitBoundaryLabel).toContain("production-mutation contract");
    expect(view.exportControlLabel).toContain("Export retained");
    expect(view.deleteControlLabel).toContain("Delete retained artifacts while leaving audit metadata only");
    expect(view.activityFeedRefs).toContain("setup_step:vercel-deploy-settings");
    expect(view.auditItems.join("\n")).toContain("ServicePagePermissionGranted");
  });

  it("uses a safe not-started state before any external service page-use permission exists", () => {
    const view = servicePageUsePermissionViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.canRevoke).toBe(false);
    expect(view.pageUrl).toContain("No page URL");
    expect(view.loginBoundaryLabel).toContain("User-owned login");
    expect(view.finalSubmitBoundaryLabel).toContain("Final submit remains blocked");
    expect(view.finalSubmitBoundaryLabel).toContain("production-mutation contract");
    expect(view.blockedActionsLabel).toContain("credential/session/secret custody");
  });

  it("keeps requested final submit visibly blocked even with confirmation and authority refs", () => {
    const requestedProjection: ServicePageUsePermissionProjection = {
      ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
      currentStatus: "blocked",
      latestPermission: {
        ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE.latestPermission,
        status: "blocked",
        finalSubmitBoundary: {
          requested: true,
          confirmationCardRef: "confirmation_card_fake",
          executionAuthorityRef: "execution_authority_fake",
          productionMutationPerformed: false
        },
        blockReasons: [
          {
            code: "final_submit_requires_confirmation_and_authority",
            message:
              "Final submit remains blocked until production-mutation contract evidence passes confirmation-card, ExecutionAuthorityRecord, redaction, approval, rollback, audit, and no-secret checks.",
            evidenceRefs: ["service-page:final-submit-request"]
          }
        ]
      }
    };
    const view = servicePageUsePermissionViewModel(requestedProjection);

    expect(view.finalSubmitBoundaryLabel).toContain("confirmation=confirmation_card_fake");
    expect(view.finalSubmitBoundaryLabel).toContain("authority=execution_authority_fake");
    expect(view.finalSubmitBoundaryLabel).toContain("Final submit remains blocked");
    expect(view.finalSubmitBoundaryLabel).toContain("production mutation performed=false");
    expect(view.blockReasonItems).toContain(
      "final_submit_requires_confirmation_and_authority: Final submit remains blocked until production-mutation contract evidence passes confirmation-card, ExecutionAuthorityRecord, redaction, approval, rollback, audit, and no-secret checks."
    );
  });

  it("renders enabled artifact export/delete controls when retained refs are user-controllable", () => {
    const view = servicePageUsePermissionViewModel(SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE);
    const markup = renderEnglishMarkup(
      createElement(ServicePageUsePermissionPanel, {
        permission: view,
        isBusy: false,
        onRefreshPermission: () => undefined,
        onRevokePermission: () => undefined,
        onExportArtifacts: () => undefined,
        onDeleteArtifacts: () => undefined
      })
    );

    expect(markup).toContain("Purpose: Prepare a deployment settings draft");
    expect(markup).toContain("Export retained prompt/result/screenshot/log artifact refs");
    expect(markup).toContain("Delete retained artifacts while leaving audit metadata only");
    expect(markup).not.toContain("disabled=\"\"");
  });

  it("hides artifact refs and controls after durable artifact deletion", () => {
    const deletedProjection = {
      ...SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
      latestPermission: {
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
        }
      }
    } as typeof SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE;
    const view = servicePageUsePermissionViewModel(deletedProjection);

    expect(view.artifactRefs).toEqual([]);
    expect(view.redactionPreviewRef).toBeNull();
    expect(view.exportControlLabel).toBeNull();
    expect(view.deleteControlLabel).toBeNull();
  });
});
