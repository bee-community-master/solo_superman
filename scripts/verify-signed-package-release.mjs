#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const SIGNED_PACKAGE_RELEASE_SCHEMA_VERSION = "solo-superman-signed-package-release.v1";
export const DEFAULT_SIGNED_PACKAGE_RELEASE_PATH = "docs/signed-package-release.example.json";

const REQUIRED_SCOPES = new Set(["macos", "windows", "release-manifest"]);
const REQUIRED_CHECKS_BY_SCOPE = new Map([
  [
    "macos",
    new Set([
      "macos_codesign_verify",
      "macos_pkgutil_verify",
      "macos_notarization_status",
      "macos_stapling_verify",
      "macos_gatekeeper_assessment",
      "artifact_checksum_recorded"
    ])
  ],
  [
    "windows",
    new Set([
      "windows_authenticode_verify",
      "windows_timestamp_verify",
      "windows_installer_signature_verify",
      "windows_hash_recorded",
      "artifact_checksum_recorded"
    ])
  ],
  [
    "release-manifest",
    new Set([
      "release_manifest_artifact_sha256",
      "release_manifest_artifact_size",
      "release_manifest_artifact_signature_refs",
      "release_manifest_signature_verify"
    ])
  ]
]);
const REQUIRED_CREDENTIAL_FREE_COMMANDS = new Set([
  "pnpm verify:signed-package-preflight",
  "pnpm verify:signed-package-release",
  "pnpm verify:signed-package-release:dry-run",
  "pnpm verify:release-readiness",
  "pnpm verify"
]);
const REQUIRED_RELEASE_EVIDENCE_COMMANDS = new Set([
  "pnpm verify:signed-package-preflight -- --require-credentials",
  "pnpm verify:signed-package-release -- --require-release-evidence",
  "pnpm verify:release-readiness -- --require-ready"
]);
const REQUIRED_BLOCKER_ISSUE = "https://github.com/bee-community-master/solo_superman/issues/266";
const ALLOWED_RELEASE_STATUSES = new Set(["blocked", "ready"]);
const ALLOWED_EVIDENCE_RUN_STATUSES = new Set(["blocked", "passed"]);
const ALLOWED_REQUIRED_FOR = new Set(["general-release", "optional-hardening"]);
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const URL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u;
const GENERIC_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const REPO_RELATIVE_EVIDENCE_REF_PATTERN = /^(?:docs|release|artifacts|support|evidence)\/[A-Za-z0-9._~/#:-]+$/u;
const SAFE_URN_EVIDENCE_REF_PATTERN = /^urn:solo-superman-[A-Za-z0-9:._-]+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

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

function validatePositiveInteger(value, path, issues) {
  if (!Number.isInteger(value) || value <= 0) {
    addIssue(issues, path, "must be a positive integer");
  }
}

function validateSha256(value, path, issues) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    addIssue(issues, path, "must be a lowercase 64-character SHA-256 hex digest");
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

function validatePublicCertificateMetadata(value, path, issues) {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be public certificate metadata");
    return;
  }

  for (const field of ["kind", "subject", "issuer", "serialNumber"]) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      addIssue(issues, `${path}.${field}`, "must be a non-empty public metadata string");
    }
  }
  validateSha256(value.fingerprintSha256, `${path}.fingerprintSha256`, issues);
}

function validatePassedChecks(bundle, path, scope, issues) {
  const passedChecks = validateStringList(bundle?.passedChecks, `${path}.passedChecks`, issues);
  const requiredChecks = REQUIRED_CHECKS_BY_SCOPE.get(scope) ?? new Set();
  for (const requiredCheck of requiredChecks) {
    if (!passedChecks.has(requiredCheck)) {
      addIssue(issues, `${path}.passedChecks`, `must include ${requiredCheck}`);
    }
  }
}

