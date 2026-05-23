import { describe, expect, it } from "vitest";
import { assertSmokePortsAvailable, cleanupManagedSmoke, diagnosticEnvSnapshot, redactConfigSecrets } from "./local-smoke.mjs";

describe("local smoke helpers", () => {
  it("keeps diagnostic env snapshots allowlisted", () => {
    expect(diagnosticEnvSnapshot({ CI: "true", SECRET: "hidden" }, ["CI"])).toEqual({ CI: "true" });
  });

  it("redacts local tokens from public smoke configs", () => {
    expect(redactConfigSecrets({ localCapabilityToken: "token", sidecarPort: "43110" })).toEqual({
      localCapabilityToken: "<redacted>",
      sidecarPort: "43110"
    });
  });

  it("reports smoke port conflicts before starting managed processes", async () => {
    const checks = [
      {
        label: "sidecar",
        host: "127.0.0.1",
        port: "43110",
        publicUrl: "http://127.0.0.1:43110",
        overrideName: "SOLO_SIDECAR_PORT"
      }
    ];

    await expect(assertSmokePortsAvailable(checks, "local-smoke", {
      listen: async () => ({ available: false, reason: "127.0.0.1:43110 is already in use" })
    })).rejects.toThrow("local-smoke: sidecar smoke port conflict");
    await expect(assertSmokePortsAvailable([
      ...checks,
      {
        label: "web preview",
        host: "127.0.0.1",
        port: "43110",
        publicUrl: "http://127.0.0.1:43110",
        overrideName: "SOLO_WEB_PORT"
      }
    ], "local-smoke", {
      listen: async () => {
        throw new Error("listen should not run for duplicate ports");
      }
    })).rejects.toThrow("sidecar and web preview smoke ports conflict before startup");
  });

  it("removes temporary app data even when process cleanup fails", async () => {
    const removed = [];

    await expect(
      cleanupManagedSmoke([{ label: "hung smoke" }], "/tmp/solo-smoke", "local-smoke", {
        remove: async (target, options) => {
          removed.push({ target, options });
        },
        stopProcess: async () => {
          throw new Error("process did not exit");
        }
      })
    ).rejects.toThrow("local-smoke cleanup failed");
    expect(removed).toEqual([
      {
        target: "/tmp/solo-smoke",
        options: { recursive: true, force: true }
      }
    ]);
  });
});
