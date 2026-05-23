# 로컬 설치, 실행, 문제 해결

언어: 한국어 | [English](troubleshooting_EN.md)

## 배포 상태

Solo Superman은 현재 제한 베타 형태의 technical preview입니다. 목표는 비개발자도 안전한 one-line installer로 local web screen에 도달하게 하고, 위험한 action은 reviewable 상태로 유지하는 것입니다.

## 한 줄 설치

| macOS shell | Windows PowerShell |
| --- | --- |
| `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"` | `irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 \| iex` |

Windows 한 줄 명령은 짧은 `scripts/win.ps1` launcher만 실행합니다. Launcher는 Windows PowerShell 5.1에서도 UTF-8 console output, TLS 1.2, UTF-8 script download decoding, BOM 제거를 먼저 설정한 뒤 full bootstrap을 실행합니다. Installer는 Node.js 24+, Git, Corepack/pnpm, Codex CLI, dependency install, local run readiness, browser opening을 확인합니다. Windows에서는 app 실행용 Node/pnpm은 Windows에 두되 Codex CLI는 기본적으로 WSL 안에 설치하고 `SOLO_CODEX_WINDOWS_MODE=wsl`로 실행합니다. 영향을 받는 Windows 기기에서는 이 경로가 Codex/Codex CLI에 더 안정적이기 때문입니다. 이미 설치된 Codex CLI가 `codex --version`으로 검증되면 npm global install이 `EEXIST` 또는 `already exists`를 출력해도 해당 명령을 재사용합니다. Solo Superman setup 이후 바이브 코딩이나 여러 agent 병렬 작업을 원하는 사용자를 위해 Codex Desktop App 안내 창도 엽니다. 기존 폴더를 덮어쓰거나 관련 없는 프로세스를 종료해 포트를 차지하지 않아야 합니다.

## 수동 준비

### macOS shell

```sh
node --version
git --version
corepack enable
pnpm --version
```

### Windows PowerShell

README의 one-line Windows installer는 prerequisite 변경 전에 관리자 권한으로 재실행합니다. 관리자 권한이 아니면 Windows UAC 승인을 요청하고 같은 bootstrap command를 administrator PowerShell에서 다시 실행합니다. Corepack이 `C:\Program Files\nodejs` 아래 shim을 쓰거나 Windows prerequisite/WSL 설정을 바꿀 수 있기 때문입니다. UAC 또는 회사 정책이 elevation을 막으면 policy를 우회하지 않고 retry command와 함께 중단합니다.

Dependency install과 smoke 검증 전에 Windows installer는 Microsoft Visual C++ Redistributable (x64) runtime DLL인 `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll`도 확인합니다. Sidecar는 시작 중 `@libsql/win32-x64-msvc` native module을 로드하므로, 이 DLL이 없으면 port fallback이 이미 alternate port를 선택한 뒤에도 `pnpm start:local` 또는 `pnpm verify:prod-bundle`이 `ERR_DLOPEN_FAILED`와 `index.node` 오류로 실패할 수 있습니다. Installer는 app check를 실행하기 전에 `winget install --id Microsoft.VCRedist.2015+.x64 -e`로 이를 복구합니다.

