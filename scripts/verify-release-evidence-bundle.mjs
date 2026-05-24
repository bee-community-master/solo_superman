#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import {
  buildReleaseEvidenceBundle,
  buildReleaseEvidenceChecklist,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts,
  RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
  validateReleaseEvidenceTemplate
} from "./release-evidence-checklist.mjs";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const RELEASE_EVIDENCE_BUNDLE_VALIDATION_SCHEMA_VERSION = "solo-superman-release-evidence-bundle-validation.v1";

const DEFAULT_MANIFEST_PATH = "manifest.json";
const DEFAULT_TIMEOUT_MS = 10_000;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"')\]}]+/giu;
const SAFE_RELATIVE_PATH_PATTERN = /^(?!\/|\.{1,2}(?:\/|$)|.*(?:^|\/)\.\.(?:\/|$)).+/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, path, message) {
  issues.push(`${path}: ${message}`);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function validateSecretFreeString(value, path, issues) {
  if (TOKEN_LIKE_PATTERN.test(value)) {
    addIssue(issues, path, "must not contain token-shaped secret values");
  }

  const urlCandidates = value.match(HTTP_URL_PATTERN) ?? [];
  if (urlCandidates.length === 0) {
    return;
  }

  for (const candidate of urlCandidates) {
    let url;
    try {
      url = new URL(candidate);
    } catch {
      addIssue(issues, path, "must be a valid URL when using URL evidence refs");
      continue;
    }
    if (url.username || url.password) {
      addIssue(issues, path, "must not include URL userinfo credentials");
    }
    for (const key of url.searchParams.keys()) {
      if (SECRET_QUERY_NAME_PATTERN.test(key)) {
        addIssue(issues, path, `must not include secret-like query parameter ${JSON.stringify(key)}`);
      }
    }
  }
}

function validateSecretFreeValue(value, path, issues) {
  if (typeof value === "string") {
    validateSecretFreeString(value, path, issues);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSecretFreeValue(item, `${path}[${index}]`, issues));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => validateSecretFreeValue(item, `${path}.${key}`, issues));
  }
}

function validateBundleRelativePath(path, issues, issuePath) {
  if (typeof path !== "string" || !SAFE_RELATIVE_PATH_PATTERN.test(path)) {
    addIssue(issues, issuePath, "must be a safe relative bundle path");
  }
}

function expectedFilesByPath(expectedBundle) {
  return new Map(expectedBundle.manifest.files.map((file) => [file.path, file]));
}

function manifestFilesByPath(manifest, issues) {
  if (!Array.isArray(manifest.files)) {
    addIssue(issues, "$.files", "must be an array");
    return new Map();
  }
  const seen = new Set();
  const files = new Map();
  manifest.files.forEach((file, index) => {
    const path = `$.files[${index}]`;
    if (!isRecord(file)) {
      addIssue(issues, path, "must be an object");
      return;
    }
    validateBundleRelativePath(file.path, issues, `${path}.path`);
    if (seen.has(file.path)) {
      addIssue(issues, `${path}.path`, "must be unique in the manifest");
    }
    seen.add(file.path);
    files.set(file.path, file);
  });
  return files;
}

function compareManifestFileEntry(actual, expected, path, issues) {
  for (const key of ["kind", "schemaVersion", "checklistStatus", "templateStatus", "issueNumber", "itemCount", "format"]) {
    if (actual?.[key] !== expected?.[key]) {
      addIssue(issues, path, `must preserve ${key} from the generated bundle manifest`);
    }
  }
}

function issueNumberFromManifestFile(file) {
  const issueNumber = Number(file?.issueNumber);
  return Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : undefined;
}

function expectedChecklistForTemplate(fullChecklist, file) {
  const issueNumber = issueNumberFromManifestFile(file);
  return issueNumber ? filterReleaseEvidenceChecklistByIssue(fullChecklist, issueNumber) : fullChecklist;
}

