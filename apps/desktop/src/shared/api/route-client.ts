import { API_ROUTE_CATALOG, type ApiRouteDefinition } from "@solo-superman/contracts";

export interface DesktopRouteClientPlaceholder {
  readonly clientName: ApiRouteDefinition["clientName"];
  readonly method: ApiRouteDefinition["method"];
  readonly path: ApiRouteDefinition["path"];
  readonly implementation: "not_mounted_in_pr_01";
}

export const desktopRouteClientPlaceholders: readonly DesktopRouteClientPlaceholder[] = API_ROUTE_CATALOG.filter(
  (route) => route.path.startsWith("/api/v1")
).map((route) => ({
  clientName: route.clientName,
  method: route.method,
  path: route.path,
  implementation: "not_mounted_in_pr_01"
}));

export function findDesktopRouteClientPlaceholder(clientName: ApiRouteDefinition["clientName"]) {
  return desktopRouteClientPlaceholders.find((route) => route.clientName === clientName) ?? null;
}
