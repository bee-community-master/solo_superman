# 로컬 설치, 실행, 문제 해결

언어: 한국어 | [English](troubleshooting_EN.md)

## 배포 상태

Solo Superman은 현재 제한 베타 형태의 technical preview입니다. 목표는 비개발자도 안전한 one-line installer로 local web screen에 도달하게 하고, 위험한 action은 reviewable 상태로 유지하는 것입니다.

## 한 줄 설치

| macOS shell | Windows PowerShell |
| --- | --- |
| `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"` | `irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 \| iex` |

Installer는 Node.js 24+, Git, Corepack/pnpm, Codex CLI, dependency install, local run readiness, browser opening을 확인합니다. Windows에서는 Solo Superman setup 이후 바이브 코딩이나 여러 agent 병렬 작업을 원하는 사용자를 위해 Codex Desktop App 안내 창도 엽니다. 기존 폴더를 덮어쓰거나 관련 없는 프로세스를 종료해 포트를 차지하지 않아야 합니다.

## 수동 준비

### macOS shell

```sh
node --version
git --version
corepack enable
pnpm --version
```

### Windows PowerShell

README의 one-line Windows installer는 prerequisite 변경 전에 관리자 권한으로 재실행합니다. 관리자 권한이 아니면 Windows UAC 승인을 요청하고 같은 bootstrap command를 administrator PowerShell에서 다시 실행합니다. Corepack이 `C:\Program Files\nodejs` 아래 shim을 쓰거나 Solo Superman 바탕화면 실행파일 생성 단계가 `C:\Users\Public\Desktop`을 만질 수 있기 때문입니다. UAC 또는 회사 정책이 elevation을 막으면 policy를 우회하지 않고 retry command와 함께 중단합니다.

Node/npm과 pnpm이 준비되면 Windows installer는 `npm install -g @openai/codex@latest`로 OpenAI Codex CLI를 설치 또는 갱신하고 `codex --version`으로 검증합니다. 이 단계는 Codex login flow를 시작하거나 credential을 저장하지 않습니다. 사용자는 Codex를 쓰기로 선택했을 때 ChatGPT account 또는 API key로 sign in합니다. Optional desktop experience를 위해 installer는 `https://openai.com/codex/`를 열고, 바이브 코딩이나 여러 agent 병렬 작업을 원하면 Codex Desktop App for Windows를 받을 수 있다고 안내합니다.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
corepack enable
pnpm --version
npm install -g @openai/codex@latest
codex --version
```

## 로컬 실행

Windows에서 installer는 나중 실행을 위한 Solo Superman 바탕화면 실행파일 `solo_superman.cmd`와 `solo_superman.lnk`를 만들거나 새로 고칩니다. 대상에는 localized, public, OneDrive-redirected Desktop folders가 포함됩니다. 이 바탕화면 실행파일은 OpenAI의 Codex Desktop App과 다른 Solo Superman 재실행용 wrapper입니다. `call pnpm start:local`을 사용하므로 control이 cmd wrapper로 돌아오며, launch가 실패하면 cmd window는 failure output과 exit code를 보여주고 Enter를 누를 때까지 닫히지 않습니다. macOS installer는 바탕화면 실행파일을 만들지 않고 rerun command를 출력합니다.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location .\solo_superman; pnpm start:local
```

기본 local path에는 OpenAI API key, ChatGPT web credential, ChatGPT Pro session이 필요하지 않습니다. 즉 local first screen에 도달하는 데 이 세 credential이 모두 필요하지 않습니다. Backend question/research preview는 local Codex CLI의 `codex login status`만 확인하며 ChatGPT web sign-in 여부를 검사하지 않습니다. Codex login이 없으면 UI는 background terminal에서 `codex auth login`을 열도록 제안할 수 있습니다. UI label은 Open Codex login과 Refresh Codex login status입니다. 별도의 ChatGPT browser-session delegation은 자체 user-approved flow가 필요하며 default local run의 일부가 아닙니다. Solo Superman은 credential을 수집하거나 저장하지 않습니다.

## 검증 명령

기여자는 아래 명령을 실행할 수 있습니다.

```sh
pnpm verify:prod-bundle
pnpm verify
```

