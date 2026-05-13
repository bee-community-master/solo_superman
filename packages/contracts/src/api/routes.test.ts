import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CATALOG,
  PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR06_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR07_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR08_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR09_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE15A_PR02_ALLOWLIST_ROUTE_IDS,
  PHASE15A_PR03_DISCLOSURE_ROUTE_IDS,
  PHASE15A_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE15A_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE15A_PR05_RESEARCH_RUN_ROUTE_IDS,
  PHASE15A_PR07_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE15A_PR07_RESEARCH_QUEUE_ROUTE_IDS,
  PHASE15B_PR10_HINT_ROUTE_IDS,
  PHASE15B_PR10_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS,
  PHASE2_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE1_QUEUE_RECOVERY_ROUTE_IDS,
  PHASE1_QUEUE_RECOVERY_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE3_PR02_EXECUTION_AUTHORITY_ROUTE_IDS,
  PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE3_PR03_FILE_DIFF_ROUTE_IDS,
  PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE3_PR04_SHELL_COMMAND_ROUTE_IDS,
  PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE3_PR05_BROWSER_ACTION_ROUTE_IDS,
  PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS,
  POST_PHASE3_PR01_MOUNTED_PRODUCT_API_ROUTE_IDS,
  POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS,
  POST_PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  POST_PHASE3_PR03_CHATGPT_DELEGATION_ROUTE_IDS,
  POST_PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
  POST_PHASE3_PR04_CHATGPT_DELEGATION_RUN_ROUTE_IDS,
  POST_PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS
} from "./routes";

const PRODUCT_API_PREFIX = "/api/v1";

