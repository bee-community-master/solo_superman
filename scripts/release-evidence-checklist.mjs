#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";

export const RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION = "solo-superman-release-evidence-checklist.v1";
export const RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION = "solo-superman-release-evidence-template.v1";

export const DEFAULT_RELEASE_EVIDENCE_CONTRACT_PATHS = {
  releaseReadiness: "docs/release-readiness.example.json",
  windowsRealDevice: "docs/windows-real-device.example.json",
  signedPackagePreflight: "docs/signed-package-preflight.example.json",
  signedPackageRelease: "docs/signed-package-release.example.json",
  packagedUpdateRollback: "docs/packaged-update-rollback.example.json"
};

const TOKEN_LIKE_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9_-]{20,}|bearer\s+[A-Za-z0-9._~+/-]{20,})\b/iu;
const SECRET_QUERY_KEY_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const OUTPUT_FORMATS = new Set(["json", "markdown", "template"]);

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

function checklistSummary(checklistItems) {
  const blockedItems = checklistItems.filter((item) => item.status === "blocked");

  return {
    totalItems: checklistItems.length,
    blockedItems: blockedItems.length,
    readyItems: checklistItems.filter((item) => item.status === "passed").length,
    blockerIssueNumbers: uniqueStrings(blockedItems
      .map((item) => item.blockerIssueNumber)
      .filter((item) => item !== null && item !== undefined)
      .map(String))
  };
}

export function filterReleaseEvidenceChecklistByIssue(checklist, issueNumber) {
  if (issueNumber === undefined) {
    return checklist;
  }

  const checklistItems = checklist.checklistItems.filter((item) => item.blockerIssueNumber === issueNumber);
  const blockedItems = checklistItems.filter((item) => item.status === "blocked");
  const issues = checklistItems.length === 0
    ? [...checklist.issues, `No release evidence checklist items matched issue #${issueNumber}.`]
    : checklist.issues;

  return {
    ...checklist,
    status: blockedItems.length > 0 || issues.length > 0 ? "blocked" : "ready",
    openBlockerIssues: uniqueStrings(blockedItems.map((item) => item.blockerIssue)),
    checklistItems,
    issues,
    summary: {
      ...checklistSummary(checklistItems),
      filterIssueNumber: String(issueNumber)
    }
  };
}

function checkboxList(items, formatter = (item) => item) {
  return items.length ? items.map((item) => `- [ ] ${formatter(item)}`) : ["- _None specified._"];
}

function bulletList(items, formatter = (item) => item) {
  return items.length ? items.map((item) => `- ${formatter(item)}`) : ["- _None specified._"];
}

function markdownValue(value) {
  return value === undefined || value === null || value === "" ? "_not specified_" : String(value);
}

function renderChecklistItemMarkdown(item) {
  const lines = [
    `### ${item.itemId}`,
    "",
    `- Source contract: \`${item.sourceContract}\``,
    `- Gate: \`${item.gateId}\``,
    `- Status: \`${item.status}\``,
    `- Scope: ${markdownValue(item.scope)}`,
    `- Required for: ${markdownValue(item.requiredFor)}`,
    `- Blocker issue: ${item.blockerIssue ? `[${item.blockerIssueNumber ?? item.blockerIssue}](${item.blockerIssue})` : "_not specified_"}`,
    "",
    "**Blocker**",
    "",
    item.blocker ? `> ${item.blocker}` : "_No blocker text supplied._",
    "",
    "**Required checks**",
    "",
    ...checkboxList(item.requiredChecks, (check) => `\`${check}\``),
    "",
    "**Required evidence**",
    "",
    ...checkboxList(item.requiredEvidence),
    "",
    "**Unblock criteria**",
    "",
    ...checkboxList(item.unblockCriteria),
    "",
    "**Evidence references**",
    "",
    ...bulletList(item.evidenceRefs)
  ];

  return lines.join("\n");
}

function templateEvidenceFields(items, fieldName) {
  return items.map((item, index) => ({
    id: `${fieldName}-${String(index + 1).padStart(2, "0")}`,
    requirement: item,
    status: "pending",
    evidenceRefs: ["<redacted evidence ref>"],
    notes: "<redacted notes or lab log summary>"
  }));
}

function templateCheckResults(items) {
  return items.map((item) => ({
    id: item,
    status: "pending",
    evidenceRefs: ["<redacted evidence ref>"],
    notes: "<redacted command output summary>"
  }));
}

function templateItem(item) {
  return {
    sourceContract: item.sourceContract,
    gateId: item.gateId,
    itemId: item.itemId,
    blockerIssue: item.blockerIssue,
    expectedFinalStatus: "passed",
    currentStatus: item.status,
    scope: item.scope,
    requiredFor: item.requiredFor,
    blocker: item.blocker,
    requiredChecks: templateCheckResults(item.requiredChecks),
    requiredEvidence: templateEvidenceFields(item.requiredEvidence, "evidence"),
    unblockCriteria: templateEvidenceFields(item.unblockCriteria, "unblock"),
    existingEvidenceRefs: item.evidenceRefs,
    verification: {
      verifiedAt: "<UTC ISO timestamp>",
      verifiedBy: ["<release lab operator or CI run id>"],
      redactionConfirmed: false,
      readyReleaseCommandsRun: []
    }
  };
}

