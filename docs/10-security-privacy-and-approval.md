# 10. Security, Privacy, and Approval

## 원칙

초기 창업자의 아이디어와 리서치 노트는 민감 정보다. Solo Superman은 기본적으로 local-first여야 하며, 사용자가 명시적으로 허용하지 않은 동기화나 외부 전송을 하면 안 된다.

## 데이터 위치 정책

| 데이터 | 기본 위치 | 외부 전송 조건 |
| --- | --- | --- |
| raw idea | local SQLite | 사용자가 LLM/research 전송 승인 |
| Living Product Spec | local SQLite | optional sync opt-in |
| answers | local SQLite | 연결된 research/LLM task 승인 |
| research sources | local cache | public URL fetch 가능, private 자료는 승인 필요 |
| decisions | local SQLite | optional sync opt-in |
| secrets | OS keychain/encrypted store | 전송 금지 |

## Sync 정책

- 프로젝트는 기본 `local_only`다.
- sync는 프로젝트 단위로 켠다.
- sync를 켤 때 사용자는 어떤 데이터가 cloud에 저장되는지 봐야 한다.
- sync를 꺼도 local 데이터가 삭제되지 않는다.
- sync 오류는 Spec 작업을 막지 않는다.

## 외부 LLM/리서치 호출 전 disclosure

Phase 1은 프로젝트 단위 포괄 위임이 아니라 **task-level disclosure + sandbox preview**를 기본으로 한다. 사용자에게 다음을 보여준다.

- 전송될 정보 요약.
- 목적.
- 사용될 provider/runtime.
- 저장 여부.
- 민감한 section 제외 여부.
- 결과가 실제 파일/쉘/브라우저에 적용되지 않고 preview artifact로만 남는다는 점.

Phase 2.5+에서 ChatGPT Pro 웹 자동화 후보를 검토하면 per-run delegation 설명을 사용한다. 이때는 run 승인 화면, revoke control, audit log, fallback chain이 필수다. Phase 3 controlled execution은 `36-phase3-controlled-execution-contract.md`를 따르며 local-first web app + local Node/Hono service 위에서 preview, explicit approval, rollback, audit evidence를 요구한다.

Phase 1.5A의 예외는 `30-phase1.5-research-runtime-and-readiness-contract.md`가 정의한 **project-level read-only research allowlist**뿐이다. 이 allowlist는 외부 write/action/browser/file/shell 실행을 허용하지 않으며, automatic external transfer는 public-safe summary + research objective까지만 허용한다. private document, full raw idea, detailed answers, credentialed source는 항상 task-level approval 또는 manual handoff가 필요하다.

## Approval boundary

### 자동 허용 가능

- 문장 정리.
- section 재배치.
- 중복 제거.
- source link 연결.
- already-approved decision의 일관 반영.
- low-risk completeness score 업데이트.

### 사용자 승인 필수

- primary customer 변경.
- problem statement 확정.
- value proposition 확정.
- MVP scope 변경.
- success criteria 변경.
- validation experiment 확정.
- phase boundary 변경.
- cloud sync 활성화.
- private document 외부 분석.
- Codex가 file/shell/browser approval request를 생성하는 경우.
- code/file/browser execution.
- Phase 3 `ExecutionAuthorityRecord.approvalDecision` 승인.

## Decision approval 상태

```text
proposed → approved
         → rejected
         → revised
         → deferred
```

- `approved`: SpecVersion에 반영 가능.
- `rejected`: 추천안 폐기, 관련 질문 재생성 가능.
- `revised`: 사용자가 수정한 결정으로 재평가.
- `deferred`: Open Questions에 남기고 완료 가능성 판단에 반영.

## Runtime permission tiers

### Tier 0: Local document operations

- Spec drafting.
- local scoring.
- local question generation.
- SQLite read/write.

Phase 1 기본 허용.

### Tier 1: External research/LLM calls

- public web research.
- LLM analysis.
- source summarization.

사용자에게 데이터 전송 범위를 설명한다.

### Tier 1A: Codex app-server sandbox preview

- Codex app-server thread 생성.
- Spec/Research 분석.
- 질문 생성.
- 리서치 프롬프트와 import template 생성.
- diff/command/browser action plan preview.

Phase 1 primary AI runtime 권한이다. 실제 파일 patch, shell command, browser action 적용은 금지한다. Codex approval request가 발생하면 Approval Manager는 `preview_only`, `decline`, Phase 2 planning handoff, 또는 Phase 3 authority gate 후보로 라우팅한다.

### Tier 1B: Phase 1.5A read-only research allowlist

- project-level connector/source category allowlist.
- public-safe summary + research objective automatic disclosure.
- revoke/pause control.
- audit/disclosure log.
- rate/budget/staleness limits.

Phase 1.5A에서만 허용되는 read-only research 권한이다. 세부 계약은 `30-phase1.5-research-runtime-and-readiness-contract.md`를 따른다.

### Tier 2: Cloud sync

- Supabase Auth/Postgres/Realtime/Storage.

프로젝트 단위 opt-in 필요.

### Tier 3: Browser automation

- Playwright/Browser-use browsing.
- form fill/action preview.

Phase 1 구현 제외. Phase 2.5에서는 `34-phase2.5-browser-automation-preview-contract.md`의 Browser Automation Preview 계약에 따라 ChatGPT Pro/Deep Research delegation을 포함해 검토할 수 있으며, delegation 설명, revoke, audit log, session failure fallback, research quality comparison이 필요하다. Phase 3 이후 첫 live 목표는 `37-post-phase3-full-vision-backlog-contract.md`의 per-run 승인형 로컬 브라우저 자동화다.

### Tier 4: File/code/shell execution

