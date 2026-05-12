# 36. Phase 3 Controlled Execution Contract

## 목적

이 문서는 Phase 3 Safe Execution Adapter의 canonical 계약이다. Phase 2.5까지는 Artifact+Gate와 Planning-ready handoff를 product code로 고정했지만, 실제 file diff, shell command, browser action 적용은 아직 제품 capability가 아니다. Phase 3는 그 다음 단계를 **approval-first controlled execution**으로 여는 계약이며, 기본 배포 방향은 `local-first web app + local Node/Hono service`다.

Phase 3 이후 방향성은 다음으로 재정렬한다.

- `Local Web Frontend`는 사용자가 브라우저에서 여는 기본 UI다.
- `Local Node/Hono Service`는 loopback-only API, ProductEngine, repository, runtime adapter, audit writer를 소유한다.
- Tauri/native shell은 future default가 아니라 legacy/current host residue이며, Phase 3 구현을 막지 않는 선에서 containment/removal 대상으로 둔다.
- no hosted SaaS default: hosted control plane, team sync, billing, remote execution은 Phase 3 기본값이 아니다.
- browser-only DB rewrite도 하지 않는다. canonical data/event source는 계속 local service와 local embedded DB다.

## Scope

Phase 3에서 허용되는 capability는 다음뿐이다.

- file diff preview를 사용자가 승인한 뒤 제한된 workspace/sandbox에 적용한다.
- shell command preview를 사용자가 승인한 뒤 제한된 allowlist/sandbox에서 실행한다.
- browser action preview를 사용자가 승인한 뒤 local/dev target 중심으로 실행한다.
- 모든 action은 preview, approval, sandbox boundary, rollback reference, execution evidence, audit record를 남긴다.

Phase 3에서 여전히 제외한다.

- 승인 없는 file/shell/browser/deploy/external mutation.
- credential custody, 계정 대리 보관, secret value 저장.
- hosted web origin에서 사용자의 local sidecar를 묵시적으로 제어하는 capability.
- external-production mutation, 결제/법률/의료/금융 등 high-stakes 제출 자동화.
- 팀 협업, billing, marketplace, public SaaS dashboard.

## Canonical topology

```text
Browser user session
  -> Local Web Frontend (React/Vite static web app)
  -> loopback HTTP with per-run local capability token
  -> Local Node/Hono Service
     -> ProductEngine/contracts/db
     -> Controlled Execution Adapter
     -> Audit/Evidence/Rollback ledger
```

Runtime ownership:

| Layer | Owner | Contract |
| --- | --- | --- |
| Local Web Frontend | `apps/desktop` web build or renamed successor | UI, preview review, approval decision capture, evidence display |
| Local Node/Hono Service | `apps/sidecar` | auth, CORS, CSRF/replay checks, ProductEngine command boundary, execution adapter orchestration |
| Product contracts | `packages/contracts` | DTO/envelope/schema source of truth |
| ProductEngine | `packages/core` | pure reducer/effect plan; no direct shell/browser/filesystem mutation |
| Repository/audit ledger | `packages/db` | append-only events, execution authority records, evidence refs, rollback refs |
| Legacy host | Tauri/native shell | compatibility residue only; not Phase 3 future default |

## Security and local service contract

The Phase 3 sidecar remains local-only.

- `Local Node/Hono Service` must bind to loopback-only host by default.
- Non-health `/api/v1` routes require a per-run local capability token.
- The token is transport/session authority only; it is not a Codex credential, ChatGPT session, API key, or durable user secret.
- CORS uses an explicit origin allowlist for local web dev/build origins and any temporary legacy host origin.
- A hosted web origin is not implicitly trusted and cannot obtain local execution authority without a separate explicit local pairing contract.
- CSRF/replay defense is required for approval and execution routes: approved action requests carry an idempotency key, preview hash, authority record id, and expiry check.
- Browser actions default to preview/local-dev targets; external-production browser mutation remains blocked unless a later contract creates a narrower approval class.

## ExecutionAuthorityRecord

No Phase 3 execution claim is valid without an `ExecutionAuthorityRecord` stored before the action runs.

