#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PACKAGED_UPDATE_ROLLBACK_DRY_RUN_SCHEMA_VERSION = "solo-superman-packaged-update-rollback-dry-run.v1";

const APP_PATHS = {
  binary: "app/bin/solo-superman",
  releaseMetadata: "app/release-metadata.json",
  updateState: "app/update-state.json"
};
const PROTECTED_PATHS = [
  "data/local.db",
  "workspace/generated-project/README.md",
  "support/solo-support-bundle.json",
  "operator-files/release-notes.md",
  "credentials/codex-cli-login-ref.txt"
];
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function absolutePath(root, relativePath) {
  return resolve(root, relativePath);
}

async function writeText(root, relativePath, value) {
  const target = absolutePath(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function writeJson(root, relativePath, value) {
  await writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readText(root, relativePath) {
  return await readFile(absolutePath(root, relativePath), "utf8");
}

async function readJson(root, relativePath) {
  return JSON.parse(await readText(root, relativePath));
}

async function snapshotFiles(root, relativePaths) {
  const entries = await Promise.all(relativePaths.map(async (relativePath) => {
    const content = await readFile(absolutePath(root, relativePath));
    return [relativePath, { sha256: sha256(content), sizeBytes: content.byteLength }];
  }));

  return Object.fromEntries(entries);
}

function compareSnapshots(before, after) {
  return Object.keys(before).filter((relativePath) => {
    const previous = before[relativePath];
    const current = after[relativePath];
    return !current || previous.sha256 !== current.sha256 || previous.sizeBytes !== current.sizeBytes;
  });
}

function releaseDescriptor(version) {
  return {
    version,
    appId: "solo-superman",
    packageKind: "fixture-package",
    signedArtifactRef: `fixture://solo-superman/${version}`
  };
}

async function writeInstalledRelease(root, release) {
  await writeText(root, APP_PATHS.binary, `solo-superman fixture binary ${release.version}\n`);
  await writeJson(root, APP_PATHS.releaseMetadata, release);
}

async function readInstalledRelease(root) {
  return await readJson(root, APP_PATHS.releaseMetadata);
}

async function createFixtureInstall(root) {
  await writeInstalledRelease(root, releaseDescriptor("0.1.0"));
  await writeJson(root, APP_PATHS.updateState, { status: "idle", activeVersion: "0.1.0" });
  await writeText(root, "data/local.db", "fixture local database\n");
  await writeText(root, "workspace/generated-project/README.md", "# Generated project fixture\n");
  await writeJson(root, "support/solo-support-bundle.json", { fixture: true, credentialFree: true });
  await writeText(root, "operator-files/release-notes.md", "operator-owned release notes\n");
  await writeText(root, "credentials/codex-cli-login-ref.txt", "fixture credential reference only; no real credential value\n");
}

async function deferUpdate(root, candidateRelease) {
  const current = await readInstalledRelease(root);
  await writeJson(root, APP_PATHS.updateState, {
    status: "deferred",
    activeVersion: current.version,
    candidateVersion: candidateRelease.version
  });

  return (await readInstalledRelease(root)).version === current.version;
}

async function applyUpdate(root, candidateRelease, options = {}) {
  const previousRelease = await readInstalledRelease(root);
  if (options.failBeforeWrite) {
    await writeJson(root, APP_PATHS.updateState, {
      status: "failed_before_write",
      activeVersion: previousRelease.version,
      candidateVersion: candidateRelease.version,
      reason: "fixture checksum failure before install write"
    });
    return { applied: false, previousRelease };
  }

  await writeInstalledRelease(root, candidateRelease);
  await writeJson(root, APP_PATHS.updateState, {
    status: "applied",
    previousVersion: previousRelease.version,
    activeVersion: candidateRelease.version
  });

  return { applied: true, previousRelease };
}

async function launchInstalledRelease(root) {
  const release = await readInstalledRelease(root);
  const binary = await readText(root, APP_PATHS.binary);

  return {
    ok: binary.includes(release.version),
    version: release.version
  };
}

async function rollbackToRelease(root, release, reason) {
  await writeInstalledRelease(root, release);
  await writeJson(root, APP_PATHS.updateState, {
    status: "rolled_back",
    activeVersion: release.version,
    reason
  });
}

async function runScenario(root) {
  await createFixtureInstall(root);
  const protectedBefore = await snapshotFiles(root, PROTECTED_PATHS);
  const initialLaunch = await launchInstalledRelease(root);
  const candidateRelease = releaseDescriptor("0.1.1");
  const deferredWithoutChangingVersion = await deferUpdate(root, candidateRelease);
  const failedAttempt = await applyUpdate(root, candidateRelease, { failBeforeWrite: true });
  const versionAfterFailedAttempt = (await readInstalledRelease(root)).version;
  const retry = await applyUpdate(root, candidateRelease);
  const versionAfterRetry = (await readInstalledRelease(root)).version;
  const launchAfterUpdate = { ok: false, version: candidateRelease.version, reason: "fixture launch verification failure" };

  await rollbackToRelease(root, retry.previousRelease, launchAfterUpdate.reason);

  const launchAfterRollback = await launchInstalledRelease(root);
  const protectedAfter = await snapshotFiles(root, PROTECTED_PATHS);
  const changedProtectedPaths = compareSnapshots(protectedBefore, protectedAfter);
  const finalRelease = await readInstalledRelease(root);
  const checks = {
    install_signed_package: initialLaunch.ok && initialLaunch.version === "0.1.0",
    apply_update: retry.applied === true && versionAfterRetry === candidateRelease.version,
    defer_update: deferredWithoutChangingVersion === true,
    retry_failed_update: failedAttempt.applied === false && versionAfterFailedAttempt === "0.1.0" && versionAfterRetry === candidateRelease.version,
    rollback_after_failed_launch: launchAfterUpdate.ok === false && finalRelease.version === retry.previousRelease.version,
    launch_after_rollback: launchAfterRollback.ok === true && launchAfterRollback.version === "0.1.0",
    preserve_user_data: changedProtectedPaths.filter((path) => path !== "credentials/codex-cli-login-ref.txt").length === 0,
    preserve_credentials: !changedProtectedPaths.includes("credentials/codex-cli-login-ref.txt")
  };

  return {
    initialVersion: "0.1.0",
    candidateVersion: candidateRelease.version,
    finalVersion: finalRelease.version,
    checks,
    changedProtectedPaths,
    protectedPaths: PROTECTED_PATHS,
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
    checks: scenario.checks,
    protectedPaths: scenario.protectedPaths,
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
