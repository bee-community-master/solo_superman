#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { URL, pathToFileURL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION = "solo-superman-release-evidence-checklist.v1";
export const RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION = "solo-superman-release-evidence-template.v1";
export const RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION = "solo-superman-release-evidence-template-validation.v1";
export const RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION = "solo-superman-release-evidence-bundle.v1";

export const DEFAULT_RELEASE_EVIDENCE_CONTRACT_PATHS = {
  releaseReadiness: "docs/release-readiness.example.json",
  windowsRealDevice: "docs/windows-real-device.example.json",
  signedPackagePreflight: "docs/signed-package-preflight.example.json",
  signedPackageRelease: "docs/signed-package-release.example.json",
  packagedUpdateRollback: "docs/packaged-update-rollback.example.json"
};

const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const SECRET_QUERY_KEY_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const OUTPUT_FORMATS = new Set(["json", "markdown", "template", "comment"]);
const BUNDLE_FULL_CHECKLIST_JSON_PATH = "release-evidence-checklist.json";
const BUNDLE_FULL_CHECKLIST_MARKDOWN_PATH = "release-evidence-checklist.md";
const BUNDLE_FULL_TEMPLATE_PATH = "release-evidence-template.json";
const BUNDLE_MANIFEST_PATH = "manifest.json";
const BUNDLE_README_PATH = "README.md";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function urlIssuesForRef(ref, path) {
  if (!/^https?:\/\//iu.test(ref)) {
    return [];
  }

  let url;
  try {
    url = new URL(ref);
  } catch {
    return [`${path} must be a valid URL evidence ref`];
  }

  const issues = [];
  if (url.protocol !== "https:") {
    issues.push(`${path} must use https for URL evidence refs`);
  }

  if (url.username || url.password) {
    issues.push(`${path} must not include URL userinfo credentials`);
  }

  for (const key of url.searchParams.keys()) {
    if (SECRET_QUERY_KEY_PATTERN.test(key)) {
      issues.push(`${path} must not include secret-like query parameter ${JSON.stringify(key)}`);
    }
  }

  return issues;
}

function validateSecretFreeStrings(value, path = "$", issues = []) {
  if (typeof value === "string") {
    if (TOKEN_LIKE_PATTERN.test(value)) {
      issues.push(`${path} must not contain token-shaped secret values`);
    }
    issues.push(...urlIssuesForRef(value, path));
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

function isSelfReferentialReadyReleaseCommand(command) {
  return (
    (/^pnpm\s+verify:ready-release\b/iu.test(command) && !/\s--plan-only\b/iu.test(command)) ||
    (/^pnpm\s+verify:release-evidence-bundle\b/iu.test(command) && /\s--require-ready\b/iu.test(command))
  );
}

export function readyReleaseCommandsRequiredBeforeAggregate(commands) {
  return stringList(commands).filter((command) => !isSelfReferentialReadyReleaseCommand(command));
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
      readyReleaseCommandsRun: [],
      readyReleaseResult: {
        status: "pending",
        commandBlockers: ["<aggregate commandBlockers or none>"],
        perCommandBlockers: ["<matching command blockers or none>"]
      }
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
    readyReleaseCommandsRequiredBeforeAggregate: readyReleaseCommandsRequiredBeforeAggregate(checklist.readyReleaseCommands),
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

function isPlaceholder(value) {
  return typeof value === "string" && /^<[^>]+>$/u.test(value.trim());
}

function requireFilledString(value, path, issues) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path} must be a non-empty string.`);
    return;
  }

  if (isPlaceholder(value)) {
    issues.push(`${path} must replace template placeholder ${JSON.stringify(value)}.`);
  }
}

function requireFilledStringList(value, path, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path} must be a non-empty array.`);
    return;
  }

  value.forEach((item, index) => requireFilledString(item, `${path}[${index}]`, issues));
}

function requireStringListIncludesAll(value, path, issues, requiredValues, label) {
  if (!requiredValues.length) {
    return;
  }

  const actualValues = stringList(value);
  for (const requiredValue of requiredValues) {
    if (!actualValues.includes(requiredValue)) {
      issues.push(`${path} must include required ${label} ${JSON.stringify(requiredValue)}.`);
    }
  }
}

