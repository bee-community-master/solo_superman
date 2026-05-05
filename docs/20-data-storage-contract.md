# 20. Data Storage Contract

## 목적

이 문서는 Phase 1 local-first 저장소를 Codex가 구현할 수 있도록 libSQL, Drizzle, migration, repository, event log, projection 계약을 고정한다.

`08-domain-model.md`가 제품 도메인 객체를 설명한다면, 이 문서는 그 객체를 Node/Hono sidecar의 local embedded libSQL 저장소에서 어떻게 관리할지 정의한다.

## 확정 결정

| 항목 | 결정 |
| --- | --- |
| Storage owner | Node/Hono sidecar |
| Database | local embedded libSQL file |
| Client | `@libsql/client` |
| ORM/schema | Drizzle ORM |
| Migration tool | Drizzle Kit generated SQL migrations |
| Schema source of truth | TypeScript schema in `packages/db/src/schema.ts` |
| Migration directory | `packages/db/drizzle/` |
| Repository layer | `packages/db/src/repositories/` |
| Projection layer | `packages/db/src/projections/` |
| Remote DB | config slot only, no sync behavior |
| Event log | append-first for ProductEngine commands |
| Effect queue | persisted async effect queue for ProductEngine effect plans |

## Storage mode

Phase 1 uses local embedded libSQL only at runtime.

```text
Node sidecar
  -> @libsql/client
  -> file:<appDataDir>/solo-superman.db
```

Remote-ready config exists, but the implementation must not call remote sync.

```text
Remote config slot
  -> remoteUrl stored as disabled config
  -> remoteTokenRef stored in OS secret store
  -> no client.sync()
  -> no embedded replica
  -> no conflict resolution
```

## File locations

| Artifact | Required location |
| --- | --- |
| Local database | `<appDataDir>/solo-superman.db` |
| Source cache | `<appDataDir>/source-cache/` |
| Export staging | `<appDataDir>/exports/` |
| Sidecar logs | `<appDataDir>/logs/sidecar/` |
| Drizzle config | `packages/db/drizzle.config.ts` |
| Drizzle schema | `packages/db/src/schema.ts` |
| SQL migrations | `packages/db/drizzle/` |
| Seed/sample fixtures | `packages/db/src/fixtures/` |

The repository must never create database files inside the repo root during packaged app execution. Tests may use temporary file URLs or `:memory:`.

## Drizzle/libSQL contract

- Use `drizzle-orm/libsql` with `@libsql/client`.
- Use `file:` URLs for local database files.
- Use generated SQL migration files rather than schema push for committed migrations.
- `drizzle-kit push` may be used only for local experiments and must not be the documented implementation path.
- Runtime startup applies unapplied generated migrations before serving `/readyz`.
- Migration execution failure makes `/readyz` fail and keeps `/healthz` alive.

## Remote config slot

Remote config is included to avoid future schema churn, not to enable Phase 1 sync.

| Config key | Storage | Phase 1 allowed behavior |
| --- | --- | --- |
| `remoteDbUrl` | local config table | may be saved, displayed as disabled |
| `remoteDbTokenRef` | OS secret ref id | may be saved, not read unless user opens settings |
| `remoteSyncEnabled` | local config table | must remain false |
| `lastRemoteSyncAt` | local config table | null in Phase 1 |
| `remoteSyncStatus` | local config table | `not_configured`, `configured_disabled`, or `unsupported_in_phase1` |

Forbidden in Phase 1:

- calling `client.sync()`.
- writing to remote Turso/libSQL database.
- background sync scheduler.
- conflict resolution UI.
- remote migration execution.

## Table groups

This document defines table groups and minimum responsibilities, not final SQL DDL.

