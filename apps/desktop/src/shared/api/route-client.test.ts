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

  it("marks Phase 1.5A allowlist governance routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("listResearchAllowlists")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-allowlists",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findDesktopRouteClientPlaceholder("createResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findDesktopRouteClientPlaceholder("updateResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findDesktopRouteClientPlaceholder("pauseResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId/pause",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findDesktopRouteClientPlaceholder("revokeResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId/revoke",
      implementation: "mounted_phase_1_5a_pr_02"
    });
  });

  it("marks Phase 1.5A disclosure routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("prepareResearchDisclosure")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-disclosures",
      implementation: "mounted_phase_1_5a_pr_03"
    });

    expect(findDesktopRouteClientPlaceholder("listResearchDisclosures")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-disclosures",
      implementation: "mounted_phase_1_5a_pr_03"
    });
  });

  it("marks Phase 1.5A research run control routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("listResearchRuns")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-runs",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findDesktopRouteClientPlaceholder("startResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findDesktopRouteClientPlaceholder("getResearchRunStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/status",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findDesktopRouteClientPlaceholder("cancelResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/cancel",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findDesktopRouteClientPlaceholder("retryResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/retry",
      implementation: "mounted_phase_1_5a_pr_05"
    });
  });

  it("marks Phase 1.5B hint query/export routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("listPhase15bUpgradeHints")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/phase15b-upgrade-hints",
      implementation: "mounted_phase_1_5b_pr_10"
    });

    expect(findDesktopRouteClientPlaceholder("exportPhase15bUpgradeHints")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/phase15b-upgrade-hints/export",
      implementation: "mounted_phase_1_5b_pr_10"
    });
  });

  it("marks Phase 2 Planning Handoff routes as mounted in the sidecar", () => {
    expect(findDesktopRouteClientPlaceholder("createPlanningHandoff")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/planning-handoff",
      implementation: "mounted_phase_2_pr_04"
    });

    expect(findDesktopRouteClientPlaceholder("getPlanningHandoff")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/planning-handoff",
      implementation: "mounted_phase_2_pr_04"
    });
  });
});
