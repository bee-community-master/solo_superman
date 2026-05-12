import { describe, expect, it } from "vitest";
import type { CommandId, CommandResponse, CorrelationId, StateVersion } from "@solo-superman/contracts";
import { commandResponseVersion, optionalCommandProjection, requiredCommandProjection } from "./command-response-helpers";

function commandResponse(overrides: Partial<CommandResponse> = {}): CommandResponse {
  return {
    category: "accepted",
    commandId: "cmd_test" as CommandId,
    correlationId: "corr_test" as CorrelationId,
    stateVersionBefore: 1 as StateVersion,
    stateVersionAfter: 2 as StateVersion,
    ...overrides
  };
}

function commandResponseWithoutStateVersion(): CommandResponse {
  return {
    category: "accepted",
    commandId: "cmd_test" as CommandId,
    correlationId: "corr_test" as CorrelationId,
    stateVersionBefore: 1 as StateVersion
  };
}

describe("web command response helpers", () => {
  it("requires state version for command chaining", () => {
    expect(commandResponseVersion(commandResponse())).toBe(2);
    expect(() => commandResponseVersion(commandResponseWithoutStateVersion())).toThrow(
      "Command did not return a next state version."
    );
  });

  it("keeps mandatory projection flows strict", () => {
    expect(
      requiredCommandProjection(commandResponse({ immediateProjection: { kind: "SessionShellProjection" } }), "SessionShellProjection")
    ).toMatchObject({ kind: "SessionShellProjection" });

    expect(() =>
      requiredCommandProjection(commandResponse({ immediateProjection: { kind: "DecisionQueueProjection" } }), "SessionShellProjection")
    ).toThrow("SessionShellProjection was not returned by the sidecar command.");
  });

  it("allows accepted async responses that expose only statusUrl for later projection refetch", () => {
    expect(
      optionalCommandProjection(
        commandResponse({
          category: "accepted",
          statusUrl: "/api/v1/commands/cmd_test/status"
        }),
        "ResearchEvidenceProjection"
      )
    ).toBeNull();
  });
});
