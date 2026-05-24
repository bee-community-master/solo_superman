#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION = "solo-superman-packaged-update-rollback.v1";
export const DEFAULT_PACKAGED_UPDATE_ROLLBACK_PATH = "docs/packaged-update-rollback.example.json";

const REQUIRED_PLATFORMS = new Set(["macos", "windows"]);
const REQUIRED_DEVICE_CHECKS = new Set([
  "install_signed_package",
  "apply_update",
  "defer_update",
  "retry_failed_update",
  "rollback_after_failed_launch",
  "launch_after_rollback",
  "preserve_user_data",
  "preserve_credentials"
]);
const REQUIRED_CREDENTIAL_FREE_COMMANDS = new Set([
  "pnpm verify:release-channel",
  "pnpm verify:packaged-update-rollback",
  "pnpm verify:packaged-update-rollback:dry-run",
  "pnpm verify:release-readiness",
  "pnpm verify"
]);
const REQUIRED_DEVICE_EVIDENCE_COMMANDS = new Set([
  "pnpm verify:packaged-update-rollback -- --require-device-evidence",
  "pnpm verify:release-readiness -- --require-ready"
]);
const REQUIRED_BLOCKER_ISSUE = "https://github.com/bee-community-master/solo_superman/issues/267";
const ALLOWED_ROLLBACK_STATUSES = new Set(["blocked", "ready"]);
const ALLOWED_DEVICE_RUN_STATUSES = new Set(["blocked", "passed"]);
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u;
const GENERIC_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const REPO_RELATIVE_EVIDENCE_REF_PATTERN =
  /^(?!(?:\/|\.{1,2}\/|.*(?:^|\/)\.\.(?:\/|$)))(?:README(?:\.en)?\.md(?:#[^\s\\?&=]+)?|(?:docs|release|artifacts|support|evidence|scripts)\/[^\s\\?&=]+)$/u;
const SAFE_URN_EVIDENCE_REF_PATTERN = /^urn:solo-superman-[A-Za-z0-9:._-]+$/u;
const ALLOWED_DEVICE_ENVIRONMENT_KINDS = new Set(["physical-device", "vm"]);
const PACKAGE_KINDS_BY_PLATFORM = new Map([
  ["macos", new Set(["macos-dmg", "macos-pkg"])],
  ["windows", new Set(["windows-msi", "windows-exe"])]
]);
const REQUIRED_PROTECTED_PATH_EVIDENCE = new Set([
  "localDatabase",
  "generatedWorkspace",
  "supportBundle",
  "operatorFiles",
  "credentials"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, path, message) {
  issues.push(`${path}: ${message}`);
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

function validateNoSecretStrings(contract, issues) {
  for (const { path, value } of collectStrings(contract)) {
    if (TOKEN_LIKE_PATTERN.test(value)) {
      addIssue(issues, path, "must not contain token-shaped values");
    }
  }
}

function validateHttpsUrlIfPresent(value, path, issues) {
  if (typeof value !== "string" || !URL_SCHEME_PATTERN.test(value)) {
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    addIssue(issues, path, "must be a valid URL when using URL evidence refs");
    return;
  }

  if (parsed.protocol !== "https:") {
    addIssue(issues, path, "must use https when using URL evidence refs");
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

function validateEvidenceRef(value, path, issues) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, path, "must be a non-empty evidence ref");
    return;
  }
  if (URL_SCHEME_PATTERN.test(value)) {
    validateHttpsUrlIfPresent(value, path, issues);
    return;
  }
  if (SAFE_URN_EVIDENCE_REF_PATTERN.test(value) || REPO_RELATIVE_EVIDENCE_REF_PATTERN.test(value)) {
    return;
  }
  if (GENERIC_SCHEME_PATTERN.test(value)) {
    addIssue(issues, path, "must use https, a solo-superman URN, or a repo-relative evidence path");
    return;
  }
  addIssue(issues, path, "must be an HTTPS URL, solo-superman URN, or repo-relative evidence path");
}

function validateStringList(value, path, issues, options = {}) {
  const { minItems = 1 } = options;
  if (!Array.isArray(value) || value.length < minItems) {
    addIssue(issues, path, `must be a string list with at least ${minItems} item(s)`);
    return new Set();
  }

  const strings = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      addIssue(issues, `${path}[${index}]`, "must be a non-empty string");
      continue;
    }
    strings.add(item);
    validateHttpsUrlIfPresent(item, `${path}[${index}]`, issues);
  }
  return strings;
}

function validateEvidenceRefList(value, path, issues, options = {}) {
  const { minItems = 1 } = options;
  if (!Array.isArray(value) || value.length < minItems) {
    addIssue(issues, path, `must be a string list with at least ${minItems} item(s)`);
    return new Set();
  }

  const refs = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      addIssue(issues, `${path}[${index}]`, "must be a non-empty string");
      continue;
    }
    refs.add(item);
    validateEvidenceRef(item, `${path}[${index}]`, issues);
  }
  return refs;
}