| Group | Tables | Purpose |
| --- | --- | --- |
| Project/session | `projects`, `sessions` | raw idea, privacy mode, session status |
| Event log | `events` | append-only ProductEngine event source |
| Spec | `spec_versions`, `spec_sections`, `spec_updates` | working draft, immutable versions, update candidates |
| Ambiguity/question | `ambiguity_issues`, `questions`, `answers` | question lifecycle and answer routing |
| Queue | `queue_items`, `queue_batches` | active/next/deferred card projections |
| Research/evidence | `research_tasks`, `research_results`, `evidence_matrices`, `evidence_items` | closed-loop research and pro/con evidence |
| Decision | `decisions`, `decision_options` | approval outcomes and rationale |
| Runtime | `runtime_preview_artifacts`, `runtime_task_refs` | Codex/manual handoff preview outputs |
| Planning handoff | `planning_handoffs`, `planning_handoff_sources`, `planning_handoff_tasks`, `planning_handoff_pr_issue_items`, `planning_handoff_risks` | Phase 2 final/blocker handoff artifacts, source trace, task/PR/issue plan, residual risk/readiness mapping |
| Effect queue | `effect_tasks` | durable execution state for `queue_projection_effect`, `research_evidence_effect`, `codex_runtime_preview_effect` |
| Scoring/export | `completeness_snapshots`, `founder_briefs` | progress, completion, export artifacts |
| Config | `app_config`, `secret_refs` | local settings and opaque OS secret references |

## ID policy

- Use stable string ids with object prefixes.
- IDs are generated in ProductEngine or repository helpers, never in React components.
- Recommended prefixes:
  - `proj_`
  - `sess_`
  - `evt_`
  - `specv_`
  - `issue_`
  - `q_`
  - `ans_`
  - `queue_`
  - `research_`
  - `evidence_`
  - `decision_`
  - `runtime_`
  - `handoff_`
  - `eft_`
  - `score_`
  - `brief_`
- Database row ids must be globally unique within the local database.
- Future sync requires IDs not to depend on autoincrement order.

## Event log contract

ProductEngine commands must write an event before mutating derived state.

```text
command
  -> validate precondition
  -> load ProductEngineStateSnapshot
  -> call pure reducer + effect plan
  -> repository transaction appends events
  -> repository transaction persists state patch
  -> repository transaction persists reducer_deterministic_output
  -> repository transaction persists effect_tasks
  -> return accepted or accepted_with_projection envelope
```

Minimum event fields:

| Field | Purpose |
| --- | --- |
| `id` | event id |
| `projectId` | project scope |
| `sessionId` | session scope |
| `type` | command/result event type |
| `source` | user, product_engine, codex_runtime, research_import, system |
| `causationId` | direct cause event or object |
| `correlationId` | chain for one ProductEngine command |
| `payloadJson` | event-specific payload |
| `createdAt` | local timestamp |
| `schemaVersion` | event payload version |

No completion candidate can be created from objects that cannot be traced to events.

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

## Effect task persistence contract

`effect_tasks` is mandatory in Phase 1 because ProductEngine effect execution uses `persisted async effect queue`.

Minimum `effect_tasks` fields:

| Field | Purpose |
| --- | --- |
| `id` | `eft_` prefixed effect task id |
| `projectId` | project scope |
| `sessionId` | session scope |
| `sourceEventId` | ProductEngine event that created the effect |
| `effectType` | `queue_projection_effect`, `research_evidence_effect`, or `codex_runtime_preview_effect` |
| `status` | `queued`, `leased`, `running`, `succeeded`, `failed`, `blocked`, `cancelled` |
| `idempotencyKey` | duplicate guard for retries and crash recovery |
| `attemptCount` | started attempts count |
| `maxAttempts` | conservative_ai_retry_matrix limit |
| `leaseOwner` | executor id while leased/running; cleared for queued or terminal statuses |
| `leaseExpiresAt` | stale-running recovery deadline; cleared for queued or terminal statuses |
| `inputJson` | effect input payload or local ref |
| `outputJson` | effect output ref after success |
| `lastErrorCode` | stable error code after failure/block |
| `lastErrorMessage` | human-readable failure/block explanation |
| `createdAt` | creation timestamp |
| `updatedAt` | last state transition timestamp |

Lifecycle:

```text
queued -> leased -> running -> succeeded
queued -> leased -> running -> failed
queued -> leased -> running -> blocked
queued -> cancelled
blocked -> queued
failed -> queued only through manual retry command
```

Storage rules:

- in-memory-only effect queue is forbidden.
- effect task creation happens in the same repository transaction that persists source ProductEngine events.
- effect executor updates only effect status/output and emits follow-up ProductEngine event or projection update through the application service path.
- stale `running` tasks with expired lease may return to `queued` if `attemptCount < maxAttempts`.
- stale `running` tasks with exhausted attempts become `failed`.

## Conservative AI retry matrix

