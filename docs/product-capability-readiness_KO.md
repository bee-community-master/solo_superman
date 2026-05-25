# 제품 capability readiness 계약

언어: 한국어 | [English](product-capability-readiness_EN.md)

이 문서는 technical preview의 **core product loop**가 실제 code-backed 상태인지 확인하는 `solo-superman-product-capability-readiness.v1` 계약입니다. Broad/general release 준비도는 [`release-readiness_KO.md`](release-readiness_KO.md)가 별도로 다루며, 이 계약은 signing credential, Windows device lab, packaged updater evidence를 요구하지 않습니다.

## 왜 필요한가

Solo Superman의 핵심 목표는 막연한 아이디어를 질문, 리서치, readiness 판단, staged implementation PR loop로 이어 가는 것입니다. 기능이 여러 smoke와 문서에 흩어져 있으면 다음 구현자가 “무엇이 이미 구현됐고 어떤 검증이 그 주장을 증명하는지”를 다시 추측하게 됩니다. 이 계약은 core product capability마다 필요한 local verifier와 source ref를 한 곳에 고정합니다.

## 검증 명령

```sh
pnpm verify:product-capability-readiness
pnpm verify:product-capability-readiness -- --require-code-backed
```

기본 모드는 [`product-capability-readiness.example.json`](product-capability-readiness.example.json)을 검사해 schema, required capability id, required verification command, evidence ref, secret-free string을 검증합니다. `--require-code-backed`는 모든 technical-preview core capability가 `code_backed` 상태일 때만 통과합니다. 현재 example contract는 모두 `code_backed`이며, broad release blocker는 `release-readiness` 계약으로 분리되어 있습니다.

## 필수 capability

