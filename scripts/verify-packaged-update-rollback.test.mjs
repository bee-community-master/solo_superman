import { describe, expect, it } from "vitest";
import {
  PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION,
  evaluatePackagedUpdateRollback,
  parsePackagedUpdateRollbackArgs,
  validatePackagedUpdateRollbackContract
} from "./verify-packaged-update-rollback.mjs";

const REQUIRED_ROLLBACK_CHECKS = [
  "install_signed_package",
  "apply_update",
  "defer_update",
  "retry_failed_update",
  "rollback_after_failed_launch",
  "launch_after_rollback",
  "preserve_user_data",
  "preserve_credentials"
];

const REQUIRED_PROTECTED_PATHS = [
  "localDatabase",
  "generatedWorkspace",
  "supportBundle",
  "operatorFiles",
  "credentials"
];

function blockedContract(overrides = {}) {
  return {
    schemaVersion: PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION,
    appId: "solo-superman",
    rollbackStatus: "blocked",
    summary: "Packaged update rollback remains blocked until device evidence exists.",
    releaseChannelContract: "docs/release-channel_KO.md",
    releaseUpdateManifest: "docs/release-update-channel.example.json",
    blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
    requiredVerificationCommands: {
      credentialFree: [
        "pnpm verify:release-channel",
        "pnpm verify:packaged-update-rollback",
        "pnpm verify:packaged-update-rollback:dry-run",
        "pnpm verify:release-readiness",
        "pnpm verify"
      ],
      deviceEvidence: [
        "pnpm verify:packaged-update-rollback -- --require-device-evidence",
        "pnpm verify:release-readiness -- --require-ready"
      ]
    },
    preservationRequirements: [
      "Rollback may replace only packaged app binaries and release metadata.",
      "Rollback must preserve local databases.",
      "Rollback must preserve credentials."
    ],
    deviceRuns: [
      {
        id: "macos-packaged-update-rollback",
        platform: "macos",
        status: "blocked",
        requiredFor: "general-release",
        blocker: "macOS packaged artifact device evidence is missing.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
        evidenceRefs: ["docs/release-channel_KO.md"],
        requiredChecks: REQUIRED_ROLLBACK_CHECKS,
        requiredEvidence: ["macOS update rollback evidence"],
        unblockCriteria: ["Attach macOS rollback evidence to #267"]
      },
      {
        id: "windows-packaged-update-rollback",
        platform: "windows",
        status: "blocked",
        requiredFor: "general-release",
        blocker: "Windows packaged artifact device evidence is missing.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
        evidenceRefs: ["docs/release-channel_KO.md", "https://github.com/bee-community-master/solo_superman/issues/259"],
        requiredChecks: REQUIRED_ROLLBACK_CHECKS,
        requiredEvidence: ["Windows update rollback evidence"],
        unblockCriteria: ["Attach Windows rollback evidence to #267"]
      }
    ],
    ...overrides
  };
}

function passedEvidenceBundle(platform, overrides = {}) {
  const checkEvidenceRefs = Object.fromEntries(
    REQUIRED_ROLLBACK_CHECKS.map((check) => [check, `evidence/${platform}-rollback/${check}.json`])
  );
  const protectedPathEvidenceRefs = Object.fromEntries(
    REQUIRED_PROTECTED_PATHS.map((pathClass) => [pathClass, `evidence/${platform}-rollback/preserve-${pathClass}.json`])
  );
  const packageKind = platform === "macos" ? "macos-dmg" : "windows-msi";
  return {
    deviceProfile: {
      platform,
      osName: platform === "macos" ? "macOS" : "Windows 11 Pro",
      osVersion: platform === "macos" ? "14.7" : "23H2 build 22631",
      architecture: platform === "macos" ? "arm64" : "x64",
      environmentKind: "vm"
    },
    packageKind,
    initialVersion: "0.1.0",
    candidateVersion: "0.1.1",
    finalVersion: "0.1.0",
    credentialSnapshotMode: "metadata_only_no_read",
    packageArtifactRef: `evidence/${platform}-rollback/package.${packageKind === "macos-dmg" ? "dmg" : "msi"}`,
    manifestRef: `evidence/${platform}-rollback/release-manifest.json`,
    updateLogRef: `evidence/${platform}-rollback/update.log`,
    rollbackLogRef: `evidence/${platform}-rollback/rollback.log`,
    launchAfterRollbackRef: `evidence/${platform}-rollback/launch-after-rollback.log`,
    preservationReportRef: `evidence/${platform}-rollback/preservation-report.json`,
    redactedEvidenceRefs: [`evidence/${platform}-rollback/redaction-report.json`],
    passedChecks: REQUIRED_ROLLBACK_CHECKS,
    checkEvidenceRefs,
    protectedPathEvidenceRefs,
    ...overrides
  };
}

