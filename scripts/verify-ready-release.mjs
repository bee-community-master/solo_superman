#!/usr/bin/env node
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { redactSupportText } from "./support-bundle.mjs";

export const READY_RELEASE_VERIFICATION_SCHEMA_VERSION = "solo-superman-ready-release-verification.v1";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR = "./solo-superman-release-evidence-bundle";
const MAX_REPORTED_COMMAND_OUTPUT_CHARS = 4_000;
const BASE_READY_RELEASE_STEPS = [
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
  },
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
  return BASE_READY_RELEASE_STEPS.map((step) => {
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
    planOnly: false
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

export function evidenceForReadyReleaseResults(results, options = {}) {
  const blockers = options.planOnly ? [] : results
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
    });
  const commandBlockers = options.planOnly ? [] : uniqueStrings(results.flatMap((result) => {
    if (commandStatus(result) === "passed") {
      return [];
    }
    return extractReadyReleaseCommandBlockers(result).map((blocker) => `${result.id}: ${blocker}`);
  }));

  return {
    status: options.planOnly ? "planned" : blockers.length === 0 ? "passed" : "blocked",
    schemaVersion: READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
    mode: options.planOnly ? "plan-only" : "ready-release-gate",
    failFast: options.failFast === true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    releaseEvidenceBundleDir: options.releaseEvidenceBundleDir ?? DEFAULT_RELEASE_EVIDENCE_BUNDLE_DIR,
    blockers,
    commandBlockers,
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
      "signed package credential preflight gate",
      "signed package release evidence gate",
      "Windows real-device evidence gate",
      "packaged update rollback device evidence gate",
      "release evidence bundle require-ready gate",
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
  const steps = readyReleaseSteps({ releaseEvidenceBundleDir: options.releaseEvidenceBundleDir });
  if (options.planOnly) {
    return evidenceForReadyReleaseResults(steps.map((step) => ({ ...step, exitCode: null, timeoutMs: options.timeoutMs })), options);
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

  return evidenceForReadyReleaseResults(results, options);
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
