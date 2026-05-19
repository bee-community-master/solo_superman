# Decisions and History / 결정과 이력

This file preserves durable project decisions after the old numbered planning docs were consolidated.

## Durable decisions / 보존할 결정

| Decision | Why it matters | Rejected alternative |
| --- | --- | --- |
| Local-first Founder OS | User data, drafts, and execution preparation stay local by default; the no hosted SaaS default rule protects this. | Hosted SaaS default. |
| Web/local topology | Local Web Frontend + Local Node/Hono Service keeps install/run and browser UX simple. | New replacement native shell. |
| Tauri/native paths removed | Native app-host code paths are historical context only; source/dependency/script routes are not active. This does not refer to the Windows `.cmd` Desktop runner used to restart the local web service. | Keeping a desktop shell as the future default. |
| ProductEngine owns decisions | A pure reducer plus effect plan keeps state transitions testable and auditable. | Hidden decision logic inside API handlers or adapters. |
| Contracts package is public boundary | DTO, command/event, API route, SSE, and projection names must be code-backed. | Copying contract values into prose without verifier coverage. |
| Local embedded libSQL + Drizzle | It supports local-first persistence and deterministic test fixtures. | Browser-only DB rewrite. |
| Codex app-server preview first | It avoids requiring an OpenAI API key or ChatGPT web session in the default local path; backend question/research preview checks local Codex CLI login instead. | Asking every user for an API key or ChatGPT web credential during install. |
| ExecutionAuthorityRecord gate | File, shell, and browser actions need preview, approval, rollback, and evidence. | Blanket approval or silent auto-apply. |
| ChatGPT browser delegation is separate and per-run | The user owns the browser session and approves each run; this path must not be confused with the default Codex CLI preview login. | Credential custody, account sharing/resale, or stable backend treatment of ChatGPT web UI. |
| README remains short | End users need installation and first run, not implementation history. | Using the root README as a planning ledger. |

## Historical closeout preservation / 과거 closeout 보존

The old numbered docs contained detailed closeout evidence for Phase 1~2, Phase 3, and Post-Phase3 issue graphs. The active contributor docs preserve the decisions and guardrails rather than every historical ledger row. If an audit needs the original prose, use git history for the removed numbered files.

## How to add a decision / 결정 추가 방법

Add a row when a future contributor would otherwise re-open the same tradeoff. Include:

- the decision in present-tense language;
- the constraint that shaped it;
- the rejected alternative;
- the verifier or test surface that protects it, if one exists.
