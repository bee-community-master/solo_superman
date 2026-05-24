#!/usr/bin/env node
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { redactSupportText } from "./support-bundle.mjs";

export const READY_RELEASE_VERIFICATION_SCHEMA_VERSION = "solo-superman-ready-release-verification.v1";

const DEFAULT_TIMEOUT_MS = 60_000;
const READY_RELEASE_STEPS = [
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
    id: "release-readiness-ready",
    command: "pnpm",
    args: ["verify:release-readiness", "--", "--require-ready"],
    display: "pnpm verify:release-readiness -- --require-ready"
  }
];

function redactedOutput(value) {
  return redactSupportText(value ?? "");
}

export function readyReleaseSteps() {
  return READY_RELEASE_STEPS.map((step) => ({ ...step, args: [...step.args] }));
}

export function parseReadyReleaseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    timeoutMs: Number(env.SOLO_READY_RELEASE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    failFast: false,
    planOnly: false
  };

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("SOLO_READY_RELEASE_TIMEOUT_MS must be a positive integer when set");
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

  return {
    status: options.planOnly ? "planned" : blockers.length === 0 ? "passed" : "blocked",
    schemaVersion: READY_RELEASE_VERIFICATION_SCHEMA_VERSION,
    mode: options.planOnly ? "plan-only" : "ready-release-gate",
    failFast: options.failFast === true,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    blockers,
    commands: results.map((result) => ({
      id: result.id,
      command: result.display,
      status: options.planOnly ? "planned" : commandStatus(result),
      exitCode: result.exitCode ?? null,
      timedOut: result.timedOut === true,
      stdout: redactedOutput(result.stdout),
      stderr: redactedOutput(result.stderr)
    })),
    checked: [
      "ready-release credential-required command sequence",
      "signed package credential preflight gate",
      "signed package release evidence gate",
      "Windows real-device evidence gate",
      "packaged update rollback device evidence gate",
      "release readiness require-ready gate",
      "ready-release command output is redacted before reporting"
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
  const steps = readyReleaseSteps();
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
