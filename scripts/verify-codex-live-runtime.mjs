import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { envValue, fixedLocalPortEnv, positiveIntegerEnv } from "./local-env.mjs";
import { waitForFetch } from "./local-http.mjs";
import { bindHostEnv, defaultLocalBindHost, loopbackHostEnv, packageManagerSpawn } from "./local-platform.mjs";
import { commandLabel, spawnManagedProcess } from "./local-processes.mjs";
import { assertSmokePortsAvailable, cleanupManagedSmoke, createDiagnosticLogger, diagnosticEnvSnapshot, redactConfigSecrets } from "./local-smoke.mjs";
import { formatHttpOrigin } from "./local-url.mjs";

export const LIVE_RUNTIME_VERIFY_ENV = "SOLO_VERIFY_CODEX_LIVE_RUNTIME";
export const LIVE_TURNS_ENV = "SOLO_CODEX_APP_SERVER_LIVE_TURNS";
export const LIVE_RUNTIME_STATUS_PATH = "/api/v1/runtime/status";

const DEFAULT_SIDECAR_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = "43116";
const DEFAULT_TIMEOUT_MS = 30_000;
const SKIPPED_REASON = `Set ${LIVE_RUNTIME_VERIFY_ENV}=1 and ${LIVE_TURNS_ENV}=1 to run the local live Codex runtime readiness smoke.`;
const DIAGNOSTIC_ENV_NAMES = [
  "CI",
  "SOLO_PNPM_COMMAND",
  "npm_execpath",
  "npm_config_user_agent",
  "SOLO_CODEX_WINDOWS_MODE",
  "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_HOST",
  "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_BIND_HOST",
  "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_PORT",
  "SOLO_CODEX_LIVE_RUNTIME_SMOKE_TIMEOUT_MS",
  LIVE_RUNTIME_VERIFY_ENV,
  LIVE_TURNS_ENV,
  "WSL_DISTRO_NAME",
  "WSL_INTEROP",
  "WSLENV"
];

function generatedToken() {
  return randomBytes(32).toString("hex");
}

function envFlagEnabled(env, name) {
  return env[name] === "1";
}

export function liveRuntimeVerificationRequested(env = process.env) {
  return envFlagEnabled(env, LIVE_RUNTIME_VERIFY_ENV);
}

export function skippedCodexLiveRuntimeEvidence() {
  return {
    status: "skipped",
    smoke: "codex_live_runtime_readiness",
    reason: SKIPPED_REASON,
    checked: [
      `${LIVE_RUNTIME_VERIFY_ENV} was not set to 1`,
      "no Codex account probe was started",
      "no local sidecar process was started"
    ]
  };
}

export function liveRuntimeVerificationGateEvidence(env = process.env) {
  if (!liveRuntimeVerificationRequested(env)) {
    return skippedCodexLiveRuntimeEvidence();
  }

  if (!envFlagEnabled(env, LIVE_TURNS_ENV)) {
    return {
      status: "blocked",
      smoke: "codex_live_runtime_readiness",
      reason: `Live Codex runtime verification was requested, but ${LIVE_TURNS_ENV}=1 is missing.`,
      checked: [
        `${LIVE_RUNTIME_VERIFY_ENV}=1 was set`,
        `${LIVE_TURNS_ENV} was not set to 1`,
        "no Codex account probe was started",
        "no local sidecar process was started"
      ],
      blockers: [
        `${LIVE_TURNS_ENV}=1 is required before live runtime readiness can be verified`
      ]
    };
  }

  return {
    status: "ready",
    smoke: "codex_live_runtime_readiness",
    checked: [
      `${LIVE_RUNTIME_VERIFY_ENV}=1 was set`,
      `${LIVE_TURNS_ENV}=1 was set`
    ],
    blockers: []
  };
}

export function assertLiveRuntimeVerificationGate(env = process.env) {
  const evidence = liveRuntimeVerificationGateEvidence(env);

  if (evidence.status === "blocked") {
    throw new Error(`${evidence.reason} ${SKIPPED_REASON}`);
  }
}

export function codexLiveRuntimeSmokeLogPath(env = process.env) {
  return envValue(
    env,
    "SOLO_CODEX_LIVE_RUNTIME_SMOKE_LOG_PATH",
    join(tmpdir(), `solo-superman-codex-live-runtime-${process.pid}.log`)
  );
}

