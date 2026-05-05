import { describe, expect, it } from "vitest";
import { findDesktopRouteClientPlaceholder } from "./route-client";

describe("PR-08 desktop route client catalog", () => {
  it("marks Decision Queue, research, runtime preview, and completion routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("getCommandStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/commands/:commandId/status",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("submitAnswer")).toMatchObject({
      method: "POST",
      path: "/api/v1/questions/:questionId/answers",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("importResearchResult")).toMatchObject({
      method: "POST",
      path: "/api/v1/research-tasks/:researchTaskId/results",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("getRuntimeStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/runtime/status",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("createManualHandoff")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/manual-handoff",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("convertRuntimeArtifact")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/artifacts/:artifactId/convert",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("blockRuntimeArtifact")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/artifacts/:artifactId/block",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("scoreCompleteness")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/completeness/score",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("getCompleteness")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/completeness",
      implementation: "mounted_pr_08"
    });

    expect(findDesktopRouteClientPlaceholder("prepareFounderBriefExport")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/founder-brief/export",
      implementation: "mounted_pr_08"
    });
  });
});
