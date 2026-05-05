import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type ConfidenceCompletionProjection,
  type CorrelationId,
  type DecisionId,
  type EventId,
  type EvidenceItemId,
  type EvidenceMatrixProjection,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type RequiredDecisionRef,
  type ResearchResultId,
  type ResearchTaskId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createInitialProductEngineState,
  reduceProductEngineCommand,
  replayProductEngineEvents
} from "../product-engine";
import { buildConfidenceCompletionProjection } from "./index";

const projectId = "proj_completeness_test" as ProjectId;
const sessionId = "sess_completeness_test" as SessionId;
const correlationId = "corr_completeness_test" as CorrelationId;
const now = "2026-05-05T00:00:00.000Z";

const completeSections = [
  "Problem Statement",
  "Target Customer",
  "Value Proposition",
  "Alternatives/Competition",
  "Evidence Matrix",
  "Validation Plan",
  "MVP Scope",
  "Success Criteria"
] as const;
const requiredDecisionRefs: readonly RequiredDecisionRef[] = [
  "primary_customer",
  "problem",
  "value",
  "mvp_scope",
  "validation_plan",
  "success_criteria"
];
const successCriteriaDecisionRef: RequiredDecisionRef = "success_criteria";

function matrix(
  id: string,
  balanceStatus: EvidenceMatrixProjection["balanceStatus"],
  decisionBlocked = false
): EvidenceMatrixProjection {
  return {
    evidenceMatrixId: id,
    researchTaskId: `research_task_${id}` as ResearchTaskId,
    researchResultId: `research_result_${id}` as ResearchResultId,
    synthesisVersion: 1,
    proEvidence: [
      {
        evidenceItemId: `evidence_pro_${id}` as EvidenceItemId,
        kind: "pro",
        summary: "Pro evidence supports the claim."
      }
    ],
    conEvidence:
      balanceStatus === "balanced"
        ? [
            {
              evidenceItemId: `evidence_con_${id}` as EvidenceItemId,
              kind: "con",
              summary: "Con evidence identifies the counter-risk."
            }
          ]
        : [],
    uncertainties: [
      {
        evidenceItemId: `evidence_uncertainty_${id}` as EvidenceItemId,
        kind: "uncertainty",
        summary: "Remaining uncertainty is explicit."
      }
    ],
    additionalQuestions: [`Validate ${id} with a customer interview.`],
    balanceStatus,
    decisionBlocked,
    ...(decisionBlocked ? { knownRisk: `Evidence remains ${balanceStatus} for ${id}.` } : {})
  };
}

function completeState(): ProductEngineStateSnapshot {
  return {
    ...createInitialProductEngineState(projectId, sessionId),
    stateVersion: 12 as StateVersion,
    currentSpec: {
      draftRef: "spec_draft_complete",
      versionRef: "spec_version_1",
      title: "Founder Brief Generator",
      sections: completeSections
    },
    openIssues: [],
    queueProjection: {
      kind: "DecisionQueueProjection" as const,
      version: 12 as ProjectionVersion,
      active: [],
      next: [],
      blocked: [],
      deferred: []
    },
    researchState: {
      kind: "ResearchEvidenceProjection" as const,
      version: 12 as ProjectionVersion,
      taskIds: [],
      tasks: [],
      results: [],
      evidenceMatrices: ["problem", "customer", "value", "validation", "mvp", "success"].map((id) =>
        matrix(id, "balanced")
      ),
      evidencePacks: [],
      reviewCards: [],
      knownRisks: [],
      nextValidationActions: [
        "Run five customer interviews.",
        "Validate willingness to pay with a concierge test."
      ],
      proConBalanceStatus: "balanced"
    },
    decisions: requiredDecisionRefs.map((requiredDecisionRef, index) => ({
      decisionId: `decision_${index + 1}` as DecisionId,
      requiredDecisionRef,
      status: "approved" as const
    })),
    specUpdatePreviews: [
      {
        previewRef: "spec_update_6",
        sourceRef: "evidence_success",
        decisionId: "decision_6" as DecisionId,
        requiredDecisionRef: successCriteriaDecisionRef,
        title: "Founder Brief Generator v1",
        sections: completeSections
      }
    ]
  };
}