function validatePackageEvidenceBundle(bundle, path, scope, issues) {
  if (!isRecord(bundle)) {
    addIssue(issues, path, "must include structured artifact evidence when the evidence run passed");
    return;
  }

  validateEvidenceRef(bundle.artifactRef, `${path}.artifactRef`, issues);
  if (scope === "macos" && !["macos-dmg", "macos-pkg"].includes(bundle.packageKind)) {
    addIssue(issues, `${path}.packageKind`, "must be macos-dmg or macos-pkg for macOS release evidence");
  }
  if (scope === "windows" && !["windows-msi", "windows-exe"].includes(bundle.packageKind)) {
    addIssue(issues, `${path}.packageKind`, "must be windows-msi or windows-exe for Windows release evidence");
  }
  validateSha256(bundle.sha256, `${path}.sha256`, issues);
  validatePositiveInteger(bundle.sizeBytes, `${path}.sizeBytes`, issues);
  validateEvidenceRef(bundle.signatureRef, `${path}.signatureRef`, issues);
  validatePublicCertificateMetadata(bundle.publicCertificate, `${path}.publicCertificate`, issues);
  validateStringList(bundle.redactedEvidenceRefs, `${path}.redactedEvidenceRefs`, issues);
  validatePassedChecks(bundle, path, scope, issues);

  if (scope === "macos") {
    for (const field of ["notarizationRef", "staplingRef", "gatekeeperAssessmentRef"]) {
      validateEvidenceRef(bundle[field], `${path}.${field}`, issues);
    }
  } else {
    for (const field of ["authenticodeRef", "timestampRef"]) {
      validateEvidenceRef(bundle[field], `${path}.${field}`, issues);
    }
  }
}

function validateManifestArtifactRef(value, path, issues) {
  if (!isRecord(value)) {
    addIssue(issues, path, "must be an artifact ref object");
    return null;
  }
  if (!new Set(["macos", "windows"]).has(value.scope)) {
    addIssue(issues, `${path}.scope`, "must be macos or windows");
  }
  validateSha256(value.sha256, `${path}.sha256`, issues);
  validatePositiveInteger(value.sizeBytes, `${path}.sizeBytes`, issues);
  validateEvidenceRef(value.signatureRef, `${path}.signatureRef`, issues);
  return typeof value.scope === "string" ? value.scope : null;
}

function validateManifestEvidenceBundle(bundle, path, issues) {
  if (!isRecord(bundle)) {
    addIssue(issues, path, "must include structured manifest evidence when the evidence run passed");
    return;
  }

  validateEvidenceRef(bundle.manifestRef, `${path}.manifestRef`, issues);
  validateSha256(bundle.manifestSha256, `${path}.manifestSha256`, issues);
  validatePositiveInteger(bundle.manifestSizeBytes, `${path}.manifestSizeBytes`, issues);
  validateEvidenceRef(bundle.manifestSignatureRef, `${path}.manifestSignatureRef`, issues);
  if (typeof bundle.publicKeyId !== "string" || bundle.publicKeyId.trim().length === 0) {
    addIssue(issues, `${path}.publicKeyId`, "must identify the release manifest verification key");
  }
  validateStringList(bundle.redactedEvidenceRefs, `${path}.redactedEvidenceRefs`, issues);
  validatePassedChecks(bundle, path, "release-manifest", issues);

  if (!Array.isArray(bundle.artifactRefs) || bundle.artifactRefs.length === 0) {
    addIssue(issues, `${path}.artifactRefs`, "must include macOS and Windows artifact refs");
    return;
  }

  const scopes = new Set();
  for (const [index, artifactRef] of bundle.artifactRefs.entries()) {
    const scope = validateManifestArtifactRef(artifactRef, `${path}.artifactRefs[${index}]`, issues);
    if (scope) {
      scopes.add(scope);
    }
  }
  for (const requiredScope of ["macos", "windows"]) {
    if (!scopes.has(requiredScope)) {
      addIssue(issues, `${path}.artifactRefs`, `must include ${requiredScope}`);
    }
  }
}

function validatePassedEvidenceBundle(run, path, issues) {
  if (run.scope === "macos" || run.scope === "windows") {
    validatePackageEvidenceBundle(run.evidenceBundle, `${path}.evidenceBundle`, run.scope, issues);
    return;
  }
  if (run.scope === "release-manifest") {
    validateManifestEvidenceBundle(run.evidenceBundle, `${path}.evidenceBundle`, issues);
  }
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
    commands.releaseEvidence,
    "$.requiredVerificationCommands.releaseEvidence",
    REQUIRED_RELEASE_EVIDENCE_COMMANDS,
    issues
  );
}

