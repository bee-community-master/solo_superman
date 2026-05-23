# Signed package release evidence 계약

언어: 한국어 | [English](signed-package-release_EN.md)

이 문서는 macOS Developer ID/notarization, Windows Authenticode/timestamp, release manifest signing evidence가 실제 general release 전에 준비되어야 한다는 `solo-superman-signed-package-release.v1` 계약입니다. 현재 repo/local 환경에는 signing credential과 final signed artifacts가 없으므로 실제 signing을 수행하지 않습니다. 대신 `pnpm verify:signed-package-release`가 #266에 묶인 release evidence 구조와 남은 blocker를 검증합니다.

## 계약 파일

- Release evidence contract: [`signed-package-release.example.json`](signed-package-release.example.json)와 `pnpm verify:signed-package-release`가 macOS/Windows signing 및 release manifest evidence gate를 검증합니다.
- Credential preflight: [`signed-packages_KO.md`](signed-packages_KO.md), [`signed-package-preflight.example.json`](signed-package-preflight.example.json), `pnpm verify:signed-package-preflight`가 signing credential group과 local dry-run/actual signing gate 분리를 검증합니다.
- Release readiness: [`release-readiness_KO.md`](release-readiness_KO.md)와 `pnpm verify:release-readiness`가 signed package evidence를 Windows real-device 및 packaged update rollback gate와 함께 broad release blocker로 유지합니다.

## 기본 검증

```sh
pnpm verify:signed-package-release
```

기본 모드는 credential-free contract check입니다. 현재 예시는 `releaseEvidenceStatus=blocked`이며, #266 blocker issue와 required evidence가 명시되어 있으면 통과합니다.

## 실제 release evidence 모드

```sh
pnpm verify:signed-package-release -- --require-release-evidence
```

이 모드는 실제 general release 직전 또는 signing lab evidence가 준비된 PR에서만 통과해야 합니다. 현재 예시 계약은 macOS, Windows, release manifest evidence run이 모두 `blocked`이므로 실패해야 합니다.

## 필수 evidence check

- macOS: `macos_codesign_verify`, `macos_pkgutil_verify`, `macos_notarization_status`, `macos_stapling_verify`, `macos_gatekeeper_assessment`, `artifact_checksum_recorded`
- Windows: `windows_authenticode_verify`, `windows_timestamp_verify`, `windows_installer_signature_verify`, `windows_hash_recorded`, `artifact_checksum_recorded`
- Release manifest: `release_manifest_artifact_sha256`, `release_manifest_artifact_size`, `release_manifest_artifact_signature_refs`, `release_manifest_signature_verify`

## 운영 규칙

- #266을 닫으려면 `pnpm verify:signed-package-preflight -- --require-credentials`, `pnpm verify:signed-package-release -- --require-release-evidence`, `pnpm verify:release-readiness -- --require-ready`를 통과할 수 있는 redacted release evidence가 필요합니다.
- Signing certificate, private key, Apple notarytool password, Windows certificate password, manifest private key는 local secret store나 CI secret manager 밖으로 나오면 안 됩니다.
- evidence ref는 HTTPS URL 또는 repo-relative 문서 anchor여야 하며 secret, token, cookie, credential 값을 포함하면 안 됩니다.
- Support bundle, PR body, release manifest에는 공개 certificate metadata, key id, checksum, signature, size, timestamp, redacted evidence ref만 남깁니다.
