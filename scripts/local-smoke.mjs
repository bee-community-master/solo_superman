import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname } from "node:path";
import { stopManagedProcess } from "./local-processes.mjs";

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

export function diagnosticEnvSnapshot(env, names) {
  return Object.fromEntries(names
    .filter((name) => env[name] !== undefined)
    .map((name) => [name, env[name]]));
}

export function redactConfigSecrets(config, secretNames = ["localCapabilityToken"]) {
  return Object.fromEntries(Object.entries(config).map(([name, value]) => [
    name,
    secretNames.includes(name) ? "<redacted>" : value
  ]));
}

export function createDiagnosticLogger(label, logPath) {
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, `${label} diagnostic log\nstartedAt=${new Date().toISOString()}\n`, "utf8");
  } catch (error) {
    console.warn(`${label}: could not initialize diagnostic log ${logPath}: ${error instanceof Error ? error.message : error}`);
  }

  const write = (message) => {
    try {
      appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
    } catch {
      // Diagnostics must never mask the original smoke failure.
    }
  };

  return {
    output({ label: processLabel, stream, stopping, text }) {
      write(`${processLabel} ${stream}${stopping ? " during cleanup" : ""}: ${text.replace(/\r?\n$/u, "")}`);
    },
    step(message) {
      write(message);
    },
    error(error) {
      write(`ERROR: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
  };
}

export async function assertSmokePortsAvailable(checks, label, options = {}) {
  const listen = options.listen ?? listenOnce;

  for (const [index, check] of checks.entries()) {
    const conflictingCheck = checks.slice(index + 1).find((candidate) => usesSameSmokePort(check, candidate));

    if (conflictingCheck) {
      throw new Error(
        [
          `${label}: ${check.label} and ${conflictingCheck.label} smoke ports conflict before startup:`,
          `${check.host}:${check.port} overlaps ${conflictingCheck.host}:${conflictingCheck.port}.`,
          "Use distinct fixed local ports,",
          `for example ${check.overrideName}=<free-port> and ${conflictingCheck.overrideName}=<another-free-port>.`
        ].join(" ")
      );
    }
  }

  for (const check of checks) {
    const result = await listen(check.host, check.port);

    if (!result.available) {
      throw new Error(
        [
          `${label}: ${check.label} smoke port conflict: ${result.reason}.`,
          `The smoke needs ${check.publicUrl} before it starts managed child processes.`,
          "Stop the existing local dev sidecar/web preview or rerun with a different fixed local port,",
          `for example ${check.overrideName}=<free-port>.`
        ].join(" ")
      );
    }
  }
}

export async function cleanupManagedSmoke(processes, appDataDir, label, options = {}) {
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
    throw new AggregateError(cleanupFailures, `${label} cleanup failed`);
  }
}
