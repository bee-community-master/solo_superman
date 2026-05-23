# Windows 실기기 설치 evidence 계약

언어: 한국어 | [English](windows-real-device_EN.md)

이 문서는 깨끗한 Windows 11 기기/VM에서 README의 한 줄 PowerShell 설치 명령이 로컬 첫 화면까지 도달해야 한다는 `solo-superman-windows-real-device.v1` evidence 계약입니다. 현재 repo/local 환경은 macOS이므로 실제 Windows 설치를 수행하지 않습니다. 대신 `pnpm verify:windows-real-device`가 #259에 묶인 Windows device evidence 구조와 남은 blocker를 검증합니다.

## 계약 파일

- Windows evidence contract: [`windows-real-device.example.json`](windows-real-device.example.json)와 `pnpm verify:windows-real-device`가 one-line installer부터 first-screen arrival까지의 device evidence gate를 검증합니다.
- Release readiness: [`release-readiness_KO.md`](release-readiness_KO.md)와 `pnpm verify:release-readiness`가 Windows evidence를 signed package, packaged update rollback gate와 함께 broad release blocker로 유지합니다.

## 기본 검증

```sh
pnpm verify:windows-real-device
```

기본 모드는 credential-free contract check입니다. 현재 예시는 `windowsVerificationStatus=blocked`이며, #259 blocker issue와 required evidence가 명시되어 있으면 통과합니다.

## 실제 device evidence 모드

```sh
pnpm verify:windows-real-device -- --require-device-evidence
```

이 모드는 실제 general release 직전 또는 Windows lab evidence가 준비된 PR에서만 통과해야 합니다. 현재 예시 계약은 Windows device run이 `blocked`이므로 실패해야 합니다.

## 필수 Windows check

`deviceRuns[].requiredChecks`에는 아래 값이 모두 있어야 합니다.

- `run_administrator_powershell_one_line_installer`
- `handle_uac_elevation`
- `install_or_reuse_node_git_corepack_pnpm`
- `install_or_verify_wsl_ubuntu`
- `install_or_reuse_codex_cli_in_wsl`
- `verify_visual_cpp_runtime`
- `create_desktop_shortcut`
- `reach_first_screen`
- `rerun_installer_safe_update`
- `generate_support_bundle`
- `collect_bootstrap_and_prod_smoke_logs`

## 운영 규칙

- #259를 닫으려면 `pnpm verify:windows-real-device -- --require-device-evidence`와 `pnpm verify:release-readiness -- --require-ready`를 통과할 수 있는 redacted Windows evidence가 필요합니다.
- Windows 검증 중 새 blocker가 나오면 #259에 묻어두지 않고 별도 fix issue/PR로 분리합니다.
- evidence ref는 HTTPS URL 또는 repo-relative 문서 anchor여야 하며 secret, token, cookie, credential 값을 포함하면 안 됩니다.
- Support bundle은 summary와 allowlisted environment만 첨부하고 파일 내용, 브라우저 세션, OpenAI/GitHub token, ChatGPT credential은 첨부하지 않습니다.
