import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  SIGNED_PACKAGE_RELEASE_DRY_RUN_SCHEMA_VERSION,
  parseSignedPackageReleaseDryRunArgs,
  runSignedPackageReleaseDryRun
} from "./verify-signed-package-release-dry-run.mjs";

async function writeContract(path, overrides = {}) {
  const contract = {
    schemaVersion: "solo-superman-signed-package-release.v1",
    appId: "solo-superman",
    releaseEvidenceStatus: "blocked",
    blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
    requiredVerificationCommands: {
      credentialFree: [
        "pnpm verify:signed-package-preflight",
        "pnpm verify:signed-package-release",
        "pnpm verify:signed-package-release:dry-run",
        "pnpm verify:release-readiness",
        "pnpm verify"
      ]
    },
    evidenceRuns: [
      { id: "macos-signed-package-release", status: "blocked" },
      { id: "windows-signed-package-release", status: "blocked" },
      { id: "release-manifest-signing", status: "blocked" }
    ],
    ...overrides
  };
  await writeFile(path, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  return contract;
}

describe("signed package release dry-run", () => {
  it("builds credential-free artifact and manifest evidence shape without real signing", async () => {
    const evidence = await runSignedPackageReleaseDryRun();
    const serialized = JSON.stringify(evidence);

    expect(evidence).toMatchObject({
      schemaVersion: SIGNED_PACKAGE_RELEASE_DRY_RUN_SCHEMA_VERSION,
      status: "passed",
      mode: "credential-free-fixture",
      issue: "https://github.com/bee-community-master/solo_superman/issues/293",
      upstreamReleaseEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/266",
      issues: []
    });
    expect(evidence.checks).toMatchObject({
      macos_artifact_digest_size_signature_ref: true,
      windows_artifact_digest_size_signature_ref: true,
      release_manifest_artifact_refs_match: true,
      release_manifest_signature_ref_recorded: true,
      public_certificate_metadata_only: true,
      contract_lists_dry_run_command: true,
      dry_run_does_not_mark_release_ready: true,
      no_secret_values_in_evidence: true
    });
    expect(evidence.artifactSummaries).toHaveLength(2);
    expect(evidence.manifestSummary).toMatchObject({
      path: "release/solo-superman-release-manifest.json",
      artifactCount: 2,
      publicKeyId: "solo-superman-fixture-release-manifest-public-key"
    });
    expect(serialized).not.toContain("P12");
    expect(serialized).not.toContain("PFX");
    expect(serialized).not.toContain("Bearer ");
  });

  it("can keep a provided fixture root for release-lab inspection", async () => {
    const root = await mkdtemp(join(tmpdir(), "solo-signed-release-test-"));
    try {
      const evidence = await runSignedPackageReleaseDryRun({ root });
      const manifest = JSON.parse(await readFile(join(root, "release/solo-superman-release-manifest.json"), "utf8"));

      expect(evidence.rootMode).toBe("provided-root");
      expect(evidence.status).toBe("passed");
      expect(manifest.artifactRefs).toHaveLength(2);
      expect(manifest.signatureRef).toBe(evidence.manifestSummary.signatureRef);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails when the release contract omits the dry-run command or marks real evidence ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "solo-signed-release-contract-test-"));
    try {
      const contractPath = join(root, "signed-package-release.json");
      await writeContract(contractPath, {
        releaseEvidenceStatus: "ready",
        requiredVerificationCommands: {
          credentialFree: ["pnpm verify:signed-package-release"]
        }
      });

      const evidence = await runSignedPackageReleaseDryRun({ contractPath });

      expect(evidence.status).toBe("failed");
      expect(evidence.checks).toMatchObject({
        contract_lists_dry_run_command: false,
        dry_run_does_not_mark_release_ready: false
      });
      expect(evidence.issues).toEqual(expect.arrayContaining([
        "contract_lists_dry_run_command dry-run check failed",
        "dry_run_does_not_mark_release_ready dry-run check failed",
        "$.requiredVerificationCommands.credentialFree: must include pnpm verify:signed-package-release:dry-run",
        "$.releaseEvidenceStatus: dry-run fixture must not mark real release evidence ready"
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("parses root, contract, and cleanup arguments", () => {
    expect(parseSignedPackageReleaseDryRunArgs(["--root", "./tmp-lab", "--contract=./release.json"])).toMatchObject({
      root: expect.stringContaining("tmp-lab"),
      contractPath: expect.stringContaining("release.json"),
      cleanup: false
    });
    expect(parseSignedPackageReleaseDryRunArgs(["--root=./tmp-lab", "--cleanup-root"])).toMatchObject({
      root: expect.stringContaining("tmp-lab"),
      cleanup: true
    });
    expect(() => parseSignedPackageReleaseDryRunArgs(["--root"])).toThrow("--root requires a path value");
    expect(() => parseSignedPackageReleaseDryRunArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
