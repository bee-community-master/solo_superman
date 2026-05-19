# Solo Superman

언어: 한국어 | [English](README.en.md)

## 소개

Solo Superman은 솔로 창업자가 아이디어를 질문, 리서치, 결정 세션으로 구체화하고 로컬 웹 UI와 Local Node/Hono service로 실행하는 local-first Founder OS입니다.

현재 배포 상태는 **테크니컬 프리뷰**입니다. 비개발자도 한 줄 설치로 로컬 웹 화면까지 도달할 수 있게 만드는 단계이며, 파일 수정, 셸 실행, 브라우저 조작, 외부 서비스 제출처럼 위험한 작업은 자동 실행하지 않고 먼저 검토 가능한 실행 준비 노트로 남깁니다.

설치 스크립트는 Node LTS, Git, Corepack/pnpm을 점검하고 필요하면 설치한 뒤 repo clone, dependency install, 로컬 실행 가능 여부 확인, 브라우저 자동 실행까지 처리합니다. 같은 이름의 폴더가 이미 있거나 기본 로컬 포트가 사용 중인 경우에도 사용자 파일을 덮어쓰거나 실행 중인 프로세스를 종료하지 않고 안전한 대체 경로/포트를 자동 선택합니다.

## 설치방법

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-windows.ps1 | iex
```

설치 프로그램이 PATH 반영을 위해 새 터미널을 요구하면 새 터미널을 열고 같은 한 줄 명령을 다시 실행하면 이어서 진행됩니다. 네트워크, 회사 보안 정책, 관리자 권한 때문에 자동 복구가 안전하지 않은 경우에는 정책을 우회하지 않고 쉬운 오류 메시지와 재실행 명령을 보여줍니다.

## 실행방법

설치가 끝나면 로컬 서버가 계속 실행되고 기본 브라우저에 Solo Superman web 화면이 자동으로 열립니다. 이 터미널을 열어두고 사용하세요. 종료하려면 `Ctrl+C`를 누릅니다.

나중에 다시 실행하려면 아래 명령을 사용합니다. Windows 설치 프로그램은 바탕화면에 `solo_superman.cmd` 실행파일도 만들어 두므로, 다음부터는 그 파일을 더블클릭해 같은 로컬 실행을 시작할 수 있습니다.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location .\solo_superman; pnpm start:local
```

기본 로컬 설치/실행 경로에는 OpenAI API key나 ChatGPT credential이 필요하지 않습니다. 다만 backend 질문/리서치 preview를 시작하기 전에는 사용자가 브라우저에서 ChatGPT에 직접 로그인했는지 확인하고, 로컬 Codex CLI가 로그인되어 있는지 확인합니다. 누락된 경우 UI가 `codex auth login`을 실행하는 백그라운드 Terminal을 열어 Codex 브라우저 로그인 화면으로 이어지게 할 수 있습니다. Solo Superman은 해당 credential을 수집하거나 저장하지 않습니다. 자세한 운영 번들 실행과 문제 해결은 [`docs/39-local-install-run-verification.md`](docs/39-local-install-run-verification.md)를 참고합니다.

## 배포 범위

- 현재 권장 공개 방식: 제한 베타 또는 테크니컬 프리뷰
- 적합한 사용자: 로컬 앱 설치에 익숙하거나 안내를 보며 터미널 한 줄 명령을 실행할 수 있는 사용자
- 아직 남은 일반 배포 과제: macOS/Windows 설치 패키지, 자동 업데이트, 오류 리포트, Windows 실기기 검증

참고: Windows PowerShell 설치 경로는 문서화되어 있지만, 넓은 공개 전에는 실제 Windows 기기에서 한 줄 설치부터 첫 화면 도달까지 별도 검증이 필요합니다.
