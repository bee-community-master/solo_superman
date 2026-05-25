#!/usr/bin/env node
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildReleaseEvidenceChecklist,
  buildReleaseEvidenceTemplate,
  filterReleaseEvidenceChecklistByIssue,
  loadReleaseEvidenceContracts
} from "./release-evidence-checklist.mjs";
import { redactSupportText } from "./support-bundle.mjs";

export const READY_RELEASE_VERIFICATION_SCHEMA_VERSION = "solo-superman-ready-release-verification.v1";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR = "./solo-superman-release-evidence-bundle";
const MAX_REPORTED_COMMAND_OUTPUT_CHARS = 4_000;
const RELEASE_EVIDENCE_BUNDLE_PREPARATION_ID = "release-evidence-bundle-preparation";
const OPTIONAL_SIGNED_PACKAGE_READY_RELEASE_STEPS = [
  {
    id: "signed-package-preflight-credentials",
    command: "pnpm",
    args: ["verify:signed-package-preflight", "--", "--require-credentials"],
    display: "pnpm verify:signed-package-preflight -- --require-credentials"
  },
  {
    id: "signed-package-release-evidence",
    command: "pnpm",
    args: ["verify:signed-package-release", "--", "--require-release-evidence"],
    display: "pnpm verify:signed-package-release -- --require-release-evidence"
  }
];
const BASE_READY_RELEASE_STEPS = [
  {
    id: "windows-real-device-evidence",
    command: "pnpm",
    args: ["verify:windows-real-device", "--", "--require-device-evidence"],
    display: "pnpm verify:windows-real-device -- --require-device-evidence"
  },
  {
    id: "packaged-update-rollback-device-evidence",
    command: "pnpm",
    args: ["verify:packaged-update-rollback", "--", "--require-device-evidence"],
    display: "pnpm verify:packaged-update-rollback -- --require-device-evidence"
  },
  {
    id: "release-evidence-bundle-ready",
    command: "pnpm",
    args: ["verify:release-evidence-bundle", "--", "--bundle-dir", DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR, "--require-ready"],
    display: `pnpm verify:release-evidence-bundle -- --bundle-dir ${DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR} --require-ready`
  },
  {
    id: "release-readiness-ready",
    command: "pnpm",
    args: ["verify:release-readiness", "--", "--require-ready"],
    display: "pnpm verify:release-readiness -- --require-ready"
  }
];

function redactedOutput(value) {
  return redactSupportText(value ?? "");
}

function reportedCommandOutput(value) {
  const redacted = redactedOutput(value);
  if (redacted.length <= MAX_REPORTED_COMMAND_OUTPUT_CHARS) {
    return redacted;
  }

  const omittedCharCount = redacted.length - MAX_REPORTED_COMMAND_OUTPUT_CHARS;
  return `${redacted.slice(0, MAX_REPORTED_COMMAND_OUTPUT_CHARS)}\n...<${omittedCharCount} redacted chars omitted; rerun the nested verifier command for full output>`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

const TEMPLATE_FIELD_BLOCKER_PATTERN = /^file:([^:]+): (\$\..+)$/;

function summarizeTemplateFieldBlockers(blockers) {
  const summarized = [];
  const omittedFieldCounts = new Map();

  for (const blocker of blockers) {
    const templateFieldMatch = blocker.match(TEMPLATE_FIELD_BLOCKER_PATTERN);
    if (templateFieldMatch) {
      const templateFile = templateFieldMatch[1];
      omittedFieldCounts.set(templateFile, (omittedFieldCounts.get(templateFile) ?? 0) + 1);
      continue;
    }

    summarized.push(blocker);
  }

  for (const [templateFile, count] of omittedFieldCounts) {
    summarized.push(
      `file:${templateFile}: ${count} template field blocker(s) omitted; fill release evidence placeholders and inspect command stdout for exact fields.`
    );
  }

  return summarized;
}

function parseJsonObjectFromOutput(value) {
  const text = value ?? "";
  const start = text.indexOf("{");
  if (start < 0) {
    return null;
  }

  for (let end = text.lastIndexOf("}"); end > start; end = text.lastIndexOf("}", end - 1)) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (isRecord(parsed)) {
        return parsed;
      }
    } catch {
      // pnpm may append lifecycle text after the JSON payload; retry with an earlier closing brace.
    }
  }

  return null;
}

