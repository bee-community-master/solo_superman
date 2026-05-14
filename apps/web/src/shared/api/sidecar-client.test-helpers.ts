import type { SidecarConnection } from "./sidecar-client";

export const connection: SidecarConnection = {
  baseUrl: "http://127.0.0.1:43110",
  localCapabilityToken: "test-token",
  mode: "vite_env",
  status: "discovered",
  tokenSource: "vite_env"
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
