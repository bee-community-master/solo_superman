#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const PRODUCTION_MUTATION_CONTRACT_SCHEMA_VERSION = "solo-superman-production-mutation-contract.v1";
export const DEFAULT_PRODUCTION_MUTATION_CONTRACT_PATH = "docs/production-mutation-contract.example.json";

const ALLOWED_CONTRACT_STATUSES = new Set(["defined_final_submit_blocked", "ready_for_final_submit"]);
const ALLOWED_GATE_STATUSES = new Set(["blocked_until_ready_evidence", "ready"]);
const REQUIRED_BLOCKED_ACTION_CLASSES = [
  "credential_entry",
  "secret_storage",
  "unattended_login",
  "payment_submit",
  "legal_submit",
  "medical_submit",
  "financial_submit",
  "privacy_submit",
  "production_deploy",
  "dns_cutover",
  "account_deletion"
];
const REQUIRED_EVIDENCE = new Map([
  [
    "confirmationCard",
    [
      "service_origin",
      "exact_action_summary",
      "redacted_form_diff",
      "irreversible_effect_notice",
      "fresh_user_final_confirmation"
    ]
  ],
  [
    "executionAuthorityRecord",
    ["ready_status", "browser_action_scope", "approved_service_origin_only", "rollback_ref", "no_secret_values"]
  ],
  [
    "redactionAndConsent",
    [
      "redaction_preview_ref",
      "visible_data_categories",
      "forbidden_credential_session_token_values",
      "user_present_login_confirmation"
    ]
  ],
  ["auditAndRollback", ["idempotency_key", "pre_mutation_snapshot_ref", "rollback_plan_ref", "activity_feed_ref", "audit_ref"]]
]);
const REQUIRED_CREDENTIAL_FREE_COMMANDS = [
  "pnpm verify:production-mutation-contract",
  "pnpm verify:service-page-pipeline"
];
const REQUIRED_READY_COMMANDS = [
  "pnpm verify:production-mutation-contract -- --require-ready",
  "pnpm verify:service-page-pipeline"
];
const SECRET_QUERY_NAME_PATTERN = /(?:token|secret|password|pass|api[_-]?key|credential|auth|session|private)/iu;
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

function validateUrl(value, path, issues) {
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

function validateHttpsUrlIfPresent(value, path, issues) {
  if (typeof value !== "string") {
    return;
  }

  if (URL_SCHEME_PATTERN.test(value)) {
    validateUrl(value, path, issues);
    return;
  }

  for (const match of value.matchAll(/https?:\/\/[^\s)]+/giu)) {
    validateUrl(match[0].replace(/[.,;:]+$/u, ""), path, issues);
  }
}

function validateNoSecretStrings(contract, issues) {
  for (const { path, value } of collectStrings(contract)) {
    if (TOKEN_LIKE_PATTERN.test(value)) {
      addIssue(issues, path, "must not contain token-shaped values");
    }
    validateHttpsUrlIfPresent(value, path, issues);
  }
}

function validateStringList(value, path, requiredValues, issues) {
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(issues, path, "must be a non-empty string list");
    return new Set();
  }

  const values = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      addIssue(issues, `${path}[${index}]`, "must be a non-empty string");
      continue;
    }
    values.add(item);
  }

  for (const required of requiredValues) {
    if (!values.has(required)) {
      addIssue(issues, path, `must include ${required}`);
    }
  }

  return values;
}

function validateFinalSubmitGate(gate, issues) {
  if (!isRecord(gate)) {
    addIssue(issues, "$.finalSubmitGate", "must be an object");
    return null;
  }

  if (gate.id !== "service-page-final-submit") {
    addIssue(issues, "$.finalSubmitGate.id", "must be service-page-final-submit");
  }
  if (!ALLOWED_GATE_STATUSES.has(gate.status)) {
    addIssue(issues, "$.finalSubmitGate.status", "must be blocked_until_ready_evidence or ready");
  }
  if (gate.allowedActionClass !== "final_submit_request") {
    addIssue(issues, "$.finalSubmitGate.allowedActionClass", "must be final_submit_request");
  }
  for (const [key, expected] of [
    ["requiresUserPresentLogin", true],
    ["requiresPerActionApproval", true],
    ["requiresSeparateConfirmation", true],
    ["productionMutationPerformed", false]
  ]) {
    if (gate[key] !== expected) {
      addIssue(issues, `$.finalSubmitGate.${key}`, `must be ${expected}`);
    }
  }
  validateStringList(
    gate.blockedActionClasses,
    "$.finalSubmitGate.blockedActionClasses",
    REQUIRED_BLOCKED_ACTION_CLASSES,
    issues
  );

  return { status: gate.status };
}

function validateRequiredEvidence(requiredEvidence, issues) {
  if (!isRecord(requiredEvidence)) {
    addIssue(issues, "$.requiredEvidence", "must be an object");
    return;
  }

  for (const [key, requiredValues] of REQUIRED_EVIDENCE.entries()) {
    validateStringList(requiredEvidence[key], `$.requiredEvidence.${key}`, requiredValues, issues);
  }
}


function validateReadyEvidenceRefs(readyEvidenceRefs, issues) {
  if (!isRecord(readyEvidenceRefs)) {
    addIssue(issues, "$.readyEvidenceRefs", "must be an object when final-submit readiness is marked ready");
    return;
  }

  for (const key of REQUIRED_EVIDENCE.keys()) {
    validateStringList(readyEvidenceRefs[key], `$.readyEvidenceRefs.${key}`, [], issues);
  }
}

