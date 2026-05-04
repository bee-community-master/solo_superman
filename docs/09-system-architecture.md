# 09. System Architecture

## 아키텍처 원칙

- Core는 작고 명확하게 고정한다.
- 외부 runtime은 직접 결합하지 않고 adapter로 둔다.
- Phase 1은 macOS desktop + local-first를 우선한다.
- Windows, mobile, cloud control plane은 후속 Phase로 확장한다.

## Core stack

| 영역 | 선택 | 상태 |
| --- | --- | --- |
| Desktop shell | Tauri v2 | core 확정 |
| UI | React + TypeScript + Vite | core 확정 |
| Local data | local embedded libSQL + Drizzle | Phase 1 구현 확정 |
| State/data fetching | Zustand + TanStack Query | Phase 1 기본값 |
| ProductEngine Orchestrator | 중앙 command/event/state reducer | Phase 1 최상위 계약 |
| Spec Engine | TypeScript core service under Node/Hono sidecar | Phase 1 구현 확정 |
| Runtime | Adapter interface | core 확정 |
| Primary AI runtime | Codex app-server via CodexRuntimeAdapter | Phase 1 우선 |
| Cloud sync | Supabase optional sync | 후속/선택 기능 |
| Mobile | Expo | 후속 Phase |

Tauri는 frontend framework 선택이 자유롭고 macOS/Windows/Linux 및 mobile 확장 방향을 제공하므로, macOS-first desktop에서 시작해 Windows로 확장하려는 방향과 맞다.

## High-level architecture

Phase 1 구현 topology는 `Tauri + Node/Hono sidecar`다. Rust/Tauri는 native boundary를 소유하고, Node/Hono sidecar는 ProductEngine, DB repository, Codex app-server adapter, local API를 소유한다.

```text
Tauri Desktop App
├─ Rust native boundary
│  ├─ sidecar lifecycle
│  ├─ app data dir discovery
│  ├─ OS secret store references
│  ├─ file picker/export write
│  └─ get_sidecar_base_url command
├─ React/TypeScript UI
│  ├─ Decision Queue Center
│  ├─ Living Spec Canvas
│  ├─ Confidence/Risk panels
│  └─ Research/Activity Feed
└─ Node/Hono Sidecar
   ├─ Hono /api/v1 local API
   ├─ ProductEngine Orchestrator
   ├─ Spec Engine services
   ├─ Decision Queue Scheduler
   ├─ Research/Evidence services
   ├─ Completeness Scorer
   ├─ CodexRuntimeAdapter
   ├─ libSQL + Drizzle repositories
   ├─ SSE event stream
   └─ source cache / export helpers
```

Implementation-level 계약은 다음 문서를 따른다.

- `19-phase1-implementation-architecture.md`: package layout, dev scripts, sidecar lifecycle, native command boundary.
- `20-data-storage-contract.md`: libSQL/Drizzle, migration, repository/projection, remote config placeholder.
- `21-sidecar-api-runtime-contract.md`: Hono routes, validation envelope, local auth, SSE, Codex app-server integration. `26-api-route-behavior-catalog.md`: endpoint별 request/command/response/SSE/error behavior.
- `22-phase1-implementation-sequence.md`: 구현 PR 순서와 acceptance criteria.

## ProductEngine Orchestrator boundary

Phase 1 Application Core의 최상위 상태 전이 주체는 `ProductEngine Orchestrator`다. 자세한 제품 계약은 `18-product-engine-orchestrator.md`를 따른다. 구현 위치는 Node/Hono sidecar의 `packages/core`이며, 외부 노출은 `apps/sidecar`의 Hono API로만 한다.

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

- ChatGPT/Codex 로그인 흐름을 local desktop onboarding에 연결한다.
- Codex thread와 Project/Session을 연결한다.
- Spec 분석, 질문 생성, 리서치 프롬프트 생성, evidence 요약, Spec update suggestion을 수행한다.
- Codex stream event를 Activity Feed와 Execution Log로 변환한다.
- Phase 1 권한은 `sandbox_preview_allowed`다.
- 실제 파일 patch, shell 실행, browser action은 적용하지 않고 preview artifact로만 라우팅한다.
- SDK/CLI는 app-server가 부적합하거나 수동 handoff 이후 `17-ai-runtime-access-strategy.md`가 정의한 공식 Codex 경로가 필요할 때 fallback 후보로 둔다.

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

Phase 2+ 후보.

- 복잡한 웹 조작.
- cloud browser/proxy/CAPTCHA가 필요한 경우.
- custom browser tools.

