import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type DecisionId,
  type DecisionEvidencePackId,
  type EvidenceItemId,
  type ProjectionVersion,
  type ProductEngineCommand,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type QueueItemId,
  type ResearchResultId,
  type ResearchTaskId,
  type RuntimeArtifactId,
  type SessionId,
  type StateVersion,
  type Phase15bUpgradeHints,
  type PlanningHandoffProjection,
  type PlanningHandoffSourceRefDto
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand } from "./index";

const PROJECT_ID = "proj_planning_handoff" as ProjectId;
const SESSION_ID = "sess_planning_handoff" as SessionId;
const READY_STATE_VERSION = 8 as StateVersion;
const READY_PROJECTION_VERSION = 8 as ProjectionVersion;
const SPEC_VERSION_REF = "spec_version_ready";
const COMPLETION_SOURCE_ID = `completion_candidate:${SESSION_ID}:8`;
const QUEUE_ITEM_ID = "queue_ready" as QueueItemId;
const RESEARCH_TASK_ID = "research_task_ready" as ResearchTaskId;
const RESEARCH_RESULT_ID = "research_result_ready" as ResearchResultId;
const EVIDENCE_PACK_ID = "evidence_pack_ready" as DecisionEvidencePackId;
const PHASE15B_HINT_ARTIFACT_ID = "runtime_artifact_phase15b_handoff" as RuntimeArtifactId;

function readySourceRefs(
  overrides: Partial<Record<"spec" | "completion" | "evidence" | "queue", Partial<PlanningHandoffSourceRefDto>>> = {}
): readonly PlanningHandoffSourceRefDto[] {
  return [
    {
      sourceType: "spec_version",
      sourceId: SPEC_VERSION_REF,
      sourceLabel: "Current SpecVersion",
      required: true,
      stale: false,
      ...overrides.spec
    },
    {
      sourceType: "completion_candidate",
      sourceId: COMPLETION_SOURCE_ID,
      sourceLabel: "Completion candidate",
      required: true,
      stale: false,
      ...overrides.completion
    },
    {
      sourceType: "decision_linked_evidence_pack",
      sourceId: EVIDENCE_PACK_ID,
      sourceLabel: "Decision-linked Evidence Pack",
      required: true,
      stale: false,
      ...overrides.evidence
    },
    {
      sourceType: "research_updated_queue_item",
      sourceId: QUEUE_ITEM_ID,
      sourceLabel: "Research-updated queue card",
      required: true,
      stale: false,
      ...overrides.queue
    }
  ];
}

function phase15bHintsFixture(): Phase15bUpgradeHints {
  return {
    executionIntent: {
      candidateActionType: "shell_command",
      targetSurface: "local verification command",
      nonExecutingSummary: "Preserve future shell readiness without running it."
    },
    approvalRequirements: [
      {
        approvalType: "task_level_execution",
        reason: "User approval is required before running future verification commands.",
        scope: "pnpm verify in an isolated worktree",
        requiredActor: "user",
        reconfirmRule: "Reconfirm when the base ref or command changes."
      }
    ],
    sandboxRequirements: {
      isolatedWorktreeRequired: true,
      browserSandboxRequired: false,
      networkMode: "offline",
      commandAllowlist: ["pnpm verify", "git diff --check"],
      secretGrantBoundary: "No credential values are required.",
      environmentPolicy: "Use local-only deterministic environment variables.",
      logCaptureRequired: true
    },
    rollbackReference: {
      baseRef: "origin/main",
      diffRef: "runtime_artifact_phase15b_handoff:preview_diff",
      rollbackNote: "Discard the hint or revert the later approved implementation commit.",
      reversible: true,
      cleanupExpectation: "Remove temporary preview logs after review."
    },
    expectedEvidence: {
      tests: ["pnpm verify"],
      smokeChecks: ["pnpm smoke:e2e"],
      artifactPaths: ["packages/core/src/product-engine/planning-handoff.test.ts"],
      manualInspection: ["Confirm Planning Handoff treats the hint as metadata only."],
      expectedLogs: ["phase15b readiness metadata exported without execution"]
    },
    riskNormalization: {
      riskLevel: "medium",
      blockedActionType: "shell_command",
      blockReason: "Shell execution is blocked until Phase 3 controlled execution approval.",
      userVisibleAction: "Ask again before running any command.",
      escalationTarget: "phase3_safe_execution"
    },
    sourceRefs: [
      {
        kind: "preview_artifact",
        refId: PHASE15B_HINT_ARTIFACT_ID,
        label: "Preview artifact label must not be needed for mapping."
      },
      {
        kind: "blocked_action",
        refId: `${PHASE15B_HINT_ARTIFACT_ID}:shell_command`,
        label: "Blocked shell action"
      },
      {
        kind: "research_run",
        refId: "research_run_phase15b_handoff",
        label: "Research run provenance"
      },
      {
        kind: "evidence_matrix",
        refId: "evidence_matrix_phase15b_handoff",
        label: "Evidence matrix provenance"
      },
      {
        kind: "research_allowlist",
        refId: "research_allowlist_phase15b_handoff",
        label: "Allowlist provenance"
      },
      {
        kind: "audit_log",
        refId: "audit_log_phase15b_handoff",
        label: "Audit log provenance"
      }
    ],
    createdAt: "2026-05-06T00:05:00.000Z",
    schemaVersion: PHASE15B_UPGRADE_HINTS_SCHEMA_VERSION
  };
}

function phase15bHintSourceRef(): PlanningHandoffSourceRefDto {
  return {
    sourceType: "phase15b_hint",
    sourceId: PHASE15B_HINT_ARTIFACT_ID,
    sourceLabel: "Phase 1.5B readiness hint",
    required: false,
    stale: false
  };
}

