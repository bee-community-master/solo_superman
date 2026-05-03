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
| Local data | SQLite/libSQL 계열 | core 확정 |
| State/data fetching | Zustand/Jotai + TanStack Query 후보 | 구현 전 확정 필요 |
| Spec Engine | 자체 TypeScript/Rust boundary | core 확정 |
| Runtime | Adapter interface | core 확정 |
| Cloud sync | Supabase optional sync | 후속/선택 기능 |
| Mobile | Expo | 후속 Phase |

Tauri는 frontend framework 선택이 자유롭고 macOS/Windows/Linux 및 mobile 확장 방향을 제공하므로, macOS-first desktop에서 시작해 Windows로 확장하려는 방향과 맞다.

## High-level architecture

```text
Tauri Desktop App
├─ React/TypeScript UI
│  ├─ Decision Queue
│  ├─ Spec Outline
│  ├─ Context Panel
│  └─ Research/Activity Feed
├─ Local Core
│  ├─ Spec Engine
│  ├─ Research Planner
│  ├─ Completeness Scorer
│  ├─ Approval Manager
│  └─ Sync Manager
├─ Local Storage
│  ├─ SQLite
│  ├─ encrypted secrets
│  └─ source cache
└─ Runtime Adapter Layer
   ├─ LocalResearchRuntime
   ├─ OpenClawRuntime later
   ├─ PlaywrightRuntime later
   ├─ BrowserUseRuntime later
   ├─ GooseRuntime later
   └─ CrewAIRuntime later
```

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
}
```

## RuntimeTaskInput

```ts
type RuntimeTaskInput = {
  projectId: string;
  taskType: 'research' | 'browser_research' | 'document_generation' | 'code_planning' | 'execution_preview';
  prompt: string;
  allowedDataRefs: string[];
  privacyMode: 'local_only' | 'sync_enabled';
  requiresUserApprovalBeforeExternalCall: boolean;
};
```

## Adapter 역할

### LocalResearchRuntime

Phase 1 기본 runtime이다.

- LLM/web research 호출을 얇게 감싼다.
- ResearchTask 상태를 SQLite에 기록한다.
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

v2 후보.

- 복잡한 웹 조작.
- cloud browser/proxy/CAPTCHA가 필요한 경우.
- custom browser tools.

Browser-use는 open-source agent와 cloud agent를 구분하므로, Phase 1에 무겁게 번들링하지 않고 adapter로 둔다.

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

Phase 1 저장소:

- SQLite database.
- source cache folder.
- encrypted secret store.
- exportable Markdown/JSON snapshot.

기본 정책:

- 원본은 local.
- sync는 mirror.
- sync 충돌 시 local을 우선하되, 충돌 resolution UI를 제공한다.

## Optional sync architecture

```text
Local SQLite
  → Sync Manager
  → Supabase Auth/Postgres/Realtime/Storage
  → Mobile/Remote monitor later
```

Supabase Realtime은 Broadcast, Presence, Postgres Changes를 제공하므로 후속 mobile approval, live dashboard, sync status 표시 후보로 적합하다. Phase 1에서는 optional sync 계약만 설계하고 구현은 핵심 폐루프 안정화 후 진행한다.

## Security boundary

- RuntimeAdapter는 Project data 전체를 기본으로 받지 않는다.
- task별 `allowedDataRefs`만 전달한다.
- 외부 전송 전 사용자에게 데이터 범위를 설명한다.
- code/file/browser execution adapter는 Phase 1에서 비활성이다.

## Packaging note

Phase 1 구현 전 결정할 항목:

- Tauri command와 local backend를 Rust 중심으로 둘지, Node/Hono sidecar를 둘지.
- SQLite binding 선택.
- LLM provider abstraction 위치.
- source cache 암호화 방식.

이번 docs에서는 이 항목을 “구현 직전 ADR 필요”로 남긴다.

