#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const RELEASE_READINESS_SCHEMA_VERSION = "solo-superman-release-readiness.v1";
export const DEFAULT_RELEASE_READINESS_PATH = "docs/release-readiness.example.json";

const REQUIRED_RELEASE_GATES = new Set([
  "signed-packages",
  "packaged-update-rollback",
  "windows-real-device"
]);
const REQUIRED_BLOCKER_ISSUES_BY_GATE = new Map([
  [
    "signed-packages",
    {
      url: "https://github.com/bee-community-master/solo_superman/issues/266",
      label: "the tracked signed package release evidence issue #266"
    }
  ],
  [
    "packaged-update-rollback",
    {
      url: "https://github.com/bee-community-master/solo_superman/issues/267",
      label: "the tracked packaged updater rollback verification issue #267"
    }
  ],
  [
    "windows-real-device",
    {
      url: "https://github.com/bee-community-master/solo_superman/issues/259",
      label: "the tracked Windows real-device verification issue #259"
    }
  ]
]);
const REQUIRED_CREDENTIAL_FREE_COMMANDS = new Set([
  "pnpm verify:prod-bundle",
  "pnpm verify:release-channel",
  "pnpm verify:windows-real-device",
  "pnpm verify:windows-installer:dry-run",
  "pnpm verify:packaged-update-rollback",
  "pnpm verify:packaged-update-rollback:dry-run",
  "pnpm verify:signed-package-preflight",
  "pnpm verify:signed-package-release",
  "pnpm verify:signed-package-release:dry-run",
  "pnpm verify:release-readiness",
  "pnpm verify"
]);
const REQUIRED_READY_COMMANDS = new Set([
  "pnpm verify:signed-package-preflight -- --require-credentials",
  "pnpm verify:signed-package-release -- --require-release-evidence",
  "pnpm verify:windows-real-device -- --require-device-evidence",
  "pnpm verify:packaged-update-rollback -- --require-device-evidence",
  "pnpm verify:release-readiness -- --require-ready"
]);
const ALLOWED_PUBLIC_POSTURES = new Set(["technical-preview", "limited-beta", "general-release"]);
const ALLOWED_READINESS_STATUSES = new Set(["blocked", "ready"]);
const ALLOWED_GATE_STATUSES = new Set(["blocked", "passed"]);
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
    commands.readyRelease,
    "$.requiredVerificationCommands.readyRelease",
    REQUIRED_READY_COMMANDS,
    issues
  );
}

function validateReleaseGate(gate, path, issues) {
  if (!isRecord(gate)) {
    addIssue(issues, path, "must be an object");
    return null;
  }

  if (typeof gate.id !== "string" || gate.id.trim().length === 0) {
    addIssue(issues, `${path}.id`, "must be a non-empty release gate id");
  }
  if (!ALLOWED_GATE_STATUSES.has(gate.status)) {
    addIssue(issues, `${path}.status`, "must be blocked or passed");
  }
  if (gate.requiredFor !== "general-release") {
    addIssue(issues, `${path}.requiredFor`, "must be general-release");
  }

  validateStringList(gate.evidenceRefs, `${path}.evidenceRefs`, issues);
  validateStringList(gate.requiredEvidence, `${path}.requiredEvidence`, issues);
  validateStringList(gate.unblockCriteria, `${path}.unblockCriteria`, issues);

  if (gate.status === "blocked") {
    if (typeof gate.blocker !== "string" || gate.blocker.trim().length === 0) {
      addIssue(issues, `${path}.blocker`, "must describe why this gate is blocked");
    }
    if (typeof gate.blockerIssue !== "string" || gate.blockerIssue.trim().length === 0) {
      addIssue(issues, `${path}.blockerIssue`, "must link a GitHub issue while this gate is blocked");
    }
  }

  if (gate.blockerIssue !== undefined) {
    validateHttpsUrlIfPresent(gate.blockerIssue, `${path}.blockerIssue`, issues);
    const requiredBlocker = REQUIRED_BLOCKER_ISSUES_BY_GATE.get(gate.id);
    if (requiredBlocker && gate.blockerIssue !== requiredBlocker.url) {
      addIssue(issues, `${path}.blockerIssue`, `must link ${requiredBlocker.label}`);
    }
  }

  if (gate.status === "passed") {
    validateStringList(gate.verifiedBy, `${path}.verifiedBy`, issues);
    if (typeof gate.verifiedAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(gate.verifiedAt)) {
      addIssue(issues, `${path}.verifiedAt`, "must be an ISO timestamp in UTC when the gate passed");
    }
  }

  return typeof gate.id === "string" ? { id: gate.id, status: gate.status } : null;
}

