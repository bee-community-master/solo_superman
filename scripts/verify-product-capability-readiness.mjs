#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const PRODUCT_CAPABILITY_READINESS_SCHEMA_VERSION = "solo-superman-product-capability-readiness.v1";
export const DEFAULT_PRODUCT_CAPABILITY_READINESS_PATH = "docs/product-capability-readiness.example.json";

const REQUIRED_CAPABILITY_COMMANDS = new Map([
  ["idea-clarification-loop", ["pnpm verify:clarification-pipeline", "pnpm verify:clarification-volume"]],
  ["research-evidence-loop", ["pnpm verify:research-pipeline"]],
  ["planning-readiness-gates", ["pnpm verify:clarification-pipeline", "pnpm verify:research-pipeline"]],
  [
    "browser-service-boundary",
    [
      "pnpm verify:browser-delegation-pipeline",
      "pnpm verify:service-page-pipeline",
      "pnpm verify:production-mutation-contract"
    ]
  ],
  [
    "auto-implementation-review-loop",
    [
      "pnpm verify:runtime-preview-turn",
      "pnpm verify:codex-live-runtime",
      "pnpm verify:worker-job",
      "pnpm verify:pr-mutation",
      "pnpm verify:auto-implementation-review-loop",
      "pnpm verify:auto-implementation-pipeline"
    ]
  ],
  ["technical-preview-release-guardrails", ["pnpm verify:prod-bundle", "pnpm verify:release-readiness"]],
  ["local-error-reporting", ["pnpm verify:support-bundle"]]
]);
const REQUIRED_CAPABILITY_IDS = new Set(REQUIRED_CAPABILITY_COMMANDS.keys());
const REQUIRED_CAPABILITY_BEHAVIOR_SNIPPETS = new Map([
  [
    "idea-clarification-loop",
    [
      "open text",
      "subjective/narrative",
      "binary stance",
      "one-of-many",
      "single choice",
      "one-or-more",
      "multi-select",
      "ranked",
      "evidence",
      "experiment answer formats",
      "non-blocking",
      "background research starts",
      "automatic queue refill"
    ]
  ],
  [
    "research-evidence-loop",
    [
      "Mounted web_search_readonly provider polling",
      "source-traced result import",
      "evidence matrices and evidence packs",
      "Max simultaneous research runs",
      "Max research runs per session",
      "markdown memory",
      "wider follow-up research",
      "Research-generated follow-up questions",
      "answer-form variety",
      "open_text narrative answers",
      "binary_choice pro/con decisions",
      "single_choice one-of-many choices",
      "multi_select one-or-more selections",
      "ranked_choice",
      "evidence_judgment"
    ]
  ],
  [
    "planning-readiness-gates",
    [
      "Composite score is 85 or higher",
      "Most confidence axes are 75 or higher",
      "question debt",
      "source-trace gaps"
    ]
  ],
  [
    "browser-service-boundary",
    [
      "approved public-read",
      "production-mutation contract",
      "final submit"
    ]
  ],
  [
    "auto-implementation-review-loop",
    [
      "live runtime readiness",
      "skipped, blocked, or passed evidence",
      "Generated PR body",
      "issue document status summary",
      "stage status summary",
      "review/evidence gate summary",
      "missing-test audit summary",
      "two consecutive no-finding",
      "feature and repository code-review",
      "changed-code and repository clean-code",
      "zero-gap missing-test audit",
      "passing test evidence before completion",
      "Final merge_main",
      "final_verify_pr_update",
      "current PR body evidence",
      "full verification commands"
    ]
  ],
  [
    "local-error-reporting",
    [
      "support diagnostics bundle",
      "credential-free",
      "redacted",
      "ready-release plan-only",
      "bundle preparation command",
      "planned command list",
      "release evidence blocker summary",
      "issue-specific handoff"
    ]
  ]
]);
const REQUIRED_DEFAULT_COMMANDS = new Set([
  "pnpm verify:prod-bundle",
  "pnpm verify:clarification-pipeline",
  "pnpm verify:clarification-volume",
  "pnpm verify:research-pipeline",
  "pnpm verify:browser-delegation-pipeline",
  "pnpm verify:service-page-pipeline",
  "pnpm verify:production-mutation-contract",
  "pnpm verify:auto-implementation-pipeline",
  "pnpm verify:support-bundle",
  "pnpm verify:product-capability-readiness",
  "pnpm verify"
]);
const REQUIRED_SUPPORTING_COMMANDS = new Set([
  "pnpm verify:codex-live-runtime",
  "pnpm verify:ready-release -- --plan-only",
  "pnpm support:bundle"
]);
const ALLOWED_PRODUCT_POSTURES = new Set(["technical-preview", "limited-beta", "general-release"]);
const ALLOWED_READINESS_STATUSES = new Set(["code_backed", "blocked"]);
const ALLOWED_CAPABILITY_STATUSES = new Set(["code_backed", "blocked"]);
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session)/iu;
const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");
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
    addIssue(issues, path, "must be a valid URL when using URL refs");
    return;
  }

  if (parsed.protocol !== "https:") {
    addIssue(issues, path, "must use https when using URL refs");
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

function validateRequiredCommands(value, path, requiredCommands, issues) {
  const commands = validateStringList(value, path, issues);
  for (const required of requiredCommands) {
    if (!commands.has(required)) {
      addIssue(issues, path, `must include ${required}`);
    }
  }
  return commands;
}

function validateRequiredBehaviorSnippets(value, path, requiredSnippets, issues) {
  if (!Array.isArray(value)) {
    return;
  }

  const behaviorText = value.filter((item) => typeof item === "string").join("\n");
  for (const snippet of requiredSnippets) {
    if (!behaviorText.includes(snippet)) {
      addIssue(issues, path, `must mention ${snippet}`);
    }
  }
}

function validateRequiredVerificationCommands(commands, issues) {
  if (!isRecord(commands)) {
    addIssue(issues, "$.requiredVerificationCommands", "must be an object");
    return;
  }

  validateRequiredCommands(
    commands.defaultSuite,
    "$.requiredVerificationCommands.defaultSuite",
    REQUIRED_DEFAULT_COMMANDS,
    issues
  );
  validateRequiredCommands(
    commands.supporting,
    "$.requiredVerificationCommands.supporting",
    REQUIRED_SUPPORTING_COMMANDS,
    issues
  );
}

function validateCapability(capability, path, issues) {
  if (!isRecord(capability)) {
    addIssue(issues, path, "must be an object");
    return null;
  }

  if (typeof capability.id !== "string" || capability.id.trim().length === 0) {
    addIssue(issues, `${path}.id`, "must be a non-empty capability id");
  }
  if (!ALLOWED_CAPABILITY_STATUSES.has(capability.status)) {
    addIssue(issues, `${path}.status`, "must be code_backed or blocked");
  }
  if (capability.requiredFor !== "technical-preview-core-loop") {
    addIssue(issues, `${path}.requiredFor`, "must be technical-preview-core-loop");
  }

  validateStringList(capability.evidenceRefs, `${path}.evidenceRefs`, issues, { minItems: 2 });
  validateStringList(capability.checkedBehaviors, `${path}.checkedBehaviors`, issues, { minItems: 2 });
  validateRequiredBehaviorSnippets(
    capability.checkedBehaviors,
    `${path}.checkedBehaviors`,
    REQUIRED_CAPABILITY_BEHAVIOR_SNIPPETS.get(capability.id) ?? [],
    issues
  );
  const verificationCommands = validateStringList(capability.verificationCommands, `${path}.verificationCommands`, issues);

  const requiredCommands = REQUIRED_CAPABILITY_COMMANDS.get(capability.id) ?? [];
  for (const command of requiredCommands) {
    if (!verificationCommands.has(command)) {
      addIssue(issues, `${path}.verificationCommands`, `must include ${command}`);
    }
  }

  if (capability.status === "blocked") {
    if (typeof capability.blocker !== "string" || capability.blocker.trim().length === 0) {
      addIssue(issues, `${path}.blocker`, "must describe why the capability is blocked");
    }
    if (typeof capability.blockerIssue !== "string" || capability.blockerIssue.trim().length === 0) {
      addIssue(issues, `${path}.blockerIssue`, "must link a GitHub issue while blocked");
    } else {
      validateHttpsUrlIfPresent(capability.blockerIssue, `${path}.blockerIssue`, issues);
    }
  }

  if (capability.status === "code_backed" && capability.blocker !== undefined) {
    addIssue(issues, `${path}.blocker`, "must be omitted when the capability is code_backed");
  }

  return typeof capability.id === "string" ? { id: capability.id, status: capability.status } : null;
}

function validateCapabilities(capabilities, issues) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    addIssue(issues, "$.capabilities", "must list every required product capability");
    return [];
  }

  const seen = new Set();
  const summaries = [];
  for (const [index, capability] of capabilities.entries()) {
    const summary = validateCapability(capability, `$.capabilities[${index}]`, issues);
    if (!summary) {
      continue;
    }
    if (seen.has(summary.id)) {
      addIssue(issues, `$.capabilities[${index}].id`, "must be unique");
    }
    seen.add(summary.id);
    summaries.push(summary);
  }

  for (const requiredId of REQUIRED_CAPABILITY_IDS) {
    if (!seen.has(requiredId)) {
      addIssue(issues, "$.capabilities", `must include ${requiredId}`);
    }
  }

  return summaries;
}

