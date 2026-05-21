import { describe, expect, it } from "vitest";
import {
  assertProdBundleSmokePortsAvailable,
  cleanupProdBundleSmoke,
  pnpmCommand,
  prodBundleSmokeLogPath,
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
    expect(config.sidecarBindHost).toBe("127.0.0.1");
    expect(config.webBindHost).toBe("127.0.0.1");
    expect(env).toMatchObject({
      CI: "true",
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      SOLO_SIDECAR_HOST: "127.0.0.1",
      VITE_SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      VITE_SOLO_SIDECAR_BASE_URL: "http://127.0.0.1:43112",
      SOLO_APP_DATA_DIR: "/tmp/solo-prod-smoke"
    });
  });

  it("honors an explicit diagnostic log path for Windows bootstrap failures", () => {
    expect(prodBundleSmokeLogPath({
      SOLO_PROD_SMOKE_LOG_PATH: "C:/Users/founder/solo_superman/solo-superman-prod-bundle-smoke.log"
    })).toBe("C:/Users/founder/solo_superman/solo-superman-prod-bundle-smoke.log");
  });

  it("uses direct recursive production build plus sidecar start and Vite preview instead of the dev server", () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token"
    });
    const commands = prodBundleSmokeCommands(config, "linux", {});

    expect(commands.build).toEqual(["pnpm", ["-r", "--if-present", "build"]]);
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
    expect(pnpmCommand("win32", {})).toBe("pnpm.cmd");
    expect(pnpmCommand("darwin", {})).toBe("pnpm");
    expect(pnpmCommand("linux", {})).toBe("pnpm");

    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token"
    });
    const commands = prodBundleSmokeCommands(config, "win32", {});

    expect(commands.build[0]).toBe("pnpm.cmd");
    expect(commands.build[1]).toEqual(["-r", "--if-present", "build"]);
    expect(commands.sidecar[0]).toBe("pnpm.cmd");
    expect(commands.webPreview[0]).toBe("pnpm.cmd");
  });

  it("uses the active pnpm entrypoint instead of a bare pnpm spawn when available", () => {
    const env = {
      npm_execpath: "/opt/pnpm/bin/pnpm.cjs",
      npm_config_user_agent: "pnpm/11.0.4 npm/? node/v24.0.0"
    };
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token"
    });
    const commands = prodBundleSmokeCommands(config, "linux", env);

    expect(commands.build).toEqual([process.execPath, ["/opt/pnpm/bin/pnpm.cjs", "-r", "--if-present", "build"]]);
    expect(commands.sidecar[0]).toBe(process.execPath);
    expect(commands.webPreview[0]).toBe(process.execPath);
  });

  it("binds smoke servers to wildcard inside WSL while keeping fetch URLs loopback-only", () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      WSL_DISTRO_NAME: "Ubuntu"
    }, "linux");
    const env = prodBundleSmokeEnvironment(config, "/tmp/solo-prod-smoke");
    const commands = prodBundleSmokeCommands(config, "linux", {});

    expect(config.sidecarHost).toBe("127.0.0.1");
    expect(config.webHost).toBe("127.0.0.1");
    expect(config.sidecarBindHost).toBe("0.0.0.0");
    expect(config.webBindHost).toBe("0.0.0.0");
    expect(config.sidecarBaseUrl).toBe("http://127.0.0.1:43110");
    expect(env.SOLO_SIDECAR_HOST).toBe("0.0.0.0");
    expect(commands.webPreview[1]).toContain("0.0.0.0");
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
      SOLO_PROD_SMOKE_WEB_BIND_HOST: "0.0.0.0"
    }, "darwin")).toThrow("SOLO_PROD_SMOKE_WEB_BIND_HOST may use 0.0.0.0 only when running inside WSL");

    expect(() => prodBundleSmokeConfig({
      SOLO_PROD_SMOKE_SIDECAR_PORT: "0"
    })).toThrow("SOLO_PROD_SMOKE_SIDECAR_PORT must be a fixed local port");
  });

  it("reports sidecar smoke port conflicts as local environment diagnostics", async () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      SOLO_PROD_SMOKE_SIDECAR_PORT: "43110",
      SOLO_PROD_SMOKE_WEB_PORT: "4173"
    });
    const seen = [];

    await expect(
      assertProdBundleSmokePortsAvailable(config, {
        listen: async (host, port) => {
          seen.push(`${host}:${port}`);

          return port === "43110"
            ? { available: false, reason: `${host}:${port} is already in use` }
            : { available: true };
        }
      })
    ).rejects.toThrow("sidecar smoke port conflict");
    await expect(
      assertProdBundleSmokePortsAvailable(config, {
        listen: async (host, port) => {
          if (port === "43110") {
            return { available: false, reason: `${host}:${port} is already in use` };
          }

          return { available: true };
        }
      })
    ).rejects.toThrow("SOLO_PROD_SMOKE_SIDECAR_PORT=<free-port>");
    expect(seen).toEqual(["127.0.0.1:43110"]);
  });

  it("uses unbracketed IPv6 loopback for process hosts and bracketed IPv6 in URLs", () => {
    const config = prodBundleSmokeConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      SOLO_PROD_SMOKE_SIDECAR_HOST: "::1",
      SOLO_PROD_SMOKE_WEB_HOST: "[::1]"
    });
    const commands = prodBundleSmokeCommands(config, "linux", {});

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

});