Node/npm과 pnpm이 준비되면 Windows installer는 Codex에 WSL을 기본 사용합니다. `wsl.exe`와 배포판을 확인하고, Codex CLI용 WSL 기본 버전을 `wsl --set-default-version 2`로 WSL2에 맞춘 뒤 Ubuntu 또는 이미 설치된 배포판을 `wsl --set-default <배포판>`으로 기본 배포판에 둡니다. 배포판이 없으면 `wsl --install -d Ubuntu`를 시도하고, 첫 WSL 설치 케이스에서는 Windows 재부팅이나 Ubuntu 첫 실행 Linux 사용자 이름/비밀번호 설정이 필요할 수 있으므로 그 단계에서 멈춥니다. 사용자는 재부팅 후 Ubuntu 첫 실행 Linux 사용자 이름/비밀번호 설정을 끝내고 같은 한 줄 명령을 다시 실행합니다. WSL 기본 버전/배포판 설정과 readiness probe는 Windows localization output이 깨져 보이지 않도록 성공 시 출력을 숨기고 installer의 UTF-8 메시지만 보여줍니다. WSL Codex 설치는 multi-line bash를 `bash -lc` 인수로 직접 넘기지 않고 Windows 임시 `.sh` 파일을 LF/UTF-8로 작성한 뒤 `wslpath`로 변환해 `wsl -- bash <script>`로 실행합니다. 그 스크립트 안에서는 Linux home을 명시적으로 계산해 `NVM_DIR`을 `$HOME/.nvm`으로 고정하고, 필요할 때 nvm을 설치합니다. Node는 먼저 `nvm use 22`로 이미 설치된 major를 선택하고, 없을 때만 `nvm install 22`를 실행합니다. 이어서 먼저 `command -v codex`와 `codex --version`으로 이미 설치된 Codex CLI를 확인하고, 사용 가능하면 `npm install -g @openai/codex@latest`를 건너뜁니다. npm install이 `EEXIST`/`already exists`로 실패해도 다시 `codex --version`이 성공하면 설치를 계속합니다. 설치 폴더의 실행 wrapper는 `SOLO_CODEX_WINDOWS_MODE=wsl`, `SOLO_SUPERMAN_CODEX_WSL_DISTRO`, `SOLO_SUPERMAN_CODEX_WSL_NODE_MAJOR`를 설정하며 sidecar는 native `codex.cmd` 대신 `wsl.exe -d <배포판> -- bash -lc ...`로 Codex account check를 실행합니다.

Maintainer가 `SOLO_SUPERMAN_CODEX_WINDOWS_MODE=native`를 명시한 경우에는 Windows installer가 native fallback을 사용할 수 있습니다. 이때도 먼저 기존 `codex --version`을 확인하고, 이미 동작하면 npm global install을 건너뜁니다. 설치 또는 갱신이 필요하면 `npm install -g @openai/codex@latest`를 실행하되, npm이 이미 있는 `codex` shim 때문에 `EEXIST`/`already exists`를 출력하면 기존 `codex --version`을 한 번 더 확인하고 성공 시 계속 진행합니다. `codex.cmd --version failed with exit -1073741515` 또는 `0xC0000135`가 발생하면 native runtime 누락으로 보고 `winget install --id Microsoft.VCRedist.2015+.x64 -e`로 Microsoft Visual C++ Redistributable (x64)을 설치한 뒤 `codex --version`을 다시 실행합니다. 이 단계는 Codex login flow를 시작하거나 credential을 저장하지 않습니다. 사용자는 Codex를 쓰기로 선택했을 때 ChatGPT account 또는 API key로 sign in합니다. Optional desktop experience를 위해 installer는 `https://openai.com/codex/`를 열고, 바이브 코딩이나 여러 agent 병렬 작업을 원하면 Codex Desktop App for Windows를 받을 수 있다고 안내합니다.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget upgrade --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
corepack enable
pnpm.cmd --version
wsl --set-default-version 2
wsl --install -d Ubuntu
# Windows가 요청하면 재부팅하고, Ubuntu 첫 실행 Linux 사용자 이름/비밀번호 설정 후 같은 한 줄 명령을 다시 실행합니다.
wsl --set-default Ubuntu
wsl -- bash -lc 'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash'
wsl -- bash -lc 'NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh"; nvm install 22; nvm use 22; npm install -g @openai/codex@latest; codex --version'
winget install --id Microsoft.VCRedist.2015+.x64 -e
codex --version
```

## 로컬 실행

Windows에서 installer는 나중 실행을 위해 바탕화면에 Solo Superman 바로가기 `solo_superman.lnk` 하나만 만들거나 새로 고칩니다. 실제 실행 wrapper `solo_superman.cmd`는 설치 폴더 안에 두고, localized, public, OneDrive-redirected Desktop folders에 이전 installer가 남긴 중복 `solo_superman.cmd`/`solo_superman.lnk`는 정리합니다. 이 바탕화면 바로가기는 OpenAI의 Codex Desktop App과 다른 Solo Superman 재실행용 wrapper를 가리킵니다. `call pnpm.cmd start:local`을 사용하므로 control이 cmd wrapper로 돌아오며, launch가 실패하면 cmd window는 failure output과 exit code를 보여주고 Enter를 누를 때까지 닫히지 않습니다. macOS installer는 바탕화면 실행파일을 만들지 않고 rerun command를 출력합니다.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location "$HOME\solo_superman"; pnpm.cmd start:local
```

