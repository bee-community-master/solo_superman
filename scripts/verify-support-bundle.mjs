#!/usr/bin/env node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  SUPPORT_BUNDLE_SCHEMA_VERSION,
  createSupportBundle,
  writeSupportBundle
} from "./support-bundle.mjs";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const SUPPORT_BUNDLE_VALIDATION_SCHEMA_VERSION = "solo-superman-support-bundle-validation.v1";

const DEFAULT_TIMEOUT_MS = 10_000;
const REQUIRED_PRIVACY_EXCLUSIONS = new Set([
  "full environment dump",
  "file contents",
  "browser cookies",
  "OpenAI or GitHub tokens",
  "ChatGPT web credentials"
]);
const REQUIRED_DIAGNOSTICS = new Set([
  "productCapabilityReadiness",
  "releaseChannel",
  "windowsRealDevice",
  "windowsInstallerDryRun",
  "packagedUpdateRollback",
  "packagedUpdateRollbackDryRun",
  "signedPackagePreflight",
  "signedPackageRelease",
  "signedPackageReleaseDryRun",
  "releaseReadiness",
  "readyReleasePlan",
  "releaseEvidenceTemplate",
  "releaseEvidenceBundle"
]);
const REQUIRED_DIAGNOSTIC_EVIDENCE_STATUS = {
  readyReleasePlan: "planned"
};
const REQUIRED_RELEASE_EVIDENCE_ISSUE_NUMBERS = [259, 266, 267];
const REQUIRED_RECOMMENDED_CHECKS = new Set([
  "pnpm verify:codex-live-runtime",
  "pnpm verify:product-capability-readiness",
  "pnpm verify:release-readiness",
  "pnpm verify:ready-release -- --plan-only",
  "pnpm release:evidence-checklist",
  "pnpm release:evidence-bundle -- <bundle-dir>",
  "pnpm verify:release-evidence-template",
  "pnpm verify:release-evidence-bundle",
  "pnpm verify:release-evidence-template -- --input <filled-template.json>",
  "pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready",
  "pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>",
  "pnpm verify:support-bundle",
  "pnpm support:bundle",
  "pnpm verify"
]);
const SENSITIVE_ENV_NAME_PATTERN = /(?:TOKEN|SECRET|PASSWORD|PASS|API[_-]?KEY|CREDENTIAL|COOKIE|AUTH|SESSION|PRIVATE|SSH|NPM_CONFIG__AUTH|GITHUB_TOKEN|OPENAI_API_KEY)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
const URL_USERINFO_CREDENTIAL_PATTERN = /\bhttps?:\/\/(?!<redacted>@)[^\s/@:]+:[^\s/@]+@/iu;
const SECRET_QUERY_VALUE_PATTERN = /[?&][^=\s]*(?:token|secret|password|pass|api[_-]?key|credential|auth|session)[^=\s]*=(?!<redacted>)(?!&|\s)[^&\s]+/iu;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addIssue(issues, path, message) {
  issues.push(`${path}: ${message}`);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
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

function validateNoSecretStrings(bundle, issues) {
  for (const { path, value } of collectStrings(bundle)) {
    if (TOKEN_LIKE_PATTERN.test(value)) {
      addIssue(issues, path, "must not contain token-shaped values");
    }
    if (URL_USERINFO_CREDENTIAL_PATTERN.test(value)) {
      addIssue(issues, path, "must not contain URL userinfo credentials");
    }
    if (SECRET_QUERY_VALUE_PATTERN.test(value)) {
      addIssue(issues, path, "must redact secret-like URL query values");
    }
  }
}

function validatePrivacy(privacy, issues) {
  if (!isRecord(privacy)) {
    addIssue(issues, "$.privacy", "must describe credential-free support bundle privacy policy");
    return;
  }
  if (privacy.credentialFree !== true) {
    addIssue(issues, "$.privacy.credentialFree", "must be true");
  }
  const exclusions = new Set(stringList(privacy.excluded));
  for (const exclusion of REQUIRED_PRIVACY_EXCLUSIONS) {
    if (!exclusions.has(exclusion)) {
      addIssue(issues, "$.privacy.excluded", `must include ${exclusion}`);
    }
  }
}

function validatePackageScripts(pkg, issues) {
  const scripts = isRecord(pkg?.scripts) ? pkg.scripts : null;
  if (!scripts) {
    addIssue(issues, "$.package.scripts", "must include package script metadata");
    return;
  }
  if (scripts.supportBundle !== "node scripts/support-bundle.mjs") {
    addIssue(issues, "$.package.scripts.supportBundle", "must point to support-bundle.mjs");
  }
  if (scripts.verifySupportBundle !== "node scripts/verify-support-bundle.mjs") {
    addIssue(issues, "$.package.scripts.verifySupportBundle", "must point to verify-support-bundle.mjs");
  }
  if (scripts.verifyReadyRelease !== "node scripts/verify-ready-release.mjs") {
    addIssue(issues, "$.package.scripts.verifyReadyRelease", "must point to verify-ready-release.mjs");
  }
  if (scripts.verifyCodexLiveRuntime !== "node scripts/verify-codex-live-runtime.mjs") {
    addIssue(issues, "$.package.scripts.verifyCodexLiveRuntime", "must point to verify-codex-live-runtime.mjs");
  }
}

function validateReleaseDiagnostics(diagnostics, issues) {
  if (!isRecord(diagnostics)) {
    addIssue(issues, "$.releaseDiagnostics", "must include compact product/release diagnostics");
    return;
  }
  for (const name of REQUIRED_DIAGNOSTICS) {
    const diagnostic = diagnostics[name];
    if (!isRecord(diagnostic)) {
      addIssue(issues, `$.releaseDiagnostics.${name}`, "must be present");
      continue;
    }
    if (diagnostic.captureStatus !== "ok") {
      addIssue(issues, `$.releaseDiagnostics.${name}.captureStatus`, "must be ok");
    }
    const expectedEvidenceStatus = REQUIRED_DIAGNOSTIC_EVIDENCE_STATUS[name] ?? "passed";
    if (diagnostic.evidenceStatus !== expectedEvidenceStatus) {
      addIssue(issues, `$.releaseDiagnostics.${name}.evidenceStatus`, `must be ${expectedEvidenceStatus}`);
    }
    if (name === "readyReleasePlan") {
      validateReadyReleasePlanDiagnostic(diagnostic, issues);
    }
  }
}

function validateReadyReleasePlanDiagnostic(diagnostic, issues) {
  if (diagnostic.mode !== "plan-only") {
    addIssue(issues, "$.releaseDiagnostics.readyReleasePlan.mode", "must be plan-only");
  }
  if (!isRecord(diagnostic.releaseEvidenceBundlePreparation)) {
    addIssue(
      issues,
      "$.releaseDiagnostics.readyReleasePlan.releaseEvidenceBundlePreparation",
      "must include bundle preparation summary"
    );
  } else if (diagnostic.releaseEvidenceBundlePreparation.status !== "planned") {
    addIssue(
      issues,
      "$.releaseDiagnostics.readyReleasePlan.releaseEvidenceBundlePreparation.status",
      "must be planned"
    );
  }
  if (typeof diagnostic.releaseEvidenceBundlePreparation?.command !== "string"
    || !diagnostic.releaseEvidenceBundlePreparation.command.startsWith("pnpm release:evidence-bundle -- ")) {
    addIssue(
      issues,
      "$.releaseDiagnostics.readyReleasePlan.releaseEvidenceBundlePreparation.command",
      "must include pnpm release:evidence-bundle preparation command"
    );
  }

  const plannedCommands = new Set(stringList(diagnostic.plannedCommands));
  if (![...plannedCommands].some((command) => command.startsWith("pnpm verify:release-evidence-bundle -- --bundle-dir ")
    && command.endsWith(" --require-ready"))) {
    addIssue(
      issues,
      "$.releaseDiagnostics.readyReleasePlan.plannedCommands",
      "must include release evidence bundle require-ready command"
    );
  }
  if (!plannedCommands.has("pnpm verify:release-readiness -- --require-ready")) {
    addIssue(
      issues,
      "$.releaseDiagnostics.readyReleasePlan.plannedCommands",
      "must include pnpm verify:release-readiness -- --require-ready"
    );
  }

  validateReadyReleaseIssuePreparation(diagnostic.releaseEvidenceIssuePreparation, issues);
}

function validateReadyReleaseIssuePreparation(value, issues) {
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      "$.releaseDiagnostics.readyReleasePlan.releaseEvidenceIssuePreparation",
      "must include issue-specific release evidence handoff entries for #259/#266/#267"
    );
    return;
  }

  const entriesByIssue = new Map(
    value
      .filter(isRecord)
      .filter((entry) => Number.isInteger(entry.issueNumber))
      .map((entry) => [entry.issueNumber, entry])
  );

  for (const issueNumber of REQUIRED_RELEASE_EVIDENCE_ISSUE_NUMBERS) {
    const entry = entriesByIssue.get(issueNumber);
    const path = `$.releaseDiagnostics.readyReleasePlan.releaseEvidenceIssuePreparation[${issueNumber}]`;
    if (!entry) {
      addIssue(
        issues,
        path,
        `must include issue-specific release evidence handoff for #${issueNumber}`
      );
      continue;
    }

    if (typeof entry.status !== "string") {
      addIssue(issues, `${path}.status`, "must include issue status");
    }
    if (typeof entry.blockedItems !== "number") {
      addIssue(issues, `${path}.blockedItems`, "must include blocked item count");
    }
    if (typeof entry.templatePath !== "string" || !entry.templatePath.endsWith(`issue-${issueNumber}-template.json`)) {
      addIssue(issues, `${path}.templatePath`, `must point to issue-${issueNumber}-template.json`);
    }
    if (typeof entry.commentPath !== "string" || !entry.commentPath.endsWith(`issue-${issueNumber}-comment.md`)) {
      addIssue(issues, `${path}.commentPath`, `must point to issue-${issueNumber}-comment.md`);
    }
    if (typeof entry.validateTemplateCommand !== "string"
      || !entry.validateTemplateCommand.includes(` --issue ${issueNumber}`)) {
      addIssue(issues, `${path}.validateTemplateCommand`, `must validate issue ${issueNumber} template`);
    }
    if (typeof entry.postIssueCommentCommand !== "string"
      || !entry.postIssueCommentCommand.startsWith(`gh issue comment ${issueNumber} `)) {
      addIssue(issues, `${path}.postIssueCommentCommand`, `must post issue ${issueNumber} comment`);
    }
  }
}

