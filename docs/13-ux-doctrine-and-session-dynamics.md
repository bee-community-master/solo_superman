# 13. UX Doctrine and Session Dynamics

## 목적

이 문서는 Solo Superman의 제품 철학과 2~5시간 심층 세션의 경험 기준을 고정하는 canonical 문서다. `02-user-journey-and-ux.md`가 화면과 흐름을 설명한다면, 이 문서는 사용자가 어떤 감각으로 세션을 통과해야 하는지와 AI가 어떤 태도로 질문해야 하는지를 정의한다.

핵심 원칙은 다음 한 문장이다.

> 사용자는 완벽한 확신을 얻고 끝나는 것이 아니라, **남은 리스크를 알고 시작한다**는 감각으로 Founder Brief를 받아야 한다.

즉 완료 화면은 “이 아이디어는 성공한다”가 아니라 “지금까지 무엇을 결정했고, 무엇은 아직 위험하며, 다음 검증은 무엇인가”를 선명하게 보여주는 출발선이어야 한다.

## UX Doctrine

Phase 번호는 사용자-facing 여정명이 아니다. UI, onboarding, CTA, export, Founder Brief에서는 `Phase 1.5A`, `Phase 2` 같은 내부 capability 용어를 쓰지 않고, 사용자가 이해할 수 있는 여정명을 사용한다. 내부 phase와 사용자 여정의 canonical mapping은 `28-founder-os-product-doctrine.md`가 소유한다.

Phase 1의 UX Doctrine은 다음 다섯 가지다.

1. **결정이 중심이다.** 긴 문서 작성량보다 창업자가 어떤 결정을 했고 왜 했는지가 더 중요하다.
2. **불확실성을 숨기지 않는다.** confidence가 낮은 축과 근거가 약한 claim을 화면 밖으로 밀어내지 않는다.
3. **질문은 사용자의 사고 비용을 줄여야 한다.** 선택지를 제공하되 왜 이 질문이 중요한지 항상 설명한다.
4. **리서치와 질문은 병렬로 진행된다.** 사용자가 답하는 동안 AI는 근거, 반대근거, 대체재, 검증 사례를 계속 쌓는다.
5. **완료는 질문 고갈이 아니라 실행 가능한 리스크 인식이다.** Spec-ready는 모든 질문이 사라진 상태가 아니라 핵심 리스크가 알려진 상태다.


## 사용자 여정 단계명

사용자에게는 내부 phase 대신 다음 여정명을 사용한다.

| User-facing stage | 의미 | 금지되는 표현 |
| --- | --- | --- |
| `아이디어 정리 중` | intake, initial spec, 첫 질문 배치가 진행 중 | Phase 1 진행 중 |
| `Spec-ready` | Living Product Spec, Known Risks, Founder Brief가 준비됨 | Phase 1 완료 |
| `리서치 보강 중` | 맡긴 claim/decision에 대한 깊은 근거팩을 준비 중 | Phase 1.5A-1 |
| `리서치 결과 검토 중` | 새 evidence가 만든 질문, 승인, risk card를 검토 중 | Phase 1.5A-2 |
| `Planning-ready` | fatal blocker 없이 high-impact research queue가 해결되고 final handoff artifact가 준비됨 | Phase 2 진입 |
| `안전 실행 대기` | controlled execution 승인과 sandbox가 필요한 상태 | Phase 3 |

이 단계명은 진행률 badge가 아니라 현재 사용자가 할 수 있는 다음 행동을 설명하는 문구다. 내부 phase 번호가 사용자 화면에 직접 표시되면 실패다. Phase 3의 실제 실행 권한, `ExecutionAuthorityRecord`, rollback, audit 계약은 `36-phase3-controlled-execution-contract.md`가 소유한다.

## Founder-facing copy guardrail

사용자는 엔진 phase를 조작하는 것이 아니라 자신의 아이디어를 전진시킨다고 느껴야 한다. 일반 UI, onboarding, CTA, export, Founder Brief에는 다음 변환을 적용한다.

