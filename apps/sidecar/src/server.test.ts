import { describe, expect, it } from "vitest";
import { createSidecarApp } from "./server";

const app = createSidecarApp();

describe("PR-01 sidecar scaffold", () => {
  it("serves health without product behavior", async () => {
    const response = await app.request("/healthz");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      productBehavior: "not_implemented_in_pr_01",
      productApiRoutesMounted: false
    });
  });

  it("serves readiness as scaffold-not-ready", async () => {
    const response = await app.request("/readyz");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "scaffold",
      ready: false,
      checks: {
        db: "not_implemented_in_pr_01",
        productEngine: "not_implemented_in_pr_01",
        codex: "not_implemented_in_pr_01"
      }
    });
  });

  it("does not mount product API route handlers in PR-01", async () => {
    const response = await app.request("/api/v1/projects");

    expect(response.status).toBe(404);
  });
});