| capability id | 통과해야 하는 핵심 evidence |
| --- | --- |
| `idea-clarification-loop` | `pnpm verify:clarification-pipeline`, `pnpm verify:clarification-volume`; product capability contract가 질문 카드와 생성 후속 질문의 주관식/서술형 open question, 찬반, 하나 선택, 하나 이상 선택 answer-form variety, prompt artifact 기반 generated JSON 초기 질문, deterministic fallback까지 이어지는 모호성 차원/사실확인·현재 리서치·인간 판단 분리, 최소 하나의 pressure question, source-seeking research task, answer-triggered researchQuestion 연결, 비차단 답변 제출을 필수 행동으로 고정해, 답변 저장 후 백그라운드 리서치 시작/queue refill이 이어져도 사용자를 멈추지 않도록 검증 |
| `research-evidence-loop` | `pnpm verify:research-pipeline`이 mounted `web_search_readonly` provider polling, source-traced result import, evidence matrix/pack, follow-up question debt, generated follow-up research run, markdown memory 저장/재사용을 검증하고, opt-in `pnpm verify:research-pipeline:live-web`은 실제 public-web 접근이 가능한 환경에서 fixture URL이 아닌 공개 source URL import 경로를 검증합니다. product capability contract는 evidence synthesis 이후 sourceQueueItemId로 연결된 planned research task와 `research_evidence_effect` 대기 작업, research follow-up의 open_text narrative, binary_choice pro/con decision, single_choice one-of-many, multi_select one-or-more, ranked_choice, evidence_judgment answer-form variety와 Research tab의 `Max simultaneous research runs`/`Max research runs per session` 한도 조절 UX를 필수 행동으로 고정 |
| `planning-readiness-gates` | clarification/research evidence가 Planning-ready gate에 연결되는지, `Composite score is 85 or higher`, `Most confidence axes are 75 or higher`, `Core ambiguity dimensions are 75 or higher`로 대부분의 readiness metric과 목표·범위/비목표·성공 기준·결정권 바닥 기준이 구체화된 뒤에만 implementation-ready가 되는지 검증하며, `pnpm verify:readiness-to-implementation`으로 positive readiness handoff가 Planning Handoff와 첫 auto-implementation run으로 이어지는지 검증 |
| `browser-service-boundary` | `pnpm verify:browser-delegation-pipeline`, `pnpm verify:service-page-pipeline`, `pnpm verify:production-mutation-contract`; 보이는 ChatGPT handoff와 result import gate가 disclosure/approval/revoke/evidence refs와 함께 유지되는지 검증 |
| `auto-implementation-review-loop` | runtime preview, opt-in `pnpm verify:codex-live-runtime` readiness evidence, opt-in `pnpm verify:worker-job:live` worker evidence, stage delivery issue보다 먼저 `issueManagement.planningIssueDocs`, 별도 PR issue sequence tracker, tracker/UI에 Planning-derived PR-sized issue doc을 1급 상태로 노출하고, 선택된 `planningIssueId` run에서 이전 slice는 completed, 선택 slice는 active, 이후 slice는 planned로 표시, worker job, PR mutation body summary, 승인된 `gh` PR 생성/본문 갱신의 임시 body-file handoff, feature/repository code-review와 changed-code/repository clean-code의 2회 연속 no-finding gate, zero-gap missing-test audit, `merge_main` 전 전체 검증 명령이 담긴 최종 PR body 갱신, aggregate pipeline smoke, `pnpm verify:single-session-product-loop`의 same-session pet-lifecycle idea → domain-fit question → answer-linked research → follow-up question → Planning Handoff → initial_pr smoke, credential-free `pnpm verify:single-session-product-loop:worker`의 same-session worker smoke, opt-in `pnpm verify:single-session-product-loop:live-web`의 같은 경로 + fixture가 아닌 public-web source URL import smoke, opt-in `pnpm verify:single-session-product-loop:live-implementation`의 same-session live-web plus live-worker smoke, `pnpm verify:readiness-to-implementation`의 spec_ready → planning_ready → initial_pr smoke, `pnpm verify:core-product-loop`의 end-to-end core product loop smoke |
| `technical-preview-release-guardrails` | `pnpm verify:prod-bundle`, `pnpm verify:release-readiness` |
| `local-error-reporting` | `pnpm verify:support-bundle`이 credential-free support diagnostics bundle, redaction, compact product/release diagnostics, ready-release plan-only summary, bundle preparation command, planned command list, release evidence blocker summary count, issue-specific handoff evidence item을 검증 |

## 계약 규칙

- `coreProductStatus=code_backed`이면 capability가 `blocked`일 수 없습니다.
- capability가 `blocked`이면 `blocker`와 GitHub `blockerIssue`가 필요합니다.
- URL evidence ref는 HTTPS만 허용하며 userinfo credential이나 secret-like query parameter를 담을 수 없습니다.
- token/secret/password/API-key shaped 값은 어떤 string에도 남길 수 없습니다.
- default verification suite에는 `pnpm verify:single-session-product-loop`, `pnpm verify:single-session-product-loop:worker`, `pnpm verify:readiness-to-implementation`, `pnpm verify:core-product-loop`, `pnpm verify:support-bundle`, `pnpm verify:product-capability-readiness`, `pnpm verify`가 포함되어야 하며, supporting command에는 default suite에 live execution을 강제하지 않는 `pnpm verify:codex-live-runtime`, `pnpm verify:worker-job:live`, `pnpm verify:single-session-product-loop:live-web`, `pnpm verify:single-session-product-loop:live-implementation`, safe `pnpm verify:ready-release -- --plan-only`, `pnpm support:bundle`이 포함되어야 합니다.

## broad release와의 경계

이 계약이 통과해도 packaged updater rollback, Windows real-device verification, 또는 optional signed-package hardening이 준비되었다는 뜻은 아닙니다. Broad/general release 판단은 [`release-readiness_KO.md`](release-readiness_KO.md), [`release-readiness.example.json`](release-readiness.example.json), `pnpm verify:release-readiness -- --require-ready`가 담당합니다.
