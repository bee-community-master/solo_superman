# Solo Superman

Language: [한국어](README.md) | English

## Overview

Solo Superman is a local-first Founder OS for solo founders. It turns ideas into concrete question loops, research, and decision sessions, then runs them through a local web UI and a local Node/Hono service.

The current release state is a **technical preview**. The goal at this stage is to let non-developers reach the local web screen with a one-line installer. Risky actions such as file edits, shell execution, browser control, or external-service submissions are not run automatically; they are first captured as reviewable execution-prep notes.

The installer checks Node.js 24 or newer, Git, Corepack/pnpm, Windows native runtime, and Codex CLI, installs missing prerequisites when safe, clones the repository, installs dependencies, verifies that the local app can run, and opens the browser automatically. On Windows, it keeps the app Node/pnpm toolchain on Windows but installs and runs Codex CLI inside WSL (Ubuntu) with `SOLO_CODEX_WINDOWS_MODE=wsl` for the more stable Codex path. When an existing Codex CLI passes `codex --version`, the installer reuses it even if the npm global install path reports an `already exists` conflict. It also opens a Codex Desktop App download prompt for users who want to continue with vibe coding or multiple parallel agents. If a folder with the same name already exists or the default local ports are already in use, it does not overwrite user files or kill running processes; it chooses a safe alternate path or port instead. When an existing install folder is a clean checkout, rerunning the same one-line installer attempts a safe fast-forward update to `origin/main`; if local changes or a diverged branch are present, it skips the update. This rerun update is only the git-checkout technical-preview path; signed packaged-app automatic updates must pass a separate release channel manifest/signature/checksum/retry/rollback contract.

## Installation

