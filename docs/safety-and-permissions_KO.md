# 안전과 권한

언어: 한국어 | [English](safety-and-permissions_EN.md)

## 절대 경계

Solo Superman은 action 준비를 도울 수 있지만 위험한 작업을 조용히 수행하면 안 됩니다. 위험한 작업에는 file patch, shell command, browser action, network write, credential access, destructive operation, ChatGPT web automation, external-production mutation, payment/legal/medical/financial action, DNS cutover, account deletion, final submit이 포함됩니다.

## 인증정보 정책

- No credential/2FA/session custody.
- Password, 2FA, session cookie, API key, ChatGPT credential, payment secret을 저장하지 않습니다.
- account sharing/resale 금지. 사용자의 ChatGPT Pro plan을 shared backend capacity처럼 사용하지 않습니다.
- local delegation에 쓰는 browser session은 사용자가 직접 소유하고 볼 수 있어야 합니다.
- 민감한 context를 포함할 수 있는 prompt/result/screenshot/log artifact 저장 전에는 redaction preview가 필요하며, retained artifact에는 export/delete control이 필요합니다.

## ExecutionAuthorityRecord

Action은 bounded source, preview, approval, rollback, evidence metadata를 가진 `ExecutionAuthorityRecord`가 있어야 executable입니다.

필수 규칙:

- `approvalDecision`은 `pending`으로 시작하며, user-visible approval만 approved로 바꿀 수 있습니다.
- `executionResult`는 `running`을 포함하고 completed, failed, blocked, partial 같은 terminal evidence-backed state로 끝나야 합니다.
- Executable action에는 execution 전 `rollbackReference`가 필수입니다. Preview-only artifact는 execution이 아니므로 rollback evidence가 필요하지 않습니다.
- `file_diff`는 기본 rollback으로 `git_diff_reverse`를 사용합니다.
- `shell_command`는 command allowlist, timeout class, stdout/stderr evidence, no credential prompt가 필요합니다.
- `browser_action`은 MVP에서 loopback-only local targets만 허용합니다. LAN/private IP targets와 cloud preview URLs는 later explicit contract가 허용하기 전까지 blocked입니다.

## 기본 차단

아래 항목은 later explicit contract 없이 blocked입니다.

- local service를 대체하는 hosted SaaS default.
- browser-only DB rewrite.
- action class 전체에 대한 blanket approval.
- destructive shell command.
- credential/session/secret/2FA/payment/legal-sensitive field persistence.
- external-production mutation, final submit, deploy, purchase, account deletion, irreversible service write.
- external service에 대한 automated signup/login.

## 외부 서비스 페이지 사용 권한

Vercel, Supabase, Stripe, GitHub, domain/DNS, app stores 같은 SaaS page에는 account delegation이 아니라 purpose-limited ServicePageUsePermission style permission을 사용해야 합니다.

Permission record는 service origin, purpose, allowed action classes, blocked action classes, visible data categories, approval granularity, revoke state, audit refs, evidence refs를 포함해야 합니다. Draft filling과 final submit은 다른 permission입니다. final submit은 production-mutation contract가 생기기 전까지 blocked입니다.
