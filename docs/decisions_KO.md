# 결정과 이력

언어: 한국어 | [English](decisions_EN.md)

이 문서는 옛 numbered planning docs가 통합된 뒤에도 오래 유지되어야 하는 project decision을 보존합니다.

## 보존할 결정

| Decision | Why it matters | Rejected alternative |
| --- | --- | --- |
| Local-first Founder OS | User data, drafts, execution preparation은 기본적으로 local에 머물며, no hosted SaaS default rule이 이를 보호합니다. | Hosted SaaS default. |
| Web/local topology | Local Web Frontend + Local Node/Hono Service가 install/run과 browser UX를 단순하게 유지합니다. | New replacement native shell. |
| Tauri/native paths removed | Native app-host code path는 역사적 맥락이며 현재 architecture surface가 아닙니다. | Tauri/native shell을 future default로 되살리기. |
| Code-backed reference contract | Contract value는 source와 verifier에 의해 뒷받침되어야 합니다. | Copying contract values into prose without verifier coverage. |
| Local embedded libSQL + Drizzle | Local-first persistence와 deterministic test fixtures를 지원합니다. | Browser-only DB rewrite. |
| Codex SDK preview first | Default local path에서 OpenAI API key나 ChatGPT web session을 요구하지 않고, backend question/research preview는 local Codex CLI login을 확인합니다. | Asking every user for an API key or ChatGPT web credential during install. |
| ExecutionAuthorityRecord gate | File, shell, browser action에는 preview, approval, rollback, evidence가 필요합니다. | Blanket approval or silent auto-apply. |
| ChatGPT browser delegation is separate and per-run | 사용자가 browser session을 직접 보고 소유하며 각 run을 승인합니다. 이 path는 default Codex CLI preview login과 혼동하면 안 됩니다. | Credential custody, account sharing/resale, or stable backend treatment of ChatGPT web UI. |
| README remains short | End user에게는 install과 first run이 필요하지 implementation history가 필요하지 않습니다. | Using the root README as a planning ledger. |

## 과거 closeout 보존

옛 numbered docs에는 Phase 1~2, Phase 3, Post-Phase3 issue graph에 대한 자세한 closeout evidence가 들어 있었습니다. 현재 active contributor docs는 모든 historical ledger row가 아니라 결정과 guardrail을 보존합니다. audit에 원문 prose가 필요하면 git history를 사용합니다.

## 결정 추가 방법

미래 기여자가 같은 tradeoff를 다시 열 가능성이 있을 때 row를 추가합니다. 포함할 내용은 다음과 같습니다.

- 현재형으로 쓴 결정;
- 그 결정을 만든 constraint;
- rejected alternative;
- 가능하면 그것을 보호하는 verifier 또는 test surface.
