import { describe, expect, it } from "vitest";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE
} from "@solo-superman/contracts";
import { autoImplementationWorkspaceCreateBlocker } from "./useDecisionQueueShellController";

describe("autoImplementationWorkspaceCreateBlocker", () => {
  it("blocks workspace creation until a planning-ready handoff exists", () => {
    expect(autoImplementationWorkspaceCreateBlocker(null)).toContain("Run the planning handoff gate");
    expect(autoImplementationWorkspaceCreateBlocker(PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE)).toContain(
      "planning_ready"
    );
    expect(autoImplementationWorkspaceCreateBlocker(PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE)).toBeNull();
  });
});
