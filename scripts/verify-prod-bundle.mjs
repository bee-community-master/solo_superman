import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { envValue, positiveIntegerEnv } from "./local-env.mjs";
import { waitForFetch } from "./local-http.mjs";
import { defaultLocalBindHost, normalizeBindHost, normalizeLoopbackHost, packageManagerSpawn } from "./local-platform.mjs";
import { commandLabel, spawnManagedProcess, stopManagedProcess } from "./local-processes.mjs";
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

function loopbackHostEnv(env, name, fallback) {
  return normalizeLoopbackHost(envValue(env, name, fallback), name);
}

function bindHostEnv(env, name, fallback, platform = process.platform) {
  return normalizeBindHost(envValue(env, name, fallback), name, env, platform);
}

function fixedPortEnv(env, name, fallback) {
  const value = envValue(env, name, fallback);

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a numeric fixed local port: ${value}`);
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`${name} must be a fixed local port between 1 and 65535: ${value}`);
  }

  return String(parsed);
}

function generatedToken() {
  return randomBytes(32).toString("hex");
}

function listenOnce(host, port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      server.removeAllListeners();
      resolve(result);
    };

    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        finish({
          available: false,
          reason: `${host}:${port} is already in use`
        });
        return;
      }

      reject(error);
    });
    server.listen(Number(port), host, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        finish({ available: true });
      });
    });
  });
}

function usesSameSmokePort(left, right) {
  return left.port === right.port;
}

export async function assertProdBundleSmokePortsAvailable(config, options = {}) {
  const listen = options.listen ?? listenOnce;
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

  for (const [index, check] of checks.entries()) {
    const conflictingCheck = checks.slice(index + 1).find((candidate) => usesSameSmokePort(check, candidate));

    if (conflictingCheck) {
      throw new Error(
        [
          `verify-prod-bundle: ${check.label} and ${conflictingCheck.label} smoke ports conflict before startup:`,
          `${check.host}:${check.port} overlaps ${conflictingCheck.host}:${conflictingCheck.port}.`,
          "Use distinct fixed local ports,",
          "for example SOLO_PROD_SMOKE_SIDECAR_PORT=<free-port> and SOLO_PROD_SMOKE_WEB_PORT=<another-free-port>."
        ].join(" ")
      );
    }
  }

  for (const check of checks) {
    const result = await listen(check.host, check.port);

    if (!result.available) {
      throw new Error(
        [
          `verify-prod-bundle: ${check.label} smoke port conflict: ${result.reason}.`,
          `The smoke needs ${check.publicUrl} before it starts managed child processes.`,
          "Stop the existing local dev sidecar/web preview or rerun with a different fixed local port,",
          `for example ${check.overrideName}=<free-port>.`
        ].join(" ")
      );
    }
  }
}

export function prodBundleSmokeLogPath(env = process.env) {
  return envValue(env, "SOLO_PROD_SMOKE_LOG_PATH", join(tmpdir(), `solo-superman-prod-bundle-smoke-${process.pid}.log`));
}

function diagnosticEnvSnapshot(env) {
  return Object.fromEntries(DIAGNOSTIC_ENV_NAMES
    .filter((name) => env[name] !== undefined)
    .map((name) => [name, env[name]]));
}

function publicSmokeConfig(config) {
  return {
    ...config,
    localCapabilityToken: "<redacted>"
  };
}

function createDiagnosticLogger(logPath) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, `verify-prod-bundle diagnostic log\nstartedAt=${new Date().toISOString()}\n`, "utf8");
  } catch (error) {
    console.warn(`verify-prod-bundle: could not initialize diagnostic log ${logPath}: ${error instanceof Error ? error.message : error}`);
  }

  const write = (message) => {
    try {
      appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
    } catch {
      // Diagnostics must never mask the original smoke failure.
    }
  };

  return {
    output({ label, stream, stopping, text }) {
      write(`${label} ${stream}${stopping ? " during cleanup" : ""}: ${text.replace(/\r?\n$/u, "")}`);
    },
    step(message) {
      write(message);
    },
    error(error) {
      write(`ERROR: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
  };
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
  const sidecarPort = fixedPortEnv(env, "SOLO_PROD_SMOKE_SIDECAR_PORT", DEFAULT_SIDECAR_PORT);
  const webHost = loopbackHostEnv(env, "SOLO_PROD_SMOKE_WEB_HOST", DEFAULT_WEB_HOST);
  const webBindHost = bindHostEnv(
    env,
    "SOLO_PROD_SMOKE_WEB_BIND_HOST",
    defaultBindHost === "0.0.0.0" ? defaultBindHost : webHost,
    platform
  );
  const webPort = fixedPortEnv(env, "SOLO_PROD_SMOKE_WEB_PORT", DEFAULT_WEB_PORT);
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
  const stopProcess = options.stopProcess ?? stopManagedProcess;
  const removeAppDataDir = options.remove ?? rm;
  const cleanupFailures = [];
  const stopResults = await Promise.allSettled([...processes].reverse().map(stopProcess));

  for (const result of stopResults) {
    if (result.status === "rejected") {
      cleanupFailures.push(result.reason);
    }
  }

  try {
    await removeAppDataDir(appDataDir, { recursive: true, force: true });
  } catch (error) {
    cleanupFailures.push(error);
  }

  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, "verify-prod-bundle cleanup failed");
  }
}

export async function runProdBundleSmoke() {
  const config = prodBundleSmokeConfig();
  await assertProdBundleSmokePortsAvailable(config);
  const appDataDir = await mkdtemp(join(tmpdir(), "solo-superman-prod-smoke-"));
  const env = prodBundleSmokeEnvironment(config, appDataDir);
  const commands = prodBundleSmokeCommands(config, process.platform, process.env);
  const logPath = prodBundleSmokeLogPath(process.env);
  const diagnostics = createDiagnosticLogger(logPath);
  const processes = [];
  let passedEvidence;

  try {
    console.log(`verify-prod-bundle: diagnostic log ${logPath}`);
    diagnostics.step(`cwd=${process.cwd()}`);
    diagnostics.step(`node=${process.version} platform=${process.platform} arch=${process.arch}`);
    diagnostics.step(`env=${JSON.stringify(diagnosticEnvSnapshot(process.env))}`);
    diagnostics.step(`config=${JSON.stringify(publicSmokeConfig(config))}`);
    diagnostics.step(`commands=${JSON.stringify(Object.fromEntries(Object.entries(commands).map(([name, [command, args]]) => [name, commandLabel(command, args)])))}`);

    console.log(`verify-prod-bundle: building web production bundle for ${config.sidecarBaseUrl}`);
    await runCommand(commands.build[0], commands.build[1], { env, diagnostics, onOutput: diagnostics.output });

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

    passedEvidence = {
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
  } catch (error) {
    diagnostics.error(error);
    console.error(`verify-prod-bundle: diagnostic log retained at ${logPath}`);
    throw error;
  } finally {
    diagnostics.step(`cleanup start: processes=${processes.length} appDataDir=${appDataDir}`);
    try {
      await cleanupProdBundleSmoke(processes, appDataDir);
      diagnostics.step("cleanup completed");
    } catch (error) {
      diagnostics.error(error);
      console.error(`verify-prod-bundle: diagnostic log retained at ${logPath}`);
      await Promise.reject(error);
    }
    if (processes.length > 0) {
      console.log(`verify-prod-bundle: stopped ${processes.length} managed process(es) and removed temporary app data`);
    }
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