function validatePendingTemplateShape(template, expectedChecklist, path, issues) {
  if (!isRecord(template)) {
    addIssue(issues, path, "must be a release evidence template object");
    return;
  }
  if (template.templateStatus !== "pending" && template.templateStatus !== "ready") {
    addIssue(issues, `${path}.templateStatus`, "must be pending or ready");
  }
  const expectedItemIds = new Set((expectedChecklist.checklistItems ?? []).map((item) => item.itemId));
  const actualItemIds = new Set((Array.isArray(template.items) ? template.items : [])
    .filter(isRecord)
    .map((item) => item.itemId)
    .filter((itemId) => typeof itemId === "string"));
  for (const expectedItemId of expectedItemIds) {
    if (!actualItemIds.has(expectedItemId)) {
      addIssue(issues, `${path}.items`, `must include source checklist item ${JSON.stringify(expectedItemId)}`);
    }
  }
  for (const command of stringList(expectedChecklist.readyReleaseCommands)) {
    if (!stringList(template.readyReleaseCommands).includes(command)) {
      addIssue(issues, `${path}.readyReleaseCommands`, `must include ${command}`);
    }
  }
}

async function fileExists(path) {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadBundleDirectory(bundleDir) {
  const manifestPath = resolve(bundleDir, DEFAULT_MANIFEST_PATH);
  const manifest = await readJson(manifestPath);
  const fileContents = new Map();
  if (Array.isArray(manifest.files)) {
    await Promise.all(manifest.files.map(async (file) => {
      if (!isRecord(file) || typeof file.path !== "string" || !SAFE_RELATIVE_PATH_PATTERN.test(file.path)) {
        return;
      }
      const absolutePath = resolve(bundleDir, file.path);
      if (await fileExists(absolutePath)) {
        fileContents.set(file.path, await readFile(absolutePath, "utf8"));
      }
    }));
  }

  return { manifest, fileContents };
}

function generatedBundleContentMap(bundle) {
  return new Map(bundle.files.map((file) => [file.path, file.content]));
}

async function validateBundlePayload({ manifest, fileContents }, options = {}) {
  const issues = [];
  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const fullChecklist = buildReleaseEvidenceChecklist(contracts, options);
  const expectedBundle = buildReleaseEvidenceBundle(fullChecklist);
  const expectedFiles = expectedFilesByPath(expectedBundle);
  const manifestFiles = manifestFilesByPath(manifest, issues);

  if (manifest.schemaVersion !== RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION}`);
  }
  if (manifest.privacy?.credentialFree !== true || manifest.privacy?.evidenceRefsMustBeRedacted !== true) {
    addIssue(issues, "$.privacy", "must preserve credential-free redacted-evidence privacy metadata");
  }
  if (manifest.checklistStatus !== fullChecklist.status) {
    addIssue(issues, "$.checklistStatus", "must match the current release evidence checklist status");
  }
  for (const command of stringList(fullChecklist.readyReleaseCommands)) {
    if (!stringList(manifest.readyReleaseCommands).includes(command)) {
      addIssue(issues, "$.readyReleaseCommands", `must include ${command}`);
    }
  }

  for (const [expectedPath, expectedFile] of expectedFiles.entries()) {
    const actualFile = manifestFiles.get(expectedPath);
    if (!actualFile) {
      addIssue(issues, "$.files", `must include ${expectedPath}`);
      continue;
    }
    compareManifestFileEntry(actualFile, expectedFile, `$.files[path=${JSON.stringify(expectedPath)}]`, issues);
    if (!fileContents.has(expectedPath)) {
      addIssue(issues, `file:${expectedPath}`, "must exist in the bundle directory");
    }
  }
  for (const actualPath of manifestFiles.keys()) {
    if (!expectedFiles.has(actualPath)) {
      addIssue(issues, "$.files", `must not include unexpected bundle file ${actualPath}`);
    }
  }

  for (const [path, content] of fileContents.entries()) {
    validateSecretFreeString(content, `file:${path}`, issues);
    const file = manifestFiles.get(path);
    if (file?.kind === "issue-template-json" || file?.kind === "full-template-json") {
      let template;
      try {
        template = JSON.parse(content);
      } catch {
        addIssue(issues, `file:${path}`, "must contain valid JSON");
        continue;
      }
      const expectedChecklist = expectedChecklistForTemplate(fullChecklist, file);
      if (options.requireReady) {
        const validation = validateReleaseEvidenceTemplate(template, { expectedChecklist });
        if (validation.status !== "passed") {
          addIssue(issues, `file:${path}`, "ready template validation must pass");
        }
        issues.push(...validation.issues.map((issue) => `file:${path}: ${issue}`));
      } else {
        validatePendingTemplateShape(template, expectedChecklist, `file:${path}`, issues);
      }
    }
  }
  validateSecretFreeValue(manifest, "$", issues);

  return {
    ok: issues.length === 0,
    issues: uniqueStrings(issues),
    manifest,
    fullChecklist,
    expectedBundle
  };
}

function evidenceForBundleValidation(validation, options = {}) {
  const manifest = validation.manifest ?? {};
  return {
    status: validation.ok ? "passed" : "blocked",
    schemaVersion: RELEASE_EVIDENCE_BUNDLE_VALIDATION_SCHEMA_VERSION,
    bundleSchemaVersion: RELEASE_EVIDENCE_BUNDLE_SCHEMA_VERSION,
    mode: options.bundleDir ? "bundle-dir" : "generated-bundle",
    requireReady: options.requireReady === true,
    bundleDir: options.bundleDir ?? null,
    checklistStatus: manifest.checklistStatus ?? validation.fullChecklist?.status ?? null,
    issueNumbers: manifest.issueNumbers ?? [],
    fileCount: Array.isArray(manifest.files) ? manifest.files.length : 0,
    blockers: validation.issues,
    checked: [
      "release evidence bundle manifest schema",
      "bundle file list matches current release evidence contracts",
      "bundle README, manifest, checklist, templates, and issue comments are present",
      "ready-release commands are carried through the bundle",
      options.requireReady ? "filled release evidence templates pass ready validation" : "pending release evidence templates preserve expected checklist items",
      "release evidence bundle strings are secret-free"
    ]
  };
}

export function parseReleaseEvidenceBundleVerifierArgs(argv = process.argv.slice(2), env = process.env) {
  let bundleDir = env.SOLO_RELEASE_EVIDENCE_BUNDLE_DIR ? resolve(env.SOLO_RELEASE_EVIDENCE_BUNDLE_DIR) : undefined;
  let requireReady = env.SOLO_RELEASE_EVIDENCE_BUNDLE_REQUIRE_READY === "1";
  let timeoutMs = Number(env.SOLO_RELEASE_EVIDENCE_BUNDLE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("SOLO_RELEASE_EVIDENCE_BUNDLE_TIMEOUT_MS must be a positive integer when set");
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--bundle-dir") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--bundle-dir requires a path value");
      }
      bundleDir = resolve(next);
      index += 1;
      continue;
    }
    if (arg.startsWith("--bundle-dir=")) {
      bundleDir = resolve(arg.slice("--bundle-dir=".length));
      continue;
    }
    if (arg === "--require-ready") {
      requireReady = true;
      continue;
    }
    if (arg === "--timeout-ms") {
      const next = argv[index + 1];
      if (!next || !Number.isInteger(Number(next)) || Number(next) <= 0) {
        throw new Error("--timeout-ms requires a positive integer value");
      }
      timeoutMs = Number(next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown release evidence bundle verifier argument: ${arg}`);
  }

  return { bundleDir, requireReady, timeoutMs };
}

async function generatedBundlePayload(options) {
  const contracts = await loadReleaseEvidenceContracts(options.contractPaths, options);
  const checklist = buildReleaseEvidenceChecklist(contracts, options);
  const bundle = buildReleaseEvidenceBundle(checklist);

  return {
    manifest: bundle.manifest,
    fileContents: generatedBundleContentMap(bundle)
  };
}

export async function runReleaseEvidenceBundleVerification(argv = process.argv.slice(2), options = {}) {
  const parsed = parseReleaseEvidenceBundleVerifierArgs(argv, options.env ?? process.env);
  const payload = parsed.bundleDir
    ? await loadBundleDirectory(parsed.bundleDir)
    : await generatedBundlePayload(options);
  const validation = await validateBundlePayload(payload, {
    ...options,
    requireReady: parsed.requireReady
  });
  const evidence = evidenceForBundleValidation(validation, {
    ...parsed,
    bundleDir: parsed.bundleDir
  });
  console.log(JSON.stringify(evidence, null, 2));
  return evidence;
}

async function main() {
  const evidence = await runReleaseEvidenceBundleVerification();
  process.exitCode = evidence.status === "passed" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
