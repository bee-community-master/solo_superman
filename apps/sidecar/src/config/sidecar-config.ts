export interface SidecarConfig {
  readonly host: string;
  readonly port: number;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 43110;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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

function parseHost(rawValue: string | undefined) {
  const host = rawValue ?? DEFAULT_HOST;

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(`Sidecar host must be loopback-only in PR-01: ${host}`);
  }

  return host === "[::1]" ? "::1" : host;
}

export function resolveSidecarConfig(): SidecarConfig {
  return {
    host: parseHost(readArgValue("--host") ?? process.env.SOLO_SIDECAR_HOST),
    port: parsePort(readArgValue("--port") ?? process.env.SOLO_SIDECAR_PORT)
  };
}

export function formatSidecarBaseUrl(config: SidecarConfig) {
  const urlHost = config.host.includes(":") ? `[${config.host}]` : config.host;

  return `http://${urlHost}:${config.port}`;
}
