import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  browserOpenCommand,
  findAvailablePort,
  localRunCommands,
  localRunEnvironment,
  pnpmCommand,
  resolveLocalRunConfig
} from "./start-local-web.mjs";

const servers = [];

async function occupyPort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("local web starter", () => {
  it("uses pnpm.cmd on Windows and pnpm elsewhere", () => {
    expect(pnpmCommand("win32")).toBe("pnpm.cmd");
    expect(pnpmCommand("darwin")).toBe("pnpm");
  });

  it("builds platform-specific browser open commands", () => {
    expect(browserOpenCommand("http://127.0.0.1:1420", "darwin")).toEqual({
      command: "open",
      args: ["http://127.0.0.1:1420"]
    });
    expect(browserOpenCommand("http://127.0.0.1:1420", "win32")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "http://127.0.0.1:1420"]
    });
  });

  it("chooses a different local port when the preferred one is already occupied", async () => {
    const preferred = await findAvailablePort(43110);
    await occupyPort(preferred);

    await expect(findAvailablePort(preferred)).resolves.not.toBe(preferred);
  });

  it("creates the shared local token and sidecar URL for the web process", async () => {
    const config = await resolveLocalRunConfig({
      SOLO_LOCAL_CAPABILITY_TOKEN: "shared-local-token",
      SOLO_LOCAL_OPEN_BROWSER: "0"
    });
    const env = localRunEnvironment(config, { PATH: "/usr/bin" });

    expect(config.sidecarBaseUrl).toBe(`http://127.0.0.1:${config.sidecarPort}`);
    expect(config.webBaseUrl).toBe(`http://127.0.0.1:${config.webPort}`);
    expect(env.SOLO_LOCAL_CAPABILITY_TOKEN).toBe("shared-local-token");
    expect(env.VITE_SOLO_LOCAL_CAPABILITY_TOKEN).toBe("shared-local-token");
    expect(env.VITE_SOLO_SIDECAR_BASE_URL).toBe(config.sidecarBaseUrl);
  });

  it("runs sidecar and web on loopback with strict web port", () => {
    const commands = localRunCommands({
      host: "127.0.0.1",
      sidecarPort: "43110",
      webPort: "1420"
    }, "darwin");

    expect(commands.sidecar).toEqual(["pnpm", ["--filter", "@solo-superman/sidecar", "start"]]);
    expect(commands.web).toEqual([
      "pnpm",
      [
        "--filter",
        "@solo-superman/web",
        "exec",
        "vite",
        "--host",
        "127.0.0.1",
        "--port",
        "1420",
        "--strictPort"
      ]
    ]);
  });
});
