# Solo Superman Contributor Docs / 기여자 문서 허브

Solo Superman is a local-first Founder OS for solo founders. Solo Superman은 솔로 창업자가 막연한 아이디어를 질문, 리서치, 결정 세션으로 구체화하고 안전한 실행 준비까지 이어 가는 로컬 우선 Founder OS입니다.

This docs folder is now optimized for contributor onboarding instead of phase-by-phase implementation planning. 이전의 `00`~`40` 번호형 기획/구현 문서는 이 온보딩 세트로 통합되었습니다.

## Start here / 먼저 읽을 문서

| Need | Read |
| --- | --- |
| 제품이 무엇인지 이해 | [`product.md`](product.md) |
| 로컬 실행과 기여 절차 | [`contributing.md`](contributing.md) |
| 시스템 구조와 패키지 경계 | [`architecture.md`](architecture.md) |
| 파일/셸/브라우저 권한 경계 | [`safety-and-permissions.md`](safety-and-permissions.md) |
| 현재 roadmap과 단계별 의미 | [`roadmap.md`](roadmap.md) |
| 과거 결정과 rejected alternatives | [`decisions.md`](decisions.md) |
| DTO/API/route/verifier contract | [`reference.md`](reference.md) |
| 설치/실행 문제 해결 | [`troubleshooting.md`](troubleshooting.md) |

## Current posture / 현재 상태

- Release channel: limited beta / technical preview.
- Runtime shape: local-first web app + local Node/Hono service.
- Default topology: Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db.
- Storage: local embedded libSQL with Drizzle; remote sync config does not enable remote storage today and remains inert until a later explicit sync contract exists.
- Risk posture: no hosted SaaS default, no browser-only DB rewrite, no automatic file/shell/browser action without an ExecutionAuthorityRecord.
- User-facing language must avoid internal labels such as Phase, PR number, or tracker number unless the user is explicitly in contributor/developer mode.

## Contributor rules / 기여자 규칙

1. Keep the root README short for end users; put contributor detail in this docs folder.
2. Update `docs/reference.md` and `scripts/verify-doc-contracts.mjs` together when contract enums, DTO families, or route surfaces change.
3. Preserve local-first safety: loopback-only local service, per-run local capability token, CSRF/replay protection, and no credential custody.
4. If you change product direction, record the decision in `docs/decisions.md` and update `docs/roadmap.md` if capability boundaries move.
5. Run `pnpm verify:docs` before opening a PR that touches docs or contract surfaces.

## What changed from the old docs / 이전 문서에서 바뀐 점

The old numbered planning docs were designed as a planning and implementation contract ledger. It included many numbered phase documents, closeout reports, and issue evidence records. That information is now condensed into:

- `product.md` for product identity and user value.
- `architecture.md` for current runtime topology.
- `safety-and-permissions.md` for non-negotiable authority boundaries.
- `roadmap.md` for phase/capability history.
- `decisions.md` for durable decisions and rejected alternatives.
- `reference.md` for code-backed contract values that the verifier checks.

Use the git history if you need the full original closeout prose. The active contributor contract is this simplified docs set.
