import { defaultDevAppDataDir } from "@solo-superman/db";

export interface SidecarConfig {
  readonly host: string;
  readonly port: number;
  readonly localCapabilityToken: string;
  readonly databaseUrl: string | undefined;
  readonly appDataDir: string;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 43110;
const WILDCARD_HOST = "0.0.0.0";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const LOCAL_TOKEN_ENV = "SOLO_LOCAL_CAPABILITY_TOKEN";

function readArgValue(name: string) {
  const prefixed = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefixed));

  if (arg) {
    return arg.slice(prefixed.length);
  }

  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }

  const value = process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing ${name} value`);
  }

  return value;
}

function parsePort(rawValue: string | undefined) {
  if (rawValue === undefined) {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`Invalid sidecar port value: ${rawValue}`);
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid sidecar port value: ${rawValue}`);
  }

  return parsed;
}

function isWslEnvironment(env: NodeJS.ProcessEnv = process.env, platform = process.platform) {
  return platform === "linux" && Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP || env.WSLENV);
}

function parseHost(rawValue: string | undefined, env: NodeJS.ProcessEnv = process.env, platform = process.platform) {
  const host = rawValue ?? DEFAULT_HOST;

  if (host === WILDCARD_HOST && isWslEnvironment(env, platform)) {
    return host;
  }

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Sidecar host must be loopback-only unless running inside WSL: ${host}`);
  }

  return host === "[::1]" ? "::1" : host;
}

function parseLocalCapabilityToken(rawValue: string | undefined) {
  if (rawValue === undefined) {
    throw new Error(`${LOCAL_TOKEN_ENV} must be provided by local bootstrap or dev env`);
  }

  const token = rawValue;

  if (token.trim().length === 0) {
    throw new Error(`${LOCAL_TOKEN_ENV} must not be empty`);
  }

  return token;
}

export function resolveSidecarConfig(): SidecarConfig {
  return {
    host: parseHost(readArgValue("--host") ?? process.env.SOLO_SIDECAR_HOST, process.env, process.platform),
    port: parsePort(readArgValue("--port") ?? process.env.SOLO_SIDECAR_PORT),
    localCapabilityToken: parseLocalCapabilityToken(readArgValue("--local-token") ?? process.env[LOCAL_TOKEN_ENV]),
    databaseUrl: readArgValue("--database-url") ?? process.env.SOLO_DATABASE_URL,
    appDataDir: readArgValue("--app-data-dir") ?? process.env.SOLO_APP_DATA_DIR ?? defaultDevAppDataDir()
  };
}

export function formatSidecarBaseUrl(config: Pick<SidecarConfig, "host" | "port">) {
  const urlHost = config.host.includes(":") ? `[${config.host}]` : config.host;

  return `http://${urlHost}:${config.port}`;
}