| 내부 표현 | 사용자-facing 표현 | 표시 원칙 |
| --- | --- | --- |
| `Phase 1.5A` | 근거 보강 | claim/decision에 묶인 근거를 더 찾는다는 행동으로 설명 |
| `Phase 1.5B` | 실행 준비 메모 | 나중에 실행계획에 필요한 승인, sandbox, rollback 정보를 보존한다고 설명 |
| `Runtime preview` | 만들기 전 실행 계획 미리보기 | 실제 실행이 아니라 안전한 preview임을 표시 |
| `Effect task` | 백그라운드 작업 | 사용자가 기다리거나 취소할 수 있는 작업으로 표시 |
| `Command failed` | 처리 실패 | 원인, 복구 버튼, 다음 안전 행동을 함께 표시 |
| `schema version` | debug/admin metadata | founder-facing surface에는 직접 노출하지 않음 |
| raw planning gate text, `blocks Planning-ready` | 실행 계획 준비 조건 / 아직 실행 계획 준비 전 | blocker나 gate 상태를 final handoff처럼 보이지 않게 표시 |
| `Blocked action` | 아직 실행할 수 없는 작업 | 막힌 이유와 필요한 승인/근거를 표시 |

`Planning-ready`는 final handoff artifact가 있을 때만 허용되는 canonical user-facing stage label이다. 위 표의 금지 대상은 `blocks Planning-ready` 같은 내부 gate 문구, blocker report, raw 상태값을 그대로 사용자에게 노출하는 경우다.

카드의 첫 문장은 항상 다음 네 가지 중 하나를 답해야 한다.

- 지금 무엇을 해야 하는가.
- 왜 이 질문이나 결정이 중요한가.
- 답하면 무엇이 바뀌는가.
- 무엇이 아직 위험한가.

## Confidence Map

### 역할

Confidence Map은 복합 완성도 점수를 대체하지 않는다. 복합 완성도는 문서가 실행 가능한 형태로 정리되었는지 보는 작업 점수이고, Confidence Map은 사용자가 어떤 축에서 자신 있게 다음 행동을 할 수 있는지 보여주는 리스크 지도다.

Phase 1은 Confidence Map을 **5축 레이더**로 표시한다.

| 축 | 질문 | 낮은 점수의 의미 |
| --- | --- | --- |
| 문제 확신도 | 이 문제가 실제로 중요하고 자주 발생하는가? | 사용자가 해결할 만한 pain인지 불명확하다 |
| 고객 세그먼트 확신도 | 첫 고객이 충분히 좁고 접근 가능한가? | 누구를 먼저 만족시킬지 모호하다 |
| 가치제안 확신도 | 대체재보다 나은 이유가 선명한가? | 사용자가 왜 바꿔야 하는지 약하다 |
| 검증 가능성 확신도 | 다음 실험으로 핵심 가설을 확인할 수 있는가? | 무엇을 측정해야 할지 불명확하다 |
| 구현 준비도 확신도 | MVP 범위와 실행 순서가 충분히 작고 명확한가? | 만들다가 범위가 커질 위험이 높다 |

### 표시 규칙

Header에는 복합 완성도와 함께 5축 레이더 요약을 표시한다.

```text
Completeness 82% · Decision-ready
Confidence: Problem 78 / Customer 66 / Value 72 / Validation 80 / Implementation 76
Lowest axis: Customer confidence
```

상세 패널은 다음 세 가지를 함께 보여준다.

- **Top 3 Risk Cards**: 지금 가장 크게 남은 리스크 3개.
- **Next Question Batch**: 다음 3~5개 질문이 어떤 confidence 축을 올리는지.
- **Score History**: 답변, 리서치, 승인 이후 축별 점수가 어떻게 변했는지.

### 축 점수 원칙

각 축은 0~100으로 계산하되, 수치 자체보다 “왜 이 점수인가”가 더 중요하다. 모든 축에는 다음 설명이 붙어야 한다.

```text
현재 점수
- 66점

낮은 이유
- 고객 단계가 넓고 구매/사용 맥락이 분리되어 있음.

점수를 올리는 다음 행동
- 첫 고객을 하나로 좁히는 질문에 답하기.
- 대체재 사용 맥락에 대한 반대근거 리서치 승인하기.
```

## 날카로운 제품 코치

