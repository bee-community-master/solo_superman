# Packaged update rollback evidence contract

Language: [한국어](packaged-update-rollback_KO.md) | English

This document defines the `solo-superman-packaged-update-rollback.v1` device rollback evidence required before signed macOS/Windows package updates can become part of a real general release. The current repo/local environment does not contain signed package artifacts or device-lab evidence, so it does not apply real updates. Instead, `pnpm verify:packaged-update-rollback` validates the expected macOS/Windows device evidence structure and keeps #267 visibly blocked until that evidence exists. `pnpm verify:packaged-update-rollback:dry-run` validates update/failure/rollback/preservation boundaries with a fixture install, but it does not replace signed package or device evidence.

## Current status

- Release channel contract: [`release-channel_EN.md`](release-channel_EN.md) plus `pnpm verify:release-channel` verify the manifest/signature/checksum/retry/rollback/user-data/credential preservation contract.
- Rollback evidence contract: [`packaged-update-rollback.example.json`](packaged-update-rollback.example.json) plus `pnpm verify:packaged-update-rollback` verify macOS/Windows device-run gates and preservation evidence requirements.
- Credential-free dry-run: `pnpm verify:packaged-update-rollback:dry-run` verifies defer/retry/failed-launch rollback plus local DB/workspace/support/operator/credential-ref preservation in a temporary fixture install.
- Actual device evidence: signed package artifacts, macOS/Windows device or VM runs, and updater rollback logs remain blocked by [#267](https://github.com/bee-community-master/solo_superman/issues/267).

## Verification commands

The default contract check is credential-free and intentionally allows the current blocked posture.

```sh
pnpm verify:packaged-update-rollback
pnpm verify:packaged-update-rollback:dry-run
```

After real release/device evidence exists, run the required evidence mode. This mode must fail until both macOS and Windows device runs are `passed`.

```sh
pnpm verify:packaged-update-rollback -- --require-device-evidence
```

## Device run evidence

Each platform must leave evidence for every check below.

1. `install_signed_package`: signed package install reaches the local first screen.
2. `apply_update`: signed update manifest/artifact is applied.
3. `defer_update`: user can defer the update.
4. `retry_failed_update`: failed update can retry while preserving the existing installation.
5. `rollback_after_failed_launch`: failed launch verification after update restores the previous app binary/release metadata.
6. `launch_after_rollback`: previous version launches after rollback.
7. `preserve_user_data`: local DBs, generated workspaces, support bundles, and operator files are preserved.
8. `preserve_credentials`: Codex/OpenAI/GitHub credentials, browser cookies, local capability tokens, and environment secrets are not read or rewritten.

## Operating rules

- Closing #267 requires redacted evidence strong enough for both `pnpm verify:packaged-update-rollback -- --require-device-evidence` and `pnpm verify:release-readiness -- --require-ready` to pass.
- Rollback may change only packaged app binaries and release metadata; local user data and credentials are not rollback or cleanup targets.
- Support bundles, PR bodies, release manifests, and device logs must contain only redacted evidence refs, not secret values.
