import { API_ROUTE_CATALOG, type ApiRoute } from "@solo-superman/contracts";

type ProductApiRoute = Extract<ApiRoute, { readonly path: `/api/v1${string}` }>;

export interface DesktopRouteClientPlaceholder {
  readonly clientName: ProductApiRoute["clientName"];
  readonly method: ProductApiRoute["method"];
  readonly path: ProductApiRoute["path"];
  readonly requiredQueryParams: readonly string[];
  readonly implementation: "not_mounted_in_pr_01";
}

function isProductApiRoute(route: ApiRoute): route is ProductApiRoute {
  return route.path.startsWith("/api/v1");
}

export const desktopRouteClientPlaceholders: readonly DesktopRouteClientPlaceholder[] = API_ROUTE_CATALOG.filter(isProductApiRoute).map((route) => ({
  clientName: route.clientName,
  method: route.method,
  path: route.path,
  requiredQueryParams: "requiredQueryParams" in route ? route.requiredQueryParams : [],
  implementation: "not_mounted_in_pr_01"
}));

export function findDesktopRouteClientPlaceholder(clientName: ProductApiRoute["clientName"]) {
  return desktopRouteClientPlaceholders.find((route) => route.clientName === clientName) ?? null;
}
