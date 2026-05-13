import { describe, expect, it } from "vitest";
import { findWebRouteClientPlaceholder } from "./route-client";

describe("PR-09 web route client catalog", () => {
  it("marks Decision Queue, research, runtime preview, completion, and spec approval routes as mounted in the sidecar", () => {
    expect(findWebRouteClientPlaceholder("getCommandStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/commands/:commandId/status",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("submitAnswer")).toMatchObject({
      method: "POST",
      path: "/api/v1/questions/:questionId/answers",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("importResearchResult")).toMatchObject({
      method: "POST",
      path: "/api/v1/research-tasks/:researchTaskId/results",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("getRuntimeStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/runtime/status",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("createManualHandoff")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/manual-handoff",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("convertRuntimeArtifact")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/artifacts/:artifactId/convert",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("blockRuntimeArtifact")).toMatchObject({
      method: "POST",
      path: "/api/v1/runtime/artifacts/:artifactId/block",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("scoreCompleteness")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/completeness/score",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("getCompleteness")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/completeness",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("prepareFounderBriefExport")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/founder-brief/export",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("createSpecUpdatePreview")).toMatchObject({
      method: "POST",
      path: "/api/v1/spec-updates",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("resolveDecision")).toMatchObject({
      method: "POST",
      path: "/api/v1/decisions/:decisionId/resolve",
      implementation: "mounted_pr_09"
    });

    expect(findWebRouteClientPlaceholder("createSpecVersion")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/spec/versions",
      implementation: "mounted_pr_09"
    });
  });

  it("marks Phase 1.5A allowlist governance routes as mounted in the sidecar", () => {
    expect(findWebRouteClientPlaceholder("listResearchAllowlists")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-allowlists",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findWebRouteClientPlaceholder("createResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findWebRouteClientPlaceholder("updateResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findWebRouteClientPlaceholder("pauseResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId/pause",
      implementation: "mounted_phase_1_5a_pr_02"
    });

    expect(findWebRouteClientPlaceholder("revokeResearchAllowlist")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-allowlists/:allowlistId/revoke",
      implementation: "mounted_phase_1_5a_pr_02"
    });
  });

  it("marks Phase 1.5A disclosure routes as mounted in the sidecar", () => {
    expect(findWebRouteClientPlaceholder("prepareResearchDisclosure")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-disclosures",
      implementation: "mounted_phase_1_5a_pr_03"
    });

    expect(findWebRouteClientPlaceholder("listResearchDisclosures")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-disclosures",
      implementation: "mounted_phase_1_5a_pr_03"
    });
  });

  it("marks Phase 1.5A research run control routes as mounted in the sidecar", () => {
    expect(findWebRouteClientPlaceholder("listResearchRuns")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-runs",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findWebRouteClientPlaceholder("startResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findWebRouteClientPlaceholder("getResearchRunStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/status",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findWebRouteClientPlaceholder("cancelResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/cancel",
      implementation: "mounted_phase_1_5a_pr_05"
    });

    expect(findWebRouteClientPlaceholder("retryResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/retry",
      implementation: "mounted_phase_1_5a_pr_05"
    });
  });

  it("marks Phase 1.5B hint query/export routes as mounted in the sidecar", () => {
    expect(findWebRouteClientPlaceholder("listPhase15bUpgradeHints")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/phase15b-upgrade-hints",
      implementation: "mounted_phase_1_5b_pr_10"
    });

    expect(findWebRouteClientPlaceholder("exportPhase15bUpgradeHints")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/phase15b-upgrade-hints/export",
      implementation: "mounted_phase_1_5b_pr_10"
    });
  });

  it("marks Phase 2 Planning Handoff routes as mounted in the sidecar", () => {
    expect(findWebRouteClientPlaceholder("createPlanningHandoff")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/planning-handoff",
      implementation: "mounted_phase_2_pr_04"
    });

    expect(findWebRouteClientPlaceholder("getPlanningHandoff")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/planning-handoff",
      implementation: "mounted_phase_2_pr_04"
    });
  });

  it("marks the Post-Phase3 PR-01 project purpose route with its own mounted lane", () => {
    expect(findWebRouteClientPlaceholder("changeProjectPurposeMode")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/project-purpose-mode",
      implementation: "mounted_post_phase3_pr_01"
    });
  });

  it("marks the Post-Phase3 PR-02 business critic routes with their own mounted lane", () => {
    expect(findWebRouteClientPlaceholder("changeBusinessCriticIntensity")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/business-critic-intensity",
      implementation: "mounted_post_phase3_pr_02"
    });
    expect(findWebRouteClientPlaceholder("deferQueueItem")).toMatchObject({
      method: "POST",
      path: "/api/v1/queue-items/:queueItemId/defer",
      implementation: "mounted_post_phase3_pr_02"
    });
    expect(findWebRouteClientPlaceholder("dismissQueueItem")).toMatchObject({
      method: "POST",
      path: "/api/v1/queue-items/:queueItemId/dismiss",
      implementation: "mounted_post_phase3_pr_02"
    });
  });

  it("keeps Post-Phase3 PR-03 ChatGPT delegation routes distinct from the PR-04 revoke route", () => {
    expect(findWebRouteClientPlaceholder("createChatGptBrowserDelegationRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations",
      implementation: "mounted_post_phase3_pr_03"
    });
    expect(findWebRouteClientPlaceholder("getChatGptBrowserDelegationRuns")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations",
      implementation: "mounted_post_phase3_pr_03"
    });
    expect(findWebRouteClientPlaceholder("revokeChatGptBrowserDelegationRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations/:runId/revoke",
      implementation: "mounted_post_phase3_pr_04"
    });
  });

  it("marks Post-Phase3 PR-05 service page-use permission routes with their own mounted lane", () => {
    expect(findWebRouteClientPlaceholder("createServicePageUsePermission")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/service-page-use-permissions",
      implementation: "mounted_post_phase3_pr_05"
    });
    expect(findWebRouteClientPlaceholder("getServicePageUsePermissions")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/service-page-use-permissions",
      implementation: "mounted_post_phase3_pr_05"
    });
    expect(findWebRouteClientPlaceholder("revokeServicePageUsePermission")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/service-page-use-permissions/:permissionId/revoke",
      implementation: "mounted_post_phase3_pr_05"
    });
  });

  it("marks the Decision Queue SSE notification stream as mounted for refetch recovery", () => {
    expect(findWebRouteClientPlaceholder("subscribeEventStream")).toMatchObject({
      method: "GET",
      path: "/api/v1/events/stream",
      requiredQueryParams: ["sessionId"],
      implementation: "mounted_phase_1_queue_recovery"
    });
  });
});
