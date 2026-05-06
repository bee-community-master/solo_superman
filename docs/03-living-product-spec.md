# 03. Living Product Spec

## 정의

Living Product Spec은 Solo Superman의 중심 산출물이다. 이것은 정적인 PRD가 아니라 질문, 리서치, 결정, 승인 과정을 통해 계속 버전업되는 제품 판단 문서다.

## Living Product Spec이 아닌 것

- 단순 AI 생성 PRD.
- 예쁜 투자자용 소개서.
- 구현자가 다시 해석해야 하는 모호한 요구사항 모음.
- 출처 없이 확신하는 시장 조사 문서.
- 사용자가 승인하지 않은 AI 추천안.

## Spec의 필수 섹션

초기 Living Product Spec은 최소 10개, 기본 12개 section을 만든다. 핵심은 모든 내용을 확정 문장으로 채우는 것이 아니라, 각 section이 현재 판단 상태를 드러내게 하는 것이다.

각 section은 가능한 한 다음 하위 구조를 가진다.

```text
현재 가설
- 지금까지의 최선 추정.

불확실성
- 사실, 추정, 미확인 영역.

필요한 결정
- 사용자가 승인하거나 보류해야 할 결정.

다음 질문 / 다음 검증
- 이 section을 전진시키는 Next Best Action.
```

### 1. Problem

- 해결하려는 문제.
- 문제가 발생하는 맥락.
- 문제의 빈도/강도/비용.
- 문제를 겪는 주체.
- 문제 부정 가능성과 반대근거.

### 2. Target Customer

- primary customer segment.
- secondary segment.
- 제외할 고객.
- 구매자와 사용자가 같은지 여부.
- 접근 가능성과 첫 검증 채널.

### 3. JTBD / Use Case

- 사용자가 어떤 상황에서 어떤 진전을 원한다.
- 사용 전/후 행동 변화.
- 제품 없이도 가능한 현재 workaround.
- 첫 세션에서 반드시 좁혀야 할 사용 맥락.

### 4. Current Alternatives

- 직접 경쟁.
- 간접 경쟁.
- 수동 workaround.
- “아무것도 안 함”이라는 대체재.
- 각 대체재가 충분히 좋은 이유.

### 5. Value Proposition

- 사용자가 얻는 핵심 변화.
- 대체재 대비 전환 이유.
- 정량 또는 정성 성공 신호.
- 약속하면 안 되는 과장 표현.

### 6. Differentiation

- 대체재와 다르게 이겨야 하는 지점.
- founder advantage.
- 모방 가능성.
- 방어되지 않는 차별화 가설.

### 7. MVP Scope

- 이번 Build Slice에서 만들 최소 제품 조각.
- 검증할 핵심 가설.
- 반드시 필요한 화면/데이터/API 후보.
- 의도적으로 단순화한 것.

### 8. Non-goals

- 이번 MVP에서 만들지 않을 것.
- 하지 않으면 불안하지만 scope creep을 막기 위해 제외하는 것.
- 후속 phase로 명시적으로 보낸 것.
- Planning Handoff에서 blocker가 되어야 하는 미정 non-goal.

### 9. Validation Plan

- 제품 없이 가능한 첫 검증 실험.
- 고객 인터뷰, 랜딩페이지, 프로토타입, 수동 컨시어지 실험.
- 성공/실패 기준.
- 실험 비용, 기간, sample 기준.

### 10. Success Criteria

- 사용자 행동 성공 기준.
- 학습 성공 기준.
- 제품 품질 성공 기준.
- 구현 준비 성공 기준.
- 실패 또는 pivot trigger.

### 11. Evidence Status

- 핵심 claim.
- 찬성 근거.
- 반대 근거.
- `missing_con_evidence` 여부.
- source quality, freshness, limitation.
- 이 근거로 결정해도 되는 것과 아직 결정하면 안 되는 것.

### 12. Known Risks / Open Questions

- high-risk 질문.
- medium/low-risk 질문.
- 답변 보류 이유.
- risk accepted 항목.
- 다음 Validation Action과 연결된 남은 리스크.

Decision Log와 Phase Plan은 SpecVersion metadata와 Planning Handoff sourceRefs에 포함한다. 이 둘은 별도 projection이나 export section이 될 수 있지만, 초기 section 수를 줄이기 위해 위 12개 section의 판단 상태를 대체해서는 안 된다.

## SpecVersion 계약

SpecVersion은 승인된 변경의 snapshot이다.

필수 메타데이터:

- `version_id`.
- `project_id`.
- `created_at`.
- `created_from`.
- `change_summary`.
- `linked_decision_ids`.
- `linked_research_result_ids`.
- `completeness_score`.
- `remaining_high_risk_count`.

## 변경 반영 규칙

### 자동 반영 가능

- 문장 다듬기.
- 중복 section 병합.
- 출처 링크 연결.
- 답변 내용의 단순 재배치.
- 명확한 오탈자 수정.
- 이미 승인된 결정을 다른 section에 일관되게 반영.

### 승인 필요

- primary target customer 변경.
- problem statement 변경.
- value proposition 변경.
- MVP 포함/제외 범위 변경.
- success criteria 변경.
- 리서치 근거가 약한 주장을 확정 문장으로 변경.
- phase boundary 변경.

## 완료 후보 조건

Living Product Spec은 다음 조건을 모두 만족할 때 완료 후보가 된다.

1. 필수 섹션이 모두 존재한다.
2. 핵심 주장에 찬성/반대 근거가 연결되어 있다.
3. high impact claim이 `pro_only` 상태로 남아 있지 않다.
4. high impact `missing_con_evidence`가 있으면 skeptical search 기록과 `risk_accepted` 또는 validation action이 있다.
5. high-risk AmbiguityIssue가 0개 또는 사용자 승인으로 보류 처리되어 있다.
6. primary customer, problem, value proposition, MVP scope, validation plan, success criteria가 승인되어 있다.
7. 충돌 상태인 section이 없다.
8. 복합 완성도 점수가 threshold 이상이다.
9. 남은 불확실성이 “실행 중 검증할 리스크”로 명시되어 있다.

## 완료 선언 결과물

완료 선언 시 시스템은 다음을 생성한다.

- Living Product Spec v1.
- Decision Log summary.
- Evidence Matrix summary.
- Pro/Con Evidence Gate summary.
- Validation Plan.
- Remaining Risks.
- Build Slice candidate note.
- Serve Checklist candidate note.
- Learning Loop hook: 어떤 사용자 반응을 다시 Evidence/Decision/다음 Build Slice로 되돌릴지.
- AI Runtime Handoff note: Codex app-server preview, manual research handoff, remaining runtime risks.

## 품질 원칙

- 확정 문장과 가설 문장을 구분한다.
- 출처가 약한 주장은 “가능성”으로 표현한다.
- 반대근거가 없는 핵심 결정은 완료할 수 없다.
- 반대근거가 아직 없으면 “없음”이 아니라 `missing_con_evidence`로 표시한다.
- `pro_evidence`만 있는 claim은 확정 문장이 아니라 hypothesis로 남긴다.
- 사용자가 승인하지 않은 AI 추천은 Spec 본문에 확정 반영하지 않는다.
- Codex app-server가 만든 preview artifact는 Living Product Spec에 직접 고정하지 않고 SpecUpdate, ResearchResult, Decision을 거친다.
- “나중에 검증”은 구체적 실험과 성공/실패 기준이 있을 때만 허용한다.
