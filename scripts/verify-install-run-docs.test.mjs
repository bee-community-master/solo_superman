import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbook = readFileSync("docs/troubleshooting.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const englishReadme = readFileSync("README.en.md", "utf8");
const windowsBootstrap = readFileSync("scripts/bootstrap-windows.ps1", "utf8");
const macosBootstrap = readFileSync("scripts/bootstrap-macos.sh", "utf8");
const windowsBlocks = [...runbook.matchAll(/```powershell\n([\s\S]*?)\n```/g)].map((match) => match[1]);
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


  it("keeps bootstrap Node requirements aligned with package engines", () => {
    expect(readFileSync("package.json", "utf8")).toContain('"node": ">=24.0.0"');
    expect(macosBootstrap).toContain("MIN_NODE_MAJOR=24");
    expect(windowsBootstrap).toContain("$MinNodeMajor = 24");
    expect(readme).toContain("Node 24 이상");
    expect(englishReadme).toContain("Node.js 24 or newer");
    expect(runbook).toContain("Node.js 24+");
  });

  it("keeps local token, sidecar URL, prod bundle smoke, and no-API-key defaults explicit", () => {
    expect(runbook).toContain("VITE_SOLO_LOCAL_CAPABILITY_TOKEN");
    expect(runbook).toContain("VITE_SOLO_SIDECAR_BASE_URL");
    expect(runbook).toContain("token mismatch fails visibly with `401`");
    expect(runbook).toContain("does not require an OpenAI API key or ChatGPT web credential by default");
    expect(runbook).toContain("codex login status");
    expect(runbook).toContain("codex auth login");
    expect(runbook).toContain("Open Codex login");
    expect(runbook).toContain("Refresh Codex login status");
  });

  it("documents and creates a Windows Desktop runner for later local launches", () => {
    expect(readme).toContain("설치 경로, 다시 실행 명령, 바탕화면 실행파일 여부");
    expect(readme).toContain("실제 표시되는 바탕화면 후보들에 `solo_superman.cmd` 실행파일");
    expect(readme).toContain("이미 설치된 경우에도");
    expect(readme).toContain("macOS 설치 프로그램은 바탕화면 실행파일을 만들지 않고");
    expect(englishReadme).toContain("install path, rerun command, and Desktop runner status");
    expect(englishReadme).toContain("checks or recreates `solo_superman.cmd` plus a `solo_superman` shortcut");
    expect(runbook).toContain("Desktop runners named `solo_superman.cmd` and `solo_superman.lnk`");
    expect(runbook).toContain("localized, public, or OneDrive-redirected Desktop folders");
    expect(windowsBootstrap).toContain("function Get-DesktopPaths");
    expect(windowsBootstrap).toContain("function New-DesktopRunner($TargetPath)");
    expect(windowsBootstrap).toContain("function Write-InstallSummary($TargetPath, $DesktopRunnerPaths)");
    expect(windowsBootstrap).toContain("function Wait-ForUserBeforeExit($Reason)");
    expect(windowsBootstrap).toContain("WScript.Shell");
    expect(windowsBootstrap).toContain("User Shell Folders");
    expect(windowsBootstrap).toContain("OneDriveCommercial");
    expect(windowsBootstrap).toContain("바탕 화면");
    expect(windowsBootstrap).toContain('Join-Path $env:PUBLIC "Desktop"');
    expect(windowsBootstrap).toContain('[Environment+SpecialFolder]::DesktopDirectory');
    expect(windowsBootstrap).toContain('Join-Path $desktop "solo_superman.cmd"');
    expect(windowsBootstrap).toContain('Join-Path $desktop "solo_superman.lnk"');
    expect(windowsBootstrap).toContain('"pnpm start:local"');
    expect(windowsBootstrap).toContain("Solo Superman local run has stopped");
    expect(windowsBootstrap).toContain("Read-Host \"이 창을 닫으려면 Enter를 누르세요\"");
    expect(windowsBootstrap).toContain("$DesktopRunnerPaths = @(New-DesktopRunner $TargetPath)");
    expect(macosBootstrap).toContain("print_install_summary");
    expect(macosBootstrap).toContain("macOS 바탕화면 실행파일: 생성하지 않음");
    expect(macosBootstrap).toContain('다시 실행 명령: cd "%s" && pnpm start:local');
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
