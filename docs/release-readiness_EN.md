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
- both credential-free and ready-release verification commands are documented, including Windows real-device, packaged update rollback, and release evidence bundle checks. Signed package release is optional hardening for direct/non-store distribution, not a required gate.
- URL evidence refs use HTTPS and do not include userinfo credentials or secret-like query parameters.
- token-shaped strings (`ghp_`, `github_pat_`, `sk-`, `npm_`, bearer tokens, and similar values) never appear in release readiness evidence.

## Release evidence checklist

When an external device lab is collecting the default #259/#267 evidence, generate the credential-free checklist first instead of manually reconciling the distributed contracts:

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

When the release lab needs the default #259/#267 work set at once, use the bundle command. It writes the full checklist/template, issue-specific Markdown checklists, issue-specific JSON templates, a manifest, and a README into one directory.

```sh
pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle
```

Use `--format template` to generate a JSON template that a release lab operator can fill with redacted evidence refs.

```sh
pnpm release:evidence-checklist -- --include-signed-package --format template --issue 266 --output ./issue-266-release-evidence-template.json
```

The template preserves each required check/evidence/unblock criterion as a `pending` placeholder and includes `evidenceBundleShape` hints for the structured fields the release lab must fill on the actual contract run, but it does not replace the real #259/#267 evidence. After the release lab fills placeholders with redacted evidence refs and sanitized notes, validate that the bundle is `ready`, `passed`, secret-free, and records pre-gate ready-release commands without the filled-bundle or aggregate self-command, plus `readyReleaseResult.status`/`commandBlockers`/`perCommandBlockers`. Running the verifier without input validates fixture templates for all #259/#267 blocker issues so default `pnpm verify` does not cover only one issue template. Full input templates without `filterIssueNumber` are checked against all five default source checklist items:

```sh
pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json
pnpm verify:release-evidence-bundle
pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle
pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready
```

`pnpm verify:release-evidence-bundle` validates the generated bundle or a release-lab bundle directory in one pass: manifest, the actual on-disk file listing, README, issue-specific templates/comments with structured evidenceBundle shape fields, ready-release commands, release evidence blocker summary, and secret-free boundaries. The generated manifest and README expose default #259/#267 blocker issue counts, blocked evidence item counts, compact evidenceBundle shape counts, and the next action through the same `releaseEvidenceBlockerSummary` contract, and `releaseLabCommandPlans` carries each issue's credential-free dry-run commands, real evidence gates, and filled-bundle/ready-release verification commands, so a release lab can open only the bundle and still see which of the two issues and five evidence items remain plus the command order to run. Use `--include-signed-package` only when signed-package hardening and #266 should be added. In `--require-ready` mode, template `readyReleaseCommandsRun` requires already-run nested verifier commands, not the bundle-ready or aggregate self-command. It fails when off-manifest scratch notes, logs, or secret-bearing artifacts are mixed into the bundle directory, so remove them before sharing evidence. Use `--require-ready` when the release lab has filled templates and every template must be `ready`/`passed`.

By default, the checklist combines blocked gates/runs, required checks, required evidence, unblock criteria, and ready-release commands from the release-readiness, Windows real-device, and packaged update rollback contracts. `--include-signed-package` explicitly adds the signed package release/preflight contracts and #266 optional hardening items. Checklist generation reads only public contract files, and bundle verification reads only the selected bundle directory to emit blockers instead of collecting file bodies as evidence. Neither command captures credential values, browser cookies, tokens, unrelated file contents, or full environment dumps.

## General release mode

Immediately before a real general release, run the stricter mode separately:

```sh
pnpm verify:release-readiness -- --require-ready
pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready
pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle
```

`pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle` runs the credential-required ready-release sequence in one place. By default it includes Windows real-device evidence, packaged updater rollback device evidence, release evidence bundle `--require-ready` verification, and the final release-readiness `--require-ready` gate. Signed-package credential preflight and signed-package release evidence are added only when `--include-signed-package` is passed. It redacts command output before printing JSON evidence, keeps stdout/stderr as bounded previews, and lifts each nested verifier `blockers`/`issues` list into per-command `blockers` plus aggregate `commandBlockers`; verbose release evidence template field-level placeholder blockers are summarized by file so release labs can see the concrete cause immediately. `--plan-only` and blocked output expose `pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle` in `releaseEvidenceBundlePreparation.command`, so operators see that a fresh bundle must exist and be filled before the final gate. The same output exposes `releaseEvidenceBlockerSummary` with the default #259/#267 blocked issue count and blocked evidence item count, and the generated release evidence bundle manifest/README now carries `releaseEvidenceIssueSummaries` with per-issue item counts, blocked item counts, item id/gate/status, and required check/evidence/unblock counts, and compact `evidenceBundle` shape kind/required field/required passed-check counts. `releaseEvidenceIssuePreparation` entries keep exact #259/#267 evidence item summaries (item id, gate, status, required check/evidence/unblock criteria), checklist/template/comment paths, template validation commands, and GitHub issue comment commands, while bundle manifest/README/checklist/comment `releaseLabCommandPlans` show each issue's dry-run/evidence/final bundle gates so release labs can immediately see which evidence belongs to each blocker issue and which verification commands to run. It is intentionally excluded from the default credential-free `pnpm verify`.

The current example contract is expected to fail in this mode because broad release is not ready and these required gates are still blocked.

| Gate | Current status | Required evidence |
| --- | --- | --- |
| `signed-packages` | optional hardening | [#266](https://github.com/bee-community-master/solo_superman/issues/266) not required for direct/non-store broad release; verify with `--include-signed-package` and `pnpm verify:signed-package-release -- --require-release-evidence` only when claiming signed artifacts |
| `packaged-update-rollback` | blocked | [#267](https://github.com/bee-community-master/solo_superman/issues/267) packaged artifact install/update/defer/retry/rollback device evidence, launch verification, and structured `evidenceBundle` strong enough for `pnpm verify:packaged-update-rollback -- --require-device-evidence` |
| `windows-real-device` | blocked | [#259](https://github.com/bee-community-master/solo_superman/issues/259) evidence plus a structured `evidenceBundle` from a clean Windows 11 one-line install through first-screen arrival on a real device or VM strong enough for `pnpm verify:windows-real-device -- --require-device-evidence` |

## Operating rules

- `pnpm verify` includes the default `pnpm verify:windows-real-device`, `pnpm verify:windows-installer:dry-run`, `pnpm verify:packaged-update-rollback`, `pnpm verify:packaged-update-rollback:dry-run`, `pnpm verify:signed-package-release`, `pnpm verify:signed-package-release:dry-run`, and `pnpm verify:release-readiness`. PRs can pass credential-free validation while general release remains blocked, but they cannot hide or remove the broad-release blockers.
- `pnpm verify:windows-installer:dry-run` is a local safety net for PowerShell installer-path drift; it does not replace the real Windows device evidence required by #259.
- `pnpm verify:packaged-update-rollback:dry-run` is a local safety net for fixture update/rollback boundaries; it does not replace the packaged artifact/device evidence required by #267.
- `pnpm verify:signed-package-release:dry-run` is a local guard for fixture signed artifact/manifest evidence shape; it does not replace the real #266 signing/notarization/Authenticode/manifest evidence.
- A release PR may switch the readiness contract to broad/general release after #267 packaged updater rollback evidence and #259 Windows/device evidence are actually available. #266 signed package credential evidence is required only when signed artifacts or signing hardening are part of the release claim.
- Any blocker found during Windows real-device verification should become a separate fix issue/PR instead of being buried inside #259.
- Support bundles, PR bodies, and release manifests must contain redacted evidence refs only, not secret values.