function validateNonEmptyString(value, path, issues, message = "must be a non-empty string") {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, path, message);
  }
}

function validateDeviceProfile(value, path, platform, issues) {
  if (!isRecord(value)) {
    addIssue(issues, path, "must describe the rollback device profile");
    return;
  }

  if (value.platform !== platform) {
    addIssue(issues, `${path}.platform`, `must be ${platform}`);
  }
  for (const field of ["osName", "osVersion", "architecture"]) {
    validateNonEmptyString(value[field], `${path}.${field}`, issues, "must be a non-empty device metadata string");
  }
  if (!ALLOWED_DEVICE_ENVIRONMENT_KINDS.has(value.environmentKind)) {
    addIssue(issues, `${path}.environmentKind`, "must be physical-device or vm");
  }
}

function validatePassedChecks(bundle, path, issues) {
  const passedChecks = validateStringList(bundle?.passedChecks, `${path}.passedChecks`, issues);
  for (const requiredCheck of REQUIRED_DEVICE_CHECKS) {
    if (!passedChecks.has(requiredCheck)) {
      addIssue(issues, `${path}.passedChecks`, `must include ${requiredCheck}`);
    }
  }
}

function validateEvidenceRefMap(value, path, requiredKeys, issues, message) {
  if (!isRecord(value)) {
    addIssue(issues, path, message);
    return;
  }

  for (const requiredKey of requiredKeys) {
    validateEvidenceRef(value[requiredKey], `${path}.${requiredKey}`, issues);
  }
}

function validatePassedEvidenceBundle(run, path, issues) {
  const bundle = run.evidenceBundle;
  const bundlePath = `${path}.evidenceBundle`;
  if (!isRecord(bundle)) {
    addIssue(issues, bundlePath, "must include structured rollback evidence when the device run passed");
    return;
  }

  validateDeviceProfile(bundle.deviceProfile, `${bundlePath}.deviceProfile`, run.platform, issues);
  const packageKinds = PACKAGE_KINDS_BY_PLATFORM.get(run.platform);
  if (!packageKinds?.has(bundle.packageKind)) {
    addIssue(issues, `${bundlePath}.packageKind`, `must be a signed ${run.platform} package kind`);
  }
  for (const field of ["initialVersion", "candidateVersion", "finalVersion"]) {
    validateNonEmptyString(bundle[field], `${bundlePath}.${field}`, issues);
  }
  if (bundle.credentialSnapshotMode !== "metadata_only_no_read") {
    addIssue(issues, `${bundlePath}.credentialSnapshotMode`, "must be metadata_only_no_read");
  }
  for (const field of [
    "packageArtifactRef",
    "manifestRef",
    "updateLogRef",
    "rollbackLogRef",
    "launchAfterRollbackRef",
    "preservationReportRef"
  ]) {
    validateEvidenceRef(bundle[field], `${bundlePath}.${field}`, issues);
  }
  validateEvidenceRefList(bundle.redactedEvidenceRefs, `${bundlePath}.redactedEvidenceRefs`, issues);
  validatePassedChecks(bundle, bundlePath, issues);
  validateEvidenceRefMap(
    bundle.checkEvidenceRefs,
    `${bundlePath}.checkEvidenceRefs`,
    REQUIRED_DEVICE_CHECKS,
    issues,
    "must map every rollback check to redacted evidence"
  );
  validateEvidenceRefMap(
    bundle.protectedPathEvidenceRefs,
    `${bundlePath}.protectedPathEvidenceRefs`,
    REQUIRED_PROTECTED_PATH_EVIDENCE,
    issues,
    "must map every protected path class to redacted preservation evidence"
  );
}

function validateRequiredCommandList(value, path, requiredCommands, issues) {
  const commands = validateStringList(value, path, issues);
  for (const required of requiredCommands) {
    if (!commands.has(required)) {
      addIssue(issues, path, `must include ${required}`);
    }
  }
}

