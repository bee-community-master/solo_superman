# 28. Founder OS Product Doctrine

## 목적

이 문서는 Phase 1 완료 이후 Solo Superman이 `1인 창업 OS`로 확장될 때의 제품 단계 철학을 고정한다. 핵심은 내부 구현 roadmap phase와 사용자가 제품 안에서 체감하는 여정 단계를 분리하고, 다음 capability가 어떤 사용자 가치를 증명해야 다음 단계로 넘어갈 수 있는지 명확히 하는 것이다.

이 문서는 다음 결정을 소유한다.

- 내부 capability phase와 user-facing journey stage의 용어 경계.
- Phase 1.5A를 `Decision-linked Evidence Pack`과 `Research-updated Queue`로 나누는 이유.
- Phase 2 Execution Planning Handoff의 strict gate.
- Phase 1.5A/2에서 금지되는 scope와 사용자-facing copy guardrail.
- Phase 0~6 capability implementation matrix가 따라야 하는 phase/journey 분리 원칙.

Phase 1.5A/B의 runtime, allowlist, disclosure, DTO/API/DB, no-execution hint 세부 구현 계약은 `30-phase1.5-research-runtime-and-readiness-contract.md`가 소유한다.

## 용어 정책

`Phase 1`, `Phase 1.5A`, `Phase 2`, `Phase 3` 같은 phase 이름은 내부 capability, roadmap, GitHub issue, implementation planning에서만 사용한다. 사용자 UI, onboarding, CTA, export, Founder Brief에는 내부 phase 이름을 노출하지 않는다.

사용자에게는 다음처럼 제품 여정 언어를 사용한다.

```text
아이디어 정리 중
-> Spec-ready
-> 리서치 보강 중
-> Planning-ready
-> 안전 실행 대기
```

사용자-facing copy는 사용자가 지금 무엇을 할 수 있고 무엇이 아직 위험한지를 설명해야 한다. 내부 phase 번호를 보여주며 진행률처럼 오해시키면 안 된다.

## Capability phase와 사용자 여정 매핑

| Internal capability | User-facing journey stage | 사용자가 보는 의미 | 내부 완료 기준 |
| --- | --- | --- | --- |
| Phase 1: Research 포함 Spec 폐루프 MVP | `Spec-ready` | 핵심 결정, 근거, 반대근거, Known Risks, Founder Brief가 준비됨 | E2E dry-run, Completion Candidate, Founder Brief metadata 통과 |
| Phase 1.5A-1: Decision-linked Evidence Pack | `리서치 근거팩 준비 중` | 맡긴 핵심 claim/decision에 대해 더 깊은 근거 원장이 쌓이는 중 | decision-linked pro/con/uncertainty/source quality/product implication 저장 |
| Phase 1.5A-2: Research-updated Queue | `리서치 결과 검토 중` | 새 evidence가 만든 질문, 승인, risk card를 검토하는 중 | high-impact card가 terminal outcome으로 수렴 |
| Phase 1.5B: Execution-readiness Hints | `실행 준비 정보 보존` | 나중에 실행계획/위임에 필요한 승인, sandbox, rollback 요구사항을 보존 | hint metadata 저장과 조회, 실제 실행 없음 |
| Phase 2: Execution Planning Handoff | `Planning-ready` | Spec과 해결된 리서치 큐를 PR/issue/task 단위 계획으로 바꿀 준비가 됨 | unresolved high-impact research-updated queue card 없음 |
| Phase 3: Safe Execution Adapter | `안전 실행 대기` | 실행계획을 승인, sandbox, rollback 경계 안에서 적용할 준비가 됨 | controlled execution approval model 검증 |

이 매핑은 UI copy의 source of truth가 아니다. UI 세부 문구는 `02-user-journey-and-ux.md`와 `13-ux-doctrine-and-session-dynamics.md`가 책임지되, 내부 phase 번호를 사용자에게 노출하지 않는 정책은 이 문서를 따른다. Phase별 capability, entry gate, exit evidence, non-goal의 구현 매트릭스는 `29-phase-capability-implementation-matrix.md`가 책임진다.

## Founder OS 확장 원칙

Solo Superman은 `문서 생성기 -> 실행 자동화 도구`로 점프하지 않는다. Founder OS는 다음 순서로 사용자의 판단 부채를 줄인다.

1. **Spec-ready**: 사용자가 막연한 아이디어를 결정, 근거, Known Risks가 있는 Living Product Spec과 Founder Brief로 닫는다.
2. **Research follow-up**: 긴 리서치를 맡기고, 핵심 claim/decision별 균형 근거 원장과 새 결정 큐를 받는다.
3. **Planning-ready**: unresolved high-impact research queue가 없을 때만 실행계획 handoff를 확정한다.
4. **Controlled execution-ready**: planning artifact가 충분히 검증된 뒤에만 실제 file, shell, browser action을 approval-first 방식으로 다룬다.
5. **Operations later**: 팀 협업, cloud/mobile monitor, billing, 운영 dashboard는 개인 창업자의 research/planning loop가 안정된 뒤 확장한다.

