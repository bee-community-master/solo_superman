# Product Overview

Language: [한국어](product_KO.md) | English

## One-line definition

Solo Superman is a local-first Founder OS that turns a solo founder's rough idea into a concrete product spec, evidence-backed decisions, and a safe implementation handoff.

## Target user

- Primary: early solo founders who need sharper product thinking before building.
- Secondary: builders using the app for personal workflow tools or internal experiments.
- Current release fit: users comfortable with a local technical preview and one terminal command.

## Core job-to-be-done

The app helps a founder move from idea fog to a concrete starting point:

| Area | Locked outcome |
| --- | --- |
| Problem | The problem and customer pain are clear. |
| Customer | Target segments and first users are separated. |
| Value | Value proposition and switching reason are explicit. |
| Evidence | Pro evidence, con evidence, and uncertainty remain visible together. |
| Scope | MVP/Build Slice stays deliberately small. |
| Risk | Remaining risks and the next validation action are known before building. |

## Session model

- Default session: 2~5 hour focused clarification loop.
- Core surface: Decision Queue with 3~5 prioritized questions at a time; questions must be grounded in the onboarding idea and goal rather than generic startup prompts.
- Onboarding also asks whether to enable public-safe, read-only research sources. The safe default is to set up research later.
- Output: Living Product Spec, Founder Brief, Build Slice Plan, Serve Checklist, Learning Loop Hook.
- Stop feeling: not “perfect certainty,” but “I know the remaining risks and can start deliberately.”

## Product modes

Solo Superman supports two project-purpose modes. The code field is `projectPurposeMode`, and the app must ask or confirm the mode instead of silently guessing it.

| Mode | When used | Required focus |
| --- | --- | --- |
| `business` | Commercialization, launch, paid use, customer validation | customer, problem strength, willingness to pay, alternatives, channels, legal/operational risk, validation experiment |
| `personal` | Personal workflow, internal tool, learning/experiment | actual workflow, repeat frequency, input/output, local data/security, implementation cost, usability success criteria |

Business mode also requires an explicit `businessCriticIntensity`; it has no default value. Personal mode may skip commercialization axes such as market size, pricing, competition, acquisition channel, and investor narrative, but those skipped axes must be visible rather than hidden.

## UX doctrine

- User-facing language uses journey terms: Spec-ready, Research in progress, Planning-ready, Waiting for safe execution.
- Internal terms like Phase 1, Phase 2.5, tracker, or PR number stay out of normal user UI.
- The question AI acts like a sharp product coach: it explains why it asks, challenges assumptions, and detects fatigue.
- Repeated questions must converge through topic keys and repeat limits; the app must not trap users in an infinite question loop.
- Long clarification sessions must show question progress with generated, answered, follow-up, topic coverage, and remaining follow-up budget counts.
- Question refresh and next-list controls must be visible, while automatic refills can add the next relevant question after a card is answered or carried forward.
- Long sessions may submit all drafted answers in the current active batch, but the action remains bounded to visible question/follow-up cards and still uses the normal per-answer research loop; when an approved public-web allowlist is active, successful answer submission may quietly start ready read-only research runs through the same bounded task/run path.
- Research-generated additional questions must re-enter the Decision Queue as answerable follow-up debt, not remain hidden as evidence-card notes only; run-status polling that ingests provider evidence must refresh the Queue and Research surfaces that expose that debt.
- The Research tab can still start currently ready planned public-web research tasks as a bounded batch, respecting the active allowlist and concurrency budget while keeping each run on the existing per-task read-only research path.
- Risk UI should show Confidence Map, five-axis radar, and Top 3 Risk Cards when the data supports them; per-question risk entry stays collapsed under an optional add-comment/risk disclosure.

## Current release

The current public posture is a limited-beta-style technical preview. It proves the local web install/run path and keeps dangerous actions reviewable. It is not yet a broad consumer-grade installer with signed macOS/Windows packages, automatic updates, telemetry, or Windows real-device certification.
