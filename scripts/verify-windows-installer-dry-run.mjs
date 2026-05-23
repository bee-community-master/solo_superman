#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tokenLikePattern } from "./secret-patterns.mjs";

export const WINDOWS_INSTALLER_DRY_RUN_SCHEMA_VERSION = "solo-superman-windows-installer-dry-run.v1";

export const DEFAULT_WINDOWS_INSTALLER_DRY_RUN_PATHS = {
  launcher: "scripts/win.ps1",
  bootstrap: "scripts/bootstrap-windows.ps1",
  readme: "README.md",
  englishReadme: "README.en.md",
  troubleshooting: "docs/troubleshooting_KO.md",
  englishTroubleshooting: "docs/troubleshooting_EN.md"
};

const TOKEN_LIKE_PATTERN = tokenLikePattern("iu");

const REQUIRED_MARKERS = [
  {
    id: "one_line_launcher_downloads_bootstrap",
    file: "launcher",
    markers: [
      "SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL",
      "https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1",
      "DownloadString($bootstrapUrl)",
      "iex $script"
    ]
  },
  {
    id: "launcher_uses_tls_and_utf8_without_bom",
    file: "launcher",
    markers: [
      "New-Object System.Text.UTF8Encoding $false",
      "SecurityProtocolType]::Tls12",
      "$script[0] -eq [char]0xFEFF"
    ]
  },
  {
    id: "administrator_uac_restart_preserves_options",
    file: "bootstrap",
    markers: [
      "function Restart-AsAdministrator",
      "Security.Principal.WindowsBuiltInRole]::Administrator",
      "-Verb RunAs",
      "SOLO_SUPERMAN_REPO_URL",
      "SOLO_SUPERMAN_CODEX_WINDOWS_MODE",
      "SOLO_SUPERMAN_CODEX_WSL_DISTRO"
    ]
  },
  {
    id: "node_git_corepack_pnpm_path",
    file: "bootstrap",
    markers: [
      "function Ensure-Git",
      "function Ensure-Node",
      "OpenJS.NodeJS.LTS",
      "function Ensure-Pnpm",
      "corepack",
      "npm@$PnpmVersion",
      "after npm fallback failure"
    ]
  },
  {
    id: "windows_native_runtime_path",
    file: "bootstrap",
    markers: [
      "function Ensure-WindowsNativeRuntime",
      "vcruntime140.dll",
      "vcruntime140_1.dll",
      "msvcp140.dll",
      "Microsoft.VCRedist.2015+.x64"
    ]
  },
  {
    id: "wsl_codex_default_path",
    file: "bootstrap",
    markers: [
      "function Ensure-WslForCodex",
      "wsl",
      "--install",
      "Ubuntu",
      "function Ensure-CodexCliInWsl",
      "@openai/codex@latest",
      "$env:SOLO_CODEX_WINDOWS_MODE = \"wsl\""
    ]
  },
  {
    id: "native_codex_repair_fallback_path",
    file: "bootstrap",
    markers: [
      "function Ensure-CodexCliNative",
      "function Test-CodexNativeRuntimeFailure",
      "after codex npm fallback failure",
      "Confirm-CodexNativeVersion"
    ]
  },
  {
    id: "safe_existing_checkout_update",
    file: "bootstrap",
    markers: [
      "function Update-ExistingCheckoutSafely",
      "\"status\", \"--porcelain\"",
      "merge-base",
      "--ff-only",
      "diverged",
      "사용자 변경을 덮어쓰지 않습니다"
    ]
  },
  {
    id: "desktop_shortcut_start_local_path",
    file: "bootstrap",
    markers: [
      "function New-DesktopRunner",
      "solo_superman.cmd",
      "solo_superman.lnk",
      "pnpm.cmd start:local",
      "Set-Location `\"$TargetPath`\"; pnpm.cmd start:local"
    ]
  },
  {
    id: "prod_smoke_logs_and_port_retry",
    file: "bootstrap",
    markers: [
      "function Invoke-ProdSmoke",
      "verify:prod-bundle",
      "SOLO_PROD_SMOKE_LOG_PATH",
      "Get-ProdSmokePortConflicts",
      "Invoke-ProdSmokeWithAlternatePorts",
      "production smoke 진단 로그"
    ]
  },
  {
    id: "friendly_failure_keeps_redacted_evidence_paths",
    file: "bootstrap",
    markers: [
      "function Write-FriendlyFailure",
      "진단 로그:",
      "bootstrap:",
      "production smoke:",
      "네트워크/회사 보안 정책/관리자 권한이 막는 경우에는 정책을 우회하지 않고 여기서 멈춥니다"
    ]
  },
  {
    id: "docs_keep_support_bundle_and_manual_checklist",
    file: "troubleshooting",
    markers: [
      "pnpm support:bundle",
      "Manual Windows PowerShell checklist",
      "OpenAI/GitHub token",
      "browser cookies"
    ]
  },
  {
    id: "english_docs_keep_support_bundle_and_manual_checklist",
    file: "englishTroubleshooting",
    markers: [
      "pnpm support:bundle",
      "Manual Windows PowerShell checklist",
      "OpenAI/GitHub tokens",
      "browser cookies"
    ]
  },
  {
    id: "readme_exposes_one_line_and_rerun",
    file: "readme",
    markers: [
      "irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 | iex",
      "설치 완료 메시지에 표시된 다시 실행 명령",
      "clean checkout이면 같은 한 줄 설치 명령을 다시 실행할 때",
      "support:bundle"
    ]
  },
  {
    id: "english_readme_exposes_one_line_and_rerun",
    file: "englishReadme",
    markers: [
      "irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 | iex",
      "use the rerun command printed by the installer",
      "existing install folder is a clean checkout",
      "support:bundle"
    ]
  }
];

