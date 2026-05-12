# 09. System Architecture

## 아키텍처 원칙

- Core는 작고 명확하게 고정한다.
- 외부 runtime은 직접 결합하지 않고 adapter로 둔다.
- Phase 3 web-local canonical 방향은 `local-first web app + local Node/Hono service`다.
- Windows/macOS 유지보수는 native shell을 늘리는 방식이 아니라 browser UI와 local service 계약으로 해결한다.
- hosted SaaS, mobile monitor, cloud control plane은 후속 opt-in capability이며 기본 topology가 아니다.

## Core stack

| 영역 | 선택 | 상태 |
| --- | --- | --- |
| Local Web Frontend | React + TypeScript + Vite in browser | Phase 3 web-local future canonical |
| Local Node/Hono Service | Hono loopback service | Phase 3 web-local future canonical |
| Removed native host history | Tauri v2 scaffold | historical context only; source/dependency/script path removed |
| Local data | local embedded libSQL + Drizzle | Phase 1~2.5 구현 확정, 계속 canonical |
| State/data fetching | Zustand + TanStack Query | Phase 1 기본값 유지 |
| ProductEngine Orchestrator | 중앙 command/event/state reducer | 최상위 제품 계약 |
| Spec Engine | TypeScript core service under Node/Hono sidecar | 구현 확정 |
| Runtime | Adapter interface | core 확정 |
| Primary AI runtime | Codex app-server via CodexRuntimeAdapter | sandbox preview 우선 |
| Controlled execution | Phase 3 adapter via `36-phase3-controlled-execution-contract.md` | preview + approval + rollback + audit 필요 |
| Cloud sync | Supabase optional sync | 후속/선택 기능 |
| Mobile | Expo or equivalent monitor | 후속 Phase |

Tauri/native shell은 제거된 historical native-host context이며 future/default/runtime path가 아니다. Phase 3 web-local 제품 방향은 사용자가 브라우저에서 여는 Local Web Frontend와 loopback Local Node/Hono Service 조합으로 고정한다.

## High-level architecture

Canonical Phase 3+ topology는 `Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db`다. Browser UI는 local static/web app으로 동작하고, Node/Hono service는 loopback-only API, ProductEngine, DB repository, Codex adapter, controlled execution adapter를 소유한다.

```text
Local Web Frontend
├─ React/TypeScript UI
│  ├─ Decision Queue Center
│  ├─ Living Spec Canvas
│  ├─ Confidence/Risk panels
│  ├─ Research/Activity Feed
│  └─ Phase 3 preview/approval/evidence surfaces
│
└─ Loopback HTTP client
   ├─ per-run local capability token
   ├─ explicit local origin allowlist
   └─ no direct DB/Codex/filesystem access

Local Node/Hono Service
├─ Hono /api/v1 loopback API
├─ ProductEngine Orchestrator
├─ Spec Engine services
├─ Decision Queue Scheduler
├─ Research/Evidence services
├─ Completeness Scorer
├─ CodexRuntimeAdapter
├─ Controlled Execution Adapter (Phase 3)
├─ libSQL + Drizzle repositories
├─ SSE event stream
└─ source cache / export / audit / rollback helpers
```

Implementation-level 계약은 다음 문서를 따른다.

- `19-phase1-implementation-architecture.md`: web-local implementation snapshot, package layout, dev scripts, sidecar lifecycle, migration impact.
- `20-data-storage-contract.md`: libSQL/Drizzle, migration, repository/projection, remote config placeholder.
- `21-sidecar-api-runtime-contract.md`: Hono routes, validation envelope, local auth, SSE, Codex app-server integration, loopback/CORS/token policy.
- `26-api-route-behavior-catalog.md`: endpoint별 request/command/response/SSE/error behavior.
- `36-phase3-controlled-execution-contract.md`: Phase 3 `ExecutionAuthorityRecord`, approval, rollback, audit, web/local service security contract.

## ProductEngine Orchestrator boundary

Application Core의 최상위 상태 전이 주체는 `ProductEngine Orchestrator`다. 자세한 제품 계약은 `18-product-engine-orchestrator.md`를 따른다. 구현 위치는 `packages/core`이며, 외부 노출은 `apps/sidecar`의 Hono API로만 한다.

ProductEngine은 다음을 소유한다.

- user command 수신과 precondition 검증.
- append-only event summary 생성.
- Spec/Research/Queue/Scoring/Runtime module 호출 순서.
- session state reduce.
- 모든 핵심 event 이후 Queue priority 재계산.
- active batch 안정성과 next batch 재정렬 정책.

ProductEngine이 직접 소유하지 않는 것은 다음이다.

