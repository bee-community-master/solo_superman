import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DecisionQueueProjection, ProjectionVersion, QueueItemId } from "@solo-superman/contracts";
import { AppLanguageProvider } from "../../../shared/i18n/app-language";
import { QuestionsView } from "./QuestionsView";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

describe("QuestionsView", () => {
  it("renders suggested answer choices with pros and cons above the free-form answer box", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_choice_1" as QueueItemId,
          title: "Which first customer should be validated?",
          state: "active",
          answerOptions: [
            {
              id: "solo_founders",
              label: "Solo founders",
              value: "Validate solo founders first.",
              pro: "Fast interviews with a narrow segment.",
              con: "May miss team buyer needs."
            }
          ]
        }
      ],
      next: [],
      blocked: [],
      deferred: []
    };
    const controller = {
      answerDrafts: {},
      businessCriticIntensity: null,
      canStart: false,
      carryQueueItemAsKnownRisk: vi.fn(),
      idea: "",
      initialBusinessCriticIntensityReason: "",
      intake: "",
      isBusy: false,
      knownRiskDrafts: {},
      projectPurposeMode: null,
      projections: {
        queue
      },
      queueRecovery: {
        status: "idle",
        label: "Queue projection is fresh.",
        refetchLabel: "Canonical queue refetch URL is not loaded yet.",
        sseLabel: "SSE notification stream is not loaded yet.",
        activeBatchLabel: "No active batch metadata loaded yet."
      },
      runInitialQueueFlow: vi.fn(),
      sections: [
        {
          id: "active",
          title: "Active batch",
          emptyLabel: "No active questions.",
          items: queue.active
        }
      ],
      setAnswerDrafts: vi.fn(),
      setBusinessCriticIntensity: vi.fn(),
      setIdea: vi.fn(),
      setInitialBusinessCriticIntensityReason: vi.fn(),
      setIntake: vi.fn(),
      setKnownRiskDrafts: vi.fn(),
      setProjectPurposeMode: vi.fn(),
      submitAnswer: vi.fn()
    } as unknown as DecisionQueueShellController;

    const markup = renderToStaticMarkup(
      <AppLanguageProvider initialLanguage="en">
        <QuestionsView controller={controller} />
      </AppLanguageProvider>
    );

    expect(markup).toContain("Suggested answer choices");
    expect(markup).toContain("Pro: Fast interviews with a narrow segment.");
    expect(markup).toContain("Con: May miss team buyer needs.");
    expect(markup).toContain("Write a different answer if none fit");
    expect(markup.indexOf("Suggested answer choices")).toBeLessThan(
      markup.indexOf("Write a different answer if none fit")
    );
  });
});
