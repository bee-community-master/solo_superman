import { describe, expect, it } from "vitest";
import { createSidecarApp } from "./server";

const localCapabilityToken = "test-local-capability-token";
const app = createSidecarApp({ localCapabilityToken });

function authHeaders(token = localCapabilityToken) {
  return {
    Authorization: `Bearer ${token}`
  };
}

interface JsonResponseBody {
  readonly error?: {
    readonly code: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
  readonly [key: string]: unknown;
}

async function jsonBody(response: Response) {
  return (await response.json()) as JsonResponseBody;
}

describe("PR-02 sidecar health shell", () => {
  it("serves health without auth before storage or ProductEngine initialization", async () => {
    const response = await app.request("/healthz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      sidecarPhase: "pr_02_health_shell",
      checks: {
        process: "alive"
      }
    });
  });

  it("serves readiness as not-ready until later storage and ProductEngine PRs", async () => {
    const response = await app.request("/readyz");
    const body = await jsonBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "not_ready",
      ready: false,
      code: "SIDECAR_NOT_READY",
      checks: {
        db: "not_initialized_until_pr_03",
        productEngine: "not_initialized_until_pr_04",
        codex: "not_checked_until_pr_07"
      }
    });
  });

  it("rejects non-health API routes without the local capability token", async () => {
    const response = await app.request("/api/v1/projects");
    const body = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED"
      },
      meta: {
        schemaVersion: expect.any(String)
      }
    });
  });

  it("rejects non-health API routes with the wrong local capability token", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: {
        ...authHeaders("wrong-token"),
        "X-Request-Id": "req_wrong_token"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("AUTH_REQUIRED");
    expect(body.meta).toMatchObject({
      requestId: "req_wrong_token",
      schemaVersion: expect.any(String)
    });
    expect(response.headers.get("x-request-id")).toBe("req_wrong_token");
  });

  it("rejects empty app-local capability token configuration", () => {
    expect(() => createSidecarApp({ localCapabilityToken: "   " })).toThrow("localCapabilityToken must not be empty");
  });

  it("answers CORS preflight for the Tauri development WebView before the auth guard", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization, X-Request-Id"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:1420");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-Request-Id");
  });

  it("exposes request ids to the local WebView for correlation", async () => {
    const response = await app.request("/api/v1/commands/cmd_demo/status", {
      headers: {
        ...authHeaders(),
        Origin: "http://127.0.0.1:1420",
        "X-Request-Id": "req_command_status"
      }
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("req_command_status");
    expect(response.headers.get("access-control-expose-headers")).toContain("x-request-id");
  });

  it("does not grant CORS to non-local origins", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization"
      }
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects explicitly non-loopback preflight before CORS handling", async () => {
    const response = await app.request("/api/v1/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:1420",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization",
        "X-Forwarded-For": "203.0.113.10"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body.error?.details?.policy).toBe("loopback_only");
  });

  it("rejects explicitly non-loopback API requests before route handling", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: {
        ...authHeaders(),
        "X-Forwarded-For": "203.0.113.10"
      }
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        details: {
          policy: "loopback_only"
        }
      },
      meta: {
        requestId: expect.any(String),
        schemaVersion: expect.any(String)
      }
    });
  });

  it("mounts the authenticated command-status placeholder without ProductEngine backing", async () => {
    const response = await app.request("/api/v1/commands/cmd_demo/status", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "EFFECT_STATUS_UNAVAILABLE",
        details: {
          commandId: "cmd_demo",
          statusEndpointShape: {
            commandId: "cmd_demo",
            commandStatus: "pending",
            effects: [],
            projectionHints: []
          }
        }
      },
      meta: {
        requestId: expect.any(String),
        schemaVersion: expect.any(String)
      }
    });
  });

  it("keeps other product API routes unimplemented behind the token guard", async () => {
    const response = await app.request("/api/v1/projects", {
      headers: authHeaders()
    });
    const body = await jsonBody(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("RESOURCE_NOT_FOUND");
  });
});