function validateTemplateResultEntries(entries, path, issues, expectedRequirements, requirementKey) {
  if (!Array.isArray(entries)) {
    issues.push(`${path} must be an array.`);
    return;
  }

  const actualRequirements = entries
    .filter(isRecord)
    .map((entry) => entry[requirementKey])
    .filter((value) => typeof value === "string");
  const missingRequirements = expectedRequirements.filter((requirement) => !actualRequirements.includes(requirement));
  for (const requirement of missingRequirements) {
    issues.push(`${path} is missing required ${requirementKey} ${JSON.stringify(requirement)}.`);
  }

  entries.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      issues.push(`${entryPath} must be an object.`);
      return;
    }

    requireFilledString(entry[requirementKey], `${entryPath}.${requirementKey}`, issues);
    if (entry.status !== "passed") {
      issues.push(`${entryPath}.status must be "passed" after evidence is collected.`);
    }
    requireFilledStringList(entry.evidenceRefs, `${entryPath}.evidenceRefs`, issues);
    requireFilledString(entry.notes, `${entryPath}.notes`, issues);
  });
}

function checklistItemsById(checklist) {
  return new Map((checklist?.checklistItems ?? []).map((item) => [item.itemId, item]));
}

function validateReadyReleaseResult(value, path, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }

  if (value.status !== "passed" && value.status !== "blocked") {
    issues.push(`${path}.status must be "passed" or "blocked".`);
  }
  requireFilledStringList(value.commandBlockers, `${path}.commandBlockers`, issues);
  requireFilledStringList(value.perCommandBlockers, `${path}.perCommandBlockers`, issues);
}

function validateTemplateItem(item, index, issues, expectedItem, requiredReadyReleaseCommands) {
  const path = `$.items[${index}]`;
  if (!isRecord(item)) {
    issues.push(`${path} must be an object.`);
    return;
  }

  requireFilledString(item.itemId, `${path}.itemId`, issues);
  if (item.expectedFinalStatus !== "passed") {
    issues.push(`${path}.expectedFinalStatus must be "passed".`);
  }
  if (expectedItem && item.blockerIssue !== expectedItem.blockerIssue) {
    issues.push(`${path}.blockerIssue must match source checklist blocker issue.`);
  }

  validateTemplateResultEntries(item.requiredChecks, `${path}.requiredChecks`, issues, expectedItem?.requiredChecks ?? [], "id");
  validateTemplateResultEntries(item.requiredEvidence, `${path}.requiredEvidence`, issues, expectedItem?.requiredEvidence ?? [], "requirement");
  validateTemplateResultEntries(item.unblockCriteria, `${path}.unblockCriteria`, issues, expectedItem?.unblockCriteria ?? [], "requirement");

  if (!isRecord(item.verification)) {
    issues.push(`${path}.verification must be an object.`);
    return;
  }

  requireFilledString(item.verification.verifiedAt, `${path}.verification.verifiedAt`, issues);
  if (typeof item.verification.verifiedAt === "string" && !isPlaceholder(item.verification.verifiedAt) && Number.isNaN(Date.parse(item.verification.verifiedAt))) {
    issues.push(`${path}.verification.verifiedAt must be an ISO timestamp.`);
  }
  requireFilledStringList(item.verification.verifiedBy, `${path}.verification.verifiedBy`, issues);
  if (item.verification.redactionConfirmed !== true) {
    issues.push(`${path}.verification.redactionConfirmed must be true.`);
  }
  requireFilledStringList(item.verification.readyReleaseCommandsRun, `${path}.verification.readyReleaseCommandsRun`, issues);
  requireStringListIncludesAll(
    item.verification.readyReleaseCommandsRun,
    `${path}.verification.readyReleaseCommandsRun`,
    issues,
    requiredReadyReleaseCommands,
    "ready-release command"
  );
  validateReadyReleaseResult(item.verification.readyReleaseResult, `${path}.verification.readyReleaseResult`, issues);
}