function validateEnv(env, issues) {
  if (!isRecord(env)) {
    addIssue(issues, "$.env", "must be an allowlisted environment snapshot object");
    return;
  }
  for (const [name, value] of Object.entries(env)) {
    if (SENSITIVE_ENV_NAME_PATTERN.test(name)) {
      addIssue(issues, `$.env.${name}`, "must not include sensitive environment names");
    }
    if (typeof value === "string" && value !== "<redacted>" && TOKEN_LIKE_PATTERN.test(value)) {
      addIssue(issues, `$.env.${name}`, "must not include token-shaped environment values");
    }
  }
}

function validateRecommendedChecks(checks, issues) {
  const commands = new Set(stringList(checks));
  for (const required of REQUIRED_RECOMMENDED_CHECKS) {
    if (!commands.has(required)) {
      addIssue(issues, "$.recommendedChecks", `must include ${required}`);
    }
  }
}

export function validateSupportBundle(bundle) {
  const issues = [];
  if (!isRecord(bundle)) {
    return { ok: false, issues: ["$: support bundle must be a JSON object"] };
  }

  if (bundle.schemaVersion !== SUPPORT_BUNDLE_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${SUPPORT_BUNDLE_SCHEMA_VERSION}`);
  }
  validatePrivacy(bundle.privacy, issues);
  validatePackageScripts(bundle.package, issues);
  validateReleaseDiagnostics(bundle.releaseDiagnostics, issues);
  validateEnv(bundle.env, issues);
  validateRecommendedChecks(bundle.recommendedChecks, issues);
  validateNoSecretStrings(bundle, issues);

  return { ok: issues.length === 0, issues };
}

export function evidenceForValidation(validation, options = {}) {
  return {
    status: validation.ok ? "passed" : "blocked",
    schemaVersion: SUPPORT_BUNDLE_VALIDATION_SCHEMA_VERSION,
    supportBundleSchemaVersion: SUPPORT_BUNDLE_SCHEMA_VERSION,
    mode: options.bundlePath ? "existing-bundle" : "generated-bundle",
    bundlePath: options.outputPath ?? options.bundlePath ?? null,
    blockers: validation.issues,
    checked: [
      "support bundle schema",
      "credential-free privacy exclusions",
      "support and verifier package scripts",
      "compact product/release diagnostics are captured successfully",
      "allowlisted environment snapshot excludes sensitive names",
      "support bundle recommended checks include support and readiness verification",
      "support bundle strings are redacted before reporting"
    ]
  };
}

export function parseSupportBundleVerificationArgs(argv = process.argv.slice(2), env = process.env) {
  let bundlePath = null;
  let outputPath = env.SOLO_VERIFY_SUPPORT_BUNDLE_OUTPUT ?? null;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--bundle") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--bundle requires a path value");
      }
      bundlePath = resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error(`${arg} requires a path value`);
      }
      outputPath = resolve(next);
      index += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      outputPath = resolve(arg.slice("--output=".length));
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
    throw new Error(`Unknown support bundle verification argument: ${arg}`);
  }

  return { bundlePath, outputPath: outputPath ? resolve(outputPath) : null, timeoutMs };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadOrGenerateBundle(options) {
  if (options.bundlePath) {
    return await readJson(options.bundlePath);
  }

  return await createSupportBundle({ timeoutMs: options.timeoutMs });
}

async function main() {
  const options = parseSupportBundleVerificationArgs();
  let tempDir = null;
  try {
    const bundle = await loadOrGenerateBundle(options);
    let outputPath = options.outputPath;
    if (!options.bundlePath) {
      if (!outputPath) {
        tempDir = await mkdtemp(join(tmpdir(), "solo-support-bundle-verify-"));
        outputPath = join(tempDir, "support-bundle.json");
      }
      await writeSupportBundle(outputPath, bundle);
    }
    const evidence = evidenceForValidation(validateSupportBundle(bundle), {
      bundlePath: options.bundlePath,
      outputPath
    });
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = evidence.status === "passed" ? 0 : 1;
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
