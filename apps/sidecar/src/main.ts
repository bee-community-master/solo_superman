import { serve } from "@hono/node-server";
import { createSidecarApp } from "./server";
import { formatSidecarBaseUrl, resolveSidecarConfig } from "./config/sidecar-config";
import { initializeStorageReadiness } from "./storage/storage-readiness";

const config = resolveSidecarConfig();
const storageReadiness = await initializeStorageReadiness(config);
const app = createSidecarApp({
  localCapabilityToken: config.localCapabilityToken,
  migrationStatus: storageReadiness.migrationStatus
});

serve(
  {
    fetch: app.fetch,
    hostname: config.host,
    port: config.port
  },
  (address) => {
    const baseUrl = formatSidecarBaseUrl({ host: config.host, port: address.port });

    console.log(JSON.stringify({ type: "sidecar-ready", baseUrl, pid: process.pid }));
  }
);
