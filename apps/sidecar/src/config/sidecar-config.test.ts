import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatSidecarBaseUrl, resolveSidecarConfig } from "./sidecar-config";

const originalArgv = process.argv;
const originalHost = process.env.SOLO_SIDECAR_HOST;
const originalPort = process.env.SOLO_SIDECAR_PORT;

function useDefaultProcessInputs() {
  process.argv = ["node", "sidecar"];

  delete process.env.SOLO_SIDECAR_HOST;
  delete process.env.SOLO_SIDECAR_PORT;
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
      port: 43110
    });
  });

  it("allows packaged-app ephemeral loopback ports", () => {
    process.argv = ["node", "sidecar", "--port", "0"];

    expect(resolveSidecarConfig().port).toBe(0);
  });

  it("rejects malformed port values instead of partially parsing them", () => {
    process.env.SOLO_SIDECAR_PORT = "43110abc";

    expect(() => resolveSidecarConfig()).toThrow("Invalid sidecar port value");
  });

  it("rejects missing CLI flag values", () => {
    process.argv = ["node", "sidecar", "--port", "--host", "127.0.0.1"];

    expect(() => resolveSidecarConfig()).toThrow("Missing --port value");
  });

  it("keeps PR-01 sidecar binding loopback-only", () => {
    process.env.SOLO_SIDECAR_HOST = "0.0.0.0";

    expect(() => resolveSidecarConfig()).toThrow("Sidecar host must be loopback-only");
  });

  it("normalizes IPv6 loopback hosts for binding and URL reporting", () => {
    process.argv = ["node", "sidecar", "--host", "[::1]", "--port", "43110"];

    const config = resolveSidecarConfig();

    expect(config).toEqual({ host: "::1", port: 43110 });
    expect(formatSidecarBaseUrl(config)).toBe("http://[::1]:43110");
  });
});
