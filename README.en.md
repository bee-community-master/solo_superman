# Solo Superman

Language: [한국어](README.md) | English

## Overview

Solo Superman is a local-first Founder OS for solo founders. It turns ideas into concrete question loops, research, and decision sessions, then runs them through a local web UI and a local Node/Hono service.

The current release state is a **technical preview**. The goal at this stage is to let non-developers reach the local web screen with a one-line installer. Risky actions such as file edits, shell execution, browser control, or external-service submissions are not run automatically; they are first captured as reviewable execution-prep notes.

The installer checks Node.js 24 or newer, Git, and Corepack/pnpm, installs missing prerequisites when safe, clones the repository, installs dependencies, verifies that the local app can run, and opens the browser automatically. If a folder with the same name already exists or the default local ports are already in use, it does not overwrite user files or kill running processes; it chooses a safe alternate path or port instead.

## Installation

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 | iex
```

If the installer asks for a new terminal so PATH changes can take effect, open a new terminal and run the same one-line command again to continue. When automatic recovery is unsafe because of network restrictions, company security policy, or administrator permissions, the installer does not bypass the policy; it shows a plain-language error and the command to retry.

## Running locally

After installation, the local server keeps running and the Solo Superman web screen opens automatically in your default browser. Keep that terminal open while using the app. Press `Ctrl+C` to stop it.

To run it again later, use the command below. The completion message shows the install path, rerun command, and Desktop runner status. On Windows, the installer checks or recreates `solo_superman.cmd` plus a `solo_superman` shortcut across visible Desktop candidates even when the app is already installed, so later launches can start the same local run by double-clicking that file. On macOS, the installer does not create a Desktop runner and instead shows the rerun command.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location .\solo_superman; pnpm start:local
```

Reaching the local first screen and running the default local path do not require an OpenAI API key or ChatGPT credentials. Only when backend question/research preview work starts does the local UI ask you to sign in directly to ChatGPT in your browser and verify that the local Codex CLI is logged in. If it is missing, the UI can open a background Terminal running `codex auth login` so Codex shows the browser login screen; Solo Superman does not collect or store those credentials. For troubleshooting, see [`docs/troubleshooting.md`](docs/troubleshooting.md). For contributor onboarding and architecture notes, start at [`docs/README.md`](docs/README.md).

## Release scope

- Current recommended public channel: limited beta or technical preview
- Suitable users: users who are comfortable installing a local app, or who can follow guidance to run one terminal command
- Remaining general-release work: macOS/Windows installers, automatic updates, error reporting, and Windows real-device verification

Note: the Windows PowerShell install path is documented, but before broad public release it still needs a separate real Windows device verification pass from one-line install through first-screen arrival.