- Spec 문장 후보 생성의 세부 로직.
- Research source 탐색과 EvidenceMatrix 산식.
- Runtime adapter 내부 실행 방식.
- 화면 layout과 component 구현.
- DB/API/DTO/route 상세. 해당 구현 계약은 `20-data-storage-contract.md`, `21-sidecar-api-runtime-contract.md`, `25-contracts-dto-catalog.md`, `26-api-route-behavior-catalog.md`가 소유한다.
- Phase 3 실제 file/shell/browser mutation. ProductEngine은 authority/evidence event를 다루고 adapter 실행은 `36-phase3-controlled-execution-contract.md`의 approval/sandbox/rollback 계약을 따른다.

따라서 Architecture 관점에서 Spec Engine, Research Planner, Completeness Scorer, Runtime Adapter는 ProductEngine 아래의 module/service boundary이며, 세션 상태를 단독으로 확정하지 않는다.

## RuntimeAdapter contract

```ts
interface AgentRuntime {
  id: string;
  name: string;

  startTask(input: RuntimeTaskInput): Promise<RuntimeTaskRef>;
  getTask(taskId: string): Promise<RuntimeTaskStatus>;
  cancelTask(taskId: string): Promise<void>;
  streamEvents(taskId: string): AsyncIterable<RuntimeEvent>;

  supportsCron?: boolean;
  supportsTaskFlow?: boolean;
  supportsBrowser?: boolean;
  supportsFilePatch?: boolean;
  supportsSubagents?: boolean;
  supportsSandboxPreview?: boolean;
  supportsManualHandoff?: boolean;
  supportsDelegatedBrowserAutomation?: boolean;
}
```

## RuntimeTaskInput

```ts
type RuntimeTaskInput = {
  projectId: string;
  taskType:
    | 'spec_analysis'
    | 'question_generation'
    | 'research'
    | 'research_handoff'
    | 'browser_research'
    | 'document_generation'
    | 'code_planning'
    | 'execution_preview';
  prompt: string;
  allowedDataRefs: string[];
  privacyMode: 'local_only' | 'sync_enabled';
  requiresUserApprovalBeforeExternalCall: boolean;
};
```

## Adapter 역할

### CodexRuntimeAdapter

Phase 1 primary AI runtime이다. 구현 후보는 Codex app-server이며, 자세한 접근 전략은 `17-ai-runtime-access-strategy.md`를 따른다.

- ChatGPT/Codex 로그인 흐름을 local web onboarding에 연결한다.
- Codex thread와 Project/Session을 연결한다.
- Spec 분석, 질문 생성, 리서치 프롬프트 생성, evidence 요약, Spec update suggestion을 수행한다.
- Codex stream event를 Activity Feed와 Execution Log로 변환한다.
- Phase 1 권한은 `sandbox_preview_allowed`다.
- 실제 파일 patch, shell 실행, browser action은 적용하지 않고 preview artifact로만 라우팅한다.
- SDK/CLI는 app-server가 부적합하거나 수동 handoff 이후 `17-ai-runtime-access-strategy.md`가 정의한 공식 Codex 경로가 필요할 때 fallback 후보로 둔다.

### ControlledExecutionAdapter

Phase 3 후보 runtime이다. 구현 계약은 `36-phase3-controlled-execution-contract.md`가 소유한다.

- `PlanningHandoffArtifact`와 `BoundedAgentOutputRecord`에서 preview artifact를 만든다.
- 사용자가 승인한 `ExecutionAuthorityRecord` 없이는 실행하지 않는다.
- file diff, shell command, browser action별 sandbox/rollback/evidence/audit을 강제한다.
- hosted SaaS나 remote worker가 아니라 Local Node/Hono Service 안의 loopback-only controlled adapter에서 시작한다.

### LocalResearchRuntime

Phase 1 보조 runtime이다.

- 수동 프롬프트 핸드오프 결과를 ResearchResult로 import한다.
- 가벼운 public source 정리와 source cache 연결을 담당한다.
- ResearchTask 상태를 local embedded libSQL에 기록한다.
- 복잡한 background orchestration은 하지 않는다.

### OpenClawRuntime

v1.5 후보.

- detached background research task.
- long-running task ledger.
- Task Flow 기반 다단계 research pipeline.
- cron/recurring research later.

OpenClaw 문서상 background task는 detached work의 ledger로 적합하고, Task Flow는 multi-step flow의 durable state와 revision tracking에 적합하다.

### PlaywrightRuntime

v1.5~v2 후보.

- 기본 웹 페이지 수집.
- browser smoke test.
- later browser action preview.

### BrowserUseRuntime

Phase 2.5+ 후보.

- 복잡한 웹 조작.
- cloud browser/proxy/CAPTCHA가 필요한 경우.
- custom browser tools.

