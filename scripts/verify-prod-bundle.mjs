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

const DEFAULT_SIDECAR_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = "43110";
const DEFAULT_WEB_HOST = "127.0.0.1";
const DEFAULT_WEB_PORT = "4173";
const DEFAULT_TIMEOUT_MS = 30_000;
const RUNTIME_STATUS_PATH = "/api/v1/runtime/status";
const WRONG_TOKEN = "intentionally-wrong-prod-smoke-token";
const DIAGNOSTIC_ENV_NAMES = [
  "CI",
  "SOLO_PNPM_COMMAND",
  "npm_execpath",
  "npm_config_user_agent",
  "SOLO_PROD_SMOKE_SIDECAR_HOST",
  "SOLO_PROD_SMOKE_SIDECAR_BIND_HOST",
  "SOLO_PROD_SMOKE_SIDECAR_PORT",
  "SOLO_PROD_SMOKE_WEB_HOST",
  "SOLO_PROD_SMOKE_WEB_BIND_HOST",
  "SOLO_PROD_SMOKE_WEB_PORT",
  "SOLO_PROD_SMOKE_TIMEOUT_MS",
  "SOLO_CODEX_WINDOWS_MODE",
  "WSL_DISTRO_NAME",
  "WSL_INTEROP",
  "WSLENV"
];

function generatedToken() {
  return randomBytes(32).toString("hex");
}

export async function assertProdBundleSmokePortsAvailable(config, options = {}) {
  const checks = [
    {
      label: "sidecar",
      host: config.sidecarBindHost,
      port: config.sidecarPort,
      publicUrl: config.sidecarBaseUrl,
      overrideName: "SOLO_PROD_SMOKE_SIDECAR_PORT"
    },
    {
      label: "web preview",
      host: config.webBindHost,
      port: config.webPort,
      publicUrl: config.webBaseUrl,
      overrideName: "SOLO_PROD_SMOKE_WEB_PORT"
    }
  ];

  await assertSmokePortsAvailable(checks, "verify-prod-bundle", options);
}

export function prodBundleSmokeLogPath(env = process.env) {
  return envValue(env, "SOLO_PROD_SMOKE_LOG_PATH", join(tmpdir(), `solo-superman-prod-bundle-smoke-${process.pid}.log`));
}

export function pnpmCommand(platform = process.platform, env = process.env) {
  return packageManagerSpawn([], env, platform)[0];
}

