# 29. Phase Capability Implementation Matrix

## 목적

이 문서는 Phase 0~6을 내부 capability 구현 단계로 정리한다. 목표는 이후 Phase 1.5와 Phase 2 구현계획을 만들 때 다시 결정해야 할 제품 범위, 진입 gate, 완료 evidence, 금지선을 줄이는 것이다.

이 문서는 다음 결정을 소유한다.

- Phase별로 사용자가 얻어야 하는 가치.
- Phase별로 구현될 capability의 경계.
- 다음 Phase로 넘어가기 전에 반드시 확인할 entry gate와 exit evidence.
- 해당 Phase에서 구현하지 않을 것과 blocker.
- Phase 1 완료 기준선과 후속 Phase acceptance evidence 형식.

이 문서는 PR/issue 실행 순서, 세부 schema, DTO field, API endpoint, package layout을 확정하지 않는다. 그런 결정은 Phase별 구현계획 문서나 후속 GitHub issue에서 다룬다. 예외적으로 Phase 2 Planning Handoff artifact/report schema의 canonical docs-level 계약은 `31-phase2-planning-handoff-contract.md`가 소유하고, Phase 2 DTO/API/storage/gate exact implementation defaults는 `32-phase2-implementation-preflight-contract.md`가 소유한다. Build Slice, Serve Checklist, Learning Loop의 no-execution checklist/handoff 의미는 `33-build-slice-serve-learning-loop.md`가 소유한다.

## 사용 원칙

Phase 3+ 방향은 no hosted SaaS default, no browser-only DB rewrite, no new replacement native shell을 기본 guardrail로 둔다.


- Phase 이름은 내부 capability, roadmap, GitHub issue, implementation planning 용어다.
- 사용자 UI, onboarding, CTA, export, Founder Brief에는 Phase 번호를 노출하지 않는다.
- Phase 4~6도 이 문서에 포함하지만, 현재는 gate 중심 contract로만 상세화한다.
- Phase 4~6의 PR slice, module boundary, schema, billing, team/cloud 운영 세부 구현은 해당 Phase entry gate가 충족되기 전까지 확정하지 않는다.
- 다음 Phase는 이전 Phase의 미해결 high-impact decision을 숨기거나 건너뛰는 방식으로 열 수 없다.
- Controlled Execution capability 전에는 실제 file patch, shell command, browser action, deploy, external mutation을 제품 capability로 구현하지 않는다.

## Matrix field contract

| Field | 의미 |
| --- | --- |
| Internal capability | 내부 roadmap/issue/implementation planning에서 쓰는 Phase 또는 Subphase 이름 |
| User-facing value | 사용자가 체감해야 하는 가치 또는 여정 단계. UI copy source of truth는 `02`/`13`번 문서다 |
| Implemented capability | 해당 Phase에서 제품이 실제로 보유해야 하는 capability 경계 |
| Entry gate | 이 Phase 구현계획을 시작하기 전에 만족해야 하는 조건 |
| Exit evidence | Phase 완료를 주장하기 위해 남겨야 하는 증거 |
| Non-goals / blocked transition | 이 Phase에 포함하지 않거나 다음 Phase 진입을 막는 조건 |
| Light evidence / links | 현재 문서, issue, PR sequence, 검증 기준과의 가벼운 연결 |

## Phase capability matrix