export function codexLiveRuntimeSmokeConfig(env = process.env, platform = process.platform, options = {}) {
  const defaultBindHost = defaultLocalBindHost(env, platform);
  const sidecarHost = loopbackHostEnv(env, "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_HOST", DEFAULT_SIDECAR_HOST);
  const sidecarBindHost = bindHostEnv(
    env,
    "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_BIND_HOST",
    defaultBindHost === "0.0.0.0" ? defaultBindHost : sidecarHost,
    platform
  );
  const sidecarPort = fixedLocalPortEnv(env, "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_PORT", DEFAULT_SIDECAR_PORT);
  const localCapabilityToken = options.localCapabilityToken ?? generatedToken();
  const sidecarBaseUrl = formatHttpOrigin(sidecarHost, sidecarPort);

  return {
    localCapabilityToken,
    sidecarHost,
    sidecarBindHost,
    sidecarPort,
    sidecarBaseUrl,
    timeoutMs: positiveIntegerEnv(
      env,
      "SOLO_CODEX_LIVE_RUNTIME_SMOKE_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      "positive integer number of milliseconds"
    )
  };
}

export function codexLiveRuntimeSmokeEnvironment(config, appDataDir, env = process.env) {
  return {
    ...env,
    CI: "true",
    SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    SOLO_SIDECAR_HOST: config.sidecarBindHost,
    SOLO_SIDECAR_PORT: config.sidecarPort,
    SOLO_APP_DATA_DIR: appDataDir
  };
}

export function codexLiveRuntimeSmokeCommands(platform = process.platform, env = process.env) {
  return {
    sidecar: packageManagerSpawn(["--filter", "@solo-superman/sidecar", "start"], env, platform)
  };
}

export async function assertCodexLiveRuntimeSmokePortAvailable(config, options = {}) {
  await assertSmokePortsAvailable([
    {
      label: "sidecar",
      host: config.sidecarBindHost,
      port: config.sidecarPort,
      publicUrl: config.sidecarBaseUrl,
      overrideName: "SOLO_CODEX_LIVE_RUNTIME_SMOKE_SIDECAR_PORT"
    }
  ], "verify-codex-live-runtime", options);
}

function runtimeStatusFromEnvelope(envelope) {
  return envelope && typeof envelope === "object" && envelope.ok === true && envelope.data && typeof envelope.data === "object"
    ? envelope.data
    : null;
}

function liveRuntimeStatusBlockers(status) {
  const blockers = [];

  if (!status) {
    blockers.push("runtime status response must be an ok=true envelope with data");
    return blockers;
  }

  if (status.status !== "available") {
    blockers.push(`runtime status must be available; received ${JSON.stringify(status.status)}`);
  }

  if (status.executionMode !== "live") {
    blockers.push(`executionMode must be live; received ${JSON.stringify(status.executionMode)}`);
  }

  if (status.liveTurnExecutionEnabled !== true) {
    blockers.push("liveTurnExecutionEnabled must be true");
  }

  if (!status.account || status.account.status !== "authenticated") {
    blockers.push(`account.status must be authenticated; received ${JSON.stringify(status.account?.status ?? null)}`);
  }

  return blockers;
}

function publicRuntimeStatus(status) {
  if (!status) {
    return null;
  }

  return {
    status: status.status,
    executionMode: status.executionMode,
    liveTurnExecutionEnabled: status.liveTurnExecutionEnabled,
    manualHandoffAvailable: status.manualHandoffAvailable,
    checkedAt: status.checkedAt,
    adapterVersion: status.adapterVersion,
    generatedSchemaVersion: status.generatedSchemaVersion,
    transport: status.transport,
    accountStatus: status.account?.status ?? null,
    accountType: status.account?.accountType ?? null,
    hasAccountEmail: Boolean(status.account?.email),
    reason: status.reason ?? status.account?.reason ?? null
  };
}

export function evaluateCodexLiveRuntimeStatus(envelope) {
  const status = runtimeStatusFromEnvelope(envelope);
  const blockers = liveRuntimeStatusBlockers(status);

  return {
    status: blockers.length === 0 ? "passed" : "blocked",
    smoke: "codex_live_runtime_readiness",
    runtime: publicRuntimeStatus(status),
    checked: [
      "authenticated local API responded",
      "runtime status is available",
      "execution mode is live",
      "live-turn flag is enabled",
      "Codex account is authenticated"
    ],
    blockers
  };
}

async function fetchCodexLiveRuntimeStatus(config, processes, diagnostics) {
  diagnostics.step(`fetch wait: ${config.sidecarBaseUrl}${LIVE_RUNTIME_STATUS_PATH} expected=200 auth=local-token timeoutMs=${config.timeoutMs}`);

  const runtimeStatus = await waitForFetch(`${config.sidecarBaseUrl}${LIVE_RUNTIME_STATUS_PATH}`, {
    expectedStatus: 200,
    headers: {
      Authorization: `Bearer ${config.localCapabilityToken}`
    },
    timeoutMs: config.timeoutMs,
    processes
  });
  diagnostics.step("fetch passed: authenticated runtime status");

  return JSON.parse(runtimeStatus.text);
}

