import { describe, expect, it } from "vitest";
import { createDevEnvironment, devCommand, resolveLocalCapabilityToken, resolveSidecarBaseUrl } from "./dev-with-local-token.mjs";

describe("PR-02 dev local capability token launcher", () => {
  it("preserves an explicitly shared token for both web frontend and sidecar dev processes", () => {
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

  it("derives the Vite sidecar base URL from the loopback sidecar host and port overrides", () => {
    const env = createDevEnvironment({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token",
      SOLO_SIDECAR_HOST: "localhost",
      SOLO_SIDECAR_PORT: "61234"
    });

    expect(env.VITE_SOLO_SIDECAR_BASE_URL).toBe("http://localhost:61234");
  });

  it("normalizes IPv6 loopback sidecar host overrides into a browser-usable origin", () => {
    expect(
      resolveSidecarBaseUrl({
        SOLO_SIDECAR_HOST: "::1",
        SOLO_SIDECAR_PORT: "61234"
      })
    ).toBe("http://[::1]:61234");
  });

  it("rejects an explicitly empty shared token before spawning dev processes", () => {
    expect(() => resolveLocalCapabilityToken({ SOLO_LOCAL_CAPABILITY_TOKEN: "   " })).toThrow(
      "SOLO_LOCAL_CAPABILITY_TOKEN must not be empty"
    );
  });

  it("rejects non-loopback sidecar development overrides before exposing the token to Vite", () => {
    expect(() =>
      createDevEnvironment({
        SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token",
        SOLO_SIDECAR_HOST: "0.0.0.0",
        SOLO_SIDECAR_PORT: "61234"
      })
    ).toThrow("SOLO_SIDECAR_HOST must be loopback-only");

    expect(() =>
      createDevEnvironment({
        SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token",
        SOLO_SIDECAR_BASE_URL: "http://192.0.2.10:61234"
      })
    ).toThrow("SOLO_SIDECAR_BASE_URL must be an origin-only loopback HTTP URL");
  });

  it("rejects ephemeral sidecar ports for root local web dev because Vite needs a fixed origin", () => {
    expect(() =>
      createDevEnvironment({
        SOLO_LOCAL_CAPABILITY_TOKEN: "shared-dev-token",
        SOLO_SIDECAR_PORT: "0"
      })
    ).toThrow("SOLO_SIDECAR_PORT must be a fixed port");
  });

  it("uses the active pnpm entrypoint for parallel dev process spawning", () => {
    expect(devCommand("linux", {
      npm_execpath: "/opt/pnpm/bin/pnpm.cjs",
      npm_config_user_agent: "pnpm/11.0.4 npm/? node/v24.0.0"
    })).toEqual([
      process.execPath,
      [
        "/opt/pnpm/bin/pnpm.cjs",
        "--parallel",
        "--filter",
        "@solo-superman/sidecar",
        "--filter",
        "@solo-superman/web",
        "dev"
      ]
    ]);
  });
});