| Internal capability | User-facing value | Implemented capability | Entry gate | Exit evidence | Non-goals / blocked transition | Light evidence / links |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 0: 기획 문서 완성 | 사용자는 아직 제품을 쓰는 단계가 아니라, 구현자가 제품 기준을 재결정하지 않아도 되는 상태 | 제품/UX/도메인/아키텍처/보안/런타임/저장소/API/DTO/운영 문서 계약을 완성하고 dry-run으로 설명 가능한 기준선을 만든다 | 초기 제품 방향과 Phase 1 MVP 범위가 문서화되어 있음 | 문서 간 상충 없음, Phase 1 구현자가 topology/package layout/DB/API/Codex boundary/PR sequence를 다시 결정하지 않아도 됨 | runtime feature 구현으로 확장하지 않음, 문서가 코드보다 앞서는 임시 가정이면 후속 구현 PR에서 ADR-style note로 정리 | `00`~`34`, README, `12-validation-and-dry-run.md`, `22-phase1-implementation-sequence.md` |
| Phase 1: Research 포함 Spec 폐루프 MVP | `Spec-ready`: 막연한 아이디어가 근거, 반대근거, Known Risks, Founder Brief가 있는 Living Product Spec v1로 닫힘 | current implementation은 Local Web Frontend와 Node/Hono sidecar를 포함하며, Phase 3+ future canonical은 Local Web Frontend + Local Node/Hono Service다. local embedded libSQL + Drizzle, ProductEngine reducer/effect queue, Decision Queue, manual research import, EvidenceMatrix, Codex sandbox preview, completeness score, Founder Brief export는 유지한다 | Phase 0 문서 계약과 PR-01~PR-09 순서가 고정됨 | 샘플 아이디어가 project creation -> question batch -> answer -> research_needed -> manual evidence import -> decision approval -> SpecVersion -> completeness -> Founder Brief draft/export까지 dry-run 됨 | 팀 협업, 모바일 앱, 결제/과금, remote sync beyond placeholder, ChatGPT web automation, actual file/shell/browser execution, Tauri/native shell을 future default로 재도입 | GitHub issue #2~#11 closed 기준선, `22-phase1-implementation-sequence.md`, `12-validation-and-dry-run.md`, `27-operations-observability-contract.md` |
| Phase 1.5A-1: Decision-linked Evidence Pack | `리서치 근거팩 준비 중`: 핵심 claim/decision에 대한 균형 근거 원장이 쌓임 | Background/bounded research result를 source dump가 아니라 claim/decisionContext에 연결된 evidence ledger로 저장한다. Pro evidence, con evidence, uncertainty, source quality, relevance, retrievedAt, stale risk, product implication, task status/retry/cancel/terminal failure recovery를 다룬다 | Phase 1의 Research Loop와 manual evidence import가 제품 가치로 검증됨. 깊은 follow-up research가 Founder Brief 이후 반복적으로 필요함 | High-impact claim마다 pro/con/uncertainty가 있거나 `research_insufficient`/`missing_con_evidence`로 수렴함. Evidence Pack이 Research-updated Queue의 durable source of truth가 됨 | 출처 목록만 저장하고 decision impact를 비워두지 않음. Pro-only high-impact claim을 decision-ready로 표시하지 않음. Recurring/open-ended market watch로 확장하지 않음 | `06-research-engine.md`, `15-pro-con-evidence-gate.md`, `16-state-event-contract.md`, `28-founder-os-product-doctrine.md`, `30-phase1.5-research-runtime-and-readiness-contract.md` |
| Phase 1.5A-2: Research-updated Queue | `리서치 결과 검토 중`: 새 evidence가 만든 결정, 위험, 충돌, 후속 질문을 사용자가 처리함 | Evidence Pack에서 Research Review, Decision Approval, Risk Acceptance, Conflict Resolution, Follow-up Question card를 생성하고 terminal outcome으로 수렴시킨다 | Phase 1.5A-1 Evidence Pack이 decision-linked source of truth로 저장됨 | Evidence Pack에서 파생된 high-impact card가 모두 `approved`, `revised`, `rejected`, `deferred`, `risk_accepted`, `research_insufficient` 중 하나의 terminal outcome을 가짐 | Unresolved high-impact card가 있으면 Phase 2 Planning Handoff를 확정하지 않음. Evidence Pack 완료만으로 Queue 검토를 건너뛰지 않음 | `04-decision-queue.md`, `14-ambiguity-question-lifecycle.md`, `16-state-event-contract.md`, `28-founder-os-product-doctrine.md`, `30-phase1.5-research-runtime-and-readiness-contract.md` |
| Phase 1.5B: Execution-readiness Hints | `실행 준비 정보 보존`: 나중에 실행계획/위임에 필요한 승인, sandbox, rollback 요구사항을 잃지 않음 | RuntimePreviewArtifact와 BlockedActionArtifact에 approval, sandbox, rollback reference, command allowlist, expected evidence, delegation requirement 같은 execution-readiness metadata를 저장/조회/export한다 | Phase 1 runtime preview artifact 저장이 안정됨. Phase 1.5A evidence/queue에서 execution-readiness metadata가 반복적으로 필요함 | Hint metadata는 저장·조회·export 가능하고 Phase 2/3 구현자가 artifact migration 없이 읽을 수 있음. Phase 1/1.5B 어디에서도 실제 실행이 일어나지 않음 | File patch, shell command, browser action, project-level delegation, implementation task commitment를 실행하지 않음 | `17-ai-runtime-access-strategy.md`, `21-sidecar-api-runtime-contract.md`, `24-codex-prompt-output-contract.md`, `28-founder-os-product-doctrine.md`, `30-phase1.5-research-runtime-and-readiness-contract.md` |
| Phase 2: Execution Planning Handoff | `Planning-ready`: Spec과 해결된 리서치 큐를 PR/issue/task 단위 실행계획, Build Slice, Serve Checklist, Learning Loop hook으로 바꿀 준비가 됨 | Living Product Spec, terminal Research-updated Queue, Known Risks, prerequisites를 구현 가능한 task breakdown, PR/issue 계획, Build Slice Plan, Serve Checklist, Learning Loop hook, readiness checklist, unresolved risk/prerequisite 표시로 변환한다 | Phase 1.5A-2 high-impact queue card가 terminal outcome을 가짐. 남은 low/medium risk는 Known Risks/Open Questions/prerequisite로 명시 가능함 | `PlanningHandoffArtifact`가 unresolved high-impact risk를 숨기지 않고, sourceRefs, gate verdict, blocker/prerequisite/assumption/validation dependency, Build Slice, Serve Checklist, Learning Loop hook, readiness checklist를 명시하며, read-only UI가 final/blocker split을 보존함 | 자동 적용, shell 실행, file patch 실행, browser action 실행, deploy 실행을 하지 않음. Serve Checklist를 실제 배포 권한으로 해석하지 않음. Provisional plan이나 blocker report를 final implementation plan처럼 보여주지 않음 | `03-living-product-spec.md`, `04-decision-queue.md`, `12-validation-and-dry-run.md`, `28-founder-os-product-doctrine.md`, `31-phase2-planning-handoff-contract.md`, `32-phase2-implementation-preflight-contract.md`, `33-build-slice-serve-learning-loop.md` |
| Phase 2.5: Browser Automation Preview | `브라우저 자동화 검토 중`: browser/ChatGPT delegation 후보가 리서치 품질을 높이는지 검토함 | PlaywrightRuntime, BrowserUseRuntime, ChatGPT Pro/Deep Research delegation, manual prompt handoff, official Codex fallback 후보를 `DelegationRiskGate`와 `ResearchQualityComparisonReport` 중심으로 비교하고, 첫 slice는 `Phase25ResearchComparisonProjection` Artifact+Gate core로 고정한다 | Phase 1.5A read-only research baseline과 manual handoff가 evidence quality gap 또는 research bottleneck을 보임. 정책/세션/데이터 노출/revoke/audit/fallback을 설명할 수 있음 | 동일 high-impact research question의 Phase 1.5A baseline vs Phase 2.5 candidate comparative dry-run artifact가 reducer/storage round-trip으로 검증되고, quality lift 또는 safe failure가 source trace/decision impact와 함께 설명됨 | submit/write, credential custody, account sharing/resale, live browser/ChatGPT adapter, review UI panel, sidecar API, team/mobile/billing 확장 금지 | `34-phase2.5-browser-automation-preview-contract.md`, `17-ai-runtime-access-strategy.md`, `10-security-privacy-and-approval.md`, `28-founder-os-product-doctrine.md` |
| Phase 3: Safe Execution Adapter (Controlled Execution) | `안전 실행 대기`: 승인, sandbox, rollback 경계 안에서 실행계획을 적용할 준비가 됨 | Local Web Frontend + Local Node/Hono Service 위에서 file diff preview, shell command preview, browser action preview를 approval-first adapter로 제공한다. 모든 실행은 `ExecutionAuthorityRecord`와 `BoundedAgentOutputRecord`를 통해 sandbox, rollback, audit log, terminal evidence에 연결한다 | Phase 2 task breakdown 품질이 충분히 검증됨. Phase 2.5 no-execution boundary가 유지됨. Approval model, sandbox boundary, rollback reference가 docs/36 기준으로 안정됨 | 사용자가 승인한 controlled execution만 적용되고, 실행 전 preview와 실행 후 evidence/audit/rollback reference가 남음. hosted web origin은 local authority를 묵시적으로 얻지 않음. #92~#97 closeout evidence는 `38-phase3-closeout-evidence.md`와 `pnpm smoke:e2e` approved/blocked dry-run으로 묶임 | 무승인 실행, credential/destructive/external-production action 자동 실행, blanket delegation, 숨겨진 mutation, hosted SaaS default, browser-only DB rewrite, 새 replacement native shell 개발 금지 | `10-security-privacy-and-approval.md`, `17-ai-runtime-access-strategy.md`, `21-sidecar-api-runtime-contract.md`, `24-codex-prompt-output-contract.md`, `28-founder-os-product-doctrine.md`, `36-phase3-controlled-execution-contract.md`, `38-phase3-closeout-evidence.md` |
| Post-Phase3 full-vision backlog | Phase 3 실행 안정성 위에서 최종 제품 비전의 미등록 기능을 PR-sized issue graph로 정렬함 | `projectPurposeMode` business/personal, 기본값 없는 `businessCriticIntensity` 명시 선택, ChatGPT Pro per-run local browser delegation, external service `ServicePageUsePermission`, implementation step ledger, macOS/Windows PowerShell setup verification을 기능 단위로 계획한다 | #91 unified tracker에서 Phase 3 #92~#97 execution authority evidence가 안정됨. full-vision gap이 #92~#97과 중복되지 않음. OpenAI 문서/약관과 browser reliability risk를 구현 직전에 재확인할 준비가 있음 | #91 tracker와 Post-Phase3 8개 child issue #99~#106이 goal/user value/dependency/scope/non-goal/API·data·UI notes/acceptance/verification/sequencing을 포함하고, `37-post-phase3-full-vision-backlog-contract.md`와 doc verifier가 cross-reference를 검증함 | credential/session custody, ChatGPT account sharing/resale, unattended signup/login, hosted implicit local control, sensitive/payment/legal/medical/financial/production submit, project-level long-running ChatGPT background queue 금지 | `37-post-phase3-full-vision-backlog-contract.md`, `10-security-privacy-and-approval.md`, `17-ai-runtime-access-strategy.md`, `36-phase3-controlled-execution-contract.md` |
| Phase 4: Optional Cloud and Mobile Monitor | local web/service 세션 밖에서도 질문/승인/진행 상태를 놓치지 않음 | Opt-in project sync, mobile approval monitor, push notification, task progress monitor, remote approval queue visibility를 local-first 원칙을 깨지 않는 보조 capability로 제공한다 | local web/service 세션 밖에서도 질문/승인을 처리하려는 반복 니즈가 확인됨. Phase 3 approval/audit model이 안정됨 | Sync/monitor는 local source of truth와 충돌하지 않고, opt-in/revoke/recovery 경계가 설명 가능함 | Mobile-first rewrite, mandatory cloud account, billing, team collaboration, cloud를 기본 source of truth로 만드는 결정 금지 | `10-security-privacy-and-approval.md`, `11-roadmap-and-phase-boundaries.md`, `28-founder-os-product-doctrine.md` |
| Phase 5: Team Collaboration | 개인 창업자 workflow가 소규모 팀의 검토/결정으로 확장됨 | Workspace sharing, role/permission, comment/review, decision owner, audit log를 decision trace와 approval boundary에 연결한다 | 개인용 workflow가 안정되고, 공유 요구가 반복적으로 확인됨. Phase 4 sync/monitor 또는 동등한 공유 기반이 product risk 없이 검증됨 | 팀원이 남긴 comment/review/approval이 decision owner와 audit trail에 연결되고, 누가 어떤 결정을 승인했는지 추적 가능함 | Public marketplace, enterprise admin, billing expansion, 무소유 decision, 권한 없는 외부 공유 금지 | `04-decision-queue.md`, `10-security-privacy-and-approval.md`, `16-state-event-contract.md`, `11-roadmap-and-phase-boundaries.md` |
| Phase 6: Advanced Multi-agent Strategy Engine | 창업 전반의 리서치/전략/실행계획을 bounded agent workflow로 확장함 | Market research crew, investor narrative crew, product strategy critic, validation experiment planner 같은 multi-agent workflow를 adapter 후보로 연결하고, 산출물을 Evidence Pack/Queue/Planning artifact로 귀속한다 | Solo/team workflow에서 반복되는 strategy/research/planning task class가 확인됨. Phase 3~5의 approval/audit/delegation boundary가 안정됨 | Multi-agent output이 source/evidence/decision/prerequisite와 연결되고, 사용자는 agent workflow의 입력, 권한, 산출물, 한계를 검토할 수 있음 | Open-ended autonomous company operation, unbounded agent loops, 승인 없는 external action, 검증되지 않은 MCP-heavy workflow의 기본 활성화 금지 | `09-system-architecture.md`, `17-ai-runtime-access-strategy.md`, `28-founder-os-product-doctrine.md`, `11-roadmap-and-phase-boundaries.md` |

