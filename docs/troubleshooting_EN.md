# Local Install, Run, and Troubleshooting

Language: [한국어](troubleshooting_KO.md) | English

## Release posture

Solo Superman is currently a limited-beta-style technical preview. The goal is to let a non-developer reach the local web screen through a safe one-line installer, while keeping risky actions reviewable.

## One-line install

| macOS shell | Windows PowerShell |
| --- | --- |
| `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"` | `irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 \| iex` |

The Windows one-line command runs only the short `scripts/win.ps1` launcher. The launcher sets UTF-8 console output, TLS 1.2, UTF-8 script download decoding, and BOM stripping before running the full bootstrap, including on Windows PowerShell 5.1. The installer checks Node.js 24+, Git, Corepack/pnpm, Codex CLI, dependency install, local run readiness, and browser opening. On Windows it keeps app execution on Windows Node/pnpm, but installs and runs Codex CLI inside WSL by default with `SOLO_CODEX_WINDOWS_MODE=wsl` because that path is more stable for Codex/Codex CLI on affected Windows machines. When an existing Codex CLI passes `codex --version`, the installer reuses it even if npm global install reports `EEXIST` or `already exists`. It also opens a Codex Desktop App guidance window for users who want vibe coding or multiple parallel agents after Solo Superman setup. It should not overwrite an existing folder or kill an unrelated process to claim a port.

## Manual prerequisites

### macOS shell

```sh
node --version
git --version
corepack enable
pnpm --version
```

### Windows PowerShell

The README one-line Windows installer self-elevates before prerequisite changes: if it is not already running as administrator, it asks for Windows UAC approval and relaunches the same bootstrap command in an administrator PowerShell. This is required because Corepack may need to write shims under `C:\Program Files\nodejs` or Windows prerequisite/WSL setup may need elevated permissions. If UAC or company policy blocks elevation, the installer stops with the retry command instead of bypassing policy.

Before dependency install and smoke verification, the Windows installer also checks the Microsoft Visual C++ Redistributable (x64) runtime DLLs `vcruntime140.dll`, `vcruntime140_1.dll`, and `msvcp140.dll`. The sidecar loads the `@libsql/win32-x64-msvc` native module during startup; when those DLLs are missing, `pnpm start:local` or `pnpm verify:prod-bundle` can fail with `ERR_DLOPEN_FAILED` and `index.node` even though port fallback already selected an alternate port. The installer repairs this with `winget install --id Microsoft.VCRedist.2015+.x64 -e` before running the app checks.

After Node/npm and pnpm are ready, the Windows installer uses WSL for Codex by default. It checks for `wsl.exe`, sets the Codex CLI WSL default version to WSL2 with `wsl --set-default-version 2`, and selects Ubuntu or an already installed distribution with `wsl --set-default <distribution>`. When no distribution is present, it installs Ubuntu with `wsl --install -d Ubuntu`; on that first WSL install path, Windows may need a reboot or Ubuntu may still need first-run Linux user/password setup, so the installer stops and tells the user to reboot, open Ubuntu once, finish the Linux username/password setup, and rerun the same one-line command. The WSL default-version/default-distribution setup and readiness probe run in no-output mode on success so Windows localization output does not appear as mojibake; the installer prints its own UTF-8 messages instead. For the WSL Codex install, it no longer passes the multi-line bash body directly as a `bash -lc` argument; it writes a temporary LF/UTF-8 `.sh` file on Windows, converts that path with `wslpath`, and runs it with `wsl -- bash <script>`. Inside that script, it explicitly resolves the Linux home directory, pins `NVM_DIR` to `$HOME/.nvm`, and installs nvm when needed. For Node, it runs `nvm use 22` first to reuse an already installed major, and only runs `nvm install 22` when needed. It then checks `command -v codex` plus `codex --version` first and skips `npm install -g @openai/codex@latest` when the existing Codex CLI is usable. If npm install fails with `EEXIST`/`already exists`, the installer checks `codex --version` again and continues when it succeeds. The install-folder runner sets `SOLO_CODEX_WINDOWS_MODE=wsl`, `SOLO_SUPERMAN_CODEX_WSL_DISTRO`, and `SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR`, and the sidecar launches Codex account checks with `wsl.exe -d <distribution> -- bash -lc ...` instead of native `codex.cmd`.

