# 00. Product Brief

## 한 문장 정의

Solo Superman은 솔로 창업자가 막연한 아이디어를 AI와 함께 질문, 리서치, 결정, 최소 실행 계획, 서빙 준비, 학습 루프까지 전환하도록 돕는 **local-first Founder OS**다.

## Founder OS 여정

Solo Superman은 PRD 생성기나 코드 자동 생성기가 아니다. 제품의 북극성은 창업자가 다음 경로를 안전하게 통과하게 하는 것이다.

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

초기 제품은 이 전체 여정 중 `Idea -> Spec -> Evidence -> Decision`을 가장 깊게 다룬다. Phase 2 Planning Handoff에서는 Build Slice, Serve Checklist, Learning Loop를 `docs/33-build-slice-serve-learning-loop.md`에 정의된 checklist/handoff 계약으로 연결하며, Controlled Execution capability 전에는 실제 file patch, shell command, browser action, deploy를 실행하지 않는다.

## 문제 정의

AI 시대에는 코드를 잘 쓰는 능력만큼이나, AI가 실행할 수 있을 정도로 모호하지 않은 기획서를 만드는 능력이 중요하다. 하지만 초기 창업자는 보통 다음 상태에서 시작한다.

- 아이디어는 있지만 문제정의가 흐릿하다.
- 타깃 고객과 고객 세그먼트가 섞여 있다.
- 경쟁/대체재를 충분히 보지 못했다.
- MVP 범위가 기능 욕심과 검증 목적 사이에서 흔들린다.
- 리서치 근거와 개인적 직감이 구분되지 않는다.
- AI에게 구현을 시켜도, 원래 기획이 모호해 결과물이 계속 어긋난다.

Solo Superman은 이 문제를 “AI가 대신 기획서를 작성한다”가 아니라 **AI가 창업자의 의사결정 품질을 높이고, 만들 것과 만들지 않을 것을 잠근 뒤, 다음 실행 조각과 학습 기준까지 남긴다**로 정의한다.

## 첫 핵심 사용자

### Primary persona: 초기 창업자

- 제품 아이디어는 있으나 아직 문제/고객/검증 방식이 충분히 선명하지 않다.
- 혼자 또는 매우 작은 팀으로 움직인다.
- AI 도구에 익숙하지만, AI 결과물을 그대로 믿기보다 스스로 판단하고 싶다.
- 코드 구현 전, 모호함이 낮은 제품 기획서와 검증 계획이 필요하다.

### 제외되는 1차 사용자

- 대기업 PM 조직.
- 이미 정교한 product ops 체계를 가진 팀.
- 단순 문서 생성만 원하는 사용자.
- 코드 자동화 에이전트 관제만 원하는 파워유저.

## 핵심 Job-to-be-Done

> “나는 막연한 창업 아이디어를 가지고 있다. 몇 시간 안에 문제정의, 타깃, 가치제안, 고객 세그먼트, 경쟁/대체재, 검증실험, 리서치 근거, MVP 범위, 성공기준까지 촘촘히 정리하고 싶다.”

이 JTBD에서 중요한 것은 문서 분량이 아니라 결정 품질이다. 따라서 제품은 다음 세 가지를 동시에 달성해야 한다.

1. **질문한다** - 핵심 모호함을 찾아 창업자가 직접 판단하도록 만든다.
2. **리서치한다** - 주장마다 찬성/반대 근거와 불확실성을 만든다.
3. **기록한다** - 승인된 결정만 Living Product Spec에 반영하고 버전을 남긴다.

## 가치제안

| 가치 | 설명 | 제품 기능 |
| --- | --- | --- |
| 모호함 감소 | 아이디어의 빈칸과 충돌을 찾아낸다 | AmbiguityIssue, Question Queue |
| 판단 품질 향상 | 주장별 찬반 근거와 불확실성을 구조화한다 | Evidence Matrix, Research Loop |
| 실행 가능성 | 구현/검증으로 이어질 만큼 문서를 구조화한다 | Living Product Spec, Build Slice Plan, Serve Checklist |
| 통제감 | 사용자가 얼마나 완성했는지 계속 볼 수 있다 | Composite Completeness Score |
| 안전한 AI 사용 | AI가 핵심 결정을 대신하지 않는다 | Approval Gate, Decision Log |

## 제품 원칙

1. **Spec-first**: spec은 구현 보조문서가 아니라 제품 판단의 중심 산출물이다.
2. **Decision-first**: 예쁜 문장보다 어떤 결정을 왜 내렸는지가 중요하다.
3. **Evidence-aware**: 중요한 주장에는 지지 근거와 반대 근거가 같이 있어야 한다.
4. **User-owned judgment**: AI는 제안하고 정리하지만, 핵심 결정은 사용자가 승인한다.
5. **Progress-visible**: 질문이 많아도 사용자는 남은 거리와 완료 기준을 알아야 한다.
6. **Local-first**: 민감한 창업 아이디어는 기본적으로 로컬에 머문다.
7. **Build-slice before build-all**: 실행 단계로 넘어가더라도 전체 제품이 아니라 가장 작고 검증 가능한 product slice를 먼저 잠근다.
8. **Learning-loop aware**: Served MVP는 끝이 아니라 사용자 반응을 다시 Evidence, Decision, 다음 Build Slice로 되돌리는 시작점이다.

## Phase 1 범위

Phase 1은 “Research 포함 Spec 폐루프”다.

```text
Idea Input
→ Initial Living Product Spec Draft
→ AmbiguityIssue 생성
→ Question Priority Queue 생성
→ 3~5개 질문 배치
→ 답변 저장
→ 병렬 Research Task
→ Pro/Con Evidence Matrix
→ Suggested Spec Update
→ 핵심 결정 승인
→ SpecVersion 생성
→ Composite Completeness 갱신
```

## Phase 1 non-goals

- 팀 협업, 조직 권한, 멀티유저 동시 편집.
- 자동 코드 실행, shell 실행, 파일 수정, 브라우저 조작 실행.
- 모바일 앱.
- 결제, 구독, 사용량 과금.

이 항목들은 장기 roadmap에서 다룰 수 있으나 Phase 1 구현자가 시작 범위로 해석하면 안 된다.

## 가장 경계할 실패

### 1순위: 무한 질문 루프

질문이 계속 쌓이는 제품은 사용자가 “끝이 없다”고 느끼는 순간 실패한다. 따라서 제품은 항상 다음을 보여줘야 한다.

- 현재 복합 완성도.
- high-risk 질문 수.
- 다음 3~5개 질문이 왜 중요한지.
- 지금 멈추면 어떤 수준의 Spec이 되는지.
- 완료 선언까지 무엇이 남았는지.

### 보조 실패 모드

- 그럴듯한 문서 생성기: 근거 없이 보기 좋은 PRD만 만드는 실패.
- AI 과잉결정: 타깃/가치제안/MVP 범위를 AI가 대신 결정하는 실패.
- 리서치 신뢰성 부족: 출처와 반대근거가 약해 잘못된 확신을 주는 실패.
