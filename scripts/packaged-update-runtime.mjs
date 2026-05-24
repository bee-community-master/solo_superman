import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { validateReleaseUpdateManifest } from "./verify-release-channel.mjs";

export const PACKAGED_UPDATE_RUNTIME_SCHEMA_VERSION = "solo-superman-packaged-update-runtime.v1";

export const APP_PATHS = {
  binary: "app/bin/solo-superman",
  releaseMetadata: "app/release-metadata.json",
  updateState: "app/update-state.json"
};

export const DEFAULT_UPDATE_PROTECTED_PATH_POLICIES = [
  { relativePath: "data/local.db", snapshotMode: "preserve_content" },
  { relativePath: "workspace/generated-project/README.md", snapshotMode: "preserve_content" },
  { relativePath: "support/solo-support-bundle.json", snapshotMode: "preserve_content" },
  { relativePath: "operator-files/release-notes.md", snapshotMode: "preserve_content" },
  { relativePath: "credentials/codex-cli-login-ref.txt", snapshotMode: "metadata_only_no_read" }
];

const REQUIRED_UPDATE_POLICY_FLAGS = [
  "requiresUserConsent",
  "allowsUserDeferral",
  "verifiesManifestSignature",
  "verifiesArtifactChecksum",
  "verifiesArtifactSignature",
  "preservesUserData",
  "preservesCredentials",
  "supportsRetry",
  "supportsRollback"
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}


function normalizeRoot(root) {
  return resolve(root);
}

export function resolveInsideRoot(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
    throw new Error("relativePath must be a non-empty string");
  }
  if (relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(relativePath)) {
    throw new Error(`Refusing absolute update path: ${relativePath}`);
  }

  const normalizedRoot = normalizeRoot(root);
  const target = resolve(normalizedRoot, relativePath);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Refusing update path outside install root: ${relativePath}`);
  }

  return target;
}

async function writeText(root, relativePath, value) {
  const target = resolveInsideRoot(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function writeJson(root, relativePath, value) {
  await writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readText(root, relativePath) {
  return await readFile(resolveInsideRoot(root, relativePath), "utf8");
}

async function readJson(root, relativePath) {
  return JSON.parse(await readText(root, relativePath));
}

function parseSemver(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.exec(version);
  if (!match) {
    return null;
  }
  return match.slice(1, 4).map(Number);
}

function compareSemver(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  if (!leftParts || !rightParts) {
    return 0;
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function releaseDescriptor(version, overrides = {}) {
  return {
    version,
    appId: "solo-superman",
    packageKind: "fixture-package",
    signedArtifactRef: `fixture://solo-superman/${version}`,
    ...overrides
  };
}

export async function writeInstalledRelease(root, release) {
  await writeText(root, APP_PATHS.binary, `solo-superman packaged runtime binary ${release.version}\n`);
  await writeJson(root, APP_PATHS.releaseMetadata, release);
}

export async function readInstalledRelease(root) {
  return await readJson(root, APP_PATHS.releaseMetadata);
}

async function writeUpdateState(root, value) {
  await writeJson(root, APP_PATHS.updateState, {
    schemaVersion: PACKAGED_UPDATE_RUNTIME_SCHEMA_VERSION,
    ...value
  });
}

export async function launchInstalledRelease(root) {
  const release = await readInstalledRelease(root);
  const binary = await readText(root, APP_PATHS.binary);

  return {
    ok: binary.includes(release.version),
    version: release.version
  };
}

async function snapshotOneProtectedPath(root, policy) {
  const filePath = resolveInsideRoot(root, policy.relativePath);
  let info;
  try {
    info = await stat(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        relativePath: policy.relativePath,
        snapshotMode: policy.snapshotMode,
        exists: false,
        contentRead: false
      };
    }
    throw error;
  }

  const base = {
    relativePath: policy.relativePath,
    snapshotMode: policy.snapshotMode,
    exists: true,
    sizeBytes: info.size,
    mtimeMs: info.mtimeMs
  };

  if (policy.snapshotMode === "metadata_only_no_read") {
    return {
      ...base,
      contentRead: false
    };
  }

  const content = await readFile(filePath);
  return {
    ...base,
    contentRead: true,
    sha256: sha256(content)
  };
}

export async function snapshotUpdateProtectedPaths(root, policies = DEFAULT_UPDATE_PROTECTED_PATH_POLICIES) {
  const snapshots = [];
  for (const policy of policies) {
    snapshots.push(await snapshotOneProtectedPath(root, policy));
  }
  return snapshots;
}

export function compareUpdateProtectedSnapshots(before, after) {
  const afterByPath = new Map(after.map((entry) => [entry.relativePath, entry]));
  return before.flatMap((previous) => {
    const current = afterByPath.get(previous.relativePath);
    if (!current) {
      return [previous.relativePath];
    }
    if (previous.exists !== current.exists) {
      return [previous.relativePath];
    }
    if (!previous.exists && !current.exists) {
      return [];
    }
    if (previous.sizeBytes !== current.sizeBytes) {
      return [previous.relativePath];
    }
    if (previous.snapshotMode === "metadata_only_no_read" || current.snapshotMode === "metadata_only_no_read") {
      return previous.mtimeMs === current.mtimeMs ? [] : [previous.relativePath];
    }
    return previous.sha256 === current.sha256 ? [] : [previous.relativePath];
  });
}

function findTargetArtifact(manifest, targetPlatform) {
  return Array.isArray(manifest?.artifacts)
    ? manifest.artifacts.find((artifact) => artifact?.platform === targetPlatform)
    : undefined;
}

