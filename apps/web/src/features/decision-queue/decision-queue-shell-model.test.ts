import { describe, expect, it } from "vitest";
import { SidecarClientError } from "../../shared/api/sidecar-client";
import { displayError } from "./shell/decision-queue-shell-model";

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
});
