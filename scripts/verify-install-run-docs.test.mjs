import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbook = readFileSync("docs/troubleshooting_KO.md", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
const readme = readFileSync("README.md", "utf8");
const englishReadme = readFileSync("README.en.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const windowsBootstrap = readFileSync("scripts/bootstrap-windows.ps1", "utf8");
const windowsLauncher = readFileSync("scripts/win.ps1", "utf8");
const macosBootstrap = readFileSync("scripts/bootstrap-macos.sh", "utf8");
const releaseChannelDoc = readFileSync("docs/release-channel_KO.md", "utf8");
const releaseChannelExample = readFileSync("docs/release-update-channel.example.json", "utf8");
const packagedUpdateRollbackDoc = readFileSync("docs/packaged-update-rollback_KO.md", "utf8");
const packagedUpdateRollbackExample = readFileSync("docs/packaged-update-rollback.example.json", "utf8");
const windowsRealDeviceDoc = readFileSync("docs/windows-real-device_KO.md", "utf8");
const windowsRealDeviceExample = readFileSync("docs/windows-real-device.example.json", "utf8");
const signedPackagesDoc = readFileSync("docs/signed-packages_KO.md", "utf8");
const signedPackagePreflightExample = readFileSync("docs/signed-package-preflight.example.json", "utf8");
const signedPackageReleaseDoc = readFileSync("docs/signed-package-release_KO.md", "utf8");
const signedPackageReleaseExample = readFileSync("docs/signed-package-release.example.json", "utf8");
const contributingDoc = readFileSync("docs/contributing_KO.md", "utf8");
const englishContributingDoc = readFileSync("docs/contributing_EN.md", "utf8");
const windowsBlocks = [...runbook.matchAll(/```powershell\n([\s\S]*?)\n```/g)].map((match) => match[1]);
const publicRepoUrl = "https://github.com/bee-community-master/solo_superman.git";
const publicRawBase = "https://raw.githubusercontent.com/bee-community-master/solo_superman/main";

function extractExpectedRepoRemotePatterns() {
  const start = windowsBootstrap.indexOf("function Normalize-RepoRemotePath");
  const end = windowsBootstrap.indexOf("function Test-ExpectedRepo", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  const normalizeFunction = windowsBootstrap.slice(start, end);
  const patternLiteral = /"(\^(?:https:\/\/github\\\.com\/|git@github\\\.com:|ssh:\/\/git@github\\\.com\/)[^"]+)"/gu;
  return [...normalizeFunction.matchAll(patternLiteral)].map((match) => match[1]);
}

function normalizeRepoRemoteForTest(remote, patterns) {
  const normalized = remote.trim().replaceAll("\\", "/").replace(/\/+$/u, "");
  for (const pattern of patterns) {
    const match = new RegExp(pattern, "iu").exec(normalized);
    if (match?.groups) {
      return `${match.groups.owner}/${match.groups.repo}`;
    }
  }

  return null;
}

describe("#105 local install/run verification docs", () => {
  it("documents macOS and Windows command blocks side by side", () => {
    expect(runbook).toContain("| macOS shell | Windows PowerShell |");
    expect(runbook).toContain("pnpm verify:prod-bundle");
    expect(runbook).toContain("pnpm verify");
  });

  it("uses PowerShell syntax for Windows setup without relying on bash exports", () => {
    expect(runbook).toContain("winget install --id OpenJS.NodeJS.LTS -e");
    expect(runbook).toContain("winget upgrade --id OpenJS.NodeJS.LTS -e");
    expect(runbook).toContain("$env:SOLO_LOCAL_CAPABILITY_TOKEN");
    expect(runbook).toContain('Set-Location "$HOME\\solo_superman"');
    expect(runbook).toContain("pnpm.cmd --version");
    expect(runbook).toContain("pnpm.cmd verify:prod-bundle");
    expect(windowsBlocks.join("\n")).not.toMatch(/\bexport\s+|\bcd\s+solo_superman\b|&&/u);
  });

  it("keeps public bootstrap surfaces on the public GitHub repository", () => {
    for (const surface of [runbook, readme, englishReadme, windowsBootstrap, windowsLauncher, macosBootstrap]) {
      expect(surface).toContain("bee-community-master/solo_superman");
      expect(surface).not.toContain("raw.githubusercontent.com/HearingOffice/solo_superman");
      expect(surface).not.toContain("https://github.com/HearingOffice/solo_superman.git");
    }

    expect(readme).toContain("언어: 한국어 | [English](README.en.md)");
    expect(readme).toContain(`irm ${publicRawBase}/scripts/win.ps1 | iex`);
    expect(readme).toContain("작은 Windows launcher");
    expect(readme).not.toContain("New-Object System.Text.UTF8Encoding");
    expect(readme).toContain('Set-Location "$HOME\\solo_superman"; pnpm.cmd start:local');
    expect(readme).toContain("설치 완료 메시지에 표시된 다시 실행 명령");
    expect(readme).toContain("clean checkout이면 같은 한 줄 설치 명령을 다시 실행할 때");
    expect(readme).toContain("패키지 앱 업데이트 채널");
    expect(readme).toContain("`pnpm verify:release-channel`");
    expect(readme).toContain("패키지 업데이트 rollback runtime/evidence 계약");
    expect(readme).toContain("`pnpm verify:packaged-update-rollback`");
    expect(readme).toContain("`pnpm verify:packaged-update-rollback:dry-run`");
    expect(readme).toContain("Windows 실기기 설치 evidence 계약");
    expect(readme).toContain("`pnpm verify:windows-real-device`");
    expect(readme).toContain("`pnpm verify:windows-installer:dry-run`");
    expect(readme).toContain("서명된 설치 패키지 preflight");
    expect(readme).toContain("`pnpm verify:signed-package-preflight`");
    expect(readme).toContain("서명된 패키지 release evidence 계약");
    expect(readme).toContain("`pnpm verify:signed-package-release`");
    expect(readme).toContain("`pnpm verify:signed-package-release:dry-run`");
    expect(releaseChannelDoc).toContain("Git checkout technical preview");
    expect(releaseChannelDoc).toContain("Packaged app release");
    expect(releaseChannelDoc).toContain("서명된 manifest, artifact checksum, artifact signature");
    expect(releaseChannelExample).toContain('"schemaVersion": "solo-superman-release-update-manifest.v1"');
    expect(packagedUpdateRollbackDoc).toContain("rollback_after_failed_launch");
    expect(packagedUpdateRollbackDoc).toContain("pnpm verify:packaged-update-rollback:dry-run");
    expect(packagedUpdateRollbackExample).toContain('"schemaVersion": "solo-superman-packaged-update-rollback.v1"');
    expect(packagedUpdateRollbackExample).toContain('"pnpm verify:packaged-update-rollback:dry-run"');
    expect(windowsRealDeviceDoc).toContain("run_administrator_powershell_one_line_installer");
    expect(windowsRealDeviceDoc).toContain("pnpm verify:windows-installer:dry-run");
    expect(windowsRealDeviceExample).toContain('"schemaVersion": "solo-superman-windows-real-device.v1"');
    expect(windowsRealDeviceExample).toContain('"pnpm verify:windows-installer:dry-run"');
    expect(signedPackagesDoc).toContain("macos-dmg");
    expect(signedPackagesDoc).toContain("windows-msi");
    expect(signedPackagesDoc).toContain("credential-free default preflight");
    expect(signedPackagePreflightExample).toContain('"schemaVersion": "solo-superman-signed-package-preflight.v1"');
    expect(signedPackagePreflightExample).toContain('"pnpm verify:signed-package-release:dry-run"');
    expect(signedPackageReleaseDoc).toContain("release_manifest_signature_verify");
    expect(signedPackageReleaseDoc).toContain("pnpm verify:signed-package-release:dry-run");
    expect(signedPackageReleaseExample).toContain('"schemaVersion": "solo-superman-signed-package-release.v1"');
    expect(signedPackageReleaseExample).toContain('"pnpm verify:signed-package-release:dry-run"');
    expect(englishReadme).toContain("Language: [한국어](README.md) | English");
    expect(englishReadme).toContain(`irm ${publicRawBase}/scripts/win.ps1 | iex`);
    expect(englishReadme).toContain("tiny Windows launcher");
    expect(englishReadme).not.toContain("New-Object System.Text.UTF8Encoding");
    expect(englishReadme).toContain('Set-Location "$HOME\\solo_superman"; pnpm.cmd start:local');
    expect(englishReadme).toContain("use the rerun command printed by the installer");
    expect(englishReadme).toContain("existing install folder is a clean checkout");
    expect(englishReadme).toContain("Packaged app update channel contract");
    expect(englishReadme).toContain("`pnpm verify:release-channel`");
    expect(englishReadme).toContain("Packaged update rollback runtime/evidence contract");
    expect(englishReadme).toContain("`pnpm verify:packaged-update-rollback`");
    expect(englishReadme).toContain("`pnpm verify:packaged-update-rollback:dry-run`");
    expect(englishReadme).toContain("Windows real-device install evidence contract");
    expect(englishReadme).toContain("`pnpm verify:windows-real-device`");
    expect(englishReadme).toContain("`pnpm verify:windows-installer:dry-run`");
    expect(englishReadme).toContain("Signed installer package preflight");
    expect(englishReadme).toContain("`pnpm verify:signed-package-preflight`");
    expect(englishReadme).toContain("Signed package release evidence contract");
    expect(englishReadme).toContain("`pnpm verify:signed-package-release`");
    expect(englishReadme).toContain("`pnpm verify:signed-package-release:dry-run`");
    expect(windowsLauncher).toContain(`${publicRawBase}/scripts/bootstrap-windows.ps1`);
    expect(windowsLauncher).toContain("[Console]::OutputEncoding");
    expect(windowsLauncher).toContain("[Net.ServicePointManager]::SecurityProtocol");
    expect(windowsLauncher).toContain("Net.WebClient");
    expect(windowsLauncher).toContain("$wc.Encoding = $utf8");
    expect(windowsLauncher).toContain("if ($script.Length -gt 0 -and $script[0] -eq [char]0xFEFF)");
    expect(windowsBootstrap).toContain(`irm ${publicRawBase}/scripts/win.ps1 | iex`);
    expect(readme).not.toContain(`${publicRawBase}/scripts/bootstrap-windows.ps1 | iex`);
    expect(englishReadme).not.toContain(`${publicRawBase}/scripts/bootstrap-windows.ps1 | iex`);
    expect(windowsBootstrap).toContain(publicRepoUrl);
    expect(macosBootstrap).toContain(publicRepoUrl);
  });

  it("keeps bootstrap Node requirements aligned with package engines", () => {
    expect(packageJson).toContain('"node": ">=24.0.0"');
    expect(macosBootstrap).toContain("MIN_NODE_MAJOR=24");
    expect(windowsBootstrap).toContain("$MinNodeMajor = 24");
    expect(windowsBootstrap).toContain("function Upgrade-WingetPackage");
    expect(windowsBootstrap).toContain('Upgrade-WingetPackage "node" "OpenJS.NodeJS.LTS"');
    expect(windowsBootstrap).toContain("winget upgrade --id OpenJS.NodeJS.LTS -e");
    expect(readme).toContain("Node 24 이상");
    expect(englishReadme).toContain("Node.js 24 or newer");
    expect(runbook).toContain("Node.js 24+");
  });

  it("keeps local token, sidecar URL, prod bundle smoke, and no-API-key defaults explicit", () => {
    expect(runbook).toContain("VITE_SOLO_LOCAL_CAPABILITY_TOKEN");
    expect(runbook).toContain("VITE_SOLO_SIDECAR_BASE_URL");
    expect(runbook).toContain("token mismatch fails visibly with `401`");
    expect(runbook).toContain("OpenAI API key, ChatGPT web credential, ChatGPT Pro session이 필요하지 않습니다");
    expect(runbook).toContain("codex login status");
    expect(runbook).toContain("codex auth login");
    expect(runbook).toContain("Open Codex login");
    expect(runbook).toContain("Refresh Codex login status");
  });

  it("documents credential-free support bundles for error reports", () => {
    expect(packageJson).toContain('"support:bundle": "node scripts/support-bundle.mjs"');
    expect(readme).toContain("오류 리포트용 로컬 진단 번들");
    expect(readme).toContain("`pnpm support:bundle`");
    expect(englishReadme).toContain("Local diagnostics bundle for error reports");
    expect(englishReadme).toContain("`pnpm support:bundle`");
    expect(runbook).toContain("## 오류 리포트용 support bundle");
    expect(runbook).toContain("pnpm support:bundle -- --output ./solo-superman-support-bundle.json");
    expect(runbook).toContain("pnpm.cmd support:bundle");
    expect(runbook).toContain("verify:release-readiness`/`verify:ready-release -- --plan-only`/`verify:release-evidence-template`/`verify:release-evidence-bundle`의 credential-free product/release diagnostics summary");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("`verify:release-readiness`, `verify:ready-release -- --plan-only`, `verify:release-evidence-template`, and `verify:release-evidence-bundle` only");
    expect(runbook).toContain("ready-release plan-only summary에는 bundle preparation command와 planned command list만 담습니다");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("ready-release plan-only summary keeps only the bundle preparation command plus planned command list");
    expect(runbook).toContain("recommended checks의 `pnpm verify:codex-live-runtime`");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("recommended `pnpm verify:codex-live-runtime` check");
    expect(runbook).toContain("recommended checks의 `pnpm verify:ready-release -- --plan-only`");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("recommended `pnpm verify:ready-release -- --plan-only` check");
    expect(runbook).toContain("Full environment dump, file contents, browser cookies");
    expect(runbook).toContain("OpenAI/GitHub token, ChatGPT web credential은 수집하지 않으며");
  });

  it("documents the release evidence checklist for external release gates", () => {
    expect(packageJson).toContain('"release:evidence-checklist": "node scripts/release-evidence-checklist.mjs"');
    expect(packageJson).toContain('"release:evidence-bundle": "node scripts/release-evidence-checklist.mjs --bundle-dir"');
    expect(packageJson).toContain('"verify:release-evidence-template": "node scripts/verify-release-evidence-template.mjs"');
    expect(packageJson).toContain('"verify:release-evidence-bundle": "node scripts/verify-release-evidence-bundle.mjs"');
    expect(readme).toContain("`pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json`");
    expect(readme).toContain("`pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md`");
    expect(readme).toContain("`pnpm release:evidence-checklist -- --format comment --issue 267 --output ./issue-267-release-evidence-comment.md`");
    expect(readme).toContain("`comment` 형식은 evidence item이 없는 잘못된 이슈 번호에서 실패합니다");
    expect(readme).toContain("`pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle`");
    expect(readme).toContain("`pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle`");
    expect(readme).toContain("`--require-ready`");
    expect(readme).toContain("`pnpm release:evidence-checklist -- --format template --issue 266 --output ./issue-266-release-evidence-template.json`");
    expect(readme).toContain("`pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json`");
    expect(readme).toContain("required ready-release command 실행 기록");
    expect(englishReadme).toContain("`pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json`");
    expect(englishReadme).toContain("`pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md`");
    expect(englishReadme).toContain("`pnpm release:evidence-checklist -- --format comment --issue 267 --output ./issue-267-release-evidence-comment.md`");
    expect(englishReadme).toContain("The `comment` format fails for mistyped issue numbers that have no evidence items");
    expect(englishReadme).toContain("`pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle`");
    expect(englishReadme).toContain("`pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle`");
    expect(englishReadme).toContain("`--require-ready`");
    expect(englishReadme).toContain("`pnpm release:evidence-checklist -- --format template --issue 266 --output ./issue-266-release-evidence-template.json`");
    expect(englishReadme).toContain("`pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json`");
    expect(englishReadme).toContain("required ready-release command records");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("## Release evidence checklist");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("release:evidence-bundle");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("--format comment --issue 267");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("빈 comment를 만들기 전에 실패합니다");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("--format template --issue 266");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("verify:release-evidence-template -- --input");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("verify:release-evidence-bundle -- --bundle-dir");
    expect(readFileSync("docs/release-readiness_KO.md", "utf8")).toContain("모든 ready-release command 실행 기록");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("## Release evidence checklist");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("release:evidence-bundle");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("--format comment --issue 267");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("fails before an empty comment is written");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("--format template --issue 266");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("verify:release-evidence-template -- --input");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("verify:release-evidence-bundle -- --bundle-dir");
    expect(readFileSync("docs/release-readiness_EN.md", "utf8")).toContain("records every ready-release command");
    expect(runbook).toContain("모든 ready-release command 실행 기록");
    expect(runbook).toContain("pnpm release:evidence-bundle");
    expect(runbook).toContain("pnpm verify:release-evidence-bundle -- --bundle-dir");
    expect(runbook).toContain("--format comment --issue 267");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("every ready-release command is recorded");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("pnpm release:evidence-bundle");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("pnpm verify:release-evidence-bundle -- --bundle-dir");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("--format comment --issue 267");
    expect(contributingDoc).toContain("`pnpm release:evidence-checklist -- --format markdown --issue <number>` / `pnpm release:evidence-checklist -- --format comment --issue <number>` / `pnpm release:evidence-checklist -- --format template --issue <number>`");
    expect(englishContributingDoc).toContain("`pnpm release:evidence-checklist -- --format markdown --issue <number>` / `pnpm release:evidence-checklist -- --format comment --issue <number>` / `pnpm release:evidence-checklist -- --format template --issue <number>`");
    expect(contributingDoc).toContain("`pnpm release:evidence-bundle -- <bundle-dir>`");
    expect(englishContributingDoc).toContain("`pnpm release:evidence-bundle -- <bundle-dir>`");
    expect(contributingDoc).toContain("`pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> [--require-ready]`");
    expect(englishContributingDoc).toContain("`pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> [--require-ready]`");
    expect(contributingDoc).toContain("`pnpm verify:release-evidence-template -- --input <filled-template.json>`");
    expect(englishContributingDoc).toContain("`pnpm verify:release-evidence-template -- --input <filled-template.json>`");
    expect(runbook).toContain("pnpm verify:release-evidence-template -- --input");
    expect(runbook).toContain("pnpm.cmd verify:release-evidence-bundle");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("pnpm verify:release-evidence-template -- --input");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("pnpm.cmd verify:release-evidence-template");
    expect(readFileSync("docs/troubleshooting_EN.md", "utf8")).toContain("pnpm.cmd verify:release-evidence-bundle");
  });

  it("installs Codex CLI on Windows and prompts for the optional Codex desktop app", () => {
    expect(readme).toContain("Corepack/pnpm, Windows native runtime, Codex CLI");
    expect(readme).toContain("Codex CLI는 안정성을 위해 WSL(Ubuntu) 안에 설치");
    expect(readme).toContain("SOLO_CODEX_WINDOWS_MODE=wsl");
    expect(readme).toContain("Codex CLI가 `codex --version`으로 검증되면");
    expect(readme).toContain("`already exists` 충돌");
    expect(readme).toContain("Codex Desktop App 다운로드 안내 창");
    expect(englishReadme).toContain("Corepack/pnpm, Windows native runtime, and Codex CLI");
    expect(englishReadme).toContain("installs and runs Codex CLI inside WSL");
    expect(englishReadme).toContain("SOLO_CODEX_WINDOWS_MODE=wsl");
    expect(englishReadme).toContain("existing Codex CLI passes `codex --version`");
    expect(englishReadme).toContain("`already exists` conflict");
    expect(englishReadme).toContain("Codex Desktop App download prompt");
    expect(runbook).toContain("wsl --set-default-version 2");
    expect(runbook).toContain("wsl --install -d Ubuntu");
    expect(runbook).toContain("Ubuntu 첫 실행 Linux 사용자 이름/비밀번호");
    expect(runbook).toContain("같은 한 줄 명령");
    expect(runbook).toContain("nvm use 22");
    expect(runbook).toContain("nvm install 22");
    expect(runbook).toContain("command -v codex");
    expect(runbook).toContain("SOLO_CODEX_WINDOWS_MODE=wsl");
    expect(runbook).toContain("wsl.exe -d <배포판> -- bash -lc");
    expect(runbook).toContain("npm install -g @openai/codex@latest");
    expect(runbook).toContain("Microsoft.VCRedist.2015+.x64");
    expect(runbook).toContain("vcruntime140.dll");
    expect(runbook).toContain("@libsql/win32-x64-msvc");
    expect(runbook).toContain("codex --version");
    expect(runbook).toContain("codex.cmd --version failed with exit -1073741515");
    expect(runbook).toContain("0xC0000135");
    expect(runbook).toContain("https://openai.com/codex/");
    expect(runbook).toContain("바이브 코딩이나 여러 agent 병렬 작업");
    expect(windowsBootstrap).toContain("$CodexDesktopAppUrl");
    expect(windowsBootstrap).toContain("$CodexWindowsMode");
    expect(windowsBootstrap).toContain("$CodexWslDistro");
    expect(windowsBootstrap).toContain('"SOLO_SUPERMAN_CODEX_WSL_DISTRO"');
    expect(windowsBootstrap).toContain("function Invoke-Pnpm");
    expect(windowsBootstrap).toContain("SOLO_PNPM_COMMAND");
    expect(windowsBootstrap).toContain("function Get-PnpmVersion");
    expect(windowsBootstrap).toContain("function Use-ExistingPnpmIfReady");
    expect(windowsBootstrap).toContain("after corepack failure");
    expect(windowsBootstrap).toContain("after npm fallback failure");
    expect(windowsBootstrap).toContain("function Test-PortConflictError");
    expect(windowsBootstrap).toContain("function Initialize-Utf8Console");
    expect(windowsBootstrap).toContain("chcp.com 65001");
    expect(windowsBootstrap).toContain("$global:OutputEncoding");
    expect(windowsBootstrap).toContain('Join-Path $env:USERPROFILE "solo_superman"');
    expect(windowsBootstrap).toContain("function Invoke-CheckedNoOutput");
    expect(windowsBootstrap).toContain("function Invoke-ToolNoOutput");
    expect(windowsBootstrap).toContain("$nativeErrorActionPreference = $ErrorActionPreference");
    expect(windowsBootstrap).toContain("$ErrorActionPreference = \"Continue\"");
    expect(windowsBootstrap).toContain("function ConvertTo-BashSingleQuotedLiteral");
    expect(windowsBootstrap).toContain("$quotedNvmInstallUrl = ConvertTo-BashSingleQuotedLiteral $CodexNvmInstallUrl");
    expect(windowsBootstrap).toContain('Replace("__NVM_INSTALL_URL__", $quotedNvmInstallUrl)');
    expect(windowsBootstrap).toContain("function Ensure-WindowsNativeRuntime");
    expect(windowsBootstrap).toContain("function Get-ProdSmokePortConflicts");
    expect(windowsBootstrap).toContain("function Invoke-ProdSmokeWithAlternatePorts");
    expect(windowsBootstrap).toContain("vcruntime140_1.dll");
    expect(windowsBootstrap).toContain("function Ensure-WslForCodex");
    expect(windowsBootstrap).toContain("function Set-WslDefaultsForCodex");
    expect(windowsBootstrap).toContain('Invoke-ToolNoOutput "wsl" @("--set-default-version", "2")');
    expect(windowsBootstrap).toContain('Invoke-ToolNoOutput "wsl" @("--set-default", $targetDistro)');
    expect(windowsBootstrap).toContain('Invoke-Tool "wsl" @("--install", "-d", $CodexWslDistro)');
    expect(windowsBootstrap).toContain("WSL/$CodexWslDistro 첫 설치를 시작했습니다");
    expect(windowsBootstrap).toContain("같은 한 줄 명령을 다시 실행하세요");
    expect(windowsBootstrap).toContain("function Ensure-CodexCliInWsl");
    expect(windowsBootstrap).toContain("function Write-LfUtf8NoBomFile");
    expect(windowsBootstrap).toContain("function ConvertTo-WslpathInput");
    expect(windowsBootstrap).toContain('Replace("\\", "/")');
    expect(windowsBootstrap).toContain("function ConvertTo-DefaultWslMountPath");
    expect(windowsBootstrap).toContain('return "/mnt/$drive/$relativePath"');
    expect(windowsBootstrap).toContain("function Get-WslPath");
    expect(windowsBootstrap).toContain("function Invoke-WslScript");
    expect(windowsBootstrap).toContain('"wslpath", "-a"');
    expect(windowsBootstrap).toContain("$wslpathInput");
    expect(windowsBootstrap).toContain("/mnt/<drive> fallback");
    expect(windowsBootstrap).toContain('codex-wsl-install-$PID-$DiagnosticTimestamp.sh');
    expect(windowsBootstrap).toContain('Invoke-Tool "wsl" @("--", "bash", $wslScriptPath)');
    expect(windowsBootstrap).toContain("Invoke-WslScript $installScript");
    expect(windowsBootstrap).not.toContain("Invoke-WslBash $installScript");
    expect(windowsBootstrap).toContain('wsl_home="${HOME:-}"');
    expect(windowsBootstrap).toContain('getent passwd "$(id -u)"');
    expect(windowsBootstrap).toContain('export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"');
    expect(windowsBootstrap).toContain("nvm.sh not found at $NVM_DIR/nvm.sh after nvm install.");
    expect(windowsBootstrap).toContain("use_node_major");
    expect(windowsBootstrap).toContain("ensure_node_major");
    expect(windowsBootstrap).toContain("nvm use __NODE_MAJOR__");
    expect(windowsBootstrap).toContain("nvm install __NODE_MAJOR__");
    expect(windowsBootstrap).toContain("nvm install __NODE_MAJOR__ failed; checking existing Node __NODE_MAJOR__.");
    expect(windowsBootstrap).toContain("use_existing_codex_if_ready");
    expect(windowsBootstrap).toContain("command -v codex");
    expect(windowsBootstrap).toContain("Codex CLI already installed");
    expect(windowsBootstrap).toContain("npm global Codex CLI install failed; checking existing codex command.");
    expect(windowsBootstrap).toContain("SOLO_CODEX_WINDOWS_MODE");
    expect(windowsBootstrap).toContain('"wsl"');
    expect(windowsBootstrap).toContain('Invoke-WslBash "true"');
    expect(windowsBootstrap).not.toContain("printf solo-superman-wsl-ready");
    expect(windowsBootstrap).toContain("function Ensure-CodexCli");
    expect(windowsBootstrap).toContain("function Test-CodexNativeRuntimeFailure");
    expect(windowsBootstrap).toContain("function Install-CodexNativeRuntime");
    expect(windowsBootstrap).toContain("function Get-CodexNativeVersion");
    expect(windowsBootstrap).toContain("function Use-ExistingCodexNativeIfReady");
    expect(windowsBootstrap).toContain("function Confirm-CodexNativeVersion");
    expect(windowsBootstrap).toContain("function Ensure-CodexCliNative");
    expect(windowsBootstrap).toContain('Invoke-Tool "npm" @("install", "-g", "@openai/codex@latest")');
    expect(windowsBootstrap).toContain("after codex npm fallback failure");
    expect(windowsBootstrap).toContain('Invoke-Tool "codex" @("--version")');
    expect(windowsBootstrap).toContain('"Microsoft.VCRedist.2015+.x64"');
    expect(windowsBootstrap).toContain("-1073741515");
    expect(windowsBootstrap).toContain("0xC0000135");
    expect(windowsBootstrap).toContain("function Show-CodexDesktopAppPrompt");
    expect(windowsBootstrap).toContain("Start-Process $CodexDesktopAppUrl");
    expect(windowsBootstrap).toContain("Codex Desktop App for Windows");
    expect(windowsBootstrap).toContain("Ensure-CodexCli");
    expect(windowsBootstrap).toContain("Show-CodexDesktopAppPrompt");
  });

  it("documents and creates a Windows Desktop runner for later local launches", () => {
    expect(readme).toContain("설치 경로, 다시 실행 명령, 바탕화면 바로가기 여부");
    expect(readme).toContain("PowerShell을 **관리자 권한으로 실행**");
    expect(readme).toContain("관리자 PowerShell로 자동 재실행");
    expect(readme).toContain("바탕화면에 `solo_superman` 바로가기 하나만");
    expect(readme).toContain("중복 바탕화면 `solo_superman.cmd`/`solo_superman.lnk`는 정리");
    expect(readme).toContain("이미 설치된 경우에도");
    expect(readme).toContain("Enter를 눌러 닫게 합니다");
    expect(readme).toContain("macOS 설치 프로그램은 바탕화면 실행파일을 만들지 않고");
    expect(englishReadme).toContain("install path, rerun command, and Desktop shortcut status");
    expect(englishReadme).toContain("Run PowerShell **as Administrator**");
    expect(englishReadme).toContain("relaunches itself in an administrator PowerShell");
    expect(englishReadme).toContain("keeps only one visible `solo_superman` Desktop shortcut");
    expect(englishReadme).toContain("duplicate Desktop `solo_superman.cmd`/`solo_superman.lnk`");
    expect(englishReadme).toContain("waits for Enter before closing");
    expect(runbook).toContain("바탕화면에 Solo Superman 바로가기 `solo_superman.lnk` 하나만");
    expect(runbook).toContain("중복 `solo_superman.cmd`/`solo_superman.lnk`는 정리");
    expect(runbook).toContain("Enter를 누를 때까지 닫히지 않습니다");
    expect(runbook).toContain("UAC prompt를 여는지");
    expect(runbook).toContain("C:\\Program Files\\nodejs");
    expect(windowsBootstrap).toContain("function Test-IsAdministrator");
    expect(windowsBootstrap).toContain("function Restart-AsAdministrator");
    expect(windowsBootstrap).toContain("Start-Process -FilePath $powershell");
    expect(windowsBootstrap).toContain("-Verb RunAs");
    expect(windowsBootstrap).toContain("-EncodedCommand");
    expect(windowsBootstrap).toContain('"SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL"');
    expect(windowsBootstrap).toContain("function Add-BootstrapUrlOverrideToCommand");
    expect(windowsBootstrap).toContain('if (-not $env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL) {');
    expect(windowsBootstrap).toContain(
      "$quotedBootstrapUrl = ConvertTo-PowerShellLiteral $env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL"
    );
    expect(windowsBootstrap).toContain(
      '$BootstrapCommand = Add-BootstrapUrlOverrideToCommand'
    );
    expect(windowsBootstrap).toContain("Restart-AsAdministrator");
    expect(windowsBootstrap).toContain("function Normalize-RepoRemotePath");
    expect(windowsBootstrap).toContain("function Update-ExistingCheckoutSafely");
    expect(windowsBootstrap).toContain('fetch", "--prune", "origin');
    expect(windowsBootstrap).toContain("safe fast-forward update");
    expect(windowsBootstrap).toContain("local 변경/untracked 파일");
    expect(gitignore).toContain("/solo_superman.cmd");
    expect(macosBootstrap).toContain("safe_update_existing_checkout");
    expect(macosBootstrap).toContain("fetch --prune origin");
    expect(macosBootstrap).toContain("safe fast-forward update");
    expect(macosBootstrap).toContain("local 변경/untracked 파일");
    expect(windowsBootstrap).toContain("[System.StringComparison]::OrdinalIgnoreCase");
    expect(windowsBootstrap).toContain('"bee-community-master/solo_superman"');
    expect(windowsBootstrap).toContain('"HearingOffice/solo_superman"');
    const repoRemotePatterns = extractExpectedRepoRemotePatterns();
    expect(repoRemotePatterns).toEqual([
      "^https://github\\.com/(?<owner>[^/]+)/(?<repo>[^/#?]+?)(?:\\.git)?$",
      "^git@github\\.com:(?<owner>[^/]+)/(?<repo>[^/#?]+?)(?:\\.git)?$",
      "^ssh://git@github\\.com/(?<owner>[^/]+)/(?<repo>[^/#?]+?)(?:\\.git)?$"
    ]);
    for (const remote of [
      "https://github.com/bee-community-master/solo_superman.git",
      "git@github.com:bee-community-master/solo_superman.git",
      "ssh://git@github.com/bee-community-master/solo_superman.git"
    ]) {
      expect(normalizeRepoRemoteForTest(remote, repoRemotePatterns)).toBe("bee-community-master/solo_superman");
    }
    for (const remote of [
      "https://evil.example/github.com/bee-community-master/solo_superman.git",
      "file:///tmp/github.com/bee-community-master/solo_superman.git"
    ]) {
      expect(normalizeRepoRemoteForTest(remote, repoRemotePatterns)).toBeNull();
    }
    expect(windowsBootstrap).not.toContain('remote -like "*bee-community-master/solo_superman*"');
    expect(windowsBootstrap).toContain("function Get-DesktopPaths");
    expect(windowsBootstrap).toContain("function Remove-LegacyDesktopRunners");
    expect(windowsBootstrap).toContain("function New-DesktopRunner($TargetPath)");
    expect(windowsBootstrap).toContain("function Write-InstallSummary($TargetPath, $DesktopRunnerPaths)");
    expect(windowsBootstrap).toContain("function Wait-ForUserBeforeExit($Reason)");
    expect(windowsBootstrap).toContain("ConvertTo-CmdEchoValue $BootstrapCommand");
    expect(windowsBootstrap).toContain("WScript.Shell");
    expect(windowsBootstrap).toContain("User Shell Folders");
    expect(windowsBootstrap).toContain("OneDriveCommercial");
    expect(windowsBootstrap).toContain("바탕 화면");
    expect(windowsBootstrap).toContain('Join-Path $env:PUBLIC "Desktop"');
    expect(windowsBootstrap).toContain('[Environment+SpecialFolder]::DesktopDirectory');
    expect(windowsBootstrap).toContain('Join-Path $TargetPath "solo_superman.cmd"');
    expect(windowsBootstrap).toContain('Join-Path $desktop "solo_superman.lnk"');
    expect(windowsBootstrap).toContain("Remove-Item -LiteralPath $legacyPath");
    expect(windowsBootstrap).toContain('$shortcut.TargetPath = $wrapperPath');
    expect(windowsBootstrap).not.toContain('Join-Path $desktop "solo_superman.cmd"');
    expect(windowsBootstrap).toContain('"call pnpm.cmd start:local"');
    expect(windowsBootstrap).toContain('Set-Location `"$TargetPath`"; pnpm.cmd start:local');
    expect(windowsBootstrap).toContain("Solo Superman failed to start. Exit code: %SOLO_EXIT%");
    expect(windowsBootstrap).toContain("Solo Superman local run has stopped");
    expect(windowsBootstrap).toContain("Press Enter to close this window");
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
      "Garbled Korean or UTF-8 output",
      "Corepack or npm `already exists` for pnpm",
      "Codex CLI `already exists`",
      "`codex`/`codex.cmd` shim",
      "Node stays on v22.x",
      "TLS 1.2",
      "Execution policy",
      "Path quoting",
      "Long path",
      "Antivirus/network prompt",
      "Administrator permission denied",
      "operation not permitted",
      "Windows prerequisite/WSL setup is denied",
      "바탕화면에 Solo Superman 바로가기",
      "Codex WSL setup incomplete",
      "WSL install script quoting",
      "line 8: syntax error: unexpected end of file from 'if' command on line 6",
      "wsl -- bash <script>",
      "WSL wslpath Windows path escaping",
      "wslpath: C:Users...AppDataLocalTemp...codex-wsl-install-1234-20260521-143000.sh",
      "C:/...",
      "/mnt/c/...",
      "wsl --set-default-version 2",
      "wsl --install -d Ubuntu",
      "같은 한 줄 명령",
      "SOLO_CODEX_WINDOWS_MODE=wsl",
      "WSL nvm home detection",
      "/nvm.sh: No such file or directory",
      "/home/<user>/.nvm/nvm.sh",
      "WSL setup garbled output",
      "solo-superman-wsl-ready",
      "WSL nvm Node already installed",
      "v22.22.3 is already installed",
      "Codex CLI native runtime missing",
      "Windows sidecar native runtime missing",
      "Microsoft.VCRedist.2015+.x64",
      "ERR_DLOPEN_FAILED",
      "@libsql/win32-x64-msvc/index.node",
      "codex.cmd --version failed with exit -1073741515",
      "Windows/WSL `spawn pnpm ENOENT` during smoke",
      "spawn pnpm ENOENT",
      "npm_execpath",
      "SOLO_PNPM_COMMAND",
      "alternate ports",
      "EADDRINUSE",
      "WSL localhost port binding",
      "0.0.0.0"
    ]) {
      expect(runbook).toContain(snippet);
    }
  });
});
