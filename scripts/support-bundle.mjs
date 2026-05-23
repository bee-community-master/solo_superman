#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

export const SUPPORT_BUNDLE_SCHEMA_VERSION = "solo-superman-support-bundle.v1";

const DEFAULT_TIMEOUT_MS = 3_000;
const OUTPUT_LIMIT = 4_000;
const PACKAGE_METADATA_SCRIPT = [
  "const p=require('./package.json');",
  "const scripts=p.scripts??{};",
  "console.log(JSON.stringify({",
  "name:p.name,version:p.version,packageManager:p.packageManager,engines:p.engines,",
  "scripts:{",
  "startLocal:scripts['start:local'],",
  "verify:scripts.verify,",
  "verifyProdBundle:scripts['verify:prod-bundle'],",
  "verifyReleaseChannel:scripts['verify:release-channel'],",
  "verifyPackagedUpdateRollback:scripts['verify:packaged-update-rollback'],",
  "verifySignedPackagePreflight:scripts['verify:signed-package-preflight'],",
  "verifyReleaseReadiness:scripts['verify:release-readiness'],",
  "supportBundle:scripts['support:bundle']",
  "}}))"
].join("");
const RELEASE_DIAGNOSTIC_COMMANDS = {
  releaseChannel: {
    command: "pnpm verify:release-channel",
    args: ["scripts/verify-release-channel.mjs"]
  },
  packagedUpdateRollback: {
    command: "pnpm verify:packaged-update-rollback",
    args: ["scripts/verify-packaged-update-rollback.mjs"]
  },
  signedPackagePreflight: {
    command: "pnpm verify:signed-package-preflight",
    args: ["scripts/verify-signed-package-preflight.mjs"]
  },
  releaseReadiness: {
    command: "pnpm verify:release-readiness",
    args: ["scripts/verify-release-readiness.mjs"]
  }
};
const SUPPORT_ENV_ALLOWLIST = [
  "CI",
  "SHELL",
  "TERM",
  "TERM_PROGRAM",
  "SOLO_CODEX_WINDOWS_MODE",
  "SOLO_SUPERMAN_CODEX_WSL_DISTRO",
  "SOLO_SUPERMAN_DIR",
  "SOLO_SUPERMAN_REPO_URL",
  "SOLO_SUPERMAN_RUN_SMOKE",
  "SOLO_SUPERMAN_START_LOCAL",
  "SOLO_PNPM_COMMAND",
  "SOLO_PROD_SMOKE_SIDECAR_PORT",
  "SOLO_PROD_SMOKE_WEB_PORT",
  "SOLO_SIDECAR_HOST",
  "SOLO_SIDECAR_PORT",
  "SOLO_WEB_HOST",
  "SOLO_WEB_PORT"
];

const SENSITIVE_NAME_PATTERN = /(?:TOKEN|SECRET|PASSWORD|PASS|API[_-]?KEY|CREDENTIAL|COOKIE|AUTH|SESSION|PRIVATE|SSH|NPM_CONFIG__AUTH|GITHUB_TOKEN|OPENAI_API_KEY)/iu;
const QUERY_SECRET_PATTERN = /([?&][^=\s]*(?:token|secret|password|pass|api[_-]?key|credential|auth|session)[^=\s]*=)[^&\s]*/giu;
const BASIC_AUTH_URL_PATTERN = /\b(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/giu;
const TOKEN_LIKE_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9_-]{20,})\b/gu;

