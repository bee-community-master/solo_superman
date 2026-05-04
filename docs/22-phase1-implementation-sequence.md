# 22. Phase 1 Implementation Sequence

## 목적

이 문서는 Codex가 Phase 1 구현을 여러 PR로 수행할 때 어떤 순서로, 어떤 acceptance criteria로, 어떤 검증 명령으로 진행해야 하는지 고정한다.

목표는 “구현 중 의사결정”을 줄이고, PR마다 작은 폐루프를 닫는 것이다.

## ProductEngine runtime policy block

```text
ProductEngine runtime policy:
- ProductEngine core uses pure reducer + effect plan.
- Reducer never calls DB, Hono, Codex, filesystem, shell, browser, or network.
- Reducer input is ProductEngineCommand plus ProductEngineStateSnapshot.
- Reducer output is ProductEngineReduction containing events, nextState, effectPlan, deterministicOutputs, and optional immediateProjection.
- Effect execution uses persisted async effect queue by default.
- In-memory-only effect queue is forbidden.
- active batch projection exception allows immediate active-batch-safe queue projection in the command response.
- First-class effect types are queue_projection_effect, research_evidence_effect, and codex_runtime_preview_effect.
- scoring_effect and spec_export_effect are not Phase 1 first-class async effects.
- Completeness/Scoring, SpecVersion, and Founder Brief draft are reducer_deterministic_output values persisted in the repository transaction.
- Retry policy is conservative_ai_retry_matrix.
```

## 구현 원칙

- 한 PR은 하나의 architectural slice만 소유한다.
- PR은 이전 PR의 public contract를 깨지 않는다.
- 각 PR은 docs contract와 검증 명령을 함께 갱신한다.
- 실제 file patch, shell execution, browser automation by Codex product feature는 Phase 1 app feature가 아니다.
- 개발자가 실행하는 test/build command는 검증을 위한 것이다.
- Remote sync, ChatGPT web automation, mobile app, billing은 Phase 1 구현 PR에 포함하지 않는다.

## PR sequence overview

```text
PR-01 Workspace scaffold
  -> PR-02 Sidecar health shell
  -> PR-03 libSQL storage foundation
  -> PR-04 ProductEngine reducer
  -> PR-05 Decision Queue UI shell
  -> PR-06 Research/Evidence loop
  -> PR-07 Codex preview adapter
  -> PR-08 Completeness and Founder Brief
  -> PR-09 End-to-end dry-run hardening
```

PR numbering here is implementation sequence numbering, not GitHub PR number.

## PR-01. Workspace scaffold

Goal:

- Create pnpm workspace and Tauri/React/Hono package skeleton without product logic.

Owns:

- root package/workspace config.
- `packages/contracts` family-folder scaffold matching `25-contracts-dto-catalog.md`, with placeholder exports for ProductEngineCommand, ProductEngineReduction, EffectTask, API DTO, SSE DTO, and UI Projection types without behavior.
- route placeholder names and client stubs follow `26-api-route-behavior-catalog.md` endpoint behavior without implementing real handlers beyond skeletons.
- `apps/desktop` skeleton.
- `apps/sidecar` skeleton.
- `packages/contracts`, `packages/core`, `packages/db` skeleton.

Acceptance criteria:

- `pnpm install` succeeds.
- `pnpm typecheck` runs with empty/skeleton packages.
- `pnpm dev:sidecar` can start placeholder Hono app.
- `pnpm dev:desktop` can start Tauri/Vite shell or documented minimal dev shell.
- No ProductEngine behavior implemented yet.

Verification:

```text
pnpm install
pnpm typecheck
pnpm dev:sidecar
```

Forbidden:

- DB schema.
- Codex integration.
- full UI implementation.

## PR-02. Sidecar health shell

Goal:

- Implement sidecar lifecycle contract and Tauri/native boundary shell.

Owns:

- `/healthz`.
- `/readyz`.
- `GET /api/v1/commands/:commandId/status` placeholder shape from `26-api-route-behavior-catalog.md`.
- loopback host/port config.
- local capability token middleware.
- Tauri sidecar launch/readiness discovery contract.
- app data dir and secret ref command stubs.

Acceptance criteria:

