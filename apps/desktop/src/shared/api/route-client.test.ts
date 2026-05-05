import { describe, expect, it } from "vitest";
import { findDesktopRouteClientPlaceholder } from "./route-client";

describe("PR-09 desktop route client catalog", () => {
  it("marks Decision Queue, research, runtime preview, completion, and spec approval routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("getCommandStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/commands/:commandId/status",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("submitAnswer")).toMatchObject({
      method: "POST",
      path: "/api/v1/questions/:questionId/answers",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("importResearchResult")).toMatchObject({
      method: "POST",
      path: "/api/v1/research-tasks/:researchTaskId/results",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("getRuntimeStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/runtime/status",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("createManualHandoff")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/manual-handoff",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("convertRuntimeArtifact")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/artifacts/:artifactId/convert",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("blockRuntimeArtifact")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/artifacts/:artifactId/block",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("scoreCompleteness")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/completeness/score",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("getCompleteness")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/completeness",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("prepareFounderBriefExport")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/founder-brief/export",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("createSpecUpdatePreview")).toMatchObject({
      method: "POST",
      path: "/api/v1/spec-updates",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("resolveDecision")).toMatchObject({
      method: "POST",
      path: "/api/v1/decisions/:decisionId/resolve",
      implementation: "mounted_pr_09"
    });

    expect(findDesktopRouteClientPlaceholder("createSpecVersion")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/spec/versions",
      implementation: "mounted_pr_09"
    });
  });
});
