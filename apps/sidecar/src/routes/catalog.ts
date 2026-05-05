import { API_ROUTE_CATALOG, CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS } from "@solo-superman/contracts";

const mountedProductApiRouteIds = new Set<string>(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS);

export const unmountedProductApiRoutePlaceholders = API_ROUTE_CATALOG.filter(
  (route) => route.path.startsWith("/api/v1") && !mountedProductApiRouteIds.has(route.routeId)
);
