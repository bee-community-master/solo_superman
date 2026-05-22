# 로드맵과 기능 경계

언어: 한국어 | [English](roadmap_EN.md)

Roadmap은 contributor map이며 user-facing UI vocabulary가 아닙니다. code-backed capability band와 보존된 backlog boundary를 함께 다루므로, 어떤 row도 broad end-user availability를 뜻하지 않습니다. Product UI는 Spec-ready, Research in progress, Planning-ready, Waiting for safe execution 같은 user state로 설명해야 합니다.

## 현재 기능 지도

| Capability band | Contributor meaning | Exit evidence |
| --- | --- | --- |
| Product foundation | Product brief, PRD, UX doctrine, Living Product Spec, Decision Queue. | New contributor can explain the Founder OS loop. |
| Research and evidence | Allowlisted read-only research, evidence matrix, pro/con/uncertainty, skeptical search. | Research-updated Queue with residual risks and research-generated follow-up questions explicitly listed instead of hidden. |
| Planning handoff | Build Slice Plan, Serve Checklist, Learning Loop Hook, blocker report when not ready. | Planning-ready artifact or explicit blocker artifact. |
| Controlled execution | ExecutionAuthorityRecord ledger plus `file_diff`, `shell_command`, `browser_action` adapters. | Approved and blocked dry-runs with evidence and rollback refs. |
| Full-vision backlog | business/personal mode, business critic intensity, ChatGPT local browser delegation, service page-use permission, implementation step ledger, workspace auto implementation run bootstrap. | Contributors can implement tracked work without inventing new safety defaults. |

## 단계 이력 요약

- Phase 1: Research 포함 Spec 폐루프 MVP. Core outputs는 Decision Queue, Living Product Spec, Completeness, Founder Brief, ProductEngine reducer contract였습니다.
- Phase 1.5A: Background Research Runtime. Allowlisted and read-only 상태를 유지합니다.
- Phase 1.5B: Execution-readiness Hints. Readiness metadata이며 not execution permission입니다. file/shell/browser work를 execute, run, apply, perform할 수 없습니다.
- Phase 2: Planning Handoff. Evidence와 risk gate를 통과할 때만 final PlanningHandoffArtifact를 만들고, 그렇지 않으면 blocker report를 만듭니다.
- Phase 2.5: Browser Automation Preview. Research quality와 delegation risk를 비교하는 no-execution 단계이며, submit/write/deploy/mutate, credential 저장, account sharing, DTO/API/storage preflight 구현을 허용하지 않습니다.
- Phase 3: Controlled Execution. MVP action class는 common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action` 순서로만 열립니다.
- Post-Phase3: Full-vision backlog. purpose mode, critic intensity, local ChatGPT browser delegation, external service permission, implementation step ledger, workspace auto implementation run bootstrap, cross-platform install/run verification을 추가합니다.

## Auto implementation workspace / 자동 구현 작업공간

Planning이 충분히 상세해지면 Solo Superman은 `workspace/<project>` 아래에 독립 generated-program repo를 준비할 수 있습니다. 첫 화면은 local git repo, `implementation-tracker.md`, 7개의 markdown fallback issue document, `.solo-superman/auto-implementation-run.json`을 만듭니다. 생성된 문서에는 tracker/step doc, commit 또는 no-code evidence, scoped code-review 및 clean-code-review streak, test evidence, blocker, evidence ref를 위한 `ImplementationStepLedger` evidence template가 포함됩니다. GitHub remote나 login이 없으면 issue/PR automation이 성공한 것처럼 보이지 않고, visible remote warning과 connection guide를 유지한 채 local work를 계속합니다.

GitHub issue mutation은 markdown generation과 별도의 contract gate를 통과해야 합니다. `githubIssueCreation`은 no mutation, dry-run readiness check, approved readiness check를 요청할 수 있지만, external write에는 여전히 connected remote status, per-action approval evidence, rollback plan, audit refs, verifier coverage가 필요합니다. Blocked remote state에서는 `githubIssueUrls`를 비우고 local markdown issue path를 source of truth로 유지합니다.

Local Codex worker job은 실행 전에 bounded plan으로 기록됩니다. Worker job은 current stage의 markdown/GitHub issue document를 선택하고, generated workspace path, allowed write scope, 필요한 `ImplementationStepLedger` evidence, 금지된 external/credential action, generated workspace로 scope되고 `no_secret_values`를 사용하는 ready-for-execution file-diff `ExecutionAuthorityRecord` ref를 저장합니다. Authority boundary가 없거나 ready 상태가 아니면 job은 시작하거나 stage를 조용히 advance하지 않고 visible blocked 상태로 남습니다. Worker run bridge는 generated workspace 안에서만 workspace-write sandbox, approval prompt 없음, network disabled 조건으로 local Codex app-server turn을 시도하며, runtime unavailable 또는 malformed worker output은 조용한 실패가 아니라 visible `Local Codex worker execution` evidence로 남깁니다. Ledger import bridge는 local worker output을 기존 `RecordImplementationStepLedger` reducer를 통해 기록하고, completed `ImplementationStepLedger` step이 validate된 뒤에만 planned worker job을 completed로 표시합니다. Worker stage-advance bridge는 completed worker job에서 validated step을 도출해 동일한 stage completion path를 호출하므로 stage advance는 계속 기존 stage endpoint semantics를 통해 수행됩니다.

Controlled runner는 5분 tick record로만 stage를 advance합니다. Stage completion에는 completed `ImplementationStepLedger` step이 필요하며 tracker/step doc, commit 또는 no-code evidence, feature와 repository scope 각각 2회 연속 no-finding code-review, changed-code와 repository scope 각각 2회 연속 clean-code review, passing test evidence, visible blocker history를 포함해야 합니다. Production/external final-submit action은 future explicit contract 없이는 계속 blocked입니다.

## 이슈 이력

- #86, #87, #88은 web/local migration과 Phase 3 controlled execution prerequisite gate를 세웠습니다.
- #91은 Phase 3와 Post-Phase3 work의 unified tracker가 되었습니다.
- #92, #93, #94, #95, #96, #97은 Phase 3 ledger, approval/API security, `file_diff`, `shell_command`, `browser_action`, closeout hardening을 다뤘습니다.
- #99, #100, #101, #102, #103, #104, #105, #106은 purpose mode, critic intensity, ChatGPT browser delegation, service page-use permission, ImplementationStepLedger, install/run verification, docs/verifier closeout을 다뤘습니다.
- #98은 임시 standalone Post-Phase3 tracker였고, 지금은 closed absorbed reference only입니다.

## 전환 규칙

Later phase는 earlier no-execution artifact를 execution permission으로 재해석할 수 없습니다. New capability band는 executable behavior라고 주장하기 전에 explicit DTO/API/storage, approval, rollback, audit, verifier coverage를 추가해야 합니다.
