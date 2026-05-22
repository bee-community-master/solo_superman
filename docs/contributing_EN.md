# Contributing Guide

Language: [한국어](contributing_KO.md) | English

## Quick local setup

```sh
corepack enable
pnpm install
pnpm start:local
```

The local app opens a browser screen through the local web frontend and local Node/Hono service. Keep the terminal open while testing. The default local install/run path does not require an OpenAI API key, ChatGPT web credential, or ChatGPT Pro session.

## Useful commands

| Task | Command |
| --- | --- |
| Run local app | `pnpm start:local` |
| Web dev server only | `pnpm dev:web` |
| Sidecar service only | `pnpm dev:sidecar` |
| Typecheck | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| E2E smoke | `pnpm smoke:e2e` |
| Docs contract | `pnpm verify:docs` |
| Full gate (typecheck, lint, tests, docs contract, production bundle smoke) | `pnpm verify` |

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Local Web Frontend and user-visible screens. |
| `apps/sidecar` | Local Node/Hono Service, API routes, runtime adapters, local auth. |
| `packages/contracts` | Public DTOs, command/event/envelope types, API route catalog, SSE contracts. |
| `packages/core` | ProductEngine reducer, Spec/Research/Completeness logic, deterministic projections. |
| `packages/db` | Local embedded libSQL/Drizzle schema and repositories. |
| `scripts` | Local run, bundle smoke, docs contract verification. |
| `docs` | Contributor onboarding and code-backed reference contracts. |

## Contribution workflow

1. Start from current `main` and create a focused branch/worktree.
2. Read the relevant onboarding docs before editing code.
3. Make the smallest focused, reviewable change that solves the issue without widening unrelated behavior.
4. Update `docs/reference_KO.md` and `docs/reference_EN.md` if enum, DTO, route, or public contract values changed.
5. Run targeted tests first, then `pnpm verify` before final PR closeout; it includes the production bundle/local smoke gate.
6. Open a draft PR with evidence: what changed, what was tested, and known gaps.

## PR checklist

- Product language still avoids internal phase/tracker terms in user UI.
- Local-first assumptions remain true: no hosted SaaS default and no browser-only DB rewrite.
- File, shell, browser, credential, or external-production actions still require explicit authority boundaries.
- New route/DTO/enum values are reflected in `docs/reference_KO.md` and `docs/reference_EN.md` and pass `pnpm verify:docs`.
- README remains end-user short; detailed contributor or troubleshooting content lives under `docs/`.
