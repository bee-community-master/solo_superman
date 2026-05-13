# Solo Superman 기획 문서 인덱스

Solo Superman은 솔로 창업자가 막연한 아이디어를 2~5시간의 질문·리서치·결정 세션으로 구체화하고, 최소 Build Slice와 서빙/학습 준비까지 연결하는 local-first web app + local Node/Hono service 기반 Founder OS다.

이 레포의 현재 기준은 **Phase 3 web/local controlled execution MVP closeout**이다. Phase 1~2 hardening closeout evidence는 `docs/35-phase1-2-closeout-evidence.md`로 보존하고, Phase 2.5는 `DelegationRiskGate`와 `ResearchQualityComparisonReport`를 DTO/type, ProductEngine reducer/projection, local persistence, adapter interface port로 닫았다. Phase 3의 canonical 실행 권한 계약과 Controlled execution MVP 순서는 `docs/36-phase3-controlled-execution-contract.md`가 소유하며, #92~#97 closeout evidence는 `docs/38-phase3-closeout-evidence.md`가 검증 가능한 ledger로 묶는다. MVP 구현 순서는 common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action` -> closeout hardening이며, 현재 문서 세트는 `00`~`40`의 번호 문서 41개와 이 인덱스를 합쳐 총 42개의 Markdown 문서로 구성한다.

## 확정된 1차 제품 결정

