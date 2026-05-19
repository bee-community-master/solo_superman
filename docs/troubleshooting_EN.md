# Local Install, Run, and Troubleshooting

Language: [한국어](troubleshooting_KO.md) | English

## Release posture

Solo Superman is currently a limited-beta-style technical preview. The goal is to let a non-developer reach the local web screen through a safe one-line installer, while keeping risky actions reviewable.

## One-line install

| macOS shell | Windows PowerShell |
| --- | --- |
| `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"` | `irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 \| iex` |

The installer checks Node.js 24+, Git, Corepack/pnpm, Codex CLI, dependency install, local run readiness, and browser opening. On Windows it keeps app execution on Windows Node/pnpm, but installs and runs Codex CLI inside WSL by default with `SOLO_CODEX_WINDOWS_MODE=wsl` because that path is more stable for Codex/Codex CLI on affected Windows machines. It also opens a Codex Desktop App guidance window for users who want vibe coding or multiple parallel agents after Solo Superman setup. It should not overwrite an existing folder or kill an unrelated process to claim a port.

## Manual prerequisites

### macOS shell

```sh
node --version
git --version
corepack enable
pnpm --version
```

### Windows PowerShell

The README one-line Windows installer self-elevates before prerequisite changes: if it is not already running as administrator, it asks for Windows UAC approval and relaunches the same bootstrap command in an administrator PowerShell. This is required because Corepack may need to write shims under `C:\Program Files\nodejs` and the Desktop runner pass may touch `C:\Users\Public\Desktop`. If UAC or company policy blocks elevation, the installer stops with the retry command instead of bypassing policy.

After Node/npm and pnpm are ready, the Windows installer uses WSL for Codex by default. It checks for `wsl.exe`, installs Ubuntu with `wsl --install -d Ubuntu` when no distribution is present, and stops with a plain-language retry message if Windows needs a reboot or Ubuntu still needs first-run Linux user/password setup. Inside WSL, it explicitly resolves the Linux home directory, pins `NVM_DIR` to `$HOME/.nvm`, installs nvm when needed, runs `nvm install 22`, installs or updates OpenAI Codex CLI with `npm install -g @openai/codex@latest`, and validates it with `codex --version`. The Desktop runner sets `SOLO_CODEX_WINDOWS_MODE=wsl`, and the sidecar launches Codex account checks with `wsl.exe -- bash -lc ...` instead of native `codex.cmd`.

If a maintainer explicitly sets `SOLO_SUPERMAN_CODEX_WINDOWS_MODE=native`, the Windows installer can still use the native fallback: it installs or updates OpenAI Codex CLI with `npm install -g @openai/codex@latest` and validates it with `codex --version`. If `codex.cmd --version` fails with exit `-1073741515` (`0xC0000135`), the installer treats that as a missing native runtime signal, installs Microsoft Visual C++ Redistributable (x64) with `winget install --id Microsoft.VCRedist.2015+.x64 -e`, then retries `codex --version`. It does not start a Codex login flow or store credentials; users sign in later with their ChatGPT account or API key when they choose to use Codex. For the optional desktop experience, the installer opens `https://openai.com/codex/` and shows a small Windows prompt explaining that users can download Codex Desktop App for Windows if they want vibe coding or multiple parallel agents.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
corepack enable
pnpm --version
wsl --install -d Ubuntu
wsl -- bash -lc 'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash'
wsl -- bash -lc 'NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh"; nvm install 22; nvm use 22; npm install -g @openai/codex@latest; codex --version'
winget install --id Microsoft.VCRedist.2015+.x64 -e
codex --version
```

## Run locally

On Windows, the installer creates or refreshes Solo Superman Desktop runners named `solo_superman.cmd` and `solo_superman.lnk` for later launches, including localized, public, or OneDrive-redirected Desktop folders. These runners are Solo Superman relaunch wrappers, not the OpenAI Codex Desktop App. The runner uses `call pnpm start:local` so control returns to the cmd wrapper; if launch fails, the cmd window keeps the failure output visible, prints the exit code, and waits for Enter before closing. The macOS installer does not create a Desktop runner and prints the rerun command instead.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location .\solo_superman; pnpm start:local
```

The default local path does not require an OpenAI API key or ChatGPT web credential by default; in plain language, reaching the local first screen needs neither an OpenAI API key, a ChatGPT web credential, nor a ChatGPT Pro session. Backend question/research preview checks the local Codex CLI with `codex login status`; it does not check whether the user is signed in to ChatGPT on the web. On Windows, the sidecar runs that Codex CLI through WSL, so the effective command is `wsl.exe -- bash -lc '... codex login status'` and login opens a WSL-backed `codex auth login` terminal. If Codex login is missing, the UI can offer to open `codex auth login` through a background terminal. The UI labels are Open Codex login and Refresh Codex login status. Separate ChatGPT browser-session delegation requires its own user-approved flow and is not part of the default local run. Solo Superman does not collect or store any credentials.

## Verification commands

Contributors can run:

```sh
pnpm verify:prod-bundle
pnpm verify
```

A production bundle smoke must cover `build_auto_local_smoke`, browser readiness, managed child processes stopped, temporary app data removed, and auto shutdown/kill evidence.

## Local token and sidecar URL

The local service uses a per-run local capability token. In normal `pnpm start:local` or installer runs, the launcher creates one fresh token and passes it to both the browser build and sidecar. The browser build receives `VITE_SOLO_LOCAL_CAPABILITY_TOKEN` and `VITE_SOLO_SIDECAR_BASE_URL`. The sidecar uses `SOLO_LOCAL_CAPABILITY_TOKEN`. A token mismatch fails visibly with `401`.