function passedRun(run, platform, overrides = {}) {
  const rest = { ...run };
  delete rest.blocker;
  delete rest.blockerIssue;
  return {
    ...rest,
    platform,
    status: "passed",
    verifiedAt: "2026-05-23T00:00:00Z",
    verifiedBy: [`device-lab:${platform}`],
    evidenceBundle: passedEvidenceBundle(platform),
    ...overrides
  };
}

describe("packaged update rollback verification", () => {
  it("passes default contract mode when rollback evidence is explicitly blocked", () => {
    const evaluation = evaluatePackagedUpdateRollback(blockedContract());

    expect(evaluation).toMatchObject({
      ok: true,
      rollbackStatus: "blocked",
      packagedUpdateRollbackReady: false,
      blockedDeviceRuns: ["macos-packaged-update-rollback", "windows-packaged-update-rollback"],
      blockers: []
    });
  });

  it("fails require-device-evidence mode until every device run has passed", () => {
    const evaluation = evaluatePackagedUpdateRollback(blockedContract(), { requireDeviceEvidence: true });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      "packaged update rollback evidence is not ready",
      "macos-packaged-update-rollback device run is still blocked",
      "windows-packaged-update-rollback device run is still blocked"
    ]);
  });

  it("accepts ready rollback evidence only when both macOS and Windows runs passed", () => {
    const base = blockedContract();
    const contract = blockedContract({
      rollbackStatus: "ready",
      deviceRuns: base.deviceRuns.map((run) => passedRun(run, run.platform))
    });
    const result = validatePackagedUpdateRollbackContract(contract);
    const evaluation = evaluatePackagedUpdateRollback(contract, { requireDeviceEvidence: true });

    expect(result.ok).toBe(true);
    expect(evaluation).toMatchObject({
      ok: true,
      packagedUpdateRollbackReady: true,
      blockedDeviceRuns: []
    });
  });

  it("requires structured rollback evidence details when a device run passed", () => {
    const base = blockedContract();
    const contract = blockedContract({
      rollbackStatus: "ready",
      deviceRuns: base.deviceRuns.map((run) => passedRun(run, run.platform, { evidenceBundle: undefined }))
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.deviceRuns[0].evidenceBundle: must include structured rollback evidence when the device run passed",
      "$.deviceRuns[1].evidenceBundle: must include structured rollback evidence when the device run passed"
    ]));
  });

  it("requires passed rollback checks and protected-path evidence refs in the bundle", () => {
    const base = blockedContract();
    const checkEvidenceRefs = { ...passedEvidenceBundle("macos").checkEvidenceRefs };
    const protectedPathEvidenceRefs = { ...passedEvidenceBundle("macos").protectedPathEvidenceRefs };
    delete checkEvidenceRefs.rollback_after_failed_launch;
    delete protectedPathEvidenceRefs.credentials;
    const contract = blockedContract({
      rollbackStatus: "ready",
      deviceRuns: base.deviceRuns.map((run) =>
        passedRun(
          run,
          run.platform,
          run.platform === "macos"
            ? {
                evidenceBundle: passedEvidenceBundle("macos", {
                  passedChecks: REQUIRED_ROLLBACK_CHECKS.filter((check) => check !== "rollback_after_failed_launch"),
                  checkEvidenceRefs,
                  protectedPathEvidenceRefs
                })
              }
            : {}
        )
      )
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.deviceRuns[0].evidenceBundle.passedChecks: must include rollback_after_failed_launch",
      "$.deviceRuns[0].evidenceBundle.checkEvidenceRefs.rollback_after_failed_launch: must be a non-empty evidence ref",
      "$.deviceRuns[0].evidenceBundle.protectedPathEvidenceRefs.credentials: must be a non-empty evidence ref"
    ]));
  });

  it("validates rollback bundle device profile, package kind, credential mode, and evidence refs", () => {
    const base = blockedContract();
    const contract = blockedContract({
      rollbackStatus: "ready",
      deviceRuns: base.deviceRuns.map((run) =>
        passedRun(
          run,
          run.platform,
          run.platform === "windows"
            ? {
                evidenceBundle: passedEvidenceBundle("windows", {
                  deviceProfile: {
                    platform: "macos",
                    osName: "",
                    osVersion: "23H2 build 22631",
                    architecture: "x64",
                    environmentKind: "cloud-ci"
                  },
                  packageKind: "macos-dmg",
                  credentialSnapshotMode: "content_hash",
                  updateLogRef: "file:///tmp/update.log"
                })
              }
            : {}
        )
      )
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.deviceRuns[1].evidenceBundle.deviceProfile.platform: must be windows",
      "$.deviceRuns[1].evidenceBundle.deviceProfile.osName: must be a non-empty device metadata string",
      "$.deviceRuns[1].evidenceBundle.deviceProfile.environmentKind: must be physical-device or vm",
      "$.deviceRuns[1].evidenceBundle.packageKind: must be a windows packaged artifact kind",
      "$.deviceRuns[1].evidenceBundle.credentialSnapshotMode: must be metadata_only_no_read",
      "$.deviceRuns[1].evidenceBundle.updateLogRef: must use https when using URL evidence refs"
    ]));
  });

  it("requires #267 for blocked top-level and device-run blocker issues", () => {
    const contract = blockedContract({
      blockerIssue: "https://example.com/missing",
      deviceRuns: blockedContract().deviceRuns.map((run) => ({ ...run, blockerIssue: "https://example.com/missing" }))
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.blockerIssue: must link the tracked packaged updater rollback issue #267",
      "$.deviceRuns[0].blockerIssue: must link the tracked packaged updater rollback issue #267",
      "$.deviceRuns[1].blockerIssue: must link the tracked packaged updater rollback issue #267"
    ]));
  });

  it("rejects secret-shaped evidence strings and non-HTTPS URL evidence refs", () => {
    const contract = blockedContract({
      deviceRuns: blockedContract().deviceRuns.map((run) =>
        run.platform === "macos"
          ? {
              ...run,
              evidenceRefs: [
                "ftp://example.com/rollback.json",
                "javascript:alert(1)",
                "evidence/macos-rollback/report.json?token=abc"
              ],
              requiredEvidence: ["Bearer abcdefghijklmnop"]
            }
          : run
      )
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.deviceRuns[0].evidenceRefs[0]: must use https when using URL evidence refs",
      "$.deviceRuns[0].evidenceRefs[1]: must use https, a solo-superman URN, or a repo-relative evidence path",
      "$.deviceRuns[0].evidenceRefs[2]: must be an HTTPS URL, solo-superman URN, or repo-relative evidence path",
      "$.deviceRuns[0].requiredEvidence[0]: must not contain token-shaped values"
    ]));
  });

  it("requires all credential-free and device-evidence command lists", () => {
    const contract = blockedContract({
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify"],
        deviceEvidence: []
      }
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:packaged-update-rollback",
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:packaged-update-rollback:dry-run",
      "$.requiredVerificationCommands.deviceEvidence: must be a string list with at least 1 item(s)",
      "$.requiredVerificationCommands.deviceEvidence: must include pnpm verify:packaged-update-rollback -- --require-device-evidence"
    ]));
  });

  it("parses contract path and device-evidence mode flags", () => {
    expect(parsePackagedUpdateRollbackArgs(["--contract", "custom.json", "--require-device-evidence"])).toEqual({
      contractPath: "custom.json",
      requireDeviceEvidence: true
    });
    expect(() => parsePackagedUpdateRollbackArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
