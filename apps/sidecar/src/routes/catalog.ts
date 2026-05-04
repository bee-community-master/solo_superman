import { API_ROUTE_CATALOG } from "@solo-superman/contracts";

export const productApiRoutePlaceholders = API_ROUTE_CATALOG.filter((route) =>
  route.path.startsWith("/api/v1")
);