AI의 기본 톤은 **날카로운 제품 코치**다. 친절하지만 무르게 넘어가지 않는다. 창업자가 피하고 있는 모호함, 근거 없는 확신, 너무 넓은 MVP, 고객과 문제의 불일치를 직접 짚는다.

허용되는 표현:

- “이 답은 아직 고객 세그먼트를 좁히지 못했습니다. 이유는 구매 맥락과 사용 맥락이 섞여 있기 때문입니다.”
- “현재 가치제안은 기능 설명에 가깝고, 대체재 대비 전환 이유가 약합니다.”
- “이 가설은 가능하지만 근거가 약합니다. 지금은 확정된 사실이 아니라 검증 전 가정으로 표시하겠습니다.”

금지되는 표현:

- “좋은 아이디어입니다”처럼 근거 없는 격려만 제공.
- 사용자의 답을 그대로 반복하면서 질문 수만 늘림.
- AI 판단을 사실처럼 단정.
- 피로 신호가 있는데 계속 같은 강도로 압박.

### 날카로움의 안전 경계

| 경계 | 규칙 |
| --- | --- |
| 항상 이유 설명 | 비판이나 질문에는 어떤 리스크를 줄이기 위한 것인지 설명한다 |
| 3회 반복 금지 | 같은 주제 질문이 3회 반복되면 더 묻지 않고 보류, 리서치 부족, risk accepted 중 하나로 전환한다 |
| 가설 언어 사용 | 근거가 약한 판단은 “가설”, “현재 추정”, “검증 필요”로 표시한다 |
| 피로도 감지 | 행동 신호 기반으로 사용자의 집중력 저하를 감지하고 요약 개입을 실행한다 |

## 행동 신호 기반 피로도 감지

세션은 2~5시간까지 길어질 수 있으므로, 시스템은 사용자의 피로를 직접 묻는 설문에만 의존하지 않는다. Phase 1 피로도 모델은 **행동 신호 기반**이다.

감지 신호:

- 답변 길이가 이전 대비 급격히 짧아짐.
- “나중에”, “잘 모르겠다”, “아무거나” 같은 보류 답변 증가.
- 같은 선택지를 반복적으로 고르지만 근거 설명이 줄어듦.
- 질문 회피, 건너뛰기, 낮은 확신 답변 증가.
- 같은 high-risk 축에서 confidence가 오르지 않는데 질문 소모만 늘어남.

피로도가 감지되면 시스템은 즉시 더 많은 질문을 밀어붙이지 않는다. 기본 개입은 **요약 후 계속 여부 확인**이다.

```text
지금까지 확정된 결정
- Primary customer: 고객 인터뷰를 앞둔 초기 창업자
- MVP scope: 질문 생성이 아니라 가설 기반 질문 큐와 결정 기록

Confidence 변화
- Problem: 44 -> 72
- Customer: 38 -> 61
- Value: 40 -> 68

지금 멈추면 받을 수 있는 산출물
- Founder Brief 초안
- Known Risks 목록
- 다음 검증 액션 3개

낮은 confidence 축
- Customer confidence 61
- Value proposition confidence 68

계속 진행하면 다음 질문 배치는 고객 세그먼트와 대체재 전환 이유를 좁힙니다.
```

피로 개입 요약에는 명시적 Top 3 Risk Cards를 기본으로 넣지 않는다. 대신 사용자가 압박감을 덜 느끼면서도 방향을 알 수 있도록 낮은 confidence 축을 보여준다.

## Adaptive Session Mode

Phase 1의 기본 세션은 고정 시간 모드나 고정 목표 모드가 아니라 adaptive mode다. 사용자는 2~5시간 안에서 답변 속도, 리서치 도착, confidence 변화, 피로 신호에 따라 깊이가 달라지는 세션을 경험한다.

### 더 깊게 묻는 trigger

아래 trigger가 발생하면 시스템은 질문을 더 만들거나 리서치 task를 추가한다.

