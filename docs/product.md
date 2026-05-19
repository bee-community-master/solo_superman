# Product Overview / 제품 개요

## One-line definition / 한 문장 정의

Solo Superman is a local-first Founder OS that turns a solo founder's rough idea into a concrete product spec, evidence-backed decisions, and a safe implementation handoff. Solo Superman은 초기 창업자의 막연한 아이디어를 제품 명세, 근거 있는 결정, 안전한 구현 준비로 바꾸는 로컬 우선 Founder OS입니다.

## Target user / 핵심 사용자

- Primary: early solo founders who need sharper product thinking before building.
- Secondary: builders using the app for personal workflow tools or internal experiments.
- Current release fit: users comfortable with a local technical preview and one terminal command.

## Core job-to-be-done / 핵심 JTBD

The app helps a founder move from idea fog to a concrete starting point:

| Area | Locked outcome |
| --- | --- |
| Problem | 문제와 고객 pain이 분명해진다. |
| Customer | 타깃 세그먼트와 first users가 분리된다. |
| Value | value proposition과 switching reason이 명확해진다. |
| Evidence | pro evidence, con evidence, uncertainty가 함께 남는다. |
| Scope | MVP/Build Slice가 과하지 않게 정리된다. |
| Risk | 남은 리스크와 next validation action을 알고 시작한다. |

## Session model / 세션 모델

- Default session: 2~5 hour focused clarification loop.
- Core surface: Decision Queue with 3~5 prioritized questions at a time.
- Output: Living Product Spec, Founder Brief, Build Slice Plan, Serve Checklist, Learning Loop Hook.
- Stop feeling: not “perfect certainty,” but “I know the remaining risks and can start deliberately.”

## Product modes / 프로젝트 목적 모드

Solo Superman supports two project-purpose modes. The code field is `projectPurposeMode`, and the app must ask or confirm the mode instead of silently guessing it.

| Mode | When used | Required focus |
| --- | --- | --- |
| `business` | 사업화, 출시, 유료화, 고객 검증 | customer, problem strength, willingness to pay, alternatives, channels, legal/operational risk, validation experiment |
| `personal` | 개인 workflow, 내부 도구, 학습/실험 | actual workflow, repeat frequency, input/output, local data/security, implementation cost, usability success criteria |

Business mode also requires an explicit `businessCriticIntensity`; it has no default value. Personal mode may skip commercialization axes such as market size, pricing, competition, acquisition channel, and investor narrative, but those skipped axes must be visible rather than hidden.

## UX doctrine / UX 원칙

- User-facing language uses journey terms: Spec-ready, Research in progress, Planning-ready, Waiting for safe execution.
- Internal terms like Phase 1, Phase 2.5, tracker, or PR number stay out of normal user UI.
- The question AI acts like a sharp product coach: it explains why it asks, challenges assumptions, and detects fatigue.
- Repeated questions must converge through topic keys and repeat limits; the app must not trap users in an infinite question loop.
- Risk UI should show Confidence Map, five-axis radar, and Top 3 Risk Cards when the data supports them.

## Current release / 현재 배포 범위

The current public posture is a technical preview. It proves the local web install/run path and keeps dangerous actions reviewable. It is not yet a broad consumer-grade installer with automatic updates, telemetry, or Windows real-device certification.
