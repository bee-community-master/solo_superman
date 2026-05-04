# Solo Superman 기획 문서 인덱스

Solo Superman은 초기 창업자가 막연한 아이디어를 2~5시간의 질문·리서치 세션으로 구체화해, 근거와 결정이 추적되는 `Living Product Spec`까지 도달하게 하는 macOS-first 데스크톱 서비스다.

이 레포의 현재 단계는 **기획 문서 작성 단계**다. 이 문서 세트는 구현 전 기준 계약이며, 런타임 코드·앱 scaffold·모바일 앱·팀 협업·결제·자동 코드 실행 구현은 아직 하지 않는다. 현재 문서 세트는 `00`~`23`의 번호 문서 24개와 이 인덱스를 합쳐 총 25개의 Markdown 문서로 구성한다.

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
| 리스크 UX | Confidence Map, 5축 레이더, Top 3 Risk Cards |
| 세션 종료 감각 | 사용자는 완벽한 확신이 아니라 “남은 리스크를 알고 시작한다”는 감각을 얻어야 함 |
| 질문 AI 톤 | 날카로운 제품 코치, 이유 설명, 가설 언어, 피로도 감지 |
| 질문 엔진 수렴 | Ambiguity/Question Lifecycle, repeat limit, severity별 수렴 정책 |
| 근거 품질 Gate | Pro/Con Evidence Gate, missing_con_evidence, skeptical search |
| 엔진 실행 계약 | State/Event Contract, end-to-end traceability, terminal outcome |
| ProductEngine 권한 | 중앙 ProductEngine Orchestrator가 Phase 1 세션 상태 전이와 Queue 재계산을 소유 |
| ProductEngine 구현 패턴 | `pure reducer + effect plan`; reducer는 DB/Hono/Codex/filesystem/network를 직접 호출하지 않음 |
| Effect 실행 모델 | 기본 `persisted async effect queue`; `active batch projection exception`만 즉시 projection 반환 허용 |
| 1급 Effect Type | `queue_projection_effect`, `research_evidence_effect`, `codex_runtime_preview_effect` |
| Effect retry 정책 | `conservative_ai_retry_matrix`: queue max 3, research/evidence max 2, Codex preview max 1 자동 재시도 |
| Deterministic output | Completeness/Scoring, SpecVersion, Founder Brief draft는 `reducer_deterministic_output` |
| AI Runtime 접근 | Codex app-server 우선, Phase 1 sandbox preview, ChatGPT Pro 웹 자동화는 Phase 2+ |
| 세션 깊이 | Adaptive mode, 모든 축 75점 이상이면 Spec-ready 후보 |
| 기본 export | Founder Brief |
| 기본 화면 | Decision Queue 중심 |
| 데이터 정책 | local-first; Phase 1은 remote config placeholder only, 사용자 선택 sync는 후속 |
| 기술 고정 | Tauri/React/local embedded libSQL/Spec Engine은 core, 외부 런타임은 adapter |
| Phase 1 구현 topology | Tauri + React/Vite desktop shell + Node/Hono sidecar |
| native/runtime 경계 | node_core_rust_native_boundary: Rust/Tauri는 native boundary, Node/Hono는 ProductEngine/DB/Codex API 소유 |
| Phase 1 저장소 | local embedded libSQL + Drizzle, remote config placeholder only |
| Phase 1 API | Hono `/api/v1` + Zod contract + SSE event stream |
| Codex 구현 경계 | Codex app-server stdio + schema pinning, sandbox preview만 허용 |
| Phase 1 구현 순서 | PR-01 workspace scaffold부터 PR-09 E2E dry-run hardening까지 고정 |
| Phase 1 MVP | Research 포함 폐루프 |
| 1순위 실패 방지 | 무한 질문 루프 |

## 읽는 순서