기본 local path에는 OpenAI API key, ChatGPT web credential, ChatGPT Pro session이 필요하지 않습니다. 즉 local first screen에 도달하는 데 이 세 credential이 모두 필요하지 않습니다. Backend question/research preview는 local Codex CLI의 `codex login status`만 확인하며 ChatGPT web sign-in 여부를 검사하지 않습니다. Windows에서는 sidecar가 이 Codex CLI를 WSL을 통해 실행하므로 실제 명령은 `wsl.exe -d <배포판> -- bash -lc '... codex login status'` 형태이며 login도 WSL-backed `codex auth login` terminal을 엽니다. Codex login이 없으면 UI는 background terminal에서 `codex auth login`을 열도록 제안할 수 있습니다. UI label은 Open Codex login과 Refresh Codex login status입니다. 별도의 ChatGPT browser-session delegation은 자체 user-approved flow가 필요하며 default local run의 일부가 아닙니다. Solo Superman은 credential을 수집하거나 저장하지 않습니다.

## 검증 명령

기여자는 아래 명령을 실행할 수 있습니다.

```sh
pnpm verify:prod-bundle
pnpm verify
```

Windows PowerShell에서는 local execution policy가 `pnpm.ps1`을 막아도 Node/Corepack command shim이 실행되도록 `pnpm.cmd verify:prod-bundle`과 `pnpm.cmd verify`를 사용합니다.

Production bundle smoke는 `build_auto_local_smoke`, browser readiness, managed child processes stopped, temporary app data removed, auto shutdown/kill evidence를 포함해야 합니다.
`pnpm verify:prod-bundle`은 managed sidecar/web child process를 시작하기 전에 fixed smoke port를 먼저 확인합니다. `127.0.0.1:43110` 또는 설정된 web preview port가 이미 사용 중이면 기존 local process를 중지하거나 `SOLO_PROD_SMOKE_SIDECAR_PORT=<free-port>` / `SOLO_PROD_SMOKE_WEB_PORT=<free-port>`로 다시 실행합니다.

Live Codex app-server preview turn은 기본 비활성입니다. Maintainer는 `codex login status`가 local Codex CLI 인증 상태를 보고한 뒤 `SOLO_CODEX_APP_SERVER_LIVE_TURNS=1`로 opt-in할 수 있습니다. 로컬 환경이 실제 live preview-only turn 준비 상태인지 증명하려면 macOS/Linux에서는 `SOLO_VERIFY_CODEX_LIVE_RUNTIME=1 SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 pnpm verify:codex-live-runtime`, Windows PowerShell에서는 `$env:SOLO_VERIFY_CODEX_LIVE_RUNTIME="1"; $env:SOLO_CODEX_APP_SERVER_LIVE_TURNS="1"; pnpm.cmd verify:codex-live-runtime`을 실행합니다. 이 명령은 per-run token과 임시 app data로 local sidecar만 띄운 뒤 `/api/v1/runtime/status`를 읽고, runtime이 `status=available`, `executionMode=live`, `liveTurnExecutionEnabled=true`, authenticated Codex account를 모두 보고할 때만 통과합니다. Opt-in 없이 `pnpm verify:codex-live-runtime`만 실행하면 live readiness를 검증한 것처럼 보이지 않도록 `skipped` evidence를 출력합니다. App은 이 경우에도 API key, cookie, ChatGPT web credential을 요청하거나 저장하지 않습니다.

