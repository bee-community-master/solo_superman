import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE,
  PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE,
  type CommandId,
  type EventId,
  type CorrelationId,
  type Phase25DelegationRiskGateDto,
  type Phase25ResearchComparisonProjection,
  type ProductEngineCommand,
  type ProductEngineEvent,
  type ProjectId,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import { createInitialProductEngineState, reduceProductEngineCommand, replayProductEngineEvents } from "./index";

const projectId = "proj_phase25_core" as ProjectId;
const sessionId = "sess_phase25_core" as SessionId;

function command(
  payload: ProductEngineCommand["payload"],
  expectedStateVersion: StateVersion = 0 as StateVersion
): ProductEngineCommand {
  return {
    commandId: `cmd_phase25_${expectedStateVersion}` as CommandId,
    commandType: "CreatePhase25ResearchComparison",
    projectId,
    sessionId,
    actor: "product_engine",
    issuedAt: "2026-05-12T00:00:00.000Z",
    idempotencyKey: `CreatePhase25ResearchComparison:${expectedStateVersion}`,
    expectedStateVersion,
    causationId: null,
    correlationId: "corr_phase25" as CorrelationId,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload
  };
}

function payloadFromFixture(
  projection = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE as Phase25ResearchComparisonProjection
) {
  const report = projection.artifact;

  return {
    researchQuestion: report.researchQuestion,
    decisionContext: report.decisionContext,
    sourceRefs: report.sourceRefs,
    baseline: report.baseline,
    candidate: report.candidate,
    delegationRiskGate: report.delegationRiskGate,
    rubric: report.rubric
  };
}

function withoutFallbackLane(
  gate: Phase25DelegationRiskGateDto
): Omit<Phase25DelegationRiskGateDto, "fallbackLane"> {
  return {
    verdict: gate.verdict,
    candidateLane: gate.candidateLane,
    checks: gate.checks,
    blockedReasons: gate.blockedReasons,
    noExecutionBoundary: gate.noExecutionBoundary,
    rationale: gate.rationale
  };
}

