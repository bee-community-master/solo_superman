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

const releaseEvidenceIssueItemCounts = new Map([
  [259, 2],
  [266, 4],
  [267, 3]
]);

function fakeReadyReleaseChecklistItems(issueNumber, itemCount) {
  return Array.from({ length: itemCount }, (_, index) => ({
    itemId: `issue-${issueNumber}-evidence-item-${index + 1}`,
    gateId: issueNumber === 259 ? "windows-real-device" : issueNumber === 266 ? "signed-packages" : "packaged-update-rollback",
    status: "blocked",
    scope: issueNumber === 259 ? "windows" : null,
    requiredChecks: index === 0 ? [] : [`check-${index}-a`, `check-${index}-b`],
    requiredEvidence: [`evidence-${index + 1}-a`, `evidence-${index + 1}-b`],
    unblockCriteria: [`unblock-${index + 1}`]
  }));
}

function fakeReadyReleaseIssuePreparation() {
  return [...releaseEvidenceIssueItemCounts].map(([issueNumber, itemCount]) => ({
    issueNumber,
    issueUrl: `https://github.com/bee-community-master/solo_superman/issues/${issueNumber}`,
    status: "blocked",
    itemCount,
    blockedItems: itemCount,
    checklistItems: fakeReadyReleaseChecklistItems(issueNumber, itemCount),
    checklistPath: `./solo-superman-release-evidence-bundle/issue-${issueNumber}-checklist.md`,
    templatePath: `./solo-superman-release-evidence-bundle/issue-${issueNumber}-template.json`,
    commentPath: `./solo-superman-release-evidence-bundle/issue-${issueNumber}-comment.md`,
    fillTemplateAction:
      `Fill ./solo-superman-release-evidence-bundle/issue-${issueNumber}-template.json with redacted release lab evidence only.`,
    validateTemplateCommand:
      `pnpm verify:release-evidence-template -- --input ./solo-superman-release-evidence-bundle/issue-${issueNumber}-template.json --issue ${issueNumber}`,
    postIssueCommentCommand:
      `gh issue comment ${issueNumber} --body-file ./solo-superman-release-evidence-bundle/issue-${issueNumber}-comment.md`
  }));
}

