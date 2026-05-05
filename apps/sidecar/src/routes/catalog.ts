import { API_ROUTE_CATALOG, PR09_MOUNTED_PRODUCT_API_ROUTE_IDS } from "@solo-superman/contracts";

const mountedProductApiRouteIds = new Set<string>(PR09_MOUNTED_PRODUCT_API_ROUTE_IDS);

export const unmountedProductApiRoutePlaceholders = API_ROUTE_CATALOG.filter(
  (route) => route.path.startsWith("/api/v1") && !mountedProductApiRouteIds.has(route.routeId)
);
