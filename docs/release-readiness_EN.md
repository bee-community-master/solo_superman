# General release readiness gate

Language: [한국어](release-readiness_KO.md) | English

Solo Superman is currently a technical preview. This document keeps “what is safe to verify now as a limited preview” separate from “what must be proven before claiming general release.” The default check must run without credentials, and a blocked broad-release posture passes only when the blockers are explicit release gates.

## Verification command

```sh
pnpm verify:release-readiness
```

The command validates [`release-readiness.example.json`](release-readiness.example.json) and checks that:

- `schemaVersion` is `solo-superman-release-readiness.v1`.
- `publicPosture` is one of `technical-preview`, `limited-beta`, or `general-release`.
- `broadReleaseStatus=blocked` names at least one blocked release gate.
- `broadReleaseStatus=ready` uses `publicPosture=general-release` and all required gates are `passed`.
- both credential-free and ready-release verification commands are documented, including signed package release, Windows real-device, and packaged update rollback evidence checks.
- URL evidence refs use HTTPS and do not include userinfo credentials or secret-like query parameters.
- token-shaped strings (`ghp_`, `github_pat_`, `sk-`, `npm_`, bearer tokens, and similar values) never appear in release readiness evidence.

## Release evidence checklist

When an external device/signing lab is collecting #259/#266/#267 evidence, generate the credential-free checklist first instead of manually reconciling the distributed contracts:

```sh
pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json
```

To create Markdown that can be pasted into a specific blocker issue, combine `--format markdown` and `--issue`:

```sh
pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md
```

The checklist combines blocked gates/runs, required checks, required evidence, unblock criteria, and ready-release commands from the release-readiness, Windows real-device, signed package release, packaged update rollback, and signed package preflight contracts. It reads only public contract files and does not capture credential values, browser cookies, tokens, file contents, or full environment dumps.

## General release mode

Immediately before a real general release, run the stricter mode separately:

```sh
pnpm verify:release-readiness -- --require-ready
```

The current example contract is expected to fail in this mode because broad release is not ready and these required gates are still blocked.

| Gate | Current status | Required evidence |
| --- | --- | --- |
| `signed-packages` | blocked | [#266](https://github.com/bee-community-master/solo_superman/issues/266) macOS Developer ID/notarization, Windows Authenticode signing/timestamp, and release manifest signing evidence strong enough for `pnpm verify:signed-package-release -- --require-release-evidence` |
| `packaged-update-rollback` | blocked | [#267](https://github.com/bee-community-master/solo_superman/issues/267) signed package install/update/defer/retry/rollback device evidence and launch verification strong enough for `pnpm verify:packaged-update-rollback -- --require-device-evidence` |
| `windows-real-device` | blocked | [#259](https://github.com/bee-community-master/solo_superman/issues/259) evidence from a clean Windows 11 one-line install through first-screen arrival on a real device or VM strong enough for `pnpm verify:windows-real-device -- --require-device-evidence` |

## Operating rules

- `pnpm verify` includes the default `pnpm verify:windows-real-device`, `pnpm verify:packaged-update-rollback`, `pnpm verify:packaged-update-rollback:dry-run`, `pnpm verify:signed-package-release`, and `pnpm verify:release-readiness`. PRs can pass credential-free validation while general release remains blocked, but they cannot hide or remove the broad-release blockers.
- `pnpm verify:packaged-update-rollback:dry-run` is a local safety net for fixture update/rollback boundaries; it does not replace the signed package/device evidence required by #267.
- A release PR may switch the readiness contract to broad/general release only after #266 signed package credential evidence, #267 packaged updater rollback evidence, and #259 Windows/device evidence are actually available.
- Any blocker found during Windows real-device verification should become a separate fix issue/PR instead of being buried inside #259.
- Support bundles, PR bodies, and release manifests must contain redacted evidence refs only, not secret values.