| Effect type | Idempotency key | Auto retry | Manual retry | Failure output |
| --- | --- | --- | --- | --- |
| `queue_projection_effect` | `sourceEventId + projectionKind` | max 3 | not normally needed | `QueueProjectionFailed` activity and sidecar refetch recommendation |
| `research_evidence_effect` | `researchTaskId` or `researchResultId + synthesisVersion` | max 2 | allowed through Research Review Card | `ResearchEffectFailed` card with retained source/result |
| `codex_runtime_preview_effect` | `turnPurpose + contextHash + runtimeAdapterVersion` | max 1 | required after auto retry exhausted | `ManualRetryCard` or `RuntimeBlockedCard` |

`scoring_effect` and `spec_export_effect` must not be added as Phase 1 first-class async effects. Completeness/Scoring, SpecVersion, and Founder Brief draft are `reducer_deterministic_output` values persisted in the repository transaction.

## Repository contract

Repositories live under `packages/db/src/repositories/`.

| Repository | Owns |
| --- | --- |
| `projectRepository` | project/session create/read/update |
| `eventRepository` | append events and query event chains |
| `specRepository` | spec sections, updates, versions |
| `ambiguityRepository` | ambiguity issues and repeat counters |
| `questionRepository` | questions, answers, route outcomes |
| `queueRepository` | queue items and active batch projection |
| `researchRepository` | research tasks/results |
| `evidenceRepository` | evidence matrices and evidence items |
| `decisionRepository` | decision cards and outcomes |
| `runtimeRepository` | runtime preview artifacts |
| `planningHandoffRepository` | final/blocker planning handoff artifacts, source refs, task/PR/issue plan, risk/readiness rows |
| `effectTaskRepository` | effect task create/lease/status/output/idempotency |
| `scoringRepository` | completeness snapshots |
| `exportRepository` | founder brief snapshots |
| `configRepository` | local config and secret refs |

Rules:

- Repositories do not contain ProductEngine branching logic.
- Repositories may enforce persistence invariants and foreign-key-like checks.
- Repositories return domain objects from `packages/contracts`.
- Repositories never call Codex app-server.
- Repositories never call Tauri commands.
- Repositories persist `effect_tasks` but do not decide whether a command should create a specific effect type. That decision belongs to ProductEngine reducer output.

## Projection contract

Projection modules live under `packages/db/src/projections/` and build read models for the UI/API.

| Projection | Output |
| --- | --- |
| `projectOverviewProjection` | project list and session summary |
| `livingSpecProjection` | current working spec and versions |
| `decisionQueueProjection` | active batch, next queue, blocked, deferred |
| `activityFeedProjection` | event/activity timeline |
| `researchEvidenceProjection` | research tasks, results, evidence matrix cards |
| `completenessProjection` | score, confidence map, risk cards |
| `founderBriefProjection` | if-stop-now and final export view |
| `planningHandoffProjection` | latest Phase 2 final/blocker handoff state for a session |

React frontend must consume projections through Hono APIs, not by reconstructing state from raw tables.

## Transaction policy

One ProductEngine command should be persisted in one transaction when possible.

Examples:

- `SubmitAnswer` writes Answer, route outcome, event, reducer deterministic outputs, active-batch-safe immediate projection when allowed, and effect_tasks in one transaction.
- `ImportResearchResult` writes ResearchResult, import event, and `research_evidence_effect` task in one transaction; EvidenceMatrix is persisted when the effect succeeds.
- `ResolveDecision` writes Decision outcome, SpecUpdate application, SpecVersion, event, and `reducer_deterministic_output` scoring/founder brief material in one transaction.
- ProductEngine command transactions persist event drafts, state patch, deterministic outputs, and `effect_tasks` together before any effect executor runs.

If a command needs Codex or external input, split it into two transactions:

```text
PlanResearch transaction
  -> external/manual runtime waits
ImportResearchResult transaction
```

## Migration convention

- Drizzle schema changes must generate migration files under `packages/db/drizzle/`.
- Migration names must be descriptive enough for review.
- Migrations must be deterministic and committed.
- Startup migration runner must apply unapplied migrations in order.
- Failed migration must prevent `/readyz` from returning ready.
- Data-destructive migrations require a future explicit ADR and are not allowed in Phase 1 implementation without user approval.

## Test data convention

- Unit tests may use `:memory:` or temp file libSQL URLs.
- E2E/dev seed uses `packages/db/src/fixtures/sample-founder-session.ts`.
- Seed data must represent the dry-run idea from `12-validation-and-dry-run.md`.
- Seed data must not be inserted into real user databases automatically.

