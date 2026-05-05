import { describe, expect, it } from "vitest";
import type {
  ProjectionVersion,
  QueueItemId,
  ResearchResultId,
  ResearchRunId,
  ResearchTaskId,
  SessionId
} from "@solo-superman/contracts";
import {
  addResearchResultToProjection,
  buildDecisionEvidencePack,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  synthesizeEvidenceMatrix
} from "./index";

const sessionId = "sess_quality_gate" as SessionId;

function task(overrides: Partial<Parameters<typeof planResearchTask>[0]> = {}) {
  return planResearchTask({
    researchTaskId: "research_task_quality_gate" as ResearchTaskId,
    sessionId,
    objective: "Validate paid founder urgency",
    routeOutcome: "missing_con_evidence",
    impact: "high",
    sourceQueueItemId: "queue_quality_gate" as QueueItemId,
    createdAt: "2026-05-05T00:00:00.000Z",
    ...overrides
  });
}

function result(overrides: Partial<Parameters<typeof importResearchResult>[0]> = {}) {
  return importResearchResult({
    researchResultId: "research_result_quality_gate" as ResearchResultId,
    researchTaskId: "research_task_quality_gate" as ResearchTaskId,
    researchRunId: "research_run_quality_gate" as ResearchRunId,
    result: "Pro: founders report urgency. Con: replacement workflows may already be good enough.",
    limitationNotes: "Manual import still needs source breadth review.",
    sourceReliability: "medium",
    claim: "Founders have urgent paid demand.",
    decisionContext: "problem",
    specSectionRef: "spec:problem",
    questionRef: "queue_quality_gate",
    implicationScope: "Supports review only; do not update SpecVersion automatically.",
    importedAt: "2026-05-05T00:01:00.000Z",
    ...overrides
  });
}

describe("Decision-linked research quality gate", () => {
  it("accepts balanced evidence into a decision-linked Evidence Pack", () => {
    const researchTask = task();
    const researchResult = result();
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(matrix).toMatchObject({ balanceStatus: "balanced", decisionBlocked: false });
    expect(pack).toMatchObject({
      gateStatus: "accepted",
      researchRunId: "research_run_quality_gate",
      claim: "Founders have urgent paid demand.",
      decisionContext: "problem",
      specSectionRef: "spec:problem",
      questionRef: "queue_quality_gate",
      proEvidenceItemIds: [expect.stringContaining("evidence_pro")],
      conEvidenceItemIds: [expect.stringContaining("evidence_con")]
    });
  });

  it("keeps gate-unknown evidence in needs_review with an explicit reason", () => {
    const researchTask = task();
    const researchResult = result({
      sourceReliability: "unknown"
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });
    const projection = addResearchResultToProjection(
      emptyResearchEvidenceProjection(),
      researchTask,
      researchResult,
      matrix,
      pack,
      1 as ProjectionVersion
    );

    expect(pack.gateStatus).toBe("needs_review");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source_metadata",
          status: "unknown",
          reason: expect.stringContaining("insufficient")
        })
      ])
    );
    expect(projection.tasks[0]).toMatchObject({ status: "needs_review" });
    expect(projection.reviewCards[0]).toMatchObject({
      state: "quality_gate_review",
      gateStatus: "needs_review",
      reviewReason: expect.stringContaining("insufficient")
    });
  });

  it("fails high-impact pro-only evidence as explicit research_insufficient instead of decision-ready", () => {
    const researchTask = task();
    const researchResult = result({
      result: "Pro: founders report urgency and willingness to pay.",
      limitationNotes: "No counter-evidence source was found in this import."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(matrix).toMatchObject({
      balanceStatus: "missing_con_evidence",
      decisionBlocked: true,
      missingConEvidenceReason: expect.stringContaining("No counter-evidence")
    });
    expect(pack).toMatchObject({
      gateStatus: "research_insufficient",
      knownRisk: expect.stringContaining("missing_con_evidence"),
      nextValidationAction: expect.stringContaining("Review or supplement")
    });
  });

  it("prioritizes failed high-impact evidence over secondary unknown checks", () => {
    const researchTask = task();
    const researchResult = result({
      result: "Pro: founders report urgency and willingness to pay.",
      sourceReliability: "unknown",
      limitationNotes: "No counter-evidence source was found in this import."
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });
    const projection = addResearchResultToProjection(
      emptyResearchEvidenceProjection(),
      researchTask,
      researchResult,
      matrix,
      pack,
      1 as ProjectionVersion
    );

    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "source_metadata", status: "unknown" }),
        expect.objectContaining({ code: "pro_con_balance", status: "failed" })
      ])
    );
    expect(pack.gateStatus).toBe("research_insufficient");
    expect(projection.reviewCards[0]).toMatchObject({
      state: "research_insufficient",
      reviewReason: expect.stringContaining("High-impact claim")
    });
  });

  it("does not mark balanced evidence ready when a high-impact source reliability gate fails", () => {
    const researchTask = task();
    const researchResult = result({
      sourceReliability: "low"
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });
    const projection = addResearchResultToProjection(
      emptyResearchEvidenceProjection(),
      researchTask,
      researchResult,
      matrix,
      pack,
      1 as ProjectionVersion
    );

    expect(matrix).toMatchObject({
      balanceStatus: "balanced",
      decisionBlocked: false
    });
    expect(pack.gateStatus).toBe("research_insufficient");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "source_reliability",
          status: "failed"
        })
      ])
    );
    expect(projection.tasks[0]).toMatchObject({ status: "research_insufficient" });
    expect(projection.reviewCards[0]).toMatchObject({
      state: "research_insufficient",
      gateStatus: "research_insufficient",
      reviewReason: expect.stringContaining("Low-reliability source")
    });
  });

  it("marks stale-sensitive evidence stale when the source predates the freshness requirement", () => {
    const researchTask = task();
    const researchResult = result({
      staleSensitive: true,
      sourcePublishedAt: "2026-05-01T00:00:00.000Z",
      sourceRequiredAfter: "2026-05-04T00:00:00.000Z"
    });
    const matrix = synthesizeEvidenceMatrix({ researchTask, researchResult, synthesisVersion: 1 });
    const pack = buildDecisionEvidencePack({ researchTask, researchResult, synthesisVersion: 1, matrix });

    expect(pack.gateStatus).toBe("stale");
    expect(pack.gateChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "staleness",
          status: "failed"
        })
      ])
    );
  });
});
