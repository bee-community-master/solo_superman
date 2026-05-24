# Product capability flow

Solo Superman turns a vague idea into implementation-ready software through a local-first loop:

1. **Idea intake** creates a local project/session and initial Living Product Spec.
2. **Clarification loop** generates active question batches, accepts answers, creates follow-up debt, and supports long bounded sessions with hundreds of answers.
3. **Research evidence loop** plans background/public research, proves mounted `web_search_readonly` provider polling, imports source-traced evidence, and keeps insufficient quality gate results visible as follow-up question debt.
4. **Planning readiness gates** combine completeness, confidence, founder brief, and Planning Handoff blockers before execution.
5. **Browser/service boundary** allows approved loopback or public-read browser/service actions while final-submit and credential-bearing actions stay blocked without explicit contracts.
6. **Auto implementation loop** bootstraps local workspace artifacts, issue docs, tracker state, worker plans, review evidence, missing-test audits, PR mutation records, and merge evidence.
7. **Release guardrails** keep technical-preview and general-release readiness separate until #259, #266, and #267 evidence exists.
8. **Local error reporting** produces credential-free support diagnostics without dumping secrets, cookies, raw file contents, or full environment data.

The executable readiness contract for these capability ids is `docs/product-capability-readiness.example.json`, verified by:

```sh
pnpm verify:product-capability-readiness
pnpm verify:product-capability-readiness -- --require-code-backed
```

The current code-backed evidence is maintained by the smoke suite in `package.json` and by source files referenced from the readiness contract. If a capability changes, update the contract, source evidence refs, docs, tests, and this wiki together.
