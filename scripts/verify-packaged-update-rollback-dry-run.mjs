#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  APP_PATHS,
  DEFAULT_UPDATE_PROTECTED_PATH_POLICIES,
  applyPackagedUpdate,
  buildPackagedUpdatePlan,
  createFixtureInstall,
  createFixtureReleaseManifest,
  deferPackagedUpdate,
  launchInstalledRelease,
  readInstalledRelease
} from "./packaged-update-runtime.mjs";

export const PACKAGED_UPDATE_ROLLBACK_DRY_RUN_SCHEMA_VERSION = "solo-superman-packaged-update-rollback-dry-run.v1";

const REQUIRED_CHECKS = [
  "install_signed_package",
  "apply_update",
  "defer_update",
  "retry_failed_update",
  "rollback_after_failed_launch",
  "launch_after_rollback",
  "preserve_user_data",
  "preserve_credentials"
];
const PROTECTED_PATHS = DEFAULT_UPDATE_PROTECTED_PATH_POLICIES.map((policy) => policy.relativePath);

function uniqueStrings(values) {
  return [...new Set(values)];
}

async function runScenario(root) {
  await createFixtureInstall(root);
  const initialLaunch = await launchInstalledRelease(root);
  const candidateVersion = "0.1.1";
  const manifest = createFixtureReleaseManifest(candidateVersion);
  const plan = buildPackagedUpdatePlan({
    manifest,
    targetPlatform: "macos-arm64",
    installedRelease: await readInstalledRelease(root)
  });

  if (plan.status !== "ready") {
    throw new Error(`fixture update plan was not ready: ${plan.issues.join("; ")}`);
  }

  const deferred = await deferPackagedUpdate(root, plan);
  const failedAttempt = await applyPackagedUpdate(root, plan, {
    failBeforeWrite: true,
    failureReason: "fixture checksum failure before install write"
  });
  const versionAfterFailedAttempt = (await readInstalledRelease(root)).version;
  const rollbackAttempt = await applyPackagedUpdate(root, plan, {
    launchVerifier: async () => ({
      ok: false,
      version: candidateVersion,
      reason: "fixture launch verification failure"
    })
  });
  const finalRelease = await readInstalledRelease(root);
  const launchAfterRollback = await launchInstalledRelease(root);
  const changedProtectedPaths = uniqueStrings([
    ...failedAttempt.changedProtectedPaths,
    ...rollbackAttempt.changedProtectedPaths
  ]);
  const credentialSnapshot = rollbackAttempt.protectedSnapshots.before.find((entry) =>
    entry.relativePath === "credentials/codex-cli-login-ref.txt"
  );
  const checks = {
    install_signed_package: initialLaunch.ok && initialLaunch.version === "0.1.0",
    apply_update: rollbackAttempt.applied === true && rollbackAttempt.candidateRelease.version === candidateVersion,
    defer_update: deferred.status === "deferred" && deferred.activeVersion === "0.1.0",
    retry_failed_update: failedAttempt.applied === false && versionAfterFailedAttempt === "0.1.0" && rollbackAttempt.applied === true,
    rollback_after_failed_launch: rollbackAttempt.rollbackApplied === true && finalRelease.version === rollbackAttempt.previousRelease.version,
    launch_after_rollback: launchAfterRollback.ok === true && launchAfterRollback.version === "0.1.0",
    preserve_user_data: changedProtectedPaths.filter((path) => path !== "credentials/codex-cli-login-ref.txt").length === 0,
    preserve_credentials: !changedProtectedPaths.includes("credentials/codex-cli-login-ref.txt")
      && credentialSnapshot?.snapshotMode === "metadata_only_no_read"
      && credentialSnapshot?.contentRead === false
  };

  return {
    initialVersion: "0.1.0",
    candidateVersion,
    finalVersion: finalRelease.version,
    updatePlan: {
      status: plan.status,
      targetPlatform: plan.targetPlatform,
      artifact: plan.artifact,
      manifestSignatureRef: plan.manifestSignatureRef
    },
    checks,
    changedProtectedPaths,
    protectedPaths: PROTECTED_PATHS,
    credentialSnapshotMode: credentialSnapshot?.snapshotMode ?? "missing",
    updaterTouchedPaths: Object.values(APP_PATHS)
  };
}

