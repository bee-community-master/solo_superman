import { describe, expect, it } from "vitest";
import { API_ROUTE_CATALOG } from "./routes";

const PRODUCT_API_PREFIX = "/api/v1";

describe("PR-01 API route catalog", () => {
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
});
