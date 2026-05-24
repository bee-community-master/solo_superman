# Signed macOS/Windows Installer Package Plan

Language: [한국어](signed-packages_KO.md) | English

This document plans the signed package path needed after the one-line installer technical preview. The current repo/local environment does not contain Apple Developer ID, notarization account, or Windows code-signing certificate material, so it does not perform real signing. Instead, `pnpm verify:signed-package-preflight` and `pnpm verify:signed-package-release:dry-run` verify the credential-free dry-run contract, release evidence shape, and exactly why the signing gate is still blocked.

## Current state

- Current distribution: README one-line installer technical preview.
- Release channel contract: [`release-channel_EN.md`](release-channel_EN.md) plus `pnpm verify:release-channel` verify manifest/signature/checksum/retry/rollback/user-data/credential preservation.
- Packaged update rollback evidence: [`packaged-update-rollback_EN.md`](packaged-update-rollback_EN.md) plus `pnpm verify:packaged-update-rollback` verify the device rollback evidence gate.
- Signed package preflight: [`signed-package-preflight.example.json`](signed-package-preflight.example.json) plus `pnpm verify:signed-package-preflight` verify macOS/Windows signing candidates and credential gates.
- Signed package release evidence: [`signed-package-release_EN.md`](signed-package-release_EN.md), `pnpm verify:signed-package-release`, and `pnpm verify:signed-package-release:dry-run` keep macOS signing/notarization, Windows Authenticode/timestamp, release manifest signature evidence, and credential-free evidence shape tied to #266/#293.
- Actual signing/notarization: blocked until required certificates, accounts, and secrets exist.

## Packaging candidates

| Platform | Candidate package | Required signing/notarization | Available in local dry-run |
| --- | --- | --- | --- |
| macOS | `macos-dmg`, `macos-pkg` | Developer ID Application/Installer certificate, Apple notarization, stapling | `pnpm build`, `pnpm verify:prod-bundle`, release channel manifest verification, signed-package preflight contract verification, signed-package release dry-run evidence shape verification |
| Windows | `windows-msi`, `windows-exe` | Authenticode certificate, timestamp server | `pnpm build`, `pnpm verify:prod-bundle`, release channel manifest verification, signed-package preflight contract verification, signed-package release dry-run evidence shape verification |

The package format decision must account for installer UX, updater integration, rollback support, and enterprise policy compatibility. Whichever format is chosen, signed artifact checksum/signature references must flow into the release update manifest.

## Credential/secret separation

Secret values must not appear in docs, PR bodies, support bundles, release manifests, or logs. Docs and manifests may contain only key identifiers, public certificate metadata, signature refs, checksums, and redacted evidence.

| Credential group | Required env names | Used for |
| --- | --- | --- |
| `macos-developer-id` | `APPLE_DEVELOPER_ID_CERTIFICATE_P12_BASE64`, `APPLE_DEVELOPER_ID_CERTIFICATE_PASSWORD`, `APPLE_NOTARYTOOL_APPLE_ID`, `APPLE_NOTARYTOOL_TEAM_ID`, `APPLE_NOTARYTOOL_PASSWORD` | macOS DMG/PKG signing, notarization, stapling |
| `windows-authenticode` | `WINDOWS_CODESIGN_CERTIFICATE_PFX_BASE64`, `WINDOWS_CODESIGN_CERTIFICATE_PASSWORD`, `WINDOWS_CODESIGN_TIMESTAMP_URL` | Windows MSI/EXE Authenticode signing and timestamping |
| `release-manifest-signing` | `SOLO_RELEASE_MANIFEST_PRIVATE_KEY_REF`, `SOLO_RELEASE_MANIFEST_PUBLIC_KEY_ID` | Release update manifest signing after signed artifact checksum/signature refs are final |

## Verification commands

The default preflight passes without credentials and reports the actual signing blocker through `credentialGateStatus` and `missingCredentialGroups`.

```sh
pnpm verify:signed-package-preflight
```

In a real signing environment, run the credential-required gate separately. This mode must fail if required env values are missing.

```sh
pnpm verify:signed-package-preflight -- --require-credentials
```

`pnpm verify` includes the credential-free default preflight, `pnpm verify:signed-package-release`, `pnpm verify:signed-package-release:dry-run`, `pnpm verify:windows-real-device`, `pnpm verify:packaged-update-rollback`, and `pnpm verify:release-readiness`, so local contributors can catch both release planning contract drift and general-release blocker drift without signing secrets.

## Real release gate

A real signed package PR or release job must carry all of this evidence:

1. macOS artifacts pass `codesign`, `pkgutil`/`spctl`, notarization status, and stapling evidence.
2. Windows artifacts pass Authenticode signature and timestamp verification.
3. The release update manifest contains final artifact SHA-256, package size, and signature refs, then passes manifest signature verification.
4. macOS/Windows devices verify install, update deferral, retry, rollback, and launch behavior.
5. Rollback changes only packaged app binaries and release metadata; it does not touch local DBs, generated workspaces, support bundles, or credentials.
6. `pnpm verify:signed-package-release -- --require-release-evidence` verifies structured `evidenceBundle` data for macOS/Windows artifacts and the release manifest, while `pnpm verify:windows-real-device -- --require-device-evidence`, `pnpm verify:packaged-update-rollback -- --require-device-evidence`, and `pnpm verify:release-readiness -- --require-ready` confirm that signed package, packaged updater rollback, and Windows real-device gates are all passed.

`pnpm verify:signed-package-release:dry-run` verifies only fixture artifact checksum/size/signature ref/manifest evidence shape; without those gates, the project must not claim broad-release signed packages or packaged automatic updates are complete.
