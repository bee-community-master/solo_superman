import { describe, expect, it } from "vitest";
import {
  CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
  CONTRACT_SCHEMA_VERSION,
  EXECUTION_AUTHORITY_SCHEMA_VERSION,
  type ChatGptBrowserDelegationProjection,
  type ChatGptBrowserDelegationResultImportGate,
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

function revokeCommand(
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 1 as StateVersion
): ProductEngineCommand {
  return {
    ...command(payload, expectedStateVersion),
    commandId: `cmd_chatgpt_delegation_revoke_${expectedStateVersion}` as CommandId,
    commandType: "RevokeChatGptBrowserDelegationRun",
    idempotencyKey: `RevokeChatGptBrowserDelegationRun:${expectedStateVersion}`
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

function passingResultImportGate(
  overrides: Partial<ChatGptBrowserDelegationResultImportGate> = {}
): ChatGptBrowserDelegationResultImportGate {
  return {
    sourceProvenanceStatus: "pass",
    uncertaintyStatus: "pass",
    conEvidenceStatus: "pass",
    staleRiskStatus: "pass",
    sourceRefs: ["chatgpt:conversation:hash"],
    uncertaintyRefs: ["uncertainty:preserved"],
    conEvidenceRefs: ["con:evidence:preserved"],
    staleRiskRefs: ["stale-risk:checked"],
    importRationale: "Candidate output preserves source, uncertainty, counter-evidence, and stale-risk gates.",
    ...overrides
  };
}

function failedResultImportGate(): ChatGptBrowserDelegationResultImportGate {
  return passingResultImportGate({
    sourceProvenanceStatus: "pass",
    uncertaintyStatus: "block",
    conEvidenceStatus: "block",
    staleRiskStatus: "pass",
    sourceRefs: ["chatgpt:conversation:hash-only"],
    uncertaintyRefs: ["uncertainty:missing"],
    conEvidenceRefs: ["con:evidence:missing"],
    staleRiskRefs: ["stale-risk:checked"],
    importRationale: "Candidate output did not preserve uncertainty or counter-evidence."
  });
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
          status: "running",
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
          status: "running"
        })
      })
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "ChatGptBrowserDelegationProjection",
      currentStatus: "running",
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
      currentStatus: "blocked",
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

  it("maps named ChatGPT policy risk patterns to durable block codes", () => {
    const fallbackRun = CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE.latestRun;
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          policyRiskVerdict: {
            verdict: "block",
            rationale: "Structured policy evidence requires fallback.",
            evidenceRefs: ["policy:third-party-backend", "policy:project-level-queue"]
          },
          browserActionAuthorityRef: undefined,
          fallbackApplied: fallbackRun.fallbackApplied
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked",
      latestRun: {
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "account_sharing_or_resale_risk" }),
          expect.objectContaining({ code: "unattended_queue_risk" })
        ])
      }
    });
  });

  it("keeps missing approval waiting instead of starting a browser action", () => {
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
      currentStatus: "waiting_for_approval",
      latestRun: {
        canRevoke: true,
        fallbackApplied: null,
        blockReasons: []
      }
    });
  });

  it("keeps explicit preflight records revokable before approval starts", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          status: "pending_preflight",
          approvalDecision: "pending",
          browserActionAuthorityRef: undefined,
          fallbackApplied: undefined
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "pending_preflight",
      latestRun: {
        canRevoke: true,
        fallbackApplied: null,
        blockReasons: [],
        nextAction: expect.stringContaining("Finish data disclosure")
      }
    });
  });

  it("keeps waiting-for-user next action distinct from fallback copy", () => {
    const waiting = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          status: "waiting_for_user"
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(waiting.accepted).toBe(true);
    expect(waiting.immediateProjection).toMatchObject({
      currentStatus: "waiting_for_user",
      latestRun: {
        nextAction: expect.stringContaining("Complete the visible browser intervention"),
        fallbackApplied: null
      }
    });
  });

  it("keeps importing-result next action distinct from fallback copy", () => {
    const importing = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          status: "importing_result",
          resultImportRef: "research_result_chatgpt_importing_action",
          resultImportGate: passingResultImportGate({
            importRationale: "Candidate output is captured while import remains revokable."
          })
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(importing.accepted).toBe(true);
    expect(importing.immediateProjection).toMatchObject({
      currentStatus: "importing_result",
      latestRun: {
        nextAction: expect.stringContaining("Review the captured ChatGPT result"),
        fallbackApplied: null
      }
    });
  });

  it("rejects explicit run states that conflict with approval and authority facts", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          status: "running",
          approvalDecision: "pending",
          browserActionAuthorityRef: undefined,
          fallbackApplied: undefined
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        message: expect.stringContaining("conflicts with derived run state waiting_for_approval")
      }
    });
  });

  it("rejects unsupported ProductEngine payload keys before lifecycle reduction", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          sessionCookie: "blocked-by-contract"
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "CreateChatGptBrowserDelegationRun payload contains unsupported keys."
      }
    });
  });

  it("fails result import attempts that do not have per-run approval or browser authority", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          approvalDecision: "pending",
          browserActionAuthorityRef: undefined,
          resultImportRef: "research_result_chatgpt_unapproved",
          resultImportGate: passingResultImportGate({
            importRationale: "Candidate output claims to preserve quality gates before approval."
          })
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "failed",
      latestRun: {
        blockReasons: expect.arrayContaining([
          expect.objectContaining({ code: "missing_user_approval" }),
          expect.objectContaining({ code: "missing_browser_action_authority" })
        ])
      }
    });
  });

  it("revokes importing-result runs while preserving captured result refs for audit recovery", () => {
    const created = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          status: "importing_result",
          resultImportRef: "research_result_chatgpt_importing",
          resultImportGate: passingResultImportGate({
            importRationale: "Candidate output is captured while import remains revokable."
          })
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );
    const projection = created.immediateProjection as ChatGptBrowserDelegationProjection;

    expect(created.accepted).toBe(true);
    expect(projection.currentStatus).toBe("importing_result");

    const revoked = reduceProductEngineCommand(
      revokeCommand({
        runId: projection.latestRun.runId,
        reason: "User stopped ChatGPT result import before committing the captured output.",
        auditRefs: ["audit:chatgpt-browser-delegation:importing-revoke"]
      }),
      {
        ...stateWithResearchTaskAndBrowserAuthority(),
        stateVersion: 1 as StateVersion,
        chatGptBrowserDelegation: projection
      }
    );

    expect(revoked.accepted).toBe(true);
    expect(revoked.immediateProjection).toMatchObject({
      currentStatus: "revoked",
      latestRun: {
        resultImportRef: "research_result_chatgpt_importing",
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "revoked_by_user" })])
      }
    });
  });

  it("revokes the latest running delegation run with audit evidence", () => {
    const created = reduceProductEngineCommand(
      command(payloadFromReadyFixture()),
      stateWithResearchTaskAndBrowserAuthority()
    );
    const projection = created.immediateProjection as ChatGptBrowserDelegationProjection;
    const revoked = reduceProductEngineCommand(
      revokeCommand({
        runId: projection.latestRun.runId,
        reason: "User stopped the visible ChatGPT browser delegation run.",
        auditRefs: ["audit:chatgpt-browser-delegation:test-revoke"]
      }),
      {
        ...stateWithResearchTaskAndBrowserAuthority(),
        stateVersion: 1 as StateVersion,
        chatGptBrowserDelegation: projection
      }
    );

    expect(revoked.accepted).toBe(true);
    expect(revoked.events[0]).toMatchObject({ eventType: "ChatGptBrowserDelegationRunRevoked" });
    expect(revoked.immediateProjection).toMatchObject({
      currentStatus: "revoked",
      latestRun: {
        runId: projection.latestRun.runId,
        canRevoke: false,
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "revoked_by_user" })]),
        auditLog: expect.arrayContaining([expect.objectContaining({ eventType: "DelegationRunRevoked" })])
      }
    });
  });

  it("rejects duplicate revoke after a run is already revoked", () => {
    const created = reduceProductEngineCommand(
      command(payloadFromReadyFixture()),
      stateWithResearchTaskAndBrowserAuthority()
    );
    const projection = created.immediateProjection as ChatGptBrowserDelegationProjection;
    const revoked = reduceProductEngineCommand(
      revokeCommand({
        runId: projection.latestRun.runId,
        reason: "User stopped the visible ChatGPT browser delegation run.",
        auditRefs: ["audit:chatgpt-browser-delegation:test-revoke"]
      }),
      {
        ...stateWithResearchTaskAndBrowserAuthority(),
        stateVersion: 1 as StateVersion,
        chatGptBrowserDelegation: projection
      }
    );

    const duplicateRevoke = reduceProductEngineCommand(
      revokeCommand({
        runId: projection.latestRun.runId,
        reason: "Duplicate revoke should not append another revoke audit event.",
        auditRefs: ["audit:chatgpt-browser-delegation:duplicate-revoke"]
      }, 2 as StateVersion),
      {
        ...stateWithResearchTaskAndBrowserAuthority(),
        stateVersion: 2 as StateVersion,
        chatGptBrowserDelegation: revoked.immediateProjection as ChatGptBrowserDelegationProjection
      }
    );

    expect(duplicateRevoke).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        message: "RevokeChatGptBrowserDelegationRun can only revoke pending, waiting, running, or importing runs."
      }
    });
  });

  it("blocks result imports without provenance, uncertainty, con-evidence, and stale-risk gates", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          resultImportRef: "research_result_chatgpt_gate_fail",
          resultImportGate: failedResultImportGate()
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "ChatGptBrowserDelegationRunFailed" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "failed",
      latestRun: {
        resultImportRef: "research_result_chatgpt_gate_fail",
        auditRefs: expect.arrayContaining(["event:ChatGptBrowserDelegationRunFailed"]),
        blockReasons: expect.arrayContaining([expect.objectContaining({ code: "result_import_gate_failed" })]),
        auditLog: expect.arrayContaining([expect.objectContaining({ eventType: "DelegationRunFailed" })])
      }
    });
  });

  it("marks ChatGPT result imports ready only after all quality gates pass", () => {
    const reduction = reduceProductEngineCommand(
      command(
        payloadFromReadyFixture({
          resultImportRef: "research_result_chatgpt_gate_pass",
          resultImportGate: passingResultImportGate()
        })
      ),
      stateWithResearchTaskAndBrowserAuthority()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "completed",
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
        currentStatus: "blocked",
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
        currentStatus: "blocked",
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
        currentStatus: "blocked",
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
      currentStatus: "running"
    });
  });
});
