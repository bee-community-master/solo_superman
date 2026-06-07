# Design Review: Solo Superman Decision Queue
**Date**: 2026-06-07
**URL**: http://127.0.0.1:1420/

## Overall Impression
The desktop shell has a coherent operations-tool foundation, but the current web experience still feels too much like an internal diagnostic console. The largest design gaps are mobile clipping, weak first-run action hierarchy, raw state copy, and overly dense disabled implementation controls.

## Findings

### High
- **Mobile shell clips the workspace** at Decision Queue shell - `390px` viewport renders as a `960px` document, leaving the active content cut off to the right -> create a real narrow layout that collapses rails and keeps document width within the viewport.
- **Primary onboarding action is below the fold** at first-run onboarding - the first viewport emphasizes reconnect/system recovery while `첫 질문 만들기` appears only after scrolling and remains disabled -> group next action, blockers, and required inputs near the top.

### Medium
- **Cryptic phase trail** at top navigation - `O/Q/R/P/I/A` labels require users to memorize workflow phases -> use localized readable short labels.
- **Internal state copy leaks into product UI** across the shell - `unavailable`, `handoff pending`, `not_started`, contract/version labels, and backend/Codex CLI details are visually prominent -> map raw states to founder-facing Korean copy and move diagnostics behind disclosure.
- **Implementation tab is too dense** - pre-session state has 29 workspace buttons, 24 disabled, and a 3844px workspace scroll height -> convert flat disabled controls into staged readiness sections.
- **Panel density weakens hierarchy** - repeated cards, shadows, borders, badges, and nested surfaces compete with the main task -> reduce secondary elevation and reserve stronger framing for the active work surface.

### Low
- **Brand mark looks like a hamburger control** on narrow layouts -> make it less menu-like or use it as a real nav control.
- **Small muted metadata may be hard to read** -> verify contrast and zoom behavior, then raise small label contrast or size where it carries workflow state.

## What Looks Good
Desktop IA is clear: left workflow rail, central workspace, and right planning radar are well separated. Active nav states are visible, the teal accent is consistent, and the form styling is restrained enough for a productivity tool.

## Top 3 Fixes
1. Build a real mobile/narrow shell.
2. Rework onboarding around the next action and blockers.
3. Replace raw states and disabled-control density with product-level readiness copy.

## Screenshots
- `docs/frontend-design-audit-2026-06-07/01-desktop-onboarding.png`
- `docs/frontend-design-audit-2026-06-07/02-desktop-questions.png`
- `docs/frontend-design-audit-2026-06-07/03-desktop-research.png`
- `docs/frontend-design-audit-2026-06-07/04-desktop-planning.png`
- `docs/frontend-design-audit-2026-06-07/05-desktop-implementation.png`
- `docs/frontend-design-audit-2026-06-07/06-desktop-permissions.png`
- `docs/frontend-design-audit-2026-06-07/07-desktop-onboarding-lower-cta.png`
- `docs/frontend-design-audit-2026-06-07/08-tablet-onboarding.png`
- `docs/frontend-design-audit-2026-06-07/09-mobile-onboarding.png`