`pnpm verify:clarification-pipeline`은 credential-free clarification pipeline smoke입니다. 임시 app data와 local sidecar를 만들고 business-mode project를 생성한 뒤 intake, 초기 Living Product Spec, ambiguity analysis, 활성 질문 묶음 생성, 첫 질문 답변 제출을 통과시킵니다. 통과하려면 Decision Queue progress가 생성/활성/답변/follow-up debt를 보여주고, research-needed 답변이 source-linked planned research task를 만들며, completeness와 Planning Handoff가 source trace 부족을 Planning-ready가 아닌 blocker evidence로 유지해야 합니다.

`pnpm verify:clarification-volume`은 credential-free long-session volume smoke입니다. 네트워크나 LLM credential 없이 core ProductEngine fixture를 실행해 business-mode clarification이 active batch를 보이는 카드 5개로 제한한 채 200개 이상의 질문에 답할 수 있고, accepted answer마다 durable research-task debt를 만들며, follow-up budget을 소진하고 question-debt completion 100%에 도달하는지 증명합니다.

`pnpm verify:runtime-preview-turn`은 그 다음 local-only smoke입니다. 기본값은 fixture mode이며 임시 app-data database를 만들고, project를 생성한 뒤 `/api/v1/runtime/codex/preview`를 queue하고, pending `codex_runtime_preview_effect`를 실행해 runtime activity에 `preview_ready` `ImplementationPlanPreviewArtifact`가 보일 때만 통과합니다. 같은 preview-turn 경로를 live Codex app-server turn으로 검증하려면 macOS/Linux에서는 `SOLO_VERIFY_CODEX_LIVE_PREVIEW_TURN=1 SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 pnpm verify:runtime-preview-turn`, Windows PowerShell에서는 `$env:SOLO_VERIFY_CODEX_LIVE_PREVIEW_TURN="1"; $env:SOLO_CODEX_APP_SERVER_LIVE_TURNS="1"; pnpm.cmd verify:runtime-preview-turn`을 실행합니다. Live 실행이 manual handoff로 fallback되면 이 smoke는 `passed`가 아니라 `blocked`를 보고합니다. 이 명령은 preview artifact 생성까지만 검증하며 full worker-job end-to-end run은 아직 아닙니다.

`pnpm verify:worker-job`은 worker bridge smoke입니다. 기본값은 fixture mode이며 임시 app data와 임시 generated-workspace root를 만들고, planning-ready handoff를 생성한 뒤 auto-implementation workspace run을 만들며, ready file-diff `ExecutionAuthorityRecord`를 붙이고 current-stage worker job을 plan/run하여 completed `ImplementationStepLedger` evidence를 import하고 run을 `initial_pr`에서 다음 review stage로 advance할 때만 통과합니다. 같은 경로를 live Codex worker turn으로 시도하려면 macOS/Linux에서는 `SOLO_VERIFY_CODEX_LIVE_WORKER_JOB=1 SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 pnpm verify:worker-job`, Windows PowerShell에서는 `$env:SOLO_VERIFY_CODEX_LIVE_WORKER_JOB="1"; $env:SOLO_CODEX_APP_SERVER_LIVE_TURNS="1"; pnpm.cmd verify:worker-job`을 실행합니다. Live worker execution이 import 가능한 ledger evidence를 만들지 못하면 이 smoke는 `blocked`를 보고합니다. Production deploy, external service mutation, final-submit action은 이 smoke 범위 밖에 남아 있습니다.

