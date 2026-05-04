import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

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

export function createDevEnvironment(env = process.env) {
  return {
    ...env,
    SOLO_LOCAL_CAPABILITY_TOKEN: resolveLocalCapabilityToken(env)
  };
}

export function runDev() {
  const child = spawn(
    "pnpm",
    ["--parallel", "--filter", "@solo-superman/sidecar", "--filter", "@solo-superman/desktop", "dev"],
    {
      env: createDevEnvironment(),
      stdio: "inherit"
    }
  );

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
