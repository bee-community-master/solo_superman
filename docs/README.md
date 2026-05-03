# Solo Superman 기획 문서 인덱스

Solo Superman은 초기 창업자가 막연한 아이디어를 2~5시간의 질문·리서치 세션으로 구체화해, 근거와 결정이 추적되는 `Living Product Spec`까지 도달하게 하는 macOS-first 데스크톱 서비스다.

이 레포의 현재 단계는 **기획 문서 작성 단계**다. 이 문서 세트는 구현 전 기준 계약이며, 런타임 코드·앱 scaffold·모바일 앱·팀 협업·결제·자동 코드 실행 구현은 아직 하지 않는다.

## 확정된 1차 제품 결정

| 항목 | 결정 |
| --- | --- |
| 첫 사용자 | 초기 창업자 |
| 핵심 JTBD | 막연한 아이디어를 문제정의, 타깃, 가치제안, 고객 세그먼트, 경쟁/대체재, 검증실험, MVP 범위, 성공기준으로 구체화 |
| 중심 산출물 | Living Product Spec |
| 기본 세션 | 2~5시간 집중 구체화 세션 |
| 질문 UX | 3~5개 질문 배치가 우선순위 큐로 계속 공급됨 |
| 리서치 품질 | 핵심 결정별 찬성 근거, 반대 근거, 불확실성, 추가 질문 매트릭스 |
| 완료 기준 | 근거 + 반대근거 + 결정 기록 + 주요 tradeoff 승인 |
| 진행률 UX | 복합 완성도 점수 |
| 기본 화면 | Decision Queue 중심 |
| 데이터 정책 | local-first + 사용자 선택 Supabase sync |
| 기술 고정 | Tauri/React/SQLite/Spec Engine은 core, 외부 런타임은 adapter |
| Phase 1 MVP | Research 포함 폐루프 |
| 1순위 실패 방지 | 무한 질문 루프 |

## 읽는 순서

1. `00-product-brief.md` - 제품 정체성과 범위.
2. `01-prd.md` - Phase 1 MVP 요구사항.
3. `02-user-journey-and-ux.md` - 2~5시간 세션과 대시보드 UX.
4. `03-living-product-spec.md` - 최종 산출물 계약.
5. `04-decision-queue.md` - 질문/결정 큐 정책.
6. `05-spec-engine.md` - Spec Engine 상태머신.
7. `06-research-engine.md` - 리서치 엔진과 evidence matrix.
8. `07-completeness-scoring.md` - 복합 완성도 점수.
9. `08-domain-model.md` - 도메인 객체와 관계.
10. `09-system-architecture.md` - 시스템 아키텍처와 런타임 adapter.
11. `10-security-privacy-and-approval.md` - 프라이버시, 승인, 권한 경계.
12. `11-roadmap-and-phase-boundaries.md` - Phase별 범위.
13. `12-validation-and-dry-run.md` - 핸드오프 검토와 샘플 dry-run.

## 문서 책임 경계

| 문서 | 책임지는 결정 | 다른 문서와의 경계 |
| --- | --- | --- |
| Product Brief | 누구의 어떤 문제를 푸는가 | 기능 상세는 PRD로 넘긴다 |
| PRD | Phase 1에 무엇이 들어가는가 | UI 상세는 UX 문서로 넘긴다 |
| UX | 사용자가 어떻게 사고하고 답하는가 | 점수 산식은 scoring 문서로 넘긴다 |
| Living Spec | 최종 산출물의 구조 | 내부 상태 전이는 Spec Engine으로 넘긴다 |
| Decision Queue | 질문/결정 카드 운영 | 리서치 생성 정책은 Research Engine으로 넘긴다 |
| Spec Engine | 상태머신과 업데이트 정책 | 데이터 구조는 Domain Model로 넘긴다 |
| Research Engine | 근거 생성/품질 기준 | 승인 권한은 Security/Approval 문서로 넘긴다 |
| Scoring | 완성도 계산과 stop condition | UX 배치는 UX 문서로 넘긴다 |
| Domain Model | 핵심 객체와 관계 | DB 상세 구현은 Phase 1 설계 때 확정한다 |
| Architecture | 기술 구성과 adapter | 보안 정책은 Security 문서로 넘긴다 |
| Security | local-first, sync, 승인 경계 | 제품 기능 범위는 PRD/로드맵으로 넘긴다 |
| Roadmap | Phase별 포함/제외 | 각 기능의 상세 계약은 해당 문서로 링크한다 |
| Validation | 문서 품질 검증 방식 | 제품 요구사항 자체는 바꾸지 않는다 |

## 공식 자료 기반 설계 메모

- Spec-first 흐름은 GitHub Spec Kit의 “spec이 실행의 중심 산출물”이라는 관점을 차용한다. 참고: <https://github.com/github/spec-kit>
- 데스크톱 shell은 Tauri v2를 기준으로 하되, MVP 문서 단계에서는 scaffolding하지 않는다. 참고: <https://v2.tauri.app/>
- 백그라운드 작업과 장기 flow는 OpenClaw Background Tasks/Task Flow를 adapter 후보로 둔다. 참고: <https://docs.openclaw.ai/automation/tasks>, <https://docs.openclaw.ai/automation/taskflow>
- 선택적 sync와 후속 모바일/대시보드 실시간성은 Supabase Realtime 확장 후보로 둔다. 참고: <https://supabase.com/docs/guides/realtime>
- 브라우저 자동화는 기본 Playwright, 고급 단계 Browser-use adapter로 분리한다. 참고: <https://github.com/browser-use/browser-use>

## 현재 금지 사항

- 런타임 코드 구현 금지.
- Tauri/React 앱 scaffold 생성 금지.
- Supabase 프로젝트 생성 또는 DB migration 실행 금지.
- OpenClaw/Goose/CrewAI/Browser-use 실제 연동 금지.
- 모바일 앱 생성 금지.
- 결제/과금 구현 금지.

