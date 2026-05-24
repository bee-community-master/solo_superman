import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  WINDOWS_INSTALLER_DRY_RUN_SCHEMA_VERSION,
  parseWindowsInstallerDryRunArgs,
  runWindowsInstallerDryRun
} from "./verify-windows-installer-dry-run.mjs";

async function writeFixture(root, relativePath, content) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

describe("Windows installer dry-run", () => {
  it("passes when the current one-line installer path keeps every credential-free boundary marker", async () => {
    const evidence = await runWindowsInstallerDryRun();

    expect(evidence).toMatchObject({
      schemaVersion: WINDOWS_INSTALLER_DRY_RUN_SCHEMA_VERSION,
      status: "passed",
      mode: "credential-free-static-dry-run",
      upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
      issues: []
    });
    expect(evidence.checks).toMatchObject({
      one_line_launcher_downloads_bootstrap: true,
      administrator_uac_restart_preserves_options: true,
      node_git_corepack_pnpm_path: true,
      wsl_codex_default_path: true,
      safe_existing_checkout_update: true,
      generated_runner_does_not_block_safe_checkout_update: true,
      desktop_shortcut_start_local_path: true,
      prod_smoke_logs_and_port_retry: true,
      docs_keep_support_bundle_and_manual_checklist: true,
      english_docs_keep_support_bundle_and_manual_checklist: true
    });
  });

  it("reports precise missing markers without running PowerShell", async () => {
    const root = await mkdtemp(join(tmpdir(), "solo-windows-installer-dry-run-test-"));
    try {
      await writeFixture(root, "launcher.ps1", "iex $script\n");
      await writeFixture(root, "bootstrap.ps1", "function Restart-AsAdministrator {}\n");
      await writeFixture(root, ".gitignore", "");
      await writeFixture(root, "README.md", "support:bundle\n");
      await writeFixture(root, "README.en.md", "support:bundle\n");
      await writeFixture(root, "troubleshooting.md", "pnpm support:bundle\n");
      await writeFixture(root, "troubleshooting.en.md", "pnpm support:bundle\n");

      const evidence = await runWindowsInstallerDryRun({
        cwd: root,
        paths: {
          launcher: "launcher.ps1",
          bootstrap: "bootstrap.ps1",
          gitignore: ".gitignore",
          readme: "README.md",
          englishReadme: "README.en.md",
          troubleshooting: "troubleshooting.md",
          englishTroubleshooting: "troubleshooting.en.md"
        }
      });

      expect(evidence.status).toBe("failed");
      expect(evidence.issues).toEqual(expect.arrayContaining([
        expect.stringContaining("one_line_launcher_downloads_bootstrap"),
        expect.stringContaining("node_git_corepack_pnpm_path"),
        expect.stringContaining("docs_keep_support_bundle_and_manual_checklist")
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("parses cwd and help arguments", () => {
    expect(parseWindowsInstallerDryRunArgs(["--cwd", "."])).toMatchObject({ cwd: expect.any(String) });
    expect(parseWindowsInstallerDryRunArgs(["--cwd=."])).toMatchObject({ cwd: expect.any(String) });
    expect(parseWindowsInstallerDryRunArgs(["--help"])).toEqual({ help: true });
    expect(() => parseWindowsInstallerDryRunArgs(["--cwd"])).toThrow("--cwd requires a path value");
  });
});
