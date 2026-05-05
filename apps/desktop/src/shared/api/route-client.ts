import {
  API_ROUTE_CATALOG,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE15A_PR02_ALLOWLIST_ROUTE_IDS,
  PHASE15A_PR03_DISCLOSURE_ROUTE_IDS,
  type ApiRoute
} from "@solo-superman/contracts";

type ProductApiRoute = Extract<ApiRoute, { readonly path: `/api/v1${string}` }>;
type DesktopRouteClientImplementation =
  | "not_mounted_yet"
  | "mounted_pr_09"
  | "mounted_phase_1_5a_pr_02"
  | "mounted_phase_1_5a_pr_03";
const CURRENT_MOUNTED_PRODUCT_API_ROUTE_ID_SET = new Set<string>(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS);
const PHASE15A_PR02_ALLOWLIST_ROUTE_ID_SET = new Set<string>(PHASE15A_PR02_ALLOWLIST_ROUTE_IDS);
const PHASE15A_PR03_DISCLOSURE_ROUTE_ID_SET = new Set<string>(PHASE15A_PR03_DISCLOSURE_ROUTE_IDS);

export interface DesktopRouteClientPlaceholder {
  readonly clientName: ProductApiRoute["clientName"];
  readonly method: ProductApiRoute["method"];
  readonly path: ProductApiRoute["path"];
  readonly requiredQueryParams: readonly string[];
  readonly implementation: DesktopRouteClientImplementation;
}

function isProductApiRoute(route: ApiRoute): route is ProductApiRoute {
  return route.path.startsWith("/api/v1");
}

function implementationStatus(route: ProductApiRoute): DesktopRouteClientImplementation {
  if (!CURRENT_MOUNTED_PRODUCT_API_ROUTE_ID_SET.has(route.routeId)) {
    return "not_mounted_yet";
  }

  if (PHASE15A_PR03_DISCLOSURE_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_phase_1_5a_pr_03";
  }

  return PHASE15A_PR02_ALLOWLIST_ROUTE_ID_SET.has(route.routeId)
    ? "mounted_phase_1_5a_pr_02"
    : "mounted_pr_09";
}

export const desktopRouteClientPlaceholders: readonly DesktopRouteClientPlaceholder[] = API_ROUTE_CATALOG.filter(isProductApiRoute).map((route) => ({
  clientName: route.clientName,
  method: route.method,
  path: route.path,
  requiredQueryParams: "requiredQueryParams" in route ? route.requiredQueryParams : [],
  implementation: implementationStatus(route)
}));

export function findDesktopRouteClientPlaceholder(clientName: ProductApiRoute["clientName"]) {
  return desktopRouteClientPlaceholders.find((route) => route.clientName === clientName) ?? null;
}
