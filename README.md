# Solo Superman

## 소개

Solo Superman은 솔로 창업자가 아이디어를 질문, 리서치, 결정 세션으로 구체화하고 로컬 웹 UI와 Local Node/Hono service로 실행하는 local-first Founder OS입니다.

설치 스크립트는 Node LTS, Git, Corepack/pnpm을 점검하고 필요하면 설치한 뒤 repo clone, dependency install, 로컬 실행 가능 여부 확인, 브라우저 자동 실행까지 처리합니다. 같은 이름의 폴더가 이미 있거나 기본 로컬 포트가 사용 중인 경우에도 사용자 파일을 덮어쓰거나 실행 중인 프로세스를 종료하지 않고 안전한 대체 경로/포트를 자동 선택합니다.

## 설치방법

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/HearingOffice/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/HearingOffice/solo_superman/main/scripts/bootstrap-windows.ps1 | iex
```

설치 프로그램이 PATH 반영을 위해 새 터미널을 요구하면 새 터미널을 열고 같은 한 줄 명령을 다시 실행하면 이어서 진행됩니다. 네트워크, 회사 보안 정책, 관리자 권한 때문에 자동 복구가 안전하지 않은 경우에는 정책을 우회하지 않고 쉬운 오류 메시지와 재실행 명령을 보여줍니다.

## 실행방법

설치가 끝나면 로컬 서버가 계속 실행되고 기본 브라우저에 Solo Superman web 화면이 자동으로 열립니다. 이 터미널을 열어두고 사용하세요. 종료하려면 `Ctrl+C`를 누릅니다.

나중에 다시 실행하려면 아래 명령을 사용합니다.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location .\solo_superman; pnpm start:local
```

기본 로컬 설치/실행 경로에는 OpenAI API key나 ChatGPT credential이 필요하지 않습니다. 자세한 운영 번들 실행과 문제 해결은 [`docs/39-local-install-run-verification.md`](docs/39-local-install-run-verification.md)를 참고합니다.