function blockedState(): ProductEngineStateSnapshot {
  return {
    ...completeState(),
    stateVersion: 9 as StateVersion,
    openIssues: [
      {
        queueItemId: "queue_blocked_customer" as QueueItemId,
        summary: "Target customer urgency",
        status: "open" as const,
        questionText: "Which buyer has urgent pain?",
        sourceRef: "customer"
      }
    ],
    researchState: {
      ...completeState().researchState,
      evidenceMatrices: [matrix("high_impact_customer_claim", "missing_con_evidence", true)],
      knownRisks: ["Evidence remains missing_con_evidence for high_impact_customer_claim."],
      nextValidationActions: ["Import counter-evidence before completion."],
      proConBalanceStatus: "missing_con_evidence" as const
    },
    decisions: []
  };
}

function command(
  commandType: Parameters<typeof reduceProductEngineCommand>[0]["commandType"],
  expectedStateVersion: StateVersion,
  payload: Readonly<Record<string, unknown>> = {},
  actor: "user" | "effect_executor" = "user"
) {
  return {
    commandId: `cmd_${commandType}` as CommandId,
    commandType,
    projectId,
    sessionId,
    actor,
    issuedAt: now,
    idempotencyKey: `${commandType}:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

describe("PR-08 completeness scoring", () => {
  it("creates a deterministic spec-ready completion candidate when all gates pass", () => {
    const projection = buildConfidenceCompletionProjection(completeState(), 13 as ProjectionVersion);

    expect(projection.compositeScore).toBeGreaterThanOrEqual(85);
    expect(projection.readinessLabel).toBe("spec_ready");
    expect(projection.axes.every((axis) => axis.score >= 75)).toBe(true);
    expect(projection.gates.every((gate) => gate.passed)).toBe(true);
    expect(projection.completionCandidate.status).toBe("candidate");
    expect(projection.topRiskCards).toEqual([]);
  });

  it("carries open questions and missing con evidence into risk cards instead of hiding them", () => {
    const projection = buildConfidenceCompletionProjection(blockedState(), 10 as ProjectionVersion);

    expect(projection.completionCandidate.status).toBe("not_ready");
    expect(projection.topRisks).toEqual(
      expect.arrayContaining([
        "Evidence remains missing_con_evidence for high_impact_customer_claim.",
        "Open question remains: Target customer urgency"
      ])
    );
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "question_debt",
          passed: false
        }),
        expect.objectContaining({
          gateId: "evidence_balance",
          passed: false
        })
      ])
    );
  });

  it("blocks completion when missing con evidence is not separately marked decisionBlocked", () => {
    const state = {
      ...completeState(),
      researchState: {
        ...completeState().researchState,
        evidenceMatrices: [
          ...["problem", "customer", "value", "validation", "mvp"].map((id) => matrix(id, "balanced")),
          {
            ...matrix("pricing_counter_evidence", "missing_con_evidence"),
            missingConEvidenceReason: "No counter-evidence exists for pricing willingness."
          }
        ],
        knownRisks: [],
        nextValidationActions: ["Run a skeptical pricing search."]
      }
    };
    const projection = buildConfidenceCompletionProjection(state, 13 as ProjectionVersion);

    expect(projection.compositeScore).toBeGreaterThanOrEqual(85);
    expect(projection.completionCandidate.status).toBe("not_ready");
    expect(projection.topRiskCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "high",
          title: "No counter-evidence exists for pricing willingness."
        })
      ])
    );
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "evidence_balance",
          passed: false
        })
      ])
    );
  });

  it("does not treat balanced evidence as a substitute for approved decisions", () => {
    const state = {
      ...completeState(),
      decisions: []
    };
    const projection = buildConfidenceCompletionProjection(state, 13 as ProjectionVersion);

    expect(projection.completionCandidate.status).toBe("not_ready");
    expect(projection.scoreBreakdown.evidenceQuality).toBeGreaterThanOrEqual(80);
    expect(projection.scoreBreakdown.decisionApproval).toBe(0);
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "required_decisions",
          passed: false
        })
      ])
    );
  });

  it("requires full required-decision coverage rather than unrelated risk carry-forward", () => {
    const state = {
      ...completeState(),
      decisions: [
        ...requiredDecisionRefs.slice(0, 5).map((requiredDecisionRef, index) => ({
          decisionId: `decision_${index + 1}` as DecisionId,
          requiredDecisionRef,
          status: "approved" as const
        })),
        {
          decisionId: "decision_6" as DecisionId,
          requiredDecisionRef: successCriteriaDecisionRef,
          status: "active" as const
        }
      ],
      researchState: {
        ...completeState().researchState,
        knownRisks: ["Unrelated implementation risk is explicitly visible."],
        nextValidationActions: ["Validate the unrelated implementation risk."]
      }
    };
    const projection = buildConfidenceCompletionProjection(state, 13 as ProjectionVersion);

    expect(projection.scoreBreakdown.decisionApproval).toBeGreaterThanOrEqual(75);
    expect(projection.completionCandidate.status).toBe("not_ready");
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "required_decisions",
          passed: false
        })
      ])
    );
  });

  it("does not count duplicate required-decision refs as full decision coverage", () => {
    const state = {
      ...completeState(),
      decisions: Array.from({ length: 6 }, (_, index) => ({
        decisionId: `decision_duplicate_${index + 1}` as DecisionId,
        requiredDecisionRef: "primary_customer" as const,
        status: "approved" as const
      }))
    };
    const projection = buildConfidenceCompletionProjection(state, 13 as ProjectionVersion);

    expect(projection.scoreBreakdown.decisionApproval).toBeLessThan(100);
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "required_decisions",
          passed: false
        })
      ])
    );
  });

  it("keeps accepted-risk decisions in known risks even when visual risk cards are capped", () => {
    const state = {
      ...completeState(),
      decisions: requiredDecisionRefs.map((requiredDecisionRef, index) => ({
        decisionId: `decision_${index + 1}` as DecisionId,
        requiredDecisionRef,
        status: index === 5 ? ("risk_accepted" as const) : ("approved" as const)
      })),
      researchState: {
        ...completeState().researchState,
        evidenceMatrices: [
          ...completeState().researchState.evidenceMatrices,
          matrix("extra_runtime_like_risk_1", "missing_con_evidence"),
          matrix("extra_runtime_like_risk_2", "missing_con_evidence"),
          matrix("extra_runtime_like_risk_3", "missing_con_evidence")
        ],
        knownRisks: ["A known research risk must remain visible."]
      }
    };
    const projection = buildConfidenceCompletionProjection(state, 13 as ProjectionVersion);

    expect(projection.topRiskCards).toHaveLength(3);
    expect(projection.topRisks).toEqual(
      expect.arrayContaining([
        "A known research risk must remain visible.",
        "Accepted risk carried forward for success_criteria: decision_6"
      ])
    );
  });

  it("emits completeness_snapshot and confidence_map as reducer deterministic outputs without async effects", () => {
    const state = completeState();
    const reduction = reduceProductEngineCommand(command("ScoreCompleteness", state.stateVersion), state);

    expect(reduction.accepted).toBe(true);
    expect(reduction.events).toMatchObject([
      {
        eventType: "CompletenessScored",
        payload: {
          candidateStatus: "candidate"
        }
      }
    ]);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.deterministicOutputs.map((output) => output.outputType)).toEqual([
      "completeness_snapshot",
      "confidence_map"
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "ConfidenceCompletionProjection",
      completionCandidate: {
        status: "candidate"
      }
    });
  });

  it("rejects explicit completion-candidate creation when guardrail gates fail", () => {
    const state = blockedState();
    const reduction = reduceProductEngineCommand(
      command("ScoreCompleteness", state.stateVersion, { candidateRequested: true }),
      state
    );

    expect(reduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "COMMAND_PRECONDITION_FAILED",
        details: {
          completionCandidate: expect.objectContaining({
            status: "not_ready"
          }),
          gates: expect.any(Array),
          topRisks: expect.any(Array)
        }
      },
      events: [],
      effectPlan: []
    });
    expect(reduction.rejectionReason?.message).toContain("Completion candidate gates failed");
  });

  it("recomputes completeness when a blocked runtime incident is added", () => {
    const state = completeState();
    const reduction = reduceProductEngineCommand(
      command(
        "CreateRuntimePreview",
        state.stateVersion,
        {
          turnPurpose: "spec_update_preview",
          contextHash: "ctx_blocked_runtime_completion",
          prompt: "Preview a spec update but do not apply the file patch.",
          sourceRefs: ["spec_current"],
          source: "protocol_fixture",
          blockedActionType: "file_patch",
          blockedActionReason: "File patch execution is forbidden in Phase 1."
        },
        "effect_executor"
      ),
      state
    );
    const completeness = reduction.nextState.completeness as ConfidenceCompletionProjection;

    expect(reduction.accepted).toBe(true);
    expect(reduction.events).toMatchObject([
      {
        eventType: "RuntimePreviewRequested",
        payload: {
          confidenceProjection: {
            completionCandidate: {
              status: "not_ready"
            }
          }
        }
      }
    ]);
    expect(completeness.completionCandidate.status).toBe("not_ready");
    expect(completeness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "blocking_incidents",
          passed: false
        })
      ])
    );
    expect(completeness.topRiskCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskId: "risk_runtime_1",
          severity: "high"
        })
      ])
    );
    expect(reduction.deterministicOutputs.map((output) => output.outputType)).toEqual([
      "reducer_deterministic_output",
      "completeness_snapshot",
      "confidence_map"
    ]);
  });

  it("updates and replays completeness after a decision is resolved", () => {
    const state = {
      ...completeState(),
      decisions: [
        ...requiredDecisionRefs.slice(0, 5).map((requiredDecisionRef, index) => ({
          decisionId: `decision_${index + 1}` as DecisionId,
          requiredDecisionRef,
          status: "approved" as const
        })),
        {
          decisionId: "decision_6" as DecisionId,
          requiredDecisionRef: successCriteriaDecisionRef,
          status: "active" as const
        }
      ],
      queueProjection: {
        ...completeState().queueProjection,
        next: [
          {
            queueItemId: "decision_card_decision_6" as QueueItemId,
            title: "Decision approval required: success_criteria",
            state: "next" as const
          }
        ]
      }
    };
    const reduction = reduceProductEngineCommand(
      command("ResolveDecision", state.stateVersion, {
        decisionId: "decision_6",
        outcome: "approved"
      }),
      state
    );
    const replayed = replayProductEngineEvents(projectId, sessionId, [
      {
        ...reduction.events[0]!,
        eventId: "evt_decision_resolved" as EventId,
        sequence: 13,
        occurredAt: now
      }
    ]);

    expect(reduction.accepted).toBe(true);
    expect(reduction.nextState).toMatchObject({
      completeness: {
        completionCandidate: {
          status: "candidate"
        }
      },
      queueProjection: {
        next: []
      }
    });
    expect(replayed.decisions).toEqual([
      {
        decisionId: "decision_6",
        requiredDecisionRef: "success_criteria",
        status: "approved"
      }
    ]);
    expect(replayed.queueProjection.next).toEqual([]);
    expect(replayed.completeness.version).toBe(13);
  });

  it("updates and replays completeness after a spec version is created", () => {
    const state = completeState();
    const reduction = reduceProductEngineCommand(
      command("CreateSpecVersion", state.stateVersion, {
        approvedPreviewRef: "spec_update_6",
        title: "Founder Brief Generator v1",
        sections: completeSections
      }),
      state
    );
    const replayed = replayProductEngineEvents(projectId, sessionId, [
      {
        ...reduction.events[0]!,
        eventId: "evt_spec_version_created" as EventId,
        sequence: 13,
        occurredAt: now
      }
    ]);

    expect(reduction.accepted).toBe(true);
    expect(reduction.nextState).toMatchObject({
      currentSpec: {
        title: "Founder Brief Generator v1"
      },
      completeness: {
        kind: "ConfidenceCompletionProjection"
      }
    });
    expect(replayed.currentSpec).toMatchObject({
      title: "Founder Brief Generator v1",
      versionRef: expect.stringMatching(/^spec_version_/)
    });
    expect(replayed.completeness.version).toBe(13);
  });

  it("rejects spec versions whose material differs from the approved preview", () => {
    const state = completeState();
    const reduction = reduceProductEngineCommand(
      command("CreateSpecVersion", state.stateVersion, {
        approvedPreviewRef: "spec_update_6",
        title: "Founder Brief Generator v1",
        sections: ["Different approved material"]
      }),
      state
    );

    expect(reduction.accepted).toBe(false);
    expect(reduction.rejectionReason).toMatchObject({
      code: "COMMAND_PRECONDITION_FAILED",
      message: "CreateSpecVersion sections must match the approved preview material."
    });
  });
});
