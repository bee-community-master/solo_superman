# Local install/run verification

This runbook is the #105 contract for non-developer local web usage under `37-post-phase3-full-vision-backlog-contract.md`. It keeps macOS shell and Windows PowerShell paths side by side and does not require an OpenAI or ChatGPT API key by default. Backend question/research preview work still requires a user-owned ChatGPT browser session plus a local Codex CLI login check; Solo Superman reads account status only and does not collect or store credentials.

## Release posture

The current non-developer path is a technical preview. It is suitable for limited beta users who can run a one-line terminal installer, keep a local server terminal open, and report setup failures. It is not yet a packaged consumer app.

Before broad non-developer distribution, the project still needs:

- real Windows device validation of the PowerShell bootstrap path;
- a signed macOS package or disk image;
- a Windows installer or launcher;
- an update path that does not require users to know Git;
- a user-visible failure report and recovery flow.

## What this verifies

- production web bundle can be built and served locally;
- local Node/Hono sidecar starts on loopback only;
- the same local capability token is embedded into the production web build and accepted by the sidecar;
- a token mismatch fails visibly with `401`;
- `pnpm verify` remains the canonical repository verification command.

## Prerequisite checks

| Purpose | macOS shell | Windows PowerShell |
| --- | --- | --- |
| Node.js | `node --version` | `node --version` |
| pnpm/Corepack | `corepack --version && pnpm --version` | `corepack --version; pnpm --version` |
| Git | `git --version` | `git --version` |
| Codex CLI login for backend question/research preview | `codex login status || codex auth login` | `codex login status; if ($LASTEXITCODE -ne 0) { codex auth login }` |

## Install prerequisites

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br># Option A: use an existing Node.js 24+ and Git install.<br>node --version<br>git --version<br><br># Option B: if Homebrew is already installed.<br>brew install node git<br><br>corepack enable<br>corepack prepare pnpm@11.0.4 --activate<br>pnpm --version<br>``` | ```powershell<br># Primary Windows path: winget.<br>winget install --id OpenJS.NodeJS.LTS -e<br>winget install --id Git.Git -e<br><br>corepack enable<br>corepack prepare pnpm@11.0.4 --activate<br>pnpm --version<br><br># Fallback when winget is unavailable or blocked by policy:<br># 1. Install Node.js 24 or newer from https://nodejs.org/<br># 2. Install Git for Windows from https://git-scm.com/download/win<br># 3. Open a new PowerShell window and rerun the version checks above.<br>``` |

## Clone and install dependencies

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br>git clone https://github.com/bee-community-master/solo_superman.git<br>cd solo_superman<br>pnpm install --frozen-lockfile<br>``` | ```powershell<br>git clone https://github.com/bee-community-master/solo_superman.git<br>Set-Location .\solo_superman<br>pnpm install --frozen-lockfile<br>``` |

## Production bundle auto smoke

Run this first. It builds the production web bundle, starts the local sidecar and production web preview, checks sidecar health, checks an authenticated local API, checks wrong-token failure, then shuts both processes down.

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br>pnpm verify:prod-bundle<br>``` | ```powershell<br>pnpm verify:prod-bundle<br>``` |

Optional port overrides use platform-native environment syntax:

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br>SOLO_PROD_SMOKE_SIDECAR_PORT=43112 \<br>SOLO_PROD_SMOKE_WEB_PORT=4175 \<br>pnpm verify:prod-bundle<br>``` | ```powershell<br>$env:SOLO_PROD_SMOKE_SIDECAR_PORT = "43112"<br>$env:SOLO_PROD_SMOKE_WEB_PORT = "4175"<br>pnpm verify:prod-bundle<br>``` |

## Beginner local web run

The README one-line installers finish by launching this command. It keeps the local sidecar and web server running, opens the default browser automatically, and chooses alternate loopback ports without killing existing processes when the defaults are busy. Stop it with `Ctrl+C`. At the end of install, both installers print the install path, rerun command, and Desktop runner status before starting local web. The Windows bootstrap writes a Desktop runner named `solo_superman.cmd` to the visible user Desktop, including localized or OneDrive-redirected Desktop folders, then runs `pnpm start:local` for later launches. The macOS bootstrap does not create a Desktop runner and prints the rerun command instead.

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br>pnpm start:local<br>``` | ```powershell<br>pnpm start:local<br>``` |

The first-run screen checks two user-owned login prerequisites before creating backend questions or research preview artifacts:

- open ChatGPT in the same browser profile and sign in directly;
- keep the local Codex CLI logged in (`codex login status` should succeed). If missing, click `Open Codex login` in the local UI to start `codex auth login` in a background Terminal and finish the browser login flow.

The local sidecar uses `codex app-server` `account/read` to verify account presence. It returns only account status/type/email/plan metadata for UI readiness and never stores passwords, 2FA codes, session cookies, API keys, access tokens, or refresh tokens.

## Manual production bundle run

Use two terminals. Terminal 1 starts the sidecar. Terminal 2 serves the already-built production web bundle.

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br># Terminal 1<br>export SOLO_LOCAL_CAPABILITY_TOKEN="$(openssl rand -hex 32)"<br>export SOLO_SIDECAR_HOST="127.0.0.1"<br>export SOLO_SIDECAR_PORT="43110"<br>export VITE_SOLO_LOCAL_CAPABILITY_TOKEN="$SOLO_LOCAL_CAPABILITY_TOKEN"<br>export VITE_SOLO_SIDECAR_BASE_URL="http://127.0.0.1:43110"<br><br>pnpm build<br>pnpm --filter @solo-superman/sidecar start<br>``` | ```powershell<br># Terminal 1<br>$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)<br>$env:SOLO_LOCAL_CAPABILITY_TOKEN = [Convert]::ToHexString($bytes).ToLowerInvariant()<br>$env:SOLO_SIDECAR_HOST = "127.0.0.1"<br>$env:SOLO_SIDECAR_PORT = "43110"<br>$env:VITE_SOLO_LOCAL_CAPABILITY_TOKEN = $env:SOLO_LOCAL_CAPABILITY_TOKEN<br>$env:VITE_SOLO_SIDECAR_BASE_URL = "http://127.0.0.1:43110"<br><br>pnpm build<br>pnpm --filter "@solo-superman/sidecar" start<br>``` |
| ```sh<br># Terminal 2<br>pnpm --filter @solo-superman/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort<br>open http://127.0.0.1:4173<br>``` | ```powershell<br># Terminal 2<br>pnpm --filter "@solo-superman/web" exec vite preview --host 127.0.0.1 --port 4173 --strictPort<br>Start-Process "http://127.0.0.1:4173"<br>``` |

