import { describe, expect, it } from "vitest";
import { findDesktopRouteClientPlaceholder } from "./route-client";

describe("PR-05 desktop route client catalog", () => {
  it("marks Decision Queue shell routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("getCommandStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/commands/:commandId/status",
      implementation: "mounted_pr_05"
    });

    expect(findDesktopRouteClientPlaceholder("submitAnswer")).toMatchObject({
      method: "POST",
      path: "/api/v1/questions/:questionId/answers",
      implementation: "mounted_pr_05"
    });

    expect(findDesktopRouteClientPlaceholder("getRuntimeStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/runtime/status",
      implementation: "not_mounted_yet"
    });
  });
});
