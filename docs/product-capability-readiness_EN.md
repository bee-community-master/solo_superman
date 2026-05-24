# Product capability readiness contract

Language: [한국어](product-capability-readiness_KO.md) | English

This document defines the `solo-superman-product-capability-readiness.v1` contract for checking whether the technical-preview **core product loop** is code-backed. Broad/general release readiness is handled separately by [`release-readiness_EN.md`](release-readiness_EN.md); this contract does not require signing credentials, Windows device labs, or packaged updater evidence.

## Why this exists

Solo Superman's core goal is to move a rough idea into questions, research, readiness judgment, and a staged implementation PR loop. When the evidence is scattered across many smokes and docs, future implementers have to guess what is already implemented and which verifier proves it. This contract keeps the local verifier commands and source refs for each core product capability in one place.

## Verification commands

```sh
pnpm verify:product-capability-readiness
pnpm verify:product-capability-readiness -- --require-code-backed
```

Default mode validates [`product-capability-readiness.example.json`](product-capability-readiness.example.json): schema, required capability ids, required verification commands, evidence refs, and secret-free strings. `--require-code-backed` passes only when every technical-preview core capability is `code_backed`. The current example contract is fully `code_backed`; broad release blockers stay in the separate release-readiness contract.

## Required capabilities

| capability id | Required core evidence |
| --- | --- |
| `idea-clarification-loop` | `pnpm verify:clarification-pipeline`, `pnpm verify:clarification-volume` |
| `research-evidence-loop` | `pnpm verify:research-pipeline` |
| `planning-readiness-gates` | clarification/research evidence connected to the Planning-ready gate |
| `browser-service-boundary` | `pnpm verify:browser-delegation-pipeline`, `pnpm verify:service-page-pipeline`, `pnpm verify:production-mutation-contract` |
| `auto-implementation-review-loop` | runtime preview, worker job, PR mutation body summaries, review-loop, and aggregate pipeline smokes |
| `technical-preview-release-guardrails` | `pnpm verify:prod-bundle`, `pnpm verify:release-readiness` |
| `local-error-reporting` | `pnpm verify:support-bundle` validates the credential-free support diagnostics bundle, redaction, and compact product/release diagnostics |

## Contract rules

- `coreProductStatus=code_backed` cannot include blocked capabilities.
- Blocked capabilities must include `blocker` and a GitHub `blockerIssue`.
- URL evidence refs must use HTTPS and cannot contain userinfo credentials or secret-like query parameters.
- Token/secret/password/API-key-shaped values must not appear in any string.
- The default verification suite must include `pnpm verify:support-bundle`, `pnpm verify:product-capability-readiness`, and `pnpm verify`.

## Boundary with broad release

Passing this contract does not claim signed macOS/Windows packages, packaged updater rollback, or Windows real-device verification are ready. Broad/general release is governed by [`release-readiness_EN.md`](release-readiness_EN.md), [`release-readiness.example.json`](release-readiness.example.json), and `pnpm verify:release-readiness -- --require-ready`.
