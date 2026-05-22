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

When planning is detailed enough, Solo Superman may prepare an independent generated-program repo under `workspace/<project>`. The first mounted surface creates a local git repo, `implementation-tracker.md`, seven markdown fallback issue documents, and `.solo-superman/auto-implementation-run.json`. If a GitHub remote or login is missing, local work continues with a visible remote warning and connection guide instead of pretending issue/PR automation succeeded.

## Tracker history

- #86, #87, and #88 established the web/local migration and Phase 3 controlled execution prerequisite gates.
- #91 became the unified tracker for Phase 3 and Post-Phase3 work.
- #92, #93, #94, #95, #96, and #97 covered Phase 3 ledger, approval/API security, `file_diff`, `shell_command`, `browser_action`, and closeout hardening.
- #99, #100, #101, #102, #103, #104, #105, and #106 covered purpose mode, critic intensity, ChatGPT browser delegation, service page-use permission, ImplementationStepLedger, install/run verification, and docs/verifier closeout.
- #98 was the temporary standalone Post-Phase3 tracker and is a closed absorbed reference only.

## Transition rule

A later phase cannot reinterpret an earlier no-execution artifact as execution permission. New capability bands must add explicit DTO/API/storage, approval, rollback, audit, and verifier coverage before claiming executable behavior.
