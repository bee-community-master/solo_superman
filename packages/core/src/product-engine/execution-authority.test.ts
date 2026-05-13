import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE,
  type CommandId,
  type CorrelationId,
  type EventId,
  type ProductEngineCommand,
  type ProductEngineEvent,
  type ProjectId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand, replayProductEngineEvents } from "./index";

const projectId = "proj_phase3_authority_core" as ProjectId;
const sessionId = "sess_phase3_authority_core" as SessionId;

function command(
  payload: Readonly<Record<string, unknown>>,
  expectedStateVersion: StateVersion = 0 as StateVersion
): ProductEngineCommand {
  return {
    commandId: `cmd_phase3_authority_${expectedStateVersion}` as CommandId,
    commandType: "CreateExecutionAuthority",
    projectId,
    sessionId,
    actor: "product_engine",
    issuedAt: "2026-05-12T00:00:00.000Z",
    idempotencyKey: `CreateExecutionAuthority:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId: "corr_phase3_authority" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function readyPayload(overrides: Readonly<Record<string, unknown>> = {}): ProductEngineCommand["payload"] {
  const projection = PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE;
  const record = projection.latestRecord;
  const base: Record<string, unknown> = {
    sourcePlanningHandoffRef: record.sourcePlanningHandoffRef,
    boundedAgentOutput: projection.boundedOutputs[0],
    actionClass: record.actionClass,
    previewArtifactRef: record.previewArtifactRef ?? undefined,
    previewArtifactHash: record.previewArtifactHash ?? undefined,
    reviewedPreviewArtifactHash: record.reviewedPreviewArtifactHash ?? undefined,
    requestedScope: record.requestedScope,
    approvalDecision: record.approvalDecision,
    approver: record.approver ?? undefined,
    sandboxBoundary: record.sandboxBoundary,
    rollbackReference: record.rollbackReference ?? undefined,
    evidenceRefs: record.evidenceRefs,
    auditRefs: record.auditRefs,
    preconditionChecks: {
      planningSourceExists: true,
      previewArtifactExists: true,
      previewHashMatches: true,
      rollbackAvailable: true,
      credentialValueRequired: false,
      sandboxEnforced: true
    },
    ...overrides
  };

  return base;
}

describe("CreateExecutionAuthority reducer", () => {
  it("records approved authority without executing adapters or side effects", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const reduction = reduceProductEngineCommand(command(readyPayload()), state);

    expect(reduction.accepted).toBe(true);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.events).toEqual([
      expect.objectContaining({
        eventType: "ExecutionAuthorityRecorded",
        payload: expect.objectContaining({
          actionClass: "file_diff",
          approvalDecision: "approved",
          executionResult: "not_run",
          blockReasons: []
        })
      })
    ]);
    expect(reduction.deterministicOutputs).toEqual([
      expect.objectContaining({
        outputType: "execution_authority_record",
        payload: expect.objectContaining({
          actionClass: "file_diff",
          executionResult: "not_run"
        })
      })
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "ExecutionAuthorityLedgerProjection",
      currentStatus: "ready_for_execution",
      latestRecord: {
        executionResult: "not_run",
        approvalDecision: "approved"
      }
    });
  });

  it("preserves service page-use browser authority scope for revoke/bypass enforcement", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          actionClass: "browser_action",
          requestedScope: {
            browserTargetRef: "browser_target:http://127.0.0.1:4321/mock-vercel/setup",
            servicePagePermissionId: "service_page_permission_vercel_ready",
            servicePageActionClass: "read",
            serviceOrigin: "https://vercel.com",
            servicePageUrl: "https://vercel.com/new",
            maxDurationMs: 1_000
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "loopback_only",
            secretPolicy: "no_secret_values"
          },
          rollbackReference: {
            kind: "browser_state_reset",
            ref: "rollback_service_page_browser"
          }
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "ready_for_execution",
      latestRecord: {
        actionClass: "browser_action",
        requestedScope: {
          servicePagePermissionId: "service_page_permission_vercel_ready",
          servicePageActionClass: "read",
          serviceOrigin: "https://vercel.com",
          servicePageUrl: "https://vercel.com/new"
        }
      }
    });
  });

  it("converges missing source, preview, rollback, credential, and sandbox preconditions to blocked", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const reduction = reduceProductEngineCommand(
      command({
        ...readyPayload(),
        sourcePlanningHandoffRef: undefined,
        previewArtifactRef: undefined,
        previewArtifactHash: undefined,
        reviewedPreviewArtifactHash: undefined,
        rollbackReference: undefined,
        approvalDecision: "pending",
        approver: undefined,
        preconditionChecks: {
          planningSourceExists: false,
          previewArtifactExists: false,
          previewHashMatches: false,
          rollbackAvailable: false,
          credentialValueRequired: true,
          sandboxEnforced: false
        }
      }),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "ExecutionAuthorityBlocked" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestRecord: {
        executionResult: "blocked",
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "missing_source" }),
          expect.objectContaining({ code: "missing_preview" }),
          expect.objectContaining({ code: "missing_approval" }),
          expect.objectContaining({ code: "missing_rollback" }),
          expect.objectContaining({ code: "credential_value_required" }),
          expect.objectContaining({ code: "sandbox_failure" })
        ])
      }
    });
  });

  it.each([
    ["pending", "missing_approval"],
    ["rejected", "rejected_approval"],
    ["revoked", "revoked_approval"],
    ["expired", "expired_approval"]
  ] as const)("records %s approval lifecycle state as blocked evidence", (approvalDecision, blockCode) => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          approvalDecision,
          approver: undefined
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "ExecutionAuthorityBlocked" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestRecord: {
        approvalDecision,
        executionResult: "blocked",
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: blockCode })])
      }
    });
  });

  it("blocks preview hash mismatches instead of relying on adapter behavior", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          reviewedPreviewArtifactHash: "sha256:different-preview",
          preconditionChecks: {
            planningSourceExists: true,
            previewArtifactExists: true,
            previewHashMatches: false,
            rollbackAvailable: true,
            credentialValueRequired: false,
            sandboxEnforced: true
          }
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestRecord: {
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "preview_hash_mismatch" })])
      }
    });
  });

  it("fails closed when sandbox enforcement is not explicitly confirmed", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          preconditionChecks: {
            planningSourceExists: true,
            previewArtifactExists: true,
            previewHashMatches: true,
            rollbackAvailable: true,
            credentialValueRequired: false
          }
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestRecord: {
        executionResult: "blocked",
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "sandbox_failure" })])
      }
    });
  });

  it("records preview-only external mutation authority as not-run without requiring rollback execution authority", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          actionClass: "external_mutation_preview_only",
          rollbackReference: undefined,
          requestedScope: {
            browserTargetRef: "external_preview_policy_ref"
          },
          sandboxBoundary: {
            mode: "browser_preview_session",
            networkPolicy: "blocked",
            secretPolicy: "no_secret_values"
          }
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "preview_only",
      latestRecord: {
        actionClass: "external_mutation_preview_only",
        executionResult: "not_run",
        rollbackReference: null
      }
    });
  });

  it("rejects approved authority when the requested scope has no explicit boundary", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          requestedScope: {}
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("requestedScope must include at least one")
      }
    });
  });

  it("rejects invalid bounded outputs without throwing from projection validation", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    let reduction: ReturnType<typeof reduceProductEngineCommand> | undefined;

    expect(() => {
      reduction = reduceProductEngineCommand(
        command(
          readyPayload({
            boundedAgentOutput: {
              ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.boundedOutputs[0],
              outputId: "invalid_bounded_output_prefix"
            }
          })
        ),
        state
      );
    }).not.toThrow();

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("bounded output id must use the bounded_output_ prefix")
      }
    });
  });

  it("rejects raw credential value keys before normalizing the authority payload", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          requestedScope: {
            ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord.requestedScope,
            secretValue: "do-not-store-this"
          }
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "CreateExecutionAuthority payload must not contain credential or secret values."
      }
    });
  });

  it("rejects common nested credential keys before payload normalization drops unknown fields", () => {
    const reduction = reduceProductEngineCommand(
      command(
        readyPayload({
          requestedScope: {
            ...PHASE3_EXECUTION_AUTHORITY_READY_PROJECTION_FIXTURE.latestRecord.requestedScope,
            apiKey: "sk-test-secret-value-000000"
          }
        })
      ),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "CreateExecutionAuthority payload must not contain credential or secret values."
      }
    });
  });

  it("replays authority events into ProductEngine state", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const reduction = reduceProductEngineCommand(command(readyPayload()), state);
    const event = {
      ...reduction.events[0]!,
      eventId: "evt_phase3_authority_replay" as EventId,
      sequence: 1,
      occurredAt: "2026-05-12T00:00:00.000Z"
    } satisfies ProductEngineEvent;
    const replayed = replayProductEngineEvents(projectId, sessionId, [event]);

    expect(replayed.executionAuthorityLedger).toMatchObject({
      currentStatus: "ready_for_execution",
      latestRecord: {
        executionResult: "not_run"
      }
    });
  });
});
