$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:SOLO_SUPERMAN_REPO_URL) { $env:SOLO_SUPERMAN_REPO_URL } else { "https://github.com/bee-community-master/solo_superman.git" }
$DefaultTargetDir = if ($env:SOLO_SUPERMAN_DIR) { $env:SOLO_SUPERMAN_DIR } else { "solo_superman" }
$PnpmVersion = if ($env:SOLO_SUPERMAN_PNPM_VERSION) { $env:SOLO_SUPERMAN_PNPM_VERSION } else { "11.0.4" }
$RunSmoke = if ($env:SOLO_SUPERMAN_RUN_SMOKE) { $env:SOLO_SUPERMAN_RUN_SMOKE } else { "1" }
$StartLocal = if ($env:SOLO_SUPERMAN_START_LOCAL) { $env:SOLO_SUPERMAN_START_LOCAL } else { "1" }
$BootstrapCommand = "irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 | iex"
$MinNodeMajor = 24

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message"
}

function Write-Warn($Message) {
  Write-Host ""
  Write-Warning $Message
}

function Test-Command($Name) {
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Checked($FilePath, [string[]]$Arguments) {
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit $LASTEXITCODE"
  }
}

function Get-ToolPath($BaseName) {
  foreach ($name in @("$BaseName.cmd", "$BaseName.exe", $BaseName)) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $cmd) {
      return $cmd.Source
    }
  }

  throw "$BaseName 명령을 찾지 못했습니다."
}

function Invoke-Tool($BaseName, [string[]]$Arguments) {
  Invoke-Checked (Get-ToolPath $BaseName) $Arguments
}

function Add-CommonToolPaths {
  $paths = @(
    "$env:ProgramFiles\nodejs",
    "${env:ProgramFiles(x86)}\nodejs",
    "$env:ProgramFiles\Git\cmd",
    "${env:ProgramFiles(x86)}\Git\cmd",
    "$env:APPDATA\npm",
    "$env:LOCALAPPDATA\Microsoft\WindowsApps"
  )

  foreach ($path in $paths) {
    if ($path -and (Test-Path $path) -and (($env:Path -split ';') -notcontains $path)) {
      $env:Path = "$env:Path;$path"
    }
  }
}

