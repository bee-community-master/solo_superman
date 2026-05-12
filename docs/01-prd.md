# 01. Product Requirements Document

## 목적

Phase 1 MVP는 초기 창업자가 하나의 막연한 아이디어를 입력한 뒤, 질문과 리서치가 병렬로 진행되는 2~5시간 세션을 통해 Living Product Spec v1을 완성하는 폐루프를 제공한다.

## MVP 성공 정의

MVP는 다음 사용 시나리오가 한 프로젝트 안에서 끊기지 않고 완료될 때 성공이다.

1. 사용자가 아이디어를 입력한다.
2. 시스템이 초기 Living Product Spec 초안을 만든다.
3. 시스템이 모호함을 찾아 질문 우선순위 큐를 만든다.
4. 사용자는 3~5개 단위 질문 배치에 답한다.
5. 시스템은 답변과 병렬 리서치 결과를 바탕으로 찬반 근거 매트릭스를 만든다.
6. 시스템은 낮은 위험 문서 정리는 자동 반영하고, 핵심 결정은 승인 요청으로 보낸다.
7. 사용자가 핵심 결정을 승인하면 SpecVersion이 생성된다.
8. 복합 완성도 점수가 업데이트된다.
9. high-risk 질문이 임계치 이하이고 핵심 결정의 근거/반대근거/승인이 존재하면 완료 후보가 된다.

## 주요 기능 요구사항

### F1. Project 생성

- 사용자는 새 프로젝트를 생성하고 막연한 아이디어를 입력할 수 있어야 한다.
- 입력은 짧은 문장, 긴 메모, 붙여넣은 리서치 조각을 모두 허용한다.
- 프로젝트는 기본적으로 local-only 상태로 생성된다.
- 사용자가 명시적으로 켜기 전에는 cloud sync가 활성화되지 않는다.

### F2. Initial Spec 생성

- 시스템은 입력 아이디어를 기반으로 Living Product Spec 초안을 만든다.
- 초안은 최소 10개, 기본 12개 section을 생성해야 한다.
- 기본 section은 Problem, Target Customer, JTBD/Use Case, Current Alternatives, Value Proposition, Differentiation, MVP Scope, Non-goals, Validation Plan, Success Criteria, Evidence Status, Known Risks/Open Questions를 포함한다.
- 초안은 추측과 사실을 구분해야 한다.
- 불확실한 내용은 확정 문장으로 쓰지 않고 `가설`, `미확인`, `질문 필요`로 표시한다.
- 빈 section을 숨기지 않는다. 비어 있거나 약한 section은 `현재 가설`, `불확실성`, `필요한 결정`, `다음 질문` 형태의 판단 상태판으로 표시한다.

### F3. AmbiguityIssue 생성

- 시스템은 초안을 분석해 모호함, 충돌, 근거 부족, 결정 필요 항목을 생성한다.
- 각 이슈는 다음 필드를 가진다.
  - 관련 Spec section.
  - 심각도: high, medium, low.
  - 유형: missing, conflict, unsupported, vague, decision_required.
  - 왜 중요한지.
  - 답하면 잠기는 결정 또는 열리는 다음 행동.
  - 기대 답변 유형: choice, text, rank, evidence, experiment.
  - 해소에 필요한 질문 또는 리서치.
- 첫 ambiguity analysis는 최소 10개 이상의 AmbiguityIssue를 생성해야 한다. 단순 표현 수정은 제외하고, 고객/문제/JTBD, 대체재, MVP 포함/제외, 검증 가능성, 성공 기준, 채널, 구현 난이도, 보안/법률/운영 리스크, founder advantage를 폭넓게 훑는다.

### F4. Question Priority Queue

- 시스템은 AmbiguityIssue를 질문 카드로 변환한다.
- 질문은 3~5개 배치로 사용자에게 제시된다.
- 질문 배치는 high-risk/high-impact 항목을 우선한다.
- 질문마다 현재 이해, 왜 중요한가, 답변 방법, 선택지 설명이 있어야 한다.
- 질문마다 `decisionItUnlocks`와 영향받는 Spec section을 보여줘야 한다.
- 첫 화면의 중심 카드는 “다음에 무엇을 해야 하는가”를 설명하는 Next Best Action 형태여야 한다.

### F5. Answer capture

- 사용자의 답변은 단순 텍스트가 아니라 Decision 후보로 저장된다.
- 선택지 답변, 직접 입력, 복수 선택을 모두 지원한다.
- 답변은 어느 모호함을 해소했는지 연결되어야 한다.

### F6. Research Loop

- 시스템은 질문과 병렬로 리서치 작업을 생성한다.
- 리서치는 단순 요약이 아니라 핵심 결정별 찬성 근거, 반대 근거, 불확실성, 추가 질문을 생성한다.
- 출처는 사람이 확인 가능한 링크와 함께 저장한다.
- 리서치 결과는 바로 Spec에 반영되지 않고 Suggested Spec Update로 전환된다.

### F7. Suggested Spec Update

- 시스템은 답변과 리서치 결과를 바탕으로 변경 제안을 만든다.
- 낮은 위험 변경은 자동 반영 가능하다.
- 핵심 결정 변경은 승인 카드로 사용자에게 제시한다.
- 변경 제안에는 다음이 포함되어야 한다.
  - 바뀌는 section.
  - 변경 전/후 요약.
  - 근거.
  - 반대근거 또는 불확실성.
  - 사용자가 승인해야 하는 이유.

### F8. Decision approval

