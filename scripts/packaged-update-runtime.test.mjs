import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  APP_PATHS,
  buildPackagedUpdatePlan,
  createFixtureInstall,
  createFixtureReleaseManifest,
  deferPackagedUpdate,
  applyPackagedUpdate,
  launchInstalledRelease,
  readInstalledRelease,
  resolveInsideRoot,
  snapshotUpdateProtectedPaths
} from "./packaged-update-runtime.mjs";

async function withFixtureRoot(testFn) {
  const root = await mkdtemp(join(tmpdir(), "solo-packaged-runtime-test-"));
  try {
    await createFixtureInstall(root);
    return await testFn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function readyPlan(root) {
  return buildPackagedUpdatePlan({
    manifest: createFixtureReleaseManifest("0.1.1"),
    targetPlatform: "macos-arm64",
    installedRelease: await readInstalledRelease(root)
  });
}

describe("packaged update runtime", () => {
  it("builds a ready plan only for a newer signed-manifest artifact targeting the install platform", async () => {
    await withFixtureRoot(async (root) => {
      const plan = await readyPlan(root);
      const stalePlan = buildPackagedUpdatePlan({
        manifest: createFixtureReleaseManifest("0.1.0"),
        targetPlatform: "macos-arm64",
        installedRelease: await readInstalledRelease(root)
      });
      const missingPlatformPlan = buildPackagedUpdatePlan({
        manifest: createFixtureReleaseManifest("0.1.1"),
        targetPlatform: "windows-x64",
        installedRelease: await readInstalledRelease(root)
      });

      expect(plan).toMatchObject({
        status: "ready",
        currentVersion: "0.1.0",
        candidateVersion: "0.1.1",
        artifact: {
          platform: "macos-arm64",
          packageKind: "macos-dmg",
          signatureKind: "apple-codesign-notarization"
        }
      });
      expect(stalePlan.issues).toContain("candidate version must be newer than the installed version");
      expect(missingPlatformPlan.issues).toContain("no artifact found for target platform windows-x64");
    });
  });


  it("returns blocked plan issues instead of throwing on malformed manifests", async () => {
    await withFixtureRoot(async (root) => {
      const plan = buildPackagedUpdatePlan({
        manifest: { appId: "solo-superman", artifacts: [{ platform: "macos-arm64" }] },
        targetPlatform: "macos-arm64",
        installedRelease: await readInstalledRelease(root)
      });
      const missingManifestPlan = buildPackagedUpdatePlan({
        manifest: undefined,
        targetPlatform: "macos-arm64",
        installedRelease: { appId: "solo-superman", version: "not-semver" }
      });

      expect(plan.status).toBe("blocked");
      expect(plan.artifact).toMatchObject({ platform: "macos-arm64" });
      expect(plan.issues.length).toBeGreaterThan(0);
      expect(missingManifestPlan.status).toBe("blocked");
      expect(missingManifestPlan.issues).toEqual(expect.arrayContaining([
        "$: manifest must be a JSON object",
        "installed release version must be semver",
        "no artifact found for target platform macos-arm64"
      ]));
    });
  });

  it("defers a ready update without changing the installed release", async () => {
    await withFixtureRoot(async (root) => {
      const plan = await readyPlan(root);
      const result = await deferPackagedUpdate(root, plan);
      const launch = await launchInstalledRelease(root);

      expect(result).toMatchObject({ status: "deferred", activeVersion: "0.1.0", candidateVersion: "0.1.1" });
      expect(launch).toEqual({ ok: true, version: "0.1.0" });
    });
  });

  it("rolls back after failed launch verification while preserving protected data and credentials", async () => {
    await withFixtureRoot(async (root) => {
      const plan = await readyPlan(root);
      const result = await applyPackagedUpdate(root, plan, {
        launchVerifier: async () => ({ ok: false, version: "0.1.1", reason: "fixture launch failure" })
      });

      expect(result).toMatchObject({
        status: "rolled_back_after_failed_launch",
        applied: true,
        rollbackApplied: true,
        changedProtectedPaths: [],
        finalRelease: { version: "0.1.0" }
      });
      expect(result.touchedPaths).toEqual(Object.values(APP_PATHS));
      expect(JSON.stringify(result)).not.toContain("fixture credential reference only");
      expect(result.protectedSnapshots.before.find((entry) => entry.relativePath.startsWith("credentials/"))).toMatchObject({
        snapshotMode: "metadata_only_no_read",
        contentRead: false
      });
    });
  });

  it("reports retryable pre-write failures without replacing the current release", async () => {
    await withFixtureRoot(async (root) => {
      const plan = await readyPlan(root);
      const result = await applyPackagedUpdate(root, plan, { failBeforeWrite: true });

      expect(result).toMatchObject({
        status: "failed_before_write",
        applied: false,
        retryable: true,
        finalRelease: { version: "0.1.0" },
        changedProtectedPaths: []
      });
    });
  });


  it("treats missing protected paths as preserved when the updater does not create them", async () => {
    await withFixtureRoot(async (root) => {
      const plan = await readyPlan(root);
      const result = await applyPackagedUpdate(root, plan, {
        protectedPathPolicies: [{ relativePath: "optional/missing-local.db", snapshotMode: "preserve_content" }]
      });

      expect(result).toMatchObject({ status: "applied", changedProtectedPaths: [] });
      expect(result.protectedSnapshots.before[0]).toMatchObject({ exists: false, contentRead: false });
      expect(result.protectedSnapshots.after[0]).toMatchObject({ exists: false, contentRead: false });
    });
  });

  it("uses metadata-only snapshots for credential paths and refuses path traversal", async () => {
    await withFixtureRoot(async (root) => {
      const snapshots = await snapshotUpdateProtectedPaths(root);
      const credentialSnapshot = snapshots.find((entry) => entry.relativePath === "credentials/codex-cli-login-ref.txt");

      expect(credentialSnapshot).toMatchObject({ snapshotMode: "metadata_only_no_read", contentRead: false });
      expect(credentialSnapshot).not.toHaveProperty("sha256");
      expect(() => resolveInsideRoot(root, "../outside")).toThrow("outside install root");
      await mkdir(resolveInsideRoot(root, "safe"), { recursive: true });
      await expect(writeFile(resolveInsideRoot(root, "safe/path.txt"), "ok")).resolves.toBeUndefined();
    });
  });
});