function fakeCommandRunner(command, args) {
  const key = [command, ...args].join(" ");
  const outputs = new Map([
    ["git branch --show-current", "main"],
    ["git rev-parse --short HEAD", "abc1234"],
    ["git status --short --branch", "## main...origin/main\n?? local-note.txt"],
    ["git remote get-url origin", "https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/bee-community-master/solo_superman.git?token=secret-value"],
    ["pnpm --version", "11.0.4"],
    ["codex --version", "codex 0.128.0"],
    [`${process.execPath} scripts/verify-product-capability-readiness.mjs`, JSON.stringify({
      status: "passed",
      schemaVersion: "solo-superman-product-capability-readiness.v1",
      mode: "contract",
      coreProductStatus: "code_backed",
      coreProductCodeBacked: true,
      blockedCapabilities: [],
      blockers: [],
      checked: ["all technical-preview core capabilities are code-backed"]
    })],
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
    [`${process.execPath} scripts/verify-windows-installer-dry-run.mjs`, JSON.stringify({
      schemaVersion: "solo-superman-windows-installer-dry-run.v1",
      status: "passed",
      mode: "credential-free-static-dry-run",
      upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
      issues: [],
      checked: ["dry-run stays credential-free and does not replace real Windows device evidence for #259"]
    })],
    [`${process.execPath} scripts/verify-packaged-update-rollback.mjs`, JSON.stringify({
      status: "passed",
      rollbackStatus: "blocked",
      packagedUpdateRollbackReady: false,
      blockedDeviceRuns: ["macos-packaged-update-rollback", "windows-packaged-update-rollback"],
      blockers: [],
      checked: ["blocked packaged update rollback posture is allowed only with explicit blockers"]
    })],
    [`${process.execPath} scripts/verify-packaged-update-rollback-dry-run.mjs`, JSON.stringify({
      schemaVersion: "solo-superman-packaged-update-rollback-dry-run.v1",
      status: "passed",
      mode: "credential-free-fixture",
      upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
      finalVersion: "0.1.0",
      issues: [],
      checked: ["dry-run remains credential-free and does not replace signed package or device evidence for #267"]
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
    [`${process.execPath} scripts/verify-signed-package-release-dry-run.mjs`, JSON.stringify({
      schemaVersion: "solo-superman-signed-package-release-dry-run.v1",
      status: "passed",
      mode: "credential-free-fixture",
      upstreamReleaseEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
      manifestSummary: { artifactCount: 2, publicKeyId: "solo-superman-fixture-release-manifest-public-key" },
      issues: [],
      checked: ["dry-run remains credential-free and does not replace signing/notarization/Authenticode/manifest evidence for #266"]
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
    })],
    [`${process.execPath} scripts/verify-ready-release.mjs --plan-only`, JSON.stringify({
      status: "planned",
      schemaVersion: "solo-superman-ready-release-verification.v1",
      mode: "plan-only",
      releaseEvidenceBundleDir: "./solo-superman-release-evidence-bundle",
      releaseEvidenceBundlePreparation: {
        status: "planned",
        command: "pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle",
        bundleDir: "./solo-superman-release-evidence-bundle",
        requiredBefore: "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready"
      },
      releaseEvidenceBlockerSummary: {
        status: "blocked",
        issueNumbers: [259, 266, 267],
        blockedIssueNumbers: [259, 266, 267],
        issueCount: 3,
        blockedIssueCount: 3,
        totalItemCount: 9,
        blockedItemCount: 9,
        nextAction: "Prepare the release evidence bundle, fill each blocked issue template with redacted release-lab evidence, validate templates, then run ready-release with the filled bundle."
      },
      releaseEvidenceIssuePreparation: fakeReadyReleaseIssuePreparation(),
      ignoredVerboseLog: `diagnostic-padding-${"x".repeat(5_000)}`,
      blockers: [],
      commandBlockers: [],
      commands: [
        { command: "pnpm verify:signed-package-preflight -- --require-credentials" },
        { command: "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready" },
        { command: "pnpm verify:release-readiness -- --require-ready" }
      ],
      checked: ["release evidence bundle preparation prerequisite is surfaced before require-ready verification"]
    })],
    [`${process.execPath} scripts/verify-release-evidence-template.mjs`, JSON.stringify({
      status: "passed",
      schemaVersion: "solo-superman-release-evidence-template-validation.v1",
      mode: "credential-free-fixture",
      filterIssueNumber: "all",
      issueNumbers: [259, 266, 267],
      itemCount: 9,
      issues: [],
      checked: ["filled release evidence templates for every blocked release issue"]
    })],
    [`${process.execPath} scripts/verify-release-evidence-bundle.mjs`, JSON.stringify({
      status: "passed",
      schemaVersion: "solo-superman-release-evidence-bundle-validation.v1",
      mode: "generated-bundle",
      checklistStatus: "blocked",
      issueNumbers: [259, 266, 267],
      fileCount: 14,
      blockers: [],
      checked: ["release evidence bundle manifest schema"]
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
          verifyCodexLiveRuntime: "node scripts/verify-codex-live-runtime.mjs",
          verifyProductCapabilityReadiness: "node scripts/verify-product-capability-readiness.mjs",
          verifyReleaseChannel: "node scripts/verify-release-channel.mjs",
          verifyWindowsRealDevice: "node scripts/verify-windows-real-device.mjs",
          verifyWindowsInstallerDryRun: "node scripts/verify-windows-installer-dry-run.mjs",
          verifyPackagedUpdateRollback: "node scripts/verify-packaged-update-rollback.mjs",
          verifyPackagedUpdateRollbackDryRun: "node scripts/verify-packaged-update-rollback-dry-run.mjs",
          verifySignedPackagePreflight: "node scripts/verify-signed-package-preflight.mjs",
          verifySignedPackageRelease: "node scripts/verify-signed-package-release.mjs",
          verifySignedPackageReleaseDryRun: "node scripts/verify-signed-package-release-dry-run.mjs",
          verifyReleaseReadiness: "node scripts/verify-release-readiness.mjs",
          verifyReadyRelease: "node scripts/verify-ready-release.mjs",
          verifyReleaseEvidenceTemplate: "node scripts/verify-release-evidence-template.mjs",
          verifyReleaseEvidenceBundle: "node scripts/verify-release-evidence-bundle.mjs",
          verifySupportBundle: "node scripts/verify-support-bundle.mjs",
          supportBundle: "node scripts/support-bundle.mjs",
          releaseEvidenceChecklist: "node scripts/release-evidence-checklist.mjs",
          releaseEvidenceBundle: "node scripts/release-evidence-checklist.mjs --bundle-dir"
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
    const sample = [
      "https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/org/repo.git?token=secret-value",
      "sk-test_abcdefghijklmnopqrstuv",
      "github_pat_abcdefghijklmnopqrstuv",
      "xoxb-abcdefghijklmnopqrstuv",
      "Bearer abcdefghijklmnopqrstuv"
    ].join(" ");

    expect(redactSupportText(sample)).toBe([
      "https://<redacted>@github.com/org/repo.git?token=<redacted>",
      "<redacted>",
      "<redacted>",
      "<redacted>",
      "<redacted>"
    ].join(" "));
  });

  it("redacts token-like values before truncating support output", () => {
    const tokenCases = [
      { marker: "ghp_", value: `ghp_${"a".repeat(30)}` },
      { marker: "github_pat_", value: `github_pat_${"b".repeat(30)}` },
      { marker: "sk-", value: `sk-${"c".repeat(30)}` },
      { marker: "npm_", value: `npm_${"d".repeat(30)}` },
      { marker: "xoxb-", value: `xoxb-${"e".repeat(30)}` },
      { marker: "Bearer ", value: `Bearer ${"f".repeat(30)}` }
    ];

    for (const token of tokenCases) {
      const redacted = redactSupportText(`${"x".repeat(3995)} ${token.value}`);

      expect(redacted).not.toContain(token.marker);
      expect(redacted).not.toContain(token.value.slice(-20));
    }
  });

  it("captures credential-free support evidence without dumping secret environment values", async () => {
    const bundle = await createSupportBundle({
      cwd: "/Users/founder/solo_superman",
      homeDir: "/Users/founder",
      env: {
        CI: "true",
        SOLO_CODEX_WINDOWS_MODE: "wsl",
        SOLO_CODEX_SDK_LIVE_TURNS: "1",
        SOLO_CODEX_SDK_LIVE_TURN_TIMEOUT_MS: "9000",
        SOLO_VERIFY_CODEX_SDK_LIVE_RUNTIME: "1",
        SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR: "22",
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
    expect(bundle.env).toEqual({
      CI: "true",
      SOLO_CODEX_WINDOWS_MODE: "wsl",
      SOLO_CODEX_SDK_LIVE_TURNS: "1",
      SOLO_CODEX_SDK_LIVE_TURN_TIMEOUT_MS: "9000",
      SOLO_VERIFY_CODEX_SDK_LIVE_RUNTIME: "1",
      SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR: "22"
    });
    expect(bundle.package.scripts.supportBundle).toBe("node scripts/support-bundle.mjs");
    expect(bundle.package.scripts.verifyCodexLiveRuntime).toBe("node scripts/verify-codex-live-runtime.mjs");
    expect(bundle.package.scripts.verifyReleaseReadiness).toBe("node scripts/verify-release-readiness.mjs");
    expect(bundle.package.scripts.verifyProductCapabilityReadiness).toBe("node scripts/verify-product-capability-readiness.mjs");
    expect(bundle.package.scripts.verifyWindowsInstallerDryRun).toBe("node scripts/verify-windows-installer-dry-run.mjs");
    expect(bundle.package.scripts.verifyPackagedUpdateRollbackDryRun).toBe("node scripts/verify-packaged-update-rollback-dry-run.mjs");
    expect(bundle.package.scripts.verifySignedPackageReleaseDryRun).toBe("node scripts/verify-signed-package-release-dry-run.mjs");
    expect(bundle.package.scripts.verifyReleaseEvidenceTemplate).toBe("node scripts/verify-release-evidence-template.mjs");
    expect(bundle.package.scripts.verifyReadyRelease).toBe("node scripts/verify-ready-release.mjs");
    expect(bundle.package.scripts.verifyReleaseEvidenceBundle).toBe("node scripts/verify-release-evidence-bundle.mjs");
    expect(bundle.package.scripts.verifySupportBundle).toBe("node scripts/verify-support-bundle.mjs");
    expect(bundle.package.scripts.releaseEvidenceChecklist).toBe("node scripts/release-evidence-checklist.mjs");
    expect(bundle.package.scripts.releaseEvidenceBundle).toBe("node scripts/release-evidence-checklist.mjs --bundle-dir");
    expect(bundle.recommendedChecks).toContain("pnpm verify:codex-live-runtime");
    expect(bundle.recommendedChecks).toContain("pnpm verify:product-capability-readiness");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-channel");
    expect(bundle.recommendedChecks).toContain("pnpm verify:windows-real-device");
    expect(bundle.recommendedChecks).toContain("pnpm verify:windows-installer:dry-run");
    expect(bundle.recommendedChecks).toContain("pnpm verify:packaged-update-rollback");
    expect(bundle.recommendedChecks).toContain("pnpm verify:packaged-update-rollback:dry-run");
    expect(bundle.recommendedChecks).toContain("pnpm verify:signed-package-preflight");
    expect(bundle.recommendedChecks).toContain("pnpm verify:signed-package-release");
    expect(bundle.recommendedChecks).toContain("pnpm verify:signed-package-release:dry-run");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-readiness");
    expect(bundle.recommendedChecks).toContain("pnpm verify:ready-release -- --plan-only");
    expect(bundle.recommendedChecks).toContain("pnpm release:evidence-checklist");
    expect(bundle.recommendedChecks).toContain("pnpm release:evidence-bundle -- <bundle-dir>");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-evidence-template");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-evidence-bundle");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-evidence-template -- --input <filled-template.json>");
    expect(bundle.recommendedChecks).toContain("pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready");
    expect(bundle.recommendedChecks).toContain("pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>");
    expect(bundle.recommendedChecks).toContain("pnpm verify:support-bundle");
    expect(bundle.recommendedChecks.indexOf("pnpm release:evidence-bundle -- <bundle-dir>")).toBeLessThan(
      bundle.recommendedChecks.indexOf("pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready")
    );
    expect(bundle.recommendedChecks.indexOf("pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready")).toBeLessThan(
      bundle.recommendedChecks.indexOf("pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>")
    );
    expect(bundle.releaseDiagnostics.productCapabilityReadiness).toMatchObject({
      command: "pnpm verify:product-capability-readiness",
      captureStatus: "ok",
      evidenceStatus: "passed",
      coreProductStatus: "code_backed",
      coreProductCodeBacked: true,
      blockedCapabilities: []
    });
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
    expect(bundle.releaseDiagnostics.windowsInstallerDryRun).toMatchObject({
      command: "pnpm verify:windows-installer:dry-run",
      captureStatus: "ok",
      evidenceStatus: "passed",
      mode: "credential-free-static-dry-run",
      upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
      issues: []
    });
    expect(bundle.releaseDiagnostics.packagedUpdateRollback).toMatchObject({
      command: "pnpm verify:packaged-update-rollback",
      captureStatus: "ok",
      evidenceStatus: "passed",
      rollbackStatus: "blocked",
      packagedUpdateRollbackReady: false,
      blockedDeviceRuns: ["macos-packaged-update-rollback", "windows-packaged-update-rollback"]
    });
    expect(bundle.releaseDiagnostics.packagedUpdateRollbackDryRun).toMatchObject({
      command: "pnpm verify:packaged-update-rollback:dry-run",
      captureStatus: "ok",
      evidenceStatus: "passed",
      mode: "credential-free-fixture",
      upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
      finalVersion: "0.1.0",
      issues: []
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
    expect(bundle.releaseDiagnostics.signedPackageReleaseDryRun).toMatchObject({
      command: "pnpm verify:signed-package-release:dry-run",
      captureStatus: "ok",
      evidenceStatus: "passed",
      mode: "credential-free-fixture",
      upstreamReleaseEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
      manifestSummary: { artifactCount: 2, publicKeyId: "solo-superman-fixture-release-manifest-public-key" },
      issues: []
    });
    expect(bundle.releaseDiagnostics.releaseReadiness).toMatchObject({
      command: "pnpm verify:release-readiness",
      captureStatus: "ok",
      evidenceStatus: "passed",
      readinessStatus: "blocked",
      broadReleaseReady: false,
      blockedGates: ["signed-packages", "packaged-update-rollback", "windows-real-device"]
    });
    expect(bundle.releaseDiagnostics.readyReleasePlan).toMatchObject({
      command: "pnpm verify:ready-release -- --plan-only",
      captureStatus: "ok",
      evidenceStatus: "planned",
      mode: "plan-only",
      releaseEvidenceBundleDir: "./solo-superman-release-evidence-bundle",
      releaseEvidenceBundlePreparation: {
        status: "planned",
        command: "pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle",
        bundleDir: "./solo-superman-release-evidence-bundle",
        requiredBefore: "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready"
      },
      releaseEvidenceBlockerSummary: {
        status: "blocked",
        issueNumbers: ["259", "266", "267"],
        blockedIssueNumbers: ["259", "266", "267"],
        issueCount: 3,
        blockedIssueCount: 3,
        totalItemCount: 9,
        blockedItemCount: 9,
        nextAction: expect.stringContaining("release evidence bundle")
      },
      releaseEvidenceIssuePreparation: fakeReadyReleaseIssuePreparation().map((entry) =>
        expect.objectContaining({
          issueNumber: entry.issueNumber,
          status: "blocked",
          blockedItems: entry.blockedItems,
          checklistItems: entry.checklistItems.map((item) =>
            expect.objectContaining({
              itemId: item.itemId,
              gateId: item.gateId,
              status: item.status,
              requiredCheckCount: item.requiredChecks.length,
              requiredEvidenceCount: item.requiredEvidence.length,
              unblockCriteriaCount: item.unblockCriteria.length
            })
          ),
          templatePath: entry.templatePath,
          commentPath: entry.commentPath,
          validateTemplateCommand: entry.validateTemplateCommand,
          postIssueCommentCommand: entry.postIssueCommentCommand
        })
      ),
      plannedCommands: [
        "pnpm verify:signed-package-preflight -- --require-credentials",
        "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready",
        "pnpm verify:release-readiness -- --require-ready"
      ],
      blockers: [],
      commandBlockers: []
    });
    expect(bundle.releaseDiagnostics.releaseEvidenceTemplate).toMatchObject({
      command: "pnpm verify:release-evidence-template",
      captureStatus: "ok",
      evidenceStatus: "passed",
      mode: "credential-free-fixture",
      filterIssueNumber: "all",
      issueNumbers: ["259", "266", "267"],
      itemCount: 9,
      issues: []
    });
    expect(bundle.releaseDiagnostics.releaseEvidenceBundle).toMatchObject({
      command: "pnpm verify:release-evidence-bundle",
      captureStatus: "ok",
      evidenceStatus: "passed",
      mode: "generated-bundle",
      checklistStatus: "blocked",
      issueNumbers: ["259", "266", "267"],
      fileCount: 14,
      blockers: []
    });
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
    expect(serialized).not.toContain("diagnostic-padding");
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
