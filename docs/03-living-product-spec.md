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

### 1. Idea Summary

- 사용자가 처음 입력한 아이디어.
- 시스템이 구조화한 1문장 요약.
- 아직 확정되지 않은 가정.

### 2. Problem Statement

- 해결하려는 문제.
- 문제가 발생하는 맥락.
- 문제의 빈도/강도/비용.
- 문제를 겪는 주체.
- 반대근거 또는 문제 부정 가능성.

### 3. Target Customer and Segments

- primary customer.
- secondary customer.
- 제외할 고객.
- 세그먼트별 pain intensity.
- 접근 가능성.
- 구매/사용 의사결정자.

### 4. Value Proposition

- 사용자가 얻는 핵심 변화.
- 기존 대체재 대비 차별점.
- 정량 또는 정성 성공 신호.
- 약속하면 안 되는 과장 표현.

### 5. Alternatives and Competition

- 직접 경쟁.
- 간접 경쟁.
- 현재 사용자의 workaround.
- “아무것도 안 함”이라는 대체재.
- 각 대체재가 강한 이유.

### 6. Evidence Matrix

- 핵심 주장.
- 찬성 근거.
- 반대 근거.
- `missing_con_evidence` 여부.
- skeptical search 기록.
- 불확실성.
- 추가 질문.
- 출처.
- Known Risks 연결.

### 7. Validation Plan

- 검증해야 할 가설.
- 고객 인터뷰 질문.
- 랜딩페이지/프로토타입/수동 컨시어지 실험.
- 성공 기준.
- 실패 기준.
- 다음 행동.

### 8. MVP Scope

- Phase 1에 포함할 것.
- 제외할 것.
- 의도적으로 단순화한 것.
- 나중에 확장할 것.

### 9. Success Criteria

- 제품 검증 성공 기준.
- 사용자 행동 성공 기준.
- 기획서 품질 성공 기준.
- 구현 준비 성공 기준.

### 10. Decision Log

- 결정 내용.
- 결정 이유.
- 고려한 대안.
- 찬성/반대 근거.
- 승인 시점.
- 되돌릴 조건.

### 11. Open Questions

- high-risk 질문.
- medium-risk 질문.
- low-risk 질문.
- 답변 보류 이유.

### 12. Phase Plan

- MVP.
- v1.5.
- v2.
- v3.
- 각 Phase의 진입 조건.

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
- Phase 1 Implementation Handoff note.

## 품질 원칙

- 확정 문장과 가설 문장을 구분한다.
- 출처가 약한 주장은 “가능성”으로 표현한다.
- 반대근거가 없는 핵심 결정은 완료할 수 없다.
- 반대근거가 아직 없으면 “없음”이 아니라 `missing_con_evidence`로 표시한다.
- `pro_evidence`만 있는 claim은 확정 문장이 아니라 hypothesis로 남긴다.
- 사용자가 승인하지 않은 AI 추천은 Spec 본문에 확정 반영하지 않는다.
- “나중에 검증”은 구체적 실험과 성공/실패 기준이 있을 때만 허용한다.
