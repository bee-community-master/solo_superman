import { spawn } from "node:child_process";
import { shouldUseShellForCommand } from "./local-platform.mjs";

const DEFAULT_TERMINATE_GRACE_MS = 5_000;
const DEFAULT_FORCE_KILL_GRACE_MS = 2_000;

export function commandLabel(command, args = []) {
  return [command, ...args].join(" ");
}

function quoteWindowsShellArgument(value) {
  const text = String(value);

  if (text.length === 0) {
    return "\"\"";
  }

  if (!/[ \t&()^|<>"%]/u.test(text)) {
    return text;
  }

  return `"${text.replace(/"/gu, "\"\"")}"`;
}

export function windowsShellCommandLine(command, args = []) {
  return [command, ...args].map(quoteWindowsShellArgument).join(" ");
}

export function hasProcessExited(processInfo) {
  return processInfo.child.exitCode !== null || processInfo.child.signalCode !== null;
}

export function spawnManagedProcess(command, args, options = {}) {
  const { platform = process.platform, ...spawnOptions } = options;
  const useShell = shouldUseShellForCommand(command, platform);
  const child = spawn(useShell ? windowsShellCommandLine(command, args) : command, useShell ? [] : args, {
    ...spawnOptions,
    shell: useShell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
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

async function taskkillProcessTree(pid, platform = process.platform) {
  if (platform !== "win32" || !pid) {
    return false;
  }

  return await new Promise((resolve) => {
    const child = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function requestProcessStop(processInfo, options) {
  const stoppedTree = await taskkillProcessTree(processInfo.child.pid, options.platform);
  if (!stoppedTree && !hasProcessExited(processInfo)) {
    try {
      processInfo.child.kill(options.force ? "SIGKILL" : "SIGTERM");
    } catch (error) {
      if (!hasProcessExited(processInfo)) {
        throw error;
      }
    }
  }
}

export async function stopManagedProcess(processInfo, options = {}) {
  if (hasProcessExited(processInfo)) {
    return;
  }

  const platform = options.platform ?? process.platform;
  const terminateGraceMs = options.terminateGraceMs ?? DEFAULT_TERMINATE_GRACE_MS;
  const forceKillGraceMs = options.forceKillGraceMs ?? DEFAULT_FORCE_KILL_GRACE_MS;
  processInfo.stopping = true;

  await new Promise((resolve, reject) => {
    let failTimer;
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(killTimer);
      if (failTimer) {
        globalThis.clearTimeout(failTimer);
      }
      resolve();
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(killTimer);
      if (failTimer) {
        globalThis.clearTimeout(failTimer);
      }
      reject(error);
    };
    const killTimer = setTimeout(() => {
      if (hasProcessExited(processInfo)) {
        finish();
        return;
      }
      void requestProcessStop(processInfo, { force: true, platform }).catch(() => {
        // The fail timer below reports a bounded cleanup failure if the process stays alive.
      });
      failTimer = setTimeout(() => {
        if (hasProcessExited(processInfo)) {
          finish();
          return;
        }
        fail(new Error(`${processInfo.label} did not exit after SIGKILL`));
      }, forceKillGraceMs);
    }, terminateGraceMs);

    processInfo.child.once("exit", finish);
    if (hasProcessExited(processInfo)) {
      finish();
      return;
    }

    void requestProcessStop(processInfo, { force: false, platform }).catch(() => {
      // The force-kill timer handles failed first-stop attempts.
    });
  });
}
