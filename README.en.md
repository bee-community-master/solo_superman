# Solo Superman

Language: [한국어](README.md) | English

## Overview

Solo Superman is a local-first Founder OS for solo founders. It turns ideas into concrete question loops, research, and decision sessions, then runs them through a local web UI and a local Node/Hono service.

The current release state is a **technical preview**. The goal at this stage is to let non-developers reach the local web screen with a one-line installer. Risky actions such as file edits, shell execution, browser control, or external-service submissions are not run automatically; they are first captured as reviewable execution-prep notes.

The installer checks Node.js 24 or newer, Git, Corepack/pnpm, Windows native runtime, and Codex CLI, installs missing prerequisites when safe, clones the repository, installs dependencies, verifies that the local app can run, and opens the browser automatically. On Windows, it keeps the app Node/pnpm toolchain on Windows but installs and runs Codex CLI inside WSL (Ubuntu) with `SOLO_CODEX_WINDOWS_MODE=wsl` for the more stable Codex path. When an existing Codex CLI passes `codex --version`, the installer reuses it even if the npm global install path reports an `already exists` conflict. It also opens a Codex Desktop App download prompt for users who want to continue with vibe coding or multiple parallel agents. If a folder with the same name already exists or the default local ports are already in use, it does not overwrite user files or kill running processes; it chooses a safe alternate path or port instead.

## Installation

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

Run PowerShell **as Administrator** from the Start menu, then paste the one-line command below. Without administrator permissions, the Node.js/Git install step can fail.

```powershell
$utf8 = New-Object System.Text.UTF8Encoding $false; [Console]::InputEncoding = $utf8; [Console]::OutputEncoding = $utf8; $OutputEncoding = $utf8; chcp.com 65001 > $null; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object Net.WebClient; $wc.Encoding = $utf8; $script = $wc.DownloadString("https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1"); if ($script.Length -gt 0 -and $script[0] -eq [char]0xFEFF) { $script = $script.Substring(1) }; iex $script
```

This command sets UTF-8 console output, TLS 1.2, and UTF-8 script download decoding before installation, including on Windows PowerShell 5.1. On Windows, before Node/Corepack/pnpm activation, WSL/Ubuntu checks, and public Desktop runner creation, the installer asks for UAC approval and relaunches itself in an administrator PowerShell when needed. For the Codex CLI WSL path, it sets WSL2 as the default version with `wsl --set-default-version 2` and selects the Codex WSL distribution as the default distribution. If no WSL distribution is installed, it tries `wsl --install -d Ubuntu`; on the first WSL install path, where Windows may need a reboot or Ubuntu may still need first-run Linux user/password setup, it stops there and tells the user to reboot, open Ubuntu once, and rerun the same one-line command. If the installer asks for a new terminal so PATH changes can take effect, open a new terminal and run the same one-line command again to continue. When automatic recovery is unsafe because of network restrictions, company security policy, or administrator permissions, the installer does not bypass the policy; it shows a plain-language error and the command to retry.

## Running locally

After installation, the local server keeps running and the Solo Superman web screen opens automatically in your default browser. Keep that terminal open while using the app. Press `Ctrl+C` to stop it.

To run it again later, use the command below. The completion message shows the install path, rerun command, and Desktop runner status. On Windows, the installer checks or recreates `solo_superman.cmd` plus a `solo_superman` shortcut across visible Desktop candidates even when the app is already installed, so later launches can start the same local run by double-clicking that file. If the double-click launch fails, the cmd window stays open, shows the failure output and exit code, and waits for Enter before closing. On macOS, the installer does not create a Desktop runner and instead shows the rerun command. If Windows chose an alternate path such as `solo_superman-2` because of a folder conflict, use the rerun command printed by the installer.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location "$HOME\solo_superman"; pnpm.cmd start:local
```

Reaching the local first screen and running the default local path do not require an OpenAI API key, ChatGPT web credential, or ChatGPT Pro session. When backend question/research preview work starts, the local UI checks only the local Codex CLI with `codex login status`; it does not inspect a ChatGPT web session. On Windows, that Codex CLI check and `codex auth login` run inside WSL. If needed, the UI can open a background Terminal so Codex shows the browser login screen. Separate features that use a ChatGPT browser session require a user-approved flow and are not a default preview prerequisite. Solo Superman does not collect or store any credentials. For troubleshooting, see [`docs/troubleshooting_EN.md`](docs/troubleshooting_EN.md). For contributor onboarding and architecture notes, start at [`docs/README_EN.md`](docs/README_EN.md).

## Release scope

- Current recommended public channel: limited-beta-style technical preview
- Suitable users: users who are comfortable installing a local app, or who can follow guidance to run one terminal command
- Remaining general-release work: signed macOS/Windows installer packages, automatic updates, error reporting, and Windows real-device verification

Note: the Windows PowerShell install path is documented, but before broad public release it still needs a separate real Windows device verification pass from one-line install through first-screen arrival.