| 항목 | 결정 |
| --- | --- |
| 첫 사용자 | 초기 창업자 |
| 핵심 JTBD | 막연한 아이디어를 문제정의, 타깃, 가치제안, 고객 세그먼트, 경쟁/대체재, 검증실험, MVP 범위, 성공기준으로 구체화 |
| 중심 산출물 | Living Product Spec, Founder Brief, Build Slice/Serve/Learning handoff |
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
| Effect 실행 모델 | 기본 `persisted async effect queue`; 즉시 projection 반환은 `active batch projection exception` 또는 endpoint별 deterministic projection exception으로 제한 |
| 1급 Effect Type | `queue_projection_effect`, `research_evidence_effect`, `codex_runtime_preview_effect` |
| Effect retry 정책 | `conservative_ai_retry_matrix`: queue max 3, research/evidence max 2, Codex preview max 1 자동 재시도 |
| Deterministic output | Completeness/Scoring, SpecVersion, Founder Brief draft는 `reducer_deterministic_output` |
| AI Runtime 접근 | Codex app-server 우선, Phase 1 sandbox preview, ChatGPT Pro 웹 자동화는 Phase 2.5+ risk-gated preview 후보이며 active execution은 Phase 3 authority gate 이후 |
| 세션 깊이 | Adaptive mode, 모든 축 75점 이상이면 Spec-ready 후보 |
| 기본 export | Founder Brief |
| 기본 화면 | Decision Queue 중심 |
| 데이터 정책 | local-first; Phase 1은 remote config placeholder only, 사용자 선택 sync는 후속 |
| 기술 고정 | Local Web Frontend + Local Node/Hono Service + local embedded libSQL + ProductEngine/Spec Engine은 core, 외부 런타임은 adapter |
| Phase 3+ 구현 topology | Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db |
| native/runtime 경계 | Tauri/native shell source·dependency·script 경로는 제거됐고 historical context로만 남는다; Node/Hono local service가 ProductEngine/DB/Codex API와 Phase 3 execution authority를 소유 |
| Phase 1 저장소 | local embedded libSQL + Drizzle, remote config placeholder only |
| Phase 1 API | Hono `/api/v1` + Zod contract + SSE event stream |
| Codex 구현 경계 | Codex app-server stdio + schema pinning, sandbox preview만 허용 |
| Codex Prompt/Output 계약 | 6개 turnPurpose, Core+Delta input, Hybrid trace+artifact output, JSON repair, severity routing |
| Contracts/DTO 계약 | `packages/contracts` public DTO, Core/API/UI Projection, CommandResponse/statusUrl, SSE refetch hint |
| API Route 행동 계약 | 전체 Phase 1 endpoint별 request, command/query mapping, response/statusUrl, effects/SSE/refetch, errors/preconditions |
| 운영·관측성 계약 | 전구간 Operations/Observability Contract, 대표 장애 dry-run, user-visible recovery |
| Phase 1 구현 순서 | PR-01 workspace scaffold부터 PR-09 E2E dry-run hardening까지 고정 |
| Phase 용어 정책 | Phase 1/1.5/2/3은 내부 capability/roadmap/issue 용어이며 사용자 UI에는 노출하지 않음 |
| Founder OS 여정 | Spec-ready -> 리서치 보강 중 -> Planning-ready -> 안전 실행 대기 |
| Post-Phase 1 split | Phase 1.5A는 allowlisted read-only background research runtime 안에서 A-1 Decision-linked Evidence Pack과 A-2 Research-updated Queue를 만들고, Phase 1.5B는 no-execution execution-readiness hint 저장·조회·export만 담당 |
| Phase 2 gate | fatal blocker 없이 Research-updated Queue가 terminal outcome으로 수렴하고 residual risk가 숨겨지지 않을 때 Planning handoff 확정 |
| Phase capability matrix | Phase 0~6은 사용자 가치, 구현 capability, entry gate, exit evidence, non-goal 중심으로 정리 |
| Phase 2 handoff artifact | `PlanningHandoffArtifact`는 final Planning-ready 전용이고, gate 실패/부분충족은 별도 blocker report로 분리 |
| Phase 2 implementation preflight | DTO wire shape, gate algorithm, storage columns/indexes, command/idempotency, route ids, 구현 순서, Phase 1.5 dependency fallback은 `32-phase2-implementation-preflight-contract.md`의 exact default를 따른다 |
| Build/Serve/Learning loop | Build Slice Plan, Serve Checklist, Learning Loop Hook은 `33-build-slice-serve-learning-loop.md`의 checklist/handoff 계약을 따른다 |
| Phase 2.5 browser automation preview | Phase 2.5는 `34-phase2.5-browser-automation-preview-contract.md`의 Artifact+Gate 계약을 따르며, ChatGPT Pro/Deep Research/browser delegation이 Phase 1.5A baseline보다 research quality lift를 만드는지 deterministic comparison report로 검증한다 |
| Phase 2.5 no-execution | Phase 2.5 첫 slice는 submit/write, credential custody, account sharing/resale, live browser/ChatGPT adapter, review UI panel, sidecar API, team/mobile/billing 확장을 하지 않는다 |
| Phase 3 controlled execution | #86/#87/#88 완료 후 `36-phase3-controlled-execution-contract.md`의 common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action` 순서로만 MVP를 열었고, `38-phase3-closeout-evidence.md`가 #92~#97 closeout evidence를 묶는다. `ExecutionAuthorityRecord` 없이는 file/shell/browser 실행 claim이 유효하지 않다 |
| Post-Phase3 full-vision backlog | `37-post-phase3-full-vision-backlog-contract.md`가 business/personal 목적 모드, 기본값 없는 사업화 비판 강도 명시 선택, ChatGPT Pro per-run local browser delegation, 외부 서비스 page-use permission, 구현 step ledger, Windows PowerShell 설치 검증을 소유한다 |
| Web/local realignment | no hosted SaaS default, no browser-only DB rewrite, no new replacement native shell; local web UI와 local Node/Hono service가 기본이다 |
| Phase 1~2 closeout evidence | #65 child issue evidence, Phase 1~2 dry-run matrix, doc-contract verifier, no-execution boundary를 `docs/35-phase1-2-closeout-evidence.md`로 추적한다 |
| Phase 3 closeout evidence | #91/#92~#97 child issue evidence, approved/blocked controlled execution dry-run, docs/verifier guardrail을 `docs/38-phase3-closeout-evidence.md`로 추적한다 |
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
20. `19-phase1-implementation-architecture.md` - web-local implementation snapshot, package layout, dev scripts, native-host removal boundary 계약.
21. `20-data-storage-contract.md` - local embedded libSQL, Drizzle migration, repository/projection, remote config placeholder 계약.
22. `21-sidecar-api-runtime-contract.md` - Hono API route shape, local auth, SSE, Codex app-server runtime preview 계약.
23. `22-phase1-implementation-sequence.md` - Phase 1을 결정 없이 구현하기 위한 PR-01~PR-09 순서와 검증 기준.
24. `23-product-engine-runtime-contract.md` - ProductEngine reducer, persisted async effect queue, effect type, retry/idempotency, API/SSE 구현 계약.
25. `24-codex-prompt-output-contract.md` - Codex Prompt/Output의 6개 turnPurpose schema, Core+Delta input, Hybrid trace+artifact output, repair/failure/blocked taxonomy 계약.
26. `25-contracts-dto-catalog.md` - `packages/contracts` public DTO, ProductEngine command envelope, API response/statusUrl, SSE, UI Projection 계약.
27. `26-api-route-behavior-catalog.md` - 전체 Phase 1 endpoint별 request, command/query mapping, response/statusUrl, SSE/refetch, error/precondition 계약.
28. `27-operations-observability-contract.md` - intake부터 completion까지 실패/status/recovery를 잇는 운영·관측성 계약과 대표 장애 dry-run.
29. `28-founder-os-product-doctrine.md` - Founder OS 단계 철학, 내부 phase와 사용자 여정 용어 분리, Phase 1.5A/2 gate.
30. `29-phase-capability-implementation-matrix.md` - Phase 0~6 capability, 사용자 가치, entry/exit gate, non-goal 매트릭스.
31. `30-phase1.5-research-runtime-and-readiness-contract.md` - Phase 1.5A allowlisted read-only research runtime과 Phase 1.5B execution-readiness hints의 canonical 구현 계약.
32. `31-phase2-planning-handoff-contract.md` - Phase 2 Planning Handoff의 final artifact, blocker report, readiness checklist, residual risk, Phase 1.5B hint mapping 계약.
33. `32-phase2-implementation-preflight-contract.md` - Phase 2 Planning Handoff를 구현 PR로 옮기기 전 DTO, gate, storage, command, API, PR 순서, Phase 1.5 dependency exact default 계약.
34. `33-build-slice-serve-learning-loop.md` - Build Slice, Serve Checklist, Learning Loop Hook의 no-execution checklist/handoff 계약.
35. `34-phase2.5-browser-automation-preview-contract.md` - Phase 2.5 Browser Automation Preview의 research quality comparison, DelegationRiskGate, no-execution boundary, ChatGPT Pro/Deep Research policy gate 계약.
36. `35-phase1-2-closeout-evidence.md` - #65 closeout evidence ledger, Phase 1~2 dry-run acceptance matrix, tracker update rule.
37. `36-phase3-controlled-execution-contract.md` - Phase 3 web/local controlled execution, #86/#87/#88 prerequisite gate, common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action` MVP sequence, `ExecutionAuthorityRecord`, approval, rollback, audit, Phase 4~6 gates.
38. `37-post-phase3-full-vision-backlog-contract.md` - #91 unified tracker 아래 Post-Phase3 full-vision backlog, business/personal mode, business critic intensity, ChatGPT Pro per-run local browser delegation, external service page-use permission, implementation step ledger, macOS/Windows PowerShell install/run verification.
39. `38-phase3-closeout-evidence.md` - #91/#92~#97 Phase 3 closeout evidence ledger, approved/blocked E2E dry-run matrix, docs/verifier guardrail, tracker update rule.
40. `39-local-install-run-verification.md` - #105 macOS shell / Windows PowerShell install, production bundle run, smoke verification, and troubleshooting runbook.
41. `40-post-phase3-full-vision-closeout-report.md` - #106 docs/verifier closeout report for #91 issue graph, no-duplicate boundaries, verification evidence, and remaining implementation risks.

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
| Ambiguity/Question Lifecycle | AmbiguityIssue, QuestionBatch, answer routing, repeat limit, completion 수렴 | Research 상세 품질 산식은 Research/Evidence 문서로, 저장소/API/DTO/route 세부 계약은 20/21/25/26번으로 넘긴다 |
| Pro/Con Evidence Gate | pro_evidence, con_evidence, missing_con_evidence, skeptical search | 외부 리서치 런타임 구현과 고객 인터뷰 방법론 깊은 설계는 후속 문서로 넘긴다 |
| State/Event Contract | Question, ResearchTask, EvidenceMatrix, Decision, SpecUpdate, SpecVersion, CompletionCandidate의 end-to-end trace | 저장소/API/DTO/route 세부 계약은 20/21/25/26번으로, 런타임/코드 구현은 후속 구현 PR로 넘긴다 |
| AI Runtime Access Strategy | Codex app-server 우선 통합, sandbox preview 권한, ChatGPT Pro 웹 자동화의 Phase 2.5+ preview/gate 비전 | 리서치 품질은 Research Engine으로, 승인/프라이버시 세부는 Security 문서로 넘긴다 |
| Product Engine Orchestrator | Phase 1 전체 세션 라이프사이클, 중앙 상태 전이, Queue 재계산, 모듈 소유권 | 세부 카드 UX는 Decision Queue로, trace link는 State/Event Contract로, runtime 권한은 AI Runtime Access Strategy로 넘긴다 |
| Phase 1 Implementation Architecture Snapshot | web-local implementation snapshot, monorepo layout, dev scripts, native-host removal boundary | DB 저장 상세는 Data Storage Contract로, API route shape는 Sidecar API Runtime Contract로, Phase 3 authority는 36번으로 넘긴다 |
| Data Storage Contract | local embedded libSQL, Drizzle schema/migration, repository/projection, event persistence | 도메인 의미는 Domain Model로, API request/response는 Sidecar API Runtime Contract로 넘긴다 |
| Sidecar API Runtime Contract | Hono route group, validation envelope, local auth, SSE, Codex app-server preview boundary | UI 화면 상세는 UX 문서로, 저장소 내부 구현은 Data Storage Contract로 넘긴다 |
| Phase 1 Implementation Sequence | Codex가 구현 중 다시 결정하지 않도록 PR-01~PR-09 순서와 acceptance를 고정 | 실제 코드 변경은 후속 구현 PR에서 수행한다 |
| ProductEngine Runtime Contract | `pure reducer + effect plan`, persisted async effect queue, active batch/deterministic projection exception, effect retry matrix | 동일 정책 원문은 18/20/21/22에도 중복 허용하며, 충돌 시 문서 수정 PR에서 먼저 정리한다 |
| Codex Prompt/Output Contract | Codex turnPurpose, prompt input context, JSON output envelope, artifact/applyPolicy taxonomy, repair/failure routing | AI runtime 전략은 17번, Hono route/runtime 경계는 21번, effect queue 실행은 23번으로 넘긴다 |
| Contracts DTO Catalog | `packages/contracts` public DTO, Core/API/UI Projection, ProductEngineCommand envelope, CommandResponse/statusUrl, SSE DTO | DB row/Drizzle schema는 20번으로, runtime behavior는 21/23번으로 넘긴다 |
| API Route Behavior Catalog | 전체 Phase 1 endpoint별 API behavior, command/query mapping, statusUrl, SSE/refetch, error/precondition | DTO field는 25번으로, DB row/DDL은 20번으로, runtime/code 구현은 21/23번과 후속 구현 PR로 넘긴다 |
| Operations/Observability Contract | 전구간 failure/status/recovery, 대표 장애 dry-run, user-visible recovery, statusUrl/projection refetch 복구 | 세부 DTO field는 25번으로, endpoint mapping은 26번으로, effect lifecycle은 23번으로 넘긴다 |
| Founder OS Product Doctrine | 내부 capability phase와 user-facing journey stage 분리, Phase 1.5A subphase, Phase 2 gate | roadmap은 내부 phase sequencing을, UX 문서는 사용자-facing copy를, API/DTO 문서는 구현 계약을 책임진다 |
| Phase Capability Implementation Matrix | Phase 0~6의 사용자 가치, 구현 capability, entry gate, exit evidence, non-goal | PR/issue 실행 순서, 세부 schema, DTO field, API endpoint, package layout은 후속 Phase별 구현계획으로 넘긴다 |
| Phase 1.5 Research Runtime and Readiness Contract | Phase 1.5A allowlisted read-only research runtime, ResearchRun lifecycle, disclosure/audit, Phase 1.5B readiness hint schema와 no-execution acceptance | Founder OS/product matrix는 사용자 가치와 gate를, 이 문서는 API/DTO/DB/runtime 구현자가 따라야 할 세부 계약을 책임진다 |
| Phase 2 Planning Handoff Contract | `PlanningHandoffArtifact`, `PlanningHandoffBlockerArtifact`, gate verdict, PR/issue/task plan, readiness checklist, residual risk, Phase 1.5B hint mapping | Roadmap/Doctrine/Matrix는 phase gate와 사용자 가치를, 이 문서는 Phase 2 handoff artifact/report schema를 책임진다. DTO/route placeholder contract는 #42에서 승격하고, reducer/storage/API handler/UI 구현은 후속 Phase 2 구현 PR로 넘긴다 |
| Phase 2 Implementation Preflight Contract | DTO wire shape, gate algorithm, storage schema defaults, command/idempotency, route ids, implementation sequencing, Phase 1.5 dependency fallback | 31번은 artifact/report schema를, 이 문서는 그 schema를 code PR로 옮기는 exact implementation defaults를 책임진다. DTO/route placeholder contract promotion은 #42가 맡고, reducer/storage/API handler/UI behavior와 GitHub issue draft는 후속 작업으로 넘긴다 |
| Build Slice, Serve Checklist, and Learning Loop | Build Slice Plan, Serve Checklist, Learning Loop Hook의 checklist/handoff 계약 | 31번은 final handoff artifact field family를, 33번은 그 field family의 제품 의미와 no-execution boundary를 책임진다. Phase 3 execution adapter와 실제 deploy는 후속 작업으로 넘긴다 |
| Phase 2.5 Browser Automation Preview Contract | Browser/ChatGPT Pro delegation preview, DelegationRiskGate, ResearchQualityComparisonReport, comparative dry-run, no-execution boundary | 11/17/10/29번은 phase/runtimes/security/matrix 요약을, 이 문서는 Phase 2.5의 canonical Artifact+Gate 계약을 책임진다. 첫 slice의 DTO/type, reducer/projection, storage, adapter interface port를 고정하고 sidecar API/UI/live adapter는 후속으로 넘긴다 |
| Phase 1~2 Closeout Evidence Report | #65 child issue evidence ledger, dry-run acceptance matrix, closeout commands, tracker update rule | 12번은 validation checklist를, 26/27번은 route/ops acceptance를, 30~32번은 Phase 1.5/2 canonical contracts를 책임진다. 이 문서는 구현 완료 주장을 검증 가능한 evidence로 묶되 tracker #65 업데이트를 대체하지 않는다 |
| Phase 3 Controlled Execution Contract | Local Web Frontend + Local Node/Hono Service topology, #86/#87/#88 prerequisite gate, common ledger/authority -> `file_diff` -> `shell_command` -> `browser_action` MVP sequence, `ExecutionAuthorityRecord`, `BoundedAgentOutputRecord`, approval/rollback/audit/security contract | 10/17/21번은 security/runtime 요약을, 26번은 endpoint behavior placeholder를, 11/29번은 phase gate를, 36번은 Phase 3 실제 실행 권한의 canonical contract를 책임진다 |
| Phase 3 Closeout Evidence | #91/#92~#97 child issue evidence ledger, Phase 3 approved/blocked E2E dry-run matrix, docs/verifier guardrail, tracker update rule | 36번은 canonical policy를, 21/25/26번은 API/DTO/route behavior를, 38번은 구현 완료 claim을 검증 가능한 evidence로 묶는 closeout report를 책임진다 |
| Post-Phase3 Full-Vision Backlog Contract | #91 unified tracker 아래 Post-Phase3 기능 단위 backlog, `projectPurposeMode`, 기본값 없는 `businessCriticIntensity`, 승인형 ChatGPT Pro local browser delegation, `ServicePageUsePermission`, implementation step ledger, Windows PowerShell setup verification | 37번은 후속 issue graph와 제품 경계를 소유한다. ChatGPT/page-use artifact는 redaction preview와 export/delete control을 요구하고, Windows 설치는 `winget` 우선 + 공식 다운로드 fallback이다. Phase 3 execution authority는 36번을 따르고, 실제 코드/schema/API 구현은 각 child issue에서 PR-sized로 다룬다 |
| Local Install/Run Verification | #105 macOS shell과 Windows PowerShell install/run/verify command, production bundle smoke, local token/sidecar URL, troubleshooting | 39번은 non-developer copy-paste runbook과 `verify:prod-bundle` smoke를 소유한다. 37번은 feature contract를, package scripts는 executable entrypoint를 책임진다 |
| Post-Phase3 Closeout Report | #106 changed docs, created issues, verification evidence, remaining risks, #91/#98 no-duplicate boundary | 40번은 closeout evidence/report를 소유한다. 37번은 canonical feature contract를, 38번은 Phase 3 #92~#97 closeout evidence를, 39번은 install/run commands를 책임진다 |

