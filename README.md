# Solo Superman

언어: 한국어 | [English](README.en.md)

## 소개

Solo Superman은 솔로 창업자가 아이디어를 질문, 리서치, 결정 세션으로 구체화하고 로컬 웹 UI와 Local Node/Hono service로 실행하는 local-first Founder OS입니다.

현재 배포 상태는 **테크니컬 프리뷰**입니다. 비개발자도 한 줄 설치로 로컬 웹 화면까지 도달할 수 있게 만드는 단계이며, 파일 수정, 셸 실행, 브라우저 조작, 외부 서비스 제출처럼 위험한 작업은 자동 실행하지 않고 먼저 검토 가능한 실행 준비 노트로 남깁니다.

설치 스크립트는 Node 24 이상, Git, Corepack/pnpm, Windows native runtime, Codex CLI를 점검하고 필요하면 설치한 뒤 repo clone, dependency install, 로컬 실행 가능 여부 확인, 브라우저 자동 실행까지 처리합니다. Windows에서는 앱 실행용 Node/pnpm은 Windows에 두되 Codex CLI는 안정성을 위해 WSL(Ubuntu) 안에 설치하고 `SOLO_CODEX_WINDOWS_MODE=wsl`로 실행합니다. 이미 설치된 Codex CLI가 `codex --version`으로 검증되면 npm 전역 설치가 `already exists` 충돌을 내더라도 기존 명령을 재사용합니다. 바이브 코딩이나 여러 agent 병렬 작업을 더 하고 싶은 사용자를 위해 Codex Desktop App 다운로드 안내 창도 띄웁니다. 같은 이름의 폴더가 이미 있거나 기본 로컬 포트가 사용 중인 경우에도 사용자 파일을 덮어쓰거나 실행 중인 프로세스를 종료하지 않고 안전한 대체 경로/포트를 자동 선택합니다. 기존 설치 폴더가 clean checkout이면 같은 한 줄 설치 명령을 다시 실행할 때 `origin/main`으로 safe fast-forward update를 시도하고, local 변경이나 diverged branch가 있으면 업데이트를 건너뜁니다. 이 재실행 업데이트는 git checkout 기반 technical-preview 경로일 뿐이며, 서명된 패키지 앱 자동 업데이트는 별도 release channel manifest/signature/checksum/retry/rollback 계약을 통과해야 합니다.

## 설치방법

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

시작 메뉴에서 PowerShell을 **관리자 권한으로 실행**한 뒤 아래 한 줄을 붙여넣으세요. 관리자 권한이 아니면 Node.js/Git 설치 단계에서 실패할 수 있습니다.

```powershell
irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 | iex
```

이 짧은 명령은 작은 Windows launcher를 먼저 실행합니다. Launcher는 Windows PowerShell 5.1에서도 UTF-8 콘솔 출력, TLS 1.2, UTF-8 스크립트 다운로드, BOM 제거를 설정한 뒤 실제 설치 스크립트를 내려받아 시작합니다. Windows 설치 프로그램은 Node/Corepack/pnpm 활성화, WSL/Ubuntu 확인, 바탕화면 바로가기 생성/정리 전에 관리자 권한이 아니면 UAC 승인을 요청해 관리자 PowerShell로 자동 재실행합니다. Codex CLI용 WSL은 기본값으로 WSL2와 Ubuntu를 쓰도록 `wsl --set-default-version 2` 및 기본 배포판 설정을 수행합니다. WSL 배포판이 없으면 `wsl --install -d Ubuntu`를 시도하며, 첫 WSL 설치처럼 Windows 재부팅이나 Ubuntu 첫 사용자 이름/비밀번호 생성이 필요할 수 있는 경우에는 그 단계에서 멈추고 재부팅 및 Ubuntu 첫 실행 후 같은 한 줄 명령을 다시 실행하라고 안내합니다. PATH 반영을 위해 새 터미널을 요구하면 새 터미널을 열고 같은 한 줄 명령을 다시 실행하면 이어서 진행됩니다. 네트워크, 회사 보안 정책, 관리자 권한 때문에 자동 복구가 안전하지 않은 경우에는 정책을 우회하지 않고 쉬운 오류 메시지와 재실행 명령을 보여줍니다.

## 실행방법

설치가 끝나면 로컬 서버가 계속 실행되고 기본 브라우저에 Solo Superman web 화면이 자동으로 열립니다. 이 터미널을 열어두고 사용하세요. 종료하려면 `Ctrl+C`를 누릅니다.