function summarizeArtifact(artifact) {
  return {
    platform: artifact?.platform,
    packageKind: artifact?.packageKind,
    url: artifact?.url,
    sha256: artifact?.sha256,
    sizeBytes: artifact?.sizeBytes,
    signatureKind: artifact?.signature?.kind,
    signatureRef: artifact?.signature?.signatureRef,
    publicKeyId: artifact?.signature?.publicKeyId
  };
}

export function buildPackagedUpdatePlan({ manifest, targetPlatform, installedRelease }) {
  const manifestValidation = validateReleaseUpdateManifest(manifest);
  const issues = [...manifestValidation.issues];
  const currentVersion = installedRelease?.version;
  const candidateVersion = manifest?.version;

  if (!targetPlatform) {
    issues.push("target platform is required");
  }
  if (!isRecord(installedRelease) || installedRelease.appId !== "solo-superman") {
    issues.push("installed release metadata must identify solo-superman");
  }
  if (currentVersion && !parseSemver(currentVersion)) {
    issues.push("installed release version must be semver");
  }
  if (currentVersion && candidateVersion && compareSemver(candidateVersion, currentVersion) <= 0) {
    issues.push("candidate version must be newer than the installed version");
  }

  const artifact = findTargetArtifact(manifest, targetPlatform);
  if (!artifact) {
    issues.push(`no artifact found for target platform ${targetPlatform}`);
  }

  return {
    schemaVersion: PACKAGED_UPDATE_RUNTIME_SCHEMA_VERSION,
    status: issues.length === 0 ? "ready" : "blocked",
    issues,
    appId: "solo-superman",
    currentVersion,
    candidateVersion,
    targetPlatform,
    manifestSignatureRef: manifest?.manifestSignature?.signatureRef,
    artifact: artifact ? summarizeArtifact(artifact) : null,
    requiredPolicyFlags: REQUIRED_UPDATE_POLICY_FLAGS
  };
}

function assertReadyPlan(plan) {
  if (!plan || plan.status !== "ready") {
    throw new Error(`Packaged update plan is not ready: ${(plan?.issues ?? ["missing plan"]).join("; ")}`);
  }
}

export async function deferPackagedUpdate(root, plan) {
  assertReadyPlan(plan);
  const current = await readInstalledRelease(root);
  await writeUpdateState(root, {
    status: "deferred",
    activeVersion: current.version,
    candidateVersion: plan.candidateVersion,
    targetPlatform: plan.targetPlatform,
    artifactSha256: plan.artifact.sha256
  });

  return {
    status: "deferred",
    activeVersion: current.version,
    candidateVersion: plan.candidateVersion
  };
}

export async function rollbackPackagedUpdate(root, release, reason) {
  await writeInstalledRelease(root, release);
  await writeUpdateState(root, {
    status: "rolled_back",
    activeVersion: release.version,
    reason
  });

  return {
    status: "rolled_back",
    activeVersion: release.version,
    reason
  };
}

export async function applyPackagedUpdate(root, plan, options = {}) {
  assertReadyPlan(plan);
  const protectedPolicies = options.protectedPathPolicies ?? DEFAULT_UPDATE_PROTECTED_PATH_POLICIES;
  const previousRelease = await readInstalledRelease(root);
  const protectedBefore = await snapshotUpdateProtectedPaths(root, protectedPolicies);

  if (options.failBeforeWrite) {
    await writeUpdateState(root, {
      status: "failed_before_write",
      activeVersion: previousRelease.version,
      candidateVersion: plan.candidateVersion,
      reason: options.failureReason ?? "update failed before writing the candidate package"
    });
    const protectedAfterFailure = await snapshotUpdateProtectedPaths(root, protectedPolicies);
    return {
      status: "failed_before_write",
      applied: false,
      retryable: true,
      previousRelease,
      finalRelease: await readInstalledRelease(root),
      changedProtectedPaths: compareUpdateProtectedSnapshots(protectedBefore, protectedAfterFailure),
      protectedSnapshots: { before: protectedBefore, after: protectedAfterFailure },
      touchedPaths: Object.values(APP_PATHS)
    };
  }

  const candidateRelease = releaseDescriptor(plan.candidateVersion, {
    packageKind: plan.artifact.packageKind,
    signedArtifactRef: plan.artifact.url,
    artifactSha256: plan.artifact.sha256,
    artifactSignatureRef: plan.artifact.signatureRef,
    manifestSignatureRef: plan.manifestSignatureRef
  });
  await writeInstalledRelease(root, candidateRelease);
  await writeUpdateState(root, {
    status: "applied",
    previousVersion: previousRelease.version,
    activeVersion: candidateRelease.version,
    targetPlatform: plan.targetPlatform,
    artifactSha256: plan.artifact.sha256
  });

  const launchVerification = options.launchVerifier
    ? await options.launchVerifier(root, candidateRelease, plan)
    : await launchInstalledRelease(root);
  let rollbackResult = null;

  if (!launchVerification.ok) {
    rollbackResult = await rollbackPackagedUpdate(
      root,
      previousRelease,
      launchVerification.reason ?? "launch verification failed after packaged update"
    );
  }

  const protectedAfter = await snapshotUpdateProtectedPaths(root, protectedPolicies);
  const finalRelease = await readInstalledRelease(root);
  const changedProtectedPaths = compareUpdateProtectedSnapshots(protectedBefore, protectedAfter);

  return {
    status: rollbackResult ? "rolled_back_after_failed_launch" : "applied",
    applied: true,
    retryable: false,
    rollbackApplied: Boolean(rollbackResult),
    previousRelease,
    candidateRelease,
    finalRelease,
    launchVerification,
    rollbackResult,
    changedProtectedPaths,
    protectedSnapshots: { before: protectedBefore, after: protectedAfter },
    touchedPaths: Object.values(APP_PATHS)
  };
}
