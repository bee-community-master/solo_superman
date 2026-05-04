import { Hono } from "hono";
import { CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
import { productApiRoutePlaceholders } from "./routes/catalog";

export function createSidecarApp() {
  const app = new Hono();

  app.get("/healthz", (context) =>
    context.json({
      status: "ok",
      service: "solo-superman-sidecar",
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      productBehavior: "not_implemented_in_pr_01",
      productApiRoutesMounted: false,
      productApiRoutePlaceholderCount: productApiRoutePlaceholders.length
    })
  );

  app.get("/readyz", (context) =>
    context.json({
      status: "scaffold",
      ready: false,
      checks: {
        db: "not_implemented_in_pr_01",
        productEngine: "not_implemented_in_pr_01",
        codex: "not_implemented_in_pr_01"
      },
      productApiRoutesMounted: false
    })
  );

  return app;
}

export type SidecarApp = ReturnType<typeof createSidecarApp>;