If a maintainer explicitly sets `SOLO_SUPERMAN_CODEX_WINDOWS_MODE=native`, the Windows installer can still use the native fallback. It checks the existing `codex --version` first and skips npm global install when Codex is already usable. If installation or update is still needed, it runs `npm install -g @openai/codex@latest`; when npm reports `EEXIST`/`already exists` for an existing `codex` shim, the installer checks `codex --version` again and continues if it succeeds. If `codex.cmd --version` fails with exit `-1073741515` (`0xC0000135`), the installer treats that as a missing native runtime signal, installs Microsoft Visual C++ Redistributable (x64) with `winget install --id Microsoft.VCRedist.2015+.x64 -e`, then retries `codex --version`. It does not start a Codex login flow or store credentials; users sign in later with their ChatGPT account or API key when they choose to use Codex. For the optional desktop experience, the installer opens `https://openai.com/codex/` and shows a small Windows prompt explaining that users can download Codex Desktop App for Windows if they want vibe coding or multiple parallel agents.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget upgrade --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
corepack enable
pnpm.cmd --version
wsl --set-default-version 2
wsl --install -d Ubuntu
# If Windows asks, reboot, open Ubuntu once, finish Linux user/password setup, then rerun the same one-line installer.
wsl --set-default Ubuntu
wsl -- bash -lc 'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash'
wsl -- bash -lc 'NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh"; nvm install 22; nvm use 22; npm install -g @openai/codex@latest; codex --version'
winget install --id Microsoft.VCRedist.2015+.x64 -e
codex --version
```

## Run locally

On Windows, the installer creates or refreshes exactly one visible Solo Superman Desktop shortcut named `solo_superman.lnk` for later launches. The real `solo_superman.cmd` runner lives in the install folder, and the installer cleans duplicate Desktop `solo_superman.cmd`/`solo_superman.lnk` files left by older installers from localized, public, or OneDrive-redirected Desktop folders. This shortcut points to the Solo Superman relaunch wrapper, not the OpenAI Codex Desktop App. The runner uses `call pnpm.cmd start:local` so control returns to the cmd wrapper; if launch fails, the cmd window keeps the failure output visible, prints the exit code, and waits for Enter before closing. The macOS installer does not create a Desktop runner and prints the rerun command instead.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location "$HOME\solo_superman"; pnpm.cmd start:local
```

The default local path does not require an OpenAI API key or ChatGPT web credential by default; in plain language, reaching the local first screen needs neither an OpenAI API key, a ChatGPT web credential, nor a ChatGPT Pro session. Backend question/research preview checks the local Codex CLI with `codex login status`; it does not check whether the user is signed in to ChatGPT on the web. On Windows, the sidecar runs that Codex CLI through WSL, so the effective command is `wsl.exe -d <distribution> -- bash -lc '... codex login status'` and login opens a WSL-backed `codex auth login` terminal. If Codex login is missing, the UI can offer to open `codex auth login` through a background terminal. The UI labels are Open Codex login and Refresh Codex login status. Separate ChatGPT browser-session delegation requires its own user-approved flow and is not part of the default local run. Solo Superman does not collect or store any credentials.

## Verification commands

Contributors can run:

```sh
pnpm verify:prod-bundle
pnpm verify
```

On Windows PowerShell, use `pnpm.cmd verify:prod-bundle` and `pnpm.cmd verify` so the Node/Corepack command shim runs even when local execution policy blocks `pnpm.ps1`.

A production bundle smoke must cover `build_auto_local_smoke`, browser readiness, managed child processes stopped, temporary app data removed, and auto shutdown/kill evidence.
Before it starts managed sidecar/web child processes, `pnpm verify:prod-bundle` probes the fixed smoke ports. If `127.0.0.1:43110` or the configured web preview port is already in use, stop the existing local process or rerun with `SOLO_PROD_SMOKE_SIDECAR_PORT=<free-port>` / `SOLO_PROD_SMOKE_WEB_PORT=<free-port>`.