Browser-use는 open-source agent와 cloud agent를 구분하므로, Phase 1에 번들링하지 않는다. ChatGPT Pro 웹 자동화는 Phase 2+에서 project-level blanket delegation, revoke, audit log, fallback chain을 갖춘 뒤 검토한다.

### GooseRuntime

v2 후보.

- MCP-heavy 작업.
- 로컬 agent 확장.
- provider routing.
- code/research subagent 후보.

Goose는 desktop app, CLI, API와 MCP extension ecosystem이 강하므로, core가 아니라 확장 runtime으로 둔다.

### CrewAIRuntime

v2+ 후보.

- 역할 기반 multi-agent research.
- 창업 전략/시장조사 flow.
- business planning agent team.

CrewAI Crews/Flows는 다중 agent와 event-driven workflow에 강하지만, Phase 1 desktop core에 바로 넣으면 Python runtime과 packaging 부담이 커진다.

## Local storage

Phase 1 저장소는 local embedded libSQL file이다. 구현 계약은 `20-data-storage-contract.md`를 따른다.

- database file: `<appDataDir>/solo-superman.db`.
- schema/migration: Drizzle ORM + Drizzle Kit generated SQL migrations.
- repository owner: Node/Hono sidecar.
- source cache folder: `<appDataDir>/source-cache/`.
- exports folder: `<appDataDir>/exports/`.
- secret value itself: OS secret store reference via Rust/Tauri native boundary.

기본 정책:

- 원본은 local이다.
- Phase 1 remote sync는 구현하지 않는다.
- Phase 1에는 remote URL/token reference/status를 담는 config slot만 둔다.
- 후속 sync가 들어와도 local event log와 SpecVersion이 canonical source다.

## Optional sync architecture

```text
Local libSQL
  -> Remote config placeholder in app_settings
  -> Supabase/Auth/Postgres/Realtime/Storage later
  -> Mobile/Remote monitor later
```

Supabase Realtime은 Broadcast, Presence, Postgres Changes를 제공하므로 후속 mobile approval, live dashboard, sync status 표시 후보로 적합하다. Phase 1에서는 optional sync runtime을 만들지 않고, `remoteDbUrl`, `remoteDbTokenRef`, `remoteSyncEnabled=false`, `remoteSyncStatus` 같은 설정 슬롯만 둔다.

## Security boundary

- RuntimeAdapter는 Project data 전체를 기본으로 받지 않는다.
- task별 `allowedDataRefs`만 전달한다.
- Phase 1에서 외부 전송 또는 Codex 분석 전 사용자에게 데이터 범위를 설명한다.
- Codex app-server는 sandbox preview 권한만 가진다.
- code/file/browser execution adapter는 Phase 1에서 실제 적용 비활성이다.
- ChatGPT Pro 웹 자동화는 Phase 2+ 비전이며 Phase 1 구현 범위가 아니다.

## Phase 1 implementation decisions

이전 packaging note의 열린 항목은 Phase 1 구현팩에서 다음처럼 고정한다.

| 항목 | Phase 1 결정 | 상세 문서 |
| --- | --- | --- |
| local backend topology | Tauri + Node/Hono sidecar | `19-phase1-implementation-architecture.md` |
| Rust/Tauri 역할 | native boundary only: sidecar lifecycle, app data dir, secret refs, picker/export | `19-phase1-implementation-architecture.md` |
| Node/Hono 역할 | ProductEngine, repositories, Codex adapter, Hono API, SSE | `19-phase1-implementation-architecture.md`, `21-sidecar-api-runtime-contract.md`, `26-api-route-behavior-catalog.md` |
| SQLite binding | local embedded libSQL via `@libsql/client` | `20-data-storage-contract.md` |
| schema/migration | Drizzle schema + generated SQL migrations | `20-data-storage-contract.md` |
| Codex app-server | stdio transport, generated schema pinning, sandbox preview | `21-sidecar-api-runtime-contract.md` |
| secret storage | value는 OS secret store, DB/config에는 reference만 저장 | `19-phase1-implementation-architecture.md`, `20-data-storage-contract.md` |
| source cache encryption | Phase 1은 app data dir 격리와 sensitive export prohibition; 파일 암호화는 후속 hardening 후보 | `20-data-storage-contract.md` |
| implementation order | PR-01~PR-09 sequence | `22-phase1-implementation-sequence.md` |

구현자가 이 표의 항목을 다시 선택하지 않는다. 변경이 필요하면 후속 ADR이 아니라 새 문서 개정 PR로 기존 결정의 근거와 migration impact를 함께 바꾼다.
