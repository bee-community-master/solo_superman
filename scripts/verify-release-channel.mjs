#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const RELEASE_UPDATE_MANIFEST_SCHEMA_VERSION = "solo-superman-release-update-manifest.v1";
export const DEFAULT_RELEASE_UPDATE_MANIFEST_PATH = "docs/release-update-channel.example.json";

const ALLOWED_CHANNELS = new Set(["preview", "beta", "stable"]);
const ALLOWED_ARTIFACT_KINDS = new Set(["macos-dmg", "macos-pkg", "windows-msi", "windows-exe", "archive-zip"]);
const ALLOWED_MANIFEST_SIGNATURE_KINDS = new Set(["ed25519", "minisign", "sigstore-bundle"]);
const ALLOWED_ARTIFACT_SIGNATURE_KINDS = new Set([
  "apple-codesign-notarization",
  "windows-authenticode",
  "sigstore-bundle",
  "minisign"
]);
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
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function addIssue(issues, path, message) {
  issues.push(`${path}: ${message}`);
}

function validateHttpsUrl(value, path, issues) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, path, "must be a non-empty HTTPS URL");
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    addIssue(issues, path, "must be a valid HTTPS URL");
    return;
  }

  if (parsed.protocol !== "https:") {
    addIssue(issues, path, "must use https");
  }
  if (parsed.username || parsed.password) {
    addIssue(issues, path, "must not contain URL userinfo credentials");
  }
  for (const key of parsed.searchParams.keys()) {
    if (SECRET_QUERY_NAME_PATTERN.test(key)) {
      addIssue(issues, path, `must not contain secret-like query parameter ${key}`);
    }
  }
}

function collectStrings(value, path = "$", strings = []) {
  if (typeof value === "string") {
    strings.push({ path, value });
    return strings;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, strings));
    return strings;
  }

  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, `${path}.${key}`, strings);
    }
  }

  return strings;
}

function validateNoSecretStrings(manifest, issues) {
  for (const { path, value } of collectStrings(manifest)) {
    if (TOKEN_LIKE_PATTERN.test(value)) {
      addIssue(issues, path, "must not contain token-shaped values");
    }
  }
}

function validateUpdatePolicy(policy, issues) {
  if (!isRecord(policy)) {
    addIssue(issues, "$.updatePolicy", "must be an object");
    return;
  }

  for (const flag of REQUIRED_UPDATE_POLICY_FLAGS) {
    if (policy[flag] !== true) {
      addIssue(issues, `$.updatePolicy.${flag}`, "must be true before packaged automatic updates are enabled");
    }
  }

  if (typeof policy.failureMode !== "string" || policy.failureMode.trim().length === 0) {
    addIssue(issues, "$.updatePolicy.failureMode", "must describe the safe failure behavior");
  }
  if (typeof policy.rollbackBoundary !== "string" || policy.rollbackBoundary.trim().length === 0) {
    addIssue(issues, "$.updatePolicy.rollbackBoundary", "must describe what rollback may and may not change");
  }
  if (typeof policy.credentialBoundary !== "string" || policy.credentialBoundary.trim().length === 0) {
    addIssue(issues, "$.updatePolicy.credentialBoundary", "must describe how credentials remain untouched");
  }
}

function expectedSignatureKindForPlatform(platform) {
  if (typeof platform !== "string") {
    return null;
  }
  if (platform.startsWith("macos-")) {
    return "apple-codesign-notarization";
  }
  if (platform.startsWith("windows-")) {
    return "windows-authenticode";
  }

  return null;
}

function artifactKindMatchesPlatform(platform, kind) {
  if (platform === "macos-arm64" || platform === "macos-x64") {
    return kind === "macos-dmg" || kind === "macos-pkg" || kind === "archive-zip";
  }
  if (platform === "windows-x64") {
    return kind === "windows-msi" || kind === "windows-exe" || kind === "archive-zip";
  }

  return false;
}

function validateSignature(signature, path, issues, options = {}) {
  const { allowedKinds = ALLOWED_ARTIFACT_SIGNATURE_KINDS, expectedKind = null } = options;
  if (!isRecord(signature)) {
    addIssue(issues, path, "must be an object");
    return;
  }

  if (!allowedKinds.has(signature.kind)) {
    addIssue(issues, `${path}.kind`, "must use an approved signature kind");
  }
  if (expectedKind && signature.kind !== expectedKind && signature.kind !== "sigstore-bundle") {
    addIssue(issues, `${path}.kind`, `must be ${expectedKind} or sigstore-bundle for this platform`);
  }
  if (typeof signature.publicKeyId !== "string" || signature.publicKeyId.trim().length === 0) {
    addIssue(issues, `${path}.publicKeyId`, "must identify the verification key/certificate");
  }
  validateHttpsUrl(signature.signatureRef, `${path}.signatureRef`, issues);
}