- 핵심 결정은 사용자 승인 전까지 확정되지 않는다.
- 승인 가능한 결정 유형은 다음과 같다.
  - primary customer segment.
  - problem statement.
  - value proposition.
  - MVP scope.
  - validation experiment.
  - success criteria.
  - phase boundary.
- 승인 결과는 Decision Log에 남는다.

### F9. SpecVersion 관리

- 승인된 변경은 새 SpecVersion을 만든다.
- 각 버전은 변경 이유, 연결된 답변, 연결된 리서치, 승인자를 기록한다.
- 사용자는 이전 버전과 현재 버전의 요약 차이를 볼 수 있어야 한다.

### F10. Composite Completeness 표시

- 시스템은 프로젝트의 완성도를 0~100%로 표시한다.
- 점수는 섹션 완성도, 질문 부채, 근거/반대근거, 결정 승인, 충돌 여부를 합산한다.
- 점수는 “더 답해야 할 이유”를 설명해야 하며, 숫자만 보여주면 안 된다.

### F11. Session control

- 사용자는 세션을 중단하고 재개할 수 있어야 한다.
- 중단 시 현재 상태 요약, 남은 high-risk 질문, 다음 추천 행동을 저장한다.
- 완료 후보 상태가 되면 시스템은 “완료 선언”, “더 깊게 질문”, “리서치 보강” 중 선택지를 제공한다.

### F12. AI Runtime Access

- Phase 1의 1차 AI 통합은 Codex app-server 기반 `CodexRuntimeAdapter`다.
- 일반 사용자 onboarding에서 API key 입력을 기본 요구하지 않는다.
- Codex 권한은 `sandbox_preview_allowed`로 제한한다.
- Codex는 질문, 리서치 프롬프트, evidence 요약, Spec update preview를 만들 수 있다.
- Codex가 만든 file diff, shell command, browser action은 Phase 1에서 실행되지 않고 preview artifact로만 남는다.
- 깊은 리서치가 필요하면 수동 프롬프트 핸드오프를 먼저 제공하고, 사용자가 풀 자동화를 원하면 `17-ai-runtime-access-strategy.md`가 정의한 공식 Codex 경로로만 리서치/분석을 진행한다.
- ChatGPT Pro 웹 자동화는 Phase 2.5+ preview/gate 비전이며 Phase 1 MVP 범위가 아니다.

### F13. Founder-facing language guardrail

- 사용자 화면, onboarding, CTA, export, Founder Brief에서는 `Phase 1.5A`, `Phase 1.5B`, `Effect task`, `schema version`, `Command failed` 같은 내부 구현 용어를 기본 노출하지 않는다.
- 내부 용어가 필요한 경우 debug/admin surface로 격리하고, 일반 사용자에게는 “근거 보강”, “실행 준비 메모”, “처리 실패”, “다음 단계 준비도”처럼 행동 중심 언어를 사용한다.
- founder-facing copy는 사용자가 지금 무엇을 해야 하고, 왜 중요한지, 답하면 어떤 결정이 열리는지를 먼저 보여준다.

## UX 요구사항

- 기본 레이아웃은 Decision Queue 중심이다.
- Living Product Spec outline은 항상 보조 패널에서 보인다.
- Research Feed는 질문/결정 카드에 연결되어야 한다.
- 각 질문 배치는 “왜 지금 이 질문인지”를 설명한다.
- 사용자는 질문이 계속 생겨도 현재 완성도와 종료 조건을 알아야 한다.

## 데이터 요구사항

- Phase 1 원본 저장소는 로컬 SQLite다.
- 선택 sync는 프로젝트 단위로 켠다.
- sync 상태는 `local_only`, `sync_enabled`, `sync_paused`, `sync_error` 중 하나다.
- sync 기능이 꺼져 있어도 모든 MVP 기능은 로컬에서 동작해야 한다.

## 보안/프라이버시 요구사항

- 사용자의 아이디어와 Spec은 기본적으로 로컬에 저장된다.
- 외부 리서치 또는 LLM 호출 전에 어떤 내용이 외부로 나가는지 설명한다.
- Codex app-server 통합은 실제 파일/쉘/브라우저 적용 없이 sandbox preview 권한으로 제한한다.
- cloud sync는 명시적 opt-in이다.
- 핵심 결정 자동 반영은 금지한다.

## 제외 범위

- 코드 자동 구현 또는 shell 실행.
- 브라우저 조작 자동 실행.
- ChatGPT Pro 웹 자동화.
- 모바일 원격 승인 앱.
- 팀 협업, 조직 권한, 공유 링크.
- 결제/과금.
- 외부 런타임 marketplace.

## MVP acceptance criteria

- 샘플 아이디어 1개로 end-to-end dry-run이 가능하다.
- 최소 10개, 기본 12개 필수 Spec section이 생성된다.
- 최소 10개 이상의 AmbiguityIssue가 식별된다.
- 첫 질문 배치는 3~5개 질문으로 구성된다.
- 모든 Question Card는 `왜 중요한가`, `답하면 잠기는 결정`, `관련 Spec section`, `expectedAnswerType`을 가진다.
- 최소 1개 핵심 결정에 대해 찬성 근거, 반대 근거, 불확실성, 추가 질문이 생성된다.
- 승인된 결정이 SpecVersion으로 반영된다.
- Codex app-server preview artifact가 실제 파일/쉘/브라우저 실행 없이 Queue/Spec/Research artifact로만 남는다.
- 복합 완성도 점수와 다음 행동이 표시된다.
- founder-facing UI copy에 내부 phase/command/schema/runtime label이 직접 노출되지 않는다.
- Completion Candidate 또는 Founder Brief에는 Known Risks와 Next Validation Action이 포함된다.
