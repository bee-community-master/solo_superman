import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  PACKAGED_UPDATE_ROLLBACK_DRY_RUN_SCHEMA_VERSION,
  parsePackagedUpdateRollbackDryRunArgs,
  runPackagedUpdateRollbackDryRun
} from "./verify-packaged-update-rollback-dry-run.mjs";

describe("packaged update rollback dry-run", () => {
  it("simulates update retry, rollback, and preservation without credentials", async () => {
    const evidence = await runPackagedUpdateRollbackDryRun();

    expect(evidence).toMatchObject({
      schemaVersion: PACKAGED_UPDATE_ROLLBACK_DRY_RUN_SCHEMA_VERSION,
      status: "passed",
      mode: "credential-free-fixture",
      finalVersion: "0.1.0",
      issues: []
    });
    expect(evidence.upstreamDeviceEvidenceIssue).toBe("https://github.com/bee-community-master/solo_superman/issues/267");
    expect(evidence.checks).toMatchObject({
      install_signed_package: true,
      apply_update: true,
      defer_update: true,
      retry_failed_update: true,
      rollback_after_failed_launch: true,
      launch_after_rollback: true,
      preserve_user_data: true,
      preserve_credentials: true
    });
    expect(evidence.updatePlan).toMatchObject({
      status: "ready",
      targetPlatform: "macos-arm64",
      artifact: { signatureKind: "apple-codesign-notarization" }
    });
    expect(evidence.credentialSnapshotMode).toBe("metadata_only_no_read");
    expect(evidence.protectedPaths).toEqual(expect.arrayContaining([
      "data/local.db",
      "workspace/generated-project/README.md",
      "support/solo-support-bundle.json",
      "operator-files/release-notes.md",
      "credentials/codex-cli-login-ref.txt"
    ]));
    expect(JSON.stringify(evidence)).not.toContain("fixture credential reference only");
  });

  it("can keep a provided fixture root for lab inspection without mutating protected files", async () => {
    const root = await mkdtemp(join(tmpdir(), "solo-packaged-rollback-test-"));
    try {
      const evidence = await runPackagedUpdateRollbackDryRun({ root });
      const credentialRef = await readFile(join(root, "credentials/codex-cli-login-ref.txt"), "utf8");

      expect(evidence.rootMode).toBe("provided-root");
      expect(evidence.status).toBe("passed");
      expect(credentialRef).toBe("fixture credential reference only; no real credential value\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("parses root and cleanup arguments", () => {
    expect(parsePackagedUpdateRollbackDryRunArgs(["--root", "./tmp-lab"])).toMatchObject({
      root: expect.stringContaining("tmp-lab"),
      cleanup: false
    });
    expect(parsePackagedUpdateRollbackDryRunArgs(["--root=./tmp-lab", "--cleanup-root"])).toMatchObject({
      root: expect.stringContaining("tmp-lab"),
      cleanup: true
    });
    expect(() => parsePackagedUpdateRollbackDryRunArgs(["--root"])).toThrow("--root requires a path value");
  });
});
