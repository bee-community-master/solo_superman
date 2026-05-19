import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatSidecarBaseUrl, resolveSidecarConfig } from "./sidecar-config";

const originalArgv = process.argv;
const originalHost = process.env.SOLO_SIDECAR_HOST;
const originalPort = process.env.SOLO_SIDECAR_PORT;
const originalToken = process.env.SOLO_LOCAL_CAPABILITY_TOKEN;
const originalDatabaseUrl = process.env.SOLO_DATABASE_URL;
const originalAppDataDir = process.env.SOLO_APP_DATA_DIR;
const originalWslDistroName = process.env.WSL_DISTRO_NAME;
const originalWslInterop = process.env.WSL_INTEROP;
const originalWslenv = process.env.WSLENV;
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

function useDefaultProcessInputs() {
  process.argv = ["node", "sidecar"];

  delete process.env.SOLO_SIDECAR_HOST;
  delete process.env.SOLO_SIDECAR_PORT;
  delete process.env.SOLO_DATABASE_URL;
  delete process.env.SOLO_APP_DATA_DIR;
  delete process.env.WSL_DISTRO_NAME;
  delete process.env.WSL_INTEROP;
  delete process.env.WSLENV;
  process.env.SOLO_LOCAL_CAPABILITY_TOKEN = "test-local-token";
}

function useProcessPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    configurable: true,
    enumerable: true,
    value: platform
  });
}

function restoreProcessInputs() {
  process.argv = originalArgv;
  if (originalPlatform) {
    Object.defineProperty(process, "platform", originalPlatform);
  }

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

  if (originalDatabaseUrl === undefined) {
    delete process.env.SOLO_DATABASE_URL;
  } else {
    process.env.SOLO_DATABASE_URL = originalDatabaseUrl;
  }

  if (originalAppDataDir === undefined) {
    delete process.env.SOLO_APP_DATA_DIR;
  } else {
    process.env.SOLO_APP_DATA_DIR = originalAppDataDir;
  }

  if (originalWslDistroName === undefined) {
    delete process.env.WSL_DISTRO_NAME;
  } else {
    process.env.WSL_DISTRO_NAME = originalWslDistroName;
  }

  if (originalWslInterop === undefined) {
    delete process.env.WSL_INTEROP;
  } else {
    process.env.WSL_INTEROP = originalWslInterop;
  }

  if (originalWslenv === undefined) {
    delete process.env.WSLENV;
  } else {
    process.env.WSLENV = originalWslenv;
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
      localCapabilityToken: "test-local-token",
      databaseUrl: undefined,
      appDataDir: expect.stringMatching(/Solo Superman|solo-superman/u)
    });
  });

  it("accepts explicit PR-03 storage paths from env or packaged sidecar args", () => {
    process.env.SOLO_APP_DATA_DIR = "/tmp/solo-superman-test-app-data";
    process.env.SOLO_DATABASE_URL = "file:/tmp/solo-superman-test-app-data/custom.db";

    expect(resolveSidecarConfig()).toMatchObject({
      appDataDir: "/tmp/solo-superman-test-app-data",
      databaseUrl: "file:/tmp/solo-superman-test-app-data/custom.db"
    });

    process.argv = [
      "node",
      "sidecar",
      "--app-data-dir",
      "/tmp/solo-superman-packaged-app-data",
      "--database-url",
      "file:/tmp/solo-superman-packaged-app-data/solo-superman.db"
    ];

    expect(resolveSidecarConfig()).toMatchObject({
      appDataDir: "/tmp/solo-superman-packaged-app-data",
      databaseUrl: "file:/tmp/solo-superman-packaged-app-data/solo-superman.db"
    });
  });

  it("allows packaged-app ephemeral loopback ports", () => {
    process.argv = ["node", "sidecar", "--port", "0"];

    expect(resolveSidecarConfig().port).toBe(0);
  });

  it("accepts a local bootstrap capability token from env", () => {
    process.env.SOLO_LOCAL_CAPABILITY_TOKEN = "local-bootstrap-test-token";

    expect(resolveSidecarConfig().localCapabilityToken).toBe("local-bootstrap-test-token");
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

    expect(() => resolveSidecarConfig()).toThrow("SOLO_LOCAL_CAPABILITY_TOKEN must be provided by local bootstrap or dev env");
  });

  it("rejects malformed port values instead of partially parsing them", () => {
    process.env.SOLO_SIDECAR_PORT = "43110abc";

    expect(() => resolveSidecarConfig()).toThrow("Invalid sidecar port value");
  });

  it("rejects missing CLI flag values", () => {
    process.argv = ["node", "sidecar", "--port", "--host", "127.0.0.1"];

    expect(() => resolveSidecarConfig()).toThrow("Missing --port value");
  });

  it("keeps native sidecar binding loopback-only", () => {
    useProcessPlatform("win32");
    process.env.SOLO_SIDECAR_HOST = "0.0.0.0";

    expect(() => resolveSidecarConfig()).toThrow("Sidecar host must be loopback-only");
  });

  it("allows WSL wildcard binding for Windows host reachability", () => {
    useProcessPlatform("linux");
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    process.env.SOLO_SIDECAR_HOST = "0.0.0.0";

    expect(resolveSidecarConfig()).toMatchObject({
      host: "0.0.0.0",
      port: 43110,
      localCapabilityToken: "test-local-token"
    });
  });

  it("normalizes IPv6 loopback hosts for binding and URL reporting", () => {
    process.argv = ["node", "sidecar", "--host", "[::1]", "--port", "43110"];

    const config = resolveSidecarConfig();

    expect(config).toMatchObject({ host: "::1", port: 43110, localCapabilityToken: "test-local-token" });
    expect(formatSidecarBaseUrl(config)).toBe("http://[::1]:43110");
  });
});
