# Verification map

Use this matrix to choose the smallest proof that matches the product claim.

| Claim | Primary command | Broader gate |
| --- | --- | --- |
| Docs/contracts stay synchronized | `pnpm verify:docs` | `pnpm verify` |
| Core product capabilities are code-backed | `pnpm verify:product-capability-readiness` | `pnpm verify` |
| Idea -> questions -> research follow-up -> auto implementation evidence stays connected | `pnpm verify:core-product-loop` | `pnpm verify` |
| Idea -> clarification -> first answer -> planning blocker works | `pnpm verify:clarification-pipeline` | `pnpm verify` |
| Hundreds of question/answer loops remain bounded | `pnpm verify:clarification-volume` | `pnpm verify` |
| Research mounted provider polling/import/synthesis stays connected | `pnpm verify:research-pipeline` | `pnpm verify` |
| Real public-web research import uses non-fixture source URLs when network allows it | `pnpm verify:research-pipeline:live-web` | opt-in; not part of default `pnpm verify` |
| Browser delegation safety/revoke path works | `pnpm verify:browser-delegation-pipeline` | `pnpm verify` |
| Service page permission/final-submit boundary works | `pnpm verify:service-page-pipeline` | `pnpm verify` |
| Production mutation stays gated | `pnpm verify:production-mutation-contract` | `pnpm verify` |
| Auto implementation preview/worker/PR/review loop works | `pnpm verify:auto-implementation-pipeline` | `pnpm verify` |
| Production bundle can run locally | `pnpm verify:prod-bundle` | `pnpm build && pnpm smoke:e2e` |
| Release evidence bundle is complete and secret-free | `pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir>` | `pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>` |
| General release is ready | `pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>` | requires #259, #266, #267 evidence |

For PR closeout in this repo, prefer the broad validation bundle:

```sh
pnpm verify
pnpm build
pnpm smoke:e2e
pnpm audit --audit-level high
git diff --check
```

Use narrower commands first while implementing, then run the broad bundle before PR body refresh and merge.