function consistencyIssues(contract, capabilitySummaries) {
  const issues = [];
  const blockedCapabilities = capabilitySummaries.filter((capability) => capability.status === "blocked");

  if (contract.coreProductStatus === "code_backed" && blockedCapabilities.length > 0) {
    addIssue(issues, "$.capabilities", "code_backed core product cannot include blocked capabilities");
  }
  if (contract.coreProductStatus === "blocked" && blockedCapabilities.length === 0) {
    addIssue(issues, "$.coreProductStatus", "blocked status must name at least one blocked capability");
  }

  return issues;
}

export function validateProductCapabilityReadinessContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: product capability readiness contract must be a JSON object"], capabilitySummaries: [] };
  }

  if (contract.schemaVersion !== PRODUCT_CAPABILITY_READINESS_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${PRODUCT_CAPABILITY_READINESS_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_PRODUCT_POSTURES.has(contract.publicPosture)) {
    addIssue(issues, "$.publicPosture", "must be technical-preview, limited-beta, or general-release");
  }
  if (!ALLOWED_READINESS_STATUSES.has(contract.coreProductStatus)) {
    addIssue(issues, "$.coreProductStatus", "must be code_backed or blocked");
  }
  if (typeof contract.summary !== "string" || contract.summary.trim().length === 0) {
    addIssue(issues, "$.summary", "must describe the current product capability posture");
  }
  if (typeof contract.releaseReadinessRef !== "string" || contract.releaseReadinessRef.trim().length === 0) {
    addIssue(issues, "$.releaseReadinessRef", "must link the separate broad-release readiness contract");
  } else {
    validateHttpsUrlIfPresent(contract.releaseReadinessRef, "$.releaseReadinessRef", issues);
  }

  validateRequiredVerificationCommands(contract.requiredVerificationCommands, issues);
  const capabilitySummaries = validateCapabilities(contract.capabilities, issues);
  issues.push(...consistencyIssues(contract, capabilitySummaries));
  validateNoSecretStrings(contract, issues);

  return { ok: issues.length === 0, issues, capabilitySummaries };
}

