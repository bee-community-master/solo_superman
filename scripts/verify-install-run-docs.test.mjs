import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbook = readFileSync("docs/39-local-install-run-verification.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const englishReadme = readFileSync("README.en.md", "utf8");
const windowsBootstrap = readFileSync("scripts/bootstrap-windows.ps1", "utf8");
const macosBootstrap = readFileSync("scripts/bootstrap-macos.sh", "utf8");
const windowsBlocks = [...runbook.matchAll(/```powershell<br>(.*?)<br>```/gs)].map((match) => match[1]);
const publicRepoUrl = "https://github.com/bee-community-master/solo_superman.git";
const publicRawBase = "https://raw.githubusercontent.com/bee-community-master/solo_superman/main";

describe("#105 local install/run verification docs", () => {
  it("documents macOS and Windows command blocks side by side", () => {
    expect(runbook).toContain("| macOS shell | Windows PowerShell |");
    expect(runbook).toContain("pnpm verify:prod-bundle");
    expect(runbook).toContain("pnpm verify");
  });

  it("uses PowerShell syntax for Windows setup without relying on bash exports", () => {
    expect(runbook).toContain("winget install --id OpenJS.NodeJS.LTS -e");
    expect(runbook).toContain("$env:SOLO_LOCAL_CAPABILITY_TOKEN");
    expect(runbook).toContain("Set-Location .\\solo_superman");
    expect(windowsBlocks.join("\n")).not.toMatch(/\bexport\s+|\bcd\s+solo_superman\b|&&/u);
  });

  it("keeps public bootstrap surfaces on the public GitHub repository", () => {
    for (const surface of [runbook, readme, englishReadme, windowsBootstrap, macosBootstrap]) {
      expect(surface).toContain("bee-community-master/solo_superman");
      expect(surface).not.toContain("raw.githubusercontent.com/HearingOffice/solo_superman");
      expect(surface).not.toContain("https://github.com/HearingOffice/solo_superman.git");
    }

    expect(readme).toContain("언어: 한국어 | [English](README.en.md)");
    expect(readme).toContain(`${publicRawBase}/scripts/bootstrap-windows.ps1`);
    expect(englishReadme).toContain("Language: [한국어](README.md) | English");
    expect(windowsBootstrap).toContain(publicRepoUrl);
    expect(macosBootstrap).toContain(publicRepoUrl);
  });

  it("keeps local token, sidecar URL, prod bundle smoke, and no-API-key defaults explicit", () => {
    expect(runbook).toContain("VITE_SOLO_LOCAL_CAPABILITY_TOKEN");
    expect(runbook).toContain("VITE_SOLO_SIDECAR_BASE_URL");
    expect(runbook).toContain("token mismatch fails visibly with `401`");
    expect(runbook).toContain("does not require an OpenAI or ChatGPT API key by default");
    expect(runbook).toContain("codex login status");
    expect(runbook).toContain("codex auth login");
    expect(runbook).toContain("Open Codex login");
    expect(runbook).toContain("Refresh Codex login status");
  });

  it("covers browser fallback and required troubleshooting cases", () => {
    for (const snippet of [
      "manual browser smoke",
      "Manual Windows PowerShell checklist",
      "managed child processes stopped",
      "temporary app data removed",
      "Port conflict",
      "Token mismatch",
      "CORS/origin",
      "Execution policy",
      "Path quoting",
      "Long path",
      "Antivirus/network prompt"
    ]) {
      expect(runbook).toContain(snippet);
    }
  });
});
