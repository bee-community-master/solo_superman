# Local Install, Run, and Troubleshooting / 로컬 설치와 문제 해결

## Release posture / 배포 상태

Solo Superman is currently a technical preview. The goal is to let a non-developer reach the local web screen through a safe one-line installer, while keeping risky actions reviewable.

## One-line install / 한 줄 설치

| macOS shell | Windows PowerShell |
| --- | --- |
| `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"` | `irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 \| iex` |

The installer checks Node.js 24+, Git, Corepack/pnpm, dependency install, local run readiness, and browser opening. It should not overwrite an existing folder or kill an unrelated process to claim a port.

## Manual prerequisites / 수동 준비

### macOS shell

```sh
node --version
git --version
corepack enable
pnpm --version
```

### Windows PowerShell

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
corepack enable
pnpm --version
```

## Run locally / 로컬 실행

On Windows, the installer also creates a Desktop runner named `solo_superman.cmd` for later launches, including localized or OneDrive-redirected Desktop folders. The macOS installer does not create a Desktop runner and prints the rerun command instead.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location .\solo_superman; pnpm start:local
```

The default local path does not require an OpenAI or ChatGPT API key by default. Before backend question/research preview work, the UI can check `codex login status` and open `codex auth login` through a background terminal. The UI labels are Open Codex login and Refresh Codex login status. Solo Superman does not collect or store those credentials.

## Verification commands / 검증 명령

Contributors can run:

```sh
pnpm verify:prod-bundle
pnpm verify
```

A production bundle smoke must cover `build_auto_local_smoke`, browser readiness, managed child processes stopped, temporary app data removed, and auto shutdown/kill evidence.

## Local token and sidecar URL / 로컬 토큰과 sidecar URL

The local service uses a per-run local capability token. The browser build receives `VITE_SOLO_LOCAL_CAPABILITY_TOKEN` and `VITE_SOLO_SIDECAR_BASE_URL`. The sidecar uses `SOLO_LOCAL_CAPABILITY_TOKEN`. A token mismatch fails visibly with `401`.

Example shell values:

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

## Manual browser smoke / 수동 브라우저 확인

- `http://127.0.0.1:<web-port>/` should show the Solo Superman first screen.
- `http://127.0.0.1:<sidecar-port>/readyz` should return readiness JSON.
- If auto-open fails, copy the printed URL into the browser manually.

## Manual Windows PowerShell checklist / Windows 수동 체크리스트

- PowerShell execution policy allows the one-line command.
- Node and Git are visible in a new terminal after installation.
- Path quoting works for folders with spaces.
- Long path support is not blocking dependency install.
- Antivirus/network prompt is not silently blocking local server startup.

## Troubleshooting cases / 문제 해결

| Case | Symptom | Safe response |
| --- | --- | --- |
| Port conflict | Browser or sidecar port is already in use. | Choose a free alternate port; do not kill unknown processes. |
| Token mismatch | API returns `401`. | Re-run `pnpm start:local` so frontend and sidecar share one token. |
| CORS/origin | Browser request is blocked. | Confirm loopback URL and local sidecar base URL. |
| Execution policy | Windows blocks script execution. | Show the policy error and retry command; do not bypass company policy. |
| Path quoting | Spaces in path break a command. | Use quoted PowerShell paths or `Set-Location`. |
| Long path | Windows dependency install fails deep in `node_modules`. | Enable long paths or move checkout to a shorter path. |
| Antivirus/network prompt | Local server is blocked. | Ask user to allow local loopback if their policy permits. |

## Install/run docs contract / 문서 계약

The docs verifier checks this troubleshooting guide for macOS/Windows command coverage, local token defaults, Codex login labels, manual browser smoke, cleanup evidence, and required troubleshooting cases.
