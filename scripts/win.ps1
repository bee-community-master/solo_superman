$ErrorActionPreference = "Stop"

$utf8 = New-Object System.Text.UTF8Encoding $false
try {
  [Console]::InputEncoding = $utf8
} catch {
}
try {
  [Console]::OutputEncoding = $utf8
} catch {
}
$OutputEncoding = $utf8
try {
  $null = & chcp.com 65001 2>$null
} catch {
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$bootstrapUrl = if ($env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL) {
  $env:SOLO_SUPERMAN_WINDOWS_BOOTSTRAP_URL
} else {
  "https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1"
}

$wc = New-Object Net.WebClient
$wc.Encoding = $utf8
$script = $wc.DownloadString($bootstrapUrl)
if ($script.Length -gt 0 -and $script[0] -eq [char]0xFEFF) {
  $script = $script.Substring(1)
}

iex $script
