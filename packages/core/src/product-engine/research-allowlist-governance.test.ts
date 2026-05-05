import { describe, expect, it } from "vitest";
import {
  PRODUCT_ENGINE_COMMAND_TYPES,
  PROJECT_APPLICATION_COMMAND_TYPES,
  type CommandType
} from "@solo-superman/contracts";

const ALLOWLIST_APPLICATION_COMMAND_TYPES = [
  "CreateResearchAllowlist",
  "UpdateResearchAllowlist",
  "PauseResearchAllowlist",
  "RevokeResearchAllowlist"
] as const satisfies readonly CommandType[];

describe("Research allowlist governance command boundary", () => {
  it("keeps project-level allowlist application commands out of the ProductEngine reducer taxonomy", () => {
    expect(PROJECT_APPLICATION_COMMAND_TYPES).toEqual(ALLOWLIST_APPLICATION_COMMAND_TYPES);
    expect(PRODUCT_ENGINE_COMMAND_TYPES).not.toEqual(
      expect.arrayContaining([...ALLOWLIST_APPLICATION_COMMAND_TYPES])
    );
  });
});
