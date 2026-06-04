import { describe, expect, it, vi } from "vitest";
import { DecisionQueueDesktopLayout } from "./DecisionQueueDesktopLayout";
import { DECISION_QUEUE_COPY, DECISION_QUEUE_PAGE_ORDER } from "./decision-queue-copy";
import { emptyProjectionState } from "./decision-queue-shell-model";
import { renderEnglishMarkup } from "../test-rendering";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

describe("DecisionQueueDesktopLayout", () => {
  it("renders compact phase labels with full accessibility labels", () => {
    const pageMeta = DECISION_QUEUE_COPY.en.pageMeta;
    const controller = {
      activePage: "onboarding",
      activePageMeta: {
        title: pageMeta.onboarding.label,
        description: pageMeta.onboarding.description
      },
      blockedQueueCount: 0,
      confidence: null,
      connect: vi.fn(),
      connectionLabel: DECISION_QUEUE_COPY.en.layout.localServiceConnected,
      connectionState: {
        status: "connected"
      },
      connectionTone: "connected",
      isBusy: false,
      navItems: DECISION_QUEUE_PAGE_ORDER.map((id) => ({
        id,
        label: pageMeta[id].label,
        sublabel: "not_started",
        health: "neutral" as const
      })),
      pageMeta,
      projections: emptyProjectionState(),
      setActivePage: vi.fn(),
      totalQueueCount: 0,
      workflowError: null
    } as unknown as DecisionQueueShellController;

    const markup = renderEnglishMarkup(
      <DecisionQueueDesktopLayout controller={controller} rightRail={<aside className="right-rail">Right rail</aside>}>
        <section>Workspace</section>
      </DecisionQueueDesktopLayout>
    );

    expect(markup).toContain('aria-label="Onboarding, current step"');
    expect(markup).toContain('aria-label="Questions"');
    expect(markup).toContain('<span class="phase-label">Onboard</span>');
    expect(markup).toContain('<span class="phase-label">Build</span>');
    expect(markup).not.toContain('<span class="phase-label">O</span>');
    expect(markup).not.toContain('<span class="phase-label">I</span>');
    expect(markup).toContain("Local service connected");
  });
});
