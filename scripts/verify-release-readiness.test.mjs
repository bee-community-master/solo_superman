import { describe, expect, it } from "vitest";
import {
  RELEASE_READINESS_SCHEMA_VERSION,
  evaluateReleaseReadiness,
  parseReleaseReadinessArgs,
  validateReleaseReadinessContract
} from "./verify-release-readiness.mjs";

function blockedContract(overrides = {}) {
  return {
    schemaVersion: RELEASE_READINESS_SCHEMA_VERSION,
    appId: "solo-superman",
    publicPosture: "technical-preview",
    broadReleaseStatus: "blocked",
    summary: "Technical preview remains safe to share with limited users, but broad release is blocked.",
    requiredVerificationCommands: {
      credentialFree: [
        "pnpm verify:prod-bundle",
        "pnpm verify:release-channel",
        "pnpm verify:windows-real-device",
        "pnpm verify:windows-installer:dry-run",
        "pnpm verify:packaged-update-rollback",
        "pnpm verify:packaged-update-rollback:dry-run",
        "pnpm verify:release-readiness",
        "pnpm verify:release-evidence-template",
        "pnpm verify:release-evidence-bundle",
        "pnpm verify"
      ],
      readyRelease: [
        "pnpm verify:windows-real-device -- --require-device-evidence",
        "pnpm verify:packaged-update-rollback -- --require-device-evidence",
        "pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready",
        "pnpm verify:release-readiness -- --require-ready",
        "pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
      ]
    },
    releaseGates: [
      {
        id: "signed-packages",
        status: "blocked",
        requiredFor: "optional-hardening",
        blocker: "Signing credentials and notarization evidence are optional hardening for direct distribution.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
        evidenceRefs: ["docs/signed-packages_KO.md", "docs/signed-package-release.example.json"],
        requiredEvidence: ["macOS Developer ID signing", "Windows Authenticode timestamp verification"],
        unblockCriteria: ["Run credential-required signed package preflight in release environment"]
      },
      {
        id: "packaged-update-rollback",
        status: "blocked",
        requiredFor: "general-release",
        blocker: "Packaged updater and rollback device verification are not implemented yet.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
        evidenceRefs: ["docs/release-channel_KO.md", "docs/release-update-channel.example.json"],
        requiredEvidence: ["Device install/update/defer/retry/rollback verification"],
        unblockCriteria: ["Record macOS and Windows rollback evidence"]
      },
      {
        id: "windows-real-device",
        status: "blocked",
        requiredFor: "general-release",
        blocker: "Windows real-device one-line installer verification is tracked separately.",
        blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
        evidenceRefs: ["docs/windows-real-device_KO.md", "docs/windows-real-device.example.json"],
        requiredEvidence: ["Clean Windows 11 one-line install through first-screen arrival"],
        unblockCriteria: ["Attach support bundle and first-screen evidence to issue #259"]
      }
    ],
    ...overrides
  };
}

describe("release readiness verification", () => {
  it("passes the default contract mode when broad release is explicitly blocked with named gates", () => {
    const evaluation = evaluateReleaseReadiness(blockedContract());

    expect(evaluation).toMatchObject({
      ok: true,
      readinessStatus: "blocked",
      broadReleaseReady: false,
      blockedGates: ["packaged-update-rollback", "windows-real-device"],
      optionalBlockedGates: ["signed-packages"],
      blockers: []
    });
  });

  it("fails require-ready mode until every broad-release gate has passed", () => {
    const evaluation = evaluateReleaseReadiness(blockedContract(), { requireReady: true });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      "broad release is not ready",
      "packaged-update-rollback gate is still blocked",
      "windows-real-device gate is still blocked"
    ]);
  });

  it("requires the tracked GitHub issue for every blocked broad-release gate", () => {
    const contract = blockedContract({
      releaseGates: blockedContract().releaseGates.map((gate) => {
        if (gate.id === "signed-packages") {
          const withoutIssue = { ...gate };
          delete withoutIssue.blockerIssue;
          return withoutIssue;
        }
        if (gate.id === "packaged-update-rollback") {
          return { ...gate, blockerIssue: "https://example.com/missing" };
        }
        return { ...gate, blockerIssue: "https://example.com/missing" };
      })
    });
    const result = validateReleaseReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.releaseGates[0].blockerIssue: must link a GitHub issue while this gate is blocked",
      "$.releaseGates[1].blockerIssue: must link the tracked packaged updater rollback verification issue #267",
      "$.releaseGates[2].blockerIssue: must link the tracked Windows real-device verification issue #259"
    ]));
  });

  it("rejects a ready broad-release claim when a required gate is still blocked", () => {
    const contract = blockedContract({
      publicPosture: "general-release",
      broadReleaseStatus: "ready",
      releaseGates: blockedContract().releaseGates.map((gate) =>
        gate.id === "signed-packages"
          ? {
              ...gate,
              status: "passed",
              verifiedAt: "2026-05-23T00:00:00Z",
              verifiedBy: ["release-job:signing"]
            }
          : gate
      )
    });
    const result = validateReleaseReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.releaseGates: ready broad release cannot include blocked required gates");
    expect(result.issues).toContain("$.releaseGates: ready broad release must pass packaged-update-rollback");
    expect(result.issues).toContain("$.releaseGates: ready broad release must pass windows-real-device");
  });

  it("rejects non-HTTPS URL evidence refs instead of silently treating them as local refs", () => {
    const contract = blockedContract({
      releaseGates: blockedContract().releaseGates.map((gate) =>
        gate.id === "signed-packages" ? { ...gate, evidenceRefs: ["ftp://example.com/signing-evidence.json"] } : gate
      )
    });
    const result = validateReleaseReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.releaseGates[0].evidenceRefs[0]: must use https when using URL evidence refs");
  });

  it("requires both credential-free and ready-release command lists", () => {
    const contract = blockedContract({
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify"],
        readyRelease: []
      }
    });
    const result = validateReleaseReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:prod-bundle",
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:windows-real-device",
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:packaged-update-rollback",
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:release-readiness",
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:release-evidence-template",
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:release-evidence-bundle",
      "$.requiredVerificationCommands.readyRelease: must be a string list with at least 1 item(s)",
      "$.requiredVerificationCommands.readyRelease: must include pnpm verify:windows-real-device -- --require-device-evidence",
      "$.requiredVerificationCommands.readyRelease: must include pnpm verify:packaged-update-rollback -- --require-device-evidence",
      "$.requiredVerificationCommands.readyRelease: must include pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready",
      "$.requiredVerificationCommands.readyRelease: must include pnpm verify:release-readiness -- --require-ready",
      "$.requiredVerificationCommands.readyRelease: must include pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle"
    ]));
  });

  it("parses contract path and ready-release mode flags", () => {
    expect(parseReleaseReadinessArgs(["--contract", "custom.json", "--require-ready"])).toEqual({
      contractPath: "custom.json",
      requireReady: true
    });
    expect(() => parseReleaseReadinessArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
