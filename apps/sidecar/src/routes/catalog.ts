import {
  API_ROUTE_CATALOG,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  isProductApiRoute
} from "@solo-superman/contracts";

const mountedProductApiRouteIds = new Set<string>(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS);

export const unmountedProductApiRoutePlaceholders = API_ROUTE_CATALOG.filter(
  (route) => isProductApiRoute(route) && !mountedProductApiRouteIds.has(route.routeId)
);