Browser-use는 open-source agent와 cloud agent를 구분하므로, Phase 1에 번들링하지 않는다. ChatGPT Pro 웹 자동화는 Phase 2.5에서 preview/gate로 검증하고, Phase 3에서도 `ExecutionAuthorityRecord` 없이는 실행하지 않는다.

### GooseRuntime

v2+ 후보.

- MCP-heavy 작업.
- 로컬 agent 확장.
- provider routing.
- code/research subagent 후보.

Goose는 web app, CLI, API와 MCP extension ecosystem이 강하므로, core가 아니라 확장 runtime으로 둔다.

### CrewAIRuntime

v2+ 후보.

- 역할 기반 multi-agent research.
- 창업 전략/시장조사 flow.
- business planning agent team.

CrewAI Crews/Flows는 다중 agent와 event-driven workflow에 강하지만, Phase 1 core에 바로 넣으면 Python runtime과 packaging 부담이 커진다.

## Local storage

저장소는 local embedded libSQL file이다. 구현 계약은 `20-data-storage-contract.md`를 따른다.

- database file: `<appDataDir>/solo-superman.db` 또는 local service가 소유한 equivalent app data dir.
- schema/migration: Drizzle ORM + Drizzle Kit generated SQL migrations.
- repository owner: Node/Hono sidecar.
- source cache folder: `<appDataDir>/source-cache/`.
- exports folder: `<appDataDir>/exports/`.
- secret value itself: local service/browser UI는 raw credential을 저장하지 않는다. OS secret store reference는 후속 local service secret adapter로만 다룬다.

기본 정책:

- 원본은 local이다.
- Phase 1~3 remote sync는 기본 구현이 아니다.
- remote URL/token reference/status는 config slot만 둔다.
- 후속 sync가 들어와도 local event log와 SpecVersion이 canonical source다.

## Optional sync architecture

```text
Local libSQL
  -> Remote config placeholder in app_settings
  -> Supabase/Auth/Postgres/Realtime/Storage later
  -> Mobile/Remote monitor later
```

Supabase Realtime은 Broadcast, Presence, Postgres Changes를 제공하므로 후속 mobile approval, live dashboard, sync status 표시 후보로 적합하다. Phase 3에서는 optional sync runtime을 만들지 않고, local controlled execution evidence가 먼저 안정되어야 한다.

## Security boundary

- RuntimeAdapter는 Project data 전체를 기본으로 받지 않는다.
- task별 `allowedDataRefs`만 전달한다.
- Phase 1에서 외부 전송 또는 Codex 분석 전 사용자에게 데이터 범위를 설명한다.
- Codex app-server는 sandbox preview 권한만 가진다.
- Phase 3 controlled execution은 preview + approval + rollback + audit 없이는 실제 적용하지 않는다.
- ChatGPT Pro 웹 자동화는 Phase 2.5 preview/gate 후보이며, Phase 3에서도 승인 없는 browser action은 금지한다.

## Phase 3 implementation decisions

이전 packaging note의 열린 항목은 web/local 방향 재정렬에 따라 다음처럼 해석한다.

| 항목 | Phase 3 기준 | 상세 문서 |
| --- | --- | --- |
| local backend topology | Local Web Frontend + Local Node/Hono Service | `19-phase1-implementation-architecture.md`, `36-phase3-controlled-execution-contract.md` |
| Native host history | removed historical context; future/default/runtime path 아님 | `19-phase1-implementation-architecture.md` |
| Node/Hono 역할 | ProductEngine, repositories, Codex adapter, Hono API, SSE, controlled execution orchestration | `21-sidecar-api-runtime-contract.md`, `36-phase3-controlled-execution-contract.md` |
| SQLite binding | local embedded libSQL via `@libsql/client` | `20-data-storage-contract.md` |
| schema/migration | Drizzle schema + generated SQL migrations | `20-data-storage-contract.md` |
| Codex app-server | stdio transport, generated schema pinning, sandbox preview | `21-sidecar-api-runtime-contract.md` |
| Phase 3 authority | `ExecutionAuthorityRecord` before execution | `36-phase3-controlled-execution-contract.md` |
| secret storage | credential values are never persisted by web UI/local service; refs only | `10-security-privacy-and-approval.md`, `20-data-storage-contract.md`, `36-phase3-controlled-execution-contract.md` |
| implementation order | docs/verifier reset -> web/local service contract -> Phase 3 adapter slices | `11-roadmap-and-phase-boundaries.md`, `29-phase-capability-implementation-matrix.md` |

구현자가 이 표의 항목을 다시 선택하지 않는다. 변경이 필요하면 새 문서 개정 PR로 기존 결정의 근거와 migration impact를 함께 바꾼다.
