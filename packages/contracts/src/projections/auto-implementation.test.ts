import { describe, expect, it } from "vitest";
import type { AutoImplementationRun, AutoImplementationRunProjection } from "./auto-implementation";
import {
  AUTO_IMPLEMENTATION_RUN_READY_FIXTURE,
  AUTO_IMPLEMENTATION_STAGE_LABELS,
  AUTO_IMPLEMENTATION_STAGES,
  AutoImplementationRunValidationError,
  validateAutoImplementationRunProjection
} from "./auto-implementation";

function readyFixtureRun() {
  const run = AUTO_IMPLEMENTATION_RUN_READY_FIXTURE.latestRun;

  if (!run) {
    throw new Error("AUTO_IMPLEMENTATION_RUN_READY_FIXTURE must include latestRun.");
  }

  return run;
}

function requiredFixtureItem<TItem>(items: readonly TItem[], index: number, label: string) {
  const item = items[index];

  if (!item) {
    throw new Error(`${label} fixture item ${index} must exist.`);
  }

  return item;
}

const readyRun = readyFixtureRun();

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
    expect(readyRun.issueManagement.githubIssueUrls).toEqual([]);
    expect(readyRun.issueManagement.githubIssueMutation).toMatchObject({
      status: "not_requested",
      requiredRemoteStatus: "connected",
      mutatesGitHub: false,
      perActionApprovalRequired: true,
      approval: null,
      blockedReason: null,
      createdIssueUrls: [],
      auditEvidenceRefs: ["github-issue-mutation:not_requested"],
      verifierEvidenceRefs: []
    });
    expect(readyRun.issueManagement.githubIssueMutation.plannedIssues).toHaveLength(AUTO_IMPLEMENTATION_STAGES.length);
    expect(readyRun.issueManagement.githubIssueMutation.plannedIssues[0]).toMatchObject({
      issueId: "local-001",
      bodyMarkdownPath: "implementation-issues/001-initial_pr.md",
      sourceStage: "initial_pr"
    });
    expect(readyRun.reviewProtocol.deliveryGates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("two consecutive no-finding passes")
      ])
    );
    expect(readyRun.reviewProtocol.stageGates.find((gate) => gate.stage === "merge_main")?.gates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rerun the full verification command on main")
      ])
    );
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
      requiredFixtureItem(readyRun.stagePlan, 1, "stagePlan"),
      requiredFixtureItem(readyRun.stagePlan, 0, "stagePlan"),
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
      requiredFixtureItem(readyRun.issueManagement.issueDocs, 1, "issueDocs"),
      requiredFixtureItem(readyRun.issueManagement.issueDocs, 0, "issueDocs"),
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

  it("rejects completed stages that do not include implementation ledger evidence", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
          ...stage,
          status: "completed",
          evidenceRefs: ["stage:complete:initial_pr"]
        }
        : stage)
    });

    expectInvalidProjection(invalid);
  });

  it("rejects blocked stages that do not preserve a visible blocker", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      stagePlan: readyRun.stagePlan.map((stage, index) => index === 0
        ? {
          ...stage,
          status: "blocked",
          evidenceRefs: ["stage:block:initial_pr"]
        }
        : stage)
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when review gates do not cover the canonical delivery protocol", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      reviewProtocol: {
        ...readyRun.reviewProtocol,
        deliveryGates: readyRun.reviewProtocol.deliveryGates.slice(1)
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when remote status, guide, and issue mode drift apart", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      remoteStatus: "connected",
      remoteGuide: {
        ...readyRun.remoteGuide,
        status: "connected",
        warning: null,
        commands: []
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when the GitHub issue mutation contract implies external writes without matching issue URLs", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        githubIssueMutation: {
          ...readyRun.issueManagement.githubIssueMutation,
          status: "applied",
          mutatesGitHub: true,
          approval: {
            approvalId: "approval_123",
            approvedBy: "local_operator",
            approvedAt: "2026-05-05T00:00:00.000Z",
            actionClass: "github_issue_create",
            approvalGranularity: "per_action",
            remoteStatusAtApproval: "connected",
            rollbackPlan: "Close created issues and keep local markdown as source of truth.",
            evidenceRefs: ["approval:github_issue_create:123"]
          },
          createdIssueUrls: ["https://github.com/bee-community-master/demo/issues/1"],
          verifierEvidenceRefs: ["verifier:github_issue_create:ready"]
        }
      }
    });

    expectInvalidProjection(invalid);
  });

  it("rejects projections when disconnected remotes are marked ready for GitHub issue mutation", () => {
    const invalid = projectionWithLatestRun({
      ...readyRun,
      issueManagement: {
        ...readyRun.issueManagement,
        githubIssueMutation: {
          ...readyRun.issueManagement.githubIssueMutation,
          status: "dry_run_ready",
          auditEvidenceRefs: ["github-issue-mutation:dry_run_ready"]
        }
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
