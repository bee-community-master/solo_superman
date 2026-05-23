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
| Release channel manifest contract | `pnpm verify:release-channel` |
| Packaged update rollback evidence contract | `pnpm verify:packaged-update-rollback` |
| Windows real-device evidence contract | `pnpm verify:windows-real-device` |
| Signed package credential-free preflight | `pnpm verify:signed-package-preflight` |
| Signed package release evidence contract | `pnpm verify:signed-package-release` |
| General release readiness gate | `pnpm verify:release-readiness` |
| Full gate (typecheck, lint, tests, docs/release/readiness/package contracts, production bundle smoke) | `pnpm verify` |

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Local Web Frontend and user-visible screens. |
| `apps/sidecar` | Local Node/Hono Service, API routes, runtime adapters, local auth. |
| `packages/contracts` | Public DTOs, command/event/envelope types, API route catalog, SSE contracts. |
| `packages/core` | ProductEngine reducer, Spec/Research/Completeness logic, deterministic projections. |
| `packages/db` | Local embedded libSQL/Drizzle schema and repositories. |
| `scripts` | Local run, bundle smoke, docs/release contract verification. |
| `docs` | Contributor onboarding and code-backed reference contracts. |

## Contribution workflow

1. Start from current `main` and create a focused branch/worktree.
2. Read the relevant onboarding docs before editing code.
3. Make the smallest focused, reviewable change that solves the issue without widening unrelated behavior.
4. Update `docs/reference_KO.md` and `docs/reference_EN.md` if enum, DTO, route, or public contract values changed.
5. Run targeted tests first, then `pnpm verify` before final PR closeout; it includes the docs/release/readiness/package contracts and production bundle/local smoke gate.
6. Open a draft PR with evidence: what changed, what was tested, and known gaps.

## PR checklist

- Product language still avoids internal phase/tracker terms in user UI.
- Local-first assumptions remain true: no hosted SaaS default and no browser-only DB rewrite.
- File, shell, browser, credential, or external-production actions still require explicit authority boundaries.
- New route/DTO/enum values are reflected in `docs/reference_KO.md` and `docs/reference_EN.md` and pass `pnpm verify:docs`.
- Packaged update channel changes update `docs/release-channel_KO.md`, `docs/release-channel_EN.md`, `docs/release-update-channel.example.json`, and `pnpm verify:release-channel` together.
- Packaged update rollback evidence changes update `docs/packaged-update-rollback_KO.md`, `docs/packaged-update-rollback_EN.md`, `docs/packaged-update-rollback.example.json`, and `pnpm verify:packaged-update-rollback` together.
- Windows real-device evidence changes update `docs/windows-real-device_KO.md`, `docs/windows-real-device_EN.md`, `docs/windows-real-device.example.json`, and `pnpm verify:windows-real-device` together.
- Signed package planning changes update `docs/signed-packages_KO.md`, `docs/signed-packages_EN.md`, `docs/signed-package-preflight.example.json`, and `pnpm verify:signed-package-preflight` together.
- Signed package release evidence changes update `docs/signed-package-release_KO.md`, `docs/signed-package-release_EN.md`, `docs/signed-package-release.example.json`, and `pnpm verify:signed-package-release` together.
- General release readiness changes update `docs/release-readiness_KO.md`, `docs/release-readiness_EN.md`, `docs/release-readiness.example.json`, and `pnpm verify:release-readiness` together.
- README remains end-user short; detailed contributor or troubleshooting content lives under `docs/`.
