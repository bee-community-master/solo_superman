import { describe, expect, it } from "vitest";
import { SidecarClientError } from "../../shared/api/sidecar-client";
import { displayError, emptyProjectionState, latestProjectionVersion, type ProjectionState } from "./shell/decision-queue-shell-model";

describe("decision queue shell model", () => {
  it("keeps sidecar API error codes visible in workflow errors", () => {
    const error = new SidecarClientError(
      {
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Score completeness requires an active session."
      },
      409
    );

    expect(displayError(error)).toBe(
      "COMMAND_PRECONDITION_FAILED: Score completeness requires an active session."
    );
  });

  it("uses the original unknown sidecar error fallback for non-Error throws", () => {
    expect(displayError(undefined)).toBe("Unknown sidecar error.");
  });

  it("keeps every refreshed projection in the expected state-version calculation", () => {
    const projections = {
      ...emptyProjectionState(),
      session: { version: 1 },
      spec: { version: 2 },
      queue: { version: 3 },
      research: { version: 4 },
      activity: { version: 5 },
      confidence: { version: 6 },
      founderBrief: { version: 7 },
      planningHandoff: { version: 8 },
      chatGptDelegation: { version: 9 },
      servicePageUsePermission: { version: 10 },
      implementationStepLedger: { version: 11 }
    } as unknown as ProjectionState;

    expect(latestProjectionVersion(projections)).toBe(11);
  });
});