## Phase 1.5 storage checklist

Phase 1.5 구현자는 `30-phase1.5-research-runtime-and-readiness-contract.md`를 기준으로 다음 저장소 계약을 추가한다.

- ResearchAllowlist는 connector/source category, status, contextMode, rate/budget/staleness policy, approved/paused/revoked timestamps를 local DB에 저장한다.
- ResearchRun은 status state machine, provider run reference, idempotency key, attempt, timestamps, terminal reason을 저장한다.
- ResearchDisclosureLog는 connector/source category, query/objective summary, public-safe summary sent, source refs를 저장한다.
- `phase15bUpgradeHints`는 structured readiness metadata로 저장·조회·export되지만 실행 권한으로 해석하지 않는다.
- secret value는 libSQL에 저장하지 않고 OS secret ref만 저장한다.

## Phase 2 planning handoff storage checklist

Phase 2 Planning Handoff 저장소 구현자는 `31-phase2-planning-handoff-contract.md`를 canonical source로 사용한다. 이 섹션은 후속 구현 PR에서 추가할 storage 이름과 책임을 고정하지만, 현재 PR에서 SQL DDL이나 product code를 추가하지 않는다.

- `CreatePlanningHandoff`는 gate 통과 시 final `PlanningHandoffArtifact`, gate 실패 시 `PlanningHandoffBlockerArtifact`를 같은 handoff storage family에 영속화한다.
- `planning_handoffs`는 `artifactId`, `sessionId`, artifact kind, schemaVersion, status, gate verdict, summary, createdAt, createdBy, source session/version refs를 저장한다.
- `planning_handoff_sources`는 SpecVersion, Founder Brief/Completion Candidate, Decision-linked Evidence Pack, Research-updated Queue item, Decision/RiskAcceptance, Known Risk/Open Question, Phase 1.5B hint sourceRef를 저장한다.
- `planning_handoff_tasks`는 final artifact의 `taskBreakdown[]` item, dependency, owner role, acceptance evidence, non-goal, linked risk/validation dependency refs를 저장한다.
- `planning_handoff_pr_issue_items`는 final artifact의 PR/issue sequence, included task ids, entry prerequisites, exit evidence, blocked-by relationship, phase boundary를 저장한다.
- `planning_handoff_risks`는 residual risk, assumption, prerequisite, validation dependency, blocker next action, required user action을 final/blocker artifact 양쪽에서 조회 가능하게 저장한다.
- `planningHandoffRepository`는 final/blocker artifact와 source/task/PR-risk rows를 한 transaction에서 저장하고, ProductEngine gate 판단 자체를 재구현하지 않는다.
- `planningHandoffProjection`은 한 session의 최신 final handoff 또는 blocker artifact를 반환한다. 두 artifact가 동시에 current final state로 보이면 안 된다.
- 이 storage family는 실행 권한을 만들지 않는다. file patch, shell command, browser action, deploy, external mutation, active delegation 상태는 저장하지 않는다.

## Data privacy rules

- Raw idea text and imported research content remain local by default.
- Source cache files stay under app data dir.
- Remote config slot does not upload data.
- Secret values are not stored in libSQL; only secret refs are stored.
- Export files require explicit user action through the Tauri native boundary.

## Official reference notes

- Turso/libSQL TypeScript SDK supports local `file:` URLs and remote/embedded patterns. Phase 1 uses local file mode and leaves remote sync disabled. Reference: <https://docs.turso.tech/sdk/ts/reference>
- Turso local development docs describe using `file:` URLs for local SDK connections. Reference: <https://docs.turso.tech/local-development>
- Drizzle SQLite docs show `drizzle-orm/libsql`, `@libsql/client`, `drizzle.config.ts`, and generate/migrate workflows. Reference: <https://orm.drizzle.team/docs/get-started/sqlite-new>
- Drizzle migration docs distinguish codebase-first generated SQL migrations from direct push. Phase 1 uses generated migrations. Reference: <https://orm.drizzle.team/docs/migrations>

## Implementation checklist

- Create `packages/db` before ProductEngine persistence work.
- Implement event repository before queue projection persistence.
- Implement local file libSQL first; remote config table can exist but remains disabled.
- Keep all DB access in Node sidecar packages.
- Add migration and repository tests before UI consumes the API.
