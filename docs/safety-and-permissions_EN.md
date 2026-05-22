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

Generated programs live in independent local git repos under `workspace/<project>`, not inside product source files. The workspace bootstrap may create local tracker/issue markdown files and a manifest, but it must not create remote GitHub issues, open PRs, merge branches, deploy, or store credentials unless a later explicit remote-runner contract and user-owned authentication boundary allow that action. Missing remote or `gh` login is represented as a visible local fallback with connection commands.

Markdown-ready output is not permission to mutate GitHub. A GitHub issue creation request must carry an explicit `githubIssueCreation` mode, pass a connected GitHub remote/login check, and record per-action approval, rollback, audit, and verifier evidence before any external write can occur. Remote states such as `no_remote`, `not_authenticated`, `permission_denied`, `offline`, or `unsupported_remote` keep `githubIssueUrls` empty and expose a blocked mutation contract while local markdown issue paths remain visible.

Auto implementation stages cannot be completed from timers alone. The runner must record each tick and may only complete a stage when a completed `ImplementationStepLedger` step proves commit/no-code evidence, code-review and clean-code review streaks, passing tests, and blocker history. Local Codex worker jobs must first store a bounded plan with the current issue document, allowed workspace write scope, required evidence, forbidden external/credential actions, and an `ExecutionAuthorityRecord` reference; missing authority keeps the job visibly blocked. Live Codex work stays local/sandboxed, and production or external final-submit actions remain blocked until a future contract explicitly opens them.
