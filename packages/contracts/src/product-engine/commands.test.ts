import { describe, expect, it } from "vitest";
import { COMMAND_ACTORS, COMMAND_TYPES } from "./commands";

describe("ProductEngine command contract placeholders", () => {
  it("keeps docs/25 CommandActor values available", () => {
    expect(COMMAND_ACTORS).toEqual(["user", "product_engine", "effect_executor", "codex_runtime", "system"]);
  });

  it("keeps command type placeholders closed and unique", () => {
    expect(new Set(COMMAND_TYPES).size).toBe(COMMAND_TYPES.length);
    expect(COMMAND_TYPES).toContain("StartProject");
    expect(COMMAND_TYPES).toContain("PrepareFounderBrief");
  });
});
