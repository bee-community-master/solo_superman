# 38. Phase 3 Closeout Evidence

이 문서는 #91 unified tracker의 Phase 3 child issue #92~#97을 닫기 위한 repo-local closeout evidence ledger다. Canonical policy는 `36-phase3-controlled-execution-contract.md`가 계속 소유하고, 이 문서는 구현 완료 claim을 검증 가능한 docs/verifier/E2E evidence로 묶는다.

## Scope

- Phase 3 Controlled Execution MVP의 common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action` 순서가 code-backed route, adapter, storage, DTO, docs contract로 닫혔는지 확인한다.
- approved path와 blocked path가 같은 `ExecutionAuthorityRecord` ledger family에 terminal evidence/audit refs를 남기는지 확인한다.
- unsafe scope 회귀를 차단한다: unauthorized execution, credential custody, destructive shell command, external-production mutation, hosted SaaS default, browser-only DB rewrite, blanket approval.
- Post-Phase3 backlog(#99~#106)는 `37-post-phase3-full-vision-backlog-contract.md`가 소유하며, 이 closeout은 후속 backlog를 구현하지 않는다.

## Child issue evidence ledger

| Issue | Slice | Code-backed evidence | Closeout guardrail |
| --- | --- | --- | --- |
| #92 | common ledger/authority | `ExecutionAuthorityRecord`, `BoundedAgentOutputRecord`, ProductEngine command/event/projection, DB repository persistence | `approvalDecision` includes `pending`; `executionResult` includes `running`; `cancelled`/`rolled_back` are not MVP states |
| #93 | approval/API security boundary | `POST /api/v1/sessions/:sessionId/execution-authority`, `GET /api/v1/sessions/:sessionId/execution-authority`, `POST /api/v1/execution-authorities/:authorityRecordId/preflight` | local token, loopback-only service binding, explicit CORS allowlist, CSRF/replay/idempotency, exact preview hash, expiry, rollback/evidence/audit refs |
| #94 | `file_diff` controlled adapter | `ExecuteFileDiffRequest`, `FileDiffExecutionResult`, route catalog/Hono route, `file-diff-adapter.ts`, terminal ledger update | `git_diff_reverse` default; `filesystem_snapshot` explicit exception; `.env*`, credential/secret/key, home, repo-outside, symlink escape blocked |
| #95 | `shell_command` controlled adapter | `ExecuteShellCommandRequest`, `ShellCommandExecutionResult`, route catalog/Hono route, `shell-command-adapter.ts`, terminal ledger update | repo scripts + read-only diagnostics allowlist; read-only 30초, test/typecheck/lint/docs verify 10분, build/full verify 20분 timeout; destructive shell command/deploy/system mutation/credential path blocked |
| #96 | `browser_action` controlled adapter | `ExecuteBrowserActionRequest`, `BrowserActionPreviewDto`, `BrowserActionExecutionResult`, route catalog/Hono route, `browser-action-adapter.ts`, terminal screenshot/log/evidence refs | loopback-only browser target policy; LAN/private/cloud/external target, credential/session custody, hidden action, external-production mutation, blanket approval blocked |
| #97 | closeout hardening | `apps/sidecar/src/e2e-dry-run.test.ts`, `apps/sidecar/src/e2e-dry-run.fixture.ts`, `scripts/verify-doc-contracts.mjs`, this doc | docs/verifier/E2E must fail if Phase 3 MVP evidence or unsafe-scope guardrails drift |

## Phase 3 approved/blocked E2E dry-run matrix

`pnpm smoke:e2e` runs `apps/sidecar/src/e2e-dry-run.test.ts` and includes the Phase 3 closeout scenarios below.

| Scenario | Approved path evidence | Blocked path evidence |
| --- | --- | --- |
| Common authority | `CreateExecutionAuthority` returns `ExecutionAuthorityLedgerProjection.currentStatus = ready_for_execution` before adapter execution | missing/expired/unapproved/mismatched authority remains `blocked` in server route tests and docs verifier snippets |
| `file_diff` | exact approved unified diff applies inside the approved workspace root and returns `FileDiffExecutionResult.status = completed`, `git_diff_reverse`, changed-file evidence, audit refs | secret/repo-outside diff returns `FileDiffExecutionResult.status = blocked` with `sandbox_failure` and `credential_value_required` |
| `shell_command` | argv-style `ls .` diagnostic in the approved workspace returns `ShellCommandExecutionResult.status = completed`, exit-code evidence, audit refs | destructive `rm -rf .` returns `ShellCommandExecutionResult.status = blocked` and never reaches shell interpolation |
| `browser_action` | visible `navigate_and_capture` against `127.0.0.1:<port>` returns `BrowserActionExecutionResult.status = completed`, screenshot/log/evidence/audit refs | `https://example.com/...` target returns `BrowserActionExecutionResult.status = blocked` because the MVP policy requires loopback HTTP targets |

## Docs/verifier guardrails

`scripts/verify-doc-contracts.mjs` owns the closeout guardrail bundle. It must require this document and fixture labels that name:

- `PHASE3_CLOSEOUT_EVIDENCE` and `PHASE3_CLOSEOUT_DRY_RUN_EVIDENCE_MAP`.
- `docs/38-phase3-closeout-evidence.md` references from `docs/README.md`, `docs/12-validation-and-dry-run.md`, and `docs/36-phase3-controlled-execution-contract.md`.
- Unauthorized execution and missing Phase 3 authority are blocked, not silently downgraded to executable plans.
- Credential custody, credential/secret/session value storage, and credential-bearing paths/URLs remain blocked.
- Destructive shell command, deploy, force reset/delete, system setting mutation, and external-production mutation remain blocked.
- Hosted SaaS default, browser-only DB rewrite, new replacement native shell, and blanket/project-level approval remain non-goals or blocked boundaries.

## Verification commands

The closeout PR must collect and report the following evidence before merge:

```bash
pnpm verify:docs
pnpm smoke:e2e
pnpm verify
```

Phase 5 merge gate should additionally run `pnpm build`, `git diff --check`, and `git diff --cached --check` when the branch has implementation changes.

## Tracker #91 update rule

After the closeout PR merges:

1. Close #97 if it remains open.
2. Mark #97 and the Phase 3 closeout checklist in #91 as complete.
3. Mark `Current main passes pnpm verify` and `Phase 3 approved/blocked dry-run evidence attached` only after the merged main evidence is confirmed.
4. Do not begin Post-Phase3 issue #99 in the same cron execution that merges #97.