function validateArtifacts(artifacts, issues) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    addIssue(issues, "$.artifacts", "must contain at least one signed artifact");
    return;
  }

  const seenPlatforms = new Set();
  for (const [index, artifact] of artifacts.entries()) {
    const path = `$.artifacts[${index}]`;
    if (!isRecord(artifact)) {
      addIssue(issues, path, "must be an object");
      continue;
    }

    if (!["macos-arm64", "macos-x64", "windows-x64"].includes(artifact.platform)) {
      addIssue(issues, `${path}.platform`, "must be macos-arm64, macos-x64, or windows-x64");
    } else if (seenPlatforms.has(artifact.platform)) {
      addIssue(issues, `${path}.platform`, "must be unique within the manifest");
    } else {
      seenPlatforms.add(artifact.platform);
    }

    if (!ALLOWED_ARTIFACT_KINDS.has(artifact.packageKind)) {
      addIssue(issues, `${path}.packageKind`, "must use an approved package kind");
    } else if (!artifactKindMatchesPlatform(artifact.platform, artifact.packageKind)) {
      addIssue(issues, `${path}.packageKind`, "must match the target platform");
    }

    validateHttpsUrl(artifact.url, `${path}.url`, issues);
    if (typeof artifact.sha256 !== "string" || !SHA256_PATTERN.test(artifact.sha256)) {
      addIssue(issues, `${path}.sha256`, "must be a lowercase 64-character SHA-256 hex digest");
    }
    if (!isPositiveInteger(artifact.sizeBytes)) {
      addIssue(issues, `${path}.sizeBytes`, "must be a positive integer");
    }
    validateSignature(artifact.signature, `${path}.signature`, issues, {
      expectedKind: expectedSignatureKindForPlatform(artifact.platform)
    });
  }
}

export function validateReleaseUpdateManifest(manifest) {
  const issues = [];

  if (!isRecord(manifest)) {
    return { ok: false, issues: ["$: manifest must be a JSON object"] };
  }

  if (manifest.schemaVersion !== RELEASE_UPDATE_MANIFEST_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${RELEASE_UPDATE_MANIFEST_SCHEMA_VERSION}`);
  }
  if (manifest.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_CHANNELS.has(manifest.channel)) {
    addIssue(issues, "$.channel", "must be preview, beta, or stable");
  }
  if (typeof manifest.version !== "string" || !SEMVER_PATTERN.test(manifest.version)) {
    addIssue(issues, "$.version", "must be a semver string without a leading v");
  }
  if (typeof manifest.releasedAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(manifest.releasedAt)) {
    addIssue(issues, "$.releasedAt", "must be an ISO timestamp in UTC, for example 2026-05-23T00:00:00Z");
  }
  validateHttpsUrl(manifest.releaseNotesUrl, "$.releaseNotesUrl", issues);
  validateUpdatePolicy(manifest.updatePolicy, issues);
  validateSignature(manifest.manifestSignature, "$.manifestSignature", issues, {
    allowedKinds: ALLOWED_MANIFEST_SIGNATURE_KINDS
  });
  validateArtifacts(manifest.artifacts, issues);
  validateNoSecretStrings(manifest, issues);

  return { ok: issues.length === 0, issues };
}

export function parseReleaseChannelArgs(argv = process.argv.slice(2)) {
  let manifestPath = DEFAULT_RELEASE_UPDATE_MANIFEST_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--manifest") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--manifest requires a path value");
      }
      manifestPath = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { manifestPath };
}

export function readReleaseUpdateManifest(manifestPath) {
  return JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
}

export function verifyReleaseUpdateManifestFile(manifestPath = DEFAULT_RELEASE_UPDATE_MANIFEST_PATH) {
  const manifest = readReleaseUpdateManifest(manifestPath);
  const validation = validateReleaseUpdateManifest(manifest);

  return {
    status: validation.ok ? "passed" : "failed",
    manifestPath,
    issues: validation.issues,
    checked: validation.ok
      ? [
          "manifest schema version is recognized",
          "release URLs are HTTPS and credential-free",
          "update policy requires consent, deferral, manifest signature, artifact checksum, artifact signature, user-data preservation, credential preservation, retry, and rollback",
          "platform artifacts have compatible package kinds, checksums, and signatures"
        ]
      : []
  };
}

async function main() {
  try {
    const { manifestPath } = parseReleaseChannelArgs();
    const evidence = verifyReleaseUpdateManifestFile(manifestPath);
    console.log(JSON.stringify(evidence, null, 2));
    if (evidence.status !== "passed") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