## 공식 자료 기반 설계 메모

- Spec-first 흐름은 GitHub Spec Kit의 “spec이 실행의 중심 산출물”이라는 관점을 차용한다. 참고: <https://github.com/github/spec-kit>
- Phase 1 초기에는 Tauri/React/Vite scaffold가 있었지만, 현재 source/dependency/script 기본 경로에서는 제거됐고 historical context로만 남는다. 참고: <https://v2.tauri.app/>
- Phase 3 web-local 기본 방향은 Local Web Frontend와 loopback Local Node/Hono Service다. native sidecar 패턴은 historical reference일 뿐 구현 기본값이 아니다. 참고: <https://v2.tauri.app/learn/sidecar-nodejs/>, <https://v2.tauri.app/ko/develop/sidecar/>
- 백그라운드 작업과 장기 flow는 OpenClaw Background Tasks/Task Flow를 adapter 후보로 둔다. 참고: <https://docs.openclaw.ai/automation/tasks>, <https://docs.openclaw.ai/automation/taskflow>
- 선택적 sync와 후속 모바일/대시보드 실시간성은 Supabase Realtime 확장 후보로 둔다. 참고: <https://supabase.com/docs/guides/realtime>
- 브라우저 자동화는 기본 Playwright, 고급 단계 Browser-use adapter로 분리한다. Phase 1에서는 제외하고 Phase 2.5+에서 ChatGPT Pro 웹 자동화 후보를 preview/gate로 검토하며 active execution은 Phase 3 authority gate 이후에만 다룬다. 참고: <https://github.com/browser-use/browser-use>
- Codex CLI는 ChatGPT 계정 또는 API key 인증을 지원하며, Phase 1의 AI 통합 근거로 둔다. 참고: <https://developers.openai.com/codex/cli>
- Codex app-server는 인증, 대화 기록, 승인, 스트리밍 이벤트를 제품에 연결하는 깊은 통합 경로로 두며 Phase 1 우선 통합 후보로 고정한다. 참고: <https://developers.openai.com/codex/app-server>
- Codex Prompt/Output의 앱 내부 canonical schema는 `24-codex-prompt-output-contract.md`가 소유한다. Codex generated schema와 앱 내부 schema는 둘 다 versioned input으로 검증한다.
- `packages/contracts` public DTO와 Core/API/UI Projection contract는 `25-contracts-dto-catalog.md`가 소유한다.
- 전체 Phase 1 endpoint별 API behavior contract는 `26-api-route-behavior-catalog.md`가 소유한다.
- 전구간 운영·관측성 recovery와 대표 장애 dry-run은 `27-operations-observability-contract.md`가 소유한다.
- Phase 0~6 capability implementation matrix는 `29-phase-capability-implementation-matrix.md`가 소유한다.
- Phase 1.5A/B 상세 구현 계약은 `30-phase1.5-research-runtime-and-readiness-contract.md`가 소유한다.
- Phase 2 Planning Handoff의 final artifact와 blocker report 계약은 `31-phase2-planning-handoff-contract.md`가 소유한다.
- Phase 2 Planning Handoff의 DTO/API/storage/gate exact implementation defaults는 `32-phase2-implementation-preflight-contract.md`가 소유한다.
- Build Slice, Serve Checklist, Learning Loop Hook의 no-execution checklist/handoff 계약은 `33-build-slice-serve-learning-loop.md`가 소유한다.
- Phase 2.5 Browser Automation Preview의 research quality comparison, DelegationRiskGate, `Phase25ResearchComparisonProjection`, ChatGPT Pro/Deep Research policy risk, no-execution boundary는 `34-phase2.5-browser-automation-preview-contract.md`가 소유한다.
- Phase 1~2 hardening closeout evidence와 #65 tracker update rule은 `docs/35-phase1-2-closeout-evidence.md`가 소유한다.
- Phase 3 Controlled execution MVP의 prerequisite gate, 순차 구현 순서, hard non-goals, deferred/blocked boundary는 `36-phase3-controlled-execution-contract.md`가 소유하고, route/API placeholder behavior는 `26-api-route-behavior-catalog.md`가 소유한다. #92~#97 closeout evidence와 approved/blocked E2E dry-run matrix는 `38-phase3-closeout-evidence.md`가 소유한다.
- #91 unified tracker 아래 Post-Phase3 full-vision backlog alignment는 `37-post-phase3-full-vision-backlog-contract.md`가 소유한다. 여기에는 `projectPurposeMode`, 기본값 없는 `businessCriticIntensity` 명시 선택, ChatGPT Pro per-run local browser delegation, external service page-use permission, implementation step ledger, macOS/Windows PowerShell install/run verification이 포함된다. Copy-pasteable local install/run commands and production bundle smoke are in `39-local-install-run-verification.md`; #106 closeout evidence and remaining risks are in `40-post-phase3-full-vision-closeout-report.md`.
- Hono는 local sidecar API의 route/validation surface로 고정하고, validation은 Hono validator/Zod 계열로 문서화한다. 참고: <https://hono.dev/docs/api>, <https://hono.dev/docs/guides/validation>
- Phase 1 저장소는 local embedded libSQL + Drizzle schema/migration 계약으로 고정한다. 참고: <https://docs.turso.tech/sdk/ts/reference>, <https://docs.turso.tech/local-development>, <https://orm.drizzle.team/docs/get-started/sqlite-new>, <https://orm.drizzle.team/docs/migrations>
- ChatGPT Pro에는 Codex와 Deep Research가 포함되지만 자동 추출, 계정 공유, 제3자 서비스 구동/재판매 제한이 있을 수 있으므로 ChatGPT Pro 웹 자동화는 Phase 2.5+ preview/gate 비전으로 두고 active execution 권한으로 해석하지 않는다. 참고: <https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro/>
- Deep Research in ChatGPT는 public web과 사용자가 제공한 source를 활용할 수 있지만 plan/settings/usage limit에 따라 다르므로, Phase 2.5는 source trace, usage/session failure, fallback을 사용자에게 보이는 계약으로 다룬다. 참고: <https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt>

