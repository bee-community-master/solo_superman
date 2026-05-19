$ErrorActionPreference = "Stop"

$RepoUrl = if ($env:SOLO_SUPERMAN_REPO_URL) { $env:SOLO_SUPERMAN_REPO_URL } else { "https://github.com/bee-community-master/solo_superman.git" }
$DefaultTargetDir = if ($env:SOLO_SUPERMAN_DIR) { $env:SOLO_SUPERMAN_DIR } else { "solo_superman" }
$PnpmVersion = if ($env:SOLO_SUPERMAN_PNPM_VERSION) { $env:SOLO_SUPERMAN_PNPM_VERSION } else { "11.0.4" }
$RunSmoke = if ($env:SOLO_SUPERMAN_RUN_SMOKE) { $env:SOLO_SUPERMAN_RUN_SMOKE } else { "1" }
$StartLocal = if ($env:SOLO_SUPERMAN_START_LOCAL) { $env:SOLO_SUPERMAN_START_LOCAL } else { "1" }
$BootstrapCommand = "irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 | iex"
$CodexDesktopAppUrl = if ($env:SOLO_SUPERMAN_CODEX_DESKTOP_URL) { $env:SOLO_SUPERMAN_CODEX_DESKTOP_URL } else { "https://openai.com/codex/" }
$ShowCodexDesktopPrompt = if ($env:SOLO_SUPERMAN_SHOW_CODEX_DESKTOP_PROMPT) { $env:SOLO_SUPERMAN_SHOW_CODEX_DESKTOP_PROMPT } else { "1" }
$MinNodeMajor = 24

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message"
}

function Write-Warn($Message) {
  Write-Host ""
  Write-Warning $Message
}

function Test-IsAdministrator {
  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch {
    return $false
  }
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

function ConvertTo-PowerShellLiteral($Value) {
  if ($null -eq $Value) {
    return "''"
  }

  return "'" + ([string]$Value).Replace("'", "''") + "'"
}

function Get-PowerShellExecutable {
  foreach ($name in @("pwsh", "powershell")) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $command) {
      return $command.Source
    }
  }

  $windowsPowerShell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
  if (Test-Path $windowsPowerShell) {
    return $windowsPowerShell
  }

  throw "관리자 권한 재실행에 사용할 PowerShell을 찾지 못했습니다."
}

function Restart-AsAdministrator {
  if (Test-IsAdministrator) {
    Write-Step "관리자 권한 확인 완료"
    return
  }

  Write-Step "관리자 권한으로 설치를 다시 시작합니다."
  Write-Host "Node/Corepack/pnpm 활성화와 공용 바탕화면 실행파일 생성에는 관리자 권한이 필요할 수 있어 Windows UAC 승인을 요청합니다."

  $envAssignments = New-Object System.Collections.Generic.List[string]
  foreach ($name in @(
    "SOLO_SUPERMAN_REPO_URL",
    "SOLO_SUPERMAN_DIR",
    "SOLO_SUPERMAN_PNPM_VERSION",
    "SOLO_SUPERMAN_RUN_SMOKE",
    "SOLO_SUPERMAN_START_LOCAL",
    "SOLO_SUPERMAN_NO_PAUSE",
    "SOLO_SUPERMAN_CODEX_DESKTOP_URL",
    "SOLO_SUPERMAN_SHOW_CODEX_DESKTOP_PROMPT"
  )) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if ($null -ne $value) {
      $envAssignments.Add("`$env:$name = $(ConvertTo-PowerShellLiteral $value)")
    }
  }

  $commandParts = New-Object System.Collections.Generic.List[string]
  $commandParts.Add('$ErrorActionPreference = "Stop"')
  foreach ($assignment in $envAssignments) {
    $commandParts.Add($assignment)
  }
  $commandParts.Add($BootstrapCommand)

  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(($commandParts -join "; ")))
  $powershell = Get-PowerShellExecutable
  $arguments = @("-NoProfile", "-EncodedCommand", $encodedCommand)
  if ([System.IO.Path]::GetFileName($powershell) -ieq "powershell.exe") {
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand)
  }

  $process = Start-Process -FilePath $powershell -ArgumentList $arguments -Verb RunAs -WorkingDirectory (Get-Location).Path -Wait -PassThru
  if (($null -ne $process.ExitCode) -and ($process.ExitCode -ne 0)) {
    exit $process.ExitCode
  }

  exit 0
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

