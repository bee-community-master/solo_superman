import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  SUPPORT_BUNDLE_SCHEMA_VERSION,
  createSupportBundle,
  parseSupportBundleArgs,
  redactSupportText,
  writeSupportBundle
} from "./support-bundle.mjs";

function fakeCommandRunner(command, args) {
  const key = [command, ...args].join(" ");
  const outputs = new Map([
    ["git branch --show-current", "main"],
    ["git rev-parse --short HEAD", "abc1234"],
    ["git status --short --branch", "## main...origin/main\n?? local-note.txt"],
    ["git remote get-url origin", "https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/bee-community-master/solo_superman.git?token=secret-value"],
    ["pnpm --version", "11.0.4"],
    ["codex --version", "codex 0.128.0"],
    [`${process.execPath} -e const p=require('./package.json'); console.log(JSON.stringify({name:p.name,version:p.version,packageManager:p.packageManager,engines:p.engines,scripts:{startLocal:p.scripts?.['start:local'],verify:p.scripts?.verify,verifyProdBundle:p.scripts?.['verify:prod-bundle'],supportBundle:p.scripts?.['support:bundle']}}))`, JSON.stringify({
      name: "solo-superman-workspace",
      version: "0.1.0",
      packageManager: "pnpm@11.0.4",
      engines: { node: ">=24.0.0" },
      scripts: { startLocal: "node scripts/start-local-web.mjs", supportBundle: "node scripts/support-bundle.mjs" }
    })]
  ]);

  return Promise.resolve({
    status: outputs.has(key) ? "ok" : "unavailable",
    stdout: outputs.get(key) ?? "",
    stderr: ""
  });
}

describe("support diagnostics bundle", () => {
  it("redacts URL credentials, query secrets, and known token shapes", () => {
    expect(redactSupportText("https://user:ghp_abcdefghijklmnopqrstuvwxyz@github.com/org/repo.git?token=secret-value sk-test_abcdefghijklmnopqrstuv"))
      .toBe("https://<redacted>@github.com/org/repo.git?token=<redacted> <redacted>");
  });

  it("captures credential-free support evidence without dumping secret environment values", async () => {
    const bundle = await createSupportBundle({
      cwd: "/Users/founder/solo_superman",
      homeDir: "/Users/founder",
      env: {
        CI: "true",
        SOLO_CODEX_WINDOWS_MODE: "wsl",
        SOLO_LOCAL_CAPABILITY_TOKEN: "secret-token",
        OPENAI_API_KEY: "sk-secret"
      },
      commandRunner: fakeCommandRunner
    });
    const serialized = JSON.stringify(bundle);

    expect(bundle.schemaVersion).toBe(SUPPORT_BUNDLE_SCHEMA_VERSION);
    expect(bundle.repo.cwd).toBe("~/solo_superman");
    expect(bundle.repo.branch).toBe("main");
    expect(bundle.repo.remoteOrigin).toBe("https://<redacted>@github.com/bee-community-master/solo_superman.git?token=<redacted>");
    expect(bundle.env).toEqual({ CI: "true", SOLO_CODEX_WINDOWS_MODE: "wsl" });
    expect(bundle.package.scripts.supportBundle).toBe("node scripts/support-bundle.mjs");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
  });

  it("parses output path overrides and writes JSON bundles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "solo-support-bundle-test-"));
    try {
      const outputPath = join(dir, "bundle.json");
      expect(parseSupportBundleArgs(["--output", outputPath], {})).toEqual({ outputPath });
      expect(parseSupportBundleArgs(["--", "--output", outputPath], {})).toEqual({ outputPath });
      expect(() => parseSupportBundleArgs(["--output"], {})).toThrow("--output requires a path value");
      await writeSupportBundle(outputPath, { schemaVersion: SUPPORT_BUNDLE_SCHEMA_VERSION, ok: true });
      await expect(readFile(outputPath, "utf8")).resolves.toContain(SUPPORT_BUNDLE_SCHEMA_VERSION);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
