# Signed package release evidence contract

Language: [한국어](signed-package-release_KO.md) | English

This document defines the `solo-superman-signed-package-release.v1` contract for macOS Developer ID/notarization, Windows Authenticode/timestamp, and release manifest signing evidence before a real general release. The current repo/local environment has no signing credentials or final signed artifacts, so it does not perform real signing. Instead, `pnpm verify:signed-package-release` validates the expected #266 release evidence structure and keeps the blocker explicit, while `pnpm verify:signed-package-release:dry-run` catches fixture artifact/manifest evidence shape drift without credentials.

## Contract file

- Release evidence contract: [`signed-package-release.example.json`](signed-package-release.example.json), `pnpm verify:signed-package-release`, and `pnpm verify:signed-package-release:dry-run` verify the macOS/Windows signing and release manifest evidence gates plus fixture evidence shape.
- Credential preflight: [`signed-packages_EN.md`](signed-packages_EN.md), [`signed-package-preflight.example.json`](signed-package-preflight.example.json), and `pnpm verify:signed-package-preflight` verify signing credential groups and the split between local dry-runs and actual signing gates.
- Release readiness: [`release-readiness_EN.md`](release-readiness_EN.md) plus `pnpm verify:release-readiness` keeps signed package evidence grouped with the Windows real-device and packaged update rollback broad-release blockers.

## Default verification

```sh
pnpm verify:signed-package-release
```

The default mode is a credential-free contract check. The current example uses `releaseEvidenceStatus=blocked`; it passes only when the #266 blocker issue and required evidence remain explicit.

## Credential-free release evidence dry-run

```sh
pnpm verify:signed-package-release:dry-run
```

This dry-run does not perform real signing. It verifies fixture macOS/Windows artifact checksum, size, signature ref, public certificate metadata, and release manifest signature-ref shape. It is the #293 local guard and does not replace the real #266 signing/notarization/Authenticode/manifest evidence.

## Real release evidence mode

```sh
pnpm verify:signed-package-release -- --require-release-evidence
```

This mode should pass only immediately before a real general release, or in a PR that has signing lab evidence attached. The current example contract must fail because the macOS, Windows, and release manifest evidence runs are still `blocked`.

## Required evidence checks

- macOS: `macos_codesign_verify`, `macos_pkgutil_verify`, `macos_notarization_status`, `macos_stapling_verify`, `macos_gatekeeper_assessment`, `artifact_checksum_recorded`
- Windows: `windows_authenticode_verify`, `windows_timestamp_verify`, `windows_installer_signature_verify`, `windows_hash_recorded`, `artifact_checksum_recorded`
- Release manifest: `release_manifest_artifact_sha256`, `release_manifest_artifact_size`, `release_manifest_artifact_signature_refs`, `release_manifest_signature_verify`

## Operating rules

- `pnpm verify:signed-package-release:dry-run` is only a local guard for fixture evidence shape drift; it does not replace real #266 release evidence.
- Closing #266 requires redacted release evidence strong enough for `pnpm verify:signed-package-preflight -- --require-credentials`, `pnpm verify:signed-package-release -- --require-release-evidence`, and `pnpm verify:release-readiness -- --require-ready` to pass.
- Signing certificates, private keys, Apple notarytool passwords, Windows certificate passwords, and manifest private keys must stay inside local secret stores or CI secret managers.
- Evidence refs must be HTTPS URLs or repo-relative documentation anchors, and they must not include secret, token, cookie, or credential values.
- Support bundles, PR bodies, and release manifests may contain only public certificate metadata, key ids, checksums, signatures, sizes, timestamps, and redacted evidence refs.