describe("API route catalog", () => {
  it("keeps product API routes as compile-time placeholders", () => {
    const productRoutes = API_ROUTE_CATALOG.filter((route) => route.path.startsWith(PRODUCT_API_PREFIX));

    expect(productRoutes.length).toBeGreaterThan(0);
    expect(productRoutes.every((route) => route.implementedInPr01 === false)).toBe(true);
  });

  it("keeps route and client names unique", () => {
    expect(new Set(API_ROUTE_CATALOG.map((route) => route.routeId)).size).toBe(API_ROUTE_CATALOG.length);
    expect(new Set(API_ROUTE_CATALOG.map((route) => route.clientName)).size).toBe(API_ROUTE_CATALOG.length);
  });

  it("preserves docs/26 required query scope for the SSE stream placeholder", () => {
    const streamRoute = API_ROUTE_CATALOG.find((route) => route.routeId === "subscribeEventStream");

    expect(streamRoute).toMatchObject({
      method: "GET",
      path: "/api/v1/events/stream",
      requiredQueryParams: ["sessionId"],
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("keeps PR-02 mounted product route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    for (const routeId of PR02_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps PR-04 mounted product route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PR04_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        "createProject",
        "captureIntake",
        "draftInitialSpec",
        "analyzeAmbiguity",
        "activateQuestionBatch"
      ])
    );

    for (const routeId of PR04_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps PR-05 mounted product route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PR05_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(expect.arrayContaining(["submitAnswer"]));

    for (const routeId of PR05_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps PR-06 research/evidence route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PR06_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining(["planResearch", "getResearchEvidence", "importResearchResult", "synthesizeEvidence"])
    );

    for (const routeId of PR06_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps PR-07 runtime preview route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PR07_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        "getRuntimeStatus",
        "createRuntimePreview",
        "createManualHandoff",
        "convertRuntimeArtifact",
        "blockRuntimeArtifact",
        "getActivity"
      ])
    );

    for (const routeId of PR07_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps PR-08 completeness/founder brief route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PR08_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        "getCompleteness",
        "scoreCompleteness",
        "createCompletionCandidate",
        "getFounderBrief",
        "prepareFounderBriefExport"
      ])
    );

    for (const routeId of PR08_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps PR-09 E2E dry-run route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PR09_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        "listSpecVersions",
        "createSpecUpdatePreview",
        "resolveDecision",
        "createSpecVersion"
      ])
    );

    for (const routeId of PR09_MOUNTED_PRODUCT_API_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1/)
      });
    }
  });

  it("keeps Phase 1.5A PR-02 allowlist governance route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE15A_PR02_ALLOWLIST_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        "listResearchAllowlists",
        "createResearchAllowlist",
        "updateResearchAllowlist",
        "pauseResearchAllowlist",
        "revokeResearchAllowlist"
      ])
    );
    for (const routeId of PHASE15A_PR02_ALLOWLIST_ROUTE_IDS) {
      expect(routeById.get(routeId)).toMatchObject({
        path: expect.stringMatching(/^\/api\/v1\/projects\/:projectId\/research-allowlists/),
        implementedInPr01: false
      });
    }
  });

  it("keeps Phase 1.5A PR-03 disclosure route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE15A_PR03_DISCLOSURE_ROUTE_IDS).toEqual(
      expect.arrayContaining(["prepareResearchDisclosure", "listResearchDisclosures"])
    );
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE15A_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );

    expect(routeById.get("prepareResearchDisclosure")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-disclosures",
      commandType: "PrepareResearchDisclosure",
      implementedInPr01: false
    });
    expect(routeById.get("listResearchDisclosures")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-disclosures",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("keeps Phase 1.5A PR-05 research run control route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE15A_PR05_RESEARCH_RUN_ROUTE_IDS).toEqual(
      expect.arrayContaining([
        "listResearchRuns",
        "startResearchRun",
        "getResearchRunStatus",
        "cancelResearchRun",
        "retryResearchRun"
      ])
    );
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE15A_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );

    expect(routeById.get("listResearchRuns")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-runs",
      commandType: "none",
      implementedInPr01: false
    });
    expect(routeById.get("startResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs",
      commandType: "StartResearchRun",
      implementedInPr01: false
    });
    expect(routeById.get("getResearchRunStatus")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/status",
      commandType: "none",
      implementedInPr01: false
    });
    expect(routeById.get("cancelResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/cancel",
      commandType: "CancelResearchRun",
      implementedInPr01: false
    });
    expect(routeById.get("retryResearchRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/projects/:projectId/research-runs/:researchRunId/retry",
      commandType: "RetryResearchRun",
      implementedInPr01: false
    });
  });

  it("keeps Phase 1.5A PR-07 research-updated queue route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE15A_PR07_RESEARCH_QUEUE_ROUTE_IDS).toEqual(["resolveResearchQueueCard"]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE15A_PR07_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("resolveResearchQueueCard")).toMatchObject({
      method: "POST",
      path: "/api/v1/research-cards/:cardId/resolve",
      commandType: "ResolveResearchQueueCard",
      implementedInPr01: false
    });
  });

  it("keeps Phase 1.5B PR-10 hint query/export route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE15B_PR10_HINT_ROUTE_IDS).toEqual([
      "listPhase15bUpgradeHints",
      "exportPhase15bUpgradeHints"
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE15B_PR10_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("listPhase15bUpgradeHints")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/phase15b-upgrade-hints",
      commandType: "none",
      implementedInPr01: false
    });
    expect(routeById.get("exportPhase15bUpgradeHints")).toMatchObject({
      method: "GET",
      path: "/api/v1/projects/:projectId/phase15b-upgrade-hints/export",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("keeps Phase 2 PR-04 Planning Handoff route ids aligned with the catalog", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS).toEqual([
      "createPlanningHandoff",
      "getPlanningHandoff"
    ]);
    expect(PHASE2_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE15B_PR10_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE2_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("createPlanningHandoff")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/planning-handoff",
      commandType: "CreatePlanningHandoff",
      implementedInPr01: false
    });
    expect(routeById.get("getPlanningHandoff")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/planning-handoff",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("mounts the Phase 1 Decision Queue SSE/refetch recovery route after the Phase 2 baseline", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE1_QUEUE_RECOVERY_ROUTE_IDS).toEqual(["subscribeEventStream"]);
    expect(PHASE1_QUEUE_RECOVERY_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE2_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...PHASE1_QUEUE_RECOVERY_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE1_QUEUE_RECOVERY_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("subscribeEventStream")).toMatchObject({
      method: "GET",
      path: "/api/v1/events/stream",
      requiredQueryParams: ["sessionId"],
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("mounts the Phase 3 PR-02 execution authority API boundary after the SSE baseline", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE3_PR02_EXECUTION_AUTHORITY_ROUTE_IDS).toEqual([
      "createExecutionAuthority",
      "getExecutionAuthority",
      "validateExecutionAuthorityPreflight"
    ]);
    expect(PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE1_QUEUE_RECOVERY_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...PHASE3_PR02_EXECUTION_AUTHORITY_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("createExecutionAuthority")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/execution-authority",
      commandType: "CreateExecutionAuthority",
      implementedInPr01: false
    });
    expect(routeById.get("getExecutionAuthority")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/execution-authority",
      commandType: "none",
      implementedInPr01: false
    });
    expect(routeById.get("validateExecutionAuthorityPreflight")).toMatchObject({
      method: "POST",
      path: "/api/v1/execution-authorities/:authorityRecordId/preflight",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("mounts the Phase 3 PR-03 file_diff controlled adapter after authority preflight", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE3_PR03_FILE_DIFF_ROUTE_IDS).toEqual(["executeFileDiff"]);
    expect(PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...PHASE3_PR03_FILE_DIFF_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("executeFileDiff")).toMatchObject({
      method: "POST",
      path: "/api/v1/execution-authorities/:authorityRecordId/file-diff",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("mounts the Phase 3 PR-04 shell_command controlled adapter after file_diff", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE3_PR04_SHELL_COMMAND_ROUTE_IDS).toEqual(["executeShellCommand"]);
    expect(PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...PHASE3_PR04_SHELL_COMMAND_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("executeShellCommand")).toMatchObject({
      method: "POST",
      path: "/api/v1/execution-authorities/:authorityRecordId/shell-command",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("mounts the Phase 3 PR-05 browser_action controlled adapter after shell_command", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(PHASE3_PR05_BROWSER_ACTION_ROUTE_IDS).toEqual(["executeBrowserAction"]);
    expect(PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...PHASE3_PR05_BROWSER_ACTION_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("executeBrowserAction")).toMatchObject({
      method: "POST",
      path: "/api/v1/execution-authorities/:authorityRecordId/browser-action",
      commandType: "none",
      implementedInPr01: false
    });
  });

  it("mounts the Post-Phase3 PR-01 project-purpose mode command after Phase 3", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS).toEqual(["changeProjectPurposeMode"]);
    expect(POST_PHASE3_PR01_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...PHASE3_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...POST_PHASE3_PR01_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("changeProjectPurposeMode")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/project-purpose-mode",
      commandType: "ChangeProjectPurposeMode",
      implementedInPr01: false
    });
  });

  it("mounts the Post-Phase3 PR-02 business critic routes after project purpose mode", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS).toEqual([
      "changeBusinessCriticIntensity",
      "deferQueueItem",
      "dismissQueueItem"
    ]);
    expect(POST_PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...POST_PHASE3_PR01_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(
      expect.arrayContaining([...POST_PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS])
    );
    expect(routeById.get("changeBusinessCriticIntensity")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/business-critic-intensity",
      commandType: "ChangeBusinessCriticIntensity",
      implementedInPr01: false
    });
    expect(routeById.get("deferQueueItem")).toMatchObject({
      method: "POST",
      path: "/api/v1/queue-items/:queueItemId/defer",
      commandType: "DeferQueueItem",
      implementedInPr01: false
    });
    expect(routeById.get("dismissQueueItem")).toMatchObject({
      method: "POST",
      path: "/api/v1/queue-items/:queueItemId/dismiss",
      commandType: "DismissQueueItem",
      implementedInPr01: false
    });
  });

  it("mounts the Post-Phase3 PR-04 ChatGPT delegation run/revoke routes after business critic gates", () => {
    const routeById = new Map(API_ROUTE_CATALOG.map((route) => [route.routeId, route]));

    expect(POST_PHASE3_PR03_CHATGPT_DELEGATION_ROUTE_IDS).toEqual([
      "createChatGptBrowserDelegationRun",
      "getChatGptBrowserDelegationRuns"
    ]);
    expect(POST_PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...POST_PHASE3_PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...POST_PHASE3_PR03_CHATGPT_DELEGATION_ROUTE_IDS
    ]);
    expect(POST_PHASE3_PR04_CHATGPT_DELEGATION_RUN_ROUTE_IDS).toEqual(["revokeChatGptBrowserDelegationRun"]);
    expect(POST_PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual([
      ...POST_PHASE3_PR03_MOUNTED_PRODUCT_API_ROUTE_IDS,
      ...POST_PHASE3_PR04_CHATGPT_DELEGATION_RUN_ROUTE_IDS
    ]);
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toEqual(POST_PHASE3_PR04_MOUNTED_PRODUCT_API_ROUTE_IDS);
    expect(routeById.get("createChatGptBrowserDelegationRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations",
      commandType: "CreateChatGptBrowserDelegationRun",
      implementedInPr01: false
    });
    expect(routeById.get("getChatGptBrowserDelegationRuns")).toMatchObject({
      method: "GET",
      path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations",
      commandType: "none",
      implementedInPr01: false
    });
    expect(routeById.get("revokeChatGptBrowserDelegationRun")).toMatchObject({
      method: "POST",
      path: "/api/v1/sessions/:sessionId/chatgpt-browser-delegations/:runId/revoke",
      commandType: "RevokeChatGptBrowserDelegationRun",
      implementedInPr01: false
    });
  });
});