function Install-WingetPackage($CommandName, $PackageId) {
  if (-not (Test-Command winget)) {
    throw "winget을 찾지 못했습니다. Node 24 이상(https://nodejs.org/)과 Git for Windows(https://git-scm.com/download/win)를 설치한 뒤 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Write-Step "$CommandName 설치/복구: winget install --id $PackageId -e"
  Invoke-Tool "winget" @("install", "--id", $PackageId, "-e", "--accept-package-agreements", "--accept-source-agreements")
  Add-CommonToolPaths
}

function Ensure-Git {
  if (Test-Command git) {
    Write-Step "git already installed: $(& git --version 2>$null | Select-Object -First 1)"
    return
  }

  Install-WingetPackage "git" "Git.Git"
  if (-not (Test-Command git)) {
    throw "git 설치 후에도 현재 PowerShell에서 명령을 찾지 못했습니다. 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }
}

function Get-NodeMajor {
  if (-not (Test-Command node)) {
    return 0
  }

  try {
    return [int](& node -p "Number(process.versions.node.split('.')[0])")
  } catch {
    return 0
  }
}

function Ensure-Node {
  $major = Get-NodeMajor
  if ($major -ge $MinNodeMajor) {
    Write-Step "node already installed: $(& node --version)"
    return
  }

  if (Test-Command node) {
    Write-Warn "현재 node 버전이 너무 낮아 Node 24 이상 설치/업그레이드를 시도합니다: $(& node --version)"
  }

  Install-WingetPackage "node" "OpenJS.NodeJS.LTS"
  $major = Get-NodeMajor
  if ($major -lt $MinNodeMajor) {
    throw "Node $MinNodeMajor 이상이 필요합니다. 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }
  Write-Step "node ready: $(& node --version)"
}

function Ensure-Pnpm {
  if (Test-Command corepack) {
    Write-Step "pnpm@$PnpmVersion 활성화"
    try {
      Invoke-Tool "corepack" @("enable")
      Invoke-Tool "corepack" @("prepare", "pnpm@$PnpmVersion", "--activate")
      Add-CommonToolPaths
      if (Test-Command pnpm) {
        Invoke-Tool "pnpm" @("--version")
        return
      }
    } catch {
      Write-Warn "Corepack pnpm 활성화가 실패해 npm global 설치로 fallback합니다. $($_.Exception.Message)"
    }
  } else {
    Write-Warn "corepack을 찾지 못해 npm global pnpm 설치로 fallback합니다."
  }

  if (-not (Test-Command npm)) {
    throw "npm을 찾지 못했습니다. Node 24 이상 설치 후 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Invoke-Tool "npm" @("install", "-g", "pnpm@$PnpmVersion")
  Add-CommonToolPaths
  if (-not (Test-Command pnpm)) {
    throw "pnpm 설치에 실패했습니다. 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }
  Invoke-Tool "pnpm" @("--version")
}

function Get-OriginRemote($Path) {
  try {
    return (& git -C $Path remote get-url origin 2>$null | Select-Object -First 1)
  } catch {
    return $null
  }
}

function Test-ExpectedRepo($Path) {
  if (-not (Test-Path (Join-Path $Path ".git"))) {
    return $false
  }

  $remote = Get-OriginRemote $Path
  return ($remote -eq $RepoUrl) -or ($remote -like "*bee-community-master/solo_superman*") -or ($remote -like "*bee-community-master/solo_superman.git*") -or ($remote -like "*HearingOffice/solo_superman*") -or ($remote -like "*HearingOffice/solo_superman.git*")
}

function Sync-OriginRemote($Path) {
  $remote = Get-OriginRemote $Path
  if ($remote -and ($remote -ne $RepoUrl)) {
    Write-Step "origin remote update: $remote -> $RepoUrl"
    Invoke-Tool "git" @("-C", $Path, "remote", "set-url", "origin", $RepoUrl)
  }
}

function Resolve-InstallTarget {
  $base = $DefaultTargetDir
  if ((Test-ExpectedRepo $base) -or (-not (Test-Path $base))) {
    return $base
  }

  Write-Warn "$base 경로가 이미 있어 건드리지 않고 새 경로를 자동 선택합니다."
  for ($i = 2; $i -le 99; $i++) {
    $candidate = "$base-$i"
    if ((Test-ExpectedRepo $candidate) -or (-not (Test-Path $candidate))) {
      return $candidate
    }
  }

  throw "사용 가능한 설치 경로를 자동으로 찾지 못했습니다. solo_superman-* 폴더를 정리한 뒤 다시 실행하세요."
}

function Get-AbsolutePath($Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

function Get-DesktopPath {
  $desktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
  if (-not $desktop) {
    $desktop = Join-Path $env:USERPROFILE "Desktop"
  }

  if (-not (Test-Path $desktop)) {
    New-Item -ItemType Directory -Path $desktop -Force | Out-Null
  }

  return $desktop
}

function ConvertTo-CmdValue($Value) {
  return ([string]$Value).Replace("%", "%%")
}

function New-DesktopRunner($TargetPath) {
  $desktop = Get-DesktopPath
  $runnerPath = Join-Path $desktop "solo_superman.cmd"
  $safeTargetPath = ConvertTo-CmdValue $TargetPath
  $content = @(
    "@echo off",
    "setlocal",
    "set ""SOLO_SUPERMAN_DIR=$safeTargetPath""",
    "cd /d ""%SOLO_SUPERMAN_DIR%""",
    "echo Starting Solo Superman locally...",
    "echo Keep this window open while using the app. Press Ctrl+C to stop it.",
    "pnpm start:local",
    "if errorlevel 1 (",
    "  echo.",
    "  echo Solo Superman failed to start. Press any key to close this window.",
    "  pause >nul",
    ")"
  ) -join "`r`n"

  Set-Content -Path $runnerPath -Value $content -Encoding ASCII
  Write-Step "바탕화면 실행파일 생성: $runnerPath"
}

function Get-FreePort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
  try {
    $listener.Start()
    return $listener.LocalEndpoint.Port
  } finally {
    $listener.Stop()
  }
}

function Invoke-ProdSmoke {
  if ($RunSmoke -eq "0") {
    Write-Step "내장 설정으로 smoke 검증을 건너뜁니다."
    return
  }

  Write-Step "production bundle smoke"
  try {
    Invoke-Tool "pnpm" @("verify:prod-bundle")
    return
  } catch {
    Write-Warn "기본 로컬 포트가 사용 중일 수 있어 빈 포트를 자동 선택해 한 번 더 시도합니다. $($_.Exception.Message)"
  }

  $sidecarPort = Get-FreePort
  $webPort = Get-FreePort
  while ($sidecarPort -eq $webPort) {
    $webPort = Get-FreePort
  }

  $oldSidecarPort = $env:SOLO_PROD_SMOKE_SIDECAR_PORT
  $oldWebPort = $env:SOLO_PROD_SMOKE_WEB_PORT
  try {
    $env:SOLO_PROD_SMOKE_SIDECAR_PORT = [string]$sidecarPort
    $env:SOLO_PROD_SMOKE_WEB_PORT = [string]$webPort
    Write-Step "production bundle smoke retry: sidecar=$sidecarPort web=$webPort"
    Invoke-Tool "pnpm" @("verify:prod-bundle")
  } finally {
    if ($null -eq $oldSidecarPort) { Remove-Item Env:SOLO_PROD_SMOKE_SIDECAR_PORT -ErrorAction SilentlyContinue } else { $env:SOLO_PROD_SMOKE_SIDECAR_PORT = $oldSidecarPort }
    if ($null -eq $oldWebPort) { Remove-Item Env:SOLO_PROD_SMOKE_WEB_PORT -ErrorAction SilentlyContinue } else { $env:SOLO_PROD_SMOKE_WEB_PORT = $oldWebPort }
  }
}

function Invoke-LocalWeb {
  if ($StartLocal -eq "0") {
    Write-Step "내장 설정으로 local web 자동 실행을 건너뜁니다."
    return
  }

  Write-Step "Solo Superman web 화면을 엽니다. 브라우저가 열리면 이 터미널을 닫지 마세요."
  Invoke-Tool "pnpm" @("start:local")
}

function Write-FriendlyFailure($Message) {
  Write-Host ""
  Write-Host "ERROR: $Message" -ForegroundColor Red
  Write-Host ""
  Write-Host "다시 시도하려면 새 PowerShell에서 아래 한 줄을 그대로 붙여넣으세요:"
  Write-Host $BootstrapCommand
  Write-Host "네트워크/회사 보안 정책/관리자 권한이 막는 경우에는 정책을 우회하지 않고 여기서 멈춥니다."
}

try {
Add-CommonToolPaths
Ensure-Git
Ensure-Node
Ensure-Pnpm

$TargetDir = Resolve-InstallTarget
$TargetPath = Get-AbsolutePath $TargetDir

if (Test-ExpectedRepo $TargetPath) {
  Write-Step "기존 checkout 사용: $TargetPath"
  Sync-OriginRemote $TargetPath
  try {
    Invoke-Tool "git" @("-C", $TargetPath, "fetch", "origin")
  } catch {
    Write-Warn "원격 업데이트 확인에 실패했지만 기존 checkout으로 계속 진행합니다. $($_.Exception.Message)"
  }
} else {
  Write-Step "repo clone: $RepoUrl -> $TargetPath"
  Invoke-Tool "git" @("clone", $RepoUrl, $TargetPath)
}

Set-Location $TargetPath
Write-Step "dependency install"
Invoke-Tool "pnpm" @("install", "--frozen-lockfile")

New-DesktopRunner $TargetPath
Invoke-ProdSmoke
Invoke-LocalWeb
} catch {
  Write-FriendlyFailure $_.Exception.Message
  exit 1
}