export function buildReleaseEvidenceTemplate(checklist) {
  const template = {
    schemaVersion: RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION,
    generatedAt: checklist.generatedAt,
    sourceChecklistSchemaVersion: checklist.schemaVersion,
    templateStatus: "pending",
    filterIssueNumber: checklist.summary.filterIssueNumber,
    openBlockerIssues: checklist.openBlockerIssues,
    privacy: {
      credentialFree: true,
      secretPolicy: "Fill placeholders only with redacted evidence refs, public metadata, checksums, sizes, signatures, and sanitized log summaries.",
      prohibited: ["credential values", "tokens", "cookies", "URL userinfo", "secret-like query parameters", "full environment dumps"]
    },
    readyReleaseCommands: checklist.readyReleaseCommands,
    credentialFreeCommands: checklist.credentialFreeCommands,
    items: checklist.checklistItems.map(templateItem),
    summary: {
      totalItems: checklist.checklistItems.length,
      pendingItems: checklist.checklistItems.length,
      filterIssueNumber: checklist.summary.filterIssueNumber
    }
  };
  const issues = uniqueStrings([...checklist.issues, ...validateSecretFreeStrings(template)]);

  return {
    ...template,
    issues
  };
}

export function renderReleaseEvidenceChecklistMarkdown(checklist) {
  const lines = [
    "# Solo Superman release evidence checklist",
    "",
    `- Schema version: \`${checklist.schemaVersion}\``,
    `- Generated at: \`${checklist.generatedAt}\``,
    `- Checklist status: \`${checklist.status}\``,
    `- Total items: ${checklist.summary.totalItems}`,
    `- Blocked items: ${checklist.summary.blockedItems}`,
    `- Filtered issue: ${checklist.summary.filterIssueNumber ? `#${checklist.summary.filterIssueNumber}` : "_none_"}`,
    "",
    "## Open blocker issues",
    "",
    ...bulletList(checklist.openBlockerIssues),
    "",
    "## Checklist issues",
    "",
    ...bulletList(checklist.issues),
    "",
    "## Ready-release verification commands",
    "",
    ...checkboxList(checklist.readyReleaseCommands, (command) => `\`${command}\``),
    "",
    "## Evidence items",
    ""
  ];

  if (checklist.checklistItems.length === 0) {
    lines.push("_No evidence items matched this filter._");
    lines.push("");
  } else {
    lines.push(...checklist.checklistItems.map(renderChecklistItemMarkdown).flatMap((section) => [section, ""]));
  }

  lines.push(
    "## Privacy boundary",
    "",
    "- [ ] Evidence refs are redacted before they are attached to GitHub issues or release PRs.",
    "- [ ] No token, cookie, credential value, URL userinfo, secret-like query parameter, file contents, or full environment dump is included."
  );

  return `${lines.join("\n").trimEnd()}\n`;
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
  let format = env.SOLO_RELEASE_EVIDENCE_CHECKLIST_FORMAT ?? "json";
  let issueNumber;

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
    } else if (arg === "--format") {
      if (!argv[index + 1]) {
        throw new Error(`${arg} requires a value.`);
      }
      format = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length);
    } else if (arg === "--issue") {
      if (!argv[index + 1]) {
        throw new Error(`${arg} requires an issue number.`);
      }
      issueNumber = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--issue=")) {
      issueNumber = Number(arg.slice("--issue=".length));
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown release evidence checklist argument: ${arg}`);
    }
  }

  if (!OUTPUT_FORMATS.has(format)) {
    throw new Error(`--format must be one of: ${[...OUTPUT_FORMATS].join(", ")}`);
  }

  if (issueNumber !== undefined && (!Number.isInteger(issueNumber) || issueNumber <= 0)) {
    throw new Error("--issue requires a positive integer issue number.");
  }

  return {
    outputPath: outputPath ? resolve(outputPath) : undefined,
    format,
    issueNumber
  };
}

async function writeChecklist(outputPath, content) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

export async function runReleaseEvidenceChecklistCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseReleaseEvidenceChecklistArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm release:evidence-checklist [--format json|markdown|template] [--issue <number>] [--output <path>]");
    return { status: "help" };
  }

  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const fullChecklist = buildReleaseEvidenceChecklist(contracts, options);
  const checklist = filterReleaseEvidenceChecklistByIssue(fullChecklist, parsed.issueNumber);
  const payload = parsed.format === "template" ? buildReleaseEvidenceTemplate(checklist) : checklist;
  const content = parsed.format === "markdown"
    ? renderReleaseEvidenceChecklistMarkdown(checklist)
    : `${JSON.stringify(payload, null, 2)}\n`;

  if (parsed.outputPath) {
    await writeChecklist(parsed.outputPath, content);
    console.log(JSON.stringify({
      status: payload.issues.length === 0 ? "passed" : "blocked",
      checklistPath: parsed.outputPath,
      format: parsed.format,
      issueNumber: parsed.issueNumber,
      schemaVersion: payload.schemaVersion,
      checklistStatus: checklist.status,
      templateStatus: payload.templateStatus,
      blockedItems: checklist.summary.blockedItems,
      openBlockerIssues: checklist.openBlockerIssues,
      issues: payload.issues
    }, null, 2));
  } else {
    process.stdout.write(content);
  }

  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReleaseEvidenceChecklistCli().then((payload) => {
    if (Array.isArray(payload.issues) && payload.issues.length > 0) {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(`release-evidence-checklist failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