1. `00-product-brief.md` - 제품 정체성과 범위.
2. `01-prd.md` - Phase 1 MVP 요구사항.
3. `02-user-journey-and-ux.md` - 2~5시간 세션과 대시보드 UX.
4. `03-living-product-spec.md` - 최종 산출물 계약.
5. `04-decision-queue.md` - 질문/결정 큐 정책.
6. `05-spec-engine.md` - Spec 중심 상태/산출 모듈.
7. `06-research-engine.md` - 리서치 엔진과 evidence matrix.
8. `07-completeness-scoring.md` - 복합 완성도 점수.
9. `08-domain-model.md` - 도메인 객체와 관계.
10. `09-system-architecture.md` - 시스템 아키텍처와 런타임 adapter.
11. `10-security-privacy-and-approval.md` - 프라이버시, 승인, 권한 경계.
12. `11-roadmap-and-phase-boundaries.md` - Phase별 범위.
13. `12-validation-and-dry-run.md` - 핸드오프 검토와 샘플 dry-run.
14. `13-ux-doctrine-and-session-dynamics.md` - UX Doctrine, confidence map, adaptive session, Founder Brief.
15. `14-ambiguity-question-lifecycle.md` - Ambiguity/Question Lifecycle과 무한 질문 루프 방지 계약.
16. `15-pro-con-evidence-gate.md` - Pro/Con Evidence Gate와 confirmation bias 방지 계약.
17. `16-state-event-contract.md` - Question→Research→Approval→SpecVersion→Completion 상태·이벤트 계약.
18. `17-ai-runtime-access-strategy.md` - Codex app-server, ChatGPT Pro 웹 자동화 비전, runtime 권한 경계.
19. `18-product-engine-orchestrator.md` - Phase 1 ProductEngine Orchestrator의 전체 세션 라이프사이클, command/event/state, queue 재계산 계약.
20. `19-phase1-implementation-architecture.md` - Tauri + Node/Hono sidecar topology, package layout, dev scripts, native boundary 계약.
21. `20-data-storage-contract.md` - local embedded libSQL, Drizzle migration, repository/projection, remote config placeholder 계약.
22. `21-sidecar-api-runtime-contract.md` - Hono API route shape, local auth, SSE, Codex app-server runtime preview 계약.
23. `22-phase1-implementation-sequence.md` - Phase 1을 결정 없이 구현하기 위한 PR-01~PR-09 순서와 검증 기준.
24. `23-product-engine-runtime-contract.md` - ProductEngine reducer, persisted async effect queue, effect type, retry/idempotency, API/SSE 구현 계약.

## 문서 책임 경계

| 문서 | 책임지는 결정 | 다른 문서와의 경계 |
| --- | --- | --- |
| Product Brief | 누구의 어떤 문제를 푸는가 | 기능 상세는 PRD로 넘긴다 |
| PRD | Phase 1에 무엇이 들어가는가 | UI 상세는 UX 문서로 넘긴다 |
| UX | 사용자가 어떻게 사고하고 답하는가 | 점수 산식은 scoring 문서로 넘긴다 |
| Living Spec | 최종 산출물의 구조 | 세션 상태 전이는 ProductEngine으로, Spec update 후보는 Spec Engine으로 넘긴다 |
| Decision Queue | 질문/결정 카드 운영과 priority UX | 최종 Queue 방출/상태 전이는 ProductEngine으로, 리서치 생성 정책은 Research Engine으로 넘긴다 |
| Spec Engine | Spec 중심 ambiguity, update 후보, versioning 재료 | 전체 세션 전이는 ProductEngine으로, 데이터 구조는 Domain Model로 넘긴다 |
| Research Engine | 근거 생성/품질 기준 | 승인 권한은 Security/Approval 문서로 넘긴다 |
| Scoring | 완성도 계산과 stop condition | UX 배치는 UX 문서로 넘긴다 |
| Domain Model | 핵심 객체와 관계 | DB 저장/마이그레이션 구현은 Data Storage Contract로 넘긴다 |
| Architecture | 기술 구성과 adapter | 구현 topology 세부는 Phase 1 Implementation Architecture로, 보안 정책은 Security 문서로 넘긴다 |
| Security | local-first, sync, 승인 경계 | 제품 기능 범위는 PRD/로드맵으로 넘긴다 |
| Roadmap | Phase별 포함/제외 | 각 기능의 상세 계약은 해당 문서로 링크한다 |
| Validation | 문서 품질 검증 방식 | 제품 요구사항 자체는 바꾸지 않는다 |
| UX Doctrine | 세션 감각, 날카로운 제품 코치, 피로도 개입, Founder Brief | 화면 배치는 UX 문서로, 산식은 Scoring 문서로 넘긴다 |
| Ambiguity/Question Lifecycle | AmbiguityIssue, QuestionBatch, answer routing, repeat limit, completion 수렴 | Research 상세 품질 산식과 DB/API 스키마는 후속 문서로 넘긴다 |
| Pro/Con Evidence Gate | pro_evidence, con_evidence, missing_con_evidence, skeptical search | 외부 리서치 런타임 구현과 고객 인터뷰 방법론 깊은 설계는 후속 문서로 넘긴다 |
| State/Event Contract | Question, ResearchTask, EvidenceMatrix, Decision, SpecUpdate, SpecVersion, CompletionCandidate의 end-to-end trace | DB/API 스키마 상세와 런타임/코드 구현은 Phase 1 설계 또는 구현 단계로 넘긴다 |
| AI Runtime Access Strategy | Codex app-server 우선 통합, sandbox preview 권한, ChatGPT Pro 웹 자동화의 Phase 2+ 비전 | 리서치 품질은 Research Engine으로, 승인/프라이버시 세부는 Security 문서로 넘긴다 |
| Product Engine Orchestrator | Phase 1 전체 세션 라이프사이클, 중앙 상태 전이, Queue 재계산, 모듈 소유권 | 세부 카드 UX는 Decision Queue로, trace link는 State/Event Contract로, runtime 권한은 AI Runtime Access Strategy로 넘긴다 |
| Phase 1 Implementation Architecture | Tauri + Node/Hono sidecar, monorepo layout, dev scripts, native boundary | DB 저장 상세는 Data Storage Contract로, API route shape는 Sidecar API Runtime Contract로 넘긴다 |
| Data Storage Contract | local embedded libSQL, Drizzle schema/migration, repository/projection, event persistence | 도메인 의미는 Domain Model로, API request/response는 Sidecar API Runtime Contract로 넘긴다 |
| Sidecar API Runtime Contract | Hono route group, validation envelope, local auth, SSE, Codex app-server preview boundary | UI 화면 상세는 UX 문서로, 저장소 내부 구현은 Data Storage Contract로 넘긴다 |
| Phase 1 Implementation Sequence | Codex가 구현 중 다시 결정하지 않도록 PR-01~PR-09 순서와 acceptance를 고정 | 실제 코드 변경은 후속 구현 PR에서 수행한다 |
| ProductEngine Runtime Contract | `pure reducer + effect plan`, persisted async effect queue, active batch projection exception, effect retry matrix | 동일 정책 원문은 18/20/21/22에도 중복 허용하며, 충돌 시 문서 수정 PR에서 먼저 정리한다 |