export function validateReleaseEvidenceTemplate(template, options = {}) {
  const issues = [];
  const expectedChecklist = options.expectedChecklist;

  if (!isRecord(template)) {
    return {
      schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
      status: "blocked",
      issues: ["$ must be a release evidence template object."],
      checked: ["filled release evidence template structure"]
    };
  }

  if (template.schemaVersion !== RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION) {
    issues.push(`$.schemaVersion must be ${JSON.stringify(RELEASE_EVIDENCE_TEMPLATE_SCHEMA_VERSION)}.`);
  }
  if (template.sourceChecklistSchemaVersion !== RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION) {
    issues.push(`$.sourceChecklistSchemaVersion must be ${JSON.stringify(RELEASE_EVIDENCE_CHECKLIST_SCHEMA_VERSION)}.`);
  }
  if (template.templateStatus !== "ready") {
    issues.push('$.templateStatus must be "ready" after evidence is collected.');
  }
  if (expectedChecklist?.summary?.filterIssueNumber && template.filterIssueNumber !== expectedChecklist.summary.filterIssueNumber) {
    issues.push("$.filterIssueNumber must match the expected checklist issue filter.");
  }
  if (template.summary?.pendingItems !== 0) {
    issues.push("$.summary.pendingItems must be 0 after evidence is collected.");
  }

  const expectedReadyReleaseCommands = stringList(expectedChecklist?.readyReleaseCommands);
  requireStringListIncludesAll(
    template.readyReleaseCommands,
    "$.readyReleaseCommands",
    issues,
    expectedReadyReleaseCommands,
    "ready-release command from source checklist"
  );

  if (!Array.isArray(template.items) || template.items.length === 0) {
    issues.push("$.items must be a non-empty array.");
  } else {
    const expectedItems = checklistItemsById(expectedChecklist);
    const expectedItemIds = [...expectedItems.keys()];
    const actualItemIds = template.items.filter(isRecord).map((item) => item.itemId).filter((itemId) => typeof itemId === "string");
    const seenActualItemIds = new Set();
    for (const expectedItemId of expectedItemIds) {
      if (!actualItemIds.includes(expectedItemId)) {
        issues.push(`$.items is missing source checklist item ${JSON.stringify(expectedItemId)}.`);
      }
    }
    for (const actualItemId of actualItemIds) {
      if (seenActualItemIds.has(actualItemId)) {
        issues.push(`$.items must not repeat source checklist item ${JSON.stringify(actualItemId)}.`);
      }
      seenActualItemIds.add(actualItemId);

      if (expectedChecklist && !expectedItems.has(actualItemId)) {
        issues.push(`$.items must not include unexpected source checklist item ${JSON.stringify(actualItemId)}.`);
      }
    }
    if (typeof template.summary?.totalItems === "number" && template.summary.totalItems !== template.items.length) {
      issues.push("$.summary.totalItems must match the number of template items.");
    }
    const requiredReadyReleaseCommands = readyReleaseCommandsRequiredBeforeAggregate(template.readyReleaseCommands);
    template.items.forEach((item, index) => validateTemplateItem(
      item,
      index,
      issues,
      expectedItems.get(item?.itemId),
      requiredReadyReleaseCommands
    ));
  }

  const finalIssues = uniqueStrings([...issues, ...validateSecretFreeStrings(template)]);

  return {
    schemaVersion: RELEASE_EVIDENCE_TEMPLATE_VALIDATION_SCHEMA_VERSION,
    status: finalIssues.length === 0 ? "passed" : "blocked",
    templateSchemaVersion: template.schemaVersion,
    filterIssueNumber: template.filterIssueNumber,
    itemCount: Array.isArray(template.items) ? template.items.length : 0,
    issues: finalIssues,
    checked: [
      "filled release evidence template schema",
      "all required checks, evidence, and unblock criteria are passed",
      "placeholder fields are replaced with redacted evidence refs and notes",
      "operator verification metadata, redaction confirmation, ready-release command coverage, and ready-release result blockers are present",
      "filled template is secret-free"
    ]
  };
}