function validateRequiredVerificationCommands(commands, issues) {
  if (!isRecord(commands)) {
    addIssue(issues, "$.requiredVerificationCommands", "must be an object");
    return;
  }

  validateStringList(
    commands.credentialFree,
    "$.requiredVerificationCommands.credentialFree",
    REQUIRED_CREDENTIAL_FREE_COMMANDS,
    issues
  );
  validateStringList(commands.ready, "$.requiredVerificationCommands.ready", REQUIRED_READY_COMMANDS, issues);
}

export function validateProductionMutationContract(contract) {
  const issues = [];

  if (!isRecord(contract)) {
    return { ok: false, issues: ["$: contract must be a JSON object"], finalSubmitReady: false };
  }

  if (contract.schemaVersion !== PRODUCTION_MUTATION_CONTRACT_SCHEMA_VERSION) {
    addIssue(issues, "$.schemaVersion", `must be ${PRODUCTION_MUTATION_CONTRACT_SCHEMA_VERSION}`);
  }
  if (contract.appId !== "solo-superman") {
    addIssue(issues, "$.appId", "must be solo-superman");
  }
  if (!ALLOWED_CONTRACT_STATUSES.has(contract.contractStatus)) {
    addIssue(issues, "$.contractStatus", "must be defined_final_submit_blocked or ready_for_final_submit");
  }
  if (contract.productionMutationPerformed !== false) {
    addIssue(issues, "$.productionMutationPerformed", "must remain false in contract verification");
  }
  if (typeof contract.summary !== "string" || contract.summary.trim().length === 0) {
    addIssue(issues, "$.summary", "must describe the final-submit boundary");
  }

  const gate = validateFinalSubmitGate(contract.finalSubmitGate, issues);
  validateRequiredEvidence(contract.requiredEvidence, issues);
  validateRequiredVerificationCommands(contract.requiredVerificationCommands, issues);
  validateStringList(contract.checkedBehaviors, "$.checkedBehaviors", ["Production mutation performed remains false in credential-free verification."], issues);
  validateNoSecretStrings(contract, issues);

  const finalSubmitReady = contract.contractStatus === "ready_for_final_submit" && gate?.status === "ready";
  if (contract.contractStatus === "ready_for_final_submit" && gate?.status !== "ready") {
    addIssue(issues, "$.finalSubmitGate.status", "must be ready when contractStatus is ready_for_final_submit");
  }
  if (contract.contractStatus === "defined_final_submit_blocked" && gate?.status === "ready") {
    addIssue(issues, "$.finalSubmitGate.status", "must stay blocked_until_ready_evidence while contractStatus is defined_final_submit_blocked");
  }
  if (contract.contractStatus === "ready_for_final_submit" || gate?.status === "ready") {
    validateReadyEvidenceRefs(contract.readyEvidenceRefs, issues);
  }

  return { ok: issues.length === 0, issues, finalSubmitReady };
}

export function evaluateProductionMutationContract(contract, options = {}) {
  const validation = validateProductionMutationContract(contract);
  const blockers = [];

  if (!validation.ok) {
    blockers.push(...validation.issues);
  }
  if (options.requireReady && !validation.finalSubmitReady) {
    blockers.push("service-page final-submit production mutation contract is not ready");
  }

  return {
    ok: blockers.length === 0,
    contractValid: validation.ok,
    finalSubmitReady: validation.finalSubmitReady,
    blockers
  };
}

export function evidenceForEvaluation(evaluation, options = {}) {
  return {
    status: evaluation.ok ? "passed" : "blocked",
    schemaVersion: PRODUCTION_MUTATION_CONTRACT_SCHEMA_VERSION,
    mode: options.requireReady ? "require-ready" : "contract",
    contractValid: evaluation.contractValid,
    finalSubmitReady: evaluation.finalSubmitReady,
    blockers: evaluation.blockers,
    checked: [
      "production mutation contract schema",
      "service-page final-submit gate remains separated from fill-draft and preview actions",
      "confirmation card, ExecutionAuthorityRecord, redaction, approval, rollback, and audit evidence requirements",
      "sensitive payment/legal/medical/financial/privacy, DNS, account-deletion, credential, and secret actions stay blocked",
      "secret-free production mutation readiness evidence strings",
      options.requireReady ? "service-page final-submit contract must be ready" : "blocked final-submit posture is allowed only with explicit evidence requirements"
    ]
  };
}

export function parseProductionMutationContractArgs(argv = process.argv.slice(2)) {
  let contractPath = DEFAULT_PRODUCTION_MUTATION_CONTRACT_PATH;
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
    if (arg.startsWith("--contract=")) {
      contractPath = arg.slice("--contract=".length);
      continue;
    }
    if (arg === "--require-ready") {
      requireReady = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true, contractPath, requireReady };
    }

    throw new Error(`Unknown production mutation contract argument: ${arg}`);
  }

  return { contractPath, requireReady };
}

export function runProductionMutationContractCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseProductionMutationContractArgs(argv);
  if (parsed.help) {
    console.log("Usage: pnpm verify:production-mutation-contract [--contract <path>] [--require-ready]");
    return { status: "help" };
  }

  const contract = JSON.parse(readFileSync(resolve(parsed.contractPath), "utf8"));
  const evaluation = evaluateProductionMutationContract(contract, {
    requireReady: parsed.requireReady,
    ...options
  });
  const evidence = evidenceForEvaluation(evaluation, { requireReady: parsed.requireReady });
  console.log(JSON.stringify(evidence, null, 2));

  if (!evaluation.ok) {
    process.exitCode = 1;
  }

  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runProductionMutationContractCli();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
