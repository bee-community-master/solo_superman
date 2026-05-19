import { describe, expect, it } from "vitest";
import {
  defaultLocalBindHost,
  isWslEnvironment,
  normalizeBindHost,
  packageManagerCommand,
  packageManagerSpawn,
  shouldUseShellForCommand
} from "./local-platform.mjs";

describe("local platform helpers", () => {
  it("detects WSL from the Linux WSL environment", () => {
    expect(isWslEnvironment({ WSL_DISTRO_NAME: "Ubuntu" }, "linux")).toBe(true);
    expect(isWslEnvironment({ WSL_INTEROP: "/run/WSL/1_interop" }, "linux")).toBe(true);
    expect(isWslEnvironment({ WSL_DISTRO_NAME: "Ubuntu" }, "win32")).toBe(false);
    expect(defaultLocalBindHost({ WSL_DISTRO_NAME: "Ubuntu" }, "linux")).toBe("0.0.0.0");
    expect(defaultLocalBindHost({}, "linux")).toBe("127.0.0.1");
  });

  it("allows wildcard bind only inside WSL", () => {
    expect(normalizeBindHost("0.0.0.0", "SOLO_LOCAL_RUN_BIND_HOST", { WSL_DISTRO_NAME: "Ubuntu" }, "linux")).toBe("0.0.0.0");
    expect(() => normalizeBindHost("0.0.0.0", "SOLO_LOCAL_RUN_BIND_HOST", {}, "darwin")).toThrow("only when running inside WSL");
  });

  it("uses the active pnpm entrypoint before falling back to bare pnpm", () => {
    const env = {
      npm_execpath: "/opt/pnpm/bin/pnpm.cjs",
      npm_config_user_agent: "pnpm/11.0.4 npm/? node/v24.0.0"
    };

    expect(packageManagerCommand(env, "linux")).toEqual({ command: process.execPath, argsPrefix: ["/opt/pnpm/bin/pnpm.cjs"] });
    expect(packageManagerSpawn(["--filter", "@solo-superman/web", "dev"], env, "linux")).toEqual([
      process.execPath,
      ["/opt/pnpm/bin/pnpm.cjs", "--filter", "@solo-superman/web", "dev"]
    ]);
    expect(packageManagerCommand({}, "win32")).toEqual({ command: "pnpm.cmd", argsPrefix: [] });
  });

  it("honors an explicit pnpm command override", () => {
    expect(packageManagerCommand({ SOLO_PNPM_COMMAND: "C:/Program Files/nodejs/pnpm.cmd" }, "win32")).toEqual({
      command: "C:/Program Files/nodejs/pnpm.cmd",
      argsPrefix: []
    });
  });

  it("runs Windows cmd shims through a shell", () => {
    expect(shouldUseShellForCommand("pnpm.cmd", "win32")).toBe(true);
    expect(shouldUseShellForCommand("pnpm", "win32")).toBe(false);
    expect(shouldUseShellForCommand("pnpm.cmd", "linux")).toBe(false);
  });
});
