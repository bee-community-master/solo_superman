import { describe, expect, it } from "vitest";
import { API_ROUTE_CATALOG } from "./routes";

const PRODUCT_API_PREFIX = "/api/v1";

describe("PR-01 API route catalog", () => {
  it("keeps product API routes as compile-time placeholders", () => {
    const productRoutes = API_ROUTE_CATALOG.filter((route) => route.path.startsWith(PRODUCT_API_PREFIX));

    expect(productRoutes.length).toBeGreaterThan(0);
    expect(productRoutes.every((route) => route.implementedInPr01 === false)).toBe(true);
  });
});
