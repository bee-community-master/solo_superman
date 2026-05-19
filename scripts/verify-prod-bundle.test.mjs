import { describe, expect, it } from "vitest";
import {
  cleanupProdBundleSmoke,
  fetchWithTimeout,
  pnpmCommand,
  prodBundleSmokeCommands,
  prodBundleSmokeConfig,
  prodBundleSmokeEnvironment
} from "./verify-prod-bundle.mjs";

describe("verify-prod-bundle smoke plan", () => {
  it("binds the same local capability token into sidecar and production web build env", () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      SOLO_PROD_SMOKE_SIDECAR_PORT: "43112",
      SOLO_PROD_SMOKE_WEB_PORT: "4175"
    });
    const env = prodBundleSmokeEnvironment(config, "/tmp/solo-prod-smoke");

    expect(config.sidecarBaseUrl).toBe("http://127.0.0.1:43112");
    expect(config.webBaseUrl).toBe("http://127.0.0.1:4175");
    expect(env).toMatchObject({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:43112",
      SOLO_APP_DATA_DIR: "/tmp/solo-prod-smoke"
    });
  });

  it("uses production build plus sidecar start and Vite preview instead of the dev server", () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token"
    });
    const commands = prodBundleSmokeCommands(config);

    expect(commands.build).toEqual(["pnpm", ["build"]]);
    expect(commands.sidecar).toEqual(["pnpm", ["--filter", "@solo-superman/sidecar", "start"]]);
    expect(commands.webPreview).toEqual([
      "pnpm",
      [
        "--filter",
        "@solo-superman/web",
        "exec",
        "vite",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4173",
        "--strictPort"
      ]
    ]);
  });

  it("uses pnpm.cmd on Windows so child_process spawn can run package scripts", () => {
    expect(pnpmCommand("win32")).toBe("pnpm.cmd");
    expect(pnpmCommand("darwin")).toBe("pnpm");
    expect(pnpmCommand("linux")).toBe("pnpm");

    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token"
    });
    const commands = prodBundleSmokeCommands(config, "win32");

    expect(commands.build[0]).toBe("pnpm.cmd");
    expect(commands.sidecar[0]).toBe("pnpm.cmd");
    expect(commands.webPreview[0]).toBe("pnpm.cmd");
  });

  it("rejects invalid timeout overrides before starting the smoke process", () => {
    expect(() => prodBundleSmokeConfig({
      SOLO_PROD_SMOKE_TIMEOUT_MS: "ten seconds"
    })).toThrow("SOLO_PROD_SMOKE_TIMEOUT_MS must be a positive integer");
  });

  it("keeps smoke host and port overrides loopback-only and fixed", () => {
    expect(() => prodBundleSmokeConfig({
      SOLO_PROD_SMOKE_WEB_HOST: "0.0.0.0"
    })).toThrow("SOLO_PROD_SMOKE_WEB_HOST must be loopback-only");

    expect(() => prodBundleSmokeConfig({
      SOLO_PROD_SMOKE_SIDECAR_PORT: "0"
    })).toThrow("SOLO_PROD_SMOKE_SIDECAR_PORT must be a fixed local port");
  });

  it("uses unbracketed IPv6 loopback for process hosts and bracketed IPv6 in URLs", () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      SOLO_PROD_SMOKE_SIDECAR_HOST: "::1",
      SOLO_PROD_SMOKE_WEB_HOST: "[::1]"
    });
    const commands = prodBundleSmokeCommands(config);

    expect(config.sidecarHost).toBe("::1");
    expect(config.webHost).toBe("::1");
    expect(config.sidecarBaseUrl).toBe("http://[::1]:43110");
    expect(config.webBaseUrl).toBe("http://[::1]:4173");
    expect(commands.webPreview[1]).toContain("::1");
    expect(commands.webPreview[1]).not.toContain("[::1]");
  });

  it("removes temporary app data even when process cleanup fails", async () => {
    const removed = [];

    await expect(
      cleanupProdBundleSmoke([{ label: "hung preview" }], "/tmp/solo-prod-smoke", {
        remove: async (target, options) => {
          removed.push({ target, options });
        },
        stopProcess: async () => {
          throw new Error("process did not exit");
        }
      })
    ).rejects.toThrow("verify-prod-bundle cleanup failed");

    expect(removed).toEqual([
      {
        target: "/tmp/solo-prod-smoke",
        options: { recursive: true, force: true }
      }
    ]);
  });

  it("bounds each smoke fetch attempt with an abort signal", async () => {
    let capturedSignal;
    const response = await fetchWithTimeout("http://127.0.0.1:43110/healthz", {
      timeoutMs: 1_000,
      fetchImpl: async (_url, init) => {
        capturedSignal = init?.signal;

        return new globalThis.Response("ok", { status: 200 });
      }
    });

    expect(response.status).toBe(200);
    expect(capturedSignal).toBeInstanceOf(globalThis.AbortSignal);
    expect(capturedSignal.aborted).toBe(false);
  });
});
