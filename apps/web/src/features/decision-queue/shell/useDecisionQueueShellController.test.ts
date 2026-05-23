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

describe("autoImplementationWorkspaceCreateBlocker", () => {
  it("blocks workspace creation until a planning-ready handoff exists", () => {
    expect(autoImplementationWorkspaceCreateBlocker(null)).toContain("Run the planning handoff gate");
    expect(autoImplementationWorkspaceCreateBlocker(PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE)).toContain(
      "planning_ready"
    );
    expect(autoImplementationWorkspaceCreateBlocker(PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE)).toBeNull();
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

    expect(autoImplementationWorkspaceCreateFailureMessage(error)).toBe(
      "Auto implementation workspace creation failed: COMMAND_PRECONDITION_FAILED: Planning handoff is not ready for implementation."
    );
  });

  it("uses the unknown local service fallback when workspace creation throws a non-Error value", () => {
    expect(autoImplementationWorkspaceCreateFailureMessage(undefined)).toBe(
      "Auto implementation workspace creation failed: Unknown local service error."
    );
  });
});