Live Codex app-server preview turns are disabled by default. Maintainers can opt in with `SOLO_CODEX_APP_SERVER_LIVE_TURNS=1` after `codex login status` reports an authenticated local Codex CLI. To prove that the local environment is actually ready for live preview-only turns, run `SOLO_VERIFY_CODEX_LIVE_RUNTIME=1 SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 pnpm verify:codex-live-runtime` on macOS/Linux, or `$env:SOLO_VERIFY_CODEX_LIVE_RUNTIME="1"; $env:SOLO_CODEX_APP_SERVER_LIVE_TURNS="1"; pnpm.cmd verify:codex-live-runtime` in Windows PowerShell. The command starts only a temporary local sidecar with a per-run token and temporary app data, reads `/api/v1/runtime/status`, and passes only when the runtime reports `status=available`, `executionMode=live`, `liveTurnExecutionEnabled=true`, and an authenticated Codex account. Running `pnpm verify:codex-live-runtime` without the opt-in flag prints `skipped` evidence instead of pretending live readiness was verified. The app still does not ask for or store API keys, cookies, or ChatGPT web credentials.

`pnpm verify:clarification-pipeline` is the credential-free clarification pipeline smoke. It creates temporary app data and a local sidecar, creates a business-mode project, then runs intake, initial Living Product Spec drafting, ambiguity analysis, active question-batch creation, and first-question answer submission. It passes only when Decision Queue progress exposes generated/active/answered/follow-up debt, the research-needed answer creates a source-linked planned research task, and completeness plus Planning Handoff keep missing source traces as blocker evidence instead of Planning-ready.

`pnpm verify:clarification-volume` is the credential-free long-session volume smoke. It runs the core ProductEngine fixture without network or LLM credentials, proves business-mode clarification can answer 200+ questions while keeping the active batch bounded to five visible cards, creates durable research-task debt for accepted answers, exhausts the follow-up budget, and reaches 100% question-debt completion.

`pnpm verify:runtime-preview-turn` is the next local-only smoke: by default it uses fixture mode, creates a temporary app-data database, creates a project, queues `/api/v1/runtime/codex/preview`, runs the pending `codex_runtime_preview_effect`, and passes only after a `preview_ready` `ImplementationPlanPreviewArtifact` is visible in runtime activity. To run the same preview-turn path against a live Codex app-server turn, use `SOLO_VERIFY_CODEX_LIVE_PREVIEW_TURN=1 SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 pnpm verify:runtime-preview-turn` on macOS/Linux, or `$env:SOLO_VERIFY_CODEX_LIVE_PREVIEW_TURN="1"; $env:SOLO_CODEX_APP_SERVER_LIVE_TURNS="1"; pnpm.cmd verify:runtime-preview-turn` in Windows PowerShell. If live execution falls back to manual handoff, the smoke reports `blocked` rather than `passed`. This still verifies preview artifact creation only; it is not a full worker-job end-to-end run.

`pnpm verify:worker-job` is the worker bridge smoke. By default it uses fixture mode, creates temporary app data and a temporary generated-workspace root, creates a planning-ready handoff, creates an auto-implementation workspace run, attaches a ready file-diff `ExecutionAuthorityRecord`, plans and runs the current-stage worker job, imports completed `ImplementationStepLedger` evidence, and advances the run from `initial_pr` to the next review stage. To attempt the same path with live Codex worker turns, use `SOLO_VERIFY_CODEX_LIVE_WORKER_JOB=1 SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 pnpm verify:worker-job` on macOS/Linux, or `$env:SOLO_VERIFY_CODEX_LIVE_WORKER_JOB="1"; $env:SOLO_CODEX_APP_SERVER_LIVE_TURNS="1"; pnpm.cmd verify:worker-job` in Windows PowerShell. If live worker execution cannot produce importable ledger evidence, the smoke reports `blocked`. Production deploys, external service mutations, and final-submit actions remain outside this smoke.