## Phase transition blockers

- Phase 1.5A-2는 Phase 1.5A-1 Evidence Pack 없이 열 수 없다.
- Phase 2는 unresolved fatal blocker 또는 terminal outcome 없는 Research-updated Queue high-impact card가 있으면 final `PlanningHandoffArtifact`로 닫을 수 없다.
- Build Slice/Serve/Learning checklist는 Phase 2 artifact의 planning context일 뿐이며, Phase 3 전 실제 실행·배포·외부 수집 권한으로 승격할 수 없다.
- Phase 3는 Phase 2 planning artifact의 approval, sandbox, rollback requirement가 불충분하거나 `36-phase3-controlled-execution-contract.md`의 `ExecutionAuthorityRecord`를 만들 수 없으면 열 수 없다.
- Phase 2.5는 `34-phase2.5-browser-automation-preview-contract.md`의 DelegationRiskGate 또는 ResearchQualityComparisonReport 없이 browser/ChatGPT delegation을 quality-lift evidence로 주장할 수 없다.
- Phase 4~6은 현재 다음 구현 범위가 아니다. 각 Phase의 entry gate가 실제 사용자/운영 evidence로 충족되기 전까지 PR/issue 실행계획을 만들지 않는다.
- Phase 4~6의 구현계획은 이 문서의 gate를 통과한 뒤 별도 docs/issue에서 작성한다.

