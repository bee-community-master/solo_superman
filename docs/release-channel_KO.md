# 패키지 릴리스 업데이트 채널

언어: 한국어 | [English](release-channel_EN.md)

이 문서는 one-line installer의 git checkout 재실행 업데이트와 나중의 패키지 앱 자동 업데이트를 분리합니다. 현재 제품은 technical preview이며, 이 문서와 `pnpm verify:release-channel`은 **업데이트 채널 계약과 검증 예시**를 고정합니다. 실제 패키지 앱 updater를 켜려면 signed macOS/Windows installer package, 배포 signing credential, 그리고 `pnpm verify:packaged-update-rollback -- --require-device-evidence`가 통과하는 device rollback evidence가 먼저 준비되어야 합니다.

## 채널 구분

| 경로 | 현재 의미 | 허용되는 업데이트 방식 |
| --- | --- | --- |
| Git checkout technical preview | README의 한 줄 installer가 repository checkout을 만들고 `pnpm start:local`을 실행합니다. | 기존 설치 폴더가 clean checkout이고 현재 branch가 기본 branch이며 local 변경/미추적 파일/divergence가 없을 때만 `origin/main`으로 safe fast-forward update를 시도합니다. |
| Packaged app release | 사용자가 서명된 macOS/Windows package를 설치한 뒤 앱 binary와 release metadata를 업데이트하는 future distribution path입니다. | 서명된 manifest, artifact checksum, artifact signature, user consent/deferral, retry/rollback boundary가 모두 검증되기 전에는 적용하지 않습니다. |

Git checkout update는 개발/technical-preview 편의 기능입니다. 이 경로는 packaged app updater가 아니며, local user data, credentials, generated workspace, operator files를 정리하거나 덮어쓰는 권한을 갖지 않습니다.

## Manifest 계약

기본 예시는 [`release-update-channel.example.json`](release-update-channel.example.json)에 있습니다. Maintainer는 PR에서 아래 명령으로 manifest 계약을 검증합니다.

```sh
pnpm verify:release-channel
```

검증 스크립트는 기본적으로 다음 조건을 요구합니다.

- `schemaVersion`은 `solo-superman-release-update-manifest.v1`입니다.
- `appId`는 `solo-superman`이고, `channel`은 `preview`, `beta`, `stable` 중 하나입니다.
- `version`은 leading `v`가 없는 semver이고, `releasedAt`은 UTC ISO timestamp입니다.
- release note, manifest signature, artifact URL은 HTTPS이며 userinfo credential이나 secret-like query parameter를 포함하지 않습니다.
- manifest 자체에는 `ed25519`, `minisign`, 또는 `sigstore-bundle` signature reference가 있어야 합니다.
- 각 artifact는 target platform과 맞는 package kind, lowercase SHA-256 checksum, positive size, platform signature evidence를 가져야 합니다.
- token-shaped 문자열(`ghp_`, `github_pat_`, `sk-`, `npm_`, bearer token 등)은 manifest 어디에도 들어갈 수 없습니다.

## Update policy 안전 경계

`updatePolicy`는 모든 boolean gate를 `true`로 선언해야 하며, verifier는 하나라도 빠지거나 false이면 실패합니다.

- `requiresUserConsent`: 업데이트 적용 전에 사용자 동의가 필요합니다.
- `allowsUserDeferral`: 사용자가 업데이트를 보류할 수 있어야 합니다.
- `verifiesManifestSignature`: manifest signature 검증 없이는 채널을 신뢰하지 않습니다.
- `verifiesArtifactChecksum`: artifact checksum 검증 없이는 설치하지 않습니다.
- `verifiesArtifactSignature`: platform signature/codesign evidence 검증 없이는 설치하지 않습니다.
- `preservesUserData`: local DB, generated workspace, support bundle, operator file을 삭제하거나 재작성하지 않습니다.
- `preservesCredentials`: Codex/OpenAI/GitHub credential, browser cookie, local capability token, environment secret을 읽거나 재작성하지 않습니다.
- `supportsRetry`: 실패 후 현재 설치본을 유지한 채 재시도할 수 있어야 합니다.
- `supportsRollback`: 새 패키지 적용 후 launch verification이 실패하면 이전 앱 binary/release metadata로 돌아갈 수 있어야 합니다.

`failureMode`, `rollbackBoundary`, `credentialBoundary`는 prose로 남겨야 합니다. Rollback은 packaged app binary와 release metadata에만 영향을 줄 수 있으며, local user data와 credential은 rollback 대상도, cleanup 대상도 아닙니다.

## 패키징 의존성

이 채널 계약은 packaged updater 구현의 선행 안전장치입니다. 실제 자동 업데이트 적용은 다음이 완료되기 전까지 deferred 상태입니다.

1. macOS/Windows signed package format 결정.
2. Developer ID/notarization 또는 Windows Authenticode signing credential 운영 절차.
3. Release hosting, manifest signing key rotation, revoked-release 처리 절차.
4. [`packaged-update-rollback_KO.md`](packaged-update-rollback_KO.md)의 `pnpm verify:packaged-update-rollback -- --require-device-evidence`가 통과할 수 있는 macOS/Windows 실제 설치·업데이트·rollback device verification.
5. [`release-readiness_KO.md`](release-readiness_KO.md)의 `pnpm verify:release-readiness -- --require-ready` gate 통과.

이 조건이 충족되기 전에는 README의 one-line installer rerun safe fast-forward path만 current update path로 유지합니다.