function validateReleaseGates(gates, issues) {
  if (!Array.isArray(gates) || gates.length === 0) {
    addIssue(issues, "$.releaseGates", "must list signed package, updater rollback, and Windows real-device gates");
    return [];
  }

  const seen = new Set();
  const summaries = [];
  for (const [index, gate] of gates.entries()) {
    const summary = validateReleaseGate(gate, `$.releaseGates[${index}]`, issues);
    if (!summary) {
      continue;
    }
    if (seen.has(summary.id)) {
      addIssue(issues, `$.releaseGates[${index}].id`, "must be unique");
    }
    seen.add(summary.id);
    summaries.push(summary);
  }

  for (const requiredGate of REQUIRED_RELEASE_GATES) {
    if (!seen.has(requiredGate)) {
      addIssue(issues, "$.releaseGates", `must include ${requiredGate}`);
    }
  }

  return summaries;
}

function consistencyIssues(contract, gateSummaries) {
  const issues = [];
  const blockedGates = gateSummaries.filter((gate) => gate.status === "blocked");
  const passedGates = gateSummaries.filter((gate) => gate.status === "passed");

  if (contract.broadReleaseStatus === "blocked" && blockedGates.length === 0) {
    addIssue(issues, "$.broadReleaseStatus", "blocked status must name at least one blocked release gate");
  }

  if (contract.broadReleaseStatus === "ready") {
    if (contract.publicPosture !== "general-release") {
      addIssue(issues, "$.publicPosture", "ready broad release must use general-release posture");
    }
    if (blockedGates.length > 0) {
      addIssue(issues, "$.releaseGates", "ready broad release cannot include blocked gates");
    }
    for (const requiredGate of REQUIRED_RELEASE_GATES) {
      if (!passedGates.some((gate) => gate.id === requiredGate)) {
        addIssue(issues, "$.releaseGates", `ready broad release must pass ${requiredGate}`);
      }
    }
  }

  return issues;
}

export function validateReleaseReadinessContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: release readiness contract must be a JSON object"], gateSummaries: [] };
  }

  if (contract.schemaVersion !== RELEASE_READINESS_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${RELEASE_READINESS_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_PUBLIC_POSTURES.has(contract.publicPosture)) {
    addIssue(issues, "$.publicPosture", "must be technical-preview, limited-beta, or general-release");
  }
  if (!ALLOWED_READINESS_STATUSES.has(contract.broadReleaseStatus)) {
    addIssue(issues, "$.broadReleaseStatus", "must be blocked or ready");
  }
  if (typeof contract.summary !== "string" || contract.summary.trim().length === 0) {
    addIssue(issues, "$.summary", "must describe the current release posture");
  }

  validateRequiredVerificationCommands(contract.requiredVerificationCommands, issues);
  const gateSummaries = validateReleaseGates(contract.releaseGates, issues);
  issues.push(...consistencyIssues(contract, gateSummaries));
  validateNoSecretStrings(contract, issues);

  return { ok: issues.length === 0, issues, gateSummaries };
}

export function evaluateReleaseReadiness(contract, options = {}) {
  const validation = validateReleaseReadinessContract(contract);
  const blockers = [];

  if (!validation.ok) {
    blockers.push(...validation.issues);
  }

  const blockedGates = validation.gateSummaries.filter((gate) => gate.status === "blocked").map((gate) => gate.id);
  if (options.requireReady) {
    if (contract?.broadReleaseStatus !== "ready") {
      blockers.push("broad release is not ready");
    }
    for (const gateId of blockedGates) {
      blockers.push(`${gateId} gate is still blocked`);
    }
  }

  return {
    ok: blockers.length === 0,
    readinessStatus: contract?.broadReleaseStatus ?? "invalid",
    broadReleaseReady: validation.ok && contract?.broadReleaseStatus === "ready" && blockedGates.length === 0,
    blockedGates,
    blockers,
    validationIssues: validation.issues
  };
}

export function parseReleaseReadinessArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_RELEASE_READINESS_PATH;
  let requireReady = false;

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
    if (arg === "--require-ready") {
      requireReady = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { contractPath, requireReady };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function evidenceForEvaluation(evaluation, options) {
  return {
    status: evaluation.ok ? "passed" : "blocked",
    schemaVersion: RELEASE_READINESS_SCHEMA_VERSION,
    mode: options.requireReady ? "require-ready" : "contract",
    readinessStatus: evaluation.readinessStatus,
    broadReleaseReady: evaluation.broadReleaseReady,
    blockedGates: evaluation.blockedGates,
    blockers: evaluation.blockers,
    checked: [
      "release readiness contract schema",
      "required signed package, updater rollback, and Windows real-device gates",
      "credential-free and ready-release verification command lists",
      "secret-free release readiness evidence strings",
      options.requireReady ? "all broad-release gates must be passed" : "blocked broad-release posture is allowed only with explicit blockers"
    ]
  };
}

function exitCodeForEvidence(evidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const options = parseReleaseReadinessArgs();
  const contract = readJson(resolve(options.contractPath));
  const evidence = evidenceForEvaluation(evaluateReleaseReadiness(contract, options), options);

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