export function evaluateProductCapabilityReadiness(contract, options = {}) {
  const validation = validateProductCapabilityReadinessContract(contract);
  const blockers = [];

  if (!validation.ok) {
    blockers.push(...validation.issues);
  }

  const blockedCapabilities = validation.capabilitySummaries
    .filter((capability) => capability.status === "blocked")
    .map((capability) => capability.id);

  if (options.requireCodeBacked) {
    if (contract?.coreProductStatus !== "code_backed") {
      blockers.push("core product capabilities are not code_backed");
    }
    for (const capabilityId of blockedCapabilities) {
      blockers.push(`${capabilityId} capability is still blocked`);
    }
  }

  return {
    ok: blockers.length === 0,
    coreProductStatus: contract?.coreProductStatus ?? "invalid",
    coreProductCodeBacked: validation.ok && contract?.coreProductStatus === "code_backed" && blockedCapabilities.length === 0,
    blockedCapabilities,
    blockers,
    validationIssues: validation.issues
  };
}

export function parseProductCapabilityReadinessArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_PRODUCT_CAPABILITY_READINESS_PATH;
  let requireCodeBacked = false;

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
    if (arg === "--require-code-backed") {
      requireCodeBacked = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { contractPath, requireCodeBacked };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function evidenceForEvaluation(evaluation, options) {
  return {
    status: evaluation.ok ? "passed" : "blocked",
    schemaVersion: PRODUCT_CAPABILITY_READINESS_SCHEMA_VERSION,
    mode: options.requireCodeBacked ? "require-code-backed" : "contract",
    coreProductStatus: evaluation.coreProductStatus,
    coreProductCodeBacked: evaluation.coreProductCodeBacked,
    blockedCapabilities: evaluation.blockedCapabilities,
    blockers: evaluation.blockers,
    checked: [
      "product capability readiness contract schema",
      "required idea, clarification, research, browser/service, planning, auto-implementation, release-guardrail, and local-error-reporting capability ids",
      "required credential-free product verification commands",
      "required capability behavior snippets, including clarification answer-form variety, non-blocking answer submission, mounted research provider polling, research run limit UX, research markdown memory, answer-form variety for research follow-up questions, planning readiness score/axis gates, approved public-read browser targets, final-submit production-mutation contract coverage, opt-in live runtime coverage, generated PR body summary coverage, two-pass review streak gates, missing-test audit coverage, redacted support diagnostics coverage, and ready-release plan-only coverage",
      "secret-free product capability evidence strings",
      options.requireCodeBacked
        ? "all technical-preview core capabilities must be code_backed"
        : "blocked capability posture is allowed only with explicit blocker evidence"
    ]
  };
}

function exitCodeForEvidence(evidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const options = parseProductCapabilityReadinessArgs();
  const contract = readJson(resolve(options.contractPath));
  const evidence = evidenceForEvaluation(evaluateProductCapabilityReadiness(contract, options), options);

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
