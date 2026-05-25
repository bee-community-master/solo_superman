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
| `idea-clarification-loop` | `pnpm verify:clarification-pipeline`, `pnpm verify:clarification-volume`; the product capability contract also fixes clarification answer-form variety for open-question subjective/narrative text, binary stance, one-of-many single choice, and one-or-more multi-select answers, prompt-artifact generated JSON initial questions, deterministic fallback ambiguity dimensions plus fact-checking/current research/human judgment routing, at least one pressure question, source-seeking research task coverage, answer-triggered researchQuestion carry-through, and non-blocking answer submission so background research starts/queue refill continue after the answer is persisted instead of pausing the user |
| `research-evidence-loop` | `pnpm verify:research-pipeline` validates mounted `web_search_readonly` provider polling, source-traced result import, evidence matrices/packs, follow-up question debt, generated follow-up research runs, and markdown memory persistence/reuse; opt-in `pnpm verify:research-pipeline:live-web` validates the real public-web import path with non-fixture source URLs when public web access is available. The product capability contract also fixes sourceQueueItemId-linked planned research tasks plus queued `research_evidence_effect` wait work after evidence synthesis, research follow-up open_text narrative, binary_choice pro/con decisions, single_choice one-of-many, multi_select one-or-more, ranked_choice, and evidence_judgment answer-form variety plus the Research tab `Max simultaneous research runs`/`Max research runs per session` limit controls as required behavior |
| `planning-readiness-gates` | clarification/research evidence connected to the Planning-ready gate, plus `Composite score is 85 or higher`, `Most confidence axes are 75 or higher`, and `Core ambiguity dimensions are 75 or higher` so implementation-ready status requires most readiness metrics plus goal, scope/non-goal, success criteria, and decision-authority floors to be concrete; `pnpm verify:readiness-to-implementation` also verifies the positive readiness handoff into Planning Handoff and the first auto-implementation run |
| `browser-service-boundary` | `pnpm verify:browser-delegation-pipeline`, `pnpm verify:service-page-pipeline`, `pnpm verify:production-mutation-contract`; verifies visible ChatGPT handoff and result import gates alongside disclosure, approval, revoke, and evidence refs |
| `auto-implementation-review-loop` | runtime preview, opt-in `pnpm verify:codex-live-runtime` readiness evidence, opt-in `pnpm verify:worker-job:live` worker evidence, first-class Planning-derived PR-sized issue docs in `issueManagement.planningIssueDocs`, a separate PR issue sequence tracker, tracker/UI before stage delivery issues, selected `planningIssueId` runs with completed/active/planned slice status, worker jobs, PR mutation body summaries, temporary body-file handoff for approved `gh` PR create/edit mutations, two consecutive no-finding feature/repository code-review and changed-code/repository clean-code gates, zero-gap missing-test audit, final PR body refresh with full verification commands before `merge_main`, aggregate pipeline smokes, the `pnpm verify:single-session-product-loop` same-session pet-lifecycle idea → domain-fit question → answer-linked research → follow-up question → Planning Handoff → initial_pr smoke, the opt-in `pnpm verify:single-session-product-loop:live-web` smoke for the same path with non-fixture public-web source URLs, the `pnpm verify:readiness-to-implementation` spec_ready → planning_ready → initial_pr smoke, and the `pnpm verify:core-product-loop` end-to-end core product loop smoke |
| `technical-preview-release-guardrails` | `pnpm verify:prod-bundle`, `pnpm verify:release-readiness` |
| `local-error-reporting` | `pnpm verify:support-bundle` validates the credential-free support diagnostics bundle, redaction, compact product/release diagnostics, ready-release plan-only summary, bundle preparation command, planned command list, release evidence blocker summary counts, and issue-specific handoff evidence item entries |

## Contract rules

- `coreProductStatus=code_backed` cannot include blocked capabilities.
- Blocked capabilities must include `blocker` and a GitHub `blockerIssue`.
- URL evidence refs must use HTTPS and cannot contain userinfo credentials or secret-like query parameters.
- Token/secret/password/API-key-shaped values must not appear in any string.
- The default verification suite must include `pnpm verify:single-session-product-loop`, `pnpm verify:readiness-to-implementation`, `pnpm verify:core-product-loop`, `pnpm verify:support-bundle`, `pnpm verify:product-capability-readiness`, and `pnpm verify`; supporting commands must include `pnpm verify:codex-live-runtime`, `pnpm verify:worker-job:live`, and `pnpm verify:single-session-product-loop:live-web` without forcing live execution into the default suite, plus the safe `pnpm verify:ready-release -- --plan-only` and `pnpm support:bundle`.

## Boundary with broad release

Passing this contract does not claim packaged updater rollback, Windows real-device verification, or optional signed-package hardening are ready. Broad/general release is governed by [`release-readiness_EN.md`](release-readiness_EN.md), [`release-readiness.example.json`](release-readiness.example.json), and `pnpm verify:release-readiness -- --require-ready`.
