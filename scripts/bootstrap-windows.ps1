$ErrorActionPreference = "Stop"

function Initialize-Utf8Console {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  try {
    [Console]::InputEncoding = $utf8
  } catch {
    # Some non-interactive hosts do not expose a mutable console input stream.
  }
  try {
    [Console]::OutputEncoding = $utf8
  } catch {
    # Some non-interactive hosts do not expose a mutable console output stream.
  }
  $global:OutputEncoding = $utf8
  try {
    $null = & chcp.com 65001 2>$null
  } catch {
    # chcp is best-effort; the .NET encodings above still protect pipeline output.
  }
}

Initialize-Utf8Console

function ConvertTo-PowerShellLiteral($Value) {
  if ($null -eq $Value) {
    return "''"
  }

  return "'" + ([string]$Value).Replace("'", "''") + "'"
}

function ConvertTo-BashSingleQuotedLiteral($Value) {
  if ($null -eq $Value) {
    return "''"
  }

  $singleQuote = [string][char]39
  return $singleQuote + ([string]$Value).Replace($singleQuote, "$singleQuote\$singleQuote$singleQuote") + $singleQuote
}

function Add-BootstrapUrlOverrideToCommand($Command) {
  if (-not $env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL) {
    return $Command
  }

  $quotedBootstrapUrl = ConvertTo-PowerShellLiteral $env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL
  return "`$env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL = $quotedBootstrapUrl; $Command"
}

$RepoUrl = if ($env:SOLO_SUPERMAN_REPO_URL) { $env:SOLO_SUPERMAN_REPO_URL } else { "https://github.com/bee-community-master/solo_superman.git" }
$DefaultTargetDir = if ($env:SOLO_SUPERMAN_DIR) {
  $env:SOLO_SUPERMAN_DIR
} elseif ($env:USERPROFILE) {
  Join-Path $env:USERPROFILE "solo_superman"
} elseif ($HOME) {
  Join-Path $HOME "solo_superman"
} else {
  "solo_superman"
}
$PnpmVersion = if ($env:SOLO_SUPERMAN_PNPM_VERSION) { $env:SOLO_SUPERMAN_PNPM_VERSION } else { "11.0.4" }
$RunSmoke = if ($env:SOLO_SUPERMAN_RUN_SMOKE) { $env:SOLO_SUPERMAN_RUN_SMOKE } else { "1" }
$StartLocal = if ($env:SOLO_SUPERMAN_START_LOCAL) { $env:SOLO_SUPERMAN_START_LOCAL } else { "1" }
$BootstrapCommand = Add-BootstrapUrlOverrideToCommand 'irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 | iex'
$CodexDesktopAppUrl = if ($env:SOLO_SUPERMAN_CODEX_DESKTOP_URL) { $env:SOLO_SUPERMAN_CODEX_DESKTOP_URL } else { "https://openai.com/codex/" }
$ShowCodexDesktopPrompt = if ($env:SOLO_SUPERMAN_SHOW_CODEX_DESKTOP_PROMPT) { $env:SOLO_SUPERMAN_SHOW_CODEX_DESKTOP_PROMPT } else { "1" }
$CodexWindowsMode = if ($env:SOLO_SUPERMAN_CODEX_WINDOWS_MODE) { $env:SOLO_SUPERMAN_CODEX_WINDOWS_MODE.ToLowerInvariant() } elseif ($env:SOLO_CODEX_WINDOWS_MODE) { $env:SOLO_CODEX_WINDOWS_MODE.ToLowerInvariant() } else { "wsl" }
$CodexNvmInstallUrl = if ($env:SOLO_SUPERMAN_CODEX_NVM_INSTALL_URL) { $env:SOLO_SUPERMAN_CODEX_NVM_INSTALL_URL } else { "https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh" }
$CodexWslNodeMajor = if ($env:SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR) { $env:SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR } else { "22" }
$CodexWslDistro = if ($env:SOLO_SUPERMAN_CODEX_WSL_DISTRO) { $env:SOLO_SUPERMAN_CODEX_WSL_DISTRO } else { "Ubuntu" }
$MinNodeMajor = 24
$DiagnosticTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BootstrapLogPath = Join-Path ([System.IO.Path]::GetTempPath()) "solo-superman-bootstrap-$DiagnosticTimestamp.log"
$ProdSmokeLogPath = $null

function Write-DiagnosticLog($Message) {
  try {
    Add-Content -Path $BootstrapLogPath -Value "[$((Get-Date).ToString("o"))] $Message" -Encoding UTF8
  } catch {
    # Diagnostics are best-effort and must not hide the installer failure.
  }
}

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message"
  Write-DiagnosticLog "STEP: $Message"
}

function Write-Warn($Message) {
  Write-Host ""
  Write-Warning $Message
  Write-DiagnosticLog "WARN: $Message"
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
  $outputLines = New-Object System.Collections.Generic.List[string]
  $commandLine = "$FilePath $($Arguments -join ' ')"
  Write-DiagnosticLog "COMMAND START: $commandLine"
  Write-DiagnosticLog "COMMAND CWD: $(Get-Location)"
  $exitCode = $null
  $nativeErrorActionPreference = $ErrorActionPreference
  try {
    # Native tools often write progress to stderr; keep that from becoming
    # a terminating NativeCommandError while we still check the real exit code.
    $ErrorActionPreference = "Continue"
    & $FilePath @Arguments 2>&1 | ForEach-Object {
      $line = [string]$_
      if ($line.Length -gt 0) {
        $outputLines.Add($line)
        Write-DiagnosticLog "COMMAND OUTPUT: $line"
      }
      Write-Host $line
    }

    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $nativeErrorActionPreference
  }

  Write-DiagnosticLog "COMMAND EXIT: $commandLine :: $exitCode"
  if ($exitCode -ne 0) {
    $message = "$FilePath $($Arguments -join ' ') failed with exit $exitCode"
    if ($outputLines.Count -gt 0) {
      $tail = ($outputLines | Select-Object -Last 120) -join "`n"
      throw "$message`n$tail"
    }

    throw $message
  }
}