`pnpm verify:pr-mutation` is the generated PR mutation smoke. It is always fixture/default and does not call `gh`; instead it creates temporary app data and a temporary generated-workspace root, creates a planning-ready handoff and auto-implementation run with connected fixture remote status, proves approved `open_pr` is blocked before `initial_pr` ledger evidence, applies fixture PR open after that evidence exists, applies fixture `update_pr_body` with current body evidence and generated body markdown, blocks `merge_pr` before `final_verify_pr_update`, blocks merge without current PR body evidence, applies fixture merge with merge readiness evidence, and blocks duplicate merge attempts after the first applied merge. Real GitHub PR writes remain behind explicit approved mutation contracts and are outside default verification.

`pnpm verify:auto-implementation-pipeline` is the credential-free aggregate smoke for the preview-turn, worker-job, and generated PR mutation smokes. It does not require live Codex flags; in fixture mode it sequentially verifies `codex_runtime_preview_effect` creation/execution, bounded worker-job ledger import plus stage advancement, and generated PR open/body-update/merge guards. If any child smoke reports `blocked`, the aggregate smoke reports `blocked` too. Real GitHub writes and production/external final-submit actions remain outside this scope.

`pnpm verify:auto-implementation-review-loop` is the credential-free review-loop smoke. It creates temporary app data and a local sidecar, creates a planning-ready auto-implementation run, then completes every canonical stage from `initial_pr` through `merge_main` through the existing stage endpoint. Each stage must carry `ImplementationStepLedger` evidence with two no-finding feature/repository code-review passes, two no-finding changed-code/repository clean-code passes, and passing test evidence. Real GitHub writes, deploys, browser actions, public-web polling, and secret access remain outside this scope.

`pnpm verify:browser-delegation-pipeline` is the credential-free browser delegation pipeline smoke. It creates temporary app data and a local sidecar, serves a loopback mock ChatGPT-ready page, creates an approved `browser_action` `ExecutionAuthorityRecord`, executes the browser action to collect screenshot/log/audit refs, creates and refetches a ChatGPT browser delegation run, then revokes that run. Real ChatGPT accounts, browser profiles, public-web polling, credential/session/token custody, and external network access remain outside this smoke.

`pnpm verify:service-page-pipeline` is the credential-free service page-use pipeline smoke. It creates temporary app data and a local sidecar, serves a loopback mock setup page, verifies service-scoped browser actions are blocked before a matching permission, grants read/preview permission, requires permission/action echo, deletes retained artifact refs to audit-metadata-only, revokes the permission, proves later browser actions are blocked, verifies a per-action fill-draft permission, and keeps final submit blocked without a production-mutation contract. Real service accounts, browser profiles, credential/session/token custody, production deploys, final-submit execution, and external network access remain outside this smoke.

`pnpm verify:research-pipeline` is the credential-free research pipeline smoke. It creates temporary app data and a local sidecar, creates a public-web allowlist, starts a read-only research run, then verifies source-traced result import plus either pending `research_evidence_effect` drain or already-created synthesis. It passes only when the Research projection exposes an evidence matrix/evidence pack/review card and the Decision Queue exposes research-generated follow-up question debt. `pnpm verify` runs the clarification pipeline, clarification volume, research, browser delegation, service page-use, auto-implementation review-loop, and auto-implementation aggregate smokes together so the default local verification covers the question/research/implementation critical paths and staged review protocol.

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
- Confirm the installer checks WSL, runs `wsl --set-default-version 2` plus default distribution selection, runs `wsl --install -d Ubuntu` when no distribution is present, and gives a same one-line command rerun message if reboot or Ubuntu first-run user setup is required.
- Confirm the installer first reuses an existing Node 22 inside WSL with `nvm use 22`, runs `nvm install 22` only when needed, reuses an existing Codex CLI with `command -v codex` and `codex --version` when available, or otherwise runs `npm install -g @openai/codex@latest`, then `codex --version` succeeds without requiring a credential prompt.
- When local web or production smoke runs inside WSL, confirm the server bind host is `0.0.0.0` while browser/fetch URLs stay on loopback `127.0.0.1`.
- Confirm the install-folder `solo_superman.cmd` sets `SOLO_CODEX_WINDOWS_MODE=wsl`, only one `solo_superman.lnk` is visible on the Desktop, and the sidecar uses `wsl.exe` for Codex account checks.
- Confirm the installer checks `vcruntime140.dll`, `vcruntime140_1.dll`, and `msvcp140.dll` before dependency install, and repairs Microsoft Visual C++ Redistributable (x64) before `@libsql/win32-x64-msvc` can fail at runtime.
- If native fallback is explicitly enabled and Codex exits with `codex.cmd --version failed with exit -1073741515`, confirm the installer installs Microsoft Visual C++ Redistributable (x64), then retries `codex --version`.
- Confirm a Codex Desktop App download window opens to `https://openai.com/codex/` and the popup explains it is optional for vibe coding / parallel agent work.
- PowerShell execution policy allows the one-line command.
- Node and Git are visible in a new terminal after installation.
- Double-click the Desktop shortcut and confirm a failed launch remains visible until Enter is pressed.
- Path quoting works for folders with spaces.
- Long path support is not blocking dependency install.
- Antivirus/network prompt is not silently blocking local server startup.

