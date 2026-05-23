# Packaged Release Update Channel

Language: [한국어](release-channel_KO.md) | English

This document separates the one-line installer's git-checkout rerun update path from a later packaged-app automatic update path. The product is still a technical preview; this document and `pnpm verify:release-channel` lock the **update channel contract and verification example**. A real packaged updater must wait until signed macOS/Windows installer packages, release signing credentials, and device rollback evidence that passes `pnpm verify:packaged-update-rollback -- --require-device-evidence` exist.

## Channel split

| Path | Current meaning | Allowed update behavior |
| --- | --- | --- |
| Git checkout technical preview | The README one-line installer creates a repository checkout and runs `pnpm start:local`. | It may attempt a safe fast-forward update to `origin/main` only when the existing install folder is a clean checkout on the default branch with no local changes, untracked files, or divergence. |
| Packaged app release | Future distribution path where a signed macOS/Windows package updates app binaries and release metadata. | It must not apply until the signed manifest, artifact checksum, artifact signature, user consent/deferral, retry, and rollback boundaries all verify. |

The git-checkout update is a development/technical-preview convenience. It is not a packaged app updater, and it has no authority to clean up or overwrite local user data, credentials, generated workspaces, or operator files.

## Manifest contract

The default example lives in [`release-update-channel.example.json`](release-update-channel.example.json). Maintainers verify the manifest contract in PRs with:

```sh
pnpm verify:release-channel
```

The verifier requires these conditions by default:

- `schemaVersion` is `solo-superman-release-update-manifest.v1`.
- `appId` is `solo-superman`, and `channel` is one of `preview`, `beta`, or `stable`.
- `version` is semver without a leading `v`, and `releasedAt` is a UTC ISO timestamp.
- Release notes, manifest signature, and artifact URLs are HTTPS and contain no userinfo credentials or secret-like query parameters.
- The manifest itself has an `ed25519`, `minisign`, or `sigstore-bundle` signature reference.
- Each artifact has a package kind compatible with its target platform, a lowercase SHA-256 checksum, a positive size, and platform signature evidence.
- Token-shaped strings such as `ghp_`, `github_pat_`, `sk-`, `npm_`, or bearer tokens are forbidden anywhere in the manifest.

## Update policy safety boundary

`updatePolicy` must declare every boolean gate as `true`; the verifier fails if any gate is missing or false.

- `requiresUserConsent`: the user must consent before an update is applied.
- `allowsUserDeferral`: the user must be able to defer the update.
- `verifiesManifestSignature`: the channel is not trusted without manifest signature verification.
- `verifiesArtifactChecksum`: artifacts are not installed without checksum verification.
- `verifiesArtifactSignature`: artifacts are not installed without platform signature/codesign evidence.
- `preservesUserData`: local DBs, generated workspaces, support bundles, and operator files are not deleted or rewritten.
- `preservesCredentials`: Codex/OpenAI/GitHub credentials, browser cookies, local capability tokens, and environment secrets are not read or rewritten.
- `supportsRetry`: after failure, the currently installed app remains active and the user can retry.
- `supportsRollback`: if launch verification fails after applying a new package, the app can return to the previous binaries/release metadata.

`failureMode`, `rollbackBoundary`, and `credentialBoundary` must also be written in prose. Rollback may affect only packaged app binaries and release metadata; local user data and credentials are not rollback targets or cleanup targets.

## Packaging dependency

This channel contract is a prerequisite safety guard for a future packaged updater implementation. Applying real automatic updates remains deferred until the following exist:

1. macOS/Windows signed package format decisions.
2. Developer ID/notarization or Windows Authenticode signing credential operations.
3. Release hosting, manifest signing key rotation, and revoked-release handling.
4. macOS/Windows real install, update, and rollback device verification strong enough for `pnpm verify:packaged-update-rollback -- --require-device-evidence` from [`packaged-update-rollback_EN.md`](packaged-update-rollback_EN.md).
5. Passing the `pnpm verify:release-readiness -- --require-ready` gate from [`release-readiness_EN.md`](release-readiness_EN.md).

Until those conditions are met, the README one-line installer rerun safe fast-forward path remains the only current update path.
