import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
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
