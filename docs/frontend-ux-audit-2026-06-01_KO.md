# Frontend UX audit - 2026-06-01

## Summary

`browser:control-in-app-browser`와 `build-web-apps:frontend-app-builder` 기준으로 Solo Superman Decision Queue 프론트엔드의 완성도를 점검했다. 이번 pass는 구현 수정이 아니라 추후 작업 가능한 GitHub issue 등록과 evidence 정리에 한정했다.

평가 대상은 `http://127.0.0.1:1420/`의 Decision Queue shell이다. `pnpm dev:web` 단독 실행과 `pnpm start:local` sidecar 연결 실행을 모두 확인했다.

## Browser evidence

- Desktop `1440x900`: 3열 shell 자체는 안정적으로 렌더링된다. 좌측 workflow rail, 중앙 workspace, 우측 planning radar가 명확하게 분리된다.
- Mobile `390x844`: `.desktop-shell`이 `960px` 폭으로 유지되어 horizontal clipping이 발생한다. 측정값은 `window.innerWidth=390`, `document.documentElement.scrollWidth=960`, `.desktop-body` grid columns `206px 494px 260px`였다.
- Connected local run: top-right connection badge가 `vite_env`로 표시되고, onboarding Codex 상태 영역에 `SOLO_CODEX_APP_SERVER_LIVE_TURNS=1` 같은 env guidance가 한국어 UI 안에 그대로 노출됐다.
- Onboarding first viewport: `1440x900`에서 `첫 질문 만들기` 버튼은 대략 `y=1198`에 있어 첫 화면 밖에 있다. visible workspace button은 `로컬 서비스 다시 연결`뿐이었다.
- Implementation tab: pre-session 상태에서 `.desktop-workspace` 안에 button `28`개가 있고, 그중 `24`개가 disabled였다. workspace scroll height는 약 `3703px`였다.
- Phase trail: topbar workflow가 `O`, `Q`, `R`, `P`, `I`, `A` 약어로 표시되어 신규 사용자가 의미를 바로 이해하기 어렵다.

## Issues registered

- Existing issue updated: [#490 Make Decision Queue shell usable on mobile-width viewports](https://github.com/bee-community-master/solo_superman/issues/490)
  - Added current Browser/IAB reproduction evidence in comment `https://github.com/bee-community-master/solo_superman/issues/490#issuecomment-4592151802`.
- New bug: [#492 Replace internal runtime/env markers with user-facing Decision Queue status copy](https://github.com/bee-community-master/solo_superman/issues/492)
- New enhancement: [#493 Keep the onboarding primary action visible with a progressive first-run flow](https://github.com/bee-community-master/solo_superman/issues/493)
- New enhancement: [#494 Replace cryptic phase-trail abbreviations with accessible workflow labels](https://github.com/bee-community-master/solo_superman/issues/494)
- New enhancement: [#495 Reduce Implementation tab disabled-action density into a guided readiness flow](https://github.com/bee-community-master/solo_superman/issues/495)

## UX assessment

The frontend has a coherent desktop operations-shell foundation: status rails, a central work surface, and a right-side planning radar all support repeated founder workflow use. The main gaps are not visual polish alone; they are workflow clarity and responsive readiness.

The highest-priority deficiency is mobile/narrow viewport usability. The app currently remains a desktop shell below mobile widths, so the active workspace is clipped. That is already tracked in #490.

The next priority is first-run action hierarchy. The first screen asks for idea, goal, project purpose, research mode, Codex state, and readiness blockers before the primary action becomes visible. This should become a progressive onboarding flow that keeps the next action and blockers near the user.

Finally, implementation and runtime surfaces expose too much internal machinery too early. Internal env/status names and long disabled-control lists should be mapped into product-level copy and staged readiness groups.

## Follow-up scope

This audit intentionally does not change runtime behavior, API contracts, sidecar discovery, storage, or ProductEngine state transitions. The next implementation PRs should address the issues independently so each UX change can be validated with focused Browser/IAB evidence and local checks.
