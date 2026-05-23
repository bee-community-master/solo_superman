#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

export const SIGNED_PACKAGE_PREFLIGHT_SCHEMA_VERSION = "solo-superman-signed-package-preflight.v1";
export const DEFAULT_SIGNED_PACKAGE_PREFLIGHT_PATH = "docs/signed-package-preflight.example.json";

const REQUIRED_PLATFORMS = new Set(["macos", "windows"]);
const ALLOWED_PACKAGE_KINDS = new Set(["macos-dmg", "macos-pkg", "windows-msi", "windows-exe"]);
const ALLOWED_SIGNING_KINDS = new Set([
  "apple-developer-id-application",
  "apple-developer-id-installer",
  "apple-notarytool",
  "windows-authenticode"
]);
const REQUIRED_DRY_RUN_COMMANDS = new Set([
  "pnpm build",
  "pnpm verify:prod-bundle",
  "pnpm verify:release-channel",
  "pnpm verify:signed-package-preflight"
]);
const REQUIRED_HARD_GATES = new Set([
  "macos-developer-id-signing",
  "macos-notarization-stapling",
  "windows-authenticode-signing",
  "release-manifest-signing",
  "device-install-update-rollback-verification"
]);
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const PROVIDER_TOKEN_PATTERN =
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/u;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]{10,}/u;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]+$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function validateNoSecretStrings(contract, issues) {
  for (const { path, value } of collectStrings(contract)) {
    if (PROVIDER_TOKEN_PATTERN.test(value) || BEARER_TOKEN_PATTERN.test(value)) {
      addIssue(issues, path, "must not contain token-shaped values");
    }
  }
}

function validatePackageCandidates(candidates, issues) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    addIssue(issues, "$.packageCandidates", "must list macOS and Windows package candidates");
    return;
  }

  const platforms = new Set();
  for (const [index, candidate] of candidates.entries()) {
    const path = `$.packageCandidates[${index}]`;
    if (!isRecord(candidate)) {
      addIssue(issues, path, "must be an object");
      continue;
    }

    if (!REQUIRED_PLATFORMS.has(candidate.platform)) {
      addIssue(issues, `${path}.platform`, "must be macos or windows");
    } else {
      platforms.add(candidate.platform);
    }

    if (!Array.isArray(candidate.packageKinds) || candidate.packageKinds.length === 0) {
      addIssue(issues, `${path}.packageKinds`, "must list at least one package kind");
    } else {
      for (const [kindIndex, kind] of candidate.packageKinds.entries()) {
        if (!ALLOWED_PACKAGE_KINDS.has(kind)) {
          addIssue(issues, `${path}.packageKinds[${kindIndex}]`, "must use an approved package kind");
        }
      }
    }

    if (!Array.isArray(candidate.signingKinds) || candidate.signingKinds.length === 0) {
      addIssue(issues, `${path}.signingKinds`, "must list signing/notarization requirements");
    } else {
      for (const [kindIndex, kind] of candidate.signingKinds.entries()) {
        if (!ALLOWED_SIGNING_KINDS.has(kind)) {
          addIssue(issues, `${path}.signingKinds[${kindIndex}]`, "must use an approved signing kind");
        }
      }
    }
  }

  for (const platform of REQUIRED_PLATFORMS) {
    if (!platforms.has(platform)) {
      addIssue(issues, "$.packageCandidates", `must include a ${platform} candidate`);
    }
  }
}

function validateCredentialGroups(groups, issues) {
  if (!Array.isArray(groups) || groups.length === 0) {
    addIssue(issues, "$.credentialGroups", "must list signing credential groups");
    return;
  }

  const seenIds = new Set();
  for (const [index, group] of groups.entries()) {
    const path = `$.credentialGroups[${index}]`;
    if (!isRecord(group)) {
      addIssue(issues, path, "must be an object");
      continue;
    }

    if (typeof group.id !== "string" || group.id.trim().length === 0) {
      addIssue(issues, `${path}.id`, "must be a non-empty credential group id");
    } else if (seenIds.has(group.id)) {
      addIssue(issues, `${path}.id`, "must be unique");
    } else {
      seenIds.add(group.id);
    }

    if (typeof group.purpose !== "string" || group.purpose.trim().length === 0) {
      addIssue(issues, `${path}.purpose`, "must describe why this credential is needed");
    }
    if (!Array.isArray(group.requiredEnv) || group.requiredEnv.length === 0) {
      addIssue(issues, `${path}.requiredEnv`, "must list required environment variable names");
      continue;
    }

    for (const [envIndex, envName] of group.requiredEnv.entries()) {
      if (typeof envName !== "string" || !ENV_NAME_PATTERN.test(envName)) {
        addIssue(issues, `${path}.requiredEnv[${envIndex}]`, "must be an uppercase environment variable name");
      }
    }
  }
}

function validateCommandList(value, path, requiredCommands, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, path, "must be a non-empty command list");
    return;
  }

  const commands = new Set();
  for (const [index, command] of value.entries()) {
    if (typeof command !== "string" || command.trim().length === 0) {
      addIssue(issues, `${path}[${index}]`, "must be a non-empty command string");
      continue;
    }
    commands.add(command);
  }

  for (const required of requiredCommands) {
    if (!commands.has(required)) {
      addIssue(issues, path, `must include ${required}`);
    }
  }
}

function validCredentialGroupIds(groups) {
  if (!Array.isArray(groups)) {
    return new Set();
  }

  return new Set(groups.filter((group) => isRecord(group) && typeof group.id === "string").map((group) => group.id));
}