function baseReadyState(): ProductEngineStateSnapshot {
  const initialState = createInitialProductEngineState(PROJECT_ID, SESSION_ID);
  const evidenceItemId = "evidence_item_ready" as EvidenceItemId;

  return {
    ...initialState,
    stateVersion: READY_STATE_VERSION,
    currentSpec: {
      draftRef: "spec_draft_ready",
      versionRef: SPEC_VERSION_REF,
      title: "Planning Handoff Ready Spec",
      sections: ["Problem", "Customer", "Value", "Validation"]
    },
    queueProjection: {
      kind: "DecisionQueueProjection",
      version: READY_PROJECTION_VERSION,
      active: [],
      next: [],
      blocked: [],
      deferred: [
        {
          queueItemId: QUEUE_ITEM_ID,
          title: "High-impact research review",
          state: "resolved",
          cardType: "research_review",
          researchTaskId: RESEARCH_TASK_ID,
          evidencePackId: EVIDENCE_PACK_ID,
          blocksPlanning: true,
          availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
          terminalOutcome: "approved"
        }
      ]
    },
    researchState: {
      kind: "ResearchEvidenceProjection",
      version: READY_PROJECTION_VERSION,
      taskIds: [RESEARCH_TASK_ID],
      tasks: [
        {
          researchTaskId: RESEARCH_TASK_ID,
          sessionId: SESSION_ID,
          objective: "Validate the handoff decision evidence.",
          routeOutcome: "research_needed",
          impact: "high",
          status: "evidence_ready",
          createdAt: "2026-05-06T00:00:00.000Z"
        }
      ],
      results: [
        {
          researchResultId: RESEARCH_RESULT_ID,
          researchTaskId: RESEARCH_TASK_ID,
          resultSummary: "Balanced evidence supports the next build slice.",
          sourceReliability: "high",
          claim: "The next build slice is ready.",
          decisionContext: "Planning Handoff gate",
          importedAt: "2026-05-06T00:01:00.000Z"
        }
      ],
      evidenceMatrices: [
        {
          evidenceMatrixId: "evidence_matrix_ready",
          researchTaskId: RESEARCH_TASK_ID,
          researchResultId: RESEARCH_RESULT_ID,
          synthesisVersion: 1,
          proEvidence: [
            {
              evidenceItemId,
              kind: "pro",
              summary: "Queue card has accepted evidence."
            }
          ],
          conEvidence: [],
          uncertainties: [],
          additionalQuestions: [],
          balanceStatus: "balanced",
          decisionBlocked: false
        }
      ],
      evidencePacks: [
        {
          evidencePackId: EVIDENCE_PACK_ID,
          researchTaskId: RESEARCH_TASK_ID,
          researchResultId: RESEARCH_RESULT_ID,
          claim: "The next build slice is ready.",
          decisionContext: "Planning Handoff gate",
          sourceReliability: "high",
          retrievedAt: "2026-05-06T00:02:00.000Z",
          gateStatus: "accepted",
          gateChecks: [
            {
              code: "source_metadata",
              status: "passed",
              reason: "Source metadata is present."
            }
          ],
          proEvidenceItemIds: [evidenceItemId],
          conEvidenceItemIds: [],
          uncertaintyItemIds: [],
          limitationRefs: [],
          implicationScope: "Phase 2 Planning Handoff",
          createdAt: "2026-05-06T00:03:00.000Z"
        }
      ],
      reviewCards: [
        {
          cardId: QUEUE_ITEM_ID,
          researchTaskId: RESEARCH_TASK_ID,
          evidencePackId: EVIDENCE_PACK_ID,
          cardType: "research_review",
          title: "High-impact research review",
          state: "resolved",
          impact: "high",
          gateStatus: "accepted",
          availableOutcomes: ["approved", "revised", "risk_accepted", "research_insufficient"],
          terminalOutcome: "approved",
          blocksPlanning: true,
          recoveryActions: ["approve_evidence", "accept_risk", "mark_research_insufficient"]
        }
      ],
      knownRisks: [],
      nextValidationActions: [],
      proConBalanceStatus: "balanced"
    },
    completeness: {
      ...initialState.completeness,
      version: READY_PROJECTION_VERSION,
      compositeScore: 92,
      readinessLabel: "spec_ready",
      gates: [
        {
          gateId: "research_queue_cards",
          label: "Research-updated Queue cards terminal",
          passed: true
        }
      ],
      topRisks: [],
      topRiskCards: [],
      nextBestActions: ["Create Planning Handoff."],
      completionCandidate: {
        status: "candidate",
        summary: "Spec and research are ready for Planning Handoff.",
        gateFailures: [],
        ifStopNowArtifact: {
          title: "Planning Handoff candidate",
          summary: "Next build slice can be planned.",
          knownRisks: [],
          nextValidationActions: []
        }
      }
    }
  };
}

function readyStateWithPhase15bHint(hints: Phase15bUpgradeHints = phase15bHintsFixture()): ProductEngineStateSnapshot {
  return {
    ...baseReadyState(),
    runtimeState: {
      kind: "RuntimeActivityProjection",
      version: READY_PROJECTION_VERSION,
      runtimeStatus: "blocked",
      effects: [],
      runtimeArtifacts: [
        {
          artifactId: PHASE15B_HINT_ARTIFACT_ID,
          turnPurpose: "implementation_plan_preview",
          kind: "BlockedActionArtifact",
          applyPolicy: "blocked",
          status: "blocked",
          source: "protocol_fixture",
          targetObject: "blocked_action",
          summary: "Shell readiness handoff blocked",
          payload: {
            title: "Shell readiness handoff blocked",
            body: "Metadata only; no command was executed.",
            targetObject: "blocked_action",
            sourceRefs: ["research_run_phase15b_handoff"],
            phase15bUpgradeHints: hints
          },
          sourceRefs: ["research_run_phase15b_handoff"],
          contextHash: "ctx_phase15b_handoff",
          runtimeAdapterVersion: "codex-app-server-preview-v1",
          blockedAction: {
            actionType: "shell_command",
            reason: "Phase 1.5B preserves readiness only."
          },
          createdAt: "2026-05-06T00:05:00.000Z",
          schemaVersion: CONTRACT_SCHEMA_VERSION
        }
      ]
    }
  };
}

