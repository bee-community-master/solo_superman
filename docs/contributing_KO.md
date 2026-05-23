# 기여 가이드

언어: 한국어 | [English](contributing_EN.md)

## 빠른 로컬 실행

```sh
corepack enable
pnpm install
pnpm start:local
```

로컬 앱은 local web frontend와 local Node/Hono service를 통해 브라우저 화면을 엽니다. 테스트하는 동안 터미널을 열어 두세요. 기본 local install/run path에는 OpenAI API key, ChatGPT web credential, ChatGPT Pro session이 필요하지 않습니다.

## 자주 쓰는 명령

| 작업 | 명령 |
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

## 레포 구조

| Path | Responsibility |
| --- | --- |
| `apps/web` | Local Web Frontend와 user-visible screens. |
| `apps/sidecar` | Local Node/Hono Service, API routes, runtime adapters, local auth. |
| `packages/contracts` | Public DTOs, command/event/envelope types, API route catalog, SSE contracts. |
| `packages/core` | ProductEngine reducer, Spec/Research/Completeness logic, deterministic projections. |
| `packages/db` | Local embedded libSQL/Drizzle schema and repositories. |
| `scripts` | Local run, bundle smoke, docs/release contract verification. |
| `docs` | Contributor onboarding and code-backed reference contracts. |

## 작업 흐름

1. current `main`에서 focused branch/worktree를 만듭니다.
2. 코드를 수정하기 전에 관련 온보딩 문서를 읽습니다.
3. unrelated behavior를 넓히지 않고 issue를 해결하는 가장 작은 reviewable change를 만듭니다.
4. enum, DTO, route, public contract value가 바뀌면 `docs/reference_KO.md`와 `docs/reference_EN.md`를 함께 갱신합니다.
5. 먼저 targeted tests를 실행하고, 최종 PR closeout 전에는 `pnpm verify`를 실행합니다. 이 명령은 docs/release/readiness/package contract와 production bundle/local smoke gate까지 포함합니다.
6. draft PR에는 changed scope, tested evidence, known gaps를 적습니다.

## PR 체크리스트

- Product language는 user UI에서 internal phase/tracker term을 피합니다.
- Local-first assumptions가 유지됩니다: no hosted SaaS default, no browser-only DB rewrite.
- File, shell, browser, credential, external-production action은 여전히 explicit authority boundary를 요구합니다.
- 새 route/DTO/enum value는 `docs/reference_KO.md`와 `docs/reference_EN.md`에 반영되고 `pnpm verify:docs`를 통과합니다.
- Packaged update channel 변경은 `docs/release-channel_KO.md`, `docs/release-channel_EN.md`, `docs/release-update-channel.example.json`, `pnpm verify:release-channel`을 함께 갱신합니다.
- Packaged update rollback evidence 변경은 `docs/packaged-update-rollback_KO.md`, `docs/packaged-update-rollback_EN.md`, `docs/packaged-update-rollback.example.json`, `pnpm verify:packaged-update-rollback`을 함께 갱신합니다.
- Windows real-device evidence 변경은 `docs/windows-real-device_KO.md`, `docs/windows-real-device_EN.md`, `docs/windows-real-device.example.json`, `pnpm verify:windows-real-device`를 함께 갱신합니다.
- Signed package planning 변경은 `docs/signed-packages_KO.md`, `docs/signed-packages_EN.md`, `docs/signed-package-preflight.example.json`, `pnpm verify:signed-package-preflight`를 함께 갱신합니다.
- Signed package release evidence 변경은 `docs/signed-package-release_KO.md`, `docs/signed-package-release_EN.md`, `docs/signed-package-release.example.json`, `pnpm verify:signed-package-release`를 함께 갱신합니다.
- General release readiness 변경은 `docs/release-readiness_KO.md`, `docs/release-readiness_EN.md`, `docs/release-readiness.example.json`, `pnpm verify:release-readiness`를 함께 갱신합니다.
- README는 end-user short entrypoint로 남고, 기여자/문제 해결 세부 내용은 `docs/` 아래에 둡니다.