function Ensure-CodexCli {
  if (-not (Test-Command npm)) {
    throw "Codex CLI 설치를 위해 npm이 필요합니다. Node 24 이상 설치 후 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Write-Step "OpenAI Codex CLI 설치/업데이트"
  Invoke-Tool "npm" @("install", "-g", "@openai/codex@latest")
  Add-CommonToolPaths
  if (-not (Test-Command codex)) {
    throw "Codex CLI 설치 후에도 codex 명령을 찾지 못했습니다. 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Invoke-Tool "codex" @("--version")
}

function Show-CodexDesktopAppPrompt {
  if ($ShowCodexDesktopPrompt -eq "0") {
    return
  }

  Write-Step "Codex Desktop App 안내"
  Write-Host "Codex CLI는 설치했습니다. Solo Superman 이후 바이브 코딩/다중 agent 작업을 더 하고 싶으면 열린 창에서 Codex Desktop App for Windows를 다운로드하고 ChatGPT 계정으로 로그인하세요."
  Write-Host "다운로드 안내: $CodexDesktopAppUrl"

  try {
    Start-Process $CodexDesktopAppUrl
  } catch {
    Write-Warn "Codex Desktop App 다운로드 페이지를 자동으로 열지 못했습니다. 브라우저에서 직접 여세요: $CodexDesktopAppUrl"
  }

  try {
    $wscript = New-Object -ComObject WScript.Shell
    $message = "Codex CLI 설치가 완료되었습니다.`n`nSolo Superman 이후 바이브 코딩이나 여러 agent 병렬 작업을 더 하고 싶으면 열린 브라우저 창에서 Codex Desktop App for Windows를 다운로드하고 ChatGPT 계정으로 로그인하세요.`n`n$CodexDesktopAppUrl"
    $wscript.Popup($message, 0, "Codex Desktop App 안내", 64) | Out-Null
  } catch {
    Write-Warn "Codex Desktop App 안내 팝업을 띄우지 못했습니다. $($_.Exception.Message)"
  }
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

function Get-DesktopPaths {
  $candidates = New-Object System.Collections.Generic.List[string]

  function Add-DesktopCandidate($Path) {
    if ($Path) {
      $expanded = [Environment]::ExpandEnvironmentVariables([string]$Path)
      if ($expanded -and (-not $candidates.Contains($expanded))) {
        $candidates.Add($expanded)
      }
    }
  }

  try {
    $wscript = New-Object -ComObject WScript.Shell
    Add-DesktopCandidate $wscript.SpecialFolders.Item("Desktop")
  } catch {
    Write-Warn "Windows Shell에서 바탕화면 경로를 읽지 못해 다른 경로 후보를 확인합니다. $($_.Exception.Message)"
  }

  foreach ($registryPath in @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
  )) {
    try {
      Add-DesktopCandidate (Get-ItemProperty -Path $registryPath -Name Desktop -ErrorAction Stop).Desktop
    } catch {
      # Registry desktop redirection is optional. Keep checking other sources.
    }
  }

  Add-DesktopCandidate ([Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory))
  Add-DesktopCandidate ([Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop))

  foreach ($oneDriveRoot in @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial)) {
    if ($oneDriveRoot) {
      Add-DesktopCandidate (Join-Path $oneDriveRoot "Desktop")
      Add-DesktopCandidate (Join-Path $oneDriveRoot "바탕 화면")
    }
  }

  Add-DesktopCandidate (Join-Path $env:USERPROFILE "Desktop")
  Add-DesktopCandidate (Join-Path $env:USERPROFILE "바탕 화면")
  if ($env:PUBLIC) {
    Add-DesktopCandidate (Join-Path $env:PUBLIC "Desktop")
  }

  $desktopPaths = New-Object System.Collections.Generic.List[string]
  foreach ($candidate in $candidates) {
    if ((Test-Path $candidate) -and (-not $desktopPaths.Contains($candidate))) {
      $desktopPaths.Add($candidate)
    }
  }

  if ($desktopPaths.Count -eq 0) {
    $fallback = $candidates | Select-Object -First 1
    if (-not $fallback) {
      $fallback = Join-Path $env:USERPROFILE "Desktop"
    }
    New-Item -ItemType Directory -Path $fallback -Force | Out-Null
    $desktopPaths.Add($fallback)
  }

  return $desktopPaths.ToArray()
}

function ConvertTo-CmdValue($Value) {
  return ([string]$Value).Replace("%", "%%")
}

function ConvertTo-CmdEchoValue($Value) {
  return (ConvertTo-CmdValue $Value).Replace("^", "^^").Replace("&", "^&").Replace("|", "^|").Replace("<", "^<").Replace(">", "^>")
}

function New-DesktopRunner($TargetPath) {
  $runnerPaths = New-Object System.Collections.Generic.List[string]
  $failedDesktopPaths = New-Object System.Collections.Generic.List[string]
  $safeTargetPath = ConvertTo-CmdValue $TargetPath
  $safeBootstrapCommand = ConvertTo-CmdEchoValue $BootstrapCommand
  $pathLine = 'set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Microsoft\WindowsApps"'
  $content = @(
    "@echo off",
    "setlocal enableextensions",
    "set ""SOLO_EXIT=0""",
    $pathLine,
    "set ""SOLO_SUPERMAN_DIR=$safeTargetPath""",
    "if not exist ""%SOLO_SUPERMAN_DIR%"" (",
    "  echo Install folder not found: ""%SOLO_SUPERMAN_DIR%""",
    "  set ""SOLO_EXIT=1""",
    "  goto solo_fail",
    ")",
    "cd /d ""%SOLO_SUPERMAN_DIR%""",
    "if errorlevel 1 (",
    "  echo Failed to enter install folder: ""%SOLO_SUPERMAN_DIR%""",
    "  set ""SOLO_EXIT=1""",
    "  goto solo_fail",
    ")",
    "where pnpm >nul 2>nul",
    "if errorlevel 1 (",
    "  echo pnpm was not found in PATH.",
    "  echo Run the Windows installer again from an Administrator PowerShell:",
    "  echo $safeBootstrapCommand",
    "  set ""SOLO_EXIT=1""",
    "  goto solo_fail",
    ")",
    "echo Starting Solo Superman locally...",
    "echo Keep this window open while using the app. Press Ctrl+C to stop it.",
    "call pnpm start:local",
    "set ""SOLO_EXIT=%ERRORLEVEL%""",
    "if not ""%SOLO_EXIT%""==""0"" goto solo_fail",
    "echo.",
    "echo Solo Superman local run has stopped.",
    "goto solo_wait",
    ":solo_fail",
    "echo.",
    "echo Solo Superman failed to start. Exit code: %SOLO_EXIT%",
    "echo The failure output above is kept visible so you can copy it.",
    "echo If this happened right after install, run the installer again from an Administrator PowerShell:",
    "echo $safeBootstrapCommand",
    ":solo_wait",
    "echo.",
    "set /p ""SOLO_CLOSE=Press Enter to close this window...""",
    "exit /b %SOLO_EXIT%"
  ) -join "`r`n"

  foreach ($desktop in Get-DesktopPaths) {
    try {
      $runnerPath = Join-Path $desktop "solo_superman.cmd"
      Set-Content -Path $runnerPath -Value $content -Encoding ASCII
      if (-not $runnerPaths.Contains($runnerPath)) {
        $runnerPaths.Add($runnerPath)
      }

      $wscript = New-Object -ComObject WScript.Shell
      $shortcutPath = Join-Path $desktop "solo_superman.lnk"
      $shortcut = $wscript.CreateShortcut($shortcutPath)
      $shortcut.TargetPath = $runnerPath
      $shortcut.WorkingDirectory = $TargetPath
      $shortcut.Description = "Start Solo Superman locally"
      $shortcut.Save()
      if (-not $runnerPaths.Contains($shortcutPath)) {
        $runnerPaths.Add($shortcutPath)
      }
    } catch {
      $failedDesktopPaths.Add("$desktop :: $($_.Exception.Message)")
      Write-Warn "바탕화면 실행파일/바로가기 생성 후보를 건너뜁니다: $desktop :: $($_.Exception.Message)"
    }
  }

  if ($runnerPaths.Count -eq 0) {
    throw "바탕화면 실행파일을 만들 수 있는 경로를 찾지 못했습니다. 관리자 권한 PowerShell에서 다시 실행하세요. 실패 후보: $($failedDesktopPaths -join '; ')"
  }

  Write-Step "바탕화면 실행파일 확인/생성"
  foreach ($runnerPath in $runnerPaths) {
    Write-Host "- $runnerPath"
  }

  return $runnerPaths.ToArray()
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
    Write-Host "나중에 실행하려면 바탕화면의 solo_superman.cmd를 더블클릭하거나 아래 명령을 실행하세요:"
    Write-Host "Set-Location `"$TargetPath`"; pnpm start:local"
    return
  }

  Write-Step "Solo Superman web 화면을 엽니다. 브라우저가 열리면 이 터미널을 닫지 마세요."
  Invoke-Tool "pnpm" @("start:local")
}

function Write-InstallSummary($TargetPath, $DesktopRunnerPaths) {
  Write-Host ""
  Write-Host "Solo Superman 설치가 완료됐습니다." -ForegroundColor Green
  Write-Host "설치 경로: $TargetPath"
  if ($DesktopRunnerPaths -and $DesktopRunnerPaths.Count -gt 0) {
    Write-Host "바탕화면 실행파일/아이콘 확인/생성:"
    foreach ($runnerPath in $DesktopRunnerPaths) {
      Write-Host "- $runnerPath"
    }
    Write-Host "바탕화면에 보이지 않으면 파일 탐색기 주소창에 위 경로의 폴더를 붙여넣어 확인하세요."
  } else {
    Write-Host "바탕화면 실행파일/아이콘: 생성되지 않음"
  }
  Write-Host "다시 실행 명령: Set-Location `"$TargetPath`"; pnpm start:local"
  Write-Host "이제 로컬 web을 시작합니다. 사용하는 동안 이 PowerShell 창을 닫지 마세요. 종료하려면 Ctrl+C를 누르세요."
}

function Wait-ForUserBeforeExit($Reason) {
  if ($env:SOLO_SUPERMAN_NO_PAUSE -eq "1") {
    return
  }

  Write-Host ""
  if ($Reason) {
    Write-Host $Reason
  }
  Read-Host "이 창을 닫으려면 Enter를 누르세요" | Out-Null
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
Restart-AsAdministrator
Add-CommonToolPaths
Ensure-Git
Ensure-Node
Ensure-Pnpm
Ensure-CodexCli

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

$DesktopRunnerPaths = @(New-DesktopRunner $TargetPath)
Invoke-ProdSmoke
Write-InstallSummary $TargetPath $DesktopRunnerPaths
Show-CodexDesktopAppPrompt
Invoke-LocalWeb
Wait-ForUserBeforeExit "Solo Superman local run이 종료됐습니다."
} catch {
  Write-FriendlyFailure $_.Exception.Message
  Wait-ForUserBeforeExit "설치가 실패했습니다. 위 안내를 확인하세요."
  exit 1
}
