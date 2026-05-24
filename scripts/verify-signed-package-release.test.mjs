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
        "pnpm verify:signed-package-release:dry-run",
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

const CHECK_DIGEST = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WINDOWS_DIGEST = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const MANIFEST_DIGEST = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const CERT_DIGEST = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

function publicCertificate(scope) {
  return {
    kind: `${scope}-public-certificate-metadata`,
    subject: `Solo Superman ${scope} release certificate`,
    issuer: "Solo Superman Release CA",
    fingerprintSha256: CERT_DIGEST,
    serialNumber: `RELEASE-${scope.toUpperCase()}-001`
  };
}

function packageEvidenceBundle(scope) {
  const isMacos = scope === "macos";
  return {
    artifactRef: `https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/solo-superman-0.1.0-${scope}.${isMacos ? "dmg" : "msi"}`,
    packageKind: isMacos ? "macos-dmg" : "windows-msi",
    sha256: isMacos ? CHECK_DIGEST : WINDOWS_DIGEST,
    sizeBytes: isMacos ? 125829120 : 146800640,
    signatureRef: `https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/${scope}-signature.json`,
    publicCertificate: publicCertificate(scope),
    redactedEvidenceRefs: [`https://github.com/bee-community-master/solo_superman/issues/266#${scope}-evidence`],
    passedChecks: requiredChecksByScope(scope),
    ...(isMacos
      ? {
          notarizationRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/macos-notarization.json",
          staplingRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/macos-stapling.json",
          gatekeeperAssessmentRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/macos-spctl.json"
        }
      : {
          authenticodeRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/windows-authenticode.json",
          timestampRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/windows-timestamp.json"
        })
  };
}

function manifestEvidenceBundle() {
  return {
    manifestRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/release-update-manifest.json",
    manifestSha256: MANIFEST_DIGEST,
    manifestSizeBytes: 4096,
    manifestSignatureRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/release-update-manifest.sig",
    publicKeyId: "solo-superman-release-key-2026-05",
    redactedEvidenceRefs: ["https://github.com/bee-community-master/solo_superman/issues/266#release-manifest-evidence"],
    passedChecks: requiredChecksByScope("release-manifest"),
    artifactRefs: [
      { scope: "macos", sha256: CHECK_DIGEST, sizeBytes: 125829120, signatureRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/macos-signature.json" },
      { scope: "windows", sha256: WINDOWS_DIGEST, sizeBytes: 146800640, signatureRef: "https://github.com/bee-community-master/solo_superman/releases/download/v0.1.0/windows-signature.json" }
    ]
  };
}

function evidenceBundleFor(scope) {
  return scope === "release-manifest" ? manifestEvidenceBundle() : packageEvidenceBundle(scope);
}

function passedRun(run) {
  const rest = { ...run };
  delete rest.blocker;
  delete rest.blockerIssue;
  return {
    ...rest,
    status: "passed",
    verifiedAt: "2026-05-24T00:00:00Z",
    verifiedBy: [`release-lab:${run.scope}`],
    evidenceBundle: evidenceBundleFor(run.scope)
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


  it("requires structured artifact evidence details for passed release runs", () => {
    const base = blockedContract();
    const [macos, ...rest] = base.evidenceRuns;
    const contract = blockedContract({
      releaseEvidenceStatus: "ready",
      evidenceRuns: [
        {
          ...passedRun(macos),
          evidenceBundle: {
            ...packageEvidenceBundle("macos"),
            passedChecks: ["macos_codesign_verify"],
            sha256: "not-a-digest"
          }
        },
        ...rest.map((run) => passedRun(run))
      ]
    });
    const result = validateSignedPackageReleaseContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.evidenceRuns[0].evidenceBundle.sha256: must be a lowercase 64-character SHA-256 hex digest",
      "$.evidenceRuns[0].evidenceBundle.passedChecks: must include macos_pkgutil_verify",
      "$.evidenceRuns[0].evidenceBundle.passedChecks: must include macos_notarization_status"
    ]));
  });


  it("rejects unsafe non-HTTPS evidence bundle refs", () => {
    const base = blockedContract();
    const [macos, ...rest] = base.evidenceRuns;
    const contract = blockedContract({
      releaseEvidenceStatus: "ready",
      evidenceRuns: [
        {
          ...passedRun(macos),
          evidenceBundle: {
            ...packageEvidenceBundle("macos"),
            signatureRef: "javascript:alert(1)",
            redactedEvidenceRefs: ["release/evidence/macos-signing.json"]
          }
        },
        ...rest.map((run) => passedRun(run))
      ]
    });
    const result = validateSignedPackageReleaseContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.evidenceRuns[0].evidenceBundle.signatureRef: must use https, a solo-superman URN, or a repo-relative evidence path"
    ]));
  });

  it("requires release manifest evidence to reference both macOS and Windows artifacts", () => {
    const base = blockedContract();
    const contract = blockedContract({
      releaseEvidenceStatus: "ready",
      evidenceRuns: base.evidenceRuns.map((run) =>
        run.scope === "release-manifest"
          ? {
              ...passedRun(run),
              evidenceBundle: {
                ...manifestEvidenceBundle(),
                artifactRefs: [manifestEvidenceBundle().artifactRefs[0]]
              }
            }
          : passedRun(run)
      )
    });
    const result = validateSignedPackageReleaseContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.evidenceRuns[2].evidenceBundle.artifactRefs: must include windows"
    ]));
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
      "$.requiredVerificationCommands.credentialFree: must include pnpm verify:signed-package-release:dry-run",
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