- Sidecar rejects non-health API requests without local token.
- `/healthz` returns alive before DB initialization.
- `/readyz` reports not ready until DB layer is initialized.
- Tauri can discover sidecar base URL in dev or mocked packaged mode.
- No ProductEngine behavior implemented yet.

Verification:

```text
pnpm typecheck
pnpm test -- --run sidecar
pnpm dev:sidecar
curl http://127.0.0.1:43110/healthz
```

Forbidden:

- persistent ProductEngine state.
- remote DB behavior.
- arbitrary shell command exposure.

## PR-03. libSQL storage foundation

Goal:

- Implement local embedded libSQL, Drizzle schema/migration convention, repository skeleton, and event log persistence.

Owns:

- `packages/db` schema and migrations.
- `effect_tasks` table/repository skeleton with idempotency, status, attempt, lease fields.
- local DB config.
- migration runner.
- event repository.
- project/session repositories.
- remote config slot disabled state.

Acceptance criteria:

- Local DB file can be created in a temp/app data path.
- Generated migrations apply cleanly.
- Event append/read works.
- Effect task create/read/status update works.
- Project/session create/read works.
- Remote config can be saved as disabled config but no sync is attempted.
- `/readyz` includes migration status.

Verification:

```text
pnpm db:generate
pnpm db:migrate
pnpm test -- --run db
pnpm typecheck
```

Forbidden:

- remote Turso writes.
- `client.sync()`.
- UI feature work beyond DB status display.

## PR-04. ProductEngine reducer

Goal:

- Implement ProductEngine `pure reducer + effect plan` skeleton enough to run intake -> initial spec -> ambiguity -> first queue batch with deterministic local stubs.

Owns:

- `packages/core/product-engine`.
- ProductEngineCommand event-sourcing envelope, ProductEngineStateSnapshot, ProductEngineReduction contracts from `25-contracts-dto-catalog.md`.
- pure reducer + effect plan pattern.
- event reduce pattern.
- initial spec stub generator.
- ambiguity issue stub generator.
- queue projection repository integration.
- `queue_projection_effect` creation and active batch projection exception.

Acceptance criteria:

- `StartProject`, `CaptureIntake`, `DraftInitialSpec`, `AnalyzeAmbiguity`, `ActivateQuestionBatch` work end-to-end through sidecar API using route behavior from `26-api-route-behavior-catalog.md`.
- Every command writes an event before projection changes.
- Reducer unit tests prove no Hono/Tauri/DB/Codex imports are required.
- Reducer output includes events, nextState, effectPlan, deterministicOutputs, and optional immediateProjection.
- First active batch has 3 to 5 question cards.
- Active batch projection exception returns immediate active-batch-safe projection while deeper queue recalculation remains effect-backed.
- Command fixtures include `expectedStateVersion`, `causationId`, and `correlationId`.
- Core logic can be unit tested without Hono/Tauri imports.

Verification:

```text
pnpm test -- --run product-engine
pnpm test -- --run sidecar
pnpm typecheck
```

Forbidden:

- Codex-generated questions as required dependency.
- real external research.
- completion candidate.

## PR-05. Decision Queue UI shell

Goal:

- Implement React UI shell for the active/next/blocked/deferred queue and spec canvas using sidecar projections.

Owns:

- Decision Queue screen.
- active batch rendering.
- answer submission UI.
- activity feed display.
- spec outline/canvas read model.
- progress/risk placeholders from current projections.
- `SessionShellProjection`, `DecisionQueueProjection`, `LivingSpecProjection`, `ConfidenceCompletionProjection`, and `RuntimeActivityProjection` rendering contract from `25-contracts-dto-catalog.md`.

Acceptance criteria:

- User can create a project, see first spec draft, see first question batch, submit an answer through endpoints defined in `26-api-route-behavior-catalog.md`.
- UI does not mutate local state as source of truth; it refetches sidecar projections.
- UI can render pending effect summary and manual retry/blocked cards.
- Active batch remains stable when sidecar reports queued_next items.
- Empty/error/loading states exist for sidecar unavailable.
- UI consumes sidecar projection DTOs without reconstructing ProductEngine state from raw events or DB-shaped records.

Verification:

```text
pnpm test -- --run frontend
pnpm typecheck
pnpm dev
```

Forbidden:

