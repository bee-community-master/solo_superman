# Solo Superman 기여자 문서 허브

언어: 한국어(기본) | [English](README_EN.md)

이 파일은 기본 한국어 진입점입니다. `_KO`/`_EN` 쌍 기준의 한국어 문서는 [README_KO.md](README_KO.md)입니다.


Solo Superman은 솔로 창업자가 막연한 아이디어를 질문, 리서치, 결정 세션으로 구체화하고 안전한 실행 준비까지 이어 가는 local-first Founder OS입니다.

이 `docs/` 폴더는 phase별 구현 장부가 아니라 기여자 온보딩과 code-backed 계약 확인을 위한 문서 세트입니다. 이전 `00`~`40` 번호형 기획/구현 문서는 이 온보딩 세트로 통합되었습니다. 기본 문서는 한국어이며, 각 문서 상단에서 `_KO`와 `_EN` 버전을 서로 이동할 수 있습니다.

## 먼저 읽을 문서

| 필요 | 읽을 문서 |
| --- | --- |
| 제품이 무엇인지 이해 | [`product_KO.md`](product_KO.md) |
| 로컬 실행과 기여 절차 | [`contributing_KO.md`](contributing_KO.md) |
| 시스템 구조와 패키지 경계 | [`architecture_KO.md`](architecture_KO.md) |
| 파일/셸/브라우저 권한 경계 | [`safety-and-permissions_KO.md`](safety-and-permissions_KO.md) |
| 현재 roadmap과 단계별 의미 | [`roadmap_KO.md`](roadmap_KO.md) |
| 과거 결정과 rejected alternatives | [`decisions_KO.md`](decisions_KO.md) |
| DTO/API/route/verifier contract | [`reference_KO.md`](reference_KO.md) |
| 패키지 release update channel 계약 | [`release-channel_KO.md`](release-channel_KO.md) |
| 설치/실행 문제 해결 | [`troubleshooting_KO.md`](troubleshooting_KO.md) |

## 현재 상태

- Release channel: 제한 베타 형태의 technical preview.
- Packaged update channel: [`release-channel_KO.md`](release-channel_KO.md)의 manifest/signature/checksum/retry/rollback 계약만 고정되어 있으며, 실제 packaged updater는 signed macOS/Windows package 이후에만 켭니다.
- Runtime shape: local-first web app + local Node/Hono service.
- Default topology: Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db.
- Storage: local embedded libSQL + Drizzle. Remote sync config는 오늘 기준 remote storage를 켜지 않으며, later explicit sync contract가 생기기 전까지 inert 상태입니다.
- Risk posture: no hosted SaaS default, no browser-only DB rewrite, ExecutionAuthorityRecord 없는 file/shell/browser 자동 실행 금지.
- 사용자-facing 문구는 사용자가 contributor/developer mode에 명시적으로 들어와 있지 않은 한 Phase, PR number, tracker number 같은 내부 라벨을 피해야 합니다.

## 기여자 규칙

1. root README는 end user용으로 짧게 유지하고, 기여자 세부 내용은 이 docs 폴더에 둡니다.
2. contract enum, DTO family, route surface가 바뀌면 `docs/reference_KO.md`, `docs/reference_EN.md`, `scripts/verify-doc-contracts.mjs`를 함께 갱신합니다.
3. local-first safety를 보존합니다: loopback-only local service, per-run local capability token, CSRF/replay protection, no credential custody.
4. 제품 방향을 바꾸면 `docs/decisions_KO.md`에 결정을 기록하고 capability boundary가 이동한 경우 `docs/roadmap_KO.md`도 갱신합니다.
5. docs 또는 contract surface를 건드린 PR은 열기 전에 `pnpm verify:docs`를 실행합니다.

## 이전 문서에서 바뀐 점

옛 numbered planning docs는 phase별 구현 계약 장부, closeout report, issue evidence record에 가까웠습니다. 현재 active contributor contract는 아래 문서로 압축되었습니다.

- `product_KO.md`: 제품 정체성과 사용자 가치.
- `architecture_KO.md`: 현재 runtime topology.
- `safety-and-permissions_KO.md`: 양보할 수 없는 authority boundary.
- `roadmap_KO.md`: phase/capability history.
- `decisions_KO.md`: durable decisions와 rejected alternatives.
- `reference_KO.md`: verifier가 검사하는 code-backed contract value.
- `release-channel_KO.md`: packaged update channel의 manifest와 safety gate.

원본 closeout prose가 필요한 audit은 git history를 사용합니다. 현재 기여자 계약의 기준은 이 단순화된 docs 세트입니다.
