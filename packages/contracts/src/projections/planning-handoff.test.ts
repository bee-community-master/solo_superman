import { describe, expect, expectTypeOf, it } from "vitest";
import type { ProjectionVersion, SessionId, StateVersion } from "../ids";
import type { CreatePlanningHandoffRequest } from "../api";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE
} from "./planning-handoff";
import type {
  PlanningHandoffArtifactDto,
  PlanningHandoffBlockerArtifactDto,
  PlanningHandoffProjection,
  PlanningHandoffRequestedScopeDto,
  PlanningHandoffRequiredUserAction,
  PlanningHandoffSourceRefDto,
  PlanningHandoffVerdict
} from "./planning-handoff";

type NonReadyPlanningHandoffVerdict = Exclude<PlanningHandoffVerdict, "planning_ready">;

const NON_READY_PLANNING_HANDOFF_VERDICTS = [
  "blocked_by_fatal",
  "needs_risk_acceptance",
  "queue_review_incomplete",
  "source_trace_incomplete"
] as const satisfies readonly NonReadyPlanningHandoffVerdict[];

function createBlockerProjectionFixture(
  currentStatus: NonReadyPlanningHandoffVerdict,
  requiredUserActions: readonly PlanningHandoffRequiredUserAction[]
): PlanningHandoffProjection {
  const artifact = PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE.blockerArtifact;

  return {
    ...PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
    version: (PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE.version + 10) as ProjectionVersion,
    currentStatus,
    blockerArtifact: {
      ...artifact,
      artifactId: `${artifact.artifactId}_${currentStatus}`,
      status: currentStatus,
      gateVerdict: {
        ...artifact.gateVerdict,
        verdict: currentStatus
      },
      requiredUserActions
    },
    summary: `Planning Handoff blocker fixture for ${currentStatus}.`
  };
}