## Acceptance checklist

- [ ] 각 Phase가 사용자-facing value와 내부 capability를 분리해 설명한다.
- [ ] Phase 1은 완료된 기준선과 issue/문서 링크만 가볍게 연결한다.
- [ ] Phase 1.5A-1과 Phase 1.5A-2가 Evidence Pack과 Queue로 분리되어 있다.
- [ ] Phase 2 gate가 high-impact Research-updated Queue terminal outcome과 fatal blocker 해소를 요구한다.
- [ ] Phase 2 final artifact와 blocker report split은 `31-phase2-planning-handoff-contract.md`에 연결된다.
- [ ] Phase 2 read-only UI는 final artifact에서만 `Planning-ready`를 표시하고 blocker artifact에서는 required next action, residual risk, safe preview refs를 숨기지 않는다.
- [ ] Phase 2 artifact가 Build Slice, Serve Checklist, Learning Loop hook을 숨기지 않고 `33-build-slice-serve-learning-loop.md`에 연결한다.
- [ ] Phase 2 implementation defaults는 `32-phase2-implementation-preflight-contract.md`에 연결된다.
- [ ] Phase 1.5B와 Phase 2.5는 preview/hint-only이며 실제 실행을 허용하지 않는다.
- [ ] Phase 2.5는 `34-phase2.5-browser-automation-preview-contract.md`에 연결되고 comparative dry-run, DelegationRiskGate, Artifact+Gate core, no-execution boundary를 요구한다.
- [x] Phase 3 controlled file/shell/browser execution은 `ExecutionAuthorityRecord`와 approved preview/rollback/evidence/audit gate 안에서만 구현된다.
- [x] Phase 3는 `36-phase3-controlled-execution-contract.md`의 Local Web Frontend, Local Node/Hono Service, `ExecutionAuthorityRecord`, approval/rollback/audit gate와 `38-phase3-closeout-evidence.md`의 approved/blocked dry-run evidence에 연결된다.
- [ ] Phase 4~6은 gate 중심 contract로만 상세화하고 PR/module/schema 수준을 확정하지 않는다.
- [ ] User-facing UI copy source of truth를 이 문서로 옮기지 않는다.
