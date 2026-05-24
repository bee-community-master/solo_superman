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

To generate only the GitHub issue comment body, combine `--format comment` and `--issue`. This format only accepts blocker issue numbers with evidence items, so a mistyped issue fails before an empty comment is written:

```sh
pnpm release:evidence-checklist -- --format comment --issue 267 --output ./issue-267-release-evidence-comment.md
```

When the release lab needs the full #259/#266/#267 work set at once, use the bundle command. It writes the full checklist/template, issue-specific Markdown checklists, issue-specific JSON templates, a manifest, and a README into one directory.

```sh
pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle
```

Use `--format template` to generate a JSON template that a release lab operator can fill with redacted evidence refs.

```sh
pnpm release:evidence-checklist -- --format template --issue 266 --output ./issue-266-release-evidence-template.json
```

The template preserves each required check/evidence/unblock criterion as a `pending` placeholder, but it does not replace the real #259/#266/#267 evidence. After the release lab fills placeholders with redacted evidence refs and sanitized notes, validate that the bundle is `ready`, `passed`, secret-free, and records every ready-release command. Running the verifier without input validates fixture templates for all #259/#266/#267 blocker issues so default `pnpm verify` does not cover only one issue template. Full input templates without `filterIssueNumber` are checked against all nine source checklist items:

```sh
pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json
```

The checklist combines blocked gates/runs, required checks, required evidence, unblock criteria, and ready-release commands from the release-readiness, Windows real-device, signed package release, packaged update rollback, and signed package preflight contracts. It reads only public contract files and does not capture credential values, browser cookies, tokens, file contents, or full environment dumps.

## General release mode

Immediately before a real general release, run the stricter mode separately:

```sh
pnpm verify:release-readiness -- --require-ready
pnpm verify:ready-release
```

`pnpm verify:ready-release` runs the credential-required ready-release sequence in one place: signed-package credential preflight, signed-package release evidence, Windows real-device evidence, packaged updater rollback device evidence, and the final release-readiness `--require-ready` gate. It redacts command output before printing JSON evidence, and it is intentionally excluded from the default credential-free `pnpm verify`.

The current example contract is expected to fail in this mode because broad release is not ready and these required gates are still blocked.

| Gate | Current status | Required evidence |
| --- | --- | --- |
| `signed-packages` | blocked | [#266](https://github.com/bee-community-master/solo_superman/issues/266) macOS Developer ID/notarization, Windows Authenticode signing/timestamp, and release manifest signing evidence strong enough for `pnpm verify:signed-package-release -- --require-release-evidence` |
| `packaged-update-rollback` | blocked | [#267](https://github.com/bee-community-master/solo_superman/issues/267) signed package install/update/defer/retry/rollback device evidence, launch verification, and structured `evidenceBundle` strong enough for `pnpm verify:packaged-update-rollback -- --require-device-evidence` |
| `windows-real-device` | blocked | [#259](https://github.com/bee-community-master/solo_superman/issues/259) evidence plus a structured `evidenceBundle` from a clean Windows 11 one-line install through first-screen arrival on a real device or VM strong enough for `pnpm verify:windows-real-device -- --require-device-evidence` |

## Operating rules

- `pnpm verify` includes the default `pnpm verify:windows-real-device`, `pnpm verify:windows-installer:dry-run`, `pnpm verify:packaged-update-rollback`, `pnpm verify:packaged-update-rollback:dry-run`, `pnpm verify:signed-package-release`, `pnpm verify:signed-package-release:dry-run`, and `pnpm verify:release-readiness`. PRs can pass credential-free validation while general release remains blocked, but they cannot hide or remove the broad-release blockers.
- `pnpm verify:windows-installer:dry-run` is a local safety net for PowerShell installer-path drift; it does not replace the real Windows device evidence required by #259.
- `pnpm verify:packaged-update-rollback:dry-run` is a local safety net for fixture update/rollback boundaries; it does not replace the signed package/device evidence required by #267.
- `pnpm verify:signed-package-release:dry-run` is a local guard for fixture signed artifact/manifest evidence shape; it does not replace the real #266 signing/notarization/Authenticode/manifest evidence.
- A release PR may switch the readiness contract to broad/general release only after #266 signed package credential evidence, #267 packaged updater rollback evidence, and #259 Windows/device evidence are actually available.
- Any blocker found during Windows real-device verification should become a separate fix issue/PR instead of being buried inside #259.
- Support bundles, PR bodies, and release manifests must contain redacted evidence refs only, not secret values.
