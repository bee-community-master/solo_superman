# Solo Superman Contributor Docs Hub

Language: [한국어](README_KO.md) | English

Solo Superman is a local-first Founder OS that helps solo founders turn vague ideas into question loops, research, decision sessions, and safe execution-prep artifacts.

This `docs/` folder is optimized for contributor onboarding and code-backed contract checks, not for phase-by-phase implementation ledgers. The old `00`~`40` numbered planning docs have been consolidated into this onboarding set. Korean is the default documentation language. `docs/README.md` remains the default Korean entrypoint, while the paired docs use `_KO` and `_EN` postfixes and link to each other at the top.

## Start here

| Need | Read |
| --- | --- |
| Understand the product | [`product_EN.md`](product_EN.md) |
| Run locally and contribute | [`contributing_EN.md`](contributing_EN.md) |
| Understand architecture and package boundaries | [`architecture_EN.md`](architecture_EN.md) |
| Understand file/shell/browser permission boundaries | [`safety-and-permissions_EN.md`](safety-and-permissions_EN.md) |
| Understand the roadmap and capability bands | [`roadmap_EN.md`](roadmap_EN.md) |
| Review decisions and rejected alternatives | [`decisions_EN.md`](decisions_EN.md) |
| Check DTO/API/route/verifier contracts | [`reference_EN.md`](reference_EN.md) |
| Review packaged release update channel contracts | [`release-channel_EN.md`](release-channel_EN.md) |
| Review signed macOS/Windows package preflight | [`signed-packages_EN.md`](signed-packages_EN.md) |
| Review general release readiness gates | [`release-readiness_EN.md`](release-readiness_EN.md) |
| Troubleshoot install and local run | [`troubleshooting_EN.md`](troubleshooting_EN.md) |

## Current posture

- Release channel: limited-beta-style technical preview.
- Packaged update channel: [`release-channel_EN.md`](release-channel_EN.md) locks only the manifest/signature/checksum/retry/rollback contract; a real packaged updater waits for signed macOS/Windows packages.
- Signed packages: [`signed-packages_EN.md`](signed-packages_EN.md) and `pnpm verify:signed-package-preflight` lock the credential-free preflight and missing signing credential gate.
- General release readiness: [`release-readiness_EN.md`](release-readiness_EN.md) and `pnpm verify:release-readiness` keep broad release blocked until signed package, packaged updater rollback, and Windows real-device gates are ready.
- Runtime shape: local-first web app + local Node/Hono service.
- Default topology: Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db.
- Storage: local embedded libSQL with Drizzle; remote sync config does not enable remote storage today and remains inert until a later explicit sync contract exists.
- Risk posture: no hosted SaaS default, no browser-only DB rewrite, no automatic file/shell/browser action without an ExecutionAuthorityRecord.
- User-facing language must avoid internal labels such as Phase, PR number, or tracker number unless the user is explicitly in contributor/developer mode.

## Contributor rules

1. Keep the root README short for end users; put contributor detail in this docs folder.
2. Update `docs/reference_EN.md`, `docs/reference_KO.md`, and `scripts/verify-doc-contracts.mjs` together when contract enums, DTO families, or route surfaces change.
3. Preserve local-first safety: loopback-only local service, per-run local capability token, CSRF/replay protection, and no credential custody.
4. If product direction changes, record the decision in `docs/decisions_EN.md` and update `docs/roadmap_EN.md` if capability boundaries move.
5. Run `pnpm verify:docs` before opening a PR that touches docs or contract surfaces.

## What changed from the old docs

The old numbered planning docs acted as an implementation contract ledger, with detailed phase documents, closeout reports, and issue evidence records. The active contributor contract is now condensed into:

- `product_EN.md` for product identity and user value.
- `architecture_EN.md` for current runtime topology.
- `safety-and-permissions_EN.md` for non-negotiable authority boundaries.
- `roadmap_EN.md` for phase/capability history.
- `decisions_EN.md` for durable decisions and rejected alternatives.
- `reference_EN.md` for code-backed contract values checked by the verifier.
- `release-channel_EN.md` for packaged update channel manifests and safety gates.
- `signed-packages_EN.md` for signed installer package candidates and signing credential gates.
- `release-readiness_EN.md` for broad/general release blockers and ready-release gates.

Use git history if an audit needs the full original closeout prose. The active contributor contract is this simplified docs set.
