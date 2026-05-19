import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL, URL } from "node:url";
import { LOOPBACK_HOSTS, normalizeLoopbackHost, packageManagerSpawn, shouldUseShellForCommand } from "./local-platform.mjs";
import { formatHttpOrigin } from "./local-url.mjs";

const DEFAULT_SIDECAR_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = "43110";

export function resolveLocalCapabilityToken(env = process.env) {
  const explicitToken = env.SOLO_LOCAL_CAPABILITY_TOKEN;

  if (explicitToken === undefined) {
    return randomBytes(32).toString("hex");
  }

  if (explicitToken.trim().length === 0) {
    throw new Error("SOLO_LOCAL_CAPABILITY_TOKEN must not be empty");
  }

  return explicitToken;
}

function normalizeDevLoopbackHost(rawHost) {
  const host = rawHost ?? DEFAULT_SIDECAR_HOST;

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`SOLO_SIDECAR_HOST must be loopback-only for local web dev: ${host}`);
  }

  return normalizeLoopbackHost(host, "SOLO_SIDECAR_HOST");
}

function parseFixedDevPort(rawPort) {
  const port = rawPort ?? DEFAULT_SIDECAR_PORT;

  if (!/^\d+$/.test(port)) {
    throw new Error(`SOLO_SIDECAR_PORT must be a numeric local web dev port: ${port}`);
  }

  const parsed = Number.parseInt(port, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`SOLO_SIDECAR_PORT must be a fixed port between 1 and 65535 for local web dev: ${port}`);
  }

  return String(parsed);
}

function normalizeLoopbackBaseUrl(value) {
  try {
    const url = new URL(value);
    const isLoopbackHost = LOOPBACK_HOSTS.has(url.hostname);
    const hasOnlyOriginParts =
      value === url.origin &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname === "/" &&
      url.search.length === 0 &&
      url.hash.length === 0;

    if (url.protocol === "http:" && isLoopbackHost && url.port.length > 0 && hasOnlyOriginParts) {
      return url.origin;
    }
  } catch {
    // handled below with a stable error message
  }

  throw new Error(`SOLO_SIDECAR_BASE_URL must be an origin-only loopback HTTP URL with an explicit port: ${value}`);
}

export function resolveSidecarBaseUrl(env = process.env) {
  const explicitBaseUrl = env.SOLO_SIDECAR_BASE_URL;

  if (explicitBaseUrl !== undefined) {
    return normalizeLoopbackBaseUrl(explicitBaseUrl);
  }

  const host = normalizeDevLoopbackHost(env.SOLO_SIDECAR_HOST);
  const port = parseFixedDevPort(env.SOLO_SIDECAR_PORT);

  return formatHttpOrigin(host, port);
}

export function createDevEnvironment(env = process.env) {
  const localCapabilityToken = resolveLocalCapabilityToken(env);
  const sidecarBaseUrl = resolveSidecarBaseUrl(env);

  return {
    ...env,
    SOLO_LOCAL_CAPABILITY_TOKEN: localCapabilityToken,
    VITE_SOLO_LOCAL_CAPABILITY_TOKEN: localCapabilityToken,
    VITE_SOLO_SIDECAR_BASE_URL: sidecarBaseUrl
  };
}

export function devCommand(platform = process.platform, env = process.env) {
  return packageManagerSpawn(
    ["--parallel", "--filter", "@solo-superman/sidecar", "--filter", "@solo-superman/web", "dev"],
    env,
    platform
  );
}

export function runDev() {
  const [command, args] = devCommand();
  const child = spawn(command, args, {
    env: createDevEnvironment(),
    shell: shouldUseShellForCommand(command),
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDev();
}