## 공식 자료 기반 설계 메모

- Spec-first 흐름은 GitHub Spec Kit의 “spec이 실행의 중심 산출물”이라는 관점을 차용한다. 참고: <https://github.com/github/spec-kit>
- 데스크톱 shell은 Tauri v2를 기준으로 하되, MVP 문서 단계에서는 scaffolding하지 않는다. 참고: <https://v2.tauri.app/>
- Phase 1 packaged desktop은 Tauri sidecar 패턴으로 Node/Hono sidecar를 실행하는 방향을 고정한다. 참고: <https://v2.tauri.app/learn/sidecar-nodejs/>, <https://v2.tauri.app/ko/develop/sidecar/>
- 백그라운드 작업과 장기 flow는 OpenClaw Background Tasks/Task Flow를 adapter 후보로 둔다. 참고: <https://docs.openclaw.ai/automation/tasks>, <https://docs.openclaw.ai/automation/taskflow>
- 선택적 sync와 후속 모바일/대시보드 실시간성은 Supabase Realtime 확장 후보로 둔다. 참고: <https://supabase.com/docs/guides/realtime>
- 브라우저 자동화는 기본 Playwright, 고급 단계 Browser-use adapter로 분리한다. Phase 1에서는 제외하고 Phase 2+에서 ChatGPT Pro 웹 자동화 비전과 함께 검토한다. 참고: <https://github.com/browser-use/browser-use>
- Codex CLI는 ChatGPT 계정 또는 API key 인증을 지원하며, Phase 1의 AI 통합 근거로 둔다. 참고: <https://developers.openai.com/codex/cli>
- Codex app-server는 인증, 대화 기록, 승인, 스트리밍 이벤트를 제품에 연결하는 깊은 통합 경로로 두며 Phase 1 우선 통합 후보로 고정한다. 참고: <https://developers.openai.com/codex/app-server>
- Hono는 local sidecar API의 route/validation surface로 고정하고, validation은 Hono validator/Zod 계열로 문서화한다. 참고: <https://hono.dev/docs/api>, <https://hono.dev/docs/guides/validation>
- Phase 1 저장소는 local embedded libSQL + Drizzle schema/migration 계약으로 고정한다. 참고: <https://docs.turso.tech/sdk/ts/reference>, <https://docs.turso.tech/local-development>, <https://orm.drizzle.team/docs/get-started/sqlite-new>, <https://orm.drizzle.team/docs/migrations>
- ChatGPT Pro에는 Codex와 Deep Research가 포함되지만 자동 추출, 계정 공유, 제3자 서비스 구동/재판매 제한이 있을 수 있으므로 ChatGPT Pro 웹 자동화는 Phase 2+ 비전으로 둔다. 참고: <https://help.openai.com/en/articles/9793128-what-is-c>

## 현재 금지 사항

- 런타임 코드 구현 금지.
- Tauri/React 앱 scaffold 생성 금지.
- Supabase 프로젝트 생성 또는 DB migration 실행 금지.
- 실제 remote sync 구현 금지. Phase 1 문서상 허용되는 것은 remote config placeholder뿐이다.
- OpenClaw/Goose/CrewAI/Browser-use 실제 연동 금지.
- Phase 1에서 ChatGPT 웹 자동화 구현 금지.
- Phase 1에서 Codex를 통한 실제 파일 patch, shell 실행, 브라우저 action 실행 금지. `diff_preview`, `command_plan_preview`, `browser_action_preview`는 preview artifact로만 남긴다.
- ProductEngine effect는 in-memory-only queue로 처리 금지. Phase 1 1급 effect는 persisted async effect queue에 저장한다.
- `scoring_effect`와 `spec_export_effect`를 Phase 1 1급 async effect로 승격 금지. scoring/export는 reducer deterministic output으로 유지한다.
- 모바일 앱 생성 금지.
- 결제/과금 구현 금지.
