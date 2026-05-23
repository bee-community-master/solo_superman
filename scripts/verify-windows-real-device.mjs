#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const WINDOWS_REAL_DEVICE_SCHEMA_VERSION = "solo-superman-windows-real-device.v1";
export const DEFAULT_WINDOWS_REAL_DEVICE_PATH = "docs/windows-real-device.example.json";

const REQUIRED_PLATFORM = "windows";
const REQUIRED_DEVICE_CHECKS = new Set([
  "run_administrator_powershell_one_line_installer",
  "handle_uac_elevation",
  "install_or_reuse_node_git_corepack_pnpm",
  "install_or_verify_wsl_ubuntu",
  "install_or_reuse_codex_cli_in_wsl",
  "verify_visual_cpp_runtime",
  "create_desktop_shortcut",
  "reach_first_screen",
  "rerun_installer_safe_update",
  "generate_support_bundle",
  "collect_bootstrap_and_prod_smoke_logs"
]);
const REQUIRED_CREDENTIAL_FREE_COMMANDS = new Set([
  "pnpm verify:prod-bundle",
  "pnpm verify:windows-real-device",
  "pnpm verify:windows-installer:dry-run",
  "pnpm verify:release-readiness",
  "pnpm verify"
]);
const REQUIRED_DEVICE_EVIDENCE_COMMANDS = new Set([
  "pnpm verify:windows-real-device -- --require-device-evidence",
  "pnpm verify:release-readiness -- --require-ready"
]);
const REQUIRED_BLOCKER_ISSUE = "https://github.com/bee-community-master/solo_superman/issues/259";
const ALLOWED_VERIFICATION_STATUSES = new Set(["blocked", "ready"]);
const ALLOWED_DEVICE_RUN_STATUSES = new Set(["blocked", "passed"]);
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u;

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
  if (run.platform !== REQUIRED_PLATFORM) {
    addIssue(issues, `${path}.platform`, "must be windows");
  }
  if (!ALLOWED_DEVICE_RUN_STATUSES.has(run.status)) {
    addIssue(issues, `${path}.status`, "must be blocked or passed");
  }
  if (run.requiredFor !== "general-release") {
    addIssue(issues, `${path}.requiredFor`, "must be general-release");
  }

  validateStringList(run.evidenceRefs, `${path}.evidenceRefs`, issues);
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
      addIssue(issues, `${path}.blockerIssue`, "must link the tracked Windows real-device issue #259");
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
  }

  return typeof run.id === "string" ? { id: run.id, platform: run.platform, status: run.status } : null;
}

function validateDeviceRuns(runs, issues) {
  if (!Array.isArray(runs) || runs.length === 0) {
    addIssue(issues, "$.deviceRuns", "must list at least one Windows real-device run");
    return [];
  }

  const summaries = [];
  for (const [index, run] of runs.entries()) {
    const summary = validateDeviceRun(run, `$.deviceRuns[${index}]`, issues);
    if (summary) {
      summaries.push(summary);
    }
  }

  if (!summaries.some((run) => run.platform === REQUIRED_PLATFORM)) {
    addIssue(issues, "$.deviceRuns", "must include a windows run");
  }

  return summaries;
}

function consistencyIssues(contract, deviceRunSummaries) {
  const issues = [];
  const blockedRuns = deviceRunSummaries.filter((run) => run.status === "blocked");
  const passedWindowsRuns = deviceRunSummaries.filter((run) => run.platform === REQUIRED_PLATFORM && run.status === "passed");

  if (contract.windowsVerificationStatus === "blocked" && blockedRuns.length === 0) {
    addIssue(issues, "$.windowsVerificationStatus", "blocked status must name at least one blocked device run");
  }

  if (contract.windowsVerificationStatus === "ready") {
    if (blockedRuns.length > 0) {
      addIssue(issues, "$.deviceRuns", "ready Windows evidence cannot include blocked device runs");
    }
    if (passedWindowsRuns.length === 0) {
      addIssue(issues, "$.deviceRuns", "ready Windows evidence must pass at least one Windows run");
    }
  }

  return issues;
}

export function validateWindowsRealDeviceContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: Windows real-device contract must be a JSON object"], deviceRunSummaries: [] };
  }

  if (contract.schemaVersion !== WINDOWS_REAL_DEVICE_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${WINDOWS_REAL_DEVICE_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_VERIFICATION_STATUSES.has(contract.windowsVerificationStatus)) {
    addIssue(issues, "$.windowsVerificationStatus", "must be blocked or ready");
  }
  if (typeof contract.summary !== "string" || contract.summary.trim().length === 0) {
    addIssue(issues, "$.summary", "must describe the current Windows real-device posture");
  }
  if (contract.releaseReadinessContract !== "docs/release-readiness_KO.md") {
    addIssue(issues, "$.releaseReadinessContract", "must point to docs/release-readiness_KO.md");
  }
  if (contract.blockerIssue !== REQUIRED_BLOCKER_ISSUE) {
    addIssue(issues, "$.blockerIssue", "must link the tracked Windows real-device issue #259");
  }
  validateHttpsUrlIfPresent(contract.blockerIssue, "$.blockerIssue", issues);

  validateRequiredVerificationCommands(contract.requiredVerificationCommands, issues);
  validateStringList(contract.privacyRequirements, "$.privacyRequirements", issues, { minItems: 2 });
  const deviceRunSummaries = validateDeviceRuns(contract.deviceRuns, issues);
  issues.push(...consistencyIssues(contract, deviceRunSummaries));
  validateNoSecretStrings(contract, issues);

  return { ok: issues.length === 0, issues, deviceRunSummaries };
}

export function evaluateWindowsRealDevice(contract, options = {}) {
  const validation = validateWindowsRealDeviceContract(contract);
  const blockers = [];

  if (!validation.ok) {
    blockers.push(...validation.issues);
  }

  const blockedDeviceRuns = validation.deviceRunSummaries.filter((run) => run.status === "blocked").map((run) => run.id);
  if (options.requireDeviceEvidence) {
    if (contract?.windowsVerificationStatus !== "ready") {
      blockers.push("Windows real-device evidence is not ready");
    }
    for (const runId of blockedDeviceRuns) {
      blockers.push(`${runId} device run is still blocked`);
    }
  }

  return {
    ok: blockers.length === 0,
    windowsVerificationStatus: contract?.windowsVerificationStatus ?? "invalid",
    windowsRealDeviceReady: validation.ok && contract?.windowsVerificationStatus === "ready" && blockedDeviceRuns.length === 0,
    blockedDeviceRuns,
    blockers,
    validationIssues: validation.issues
  };
}

export function parseWindowsRealDeviceArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_WINDOWS_REAL_DEVICE_PATH;
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
    schemaVersion: WINDOWS_REAL_DEVICE_SCHEMA_VERSION,
    mode: options.requireDeviceEvidence ? "require-device-evidence" : "contract",
    windowsVerificationStatus: evaluation.windowsVerificationStatus,
    windowsRealDeviceReady: evaluation.windowsRealDeviceReady,
    blockedDeviceRuns: evaluation.blockedDeviceRuns,
    blockers: evaluation.blockers,
    checked: [
      "Windows real-device contract schema",
      "clean Windows 11 one-line installer evidence gate",
      "UAC/prerequisite/WSL/Codex/runtime/first-screen checks",
      "secret-free Windows evidence strings",
      options.requireDeviceEvidence
        ? "all Windows real-device runs must be passed"
        : "blocked Windows real-device posture is allowed only with explicit blockers"
    ]
  };
}

function exitCodeForEvidence(evidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const options = parseWindowsRealDeviceArgs();
  const contract = readJson(resolve(options.contractPath));
  const evidence = evidenceForEvaluation(evaluateWindowsRealDevice(contract, options), options);

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