export function prodBundleSmokeConfig(env = process.env, platform = process.platform) {
  const defaultBindHost = defaultLocalBindHost(env, platform);
  const sidecarHost = loopbackHostEnv(env, "SOLO_PROD_SMOKE_SIDECAR_HOST", DEFAULT_SIDECAR_HOST);
  const sidecarBindHost = bindHostEnv(
    env,
    "SOLO_PROD_SMOKE_SIDECAR_BIND_HOST",
    defaultBindHost === "0.0.0.0" ? defaultBindHost : sidecarHost,
    platform
  );
  const sidecarPort = fixedLocalPortEnv(env, "SOLO_PROD_SMOKE_SIDECAR_PORT", DEFAULT_SIDECAR_PORT);
  const webHost = loopbackHostEnv(env, "SOLO_PROD_SMOKE_WEB_HOST", DEFAULT_WEB_HOST);
  const webBindHost = bindHostEnv(
    env,
    "SOLO_PROD_SMOKE_WEB_BIND_HOST",
    defaultBindHost === "0.0.0.0" ? defaultBindHost : webHost,
    platform
  );
  const webPort = fixedLocalPortEnv(env, "SOLO_PROD_SMOKE_WEB_PORT", DEFAULT_WEB_PORT);
  const localCapabilityToken = envValue(env, "SOLO_LOCAL_CAPABILITY_TOKEN", generatedToken());
  const sidecarBaseUrl = formatHttpOrigin(sidecarHost, sidecarPort);
  const webBaseUrl = formatHttpOrigin(webHost, webPort);

  return {
    localCapabilityToken,
    sidecarHost,
    sidecarBindHost,
    sidecarPort,
    sidecarBaseUrl,
    webHost,
    webBindHost,
    webPort,
    webBaseUrl,
    timeoutMs: positiveIntegerEnv(env, "SOLO_PROD_SMOKE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, "positive integer number of milliseconds")
  };
}

export function prodBundleSmokeEnvironment(config, appDataDir, env = process.env) {
  return {
    ...env,
    CI: "true",
    SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    SOLO_SIDECAR_HOST: config.sidecarBindHost,
    SOLO_SIDECAR_PORT: config.sidecarPort,
    SOLO_APP_DATA_DIR: appDataDir,
    VITE_SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    VITE_SOLO_SIDECAR_BASE_URL: config.sidecarBaseUrl
  };
}

export function prodBundleSmokeCommands(config, platform = process.platform, env = process.env) {
  return {
    build: packageManagerSpawn(["-r", "--if-present", "build"], env, platform),
    sidecar: packageManagerSpawn(["--filter", "@solo-superman/sidecar", "start"], env, platform),
    webPreview: packageManagerSpawn([
      "--filter",
      "@solo-superman/web",
      "exec",
      "vite",
      "preview",
      "--host",
      config.webBindHost,
      "--port",
      config.webPort,
      "--strictPort"
    ], env, platform)
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    options.diagnostics?.step(`command start: ${commandLabel(command, args)}`);
    const managed = spawnManagedProcess(command, args, options);

    managed.child.on("error", reject);
    managed.child.on("exit", (code, signal) => {
      options.diagnostics?.step(`command exit: ${managed.label} code=${code ?? "<null>"} signal=${signal ?? "<null>"}`);
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${managed.label} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

export async function cleanupProdBundleSmoke(processes, appDataDir, options = {}) {
  await cleanupManagedSmoke(processes, appDataDir, "verify-prod-bundle", options);
}

function prodBundlePassedEvidence(config) {
  return {
    status: "passed",
    smoke: "build_auto_local_smoke",
    sidecarBaseUrl: config.sidecarBaseUrl,
    webBaseUrl: config.webBaseUrl,
    checked: [
      "production build completed",
      "sidecar health responded",
      "authenticated local API responded",
      "token mismatch returned 401",
      "production web preview responded",
      "managed child processes stopped",
      "temporary app data removed"
    ]
  };
}

function startProdBundleDiagnostics(config, commands, diagnostics, logPath) {
  console.log(`verify-prod-bundle: diagnostic log ${logPath}`);
  diagnostics.step(`cwd=${process.cwd()}`);
  diagnostics.step(`node=${process.version} platform=${process.platform} arch=${process.arch}`);
  diagnostics.step(`env=${JSON.stringify(diagnosticEnvSnapshot(process.env, DIAGNOSTIC_ENV_NAMES))}`);
  diagnostics.step(`config=${JSON.stringify(redactConfigSecrets(config))}`);
  diagnostics.step(`commands=${JSON.stringify(Object.fromEntries(Object.entries(commands).map(([name, [command, args]]) => [name, commandLabel(command, args)])))}`);
}

async function buildProdBundle(config, commands, env, diagnostics) {
  console.log(`verify-prod-bundle: building web production bundle for ${config.sidecarBaseUrl}`);
  await runCommand(commands.build[0], commands.build[1], { env, diagnostics, onOutput: diagnostics.output });
}

async function startProdBundleSidecar(config, commands, env, processes, diagnostics) {
  console.log(`verify-prod-bundle: starting sidecar ${config.sidecarBaseUrl}`);
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

async function verifyProdBundleRuntimeStatus(config, processes, diagnostics) {
  diagnostics.step(`fetch wait: ${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH} expected=200 auth=local-token timeoutMs=${config.timeoutMs}`);
  await waitForFetch(`${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH}`, {
    expectedStatus: 200,
    headers: {
      Authorization: `Bearer ${config.localCapabilityToken}`
    },
    timeoutMs: config.timeoutMs,
    processes
  });
  diagnostics.step("fetch passed: authenticated runtime status");

  diagnostics.step(`fetch wait: ${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH} expected=401 auth=wrong-token timeoutMs=${config.timeoutMs}`);
  await waitForFetch(`${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH}`, {
    expectedStatus: 401,
    headers: {
      Authorization: `Bearer ${WRONG_TOKEN}`
    },
    timeoutMs: config.timeoutMs,
    processes
  });
  diagnostics.step("fetch passed: token mismatch returned 401");
}

async function startProdBundleWebPreview(config, commands, env, processes, diagnostics) {
  console.log(`verify-prod-bundle: starting web preview ${config.webBaseUrl}`);
  diagnostics.step(`managed process start: ${commandLabel(commands.webPreview[0], commands.webPreview[1])}`);
  const webPreview = spawnManagedProcess(commands.webPreview[0], commands.webPreview[1], { env, onOutput: diagnostics.output });
  processes.push(webPreview);

  diagnostics.step(`fetch wait: ${config.webBaseUrl} expected=200 includes=Solo Superman timeoutMs=${config.timeoutMs}`);
  await waitForFetch(config.webBaseUrl, {
    expectedStatus: 200,
    textIncludes: "Solo Superman",
    timeoutMs: config.timeoutMs,
    processes
  });
  diagnostics.step("fetch passed: production web preview");
}

async function runProdBundleSmokeSteps(config, commands, env, processes, diagnostics, logPath) {
  startProdBundleDiagnostics(config, commands, diagnostics, logPath);
  await buildProdBundle(config, commands, env, diagnostics);
  await startProdBundleSidecar(config, commands, env, processes, diagnostics);
  await verifyProdBundleRuntimeStatus(config, processes, diagnostics);
  await startProdBundleWebPreview(config, commands, env, processes, diagnostics);

  return prodBundlePassedEvidence(config);
}

async function cleanupProdBundleSmokeRun(processes, appDataDir, diagnostics, logPath) {
  diagnostics.step(`cleanup start: processes=${processes.length} appDataDir=${appDataDir}`);

  try {
    await cleanupProdBundleSmoke(processes, appDataDir);
    diagnostics.step("cleanup completed");
  } catch (error) {
    diagnostics.error(error);
    console.error(`verify-prod-bundle: diagnostic log retained at ${logPath}`);
    throw error;
  }

  if (processes.length > 0) {
    console.log(`verify-prod-bundle: stopped ${processes.length} managed process(es) and removed temporary app data`);
  }
}

export async function runProdBundleSmoke() {
  const config = prodBundleSmokeConfig();
  await assertProdBundleSmokePortsAvailable(config);
  const appDataDir = await mkdtemp(join(tmpdir(), "solo-superman-prod-smoke-"));
  const env = prodBundleSmokeEnvironment(config, appDataDir);
  const commands = prodBundleSmokeCommands(config, process.platform, process.env);
  const logPath = prodBundleSmokeLogPath(process.env);
  const diagnostics = createDiagnosticLogger("verify-prod-bundle", logPath);
  const processes = [];
  let passedEvidence;

  try {
    passedEvidence = await runProdBundleSmokeSteps(config, commands, env, processes, diagnostics, logPath);
  } catch (error) {
    diagnostics.error(error);
    console.error(`verify-prod-bundle: diagnostic log retained at ${logPath}`);
    throw error;
  } finally {
    await cleanupProdBundleSmokeRun(processes, appDataDir, diagnostics, logPath);
  }

  if (passedEvidence) {
    diagnostics.step(`passed=${JSON.stringify(passedEvidence)}`);
    console.log(JSON.stringify(passedEvidence));
  }
}

const invokedScriptUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === invokedScriptUrl) {
  runProdBundleSmoke().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
