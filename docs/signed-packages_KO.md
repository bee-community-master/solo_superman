# 서명된 macOS/Windows 설치 패키지 계획

언어: 한국어 | [English](signed-packages_EN.md)

이 문서는 one-line installer 이후의 broad release를 위한 signed package 계획입니다. 현재 repo/local 환경에는 Apple Developer ID, notarization 계정, Windows code-signing certificate가 없으므로 실제 signing은 수행하지 않습니다. 대신 `pnpm verify:signed-package-preflight`로 credential-free dry-run 계약과 missing credential 이유를 명확히 검증합니다.

## 현재 상태

- Current distribution: README의 one-line installer technical preview.
- Release channel contract: [`release-channel_KO.md`](release-channel_KO.md)와 `pnpm verify:release-channel`이 manifest/signature/checksum/retry/rollback/user-data/credential preservation을 검증합니다.
- Packaged update rollback evidence: [`packaged-update-rollback_KO.md`](packaged-update-rollback_KO.md)와 `pnpm verify:packaged-update-rollback`이 device rollback evidence gate를 검증합니다.
- Signed package preflight: [`signed-package-preflight.example.json`](signed-package-preflight.example.json)와 `pnpm verify:signed-package-preflight`가 macOS/Windows signing 후보와 credential gate를 검증합니다.
- Actual signing/notarization: 필요한 certificate/account/secret이 준비될 때까지 blocked입니다.

## 패키징 후보

| Platform | 후보 package | 필요한 signing/notarization | 로컬 dry-run에서 가능한 것 |
| --- | --- | --- | --- |
| macOS | `macos-dmg`, `macos-pkg` | Developer ID Application/Installer certificate, Apple notarization, stapling | `pnpm build`, `pnpm verify:prod-bundle`, release channel manifest 검증, signed-package preflight contract 검증 |
| Windows | `windows-msi`, `windows-exe` | Authenticode certificate, timestamp server | `pnpm build`, `pnpm verify:prod-bundle`, release channel manifest 검증, signed-package preflight contract 검증 |

Package format 결정은 installer UX, updater integration, rollback support, enterprise policy compatibility를 함께 고려해야 합니다. 어떤 형식을 선택하든 signed artifact의 checksum/signature reference는 release update manifest에 들어가야 합니다.

## Credential/secret 분리

필요한 secret은 문서, PR body, support bundle, release manifest, 로그에 값을 노출하지 않습니다. 문서와 manifest에는 key identifier, public certificate metadata, signature ref, checksum, redacted evidence만 남깁니다.

| Credential group | Required env names | 사용처 |
| --- | --- | --- |
| `macos-developer-id` | `APPLE_DEVELOPER_ID_CERTIFICATE_P12_BASE64`, `APPLE_DEVELOPER_ID_CERTIFICATE_PASSWORD`, `APPLE_NOTARYTOOL_APPLE_ID`, `APPLE_NOTARYTOOL_TEAM_ID`, `APPLE_NOTARYTOOL_PASSWORD` | macOS DMG/PKG signing, notarization, stapling |
| `windows-authenticode` | `WINDOWS_CODESIGN_CERTIFICATE_PFX_BASE64`, `WINDOWS_CODESIGN_CERTIFICATE_PASSWORD`, `WINDOWS_CODESIGN_TIMESTAMP_URL` | Windows MSI/EXE Authenticode signing and timestamping |
| `release-manifest-signing` | `SOLO_RELEASE_MANIFEST_PRIVATE_KEY_REF`, `SOLO_RELEASE_MANIFEST_PUBLIC_KEY_ID` | signed artifact checksum/signature ref가 확정된 뒤 release update manifest signing |

## 검증 명령

기본 preflight는 credential이 없어도 통과하며, 결과 JSON의 `credentialGateStatus`와 `missingCredentialGroups`로 실제 signing이 왜 blocked인지 보여줍니다.

```sh
pnpm verify:signed-package-preflight
```

실제 signing 환경에서는 credential을 요구하는 gate를 별도로 실행합니다. 이 모드는 필요한 env가 빠지면 실패해야 합니다.

```sh
pnpm verify:signed-package-preflight -- --require-credentials
```

`pnpm verify`는 credential-free default preflight, `pnpm verify:windows-real-device`, `pnpm verify:packaged-update-rollback`, `pnpm verify:release-readiness`를 포함하므로 local 개발자는 signing secret 없이도 release planning contract drift와 general release blocker drift를 잡을 수 있습니다.

## 실제 release gate

실제 signed package PR 또는 release job은 아래 evidence가 모두 있어야 합니다.

1. macOS artifact가 `codesign`, `pkgutil`/`spctl`, notarization status, stapling evidence를 통과합니다.
2. Windows artifact가 Authenticode signature와 timestamp verification을 통과합니다.
3. Release update manifest가 artifact SHA-256, package size, signature ref를 최종값으로 담고 manifest signature를 통과합니다.
4. macOS/Windows device에서 install, update defer, retry, rollback, launch verification을 수행합니다.
5. Rollback은 packaged app binary와 release metadata만 바꾸며 local DB, generated workspace, support bundle, credential을 건드리지 않습니다.
6. `pnpm verify:windows-real-device -- --require-device-evidence`, `pnpm verify:packaged-update-rollback -- --require-device-evidence`, `pnpm verify:release-readiness -- --require-ready`가 signed package, packaged updater rollback, Windows 실기기 gate를 모두 passed로 확인합니다.

위 gate가 없으면 넓은 공개용 signed package나 packaged automatic update를 완료로 주장하지 않습니다.