나중에 다시 실행하려면 아래 명령을 사용합니다. 설치 완료 메시지는 설치 경로, 다시 실행 명령, 바탕화면 바로가기 여부를 알려줍니다. Windows 설치 프로그램은 이미 설치된 경우에도 바탕화면에 `solo_superman` 바로가기 하나만 보이도록 `solo_superman.lnk`를 확인/생성하고, 이전 installer가 만든 중복 바탕화면 `solo_superman.cmd`/`solo_superman.lnk`는 정리합니다. 실제 실행 wrapper인 `solo_superman.cmd`는 설치 폴더 안에 두며, 바로가기를 더블클릭하면 같은 로컬 실행을 시작합니다. 더블클릭 실행이 실패하면 cmd 창을 자동으로 닫지 않고 실패 내용과 종료 코드를 보여준 뒤 Enter를 눌러 닫게 합니다. macOS 설치 프로그램은 바탕화면 실행파일을 만들지 않고 재실행 명령을 안내합니다. Windows에서 설치 경로 충돌 때문에 `solo_superman-2` 같은 대체 경로가 선택되면 설치 완료 메시지에 표시된 다시 실행 명령을 사용하세요.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location "$HOME\solo_superman"; pnpm.cmd start:local
```

로컬 첫 화면 도달과 기본 실행에는 OpenAI API key, ChatGPT web credential, 또는 ChatGPT Pro 세션이 필요하지 않습니다. backend 질문/리서치 preview를 시작할 때 UI는 ChatGPT 웹 세션을 검사하지 않고 로컬 Codex CLI의 `codex login status`만 확인합니다. Windows에서는 이 Codex CLI 확인과 `codex auth login`을 WSL 안에서 실행합니다. 필요하면 백그라운드 Terminal을 열어 Codex 브라우저 로그인 화면으로 이어지게 합니다. ChatGPT 브라우저 세션을 사용하는 별도 기능은 사용자 승인 흐름이 필요하며 기본 preview 조건이 아닙니다. Solo Superman은 어떤 credential도 수집하거나 저장하지 않습니다. 자세한 문제 해결은 [`docs/troubleshooting_KO.md`](docs/troubleshooting_KO.md)를 참고합니다. 기여자 온보딩과 아키텍처 문서는 [`docs/README.md`](docs/README.md)에서 시작합니다.

## 배포 범위

- 현재 권장 공개 방식: 제한 베타 형태의 테크니컬 프리뷰
- 적합한 사용자: 로컬 앱 설치에 익숙하거나 안내를 보며 터미널 한 줄 명령을 실행할 수 있는 사용자
- 제품 capability readiness 게이트: [`docs/product-capability-readiness_KO.md`](docs/product-capability-readiness_KO.md)와 `pnpm verify:product-capability-readiness`가 질문, 리서치, readiness, browser/service boundary, auto implementation loop가 credential-free verifier로 code-backed인지 확인합니다.
- Final-submit production mutation 계약: `docs/production-mutation-contract.example.json`와 `pnpm verify:production-mutation-contract`가 service-page final submit을 열기 전에 필요한 confirmation-card, ExecutionAuthorityRecord, redaction, approval, rollback, audit, no-secret evidence 요구사항을 검증합니다. 기본 로컬 검증에서는 실제 external production mutation을 수행하지 않습니다.
- 오류 리포트용 로컬 진단 번들: 실패 상황에서 `pnpm support:bundle`을 실행하면 credential-free JSON support bundle 경로가 출력됩니다. `pnpm verify:support-bundle`은 bundle schema, redaction, compact product/release diagnostics, ready-release `--plan-only` summary, #259/#266/#267 이슈별 handoff, recommended checks를 검증하며, recommended checks에는 opt-in live runtime readiness용 `pnpm verify:codex-live-runtime`, `pnpm verify:ready-release -- --plan-only`, `pnpm release:evidence-bundle -- <bundle-dir>`, filled bundle `pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready`, release lab bundle용 final `pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>` 실행 순서도 포함됩니다. 이 번들은 OS/Node/pnpm/git 상태, product/release diagnostics summary, ready-release 이슈별 checklist/template/comment 경로와 template 검증/GitHub issue comment 명령, allowlisted environment만 담고 token, secret, cookie, credential, file contents는 수집하지 않습니다.
- release evidence checklist: `pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json`가 #259/#266/#267에 필요한 blocked gate, required checks/evidence, final verification command를 credential-free JSON으로 묶어 줍니다. 특정 이슈에 붙일 Markdown checklist가 필요하면 `pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md`를 사용합니다. GitHub 이슈에 붙일 comment 본문만 만들려면 `pnpm release:evidence-checklist -- --format comment --issue 267 --output ./issue-267-release-evidence-comment.md`를 사용합니다. `comment` 형식은 evidence item이 없는 잘못된 이슈 번호에서 실패합니다. Release lab 전체 bundle은 `pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle`로 전체 checklist/template과 issue별 Markdown/JSON template, manifest, README를 한 번에 생성합니다. 생성/수정한 bundle은 `pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle`로 manifest와 실제 디스크 파일의 completeness/listing, ready-release command 포함 여부, secret-free 경계를 검증하고, manifest에 없는 scratch/secret 파일이 섞이면 실패합니다. 실제 redacted evidence를 모두 채운 뒤에는 `--require-ready`를 추가해 모든 template이 ready/passed인지 확인합니다. Release lab이 채울 JSON template은 `pnpm release:evidence-checklist -- --format template --issue 266 --output ./issue-266-release-evidence-template.json`으로 생성하고, 채운 template은 `pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json`로 placeholder, passed 상태, redaction, filled-bundle/aggregate self-command을 제외한 pre-gate ready-release command 실행 기록과 `readyReleaseResult.status`/`commandBlockers`/`perCommandBlockers`까지 검증합니다. 입력 없이 `pnpm verify:release-evidence-template`/`pnpm verify:release-evidence-bundle`을 실행하면 #259/#266/#267 blocker issue별 credential-free fixture와 현재 bundle 계약을 모두 검증합니다.
- 서명된 설치 패키지 preflight: [`docs/signed-packages_KO.md`](docs/signed-packages_KO.md)와 `pnpm verify:signed-package-preflight`가 macOS/Windows package 후보, signing credential gate, local dry-run과 actual signing gate 분리를 검증합니다.
- 서명된 패키지 release evidence 계약: [`docs/signed-package-release_KO.md`](docs/signed-package-release_KO.md)와 `pnpm verify:signed-package-release`가 macOS signing/notarization, Windows Authenticode/timestamp, release manifest signature evidence gate를 #266에 묶어 두고, `pnpm verify:signed-package-release:dry-run`이 credential-free fixture로 artifact checksum/size/signature ref/manifest evidence shape drift를 잡습니다.
- 패키지 앱 업데이트 채널 계약: [`docs/release-channel_KO.md`](docs/release-channel_KO.md)와 `pnpm verify:release-channel`이 manifest 서명, artifact checksum/signature, 사용자 보류, 재시도, rollback, credential/user-data 보존 조건을 검증합니다.
- 패키지 업데이트 rollback runtime/evidence 계약: [`docs/packaged-update-rollback_KO.md`](docs/packaged-update-rollback_KO.md), `pnpm verify:packaged-update-rollback`, `pnpm verify:packaged-update-rollback:dry-run`이 fixture 기반 packaged updater runtime의 defer/retry/failed-launch rollback 경계와 macOS/Windows device rollback evidence gate를 #267에 묶어 둡니다.
- Windows 실기기 설치 evidence 계약: [`docs/windows-real-device_KO.md`](docs/windows-real-device_KO.md), `pnpm verify:windows-real-device`, `pnpm verify:windows-installer:dry-run`이 한 줄 설치부터 첫 화면 도달까지의 evidence gate와 credential-free installer path drift를 #259에 묶어 둡니다.
- 일반 공개 준비도 게이트: [`docs/release-readiness_KO.md`](docs/release-readiness_KO.md)와 `pnpm verify:release-readiness`가 signed package, packaged updater rollback, Windows 실기기 evidence가 준비되기 전까지 broad/general release 상태가 blocked임을 검증합니다.
- 아직 남은 일반 배포 과제: 실제 signing/notarization credential으로 macOS/Windows 설치 패키지 생성 및 검증, signed artifact를 사용하는 macOS/Windows 실기기 updater rollback 검증, Windows 실기기 검증

참고: Windows PowerShell 설치 경로는 문서화되어 있지만, 넓은 공개 전에는 실제 Windows 기기에서 한 줄 설치부터 첫 화면 도달까지 별도 검증이 필요합니다.