- direct DB access from frontend.
- frontend-local ProductEngine decisions.
- detailed visual redesign beyond required shell.

## PR-06. Research/Evidence loop

Goal:

- Implement answer routing to research_needed/missing_con_evidence, manual research result import, EvidenceMatrix, and Research Review Card.

Owns:

- ResearchTask repository.
- `research_evidence_effect` executor and retry policy.
- ResearchResult import endpoint.
- EvidenceMatrix synthesis stub and deterministic rules.
- Pro/con/uncertainty UI projection.
- `ResearchEvidenceProjection` and related `StatusEndpointDto`/SSE refetch hints from `25-contracts-dto-catalog.md`.
- Queue reprioritization after evidence import.

Acceptance criteria:

- Answer can create a ResearchTask through the answer/research endpoints defined in `26-api-route-behavior-catalog.md`.
- Manual result import creates ResearchResult and EvidenceMatrix.
- High-impact pro-only claim routes to missing_con_evidence or decision block.
- Queue is recalculated but active batch remains stable.
- `research_evidence_effect` uses idempotency by `researchTaskId` or `researchResultId + synthesisVersion` and max 2 automatic retries.
- Known Risks update when evidence is insufficient.

Verification:

```text
pnpm test -- --run research
pnpm test -- --run product-engine
pnpm typecheck
```

Forbidden:

- web automation.
- background cloud research.
- customer interview methodology deep implementation.

## PR-07. Codex preview adapter

Goal:

- Implement Codex app-server availability, schema generation integration, stdio turn wrapper, `24-codex-prompt-output-contract.md` internal schema, RuntimePreviewArtifact creation, and manual handoff fallback.

Owns:

- CodexRuntimeAdapter.
- `codex_runtime_preview_effect` executor and conservative retry.
- generated schema import wrapper.
- `packages/contracts/src/codex/` re-export compatibility with `25-contracts-dto-catalog.md`.
- runtime status endpoint.
- runtime preview endpoint.
- RuntimePreviewArtifact persistence.
- 6 turnPurpose fixtures, 7 artifact kind schemas, 6 applyPolicy schemas.
- JSON parser repair and Codex self-repair pipeline.
- severity-based failure routing.
- blocked execution request conversion.

Acceptance criteria:

- App can show Codex runtime status through runtime endpoints defined in `26-api-route-behavior-catalog.md`.
- If Codex app-server is unavailable, manual handoff fallback works.
- If available, all 6 canonical turnPurpose happy-path fixtures can generate valid RuntimePreviewArtifact/artifact output.
- `codex_runtime_preview_effect` uses idempotency by `turnPurpose + contextHash + runtimeAdapterVersion`, max 1 automatic retry, with per-attempt parser repair once and self-repair once.
- Low-risk artifacts auto-apply only through ProductEngine commands; evidence uses conditional gate.
- File diff/shell/browser/network/credential/destructive suggestions are blocked and converted to `BlockedActionArtifact`/block cards.
- No file/shell/browser action is applied by the app.
- Codex artifact/applyPolicy/blocked taxonomy enum values match both `24-codex-prompt-output-contract.md` and `25-contracts-dto-catalog.md`.

Verification:

```text
codex app-server generate-ts --out packages/contracts/src/codex-generated/<codex-version>
pnpm test -- --run codex-contract
pnpm test -- --run runtime
pnpm typecheck
```

If Codex app-server is unavailable in CI, tests must use a protocol fixture and mark live Codex smoke as skipped with an explicit reason.

Forbidden:

- ChatGPT web automation.
- API key requirement as default path.
- running arbitrary Codex-generated commands.
- implementing Phase 1.5 automatic execution in PR-07.

## PR-08. Completeness and Founder Brief

Goal:

- Implement composite completeness projection, confidence map, top risks, completion candidate, if-stop-now artifact, and Founder Brief draft/export metadata.

Owns:

- CompletenessSnapshot repository.
- scoring service as `reducer_deterministic_output`, not `scoring_effect`.
- risk card projection.
- Completion Candidate Card.
- Founder Brief projection and export request as `reducer_deterministic_output`, not `spec_export_effect`.
- `FounderBriefProjection` and `ConfidenceCompletionProjection` field contracts from `25-contracts-dto-catalog.md`.

Acceptance criteria:

