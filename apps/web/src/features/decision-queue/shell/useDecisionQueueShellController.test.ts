import { describe, expect, it } from "vitest";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
  type LivingSpecProjection,
  type ProjectId,
  type ProjectionVersion,
  type ResearchRunControlProjection
} from "@solo-superman/contracts";
import { SidecarClientError } from "../../../shared/api/sidecar-client";
import {
  autoImplementationWorkspaceCreateBlocker,
  autoImplementationWorkspaceCreateFailureMessage,
  buildAutoImplementationRunCreateRequest,
  connectionStatusLabel,
  implementationNavSublabel,
  permissionNavStatusLabel,
  planningNavSublabel,
  researchRunControlHasPollableRuns
} from "./useDecisionQueueShellController";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";

const ACTION_ERRORS = DECISION_QUEUE_COPY.en.autoImplementation.actionErrors;

describe("Decision Queue shell chrome labels", () => {
  it("maps local-service and workflow statuses to product-facing copy", () => {
    expect(connectionStatusLabel({
      status: "unavailable",
      message: "Sidecar connection is unavailable."
    }, DECISION_QUEUE_COPY.ko)).toBe("로컬 서비스 연결 필요");
    expect(planningNavSublabel("empty", DECISION_QUEUE_COPY.ko)).toBe("인계 대기");
    expect(planningNavSublabel("blocked", DECISION_QUEUE_COPY.ko)).toBe("검토 필요");
    expect(planningNavSublabel("final", DECISION_QUEUE_COPY.en)).toBe("Planning-ready");
    expect(implementationNavSublabel(null, "not_started", DECISION_QUEUE_COPY.ko)).toBe("시작 전");
    expect(implementationNavSublabel("running", "not_started", DECISION_QUEUE_COPY.en)).toBe("running");
    expect(permissionNavStatusLabel("not_started", DECISION_QUEUE_COPY.en)).toBe("Not started");
  });
});

describe("autoImplementationWorkspaceCreateBlocker", () => {
  it("blocks workspace creation until a planning-ready handoff exists", () => {
    expect(autoImplementationWorkspaceCreateBlocker(null, ACTION_ERRORS)).toContain("Run the planning handoff gate");
    expect(
      autoImplementationWorkspaceCreateBlocker(PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE, ACTION_ERRORS)
    ).toContain(
      "planning_ready"
    );
    expect(autoImplementationWorkspaceCreateBlocker(PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE, ACTION_ERRORS)).toBeNull();
  });
});

describe("autoImplementationWorkspaceCreateFailureMessage", () => {
  it("keeps auto workspace creation API failures visible with the service error code", () => {
    const error = new SidecarClientError(
      {
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Planning handoff is not ready for implementation."
      },
      409
    );

    expect(autoImplementationWorkspaceCreateFailureMessage(error, ACTION_ERRORS)).toBe(
      "Auto implementation workspace creation failed: COMMAND_PRECONDITION_FAILED: Planning handoff is not ready for implementation."
    );
  });

  it("uses the unknown local service fallback when workspace creation throws a non-Error value", () => {
    expect(autoImplementationWorkspaceCreateFailureMessage(undefined, ACTION_ERRORS)).toBe(
      "Auto implementation workspace creation failed: Unknown local service error."
    );
  });
});

describe("buildAutoImplementationRunCreateRequest", () => {
  it("turns a planning-ready handoff into the next PR-sized auto implementation workspace request", () => {
    const session = {
      projectId: "proj_build_auto_run_request" as ProjectId,
      sessionId: "sess_build_auto_run_request",
      projectPurposeModeLabel: "Business validation",
      projectPurposeModeEffect: "Business validation remains active."
    } as Parameters<typeof buildAutoImplementationRunCreateRequest>[0]["session"];
    const spec = {
      kind: "LivingSpecProjection",
      sessionId: session.sessionId,
      version: 2 as ProjectionVersion,
      title: "Pet lifecycle assistant",
      sections: []
    } as unknown as LivingSpecProjection;

    expect(buildAutoImplementationRunCreateRequest({
      session,
      spec,
      planningHandoff: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
      autoImplementationRuns: null
    })).toEqual(expect.objectContaining({
      sessionId: "sess_build_auto_run_request",
      projectName: "Pet lifecycle assistant",
      sourcePlanningRef: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.finalArtifact.artifactId,
      planningIssueId: "phase2_pr01",
      trackerTitle: "Pet lifecycle assistant implementation tracker",
      trackerGoal: PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE.summary
    }));
  });
});

describe("researchRunControlHasPollableRuns", () => {
  it("polls only queued or running research runs so completed and paused runs do not spin the background loop", () => {
    const runs = (statuses: readonly string[]) => ({
      runs: statuses.map((status, index) => ({
        researchRunId: `research_run_${index}`,
        status
      }))
    }) as unknown as ResearchRunControlProjection;

    expect(researchRunControlHasPollableRuns(null)).toBe(false);
    expect(researchRunControlHasPollableRuns(runs(["completed", "failed", "paused"]))).toBe(false);
    expect(researchRunControlHasPollableRuns(runs(["completed", "queued"]))).toBe(true);
    expect(researchRunControlHasPollableRuns(runs(["running"]))).toBe(true);
  });
});
