# Roadmap and Capability Boundaries

Language: [한국어](roadmap_KO.md) | English

The roadmap is a contributor map, not a user-facing UI vocabulary. It mixes code-backed capability bands with preserved backlog boundaries, so a row here is not a claim that the feature is broadly available to end users. Product UI should describe user states such as Spec-ready, Research in progress, Planning-ready, and Waiting for safe execution.

## Current capability map

| Capability band | Contributor meaning | Exit evidence |
| --- | --- | --- |
| Product foundation | Product brief, PRD, UX doctrine, Living Product Spec, Decision Queue. | New contributor can explain the Founder OS loop. |
| Research and evidence | Allowlisted read-only research, evidence matrix, pro/con/uncertainty, skeptical search. | Research-updated Queue with residual risks and research-generated follow-up questions explicitly listed instead of hidden. |
| Planning handoff | Build Slice Plan, Serve Checklist, Learning Loop Hook, blocker report when not ready. | Planning-ready artifact or explicit blocker artifact. |
| Controlled execution | ExecutionAuthorityRecord ledger plus `file_diff`, `shell_command`, `browser_action` adapters. | Approved and blocked dry-runs with evidence and rollback refs. |
| Full-vision backlog | business/personal mode, business critic intensity, ChatGPT local browser delegation, service page-use permission, implementation step ledger, workspace auto implementation run bootstrap. | Contributors can implement tracked work without inventing new safety defaults. |

## Phase history

- Phase 1: closed-loop Spec MVP with Research. Core outputs were Decision Queue, Living Product Spec, Completeness, Founder Brief, and ProductEngine reducer contract.
- Phase 1.5A: Background Research Runtime. It stays allowlisted and read-only.
- Phase 1.5B: Execution-readiness Hints. It is readiness metadata, not execution permission, and cannot execute, run, apply, or perform file/shell/browser work.
- Phase 2: Planning Handoff. It produces a final PlanningHandoffArtifact only when evidence and risk gates pass; otherwise it produces a blocker report.
- Phase 2.5: Browser Automation Preview. It compares research quality and delegation risk; it is no-execution and must not submit, write, deploy, mutate, store credentials, share accounts, or implement DTO/API/storage preflight.
- Phase 3: Controlled Execution. It opens MVP action classes only in the sequence common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action`.
- Post-Phase3: Full-vision backlog. It adds purpose mode, critic intensity, local ChatGPT browser delegation, external service permission, implementation step ledger, workspace auto implementation run bootstrap, and cross-platform install/run verification.

## Auto implementation workspace / 자동 구현 작업공간

When planning is detailed enough, Solo Superman may prepare an independent generated-program repo under `workspace/<project>`. The first mounted surface creates a local git repo, `implementation-tracker.md`, seven markdown fallback issue documents, and `.solo-superman/auto-implementation-run.json`. Those generated docs include an `ImplementationStepLedger` evidence template for tracker/step docs, commit or no-code evidence, scoped code-review and clean-code-review streaks, test evidence, blockers, and evidence refs. If a GitHub remote or login is missing, local work continues with a visible remote warning and connection guide instead of pretending issue/PR automation succeeded.

GitHub issue mutation is contract-gated separately from markdown generation. `githubIssueCreation` can request no mutation, a dry-run readiness check, or an approved issue-creation run; any external write still requires connected remote status, per-action approval evidence, rollback plan, audit refs, and verifier coverage. Approved issue creation is limited to `gh issue create` for the generated markdown issue documents, then persists the created GitHub issue URLs beside the local markdown paths. Blocked remote states keep `githubIssueUrls` empty and preserve local markdown issue paths as the source of truth.

GitHub PR mutation uses the same explicit remote-action boundary. The auto implementation run records `open_pr`, `update_pr_body`, and `merge_pr` attempts as `pullRequestMutations`, including issue links, implementation scope, review streak refs, exact verification commands, known gaps, rollback notes, PR-body evidence, merge-readiness evidence, approval, audit, and verifier refs. Dry-runs stay read-only. Approved body updates and merges require connected remote status, per-action approval, and verifier evidence; merges are additionally blocked until the `final_verify_pr_update` stage has completed ledger evidence and the current PR body evidence is present.

Local Codex worker jobs are represented as bounded plans before execution. A worker job selects the current stage's markdown/GitHub issue document, stores the generated workspace path, exact planned `ImplementationStepLedger` tracker/step docs, allowed write scope, required ledger evidence, forbidden external/credential actions, and the linked ready-for-execution file-diff `ExecutionAuthorityRecord` reference scoped to that generated workspace with `no_secret_values`. If that authority boundary is missing or not ready, the job remains visibly blocked instead of starting or silently advancing a stage. The worker run bridge attempts a local Codex app-server turn only inside the generated workspace with workspace-write sandboxing, no approval prompts, and network disabled; runtime unavailability or malformed worker output becomes visible `Local Codex worker execution` evidence instead of a silent failure. A ledger import bridge first checks that imported transitions use the planned tracker/step docs, records matching local worker output through the existing `RecordImplementationStepLedger` reducer, then can mark a planned worker job completed only after a completed `ImplementationStepLedger` step validates. The worker stage-advance bridge derives that validated step from the completed worker job and calls the same stage completion path, so stage advancement still goes through the existing stage endpoint semantics.

The controlled runner advances stages only through 5-minute tick records. Completing a stage requires a completed `ImplementationStepLedger` step with tracker/step docs, commit or no-code evidence, two consecutive no-finding code-review passes for feature and repository scopes, two consecutive clean-code passes for changed-code and repository scopes, passing test evidence, and visible blocker history. Production/external final-submit actions remain blocked without a future explicit contract.

## Tracker history

- #86, #87, and #88 established the web/local migration and Phase 3 controlled execution prerequisite gates.
- #91 became the unified tracker for Phase 3 and Post-Phase3 work.
- #92, #93, #94, #95, #96, and #97 covered Phase 3 ledger, approval/API security, `file_diff`, `shell_command`, `browser_action`, and closeout hardening.
- #99, #100, #101, #102, #103, #104, #105, #106, and #108 exposed stage tick/lifecycle controls, manual worker completion, planned worker ledger-doc binding, exact planned worker ledger docs inside bounded worker plans, and manual ledger-import binding to those planned docs.
- #98 was the temporary standalone Post-Phase3 tracker and is a closed absorbed reference only.

## Transition rule

A later phase cannot reinterpret an earlier no-execution artifact as execution permission. New capability bands must add explicit DTO/API/storage, approval, rollback, audit, and verifier coverage before claiming executable behavior.
