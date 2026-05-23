import { describe, expect, it } from "vitest";
import { planningRadarAxes, type RadarAxisLabels } from "./planning-radar-model";

const TEST_AXIS_LABELS: RadarAxisLabels = {
  problem: "Problem copy",
  customer: "Customer copy",
  value: "Value copy",
  validation: "Validation copy",
  implementation: "Implementation copy"
};

describe("planningRadarAxes", () => {
  it("uses injected language copy labels for radar axes", () => {
    expect(planningRadarAxes(null, TEST_AXIS_LABELS).map((axis) => axis.label)).toEqual([
      "Problem copy",
      "Customer copy",
      "Value copy",
      "Validation copy",
      "Implementation copy"
    ]);
  });

  it("falls back to stable axis ids instead of locale-specific user-facing labels", () => {
    expect(planningRadarAxes(null).map((axis) => axis.label)).toEqual([
      "problem",
      "customer",
      "value",
      "validation",
      "implementation"
    ]);
    expect(planningRadarAxes(null).map((axis) => axis.label).join(" ")).not.toMatch(/[가-힣]/u);
  });
});
