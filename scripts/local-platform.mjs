import { basename } from "node:path";
import { envValue } from "./local-env.mjs";

export const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isWslEnvironment(env = process.env, platform = process.platform) {
  return platform === "linux" && Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP || env.WSLENV);
}

export function defaultLocalBindHost(env = process.env, platform = process.platform) {
  return isWslEnvironment(env, platform) ? "0.0.0.0" : "127.0.0.1";
}

export function normalizeLoopbackHost(value, name) {
  if (!LOOPBACK_HOSTS.has(value)) {
    throw new Error(`${name} must be loopback-only: ${value}`);
  }

  return value === "[::1]" ? "::1" : value;
}

export function normalizeBindHost(value, name, env = process.env, platform = process.platform) {
  if (value === "0.0.0.0") {
    if (isWslEnvironment(env, platform)) {
      return value;
    }

    throw new Error(`${name} may use 0.0.0.0 only when running inside WSL: ${value}`);
  }

  return normalizeLoopbackHost(value, name);
}

function isPnpmExecPath(value, env) {
  if (!value) {
    return false;
  }

  const userAgent = env.npm_config_user_agent ?? "";
  if (userAgent.toLowerCase().startsWith("pnpm/")) {
    return true;
  }

  return /pnpm(?:\.cjs|\.js|\.cmd|\.ps1)?$/iu.test(basename(value));
}

export function packageManagerCommand(env = process.env, platform = process.platform) {
  const override = envValue(env, "SOLO_PNPM_COMMAND", "");
  if (override) {
    return { command: override, argsPrefix: [] };
  }

  const npmExecPath = envValue(env, "npm_execpath", "");
  if (isPnpmExecPath(npmExecPath, env)) {
    return { command: process.execPath, argsPrefix: [npmExecPath] };
  }

  return { command: platform === "win32" ? "pnpm.cmd" : "pnpm", argsPrefix: [] };
}

export function packageManagerSpawn(commandArgs, env = process.env, platform = process.platform) {
  const plan = packageManagerCommand(env, platform);

  return [plan.command, [...plan.argsPrefix, ...commandArgs]];
}

export function shouldUseShellForCommand(command, platform = process.platform) {
  return platform === "win32" && /\.(?:cmd|bat)$/iu.test(command);
}
