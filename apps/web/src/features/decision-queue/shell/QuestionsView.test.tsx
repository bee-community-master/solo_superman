import { describe, expect, it, vi } from "vitest";
import type { DecisionQueueProjection, ProjectionVersion, QueueItemId } from "@solo-superman/contracts";
import { renderEnglishMarkup } from "../test-rendering";
import { QuestionsView } from "./QuestionsView";
import { emptyProjectionState } from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

const DEFAULT_QUEUE_RECOVERY = {
  status: "idle",
  label: "Questions are up to date.",
  refetchLabel: "Question refresh path is not loaded yet.",
  sseLabel: "Live update stream is not loaded yet.",
  activeBatchLabel: "Current question details are not loaded yet."
} as const;

function renderQuestionsView(controllerOverrides: Partial<DecisionQueueShellController> = {}) {
  const controller = {
    answerDrafts: {},
    businessCriticIntensity: null,
    canStart: false,
    carryQueueItemAsKnownRisk: vi.fn(),
    chatGptLoginAcknowledged: false,
    codexLoginStart: null,
    idea: "",
    initialBusinessCriticIntensityReason: "",
    intake: "",
    isBusy: false,
    knownRiskDrafts: {},
    projectPurposeMode: null,
    projections: emptyProjectionState(),
    queueRecovery: DEFAULT_QUEUE_RECOVERY,
    refreshRuntimeStatus: vi.fn(),
    runInitialQueueFlow: vi.fn(),
    sections: [],
    setAnswerDrafts: vi.fn(),
    setBusinessCriticIntensity: vi.fn(),
    setChatGptLoginAcknowledged: vi.fn(),
    setIdea: vi.fn(),
    setInitialBusinessCriticIntensityReason: vi.fn(),
    setIntake: vi.fn(),
    setKnownRiskDrafts: vi.fn(),
    setProjectPurposeMode: vi.fn(),
    startCodexLogin: vi.fn(),
    submitAnswer: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderEnglishMarkup(<QuestionsView controller={controller as DecisionQueueShellController} />);
}

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

    const markup = renderQuestionsView({
      projections: {
        ...emptyProjectionState(),
        queue
      },
      sections: [
        {
          id: "active",
          title: "Current questions",
          emptyLabel: "No current questions.",
          items: queue.active
        }
      ]
    });

    expect(markup).toContain("Up to date");
    expect(markup).toContain("Queue");
    expect(markup).not.toContain("Idea summary");
    expect(markup).not.toContain("Goal description");
    expect(markup).toContain("Suggested answer choices");
    expect(markup).toContain("Pro: Fast interviews with a narrow segment.");
    expect(markup).toContain("Con: May miss team buyer needs.");
    expect(markup).toContain("Write a different answer if none fit");
    expect(markup.indexOf("Suggested answer choices")).toBeLessThan(
      markup.indexOf("Write a different answer if none fit")
    );
  });


});
