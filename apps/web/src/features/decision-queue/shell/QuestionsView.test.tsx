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

const DEFAULT_QUESTION_PROGRESS = {
  generatedQuestionCount: 0,
  openQuestionCount: 0,
  answeredQuestionCount: 0,
  terminalQuestionCount: 0,
  followUpQuestionCount: 0,
  followUpOpenQuestionCount: 0,
  topicCoverageCount: 0,
  openTopicCoverageCount: 0,
  followUpBudgetRemainingCount: 0,
  visibleQuestionDebtCount: 0,
  activeQuestionCount: 0,
  upcomingQuestionCount: 0,
  blockedQuestionCount: 0,
  completionPercent: 0
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
    loadNextQuestionBatch: vi.fn(),
    projectPurposeMode: null,
    projections: emptyProjectionState(),
    questionProgress: DEFAULT_QUESTION_PROGRESS,
    queueRecovery: DEFAULT_QUEUE_RECOVERY,
    refreshQuestionList: vi.fn(),
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
    expect(markup).toContain("Question progress");
    expect(markup).toContain("Refresh question list");
    expect(markup).toContain("Load next questions");
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

  it("renders question coaching context so founders know why a card is being asked", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_coaching_1" as QueueItemId,
          title: "Which workflow breaks most often today?",
          state: "active",
          whyItMatters: "If the painful workflow is unclear, the first build slice can solve the wrong job.",
          decisionItUnlocks: "Locks the first workflow slice and the success metric."
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

    expect(markup).toContain("Why this matters");
    expect(markup).toContain("If the painful workflow is unclear");
    expect(markup).toContain("Decision this unlocks");
    expect(markup).toContain("Locks the first workflow slice");
    expect(markup).toContain("Current");
    expect(markup).not.toContain(">active<");
    expect(markup).not.toContain("whyItMatters");
    expect(markup).not.toContain("decisionItUnlocks");
  });

  it("keeps known-risk entry folded behind an additional comment/risk disclosure", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_risk_1" as QueueItemId,
          title: "What risk should stay visible?",
          state: "active",
          businessCriticCategory: "legal_ops_security",
          businessCriticPressureKind: "core_assumption_challenge"
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

    expect(markup).toContain("<details");
    expect(markup).toContain("Add comment or risk");
    expect(markup).toContain("Keep as a known risk");
    expect(markup).toContain("Legal, operations, and security");
    expect(markup).toContain("Core assumption check");
    expect(markup).not.toContain("legal_ops_security");
    expect(markup).not.toContain("core_assumption_challenge");
  });

  it("renders question debt progress so long sessions show generated, answered, follow-up, and visible counts", () => {
    const markup = renderQuestionsView({
      questionProgress: {
        generatedQuestionCount: 23,
        openQuestionCount: 18,
        answeredQuestionCount: 4,
        terminalQuestionCount: 5,
        followUpQuestionCount: 8,
        followUpOpenQuestionCount: 7,
        topicCoverageCount: 12,
        openTopicCoverageCount: 9,
        followUpBudgetRemainingCount: 40,
        visibleQuestionDebtCount: 6,
        activeQuestionCount: 5,
        upcomingQuestionCount: 1,
        blockedQuestionCount: 0,
        completionPercent: 22
      }
    });

    expect(markup).toContain("5/23 generated questions handled · 22%");
    expect(markup).toContain("Generated");
    expect(markup).toContain("Open debt");
    expect(markup).toContain("Visible now");
    expect(markup).toContain("Answered");
    expect(markup).toContain("Follow-ups");
    expect(markup).toContain("Topics covered");
    expect(markup).toContain("Open topics");
    expect(markup).toContain("Follow-up budget");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("<dd>23</dd>");
    expect(markup).toContain("<dd>18</dd>");
    expect(markup).toContain("<dd>6</dd>");
    expect(markup).toContain("<dd>8</dd>");
    expect(markup).toContain("<dd>12</dd>");
    expect(markup).toContain("<dd>9</dd>");
    expect(markup).toContain("<dd>40</dd>");
  });

  it("clamps displayed question progress percentages to the visible 0 to 100 range", () => {
    const markup = renderQuestionsView({
      questionProgress: {
        ...DEFAULT_QUESTION_PROGRESS,
        generatedQuestionCount: 23,
        terminalQuestionCount: 25,
        completionPercent: 140
      }
    });

    expect(markup).toContain("25/23 generated questions handled · 100%");
    expect(markup).toContain('style="width:100%"');
    expect(markup).not.toContain("140%");
  });

  it("renders research-generated additional questions on research-updated queue cards", () => {
    const markup = renderQuestionsView({
      sections: [
        {
          id: "blocked",
          title: "Needs attention",
          emptyLabel: "No blocked items.",
          items: [
            {
              queueItemId: "research_review_follow_up" as QueueItemId,
              title: "Evidence still insufficient: Validate paid founder urgency",
              state: "blocked",
              cardType: "follow_up_question",
              additionalQuestions: [
                "What evidence would resolve Validate paid founder urgency?"
              ]
            }
          ]
        }
      ]
    });

    expect(markup).toContain("Research-generated questions");
    expect(markup).toContain("What evidence would resolve Validate paid founder urgency?");
    expect(markup).toContain("Blocked");
    expect(markup).not.toContain(">blocked<");
  });


});