function validateRequiredVerificationCommands(commands, issues) {
  if (!isRecord(commands)) {
    addIssue(issues, "$.requiredVerificationCommands", "must be an object");
    return;
  }

  validateRequiredCommandList(
    commands.credentialFree,
    "$.requiredVerificationCommands.credentialFree",
    REQUIRED_CREDENTIAL_FREE_COMMANDS,
    issues
  );
  validateRequiredCommandList(
    commands.deviceEvidence,
    "$.requiredVerificationCommands.deviceEvidence",
    REQUIRED_DEVICE_EVIDENCE_COMMANDS,
    issues
  );
}

function validateDeviceRun(run, path, issues) {
  if (!isRecord(run)) {
    addIssue(issues, path, "must be an object");
    return null;
  }

  if (typeof run.id !== "string" || run.id.trim().length === 0) {
    addIssue(issues, `${path}.id`, "must be a non-empty device run id");
  }
  if (!REQUIRED_PLATFORMS.has(run.platform)) {
    addIssue(issues, `${path}.platform`, "must be macos or windows");
  }
  if (!ALLOWED_DEVICE_RUN_STATUSES.has(run.status)) {
    addIssue(issues, `${path}.status`, "must be blocked or passed");
  }
  if (run.requiredFor !== "general-release") {
    addIssue(issues, `${path}.requiredFor`, "must be general-release");
  }

  validateEvidenceRefList(run.evidenceRefs, `${path}.evidenceRefs`, issues);
  validateStringList(run.requiredEvidence, `${path}.requiredEvidence`, issues);
  validateStringList(run.unblockCriteria, `${path}.unblockCriteria`, issues);
  const checks = validateStringList(run.requiredChecks, `${path}.requiredChecks`, issues);
  for (const requiredCheck of REQUIRED_DEVICE_CHECKS) {
    if (!checks.has(requiredCheck)) {
      addIssue(issues, `${path}.requiredChecks`, `must include ${requiredCheck}`);
    }
  }

  if (run.status === "blocked") {
    if (typeof run.blocker !== "string" || run.blocker.trim().length === 0) {
      addIssue(issues, `${path}.blocker`, "must describe why this device run is blocked");
    }
    if (run.blockerIssue !== REQUIRED_BLOCKER_ISSUE) {
      addIssue(issues, `${path}.blockerIssue`, "must link the tracked packaged updater rollback issue #267");
    }
  }

  if (run.blockerIssue !== undefined) {
    validateHttpsUrlIfPresent(run.blockerIssue, `${path}.blockerIssue`, issues);
  }

  if (run.status === "passed") {
    validateStringList(run.verifiedBy, `${path}.verifiedBy`, issues);
    if (typeof run.verifiedAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(run.verifiedAt)) {
      addIssue(issues, `${path}.verifiedAt`, "must be an ISO timestamp in UTC when the device run passed");
    }
    validatePassedEvidenceBundle(run, path, issues);
  }

  return typeof run.platform === "string" ? { id: run.id, platform: run.platform, status: run.status } : null;
}

function validateDeviceRuns(runs, issues) {
  if (!Array.isArray(runs) || runs.length === 0) {
    addIssue(issues, "$.deviceRuns", "must list macOS and Windows packaged update rollback runs");
    return [];
  }

  const seenPlatforms = new Set();
  const summaries = [];
  for (const [index, run] of runs.entries()) {
    const summary = validateDeviceRun(run, `$.deviceRuns[${index}]`, issues);
    if (!summary) {
      continue;
    }
    if (seenPlatforms.has(summary.platform)) {
      addIssue(issues, `$.deviceRuns[${index}].platform`, "must be unique within deviceRuns");
    }
    seenPlatforms.add(summary.platform);
    summaries.push(summary);
  }

  for (const requiredPlatform of REQUIRED_PLATFORMS) {
    if (!seenPlatforms.has(requiredPlatform)) {
      addIssue(issues, "$.deviceRuns", `must include ${requiredPlatform}`);
    }
  }

  return summaries;
}

function consistencyIssues(contract, deviceRunSummaries) {
  const issues = [];
  const blockedRuns = deviceRunSummaries.filter((run) => run.status === "blocked");
  const passedPlatforms = new Set(deviceRunSummaries.filter((run) => run.status === "passed").map((run) => run.platform));

  if (contract.rollbackStatus === "blocked" && blockedRuns.length === 0) {
    addIssue(issues, "$.rollbackStatus", "blocked status must name at least one blocked device run");
  }

  if (contract.rollbackStatus === "ready") {
    if (blockedRuns.length > 0) {
      addIssue(issues, "$.deviceRuns", "ready rollback evidence cannot include blocked device runs");
    }
    for (const requiredPlatform of REQUIRED_PLATFORMS) {
      if (!passedPlatforms.has(requiredPlatform)) {
        addIssue(issues, "$.deviceRuns", `ready rollback evidence must pass ${requiredPlatform}`);
      }
    }
  }

  return issues;
}

export function validatePackagedUpdateRollbackContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: packaged update rollback contract must be a JSON object"], deviceRunSummaries: [] };
  }

  if (contract.schemaVersion !== PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_ROLLBACK_STATUSES.has(contract.rollbackStatus)) {
    addIssue(issues, "$.rollbackStatus", "must be blocked or ready");
  }
  if (typeof contract.summary !== "string" || contract.summary.trim().length === 0) {
    addIssue(issues, "$.summary", "must describe the current packaged update rollback posture");
  }
  if (contract.releaseChannelContract !== "docs/release-channel_KO.md") {
    addIssue(issues, "$.releaseChannelContract", "must point to docs/release-channel_KO.md");
  }
  if (contract.releaseUpdateManifest !== "docs/release-update-channel.example.json") {
    addIssue(issues, "$.releaseUpdateManifest", "must point to docs/release-update-channel.example.json");
  }
  if (contract.blockerIssue !== REQUIRED_BLOCKER_ISSUE) {
    addIssue(issues, "$.blockerIssue", "must link the tracked packaged updater rollback issue #267");
  }
  validateHttpsUrlIfPresent(contract.blockerIssue, "$.blockerIssue", issues);

  validateRequiredVerificationCommands(contract.requiredVerificationCommands, issues);
  validateStringList(contract.preservationRequirements, "$.preservationRequirements", issues, { minItems: 3 });
  const deviceRunSummaries = validateDeviceRuns(contract.deviceRuns, issues);
  issues.push(...consistencyIssues(contract, deviceRunSummaries));
  validateNoSecretStrings(contract, issues);

  return { ok: issues.length === 0, issues, deviceRunSummaries };
}

export function evaluatePackagedUpdateRollback(contract, options = {}) {
  const validation = validatePackagedUpdateRollbackContract(contract);
  const blockers = [];

  if (!validation.ok) {
    blockers.push(...validation.issues);
  }

  const blockedDeviceRuns = validation.deviceRunSummaries.filter((run) => run.status === "blocked").map((run) => run.id);
  if (options.requireDeviceEvidence) {
    if (contract?.rollbackStatus !== "ready") {
      blockers.push("packaged update rollback evidence is not ready");
    }
    for (const runId of blockedDeviceRuns) {
      blockers.push(`${runId} device run is still blocked`);
    }
  }

  return {
    ok: blockers.length === 0,
    rollbackStatus: contract?.rollbackStatus ?? "invalid",
    packagedUpdateRollbackReady: validation.ok && contract?.rollbackStatus === "ready" && blockedDeviceRuns.length === 0,
    blockedDeviceRuns,
    blockers,
    validationIssues: validation.issues
  };
}

export function parsePackagedUpdateRollbackArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_PACKAGED_UPDATE_ROLLBACK_PATH;
  let requireDeviceEvidence = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--contract") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--contract requires a path value");
      }
      contractPath = next;
      index += 1;
      continue;
    }
    if (arg === "--require-device-evidence") {
      requireDeviceEvidence = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { contractPath, requireDeviceEvidence };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function evidenceForEvaluation(evaluation, options) {
  return {
    status: evaluation.ok ? "passed" : "blocked",
    schemaVersion: PACKAGED_UPDATE_ROLLBACK_SCHEMA_VERSION,
    mode: options.requireDeviceEvidence ? "require-device-evidence" : "contract",
    rollbackStatus: evaluation.rollbackStatus,
    packagedUpdateRollbackReady: evaluation.packagedUpdateRollbackReady,
    blockedDeviceRuns: evaluation.blockedDeviceRuns,
    blockers: evaluation.blockers,
    checked: [
      "packaged update rollback contract schema",
      "macOS and Windows device rollback evidence gates",
      "install/update/defer/retry/rollback/launch preservation checks",
      "secret-free rollback evidence strings",
      options.requireDeviceEvidence
        ? "all packaged update rollback device runs must be passed"
        : "blocked packaged update rollback posture is allowed only with explicit blockers"
    ]
  };
}

function exitCodeForEvidence(evidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const options = parsePackagedUpdateRollbackArgs();
  const contract = readJson(resolve(options.contractPath));
  const evidence = evidenceForEvaluation(evaluatePackagedUpdateRollback(contract, options), options);

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
