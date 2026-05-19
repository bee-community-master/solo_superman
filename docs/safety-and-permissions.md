# Safety and Permissions / 안전과 권한

## Non-negotiable posture / 절대 경계

Solo Superman can help prepare actions, but it must not silently perform risky work. Risky work includes file patch, shell command, browser action, network write, credential access, destructive operation, ChatGPT web automation, external-production mutation, payment/legal/medical/financial action, DNS cutover, account deletion, or final submit.

## Credential and account policy / 인증정보 정책

- No credential/2FA/session custody.
- No password, 2FA, session cookie, API key, ChatGPT credential, or payment secret storage.
- No account sharing/resale and no use of a user's ChatGPT Pro plan as shared backend capacity.
- The user must directly own and see any browser session used for local delegation.
- Redaction preview is required before storing prompt/result/screenshot/log artifacts that might contain sensitive context; users need export/delete controls for retained artifacts.

## ExecutionAuthorityRecord / 실행 권한 기록

An action is not executable until it has an `ExecutionAuthorityRecord` with bounded source, preview, approval, rollback, and evidence metadata.

Required rules:

- `approvalDecision` starts as `pending`; only user-visible approval can move it to approved.
- `executionResult` includes `running` and must end in a terminal evidence-backed state such as completed, failed, blocked, or partial.
- `rollbackReference` is mandatory before execution unless a later explicit contract says the action is preview-only.
- `file_diff` uses `git_diff_reverse` by default for rollback.
- `shell_command` needs command allowlist, timeout class, stdout/stderr evidence, and no credential prompt.
- `browser_action` needs loopback-only local targets for the MVP; LAN/private IP targets and cloud preview URLs stay blocked unless a later explicit contract permits them.

## Blocked by default / 기본 차단

The following remain blocked without a later explicit contract:

- hosted SaaS default replacing the local service.
- browser-only DB rewrite.
- blanket approval across action classes.
- destructive shell command.
- credential custody or credential/session/secret/2FA/payment/legal-sensitive field persistence.
- external-production mutation, final submit, deploy, purchase, account deletion, or irreversible service write.
- automated signup/login for external services.

## Service page-use permission / 외부 서비스 페이지 사용 권한

For Vercel, Supabase, Stripe, GitHub, domain/DNS, app stores, or similar SaaS pages, permission must use a ServicePageUsePermission style purpose-limited page-use permission, not account delegation.

A permission record must include service origin, purpose, allowed action classes, blocked action classes, visible data categories, approval granularity, revoke state, audit refs, and evidence refs. Filling a draft and final submit are different permissions; final submit remains blocked until a production-mutation contract exists.
