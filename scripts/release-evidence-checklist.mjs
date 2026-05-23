#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";

export const RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION = "solo-superman-release-evidence-checklist.v1";

export const DEFAULT_RELEASE_EVIDENCE_CONTRACT_PATHS = {
  releaseReadiness: "docs/release-readiness.example.json",
  windowsRealDevice: "docs/windows-real-device.example.json",
  signedPackagePreflight: "docs/signed-package-preflight.example.json",
  signedPackageRelease: "docs/signed-package-release.example.json",
  packagedUpdateRollback: "docs/packaged-update-rollback.example.json"
};

const TOKEN_LIKE_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9_-]{20,}|bearer\s+[A-Za-z0-9._~+/-]{20,})\b/iu;
const SECRET_QUERY_KEY_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function urlIssueForRef(ref, path) {
  if (!/^https?:\/\//iu.test(ref)) {
    return null;
  }

  let url;
  try {
    url = new URL(ref);
  } catch {
    return `${path} must be a valid URL evidence ref`;
  }

  if (url.protocol !== "https:") {
    return `${path} must use https for URL evidence refs`;
  }

  if (url.username || url.password) {
    return `${path} must not include URL userinfo credentials`;
  }

  for (const key of url.searchParams.keys()) {
    if (SECRET_QUERY_KEY_PATTERN.test(key)) {
      return `${path} must not include secret-like query parameter ${JSON.stringify(key)}`;
    }
  }

  return null;
}

function validateSecretFreeStrings(value, path = "$", issues = []) {
  if (typeof value === "string") {
    if (TOKEN_LIKE_PATTERN.test(value)) {
      issues.push(`${path} must not contain token-shaped secret values`);
    }
    const urlIssue = urlIssueForRef(value, path);
    if (urlIssue) {
      issues.push(urlIssue);
    }
    return issues;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSecretFreeStrings(item, `${path}[${index}]`, issues));
    return issues;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => validateSecretFreeStrings(item, `${path}.${key}`, issues));
  }

  return issues;
}

function collectCommands(...commandGroups) {
  return uniqueStrings(commandGroups.flatMap((group) => {
    if (Array.isArray(group)) {
      return stringList(group);
    }
    if (isRecord(group)) {
      return Object.values(group).flatMap(stringList);
    }
    return [];
  }));
}

function blockerIssueNumber(blockerIssue) {
  const match = typeof blockerIssue === "string" ? blockerIssue.match(/\/issues\/(\d+)\b/u) : null;
  return match ? Number(match[1]) : null;
}

function checklistItem({ sourceContract, gateId, run }) {
  const blockerIssue = typeof run.blockerIssue === "string" ? run.blockerIssue : undefined;

  return {
    sourceContract,
    gateId,
    itemId: typeof run.id === "string" ? run.id : gateId,
    status: typeof run.status === "string" ? run.status : "unknown",
    scope: typeof run.scope === "string" ? run.scope : typeof run.platform === "string" ? run.platform : undefined,
    requiredFor: typeof run.requiredFor === "string" ? run.requiredFor : undefined,
    blocker: typeof run.blocker === "string" ? run.blocker : undefined,
    blockerIssue,
    blockerIssueNumber: blockerIssueNumber(blockerIssue),
    evidenceRefs: stringList(run.evidenceRefs),
    requiredChecks: stringList(run.requiredChecks),
    requiredEvidence: stringList(run.requiredEvidence),
    unblockCriteria: stringList(run.unblockCriteria)
  };
}

function collectGateItems(contract, sourceContract, gateId, collectionName) {
  const runs = Array.isArray(contract?.[collectionName]) ? contract[collectionName] : [];
  return runs.filter(isRecord).map((run) => checklistItem({ sourceContract, gateId, run }));
}

function collectReleaseReadinessGateItems(contract, sourceContract) {
  return collectGateItems(contract, sourceContract, "release-readiness", "releaseGates");
}

function collectCredentialGroups(preflightContract) {
  return Array.isArray(preflightContract?.credentialGroups)
    ? preflightContract.credentialGroups.filter(isRecord).map((group) => ({
      id: typeof group.id === "string" ? group.id : "unknown-credential-group",
      purpose: typeof group.purpose === "string" ? group.purpose : undefined,
      requiredEnv: stringList(group.requiredEnv)
    }))
    : [];
}

function collectHardGates(preflightContract) {
  return Array.isArray(preflightContract?.hardGates)
    ? preflightContract.hardGates.filter(isRecord).map((gate) => ({
      id: typeof gate.id === "string" ? gate.id : "unknown-hard-gate",
      requiresCredentialGroup: typeof gate.requiresCredentialGroup === "string" ? gate.requiresCredentialGroup : undefined,
      evidence: typeof gate.evidence === "string" ? gate.evidence : undefined
    }))
    : [];
}

