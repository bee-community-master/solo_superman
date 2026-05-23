# Solo Superman

Language: [한국어](README.md) | English

## Overview

Solo Superman is a local-first Founder OS for solo founders. It turns ideas into concrete question loops, research, and decision sessions, then runs them through a local web UI and a local Node/Hono service.

The current release state is a **technical preview**. The goal at this stage is to let non-developers reach the local web screen with a one-line installer. Risky actions such as file edits, shell execution, browser control, or external-service submissions are not run automatically; they are first captured as reviewable execution-prep notes.

The installer checks Node.js 24 or newer, Git, Corepack/pnpm, Windows native runtime, and Codex CLI, installs missing prerequisites when safe, clones the repository, installs dependencies, verifies that the local app can run, and opens the browser automatically. On Windows, it keeps the app Node/pnpm toolchain on Windows but installs and runs Codex CLI inside WSL (Ubuntu) with `SOLO_CODEX_WINDOWS_MODE=wsl` for the more stable Codex path. When an existing Codex CLI passes `codex --version`, the installer reuses it even if the npm global install path reports an `already exists` conflict. It also opens a Codex Desktop App download prompt for users who want to continue with vibe coding or multiple parallel agents. If a folder with the same name already exists or the default local ports are already in use, it does not overwrite user files or kill running processes; it chooses a safe alternate path or port instead. When an existing install folder is a clean checkout, rerunning the same one-line installer attempts a safe fast-forward update to `origin/main`; if local changes or a diverged branch are present, it skips the update. This rerun update is only the git-checkout technical-preview path; signed packaged-app automatic updates must pass a separate release channel manifest/signature/checksum/retry/rollback contract.

## Installation

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

Run PowerShell **as Administrator** from the Start menu, then paste the one-line command below. Without administrator permissions, the Node.js/Git install step can fail.

```powershell
irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 | iex
```

This short command runs a tiny Windows launcher first. The launcher sets UTF-8 console output, TLS 1.2, UTF-8 script download decoding, and BOM stripping before downloading and starting the full installer, including on Windows PowerShell 5.1. On Windows, before Node/Corepack/pnpm activation, WSL/Ubuntu checks, and Desktop shortcut creation/cleanup, the installer asks for UAC approval and relaunches itself in an administrator PowerShell when needed. For the Codex CLI WSL path, it sets WSL2 as the default version with `wsl --set-default-version 2` and selects the Codex WSL distribution as the default distribution. If no WSL distribution is installed, it tries `wsl --install -d Ubuntu`; on the first WSL install path, where Windows may need a reboot or Ubuntu may still need first-run Linux user/password setup, it stops there and tells the user to reboot, open Ubuntu once, and rerun the same one-line command. If the installer asks for a new terminal so PATH changes can take effect, open a new terminal and run the same one-line command again to continue. When automatic recovery is unsafe because of network restrictions, company security policy, or administrator permissions, the installer does not bypass the policy; it shows a plain-language error and the command to retry.

## Running locally

After installation, the local server keeps running and the Solo Superman web screen opens automatically in your default browser. Keep that terminal open while using the app. Press `Ctrl+C` to stop it.

To run it again later, use the command below. The completion message shows the install path, rerun command, and Desktop shortcut status. On Windows, the installer keeps only one visible `solo_superman` Desktop shortcut by creating or refreshing `solo_superman.lnk` and cleaning up duplicate Desktop `solo_superman.cmd`/`solo_superman.lnk` files left by older installers. The real `solo_superman.cmd` wrapper lives in the install folder, and the Desktop shortcut points to it. If the double-click launch fails, the cmd window stays open, shows the failure output and exit code, and waits for Enter before closing. On macOS, the installer does not create a Desktop runner and instead shows the rerun command. If Windows chose an alternate path such as `solo_superman-2` because of a folder conflict, use the rerun command printed by the installer.

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
- Product capability readiness gate: [`docs/product-capability-readiness_EN.md`](docs/product-capability-readiness_EN.md) and `pnpm verify:product-capability-readiness` check whether questions, research, readiness, browser/service boundaries, and the auto implementation loop are code-backed by credential-free verifiers.
- Local diagnostics bundle for error reports: after a failure, run `pnpm support:bundle` to print the path to a credential-free JSON support bundle. It captures OS/Node/pnpm/git state, product/release diagnostics summaries, and allowlisted environment values only; it does not collect tokens, secrets, cookies, credentials, or file contents.
- Release evidence checklist: `pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json` generates one credential-free JSON checklist for the blocked gates, required checks/evidence, and final verification commands tied to #259/#266/#267. To create Markdown for a specific issue comment, run `pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md`.
- Signed installer package preflight: [`docs/signed-packages_EN.md`](docs/signed-packages_EN.md) and `pnpm verify:signed-package-preflight` verify macOS/Windows package candidates, signing credential gates, and the split between local dry-runs and actual signing gates.
- Signed package release evidence contract: [`docs/signed-package-release_EN.md`](docs/signed-package-release_EN.md) and `pnpm verify:signed-package-release` keep macOS signing/notarization, Windows Authenticode/timestamp, and release manifest signature evidence tied to #266.
- Packaged app update channel contract: [`docs/release-channel_EN.md`](docs/release-channel_EN.md) and `pnpm verify:release-channel` verify manifest signature, artifact checksum/signature, user deferral, retry, rollback, and credential/user-data preservation requirements.
- Packaged update rollback evidence contract: [`docs/packaged-update-rollback_EN.md`](docs/packaged-update-rollback_EN.md), `pnpm verify:packaged-update-rollback`, and `pnpm verify:packaged-update-rollback:dry-run` keep fixture rollback boundaries and macOS/Windows device rollback evidence tied to #267.
- Windows real-device install evidence contract: [`docs/windows-real-device_EN.md`](docs/windows-real-device_EN.md), `pnpm verify:windows-real-device`, and `pnpm verify:windows-installer:dry-run` keep one-line install through first-screen evidence and credential-free installer path drift tied to #259.
- General release readiness gate: [`docs/release-readiness_EN.md`](docs/release-readiness_EN.md) and `pnpm verify:release-readiness` verify that broad/general release remains blocked until signed package, packaged updater rollback, and Windows real-device evidence are ready.
- Remaining general-release work: create and verify macOS/Windows installer packages with real signing/notarization credentials, real packaged-app updater implementation/device rollback verification, and Windows real-device verification

Note: the Windows PowerShell install path is documented, but before broad public release it still needs a separate real Windows device verification pass from one-line install through first-screen arrival.