export function buildFilledReleaseEvidenceTemplateFixture(template, options = {}) {
  const verifiedAt = options.now?.toISOString?.() ?? new Date("2026-05-24T00:00:00.000Z").toISOString();
  const fixtureRef = (itemId, fieldId) => `urn:solo-superman-fixture-evidence:${itemId}:${fieldId}`;

  return {
    ...template,
    templateStatus: "ready",
    items: template.items.map((item) => ({
      ...item,
      requiredChecks: item.requiredChecks.map((check) => ({
        ...check,
        status: "passed",
        evidenceRefs: [fixtureRef(item.itemId, `check-${check.id}`)],
        notes: `Credential-free fixture evidence confirms ${check.id}.`
      })),
      requiredEvidence: item.requiredEvidence.map((evidence) => ({
        ...evidence,
        status: "passed",
        evidenceRefs: [fixtureRef(item.itemId, evidence.id)],
        notes: `Credential-free fixture evidence confirms ${evidence.requirement}.`
      })),
      unblockCriteria: item.unblockCriteria.map((criterion) => ({
        ...criterion,
        status: "passed",
        evidenceRefs: [fixtureRef(item.itemId, criterion.id)],
        notes: `Credential-free fixture evidence confirms ${criterion.requirement}.`
      })),
      verification: {
        verifiedAt,
        verifiedBy: ["solo-superman-fixture-release-lab"],
        redactionConfirmed: true,
        readyReleaseCommandsRun: readyReleaseCommandsRequiredBeforeAggregate(template.readyReleaseCommands),
        readyReleaseResult: {
          status: "passed",
          commandBlockers: ["none"],
          perCommandBlockers: ["none"]
        }
      }
    })),
    summary: {
      ...template.summary,
      pendingItems: 0
    },
    issues: []
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

export function renderReleaseEvidenceIssueCommentMarkdown(checklist) {
  const issueNumber = checklist.summary.filterIssueNumber;
  const issueLabel = issueNumber ? `#${issueNumber}` : "the release blocker issue";
  const templatePath = issueNumber ? `issue-${issueNumber}-template.json` : "release-evidence-template.json";
  const verifyCommand = issueNumber
    ? `pnpm verify:release-evidence-template -- --input <filled-template.json> --issue ${issueNumber}`
    : "pnpm verify:release-evidence-template -- --input <filled-template.json>";
  const readyReleaseCommand = "pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>";
  const lines = [
    `# Release evidence update for ${issueLabel}`,
    "",
    "Use this comment body when the release lab has collected the required redacted evidence.",
    "",
    "## Release lab workflow",
    "",
    `- [ ] Fill \`${templatePath}\` with redacted evidence refs, public metadata, checksums, sizes, signature refs, and sanitized log summaries only.`,
    `- [ ] Run \`${verifyCommand}\` and paste the sanitized validation summary below.`,
    `- [ ] Run \`${readyReleaseCommand}\` after the full bundle passes, then paste status plus any aggregate \`commandBlockers\` below.`,
    "- [ ] Copy the same final ready-release values into `verification.readyReleaseResult.status`, `verification.readyReleaseResult.commandBlockers`, and `verification.readyReleaseResult.perCommandBlockers` in the filled JSON template.",
    "- [ ] Keep `verification.readyReleaseCommandsRun` limited to nested verifier commands that run before the filled-bundle and aggregate ready-release gates; do not list those self-referential verifier commands there.",
    "- [ ] Confirm no credential values, tokens, cookies, URL userinfo, secret-like query parameters, raw file contents, or full environment dumps are included.",
    "",
    "## Validation summary",
    "",
    "- Template validation command: _paste sanitized command output summary here_",
    "- Ready-release command: _paste final status and aggregate commandBlockers here_",
    "- Per-command blockers: _paste matching command `blockers` entries here, or `none` if passed_",
    "- Template readyReleaseResult: _confirm `status`, `commandBlockers`, and `perCommandBlockers` were copied into the filled JSON template_",
    "- Release lab operator / CI run: _redacted operator or run id_",
    "- Verified at: _UTC timestamp_",
    "",
    "## Evidence checklist",
    "",
    ...checklist.checklistItems.flatMap((item) => [renderChecklistItemMarkdown(item), ""]),
    "## Privacy boundary",
    "",
    "- [ ] Evidence refs are redacted before they are attached to GitHub issues or release PRs.",
    "- [ ] No token, cookie, credential value, URL userinfo, secret-like query parameter, file contents, or full environment dump is included."
  ];

  if (checklist.checklistItems.length === 0) {
    lines.splice(lines.indexOf("## Evidence checklist") + 2, 0, "_No evidence items matched this issue filter._", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function jsonContent(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function bundleIssueNumbers(checklist) {
  const issueNumbers = checklist.summary?.blockerIssueNumbers?.length
    ? checklist.summary.blockerIssueNumbers
    : checklist.checklistItems
      .map((item) => item.blockerIssueNumber)
      .filter((issueNumber) => issueNumber !== null && issueNumber !== undefined);

  return uniqueStrings(issueNumbers.map(String))
    .map(Number)
    .filter((issueNumber) => Number.isInteger(issueNumber) && issueNumber > 0)
    .sort((left, right) => left - right);
}

function bundleFileEntry(kind, relativePath, payload, metadata = {}) {
  return {
    kind,
    path: relativePath,
    schemaVersion: typeof payload?.schemaVersion === "string" ? payload.schemaVersion : undefined,
    checklistStatus: typeof payload?.status === "string" ? payload.status : undefined,
    templateStatus: typeof payload?.templateStatus === "string" ? payload.templateStatus : undefined,
    issueNumber: metadata.issueNumber,
    itemCount: typeof payload?.summary?.totalItems === "number" ? payload.summary.totalItems : metadata.itemCount,
    format: metadata.format
  };
}

function bundleManifestFileEntry(file) {
  return {
    kind: file.kind,
    path: file.path,
    schemaVersion: file.schemaVersion,
    checklistStatus: file.checklistStatus,
    templateStatus: file.templateStatus,
    issueNumber: file.issueNumber,
    itemCount: file.itemCount,
    format: file.format
  };
}

function renderReleaseEvidenceBundleReadme(manifest) {
  const issueLines = manifest.issueNumbers.length
    ? manifest.issueNumbers.map((issueNumber) => {
      const issueFiles = manifest.files
        .filter((file) => file.issueNumber === issueNumber)
        .map((file) => `  - \`${file.path}\` (${file.kind})`);

      return [`- #${issueNumber}`, ...issueFiles].join("\n");
    })
    : ["- _No blocker issues were found._"];

  return `${[
    "# Solo Superman release evidence bundle",
    "",
    `Generated at: \`${manifest.generatedAt}\``,
    `Bundle status: \`${manifest.status}\``,
    `Checklist status: \`${manifest.checklistStatus}\``,
    "",
    "## How to use",
    "",
    "1. Pick the issue-specific template for the release lab run you are executing.",
    "2. Replace placeholders only with redacted evidence refs, public metadata, checksums, sizes, signature refs, and sanitized log summaries.",
    "3. Keep credential values, tokens, cookies, URL userinfo, secret-like query parameters, and full environment dumps out of every file.",
    "4. Validate the generated or edited bundle structure with `pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir>` before distributing it.",
    "5. Validate each filled template with `pnpm verify:release-evidence-template -- --input <filled-template.json>` before attaching evidence to GitHub.",
    "6. After all real evidence is filled, run `pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready` before the final ready-release gate.",
    "7. Run `pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>` and copy the final status plus aggregate/per-command blockers into each filled template's `verification.readyReleaseResult.status`, `verification.readyReleaseResult.commandBlockers`, and `verification.readyReleaseResult.perCommandBlockers` fields before posting the matching issue comment.",
    "   Keep `verification.readyReleaseCommandsRun` to nested verifier commands only; the filled-bundle verifier and aggregate ready-release self-commands are represented by the bundle gate and `verification.readyReleaseResult`, not by pre-gate command-run entries.",
    "",
    "## Included issue files",
    "",
    ...issueLines,
    "",
    "## Full-bundle files",
    "",
    ...manifest.files
      .filter((file) => file.issueNumber === undefined)
      .map((file) => `- \`${file.path}\` (${file.kind})`),
    "",
    "## GitHub issue comments",
    "",
    ...manifest.files
      .filter((file) => file.kind === "issue-comment-markdown")
      .map((file) => `- #${file.issueNumber}: \`${file.path}\` — paste only after the filled template and full bundle pass validation.`),
    "",
    "## Bundle validation commands",
    "",
    "```sh",
    "pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir>",
    "pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready",
    "pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>",
    "```",
    "",
    "Use the first command for generated or partially edited bundles. It fails if the bundle directory contains off-manifest files, so remove scratch notes or secret-bearing artifacts before sharing evidence. Use `--require-ready` only after release lab evidence has replaced placeholders. The aggregate `verify:ready-release` command also runs the filled-bundle gate before final `release-readiness --require-ready`.",
    "",
    "When `verify:ready-release` is blocked, read its aggregate `commandBlockers` list first, then inspect the matching command entry's `blockers` array. These fields lift nested verifier `blockers`/`issues` out of redacted stdout so missing credentials, device evidence, or bundle files are visible without copying raw logs. The same values must be copied into each filled template's `readyReleaseResult` fields so the JSON evidence and issue comment agree. Do not add the `verify:release-evidence-bundle --require-ready` or aggregate `verify:ready-release` self-commands to `readyReleaseCommandsRun`; that field is reserved for verifier commands that already ran before those gates.",
    "",
    "## Ready-release verification commands",
    "",
    ...checkboxList(manifest.readyReleaseCommands, (command) => `\`${command}\``),
    "",
    "## Privacy boundary",
    "",
    "- [ ] Evidence refs are redacted before they are attached to GitHub issues or release PRs.",
    "- [ ] No token, cookie, credential value, URL userinfo, secret-like query parameter, file contents, or full environment dump is included."
  ].join("\n").trimEnd()}\n`;
}

export function buildReleaseEvidenceBundle(checklist) {
  const files = [];
  const fullTemplate = buildReleaseEvidenceTemplate(checklist);
  const addFile = (entry, content) => {
    files.push({ ...entry, content });
  };

  addFile(bundleFileEntry("full-checklist-json", BUNDLE_FULL_CHECKLIST_JSON_PATH, checklist, { format: "json" }), jsonContent(checklist));
  addFile(
    bundleFileEntry("full-checklist-markdown", BUNDLE_FULL_CHECKLIST_MARKDOWN_PATH, checklist, { format: "markdown" }),
    renderReleaseEvidenceChecklistMarkdown(checklist)
  );
  addFile(bundleFileEntry("full-template-json", BUNDLE_FULL_TEMPLATE_PATH, fullTemplate, { format: "json" }), jsonContent(fullTemplate));

  const issueNumbers = bundleIssueNumbers(checklist);
  for (const issueNumber of issueNumbers) {
    const issueChecklist = filterReleaseEvidenceChecklistByIssue(checklist, issueNumber);
    const issueTemplate = buildReleaseEvidenceTemplate(issueChecklist);
    const issuePrefix = `issue-${issueNumber}`;

    addFile(
      bundleFileEntry("issue-checklist-markdown", `${issuePrefix}-checklist.md`, issueChecklist, { format: "markdown", issueNumber }),
      renderReleaseEvidenceChecklistMarkdown(issueChecklist)
    );
    addFile(
      bundleFileEntry("issue-template-json", `${issuePrefix}-template.json`, issueTemplate, { format: "json", issueNumber }),
      jsonContent(issueTemplate)
    );
    addFile(
      bundleFileEntry("issue-comment-markdown", `${issuePrefix}-comment.md`, issueChecklist, { format: "markdown", issueNumber }),
      renderReleaseEvidenceIssueCommentMarkdown(issueChecklist)
    );
  }

  const manifestFiles = [
    ...files.map(bundleManifestFileEntry),
    {
      kind: "bundle-readme",
      path: BUNDLE_README_PATH,
      format: "markdown"
    },
    {
      kind: "bundle-manifest",
      path: BUNDLE_MANIFEST_PATH,
      schemaVersion: RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
      format: "json"
    }
  ];
  const manifestBase = {
    schemaVersion: RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
    generatedAt: checklist.generatedAt,
    status: "passed",
    checklistStatus: checklist.status,
    issueNumbers,
    summary: checklist.summary,
    openBlockerIssues: checklist.openBlockerIssues,
    readyReleaseCommands: checklist.readyReleaseCommands,
    readyReleaseCommandsRequiredBeforeAggregate: readyReleaseCommandsRequiredBeforeAggregate(checklist.readyReleaseCommands),
    credentialFreeCommands: checklist.credentialFreeCommands,
    privacy: {
      credentialFree: true,
      evidenceRefsMustBeRedacted: true,
      secretPolicy: "Bundle generation reads only public contract files and writes placeholders for redacted release lab evidence."
    },
    files: manifestFiles,
    issues: []
  };
  const issues = uniqueStrings([...checklist.issues, ...validateSecretFreeStrings(manifestBase)]);
  const manifest = {
    ...manifestBase,
    status: issues.length === 0 ? "passed" : "blocked",
    issues
  };

  files.push({
    kind: "bundle-readme",
    path: BUNDLE_README_PATH,
    format: "markdown",
    content: renderReleaseEvidenceBundleReadme(manifest)
  });
  files.push({
    kind: "bundle-manifest",
    path: BUNDLE_MANIFEST_PATH,
    schemaVersion: RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
    format: "json",
    content: jsonContent(manifest)
  });

  return { manifest, files };
}

async function writeReleaseEvidenceBundle(bundleDir, bundle) {
  await Promise.all(bundle.files.map(async (file) => {
    const outputPath = resolve(bundleDir, file.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, file.content, "utf8");
  }));
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
  let bundleDir = env.SOLO_RELEASE_EVIDENCE_BUNDLE_DIR;
  let explicitFormat = false;

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
      explicitFormat = true;
      index += 1;
    } else if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length);
      explicitFormat = true;
    } else if (arg === "--issue") {
      if (!argv[index + 1]) {
        throw new Error(`${arg} requires an issue number.`);
      }
      issueNumber = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith("--issue=")) {
      issueNumber = Number(arg.slice("--issue=".length));
    } else if (arg === "--bundle-dir") {
      const valueIndex = argv[index + 1] === "--" ? index + 2 : index + 1;
      if (!argv[valueIndex]) {
        throw new Error(`${arg} requires a path value.`);
      }
      bundleDir = argv[valueIndex];
      index = valueIndex;
    } else if (arg.startsWith("--bundle-dir=")) {
      bundleDir = arg.slice("--bundle-dir=".length);
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

  if (format === "comment" && issueNumber === undefined) {
    throw new Error("--format comment requires --issue <number> so the generated GitHub comment targets one blocker issue.");
  }

  if (bundleDir && outputPath) {
    throw new Error("--bundle-dir cannot be combined with --output.");
  }
  if (bundleDir && explicitFormat) {
    throw new Error("--bundle-dir cannot be combined with --format.");
  }
  if (bundleDir && issueNumber !== undefined) {
    throw new Error("--bundle-dir cannot be combined with --issue; the bundle always includes every blocker issue.");
  }

  return {
    outputPath: outputPath ? resolve(outputPath) : undefined,
    format,
    issueNumber,
    bundleDir: bundleDir ? resolve(bundleDir) : undefined
  };
}

async function writeChecklist(outputPath, content) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

function renderReleaseEvidenceChecklistOutput(checklist, format) {
  if (format === "template") {
    const payload = buildReleaseEvidenceTemplate(checklist);
    return {
      payload,
      content: jsonContent(payload)
    };
  }

  if (format === "markdown") {
    return {
      payload: checklist,
      content: renderReleaseEvidenceChecklistMarkdown(checklist)
    };
  }

  if (format === "comment") {
    return {
      payload: checklist,
      content: renderReleaseEvidenceIssueCommentMarkdown(checklist)
    };
  }

  return {
    payload: checklist,
    content: jsonContent(checklist)
  };
}

function assertCommentChecklistHasEvidenceItems(checklist, fullChecklist) {
  if (checklist.checklistItems.length > 0) {
    return;
  }

  const issueNumber = checklist.summary.filterIssueNumber;
  const availableIssueLabels = fullChecklist.summary.blockerIssueNumbers
    .map(Number)
    .filter((issue) => Number.isInteger(issue) && issue > 0)
    .sort((left, right) => left - right)
    .map((issue) => `#${issue}`);
  const availableIssues = availableIssueLabels.length > 0
    ? ` Available blocker issues: ${availableIssueLabels.join(", ")}.`
    : "";
  throw new Error(`--format comment matched no release evidence checklist items for issue #${issueNumber}.${availableIssues}`);
}

export async function runReleaseEvidenceChecklistCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseReleaseEvidenceChecklistArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm release:evidence-checklist [--format json|markdown|template|comment] [--issue <number>] [--output <path>] [--bundle-dir <path>]");
    return { status: "help" };
  }

  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const fullChecklist = buildReleaseEvidenceChecklist(contracts, options);
  if (parsed.bundleDir) {
    const bundle = buildReleaseEvidenceBundle(fullChecklist);
    await writeReleaseEvidenceBundle(parsed.bundleDir, bundle);
    const summary = {
      ...bundle.manifest,
      bundleDir: parsed.bundleDir
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  const checklist = filterReleaseEvidenceChecklistByIssue(fullChecklist, parsed.issueNumber);
  if (parsed.format === "comment") {
    assertCommentChecklistHasEvidenceItems(checklist, fullChecklist);
  }
  const { payload, content } = renderReleaseEvidenceChecklistOutput(checklist, parsed.format);

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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReleaseEvidenceChecklistCli().then((payload) => {
    if (Array.isArray(payload.issues) && payload.issues.length > 0) {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(`release-evidence-checklist failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