function markerIssues(files) {
  return REQUIRED_MARKERS.flatMap((check) => {
    const text = files[check.file] ?? "";
    return check.markers
      .filter((marker) => !text.includes(marker))
      .map((marker) => `${check.id}: ${check.file} is missing marker ${JSON.stringify(marker)}`);
  });
}

function secretIssues(files) {
  return Object.entries(files).flatMap(([id, text]) => TOKEN_LIKE_PATTERN.test(text)
    ? [`${id}: must not contain token-shaped secret values`]
    : []);
}

function bomIssues(files) {
  return Object.entries(files).flatMap(([id, text]) => text.charCodeAt(0) === 0xFEFF
    ? [`${id}: must not start with a UTF-8 BOM`]
    : []);
}

async function readInstallerFiles(paths, cwd) {
  const entries = await Promise.all(Object.entries(paths).map(async ([id, path]) => [
    id,
    await readFile(resolve(cwd, path), "utf8")
  ]));

  return Object.fromEntries(entries);
}

function buildWindowsInstallerDryRunEvidence(files, paths) {
  const issues = [
    ...markerIssues(files),
    ...secretIssues(files),
    ...bomIssues(files)
  ];

  return {
    schemaVersion: WINDOWS_INSTALLER_DRY_RUN_SCHEMA_VERSION,
    status: issues.length === 0 ? "passed" : "failed",
    mode: "credential-free-static-dry-run",
    issue: "https://github.com/bee-community-master/solo_superman/issues/291",
    upstreamDeviceEvidenceIssue: "https://github.com/bee-community-master/solo_superman/issues/259",
    inspectedPaths: paths,
    checks: Object.fromEntries(REQUIRED_MARKERS.map((check) => [
      check.id,
      check.markers.every((marker) => (files[check.file] ?? "").includes(marker))
    ])),
    issues,
    checked: [
      "one-line Windows launcher downloads the bootstrap script over TLS with UTF-8 handling",
      "administrator/UAC restart path preserves configured installer options",
      "Node, Git, Corepack/pnpm, Visual C++ runtime, WSL/Ubuntu, and Codex CLI paths remain represented",
      "safe rerun updates only clean expected checkouts by fast-forward",
      "desktop shortcut and start:local path remain represented",
      "production smoke logs and port-conflict retry remain represented",
      "support bundle and manual Windows checklist docs remain represented",
      "dry-run stays credential-free and does not replace real Windows device evidence for #259"
    ]
  };
}

export async function runWindowsInstallerDryRun(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? DEFAULT_WINDOWS_INSTALLER_DRY_RUN_PATHS;
  const files = await readInstallerFiles(paths, cwd);

  return buildWindowsInstallerDryRunEvidence(files, paths);
}

export function parseWindowsInstallerDryRunArgs(argv = process.argv.slice(2)) {
  let cwd;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--cwd") {
      if (!argv[index + 1]) {
        throw new Error("--cwd requires a path value");
      }
      cwd = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--cwd=")) {
      cwd = arg.slice("--cwd=".length);
    } else if (arg === "--help" || arg === "-h") {
      return { help: true };
    } else {
      throw new Error(`Unknown Windows installer dry-run argument: ${arg}`);
    }
  }

  return { cwd: cwd ? resolve(cwd) : undefined };
}

export async function runWindowsInstallerDryRunCli(argv = process.argv.slice(2), options = {}) {
  const parsed = parseWindowsInstallerDryRunArgs(argv);
  if (parsed.help) {
    console.log("Usage: pnpm verify:windows-installer:dry-run [--cwd <path>]");
    return { status: "help" };
  }

  const evidence = await runWindowsInstallerDryRun({ ...options, cwd: parsed.cwd ?? options.cwd });
  console.log(JSON.stringify(evidence, null, 2));
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runWindowsInstallerDryRunCli().then((evidence) => {
    if (evidence.status !== "passed") {
      process.exitCode = 1;
    }
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