## 현재 금지 사항

- 사용자 UI, onboarding, CTA, export에 `Phase 1.5`, `Phase 2` 같은 내부 capability phase 용어 노출 금지.
- Controlled execution capability 전 실제 file patch, shell command, browser action, deploy, external system mutation 금지.
- `31-phase2-planning-handoff-contract.md`의 gate verdict 없이 final `PlanningHandoffArtifact` 또는 `Planning-ready` handoff 확정 금지.
- 실제 remote sync 구현은 다음 research/planning capability 범위에서 제외한다. Phase 1 기준 허용된 것은 remote config placeholder뿐이다.
- Phase 1 제품 범위에서 OpenClaw/Goose/CrewAI/Browser-use 실제 연동 금지. Phase 1.5A read-only research connector 후보는 `30-phase1.5-research-runtime-and-readiness-contract.md`의 allowlist/no-write 계약을 먼저 만족해야 한다.
- Phase 1에서 ChatGPT 웹 자동화 구현 금지.
- Phase 2.5에서 ChatGPT Pro/Deep Research 또는 browser delegation을 검토하더라도 실제 submit/write, credential/session custody, account sharing/resale, live browser/ChatGPT adapter, review UI panel, sidecar API, team/mobile/billing 확장 금지.
- Codex를 통한 실제 파일 patch, shell 실행, 브라우저 action 실행 금지. `diff_preview`, `command_plan_preview`, `browser_action_preview`는 preview artifact 또는 `BlockedActionArtifact`로만 남긴다. Phase 1.5A는 `30-phase1.5-research-runtime-and-readiness-contract.md`의 allowlisted read-only research runtime, Phase 1.5B는 execution-readiness hint 저장만 다루며 실제 실행은 Controlled Execution capability 전에는 하지 않는다.
- Phase 3 MVP에서도 credential custody, hosted control plane, destructive shell command, 모바일 승인/팀 협업/제품 결제·과금은 금지하며, external-production mutation(결제/법률/의료/금융 제출 자동화 포함)과 blanket/project-level approval은 후속 explicit contract 없이는 `blocked`로 수렴한다.
- ChatGPT Pro 사용자를 위한 no-API-key 경로도 `37-post-phase3-full-vision-backlog-contract.md` 기준으로 per-run local browser delegation부터 시작하며, credential/session custody, account sharing/resale, unattended signup/login은 금지한다.
- ProductEngine effect는 in-memory-only queue로 처리 금지. Phase 1 1급 effect는 persisted async effect queue에 저장한다.
- `scoring_effect`와 `spec_export_effect`를 Phase 1 1급 async effect로 승격 금지. scoring/export는 reducer deterministic output으로 유지한다.
- 모바일 앱 생성 금지.
- 팀 협업, 본격 cloud sync, 모바일/원격 승인, 결제/과금 확장 금지.
- Phase 4~6은 entry gate 충족 전까지 gate 중심 contract로만 다루며 PR/module/schema 수준 구현계획 확정 금지.
- Build Slice, Serve Checklist, Learning Loop Hook을 실제 code generation, deploy, analytics ingestion, 외부 mutation 실행 권한으로 해석 금지.
- 외부 APM, log drain, 배포 관측 플랫폼 선택 금지. Phase 1 운영성은 문서상 event/effect/status/projection/activity recovery 계약으로만 고정한다.
- `packages/contracts`가 Hono, Drizzle, React, Tauri, Codex runtime client를 직접 import하는 구조 금지.
