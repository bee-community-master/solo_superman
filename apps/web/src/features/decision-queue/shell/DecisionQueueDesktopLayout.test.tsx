import { describe, expect, it, vi } from "vitest";
import {
  DecisionQueueDesktopLayout,
  type DecisionQueueDesktopLayoutController
} from "./DecisionQueueDesktopLayout";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { emptyProjectionState } from "./decision-queue-shell-model";
import { renderEnglishMarkup } from "../test-rendering";

describe("DecisionQueueDesktopLayout", () => {
  it("renders compact phase labels with full accessibility labels", () => {
    const pageMeta = DECISION_QUEUE_COPY.en.pageMeta;
    const navItems = [
      {
        id: "onboarding",
        label: pageMeta.onboarding.label,
        sublabel: "Login + goal setup",
        health: "pending"
      },
      {
        id: "questions",
        label: pageMeta.questions.label,
        sublabel: "0 active · 0 next",
        health: "pending",
        badge: 0
      },
      {
        id: "research",
        label: pageMeta.research.label,
        sublabel: "0 tasks · 0 runs",
        health: "pending",
        badge: undefined
      },
      {
        id: "planning",
        label: pageMeta.planning.label,
        sublabel: "Handoff pending",
        health: "pending"
      },
      {
        id: "implementation",
        label: pageMeta.implementation.label,
        sublabel: "Not started",
        health: "pending"
      },
      {
        id: "permissions",
        label: pageMeta.permissions.label,
        sublabel: "Not started · Not started",
        health: "pending"
      }
    ] satisfies DecisionQueueDesktopLayoutController["navItems"];
    const controller = {
      activePage: "onboarding",
      activePageMeta: pageMeta.onboarding,
      blockedQueueCount: 0,
      confidence: null,
      connect: vi.fn(),
      connectionLabel: DECISION_QUEUE_COPY.en.layout.localServiceConnected,
      connectionState: {
        status: "connected",
        connection: {
          baseUrl: "http://127.0.0.1:43110",
          localCapabilityToken: "test-token",
          mode: "vite_env",
          status: "discovered",
          tokenSource: "vite_env"
        }
      },
      connectionTone: "connected",
      isBusy: false,
      navItems,
      pageMeta,
      projections: emptyProjectionState(),
      setActivePage: vi.fn(),
      totalQueueCount: 0,
      workflowError: null
    } satisfies DecisionQueueDesktopLayoutController;

    const markup = renderEnglishMarkup(
      <DecisionQueueDesktopLayout
        controller={controller}
        rightRail={<aside className="right-rail">Right rail</aside>}
      >
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
    expect(markup).toContain('<p class="view-kicker">Workspace</p>');
    expect(markup).not.toContain("solo-superman.contracts.v1");
    expect(markup).not.toContain("not_started");
  });
});