function truncate(value, limit = OUTPUT_LIMIT) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit)}…<truncated>` : text;
}

export function redactSupportText(value) {
  return truncate(value)
    .replace(BASIC_AUTH_URL_PATTERN, "$1<redacted>@")
    .replace(QUERY_SECRET_PATTERN, "$1<redacted>")
    .replace(TOKEN_LIKE_PATTERN, "<redacted>");
}

function homeRelativePath(value, home = homedir()) {
  const text = String(value ?? "");
  return home && text.startsWith(home) ? `~${text.slice(home.length)}` : text;
}

function safeEnvSnapshot(env = process.env) {
  return Object.fromEntries(SUPPORT_ENV_ALLOWLIST
    .filter((name) => env[name] !== undefined)
    .map((name) => [name, SENSITIVE_NAME_PATTERN.test(name) ? "<redacted>" : redactSupportText(env[name])])
  );
}

function commandResult(status, details = {}) {
  return {
    status,
    ...details
  };
}

async function spawnCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return await new Promise((resolveCommand) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const timeout = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      resolveCommand(commandResult("timeout", { stdout: redactSupportText(stdout), stderr: redactSupportText(stderr), timeoutMs }));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeout);
      resolveCommand(commandResult("unavailable", { error: redactSupportText(error.message) }));
    });
    child.once("exit", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeout);
      resolveCommand(commandResult(code === 0 ? "ok" : "failed", {
        code,
        signal,
        stdout: redactSupportText(stdout.trim()),
        stderr: redactSupportText(stderr.trim())
      }));
    });
  });
}

async function runCapture(commandRunner, command, args, options) {
  const result = await commandRunner(command, args, options);
  return {
    ...result,
    stdout: result.stdout === undefined ? undefined : redactSupportText(result.stdout),
    stderr: result.stderr === undefined ? undefined : redactSupportText(result.stderr),
    error: result.error === undefined ? undefined : redactSupportText(result.error)
  };
}

function singleLineStdout(result) {
  return result.status === "ok" ? String(result.stdout ?? "").split(/\r?\n/u)[0] || null : null;
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function compactMissingCredentialGroups(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((group) => ({
    id: typeof group.id === "string" ? group.id : null,
    status: typeof group.status === "string" ? group.status : null,
    missingEnv: stringList(group.missingEnv)
  }));
}

function compactReleaseDiagnostic(name, result) {
  const diagnostic = RELEASE_DIAGNOSTIC_COMMANDS[name];
  const parsed = parseJsonObject(result.stdout);
  const base = {
    command: diagnostic?.command ?? name,
    captureStatus: result.status
  };

  if (!parsed) {
    return {
      ...base,
      evidenceStatus: "unavailable",
      error: result.error ?? result.stderr ?? "diagnostic output was not valid JSON"
    };
  }

  const summary = {
    ...base,
    evidenceStatus: typeof parsed.status === "string" ? parsed.status : "unknown",
    checked: stringList(parsed.checked)
  };

  switch (name) {
    case "releaseChannel":
      return {
        ...summary,
        manifestPath: typeof parsed.manifestPath === "string" ? parsed.manifestPath : null,
        issues: stringList(parsed.issues)
      };
    case "packagedUpdateRollback":
      return {
        ...summary,
        rollbackStatus: typeof parsed.rollbackStatus === "string" ? parsed.rollbackStatus : "unknown",
        packagedUpdateRollbackReady: parsed.packagedUpdateRollbackReady === true,
        blockedDeviceRuns: stringList(parsed.blockedDeviceRuns),
        blockers: stringList(parsed.blockers)
      };
    case "signedPackagePreflight":
      return {
        ...summary,
        contractPath: typeof parsed.contractPath === "string" ? parsed.contractPath : null,
        credentialGateStatus: typeof parsed.credentialGateStatus === "string"
          ? parsed.credentialGateStatus
          : "unknown",
        missingCredentialGroups: compactMissingCredentialGroups(parsed.missingCredentialGroups),
        issues: stringList(parsed.issues)
      };
    case "releaseReadiness":
      return {
        ...summary,
        schemaVersion: typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : null,
        mode: typeof parsed.mode === "string" ? parsed.mode : null,
        readinessStatus: typeof parsed.readinessStatus === "string" ? parsed.readinessStatus : "unknown",
        broadReleaseReady: parsed.broadReleaseReady === true,
        blockedGates: stringList(parsed.blockedGates),
        blockers: stringList(parsed.blockers)
      };
    default:
      return {
        ...summary,
        evidenceStatus: "unknown-diagnostic"
      };
  }
}

async function readReleaseDiagnostics(commandRunner, options) {
  const entries = Object.entries(RELEASE_DIAGNOSTIC_COMMANDS);
  const diagnostics = await Promise.all(entries.map(async ([name, diagnostic]) => {
    const result = await runCapture(commandRunner, process.execPath, diagnostic.args, options);
    return [name, compactReleaseDiagnostic(name, result)];
  }));

  return Object.fromEntries(diagnostics);
}

async function readPackageMetadata(commandRunner, options) {
  const packageResult = await runCapture(commandRunner, process.execPath, ["-e", PACKAGE_METADATA_SCRIPT], options);
  return parseJsonObject(packageResult.stdout) ?? {
    error: packageResult.status === "ok"
      ? "package metadata output was not valid JSON"
      : packageResult.error ?? packageResult.stderr ?? "package metadata unavailable"
  };
}

export async function createSupportBundle(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const commandRunner = options.commandRunner ?? spawnCommand;
  const commandOptions = { cwd, env, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS };
  const [
    gitBranch,
    gitHead,
    gitStatus,
    gitRemote,
    pnpmVersion,
    codexVersion,
    packageMetadata,
    releaseDiagnostics
  ] = await Promise.all([
    runCapture(commandRunner, "git", ["branch", "--show-current"], commandOptions),
    runCapture(commandRunner, "git", ["rev-parse", "--short", "HEAD"], commandOptions),
    runCapture(commandRunner, "git", ["status", "--short", "--branch"], commandOptions),
    runCapture(commandRunner, "git", ["remote", "get-url", "origin"], commandOptions),
    runCapture(commandRunner, "pnpm", ["--version"], commandOptions),
    runCapture(commandRunner, "codex", ["--version"], commandOptions),
    readPackageMetadata(commandRunner, commandOptions),
    readReleaseDiagnostics(commandRunner, commandOptions)
  ]);

  return {
    schemaVersion: SUPPORT_BUNDLE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    privacy: {
      credentialFree: true,
      secretPolicy: "Only allowlisted environment names are captured; token/secret/password/API-key shaped names and values are redacted.",
      excluded: ["full environment dump", "file contents", "browser cookies", "OpenAI or GitHub tokens", "ChatGPT web credentials"]
    },
    runtime: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      versions: process.versions
    },
    repo: {
      cwd: homeRelativePath(cwd, options.homeDir),
      branch: singleLineStdout(gitBranch),
      head: singleLineStdout(gitHead),
      remoteOrigin: singleLineStdout(gitRemote),
      statusShort: gitStatus.status === "ok" ? redactSupportText(gitStatus.stdout).split(/\r?\n/u).filter(Boolean) : [],
      gitAvailable: gitHead.status === "ok"
    },
    tools: {
      pnpm: {
        status: pnpmVersion.status,
        version: singleLineStdout(pnpmVersion),
        error: pnpmVersion.error ?? pnpmVersion.stderr
      },
      codex: {
        status: codexVersion.status,
        version: singleLineStdout(codexVersion),
        error: codexVersion.error ?? codexVersion.stderr
      }
    },
    package: packageMetadata,
    releaseDiagnostics,
    env: safeEnvSnapshot(env),
    recommendedChecks: [
      "pnpm verify:prod-bundle",
      "pnpm verify:release-channel",
      "pnpm verify:packaged-update-rollback",
      "pnpm verify:signed-package-preflight",
      "pnpm verify:release-readiness",
      "pnpm verify",
      "pnpm support:bundle"
    ],
    nextStep: "Attach this JSON bundle to a Solo Superman error report; do not add secrets, cookies, or credentials."
  };
}

function defaultOutputPath(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/gu, "-");
  return resolve(tmpdir(), `solo-superman-support-bundle-${stamp}.json`);
}

export function parseSupportBundleArgs(argv = process.argv.slice(2), env = process.env) {
  let outputPath = env.SOLO_SUPPORT_BUNDLE_PATH;

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
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown support bundle argument: ${arg}`);
    }
  }

  return { outputPath: outputPath ? resolve(outputPath) : defaultOutputPath() };
}

export async function writeSupportBundle(outputPath, bundle) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

export async function runSupportBundleCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseSupportBundleArgs(argv, options.env ?? process.env);
  if (parsed.help) {
    console.log("Usage: pnpm support:bundle [--output <path>]");
    return { status: "help" };
  }

  const bundle = await createSupportBundle(options);
  await writeSupportBundle(parsed.outputPath, bundle);
  const envelope = {
    status: "passed",
    bundlePath: parsed.outputPath,
    schemaVersion: bundle.schemaVersion,
    checked: [
      "collected credential-free runtime and repository diagnostics",
      "captured only allowlisted environment values",
      "redacted token/secret-shaped values",
      "captured credential-free release diagnostics",
      "wrote JSON support bundle"
    ]
  };
  console.log(JSON.stringify(envelope, null, 2));
  return envelope;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSupportBundleCli().catch((error) => {
    console.error(`support-bundle failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
