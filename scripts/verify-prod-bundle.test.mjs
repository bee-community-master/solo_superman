import { describe, expect, it } from "vitest";
import {
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

  it("rejects invalid timeout overrides before starting the smoke process", () => {
    expect(() => prodBundleSmokeConfig({
      SOLO_PROD_SMOKE_TIMEOUT_MS: "ten seconds"
    })).toThrow("SOLO_PROD_SMOKE_TIMEOUT_MS must be a positive integer");
  });
});
