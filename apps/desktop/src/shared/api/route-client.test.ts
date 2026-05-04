import { describe, expect, it } from "vitest";
import { findDesktopRouteClientPlaceholder } from "./route-client";

describe("PR-02 desktop route client placeholders", () => {
  it("marks only the command status endpoint as mounted in the sidecar placeholder shell", () => {
    expect(findDesktopRouteClientPlaceholder("getCommandStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/commands/:commandId/status",
      implementation: "mounted_placeholder_pr_02"
    });

    expect(findDesktopRouteClientPlaceholder("listProjects")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects",
      implementation: "not_mounted_yet"
    });
  });
});
