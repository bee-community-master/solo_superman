import { describe, expect, it } from "vitest";
import type { AutoImplementationRunProjection } from "./auto-implementation";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_STAGE_LABELS,
  AUTO_IMPLEMENTATION_STAGES,
  AutoImplementationRunValidationError,
  validateAutoImplementationRunProjection
} from "./auto-implementation";

describe("AutoImplementationRunProjection contract", () => {
  it("accepts the ready fixture with seven 5-minute implementation stages and markdown fallback issues", () => {
    expect(validateAutoImplementationRunProjection(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE)).toBe(
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE
    );
    expect(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun?.stagePlan).toHaveLength(AUTO_IMPLEMENTATION_STAGES.length);
    expect(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun?.stagePlan[0]).toMatchObject({
      stage: "initial_pr",
      label: AUTO_IMPLEMENTATION_STAGE_LABELS.initial_pr,
      status: "ready"
    });
    expect(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun?.issueManagement.mode).toBe("markdown_fallback");
    expect(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun?.remoteGuide.commands).toContain("gh auth login");
  });

  it("rejects generated repo folders outside the safe slug shape", () => {
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        projectFolderName: "../escape"
      },
      runs: [
        {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
          projectFolderName: "../escape"
        }
      ]
    } as AutoImplementationRunProjection;

    expect(() => validateAutoImplementationRunProjection(invalid)).toThrow(AutoImplementationRunValidationError);
  });

  it("rejects generated repo folders that are reserved on Windows", () => {
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        projectFolderName: "con"
      },
      runs: [
        {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
          projectFolderName: "con"
        }
      ]
    } as AutoImplementationRunProjection;

    expect(() => validateAutoImplementationRunProjection(invalid)).toThrow(AutoImplementationRunValidationError);
  });

  it("rejects projections when the stage plan is not the canonical runner sequence", () => {
    const outOfOrderStagePlan = [
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan[1]!,
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan[0]!,
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.stagePlan.slice(2)
    ];
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        stagePlan: outOfOrderStagePlan
      },
      runs: [
        {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
          stagePlan: outOfOrderStagePlan
        }
      ]
    } as AutoImplementationRunProjection;

    expect(() => validateAutoImplementationRunProjection(invalid)).toThrow(AutoImplementationRunValidationError);
  });

  it("rejects projections when issue documents do not cover the canonical stages in order", () => {
    const outOfOrderIssueDocs = [
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement.issueDocs[1]!,
      AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement.issueDocs[0]!,
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement.issueDocs.slice(2)
    ];
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      latestRun: {
        ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        issueManagement: {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
          issueDocs: outOfOrderIssueDocs
        }
      },
      runs: [
        {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
          issueManagement: {
            ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!.issueManagement,
            issueDocs: outOfOrderIssueDocs
          }
        }
      ]
    } as AutoImplementationRunProjection;

    expect(() => validateAutoImplementationRunProjection(invalid)).toThrow(AutoImplementationRunValidationError);
  });

  it("rejects projections when latestRun does not match the last run", () => {
    const invalid = {
      ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
      runs: [
        AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
        {
          ...AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun!,
          runId: "auto_run_other"
        }
      ]
    } as AutoImplementationRunProjection;

    expect(() => validateAutoImplementationRunProjection(invalid)).toThrow(AutoImplementationRunValidationError);
  });
});