async function startCodexLiveRuntimeSidecar(config, commands, env, processes, diagnostics) {
  console.log(`verify-codex-live-runtime: starting sidecar ${config.sidecarBaseUrl}`);
  diagnostics.step(`managed process start: ${commandLabel(commands.sidecar[0], commands.sidecar[1])}`);
  const sidecar = spawnManagedProcess(commands.sidecar[0], commands.sidecar[1], { env, onOutput: diagnostics.output });
  processes.push(sidecar);

  diagnostics.step(`fetch wait: ${config.sidecarBaseUrl}/healthz expected=200 includes=solo-superman-sidecar timeoutMs=${config.timeoutMs}`);
  await waitForFetch(`${config.sidecarBaseUrl}/healthz`, {
    expectedStatus: 200,
    textIncludes: "solo-superman-sidecar",
    timeoutMs: config.timeoutMs,
    processes
  });
  diagnostics.step("fetch passed: sidecar health");
}

async function runCodexLiveRuntimeSmoke(config, commands, env, processes, diagnostics, logPath) {
  startCodexLiveRuntimeDiagnostics(config, commands, diagnostics, logPath);
  await startCodexLiveRuntimeSidecar(config, commands, env, processes, diagnostics);
  const envelope = await fetchCodexLiveRuntimeStatus(config, processes, diagnostics);
  const evidence = evaluateCodexLiveRuntimeStatus(envelope);
  diagnostics.step(`evidence=${JSON.stringify(evidence)}`);

  if (evidence.status !== "passed") {
    console.error(JSON.stringify(evidence));
    throw new Error(`Codex live runtime readiness blocked: ${evidence.blockers.join("; ")}`);
  }

  console.log(JSON.stringify(evidence));
}

function startCodexLiveRuntimeDiagnostics(config, commands, diagnostics, logPath) {
  console.log(`verify-codex-live-runtime: diagnostic log ${logPath}`);
  diagnostics.step(`cwd=${process.cwd()}`);
  diagnostics.step(`node=${process.version} platform=${process.platform} arch=${process.arch}`);
  diagnostics.step(`env=${JSON.stringify(diagnosticEnvSnapshot(process.env, DIAGNOSTIC_ENV_NAMES))}`);
  diagnostics.step(`config=${JSON.stringify(redactConfigSecrets(config))}`);
  diagnostics.step(`commands=${JSON.stringify(Object.fromEntries(Object.entries(commands).map(([name, [command, args]]) => [name, commandLabel(command, args)])))}`);
}

async function cleanupCodexLiveRuntimeSmoke(processes, appDataDir, diagnostics, logPath) {
  diagnostics.step(`cleanup start: processes=${processes.length} appDataDir=${appDataDir}`);

  try {
    await cleanupManagedSmoke(processes, appDataDir, "verify-codex-live-runtime");
    diagnostics.step("cleanup completed");
  } catch (error) {
    diagnostics.error(error);
    console.error(`verify-codex-live-runtime: diagnostic log retained at ${logPath}`);
    throw error;
  }

  if (processes.length > 0) {
    console.log(`verify-codex-live-runtime: stopped ${processes.length} managed process(es) and removed temporary app data`);
  }
}

export async function runCodexLiveRuntimeVerification() {
  const gateEvidence = liveRuntimeVerificationGateEvidence(process.env);

  if (gateEvidence.status === "skipped") {
    console.log(JSON.stringify(gateEvidence));
    return;
  }

  if (gateEvidence.status === "blocked") {
    console.error(JSON.stringify(gateEvidence));
    assertLiveRuntimeVerificationGate(process.env);
  }

  const config = codexLiveRuntimeSmokeConfig();
  await assertCodexLiveRuntimeSmokePortAvailable(config);
  const appDataDir = await mkdtemp(join(tmpdir(), "solo-superman-codex-live-runtime-"));
  const env = codexLiveRuntimeSmokeEnvironment(config, appDataDir);
  const commands = codexLiveRuntimeSmokeCommands(process.platform, process.env);
  const logPath = codexLiveRuntimeSmokeLogPath(process.env);
  const diagnostics = createDiagnosticLogger("verify-codex-live-runtime", logPath);
  const processes = [];

  try {
    await runCodexLiveRuntimeSmoke(config, commands, env, processes, diagnostics, logPath);
  } catch (error) {
    diagnostics.error(error);
    console.error(`verify-codex-live-runtime: diagnostic log retained at ${logPath}`);
    throw error;
  } finally {
    await cleanupCodexLiveRuntimeSmoke(processes, appDataDir, diagnostics, logPath);
  }
}

const invokedScriptUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === invokedScriptUrl) {
  runCodexLiveRuntimeVerification().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
