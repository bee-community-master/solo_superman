import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  SUPPORT_BUNDLE_SCHEMA_VERSION,
  createSupportBundle,
  parseSupportBundleArgs,
  redactSupportText,
  writeSupportBundle
} from "./support-bundle.mjs";

function fakeCommandRunner(command, args) {
  const key = [command, ...args].join(" ");
  const outputs = new Map([
    ["git branch --show-current", "main"],
    ["git rev-parse --short HEAD", "abc1234"],
    ["git status --short --branch", "## main...origin/main\n?? local-note.txt"],
    ["git remote get-url origin", "https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/bee-community-master/solo_superman.git?token=secret-value"],
    ["pnpm --version", "11.0.4"],
    ["codex --version", "codex 0.128.0"],
    [`${process.execPath} scripts/verify-release-channel.mjs`, JSON.stringify({
      status: "passed",
      manifestPath: "docs/release-update-channel.example.json",
      issues: [],
      checked: ["release URLs are HTTPS and credential-free"]
    })],
    [`${process.execPath} scripts/verify-windows-real-device.mjs`, JSON.stringify({
      status: "passed",
      windowsVerificationStatus: "blocked",
      windowsRealDeviceReady: false,
      blockedDeviceRuns: ["windows-one-line-install-first-screen"],
      blockers: [],
      checked: ["blocked Windows real-device posture is allowed only with explicit blockers"]
    })],
    [`${process.execPath} scripts/verify-packaged-update-rollback.mjs`, JSON.stringify({
      status: "passed",
      rollbackStatus: "blocked",
      packagedUpdateRollbackReady: false,
      blockedDeviceRuns: ["macos-packaged-update-rollback", "windows-packaged-update-rollback"],
      blockers: [],
      checked: ["blocked packaged update rollback posture is allowed only with explicit blockers"]
    })],
    [`${process.execPath} scripts/verify-signed-package-preflight.mjs`, JSON.stringify({
      status: "passed",
      contractPath: "docs/signed-package-preflight.example.json",
      credentialGateStatus: "blocked",
      missingCredentialGroups: [
        { id: "macos-developer-id", status: "missing", requiredEnv: ["APPLE_ID"], missingEnv: ["APPLE_ID"] },
        { id: "windows-authenticode", status: "missing", requiredEnv: ["WINDOWS_CERT_PASSWORD"], missingEnv: ["WINDOWS_CERT_PASSWORD"] }
      ],
      issues: [],
      checked: ["signing credential groups are named without exposing values"]
    })],
    [`${process.execPath} scripts/verify-signed-package-release.mjs`, JSON.stringify({
      status: "passed",
      releaseEvidenceStatus: "blocked",
      signedPackageReleaseReady: false,
      blockedEvidenceRuns: ["macos-signed-package-release", "windows-signed-package-release", "release-manifest-signing"],
      blockers: [],
      checked: ["blocked signed package release posture is allowed only with explicit blockers"]
    })],
    [`${process.execPath} scripts/verify-release-readiness.mjs`, JSON.stringify({
      status: "passed",
      schemaVersion: "solo-superman-release-readiness.v1",
      mode: "contract",
      readinessStatus: "blocked",
      broadReleaseReady: false,
      blockedGates: ["signed-packages", "packaged-update-rollback", "windows-real-device"],
      blockers: [],
      checked: ["blocked broad-release posture is allowed only with explicit blockers"]
    })]
  ]);

  if (command === process.execPath && args[0] === "-e") {
    return Promise.resolve({
      status: "ok",
      stdout: JSON.stringify({
        name: "solo-superman-workspace",
        version: "0.1.0",
        packageManager: "pnpm@11.0.4",
        engines: { node: ">=24.0.0" },
        scripts: {
          startLocal: "node scripts/start-local-web.mjs",
          verify: "pnpm typecheck && pnpm lint",
          verifyProdBundle: "node scripts/verify-prod-bundle.mjs",
          verifyReleaseChannel: "node scripts/verify-release-channel.mjs",
          verifyWindowsRealDevice: "node scripts/verify-windows-real-device.mjs",
          verifyPackagedUpdateRollback: "node scripts/verify-packaged-update-rollback.mjs",
          verifySignedPackagePreflight: "node scripts/verify-signed-package-preflight.mjs",
          verifySignedPackageRelease: "node scripts/verify-signed-package-release.mjs",
          verifyReleaseReadiness: "node scripts/verify-release-readiness.mjs",
          supportBundle: "node scripts/support-bundle.mjs"
        }
      }),
      stderr: ""
    });
  }

  return Promise.resolve({
    status: outputs.has(key) ? "ok" : "unavailable",
    stdout: outputs.get(key) ?? "",
    stderr: ""
  });
}

