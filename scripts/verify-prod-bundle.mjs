import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SIDECAR_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = "43110";
const DEFAULT_WEB_HOST = "127.0.0.1";
const DEFAULT_WEB_PORT = "4173";
const DEFAULT_TIMEOUT_MS = 30_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function envValue(env, name, fallback) {
  const value = env[name];

  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function positiveIntegerEnv(env, name, fallback) {
  const value = envValue(env, name, String(fallback));

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer number of milliseconds; received ${JSON.stringify(value)}`);
  }

  return Number.parseInt(value, 10);
}

function loopbackHostEnv(env, name, fallback) {
  const value = envValue(env, name, fallback);

  if (!LOOPBACK_HOSTS.has(value)) {
    throw new Error(`${name} must be loopback-only for local production smoke: ${value}`);
  }

  return value === "[::1]" ? "::1" : value;
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

function formatHttpOrigin(host, port) {
  const urlHost = host.includes(":") ? `[${host}]` : host;

  return `http://${urlHost}:${port}`;
}

export function prodBundleSmokeConfig(env = process.env) {
  const sidecarHost = loopbackHostEnv(env, "SOLO_PROD_SMOKE_SIDECAR_HOST", DEFAULT_SIDECAR_HOST);
  const sidecarPort = fixedPortEnv(env, "SOLO_PROD_SMOKE_SIDECAR_PORT", DEFAULT_SIDECAR_PORT);
  const webHost = loopbackHostEnv(env, "SOLO_PROD_SMOKE_WEB_HOST", DEFAULT_WEB_HOST);
  const webPort = fixedPortEnv(env, "SOLO_PROD_SMOKE_WEB_PORT", DEFAULT_WEB_PORT);
  const localCapabilityToken = envValue(env, "SOLO_LOCAL_CAPABILITY_TOKEN", generatedToken());
  const sidecarBaseUrl = formatHttpOrigin(sidecarHost, sidecarPort);
  const webBaseUrl = formatHttpOrigin(webHost, webPort);

  return {
    localCapabilityToken,
    sidecarHost,
    sidecarPort,
    sidecarBaseUrl,
    webHost,
    webPort,
    webBaseUrl,
    timeoutMs: positiveIntegerEnv(env, "SOLO_PROD_SMOKE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)
  };
}

export function prodBundleSmokeEnvironment(config, appDataDir, env = process.env) {
  return {
    ...env,
    SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    SOLO_SIDECAR_HOST: config.sidecarHost,
    SOLO_SIDECAR_PORT: config.sidecarPort,
    SOLO_APP_DATA_DIR: appDataDir,
    VITE_SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    VITE_SOLO_SIDECAR_BASE_URL: config.sidecarBaseUrl
  };
}

export function prodBundleSmokeCommands(config) {
  return {
    build: ["pnpm", ["build"]],
    sidecar: ["pnpm", ["--filter", "@solo-superman/sidecar", "start"]],
    webPreview: [
      "pnpm",
      [
        "--filter",
        "@solo-superman/web",
        "exec",
        "vite",
        "preview",
        "--host",
        config.webHost,
        "--port",
        config.webPort,
        "--strictPort"
      ]
    ]
  };
}

function commandLabel(command, args) {
  return [command, ...args].join(" ");
}

function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const managed = {
    child,
    label: commandLabel(command, args),
    logs: [],
    stopping: false
  };

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk);
    managed.logs.push(text);
    if (!managed.stopping) {
      process.stdout.write(text);
    }
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    managed.logs.push(text);
    if (!managed.stopping) {
      process.stderr.write(text);
    }
  });

  return managed;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const managed = spawnManaged(command, args, options);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasExited(processInfo) {
  return processInfo.child.exitCode !== null || processInfo.child.signalCode !== null;
}

async function waitForFetch(url, options) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < options.timeoutMs) {
    if (options.processes?.some(hasExited)) {
      const exited = options.processes.find(hasExited);

      throw new Error(`${exited.label} exited before ${url} became ready.\n${exited.logs.join("")}`);
    }

    try {
      const response = await fetch(url, {
        headers: options.headers
      });
      const text = await response.text();

      if (response.status === options.expectedStatus && (!options.textIncludes || text.includes(options.textIncludes))) {
        return { response, text };
      }

      lastError = new Error(`${url} returned ${response.status}; expected ${options.expectedStatus}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw lastError ?? new Error(`${url} did not become ready within ${options.timeoutMs}ms`);
}

async function stopProcess(processInfo) {
  if (hasExited(processInfo)) {
    return;
  }

  processInfo.stopping = true;

  await new Promise((resolve) => {
    const killTimer = setTimeout(() => {
      if (!hasExited(processInfo)) {
        processInfo.child.kill("SIGKILL");
      }
    }, 5_000);

    processInfo.child.once("exit", () => {
      globalThis.clearTimeout(killTimer);
      resolve();
    });

    processInfo.child.kill("SIGTERM");
  });
}

export async function runProdBundleSmoke() {
  const config = prodBundleSmokeConfig();
  const appDataDir = await mkdtemp(join(tmpdir(), "solo-superman-prod-smoke-"));
  const env = prodBundleSmokeEnvironment(config, appDataDir);
  const commands = prodBundleSmokeCommands(config);
  const processes = [];

  try {
    console.log(`verify-prod-bundle: building web production bundle for ${config.sidecarBaseUrl}`);
    await runCommand(commands.build[0], commands.build[1], { env });

    console.log(`verify-prod-bundle: starting sidecar ${config.sidecarBaseUrl}`);
    const sidecar = spawnManaged(commands.sidecar[0], commands.sidecar[1], { env });
    processes.push(sidecar);
    await waitForFetch(`${config.sidecarBaseUrl}/healthz`, {
      expectedStatus: 200,
      textIncludes: "solo-superman-sidecar",
      timeoutMs: config.timeoutMs,
      processes
    });
    await waitForFetch(`${config.sidecarBaseUrl}/api/v1/runtime/status`, {
      expectedStatus: 200,
      headers: {
        Authorization: `Bearer ${config.localCapabilityToken}`
      },
      timeoutMs: config.timeoutMs,
      processes
    });
    await waitForFetch(`${config.sidecarBaseUrl}/api/v1/runtime/status`, {
      expectedStatus: 401,
      headers: {
        Authorization: "Bearer intentionally-wrong-prod-smoke-token"
      },
      timeoutMs: config.timeoutMs,
      processes
    });

    console.log(`verify-prod-bundle: starting web preview ${config.webBaseUrl}`);
    const webPreview = spawnManaged(commands.webPreview[0], commands.webPreview[1], { env });
    processes.push(webPreview);
    await waitForFetch(config.webBaseUrl, {
      expectedStatus: 200,
      textIncludes: "Solo Superman",
      timeoutMs: config.timeoutMs,
      processes
    });

    console.log(JSON.stringify({
      status: "passed",
      smoke: "build_auto_local_smoke",
      sidecarBaseUrl: config.sidecarBaseUrl,
      webBaseUrl: config.webBaseUrl,
      checked: [
        "production build completed",
        "sidecar health responded",
        "authenticated local API responded",
        "token mismatch returned 401",
        "production web preview responded"
      ]
    }));
  } finally {
    await Promise.all(processes.reverse().map(stopProcess));
    await rm(appDataDir, { recursive: true, force: true });
  }
}

const invokedScriptUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === invokedScriptUrl) {
  runProdBundleSmoke().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