`pnpm verify:pr-mutation`은 generated PR mutation smoke입니다. 기본값은 항상 fixture이며 `gh`를 호출하지 않습니다. 대신 임시 app data와 임시 generated-workspace root를 만들고, planning-ready handoff와 connected fixture remote status의 auto-implementation run을 만든 뒤, approved `open_pr`이 `initial_pr` ledger evidence 전에는 막히는지, 해당 evidence 이후 fixture PR open이 적용되는지, current body evidence와 generated body markdown이 있는 fixture `update_pr_body`가 적용되는지, `final_verify_pr_update` 전에는 `merge_pr`이 막히는지, current PR body evidence가 없으면 merge가 막히는지, merge readiness evidence가 있으면 fixture merge가 적용되는지, 첫 merge 이후 duplicate merge가 막히는지를 검증합니다. 실제 GitHub PR write는 계속 explicit approved mutation contract 뒤에 있으며 default verification 범위 밖입니다.

`pnpm verify:auto-implementation-pipeline`은 preview-turn, worker-job, generated PR mutation smoke를 한 번에 묶는 credential-free aggregate smoke입니다. 이 명령은 live Codex flag를 강제로 요구하지 않고 fixture mode에서 `codex_runtime_preview_effect` 생성/실행, bounded worker job의 ledger import 및 stage advance, generated PR open/body-update/merge guard를 순차 검증하며, 하위 smoke 중 하나라도 `blocked`이면 aggregate 결과도 `blocked`로 보고합니다. 실제 GitHub write와 production/external final-submit action은 계속 범위 밖입니다.

`pnpm verify:auto-implementation-review-loop`은 credential-free review-loop smoke입니다. 임시 app data와 local sidecar를 만들고 planning-ready auto-implementation run을 만든 뒤 `initial_pr`부터 `merge_main`까지 모든 canonical stage를 기존 stage endpoint로 완료합니다. 각 stage는 `ImplementationStepLedger`에 feature/repository code-review 2회 no-finding pass, changed-code/repository clean-code 2회 no-finding pass, gap 없는 missing-test audit evidence, passing test evidence가 있어야 통과합니다. 실제 GitHub write, deploy, browser action, public-web polling, secret access는 범위 밖입니다.

`pnpm verify:browser-delegation-pipeline`은 credential-free browser delegation pipeline smoke입니다. 임시 app data와 local sidecar를 만들고 loopback mock ChatGPT-ready page를 띄운 뒤, 승인된 `browser_action` `ExecutionAuthorityRecord`를 생성하고 browser action으로 screenshot/log/audit ref를 확보하며, ChatGPT browser delegation run 생성 및 refetch 후 revoke까지 검증합니다. 실제 ChatGPT account, browser profile, public-web polling, credential/session/token custody, 외부 네트워크 접근은 이 smoke 범위 밖입니다.

`pnpm verify:service-page-pipeline`은 credential-free service page-use pipeline smoke입니다. 임시 app data와 local sidecar를 만들고 loopback mock setup page를 띄운 뒤, matching permission 전 service-scoped browser action 차단, read/preview permission grant, permission/action echo 요구, retained artifact ref의 audit-metadata-only 삭제, revoke 이후 browser action 차단, per-action fill-draft permission, production-mutation contract 없는 final submit 차단을 검증합니다. 실제 service account, browser profile, credential/session/token custody, production deploy, final-submit execution, 외부 네트워크 접근은 이 smoke 범위 밖입니다.

