# Auto implementation gates

The auto implementation path is intentionally evidence-heavy. A run cannot claim completion from generated code alone.

## Artifact chain

- Local workspace repo and `.solo-superman/auto-implementation-run.json` manifest
- `implementation-tracker.md`
- Stage issue markdown files under `implementation-issues/`
- Worker plan and ready `ExecutionAuthorityRecord`
- `ImplementationStepLedger` evidence for each stage
- Generated PR body with issue traceability, stage summaries, evidence summaries, missing-test audit summaries, implementation evidence, and test evidence
- PR mutation records for open/update/merge and post-merge verification evidence

## Required review gates

Every implementation stage must provide evidence for:

- feature-scope code review with no findings
- repository-scope code review with no findings
- changed-code clean-code review with no findings
- repository-scope clean-code review with no findings
- missing-test audit with zero gaps
- passing test evidence
- blocker history when a stage was previously blocked

The smoke target that proves the complete fixture path is:

```sh
pnpm verify:auto-implementation-pipeline
```

The focused review-loop target is:

```sh
pnpm verify:auto-implementation-review-loop
```

If a future implementation changes review scope names, stage names, PR body sections, or merge prerequisites, update `packages/contracts/src/projections/implementation-step-ledger.ts`, `apps/sidecar/src/product-engine/command-service.ts`, `apps/sidecar/src/product-engine/auto-implementation-workspace.ts`, tests, and this wiki together.