- file patch.
- shell command.
- code generation applied to repo.

Phase 1~2.5 실제 적용 제외. Codex sandbox preview artifact는 허용할 수 있지만, Phase 3 실제 적용은 `36-phase3-controlled-execution-contract.md`의 `ExecutionAuthorityRecord`, preview + approval + rollback + audit가 필수다. Local Node/Hono Service는 loopback-only로 bind하고, 실행 route는 per-run local capability token, idempotency key, preview hash, authority record id, expiry check를 요구한다.

## ChatGPT Pro local browser delegation boundary

ChatGPT Pro 웹 자동화의 Phase 2.5 설명은 active permission 자체가 아니다. Phase 2.5에서는 risk-gated preview/delegation explanation만 검증하고, Phase 3 이후 첫 live 목표는 `37-post-phase3-full-vision-backlog-contract.md`의 per-run 승인형 로컬 브라우저 자동화다. 최초 run 승인 시 사용자는 다음을 봐야 한다.

- ChatGPT 웹이 어떤 deep research 목적에 쓰이는가.
- 어떤 project context가 전송될 수 있는가.
- 어떤 private data는 전송하지 않는가.
- 사용자가 직접 로그인한 local browser session만 사용하며, 제품은 비밀번호/2FA/session cookie/API key를 저장하거나 대리 입력하지 않는다는 점.
- 자동화 실패 시 수동 프롬프트 핸드오프와 `17-ai-runtime-access-strategy.md`가 정의한 공식 Codex 경로 fallback이 적용된다는 점.
- 이번 run을 revoke하거나 중단할 수 있는 위치.
- audit log에 남는 항목.
- 승인된 prompt/result/screenshot/log는 연구 근거로 기본 보존되지만 credential/session/secret/2FA/payment/legal-sensitive field는 저장하지 않고, 저장 전 redaction preview와 사용자 export/delete control이 제공된다는 점.

Per-run delegation은 계정 공유, credential/session custody, 제3자 서비스 구동/재판매, unattended background queue를 의미하지 않는다. 이런 후보는 `DelegationRiskGate`, `ExecutionAuthorityRecord`, 또는 `ServicePageUsePermission` gate에서 block verdict로 수렴한다.

## External service page-use permission boundary

외부 서비스 가입/로그인/설정 페이지를 사용할 때 권한은 계정 대리 보관이 아니라 page-use permission이어야 한다. 후속 구현은 `37-post-phase3-full-vision-backlog-contract.md`의 `ServicePageUsePermission` 계약을 따른다.

- 사용자가 직접 로그인한 페이지에서만 작업한다.
- read, fill draft, preview, copy generated value, final submit request를 action class로 분리한다.
- final submit, 결제, 법률/의료/금융/개인정보 제출, production deploy, DNS cutover, account deletion은 별도 explicit contract 전까지 blocked다.
- 모든 page-use permission은 revoke state, audit refs, evidence refs를 가져야 한다.
- page-use artifact를 보존할 때도 credential/session/secret/2FA/payment/legal-sensitive field는 저장하지 않으며, redaction preview와 사용자 export/delete control이 필수다.

## Phase 3 local web security contract

Phase 3 web/local 방향은 hosted SaaS default가 아니다. Local Web Frontend는 browser UI이고 Local Node/Hono Service는 loopback-only execution authority boundary다.

- Non-health local API는 per-run local capability token 없이는 접근할 수 없다.
- CORS는 `127.0.0.1`, `localhost`, `[::1]` 기반의 명시적 loopback web origin만 허용하며 동적 로컬 포트는 허용한다.
- hosted web origin은 local sidecar 실행 권한을 묵시적으로 얻지 않는다.
- CSRF/replay 방지를 위해 approval/execution route는 idempotency key, preview hash, `ExecutionAuthorityRecord.recordId`, expiry check를 검증해야 한다.
- local token은 Codex credential, ChatGPT session, API key, durable user secret이 아니며 disk persistence 금지다.
- external-production browser mutation, destructive action, credential value access는 별도 narrower contract 전까지 blocked로 수렴한다.


## Audit log

모든 high-impact action은 audit log에 남긴다.

필드:

- actor: user, ai, runtime.
- action type.
- before/after summary.
- linked decision/evidence.
- timestamp.
- approval status.

## 신뢰 UX

- “AI가 바꾼 것”과 “사용자가 승인한 것”을 구분한다.
- 리서치 출처를 숨기지 않는다.
- 불확실성은 점수 하락 요인으로 보여준다.
- 완료 선언 때 남은 리스크를 명시한다.

## 금지 사항

- private idea를 사용자 모르게 cloud에 저장하지 않는다.
- 핵심 결정을 AI 추천만으로 확정하지 않는다.
- 외부 출처가 없는 시장 주장을 확정 문장으로 쓰지 않는다.
- Phase 1에서 자동 코드 실행을 제공하지 않는다.
- Phase 1에서 ChatGPT 웹 자동화를 제공하지 않는다.
- Codex app-server를 붙이더라도 Phase 1에서는 sandbox preview 권한을 넘지 않는다.
- Phase 3에서도 hosted web origin에 local execution authority를 묵시적으로 주지 않는다.
- Phase 3에서도 `ExecutionAuthorityRecord` 없는 file/shell/browser 실행 claim을 인정하지 않는다.
- ChatGPT Pro no-API-key 경로도 사용자 소유 local browser session, per-run approval, no credential custody, no account sharing/resale, revoke/audit/fallback을 만족해야 한다.
- 외부 서비스 로그인은 unattended signup/login으로 실행하지 않으며, 사용자가 현존하고 중단할 수 있는 page-use permission 안에서만 다룬다.
