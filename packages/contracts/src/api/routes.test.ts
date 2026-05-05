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
    expect(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS).toBe(PHASE15A_PR05_MOUNTED_PRODUCT_API_ROUTE_IDS);

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
});
