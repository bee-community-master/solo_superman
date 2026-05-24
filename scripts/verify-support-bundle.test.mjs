import { describe, expect, it } from "vitest";
import {
  SUPPORT_BUNDLE_VALIDATION_SCHEMA_VERSION,
  evidenceForValidation,
  parseSupportBundleVerificationArgs,
  validateSupportBundle
} from "./verify-support-bundle.mjs";
import { SUPPORT_BUNDLE_SCHEMA_VERSION } from "./support-bundle.mjs";

const requiredDiagnostics = [
  "productCapabilityReadiness",
  "releaseChannel",
  "windowsRealDevice",
  "windowsInstallerDryRun",
  "packagedUpdateRollback",
  "packagedUpdateRollbackDryRun",
  "signedPackagePreflight",
  "signedPackageRelease",
  "signedPackageReleaseDryRun",
  "releaseReadiness",
  "releaseEvidenceTemplate",
  "releaseEvidenceBundle"
];

function validBundle(overrides = {}) {
  return {
    schemaVersion: SUPPORT_BUNDLE_SCHEMA_VERSION,
    privacy: {
      credentialFree: true,
      secretPolicy: "Only allowlisted environment names are captured.",
      excluded: [
        "full environment dump",
        "file contents",
        "browser cookies",
        "OpenAI or GitHub tokens",
        "ChatGPT web credentials"
      ]
    },
    repo: {
      remoteOrigin: "https://<redacted>@github.com/bee-community-master/solo_superman.git?token=<redacted>"
    },
    package: {
      scripts: {
        supportBundle: "node scripts/support-bundle.mjs",
        verifyReadyRelease: "node scripts/verify-ready-release.mjs",
        verifyReleaseEvidenceBundle: "node scripts/verify-release-evidence-bundle.mjs",
        verifySupportBundle: "node scripts/verify-support-bundle.mjs"
      }
    },
    releaseDiagnostics: Object.fromEntries(requiredDiagnostics.map((name) => [name, {
      command: `pnpm ${name}`,
      captureStatus: "ok",
      evidenceStatus: "passed",
      checked: []
    }])),
    env: {
      CI: "true",
      SHELL: "/bin/zsh"
    },
    recommendedChecks: [
      "pnpm verify:product-capability-readiness",
      "pnpm verify:release-readiness",
      "pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>",
      "pnpm verify:release-evidence-template",
      "pnpm verify:release-evidence-bundle",
      "pnpm verify:support-bundle",
      "pnpm support:bundle",
      "pnpm verify"
    ],
    ...overrides
  };
}

describe("support bundle verification", () => {
  it("accepts a credential-free support diagnostics bundle", () => {
    const validation = validateSupportBundle(validBundle());
    const evidence = evidenceForValidation(validation, { outputPath: "/tmp/support-bundle.json" });

    expect(validation.ok).toBe(true);
    expect(evidence).toMatchObject({
      status: "passed",
      schemaVersion: SUPPORT_BUNDLE_VALIDATION_SCHEMA_VERSION,
      mode: "generated-bundle",
      supportBundleSchemaVersion: SUPPORT_BUNDLE_SCHEMA_VERSION,
      bundlePath: "/tmp/support-bundle.json"
    });
  });

  it("requires every compact product and release diagnostic to be captured successfully", () => {
    const bundle = validBundle({
      releaseDiagnostics: {
        ...validBundle().releaseDiagnostics,
        releaseReadiness: {
          command: "pnpm verify:release-readiness",
          captureStatus: "timeout",
          evidenceStatus: "unavailable"
        }
      }
    });
    const validation = validateSupportBundle(bundle);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      "$.releaseDiagnostics.releaseReadiness.captureStatus: must be ok",
      "$.releaseDiagnostics.releaseReadiness.evidenceStatus: must be passed"
    ]));
  });

  it("rejects secret-shaped bundle strings and sensitive environment names", () => {
    const bundle = validBundle({
      repo: {
        remoteOrigin: "https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/org/repo.git?token=secret-value"
      },
      env: {
        GITHUB_TOKEN: "<redacted>",
        CI: "true"
      }
    });
    const validation = validateSupportBundle(bundle);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      "$.repo.remoteOrigin: must not contain token-shaped values",
      "$.repo.remoteOrigin: must not contain URL userinfo credentials",
      "$.repo.remoteOrigin: must redact secret-like URL query values",
      "$.env.GITHUB_TOKEN: must not include sensitive environment names"
    ]));
  });

  it("requires support scripts and recommended checks to include the verifier", () => {
    const bundle = validBundle({
      package: { scripts: { supportBundle: "node scripts/support-bundle.mjs" } },
      recommendedChecks: ["pnpm support:bundle"]
    });
    const validation = validateSupportBundle(bundle);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      "$.package.scripts.verifySupportBundle: must point to verify-support-bundle.mjs",
      "$.package.scripts.verifyReadyRelease: must point to verify-ready-release.mjs",
      "$.recommendedChecks: must include pnpm verify:support-bundle",
      "$.recommendedChecks: must include pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>",
      "$.recommendedChecks: must include pnpm verify"
    ]));
  });

  it("parses existing bundle, output, and timeout flags", () => {
    expect(parseSupportBundleVerificationArgs([
      "--bundle",
      "bundle.json",
      "--output",
      "verified.json",
      "--timeout-ms",
      "2000"
    ], {})).toMatchObject({
      bundlePath: expect.stringContaining("bundle.json"),
      outputPath: expect.stringContaining("verified.json"),
      timeoutMs: 2000
    });
    expect(() => parseSupportBundleVerificationArgs(["--bundle"], {})).toThrow("--bundle requires a path value");
    expect(() => parseSupportBundleVerificationArgs(["--timeout-ms", "0"], {})).toThrow(
      "--timeout-ms requires a positive integer value"
    );
  });
});
