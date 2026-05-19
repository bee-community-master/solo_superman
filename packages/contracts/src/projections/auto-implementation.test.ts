import { describe, expect, it } from "vitest";
import type { AutoImplementationRun, AutoImplementationRunProjection } from "./auto-implementation";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_STAGE_LABELS,
  AUTO_IMPLEMENTATION_STAGES,
  AutoImplementationRunValidationError,
  validateAutoImplementationRunProjection
} from "./auto-implementation";

const readyRun = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!;

function projectionWithLatestRun(run: AutoImplementationRun): AutoImplementationRunProjection {
  return {
    ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
    latestRun: run,
    runs: [run]
  } as AutoImplementationRunProjection;
}

function expectInvalidProjection(projection: AutoImplementationRunProjection) {
  expect(() => validateAutoImplementationRunProjection(projection)).toThrow(AutoImplementationRunValidationError);
}

describe("AutoImplementationRunProjection contract", () => {
  it("accepts the ready fixture with seven 5-minute implementation stages and markdown fallback issues", () => {
    expect(validateAutoImplementationRunProjection(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE)).toBe(
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE
    );
    expect(readyRun.stagePlan).toHaveLength(AUTO_IMPLEMENTATION_STAGES.length);
    expect(readyRun.stagePlan[0]).toMatchObject({
      stage: "initial_pr",
      label: AUTO_IMPLEMENTATION_STAGE_LABELS.initial_pr,
      status: "ready"
    });
    expect(readyRun.issueManagement.mode).toBe("markdown_fallback");
    expect(readyRun.remoteGuide.commands).toContain("gh auth login");
  });

  it("rejects generated repo folders outside the safe slug shape", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      projectFolderName: "../escape"
    });

    expectInvalidProjection(invalid);
  });

  it("rejects generated repo folders that are reserved on Windows", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      projectFolderName: "con"
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when the stage plan is not the canonical runner sequence", () => {
    const outOfOrderStagePlan = [
      readyRun.stagePlan[1]!,
      readyRun.stagePlan[0]!,
      ...readyRun.stagePlan.slice(2)
    ];
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: outOfOrderStagePlan
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when issue documents do not cover the canonical stages in order", () => {
    const outOfOrderIssueDocs = [
      readyRun.issueManagement.issueDocs[1]!,
      readyRun.issueManagement.issueDocs[0]!,
      ...readyRun.issueManagement.issueDocs.slice(2)
    ];
    const invalid = projectionWithLatestRun({
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        issueDocs: outOfOrderIssueDocs
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when latestRun does not match the last run", () => {
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      runs: [
        readyRun,
        {
          ...readyRun,
          runId: "auto_run_other"
        }
      ]
    } as AutoImplementationRunProjection;

    expectInvalidProjection(invalid);
  });
});
