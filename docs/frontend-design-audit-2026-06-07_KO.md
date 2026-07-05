# Web Design Audit - 2026-06-07

## Summary

`http://127.0.0.1:1420/`에서 Solo Superman Decision Queue shell을 한국어 UI 기준으로 검수했다. 이번 pass는 제품 코드 수정 없이, 웹 화면의 UX 저해 요소, 일관성 부족, 심미적 보강 포인트를 스크린샷 증거와 함께 문서화하는 데 한정했다.

전반적으로 데스크톱 운영 shell의 골격은 안정적이다. 좌측 workflow rail, 중앙 workspace, 우측 planning radar가 명확히 분리되어 반복 작업용 도구라는 인상이 분명하다. 다만 모바일/좁은 뷰포트에서는 화면이 깨진 것처럼 보이고, 첫 실행 흐름과 구현 탭은 내부 상태와 비활성 액션을 너무 일찍 노출해 사용자가 다음 행동을 고르기 어렵다.

## Evidence

| Step | Screenshot | Health |
| --- | --- | --- |
| 1. Desktop onboarding first viewport | [01-desktop-onboarding.png](frontend-design-audit-2026-06-07/01-desktop-onboarding.png) | Needs work |
| 2. Desktop questions | [02-desktop-questions.png](frontend-design-audit-2026-06-07/02-desktop-questions.png) | Needs work |
| 3. Desktop research | [03-desktop-research.png](frontend-design-audit-2026-06-07/03-desktop-research.png) | Mostly healthy |
| 4. Desktop planning | [04-desktop-planning.png](frontend-design-audit-2026-06-07/04-desktop-planning.png) | Needs work |
| 5. Desktop implementation | [05-desktop-implementation.png](frontend-design-audit-2026-06-07/05-desktop-implementation.png) | Needs work |
| 6. Desktop permissions | [06-desktop-permissions.png](frontend-design-audit-2026-06-07/06-desktop-permissions.png) | Mostly healthy |
| 7. Onboarding lower CTA | [07-desktop-onboarding-lower-cta.png](frontend-design-audit-2026-06-07/07-desktop-onboarding-lower-cta.png) | Needs work |
| 8. Tablet/narrow onboarding | [08-tablet-onboarding.png](frontend-design-audit-2026-06-07/08-tablet-onboarding.png) | Needs work |
| 9. Mobile onboarding | [09-mobile-onboarding.png](frontend-design-audit-2026-06-07/09-mobile-onboarding.png) | Broken |

Capture notes:

- Browser was opened first against the local URL. Saved evidence screenshots were captured with the approved Playwright fallback because the exposed Browser tools did not provide a screenshot-save API.
- Desktop viewport: `1440x900`.
- Tablet/narrow viewport: `960x720`.
- Mobile viewport: `390x844`.
- Mobile measurement: `window.innerWidth=390`, `document.documentElement.scrollWidth=960`, `document.body.scrollWidth=960`.
- Implementation tab measurement: workspace scroll height `3844px`, client height `848px`, workspace buttons `29`, disabled workspace buttons `24`.

## Findings

### High

- **Mobile viewport keeps a desktop-width shell** at Decision Queue shell - the 390px capture shows the app clipped to a 960px document width, with the left rail consuming most of the screen and the active workspace cut off to the right. The right rail also remains part of the document flow. This looks broken, not just unoptimized. Fix by switching below 960px to a real mobile shell: collapse workflow navigation into a compact top/step control, hide or move the right rail below the workspace, and ensure `documentElement.scrollWidth <= viewport width`. Evidence: [09-mobile-onboarding.png](frontend-design-audit-2026-06-07/09-mobile-onboarding.png).

- **First-run primary action is not available in the first viewport** at onboarding - at `1440x900`, the visible workspace actions are reconnect controls, while the actual `첫 질문 만들기` action appears only after scrolling to the lower form and is disabled behind several setup blockers. This weakens action hierarchy: the user sees system connection recovery before the product's main next step. Fix by turning onboarding into a progressive first-run panel with the next action, blockers, and required fields grouped near the top. Evidence: [01-desktop-onboarding.png](frontend-design-audit-2026-06-07/01-desktop-onboarding.png), [07-desktop-onboarding-lower-cta.png](frontend-design-audit-2026-06-07/07-desktop-onboarding-lower-cta.png).

### Medium

