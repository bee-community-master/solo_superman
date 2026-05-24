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
- Long clarification sessions must show question progress with generated, active now, upcoming next, blocked, answered, total follow-up, open follow-up, topic coverage, and remaining follow-up budget counts. Maintainers must be able to run credential-free clarification pipeline and clarification volume smokes that verify the question loop from idea intake through initial spec analysis, active question batch, answer submission, follow-up/research debt, Planning Handoff blocker evidence, and 200+ bounded question/answer loops with 100% question-debt completion.
- Question refresh and next-list controls must be visible, while automatic refills can add the next relevant question after a card is answered or carried forward.
- Long sessions may submit all drafted answers in the current active batch, but the action remains bounded to visible question/follow-up cards and still uses the normal per-answer research loop; when an approved public-web allowlist is active, successful answer submission may quietly start ready read-only research runs through the same bounded task/run path.
- Research-generated additional questions must re-enter the Decision Queue as answerable, source-traceable follow-up debt, not remain hidden as evidence-card notes only; run-status polling that ingests provider evidence must refresh the Queue and Research surfaces that expose that debt, and Planning Handoff build-slice evidence must carry the same research follow-up provenance forward. Those follow-up questions must choose the answer form from the concrete question intent: open_text, binary_choice, single_choice, multi_select, ranked_choice, or evidence_judgment. They must not force every answer into a pro/con stance.
- Research review cards must show retained source traces when public evidence, runs, or source questions produced the card, so source provenance is visible before the user resolves research-generated follow-up questions.
- Research tab evidence matrices and evidence packs must show pro evidence, con evidence, uncertainties, missing counter-evidence reasons, known risks, next validation actions, source reliability, and quality gate checks together so skeptical-search gaps stay visible before Planning-ready.
- The Research tab can still start currently ready planned public-web research tasks as a bounded batch, respecting the active allowlist and concurrency budget while keeping each run on the existing per-task read-only research path. Users must be able to tune Max simultaneous research runs and Max research runs per session from the Research tab, and those limits apply to both manual starts and answer-triggered automatic public-web research starts. Maintainers must be able to run a credential-free research pipeline smoke that proves mounted `web_search_readonly` provider polling, source-traced result import, insufficient quality gate review, evidence matrix/pack/review-card synthesis, and Decision Queue follow-up question debt stay connected.
- Risk UI should show Confidence Map, if-stop-now risks/actions, next-best validation/build-readiness actions, five-axis radar, and Top 3 Risk Cards when the data supports them; Founder Brief risk/action arrays must remain first-class lists instead of only being embedded in prose sections. Per-question risk entry stays collapsed under an optional add-comment/risk disclosure.
- ChatGPT local browser delegation must show data disclosure previews, excluded sensitive fields, policy/session-ownership verdicts, approval/authority refs, browser evidence refs, revoke controls, and result-import gates before treating an external AI workspace as safe enough for visible handoff. Browser actions may also use approved public-read HTTPS DNS targets for read-only evidence capture, while loopback-only remains required for service-page/local preview flows. External service page-use permission must also keep user-present login, permission/action echo, artifact deletion, revoke, and final-submit boundaries explicit. Maintainers must be able to run credential-free browser delegation and service page-use pipeline smokes that prove loopback browser actions, approved/refetchable permissions, artifact cleanup or revoke paths, and blocked final-submit/credential-free boundaries without real ChatGPT/service credentials or external network access.
- Auto implementation worker controls must show Codex runtime readiness, checked-at evidence, adapter/schema/transport evidence, execution mode, account status, live-turn flag, manual handoff availability, and ledger-import fallback before an operator tries to run a local worker job; the Implementation runtime panel must let the operator refresh that runtime status and see the same readiness evidence, including execution mode, Codex account, live-turn state, and manual handoff state, without leaving the implementation flow. Maintainers must also have opt-in runtime verification commands such as `pnpm verify:codex-live-runtime` that distinguish skipped, blocked, and passed readiness evidence without forcing live runtime execution into the default verification suite, plus credential-free fixture smokes that prove a runtime preview request queues `codex_runtime_preview_effect`, runs the effect executor, persists a `preview_ready` runtime artifact, completes one bounded auto-implementation worker job through ledger import and stage advancement, exercises generated PR open/body-update/merge mutation guards without real GitHub writes, proves every canonical auto-implementation stage can complete with code-review, clean-code, missing-test audit, and test evidence in a review-loop smoke, and aggregates preview, worker, PR mutation, and review-loop evidence into one credential-free pipeline smoke.

## Current release

The current public posture is a limited-beta-style technical preview. It proves the local web install/run path and keeps dangerous actions reviewable. Signed packages currently provide the credential-free preflight in `docs/signed-packages_EN.md`/`pnpm verify:signed-package-preflight` and the release evidence contract in `docs/signed-package-release_EN.md`/`pnpm verify:signed-package-release`; real signing/notarization waits for certificates, accounts, secrets, and redacted evidence. The packaged update channel currently locks only the manifest/signature/checksum/retry/rollback verification contract in `docs/release-channel_EN.md` plus the device rollback evidence contract in `docs/packaged-update-rollback_EN.md` and `pnpm verify:packaged-update-rollback`, while `docs/windows-real-device_EN.md`/`pnpm verify:windows-real-device` and `docs/release-readiness_EN.md`/`pnpm verify:release-readiness` keep Windows real-device and broad-release blockers in one gate; real automatic update application remains deferred until signed macOS/Windows installer packages and device rollback verification exist. It is not yet a broad consumer-grade installer with signed macOS/Windows packages, automatic updates, telemetry, or Windows real-device certification.