function evidenceForScenario(scenario, rootMode) {
  const failedChecks = REQUIRED_CHECKS.filter((check) => scenario.checks[check] !== true);
  const issues = [
    ...failedChecks.map((check) => `${check} dry-run check failed`),
    ...scenario.changedProtectedPaths.map((path) => `${path} changed during rollback dry-run`)
  ];

  return {
    schemaVersion: PACKAGED_UPDATE_ROLLBACK_DRY_RUN_SCHEMA_VERSION,
    status: issues.length === 0 ? "passed" : "failed",
    mode: "credential-free-fixture",
    issue: "https://github.com/bee-community-master/solo_superman/issues/289",
    upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
    rootMode,
    initialVersion: scenario.initialVersion,
    candidateVersion: scenario.candidateVersion,
    finalVersion: scenario.finalVersion,
    updatePlan: scenario.updatePlan,
    checks: scenario.checks,
    protectedPaths: scenario.protectedPaths,
    credentialSnapshotMode: scenario.credentialSnapshotMode,
    updaterTouchedPaths: scenario.updaterTouchedPaths,
    issues,
    checked: [
      "fixture install reaches launchable baseline",
      "deferred update does not change active version",
      "failed update attempt leaves current version active before retry",
      "retry can apply the candidate update",
      "failed launch rolls back to the previous app binary and release metadata",
      "launch after rollback succeeds",
      "local DB, generated workspace, support bundle, operator files, and credential refs are preserved",
      "credential ref snapshots use metadata-only no-read mode",
      "dry-run remains credential-free and does not replace signed package or device evidence for #267"
    ]
  };
}

export async function runPackagedUpdateRollbackDryRun(options = {}) {
  const root = options.root ? resolve(options.root) : await mkdtemp(join(tmpdir(), "solo-packaged-update-rollback-dry-run-"));
  const shouldCleanup = options.cleanup ?? !options.root;

  try {
    const scenario = await runScenario(root);
    return evidenceForScenario(scenario, options.root ? "provided-root" : "temporary-root");
  } catch (error) {
    return {
      schemaVersion: PACKAGED_UPDATE_ROLLBACK_DRY_RUN_SCHEMA_VERSION,
      status: "failed",
      mode: "credential-free-fixture",
      issue: "https://github.com/bee-community-master/solo_superman/issues/289",
      upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/267",
      rootMode: options.root ? "provided-root" : "temporary-root",
      issues: [error instanceof Error ? error.message : String(error)],
      checked: []
    };
  } finally {
    if (shouldCleanup) {
      await rm(root, { recursive: true, force: true });
    }
  }
}

export function parsePackagedUpdateRollbackDryRunArgs(argv = process.argv.slice(2), env = process.env) {
  let root = env.SOLO_PACKAGED_UPDATE_ROLLBACK_DRY_RUN_ROOT;
  let cleanup;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--root") {
      if (!argv[index + 1]) {
        throw new Error("--root requires a path value");
      }
      root = argv[index + 1];
      cleanup = false;
      index += 1;
    } else if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
      cleanup = false;
    } else if (arg === "--cleanup-root") {
      cleanup = true;
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown packaged update rollback dry-run argument: ${arg}`);
    }
  }

  return {
    root: root ? resolve(root) : undefined,
    cleanup
  };
}

export async function runPackagedUpdateRollbackDryRunCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parsePackagedUpdateRollbackDryRunArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm verify:packaged-update-rollback:dry-run [--root <path>] [--cleanup-root]");
    return { status: "help" };
  }

  const evidence = await runPackagedUpdateRollbackDryRun({
    ...options,
    root: parsed.root ?? options.root,
    cleanup: parsed.cleanup ?? options.cleanup
  });
  console.log(JSON.stringify(evidence, null, 2));
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPackagedUpdateRollbackDryRunCli().then((evidence) => {
    if (evidence.status !== "passed") {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
