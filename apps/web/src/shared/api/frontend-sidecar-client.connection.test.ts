import { describe, expect, it } from "vitest";
import {
  diagnoseSidecarConnectionFromEnv,
  discoverSidecarConnection,
  sidecarConnectionFromEnv
} from "./sidecar-client";

describe("sidecar client connection", () => {
  it("discovers the Vite dev connection without exposing sidecar auth through app state", () => {
    expect(
      sidecarConnectionFromEnv({
        VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
        VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:61234"
      })
    ).toMatchObject({
      baseUrl: "http://127.0.0.1:61234",
      localCapabilityToken: "shared-token",
      mode: "vite_env"
    });

    expect(sidecarConnectionFromEnv({})).toBeNull();
    expect(sidecarConnectionFromEnv({ VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token" })).toBeNull();
    expect(sidecarConnectionFromEnv({ VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:61234" })).toBeNull();
  });

  it("accepts an explicit IPv6 loopback Vite sidecar origin", () => {
    expect(
      sidecarConnectionFromEnv({
        VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
        VITE_SOLO_SIDECAR_BASE_URL: "http://[::1]:61234"
      })
    ).toMatchObject({
      baseUrl: "http://[::1]:61234",
      localCapabilityToken: "shared-token",
      mode: "vite_env"
    });
  });

  it("does not fall back to a native shell bridge when Vite sidecar env is absent", async () => {
    await expect(discoverSidecarConnection()).resolves.toBeNull();
  });

  it("explains why Vite sidecar discovery is unavailable", () => {
    expect(diagnoseSidecarConnectionFromEnv({})).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("VITE_SOLO_LOCAL_CAPABILITY_TOKEN is missing"),
      details: {
        hasViteToken: false,
        hasViteSidecarBaseUrl: false
      }
    });

    expect(
      diagnoseSidecarConnectionFromEnv({
        VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
        VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:61234/"
      })
    ).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("VITE_SOLO_SIDECAR_BASE_URL is not an origin-only loopback HTTP URL")
    });
  });

  it("rejects non-loopback or non-origin Vite dev base URLs before sending the local token", () => {
    for (const baseUrl of [
      "https://127.0.0.1:61234",
      "http://192.0.2.10:61234",
      "http://127.0.0.1:61234/api",
      "http://127.0.0.1:61234/",
      "http://127.0.0.1:61234@evil.example"
    ]) {
      expect(
        sidecarConnectionFromEnv({
          VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-token",
          VITE_SOLO_SIDECAR_BASE_URL: baseUrl
        })
      ).toBeNull();
    }
  });

});
