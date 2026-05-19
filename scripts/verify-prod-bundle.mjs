import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { envValue, positiveIntegerEnv } from "./local-env.mjs";
import { waitForFetch } from "./local-http.mjs";
import { defaultLocalBindHost, normalizeBindHost, normalizeLoopbackHost, packageManagerSpawn } from "./local-platform.mjs";
import { spawnManagedProcess, stopManagedProcess } from "./local-processes.mjs";
import { formatHttpOrigin } from "./local-url.mjs";

const DEFAULT_SIDECAR_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = "43110";
const DEFAULT_WEB_HOST = "127.0.0.1";
const DEFAULT_WEB_PORT = "4173";
const DEFAULT_TIMEOUT_MS = 30_000;
const RUNTIME_STATUS_PATH = "/api/v1/runtime/status";
const WRONG_TOKEN = "intentionally-wrong-prod-smoke-token";

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
    const managed = spawnManagedProcess(command, args, options);

    managed.child.on("error", reject);
    managed.child.on("exit", (code, signal) => {
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
  const appDataDir = await mkdtemp(join(tmpdir(), "solo-superman-prod-smoke-"));
  const env = prodBundleSmokeEnvironment(config, appDataDir);
  const commands = prodBundleSmokeCommands(config, process.platform, process.env);
  const processes = [];
  let passedEvidence;

  try {
    console.log(`verify-prod-bundle: building web production bundle for ${config.sidecarBaseUrl}`);
    await runCommand(commands.build[0], commands.build[1], { env });

    console.log(`verify-prod-bundle: starting sidecar ${config.sidecarBaseUrl}`);
    const sidecar = spawnManagedProcess(commands.sidecar[0], commands.sidecar[1], { env });
    processes.push(sidecar);
    await waitForFetch(`${config.sidecarBaseUrl}/healthz`, {
      expectedStatus: 200,
      textIncludes: "solo-superman-sidecar",
      timeoutMs: config.timeoutMs,
      processes
    });
    await waitForFetch(`${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH}`, {
      expectedStatus: 200,
      headers: {
        Authorization: `Bearer ${config.localCapabilityToken}`
      },
      timeoutMs: config.timeoutMs,
      processes
    });
    await waitForFetch(`${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH}`, {
      expectedStatus: 401,
      headers: {
        Authorization: `Bearer ${WRONG_TOKEN}`
      },
      timeoutMs: config.timeoutMs,
      processes
    });

    console.log(`verify-prod-bundle: starting web preview ${config.webBaseUrl}`);
    const webPreview = spawnManagedProcess(commands.webPreview[0], commands.webPreview[1], { env });
    processes.push(webPreview);
    await waitForFetch(config.webBaseUrl, {
      expectedStatus: 200,
      textIncludes: "Solo Superman",
      timeoutMs: config.timeoutMs,
      processes
    });

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
  } finally {
    await cleanupProdBundleSmoke(processes, appDataDir);
    if (processes.length > 0) {
      console.log(`verify-prod-bundle: stopped ${processes.length} managed process(es) and removed temporary app data`);
    }
  }

  if (passedEvidence) {
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
