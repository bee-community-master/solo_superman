import { describe, expect, it } from "vitest";
import {
  READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
  evidenceForReadyReleaseResults,
  extractReadyReleaseCommandBlockers,
  parseReadyReleaseArgs,
  readyReleaseSteps,
  releaseEvidenceBlockerSummary,
  releaseEvidenceIssuePreparation,
  runReadyReleaseVerification
} from "./verify-ready-release.mjs";
import {
  buildReleaseEvidenceChecklist,
  loadReleaseEvidenceContracts
} from "./release-evidence-checklist.mjs";

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
      releaseEvidenceBundlePreparation: {
        id: "release-evidence-bundle-preparation",
        status: "unchecked",
        command: "pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle"
      },
      releaseEvidenceBlockerSummary: {
        status: "unknown",
        issueCount: 0,
        blockedIssueCount: 0,
        totalItemCount: 0,
        blockedItemCount: 0
      },
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

  it("summarizes verbose template field blockers while keeping file-level blockers", () => {
    const stdout = [
      "{",
      "  \"status\": \"blocked\",",
      "  \"blockers\": [",
      "    \"file:issue-259-template.json: ready template validation must pass\",",
      "    \"file:issue-259-template.json: $.templateStatus must be \\\"ready\\\" after evidence is collected.\",",
      "    \"file:issue-259-template.json: $.items[0].verification.verifiedAt must replace template placeholder \\\"<UTC ISO timestamp>\\\".\",",
      "    \"file:issue-266-template.json: ready template validation must pass\",",
      "    \"file:issue-266-template.json: $.summary.pendingItems must be 0 after evidence is collected.\"",
      "  ],",
      "  \"issues\": []",
      "}",
      " ELIFECYCLE  Command failed with exit code 1."
    ].join("\n");

    expect(extractReadyReleaseCommandBlockers({ stdout })).toEqual([
      "file:issue-259-template.json: ready template validation must pass",
      "file:issue-266-template.json: ready template validation must pass",
      "file:issue-259-template.json: 2 template field blocker(s) omitted; fill release evidence placeholders and inspect command stdout for exact fields.",
      "file:issue-266-template.json: 1 template field blocker(s) omitted; fill release evidence placeholders and inspect command stdout for exact fields."
    ]);
  });

  it("runs every gate by default and redacts blocked command output", async () => {
    const calls = [];
    const evidence = await runReadyReleaseVerification({
      timeoutMs: 5000,
      releaseEvidenceBundleDirStatus: "present",
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

  it("bounds reported command output so aggregate ready-release evidence stays readable", async () => {
    const evidence = await runReadyReleaseVerification({
      releaseEvidenceBundleDirStatus: "present",
      runner: async (step) => ({
        ...step,
        exitCode: step.id === "signed-package-release-evidence" ? 1 : 0,
        stdout: step.id === "signed-package-release-evidence"
          ? `${"x".repeat(4_500)} token=ghp_abcdefghijklmnopqrstuvwxyz1234567890`
          : "{\"status\":\"passed\",\"blockers\":[]}",
        stderr: ""
      })
    });

    const blockedCommand = evidence.commands.find((command) => command.id === "signed-package-release-evidence");
    expect(blockedCommand?.stdout).toContain("redacted chars omitted");
    expect(blockedCommand?.stdout).not.toContain("ghp_");
    expect(blockedCommand?.stdout.length).toBeLessThan(4_200);
  });

  it("surfaces nested command blockers in aggregate evidence", async () => {
    const evidence = await runReadyReleaseVerification({
      releaseEvidenceBundleDirStatus: "present",
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
      releaseEvidenceBundleDirStatus: "present",
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
    const evidence = await runReadyReleaseVerification({
      planOnly: true,
      now: new Date("2026-05-24T00:00:00.000Z")
    });

    expect(evidence).toMatchObject({
      status: "planned",
      mode: "plan-only",
      releaseEvidenceBundleDir: "./solo-superman-release-evidence-bundle",
      releaseEvidenceBundlePreparation: {
        status: "planned",
        command: "pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle",
        requiredBefore: "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready"
      },
      releaseEvidenceBlockerSummary: {
        status: "blocked",
        issueNumbers: [259, 266, 267],
        blockedIssueNumbers: [259, 266, 267],
        issueCount: 3,
        blockedIssueCount: 3,
        totalItemCount: 9,
        blockedItemCount: 9
      },
      blockers: [],
      commandBlockers: []
    });
    expect(evidence.releaseEvidenceIssuePreparation).toEqual([
      expect.objectContaining({
        issueNumber: 259,
        templatePath: "./solo-superman-release-evidence-bundle/issue-259-template.json",
        commentPath: "./solo-superman-release-evidence-bundle/issue-259-comment.md",
        validateTemplateCommand:
          "pnpm verify:release-evidence-template -- --input ./solo-superman-release-evidence-bundle/issue-259-template.json --issue 259",
        postIssueCommentCommand:
          "gh issue comment 259 --body-file ./solo-superman-release-evidence-bundle/issue-259-comment.md"
      }),
      expect.objectContaining({
        issueNumber: 266,
        templatePath: "./solo-superman-release-evidence-bundle/issue-266-template.json",
        commentPath: "./solo-superman-release-evidence-bundle/issue-266-comment.md"
      }),
      expect.objectContaining({
        issueNumber: 267,
        templatePath: "./solo-superman-release-evidence-bundle/issue-267-template.json",
        commentPath: "./solo-superman-release-evidence-bundle/issue-267-comment.md"
      })
    ]);
    expect(evidence.commands).toHaveLength(readyReleaseSteps().length);
    expect(evidence.commands.every((command) => command.status === "planned")).toBe(true);
    expect(evidence.commands.every((command) => command.blockers.length === 0)).toBe(true);
    expect(evidence.checked).toContain(
      "plan-only release evidence blocker summary reports blocker issue and blocked item counts before release-lab handoff"
    );
    expect(evidence.checked).toContain(
      "issue-specific release evidence templates, comments, and validation commands are surfaced before release-lab handoff"
    );
  });

  it("summarizes release evidence blocker issues and item counts for operator handoff", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issuePrep = releaseEvidenceIssuePreparation(checklist, {
      releaseEvidenceBundleDir: "./filled-release-bundle"
    });

    expect(releaseEvidenceBlockerSummary(issuePrep)).toMatchObject({
      status: "blocked",
      issueNumbers: [259, 266, 267],
      blockedIssueNumbers: [259, 266, 267],
      issueCount: 3,
      blockedIssueCount: 3,
      totalItemCount: 9,
      blockedItemCount: 9,
      nextAction: expect.stringContaining("release evidence bundle")
    });
  });

  it("builds issue-specific release evidence preparation records for the selected bundle directory", async () => {
    const checklist = buildReleaseEvidenceChecklist(await loadReleaseEvidenceContracts(), {
      now: new Date("2026-05-24T00:00:00.000Z")
    });
    const issuePrep = releaseEvidenceIssuePreparation(checklist, {
      releaseEvidenceBundleDir: "./filled-release-bundle"
    });

    expect(issuePrep.map((entry) => entry.issueNumber)).toEqual([259, 266, 267]);
    expect(issuePrep[0]).toMatchObject({
      issueUrl: "https://github.com/bee-community-master/solo_superman/issues/259",
      itemCount: 2,
      blockedItems: 2,
      checklistPath: "./filled-release-bundle/issue-259-checklist.md",
      templatePath: "./filled-release-bundle/issue-259-template.json",
      commentPath: "./filled-release-bundle/issue-259-comment.md",
      fillTemplateAction: "Fill ./filled-release-bundle/issue-259-template.json with redacted release lab evidence only.",
      validateTemplateCommand:
        "pnpm verify:release-evidence-template -- --input ./filled-release-bundle/issue-259-template.json --issue 259",
      postIssueCommentCommand: "gh issue comment 259 --body-file ./filled-release-bundle/issue-259-comment.md"
    });
    expect(JSON.stringify(issuePrep)).not.toContain("ghp_");
  });

  it("passes a custom release evidence bundle directory through the ready-release sequence", async () => {
    const steps = readyReleaseSteps({ releaseEvidenceBundleDir: "./filled-bundle" });

    expect(steps.find((step) => step.id === "release-evidence-bundle-ready")).toMatchObject({
      args: ["verify:release-evidence-bundle", "--", "--bundle-dir", "./filled-bundle", "--require-ready"],
      display: "pnpm verify:release-evidence-bundle -- --bundle-dir ./filled-bundle --require-ready"
    });
  });

  it("surfaces the release evidence bundle preparation command when the bundle directory is missing", async () => {
    const evidence = await runReadyReleaseVerification({
      releaseEvidenceBundleDirStatus: "missing",
      runner: async (step) => ({ ...step, exitCode: 0, stdout: "{\"status\":\"passed\",\"blockers\":[]}", stderr: "" })
    });

    expect(evidence.status).toBe("blocked");
    expect(evidence.releaseEvidenceBundlePreparation).toMatchObject({
      id: "release-evidence-bundle-preparation",
      status: "missing",
      command: "pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle",
      bundleDir: "./solo-superman-release-evidence-bundle"
    });
    expect(evidence.blockers).toEqual([
      "release-evidence-bundle-preparation: ./solo-superman-release-evidence-bundle is missing; run pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle before filling real evidence and running final ready-release."
    ]);
    expect(evidence.commandBlockers).toEqual(evidence.blockers);
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
