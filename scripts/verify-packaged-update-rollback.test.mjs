import { describe, expect, it } from "vitest";
import {
  PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION,
  evaluatePackagedUpdateRollback,
  parsePackagedUpdateRollbackArgs,
  validatePackagedUpdateRollbackContract
} from "./verify-packaged-update-rollback.mjs";

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
        blocker: "macOS signed package device evidence is missing.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
        evidenceRefs: ["docs/release-channel_KO.md"],
        requiredChecks: [
          "install_signed_package",
          "apply_update",
          "defer_update",
          "retry_failed_update",
          "rollback_after_failed_launch",
          "launch_after_rollback",
          "preserve_user_data",
          "preserve_credentials"
        ],
        requiredEvidence: ["macOS update rollback evidence"],
        unblockCriteria: ["Attach macOS rollback evidence to #267"]
      },
      {
        id: "windows-packaged-update-rollback",
        platform: "windows",
        status: "blocked",
        requiredFor: "general-release",
        blocker: "Windows signed package device evidence is missing.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
        evidenceRefs: ["docs/release-channel_KO.md", "https://github.com/bee-community-master/solo_superman/issues/259"],
        requiredChecks: [
          "install_signed_package",
          "apply_update",
          "defer_update",
          "retry_failed_update",
          "rollback_after_failed_launch",
          "launch_after_rollback",
          "preserve_user_data",
          "preserve_credentials"
        ],
        requiredEvidence: ["Windows update rollback evidence"],
        unblockCriteria: ["Attach Windows rollback evidence to #267"]
      }
    ],
    ...overrides
  };
}

function passedRun(run, platform) {
  const rest = { ...run };
  delete rest.blocker;
  delete rest.blockerIssue;
  return {
    ...rest,
    platform,
    status: "passed",
    verifiedAt: "2026-05-23T00:00:00Z",
    verifiedBy: [`device-lab:${platform}`]
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
          ? { ...run, evidenceRefs: ["ftp://example.com/rollback.json"], requiredEvidence: ["Bearer abcdefghijklmnop"] }
          : run
      )
    });
    const result = validatePackagedUpdateRollbackContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.deviceRuns[0].evidenceRefs[0]: must use https when using URL evidence refs",
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
