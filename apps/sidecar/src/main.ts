import { serve } from "@hono/node-server";
import { createSidecarApp } from "./server";
import { formatSidecarBaseUrl, resolveSidecarConfig } from "./config/sidecar-config";
import { initializeStorageReadiness } from "./storage/storage-readiness";

const config = resolveSidecarConfig();
console.log(JSON.stringify({
  type: "sidecar-starting",
  host: config.host,
  port: config.port,
  hasLocalCapabilityToken: config.localCapabilityToken.length > 0,
  databaseConfigured: Boolean(config.databaseUrl),
  appDataDir: config.appDataDir,
  pid: process.pid
}));
const storageReadiness = await initializeStorageReadiness(config);
console.log(JSON.stringify({
  type: "sidecar-storage-readiness",
  state: storageReadiness.migrationStatus.state,
  appliedMigrationCount: storageReadiness.migrationStatus.appliedMigrationCount,
  hasStorage: Boolean(storageReadiness.storage),
  pid: process.pid
}));
const app = createSidecarApp({
  localCapabilityToken: config.localCapabilityToken,
  migrationStatus: storageReadiness.migrationStatus,
  storage: storageReadiness.storage
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
