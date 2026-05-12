import { describe, expect, it } from "vitest";
import type {
  CommandId,
  CorrelationId,
  ProjectId,
  SchemaVersion,
  StateVersion
} from "../ids";
import { PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE, PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE } from "../projections";
import type {
  ProductEngineDeterministicOutput,
  ProductEngineReduction
} from "./reduction";

describe("ProductEngine reduction contract surface", () => {
  it("allows Planning Handoff as a deterministic output and immediate projection", () => {
    const output = {
      outputType: "planning_handoff_artifact",
      outputRef: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.artifactId,
      payload: {
        artifactKind: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.kind,
        verdict: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.gateVerdict.verdict
      }
    } satisfies ProductEngineDeterministicOutput;

    const reduction = {
      accepted: true,
      events: [
        {
          eventType: "PlanningHandoffCreated",
          projectId: "project_demo_001" as ProjectId,
          sessionId: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.sessionId,
          sourceCommandId: "cmd_planning_handoff_001" as CommandId,
          correlationId: "corr_planning_handoff_001" as CorrelationId,
          causationId: null,
          schemaVersion: "solo-superman.product-engine-event.v1" as SchemaVersion,
          payload: {
            artifactId: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.artifactId,
            verdict: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.gateVerdict.verdict
          }
        }
      ],
      nextState: { stateVersionAfter: 43 as StateVersion },
      effectPlan: [],
      deterministicOutputs: [output],
      immediateProjection: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE
    } satisfies ProductEngineReduction;

    expect(reduction.deterministicOutputs).toEqual([expect.objectContaining({ outputType: "planning_handoff_artifact" })]);
    expect(reduction.immediateProjection?.kind).toBe("PlanningHandoffProjection");
    expect(reduction.effectPlan).toEqual([]);
  });

  it("allows Phase 2.5 comparison as deterministic output and immediate projection", () => {
    const output = {
      outputType: "phase25_research_comparison_report",
      outputRef: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact.artifactId,
      payload: {
        status: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.currentStatus,
        verdict: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact.delegationRiskGate.verdict
      }
    } satisfies ProductEngineDeterministicOutput;

    const reduction = {
      accepted: true,
      events: [
        {
          eventType: "Phase25ResearchComparisonCreated",
          projectId: "project_demo_001" as ProjectId,
          sessionId: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.sessionId,
          sourceCommandId: "cmd_phase25_001" as CommandId,
          correlationId: "corr_phase25_001" as CorrelationId,
          causationId: null,
          schemaVersion: "solo-superman.product-engine-event.v1" as SchemaVersion,
          payload: {
            artifactId: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact.artifactId,
            verdict: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact.delegationRiskGate.verdict
          }
        }
      ],
      nextState: { stateVersionAfter: 44 as StateVersion },
      effectPlan: [],
      deterministicOutputs: [output],
      immediateProjection: PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE
    } satisfies ProductEngineReduction;

    expect(reduction.deterministicOutputs).toEqual([
      expect.objectContaining({ outputType: "phase25_research_comparison_report" })
    ]);
    expect(reduction.immediateProjection?.kind).toBe("Phase25ResearchComparisonProjection");
  });

});
