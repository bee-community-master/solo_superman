import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { pathToFileURL } from "node:url";

const LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = 43110;
const DEFAULT_WEB_PORT = 1420;
const DEFAULT_READY_TIMEOUT_MS = 60_000;
const FETCH_RETRY_INTERVAL_MS = 250;
const TERMINATE_GRACE_MS = 5_000;
const FORCE_KILL_GRACE_MS = 2_000;
const WRONG_TOKEN = "intentionally-wrong-local-run-token";
const RUNTIME_STATUS_PATH = "/api/v1/runtime/status";

function envValue(env, name, fallback) {
  const value = env[name];

  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function positiveIntegerEnv(env, name, fallback) {
  const value = envValue(env, name, String(fallback));

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer; received ${JSON.stringify(value)}`);
  }

  return Number.parseInt(value, 10);
}

function parsePreferredPort(env, name, fallback) {
  const value = envValue(env, name, String(fallback));

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a numeric local port: ${value}`);
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`${name} must be between 1 and 65535: ${value}`);
  }

  return parsed;
}

export function pnpmCommand(platform = process.platform) {
  return platform === "win32" ? "pnpm.cmd" : "pnpm";
}

export function browserOpenCommand(url, platform = process.platform) {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

export function generatedToken() {
  return randomBytes(32).toString("hex");
}

function formatHttpOrigin(host, port) {
  return `http://${host}:${port}`;
}

export async function isPortAvailable(port, host = LOOPBACK_HOST) {
  return await new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(preferredPort, host = LOOPBACK_HOST) {
  if (preferredPort > 0 && await isPortAvailable(preferredPort, host)) {
    return preferredPort;
  }

  return await new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a local port")));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

export async function resolveLocalRunConfig(env = process.env) {
  const sidecarPort = await findAvailablePort(
    parsePreferredPort(env, "SOLO_LOCAL_RUN_SIDECAR_PORT", DEFAULT_SIDECAR_PORT)
  );
  let webPort = await findAvailablePort(parsePreferredPort(env, "SOLO_LOCAL_RUN_WEB_PORT", DEFAULT_WEB_PORT));

  while (webPort === sidecarPort) {
    webPort = await findAvailablePort(0);
  }

  const sidecarBaseUrl = formatHttpOrigin(LOOPBACK_HOST, sidecarPort);
  const webBaseUrl = formatHttpOrigin(LOOPBACK_HOST, webPort);

  return {
    host: LOOPBACK_HOST,
    localCapabilityToken: envValue(env, "SOLO_LOCAL_CAPABILITY_TOKEN", generatedToken()),
    openBrowser: envValue(env, "SOLO_LOCAL_OPEN_BROWSER", "1") !== "0",
    readyTimeoutMs: positiveIntegerEnv(env, "SOLO_LOCAL_READY_TIMEOUT_MS", DEFAULT_READY_TIMEOUT_MS),
    sidecarBaseUrl,
    sidecarPort: String(sidecarPort),
    webBaseUrl,
    webPort: String(webPort)
  };
}

export function localRunEnvironment(config, env = process.env) {
  return {
    ...env,
    SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    SOLO_SIDECAR_HOST: config.host,
    SOLO_SIDECAR_PORT: config.sidecarPort,
    VITE_SOLO_LOCAL_CAPABILITY_TOKEN: config.localCapabilityToken,
    VITE_SOLO_SIDECAR_BASE_URL: config.sidecarBaseUrl
  };
}

export function localRunCommands(config, platform = process.platform) {
  const pnpm = pnpmCommand(platform);

  return {
    sidecar: [pnpm, ["--filter", "@solo-superman/sidecar", "start"]],
    web: [
      pnpm,
      [
        "--filter",
        "@solo-superman/web",
        "exec",
        "vite",
        "--host",
        config.host,
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

function hasExited(processInfo) {
  return processInfo.child.exitCode !== null || processInfo.child.signalCode !== null;
}

function remainingTimeoutMs(startedAt, timeoutMs) {
  return Math.max(1, timeoutMs - (Date.now() - startedAt));
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options) {
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  try {
    return await fetchImpl(url, {
      headers: options.headers,
      signal: controller.signal
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
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
      const response = await fetchWithTimeout(url, {
        headers: options.headers,
        timeoutMs: remainingTimeoutMs(startedAt, options.timeoutMs)
      });
      const text = await response.text();

      if (response.status === options.expectedStatus && (!options.textIncludes || text.includes(options.textIncludes))) {
        return { response, text };
      }

      lastError = new Error(`${url} returned ${response.status}; expected ${options.expectedStatus}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(FETCH_RETRY_INTERVAL_MS);
  }

  throw lastError ?? new Error(`${url} did not become ready within ${options.timeoutMs}ms`);
}

async function stopProcess(processInfo) {
  if (hasExited(processInfo)) {
    return;
  }

  processInfo.stopping = true;

  await new Promise((resolve, reject) => {
    let failTimer;
    const killTimer = setTimeout(() => {
      if (!hasExited(processInfo)) {
        processInfo.child.kill("SIGKILL");
        failTimer = setTimeout(() => {
          if (!hasExited(processInfo)) {
            reject(new Error(`${processInfo.label} did not exit after SIGKILL`));
          }
        }, FORCE_KILL_GRACE_MS);
      }
    }, TERMINATE_GRACE_MS);

    processInfo.child.once("exit", () => {
      globalThis.clearTimeout(killTimer);
      if (failTimer) {
        globalThis.clearTimeout(failTimer);
      }
      resolve();
    });

    processInfo.child.kill("SIGTERM");
  });
}

async function stopAll(processes) {
  await Promise.allSettled([...processes].reverse().map(stopProcess));
}

async function openBrowser(url, options = {}) {
  const spawnImpl = options.spawnImpl ?? spawn;
  const platform = options.platform ?? process.platform;
  const command = browserOpenCommand(url, platform);

  await new Promise((resolve, reject) => {
    const child = spawnImpl(command.command, command.args, {
      stdio: "ignore",
      detached: platform !== "win32"
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
        return;
      }

      reject(new Error(`${commandLabel(command.command, command.args)} failed with exit ${code}`));
    });
    child.unref?.();
  });
}

function isLikelyPortConflict(error) {
  return /EADDRINUSE|address already in use|strictPort/i.test(String(error instanceof Error ? error.stack ?? error.message : error));
}

async function waitForStopSignal(processes) {
  return await new Promise((resolve) => {
    let stopping = false;

    const shutdown = async (exitCode) => {
      if (stopping) {
        return;
      }
      stopping = true;
      console.log("\nlocal web run: stopping sidecar and web server...");
      await stopAll(processes);
      resolve(exitCode);
    };

    process.once("SIGINT", () => {
      void shutdown(0);
    });
    process.once("SIGTERM", () => {
      void shutdown(0);
    });

    for (const processInfo of processes) {
      processInfo.child.once("exit", (code, signal) => {
        if (!stopping) {
          console.error(`\nlocal web run: ${processInfo.label} exited unexpectedly with ${signal ?? `exit ${code}`}.`);
          void shutdown(code === 0 ? 0 : 1);
        }
      });
    }
  });
}

async function startOnce(config) {
  const env = localRunEnvironment(config);
  const commands = localRunCommands(config);
  const processes = [];

  try {
    console.log(`local web run: starting sidecar ${config.sidecarBaseUrl}`);
    const sidecar = spawnManaged(commands.sidecar[0], commands.sidecar[1], { env });
    processes.push(sidecar);
    await waitForFetch(`${config.sidecarBaseUrl}/healthz`, {
    expectedStatus: 200,
    textIncludes: "solo-superman-sidecar",
    timeoutMs: config.readyTimeoutMs,
    processes
  });
  await waitForFetch(`${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH}`, {
    expectedStatus: 200,
    headers: {
      Authorization: `Bearer ${config.localCapabilityToken}`
    },
    timeoutMs: config.readyTimeoutMs,
    processes
  });
  await waitForFetch(`${config.sidecarBaseUrl}${RUNTIME_STATUS_PATH}`, {
    expectedStatus: 401,
    headers: {
      Authorization: `Bearer ${WRONG_TOKEN}`
    },
    timeoutMs: config.readyTimeoutMs,
    processes
  });

  console.log(`local web run: starting web ${config.webBaseUrl}`);
  const web = spawnManaged(commands.web[0], commands.web[1], { env });
  processes.push(web);
  await waitForFetch(config.webBaseUrl, {
    expectedStatus: 200,
    textIncludes: "Solo Superman",
    timeoutMs: config.readyTimeoutMs,
    processes
  });

  if (config.openBrowser) {
    try {
      await openBrowser(config.webBaseUrl);
      console.log(`local web run: browser opened ${config.webBaseUrl}`);
    } catch (error) {
      console.warn(
        `local web run: 브라우저 자동 열기에 실패했습니다. 아래 주소를 브라우저에 붙여넣으세요.\n${config.webBaseUrl}\n${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    console.log(`local web run: browser auto-open disabled. Open ${config.webBaseUrl}`);
  }

  console.log("\nSolo Superman web 화면이 준비됐습니다.");
  console.log(`URL: ${config.webBaseUrl}`);
  console.log("이 터미널을 열어두세요. 종료하려면 Ctrl+C를 누르세요.");

    const exitCode = await waitForStopSignal(processes);
    process.exit(exitCode);
  } catch (error) {
    await stopAll(processes);
    throw error;
  }
}

export async function runLocalWeb() {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const config = await resolveLocalRunConfig();

    try {
      await startOnce(config);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= 2 || !isLikelyPortConflict(error)) {
        break;
      }

      console.warn("local web run: 포트 충돌 가능성이 있어 빈 포트로 한 번 더 시도합니다.");
    }
  }

  throw lastError ?? new Error("local web run failed");
}

const invokedScriptUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === invokedScriptUrl) {
  runLocalWeb().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    console.error("\n자동 실행에 실패했습니다. 위 오류를 확인한 뒤 README의 한 줄 설치 명령을 새 터미널에서 다시 실행하세요.");
    process.exit(1);
  });
}
