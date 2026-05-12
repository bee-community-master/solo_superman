import { describe, expect, expectTypeOf, it } from "vitest";
import {
  PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE,
  PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE,
  phase25ResearchComparisonValidationIssues,
  validatePhase25ResearchComparisonProjection,
  validatePhase25ResearchComparisonReport
} from "./phase25-research-comparison";
import type {
  Phase25DelegationRiskGateDto,
  CreatePhase25ResearchComparisonPayload,
  Phase25ResearchCandidateAdapterPort,
  Phase25ResearchComparisonProjection,
  Phase25ResearchQualityComparisonReportDto
} from "./phase25-research-comparison";

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

describe("Phase 2.5 ResearchQualityComparisonReport contract", () => {
  it("keeps the closed artifact, gate, projection, and adapter-port field families exact", () => {
    expectTypeOf<keyof Phase25ResearchQualityComparisonReportDto>().toEqualTypeOf<
      | "artifactId"
      | "kind"
      | "schemaVersion"
      | "createdAt"
      | "createdBy"
      | "status"
      | "researchQuestion"
      | "decisionContext"
      | "candidateLane"
      | "sourceRefs"
      | "baseline"
      | "candidate"
      | "delegationRiskGate"
      | "rubric"
      | "qualityLiftStatus"
      | "qualityLiftClaimed"
      | "decisionImpactSummary"
      | "requiredFollowUps"
      | "noExecutionPolicy"
    >();
    expectTypeOf<keyof Phase25DelegationRiskGateDto>().toEqualTypeOf<
      | "verdict"
      | "candidateLane"
      | "checks"
      | "blockedReasons"
      | "fallbackLane"
      | "noExecutionBoundary"
      | "rationale"
    >();
    expectTypeOf<keyof CreatePhase25ResearchComparisonPayload>().toEqualTypeOf<
      | "researchQuestion"
      | "decisionContext"
      | "sourceRefs"
      | "baseline"
      | "candidate"
      | "delegationRiskGate"
      | "rubric"
    >();
    expectTypeOf<keyof Phase25ResearchComparisonProjection>().toEqualTypeOf<
      | "kind"
      | "sessionId"
      | "version"
      | "currentStatus"
      | "artifact"
      | "sourceRefs"
      | "summary"
      | "refetchUrl"
    >();
    expectTypeOf<keyof Phase25ResearchCandidateAdapterPort>().toEqualTypeOf<
      "adapterKind" | "adapterVersion" | "compare"
    >();
  });

  it("validates deterministic quality-lift fixtures without granting execution authority", () => {
    const projection = validatePhase25ResearchComparisonProjection(PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE);
    const report = projection.artifact;

    expect(report.status).toBe("quality_lift_ready");
    expect(report.qualityLiftStatus).toBe("material_quality_lift");
    expect(report.qualityLiftClaimed).toBe(true);
    expect(report.delegationRiskGate.verdict).toBe("allowed_for_comparative_preview");
    expect(report.noExecutionPolicy).toBe("no_submit_write_credential_custody_or_live_browser_execution");
    expect(report.candidate.conEvidence.length).toBeGreaterThan(0);
    expect(report.candidate.uncertainties.length).toBeGreaterThan(0);
    expect(report.candidate.sourceTraceRefs.length).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toMatch(/submit\(|credentialValue|sessionCookie|browserActionExecuted/iu);
  });

  it("validates deterministic safe-failure fixtures without claiming quality lift", () => {
    const report = validatePhase25ResearchComparisonReport(PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE.artifact);

    expect(report.status).toBe("safe_failure_blocked");
    expect(report.qualityLiftStatus).toBe("safe_failure_no_lift");
    expect(report.qualityLiftClaimed).toBe(false);
    expect(report.delegationRiskGate.verdict).toBe("blocked_by_session_custody");
    expect(report.delegationRiskGate.blockedReasons).toEqual([
      "Session custody is unresolved for ChatGPT Pro delegation."
    ]);
  });

  it("rejects pro-only, source-dump, and untraceable candidate outputs as quality-lift evidence", () => {
    const validReport = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const proOnlyReport = {
      ...validReport,
      candidate: {
        ...validReport.candidate,
        conEvidence: [],
        uncertainties: []
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const sourceDumpReport = {
      ...validReport,
      candidate: {
        ...validReport.candidate,
        decisionImpacts: []
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const untraceableReport = {
      ...validReport,
      candidate: {
        ...validReport.candidate,
        sourceTraceRefs: []
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;

    expect(phase25ResearchComparisonValidationIssues(proOnlyReport)).toEqual(
      expect.arrayContaining([
        "quality_lift_ready rejects pro-only candidate output",
        "quality_lift_ready requires explicit candidate uncertainties"
      ])
    );
    expect(phase25ResearchComparisonValidationIssues(sourceDumpReport)).toContain(
      "quality_lift_ready requires decision impact evidence"
    );
    expect(phase25ResearchComparisonValidationIssues(untraceableReport)).toContain(
      "candidate sourceTraceRefs must include traceable references"
    );
  });

  it("rejects malformed source metadata and missing outcome explanation fields", () => {
    const validReport = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const malformedSourceRef = {
      ...validReport,
      sourceRefs: [
        {
          ...validReport.sourceRefs[0],
          required: "yes"
        }
      ]
    } as unknown as Phase25ResearchQualityComparisonReportDto;
    const malformedSourceLabel = {
      ...validReport,
      sourceRefs: [
        {
          ...validReport.sourceRefs[0],
          sourceLabel: 123
        }
      ]
    } as unknown as Phase25ResearchQualityComparisonReportDto;
    const nullSourceRef = {
      ...validReport,
      sourceRefs: [null]
    } as unknown as Phase25ResearchQualityComparisonReportDto;
    const missingOutcomeExplanation = {
      ...validReport,
      decisionImpactSummary: "",
      requiredFollowUps: []
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const safeFailureWithoutReasons = {
      ...PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE.artifact,
      delegationRiskGate: {
        ...PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE.artifact.delegationRiskGate,
        blockedReasons: []
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;

    expect(phase25ResearchComparisonValidationIssues(malformedSourceRef)).toContain(
      "sourceRefs must include traceable references"
    );
    expect(phase25ResearchComparisonValidationIssues(malformedSourceLabel)).toContain(
      "sourceRefs must include traceable references"
    );
    expect(phase25ResearchComparisonValidationIssues(nullSourceRef)).toContain(
      "sourceRefs must include traceable references"
    );
    expect(phase25ResearchComparisonValidationIssues(missingOutcomeExplanation)).toEqual(
      expect.arrayContaining([
        "decisionImpactSummary is required",
        "requiredFollowUps must include at least one follow-up or boundary note"
      ])
    );
    expect(phase25ResearchComparisonValidationIssues(safeFailureWithoutReasons)).toContain(
      "safe_failure_blocked requires explicit blockedReasons"
    );
  });

  it("rejects allowed gate reports with blocked checks or lane mismatch", () => {
    const validReport = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const allowedGateWithBlockedCheck = {
      ...validReport,
      delegationRiskGate: {
        ...validReport.delegationRiskGate,
        checks: validReport.delegationRiskGate.checks.map((check) =>
          check.checkName === "session_custody"
            ? {
                ...check,
                status: "block",
                rationale: "Session custody is blocked and must force safe failure."
              }
            : check
        )
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const allowedGateWithBlockedReasons = {
      ...validReport,
      delegationRiskGate: {
        ...validReport.delegationRiskGate,
        blockedReasons: ["A blocked reason must not coexist with an allowed gate verdict."]
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const candidateLaneMismatch = {
      ...validReport,
      candidateLane: "browseruse_preview"
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const gateLaneMismatch = {
      ...validReport,
      delegationRiskGate: {
        ...validReport.delegationRiskGate,
        candidateLane: "official_codex_fallback"
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;

    expect(phase25ResearchComparisonValidationIssues(allowedGateWithBlockedCheck)).toContain(
      "allowed_for_comparative_preview requires every DelegationRiskGate check to pass"
    );
    expect(phase25ResearchComparisonValidationIssues(allowedGateWithBlockedReasons)).toContain(
      "allowed_for_comparative_preview must not include blockedReasons"
    );
    expect(phase25ResearchComparisonValidationIssues(candidateLaneMismatch)).toContain(
      "candidateLane must match candidate.lane"
    );
    expect(phase25ResearchComparisonValidationIssues(gateLaneMismatch)).toContain(
      "DelegationRiskGate candidateLane must match report candidateLane"
    );
  });

  it("rejects invalid or missing fallback lanes for fallback-required gates", () => {
    const safeFailureReport = PHASE25_SAFE_FAILURE_PROJECTION_FIXTURE.artifact;
    const gateWithoutFallbackLane = withoutFallbackLane(safeFailureReport.delegationRiskGate);
    const invalidFallbackLane = {
      ...safeFailureReport,
      delegationRiskGate: {
        ...safeFailureReport.delegationRiskGate,
        verdict: "fallback_required",
        fallbackLane: "browseruse_preview"
      }
    } as unknown as Phase25ResearchQualityComparisonReportDto;
    const missingFallbackLane = {
      ...safeFailureReport,
      delegationRiskGate: {
        ...gateWithoutFallbackLane,
        verdict: "fallback_required"
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;

    expect(phase25ResearchComparisonValidationIssues(invalidFallbackLane)).toContain(
      "DelegationRiskGate fallbackLane must be manual_prompt_handoff or official_codex_fallback"
    );
    expect(phase25ResearchComparisonValidationIssues(missingFallbackLane)).toContain(
      "fallback_required requires an explicit fallbackLane"
    );
  });

  it("rejects ambiguous duplicate keys and no-execution boundary mismatches", () => {
    const validReport = PHASE25_QUALITY_LIFT_PROJECTION_FIXTURE.artifact;
    const duplicateSourceRef = {
      ...validReport,
      sourceRefs: [...validReport.sourceRefs, validReport.sourceRefs[0]!]
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const duplicateGateCheck = {
      ...validReport,
      delegationRiskGate: {
        ...validReport.delegationRiskGate,
        checks: [...validReport.delegationRiskGate.checks, validReport.delegationRiskGate.checks[0]!]
      }
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const duplicateRubricDimension = {
      ...validReport,
      rubric: [...validReport.rubric, validReport.rubric[0]!]
    } satisfies Phase25ResearchQualityComparisonReportDto;
    const mismatchedNoExecutionBoundary = {
      ...validReport,
      delegationRiskGate: {
        ...validReport.delegationRiskGate,
        noExecutionBoundary: "metadata_only_no_execution"
      }
    } as unknown as Phase25ResearchQualityComparisonReportDto;

    expect(phase25ResearchComparisonValidationIssues(duplicateSourceRef)).toContain(
      "sourceRefs must not duplicate sourceType/sourceId pairs"
    );
    expect(phase25ResearchComparisonValidationIssues(duplicateGateCheck)).toContain(
      "DelegationRiskGate checks must not duplicate checkName"
    );
    expect(phase25ResearchComparisonValidationIssues(duplicateRubricDimension)).toContain(
      "rubric must not duplicate quality dimensions"
    );
    expect(phase25ResearchComparisonValidationIssues(mismatchedNoExecutionBoundary)).toEqual(
      expect.arrayContaining([
        "DelegationRiskGate noExecutionBoundary must match Phase 2.5 no-execution boundary",
        "delegation risk gate and report no-execution policy must match"
      ])
    );
  });
});
