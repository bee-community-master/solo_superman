import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CATALOG,
  PR02_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR04_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR05_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PR06_MOUNTED_PRODUCT_API_ROUTE_IDS
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
});
