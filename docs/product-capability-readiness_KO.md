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
| `idea-clarification-loop` | `pnpm verify:clarification-pipeline`, `pnpm verify:clarification-volume` |
| `research-evidence-loop` | `pnpm verify:research-pipeline`이 mounted `web_search_readonly` provider polling, source-traced result import, evidence matrix/pack, follow-up question debt를 검증하고, product capability contract가 research follow-up의 answer-form variety를 필수 행동으로 고정 |
| `planning-readiness-gates` | clarification/research evidence가 Planning-ready gate에 연결되는지, `Composite score is 85 or higher`와 `Most confidence axes are 75 or higher`로 대부분의 readiness metric이 구체화된 뒤에만 implementation-ready가 되는지 검증 |
| `browser-service-boundary` | `pnpm verify:browser-delegation-pipeline`, `pnpm verify:service-page-pipeline`, `pnpm verify:production-mutation-contract` |
| `auto-implementation-review-loop` | runtime preview, opt-in `pnpm verify:codex-live-runtime` readiness evidence, worker job, PR mutation body summary, feature/repository code-review와 changed-code/repository clean-code의 2회 연속 no-finding gate, zero-gap missing-test audit, aggregate pipeline smoke |
| `technical-preview-release-guardrails` | `pnpm verify:prod-bundle`, `pnpm verify:release-readiness` |
| `local-error-reporting` | `pnpm verify:support-bundle`이 credential-free support diagnostics bundle, redaction, compact product/release diagnostics, ready-release plan-only summary, bundle preparation command, planned command list, issue-specific handoff를 검증 |

## 계약 규칙

- `coreProductStatus=code_backed`이면 capability가 `blocked`일 수 없습니다.
- capability가 `blocked`이면 `blocker`와 GitHub `blockerIssue`가 필요합니다.
- URL evidence ref는 HTTPS만 허용하며 userinfo credential이나 secret-like query parameter를 담을 수 없습니다.
- token/secret/password/API-key shaped 값은 어떤 string에도 남길 수 없습니다.
- default verification suite에는 `pnpm verify:support-bundle`, `pnpm verify:product-capability-readiness`, `pnpm verify`가 포함되어야 하며, supporting command에는 default suite에 live execution을 강제하지 않는 `pnpm verify:codex-live-runtime`, safe `pnpm verify:ready-release -- --plan-only`, `pnpm support:bundle`이 포함되어야 합니다.

## broad release와의 경계

이 계약이 통과해도 signed macOS/Windows package, packaged updater rollback, Windows real-device verification이 준비되었다는 뜻은 아닙니다. Broad/general release 판단은 [`release-readiness_KO.md`](release-readiness_KO.md), [`release-readiness.example.json`](release-readiness.example.json), `pnpm verify:release-readiness -- --require-ready`가 담당합니다.