```ts
type ExecutionAuthorityRecord = {
  recordId: string;
  sourcePlanningHandoffRef: string;
  actionClass: 'file_diff' | 'shell_command' | 'browser_action' | 'external_mutation_preview_only';
  previewArtifactRef: string;
  requestedScope: {
    workspaceRef?: string;
    commandAllowlistRef?: string;
    browserTargetRef?: string;
    filePathGlobs?: string[];
    maxDurationMs?: number;
  };
  approvalDecision: 'approved' | 'rejected' | 'revoked' | 'expired';
  approver: {
    actorId: string;
    actorType: 'user' | 'local_operator';
    approvedAt?: string;
  };
  sandboxBoundary: {
    mode: 'workspace_patch' | 'command_sandbox' | 'browser_preview_session';
    networkPolicy: 'loopback_only' | 'approved_public_read' | 'blocked';
    secretPolicy: 'no_secret_values' | 'explicit_secret_ref_only';
  };
  rollbackReference: {
    kind: 'git_diff_reverse' | 'filesystem_snapshot' | 'command_compensating_action' | 'browser_state_reset' | 'not_applicable_preview_only';
    ref: string;
  };
  executionResult: 'not_run' | 'blocked' | 'completed' | 'failed' | 'partial';
  evidenceRefs: string[];
  auditRefs: string[];
  createdAt: string;
};
```

Rules:

- `approvalDecision` must be `approved` at execution start and can later become `revoked` only for future/retry attempts.
- `previewArtifactRef` must resolve to the exact user-reviewed diff/command/browser action plan.
- `rollbackReference` is mandatory before execution unless `actionClass` is `external_mutation_preview_only` and the result stays `not_run`.
- `executionResult` starts as `not_run`, then becomes `blocked`, `completed`, `failed`, or `partial` with evidence.
- `evidenceRefs` must include stdout/stderr summaries, diff stats, browser screenshots/log refs, or block reasons appropriate to the action class.
- `auditRefs` must connect to ProductEngine events and user-visible activity.

## Controlled action flow

```text
PlanningHandoffArtifact
  -> BoundedAgentOutputRecord
  -> preview artifact
  -> ExecutionAuthorityRecord(not_run, approved/rejected)
  -> sandboxed execution if approved
  -> evidence capture
  -> rollbackReference validation
  -> audit/activity projection
```

Phase 3 adapters must fail closed:

- missing planning source -> blocked.
- missing preview artifact -> blocked.
- preview hash mismatch -> blocked.
- missing approval -> blocked.
- expired approval -> blocked.
- missing rollback reference -> blocked.
- sandbox cannot be enforced -> blocked.
- credential value required -> blocked.

## BoundedAgentOutputRecord

Agent output is not executable until it is bounded by source/evidence/approval metadata.

```ts
type BoundedAgentOutputRecord = {
  outputId: string;
  sourceRefs: string[];
  intendedDecisionImpact: string;
  proposedActionPreviewRefs: string[];
  requiredApprovals: string[];
  evidenceRefs: string[];
  failureMode: 'insufficient_source' | 'insufficient_evidence' | 'approval_required' | 'policy_blocked' | 'ready_for_preview';
  noExecutionPolicy: 'suggestion_only' | 'preview_only' | 'controlled_execution_required';
};
```

Outputs lacking source/evidence/approval linkage are rejected as untrusted suggestion, not executable plan.

## Phase 4~6 handoff gates

| Next phase | Gate after Phase 3 |
| --- | --- |
| Phase 4 Optional Cloud/Mobile Monitor | local approval/audit/rollback evidence is stable, and remote monitor is opt-in/read-only by default |
| Phase 5 Team Collaboration | approval authority, decision owner, audit trail, and revocation semantics are stable for one local user first |
| Phase 6 Advanced Multi-agent Strategy Engine | `BoundedAgentOutputRecord` ties every agent output to source, evidence, approval, and no-execution policy |

## Acceptance checklist

- [ ] Phase 3 implementation starts from `Local Web Frontend -> Local Node/Hono Service -> ProductEngine/contracts/db`.
- [ ] Tauri/native shell is not described as future default.
- [ ] `ExecutionAuthorityRecord` exists before every controlled execution attempt.
- [ ] `approvalDecision`, `sandboxBoundary`, `rollbackReference`, `executionResult`, `evidenceRefs`, and `auditRefs` are persisted.
- [ ] per-run local capability token, loopback-only service binding, explicit CORS allowlist, and CSRF/replay/idempotency checks are documented and tested.
- [ ] hosted web origin does not receive implicit local execution authority.
- [ ] `BoundedAgentOutputRecord` rejects untrusted agent suggestions without source/evidence/approval linkage.
- [ ] Phase 4~6 remain gated by Phase 3 evidence, not enabled by default.
