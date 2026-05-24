import { describe, expect, it } from "vitest";
import {
  READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
  evidenceForReadyReleaseResults,
  extractReadyReleaseCommandBlockers,
  parseReadyReleaseArgs,
  readyReleaseSteps,
  runReadyReleaseVerification
} from "./verify-ready-release.mjs";

describe("ready release aggregate verification", () => {
  it("plans the required ready-release command sequence", () => {
    expect(readyReleaseSteps().map((step) => step.display)).toEqual([
      "pnpm verify:signed-package-preflight -- --require-credentials",
      "pnpm verify:signed-package-release -- --require-release-evidence",
      "pnpm verify:windows-real-device -- --require-device-evidence",
      "pnpm verify:packaged-update-rollback -- --require-device-evidence",
      "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready",
      "pnpm verify:release-readiness -- --require-ready"
    ]);
  });

  it("summarizes passing ready-release results", () => {
    const results = readyReleaseSteps().map((step) => ({ ...step, exitCode: 0, stdout: "ok", stderr: "" }));
    const evidence = evidenceForReadyReleaseResults(results, { timeoutMs: 1234 });

    expect(evidence).toMatchObject({
      status: "passed",
      schemaVersion: READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
      mode: "ready-release-gate",
      timeoutMs: 1234,
      releaseEvidenceBundleDir: "./solo-superman-release-evidence-bundle",
      blockers: [],
      commandBlockers: []
    });
    expect(evidence.commands.every((command) => command.status === "passed")).toBe(true);
    expect(evidence.commands.every((command) => command.blockers.length === 0)).toBe(true);
  });

  it("extracts nested verifier blockers from pnpm JSON output", () => {
    const stdout = [
      "{",
      "  \"status\": \"blocked\",",
      "  \"blockers\": [\"Windows evidence is not ready\"],",
      "  \"issues\": [\"release-manifest-signing: token=ghp_abcdefghijklmnopqrstuvwxyz1234567890\"]",
      "}",
      " ELIFECYCLE  Command failed with exit code 1."
    ].join("\n");

    expect(extractReadyReleaseCommandBlockers({ stdout })).toEqual([
      "Windows evidence is not ready",
      "release-manifest-signing: token=<redacted>"
    ]);
  });

  it("runs every gate by default and redacts blocked command output", async () => {
    const calls = [];
    const evidence = await runReadyReleaseVerification({
      timeoutMs: 5000,
      runner: async (step, options) => {
        calls.push({ step, options });
        return {
          ...step,
          timeoutMs: options.timeoutMs,
          exitCode: step.id === "windows-real-device-evidence" ? 1 : 0,
          stdout: step.id === "windows-real-device-evidence"
            ? "blocked token=ghp_abcdefghijklmnopqrstuvwxyz1234567890"
            : "passed",
          stderr: ""
        };
      }
    });

    expect(calls).toHaveLength(readyReleaseSteps().length);
    expect(evidence.status).toBe("blocked");
    expect(evidence.blockers).toEqual([
      "pnpm verify:windows-real-device -- --require-device-evidence exited with code 1"
    ]);
    const blockedCommand = evidence.commands.find((command) => command.id === "windows-real-device-evidence");
    expect(blockedCommand?.stdout).toContain("<redacted>");
    expect(blockedCommand?.stdout).not.toContain("ghp_");
  });

  it("surfaces nested command blockers in aggregate evidence", async () => {
    const evidence = await runReadyReleaseVerification({
      runner: async (step) => {
        if (step.id !== "release-evidence-bundle-ready") {
          return { ...step, exitCode: 0, stdout: "{\"status\":\"passed\",\"blockers\":[]}", stderr: "" };
        }

        return {
          ...step,
          exitCode: 1,
          stdout: [
            "{",
            "  \"status\": \"blocked\",",
            "  \"blockers\": [\"$.bundleDir: must exist before verifying release evidence\"],",
            "  \"issues\": []",
            "}",
            " ELIFECYCLE  Command failed with exit code 1."
          ].join("\n"),
          stderr: ""
        };
      }
    });

    expect(evidence.blockers).toEqual([
      "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready exited with code 1"
    ]);
    expect(evidence.commandBlockers).toEqual([
      "release-evidence-bundle-ready: $.bundleDir: must exist before verifying release evidence"
    ]);
    expect(evidence.commands.find((command) => command.id === "release-evidence-bundle-ready")?.blockers).toEqual([
      "$.bundleDir: must exist before verifying release evidence"
    ]);
  });

  it("supports fail-fast for release lab reruns", async () => {
    const calls = [];
    const evidence = await runReadyReleaseVerification({
      failFast: true,
      runner: async (step) => {
        calls.push(step.id);
        return { ...step, exitCode: 1, stdout: "blocked", stderr: "" };
      }
    });

    expect(calls).toEqual(["signed-package-preflight-credentials"]);
    expect(evidence.status).toBe("blocked");
    expect(evidence.failFast).toBe(true);
  });

  it("lists planned commands without reporting blockers in plan-only mode", async () => {
    const evidence = await runReadyReleaseVerification({ planOnly: true });

    expect(evidence).toMatchObject({
      status: "planned",
      mode: "plan-only",
      releaseEvidenceBundleDir: "./solo-superman-release-evidence-bundle",
      blockers: [],
      commandBlockers: []
    });
    expect(evidence.commands).toHaveLength(readyReleaseSteps().length);
    expect(evidence.commands.every((command) => command.status === "planned")).toBe(true);
    expect(evidence.commands.every((command) => command.blockers.length === 0)).toBe(true);
  });

  it("passes a custom release evidence bundle directory through the ready-release sequence", async () => {
    const steps = readyReleaseSteps({ releaseEvidenceBundleDir: "./filled-bundle" });

    expect(steps.find((step) => step.id === "release-evidence-bundle-ready")).toMatchObject({
      args: ["verify:release-evidence-bundle", "--", "--bundle-dir", "./filled-bundle", "--require-ready"],
      display: "pnpm verify:release-evidence-bundle -- --bundle-dir ./filled-bundle --require-ready"
    });
  });

  it("parses timeout, fail-fast, and plan-only flags", () => {
    expect(parseReadyReleaseArgs(["--timeout-ms", "2000", "--fail-fast", "--plan-only", "--evidence-bundle-dir", "./bundle"], {})).toEqual({
      timeoutMs: 2000,
      releaseEvidenceBundleDir: "./bundle",
      failFast: true,
      planOnly: true
    });
    expect(parseReadyReleaseArgs([], {
      SOLO_READY_RELEASE_TIMEOUT_MS: "3000",
      SOLO_RELEASE_EVIDENCE_BUNDLE_DIR: "./env-bundle"
    })).toMatchObject({ timeoutMs: 3000, releaseEvidenceBundleDir: "./env-bundle" });
    expect(parseReadyReleaseArgs(["--evidence-bundle-dir=./equals-bundle"], {})).toMatchObject({ releaseEvidenceBundleDir: "./equals-bundle" });
    expect(() => parseReadyReleaseArgs(["--evidence-bundle-dir"], {})).toThrow("--evidence-bundle-dir requires a path value");
    expect(() => parseReadyReleaseArgs(["--evidence-bundle-dir", ""], {})).toThrow("--evidence-bundle-dir requires a path value");
    expect(() => parseReadyReleaseArgs([], { SOLO_RELEASE_EVIDENCE_BUNDLE_DIR: "" })).toThrow("SOLO_RELEASE_EVIDENCE_BUNDLE_DIR must be a non-empty path when set");
    expect(() => parseReadyReleaseArgs(["--timeout-ms", "0"], {})).toThrow("--timeout-ms requires a positive integer value");
  });
});