describe("support diagnostics bundle", () => {
  it("redacts URL credentials, query secrets, and known token shapes", () => {
    expect(redactSupportText("https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/org/repo.git?token=secret-value sk-test_abcdefghijklmnopqrstuv"))
      .toBe("https://<redacted>@github.com/org/repo.git?token=<redacted> <redacted>");
  });

  it("captures credential-free support evidence without dumping secret environment values", async () => {
    const bundle = await createSupportBundle({
      cwd: "/Users/founder/solo_superman",
      homeDir: "/Users/founder",
      env: {
        CI: "true",
        SOLO_CODEX_WINDOWS_MODE: "wsl",
        SOLO_LOCAL_CAPABILITY_TOKEN: "secret-token",
        OPENAI_API_KEY: "sk-secret"
      },
      commandRunner: fakeCommandRunner
    });
    const serialized = JSON.stringify(bundle);

    expect(bundle.schemaVersion).toBe(SUPPORT_BUNDLE_SCHEMA_VERSION);
    expect(bundle.repo.cwd).toBe("~/solo_superman");
    expect(bundle.repo.branch).toBe("main");
    expect(bundle.repo.remoteOrigin).toBe("https://<redacted>@github.com/bee-community-master/solo_superman.git?token=<redacted>");
    expect(bundle.env).toEqual({ CI: "true", SOLO_CODEX_WINDOWS_MODE: "wsl" });
    expect(bundle.package.scripts.supportBundle).toBe("node scripts/support-bundle.mjs");
    expect(bundle.package.scripts.verifyReleaseReadiness).toBe("node scripts/verify-release-readiness.mjs");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-channel");
    expect(bundle.recommendedChecks).toContain("pnpm verify:windows-real-device");
    expect(bundle.recommendedChecks).toContain("pnpm verify:packaged-update-rollback");
    expect(bundle.recommendedChecks).toContain("pnpm verify:signed-package-preflight");
    expect(bundle.recommendedChecks).toContain("pnpm verify:signed-package-release");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-readiness");
    expect(bundle.releaseDiagnostics.releaseChannel).toMatchObject({
      command: "pnpm verify:release-channel",
      captureStatus: "ok",
      evidenceStatus: "passed",
      manifestPath: "docs/release-update-channel.example.json"
    });
    expect(bundle.releaseDiagnostics.windowsRealDevice).toMatchObject({
      command: "pnpm verify:windows-real-device",
      captureStatus: "ok",
      evidenceStatus: "passed",
      windowsVerificationStatus: "blocked",
      windowsRealDeviceReady: false,
      blockedDeviceRuns: ["windows-one-line-install-first-screen"]
    });
    expect(bundle.releaseDiagnostics.packagedUpdateRollback).toMatchObject({
      command: "pnpm verify:packaged-update-rollback",
      captureStatus: "ok",
      evidenceStatus: "passed",
      rollbackStatus: "blocked",
      packagedUpdateRollbackReady: false,
      blockedDeviceRuns: ["macos-packaged-update-rollback", "windows-packaged-update-rollback"]
    });
    expect(bundle.releaseDiagnostics.signedPackagePreflight).toMatchObject({
      command: "pnpm verify:signed-package-preflight",
      captureStatus: "ok",
      evidenceStatus: "passed",
      credentialGateStatus: "blocked",
      missingCredentialGroups: [
        { id: "macos-developer-id", status: "missing", missingEnv: ["APPLE_ID"] },
        { id: "windows-authenticode", status: "missing", missingEnv: ["WINDOWS_CERT_PASSWORD"] }
      ]
    });
    expect(bundle.releaseDiagnostics.signedPackageRelease).toMatchObject({
      command: "pnpm verify:signed-package-release",
      captureStatus: "ok",
      evidenceStatus: "passed",
      releaseEvidenceStatus: "blocked",
      signedPackageReleaseReady: false,
      blockedEvidenceRuns: ["macos-signed-package-release", "windows-signed-package-release", "release-manifest-signing"]
    });
    expect(bundle.releaseDiagnostics.releaseReadiness).toMatchObject({
      command: "pnpm verify:release-readiness",
      captureStatus: "ok",
      evidenceStatus: "passed",
      readinessStatus: "blocked",
      broadReleaseReady: false,
      blockedGates: ["signed-packages", "packaged-update-rollback", "windows-real-device"]
    });
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
  });

  it("parses output path overrides and writes JSON bundles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "solo-support-bundle-test-"));
    try {
      const outputPath = join(dir, "bundle.json");
      expect(parseSupportBundleArgs(["--output", outputPath], {})).toEqual({ outputPath });
      expect(parseSupportBundleArgs(["--", "--output", outputPath], {})).toEqual({ outputPath });
      expect(() => parseSupportBundleArgs(["--output"], {})).toThrow("--output requires a path value");
      await writeSupportBundle(outputPath, { schemaVersion: SUPPORT_BUNDLE_SCHEMA_VERSION, ok: true });
      await expect(readFile(outputPath, "utf8")).resolves.toContain(SUPPORT_BUNDLE_SCHEMA_VERSION);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
