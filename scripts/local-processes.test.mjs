import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { commandLabel, hasProcessExited, stopManagedProcess, windowsShellCommandLine } from "./local-processes.mjs";

function createFakeProcessInfo() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.killSignals = [];
  child.kill = (signal) => {
    child.killSignals.push(signal);
    child.exitCode = 0;
    child.emit("exit", 0, null);
    return true;
  };

  return {
    child,
    label: "fake child",
    logs: [],
    stopping: false
  };
}

describe("local process helpers", () => {
  it("formats command labels consistently", () => {
    expect(commandLabel("pnpm", ["--filter", "@solo-superman/web", "dev"])).toBe("pnpm --filter @solo-superman/web dev");
    expect(commandLabel("pnpm")).toBe("pnpm");
  });

  it("quotes Windows cmd shim paths before sending them through a shell", () => {
    expect(windowsShellCommandLine("C:\\Program Files\\nodejs\\pnpm.CMD", ["-r", "--if-present", "build"])).toBe(
      "\"C:\\Program Files\\nodejs\\pnpm.CMD\" -r --if-present build"
    );
    expect(windowsShellCommandLine("pnpm.cmd", ["--filter", "@solo-superman/web", "dev"])).toBe(
      "pnpm.cmd --filter @solo-superman/web dev"
    );
  });

  it("detects exited managed processes", () => {
    const processInfo = createFakeProcessInfo();

    expect(hasProcessExited(processInfo)).toBe(false);
    processInfo.child.exitCode = 0;
    expect(hasProcessExited(processInfo)).toBe(true);
  });

  it("marks process shutdown and sends a terminate signal", async () => {
    const processInfo = createFakeProcessInfo();

    await stopManagedProcess(processInfo, { platform: "linux", terminateGraceMs: 1, forceKillGraceMs: 1 });

    expect(processInfo.stopping).toBe(true);
    expect(processInfo.child.killSignals).toEqual(["SIGTERM"]);
  });
});
