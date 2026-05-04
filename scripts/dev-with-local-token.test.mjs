import { describe, expect, it } from "vitest";
import { createDevEnvironment, resolveLocalCapabilityToken } from "./dev-with-local-token.mjs";

describe("PR-02 dev local capability token launcher", () => {
  it("preserves an explicitly shared token for both desktop and sidecar dev processes", () => {
    const env = createDevEnvironment({
      PATH: "/usr/bin",
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token"
    });

    expect(env.SOLO_LOCAL_CAPABILITY_TOKEN).toBe("shared-dev-token");
    expect(env.VITE_SOLO_LOCAL_CAPABILITY_TOKEN).toBe("shared-dev-token");
    expect(env.VITE_SOLO_SIDECAR_BASE_URL).toBe("http://127.0.0.1:43110");
  });

  it("generates one high-entropy token into the shared child environment when none is provided", () => {
    const token = resolveLocalCapabilityToken({});
    const env = createDevEnvironment({});

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(env.SOLO_LOCAL_CAPABILITY_TOKEN).toMatch(/^[0-9a-f]{64}$/);
    expect(env.VITE_SOLO_LOCAL_CAPABILITY_TOKEN).toBe(env.SOLO_LOCAL_CAPABILITY_TOKEN);
  });

  it("passes the sidecar base URL to Vite when a dev override is configured", () => {
    const env = createDevEnvironment({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token",
      SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:61234"
    });

    expect(env.VITE_SOLO_SIDECAR_BASE_URL).toBe("http://127.0.0.1:61234");
  });

  it("rejects an explicitly empty shared token before spawning dev processes", () => {
    expect(() => resolveLocalCapabilityToken({ SOLO_LOCAL_CAPABILITY_TOKEN: "   " })).toThrow(
      "SOLO_LOCAL_CAPABILITY_TOKEN must not be empty"
    );
  });
});
