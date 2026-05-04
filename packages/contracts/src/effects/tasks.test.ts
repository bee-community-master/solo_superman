import { describe, expect, it } from "vitest";
import { EFFECT_STATUSES, EFFECT_TYPES } from "./tasks";

describe("Effect task contract placeholders", () => {
  it("exposes only the three Phase 1 first-class effect types", () => {
    expect(EFFECT_TYPES).toEqual([
      "queue_projection_effect",
      "research_evidence_effect",
      "codex_runtime_preview_effect"
    ]);
  });

  it("matches the docs/25 effect lifecycle status names", () => {
    expect(EFFECT_STATUSES).toEqual(["queued", "leased", "running", "succeeded", "failed", "blocked", "cancelled"]);
  });
});