function Invoke-CheckedNoOutput($FilePath, [string[]]$Arguments) {
  $commandLine = "$FilePath $($Arguments -join ' ')"
  Write-DiagnosticLog "COMMAND START NO OUTPUT: $commandLine"
  & $FilePath @Arguments > $null 2> $null
  $exitCode = $LASTEXITCODE
  Write-DiagnosticLog "COMMAND EXIT NO OUTPUT: $commandLine :: $exitCode"
  if ($exitCode -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit $exitCode"
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

function Invoke-ToolNoOutput($BaseName, [string[]]$Arguments) {
  Invoke-CheckedNoOutput (Get-ToolPath $BaseName) $Arguments
}

function Invoke-Pnpm([string[]]$Arguments) {
  $pnpm = Get-ToolPath "pnpm"
  $oldPnpmCommand = $env:SOLO_PNPM_COMMAND
  $oldCi = $env:CI
  try {
    $env:SOLO_PNPM_COMMAND = $pnpm
    $env:CI = "true"
    Write-DiagnosticLog "PNPM COMMAND: $pnpm $($Arguments -join ' ')"
    Write-DiagnosticLog "PNPM ENV: SOLO_PNPM_COMMAND=$pnpm CI=true SOLO_PROD_SMOKE_LOG_PATH=$env:SOLO_PROD_SMOKE_LOG_PATH"
    Invoke-Checked $pnpm $Arguments
  } finally {
    if ($null -eq $oldPnpmCommand) {
      Remove-Item Env:SOLO_PNPM_COMMAND -ErrorAction SilentlyContinue
    } else {
      $env:SOLO_PNPM_COMMAND = $oldPnpmCommand
    }
    if ($null -eq $oldCi) {
      Remove-Item Env:CI -ErrorAction SilentlyContinue
    } else {
      $env:CI = $oldCi
    }
  }
}

function Test-PortConflictError($Message) {
  return [string]$Message -match "EADDRINUSE|address already in use|strictPort|Port conflict|포트 충돌"
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
  Write-Host "Node/Corepack/pnpm 활성화와 Windows prerequisite/WSL 설정에는 관리자 권한이 필요할 수 있어 Windows UAC 승인을 요청합니다."

  $envAssignments = New-Object System.Collections.Generic.List[string]
  foreach ($name in @(
    "SOLO_SUPERMAN_REPO_URL",
    "SOLO_SUPERMAN_DIR",
    "SOLO_SUPERMAN_PNPM_VERSION",
    "SOLO_SUPERMAN_RUN_SMOKE",
    "SOLO_SUPERMAN_START_LOCAL",
    "SOLO_SUPERMAN_NO_PAUSE",
    "SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL",
    "SOLO_SUPERMAN_CODEX_DESKTOP_URL",
    "SOLO_SUPERMAN_SHOW_CODEX_DESKTOP_PROMPT",
    "SOLO_SUPERMAN_CODEX_WINDOWS_MODE",
    "SOLO_CODEX_WINDOWS_MODE",
    "SOLO_SUPERMAN_CODEX_NVM_INSTALL_URL",
    "SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR",
    "SOLO_SUPERMAN_CODEX_WSL_DISTRO"
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

function Install-WingetPackage($CommandName, $PackageId, $MissingWingetMessage) {
  if (-not (Test-Command winget)) {
    if ($MissingWingetMessage) {
      throw $MissingWingetMessage
    }
    throw "winget을 찾지 못했습니다. Node 24 이상(https://nodejs.org/)과 Git for Windows(https://git-scm.com/download/win)를 설치한 뒤 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Write-Step "$CommandName 설치/복구: winget install --id $PackageId -e"
  Invoke-Tool "winget" @("install", "--id", $PackageId, "-e", "--accept-package-agreements", "--accept-source-agreements")
  Add-CommonToolPaths
}

function Upgrade-WingetPackage($CommandName, $PackageId, $MissingWingetMessage) {
  if (-not (Test-Command winget)) {
    if ($MissingWingetMessage) {
      throw $MissingWingetMessage
    }
    throw "winget을 찾지 못했습니다. Node 24 이상(https://nodejs.org/)과 Git for Windows(https://git-scm.com/download/win)를 설치한 뒤 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Write-Step "$CommandName 업그레이드: winget upgrade --id $PackageId -e"
  Invoke-Tool "winget" @("upgrade", "--id", $PackageId, "-e", "--accept-package-agreements", "--accept-source-agreements")
  Add-CommonToolPaths
}

function Test-WindowsNativeRuntime {
  if (-not $env:WINDIR) {
    return $false
  }

  $system32 = Join-Path $env:WINDIR "System32"
  foreach ($dllName in @("vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll")) {
    if (-not (Test-Path (Join-Path $system32 $dllName))) {
      return $false
    }
  }

  return $true
}

function Install-WindowsNativeRuntime($Reason) {
  Write-Step "Windows native runtime 설치/복구"
  if ($Reason) {
    Write-Host $Reason
  }
  Install-WingetPackage "Microsoft Visual C++ Redistributable (x64)" "Microsoft.VCRedist.2015+.x64" "winget을 찾지 못해 Microsoft Visual C++ Redistributable (x64)을 자동 설치하지 못했습니다. https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist 에서 x64 runtime을 설치한 뒤 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
}

function Ensure-WindowsNativeRuntime {
  if (Test-WindowsNativeRuntime) {
    Write-Step "Windows native runtime already installed: Microsoft Visual C++ Redistributable (x64)"
    return
  }

  Write-Warn "Windows native module 실행에 필요한 Visual C++ runtime DLL(vcruntime140.dll/vcruntime140_1.dll/msvcp140.dll)을 찾지 못해 설치/복구를 시도합니다."
  Install-WindowsNativeRuntime "Solo Superman sidecar의 @libsql/win32-x64-msvc native module과 Codex native fallback은 Microsoft Visual C++ Redistributable (x64)이 필요합니다."
  Add-CommonToolPaths
  if (-not (Test-WindowsNativeRuntime)) {
    throw "Microsoft Visual C++ Redistributable (x64) 설치 후에도 Windows native runtime DLL을 확인하지 못했습니다. Windows 재부팅 또는 새 관리자 PowerShell이 필요할 수 있습니다. 재부팅 후 README의 한 줄 설치 명령을 다시 실행하세요."
  }
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

function Get-PnpmVersion {
  if (-not (Test-Command pnpm)) {
    return $null
  }

  try {
    $pnpm = Get-ToolPath "pnpm"
    $output = & $pnpm @("--version") 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }

    return ([string]($output | Select-Object -First 1)).Trim()
  } catch {
    return $null
  }
}

function Test-PnpmVersionReady($Version) {
  if (-not $Version) {
    return $false
  }

  $requiredMajor = [int](([string]$PnpmVersion).Split(".")[0])
  if ([string]$Version -notmatch "^(\d+)") {
    return $false
  }

  return [int]$Matches[1] -ge $requiredMajor
}

function Use-ExistingPnpmIfReady($Source) {
  $version = Get-PnpmVersion
  if (Test-PnpmVersionReady $version) {
    Write-Step "pnpm ready: $version ($Source)"
    return $true
  }

  if ($version) {
    Write-Warn "현재 pnpm 버전이 너무 낮아 pnpm@$PnpmVersion 활성화/설치를 시도합니다: $version"
  }

  return $false
}

function Ensure-Node {
  $major = Get-NodeMajor
  if ($major -ge $MinNodeMajor) {
    Write-Step "node already installed: $(& node --version)"
    return
  }

  if (Test-Command node) {
    Write-Warn "현재 node 버전이 너무 낮아 Node 24 이상 설치/업그레이드를 시도합니다: $(& node --version)"
    try {
      Upgrade-WingetPackage "node" "OpenJS.NodeJS.LTS"
    } catch {
      Write-Warn "Node winget upgrade가 실패해 install/repair 경로를 시도합니다. $($_.Exception.Message)"
    }
    $major = Get-NodeMajor
    if ($major -ge $MinNodeMajor) {
      Write-Step "node ready: $(& node --version)"
      return
    }
  }

  Install-WingetPackage "node" "OpenJS.NodeJS.LTS"
  $major = Get-NodeMajor
  if ($major -lt $MinNodeMajor) {
    $currentNode = if (Test-Command node) { & node --version } else { "not found" }
    throw "Node $MinNodeMajor 이상이 필요하지만 현재 PowerShell에서는 $currentNode 입니다. winget upgrade --id OpenJS.NodeJS.LTS -e 또는 https://nodejs.org/ 의 Windows x64 LTS installer로 Node 24 이상을 설치한 뒤 새 관리자 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }
  Write-Step "node ready: $(& node --version)"
}

function Ensure-Pnpm {
  if (Use-ExistingPnpmIfReady "existing command") {
    return
  }

  if (Test-Command corepack) {
    Write-Step "pnpm@$PnpmVersion 활성화"
    try {
      Invoke-Tool "corepack" @("enable")
      Invoke-Tool "corepack" @("prepare", "pnpm@$PnpmVersion", "--activate")
      Add-CommonToolPaths
      if (Use-ExistingPnpmIfReady "corepack") {
        return
      }
    } catch {
      Write-Warn "Corepack pnpm 활성화가 실패했습니다. 이미 있는 pnpm shim을 확인한 뒤 필요할 때만 npm global 설치로 fallback합니다. $($_.Exception.Message)"
      Add-CommonToolPaths
      if (Use-ExistingPnpmIfReady "after corepack failure") {
        return
      }
    }
  } else {
    Write-Warn "corepack을 찾지 못해 npm global pnpm 설치로 fallback합니다."
  }

  if (-not (Test-Command npm)) {
    throw "npm을 찾지 못했습니다. Node 24 이상 설치 후 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  try {
    Invoke-Tool "npm" @("install", "-g", "pnpm@$PnpmVersion")
  } catch {
    Write-Warn "npm global pnpm 설치가 실패했습니다. 이미 있는 pnpm shim을 한 번 더 확인합니다. $($_.Exception.Message)"
    Add-CommonToolPaths
    if (Use-ExistingPnpmIfReady "after npm fallback failure") {
      return
    }

    throw
  }

  Add-CommonToolPaths
  if (-not (Use-ExistingPnpmIfReady "npm global install")) {
    throw "pnpm 설치에 실패했습니다. 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }
}

function Assert-CodexWindowsMode {
  if (($CodexWindowsMode -ne "wsl") -and ($CodexWindowsMode -ne "native")) {
    throw "SOLO_SUPERMAN_CODEX_WINDOWS_MODE 값은 wsl 또는 native만 지원합니다. 현재 값: $CodexWindowsMode"
  }

  if ($CodexWslNodeMajor -notmatch "^\d+$") {
    throw "SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR 값은 숫자 major 버전이어야 합니다. 현재 값: $CodexWslNodeMajor"
  }

  if ([string]::IsNullOrWhiteSpace($CodexWslDistro)) {
    throw "SOLO_SUPERMAN_CODEX_WSL_DISTRO 값은 비어 있을 수 없습니다."
  }

  if ($CodexNvmInstallUrl -notmatch "^https://") {
    throw "SOLO_SUPERMAN_CODEX_NVM_INSTALL_URL은 https URL이어야 합니다. 현재 값: $CodexNvmInstallUrl"
  }
}

function Get-NormalizedWslLine($Value) {
  return ([string]$Value).Replace([string][char]0, "").Trim()
}

function Get-WslDistributionNames {
  if (-not (Test-Command wsl)) {
    return @()
  }

  try {
    $wsl = Get-ToolPath "wsl"
    $output = & $wsl @("--list", "--quiet") 2>$null
    if ($LASTEXITCODE -ne 0) {
      return @()
    }

    $names = New-Object System.Collections.Generic.List[string]
    foreach ($line in $output) {
      $name = Get-NormalizedWslLine $line
      if ($name -and (-not $names.Contains($name))) {
        $names.Add($name)
      }
    }

    return $names.ToArray()
  } catch {
    return @()
  }
}

function Select-CodexWslDistribution($Distributions) {
  $distributionList = @($Distributions)
  foreach ($distribution in $distributionList) {
    if ($distribution -ieq $CodexWslDistro) {
      return $distribution
    }
  }

  return ($distributionList | Select-Object -First 1)
}

function Set-WslDefaultsForCodex($Distributions) {
  Write-Step "Codex CLI용 WSL2/default 배포판 설정"
  try {
    [void](Invoke-ToolNoOutput "wsl" @("--set-default-version", "2"))
  } catch {
    Write-Warn "WSL 기본 버전을 2로 설정하지 못했습니다. 이미 정책으로 고정되어 있거나 Windows가 재부팅을 기다리는 상태일 수 있습니다. $($_.Exception.Message)"
  }

  $targetDistro = Select-CodexWslDistribution $Distributions
  if (-not $targetDistro) {
    return $null
  }

  try {
    [void](Invoke-ToolNoOutput "wsl" @("--set-default", $targetDistro))
  } catch {
    Write-Warn "Codex CLI용 기본 WSL 배포판을 $targetDistro 로 설정하지 못했습니다. 현재 default 배포판으로 계속 시도합니다. $($_.Exception.Message)"
  }

  return $targetDistro
}

function Invoke-WslBash($Command) {
  Invoke-ToolNoOutput "wsl" @("--", "bash", "-lc", $Command)
}

function Invoke-WslRootBash($Command) {
  Invoke-Tool "wsl" @("-u", "root", "--", "bash", "-lc", $Command)
}

function Write-LfUtf8NoBomFile($Path, $Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $normalized = ([string]$Content).Replace("`r`n", "`n").Replace("`r", "`n")
  [System.IO.File]::WriteAllText($Path, $normalized, $utf8NoBom)
}

function ConvertTo-WslpathInput($WindowsPath) {
  return ([System.IO.Path]::GetFullPath($WindowsPath)).Replace("\", "/")
}

function ConvertTo-DefaultWslMountPath($WindowsPath) {
  $fullPath = [System.IO.Path]::GetFullPath($WindowsPath)
  if ($fullPath -notmatch "^[A-Za-z]:\\") {
    throw "WSL 기본 mount path로 변환할 수 있는 drive-letter Windows 경로가 아닙니다: $fullPath"
  }

  $drive = $fullPath.Substring(0, 1).ToLowerInvariant()
  $relativePath = $fullPath.Substring(3).Replace("\", "/")
  return "/mnt/$drive/$relativePath"
}

function Get-WslPath($WindowsPath) {
  $wsl = Get-ToolPath "wsl"
  $wslpathInput = ConvertTo-WslpathInput $WindowsPath
  $output = & $wsl @("--", "wslpath", "-a", $wslpathInput) 2>&1
  if ($LASTEXITCODE -ne 0) {
    $fallbackPath = ConvertTo-DefaultWslMountPath $WindowsPath
    Write-Warn "wslpath가 Windows 임시 스크립트 경로 변환에 실패해 기본 /mnt/<drive> fallback을 사용합니다: $wslpathInput -> $fallbackPath :: $output"
    return $fallbackPath
  }

  $wslPath = Get-NormalizedWslLine ($output | Select-Object -First 1)
  if (-not $wslPath) {
    throw "Windows 임시 스크립트 경로를 WSL 경로로 변환했지만 결과가 비어 있습니다: $WindowsPath"
  }

  return $wslPath
}

function Invoke-WslScript($Script) {
  $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "solo-superman"
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  $scriptPath = Join-Path $tempRoot "codex-wsl-install-$PID-$DiagnosticTimestamp.sh"
  Write-LfUtf8NoBomFile $scriptPath $Script
  $wslScriptPath = Get-WslPath $scriptPath

  try {
    Invoke-Tool "wsl" @("--", "bash", $wslScriptPath)
  } finally {
    Remove-Item -Path $scriptPath -Force -ErrorAction SilentlyContinue
  }
}

function Ensure-WslForCodex {
  if (-not (Test-Command wsl)) {
    throw "WSL 명령을 찾지 못했습니다. Windows 10 2004 이상 또는 Windows 11에서 관리자 PowerShell로 wsl --install을 실행한 뒤 PC를 재부팅하고, $CodexWslDistro 를 한 번 열어 Linux 사용자 이름/비밀번호를 만든 다음 같은 한 줄 명령을 다시 실행하세요: $BootstrapCommand"
  }

  $distributions = @(Get-WslDistributionNames)
  if ($distributions.Count -eq 0) {
    Write-Step "Codex CLI용 WSL/$CodexWslDistro 설치 및 기본 경로 설정"
    try {
      Invoke-Tool "wsl" @("--set-default-version", "2")
    } catch {
      Write-Warn "WSL 설치 전 기본 버전 2 설정이 실패했습니다. wsl --install 뒤 Windows 재부팅으로 해결될 수 있습니다. $($_.Exception.Message)"
    }

    try {
      Invoke-Tool "wsl" @("--install", "-d", $CodexWslDistro)
    } catch {
      throw "WSL/$CodexWslDistro 설치 명령이 완료되지 않았습니다. Windows가 재부팅 또는 Microsoft Store/회사 정책 승인을 요구할 수 있습니다. PC를 재부팅하고, $CodexWslDistro 를 한 번 열어 Linux 사용자 이름/비밀번호를 만든 뒤 새 관리자 PowerShell에서 같은 한 줄 명령을 다시 실행하세요: $BootstrapCommand :: $($_.Exception.Message)"
    }

    throw "WSL/$CodexWslDistro 첫 설치를 시작했습니다. Windows가 재부팅을 요청할 수 있으므로 PC를 재부팅하고, $CodexWslDistro 를 한 번 열어 Linux 사용자 이름/비밀번호를 만든 뒤 새 관리자 PowerShell에서 같은 한 줄 명령을 다시 실행하세요: $BootstrapCommand"
  }

  $targetDistro = Set-WslDefaultsForCodex $distributions

  try {
    Invoke-WslBash "true"
  } catch {
    throw "WSL 배포판은 보이지만 bash 실행 또는 첫 사용자 설정이 끝나지 않았습니다. Windows가 요청했다면 재부팅하고, $CodexWslDistro 를 한 번 열어 Linux 사용자 이름/비밀번호를 만든 뒤 같은 한 줄 명령을 다시 실행하세요: $BootstrapCommand :: $($_.Exception.Message)"
  }

  if ($targetDistro) {
    Write-Step "WSL ready for Codex CLI: default=$targetDistro installed=$($distributions -join ', ')"
  } else {
    Write-Step "WSL ready for Codex CLI: $($distributions -join ', ')"
  }
}

function Ensure-WslCurl {
  try {
    Invoke-WslBash "command -v curl >/dev/null 2>&1"
    return
  } catch {
    Write-Warn "WSL 안에서 curl을 찾지 못해 Ubuntu/Debian 계열 apt로 curl 설치를 시도합니다. $($_.Exception.Message)"
  }

  try {
    Invoke-WslRootBash "if command -v apt-get >/dev/null 2>&1; then apt-get update && apt-get install -y curl ca-certificates; else exit 42; fi"
  } catch {
    throw "WSL 안에서 curl을 자동 준비하지 못했습니다. WSL Ubuntu에서 sudo apt-get update; sudo apt-get install -y curl ca-certificates 를 실행한 뒤 README의 한 줄 설치 명령을 다시 실행하세요. $($_.Exception.Message)"
  }
}

function Ensure-CodexCliInWsl {
  Ensure-WslForCodex
  Ensure-WslCurl

  Write-Step "OpenAI Codex CLI 설치/업데이트 (WSL)"
  $installScript = @'
set -euo pipefail
wsl_home="${HOME:-}"
if [ -z "$wsl_home" ]; then
  wsl_home="$(getent passwd "$(id -u)" | cut -d: -f6 || true)"
fi
if [ -z "$wsl_home" ]; then
  echo "Could not determine WSL HOME for nvm." >&2
  exit 44
fi
export HOME="$wsl_home"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL __NVM_INSTALL_URL__ | PROFILE=/dev/null bash
fi
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm.sh not found at $NVM_DIR/nvm.sh after nvm install." >&2
  exit 45
fi
. "$NVM_DIR/nvm.sh"
use_node_major() {
  nvm use __NODE_MAJOR__
}
ensure_node_major() {
  if use_node_major; then
    return 0
  fi

  if ! nvm install __NODE_MAJOR__; then
    echo "nvm install __NODE_MAJOR__ failed; checking existing Node __NODE_MAJOR__." >&2
    if use_node_major; then
      return 0
    fi
    exit 47
  fi

  use_node_major
}
ensure_node_major
use_existing_codex_if_ready() {
  if command -v codex >/dev/null 2>&1; then
    if codex_version="$(codex --version 2>&1)"; then
      printf 'Codex CLI already installed: %s\n' "$codex_version"
      return 0
    fi
  fi

  return 1
}
if use_existing_codex_if_ready; then
  exit 0
fi
if ! npm install -g @openai/codex@latest; then
  echo "npm global Codex CLI install failed; checking existing codex command." >&2
  if use_existing_codex_if_ready; then
    exit 0
  fi
  exit 46
fi
codex --version
'@
  $quotedNvmInstallUrl = ConvertTo-BashSingleQuotedLiteral $CodexNvmInstallUrl
  $installScript = $installScript.Replace("__NVM_INSTALL_URL__", $quotedNvmInstallUrl).Replace("__NODE_MAJOR__", $CodexWslNodeMajor)
  Invoke-WslScript $installScript
  $env:SOLO_CODEX_WINDOWS_MODE = "wsl"
}

function Test-CodexNativeRuntimeFailure($Message) {
  return ([string]$Message -match "codex(?:\\.cmd)? --version failed with exit (-1073741515|3221225781)") -or ([string]$Message -match "0xC0000135")
}

function Install-CodexNativeRuntime {
  Install-WindowsNativeRuntime "codex.cmd가 -1073741515(0xC0000135)로 종료되면 필요한 Windows C++ runtime DLL을 찾지 못한 상태일 수 있습니다."
}

function Get-CodexNativeVersion {
  if (-not (Test-Command codex)) {
    return $null
  }

  try {
    $codex = Get-ToolPath "codex"
    $output = & $codex @("--version") 2>&1
    if ($LASTEXITCODE -ne 0) {
      return $null
    }

    $versionLine = [string]($output | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($versionLine)) {
      return "codex --version succeeded"
    }

    return $versionLine.Trim()
  } catch {
    return $null
  }
}

function Use-ExistingCodexNativeIfReady($Source) {
  $version = Get-CodexNativeVersion
  if ($version) {
    Write-Step "Codex CLI already installed: $version ($Source)"
    return $true
  }

  return $false
}

function Confirm-CodexNativeVersion {
  try {
    Invoke-Tool "codex" @("--version")
  } catch {
    if (-not (Test-CodexNativeRuntimeFailure $_.Exception.Message)) {
      throw
    }

    Write-Warn "Codex CLI 실행에 필요한 Windows native runtime이 빠져 있어 Visual C++ Redistributable 설치 후 다시 확인합니다. $($_.Exception.Message)"
    Install-CodexNativeRuntime
    Add-CommonToolPaths
    Invoke-Tool "codex" @("--version")
  }
}

function Ensure-CodexCliNative {
  Add-CommonToolPaths
  if (Use-ExistingCodexNativeIfReady "existing command") {
    return
  }

  if (Test-Command codex) {
    try {
      Confirm-CodexNativeVersion
      Write-Step "Codex CLI already installed: codex --version succeeded after runtime repair (existing command)"
      return
    } catch {
      Write-Warn "기존 Codex CLI가 있지만 실행 확인에 실패해 npm 설치/업데이트를 시도합니다. $($_.Exception.Message)"
    }
  }

  if (-not (Test-Command npm)) {
    throw "Codex CLI 설치를 위해 npm이 필요합니다. Node 24 이상 설치 후 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Write-Step "OpenAI Codex CLI 설치/업데이트"
  try {
    Invoke-Tool "npm" @("install", "-g", "@openai/codex@latest")
  } catch {
    $installError = $_
    Write-Warn "npm global Codex CLI 설치가 실패했습니다. 이미 있는 codex 명령을 한 번 더 확인합니다. $($_.Exception.Message)"
    Add-CommonToolPaths
    if (Use-ExistingCodexNativeIfReady "after codex npm fallback failure") {
      return
    }

    if (Test-Command codex) {
      try {
        Confirm-CodexNativeVersion
        Write-Step "Codex CLI ready after npm install failure"
        return
      } catch {
        Write-Warn "기존 Codex CLI 확인도 실패했습니다. $($_.Exception.Message)"
      }
    }

    throw $installError
  }

  Add-CommonToolPaths
  if (-not (Test-Command codex)) {
    throw "Codex CLI 설치 후에도 codex 명령을 찾지 못했습니다. 새 PowerShell에서 README의 한 줄 설치 명령을 다시 실행하세요."
  }

  Confirm-CodexNativeVersion
}

function Ensure-CodexCli {
  Assert-CodexWindowsMode
  if ($CodexWindowsMode -eq "native") {
    Write-Warn "SOLO_SUPERMAN_CODEX_WINDOWS_MODE=native가 지정되어 Windows native Codex CLI 경로를 사용합니다. 기본값은 WSL입니다."
    Ensure-CodexCliNative
    $env:SOLO_CODEX_WINDOWS_MODE = "native"
    return
  }

  Ensure-CodexCliInWsl
}

function Show-CodexDesktopAppPrompt {
  if ($ShowCodexDesktopPrompt -eq "0") {
    return
  }

  Write-Step "Codex Desktop App 안내"
  if ($CodexWindowsMode -eq "wsl") {
    Write-Host "Codex CLI는 Windows 안정성을 위해 WSL 안에 설치했습니다. Solo Superman 이후 바이브 코딩/다중 agent 작업을 더 하고 싶으면 열린 창에서 Codex Desktop App for Windows를 다운로드하고 ChatGPT 계정으로 로그인하세요."
  } else {
    Write-Host "Codex CLI는 Windows native 경로에 설치했습니다. Solo Superman 이후 바이브 코딩/다중 agent 작업을 더 하고 싶으면 열린 창에서 Codex Desktop App for Windows를 다운로드하고 ChatGPT 계정으로 로그인하세요."
  }
  Write-Host "다운로드 안내: $CodexDesktopAppUrl"

  try {
    Start-Process $CodexDesktopAppUrl
  } catch {
    Write-Warn "Codex Desktop App 다운로드 페이지를 자동으로 열지 못했습니다. 브라우저에서 직접 여세요: $CodexDesktopAppUrl"
  }

  try {
    $wscript = New-Object -ComObject WScript.Shell
    $codexModeMessage = if ($CodexWindowsMode -eq "wsl") { "Codex CLI 설치가 WSL 안에서 완료되었습니다." } else { "Codex CLI 설치가 Windows native 경로에서 완료되었습니다." }
    $message = "$codexModeMessage`n`nSolo Superman 이후 바이브 코딩이나 여러 agent 병렬 작업을 더 하고 싶으면 열린 브라우저 창에서 Codex Desktop App for Windows를 다운로드하고 ChatGPT 계정으로 로그인하세요.`n`n$CodexDesktopAppUrl"
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

function Normalize-RepoRemotePath($Remote) {
  if ([string]::IsNullOrWhiteSpace($Remote)) {
    return $null
  }

  $normalized = ([string]$Remote).Trim().Replace("\", "/").TrimEnd("/")
  foreach ($pattern in @(
    "^https://github\.com/(?<owner>[^/]+)/(?<repo>[^/#?]+?)(?:\.git)?$",
    "^git@github\.com:(?<owner>[^/]+)/(?<repo>[^/#?]+?)(?:\.git)?$",
    "^ssh://git@github\.com/(?<owner>[^/]+)/(?<repo>[^/#?]+?)(?:\.git)?$"
  )) {
    if ($normalized -match $pattern) {
      return "$($Matches.owner)/$($Matches.repo)"
    }
  }

  return $null
}

function Test-ExpectedRepo($Path) {
  if (-not (Test-Path (Join-Path $Path ".git"))) {
    return $false
  }

  $remote = Get-OriginRemote $Path
  if ($remote -and [string]::Equals(([string]$remote).Trim().TrimEnd("/"), ([string]$RepoUrl).Trim().TrimEnd("/"), [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  $remotePath = Normalize-RepoRemotePath $remote
  return $remotePath -in @(
    "bee-community-master/solo_superman",
    "HearingOffice/solo_superman"
  )
}

function Sync-OriginRemote($Path) {
  $remote = Get-OriginRemote $Path
  if ($remote -and ($remote -ne $RepoUrl)) {
    Write-Step "origin remote update: $remote -> $RepoUrl"
    Invoke-Tool "git" @("-C", $Path, "remote", "set-url", "origin", $RepoUrl)
  }
}

function Get-GitFirstLine($Path, [string[]]$Arguments) {
  try {
    $git = Get-ToolPath "git"
    $gitArguments = @("-C", $Path) + $Arguments
    $output = & $git @gitArguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }

    $line = $output | Select-Object -First 1
    if ($null -eq $line) {
      return $null
    }

    return ([string]$line).Trim()
  } catch {
    return $null
  }
}

function Get-GitOutputLines($Path, [string[]]$Arguments) {
  try {
    $git = Get-ToolPath "git"
    $gitArguments = @("-C", $Path) + $Arguments
    $output = & $git @gitArguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return @{
        Success = $false
        Lines = @()
      }
    }

    return @{
      Success = $true
      Lines = @($output | ForEach-Object { [string]$_ })
    }
  } catch {
    return @{
      Success = $false
      Lines = @()
    }
  }
}

function Test-GeneratedRunnerStatusLine($Line) {
  return ([string]$Line).Trim() -eq "?? solo_superman.cmd"
}

function Test-GitCommand($Path, [string[]]$Arguments) {
  try {
    $git = Get-ToolPath "git"
    $gitArguments = @("-C", $Path) + $Arguments
    & $git @gitArguments > $null 2> $null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Get-CheckoutDefaultBranch($Path) {
  $originHead = Get-GitFirstLine $Path @("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD")
  if ($originHead -and $originHead.StartsWith("origin/")) {
    return $originHead.Substring("origin/".Length)
  }

  return "main"
}

function Update-ExistingCheckoutSafely($Path) {
  $statusResult = Get-GitOutputLines $Path @("status", "--porcelain")
  if (-not $statusResult.Success) {
    Write-Warn "기존 checkout 상태를 확인하지 못해 자동 업데이트를 건너뜁니다."
    return
  }

  $statusLines = @($statusResult.Lines)
  $blockingStatusLines = @($statusLines | Where-Object { -not (Test-GeneratedRunnerStatusLine $_) })
  if ($blockingStatusLines.Count -gt 0) {
    Write-Warn "기존 checkout에 local 변경/untracked 파일이 있어 자동 업데이트를 건너뜁니다. 사용자 파일을 덮어쓰지 않고 계속 진행합니다."
    return
  }

  $currentBranch = Get-GitFirstLine $Path @("symbolic-ref", "--quiet", "--short", "HEAD")
  if (-not $currentBranch) {
    Write-Warn "기존 checkout이 detached HEAD 상태라 자동 업데이트를 건너뜁니다."
    return
  }

  $defaultBranch = Get-CheckoutDefaultBranch $Path
  $remoteRef = "origin/$defaultBranch"
  if ($currentBranch -ne $defaultBranch) {
    Write-Warn "현재 branch가 $currentBranch 이라 자동 업데이트를 건너뜁니다. 기본 branch($defaultBranch)는 원격에서만 확인했습니다."
    return
  }

  if (-not (Test-GitCommand $Path @("rev-parse", "--verify", "--quiet", $remoteRef))) {
    Write-Warn "$remoteRef ref를 확인하지 못해 자동 업데이트를 건너뜁니다."
    return
  }

  if (-not (Test-GitCommand $Path @("merge-base", "--is-ancestor", "HEAD", $remoteRef))) {
    Write-Warn "기존 checkout이 $remoteRef 와 diverged 상태라 자동 업데이트를 건너뜁니다. 사용자 변경을 덮어쓰지 않습니다."
    return
  }

  $headSha = Get-GitFirstLine $Path @("rev-parse", "--short", "HEAD")
  $remoteSha = Get-GitFirstLine $Path @("rev-parse", "--short", $remoteRef)
  if ($headSha -and $remoteSha -and ($headSha -eq $remoteSha)) {
    Write-Step "checkout already up to date: $remoteRef@$remoteSha"
    return
  }

  Write-Step "safe fast-forward update: $headSha -> $remoteSha"
  try {
    Invoke-Tool "git" @("-C", $Path, "merge", "--ff-only", $remoteRef)
  } catch {
    Write-Warn "safe fast-forward update가 실패해 기존 checkout으로 계속 진행합니다. $($_.Exception.Message)"
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

function Remove-LegacyDesktopRunners($DesktopPaths, $KeepPath) {
  foreach ($desktop in $DesktopPaths) {
    foreach ($runnerName in @("solo_superman.cmd", "solo_superman.lnk")) {
      $legacyPath = Join-Path $desktop $runnerName
      try {
        if ($KeepPath) {
          $legacyFullPath = [System.IO.Path]::GetFullPath($legacyPath)
          $keepFullPath = [System.IO.Path]::GetFullPath($KeepPath)
          if ([string]::Equals($legacyFullPath, $keepFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
          }
        }

        if (Test-Path -LiteralPath $legacyPath) {
          Remove-Item -LiteralPath $legacyPath -Force -ErrorAction Stop
        }
      } catch {
        Write-Warn "기존 바탕화면 실행파일 정리를 건너뜁니다: $legacyPath :: $($_.Exception.Message)"
      }
    }
  }
}

function New-DesktopRunner($TargetPath) {
  $runnerPaths = New-Object System.Collections.Generic.List[string]
  $failedDesktopPaths = New-Object System.Collections.Generic.List[string]
  $safeTargetPath = ConvertTo-CmdValue $TargetPath
  $safeBootstrapCommand = ConvertTo-CmdEchoValue $BootstrapCommand
  $safeCodexWindowsMode = ConvertTo-CmdValue $CodexWindowsMode
  $safeCodexWslDistro = ConvertTo-CmdValue $CodexWslDistro
  $safeCodexWslNodeMajor = ConvertTo-CmdValue $CodexWslNodeMajor
  $pathLine = 'set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Microsoft\WindowsApps"'
  $content = @(
    "@echo off",
    "setlocal enableextensions",
    "set ""SOLO_EXIT=0""",
    $pathLine,
    "set ""SOLO_SUPERMAN_DIR=$safeTargetPath""",
    "set ""SOLO_CODEX_WINDOWS_MODE=$safeCodexWindowsMode""",
    "set ""SOLO_SUPERMAN_CODEX_WSL_DISTRO=$safeCodexWslDistro""",
    "set ""SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR=$safeCodexWslNodeMajor""",
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
    "call pnpm.cmd start:local",
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
  $wrapperPath = Join-Path $TargetPath "solo_superman.cmd"
  Set-Content -Path $wrapperPath -Value $content -Encoding ASCII
  $desktopPaths = @(Get-DesktopPaths)

  foreach ($desktop in $desktopPaths) {
    try {
      $wscript = New-Object -ComObject WScript.Shell
      $shortcutPath = Join-Path $desktop "solo_superman.lnk"
      Remove-LegacyDesktopRunners $desktopPaths $shortcutPath
      $shortcut = $wscript.CreateShortcut($shortcutPath)
      $shortcut.TargetPath = $wrapperPath
      $shortcut.WorkingDirectory = $TargetPath
      $shortcut.Description = "Start Solo Superman locally"
      $shortcut.Save()
      if (-not $runnerPaths.Contains($shortcutPath)) {
        $runnerPaths.Add($shortcutPath)
      }
      break
    } catch {
      $failedDesktopPaths.Add("$desktop :: $($_.Exception.Message)")
      Write-Warn "바탕화면 바로가기 생성 후보를 건너뜁니다: $desktop :: $($_.Exception.Message)"
    }
  }

  if ($runnerPaths.Count -eq 0) {
    throw "바탕화면 바로가기를 만들 수 있는 경로를 찾지 못했습니다. 관리자 권한 PowerShell에서 다시 실행하세요. 실패 후보: $($failedDesktopPaths -join '; ')"
  }

  Write-Step "바탕화면 바로가기 확인/생성"
  foreach ($runnerPath in $runnerPaths) {
    Write-Host "- $runnerPath"
  }
  Write-Host "실행 wrapper: $wrapperPath"

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

function Test-LocalTcpPortAvailable($Port) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), [int]$Port)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $listener.Stop()
  }
}

function Get-ProdSmokeConfiguredPort($Name, $DefaultPort) {
  $rawValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  $parsedPort = 0
  if ($rawValue) {
    if ([int]::TryParse($rawValue, [ref]$parsedPort) -and ($parsedPort -gt 0) -and ($parsedPort -le 65535)) {
      return $parsedPort
    }
  }

  return [int]$DefaultPort
}

function Get-ProdSmokePortConflicts {
  $conflicts = New-Object System.Collections.Generic.List[string]
  foreach ($entry in @(
    @{ Name = "SOLO_PROD_SMOKE_SIDECAR_PORT"; DefaultPort = 43110 },
    @{ Name = "SOLO_PROD_SMOKE_WEB_PORT"; DefaultPort = 4173 }
  )) {
    $port = Get-ProdSmokeConfiguredPort $entry.Name $entry.DefaultPort
    if (-not (Test-LocalTcpPortAvailable $port)) {
      $conflicts.Add("$($entry.Name)=$port")
    }
  }

  return $conflicts.ToArray()
}

function Invoke-ProdSmokeWithAlternatePorts {
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
    Invoke-ProdSmokeCommand
  } finally {
    if ($null -eq $oldSidecarPort) { Remove-Item Env:SOLO_PROD_SMOKE_SIDECAR_PORT -ErrorAction SilentlyContinue } else { $env:SOLO_PROD_SMOKE_SIDECAR_PORT = $oldSidecarPort }
    if ($null -eq $oldWebPort) { Remove-Item Env:SOLO_PROD_SMOKE_WEB_PORT -ErrorAction SilentlyContinue } else { $env:SOLO_PROD_SMOKE_WEB_PORT = $oldWebPort }
  }
}

function Invoke-ProdSmokeCommand {
  $oldSmokeLogPath = $env:SOLO_PROD_SMOKE_LOG_PATH
  try {
    if ($ProdSmokeLogPath) {
      $env:SOLO_PROD_SMOKE_LOG_PATH = $ProdSmokeLogPath
      Write-DiagnosticLog "production smoke diagnostic log: $ProdSmokeLogPath"
    }
    Invoke-Pnpm @("verify:prod-bundle")
  } finally {
    if ($null -eq $oldSmokeLogPath) {
      Remove-Item Env:SOLO_PROD_SMOKE_LOG_PATH -ErrorAction SilentlyContinue
    } else {
      $env:SOLO_PROD_SMOKE_LOG_PATH = $oldSmokeLogPath
    }
  }
}

function Invoke-ProdSmoke {
  if ($RunSmoke -eq "0") {
    Write-Step "내장 설정으로 smoke 검증을 건너뜁니다."
    return
  }

  Write-Step "production bundle smoke"
  if ($ProdSmokeLogPath) {
    Write-Host "production smoke 진단 로그: $ProdSmokeLogPath"
  }
  $portConflicts = @(Get-ProdSmokePortConflicts)
  if ($portConflicts.Count -eq 0) {
    try {
      Invoke-ProdSmokeCommand
      return
    } catch {
      if (-not (Test-PortConflictError $_.Exception.Message)) {
        throw "production bundle smoke가 포트 충돌 전 단계에서 실패했습니다. 진단 로그: bootstrap=$BootstrapLogPath smoke=$ProdSmokeLogPath. pnpm child process는 SOLO_PNPM_COMMAND로 현재 pnpm 경로를 전달해 실행합니다. $($_.Exception.Message)"
      }

      Write-Warn "production bundle smoke 실행 중 포트 충돌 가능성이 있어 빈 포트로 한 번 더 시도합니다. $($_.Exception.Message)"
    }
  } else {
    Write-Warn "production bundle smoke 기본/설정 포트가 이미 사용 중이라 빈 포트를 자동 선택합니다: $($portConflicts -join ', ')"
  }

  Invoke-ProdSmokeWithAlternatePorts
}

function Invoke-LocalWeb {
  if ($StartLocal -eq "0") {
    Write-Step "내장 설정으로 local web 자동 실행을 건너뜁니다."
    Write-Host "나중에 실행하려면 바탕화면의 solo_superman 바로가기를 더블클릭하거나 아래 명령을 실행하세요:"
    Write-Host "Set-Location `"$TargetPath`"; pnpm.cmd start:local"
    return
  }

  Write-Step "Solo Superman web 화면을 엽니다. 브라우저가 열리면 이 터미널을 닫지 마세요."
  $env:SOLO_CODEX_WINDOWS_MODE = $CodexWindowsMode
  Invoke-Pnpm @("start:local")
}

function Write-InstallSummary($TargetPath, $DesktopRunnerPaths) {
  Write-Host ""
  Write-Host "Solo Superman 설치가 완료됐습니다." -ForegroundColor Green
  Write-Host "설치 경로: $TargetPath"
  Write-Host "Codex 실행 경로: Windows $CodexWindowsMode"
  if ($DesktopRunnerPaths -and $DesktopRunnerPaths.Count -gt 0) {
    Write-Host "바탕화면 바로가기 확인/생성:"
    foreach ($runnerPath in $DesktopRunnerPaths) {
      Write-Host "- $runnerPath"
    }
    Write-Host "바탕화면에 보이지 않으면 파일 탐색기 주소창에 위 경로의 폴더를 붙여넣어 확인하세요."
  } else {
    Write-Host "바탕화면 바로가기: 생성되지 않음"
  }
  Write-Host "다시 실행 명령: Set-Location `"$TargetPath`"; pnpm.cmd start:local"
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
  Write-Host "진단 로그:"
  Write-Host "- bootstrap: $BootstrapLogPath"
  if ($ProdSmokeLogPath) {
    Write-Host "- production smoke: $ProdSmokeLogPath"
  }
  Write-Host ""
  Write-Host "다시 시도하려면 새 PowerShell에서 아래 한 줄을 그대로 붙여넣으세요:"
  Write-Host $BootstrapCommand
  Write-Host "네트워크/회사 보안 정책/관리자 권한이 막는 경우에는 정책을 우회하지 않고 여기서 멈춥니다."
}

try {
Write-Host "bootstrap 진단 로그: $BootstrapLogPath"
Write-DiagnosticLog "bootstrap started"
Write-DiagnosticLog "PowerShell=$($PSVersionTable.PSVersion) OS=$([System.Environment]::OSVersion.VersionString) Process64=$([System.Environment]::Is64BitProcess)"
Restart-AsAdministrator
Add-CommonToolPaths
Ensure-Git
Ensure-Node
Ensure-WindowsNativeRuntime
Ensure-Pnpm
Ensure-CodexCli

$TargetDir = Resolve-InstallTarget
$TargetPath = Get-AbsolutePath $TargetDir

if (Test-ExpectedRepo $TargetPath) {
  Write-Step "기존 checkout 사용: $TargetPath"
  Sync-OriginRemote $TargetPath
  try {
    Invoke-Tool "git" @("-C", $TargetPath, "fetch", "--prune", "origin")
    Update-ExistingCheckoutSafely $TargetPath
  } catch {
    Write-Warn "원격 업데이트 확인에 실패했지만 기존 checkout으로 계속 진행합니다. $($_.Exception.Message)"
  }
} else {
  Write-Step "repo clone: $RepoUrl -> $TargetPath"
  Invoke-Tool "git" @("clone", $RepoUrl, $TargetPath)
}

Set-Location $TargetPath
$ProdSmokeLogPath = Join-Path $TargetPath "solo-superman-prod-bundle-smoke-$DiagnosticTimestamp.log"
Write-DiagnosticLog "target path: $TargetPath"
Write-DiagnosticLog "production smoke log path: $ProdSmokeLogPath"
Write-Step "dependency install"
Invoke-Pnpm @("install", "--frozen-lockfile")

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
