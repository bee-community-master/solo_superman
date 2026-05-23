# 일반 공개 준비도 게이트

언어: 한국어 | [English](release-readiness_EN.md)

Solo Superman은 현재 technical preview입니다. 이 문서는 “지금 limited preview로 검증 가능한 것”과 “general release로 주장하려면 아직 필요한 것”을 한 곳에 고정합니다. 기본 검증은 credential-free 환경에서 실행되어야 하며, broad release가 아직 `blocked`라는 사실도 명시적 gate가 있을 때만 통과합니다.

## 검증 명령

```sh
pnpm verify:release-readiness
```

이 명령은 [`release-readiness.example.json`](release-readiness.example.json)을 검사해 다음 조건을 확인합니다.

- `schemaVersion`은 `solo-superman-release-readiness.v1`입니다.
- `publicPosture`는 `technical-preview`, `limited-beta`, `general-release` 중 하나입니다.
- `broadReleaseStatus`가 `blocked`이면 반드시 blocked release gate가 있어야 합니다.
- `broadReleaseStatus`가 `ready`이면 public posture가 `general-release`여야 하고 모든 필수 gate가 `passed`여야 합니다.
- credential-free 검증 명령과 ready-release 검증 명령이 모두 문서화되어야 하며, signed package release, Windows real-device, packaged update rollback evidence 검증도 포함해야 합니다.
- URL evidence ref는 HTTPS여야 하며 userinfo credential이나 secret-like query parameter를 포함하면 안 됩니다.
- token-shaped 문자열(`ghp_`, `github_pat_`, `sk-`, `npm_`, bearer token 등)은 release readiness evidence 어디에도 들어갈 수 없습니다.

## Release evidence checklist

외부 device/signing lab에서 #259/#266/#267 evidence를 모을 때는 분산된 계약 파일을 수동으로 대조하지 않고 아래 credential-free checklist를 먼저 생성합니다.

```sh
pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json
```

특정 blocker issue에 바로 붙일 Markdown checklist가 필요하면 `--format markdown`과 `--issue`를 함께 사용합니다.

```sh
pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md
```

Release lab operator가 실제 redacted evidence ref를 채울 JSON template은 `--format template`으로 생성합니다.

```sh
pnpm release:evidence-checklist -- --format template --issue 266 --output ./issue-266-release-evidence-template.json
```

Template은 각 required check/evidence/unblock criterion을 `pending` placeholder로 보존하지만, 실제 #259/#266/#267 evidence를 대체하지 않습니다. Release lab이 placeholder를 redacted evidence refs와 sanitized notes로 채운 뒤에는 아래 verifier로 `ready`/`passed`/secret-free 상태와 모든 ready-release command 실행 기록을 확인합니다. 입력 없이 verifier를 실행하면 #259/#266/#267 blocker issue fixture template을 모두 검증해 기본 `pnpm verify`가 특정 issue template drift만 놓치지 않도록 합니다.

```sh
pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json
```

Checklist는 `release-readiness`, Windows 실기기, signed package release, packaged update rollback, signed package preflight 계약에서 blocked gate/run, required checks, required evidence, unblock criteria, ready-release command를 묶습니다. 이 명령은 계약 파일만 읽고 credential 값, browser cookie, token, file contents, full environment dump를 수집하지 않습니다.

## 일반 공개 준비 모드

실제 일반 공개 직전에는 아래 명령을 별도로 실행합니다.

```sh
pnpm verify:release-readiness -- --require-ready
```

현재 예시 계약은 이 모드에서 실패해야 합니다. 실패 이유는 broad release가 아직 ready가 아니고, 아래 필수 gate가 blocked이기 때문입니다.

| Gate | 현재 상태 | 필요 evidence |
| --- | --- | --- |
| `signed-packages` | blocked | [#266](https://github.com/bee-community-master/solo_superman/issues/266) `pnpm verify:signed-package-release -- --require-release-evidence`가 통과할 macOS Developer ID/notarization, Windows Authenticode signing/timestamp, release manifest signing evidence |
| `packaged-update-rollback` | blocked | [#267](https://github.com/bee-community-master/solo_superman/issues/267) `pnpm verify:packaged-update-rollback -- --require-device-evidence`가 통과할 signed package install/update/defer/retry/rollback device evidence and launch verification |
| `windows-real-device` | blocked | [#259](https://github.com/bee-community-master/solo_superman/issues/259) `pnpm verify:windows-real-device -- --require-device-evidence`가 통과할 clean Windows 11 one-line install부터 first-screen arrival까지의 실기기/VM evidence |

## 운영 규칙

- `pnpm verify`는 기본 `pnpm verify:windows-real-device`, `pnpm verify:windows-installer:dry-run`, `pnpm verify:packaged-update-rollback`, `pnpm verify:packaged-update-rollback:dry-run`, `pnpm verify:signed-package-release`, `pnpm verify:signed-package-release:dry-run`, `pnpm verify:release-readiness`를 포함합니다. 따라서 PR은 general release blocker를 지우지 않은 상태로도 credential-free validation을 통과할 수 있지만, blocker가 숨겨진 broad release claim은 통과할 수 없습니다.
- `pnpm verify:windows-installer:dry-run`은 PowerShell installer path drift를 잡는 로컬 안전망이며, #259의 실제 Windows device evidence를 대체하지 않습니다.
- `pnpm verify:packaged-update-rollback:dry-run`은 fixture update/rollback boundary를 검증하는 로컬 안전망이며, #267의 signed package/device evidence를 대체하지 않습니다.
- `pnpm verify:signed-package-release:dry-run`은 fixture signed artifact/manifest evidence shape를 검증하는 로컬 안전망이며, #266의 실제 signing/notarization/Authenticode/manifest evidence를 대체하지 않습니다.
- release PR이 broad/general release로 상태를 바꾸려면 먼저 #266 signed package credential evidence, #267 packaged updater rollback evidence, #259 Windows/device evidence가 실제로 준비되어야 합니다.
- Windows 실기기 검증에서 발견되는 blocker는 #259에만 묻어두지 말고 별도 fix issue/PR로 분리합니다.
- Support bundle, PR body, release manifest에는 secret 값을 넣지 않고 redacted evidence ref만 남깁니다.
