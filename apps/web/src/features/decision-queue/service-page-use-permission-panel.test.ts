import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE,
  servicePageUsePermissionSummaryForStatus
} from "@solo-superman/contracts";
import {
  ServicePageUsePermissionPanel,
  servicePageUsePermissionViewModel
} from "./ServicePageUsePermissionPanel";

describe("ServicePageUsePermissionPanel view model", () => {
  it("shows the service origin, allowed and blocked actions, login boundary, and artifact controls", () => {
    const view = servicePageUsePermissionViewModel(SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE);

    expect(view.status).toBe("granted");
    expect(view.summary).toBe(servicePageUsePermissionSummaryForStatus("granted"));
    expect(view.serviceLabel).toContain("Vercel");
    expect(view.serviceLabel).toContain("https://vercel.com");
    expect(view.pageUrl).toBe("https://vercel.com/new");
    expect(view.allowedActionsLabel).toContain("read");
    expect(view.blockedActionsLabel).toContain("credential_entry");
    expect(view.dataCategoriesLabel).toContain("user_provided_project_context");
    expect(view.approvalLabel).toContain("user_approval_service_page_vercel");
    expect(view.loginBoundaryLabel).toContain("User logs in directly");
    expect(view.finalSubmitBoundaryLabel).toContain("final submit requires confirmation");
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
    expect(view.finalSubmitBoundaryLabel).toContain("separate confirmation card");
    expect(view.blockedActionsLabel).toContain("credential/session/secret custody");
  });

  it("renders enabled artifact export/delete controls when retained refs are user-controllable", () => {
    const view = servicePageUsePermissionViewModel(SERVICE_PAGE_USE_PERMISSION_READY_PROJECTION_FIXTURE);
    const markup = renderToStaticMarkup(
      createElement(ServicePageUsePermissionPanel, {
        permission: view,
        isBusy: false,
        onRefreshPermission: () => undefined,
        onRevokePermission: () => undefined,
        onExportArtifacts: () => undefined,
        onDeleteArtifacts: () => undefined
      })
    );

    expect(markup).toContain("Export retained prompt/result/screenshot/log artifact refs");
    expect(markup).toContain("Delete retained artifacts while leaving audit metadata only");
    expect(markup).not.toContain("disabled=\"\"");
  });
});