Example shell values. The fixed `local-dev-token` used in the examples below is a manual troubleshooting placeholder only; do not describe it as the launcher-generated per-run token.

```sh
export SOLO_LOCAL_CAPABILITY_TOKEN=local-dev-token
export VITE_SOLO_LOCAL_CAPABILITY_TOKEN=local-dev-token
export VITE_SOLO_SIDECAR_BASE_URL=http://127.0.0.1:43110
```

Example Windows PowerShell values:

```powershell
$env:SOLO_LOCAL_CAPABILITY_TOKEN = "local-dev-token"
$env:VITE_SOLO_LOCAL_CAPABILITY_TOKEN = "local-dev-token"
$env:VITE_SOLO_SIDECAR_BASE_URL = "http://127.0.0.1:43110"
```

## Manual browser smoke

- `http://127.0.0.1:<web-port>/` should show the Solo Superman first screen.
- `http://127.0.0.1:<sidecar-port>/readyz` should return readiness JSON.
- If auto-open fails, copy the printed URL into the browser manually.

## Manual Windows PowerShell checklist

- Start from a non-admin PowerShell and confirm the one-line installer opens a UAC prompt, then relaunches in an administrator PowerShell before Corepack/pnpm activation.
- Confirm the installer checks WSL, runs `wsl --install -d Ubuntu` when no distribution is present, and gives a rerun message if reboot or Ubuntu first-run user setup is required.
- Confirm the installer runs `nvm install 22` inside WSL, then `npm install -g @openai/codex@latest`, then `codex --version` succeeds without requiring a credential prompt.
- Confirm `solo_superman.cmd` sets `SOLO_CODEX_WINDOWS_MODE=wsl` and the sidecar uses `wsl.exe` for Codex account checks.
- If native fallback is explicitly enabled and Codex exits with `codex.cmd --version failed with exit -1073741515`, confirm the installer installs Microsoft Visual C++ Redistributable (x64), then retries `codex --version`.
- Confirm a Codex Desktop App download window opens to `https://openai.com/codex/` and the popup explains it is optional for vibe coding / parallel agent work.
- PowerShell execution policy allows the one-line command.
- Node and Git are visible in a new terminal after installation.
- Double-click `solo_superman.cmd` or the Desktop shortcut and confirm a failed launch remains visible until Enter is pressed.
- Path quoting works for folders with spaces.
- Long path support is not blocking dependency install.
- Antivirus/network prompt is not silently blocking local server startup.

## Troubleshooting cases

| Case | Symptom | Safe response |
| --- | --- | --- |
| Port conflict | Browser or sidecar port is already in use. | Choose a free alternate port; do not kill unknown processes. |
| Token mismatch | API returns `401`. | Re-run `pnpm start:local` so frontend and sidecar share one token. |
| CORS/origin | Browser request is blocked. | Confirm loopback URL and local sidecar base URL. |
| Administrator permission denied | Corepack reports `operation not permitted` for `C:\Program Files\nodejs\pnpx` or Windows denies `C:\Users\Public\Desktop\solo_superman.cmd`. | Rerun the README one-line installer and approve the UAC administrator prompt. If company policy blocks UAC, stop and use an approved managed install path. |
| Codex WSL setup incomplete | The installer reports that WSL/Ubuntu needs a reboot or first-run Linux user/password setup. | Reboot if Windows requested it, open Ubuntu once to finish Linux user setup, then rerun the README one-line installer. The installer will resume Codex CLI installation inside WSL. |
| WSL nvm home detection | WSL Codex install shows `/nvm.sh: No such file or directory` or `nvm.sh not found`. | Do not switch to Windows backslashes. The nvm path inside WSL should be the Linux slash path `/home/<user>/.nvm/nvm.sh`. The updated installer explicitly resolves WSL `HOME`, pins `NVM_DIR` to `$HOME/.nvm`, and verifies that nvm.sh exists before sourcing it. |
| Codex CLI native runtime missing | Native fallback reports `codex.cmd --version failed with exit -1073741515` or `0xC0000135` right after `npm install -g @openai/codex@latest`. | Prefer the default WSL path. If native fallback is required, install Microsoft Visual C++ Redistributable (x64) with `winget install --id Microsoft.VCRedist.2015+.x64 -e`, then retry `codex --version`; the updated installer does this automatically in native mode. |
| Windows `spawn pnpm ENOENT` during smoke | `pnpm verify:prod-bundle` fails even though `pnpm --version` works in PowerShell, often after a previous install attempt. | The production smoke runner must spawn `pnpm.cmd` on Windows instead of bare `pnpm`; rerun the updated installer so it pulls the fixed script before smoke verification. |
| Execution policy | Windows blocks script execution. | Show the policy error and retry command; do not bypass company policy. |
| Path quoting | Spaces in path break a command. | Use quoted PowerShell paths or `Set-Location`. |
| Long path | Windows dependency install fails deep in `node_modules`. | Enable long paths or move checkout to a shorter path. |
| Antivirus/network prompt | Local server is blocked. | Ask user to allow local loopback if their policy permits. |

## Install/run docs contract

The docs verifier checks this troubleshooting guide for macOS/Windows command coverage, local token defaults, Codex login labels, manual browser smoke, cleanup evidence, and required troubleshooting cases.