- **Phase trail labels are cryptic** in the top navigation - desktop and mobile show `O`, `Q`, `R`, `P`, `I`, `A`, which makes the workflow hard to parse for new users and screen magnification users. The left rail has full labels, so the top trail should use readable short words or be visually secondary. Fix by using localized short labels such as `시작`, `질문`, `리서치`, `계획`, `구현`, `권한`, with truncation only when space genuinely requires it. Evidence: [01-desktop-onboarding.png](frontend-design-audit-2026-06-07/01-desktop-onboarding.png), [09-mobile-onboarding.png](frontend-design-audit-2026-06-07/09-mobile-onboarding.png).

- **Internal state copy leaks into the UI** across the shell - Korean screens still show raw English/system markers such as `unavailable`, `handoff pending`, `not_started`, `SOLO-SUPERMAN.CONTRACTS.V1`, and backend/Codex CLI implementation details. This makes the interface feel like an internal diagnostics console rather than a founder-facing product. Fix by mapping raw states to product-level Korean labels and moving diagnostic details behind disclosure controls. Evidence: [01-desktop-onboarding.png](frontend-design-audit-2026-06-07/01-desktop-onboarding.png), [05-desktop-implementation.png](frontend-design-audit-2026-06-07/05-desktop-implementation.png).

- **Implementation tab overloads users with disabled controls** - pre-session implementation state contains 29 workspace buttons, 24 disabled, and a `3844px` workspace scroll height. The first viewport already shows several gated rows and disabled buttons before explaining a single next action. Fix by replacing the flat disabled-control list with a readiness checklist and only revealing controls when their prerequisite stage is active. Evidence: [05-desktop-implementation.png](frontend-design-audit-2026-06-07/05-desktop-implementation.png).

- **Nested panels and heavy shadows make dense states feel busier than necessary** - desktop cards are visually consistent, but repeated white panels, inset boxes, shadows, badges, and status cards create a high border density. In onboarding and implementation, this competes with form labels and next-step guidance. Fix by reducing elevation on secondary panels, grouping related setup blocks with lighter dividers, and reserving shadow for the main active work surface. Evidence: [01-desktop-onboarding.png](frontend-design-audit-2026-06-07/01-desktop-onboarding.png), [05-desktop-implementation.png](frontend-design-audit-2026-06-07/05-desktop-implementation.png).

### Low

- **Brand mark reads like a hamburger control** - the top-left mark uses three horizontal bars and sits where users often expect a menu button, but it is decorative. On mobile, where navigation is already constrained, this can create false affordance. Fix by making the mark less menu-like or by making it a real navigation control in narrow layouts. Evidence: [09-mobile-onboarding.png](frontend-design-audit-2026-06-07/09-mobile-onboarding.png).

- **Very small muted labels may be hard to read** - rail metadata and status captions use small sizes and low-contrast muted colors. Screenshots alone do not prove a WCAG failure, but these labels should be checked with computed contrast and zoom. Fix by raising small label size or contrast where the label carries workflow state. Evidence: [01-desktop-onboarding.png](frontend-design-audit-2026-06-07/01-desktop-onboarding.png).

## What Looks Good

- Desktop information architecture is clear: workflow rail, active workspace, and planning radar each have a distinct job.
- Active navigation states are visible through background, accent color, and status orb changes.
- The form field styling is restrained and consistent, with calm surfaces and a clear teal accent.
- The right rail gives useful at-a-glance completeness and research status without requiring a modal or extra route.

## Top 3 Fixes

1. Build a real narrow/mobile shell so the document width matches the viewport and the active workspace is not clipped.
2. Rework onboarding into a progressive first-run flow with the primary next action and blockers visible near the top.
3. Replace raw/internal status labels and dense disabled controls with localized product-level readiness states.

## Accessibility And Evidence Limits

This pass is based on current screenshots, DOM-level measurements, and visible interaction states. It can identify visible risks such as clipping, unclear labels, tiny muted text, and disabled-action overload, but it does not claim full WCAG compliance. A follow-up accessibility pass should test keyboard traversal, focus visibility, semantic announcements, reduced motion, zoom at 200%, and computed color contrast.

## Follow-up Scope

This audit does not change runtime behavior, API contracts, sidecar discovery, storage, ProductEngine state transitions, or GitHub issue state. It should be used as design evidence for focused implementation PRs.