function validateHardGates(gates, issues, credentialGroupIds = new Set()) {
  if (!Array.isArray(gates) || gates.length === 0) {
    addIssue(issues, "$.hardGates", "must list actual signing/release gates");
    return;
  }

  const gateIds = new Set();
  for (const [index, gate] of gates.entries()) {
    const path = `$.hardGates[${index}]`;
    if (!isRecord(gate)) {
      addIssue(issues, path, "must be an object");
      continue;
    }
    if (typeof gate.id !== "string" || gate.id.trim().length === 0) {
      addIssue(issues, `${path}.id`, "must be a non-empty hard gate id");
    } else {
      gateIds.add(gate.id);
    }
    if (typeof gate.requiresCredentialGroup !== "string" || gate.requiresCredentialGroup.trim().length === 0) {
      addIssue(issues, `${path}.requiresCredentialGroup`, "must name the credential group or explicit external evidence");
    } else if (!credentialGroupIds.has(gate.requiresCredentialGroup) && gate.requiresCredentialGroup !== "external-device-evidence") {
      addIssue(issues, `${path}.requiresCredentialGroup`, "must reference a declared credential group or external-device-evidence");
    }
    if (typeof gate.evidence !== "string" || gate.evidence.trim().length === 0) {
      addIssue(issues, `${path}.evidence`, "must describe required release evidence");
    }
  }

  for (const required of REQUIRED_HARD_GATES) {
    if (!gateIds.has(required)) {
      addIssue(issues, "$.hardGates", `must include ${required}`);
    }
  }
}

export function validateSignedPackagePreflightContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: preflight contract must be a JSON object"] };
  }

  if (contract.schemaVersion !== SIGNED_PACKAGE_PREFLIGHT_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${SIGNED_PACKAGE_PREFLIGHT_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  validateHttpsUrl(contract.releaseRepositoryUrl, "$.releaseRepositoryUrl", issues);
  if (contract.releaseChannelContract !== "docs/release-channel_KO.md") {
    addIssue(issues, "$.releaseChannelContract", "must point to docs/release-channel_KO.md");
  }
  if (contract.releaseChannelManifest !== "docs/release-update-channel.example.json") {
    addIssue(issues, "$.releaseChannelManifest", "must point to docs/release-update-channel.example.json");
  }
  validatePackageCandidates(contract.packageCandidates, issues);
  validateCredentialGroups(contract.credentialGroups, issues);
  validateCommandList(contract.localDryRunCommands, "$.localDryRunCommands", REQUIRED_DRY_RUN_COMMANDS, issues);
  validateHardGates(contract.hardGates, issues, validCredentialGroupIds(contract.credentialGroups));
  if (typeof contract.credentialBoundary !== "string" || contract.credentialBoundary.trim().length === 0) {
    addIssue(issues, "$.credentialBoundary", "must describe how signing credentials stay out of docs and logs");
  }
  validateNoSecretStrings(contract, issues);

  return { ok: issues.length === 0, issues };
}

export function evaluateCredentialGroups(contract, env = process.env) {
  if (!Array.isArray(contract?.credentialGroups)) {
    return [];
  }

  return contract.credentialGroups.map((group) => {
    const requiredEnv = Array.isArray(group.requiredEnv) ? group.requiredEnv : [];
    const missingEnv = requiredEnv.filter((name) => typeof name !== "string" || !env[name]);
    return {
      id: group.id,
      purpose: group.purpose,
      status: missingEnv.length === 0 ? "ready" : "missing",
      requiredEnv,
      missingEnv
    };
  });
}

export function readSignedPackagePreflightContract(contractPath) {
  return JSON.parse(readFileSync(resolve(contractPath), "utf8"));
}

export function verifySignedPackagePreflight(options = {}) {
  const {
    contractPath = DEFAULT_SIGNED_PACKAGE_PREFLIGHT_PATH,
    env = process.env,
    requireCredentials = false
  } = options;
  const contract = readSignedPackagePreflightContract(contractPath);
  const validation = validateSignedPackagePreflightContract(contract);
  const credentialGroups = evaluateCredentialGroups(contract, env);
  const missingCredentialGroups = credentialGroups.filter((group) => group.status !== "ready");
  const credentialGateStatus = missingCredentialGroups.length === 0 ? "ready" : "blocked";
  const ok = validation.ok && (!requireCredentials || credentialGateStatus === "ready");
  const credentialIssues = requireCredentials
    ? missingCredentialGroups.map((group) => `${group.id}: missing required env ${group.missingEnv.join(", ")}`)
    : [];

  return {
    status: ok ? "passed" : "failed",
    contractPath,
    requireCredentials,
    credentialGateStatus,
    issues: validation.ok ? credentialIssues : validation.issues,
    missingCredentialGroups,
    checked: validation.ok
      ? [
          "signed package preflight schema is recognized",
          "macOS and Windows package candidates are documented",
          "signing credential groups are named without exposing values",
          "credential-free dry-run commands are separated from actual signing gates",
          "release-channel manifest verification is linked before packaged updates"
        ]
      : []
  };
}

export function parseSignedPackagePreflightArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_SIGNED_PACKAGE_PREFLIGHT_PATH;
  let requireCredentials = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--manifest" || arg === "--contract") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error(`${arg} requires a path value`);
      }
      contractPath = next;
      index += 1;
      continue;
    }
    if (arg === "--require-credentials") {
      requireCredentials = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { contractPath, requireCredentials };
}

async function main() {
  try {
    const options = parseSignedPackagePreflightArgs();
    const evidence = verifySignedPackagePreflight(options);
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