describe("Planning Handoff projection contract", () => {
  it("keeps the final/blocker/request field families exact", () => {
    expectTypeOf<keyof PlanningHandoffArtifactDto>().toEqualTypeOf<
      | "artifactId"
      | "kind"
      | "schemaVersion"
      | "createdAt"
      | "createdBy"
      | "status"
      | "sourceRefs"
      | "gateVerdict"
      | "scopeSnapshot"
      | "taskBreakdown"
      | "prIssuePlan"
      | "buildSlicePlan"
      | "serveChecklist"
      | "learningLoopHook"
      | "readinessChecklist"
      | "residualRiskRegister"
      | "phase15bHintMapping"
      | "noExecutionPolicy"
      | "handoffSummary"
    >();
    expectTypeOf<keyof PlanningHandoffBlockerArtifactDto>().toEqualTypeOf<
      | "artifactId"
      | "kind"
      | "schemaVersion"
      | "createdAt"
      | "createdBy"
      | "status"
      | "sourceRefs"
      | "gateVerdict"
      | "blockers"
      | "residualRisks"
      | "requiredUserActions"
      | "safePreviewRefs"
      | "phase15bHintMapping"
      | "noFinalLabelRule"
    >();
    expectTypeOf<CreatePlanningHandoffRequest>().toEqualTypeOf<{
      readonly scaffoldOnly?: true;
      readonly sessionId: SessionId;
      readonly expectedStateVersion: StateVersion;
      readonly sourceRefs: readonly PlanningHandoffSourceRefDto[];
      readonly requestedScope?: PlanningHandoffRequestedScopeDto;
    }>();
  });

  it("keeps final and blocker artifacts mutually exclusive", () => {
    expect(PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.currentStatus).toBe("planning_ready");
    expect("finalArtifact" in PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE).toBe(true);
    expect("blockerArtifact" in PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE).toBe(false);

    expect(PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE.currentStatus).not.toBe("planning_ready");
    expect("finalArtifact" in PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE).toBe(false);
    expect("blockerArtifact" in PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE).toBe(true);
  });

  it("exposes final planning-ready artifacts without execution authority", () => {
    const artifact = PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact;

    expect(artifact.noExecutionPolicy).toBe("no_file_shell_browser_deploy_or_external_mutation");
    expect(artifact.handoffSummary).toMatch(/^[가-힣]/u);
    expect(PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.summary).toBe(artifact.handoffSummary);
    expect(artifact.scopeSnapshot.userFacingJourneyLabel).toBe("Planning-ready");
    expect(artifact.scopeSnapshot.excludedInternalPhases).toEqual([
      "phase3_controlled_execution",
      "chatgpt_web_automation",
      "external_deploy"
    ]);
    expect(artifact.phase15bHintMapping.every((mapping) => mapping.hintRef.sourceType === "phase15b_hint")).toBe(true);
    expect(artifact.phase15bHintMapping[0]).toMatchObject({
      requiredApprovals: [expect.stringContaining("task_level_execution")],
      sandboxBoundary: expect.stringContaining("network=offline"),
      rollbackReference: expect.stringContaining("origin/main"),
      expectedEvidence: expect.arrayContaining(["pnpm verify"]),
      riskNormalization: {
        riskLevel: "medium",
        blockedActionType: "shell_command"
      },
      sourceTrace: expect.arrayContaining([
        expect.objectContaining({ kind: "research_run", refId: "research_run_demo" }),
        expect.objectContaining({ kind: "evidence_matrix", refId: "evidence_matrix_demo" }),
        expect.objectContaining({ kind: "research_allowlist", refId: "research_allowlist_demo" }),
        expect.objectContaining({ kind: "audit_log", refId: "audit_log_demo" })
      ]),
      noExecutionPolicy: "metadata_only_no_execution"
    });
  });

  it("keeps Build/Serve/Learning handoff fields preview-only and value-safe", () => {
    const artifact = PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact;

    expect(artifact.buildSlicePlan.sourceRefs.map((ref) => ref.sourceType)).toEqual(
      expect.arrayContaining(["spec_version", "decision_linked_evidence_pack", "research_updated_queue_item"])
    );
    expect(artifact.serveChecklist.envVars).toEqual([
      expect.objectContaining({
        envVarName: "SOLO_SUPERMAN_LOCAL_TOKEN",
        valueIncluded: false
      })
    ]);
    expect(artifact.learningLoopHook.decisionOptions).toEqual(["persevere", "narrow_scope", "next_slice"]);
    expect(JSON.stringify(artifact.serveChecklist)).not.toMatch(/token[_-]?value|secret|password|credentialValue/iu);
  });

  it("exposes blocker artifacts without using the final handoff label", () => {
    const artifact = PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE.blockerArtifact;

    expect(artifact.noFinalLabelRule).toBe("must_not_use_planning_ready_label");
    expect(artifact.requiredUserActions).toEqual(["revise", "research_more"]);
    expect(artifact.blockers.map((blocker) => blocker.blockerClass)).toEqual(["source_trace", "queue_review"]);
    expect(artifact.gateVerdict.terminalOutcomeSummary.map((summary) => summary.outcome)).toContain("deferred");
    expect(artifact.phase15bHintMapping[0]).toMatchObject({
      noExecutionPolicy: "metadata_only_no_execution",
      riskNormalization: {
        blockedActionType: "shell_command"
      }
    });
  });

  it("keeps every non-ready verdict on the blocker-only path", () => {
    expectTypeOf<(typeof NON_READY_PLANNING_HANDOFF_VERDICTS)[number]>().toEqualTypeOf<
      NonReadyPlanningHandoffVerdict
    >();

    const fixtures = NON_READY_PLANNING_HANDOFF_VERDICTS.map((currentStatus) =>
      createBlockerProjectionFixture(currentStatus, currentStatus === "needs_risk_acceptance" ? ["risk_accept"] : ["revise"])
    );

    expect(fixtures.map((fixture) => fixture.currentStatus)).toEqual(NON_READY_PLANNING_HANDOFF_VERDICTS);

    for (const projection of fixtures) {
      expect("finalArtifact" in projection).toBe(false);
      expect("blockerArtifact" in projection).toBe(true);

      if (!projection.blockerArtifact) {
        throw new Error(`Missing blocker artifact for ${projection.currentStatus}`);
      }

      expect(projection.blockerArtifact.status).toBe(projection.currentStatus);
      expect(projection.blockerArtifact.gateVerdict.verdict).toBe(projection.currentStatus);
      expect(projection.blockerArtifact.noFinalLabelRule).toBe("must_not_use_planning_ready_label");
      expect(projection.blockerArtifact.requiredUserActions.length).toBeGreaterThan(0);
      expect(projection.blockerArtifact.sourceRefs.length).toBeGreaterThan(0);
    }
  });

  it("keeps projection refetch URLs aligned with their session id", () => {
    for (const projection of [
      PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
      PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE
    ]) {
      expect(projection.refetchUrl).toBe(`/api/v1/sessions/${projection.sessionId}/planning-handoff`);
    }
  });

  it("allows CreatePlanningHandoffRequest to carry only source refs and optional requested scope", () => {
    const request = {
      sessionId: "session_demo_001" as SessionId,
      expectedStateVersion: 42 as StateVersion,
      sourceRefs: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.sourceRefs,
      requestedScope: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.scopeSnapshot
    } satisfies CreatePlanningHandoffRequest;

    expect(request.sourceRefs.map((ref) => ref.sourceType)).toEqual(
      expect.arrayContaining(["spec_version", "founder_brief", "decision_linked_evidence_pack"])
    );
    expect(JSON.stringify(request)).not.toMatch(/shellCommand|filePatch|browserAction|deployTarget|credential/iu);
  });
});
