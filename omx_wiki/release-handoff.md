# Release handoff

General release remains blocked until the external evidence issues are completed:

- #259 Windows real-device one-line installer verification
- #266 signed package release evidence
- #267 packaged updater rollback device evidence

The local repo can prepare and validate the evidence handoff bundle, but it cannot replace real signing credentials or device/VM runs.

## Bundle workflow

```sh
pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle
pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle
```

After release lab evidence is collected and every issue template is filled with redacted refs and sanitized notes:

```sh
pnpm verify:release-evidence-template -- --input ./solo-superman-release-evidence-bundle/issue-259-template.json --issue 259
pnpm verify:release-evidence-template -- --input ./solo-superman-release-evidence-bundle/issue-266-template.json --issue 266
pnpm verify:release-evidence-template -- --input ./solo-superman-release-evidence-bundle/issue-267-template.json --issue 267
pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle --require-ready
pnpm verify:ready-release -- --evidence-bundle-dir ./solo-superman-release-evidence-bundle
```

The bundle verifier fails off-manifest scratch notes, logs, or secret-bearing artifacts. If the final `verify:ready-release` gate is blocked, use the aggregate `commandBlockers` and each command entry's `blockers` array before inspecting redacted stdout. Paste generated issue comments only after the filled template and full bundle pass validation.
