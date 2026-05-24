import { describe, expect, it } from "vitest";
import {
  READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
  evidenceForReadyReleaseResults,
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
      blockers: []
    });
    expect(evidence.commands.every((command) => command.status === "passed")).toBe(true);
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
      blockers: []
    });
    expect(evidence.commands).toHaveLength(readyReleaseSteps().length);
    expect(evidence.commands.every((command) => command.status === "planned")).toBe(true);
  });

  it("parses timeout, fail-fast, and plan-only flags", () => {
    expect(parseReadyReleaseArgs(["--timeout-ms", "2000", "--fail-fast", "--plan-only"], {})).toEqual({
      timeoutMs: 2000,
      failFast: true,
      planOnly: true
    });
    expect(parseReadyReleaseArgs([], { SOLO_READY_RELEASE_TIMEOUT_MS: "3000" }).timeoutMs).toBe(3000);
    expect(() => parseReadyReleaseArgs(["--timeout-ms", "0"], {})).toThrow("--timeout-ms requires a positive integer value");
  });
});
