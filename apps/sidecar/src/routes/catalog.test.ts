import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CATALOG,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  isProductApiRoute
} from "@solo-superman/contracts";
import { unmountedProductApiRoutePlaceholders } from "./catalog";

describe("sidecar route catalog", () => {
  it("keeps unmounted product API placeholders aligned with the shared mounted route list", () => {
    const mountedRouteIds = new Set<string>(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS);
    const expectedUnmountedRoutes = API_ROUTE_CATALOG.filter(
      (route) => isProductApiRoute(route) && !mountedRouteIds.has(route.routeId)
    );

    expect(unmountedProductApiRoutePlaceholders).toHaveLength(expectedUnmountedRoutes.length);
    expect(unmountedProductApiRoutePlaceholders.map((route) => route.routeId).sort()).toEqual(
      expectedUnmountedRoutes.map((route) => route.routeId).sort()
    );
  });
});