`pnpm verify:research-pipeline`은 credential-free research pipeline smoke입니다. 임시 app data와 local sidecar를 만들고 public-web allowlist를 생성한 뒤 read-only research run을 시작하며, source trace가 있는 result import와 pending `research_evidence_effect` drain 또는 이미 생성된 synthesis를 확인합니다. 통과하려면 Research projection에 evidence matrix/evidence pack/review card가 보이고 Decision Queue에 research-generated follow-up question debt가 노출되어야 합니다. `pnpm verify`는 clarification pipeline, clarification volume, research, browser delegation, service page-use, auto-implementation aggregate smoke를 함께 실행하며, auto-implementation aggregate가 runtime preview, worker job, PR mutation, missing-test audit ref를 포함한 review-loop evidence를 포함하므로 review-loop smoke를 중복 실행하지 않고 기본 로컬 검증에서 질문/리서치/구현 critical path와 staged review protocol을 모두 확인합니다.

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
- Installer가 WSL을 확인하고 `wsl --set-default-version 2` 및 기본 배포판 설정을 수행하는지, 배포판이 없을 때 `wsl --install -d Ubuntu`를 실행한 뒤 reboot 또는 Ubuntu first-run user setup이 필요하면 같은 한 줄 명령 rerun message를 주는지 확인합니다.
- Installer가 WSL 안에서 먼저 `nvm use 22`로 기존 Node 22를 재사용하고, 없을 때만 `nvm install 22`를 실행한 뒤 기존 Codex CLI가 있으면 `command -v codex`와 `codex --version`으로 재사용하고, 없으면 `npm install -g @openai/codex@latest`와 `codex --version`이 credential prompt 없이 성공하는지 확인합니다.
- WSL 안에서 local web 또는 production smoke를 실행할 때 server bind host는 `0.0.0.0`, browser/fetch URL은 `127.0.0.1` loopback으로 유지되는지 확인합니다.
- 설치 폴더의 `solo_superman.cmd`가 `SOLO_CODEX_WINDOWS_MODE=wsl`을 설정하고 바탕화면에는 `solo_superman.lnk` 하나만 보이는지, sidecar가 Codex account check에 `wsl.exe`를 사용하는지 확인합니다.
- Installer가 dependency install 전에 `vcruntime140.dll`, `vcruntime140_1.dll`, `msvcp140.dll`을 확인하고, `@libsql/win32-x64-msvc`가 runtime에서 실패하기 전에 Microsoft Visual C++ Redistributable (x64)을 복구하는지 확인합니다.
- Native fallback을 명시적으로 켠 상태에서 `codex.cmd --version failed with exit -1073741515`가 발생하면 installer가 Microsoft Visual C++ Redistributable (x64)을 설치하고 `codex --version`을 다시 실행하는지 확인합니다.
- Codex Desktop App download window가 `https://openai.com/codex/`로 열리고 popup이 바이브 코딩 / parallel agent work용 optional 안내임을 설명하는지 확인합니다.
- PowerShell execution policy가 one-line command를 허용하는지 확인합니다.
- 설치 후 새 terminal에서 Node와 Git이 보이는지 확인합니다.
- Double-click Desktop shortcut 후 failed launch가 Enter를 누를 때까지 visible한지 확인합니다.
- Path quoting works for folders with spaces.
- Long path support is not blocking dependency install.
- Antivirus/network prompt is not silently blocking local server startup.

## 문제 해결 사례

