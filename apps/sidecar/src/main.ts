import { serve } from "@hono/node-server";
import { createSidecarApp } from "./server";
import { resolveSidecarConfig } from "./config/sidecar-config";

const config = resolveSidecarConfig();
const app = createSidecarApp();

const server = serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port
});

const address = server.address();
const actualPort = typeof address === "object" && address ? address.port : config.port;
const baseUrl = `http://${config.host}:${actualPort}`;

console.log(JSON.stringify({ type: "sidecar-ready", baseUrl, pid: process.pid }));
