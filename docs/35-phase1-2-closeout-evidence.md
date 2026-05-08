# Phase 1~2 Closeout Evidence Report

이 문서는 구현 순서 관리 이슈 #65의 closeout evidence를 repo 안에서 재검증 가능한 형태로 남긴다. #75 hardening PR은 이 문서를 기준으로 Phase 1, Phase 1.5A, Phase 1.5B, Phase 2가 기존 canonical docs 기준으로 구현·검증·회귀 방지되었는지 확인한다.

## Scope and non-goals

- Scope: #66, #67, #68, #69, #70, #71, #74, #75의 merged implementation evidence를 Phase 1~2 dry-run acceptance로 묶는다.
- Scope: `pnpm verify`, `pnpm smoke:e2e`, `node scripts/verify-doc-contracts.mjs`가 문서/DTO/route/projection/SSE/no-execution contract drift를 잡도록 유지한다.
- Non-goal: Phase 2.5 browser/delegation/comparative research 기능 검증.
- Non-goal: file patch, shell command, browser action, deploy, external mutation, credential custody, ChatGPT web automation 실행 권한 확대.

## Child issue evidence ledger

| Issue | Phase | Evidence to keep green | Remaining risk after closeout |
| --- | --- | --- | --- |
| #66 | Phase 1 canonical output | Initial Living Spec creates canonical 12 sections; ambiguity analysis creates 15 metadata-rich issues; first batch chooses priority question cards. | Packaged Tauri manual click smoke remains outside this automated closeout. |
| #67 | Phase 1 Decision Queue ops | Queue projection exposes active batch/refetch recovery; SSE emits `projection.updated` notification; missed-SSE recovery refetches canonical queue without duplicate effects. | Long-lived EventSource reconnect in a packaged app is still a manual smoke candidate. |
| #68 | Phase 1.5A lifecycle | Allowlist create/update/pause/revoke, local fake read-only provider start/status/cancel/retry, and provider polling preserve read-only lifecycle state. | Real external provider SDK and long-running daemon smoke remain future adapter work. |
| #69 | Phase 1.5A quality gate | Provider result ingest links Decision Evidence Pack, Research-updated Queue, terminal outcome, and Phase 2 Planning Handoff quality gate. | Residual-risk policy must stay visible when `research_insufficient` is non-fatal. |
| #70 | Phase 1.5B hints | `Phase15bUpgradeHints` query/export is sanitized `readiness_preview_handoff_metadata`; hints map into Phase 2 without becoming execution permission. | Future controlled execution work must not reinterpret hint metadata as approval. |
| #71 | Phase 2 strict request/storage | Planning Handoff route rejects unsupported/execution-intent keys, preserves source traces, and saves deterministic artifacts idempotently. | Any new request key must update route parser, DTO catalog, tests, and verifier together. |
| #74 | Phase 2 synthesis/UI trigger | Final Planning Handoff synthesis is source-driven; desktop trigger runs only local gate creation and surfaces final/blocker projection. | UI trigger must remain safe and non-executing until Phase 3 controlled execution exists. |
| #75 | Hardening closeout | E2E dry-run fixture covers Phase 1 -> 1.5A -> 1.5B -> 2, blocker/final Planning Handoff, doc-contract verifier, and this closeout report. | #65 body still needs final checkbox/comment update after the hardening PR merges. |

## Dry-run acceptance matrix

| Acceptance | Automated evidence | Contract guarded |
| --- | --- | --- |
| Phase 1 canonical output dry-run | `apps/sidecar/src/e2e-dry-run.test.ts` sample idea path: StartProject -> CaptureIntake -> DraftInitialSpec -> AnalyzeAmbiguity -> ActivateQuestionBatch -> SubmitAnswer -> ImportResearchResult -> ResolveDecision -> CreateSpecVersion -> completeness/founder brief. | `docs/12-validation-and-dry-run.md`, `docs/16-state-event-contract.md`, `docs/22-phase1-implementation-sequence.md`. |
| Phase 1.5A allowlist/research lifecycle dry-run | `apps/sidecar/src/e2e-dry-run.test.ts` covers the allowlisted start/status/cancel lifecycle; `apps/sidecar/src/server.test.ts` keeps pause/revoke/retry/provider polling route guardrails green. | `docs/30-phase1.5-research-runtime-and-readiness-contract.md`, `docs/26-api-route-behavior-catalog.md`, `docs/27-operations-observability-contract.md`. |
| Phase 1.5B hint/no-execution dry-run | `apps/sidecar/src/e2e-dry-run.test.ts` creates blocked runtime previews for every forbidden runtime boundary, queries/exports sanitized hints, and confirms no SpecVersion/file write side effect. | `docs/24-codex-prompt-output-contract.md`, `docs/30-phase1.5-research-runtime-and-readiness-contract.md`, `docs/31-phase2-planning-handoff-contract.md`, `docs/32-phase2-implementation-preflight-contract.md`. |
| Phase 2 final/blocker Planning Handoff dry-run | `apps/sidecar/src/e2e-dry-run.test.ts` persists a blocker projection for incomplete source traces and creates a final `PlanningHandoffArtifact` from accepted Spec, Completion Candidate or Founder Brief, Evidence Pack, and Research-updated Queue sources. | `docs/31-phase2-planning-handoff-contract.md`, `docs/32-phase2-implementation-preflight-contract.md`, `docs/33-build-slice-serve-learning-loop.md`. |
| Route/DTO/projection/SSE contract drift | `node scripts/verify-doc-contracts.mjs` compares docs/25 enums, docs/26 routes/query params, route catalog, projection kinds, SSE names, package boundaries, no-execution doc claims, and this closeout report snippets. | `packages/contracts`, `packages/core`, `apps/sidecar`, docs/24~35. |
| No-execution boundary | `pnpm verify` plus targeted E2E verifies blocked runtime preview, metadata-only Founder Brief export, Phase 1.5B hint export, and Planning Handoff no-execution policy. | Phase 1, Phase 1.5B, Phase 2, and Phase 2.5 docs all deny execution permission before controlled execution. |

## Required closeout commands

Run these before claiming #75 complete or before merging its PR:

```bash
pnpm verify
pnpm smoke:e2e
node scripts/verify-doc-contracts.mjs
git diff --check origin/main...HEAD
```

## Tracker #65 update rule

After #75 merges:

1. Close #75 if GitHub automation has not already closed it.
2. Update #65 child issue checkbox for #75 to `[x]`.
3. Mark the #65 closeout checklist items complete only when the commands above passed on the merged PR/main evidence.
4. Add a #65 comment that links the hardening PR, this document, and the verification commands.

This document is not a substitute for the GitHub tracker update; it is the repo-local source of truth that makes the tracker update auditable.
