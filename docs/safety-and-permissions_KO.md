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

## Auto implementation workspace / 자동 구현 작업공간

Generated program은 product source file 안이 아니라 `workspace/<project>` 아래의 독립 local git repo에 생성됩니다. Workspace bootstrap은 local tracker/issue markdown file과 manifest를 만들고, 이후 diff와 rollback evidence를 위해 Solo Superman이 생성한 artifact만 clean local baseline으로 commit할 수 있습니다. 관련 없는 operator file은 stage하지 않아야 하며, later explicit remote-runner contract와 user-owned authentication boundary가 허용하기 전에는 remote GitHub issue 생성, PR 열기, branch merge, deploy, credential 저장을 수행하면 안 됩니다. Remote나 `gh` login이 없으면 visible local fallback과 connection command로 표현합니다.

Markdown-ready output은 GitHub mutation permission이 아닙니다. GitHub issue creation request는 명시적 `githubIssueCreation` mode, connected GitHub remote/login check, per-action approval, rollback, audit, verifier evidence를 갖춰야 external write를 할 수 있습니다. Approved 상태에서도 executor는 generated markdown issue document에 대한 `gh issue create`만 호출할 수 있고, 결과 GitHub issue URL을 local markdown path와 함께 저장해야 하며, generated issue-state markdown과 web issue row는 대응되는 GitHub issue URL을 노출해 URL 목록을 수동으로 대조하지 않게 해야 합니다. Generated workspace에 해당 URL이 기록된 뒤에는 같은 workspace에 대한 다른 approved issue-creation request가 adapter를 다시 호출하면 안 됩니다. `no_remote`, `not_authenticated`, `permission_denied`, `offline`, `unsupported_remote` 같은 remote state에서는 `githubIssueUrls`를 비워 두고 blocked mutation contract를 보여 주며 local markdown issue path를 계속 표시해야 합니다.

GitHub PR mutation은 action별로 permission을 요구합니다. `pullRequestMutations`는 read-only dry-run이나 approved `open_pr`, `update_pr_body`, `merge_pr` action을 기록할 수 있지만, approved write에는 connected remote status, per-action approval, rollback notes, audit refs, verifier evidence가 필요합니다. Generated PR body는 verification command만 의존하지 않고 local markdown issue/GitHub issue traceability, scope별 code-review/clean-code review ref, completed stage의 `ImplementationStepLedger` implementation/missing-test audit/test evidence ref를 노출해야 합니다. Approved `open_pr`는 `initial_pr`이 validated implementation ledger evidence로 completed되기 전에는 adapter를 호출하면 안 되고, run에 PR URL이 이미 기록되어 있으면 adapter를 호출하면 안 됩니다. PR body update는 current body evidence를 포함해야 합니다. PR merge는 current PR body evidence, merge-readiness evidence, completed `final_verify_pr_update` ledger evidence도 필요하며, merge가 기록된 뒤의 다른 approved `merge_pr`는 adapter 호출 전에 blocked되어야 합니다. Final `merge_main` stage 역시 applied PR merge mutation record와 `post-merge-verify:*` ledger test evidence가 모두 있어야 complete될 수 있으므로, run이 일반 ledger/test evidence만으로 completed를 주장할 수 없습니다. 하나라도 없으면 merge action은 blocked로 남고 injected/default `gh` adapter를 호출하지 않습니다.

Auto implementation stage는 timer만으로 completed가 될 수 없습니다. Generated tracker와 issue markdown은 worker execution이 시작되기 전에 scope별 review evidence slot을 남겨야 하며, stage별 issue-state section은 stage evidence ref, stage blocker evidence ref, latest worker evidence ref를 노출해야 하고, generated manifest, tracker run-state section, authoritative `issueManagement.issueDocs[].status` 값, issue status summary는 stage, worker, PR mutation transition 이후에도 최신 상태로 동기화되어야 합니다. Runner는 각 tick을 기록해야 하며, completed `ImplementationStepLedger` step이 commit/no-code evidence, code-review 및 clean-code review streak, gap 없는 missing-test audit, passing tests, blocker history를 증명할 때만 stage를 complete할 수 있습니다. `merge_main`은 run completed 표시 전에 recorded applied PR merge mutation과 post-merge verification evidence도 추가로 필요합니다. Local Codex worker job은 먼저 current issue document, 정확한 planned `ImplementationStepLedger` tracker/step doc, 허용된 workspace write scope, required evidence, 금지된 external/credential action, generated workspace로 scope되고 `no_secret_values`를 사용하는 ready-for-execution file-diff `ExecutionAuthorityRecord` ref를 포함한 bounded plan을 저장해야 하며, authority가 없거나 ready 상태가 아니면 visible blocked 상태로 남습니다. Worker run bridge는 generated workspace로 제한된 workspace-write root, approval policy `never`, network access disabled 조건의 local app-server turn으로만 Codex를 시작하며, runtime unavailable, job output mismatch, ledger evidence 누락은 visible worker blocker로 기록됩니다. Imported worker ledger transition은 Implementation UI에서 current-stage worker 대상으로 붙여넣을 수 있고, planned tracker/step doc과 일치해야 기존 `RecordImplementationStepLedger` reducer로 replay되며, ledger validation이 성공한 뒤에만 current-stage worker를 complete할 수 있습니다. Worker UI/action handler는 import, run, complete, advance target을 고를 때 completed previous-stage job을 무시해야 하며, `merge_main` advance는 applied PR merge record와 current-stage `post-merge-verify:*` ledger evidence가 모두 생길 때까지 비활성화해야 하고, latest current-stage worker를 run/import/complete/advance로 계속 처리할 수 있으면 다른 current-stage worker를 계획하지 않아야 합니다. 이후 worker stage-advance bridge도 동일한 stage completion validation을 재사용하므로 기존 stage endpoint semantics를 우회하지 않습니다. Live Codex work는 local/sandboxed 상태를 유지하고, production 또는 external final-submit action은 future contract가 명시적으로 열기 전까지 blocked입니다.
