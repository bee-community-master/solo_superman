import { serve } from "@hono/node-server";
import { createSidecarApp } from "./server";
import { formatSidecarBaseUrl, resolveSidecarConfig } from "./config/sidecar-config";

const config = resolveSidecarConfig();
const app = createSidecarApp();

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
