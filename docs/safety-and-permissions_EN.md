# Safety and Permissions

Language: [한국어](safety-and-permissions_KO.md) | English

## Non-negotiable posture

Solo Superman can help prepare actions, but it must not silently perform risky work. Risky work includes file patch, shell command, browser action, network write, credential access, destructive operation, ChatGPT web automation, external-production mutation, payment/legal/medical/financial action, DNS cutover, account deletion, or final submit.

## Credential and account policy

- No credential/2FA/session custody.
- No password, 2FA, session cookie, API key, ChatGPT credential, or payment secret storage.
- No account sharing/resale and no use of a user's ChatGPT Pro plan as shared backend capacity.
- The user must directly own and see any browser session used for local delegation.
- Redaction preview is required before storing prompt/result/screenshot/log artifacts that might contain sensitive context; users need export/delete controls for retained artifacts.

## ExecutionAuthorityRecord

An action is not executable until it has an `ExecutionAuthorityRecord` with bounded source, preview, approval, rollback, and evidence metadata.

Required rules:

- `approvalDecision` starts as `pending`; only user-visible approval can move it to approved.
- `executionResult` includes `running` and must end in a terminal evidence-backed state such as completed, failed, blocked, or partial.
- For executable actions, `rollbackReference` is mandatory before execution; preview-only artifacts are not execution and do not need rollback evidence.
- `file_diff` uses `git_diff_reverse` by default for rollback.
- `shell_command` needs command allowlist, timeout class, stdout/stderr evidence, and no credential prompt.
- `browser_action` needs loopback-only local targets for the MVP; LAN/private IP targets and cloud preview URLs stay blocked unless a later explicit contract permits them.

## Blocked by default

The following remain blocked without a later explicit contract:

- hosted SaaS default replacing the local service.
- browser-only DB rewrite.
- blanket approval across action classes.
- destructive shell command.
- credential custody or credential/session/secret/2FA/payment/legal-sensitive field persistence.
- external-production mutation, final submit, deploy, purchase, account deletion, or irreversible service write.
- automated signup/login for external services.

## Service page-use permission

For Vercel, Supabase, Stripe, GitHub, domain/DNS, app stores, or similar SaaS pages, permission must use a ServicePageUsePermission style purpose-limited page-use permission, not account delegation.

A permission record must include service origin, purpose, allowed action classes, blocked action classes, visible data categories, approval granularity, revoke state, audit refs, and evidence refs. Filling a draft and final submit are different permissions; final submit remains blocked until a production-mutation contract exists.

## Auto implementation workspace / 자동 구현 작업공간

Generated programs live in independent local git repos under `workspace/<project>`, not inside product source files. The workspace bootstrap may create local tracker/issue markdown files and a manifest, then commit only those Solo Superman-generated artifacts as a clean local baseline for later diffs and rollback evidence. It must not stage unrelated operator files, create remote GitHub issues, open PRs, merge branches, deploy, or store credentials unless a later explicit remote-runner contract and user-owned authentication boundary allow that action. Missing remote or `gh` login is represented as a visible local fallback with connection commands.

Markdown-ready output is not permission to mutate GitHub. A GitHub issue creation request must carry an explicit `githubIssueCreation` mode, pass a connected GitHub remote/login check, and record per-action approval, rollback, audit, and verifier evidence before any external write can occur. When approved, the executor may only call `gh issue create` for the generated markdown issue documents and must persist the resulting GitHub issue URLs beside the local markdown paths; generated issue-state markdown and web issue rows must then expose the matching GitHub issue URL instead of requiring manual list correlation. Once those URLs are recorded for a generated workspace, another approved issue-creation request for the same workspace must not invoke the adapter again. Remote states such as `no_remote`, `not_authenticated`, `permission_denied`, `offline`, or `unsupported_remote` keep `githubIssueUrls` empty and expose a blocked mutation contract while local markdown issue paths remain visible.

GitHub PR mutation is permissioned per action. `pullRequestMutations` can record read-only dry-runs or approved `open_pr`, `update_pr_body`, and `merge_pr` actions, but approved writes require connected remote status, per-action approval, rollback notes, audit refs, and verifier evidence. Generated PR bodies must expose local markdown issue/GitHub issue traceability, scope-specific code-review and clean-code review refs, and completed-stage implementation, missing-test audit, and test evidence refs from the `ImplementationStepLedger` instead of relying on verification commands alone. Approved `open_pr` must not invoke the adapter until `initial_pr` has completed validated implementation ledger evidence, and it must not invoke the adapter after a PR URL has already been recorded for the run. PR body updates must include current body evidence. PR merges must also include current PR body evidence, merge-readiness evidence, and completed `final_verify_pr_update` ledger evidence; after a merge is recorded, another approved `merge_pr` must be blocked before the adapter is invoked. Otherwise the merge action remains blocked and the injected or default `gh` adapter is not invoked.

Auto implementation stages cannot be completed from timers alone. Generated tracker and issue markdown must reserve scope-specific review evidence slots before worker execution starts, per-stage issue-state sections must expose stage evidence refs, stage blocker evidence refs, and latest worker evidence refs, and the generated manifest, tracker run-state section, authoritative `issueManagement.issueDocs[].status` values, and issue status summaries must stay synchronized after stage, worker, and PR mutation transitions. The runner must record each tick and may only complete a stage when a completed `ImplementationStepLedger` step proves commit/no-code evidence, code-review and clean-code review streaks, a zero-gap missing-test audit, passing tests, and blocker history. Local Codex worker jobs must first store a bounded plan with the current issue document, exact planned `ImplementationStepLedger` tracker/step docs, allowed workspace write scope, required evidence, forbidden external/credential actions, and a ready-for-execution file-diff `ExecutionAuthorityRecord` reference scoped to that generated workspace with `no_secret_values`; missing or non-ready authority keeps the job visibly blocked. The worker run bridge then starts Codex only as a local app-server turn with workspace-write roots limited to the generated workspace, approval policy `never`, and network access disabled; unavailable runtime, mismatched job output, or missing ledger evidence is recorded as a visible worker blocker. Imported worker ledger transitions can be pasted through the Implementation UI for the current-stage worker, must match the planned tracker/step docs before they are replayed through the existing `RecordImplementationStepLedger` reducer, and may only complete the current-stage worker after ledger validation succeeds; worker UI/action handlers must ignore completed previous-stage jobs when choosing import, run, complete, or advance targets, and must not plan another current-stage worker when the latest current-stage worker can still be run, imported, completed, or advanced. The worker stage-advance bridge then reuses the same stage completion validation instead of bypassing the existing stage endpoint semantics. Live Codex work stays local/sandboxed, and production or external final-submit actions remain blocked until a future contract explicitly opens them.