function validateEvidenceRun(run, path, issues) {
  if (!isRecord(run)) {
    addIssue(issues, path, "must be an object");
    return null;
  }

  if (typeof run.id !== "string" || run.id.trim().length === 0) {
    addIssue(issues, `${path}.id`, "must be a non-empty evidence run id");
  }
  if (!REQUIRED_SCOPES.has(run.scope)) {
    addIssue(issues, `${path}.scope`, "must be macos, windows, or release-manifest");
  }
  if (!ALLOWED_EVIDENCE_RUN_STATUSES.has(run.status)) {
    addIssue(issues, `${path}.status`, "must be blocked or passed");
  }
  if (!ALLOWED_REQUIRED_FOR.has(run.requiredFor)) {
    addIssue(issues, `${path}.requiredFor`, "must be general-release or optional-hardening");
  }

  validateStringList(run.evidenceRefs, `${path}.evidenceRefs`, issues);
  validateStringList(run.requiredEvidence, `${path}.requiredEvidence`, issues);
  validateStringList(run.unblockCriteria, `${path}.unblockCriteria`, issues);
  const checks = validateStringList(run.requiredChecks, `${path}.requiredChecks`, issues);
  const requiredChecks = REQUIRED_CHECKS_BY_SCOPE.get(run.scope) ?? new Set();
  for (const requiredCheck of requiredChecks) {
    if (!checks.has(requiredCheck)) {
      addIssue(issues, `${path}.requiredChecks`, `must include ${requiredCheck}`);
    }
  }

  if (run.status === "blocked") {
    if (typeof run.blocker !== "string" || run.blocker.trim().length === 0) {
      addIssue(issues, `${path}.blocker`, "must describe why this evidence run is blocked");
    }
    if (run.blockerIssue !== REQUIRED_BLOCKER_ISSUE) {
      addIssue(issues, `${path}.blockerIssue`, "must link the tracked signed package release evidence issue #266");
    }
  }

  if (run.blockerIssue !== undefined) {
    validateHttpsUrlIfPresent(run.blockerIssue, `${path}.blockerIssue`, issues);
  }

  if (run.status === "passed") {
    validateStringList(run.verifiedBy, `${path}.verifiedBy`, issues);
    if (typeof run.verifiedAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(run.verifiedAt)) {
      addIssue(issues, `${path}.verifiedAt`, "must be an ISO timestamp in UTC when the evidence run passed");
    }
    validatePassedEvidenceBundle(run, path, issues);
  }

  return typeof run.scope === "string" ? { id: run.id, scope: run.scope, status: run.status } : null;
}

function validateEvidenceRuns(runs, issues) {
  if (!Array.isArray(runs) || runs.length === 0) {
    addIssue(issues, "$.evidenceRuns", "must list macOS, Windows, and release manifest signing evidence runs");
    return [];
  }

  const seenScopes = new Set();
  const summaries = [];
  for (const [index, run] of runs.entries()) {
    const summary = validateEvidenceRun(run, `$.evidenceRuns[${index}]`, issues);
    if (!summary) {
      continue;
    }
    if (seenScopes.has(summary.scope)) {
      addIssue(issues, `$.evidenceRuns[${index}].scope`, "must be unique within evidenceRuns");
    }
    seenScopes.add(summary.scope);
    summaries.push(summary);
  }

  for (const requiredScope of REQUIRED_SCOPES) {
    if (!seenScopes.has(requiredScope)) {
      addIssue(issues, "$.evidenceRuns", `must include ${requiredScope}`);
    }
  }

  return summaries;
}

function consistencyIssues(contract, evidenceRunSummaries) {
  const issues = [];
  const blockedRuns = evidenceRunSummaries.filter((run) => run.status === "blocked");
  const passedScopes = new Set(evidenceRunSummaries.filter((run) => run.status === "passed").map((run) => run.scope));

  if (contract.releaseEvidenceStatus === "blocked" && blockedRuns.length === 0) {
    addIssue(issues, "$.releaseEvidenceStatus", "blocked status must name at least one blocked evidence run");
  }

  if (contract.releaseEvidenceStatus === "ready") {
    if (blockedRuns.length > 0) {
      addIssue(issues, "$.evidenceRuns", "ready release evidence cannot include blocked evidence runs");
    }
    for (const requiredScope of REQUIRED_SCOPES) {
      if (!passedScopes.has(requiredScope)) {
        addIssue(issues, "$.evidenceRuns", `ready release evidence must pass ${requiredScope}`);
      }
    }
  }

  return issues;
}

export function validateSignedPackageReleaseContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: signed package release contract must be a JSON object"], evidenceRunSummaries: [] };
  }

  if (contract.schemaVersion !== SIGNED_PACKAGE_RELEASE_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${SIGNED_PACKAGE_RELEASE_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_RELEASE_STATUSES.has(contract.releaseEvidenceStatus)) {
    addIssue(issues, "$.releaseEvidenceStatus", "must be blocked or ready");
  }
  if (typeof contract.summary !== "string" || contract.summary.trim().length === 0) {
    addIssue(issues, "$.summary", "must describe the current signed package release posture");
  }
  if (contract.preflightContract !== "docs/signed-package-preflight.example.json") {
    addIssue(issues, "$.preflightContract", "must point to docs/signed-package-preflight.example.json");
  }
  if (contract.releaseReadinessContract !== "docs/release-readiness_KO.md") {
    addIssue(issues, "$.releaseReadinessContract", "must point to docs/release-readiness_KO.md");
  }
  if (contract.blockerIssue !== REQUIRED_BLOCKER_ISSUE) {
    addIssue(issues, "$.blockerIssue", "must link the tracked signed package release evidence issue #266");
  }
  validateHttpsUrlIfPresent(contract.blockerIssue, "$.blockerIssue", issues);

  validateRequiredVerificationCommands(contract.requiredVerificationCommands, issues);
  validateStringList(contract.credentialBoundary, "$.credentialBoundary", issues, { minItems: 2 });
  const evidenceRunSummaries = validateEvidenceRuns(contract.evidenceRuns, issues);
  issues.push(...consistencyIssues(contract, evidenceRunSummaries));
  validateNoSecretStrings(contract, issues);

  return { ok: issues.length === 0, issues, evidenceRunSummaries };
}

export function evaluateSignedPackageRelease(contract, options = {}) {
  const validation = validateSignedPackageReleaseContract(contract);
  const blockers = [];

  if (!validation.ok) {
    blockers.push(...validation.issues);
  }

  const blockedEvidenceRuns = validation.evidenceRunSummaries.filter((run) => run.status === "blocked").map((run) => run.id);
  if (options.requireReleaseEvidence) {
    if (contract?.releaseEvidenceStatus !== "ready") {
      blockers.push("signed package release evidence is not ready");
    }
    for (const runId of blockedEvidenceRuns) {
      blockers.push(`${runId} evidence run is still blocked`);
    }
  }

  return {
    ok: blockers.length === 0,
    releaseEvidenceStatus: contract?.releaseEvidenceStatus ?? "invalid",
    signedPackageReleaseReady: validation.ok && contract?.releaseEvidenceStatus === "ready" && blockedEvidenceRuns.length === 0,
    blockedEvidenceRuns,
    blockers,
    validationIssues: validation.issues
  };
}

export function parseSignedPackageReleaseArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_SIGNED_PACKAGE_RELEASE_PATH;
  let requireReleaseEvidence = false;

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
    if (arg === "--require-release-evidence") {
      requireReleaseEvidence = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { contractPath, requireReleaseEvidence };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function evidenceForEvaluation(evaluation, options) {
  return {
    status: evaluation.ok ? "passed" : "blocked",
    schemaVersion: SIGNED_PACKAGE_RELEASE_SCHEMA_VERSION,
    mode: options.requireReleaseEvidence ? "require-release-evidence" : "contract",
    releaseEvidenceStatus: evaluation.releaseEvidenceStatus,
    signedPackageReleaseReady: evaluation.signedPackageReleaseReady,
    blockedEvidenceRuns: evaluation.blockedEvidenceRuns,
    blockers: evaluation.blockers,
    checked: [
      "signed package release evidence contract schema",
      "macOS signing, notarization, and stapling evidence gate",
      "Windows Authenticode signing and timestamp evidence gate",
      "release manifest checksum/signature evidence gate",
      "secret-free signed package release evidence strings",
      options.requireReleaseEvidence
        ? "all signed package release evidence runs must be passed"
        : "blocked signed package release posture is allowed only with explicit blockers"
    ]
  };
}

function exitCodeForEvidence(evidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const options = parseSignedPackageReleaseArgs();
  const contract = readJson(resolve(options.contractPath));
  const evidence = evidenceForEvaluation(evaluateSignedPackageRelease(contract, options), options);

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