각 단계는 다음 단계를 가능하게 하는 증거를 남겨야 한다. 다음 단계가 이전 단계의 미해결 결정을 숨기거나 건너뛰면 실패다.

## Phase 1.5A-1: Decision-linked Evidence Pack

Phase 1.5A의 첫 subphase는 background research를 단순 source dump가 아니라 decision-linked evidence ledger로 만든다.

필수 산출물:

- 대상 `claim` 또는 `decisionContext`.
- 연결된 Spec section, Decision, Question, ResearchTask.
- pro evidence와 con evidence.
- uncertainty와 stale risk.
- source quality, relevance, retrievedAt.
- product implication: 이 근거가 어떤 decision, queue card, Known Risk, validation action에 영향을 주는지.

완료 조건:

- high-impact claim은 pro/con evidence와 uncertainty를 모두 가진다.
- source가 부족하면 `research_insufficient` 또는 `missing_con_evidence`로 수렴한다.
- evidence pack은 durable source of truth로 저장되고, queue card는 이 ledger에서 파생된다.

금지:

- 출처 목록만 저장하고 decision impact를 비워두는 것.
- pro-only high-impact claim을 decision-ready로 표시하는 것.
- recurring market watch나 알림 제품으로 scope를 넓히는 것.

## Phase 1.5A-2: Research-updated Queue

두 번째 subphase는 Evidence Pack에서 사용자의 다음 행동을 만든다. Queue는 제품 표면이고 Evidence Pack은 원장이다.

Queue card 유형:

- Research Review Card: 새 근거 검토.
- Decision Approval Card: 핵심 decision 변경 또는 확정.
- Risk Acceptance Card: 남은 high-impact uncertainty를 알고 진행할지 선택.
- Conflict Resolution Card: Spec, evidence, decision 사이 충돌 해소.
- Follow-up Question Card: 새 evidence가 만든 좁고 답 가능한 질문.

완료 조건:

- Evidence Pack에서 파생된 high-impact card가 모두 terminal outcome을 가진다.
- terminal outcome은 `approved`, `revised`, `rejected`, `deferred`, `risk_accepted`, `research_insufficient` 중 하나다.
- unresolved high-impact card가 있으면 Planning-ready로 넘어가지 않는다.

## Phase 2 진입 Gate

Phase 2 Execution Planning Handoff는 Research-updated Queue의 high-impact card가 해결된 뒤에만 열린다.

허용:

- low/medium risk 항목은 Known Risks 또는 Open Questions로 남긴 뒤 planning context에 포함할 수 있다.
- `deferred` 또는 `risk_accepted`는 사용자가 이유를 승인한 경우 terminal outcome으로 인정한다.
- planning artifact는 unresolved risk를 숨기지 않고 prerequisite, assumption, validation dependency로 표시한다.

금지:

- unresolved high-impact card가 있는데 Planning handoff를 확정하는 것.
- Evidence Pack 완료만으로 Queue 검토 없이 PR/issue/task 계획을 확정하는 것.
- provisional plan을 final implementation plan처럼 보여주는 것.

## Non-goals for next capability planning

다음 capability 보강과 구현계획에서 제외한다.

- 사용자 UI, onboarding, CTA, export에 내부 phase 용어 노출.
- Controlled execution capability 전 실제 file patch, shell command, browser action, deploy, external system mutation.
- unresolved Research-updated Queue에서 planning handoff 확정.
- recurring/open-ended market watch 제품화.
- 팀 협업, 본격 cloud sync, 모바일/원격 승인, 결제/과금, 운영 dashboard 확장.

## 문서 적용 규칙

- Roadmap과 GitHub issue는 internal capability phase를 사용할 수 있다.
- UX, onboarding, CTA, export, Founder Brief는 user-facing journey stage만 사용한다.
- 문서가 phase와 journey를 함께 설명해야 할 때는 반드시 매핑표를 먼저 제시한다.
- 새 구현 issue는 `내부 capability`, `사용자-facing label`, `entry gate`, `non-goals`, `acceptance evidence`를 모두 포함해야 한다.
- Phase 0~6을 한눈에 보는 capability/gate/evidence 기준은 `29-phase-capability-implementation-matrix.md`를 따른다.

## Acceptance checklist

- [ ] 내부 phase 이름이 사용자-facing UI 문구처럼 쓰이지 않는다.
- [ ] Phase 1.5A-1 Evidence Pack과 Phase 1.5A-2 Research-updated Queue가 분리되어 있다.
- [ ] Evidence Pack은 decision-linked source of truth이고 Queue는 action projection이다.
- [ ] Phase 2 진입은 high-impact Research-updated Queue terminal outcome을 요구한다.
- [ ] Controlled execution 전 실제 file/shell/browser/deploy action은 금지된다.
- [ ] 팀, cloud, mobile, billing, operations 확장은 다음 research/planning capability 범위에 포함되지 않는다.
- [ ] Phase capability matrix가 내부 phase를 사용자-facing copy source of truth로 바꾸지 않는다.
