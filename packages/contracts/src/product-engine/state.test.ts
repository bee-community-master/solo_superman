import { describe, expect, it } from "vitest";
import type { ProductEngineStateSnapshot } from "./state";

describe("ProductEngine state snapshot contract placeholder", () => {
  it("keeps the docs/25 top-level snapshot fields as real type keys", () => {
    const stateSnapshotFields = [
      "stateVersion",
      "project",
      "session",
      "currentSpec",
      "openIssues",
      "queueProjection",
      "researchState",
      "decisions",
      "runtimeState",
      "completeness"
    ] as const satisfies readonly (keyof ProductEngineStateSnapshot)[];

    expect(stateSnapshotFields).toHaveLength(10);
  });
});
