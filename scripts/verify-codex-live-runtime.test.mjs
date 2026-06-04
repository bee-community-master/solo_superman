import { describe, expect, it } from "vitest";
import {
  LIVE_RUNTIME_VERIFY_ENV,
  LIVE_TURNS_ENV,
  assertCodexLiveRuntimeSmokePortAvailable,
  assertLiveRuntimeVerificationGate,
  codexLiveRuntimeSmokeCommands,
  codexLiveRuntimeSmokeConfig,
  codexLiveRuntimeSmokeEnvironment,
  evaluateCodexLiveRuntimeStatus,
  liveRuntimeVerificationGateEvidence,
  liveRuntimeVerificationRequested,
  skippedCodexLiveRuntimeEvidence
} from "./verify-codex-live-runtime.mjs";

describe("verify-codex-live-runtime smoke plan", () => {
  it("skips by default without probing Codex or starting a sidecar", () => {
    expect(liveRuntimeVerificationRequested({})).toBe(false);
    expect(skippedCodexLiveRuntimeEvidence()).toMatchObject({
      status: "skipped",
      smoke: "codex_live_runtime_readiness",
      checked: [
        `${LIVE_RUNTIME_VERIFY_ENV} was not set to 1`,
        "no Codex account probe was started",
        "no local sidecar process was started"
      ]
    });
  });

  it("requires the live-turn runtime gate when verification is explicitly requested", () => {
    expect(liveRuntimeVerificationGateEvidence({
      [LIVE_RUNTIME_VERIFY_ENV]: "1"
    })).toMatchObject({
      status: "blocked",
      blockers: [
        `${LIVE_TURNS_ENV}=1 is required before live runtime readiness can be verified`
      ]
    });
    expect(() => assertLiveRuntimeVerificationGate({
      [LIVE_RUNTIME_VERIFY_ENV]: "1"
    })).toThrow(`${LIVE_TURNS_ENV}=1 is missing`);
    expect(liveRuntimeVerificationGateEvidence({
      [LIVE_RUNTIME_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    })).toMatchObject({
      status: "ready",
      blockers: []
    });
    expect(() => assertLiveRuntimeVerificationGate({
      [LIVE_RUNTIME_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    })).not.toThrow();
  });

  it("keeps live runtime smoke local-only with an isolated token and app data dir", () => {
    const config = codexLiveRuntimeSmokeConfig({
      SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_PORT: "43121",
      SOLO_LOCAL_CAPABILITY_TOKEN: "must-not-be-reused",
      [LIVE_RUNTIME_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    }, "linux", { localCapabilityToken: "per-run-token" });
    const env = codexLiveRuntimeSmokeEnvironment(config, "/tmp/solo-live-runtime-smoke", {
      [LIVE_RUNTIME_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    });

    expect(config.sidecarBaseUrl).toBe("http://127.0.0.1:43121");
    expect(config.sidecarBindHost).toBe("127.0.0.1");
    expect(env).toMatchObject({
      CI: "true",
      SOLO_LOCAL_CAPABILITY_TOKEN: "per-run-token",
      SOLO_SIDECAR_HOST: "127.0.0.1",
      SOLO_SIDECAR_PORT: "43121",
      SOLO_APP_DATA_DIR: "/tmp/solo-live-runtime-smoke",
      [LIVE_RUNTIME_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    });
    expect(config.localCapabilityToken).toBe("per-run-token");
  });

  it("uses the package manager sidecar start command and pnpm.cmd on Windows", () => {
    expect(codexLiveRuntimeSmokeCommands("linux", {}).sidecar).toEqual([
      "pnpm",
      ["--filter", "@solo-superman/sidecar", "start"]
    ]);
    expect(codexLiveRuntimeSmokeCommands("win32", {}).sidecar[0]).toBe("pnpm.cmd");
  });

  it("binds to wildcard inside WSL while keeping fetch URLs loopback-only", () => {
    const config = codexLiveRuntimeSmokeConfig({
      WSL_DISTRO_NAME: "Ubuntu",
      [LIVE_RUNTIME_VERIFY_ENV]: "1",
      [LIVE_TURNS_ENV]: "1"
    }, "linux");

    expect(config.sidecarHost).toBe("127.0.0.1");
    expect(config.sidecarBindHost).toBe("0.0.0.0");
    expect(config.sidecarBaseUrl).toBe("http://127.0.0.1:43116");
  });

  it("rejects non-loopback host and invalid timeout overrides", () => {
    expect(() => codexLiveRuntimeSmokeConfig({
      SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_HOST: "192.168.0.10"
    })).toThrow("SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_HOST must be loopback-only");
    expect(() => codexLiveRuntimeSmokeConfig({
      SOLO_CODEX_LIVE_RUNTIME_SMOKE_TIMEOUT_MS: "soon"
    })).toThrow("SOLO_CODEX_LIVE_RUNTIME_SMOKE_TIMEOUT_MS must be a positive integer");
  });

  it("checks the live runtime smoke sidecar port before startup", async () => {
    const config = codexLiveRuntimeSmokeConfig({
      SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_PORT: "43121"
    });

    await expect(assertCodexLiveRuntimeSmokePortAvailable(config, {
      listen: async (host, port) => ({
        available: false,
        reason: `${host}:${port} is already in use`
      })
    })).rejects.toThrow("verify-codex-live-runtime: sidecar smoke port conflict");
  });

  it("passes only when runtime status proves live mode and an authenticated account", () => {
    expect(evaluateCodexLiveRuntimeStatus({
      ok: true,
      data: {
        status: "available",
        executionMode: "live",
        liveTurnExecutionEnabled: true,
        manualHandoffAvailable: true,
        checkedAt: "2026-05-23T00:00:00.000Z",
        adapterVersion: "codex-sdk-runtime-v1",
        sdkPackageVersion: "0.137.0",
        codexCliVersion: "0.137.0",
        transport: "codex-sdk-jsonl",
        account: {
          status: "authenticated",
          accountType: "chatgpt",
          email: "founder@example.com"
        }
      }
    })).toMatchObject({
      status: "passed",
      runtime: {
        status: "available",
        executionMode: "live",
        liveTurnExecutionEnabled: true,
        accountStatus: "authenticated",
        codexCliVersion: "0.137.0",
        hasAccountEmail: true
      },
      blockers: []
    });
  });

  it("blocks unavailable, manual-handoff, or unauthenticated runtime status", () => {
    const evidence = evaluateCodexLiveRuntimeStatus({
      ok: true,
      data: {
        status: "unavailable",
        executionMode: "manual_handoff",
        liveTurnExecutionEnabled: false,
        account: {
          status: "missing"
        }
      }
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual([
      "runtime status must be available; received \"unavailable\"",
      "executionMode must be live; received \"manual_handoff\"",
      "liveTurnExecutionEnabled must be true",
      "account.status must be authenticated; received \"missing\""
    ]);
  });

  it("blocks malformed runtime status envelopes", () => {
    expect(evaluateCodexLiveRuntimeStatus({ ok: false }).blockers).toEqual([
      "runtime status response must be an ok=true envelope with data"
    ]);
  });
});