- Score updates after answer, evidence, decision, and spec version changes through deterministic reducer output and completeness endpoints defined in `26-api-route-behavior-catalog.md`.
- Completion candidate requires all gates from `07-completeness-scoring.md` and `16-state-event-contract.md`.
- Founder Brief includes Problem-Customer-Value, top decisions, known risks, next validation actions.
- Completion does not hide missing con evidence or high severity risk.

Verification:

```text
pnpm test -- --run completeness
pnpm test -- --run founder-brief
pnpm typecheck
```

Forbidden:

- claiming startup success probability.
- exporting without explicit user action.

## PR-09. End-to-end dry-run hardening

Goal:

- Make the dry-run scenario from `12-validation-and-dry-run.md` pass through the implemented app without manual state surgery.
- Make at least two representative incidents from `27-operations-observability-contract.md` pass through the implemented app; all three are preferred before declaring Phase 1 operationally ready.

Owns:

- E2E fixture.
- smoke test script.
- docs-to-runtime acceptance checklist.
- issue/bug cleanup from PR-01 through PR-08.

Acceptance criteria:

- Sample idea can go from project creation to first question batch.
- At least one answer routes to research_needed.
- Manual evidence import creates EvidenceMatrix.
- Decision approval can create SpecVersion.
- Completeness score and Founder Brief draft are visible.
- Runtime preview blocked action stays preview-only through runtime artifact endpoints defined in `26-api-route-behavior-catalog.md`.
- Effect queue dry-run covers queue_projection_effect, research_evidence_effect, codex_runtime_preview_effect, conservative_ai_retry_matrix, active batch projection exception, and deterministic scoring/export output.
- Operations dry-run covers research effect retry exhaustion, Codex runtime unavailable/blocked/schema-mismatched, and SSE missed/refetch recovery when feasible for PR-09.

Verification:

```text
pnpm verify
pnpm test -- --run e2e
```

Forbidden:

- widening Phase 1 scope to remote sync, mobile, billing, or web automation.

## Cross-PR dependency rules

- PR-03 cannot start before PR-02 sidecar health contract exists.
- PR-04 cannot persist real state before PR-03 event and effect task repositories exist.
- PR-05 may begin after PR-02 with mocked projections, but merge should wait for PR-04 projection contracts.
- PR-07 should not create runtime artifacts before PR-03 effect persistence and PR-04 ProductEngine command/effect flow exist.
- PR-08 should not claim completion before PR-06 evidence gates exist.
- PR-09 is the integration gate and should not introduce new product scope.

## Definition of done for every implementation PR

- Changes match the relevant docs contract.
- Tests include at least one happy path and one guardrail/failure path.
- `pnpm typecheck` passes.
- `pnpm lint` passes or documented if lint is not yet introduced.
- `pnpm test` targeted suite passes.
- `git diff --check` passes.
- PR description lists forbidden scope not touched.

## Documentation update rule

If implementation discovers a real contract problem:

1. Do not silently choose a different architecture.
2. Add a short ADR-style note to the relevant docs file.
3. Update README responsibility boundary if ownership changes.
4. Explain the rejected alternative in the PR body.

## Implementation readiness checklist

- 19번 문서가 package/runtime/process 경계를 고정한다.
- 20번 문서가 DB/repository/event/projection 경계를 고정한다.
- 21번 문서가 Hono API/Codex runtime boundary를 고정한다.
- 26번 문서가 전체 Phase 1 endpoint별 request, command/query mapping, response/statusUrl, SSE/refetch, error/precondition behavior를 고정한다.
- 24번 문서가 Codex Prompt/Output, turnPurpose schema, artifact taxonomy, repair/failure routing을 고정한다.
- 25번 문서가 `packages/contracts` public DTO, ProductEngineCommand envelope, CommandResponse/statusUrl, SSE DTO, UI Projection contract를 고정한다.
- 22번 문서가 PR 순서와 acceptance criteria를 고정한다.
- 23번 문서가 ProductEngine runtime contract, effect queue, retry/idempotency, API/SSE 구현 기준을 고정한다.
- 12번 dry-run은 PR-09의 integration target으로 남는다.
- 27번 문서가 전구간 운영·관측성 recovery와 대표 장애 dry-run을 고정한다.