describe("CreatePhase25ResearchComparison reducer", () => {
  it("creates a deterministic quality-lift comparison report without effects", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const reduction = reduceProductEngineCommand(command(payloadFromFixture()), state);

    expect(reduction.accepted).toBe(true);
    expect(reduction.events).toEqual([
      expect.objectContaining({
        eventType: "Phase25ResearchComparisonCreated",
        payload: expect.objectContaining({
          artifactKind: "ResearchQualityComparisonReport",
          status: "quality_lift_ready",
          verdict: "allowed_for_comparative_preview"
        })
      })
    ]);
    expect(reduction.effectPlan).toEqual([]);
    expect(reduction.deterministicOutputs).toEqual([
      expect.objectContaining({
        outputType: "phase25_research_comparison_report",
        payload: expect.objectContaining({
          qualityLiftClaimed: true,
          candidateLane: "manual_prompt_handoff"
        })
      })
    ]);
    expect(reduction.immediateProjection).toMatchObject({
      kind: "Phase25ResearchComparisonProjection",
      currentStatus: "quality_lift_ready",
      artifact: {
        qualityLiftStatus: "material_quality_lift",
        noExecutionPolicy: "no_submit_write_credential_custody_or_live_browser_execution"
      }
    });
  });

  it("creates a safe-failure report when DelegationRiskGate blocks the candidate", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const reduction = reduceProductEngineCommand(command(payloadFromFixture(PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE)), state);

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "Phase25ResearchComparisonBlocked",
      payload: {
        status: "safe_failure_blocked",
        verdict: "blocked_by_session_custody"
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "safe_failure_blocked",
      artifact: {
        qualityLiftStatus: "safe_failure_no_lift",
        qualityLiftClaimed: false,
        delegationRiskGate: {
          blockedReasons: expect.arrayContaining(["Session custody is unresolved for ChatGPT Pro delegation."])
        }
      }
    });
  });

  it("downgrades pro-only candidate output to safe failure instead of valid quality lift", () => {
    const report = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const reduction = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        candidate: {
          ...report.candidate,
          conEvidence: [],
          uncertainties: []
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({ eventType: "Phase25ResearchComparisonBlocked" });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "safe_failure_blocked",
      artifact: {
        qualityLiftClaimed: false,
        delegationRiskGate: {
          verdict: "fallback_required",
          blockedReasons: expect.arrayContaining([
            "Candidate output is pro-only and lacks counter-evidence.",
            "Candidate output lacks explicit uncertainties."
          ])
        }
      }
    });
  });

  it("downgrades an allowed gate to safe failure when any DelegationRiskGate check blocks", () => {
    const report = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const reduction = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        delegationRiskGate: {
          ...report.delegationRiskGate,
          checks: report.delegationRiskGate.checks.map((check) =>
            check.checkName === "session_custody"
              ? {
                  ...check,
                  status: "block",
                  rationale: "Session custody is blocked and must force safe failure."
                }
              : check
          )
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "Phase25ResearchComparisonBlocked",
      payload: {
        status: "safe_failure_blocked",
        verdict: "fallback_required"
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "safe_failure_blocked",
      artifact: {
        qualityLiftClaimed: false,
        delegationRiskGate: {
          verdict: "fallback_required",
          blockedReasons: expect.arrayContaining([
            expect.stringContaining("DelegationRiskGate check session_custody is block")
          ])
        }
      }
    });
  });

  it("downgrades an allowed gate to safe failure when blockedReasons are present", () => {
    const report = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const reduction = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        delegationRiskGate: {
          ...report.delegationRiskGate,
          blockedReasons: ["Policy review requires manual fallback before quality lift can be claimed."]
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(reduction.accepted).toBe(true);
    expect(reduction.events[0]).toMatchObject({
      eventType: "Phase25ResearchComparisonBlocked",
      payload: {
        status: "safe_failure_blocked",
        verdict: "fallback_required"
      }
    });
    expect(reduction.immediateProjection).toMatchObject({
      currentStatus: "safe_failure_blocked",
      artifact: {
        qualityLiftClaimed: false,
        delegationRiskGate: {
          blockedReasons: expect.arrayContaining([
            "Policy review requires manual fallback before quality lift can be claimed."
          ])
        }
      }
    });
  });

  it("rejects malformed gate boundary and duplicate closed contract keys", () => {
    const report = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const malformedBoundary = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        delegationRiskGate: {
          ...report.delegationRiskGate,
          noExecutionBoundary: "metadata_only_no_execution"
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );
    const duplicateGateCheck = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        delegationRiskGate: {
          ...report.delegationRiskGate,
          checks: [...report.delegationRiskGate.checks, report.delegationRiskGate.checks[0]!]
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );
    const duplicateRubricDimension = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        rubric: [...report.rubric, report.rubric[0]!]
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(malformedBoundary).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "CreatePhase25ResearchComparison requires a valid DelegationRiskGate."
      }
    });
    expect(duplicateGateCheck).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("DelegationRiskGate checks must not duplicate checkName")
      }
    });
    expect(duplicateRubricDimension).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: expect.stringContaining("rubric must not duplicate quality dimensions")
      }
    });
  });

  it("rejects malformed source ref metadata instead of coercing it", () => {
    const report = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const malformedRequiredFlag = {
      ...report.sourceRefs[0],
      required: "yes"
    };
    const malformedSourceLabel = {
      ...report.sourceRefs[0],
      sourceLabel: 123
    };
    const invalidPayloadMessage =
      "CreatePhase25ResearchComparison requires a research question, decision context, baseline, candidate, rubric, and traceable sourceRefs.";
    const malformedRequiredReduction = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        sourceRefs: [malformedRequiredFlag]
      }),
      createInitialProductEngineState(projectId, sessionId)
    );
    const malformedLabelReduction = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(),
        sourceRefs: [malformedSourceLabel]
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(malformedRequiredReduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: invalidPayloadMessage
      }
    });
    expect(malformedLabelReduction).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: invalidPayloadMessage
      }
    });
  });

  it("rejects invalid fallback lanes instead of silently defaulting them", () => {
    const report = PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE.artifact;
    const invalidFallbackLane = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE),
        delegationRiskGate: {
          ...report.delegationRiskGate,
          fallbackLane: "browseruse_preview"
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );
    const gateWithoutFallbackLane = withoutFallbackLane(report.delegationRiskGate);
    const missingFallbackLane = reduceProductEngineCommand(
      command({
        ...payloadFromFixture(PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE),
        delegationRiskGate: {
          ...gateWithoutFallbackLane,
          verdict: "fallback_required"
        }
      }),
      createInitialProductEngineState(projectId, sessionId)
    );

    expect(invalidFallbackLane).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "CreatePhase25ResearchComparison requires a valid DelegationRiskGate."
      }
    });
    expect(missingFallbackLane).toMatchObject({
      accepted: false,
      rejectionReason: {
        code: "VALIDATION_FAILED",
        message: "CreatePhase25ResearchComparison requires a valid DelegationRiskGate."
      }
    });
  });

  it("replays Phase 2.5 comparison events back into state", () => {
    const state = createInitialProductEngineState(projectId, sessionId);
    const reduction = reduceProductEngineCommand(command(payloadFromFixture()), state);
    const draft = reduction.events[0];

    if (!draft) {
      throw new Error("Phase 2.5 reduction should emit one event");
    }

    const event: ProductEngineEvent = {
      ...draft,
      eventId: "evt_phase25_created" as EventId,
      sequence: 1,
      occurredAt: "2026-05-12T00:00:00.000Z"
    };

    const replayed = replayProductEngineEvents(projectId, sessionId, [event]);

    expect(replayed.phase25ResearchComparison).toMatchObject({
      kind: "Phase25ResearchComparisonProjection",
      currentStatus: "quality_lift_ready"
    });
  });
});
