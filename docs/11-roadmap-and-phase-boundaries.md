# 11. Roadmap and Phase Boundaries

## Phase 원칙

- Phase는 기술 레이어가 아니라 검증할 사용자 가치 단위로 나눈다.
- 각 Phase는 이전 Phase의 성공 조건을 전제로 한다.
- non-goal로 정한 항목은 해당 Phase 진입 전까지 구현하지 않는다.

## Phase 0: 기획 문서 완성

현재 레포의 단계다.

산출물:

- 23개 번호 문서와 README로 구성된 상세 기획/구현 계약 문서.
- 구현자 핸드오프 검토.
- 샘플 아이디어 dry-run.

완료 조건:

- 문서 간 상충 없음.
- Phase 1 구현자가 추가 제품 결정을 하지 않아도 됨.
- dry-run에서 질문 큐, 리서치 매트릭스, Spec 업데이트, 완성도 점수가 설명 가능.
- Phase 1 구현자가 topology, package layout, DB binding, API route shape/endpoint behavior, Codex boundary, PR sequence를 다시 결정하지 않아도 됨.

## Phase 1: Research 포함 Spec 폐루프 MVP

목표:

- 초기 창업자가 하나의 아이디어를 Living Product Spec v1까지 구체화한다.

포함:

- macOS desktop app.
- Tauri + React/Vite desktop shell.
- Node/Hono sidecar.
- local embedded libSQL + Drizzle.
- Project 생성.
- Initial Spec Draft.
- AmbiguityIssue 분석.
- Question Priority Queue.
- 3~5개 질문 배치.
- 답변 저장.
- 실제 리서치 결과 저장.
- Codex app-server 기반 Spec/Research sandbox preview.
- 수동 프롬프트 핸드오프와 공식 Codex 경로 fallback.
- 찬반 근거 매트릭스.
- Suggested Spec Update.
- Decision Approval.
- SpecVersion.
- Composite Completeness Score.
- Hono `/api/v1` local API and SSE event stream.
- Codex app-server sandbox preview adapter.
- Founder Brief export.

제외:

- 팀 협업.
- 모바일 앱.
- 결제/과금.
- 자동 코드 실행.
- 브라우저 조작 실행.
- ChatGPT Pro 웹 자동화.
- actual remote sync beyond config placeholder.
- runtime marketplace.

완료 조건:

- 샘플 아이디어 하나가 end-to-end로 처리된다.
- 완료 후보 card가 생성된다.
- 사용자가 Spec v1과 Founder Brief를 export할 수 있다.
- PR-01~PR-09 implementation sequence의 E2E dry-run acceptance를 통과한다.

## Phase 1.5: Background Research Runtime

목표:

- 리서치 작업을 더 안정적으로 background task로 운영한다.

후보:

- OpenClawRuntime adapter.
- Research task ledger.
- 실패/재시도/취소.
- long-running research status.

진입 조건:

- Phase 1에서 Research Loop가 제품 가치로 검증됨.
- local research task 상태 관리가 병목이 됨.

제외:

- 자동 코드 실행.
- 팀 협업.
- 결제.

## Phase 2: Execution Planning Handoff

목표:

- Living Product Spec을 구현 가능한 task plan으로 변환한다.

포함:

- Spec → task breakdown.
- PR/issue 단위 실행 계획.
- implementation readiness checklist.
- file diff/command/browser action은 preview까지만 설계 가능.

제외:

- 자동 적용.
- shell 실행.
- 파일 patch 실행.

## Phase 2.5: Browser Automation Preview

목표:

- 시장/경쟁/검증 리서치에서 브라우저 자동화가 필요한 경우 preview와 통제권을 제공한다.
- ChatGPT Pro 웹 자동화를 Phase 2+ 비전으로 검증한다.

후보:

- PlaywrightRuntime.
- BrowserUseRuntime.
- ChatGPT Pro web research automation.
- project-level blanket delegation.
- revoke control.
- action preview.
- source capture.

진입 조건:

- Phase 1 수동 프롬프트 핸드오프가 실제 리서치 병목으로 확인됨.
- ChatGPT 웹 자동화의 정책/약관/세션/사용량 제한 리스크 검토가 끝남.
- fallback chain이 구현되어 있음.
- audit log와 revoke control이 설계되어 있음.

제외:

- 사용자 승인 없는 form submission.
- 로그인/결제/민감 작업 자동 실행.
- ChatGPT 계정 공유 또는 인증정보 대리 보관.

## Phase 3: Safe Execution Adapter

목표:

- 코드/문서/브라우저 실행을 approval-first 방식으로 제공한다.

포함:

- file diff preview.
- shell command preview.
- browser action preview.
- sandbox.
- rollback.
- audit log.

진입 조건:

- Phase 2 task breakdown 품질이 충분히 검증됨.
- approval model이 안정됨.

## Phase 4: Optional Cloud and Mobile Monitor

목표:

- 프로젝트 sync와 모바일 원격 승인/모니터링을 제공한다.

포함:

- Supabase optional sync.
- Expo mobile app.
- push notification.
- approval queue monitor.
- task progress monitor.

진입 조건:

- 사용자가 desktop 세션 밖에서도 질문/승인을 처리하려는 니즈가 확인됨.

## Phase 5: Team Collaboration

목표:

- 개인 창업자에서 소규모 창업팀으로 확장한다.

포함:

- workspace sharing.
- role/permission.
- comment/review.
- decision owner.
- audit log.

진입 조건:

- 개인용 workflow가 안정되고, 공유 요구가 반복적으로 확인됨.

## Phase 6: Advanced Multi-agent Strategy Engine

목표:

- 창업 전반 리서치/전략/실행을 다중 agent workflow로 확장한다.

후보:

- GooseRuntime for MCP-heavy local workflows.
- CrewAIRuntime for strategy/research crews.
- OpenClaw Task Flow for durable pipelines.

포함 가능:

- market research crew.
- investor narrative crew.
- product strategy critic.
- validation experiment planner.

## Phase guardrails

- Phase 1 완료 전 자동 실행 기능을 만들지 않는다.
- Phase 1에서 Codex app-server는 sandbox preview 권한을 넘지 않는다.
- Phase 1에서 ChatGPT Pro 웹 자동화를 만들지 않는다.
- Phase 1 완료 전 모바일 앱을 만들지 않는다.
- Phase 1 완료 전 결제/과금을 만들지 않는다.
- Phase 1 완료 전 팀 협업을 만들지 않는다.
- cloud sync는 local-first 원칙을 깨지 않는 opt-in이어야 한다.
- Phase 1에서 remote sync는 remote config placeholder only로 남긴다.
- Phase 1 implementation sequence는 `22-phase1-implementation-sequence.md`를 따른다.

