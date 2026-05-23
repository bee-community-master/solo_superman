import { describe, expect, it } from "vitest";
import {
  SIGNED_PACKAGE_RELEASE_SCHEMA_VERSION,
  evaluateSignedPackageRelease,
  parseSignedPackageReleaseArgs,
  validateSignedPackageReleaseContract
} from "./verify-signed-package-release.mjs";

function requiredChecksByScope(scope) {
  return {
    macos: [
      "macos_codesign_verify",
      "macos_pkgutil_verify",
      "macos_notarization_status",
      "macos_stapling_verify",
      "macos_gatekeeper_assessment",
      "artifact_checksum_recorded"
    ],
    windows: [
      "windows_authenticode_verify",
      "windows_timestamp_verify",
      "windows_installer_signature_verify",
      "windows_hash_recorded",
      "artifact_checksum_recorded"
    ],
    "release-manifest": [
      "release_manifest_artifact_sha256",
      "release_manifest_artifact_size",
      "release_manifest_artifact_signature_refs",
      "release_manifest_signature_verify"
    ]
  }[scope];
}

function blockedRun(id, scope) {
  return {
    id,
    scope,
    status: "blocked",
    requiredFor: "general-release",
    blocker: `${scope} release evidence is missing.`,
    blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
    evidenceRefs: ["docs/signed-packages_KO.md"],
    requiredChecks: requiredChecksByScope(scope),
    requiredEvidence: [`${scope} signed package release evidence`],
    unblockCriteria: ["Attach redacted release evidence to #266"]
  };
}

function blockedContract(overrides = {}) {
  return {
    schemaVersion: SIGNED_PACKAGE_RELEASE_SCHEMA_VERSION,
    appId: "solo-superman",
    releaseEvidenceStatus: "blocked",
    summary: "Signed package release evidence remains blocked until real release evidence exists.",
    preflightContract: "docs/signed-package-preflight.example.json",
    releaseReadinessContract: "docs/release-readiness_KO.md",
    blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
    requiredVerificationCommands: {
      credentialFree: [
        "pnpm verify:signed-package-preflight",
        "pnpm verify:signed-package-release",
        "pnpm verify:release-readiness",
        "pnpm verify"
      ],
      releaseEvidence: [
        "pnpm verify:signed-package-preflight -- --require-credentials",
        "pnpm verify:signed-package-release -- --require-release-evidence",
        "pnpm verify:release-readiness -- --require-ready"
      ]
    },
    credentialBoundary: [
      "Signing credentials must stay in local secret stores or CI secret managers.",
      "Release evidence must use redacted refs, public certificate metadata, signatures, checksums, and timestamps only."
    ],
    evidenceRuns: [
      blockedRun("macos-signed-package-release", "macos"),
      blockedRun("windows-signed-package-release", "windows"),
      blockedRun("release-manifest-signing", "release-manifest")
    ],
    ...overrides
  };
}

function passedRun(run) {
  const rest = { ...run };
  delete rest.blocker;
  delete rest.blockerIssue;
  return {
    ...rest,
    status: "passed",
    verifiedAt: "2026-05-24T00:00:00Z",
    verifiedBy: [`release-lab:${run.scope}`]
  };
}

describe("signed package release verification", () => {
  it("passes default contract mode when release evidence is explicitly blocked", () => {
    const evaluation = evaluateSignedPackageRelease(blockedContract());

    expect(evaluation).toMatchObject({
      ok: true,
      releaseEvidenceStatus: "blocked",
      signedPackageReleaseReady: false,
      blockedEvidenceRuns: ["macos-signed-package-release", "windows-signed-package-release", "release-manifest-signing"],
      blockers: []
    });
  });

  it("fails require-release-evidence mode until every evidence run has passed", () => {
    const evaluation = evaluateSignedPackageRelease(blockedContract(), { requireReleaseEvidence: true });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      "signed package release evidence is not ready",
      "macos-signed-package-release evidence run is still blocked",
      "windows-signed-package-release evidence run is still blocked",
      "release-manifest-signing evidence run is still blocked"
    ]);
  });

  it("accepts ready release evidence only when all scopes passed", () => {
    const base = blockedContract();
    const contract = blockedContract({
      releaseEvidenceStatus: "ready",
      evidenceRuns: base.evidenceRuns.map((run) => passedRun(run))
    });
    const result = validateSignedPackageReleaseContract(contract);
    const evaluation = evaluateSignedPackageRelease(contract, { requireReleaseEvidence: true });

    expect(result.ok).toBe(true);
    expect(evaluation).toMatchObject({
      ok: true,
      signedPackageReleaseReady: true,
      blockedEvidenceRuns: []
    });
  });

  it("requires #266 for blocked top-level and evidence-run blocker issues", () => {
    const contract = blockedContract({
      blockerIssue: "https://example.com/missing",
      evidenceRuns: blockedContract().evidenceRuns.map((run) => ({ ...run, blockerIssue: "https://example.com/missing" }))
    });
    const result = validateSignedPackageReleaseContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.blockerIssue: must link the tracked signed package release evidence issue #266",
      "$.evidenceRuns[0].blockerIssue: must link the tracked signed package release evidence issue #266",
      "$.evidenceRuns[1].blockerIssue: must link the tracked signed package release evidence issue #266",
      "$.evidenceRuns[2].blockerIssue: must link the tracked signed package release evidence issue #266"
    ]));
  });

  it("rejects secret-shaped evidence strings and non-HTTPS URL evidence refs", () => {
    const contract = blockedContract({
      evidenceRuns: blockedContract().evidenceRuns.map((run) =>
        run.scope === "macos"
          ? { ...run, evidenceRefs: ["ftp://example.com/signing-evidence.json"], requiredEvidence: ["Bearer abcdefghijklmnop"] }
          : run
      )
    });
    const result = validateSignedPackageReleaseContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.evidenceRuns[0].evidenceRefs[0]: must use https when using URL evidence refs",
      "$.evidenceRuns[0].requiredEvidence[0]: must not contain token-shaped values"
    ]));
  });

  it("requires all credential-free and release-evidence command lists", () => {
    const contract = blockedContract({
      requiredVerificationCommands: {
        credentialFree: ["pnpm verify"],
        releaseEvidence: []
      }
    });
    const result = validateSignedPackageReleaseContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:signed-package-release",
      "$.requiredVerificationCommands.releaseEvidence: must be a string list with at least 1 item(s)",
      "$.requiredVerificationCommands.releaseEvidence: must include pnpm verify:signed-package-release -- --require-release-evidence"
    ]));
  });

  it("parses contract path and release-evidence mode flags", () => {
    expect(parseSignedPackageReleaseArgs(["--contract", "custom.json", "--require-release-evidence"])).toEqual({
      contractPath: "custom.json",
      requireReleaseEvidence: true
    });
    expect(() => parseSignedPackageReleaseArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
