import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { AUTO_IMPLEMENTATION_RUN_READY_FIXTURE } from "@solo-superman/contracts";
import {
  AutoImplementationRunPanel,
  autoImplementationRunViewModel
} from "./AutoImplementationRunPanel";
import { renderEnglishMarkup } from "./test-rendering";

describe("AutoImplementationRunPanel view model", () => {
  it("shows workspace, five-minute stages, markdown issues, and remote guide", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);

    expect(view.status).toBe("pending");
    expect(view.workspaceLabel).toContain("/repo/workspace/demo-project");
    expect(view.nextTickLabel).toContain("2026-05-19T00:05:00.000Z");
    expect(view.issueModeLabel).toContain("markdown_fallback");
    expect(view.githubIssueMutationLabel).toContain("not_requested");
    expect(view.githubIssuePlans[0]!.bodyMarkdownPath).toContain("implementation-issues/001-initial_pr.md");
    expect(view.githubCreatedIssueUrls).toEqual([]);
    expect(view.stages).toHaveLength(7);
    expect(view.stages[0]!.status).toBe("ready");
    expect(view.issueDocs[0]!.relativePath).toContain("implementation-issues/001-initial_pr.md");
    expect(view.deliveryGates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("two consecutive no-finding passes")
      ])
    );
    expect(view.stageReviewGates.find((stage) => stage.stage === "merge_main")?.gates).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rerun the full verification command on main")
      ])
    );
    expect(view.remoteWarning).toContain("Remote is not connected");
    expect(view.remoteCommands).toContain("git remote add origin <github-repo-url>");
  });

  it("uses a visible not-started state before the workspace run exists", () => {
    const view = autoImplementationRunViewModel(null);

    expect(view.status).toBe("not_started");
    expect(view.hasRun).toBe(false);
    expect(view.workspaceLabel).toContain("workspace/<project>");
    expect(view.remoteNextAction).toContain("planning handoff");
    expect(view.githubIssueMutationLabel).toContain("not requested");
  });

  it("renders the remote warning and local issue documents", () => {
    const view = autoImplementationRunViewModel(AUTO_IMPLEMENTATION_RUN_READY_FIXTURE);
    const markup = renderEnglishMarkup(
      createElement(AutoImplementationRunPanel, {
        run: view,
        isBusy: false,
        onCreateRun: () => undefined,
        onRefreshRun: () => undefined
      })
    );

    expect(markup).toContain("Auto implementation workspace");
    expect(markup).toContain("Initial implementation and PR creation");
    expect(markup).toContain("Review and merge protocol");
    expect(markup).toContain("Do not merge until the feature PR code review reaches two consecutive no-finding passes");
    expect(markup).toContain("Sync main after merge and rerun the full verification command on main.");
    expect(markup).toContain("implementation-issues/001-initial_pr.md");
    expect(markup).toContain("GitHub issue mutation contract");
    expect(markup).toContain("GitHub issue mutation: not_requested");
    expect(markup).toContain("local markdown issue paths remain the source of truth");
    expect(markup).toContain("git remote add origin");
  });
});
