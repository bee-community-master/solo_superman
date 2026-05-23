import { describe, expect, it } from "vitest";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE
} from "@solo-superman/contracts";
import { SidecarClientError } from "../../../shared/api/sidecar-client";
import {
  autoImplementationWorkspaceCreateBlocker,
  autoImplementationWorkspaceCreateFailureMessage
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
