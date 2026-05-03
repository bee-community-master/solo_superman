# 10. Security, Privacy, and Approval

## 원칙

초기 창업자의 아이디어와 리서치 노트는 민감 정보다. Solo Superman은 기본적으로 local-first여야 하며, 사용자가 명시적으로 허용하지 않은 동기화나 외부 전송을 하면 안 된다.

## 데이터 위치 정책

| 데이터 | 기본 위치 | 외부 전송 조건 |
| --- | --- | --- |
| raw idea | local SQLite | 사용자가 LLM/research 전송 승인 |
| Living Product Spec | local SQLite | optional sync opt-in |
| answers | local SQLite | 연결된 research/LLM task 승인 |
| research sources | local cache | public URL fetch 가능, private 자료는 승인 필요 |
| decisions | local SQLite | optional sync opt-in |
| secrets | OS keychain/encrypted store | 전송 금지 |

## Sync 정책

- 프로젝트는 기본 `local_only`다.
- sync는 프로젝트 단위로 켠다.
- sync를 켤 때 사용자는 어떤 데이터가 cloud에 저장되는지 봐야 한다.
- sync를 꺼도 local 데이터가 삭제되지 않는다.
- sync 오류는 Spec 작업을 막지 않는다.

## 외부 LLM/리서치 호출 전 disclosure

사용자에게 다음을 보여준다.

- 전송될 정보 요약.
- 목적.
- 사용될 provider/runtime.
- 저장 여부.
- 민감한 section 제외 여부.

## Approval boundary

### 자동 허용 가능

- 문장 정리.
- section 재배치.
- 중복 제거.
- source link 연결.
- already-approved decision의 일관 반영.
- low-risk completeness score 업데이트.

### 사용자 승인 필수

- primary customer 변경.
- problem statement 확정.
- value proposition 확정.
- MVP scope 변경.
- success criteria 변경.
- validation experiment 확정.
- phase boundary 변경.
- cloud sync 활성화.
- private document 외부 분석.
- code/file/browser execution.

## Decision approval 상태

```text
proposed → approved
         → rejected
         → revised
         → deferred
```

- `approved`: SpecVersion에 반영 가능.
- `rejected`: 추천안 폐기, 관련 질문 재생성 가능.
- `revised`: 사용자가 수정한 결정으로 재평가.
- `deferred`: Open Questions에 남기고 완료 가능성 판단에 반영.

## Runtime permission tiers

### Tier 0: Local document operations

- Spec drafting.
- local scoring.
- local question generation.
- SQLite read/write.

Phase 1 기본 허용.

### Tier 1: External research/LLM calls

- public web research.
- LLM analysis.
- source summarization.

사용자에게 데이터 전송 범위를 설명한다.

### Tier 2: Cloud sync

- Supabase Auth/Postgres/Realtime/Storage.

프로젝트 단위 opt-in 필요.

### Tier 3: Browser automation

- Playwright/Browser-use browsing.
- form fill/action preview.

Phase 1 구현 제외. v2에서 explicit approval 필요.

### Tier 4: File/code/shell execution

- file patch.
- shell command.
- code generation applied to repo.

Phase 1 구현 제외. 장기적으로도 preview + approval + rollback이 필수다.

## Audit log

모든 high-impact action은 audit log에 남긴다.

필드:

- actor: user, ai, runtime.
- action type.
- before/after summary.
- linked decision/evidence.
- timestamp.
- approval status.

## 신뢰 UX

- “AI가 바꾼 것”과 “사용자가 승인한 것”을 구분한다.
- 리서치 출처를 숨기지 않는다.
- 불확실성은 점수 하락 요인으로 보여준다.
- 완료 선언 때 남은 리스크를 명시한다.

## 금지 사항

- private idea를 사용자 모르게 cloud에 저장하지 않는다.
- 핵심 결정을 AI 추천만으로 확정하지 않는다.
- 외부 출처가 없는 시장 주장을 확정 문장으로 쓰지 않는다.
- Phase 1에서 자동 코드 실행을 제공하지 않는다.

