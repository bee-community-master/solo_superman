import {
  API_ROUTE_CATALOG,
  CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS,
  PHASE15A_PR02_ALLOWLIST_ROUTE_IDS,
  PHASE15A_PR03_DISCLOSURE_ROUTE_IDS,
  PHASE15A_PR05_RESEARCH_RUN_ROUTE_IDS,
  PHASE15B_PR10_HINT_ROUTE_IDS,
  PHASE1_QUEUE_RECOVERY_ROUTE_IDS,
  PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS,
  POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS,
  POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS,
  type ApiRoute
} from "@solo-superman/contracts";

type ProductApiRoute = Extract<ApiRoute, { readonly path: `/api/v1${string}` }>;
type WebRouteClientImplementation =
  | "not_mounted_yet"
  | "mounted_pr_09"
  | "mounted_phase_1_5a_pr_02"
  | "mounted_phase_1_5a_pr_03"
  | "mounted_phase_1_5a_pr_05"
  | "mounted_phase_1_5b_pr_10"
  | "mounted_phase_1_queue_recovery"
  | "mounted_phase_2_pr_04"
  | "mounted_post_phase3_pr_01"
  | "mounted_post_phase3_pr_02";
const CURRENT_MOUNTED_PRODUCT_API_ROUTE_ID_SET = new Set<string>(CURRENT_MOUNTED_PRODUCT_API_ROUTE_IDS);
const PHASE15A_PR02_ALLOWLIST_ROUTE_ID_SET = new Set<string>(PHASE15A_PR02_ALLOWLIST_ROUTE_IDS);
const PHASE15A_PR03_DISCLOSURE_ROUTE_ID_SET = new Set<string>(PHASE15A_PR03_DISCLOSURE_ROUTE_IDS);
const PHASE15A_PR05_RESEARCH_RUN_ROUTE_ID_SET = new Set<string>(PHASE15A_PR05_RESEARCH_RUN_ROUTE_IDS);
const PHASE15B_PR10_HINT_ROUTE_ID_SET = new Set<string>(PHASE15B_PR10_HINT_ROUTE_IDS);
const PHASE1_QUEUE_RECOVERY_ROUTE_ID_SET = new Set<string>(PHASE1_QUEUE_RECOVERY_ROUTE_IDS);
const PHASE2_PR04_PLANNING_HANDOFF_ROUTE_ID_SET = new Set<string>(PHASE2_PR04_PLANNING_HANDOFF_ROUTE_IDS);
const POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_ID_SET = new Set<string>(POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_IDS);
const POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_ID_SET = new Set<string>(POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_IDS);

export interface WebRouteClientPlaceholder {
  readonly clientName: ProductApiRoute["clientName"];
  readonly method: ProductApiRoute["method"];
  readonly path: ProductApiRoute["path"];
  readonly requiredQueryParams: readonly string[];
  readonly implementation: WebRouteClientImplementation;
}

function isProductApiRoute(route: ApiRoute): route is ProductApiRoute {
  return route.path.startsWith("/api/v1");
}

function implementationStatus(route: ProductApiRoute): WebRouteClientImplementation {
  if (!CURRENT_MOUNTED_PRODUCT_API_ROUTE_ID_SET.has(route.routeId)) {
    return "not_mounted_yet";
  }

  if (PHASE15A_PR03_DISCLOSURE_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_phase_1_5a_pr_03";
  }

  if (PHASE15A_PR05_RESEARCH_RUN_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_phase_1_5a_pr_05";
  }

  if (PHASE15B_PR10_HINT_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_phase_1_5b_pr_10";
  }

  if (PHASE2_PR04_PLANNING_HANDOFF_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_phase_2_pr_04";
  }

  if (POST_PHASE3_PR02_BUSINESS_CRITIC_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_post_phase3_pr_02";
  }

  if (POST_PHASE3_PR01_PROJECT_PURPOSE_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_post_phase3_pr_01";
  }

  if (PHASE1_QUEUE_RECOVERY_ROUTE_ID_SET.has(route.routeId)) {
    return "mounted_phase_1_queue_recovery";
  }

  return PHASE15A_PR02_ALLOWLIST_ROUTE_ID_SET.has(route.routeId)
    ? "mounted_phase_1_5a_pr_02"
    : "mounted_pr_09";
}

export const webRouteClientPlaceholders: readonly WebRouteClientPlaceholder[] = API_ROUTE_CATALOG.filter(isProductApiRoute).map((route) => ({
  clientName: route.clientName,
  method: route.method,
  path: route.path,
  requiredQueryParams: "requiredQueryParams" in route ? route.requiredQueryParams : [],
  implementation: implementationStatus(route)
}));

export function findWebRouteClientPlaceholder(clientName: ProductApiRoute["clientName"]) {
  return webRouteClientPlaceholders.find((route) => route.clientName === clientName) ?? null;
}