Production bundle smoke는 `build_auto_local_smoke`, browser readiness, managed child processes stopped, temporary app data removed, auto shutdown/kill evidence를 포함해야 합니다.

## 로컬 토큰과 sidecar URL

Local service는 per-run local capability token을 사용합니다. 일반 `pnpm start:local` 또는 installer run에서 launcher는 fresh token 하나를 만들어 browser build와 sidecar 모두에 전달합니다. Browser build는 `VITE_SOLO_LOCAL_CAPABILITY_TOKEN`과 `VITE_SOLO_SIDECAR_BASE_URL`을 받습니다. Sidecar는 `SOLO_LOCAL_CAPABILITY_TOKEN`을 사용합니다. token mismatch fails visibly with `401`.

Example shell values입니다. 아래의 고정 `local-dev-token`은 manual troubleshooting placeholder일 뿐이며 launcher-generated per-run token으로 설명하면 안 됩니다.

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
- Auto-open이 실패하면 출력된 URL을 browser에 직접 붙여넣습니다.

## Manual Windows PowerShell checklist / Windows 수동 체크리스트

- non-admin PowerShell에서 시작해 one-line installer가 UAC prompt를 여는지 확인하고, Corepack/pnpm activation 전에 administrator PowerShell로 재실행하는지 확인합니다.
- Installer가 `npm install -g @openai/codex@latest`를 실행한 뒤 `codex --version`이 credential prompt 없이 성공하는지 확인합니다.
- Codex Desktop App download window가 `https://openai.com/codex/`로 열리고 popup이 바이브 코딩 / parallel agent work용 optional 안내임을 설명하는지 확인합니다.
- PowerShell execution policy가 one-line command를 허용하는지 확인합니다.
- 설치 후 새 terminal에서 Node와 Git이 보이는지 확인합니다.
- Double-click `solo_superman.cmd` 또는 Desktop shortcut 후 failed launch가 Enter를 누를 때까지 visible한지 확인합니다.
- Path quoting works for folders with spaces.
- Long path support is not blocking dependency install.
- Antivirus/network prompt is not silently blocking local server startup.

## 문제 해결 사례

| Case | Symptom | Safe response |
| --- | --- | --- |
| Port conflict | Browser 또는 sidecar port가 이미 사용 중입니다. | free alternate port를 선택합니다. unknown process를 kill하지 않습니다. |
| Token mismatch | API returns `401`. | frontend와 sidecar가 같은 token을 받도록 `pnpm start:local`을 다시 실행합니다. |
| CORS/origin | Browser request is blocked. | loopback URL과 local sidecar base URL을 확인합니다. |
| Administrator permission denied | Corepack reports `operation not permitted` for `C:\Program Files\nodejs\pnpx` or Windows denies `C:\Users\Public\Desktop\solo_superman.cmd`. | README one-line installer를 다시 실행하고 UAC administrator prompt를 승인합니다. 회사 정책이 UAC를 막으면 중단하고 승인된 managed install path를 사용합니다. |
| Windows `spawn pnpm ENOENT` during smoke | `pnpm verify:prod-bundle` fails even though `pnpm --version` works in PowerShell, often after a previous install attempt. | Production smoke runner는 Windows에서 bare `pnpm` 대신 `pnpm.cmd`를 spawn해야 합니다. fixed script를 받도록 updated installer를 다시 실행합니다. |
| Execution policy | Windows blocks script execution. | Policy error와 retry command를 보여주며 회사 정책을 우회하지 않습니다. |
| Path quoting | Spaces in path break a command. | quoted PowerShell paths 또는 `Set-Location`을 사용합니다. |
| Long path | Windows dependency install fails deep in `node_modules`. | long paths를 enable하거나 checkout을 shorter path로 옮깁니다. |
| Antivirus/network prompt | Local server is blocked. | 정책이 허용한다면 local loopback을 allow하도록 안내합니다. |

## Install/run docs contract / 문서 계약

Docs verifier는 이 troubleshooting guide에서 macOS/Windows command coverage, local token defaults, Codex login labels, manual browser smoke, cleanup evidence, required troubleshooting cases를 확인합니다.