### macOS shell

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/bootstrap-macos.sh)"
```

### Windows PowerShell

Run PowerShell **as Administrator** from the Start menu, then paste the one-line command below. Without administrator permissions, the Node.js/Git install step can fail.

```powershell
irm https://raw.githubusercontent.com/bee-community-master/solo_superman/main/scripts/win.ps1 | iex
```

This short command runs a tiny Windows launcher first. The launcher sets UTF-8 console output, TLS 1.2, UTF-8 script download decoding, and BOM stripping before downloading and starting the full installer, including on Windows PowerShell 5.1. On Windows, before Node/Corepack/pnpm activation, WSL/Ubuntu checks, and Desktop shortcut creation/cleanup, the installer asks for UAC approval and relaunches itself in an administrator PowerShell when needed. For the Codex CLI WSL path, it sets WSL2 as the default version with `wsl --set-default-version 2` and selects the Codex WSL distribution as the default distribution. If no WSL distribution is installed, it tries `wsl --install -d Ubuntu`; on the first WSL install path, where Windows may need a reboot or Ubuntu may still need first-run Linux user/password setup, it stops there and tells the user to reboot, open Ubuntu once, and rerun the same one-line command. If the installer asks for a new terminal so PATH changes can take effect, open a new terminal and run the same one-line command again to continue. When automatic recovery is unsafe because of network restrictions, company security policy, or administrator permissions, the installer does not bypass the policy; it shows a plain-language error and the command to retry.

## Running locally

After installation, the local server keeps running and the Solo Superman web screen opens automatically in your default browser. Keep that terminal open while using the app. Press `Ctrl+C` to stop it.

To run it again later, use the command below. The completion message shows the install path, rerun command, and Desktop shortcut status. On Windows, the installer keeps only one visible `solo_superman` Desktop shortcut by creating or refreshing `solo_superman.lnk` and cleaning up duplicate Desktop `solo_superman.cmd`/`solo_superman.lnk` files left by older installers. The real `solo_superman.cmd` wrapper lives in the install folder, and the Desktop shortcut points to it. If the double-click launch fails, the cmd window stays open, shows the failure output and exit code, and waits for Enter before closing. On macOS, the installer does not create a Desktop runner and instead shows the rerun command. If Windows chose an alternate path such as `solo_superman-2` because of a folder conflict, use the rerun command printed by the installer.

### macOS shell

```sh
cd solo_superman && pnpm start:local
```

### Windows PowerShell

```powershell
Set-Location "$HOME\solo_superman"; pnpm.cmd start:local
```

Reaching the local first screen and running the default local path do not require an OpenAI API key, ChatGPT web credential, or ChatGPT Pro session. When backend question/research preview work starts, the local UI checks only the local Codex CLI with `codex login status`; it does not inspect a ChatGPT web session. On Windows, that Codex CLI check and `codex auth login` run inside WSL. If needed, the UI can open a background Terminal so Codex shows the browser login screen. Separate features that use a ChatGPT browser session require a user-approved flow and are not a default preview prerequisite. Solo Superman does not collect or store any credentials. For troubleshooting, see [`docs/troubleshooting_EN.md`](docs/troubleshooting_EN.md). For contributor onboarding and architecture notes, start at [`docs/README_EN.md`](docs/README_EN.md).

## Research and question configuration

Solo Superman reads optional `projectConfig.json` and `.solo-superman/projectConfig.json` files from the repo/workspace root. The `.solo-superman` file wins when both define the same setting. Supported settings include `questionGeneration.initialQuestionCount`, `questionGeneration.reviewAxes`, `questionGeneration.ambiguityDimensions`, `questionGeneration.language`, `questionGeneration.domainKeywordExpansions`, `research.localCorpusDir`, `research.preferredLanguage`, `research.region`, `research.evidenceConflictRatio`, and `research.gates.minimumUsableFindings`.

Read-only web research can also be tuned with environment variables: `SOLO_RESEARCH_WEB_MAX_RESULTS`, `SOLO_RESEARCH_WEB_MAX_FETCHED_PAGES`, `SOLO_RESEARCH_WEB_TIMEOUT_MS`, `SOLO_RESEARCH_WEB_MIN_DELAY_MS`, `SOLO_RESEARCH_WEB_MAX_DELAY_MS`, `SOLO_RESEARCH_WEB_ENGINE` (`duckduckgo`, `bing`, `google.co.kr`, or `naver`), `SOLO_RESEARCH_LANGUAGE`, `SOLO_RESEARCH_REGION`, `SOLO_RESEARCH_LOCAL_CORPUS_DIR`, `SOLO_RESEARCH_HIGH_IMPACT_REQUIRES_BALANCED_EVIDENCE`, `SOLO_RESEARCH_MINIMUM_USABLE_FINDINGS`, and `MAX_EVIDENCE_CONFLICT_RATIO`. When `research.localCorpusDir` or `SOLO_RESEARCH_LOCAL_CORPUS_DIR` is set, offline research ranks Markdown, TXT, and best-effort PDF text from that folder instead of opening the browser search adapter.

## Release scope

- Current recommended public channel: limited-beta-style technical preview
- Suitable users: users who are comfortable installing a local app, or who can follow guidance to run one terminal command
- Product capability readiness gate: [`docs/product-capability-readiness_EN.md`](docs/product-capability-readiness_EN.md) and `pnpm verify:product-capability-readiness` check whether questions, research, readiness, browser/service boundaries, and the auto implementation loop are code-backed by credential-free verifiers.
- Final-submit production mutation contract: `docs/production-mutation-contract.example.json` and `pnpm verify:production-mutation-contract` verify the confirmation-card, ExecutionAuthorityRecord, redaction, approval, rollback, audit, and no-secret evidence requirements needed before service-page final-submit readiness. The default local verifier does not perform any real external production mutation.
- Local diagnostics bundle for error reports: after a failure, run `pnpm support:bundle` to print the path to a credential-free JSON support bundle. `pnpm verify:support-bundle` validates the bundle schema, redaction, compact product/release diagnostics, ready-release `--plan-only` summary, default #259/#267 issue-specific handoff entries, the signed-package opt-in #266 handoff boundary, and recommended checks, including `pnpm verify:codex-live-runtime` for opt-in live runtime readiness, `pnpm verify:ready-release -- --plan-only`, the release-lab sequence `pnpm release:evidence-bundle -- <bundle-dir>`, filled-bundle `pnpm verify:release-evidence-bundle -- --bundle-dir <bundle-dir> --require-ready`, and final `pnpm verify:ready-release -- --evidence-bundle-dir <bundle-dir>`. It captures OS/Node/pnpm/git state, product/release diagnostics summaries, ready-release issue-specific checklist/template/comment paths plus template validation and GitHub issue comment commands, and allowlisted environment values only; it does not collect tokens, secrets, cookies, credentials, or file contents.
- Release evidence checklist: `pnpm release:evidence-checklist -- --output ./solo-superman-release-evidence-checklist.json` generates one credential-free JSON checklist for the default general-release blockers #259/#267, their required checks/evidence, and final verification commands. To create Markdown for a specific issue comment, run `pnpm release:evidence-checklist -- --format markdown --issue 259 --output ./issue-259-release-evidence.md`. To generate just the GitHub issue comment body, run `pnpm release:evidence-checklist -- --format comment --issue 267 --output ./issue-267-release-evidence-comment.md`. The `comment` format fails for mistyped issue numbers that have no evidence items. To generate the default release lab bundle in one step, run `pnpm release:evidence-bundle -- ./solo-superman-release-evidence-bundle`; it writes #259/#267 checklist/template files plus issue-specific Markdown/JSON templates, a manifest, and a README. Validate a generated or edited bundle with `pnpm verify:release-evidence-bundle -- --bundle-dir ./solo-superman-release-evidence-bundle` to check manifest/file completeness, ready-release command coverage, and secret-free boundaries; after the release lab fills real redacted evidence, add `--require-ready` to require every template to be ready/passed. Add `--include-signed-package` only when signed artifacts are part of the release claim; for example, generate the #266 signed-package hardening template with `pnpm release:evidence-checklist -- --include-signed-package --format template --issue 266 --output ./issue-266-release-evidence-template.json`, then validate the filled template with `pnpm verify:release-evidence-template -- --input ./issue-266-release-evidence-template.json`, including placeholder removal, passed statuses, redaction, and pre-gate ready-release command records while excluding the filled-bundle and aggregate self-commands. Running `pnpm verify:release-evidence-template`/`pnpm verify:release-evidence-bundle` without input validates credential-free fixtures for the default #259/#267 blocker issues and the current bundle contract.
- Signed installer package preflight: [`docs/signed-packages_EN.md`](docs/signed-packages_EN.md) and `pnpm verify:signed-package-preflight` verify macOS/Windows package candidates, signing credential gates, and the split between local dry-runs and actual signing gates.
- Signed package release evidence contract: [`docs/signed-package-release_EN.md`](docs/signed-package-release_EN.md) and `pnpm verify:signed-package-release` keep macOS signing/notarization, Windows Authenticode/timestamp, and release manifest signature evidence tied to #266, while `pnpm verify:signed-package-release:dry-run` catches credential-free fixture drift in artifact checksum/size/signature ref/manifest evidence shape.
- Packaged app update channel contract: [`docs/release-channel_EN.md`](docs/release-channel_EN.md) and `pnpm verify:release-channel` verify manifest signature, artifact checksum/signature, user deferral, retry, rollback, and credential/user-data preservation requirements.
- Packaged update rollback runtime/evidence contract: [`docs/packaged-update-rollback_EN.md`](docs/packaged-update-rollback_EN.md), `pnpm verify:packaged-update-rollback`, and `pnpm verify:packaged-update-rollback:dry-run` keep the fixture packaged updater runtime defer/retry/failed-launch rollback boundaries and macOS/Windows device rollback evidence tied to #267.
- Windows real-device install evidence contract: [`docs/windows-real-device_EN.md`](docs/windows-real-device_EN.md), `pnpm verify:windows-real-device`, and `pnpm verify:windows-installer:dry-run` keep one-line install through first-screen evidence and credential-free installer path drift tied to #259.
- General release readiness gate: [`docs/release-readiness_EN.md`](docs/release-readiness_EN.md) and `pnpm verify:release-readiness` verify that broad/general release remains blocked until packaged updater rollback and Windows real-device evidence are ready, while signed package evidence is added only as optional hardening when signed artifacts are claimed.
- Remaining general-release work: #267 packaged updater rollback device evidence and #259 Windows real-device verification. If the release claims macOS/Windows signed installer packages with real signing/notarization credentials, #266 signed-package hardening evidence is also required.

Note: the Windows PowerShell install path is documented, but before broad public release it still needs a separate real Windows device verification pass from one-line install through first-screen arrival.