| Trigger | 의미 | 기본 대응 |
| --- | --- | --- |
| High confidence, low evidence | 사용자는 확신하지만 근거가 약함 | 반대근거 리서치와 근거 요청 질문 생성 |
| Problem-Customer-Value misalignment | 문제, 고객, 가치제안이 서로 다른 방향을 가리킴 | 세 축을 동시에 비교하는 선택 질문 생성 |
| MVP scope too broad | MVP가 검증보다 제품 완성에 가까워짐 | 핵심 가설 하나를 검증하는 범위로 축소 질문 생성 |
| Missing con evidence | 찬성 근거만 있고 반대근거가 없음 | 대체재, 지불의사, 행동 변화 리스크 리서치 생성 |

### 멈추거나 완료 후보를 제안하는 trigger

아래 조건에서는 시스템이 질문을 계속 늘리지 않고 멈춤 또는 완료 후보를 제안한다.

| Trigger | 의미 | 기본 대응 |
| --- | --- | --- |
| 모든 축 75점 이상 | 5개 confidence 축이 Spec-ready 후보 기준을 넘음 | Completion Candidate Card 생성 |
| 3회 반복 제한 도달 | 같은 주제 질문이 더 이상 정보를 만들지 못함 | 결정 보류, 리서치 부족, risk accepted 중 하나로 전환 |

Spec-ready 후보는 **모든 축 75점 이상**과 복합 완성도 gate를 함께 만족해야 한다. 5축 중 하나라도 75점 미만이면 완료 대신 낮은 축을 올리는 다음 질문 배치를 제안한다.

3회 반복 제한의 상세 수렴 정책은 `14-ambiguity-question-lifecycle.md`를 따른다. high severity는 Risk Accepted 요청, medium severity는 `research_needed` 또는 `research_insufficient`, low severity는 `deferred`로 수렴하는 것이 기본이다.

## Founder Brief

Founder Brief는 사용자가 세션을 중단하거나 완료했을 때 받는 기본 export package다. 이것은 투자자용 pitch deck이 아니라 창업자가 다음 주에 무엇을 검증해야 하는지 아는 실행 브리프다.

기본 포함 section:

1. **Problem-Customer-Value Summary**
   - 어떤 문제를, 어떤 첫 고객에게, 어떤 가치제안으로 풀 것인지.
2. **Top Decisions**
   - 세션 중 확정된 핵심 결정과 그 결정의 근거.
3. **Known Risks**
   - 아직 낮은 confidence 축, 반대근거, risk accepted 항목.
4. **Next Validation Actions**
   - 다음 1~2주 안에 실행할 검증 실험과 성공/실패 기준.

기본 포함하지 않는 항목:

- One-liner polish.
- 5축 레이더 이미지 자체.
- 장기 제품 로드맵.
- 구현 task list 전체.

위 항목들은 사용자가 명시적으로 원하거나 후속 export template이 확장될 때 추가한다.

## Completion UX

완료 화면의 첫 메시지는 “성공 가능성이 높습니다”가 아니다.

권장 메시지:

> 이제 시작할 수 있습니다. 중요한 결정은 정리되었고, 남은 리스크를 알고 시작한다는 점이 이번 세션의 성과입니다.

완료 화면은 다음 순서로 구성한다.

1. Spec-ready 여부와 통과한 gate.
2. 5축 confidence 상태.
3. Top Decisions.
4. Known Risks.
5. Next Validation Actions.
6. Founder Brief export.

완료 화면이 지나치게 축하 중심이 되면 안 된다. 창업자에게 필요한 것은 확신 과잉이 아니라 명확한 다음 행동이다.

## 다른 문서와의 관계

- `02-user-journey-and-ux.md`는 화면 구조와 사용 흐름을 책임진다.
- `07-completeness-scoring.md`는 복합 완성도 산식과 gate를 책임진다.
- `12-validation-and-dry-run.md`는 이 UX Doctrine이 실제 dry-run에서 작동하는지 검증한다.
- `14-ambiguity-question-lifecycle.md`는 질문 반복 제한과 무한 질문 루프 방지의 엔진 계약을 책임진다.
- `28-founder-os-product-doctrine.md`는 내부 phase와 사용자-facing journey stage의 용어 경계 및 post-Phase 1 Founder OS 확장 철학을 책임진다.
- 이 문서는 confidence map, sharp coach tone, adaptive session, fatigue intervention, Founder Brief의 기준 source of truth다.
