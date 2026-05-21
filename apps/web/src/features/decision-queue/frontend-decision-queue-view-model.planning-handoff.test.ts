import { describe, expect, it } from "vitest";
import { createElement } from "react";
import {
  PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE,
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE
} from "@solo-superman/contracts";
import type {
  PlanningHandoffProjection,
} from "@solo-superman/contracts";
import {
  type PlanningHandoffViewModel,
  planningHandoffViewModel,
} from "./decision-queue-view-model";

import { PlanningHandoffPanel } from "./PlanningHandoffPanel";
import { renderEnglishMarkup } from "./test-rendering";

function handoffProjectionFixture(kind: "final" | "blocker"): PlanningHandoffProjection {
  return kind === "final"
    ? (PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE as PlanningHandoffProjection)
    : (PLANNING_HANDOFF_BLOCKER_PROJECTION_FIXTURE as PlanningHandoffProjection);
}

function handoffCopy(handoff: PlanningHandoffViewModel) {
  const artifact = handoff.final ?? handoff.blocker;

  return [
    handoff.statusLabel,
    handoff.label,
    handoff.summary,
    handoff.noExecutionLabel,
    handoff.refetchLabel,
    handoff.sourceRefsLabel,
    artifact?.heading,
    ...(artifact?.groups.flatMap((group) => [group.title, ...group.items]) ?? [])
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

describe("Decision Queue view model planning-handoff", () => {
  it("renders Planning-ready only for a final Planning Handoff artifact", () => {
    const handoff = planningHandoffViewModel(handoffProjectionFixture("final"));
    const copy = handoffCopy(handoff);
    const markup = renderEnglishMarkup(
      createElement(PlanningHandoffPanel, {
        hasActiveSession: true,
        isBusy: false,
        handoff,
        onRunHandoffGate: () => undefined,
        onRefreshHandoff: () => undefined
      })
    );

    expect(handoff).toMatchObject({
      status: "final",
      statusLabel: "Planning-ready",
      blocker: null
    });
    expect(handoff.final).not.toBeNull();
    expect(copy).toContain("Planning-ready");
    expect(copy).toContain("final handoff shows only when the gate verdict is Planning-ready");
    expect(copy).toContain("Readiness hint requires explicit future execution approval");
    expect(copy).toContain("Execution preparation notes");
    expect(copy).toContain("source trace preview_artifact:runtime_artifact_demo");
    expect(copy).toContain("policy metadata only no execution");
    expect(copy).toContain("residual risk visibility passed");
    expect(copy).toContain("file, shell, browser, deploy, credential, and delegation controls stay unavailable");
    expect(markup).toContain("Planning Handoff");
    expect(markup).toContain("Planning-ready");
    expect(markup).toContain("Execution preparation notes");
    expect(markup).toContain("Residual risks");
    expect(markup).toContain("Source references:");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
    expect(markup).not.toContain("no_file_shell_browser_deploy_or_external_mutation");
  });

  it("keeps blocker Planning Handoff copy mutually exclusive from the final label", () => {
    const handoff = planningHandoffViewModel({
      ...handoffProjectionFixture("blocker"),
      summary: "Blocked lowercase planning-ready and planning_ready copy must remain a blocker report."
    });
    const copy = handoffCopy(handoff);
    const markup = renderEnglishMarkup(
      createElement(PlanningHandoffPanel, {
        hasActiveSession: true,
        isBusy: false,
        handoff,
        onRunHandoffGate: () => undefined,
        onRefreshHandoff: () => undefined
      })
    );

    expect(handoff).toMatchObject({
      status: "blocked",
      final: null
    });
    expect(handoff.blocker).not.toBeNull();
    expect(copy).not.toContain("Planning-ready");
    expect(copy).not.toMatch(/\bplanning[-_]ready\b/iu);
    expect(copy).toContain("handoff blocker: source trace incomplete");
    expect(copy).toContain("Blocked lowercase final handoff and final handoff copy must remain a blocker report.");
    expect(copy).toContain("required next action research more");
    expect(copy).toContain("Safe preview refs");
    expect(copy).toContain("Execution preparation notes");
    expect(copy).toContain("policy metadata only no execution");
    expect(copy).toContain("No additional residual risk entries are hidden");
    expect(markup).toContain("Blocker report");
    expect(markup).toContain("Execution preparation notes");
    expect(markup).not.toContain("Planning-ready");
    expect(markup).not.toMatch(/\bplanning[-_]ready\b/iu);
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
  });

  it("keeps Planning Handoff empty state read-only until a final or blocker projection is loaded", () => {
    const handoff = planningHandoffViewModel(null);
    const markup = renderEnglishMarkup(
      createElement(PlanningHandoffPanel, {
        hasActiveSession: false,
        isBusy: false,
        handoff,
        onRunHandoffGate: () => undefined,
        onRefreshHandoff: () => undefined
      })
    );

    expect(handoff).toMatchObject({
      status: "empty",
      statusLabel: "handoff pending",
      final: null,
      blocker: null
    });
    expect(markup).toContain("No final handoff or blocker is available");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Run planning handoff check</button>");
    expect(markup).toContain("<button type=\"button\" disabled=\"\">Refresh handoff</button>");
    expect(markup).not.toMatch(/\b(executed|succeeded|applied)\b/iu);
  });
});