## Troubleshooting cases

| Case | Symptom | Safe response |
| --- | --- | --- |
| Port conflict | Browser or sidecar port is already in use. | Choose a free alternate port; do not kill unknown processes. For `pnpm verify:prod-bundle`, use `SOLO_PROD_SMOKE_SIDECAR_PORT=<free-port>` or `SOLO_PROD_SMOKE_WEB_PORT=<free-port>` after stopping or identifying the conflicting process. |
| Token mismatch | API returns `401`. | Re-run `pnpm start:local` so frontend and sidecar share one token. |
| CORS/origin | Browser request is blocked. | Confirm loopback URL and local sidecar base URL. |
| Garbled Korean or UTF-8 output | Korean output or downloaded script text looks corrupted after running the README one-line command in Windows PowerShell. | Use the short README `scripts/win.ps1` launcher command. The launcher sets `[Console]::OutputEncoding`, `$OutputEncoding`, `chcp.com 65001`, TLS 1.2, UTF-8 download decoding, and BOM stripping before running the bootstrap. |
| Corepack or npm `already exists` for pnpm | Corepack or npm reports `EEXIST`, `already exists`, or `file already exists` for an existing `pnpm`/`pnpm.cmd` shim. | The updated installer checks the existing `pnpm.cmd --version` first, and after Corepack/npm fallback failures it continues when a usable pnpm 11+ shim is already available. |
| Codex CLI `already exists` | During the WSL or native Codex install step, npm reports `EEXIST`, `already exists`, or `file already exists` for an existing `codex`/`codex.cmd` shim. | The updated installer checks the existing `codex --version` first, and after npm global install failures it continues when a usable Codex CLI is already available. |
| Node stays on v22.x | The README one-line install prints `node already installed: v22...` or `Node 24 or newer is required`. | The updated installer tries `winget upgrade --id OpenJS.NodeJS.LTS -e` first when it sees an older LTS such as Node 22. If `node --version` is still below 24, install Node 24+ with the Node.js Windows x64 LTS installer, then rerun from a new administrator PowerShell. |
| Administrator permission denied | Corepack reports `operation not permitted` for `C:\Program Files\nodejs\pnpx` or Windows prerequisite/WSL setup is denied. | Rerun the README one-line installer and approve the UAC administrator prompt. If company policy blocks UAC, stop and use an approved managed install path. |
| Codex WSL setup incomplete | The installer reports that WSL/Ubuntu needs a reboot or first-run Linux user/password setup. | Reboot if Windows requested it, open Ubuntu once to finish Linux user setup, then rerun the same README one-line installer. The installer will resume WSL2/default distribution setup and Codex CLI installation inside WSL. |
| WSL install script quoting | The installer shows a truncated multi-line bash error such as `line 8: syntax error: unexpected end of file from 'if' command on line 6`. | The updated installer no longer sends the multi-line WSL install script as a direct `bash -lc` argument. It writes a LF/UTF-8 temporary `.sh` file, converts the path with `wslpath`, and runs it with `wsl -- bash <script>`. |
| WSL wslpath Windows path escaping | The installer shows a stripped Windows temp path such as `wslpath: C:Users...AppDataLocalTemp...codex-wsl-install-1234-20260521-143000.sh`. | The updated installer passes a forward-slash Windows path like `C:/...` to `wslpath` instead of a raw `C:\...` path. If `wslpath` still fails, it falls back to the default `/mnt/c/...` mount path. |
| WSL nvm home detection | WSL Codex install shows `/nvm.sh: No such file or directory` or `nvm.sh not found`. | Do not switch to Windows backslashes. The nvm path inside WSL should be the Linux slash path `/home/<user>/.nvm/nvm.sh`. The updated installer explicitly resolves WSL `HOME`, pins `NVM_DIR` to `$HOME/.nvm`, and verifies that nvm.sh exists before sourcing it. |
| WSL setup garbled output | After `Codex CLI용 WSL2/default 배포판 설정`, Windows localization output looks corrupted until around `solo-superman-wsl-ready`. | The updated installer runs WSL default setup and readiness probes in no-output mode and no longer prints probe text such as `solo-superman-wsl-ready` on success. |
| WSL nvm Node already installed | After `OpenAI Codex CLI 설치/업데이트 (WSL)`, the installer shows a message like `v22.22.3 is already installed` and fails. | The updated installer runs `nvm use 22` before `nvm install 22` so it reuses an existing Node 22. If install still fails but the existing Node 22 can be selected, Codex installation continues. |
| Windows sidecar native runtime missing | `pnpm start:local` or `pnpm verify:prod-bundle` starts on an alternate port, then the sidecar exits with `ERR_DLOPEN_FAILED`, `The specified module could not be found`, and `@libsql/win32-x64-msvc/index.node`. | Install or repair Microsoft Visual C++ Redistributable (x64) with `winget install --id Microsoft.VCRedist.2015+.x64 -e`. The updated installer checks the required runtime DLLs before dependency install and does this automatically. |
| Codex CLI native runtime missing | Native fallback reports `codex.cmd --version failed with exit -1073741515` or `0xC0000135` right after `npm install -g @openai/codex@latest`. | Prefer the default WSL path. If native fallback is required, install Microsoft Visual C++ Redistributable (x64) with `winget install --id Microsoft.VCRedist.2015+.x64 -e`, then retry `codex --version`; the updated installer does this automatically in native mode. |
| Windows/WSL `spawn pnpm ENOENT` during smoke | A child process inside `pnpm verify:prod-bundle` or `pnpm start:local` fails with `spawn pnpm ENOENT`. The Windows installer may misclassify the same failure as a port conflict and retry with alternate ports. | The updated runner reuses the active pnpm entrypoint from `npm_execpath` or the installer-provided `SOLO_PNPM_COMMAND`, and runs Windows `.cmd` shims through a shell. The installer retries alternate ports only for real `EADDRINUSE`/`strictPort` port conflicts. |
| WSL localhost port binding | A server appears to start inside WSL, but the Windows browser cannot reach the `localhost`/`127.0.0.1` port or readiness fetch keeps failing. | The updated local runner binds servers to `0.0.0.0` when WSL is detected, while keeping browser/fetch URLs and the Vite sidecar base URL on loopback `127.0.0.1`. Native macOS/Windows still reject `0.0.0.0` bind overrides. |
| Execution policy | Windows blocks script execution. | Show the policy error and retry command; do not bypass company policy. |
| Path quoting | Spaces in path break a command. | Use quoted PowerShell paths or `Set-Location`. |
| Long path | Windows dependency install fails deep in `node_modules`. | Enable long paths or move checkout to a shorter path. |
| Antivirus/network prompt | Local server is blocked. | Ask user to allow local loopback if their policy permits. |

## Install/run docs contract

The docs verifier checks this troubleshooting guide for macOS/Windows command coverage, local token defaults, Codex login labels, manual browser smoke, cleanup evidence, and required troubleshooting cases.