function planningHandoffCommand(
  payload: ProductEngineCommand["payload"],
  overrides: Partial<Pick<ProductEngineCommand, "idempotencyKey">> = {}
): ProductEngineCommand {
  return {
    commandId: "cmd_planning_handoff" as CommandId,
    commandType: "CreatePlanningHandoff",
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    actor: "user",
    issuedAt: "2026-05-06T00:10:00.000Z",
    idempotencyKey: overrides.idempotencyKey ?? "CreatePlanningHandoff:ready",
    expectedStateVersion: READY_STATE_VERSION,
    causationId: null,
    correlationId: "corr_planning_handoff" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function runtimeConversionCommand(payload: ProductEngineCommand["payload"]): ProductEngineCommand {
  return {
    commandId: "cmd_runtime_to_handoff" as CommandId,
    commandType: "ConvertRuntimeArtifact",
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    actor: "user",
    issuedAt: "2026-05-06T00:11:00.000Z",
    idempotencyKey: "ConvertRuntimeArtifact:handoff",
    expectedStateVersion: READY_STATE_VERSION,
    causationId: null,
    correlationId: "corr_runtime_to_handoff" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function withoutTerminalOutcome<T extends { terminalOutcome?: unknown }>(value: T): Omit<T, "terminalOutcome"> {
  const copy = { ...value };

  delete copy.terminalOutcome;

  return copy;
}

interface ResearchInsufficientQueueOutcomeOptions {
  readonly title: string;
  readonly decisionContext: string;
  readonly knownRisk: string;
  readonly knownRisks?: readonly string[];
  readonly nextValidationActions?: readonly string[];
}

function withResearchInsufficientQueueOutcome(
  state: ProductEngineStateSnapshot,
  options: ResearchInsufficientQueueOutcomeOptions
): ProductEngineStateSnapshot {
  return {
    ...state,
    queueProjection: {
      ...state.queueProjection,
      deferred: [
        {
          ...state.queueProjection.deferred[0]!,
          title: options.title,
          terminalOutcome: "research_insufficient" as const
        }
      ]
    },
    researchState: {
      ...state.researchState,
      evidenceMatrices: [
        {
          ...state.researchState.evidenceMatrices[0]!,
          balanceStatus: "missing_con_evidence" as const,
          decisionBlocked: true,
          knownRisk: options.knownRisk
        }
      ],
      evidencePacks: [
        {
          ...state.researchState.evidencePacks[0]!,
          gateStatus: "research_insufficient" as const,
          decisionContext: options.decisionContext,
          knownRisk: options.knownRisk
        }
      ],
      reviewCards: [
        {
          ...state.researchState.reviewCards[0]!,
          title: options.title,
          decisionContext: options.decisionContext,
          terminalOutcome: "research_insufficient" as const
        }
      ],
      knownRisks: options.knownRisks ?? state.researchState.knownRisks,
      nextValidationActions: options.nextValidationActions ?? state.researchState.nextValidationActions
    }
  };
}

describe("Phase 2 Planning Handoff ProductEngine gate", () => {
  it("creates a deterministic final Planning Handoff without queuing effects when the gate is planning_ready", () => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.events).toHaveLength(1);
    expect(reduction.events[0]).toMatchObject({
      eventType: "PlanningHandoffCreated",
      payload: {
        verdict: "planning_ready",
        artifactKind: "PlanningHandoffArtifact"
      }
    });
    expect(reduction.deterministicOutputs).toEqual([
      expect.objectContaining({
        outputType: "planning_handoff_artifact",
        outputRef: "handoff_d912dcf3a29eef63c6f7afbff007623e",
        payload: expect.objectContaining({
          verdict: "planning_ready",
          artifactKind: "PlanningHandoffArtifact"
        })
      })
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "PlanningHandoffProjection",
      currentStatus: "planning_ready",
      finalArtifact: {
        status: "planning_ready",
        noExecutionPolicy: "no_file_shell_browser_deploy_or_external_mutation"
      }
    });
    expect(reduction.nextState).toMatchObject({
      planningHandoff: expect.objectContaining({
        currentStatus: "planning_ready"
      })
    });
  });

  it("synthesizes source-driven task, PR/issue, and build-slice plans instead of a generic scaffold", () => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [...readySourceRefs(), phase15bHintSourceRef()]
      }),
      readyStateWithPhase15bHint()
    );
    const projection = reduction.immediateProjection as PlanningHandoffProjection;

    if (projection.currentStatus !== "planning_ready") {
      throw new Error("Expected a final Planning Handoff projection.");
    }

    const { finalArtifact } = projection;

    expect(finalArtifact.taskBreakdown).toHaveLength(3);
    expect(finalArtifact.taskBreakdown.map((task) => task.ownerRole)).toEqual(["product", "research", "security"]);
    expect(finalArtifact.taskBreakdown[0]).toMatchObject({
      title: expect.stringContaining("product context"),
      sourceRefs: expect.arrayContaining([expect.objectContaining({ sourceType: "spec_version" })])
    });
    expect(finalArtifact.taskBreakdown[1]).toMatchObject({
      title: expect.stringContaining("evidence"),
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({ sourceType: "decision_linked_evidence_pack" }),
        expect.objectContaining({ sourceType: "research_updated_queue_item" })
      ]),
      acceptanceEvidence: expect.arrayContaining([
        expect.stringContaining(`Research-updated queue ${QUEUE_ITEM_ID} terminal outcome is approved.`)
      ])
    });
    expect(finalArtifact.taskBreakdown[2]).toMatchObject({
      title: expect.stringContaining("readiness"),
      sourceRefs: expect.arrayContaining([expect.objectContaining({ sourceType: "phase15b_hint" })]),
      acceptanceEvidence: expect.arrayContaining([
        "No file, shell, browser, deploy, credential, external mutation, or active delegation authority is introduced.",
        "pnpm verify"
      ])
    });
    expect(finalArtifact.prIssuePlan).toHaveLength(finalArtifact.taskBreakdown.length);
    expect(finalArtifact.prIssuePlan[1]?.blockedBy).toEqual([finalArtifact.taskBreakdown[0]?.taskId]);
    expect(finalArtifact.prIssuePlan[2]?.entryPrerequisites).toEqual(
      expect.arrayContaining([expect.stringContaining("Phase 1.5B sandbox")])
    );
    expect(finalArtifact.buildSlicePlan.includedCapabilities).toEqual(
      expect.arrayContaining(["source-driven task synthesis", expect.stringContaining("research task")])
    );
    expect(finalArtifact.buildSlicePlan.acceptanceCriteria).toEqual(
      expect.arrayContaining([expect.stringContaining("Spec/Evidence/Queue sources drive task")])
    );
  });

  it("maps Phase 1.5B readiness hints into Phase 2 approvals, sandbox, rollback, evidence, and residual risk", () => {
    const hintRef = phase15bHintSourceRef();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [...readySourceRefs(), hintRef]
      }),
      readyStateWithPhase15bHint()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready",
      finalArtifact: {
        readinessChecklist: {
          requiredApprovals: expect.arrayContaining([expect.stringContaining("task_level_execution")]),
          sandboxBoundary: expect.stringContaining("network=offline"),
          rollbackReference: expect.stringContaining("origin/main"),
          expectedEvidence: expect.arrayContaining(["pnpm verify", "pnpm smoke:e2e"])
        },
        prIssuePlan: expect.arrayContaining([
          expect.objectContaining({
            entryPrerequisites: expect.arrayContaining([
              expect.stringContaining("Phase 1.5B sandbox"),
              expect.stringContaining("Phase 1.5B rollback")
            ]),
            exitEvidence: expect.arrayContaining(["pnpm verify", "pnpm smoke:e2e"])
          })
        ]),
        phase15bHintMapping: [
          expect.objectContaining({
            hintRef,
            requiredApprovals: expect.arrayContaining([expect.stringContaining("task_level_execution")]),
            sandboxBoundary: expect.stringContaining("isolatedWorktree=true"),
            rollbackReference: expect.stringContaining("runtime_artifact_phase15b_handoff:preview_diff"),
            expectedEvidence: expect.arrayContaining(["pnpm verify", "pnpm smoke:e2e"]),
            riskNormalization: {
              riskLevel: "medium",
              blockedActionType: "shell_command",
              blockReason: "Shell execution is blocked until Phase 3 controlled execution approval.",
              userVisibleAction: "Ask again before running any command.",
              escalationTarget: "phase3_safe_execution"
            },
            sourceTrace: expect.arrayContaining([
              expect.objectContaining({ kind: "research_run", refId: "research_run_phase15b_handoff" }),
              expect.objectContaining({ kind: "evidence_matrix", refId: "evidence_matrix_phase15b_handoff" }),
              expect.objectContaining({ kind: "research_allowlist", refId: "research_allowlist_phase15b_handoff" }),
              expect.objectContaining({ kind: "audit_log", refId: "audit_log_phase15b_handoff" })
            ]),
            noExecutionPolicy: "metadata_only_no_execution"
          })
        ],
        residualRiskRegister: expect.arrayContaining([
          expect.objectContaining({
            riskId: expect.stringContaining("phase15b_"),
            riskClass: "phase15b_readiness_gap",
            validationDependency: "Shell execution is blocked until Phase 3 controlled execution approval.",
            sourceRefs: [hintRef]
          })
        ])
      }
    });
    expect(JSON.stringify(reduction.immediateProjection)).not.toContain("Preview artifact label must not be needed");
  });

  it("redacts non-public Phase 1.5B hint text before reusing it in Planning Handoff", () => {
    const unsafeHintArtifactId = "runtime_artifact_private_customer_alpha_raw_idea" as RuntimeArtifactId;
    const hintRef: PlanningHandoffSourceRefDto = {
      ...phase15bHintSourceRef(),
      sourceId: unsafeHintArtifactId,
      sourceLabel: "Private customer Alpha sourceRef includes token=secret-token-value."
    };
    const baseHints = phase15bHintsFixture();
    const privateHints: Phase15bUpgradeHints = {
      ...baseHints,
      approvalRequirements: [
        {
          ...baseHints.approvalRequirements[0]!,
          reason: "Private customer Alpha approval includes token=secret-token-value.",
          scope: "Customer Jane internal roadmap",
          reconfirmRule: "Bearer abcdefghijklmnop"
        }
      ],
      sandboxRequirements: {
        ...baseHints.sandboxRequirements,
        secretGrantBoundary: "AWS_SECRET_ACCESS_KEY wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        environmentPolicy: "Private customer Alpha local environment"
      },
      rollbackReference: {
        ...baseHints.rollbackReference,
        diffRef: "runtime_artifact_phase15b_handoff:preview_diff?token=secret-token-value",
        rollbackNote: "Discard Private customer Alpha payload notes.",
        cleanupExpectation: "Remove Customer Jane internal roadmap notes."
      },
      expectedEvidence: {
        ...baseHints.expectedEvidence,
        manualInspection: ["Review clientSecret client-secret-value-123 before execution."],
        expectedLogs: ["Authorization: Basic dXNlcjpwYXNz"]
      },
      riskNormalization: {
        ...baseHints.riskNormalization,
        blockReason: "Future shell action has token secret-token-value-12345.",
        userVisibleAction: "Ask about Customer Jane internal roadmap before any command."
      },
      sourceRefs: [
        ...baseHints.sourceRefs,
        {
          kind: "spec_section",
          refId: "spec_section_private_customer_alpha_raw_idea",
          label: "Private customer Alpha raw idea"
        }
      ]
    };
    const stateWithUnsafeHintRef = readyStateWithPhase15bHint(privateHints);
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [...readySourceRefs(), hintRef]
      }),
      {
        ...stateWithUnsafeHintRef,
        runtimeState: {
          ...stateWithUnsafeHintRef.runtimeState,
          runtimeArtifacts: [
            {
              ...stateWithUnsafeHintRef.runtimeState.runtimeArtifacts[0]!,
              artifactId: unsafeHintArtifactId
            }
          ]
        }
      }
    );
    const serializedPublicOutputs = JSON.stringify({
      events: reduction.events,
      deterministicOutputs: reduction.deterministicOutputs,
      immediateProjection: reduction.immediateProjection
    });

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      finalArtifact: {
        sourceRefs: expect.arrayContaining([
          expect.objectContaining({
            sourceType: "phase15b_hint",
            sourceId: expect.stringMatching(/^redacted_ref:phase15b_hint:[a-f0-9]{16}$/u),
            sourceLabel: "[redacted_phase15b_non_exportable_metadata]"
          })
        ]),
        phase15bHintMapping: [
          expect.objectContaining({
            hintRef: expect.objectContaining({
              sourceId: expect.stringMatching(/^redacted_ref:phase15b_hint:[a-f0-9]{16}$/u),
              sourceLabel: "[redacted_phase15b_non_exportable_metadata]"
            })
          })
        ]
      }
    });
    expect(serializedPublicOutputs).toContain("[redacted_phase15b_non_exportable_metadata]");
    expect(serializedPublicOutputs).toMatch(/redacted_ref:spec_section:[a-f0-9]{16}/u);
    expect(serializedPublicOutputs).not.toContain("Private customer Alpha");
    expect(serializedPublicOutputs).not.toContain("Customer Jane internal roadmap");
    expect(serializedPublicOutputs).not.toContain("runtime_artifact_private_customer_alpha_raw_idea");
    expect(serializedPublicOutputs).not.toContain("spec_section_private_customer_alpha_raw_idea");
    expect(serializedPublicOutputs).not.toContain("token=secret-token-value");
    expect(serializedPublicOutputs).not.toContain("Bearer abcdefghijklmnop");
    expect(serializedPublicOutputs).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(serializedPublicOutputs).not.toContain("wJalrXUtnFEMI");
    expect(serializedPublicOutputs).not.toContain("clientSecret");
    expect(serializedPublicOutputs).not.toContain("client-secret-value-123");
    expect(serializedPublicOutputs).not.toContain("Authorization: Basic");
    expect(serializedPublicOutputs).not.toContain("dXNlcjpwYXNz");
    expect(serializedPublicOutputs).not.toContain("secret-token-value-12345");
  });

  it("blocks required Phase 1.5B hint refs that do not resolve to valid hint payloads", () => {
    const missingRequiredHintRef: PlanningHandoffSourceRefDto = {
      ...phase15bHintSourceRef(),
      sourceId: "runtime_artifact_missing_phase15b",
      required: true
    };
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [...readySourceRefs(), missingRequiredHintRef]
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "source_trace_incomplete",
      blockerArtifact: {
        blockers: expect.arrayContaining([
          expect.objectContaining({
            blockerClass: "source_trace",
            whyFatal:
              "Planning Handoff cannot use required source refs that are not present, accepted, and current in the loaded ProductEngine state.",
            sourceRefs: [missingRequiredHintRef]
          })
        ])
      }
    });
  });

  it("emits a source_trace_incomplete blocker artifact instead of transient rejection for stale or missing required refs", () => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs({
          spec: {
            stale: true
          }
        })
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "PlanningHandoffBlocked",
      payload: {
        verdict: "source_trace_incomplete",
        artifactKind: "PlanningHandoffBlockerArtifact"
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "source_trace_incomplete",
      blockerArtifact: {
        status: "source_trace_incomplete",
        noFinalLabelRule: "must_not_use_planning_ready_label",
        requiredUserActions: expect.arrayContaining(["revise"])
      }
    });
  });

  it.each([
    ["decision-linked Evidence Pack", "decision_linked_evidence_pack"],
    ["research-updated Queue", "research_updated_queue_item"]
  ] as const)("emits source_trace_incomplete when the %s source ref is omitted", (_label, omittedSourceType) => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs().filter((sourceRef) => sourceRef.sourceType !== omittedSourceType)
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "source_trace_incomplete",
      blockerArtifact: {
        requiredUserActions: expect.arrayContaining(["research_more"])
      }
    });
  });

  it("does not accept a draft spec ref in place of the current SpecVersion source", () => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs({
          spec: {
            sourceId: "spec_draft_ready",
            sourceLabel: "Draft spec ref"
          }
        })
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "source_trace_incomplete"
    });
  });

  it("does not accept a plain non-research queue card as the Research-updated Queue source", () => {
    const plainQuestionQueueItemId = "queue_plain_question" as QueueItemId;
    const state = baseReadyState();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs({
          queue: {
            sourceId: plainQuestionQueueItemId,
            sourceLabel: "Plain question card"
          }
        })
      }),
      {
        ...state,
        queueProjection: {
          ...state.queueProjection,
          active: [
            ...state.queueProjection.active,
            {
              queueItemId: plainQuestionQueueItemId,
              title: "Plain intake question",
              state: "active",
              cardType: "question"
            }
          ]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "source_trace_incomplete"
    });
  });

  it("does not accept a non-accepted Evidence Pack as the decision-linked evidence source", () => {
    const state = baseReadyState();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...state,
        researchState: {
          ...state.researchState,
          evidencePacks: [
            {
              ...state.researchState.evidencePacks[0]!,
              gateStatus: "needs_review"
            }
          ]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "source_trace_incomplete"
    });
  });

  it("emits queue_review_incomplete when a high-impact research queue card has no terminal outcome", () => {
    const state = baseReadyState();
    const queueItemWithoutOutcome = withoutTerminalOutcome(state.queueProjection.deferred[0]!);
    const cardWithoutOutcome = withoutTerminalOutcome(state.researchState.reviewCards[0]!);
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...state,
        queueProjection: {
          ...state.queueProjection,
          deferred: [queueItemWithoutOutcome]
        },
        researchState: {
          ...state.researchState,
          reviewCards: [cardWithoutOutcome]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "queue_review_incomplete",
      blockerArtifact: {
        requiredUserActions: expect.arrayContaining(["research_more"])
      }
    });
  });

  it("carries Phase 1.5B readiness semantics into blocker reports without making them gate actions", () => {
    const hintRef = phase15bHintSourceRef();
    const state = readyStateWithPhase15bHint();
    const queueItemWithoutOutcome = withoutTerminalOutcome(state.queueProjection.deferred[0]!);
    const cardWithoutOutcome = withoutTerminalOutcome(state.researchState.reviewCards[0]!);
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [...readySourceRefs(), hintRef]
      }),
      {
        ...state,
        queueProjection: {
          ...state.queueProjection,
          deferred: [queueItemWithoutOutcome]
        },
        researchState: {
          ...state.researchState,
          reviewCards: [cardWithoutOutcome]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "queue_review_incomplete",
      blockerArtifact: {
        requiredUserActions: ["research_more"],
        phase15bHintMapping: [
          expect.objectContaining({
            hintRef,
            sandboxBoundary: expect.stringContaining("network=offline"),
            noExecutionPolicy: "metadata_only_no_execution"
          })
        ],
        safePreviewRefs: expect.arrayContaining([hintRef])
      }
    });
    const planningHandoffProjection = reduction.immediateProjection as PlanningHandoffProjection;
    const blockerArtifact =
      planningHandoffProjection.currentStatus === "queue_review_incomplete"
        ? planningHandoffProjection.blockerArtifact
        : null;

    expect(blockerArtifact?.blockers.some((blocker) => blocker.sourceRefs.includes(hintRef))).toBe(false);
    expect(JSON.stringify(blockerArtifact?.phase15bHintMapping)).toContain("metadata_only_no_execution");
    expect(JSON.stringify(blockerArtifact?.phase15bHintMapping)).toContain("network=offline");
  });

  it("emits blocked_by_fatal for terminal research_insufficient high-impact queue outcomes", () => {
    const state = baseReadyState();
    const insufficientQueueItem = {
      ...state.queueProjection.deferred[0]!,
      terminalOutcome: "research_insufficient" as const
    };
    const insufficientCard = {
      ...state.researchState.reviewCards[0]!,
      terminalOutcome: "research_insufficient" as const
    };
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...state,
        queueProjection: {
          ...state.queueProjection,
          deferred: [insufficientQueueItem]
        },
        researchState: {
          ...state.researchState,
          reviewCards: [insufficientCard]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked_by_fatal",
      blockerArtifact: {
        requiredUserActions: expect.arrayContaining(["research_more"])
      }
    });
  });

  it("carries non-fatal research_insufficient queue outcomes as visible residual risks", () => {
    const state = withResearchInsufficientQueueOutcome(baseReadyState(), {
      title: "Value proposition differentiation evidence gap",
      decisionContext: "value_proposition",
      knownRisk: "Value proposition differentiation evidence remains insufficient.",
      knownRisks: ["Value proposition differentiation evidence remains insufficient."],
      nextValidationActions: ["Validate value proposition differentiation before execution."]
    });
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready",
      finalArtifact: {
        gateVerdict: {
          terminalOutcomeSummary: [
            expect.objectContaining({
              queueItemId: QUEUE_ITEM_ID,
              outcome: "research_insufficient",
              residualRiskClass: "value_proposition_differentiation"
            })
          ]
        },
        residualRiskRegister: expect.arrayContaining([
          expect.objectContaining({
            riskId: `research_queue_${QUEUE_ITEM_ID}_research_insufficient`,
            riskClass: "value_proposition_differentiation",
            validationDependency: expect.stringContaining("Supplement")
          })
        ])
      }
    });
  });

  it("keeps value proposition validation gaps residual instead of matching generic validation as fatal", () => {
    const state = withResearchInsufficientQueueOutcome(baseReadyState(), {
      title: "Value proposition validation evidence gap",
      decisionContext: "value_proposition",
      knownRisk: "Value proposition validation evidence remains insufficient."
    });
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready",
      finalArtifact: {
        gateVerdict: {
          terminalOutcomeSummary: [
            expect.objectContaining({
              queueItemId: QUEUE_ITEM_ID,
              outcome: "research_insufficient",
              residualRiskClass: "value_proposition_differentiation"
            })
          ]
        }
      }
    });
  });

  it("keeps success metrics validation gaps fatal for Planning Handoff", () => {
    const state = withResearchInsufficientQueueOutcome(baseReadyState(), {
      title: "Success metrics validation gap",
      decisionContext: "success_metrics_validation",
      knownRisk: "Success metrics validation evidence remains insufficient."
    });
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      state
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked_by_fatal",
      blockerArtifact: {
        blockers: [
          expect.objectContaining({
            blockerClass: "success_metrics_validation",
            currentOutcome: "research_insufficient"
          })
        ]
      }
    });
  });

  it("keeps an unrelated risk acceptance source from unblocking a fatal queue outcome", () => {
    const state = baseReadyState();
    const deferredQueueItem = {
      ...state.queueProjection.deferred[0]!,
      terminalOutcome: "deferred" as const
    };
    const deferredCard = {
      ...state.researchState.reviewCards[0]!,
      terminalOutcome: "deferred" as const
    };
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [
          ...readySourceRefs(),
          {
            sourceType: "risk_acceptance",
            sourceId: "decision_unrelated_queue_acceptance",
            sourceLabel: "Unrelated risk acceptance decision",
            required: true,
            stale: false
          } satisfies PlanningHandoffSourceRefDto
        ]
      }),
      {
        ...state,
        decisions: [
          {
            decisionId: "decision_unrelated_queue_acceptance" as DecisionId,
            requiredDecisionRef: "validation_plan",
            status: "risk_accepted"
          }
        ],
        queueProjection: {
          ...state.queueProjection,
          deferred: [deferredQueueItem]
        },
        researchState: {
          ...state.researchState,
          reviewCards: [deferredCard]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "blocked_by_fatal"
    });
  });

  it("allows a deferred queue blocker only when risk acceptance is linked to the card source trace", () => {
    const state = baseReadyState();
    const linkedDecisionId = "decision_linked_queue_acceptance" as DecisionId;
    const deferredQueueItem = {
      ...state.queueProjection.deferred[0]!,
      terminalOutcome: "deferred" as const
    };
    const deferredCard = {
      ...state.researchState.reviewCards[0]!,
      terminalOutcome: "deferred" as const,
      retainedSourceRefs: [linkedDecisionId]
    };
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [
          ...readySourceRefs(),
          {
            sourceType: "risk_acceptance",
            sourceId: linkedDecisionId,
            sourceLabel: "Linked queue risk acceptance decision",
            required: true,
            stale: false
          } satisfies PlanningHandoffSourceRefDto
        ]
      }),
      {
        ...state,
        decisions: [
          {
            decisionId: linkedDecisionId,
            requiredDecisionRef: "validation_plan",
            status: "risk_accepted"
          }
        ],
        queueProjection: {
          ...state.queueProjection,
          deferred: [deferredQueueItem]
        },
        researchState: {
          ...state.researchState,
          reviewCards: [deferredCard]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready"
    });
  });

  it("emits needs_risk_acceptance when a high-severity known risk is visible but not accepted", () => {
    const state = baseReadyState();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...state,
        completeness: {
          ...state.completeness,
          topRiskCards: [
            {
              riskId: "risk_high_approval",
              title: "Approval/security execution safety needs explicit acceptance",
              severity: "high",
              sourceRefs: ["risk_high_approval"],
              nextValidationAction: "Accept or resolve the risk before final handoff."
            }
          ]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "needs_risk_acceptance",
      blockerArtifact: {
        requiredUserActions: expect.arrayContaining(["risk_accept"])
      }
    });
  });

  it("keeps an unrelated risk acceptance source from accepting a high-severity known risk", () => {
    const state = baseReadyState();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [
          ...readySourceRefs(),
          {
            sourceType: "risk_acceptance",
            sourceId: "decision_unrelated_known_risk_acceptance",
            sourceLabel: "Unrelated risk acceptance decision",
            required: true,
            stale: false
          } satisfies PlanningHandoffSourceRefDto
        ]
      }),
      {
        ...state,
        decisions: [
          {
            decisionId: "decision_unrelated_known_risk_acceptance" as DecisionId,
            requiredDecisionRef: "validation_plan",
            status: "risk_accepted"
          }
        ],
        completeness: {
          ...state.completeness,
          topRiskCards: [
            {
              riskId: "risk_high_unrelated",
              title: "High-severity risk needs a linked acceptance trace",
              severity: "high",
              sourceRefs: ["risk_high_unrelated"],
              nextValidationAction: "Link an explicit risk acceptance source before final handoff."
            }
          ]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "needs_risk_acceptance"
    });
  });

  it("does not treat an unreferenced risk_accepted decision as explicit risk acceptance", () => {
    const state = baseReadyState();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...state,
        decisions: [
          {
            decisionId: "decision_unlinked_risk_acceptance" as DecisionId,
            requiredDecisionRef: "validation_plan",
            status: "risk_accepted"
          }
        ],
        completeness: {
          ...state.completeness,
          topRiskCards: [
            {
              riskId: "risk_high_unlinked",
              title: "Unlinked high-severity risk still needs explicit acceptance trace",
              severity: "high",
              sourceRefs: ["risk_high_unlinked"],
              nextValidationAction: "Link an explicit risk acceptance source before final handoff."
            }
          ]
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "needs_risk_acceptance",
      blockerArtifact: {
        requiredUserActions: expect.arrayContaining(["risk_accept"])
      }
    });
  });

  it("allows planning_ready when the high-severity risk has an explicit risk acceptance source", () => {
    const state = baseReadyState();
    const riskAcceptedState: ProductEngineStateSnapshot = {
      ...state,
      decisions: [
        {
          decisionId: "decision_risk_acceptance" as DecisionId,
          requiredDecisionRef: "validation_plan",
          status: "risk_accepted"
        }
      ],
      completeness: {
        ...state.completeness,
        topRiskCards: [
          {
            riskId: "risk_high_approval",
            title: "Approval/security execution safety accepted with rationale",
            severity: "high",
            sourceRefs: ["risk_high_approval", "decision_risk_acceptance"],
            nextValidationAction: "Monitor the accepted risk in the next slice."
          }
        ]
      }
    };
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: [
          ...readySourceRefs(),
          {
            sourceType: "risk_acceptance",
            sourceId: "decision_risk_acceptance",
            sourceLabel: "Risk acceptance decision",
            required: true,
            stale: false
          } satisfies PlanningHandoffSourceRefDto
        ]
      }),
      riskAcceptedState
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready",
      finalArtifact: {
        residualRiskRegister: [
          expect.objectContaining({
            riskId: "risk_high_approval"
          })
        ]
      }
    });
  });

  it("keeps research and Founder Brief known risks visible in the final residual risk register", () => {
    const state = baseReadyState();
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...state,
        researchState: {
          ...state.researchState,
          knownRisks: ["research risk remains visible"]
        },
        founderBrief: {
          kind: "FounderBriefProjection",
          sessionId: SESSION_ID,
          version: READY_PROJECTION_VERSION,
          exportReady: true,
          problemCustomerValue: "Planning Handoff customer/problem/value summary",
          topDecisions: ["Proceed with the next build slice."],
          knownRisks: ["founder brief risk remains visible"],
          nextValidationActions: ["Review residual risks before implementation."],
          briefSections: [],
          ifStopNowArtifact: {
            title: "If stop now",
            summary: "Risks remain visible in the handoff.",
            knownRisks: ["founder brief risk remains visible"],
            nextValidationActions: ["Review residual risks before implementation."]
          },
          exportMetadata: {
            format: "markdown",
            filename: "founder-brief.md",
            preparedAt: "2026-05-06T00:04:00.000Z",
            writePolicy: "metadata_only_no_file_write",
            blockedSideEffects: ["file_write"]
          }
        }
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready",
      finalArtifact: {
        residualRiskRegister: expect.arrayContaining([
          expect.objectContaining({
            riskId: "research risk remains visible",
            sourceRefs: [
              expect.objectContaining({
                sourceType: "known_risk"
              })
            ]
          }),
          expect.objectContaining({
            riskId: "founder brief risk remains visible",
            sourceRefs: [
              expect.objectContaining({
                sourceType: "known_risk"
              })
            ]
          })
        ])
      }
    });
  });

  it("keeps open questions visible in the final residual risk register", () => {
    const openQuestionId = "queue_open_question" as QueueItemId;
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs()
      }),
      {
        ...baseReadyState(),
        openIssues: [
          {
            queueItemId: openQuestionId,
            summary: "MVP scope edge case remains open",
            status: "open",
            questionText: "Should this edge case stay out of scope for the next slice?"
          }
        ]
      }
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "planning_ready",
      finalArtifact: {
        residualRiskRegister: expect.arrayContaining([
          expect.objectContaining({
            riskId: `open_question_${openQuestionId}`,
            riskClass: "mvp_scope_non_scope",
            sourceRefs: [
              expect.objectContaining({
                sourceType: "open_question",
                sourceId: openQuestionId
              })
            ]
          })
        ])
      }
    });
  });

  it("derives artifact identity from normalized handoff inputs instead of raw command idempotency", () => {
    const firstReduction = reduceProductEngineCommand(
      planningHandoffCommand(
        {
          sourceRefs: readySourceRefs()
        },
        {
          idempotencyKey: "caller-retry-a"
        }
      ),
      baseReadyState()
    );
    const secondReduction = reduceProductEngineCommand(
      planningHandoffCommand(
        {
          sourceRefs: [...readySourceRefs()].reverse()
        },
        {
          idempotencyKey: "caller-retry-b"
        }
      ),
      baseReadyState()
    );

    expect(firstReduction.accepted).toBe(true);
    expect(secondReduction.accepted).toBe(true);
    expect(firstReduction.deterministicOutputs[0]?.outputRef).toEqual(
      secondReduction.deterministicOutputs[0]?.outputRef
    );
  });

  it("changes artifact identity when the requested planning scope changes", () => {
    const firstReduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs(),
        requestedScope: {
          productSlice: "Planning Handoff Ready Spec",
          userFacingJourneyLabel: "Planning-ready",
          nonGoals: ["controlled execution"],
          excludedInternalPhases: ["phase3_controlled_execution"],
          assumptions: ["No execution authority."]
        }
      }),
      baseReadyState()
    );
    const secondReduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs(),
        requestedScope: {
          productSlice: "Narrowed Planning Handoff Ready Spec",
          userFacingJourneyLabel: "Planning-ready",
          nonGoals: ["controlled execution"],
          excludedInternalPhases: ["phase3_controlled_execution"],
          assumptions: ["No execution authority."]
        }
      }),
      baseReadyState()
    );

    expect(firstReduction.accepted).toBe(true);
    expect(secondReduction.accepted).toBe(true);
    expect(firstReduction.deterministicOutputs[0]?.outputRef).not.toEqual(
      secondReduction.deterministicOutputs[0]?.outputRef
    );
  });

  it.each([
    ["shellCommand", { shellCommand: "pnpm build" }],
    ["shell_command", { shell_command: "pnpm build" }],
    ["browserInstructions", { browserInstructions: "click deploy" }],
    ["deploy", { deploy: "production" }],
    ["apiKey", { apiKey: "secret" }],
    ["token", { token: "secret" }],
    ["command", { command: "apply patch" }],
    ["destinationPath", { destinationPath: "/tmp/out" }]
  ] as const)("rejects CreatePlanningHandoff payloads that include unsupported %s intent", (_label, extraPayload) => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs(),
        ...extraPayload
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringContaining("must only include")
    });
  });

  it("rejects CreatePlanningHandoff requestedScope objects that include unsupported nested keys", () => {
    const reduction = reduceProductEngineCommand(
      planningHandoffCommand({
        sourceRefs: readySourceRefs(),
        requestedScope: {
          productSlice: "Planning Handoff Ready Spec",
          userFacingJourneyLabel: "Planning-ready",
          nonGoals: ["controlled execution"],
          excludedInternalPhases: ["phase3_controlled_execution"],
          assumptions: ["No execution authority."],
          deployTarget: "production"
        }
      }),
      baseReadyState()
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "VALIDATION_FAILED",
      message: expect.stringContaining("requestedScope is invalid")
    });
  });

  it.each([
    "PlanningHandoffArtifact",
    "PlanningHandoffArtifactDto",
    "planning-ready-artifact",
    "PlanningHandoffProjection",
    "final_handoff"
  ])("blocks ConvertRuntimeArtifact from escalating a preview into %s", (target) => {
    const runtimeArtifactId = "runtime_artifact_planning_note" as RuntimeArtifactId;
    const reduction = reduceProductEngineCommand(
      runtimeConversionCommand({
        artifactId: runtimeArtifactId,
        target
      }),
      {
        ...baseReadyState(),
        runtimeState: {
          kind: "RuntimeActivityProjection",
          version: READY_PROJECTION_VERSION,
          runtimeStatus: "available",
          effects: [],
          runtimeArtifacts: [
            {
              artifactId: runtimeArtifactId,
              turnPurpose: "implementation_plan_preview",
              kind: "ImplementationPlanPreviewArtifact",
              applyPolicy: "note_only",
              status: "preview_ready",
              source: "protocol_fixture",
              targetObject: "PlanningNote",
              summary: "Preview-only planning note",
              payload: {
                title: "Preview-only planning note",
                body: "This cannot become a final handoff.",
                targetObject: "PlanningNote",
                sourceRefs: [SPEC_VERSION_REF]
              },
              sourceRefs: [SPEC_VERSION_REF],
              contextHash: "ctx_planning_note",
              runtimeAdapterVersion: "codex-app-server-preview-v1",
              createdAt: "2026-05-06T00:09:00.000Z",
              schemaVersion: CONTRACT_SCHEMA_VERSION
            }
          ]
        }
      }
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "RUNTIME_ACTION_BLOCKED",
      message: expect.stringContaining("cannot create a final PlanningHandoffArtifact")
    });
  });
});
