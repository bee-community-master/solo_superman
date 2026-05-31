import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
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
        summary: "Supporting signal backs the claim."
      }
    ],
    conEvidence:
      balanceStatus === "balanced"
        ? [
            {
              evidenceItemId: `evidence_con_${id}` as EvidenceItemId,
              kind: "con",
              summary: "Counterpoint identifies the risk."
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
    project: {
      ...createInitialProductEngineState(projectId, sessionId).project,
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "사업화 검증 중심",
      projectPurposeModeReason: "Test fixture confirms business purpose mode.",
      businessCriticIntensity: "balanced",
      businessCriticIntensitySelectionStatus: "confirmed",
      businessCriticIntensityLabel: "균형형 사업 검증",
      businessCriticIntensityEffect: "주요 판단 영역마다 최소 1개의 다른 관점 질문을 유지합니다.",
      businessCriticIntensityAudit: []
    },
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

  it("allows completion when most readiness metrics are concrete even if one section metric is weak", () => {
    const mostlyConcreteState = {
      ...completeState(),
      currentSpec: {
        ...completeState().currentSpec,
        sections: [
          "Problem Statement",
          "Value Proposition",
          "MVP Scope",
          "Success Criteria"
        ]
      }
    };
    const projection = buildConfidenceCompletionProjection(mostlyConcreteState, 13 as ProjectionVersion);
    const confidenceAxesGate = projection.gates.find((gate) => gate.gateId === "confidence_axes");
    const readyScoreMetricCount = Object.values(projection.scoreBreakdown).filter((score) => score >= 75).length;
    const readyAxisCount = projection.axes.filter((axis) => axis.score >= 75).length;

    expect(projection.scoreBreakdown.sectionCompleteness).toBeLessThan(75);
    expect(readyScoreMetricCount).toBe(4);
    expect(readyAxisCount).toBe(4);
    expect(projection.compositeScore).toBeGreaterThanOrEqual(85);
    expect(confidenceAxesGate).toMatchObject({
      label: "Most confidence axes are 75 or higher",
      passed: true
    });
    expect(projection.completionCandidate.status).toBe("candidate");
  });

  it("blocks implementation when a core ambiguity dimension is still below the floor despite strong aggregate scores", () => {
    const scopeAmbiguousState = {
      ...completeState(),
      currentSpec: {
        ...completeState().currentSpec,
        sections: completeSections.filter((section) => section !== "MVP Scope")
      }
    };
    const projection = buildConfidenceCompletionProjection(scopeAmbiguousState, 13 as ProjectionVersion);

    expect(projection.compositeScore).toBeGreaterThanOrEqual(85);
    expect(projection.axes.filter((axis) => axis.score >= 75)).toHaveLength(5);
    expect(projection.ambiguityDimensionCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimension: "scope",
          requiredForImplementation: true,
          score: expect.any(Number)
        })
      ])
    );
    expect(projection.ambiguityDimensionCoverage?.find((dimension) => dimension.dimension === "scope")?.score).toBeLessThan(75);
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "ambiguity_dimension_floor",
          label: "Core ambiguity dimensions are 75 or higher",
          passed: false,
          blockingReason: expect.stringContaining("Scope/non-goal clarity")
        })
      ])
    );
    expect(projection.completionCandidate.status).toBe("not_ready");
  });

  it("blocks strong and investor-grade completion pressure until carried as Known Risk", () => {
    const strongOpenProjection = buildConfidenceCompletionProjection(
      {
        ...completeState(),
        project: {
          ...completeState().project,
          businessCriticIntensity: "strong",
          businessCriticIntensityLabel: "강한 사업 검증"
        },
        openIssues: [
          {
            queueItemId: "queue_strong_pressure" as QueueItemId,
            topicKey: "strong_paid_intent_core_assumption",
            businessCriticCategory: "paid_intent",
            businessCriticIntensityMinimum: "strong",
            businessCriticPressureKind: "core_assumption_challenge",
            summary: "유료 의향 핵심 가설이 반박 질문 없이 남아 있음",
            status: "open",
            questionText: "사용자가 돈을 내지 않을 가장 강한 이유는 무엇인가?"
          }
        ]
      },
      13 as ProjectionVersion
    );
    const investorOpenProjection = buildConfidenceCompletionProjection(
      {
        ...completeState(),
        project: {
          ...completeState().project,
          businessCriticIntensity: "investor_grade",
          businessCriticIntensityLabel: "꼼꼼한 사업 검증"
        },
        openIssues: [
          {
            queueItemId: "queue_investor_pressure" as QueueItemId,
            topicKey: "investor_pricing_pressure",
            businessCriticCategory: "pricing",
            businessCriticIntensityMinimum: "investor_grade",
            businessCriticPressureKind: "investor_pressure_pass",
            summary: "가격 검증 pressure item이 닫히지 않음",
            status: "open",
            questionText: "어떤 가격에서 누가 거절할 것인가?"
          }
        ]
      },
      13 as ProjectionVersion
    );
    const investorKnownRiskProjection = buildConfidenceCompletionProjection(
      {
        ...completeState(),
        project: {
          ...completeState().project,
          businessCriticIntensity: "investor_grade",
          businessCriticIntensityLabel: "꼼꼼한 사업 검증"
        },
        openIssues: [
          {
            queueItemId: "queue_investor_pressure" as QueueItemId,
            topicKey: "investor_pricing_pressure",
            businessCriticCategory: "pricing",
            businessCriticIntensityMinimum: "investor_grade",
            businessCriticPressureKind: "investor_pressure_pass",
            knownRiskAccepted: true,
            nextValidationAction: "Run a price sensitivity smoke test.",
            summary: "가격 검증 pressure item이 닫히지 않음",
            status: "deferred",
            questionText: "어떤 가격에서 누가 거절할 것인가?"
          }
        ]
      },
      13 as ProjectionVersion
    );
    const investorCoreChallengeProjection = buildConfidenceCompletionProjection(
      {
        ...completeState(),
        project: {
          ...completeState().project,
          businessCriticIntensity: "investor_grade",
          businessCriticIntensityLabel: "꼼꼼한 사업 검증"
        },
        openIssues: [
          {
            queueItemId: "queue_investor_core_pressure" as QueueItemId,
            topicKey: "strong_paid_intent_core_assumption",
            businessCriticCategory: "paid_intent",
            businessCriticIntensityMinimum: "strong",
            businessCriticPressureKind: "core_assumption_challenge",
            summary: "유료 의향 핵심 가설이 반박 질문 없이 남아 있음",
            status: "open",
            questionText: "사용자가 돈을 내지 않을 가장 강한 이유는 무엇인가?"
          }
        ]
      },
      13 as ProjectionVersion
    );

    expect(strongOpenProjection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "business_critic_pressure",
          passed: false,
          blockingReason: expect.stringContaining("core-assumption")
        })
      ])
    );
    expect(strongOpenProjection.completionCandidate.status).toBe("not_ready");
    expect(investorOpenProjection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "business_critic_pressure",
          passed: false,
          blockingReason: expect.stringContaining("pricing")
        })
      ])
    );
    expect(investorOpenProjection.completionCandidate.status).toBe("not_ready");
    expect(investorCoreChallengeProjection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "business_critic_pressure",
          passed: false,
          blockingReason: expect.stringContaining("paid_intent")
        })
      ])
    );
    expect(investorKnownRiskProjection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "business_critic_pressure",
          passed: true
        })
      ])
    );
  });

  it("lets personal workflow projects complete without market-size, investor, or willingness-to-pay gates", () => {
    const state = {
      ...completeState(),
      project: {
        ...completeState().project,
        projectPurposeMode: "personal" as const,
        projectPurposeModeSelectionStatus: "confirmed" as const,
        projectPurposeModeLabel: "개인 작업 흐름 구현 중심",
        projectPurposeModeReason: "User confirmed personal workflow mode.",
        projectPurposeModeAudit: []
      },
      currentSpec: {
        ...completeState().currentSpec,
        title: "Personal Workflow Helper",
        sections: [
          "Workflow",
          "Frequency",
          "Input",
          "Output",
          "GUI",
          "Implementation Feasibility",
          "Local Data",
          "Security",
          "Maintainability",
          "Success Criteria"
        ]
      },
      researchState: {
        ...completeState().researchState,
        nextValidationActions: ["Run the tool on three repeated personal workflow examples."]
      }
    };
    const projection = buildConfidenceCompletionProjection(state, 13 as ProjectionVersion);
    const serialized = JSON.stringify({
      gateFailures: projection.completionCandidate.gateFailures,
      nextBestActions: projection.nextBestActions,
      projectPurposeModeEffect: projection.projectPurposeModeEffect
    }).toLowerCase();

    expect(projection.projectPurposeMode).toBe("personal");
    expect(projection.completionCandidate.status).toBe("candidate");
    expect(serialized).not.toContain("market size");
    expect(serialized).not.toContain("investor");
    expect(serialized).not.toContain("willingness to pay");
    expect(projection.skippedCommercializationAxes).toEqual(
      expect.arrayContaining(["market_size", "investor_narrative", "willingness_to_pay"])
    );
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

  it("blocks completion when an implementation step ledger has started but is not closed out", () => {
    const step = IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE.steps[0]!;
    const blockedImplementationStep = {
      ...step,
      status: "blocked" as const,
      missingEvidence: ["passing TestEvidenceRecord without failed tests or Not-tested gaps"],
      blocker: {
        stepId: step.stepDoc.stepId,
        reason: "Implementation verification is not clean yet.",
        missingEvidence: ["passing TestEvidenceRecord without failed tests or Not-tested gaps"],
        nextRequiredAction: "Fix implementation tests and record passing evidence.",
        evidenceRefs: ["test:failed"]
      }
    };
    const projection = buildConfidenceCompletionProjection(
      {
        ...completeState(),
        implementationStepLedger: {
          ...IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE,
          currentStatus: "blocked",
          summary: "Implementation step ledger is blocked by missing or failed evidence.",
          steps: [blockedImplementationStep],
          blockedSteps: [blockedImplementationStep.blocker],
          progressReport:
            "Tracker: Demo implementation tracker\n1. Create deterministic ledger — blocked. Missing: passing TestEvidenceRecord without failed tests or Not-tested gaps."
        }
      },
      13 as ProjectionVersion
    );

    expect(projection.completionCandidate.status).toBe("not_ready");
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "implementation_closeout",
          passed: false,
          blockingReason: "Implementation step ledger is blocked: Implementation verification is not clean yet."
        })
      ])
    );
    expect(projection.topRiskCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskId: "risk_implementation_step_ledger",
          severity: "high",
          nextValidationAction: "Fix implementation tests and record passing evidence."
        })
      ])
    );
    expect(projection.topRisks).toEqual(
      expect.arrayContaining([
        "Implementation step ledger is blocked: Implementation verification is not clean yet."
      ])
    );
  });

  it("allows completion when a started implementation step ledger is closed out", () => {
    const projection = buildConfidenceCompletionProjection(
      {
        ...completeState(),
        implementationStepLedger: IMPLEMENTATION_STEP_LEDGER_READY_FIXTURE
      },
      13 as ProjectionVersion
    );

    expect(projection.completionCandidate.status).toBe("candidate");
    expect(projection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gateId: "implementation_closeout",
          passed: true
        })
      ])
    );
    expect(projection.topRiskCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskId: "risk_implementation_step_ledger"
        })
      ])
    );
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
