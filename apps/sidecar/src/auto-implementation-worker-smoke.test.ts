import { describe, expect, it } from "vitest";
import {
  CODEX_APP_SERVER_GENERATED_VERSION,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  type CodexRuntimeStatusDto
} from "@solo-superman/contracts";
import {
  LIVE_TURNS_ENV,
  LIVE_WORKER_JOB_VERIFY_ENV,
  autoImplementationWorkerGateEvidence,
  runAutoImplementationWorkerSmoke
} from "./auto-implementation-worker-smoke";
import {
  CodexRuntimeUnavailableError,
  createCodexRuntimeAdapter,
  fixtureCodexWorkerExecutionOutput
} from "./runtime";

function runtimeStatus(overrides: Partial<CodexRuntimeStatusDto> = {}): CodexRuntimeStatusDto {
  return {
    status: "available",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    generatedSchemaVersion: CODEX_APP_SERVER_GENERATED_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: "2026-05-23T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: true,
    executionMode: "live",
    account: {
      status: "authenticated",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      accountType: "chatgpt",
      email: "fixture-codex@example.local"
    },
    reason: "Test fixture reports runtime readiness.",
    ...overrides
  };
}

describe("auto implementation worker job smoke", () => {
  it("runs a credential-free fixture worker job through ledger import and stage advance by default", async () => {
    const evidence = await runAutoImplementationWorkerSmoke({ env: {} });

    expect(evidence).toMatchObject({
      status: "passed",
      smoke: "auto_implementation_worker_job",
      mode: "fixture",
      runtime: {
        status: "available",
        executionMode: "fixture",
        liveTurnExecutionEnabled: false,
        accountStatus: "authenticated"
      },
      worker: {
        jobStatus: "completed",
        stageBefore: "initial_pr",
        stageAfter: "code_review_fix_1",
        ledgerStatus: "completed",
        projectFolderName: "worker-job-smoke-demo",
        issueRelativePath: "implementation-issues/001-initial_pr.md"
      }
    });
    expect(evidence.worker?.implementationStepId).toContain(":initial_pr:local-001");
    expect(evidence.checked).toContain("worker stage advanced through the stage-advance route");
  });

  it("blocks live worker-job verification before side effects when live turns are not enabled", async () => {
    const evidence = await runAutoImplementationWorkerSmoke({
      env: {
        [LIVE_WORKER_JOB_VERIFY_ENV]: "1"
      }
    });

    expect(evidence).toMatchObject({
      status: "blocked",
      mode: "live",
      blockers: [`${LIVE_TURNS_ENV}=1 is required before live worker-job execution can be verified`]
    });
    expect(evidence.worker).toBeUndefined();
  });

  it("documents fixture, blocked-live, and ready-live gate states", () => {
    expect(autoImplementationWorkerGateEvidence({})).toMatchObject({
      status: "ready",
      mode: "fixture"
    });
    expect(autoImplementationWorkerGateEvidence({ [LIVE_WORKER_JOB_VERIFY_ENV]: "1" })).toMatchObject({
      status: "blocked",
      mode: "live"
    });
    expect(
      autoImplementationWorkerGateEvidence({
        [LIVE_WORKER_JOB_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      })
    ).toMatchObject({
      status: "ready",
      mode: "live"
    });
  });

  it("passes live mode only when the worker bridge returns completed ledger evidence", async () => {
    const liveWorkerAdapter = {
      ...createCodexRuntimeAdapter({ fixtureMode: true, env: {} }),
      async getStatus() {
        return runtimeStatus();
      },
      async executeWorker(input: Parameters<ReturnType<typeof createCodexRuntimeAdapter>["executeWorker"]>[0]) {
        return fixtureCodexWorkerExecutionOutput(input);
      }
    };

    const evidence = await runAutoImplementationWorkerSmoke({
      env: {
        [LIVE_WORKER_JOB_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      },
      runtimeAdapter: liveWorkerAdapter
    });

    expect(evidence).toMatchObject({
      status: "passed",
      mode: "live",
      runtime: {
        status: "available",
        executionMode: "live",
        liveTurnExecutionEnabled: true,
        accountStatus: "authenticated"
      },
      worker: {
        jobStatus: "completed",
        ledgerStatus: "completed",
        stageBefore: "initial_pr",
        stageAfter: "code_review_fix_1"
      }
    });
  });

  it("reports blocked when a ready live runtime fails before importable ledger evidence", async () => {
    const blockedWorkerAdapter = {
      ...createCodexRuntimeAdapter({ fixtureMode: true, env: {} }),
      async getStatus() {
        return runtimeStatus();
      },
      async executeWorker() {
        throw new CodexRuntimeUnavailableError("Injected live worker failure.");
      }
    };

    const evidence = await runAutoImplementationWorkerSmoke({
      env: {
        [LIVE_WORKER_JOB_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      },
      runtimeAdapter: blockedWorkerAdapter
    });

    expect(evidence).toMatchObject({
      status: "blocked",
      mode: "live",
      worker: {
        jobStatus: "blocked",
        stageBefore: "initial_pr",
        stageAfter: "initial_pr"
      }
    });
    expect(evidence.blockers).toEqual(
      expect.arrayContaining([
        "worker job must be completed; received \"blocked\"",
        "worker stage was not advanced because completed worker evidence was unavailable"
      ])
    );
  });

  it("blocks before creating worker state when live runtime status is unavailable", async () => {
    const unavailableAdapter = {
      ...createCodexRuntimeAdapter({ fixtureMode: true, env: {} }),
      async getStatus() {
        return runtimeStatus({
          status: "unavailable",
          executionMode: "manual_handoff",
          liveTurnExecutionEnabled: false,
          account: {
            status: "missing",
            loginCommand: "codex auth login",
            loginStatusCommand: "codex login status"
          }
        });
      }
    };

    const evidence = await runAutoImplementationWorkerSmoke({
      env: {
        [LIVE_WORKER_JOB_VERIFY_ENV]: "1",
        [LIVE_TURNS_ENV]: "1"
      },
      runtimeAdapter: unavailableAdapter
    });

    expect(evidence).toMatchObject({
      status: "blocked",
      mode: "live",
      runtime: {
        status: "unavailable",
        executionMode: "manual_handoff",
        liveTurnExecutionEnabled: false,
        accountStatus: "missing"
      }
    });
    expect(evidence.worker).toBeUndefined();
  });
});