export function extractReadyReleaseCommandBlockers(result) {
  const parsed = parseJsonObjectFromOutput(result?.stdout);
  if (!parsed) {
    return [];
  }

  return summarizeTemplateFieldBlockers(uniqueStrings([
    ...stringList(parsed.blockers),
    ...stringList(parsed.issues)
  ].map(redactedOutput)));
}

export function readyReleaseSteps(options = {}) {
  const releaseEvidenceBundleDir = options.releaseEvidenceBundleDir ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR;
  const steps = [
    ...(options.includeSignedPackage ? OPTIONAL_SIGNED_PACKAGE_READY_RELEASE_STEPS : []),
    ...BASE_READY_RELEASE_STEPS
  ];
  return steps.map((step) => {
    if (step.id !== "release-evidence-bundle-ready") {
      return { ...step, args: [...step.args] };
    }
    return {
      ...step,
      args: ["verify:release-evidence-bundle", "--", "--bundle-dir", releaseEvidenceBundleDir, "--require-ready"],
      display: `pnpm verify:release-evidence-bundle -- --bundle-dir ${releaseEvidenceBundleDir} --require-ready`
    };
  });
}

export function parseReadyReleaseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    timeoutMs: Number(env.SOLO_READY_RELEASE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    releaseEvidenceBundleDir: env.SOLO_RELEASE_EVIDENCE_BUNDLE_DIR ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR,
    failFast: false,
    planOnly: false,
    includeSignedPackage: env.SOLO_READY_RELEASE_INCLUDE_SIGNED_PACKAGE === "1"
  };

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("SOLO_READY_RELEASE_TIMEOUT_MS must be a positive integer when set");
  }
  if (typeof options.releaseEvidenceBundleDir !== "string" || options.releaseEvidenceBundleDir.trim().length === 0) {
    throw new Error("SOLO_RELEASE_EVIDENCE_BUNDLE_DIR must be a non-empty path when set");
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--fail-fast") {
      options.failFast = true;
      continue;
    }
    if (arg === "--plan-only") {
      options.planOnly = true;
      continue;
    }
    if (arg === "--include-signed-package") {
      options.includeSignedPackage = true;
      continue;
    }
    if (arg === "--evidence-bundle-dir") {
      const next = argv[index + 1];
      if (!next || next.trim().length === 0) {
        throw new Error("--evidence-bundle-dir requires a path value");
      }
      options.releaseEvidenceBundleDir = next;
      index += 1;
      continue;
    }
    if (arg.startsWith("--evidence-bundle-dir=")) {
      const next = arg.slice("--evidence-bundle-dir=".length);
      if (!next || next.trim().length === 0) {
        throw new Error("--evidence-bundle-dir requires a path value");
      }
      options.releaseEvidenceBundleDir = next;
      continue;
    }
    if (arg === "--timeout-ms") {
      const next = argv[index + 1];
      if (!next || !Number.isInteger(Number(next)) || Number(next) <= 0) {
        throw new Error("--timeout-ms requires a positive integer value");
      }
      options.timeoutMs = Number(next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown ready-release verification argument: ${arg}`);
  }

  return options;
}

function commandStatus(result) {
  if (result.timedOut) {
    return "timeout";
  }
  if (result.error) {
    return "error";
  }
  return result.exitCode === 0 ? "passed" : "blocked";
}

function releaseEvidenceBundlePreparation(options = {}) {
  const bundleDir = options.releaseEvidenceBundleDir ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR;
  const command = `pnpm release:evidence-bundle -- ${bundleDir}`;
  const status = options.planOnly
    ? "planned"
    : options.releaseEvidenceBundleDirStatus ?? "unchecked";

  return {
    id: RELEASE_EVIDENCE_BUNDLE_PREPARATION_ID,
    status,
    command,
    bundleDir,
    requiredBefore: `pnpm verify:release-evidence-bundle -- --bundle-dir ${bundleDir} --require-ready`,
    checked: [
      "release evidence bundle directory exists before final ready-release",
      "operator-visible command for preparing a fresh release evidence bundle is present",
      "prepared bundle must still be filled with real redacted evidence before require-ready verification"
    ]
  };
}

function releaseEvidenceBundlePreparationBlockers(preparation) {
  if (preparation.status === "missing") {
    return [
      `${preparation.id}: ${preparation.bundleDir} is missing; run ${preparation.command} before filling real evidence and running final ready-release.`
    ];
  }
  if (preparation.status === "not_directory") {
    return [
      `${preparation.id}: ${preparation.bundleDir} exists but is not a directory; choose a clean bundle directory or move the file before running final ready-release.`
    ];
  }
  return [];
}

function issueNumbersForReleaseEvidenceChecklist(checklist) {
  const issueNumbers = checklist.summary?.blockerIssueNumbers?.length
    ? checklist.summary.blockerIssueNumbers
    : (checklist.checklistItems ?? [])
      .map((item) => item.blockerIssueNumber)
      .filter((issueNumber) => issueNumber !== null && issueNumber !== undefined);

  return uniqueStrings(issueNumbers.map(String))
    .map(Number)
    .filter((issueNumber) => Number.isInteger(issueNumber) && issueNumber > 0)
    .sort((left, right) => left - right);
}

function evidenceBundleShapeSummary(templateItem) {
  const shape = templateItem?.evidenceBundleShape;

  if (!isRecord(shape)) {
    return null;
  }

  return {
    kind: typeof shape.kind === "string" ? shape.kind : "unknown-evidence-bundle",
    requiredFields: stringList(shape.requiredFields),
    requiredFieldCount: stringList(shape.requiredFields).length,
    requiredPassedChecks: stringList(shape.requiredPassedChecks),
    requiredArtifactScopes: stringList(shape.requiredArtifactScopes),
    requiredProtectedPathEvidenceRefs: stringList(shape.requiredProtectedPathEvidenceRefs)
  };
}

function releaseEvidenceChecklistItemSummary(item, templateItem) {
  const evidenceBundleShape = evidenceBundleShapeSummary(templateItem);

  return {
    itemId: typeof item.itemId === "string" ? item.itemId : "unknown-release-evidence-item",
    gateId: typeof item.gateId === "string" ? item.gateId : "unknown-release-gate",
    status: typeof item.status === "string" ? item.status : "unknown",
    scope: typeof item.scope === "string" ? item.scope : null,
    requiredChecks: stringList(item.requiredChecks),
    requiredEvidence: stringList(item.requiredEvidence),
    unblockCriteria: stringList(item.unblockCriteria),
    ...(evidenceBundleShape ? { evidenceBundleShape } : {})
  };
}

export function releaseEvidenceIssuePreparation(checklist, options = {}) {
  const bundleDir = options.releaseEvidenceBundleDir ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR;

  return issueNumbersForReleaseEvidenceChecklist(checklist).map((issueNumber) => {
    const issueChecklist = filterReleaseEvidenceChecklistByIssue(checklist, issueNumber);
    const templateItems = new Map(
      buildReleaseEvidenceTemplate(issueChecklist).items.map((item) => [item.itemId, item])
    );
    const issuePrefix = `issue-${issueNumber}`;

    return {
      issueNumber,
      issueUrl: issueChecklist.openBlockerIssues[0] ?? null,
      status: issueChecklist.status,
      itemCount: issueChecklist.summary.totalItems,
      blockedItems: issueChecklist.summary.blockedItems,
      checklistItems: issueChecklist.checklistItems.map((item) =>
        releaseEvidenceChecklistItemSummary(item, templateItems.get(item.itemId))
      ),
      checklistPath: `${bundleDir}/${issuePrefix}-checklist.md`,
      templatePath: `${bundleDir}/${issuePrefix}-template.json`,
      commentPath: `${bundleDir}/${issuePrefix}-comment.md`,
      fillTemplateAction: `Fill ${bundleDir}/${issuePrefix}-template.json with redacted release lab evidence only.`,
      validateTemplateCommand: `pnpm verify:release-evidence-template -- --input ${bundleDir}/${issuePrefix}-template.json --issue ${issueNumber}`,
      postIssueCommentCommand: `gh issue comment ${issueNumber} --body-file ${bundleDir}/${issuePrefix}-comment.md`,
      checked: [
        "issue-specific checklist, template, and comment paths are generated by the release evidence bundle",
        "issue-specific checklist item summaries identify the exact evidence items to fill",
        "template validation must pass before posting the GitHub issue comment",
        "comment posting remains a release-lab action and is not performed by plan-only verification"
      ]
    };
  });
}

export function releaseEvidenceBlockerSummary(issuePreparation = []) {
  const entries = Array.isArray(issuePreparation) ? issuePreparation.filter(isRecord) : [];
  const issueNumbers = entries
    .map((entry) => entry.issueNumber)
    .filter((issueNumber) => Number.isInteger(issueNumber) && issueNumber > 0)
    .sort((left, right) => left - right);
  const blockedIssueNumbers = entries
    .filter((entry) => entry.status !== "ready" || Number(entry.blockedItems ?? 0) > 0)
    .map((entry) => entry.issueNumber)
    .filter((issueNumber) => Number.isInteger(issueNumber) && issueNumber > 0)
    .sort((left, right) => left - right);
  const totalItemCount = entries.reduce((total, entry) => total + (Number.isInteger(entry.itemCount) ? entry.itemCount : 0), 0);
  const blockedItemCount = entries.reduce((total, entry) => total + (Number.isInteger(entry.blockedItems) ? entry.blockedItems : 0), 0);

  return {
    status: entries.length === 0 ? "unknown" : blockedIssueNumbers.length > 0 || blockedItemCount > 0 ? "blocked" : "ready",
    issueNumbers,
    blockedIssueNumbers,
    issueCount: issueNumbers.length,
    blockedIssueCount: blockedIssueNumbers.length,
    totalItemCount,
    blockedItemCount,
    nextAction: blockedIssueNumbers.length > 0
      ? "Prepare the release evidence bundle, fill each blocked issue template with redacted release-lab evidence, validate templates, then run ready-release with the filled bundle."
      : "Run the ready-release gate with the filled release evidence bundle."
  };
}

async function releaseEvidenceIssuePreparationForOptions(options = {}) {
  if (Array.isArray(options.releaseEvidenceIssuePreparation)) {
    return options.releaseEvidenceIssuePreparation;
  }

  const contracts = options.contracts ?? await loadReleaseEvidenceContracts(options.contractPaths, options);
  const checklist = options.releaseEvidenceChecklist ?? buildReleaseEvidenceChecklist(contracts, options);

  return releaseEvidenceIssuePreparation(checklist, options);
}

async function releaseEvidenceBundleDirStatus(bundleDir, options = {}) {
  try {
    const entry = await stat(resolve(options.cwd ?? process.cwd(), bundleDir));
    return entry.isDirectory() ? "present" : "not_directory";
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
}

export function evidenceForReadyReleaseResults(results, options = {}) {
  const preparation = releaseEvidenceBundlePreparation(options);
  const preparationBlockers = options.planOnly ? [] : releaseEvidenceBundlePreparationBlockers(preparation);
  const issuePreparation = options.releaseEvidenceIssuePreparation ?? [];
  const blockers = options.planOnly ? [] : [
    ...preparationBlockers,
    ...results
      .filter((result) => commandStatus(result) !== "passed")
      .map((result) => {
        const status = commandStatus(result);
        if (status === "timeout") {
          return `${result.display} timed out after ${result.timeoutMs}ms`;
        }
        if (status === "error") {
          return `${result.display} failed to start: ${result.error}`;
        }
        return `${result.display} exited with code ${result.exitCode}`;
      })
  ];
  const commandBlockers = options.planOnly ? [] : uniqueStrings([
    ...preparationBlockers,
    ...results.flatMap((result) => {
      if (commandStatus(result) === "passed") {
        return [];
      }
      return extractReadyReleaseCommandBlockers(result).map((blocker) => `${result.id}: ${blocker}`);
    })
  ]);

  return {
    status: options.planOnly ? "planned" : blockers.length === 0 ? "passed" : "blocked",
    schemaVersion: READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
    mode: options.planOnly ? "plan-only" : "ready-release-gate",
    failFast: options.failFast === true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    releaseEvidenceBundleDir: options.releaseEvidenceBundleDir ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR,
    releaseEvidenceBundlePreparation: preparation,
    releaseEvidenceBlockerSummary: releaseEvidenceBlockerSummary(issuePreparation),
    blockers,
    commandBlockers,
    releaseEvidenceIssuePreparation: issuePreparation,
    commands: results.map((result) => ({
      id: result.id,
      command: result.display,
      status: options.planOnly ? "planned" : commandStatus(result),
      exitCode: result.exitCode ?? null,
      timedOut: result.timedOut === true,
      blockers: options.planOnly || commandStatus(result) === "passed" ? [] : extractReadyReleaseCommandBlockers(result),
      stdout: reportedCommandOutput(result.stdout),
      stderr: reportedCommandOutput(result.stderr)
    })),
    checked: [
      "ready-release credential-required command sequence",
      options.includeSignedPackage
        ? "signed package credential preflight and release evidence gates included by explicit opt-in"
        : "signed package credential gates skipped by default because non-store/direct distribution does not require signing",
      "Windows real-device evidence gate",
      "packaged update rollback device evidence gate",
      "release evidence bundle require-ready gate",
      "release evidence bundle preparation prerequisite is surfaced before require-ready verification",
      "plan-only release evidence blocker summary reports blocker issue and blocked item counts before release-lab handoff",
      "issue-specific release evidence item summaries, templates, comments, and validation commands are surfaced before release-lab handoff",
      "release readiness require-ready gate",
      "nested verifier blockers and issues are surfaced per command",
      "verbose release-template field blockers are summarized while redacted stdout keeps a bounded diagnostic preview",
      "ready-release command output is redacted and bounded before reporting"
    ]
  };
}

function runCommand(step, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      resolve({ ...step, exitCode: null, timedOut: true, timeoutMs, stdout, stderr });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timer);
      resolve({ ...step, exitCode: null, error: error.message, timeoutMs, stdout, stderr });
    });
    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timer);
      resolve({ ...step, exitCode, timeoutMs, stdout, stderr });
    });
  });
}

export async function runReadyReleaseVerification(options = {}) {
  const steps = readyReleaseSteps({
    releaseEvidenceBundleDir: options.releaseEvidenceBundleDir,
    includeSignedPackage: options.includeSignedPackage
  });
  const releaseEvidenceBundleDirStatusValue = options.planOnly
    ? undefined
    : options.releaseEvidenceBundleDirStatus ?? (await releaseEvidenceBundleDirStatus(
      options.releaseEvidenceBundleDir ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR,
      options
    ));
  const evidenceOptions = {
    ...options,
    releaseEvidenceBundleDirStatus: releaseEvidenceBundleDirStatusValue,
    releaseEvidenceIssuePreparation: await releaseEvidenceIssuePreparationForOptions(options)
  };
  if (options.planOnly) {
    return evidenceForReadyReleaseResults(
      steps.map((step) => ({ ...step, exitCode: null, timeoutMs: options.timeoutMs })),
      evidenceOptions
    );
  }

  const results = [];
  const runner = options.runner ?? runCommand;
  for (const step of steps) {
    const result = await runner(step, options);
    results.push({ ...step, ...result, timeoutMs: result.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS });
    if (options.failFast && commandStatus(results.at(-1)) !== "passed") {
      break;
    }
  }

  return evidenceForReadyReleaseResults(results, evidenceOptions);
}

async function main() {
  const options = parseReadyReleaseArgs();
  const evidence = await runReadyReleaseVerification(options);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" || evidence.status === "planned" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