| Case | Symptom | Safe response |
| --- | --- | --- |
| Port conflict | Browser 또는 sidecar port가 이미 사용 중입니다. | free alternate port를 선택합니다. unknown process를 kill하지 않습니다. `pnpm verify:prod-bundle`에서는 충돌 process를 확인하거나 중지한 뒤 `SOLO_PROD_SMOKE_SIDECAR_PORT=<free-port>` 또는 `SOLO_PROD_SMOKE_WEB_PORT=<free-port>`를 사용합니다. |
| Token mismatch | API returns `401`. | frontend와 sidecar가 같은 token을 받도록 `pnpm start:local`을 다시 실행합니다. |
| CORS/origin | Browser request is blocked. | loopback URL과 local sidecar base URL을 확인합니다. |
| Garbled Korean or UTF-8 output | Windows PowerShell에서 README 한 줄 명령을 실행했을 때 한글 출력이나 다운로드된 script text가 깨져 보입니다. | README의 짧은 `scripts/win.ps1` launcher 명령을 사용합니다. Launcher가 `[Console]::OutputEncoding`, `$OutputEncoding`, `chcp.com 65001`, TLS 1.2, UTF-8 download decoding, BOM 제거를 먼저 수행한 뒤 bootstrap을 실행합니다. |
| Corepack or npm `already exists` for pnpm | Corepack 또는 npm이 이미 있는 `pnpm`/`pnpm.cmd` shim 때문에 `EEXIST`, `already exists`, `file already exists`를 출력합니다. | updated installer는 먼저 기존 `pnpm.cmd --version`을 확인하고, Corepack/npm fallback 실패 후에도 사용 가능한 pnpm 11+ shim이 있으면 설치를 계속합니다. |
| Codex CLI `already exists` | WSL 또는 native Codex 설치 단계에서 npm이 이미 있는 `codex`/`codex.cmd` shim 때문에 `EEXIST`, `already exists`, `file already exists`를 출력합니다. | updated installer는 먼저 기존 `codex --version`을 확인하고, npm global install 실패 후에도 사용 가능한 Codex CLI가 있으면 설치를 계속합니다. |
| Node stays on v22.x | README 한 줄 설치 중 `node already installed: v22...` 또는 `Node 24 이상이 필요` 메시지가 보입니다. | updated installer는 Node 22 같은 오래된 LTS가 있으면 `winget upgrade --id OpenJS.NodeJS.LTS -e`를 먼저 시도합니다. 그래도 `node --version`이 24 이상이 아니면 Node.js Windows x64 LTS installer로 Node 24+를 설치한 뒤 새 관리자 PowerShell에서 다시 실행합니다. |
| Administrator permission denied | Corepack reports `operation not permitted` for `C:\Program Files\nodejs\pnpx` or Windows prerequisite/WSL setup is denied. | README one-line installer를 다시 실행하고 UAC administrator prompt를 승인합니다. 회사 정책이 UAC를 막으면 중단하고 승인된 managed install path를 사용합니다. |
| Codex WSL setup incomplete | Installer가 WSL/Ubuntu reboot 또는 first-run Linux user/password setup이 필요하다고 보고합니다. | Windows가 요청했다면 reboot하고, Ubuntu를 한 번 열어 Linux user setup을 끝낸 뒤 README의 같은 한 줄 명령을 다시 실행합니다. Installer가 WSL2/default 배포판 설정과 WSL 안의 Codex CLI 설치를 이어서 진행합니다. |
| WSL install script quoting | `line 8: syntax error: unexpected end of file from 'if' command on line 6`처럼 multi-line bash가 중간에서 끊긴 듯한 오류가 보입니다. | updated installer는 multi-line WSL install script를 `bash -lc` argument로 직접 전달하지 않고 LF/UTF-8 temporary `.sh` file로 작성한 뒤 `wslpath`로 변환해 `wsl -- bash <script>`로 실행합니다. |
| WSL wslpath Windows path escaping | `wslpath: C:Users...AppDataLocalTemp...codex-wsl-install-1234-20260521-143000.sh`처럼 backslash가 사라진 Windows temp path가 보입니다. | updated installer는 `wslpath` 입력을 `C:\...`가 아니라 `C:/...` forward-slash Windows path로 변환합니다. `wslpath`가 그래도 실패하면 default `/mnt/c/...` mount path로 fallback합니다. |
| WSL nvm home detection | WSL Codex install에서 `/nvm.sh: No such file or directory` 또는 `nvm.sh not found`가 보입니다. | Windows backslash로 바꾸지 않습니다. WSL 안의 nvm path는 Linux slash path인 `/home/<user>/.nvm/nvm.sh`여야 합니다. updated installer는 WSL `HOME`을 명시적으로 계산하고 `NVM_DIR`을 `$HOME/.nvm`으로 고정한 뒤 nvm.sh 존재를 확인합니다. |
| WSL setup garbled output | `Codex CLI용 WSL2/default 배포판 설정` 다음 줄부터 `solo-superman-wsl-ready` 근처까지 Windows localization output이 깨져 보입니다. | updated installer는 WSL default setup과 readiness probe를 no-output mode로 실행하고, 성공 시 `solo-superman-wsl-ready` 같은 probe text를 출력하지 않습니다. |
| WSL nvm Node already installed | `OpenAI Codex CLI 설치/업데이트 (WSL)` 다음에 `v22.22.3 is already installed` 같은 메시지가 보이고 설치가 실패합니다. | updated installer는 `nvm install 22`보다 먼저 `nvm use 22`를 실행해 이미 있는 Node 22를 재사용합니다. install이 실패해도 기존 Node 22를 다시 선택할 수 있으면 Codex 설치를 계속합니다. |
| Windows sidecar native runtime missing | `pnpm start:local` 또는 `pnpm verify:prod-bundle`이 alternate port로 시작한 뒤 sidecar가 `ERR_DLOPEN_FAILED`, `The specified module could not be found`, `@libsql/win32-x64-msvc/index.node`로 종료됩니다. | `winget install --id Microsoft.VCRedist.2015+.x64 -e`로 Microsoft Visual C++ Redistributable (x64)을 설치 또는 복구합니다. updated installer는 dependency install 전에 필요한 runtime DLL을 확인하고 자동으로 이 과정을 수행합니다. |
| Codex CLI native runtime missing | Native fallback에서 `npm install -g @openai/codex@latest` 직후 `codex.cmd --version failed with exit -1073741515` 또는 `0xC0000135`가 발생합니다. | 기본 WSL 경로를 우선 사용합니다. Native fallback이 꼭 필요하면 `winget install --id Microsoft.VCRedist.2015+.x64 -e`로 Microsoft Visual C++ Redistributable (x64)을 설치한 뒤 `codex --version`을 다시 실행합니다. updated installer는 native mode에서 이 과정을 자동 수행합니다. |
| Windows/WSL `spawn pnpm ENOENT` during smoke | `pnpm verify:prod-bundle` 또는 `pnpm start:local` 안의 child process가 `spawn pnpm ENOENT`로 실패합니다. Windows installer가 같은 오류를 포트 충돌로 오인해 alternate ports retry를 반복할 수 있습니다. | updated runner는 `npm_execpath` 또는 installer가 넘긴 `SOLO_PNPM_COMMAND`로 현재 pnpm entrypoint를 재사용하고, Windows `.cmd` shim은 shell 경유로 실행합니다. installer는 `EADDRINUSE`/`strictPort` 같은 실제 포트 충돌에서만 alternate ports retry를 수행합니다. |
| WSL localhost port binding | WSL에서 서버가 떠도 Windows 브라우저에서 `localhost`/`127.0.0.1` 포트가 열리지 않거나 readiness fetch가 계속 실패합니다. | updated local runner는 WSL 감지 시 server bind host를 `0.0.0.0`으로 사용하되, browser/fetch URL과 Vite sidecar base URL은 loopback `127.0.0.1`로 유지합니다. Native macOS/Windows에서는 `0.0.0.0` bind override를 허용하지 않습니다. |
| Execution policy | Windows blocks script execution. | Policy error와 retry command를 보여주며 회사 정책을 우회하지 않습니다. |
| Path quoting | Spaces in path break a command. | quoted PowerShell paths 또는 `Set-Location`을 사용합니다. |
| Long path | Windows dependency install fails deep in `node_modules`. | long paths를 enable하거나 checkout을 shorter path로 옮깁니다. |
| Antivirus/network prompt | Local server is blocked. | 정책이 허용한다면 local loopback을 allow하도록 안내합니다. |

## Install/run docs contract / 문서 계약

Docs verifier는 이 troubleshooting guide에서 macOS/Windows command coverage, local token defaults, Codex login labels, manual browser smoke, cleanup evidence, required troubleshooting cases를 확인합니다.
