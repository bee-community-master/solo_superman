import { describe, expect, it } from "vitest";
import {
  CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
  CONTRACT_SCHEMA_VERSION,
  EXECUTION_AUTHORITY_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type EventId,
  type ExecutionAuthorityLedgerProjection,
  type ProductEngineCommand,
  type ProductEngineEvent,
  type ProductEngineStateSnapshot,
  type ProjectionVersion,
  type ProjectId,
  type ResearchTaskId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand, replayProductEngineEvents } from "./index";

const projectId = "proj_chatgpt_delegation_core" as ProjectId;
const sessionId = "sess_chatgpt_delegation_core" as SessionId;
const researchTaskId = "research_task_chatgpt_ready" as ResearchTaskId;

function command(
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 0 as StateVersion
): ProductEngineCommand {
  return {
    commandId: `cmd_chatgpt_delegation_${expectedStateVersion}` as CommandId,
    commandType: "CreateChatGptBrowserDelegationRun",
    projectId,
    sessionId,
    actor: "product_engine",
    issuedAt: "2026-05-13T00:00:00.000Z",
    idempotencyKey: `CreateChatGptBrowserDelegationRun:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId: "corr_chatgpt_delegation" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function stateWithResearchTask(): ProductEngineStateSnapshot {
  const state = createInitialProductEngineState(projectId, sessionId);

  return {
    ...state,
    researchState: {
      ...state.researchState,
      taskIds: [researchTaskId],
      tasks: [
        {
          researchTaskId,
          sessionId,
          objective: "Compare alternatives for a high-impact founder research question.",
          routeOutcome: "research_needed",
          impact: "high",
          status: "planned",
          createdAt: "2026-05-13T00:00:00.000Z"
        }
      ]
    }
  };
}

function browserActionAuthorityProjection(
  recordId = "exec_auth_chatgpt_ready"
): ExecutionAuthorityLedgerProjection {
  const record = {
    recordId,
    sourcePlanningHandoffRef: "planning_handoff_chatgpt_browser",
    boundedAgentOutputId: "bounded_output_chatgpt_browser",
    actionClass: "browser_action",
    previewArtifactRef: "preview_chatgpt_browser",
    previewArtifactHash: "sha256:chatgpt-browser-preview",
    reviewedPreviewArtifactHash: "sha256:chatgpt-browser-preview",
    requestedScope: {
      browserTargetRef: "browser_target:http://127.0.0.1:4173",
      maxDurationMs: 1_000
    },
    approvalDecision: "approved",
    approver: {
      actorId: "user_chatgpt_browser_owner",
      actorType: "user",
      approvedAt: "2026-05-13T00:00:00.000Z",
      decidedAt: "2026-05-13T00:00:00.000Z"
    },
    sandboxBoundary: {
      mode: "browser_preview_session",
      networkPolicy: "loopback_only",
      secretPolicy: "no_secret_values"
    },
    rollbackReference: {
      kind: "browser_state_reset",
      ref: "rollback_chatgpt_browser"
    },
    executionResult: "not_run",
    blockReasons: [],
    evidenceRefs: ["evidence_chatgpt_browser_preview"],
    auditRefs: ["audit_chatgpt_browser_authority"],
    createdAt: "2026-05-13T00:00:00.000Z",
    schemaVersion: EXECUTION_AUTHORITY_SCHEMA_VERSION
  } as const;

  return {
    kind: "ExecutionAuthorityLedgerProjection",
    sessionId,
    version: 1 as ProjectionVersion,
    currentStatus: "ready_for_execution",
    records: [record],
    boundedOutputs: [
      {
        outputId: record.boundedAgentOutputId,
        sourceRefs: [record.sourcePlanningHandoffRef],
        intendedDecisionImpact: "Approve one visible local ChatGPT browser research run.",
        proposedActionPreviewRefs: [record.previewArtifactRef],
        requiredApprovals: ["approval_chatgpt_browser"],
        evidenceRefs: record.evidenceRefs,
        failureMode: "ready_for_preview",
        noExecutionPolicy: "controlled_execution_required"
      }
    ],
    latestRecord: record,
    blockedPreconditions: [],
    summary: "Execution authority passed approval, preview, sandbox, and rollback checks and is ready.",
    refetchUrl: `/api/v1/sessions/${sessionId}/execution-authority`
  };
}

function stateWithResearchTaskAndBrowserAuthority(recordId = "exec_auth_chatgpt_ready"): ProductEngineStateSnapshot {
  return {
    ...stateWithResearchTask(),
    executionAuthorityLedger: browserActionAuthorityProjection(recordId)
  };
}

function payloadFromReadyFixture(overrides: Readonly<Record<string, unknown>> = {}) {
  const run = CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.latestRun;

  return {
    researchTaskId: run.researchTaskId,
    promptPreviewRef: run.promptPreviewRef,
    dataDisclosurePreview: run.dataDisclosurePreview,
    redactionSummary: run.redactionSummary,
    policyRiskVerdict: run.policyRiskVerdict,
    sessionOwnershipVerdict: run.sessionOwnershipVerdict,
    approvalDecision: run.approvalDecision,
    browserActionAuthorityRef: run.browserActionAuthorityRef ?? undefined,
    resultImportRef: run.resultImportRef ?? undefined,
    resultImportGate: run.resultImportGate ?? undefined,
    fallbackApplied: run.fallbackApplied ?? undefined,
    screenshotRefs: run.screenshotRefs,
    logRefs: run.logRefs,
    auditRefs: run.auditRefs,
    ...overrides
  };
}

describe("CreateChatGptBrowserDelegationRun reducer", () => {
  it("records an approved per-run local browser delegation preflight without adapter side effects", () => {
    const reduction = reduceProductEngineCommand(command(payloadFromReadyFixture()), stateWithResearchTaskAndBrowserAuthority());

    expect(reduction.accepted).toBe(true);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.events).toEqual([
      expect.objectContaining({
        eventType: "ChatGptBrowserDelegationRunRecorded",
        payload: expect.objectContaining({
          status: "ready_for_browser_action",
          approvalDecision: "approved",
          browserActionAuthorityRef: "exec_auth_chatgpt_ready",
          blockReasons: []
        })
      })
    ]);
    expect(reduction.deterministicOutputs).toEqual([
      expect.objectContaining({
        outputType: "chatgpt_browser_delegation_run",
        payload: expect.objectContaining({
          researchTaskId,
          status: "ready_for_browser_action"
        })
      })
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "ChatGptBrowserDelegationProjection",
      currentStatus: "ready_for_browser_action",
      latestRun: {
        dataDisclosurePreview: {
          redactionPreviewShown: true,
          userCanEditPromptBeforeRun: true
        },
        redactionSummary: {
          userExportDeleteControls: true,
          deletionLeavesAuditMetadataOnly: true
        }
      }
    });
  });

  it("blocks policy/session/account-sharing risks with a visible fallback state", () => {
    const fallbackRun = CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE.latestRun;
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          policyRiskVerdict: fallbackRun.policyRiskVerdict,
          browserActionAuthorityRef: undefined,
          fallbackApplied: fallbackRun.fallbackApplied
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "ChatGptBrowserDelegationRunBlocked" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "fallback_required",
      latestRun: {
        fallbackApplied: {
          lane: "manual_prompt_handoff"
        },
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "policy_risk_blocked" }),
          expect.objectContaining({ code: "account_sharing_or_resale_risk" }),
          expect.objectContaining({ code: "unattended_queue_risk" }),
          expect.objectContaining({ code: "missing_browser_action_authority" })
        ])
      }
    });
  });

  it("auto-materializes fallback instead of silently retrying when approval is missing", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          approvalDecision: "pending",
          browserActionAuthorityRef: undefined,
          fallbackApplied: undefined
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "fallback_required",
      latestRun: {
        fallbackApplied: {
          lane: "manual_prompt_handoff",
          visibleState: expect.stringContaining("ChatGPT 브라우저 위임")
        },
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "missing_user_approval" }),
          expect.objectContaining({ code: "missing_browser_action_authority" })
        ])
      }
    });
  });

  it("blocks result imports without provenance, uncertainty, con-evidence, and stale-risk gates", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          resultImportRef: "research_result_chatgpt_gate_fail",
          resultImportGate: {
            sourceProvenanceStatus: "pass",
            uncertaintyStatus: "block",
            conEvidenceStatus: "block",
            staleRiskStatus: "pass",
            sourceRefs: ["chatgpt:conversation:hash-only"],
            uncertaintyRefs: ["uncertainty:missing"],
            conEvidenceRefs: ["con:evidence:missing"],
            staleRiskRefs: ["stale-risk:checked"],
            importRationale: "Candidate output did not preserve uncertainty or counter-evidence."
          }
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "fallback_required",
      latestRun: {
        resultImportRef: "research_result_chatgpt_gate_fail",
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "result_import_gate_failed" })])
      }
    });
  });

  it("marks ChatGPT result imports ready only after all quality gates pass", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          resultImportRef: "research_result_chatgpt_gate_pass",
          resultImportGate: {
            sourceProvenanceStatus: "pass",
            uncertaintyStatus: "pass",
            conEvidenceStatus: "pass",
            staleRiskStatus: "pass",
            sourceRefs: ["chatgpt:conversation:hash"],
            uncertaintyRefs: ["uncertainty:preserved"],
            conEvidenceRefs: ["con:evidence:preserved"],
            staleRiskRefs: ["stale-risk:checked"],
            importRationale: "Candidate output preserves source, uncertainty, counter-evidence, and stale-risk gates."
          }
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "result_import_ready",
      latestRun: {
        resultImportRef: "research_result_chatgpt_gate_pass",
        blockReasons: []
      }
    });
  });

  it("blocks fake or non-browser execution authority refs with a visible fallback", () => {
    const missingAuthority = reduceProductEngineCommand(
      command(payloadFromReadyFixture({ browserActionAuthorityRef: "exec_auth_missing" })),
      stateWithResearchTask()
    );
    const wrongActionProjection = browserActionAuthorityProjection();
    const wrongActionRecord = {
      ...wrongActionProjection.latestRecord,
      actionClass: "file_diff",
      sandboxBoundary: {
        mode: "workspace_patch",
        networkPolicy: "blocked",
        secretPolicy: "no_secret_values"
      },
      rollbackReference: {
        kind: "git_diff_reverse",
        ref: "rollback_wrong_action_class"
      },
      requestedScope: {
        workspaceRef: "workspace:solo-superman",
        filePathGlobs: ["packages/**"]
      }
    } as const;
    const wrongActionClass = reduceProductEngineCommand(
      command(payloadFromReadyFixture({ browserActionAuthorityRef: "exec_auth_chatgpt_ready" })),
      {
        ...stateWithResearchTaskAndBrowserAuthority(),
        executionAuthorityLedger: {
          ...wrongActionProjection,
          records: [wrongActionRecord],
          latestRecord: wrongActionRecord
        }
      }
    );
    const failedAuthorityProjection = browserActionAuthorityProjection();
    const failedAuthorityRecord = {
      ...failedAuthorityProjection.latestRecord,
      executionResult: "failed"
    } as const;
    const failedAuthority = reduceProductEngineCommand(
      command(payloadFromReadyFixture({ browserActionAuthorityRef: "exec_auth_chatgpt_ready" })),
      {
        ...stateWithResearchTaskAndBrowserAuthority(),
        executionAuthorityLedger: {
          ...failedAuthorityProjection,
          records: [failedAuthorityRecord],
          latestRecord: failedAuthorityRecord
        }
      }
    );

    expect(missingAuthority).toMatchObject({
      accepted: true,
      immediateProjection: {
        currentStatus: "fallback_required",
        latestRun: {
          blockReasons: expect.arrayContaining([
            expect.objectContaining({ code: "missing_browser_action_authority" })
          ]),
          fallbackApplied: expect.objectContaining({ lane: "manual_prompt_handoff" })
        }
      }
    });
    expect(wrongActionClass).toMatchObject({
      accepted: true,
      immediateProjection: {
        currentStatus: "fallback_required",
        latestRun: {
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "missing_browser_action_authority",
              evidenceRefs: expect.arrayContaining(["execution-authority:exec_auth_chatgpt_ready:action-class:file_diff"])
            })
          ])
        }
      }
    });
    expect(failedAuthority).toMatchObject({
      accepted: true,
      immediateProjection: {
        currentStatus: "fallback_required",
        latestRun: {
          blockReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "missing_browser_action_authority",
              evidenceRefs: expect.arrayContaining(["execution-authority:exec_auth_chatgpt_ready:status:closed"])
            })
          ])
        }
      }
    });
  });

  it("rejects missing ResearchTask traceability and credential-shaped payload values", () => {
    const missingTask = reduceProductEngineCommand(
      command(payloadFromReadyFixture({ researchTaskId: "research_task_missing" })),
      stateWithResearchTask()
    );
    const secretPayload = reduceProductEngineCommand(
      command(payloadFromReadyFixture({ logRefs: ["chatgpt:api_key=sk-test-not-allowed"] })),
      stateWithResearchTask()
    );

    expect(missingTask).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "RESOURCE_NOT_FOUND",
        message: "CreateChatGptBrowserDelegationRun requires an existing ResearchTask."
      }
    });
    expect(secretPayload).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("must not contain credential")
      }
    });
  });

  it("replays delegation events back into state", () => {
    const reduction = reduceProductEngineCommand(command(payloadFromReadyFixture()), stateWithResearchTaskAndBrowserAuthority());
    const draft = reduction.events[0];

    if (!draft) {
      throw new Error("ChatGPT delegation reduction should emit one event");
    }

    const event: ProductEngineEvent = {
      ...draft,
      eventId: "evt_chatgpt_delegation_created" as EventId,
      sequence: 1,
      occurredAt: "2026-05-13T00:00:00.000Z"
    };

    const replayed = replayProductEngineEvents(projectId, sessionId, [event]);

    expect(replayed.chatGptBrowserDelegation).toMatchObject({
      kind: "ChatGptBrowserDelegationProjection",
      currentStatus: "ready_for_browser_action"
    });
  });
});