## Developer run path

This path is for contributors. It uses Vite dev server and sidecar watch mode; it is not the production bundle verification path.

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br>pnpm dev<br>``` | ```powershell<br>pnpm dev<br>``` |

## Canonical verification

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br>pnpm verify<br>``` | ```powershell<br>pnpm verify<br>``` |

`pnpm verify` runs typecheck, lint, test, and doc-contract checks. It does not require external production credentials or OpenAI/ChatGPT API keys. Live first-run backend readiness still checks the user's browser ChatGPT login acknowledgement and local Codex CLI account status.

## Browser automation prerequisite

No browser automation package is required for the default local install path. For #105, browser verification falls back to manually opening the local production preview URL after `pnpm verify:prod-bundle` succeeds.

| macOS shell | Windows PowerShell |
| --- | --- |
| ```sh<br># Optional only if a future issue adds Playwright/browser automation.<br>pnpm exec playwright --version || echo "Playwright is not installed; use manual browser smoke."<br>``` | ```powershell<br># Optional only if a future issue adds Playwright/browser automation.<br>pnpm exec playwright --version; if ($LASTEXITCODE -ne 0) { Write-Host "Playwright is not installed; use manual browser smoke." }<br>``` |

## Manual Windows PowerShell checklist

Use this checklist when CI or the current machine cannot run real Windows PowerShell:

- [ ] Run the prerequisite checks in a new PowerShell window and confirm Node 24+, pnpm/Corepack, and Git are available.
- [ ] Clone the repo, run `pnpm install --frozen-lockfile`, then run `pnpm verify:prod-bundle`.
- [ ] Confirm the smoke output ends with `status:"passed"`, `build_auto_local_smoke`, `token mismatch returned 401`, `managed child processes stopped`, and `temporary app data removed`.
- [ ] Run `pnpm verify` in the same checkout and record any Windows-only failure as a follow-up blocker issue.

## Troubleshooting

| Symptom | macOS shell | Windows PowerShell |
| --- | --- | --- |
| Port conflict on `43110` or `4173` | `lsof -nP -iTCP:43110 -sTCP:LISTEN` then choose `SOLO_PROD_SMOKE_SIDECAR_PORT=43112` | `Get-NetTCPConnection -LocalPort 43110 -ErrorAction SilentlyContinue` then choose `$env:SOLO_PROD_SMOKE_SIDECAR_PORT = "43112"` |
| Token mismatch | Rebuild after setting both `SOLO_LOCAL_CAPABILITY_TOKEN` and `VITE_SOLO_LOCAL_CAPABILITY_TOKEN` to the same value. | Rebuild after setting both `$env:SOLO_LOCAL_CAPABILITY_TOKEN` and `$env:VITE_SOLO_LOCAL_CAPABILITY_TOKEN` to the same value. |
| CORS/origin blocked | Use `http://127.0.0.1:<port>`; do not use hosted/cloud preview URLs. | Use `http://127.0.0.1:<port>`; do not use hosted/cloud preview URLs. |
| Codex login missing | Click `Open Codex login` in the local UI, or run `codex auth login` directly, finish the browser/device login flow, then click `Refresh Codex login status`. | Click `Open Codex login` in the local UI, or run `codex auth login` directly, finish the browser/device login flow, then click `Refresh Codex login status`. |
| Execution policy blocks scripts | Not applicable for shell; reinstall Node/pnpm if `pnpm` is missing. | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` only if your organization permits it, then open a new PowerShell window. |
| Path quoting | Quote paths with spaces: `cd "$HOME/Projects/solo superman"`. | Quote paths with spaces: `Set-Location "C:\Users\you\Projects\solo superman"`. |
| Long path checkout errors | Use a shorter path such as `$HOME/src/solo_superman`. | Enable Git long paths if permitted: `git config --global core.longpaths true`, or clone to `C:\src\solo_superman`. |
| Antivirus/network prompt | Allow loopback `127.0.0.1` for Node.js only for this local app run. | Allow loopback `127.0.0.1` for Node.js only for this local app run. |
