import { describe, expect, it } from "vitest";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
  type ResearchRunControlProjection
} from "@solo-superman/contracts";
import { SidecarClientError } from "../../../shared/api/sidecar-client";
import {
  autoImplementationWorkspaceCreateBlocker,
  autoImplementationWorkspaceCreateFailureMessage,
  researchRunControlHasPollableRuns
} from "./useDecisionQueueShellController";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";

const ACTION_ERRORS = DECISION_QUEUE_COPY.en.autoImplementation.actionErrors;

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
