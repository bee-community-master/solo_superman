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
| `research-evidence-loop` | `pnpm verify:research-pipeline` |
| `planning-readiness-gates` | clarification/research evidence가 Planning-ready gate에 연결되는지 검증 |
| `browser-service-boundary` | `pnpm verify:browser-delegation-pipeline`, `pnpm verify:service-page-pipeline` |
| `auto-implementation-review-loop` | runtime preview, worker job, PR mutation, review-loop, aggregate pipeline smoke |
| `technical-preview-release-guardrails` | `pnpm verify:prod-bundle`, `pnpm verify:release-readiness` |

## 계약 규칙

- `coreProductStatus=code_backed`이면 capability가 `blocked`일 수 없습니다.
- capability가 `blocked`이면 `blocker`와 GitHub `blockerIssue`가 필요합니다.
- URL evidence ref는 HTTPS만 허용하며 userinfo credential이나 secret-like query parameter를 담을 수 없습니다.
- token/secret/password/API-key shaped 값은 어떤 string에도 남길 수 없습니다.
- default verification suite에는 `pnpm verify:product-capability-readiness`와 `pnpm verify`가 포함되어야 합니다.

## broad release와의 경계

이 계약이 통과해도 signed macOS/Windows package, packaged updater rollback, Windows real-device verification이 준비되었다는 뜻은 아닙니다. Broad/general release 판단은 [`release-readiness_KO.md`](release-readiness_KO.md), [`release-readiness.example.json`](release-readiness.example.json), `pnpm verify:release-readiness -- --require-ready`가 담당합니다.
