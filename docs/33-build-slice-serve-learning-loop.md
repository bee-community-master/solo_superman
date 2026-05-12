# 33. Build Slice, Serve Checklist, and Learning Loop

## 목적

이 문서는 Solo Superman이 `Planning-ready` 이후 곧바로 전체 제품 자동 구현으로 점프하지 않도록, Build Slice, Serve Checklist, Learning Loop의 checklist/handoff 계약을 고정한다.

Canonical path: `docs/33-build-slice-serve-learning-loop.md`.

이 문서는 실행 adapter가 아니다. file patch, shell command, browser action, deploy, external mutation은 Phase 3 controlled execution capability 전까지 실행하지 않는다.

## Founder OS full loop

제품 북극성은 다음 loop다.

```text
Idea
-> Spec
-> Evidence
-> Decision
-> Build Slice
-> Local Preview
-> Served MVP
-> Learning Loop
```

Phase 1은 `Idea -> Spec -> Evidence -> Decision`을 닫고, Phase 2는 `Build Slice -> Serve -> Learning`으로 넘어가기 위한 planning context를 만든다. 실제 controlled execution adapter의 권한, 승인, 실행 절차는 이 문서가 아니라 `36-phase3-controlled-execution-contract.md`에서만 다루며, 이 문서는 그 전 단계의 checklist/handoff 경계만 고정한다.

## Build Slice Plan

Build Slice는 이번 한 번의 구현 사이클에서 만들 수 있는 가장 작고 검증 가능한 제품 조각이다.

필수 필드:

| Field | Required | Rule |
| --- | --- | --- |
| `sliceGoal` | yes | 이번 slice가 검증할 한 가지 제품 진전 |
| `includedCapabilities` | yes | 이번에 만들 것. 화면, 데이터, API 후보를 포함할 수 있음 |
| `nonGoals` | yes | 이번에 만들지 않을 것. scope creep 방지용 |
| `sourceRefs` | yes | Spec, Decision, Evidence Pack, Queue, Known Risk refs |
| `acceptanceCriteria` | yes | 사용자가 slice 완료를 판단할 수 있는 조건 |
| `smokeTests` | yes | 구현 후 최소 검증 시나리오 |
| `validationMetric` | yes | Served MVP나 preview에서 배울 지표 |
| `residualRisks` | yes | 이번 slice 이후에도 남는 리스크 |

예시:

```text
목표
- 사용자가 아이디어를 입력하면 10개 이상의 핵심 질문과 Founder Brief 초안을 얻는다.

이번에 만들 것
- 프로젝트 생성
- 12섹션 초기 Spec
- 10개 이상 AmbiguityIssue
- 질문 카드별 why/unlocks 표시
- Founder Brief markdown preview

이번에 만들지 않을 것
- 자동 코드 생성
- 자동 배포
- 팀 협업
- 결제
- 클라우드 동기화
```

## Serve Checklist

Serve Checklist는 “배포를 실행하라”가 아니라 “서빙 가능한지 판단하기 위해 빠뜨리면 안 되는 점검표”다.

필수 필드:

| Field | Required | Rule |
| --- | --- | --- |
| `serveTarget` | yes | Vercel, Railway, Fly.io, self-hosted, local preview 등 후보 |
| `envVars` | yes | 필요한 env var와 누락 여부. 값은 저장하지 않음 |
| `publicUrl` | optional | 이미 있거나 생성 예정인 공개 URL |
| `authAndPrivacyCheck` | yes | 인증 필요 여부, 개인정보/민감정보 노출 위험 |
| `smokeTestChecklist` | yes | 첫 사용자에게 보여주기 전 확인할 시나리오 |
| `rollbackPlan` | yes | 문제가 생겼을 때 되돌릴 기준 |
| `launchNote` | yes | 첫 사용자에게 보낼 간단한 설명 |
| `learningMetrics` | yes | 무엇을 관찰할지 |

Serve Checklist는 Phase 2 artifact에 포함될 수 있지만 deploy, DNS 변경, secret 설정, 외부 계정 mutation을 수행하지 않는다.

## Learning Loop Hook

Learning Loop Hook은 Served MVP 이후 사용자 반응을 다시 Evidence, Decision, 다음 Build Slice로 되돌리는 계약이다.

필수 필드:

| Field | Required | Rule |
| --- | --- | --- |
| `signalsToCollect` | yes | feedback, usage, conversion, interview notes 등 |
| `interpretationFrame` | yes | 어떤 신호가 problem, customer, value, validation, implementation confidence를 바꾸는지 |
| `decisionOptions` | yes | pivot, persevere, narrow scope, next slice 후보 |
| `recommendedNextSliceRule` | yes | 다음 Build Slice를 추천하는 조건 |
| `riskUpdateRule` | yes | Known Risks와 Evidence Status를 갱신하는 조건 |

Learning Loop Hook은 사용자의 결정을 대신하지 않는다. AI는 관찰을 정리하고 가능한 결정을 제안하지만, pivot/persevere decision은 Approval Card 또는 동등한 사용자 승인 경로를 거쳐야 한다.

## Planning Handoff 연결

`31-phase2-planning-handoff-contract.md`의 final `PlanningHandoffArtifact`는 다음 field family를 포함해야 한다.

- `buildSlicePlan`.
- `serveChecklist`.
- `learningLoopHook`.
- `noExecutionPolicy`.

Gate 실패 또는 fatal blocker가 있으면 이 세 field family를 final handoff처럼 표시하지 않는다. 필요하면 `PlanningHandoffBlockerArtifact.safePreviewRefs`에 safe preview로만 연결한다.

## Non-goals

- 제품 코드 생성, file patch, shell command, browser action, deploy 실행.
- Phase 3 controlled execution adapter 세부 설계.
- 외부 analytics, cloud sync, CRM, feedback ingestion 자동화.
- 사용자 승인 없는 pivot/persevere decision.
- 팀 협업, 결제, 모바일 monitor로 scope 확장.

## Acceptance checklist

- [ ] Build Slice는 전체 제품이 아니라 가장 작고 검증 가능한 product slice다.
- [ ] Build Slice에는 explicit non-goals가 있다.
- [ ] Serve Checklist는 실제 deploy 실행 권한이 아니라 준비 점검표다.
- [ ] Serve Checklist는 env var 값을 저장하지 않는다.
- [ ] Learning Loop Hook은 feedback/usage signal을 Evidence, Decision, 다음 Build Slice로 되돌린다.
- [ ] Pivot/persevere decision은 사용자 승인 없이 확정되지 않는다.
- [ ] Planning Handoff에 연결될 때 no-execution policy가 함께 표시된다.


## Phase 3 handoff reference

Phase 3 controlled execution authority, `ExecutionAuthorityRecord`, rollback, audit, Local Web Frontend + Local Node/Hono Service topology는 `36-phase3-controlled-execution-contract.md`가 canonical source다.
