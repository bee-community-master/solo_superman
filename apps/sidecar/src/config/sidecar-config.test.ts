import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatSidecarBaseUrl, resolveSidecarConfig } from "./sidecar-config";

const originalArgv = process.argv;
const originalHost = process.env.SOLO_SIDECAR_HOST;
const originalPort = process.env.SOLO_SIDECAR_PORT;
const originalToken = process.env.SOLO_LOCAL_CAPABILITY_TOKEN;

function useDefaultProcessInputs() {
  process.argv = ["node", "sidecar"];

  delete process.env.SOLO_SIDECAR_HOST;
  delete process.env.SOLO_SIDECAR_PORT;
  process.env.SOLO_LOCAL_CAPABILITY_TOKEN = "test-local-token";
}

function restoreProcessInputs() {
  process.argv = originalArgv;

  if (originalHost === undefined) {
    delete process.env.SOLO_SIDECAR_HOST;
  } else {
    process.env.SOLO_SIDECAR_HOST = originalHost;
  }

  if (originalPort === undefined) {
    delete process.env.SOLO_SIDECAR_PORT;
  } else {
    process.env.SOLO_SIDECAR_PORT = originalPort;
  }

  if (originalToken === undefined) {
    delete process.env.SOLO_LOCAL_CAPABILITY_TOKEN;
  } else {
    process.env.SOLO_LOCAL_CAPABILITY_TOKEN = originalToken;
  }
}

describe("sidecar scaffold config", () => {
  beforeEach(() => {
    useDefaultProcessInputs();
  });

  afterEach(() => {
    restoreProcessInputs();
  });

  it("uses the documented loopback development default", () => {
    expect(resolveSidecarConfig()).toEqual({
      host: "127.0.0.1",
      port: 43110,
      localCapabilityToken: "test-local-token"
    });
  });

  it("allows packaged-app ephemeral loopback ports", () => {
    process.argv = ["node", "sidecar", "--port", "0"];

    expect(resolveSidecarConfig().port).toBe(0);
  });

  it("accepts a Tauri-issued local capability token from env", () => {
    process.env.SOLO_LOCAL_CAPABILITY_TOKEN = "tauri-issued-test-token";

    expect(resolveSidecarConfig().localCapabilityToken).toBe("tauri-issued-test-token");
  });

  it("accepts a local capability token from packaged sidecar args", () => {
    process.argv = ["node", "sidecar", "--local-token", "packaged-token"];

    expect(resolveSidecarConfig().localCapabilityToken).toBe("packaged-token");
  });

  it("rejects empty local capability tokens", () => {
    process.env.SOLO_LOCAL_CAPABILITY_TOKEN = "   ";

    expect(() => resolveSidecarConfig()).toThrow("SOLO_LOCAL_CAPABILITY_TOKEN must not be empty");
  });

  it("rejects missing local capability tokens instead of generating an unreachable sidecar-only token", () => {
    delete process.env.SOLO_LOCAL_CAPABILITY_TOKEN;

    expect(() => resolveSidecarConfig()).toThrow("SOLO_LOCAL_CAPABILITY_TOKEN must be provided by Tauri or dev env");
  });

  it("rejects malformed port values instead of partially parsing them", () => {
    process.env.SOLO_SIDECAR_PORT = "43110abc";

    expect(() => resolveSidecarConfig()).toThrow("Invalid sidecar port value");
  });

  it("rejects missing CLI flag values", () => {
    process.argv = ["node", "sidecar", "--port", "--host", "127.0.0.1"];

    expect(() => resolveSidecarConfig()).toThrow("Missing --port value");
  });

  it("keeps PR-02 sidecar binding loopback-only", () => {
    process.env.SOLO_SIDECAR_HOST = "0.0.0.0";

    expect(() => resolveSidecarConfig()).toThrow("Sidecar host must be loopback-only");
  });

  it("normalizes IPv6 loopback hosts for binding and URL reporting", () => {
    process.argv = ["node", "sidecar", "--host", "[::1]", "--port", "43110"];

    const config = resolveSidecarConfig();

    expect(config).toEqual({ host: "::1", port: 43110, localCapabilityToken: "test-local-token" });
    expect(formatSidecarBaseUrl(config)).toBe("http://[::1]:43110");
  });
});