function collectSourceContracts(contracts) {
  return Object.entries(contracts).map(([id, contract]) => {
    const record = isRecord(contract) ? contract : {};

    return {
      id,
      schemaVersion: typeof record.schemaVersion === "string" ? record.schemaVersion : "unknown",
      appId: typeof record.appId === "string" ? record.appId : "unknown",
      status: record.broadReleaseStatus
        ?? record.windowsVerificationStatus
        ?? record.releaseEvidenceStatus
        ?? record.rollbackStatus
        ?? "informational",
      blockerIssue: typeof record.blockerIssue === "string" ? record.blockerIssue : undefined
    };
  });
}

export function buildReleaseEvidenceChecklist(contracts, options = {}) {
  const sourceContracts = collectSourceContracts(contracts);
  const releaseGateItems = collectReleaseReadinessGateItems(contracts.releaseReadiness, "releaseReadiness");
  const checklistItems = [
    ...releaseGateItems,
    ...collectGateItems(contracts.windowsRealDevice, "windowsRealDevice", "windows-real-device", "deviceRuns"),
    ...collectGateItems(contracts.signedPackageRelease, "signedPackageRelease", "signed-packages", "evidenceRuns"),
    ...collectGateItems(contracts.packagedUpdateRollback, "packagedUpdateRollback", "packaged-update-rollback", "deviceRuns")
  ];
  const blockedItems = checklistItems.filter((item) => item.status === "blocked");
  const readyReleaseCommands = collectCommands(
    contracts.releaseReadiness?.requiredVerificationCommands?.readyRelease,
    contracts.windowsRealDevice?.requiredVerificationCommands?.deviceEvidence,
    contracts.signedPackageRelease?.requiredVerificationCommands?.releaseEvidence,
    contracts.packagedUpdateRollback?.requiredVerificationCommands?.deviceEvidence
  );
  const credentialFreeCommands = collectCommands(
    contracts.releaseReadiness?.requiredVerificationCommands?.credentialFree,
    contracts.windowsRealDevice?.requiredVerificationCommands?.credentialFree,
    contracts.signedPackageRelease?.requiredVerificationCommands?.credentialFree,
    contracts.packagedUpdateRollback?.requiredVerificationCommands?.credentialFree,
    contracts.signedPackagePreflight?.localDryRunCommands
  );
  const openBlockerIssues = uniqueStrings(blockedItems.map((item) => item.blockerIssue));
  const checklist = {
    schemaVersion: RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION,
    generatedAt: options.now?.toISOString?.() ?? new Date().toISOString(),
    status: blockedItems.length > 0 ? "blocked" : "ready",
    privacy: {
      credentialFree: true,
      secretPolicy: "Checklist generation reads only public contract files and must never capture credential values or full environment dumps.",
      evidenceRefsMustBeRedacted: true
    },
    sourceContracts,
    openBlockerIssues,
    credentialFreeCommands,
    readyReleaseCommands,
    credentialGroups: collectCredentialGroups(contracts.signedPackagePreflight),
    hardGates: collectHardGates(contracts.signedPackagePreflight),
    checklistItems,
    summary: {
      totalItems: checklistItems.length,
      blockedItems: blockedItems.length,
      readyItems: checklistItems.filter((item) => item.status === "passed").length,
      blockerIssueNumbers: uniqueStrings(blockedItems.map((item) => item.blockerIssueNumber).filter((item) => item !== null && item !== undefined).map(String))
    }
  };
  const issues = validateSecretFreeStrings(checklist);

  return {
    ...checklist,
    issues
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadReleaseEvidenceContracts(paths = DEFAULT_RELEASE_EVIDENCE_CONTRACT_PATHS, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const entries = await Promise.all(Object.entries(paths).map(async ([id, path]) => [id, await readJson(resolve(cwd, path))]));

  return Object.fromEntries(entries);
}

export function parseReleaseEvidenceChecklistArgs(argv = process.argv.slice(2), env = process.env) {
  let outputPath = env.SOLO_RELEASE_EVIDENCE_CHECKLIST_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--output" || arg === "-o") {
      if (!argv[index + 1]) {
        throw new Error(`${arg} requires a path value.`);
      }
      outputPath = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown release evidence checklist argument: ${arg}`);
    }
  }

  return { outputPath: outputPath ? resolve(outputPath) : undefined };
}

async function writeChecklist(outputPath, checklist) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
}

export async function runReleaseEvidenceChecklistCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseReleaseEvidenceChecklistArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm release:evidence-checklist [--output <path>]");
    return { status: "help" };
  }

  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const checklist = buildReleaseEvidenceChecklist(contracts, options);

  if (parsed.outputPath) {
    await writeChecklist(parsed.outputPath, checklist);
    console.log(JSON.stringify({
      status: checklist.issues.length === 0 ? "passed" : "blocked",
      checklistPath: parsed.outputPath,
      schemaVersion: checklist.schemaVersion,
      checklistStatus: checklist.status,
      blockedItems: checklist.summary.blockedItems,
      openBlockerIssues: checklist.openBlockerIssues,
      issues: checklist.issues
    }, null, 2));
  } else {
    console.log(JSON.stringify(checklist, null, 2));
  }

  return checklist;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReleaseEvidenceChecklistCli().then((checklist) => {
    if (Array.isArray(checklist.issues) && checklist.issues.length > 0) {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(`release-evidence-checklist failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
