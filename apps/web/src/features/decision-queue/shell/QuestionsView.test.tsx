import { describe, expect, it, vi } from "vitest";
import type {
  DecisionQueueProjection,
  ProjectionVersion,
  ProjectId,
  QueueItemId,
  SessionId
} from "@solo-superman/contracts";
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
    submitDraftedActiveAnswers: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderEnglishMarkup(<QuestionsView controller={controller as DecisionQueueShellController} />);
}

describe("QuestionsView", () => {
  it("renders one-of-many answer choices with neutral decision labels above the free-form answer box", () => {
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
    expect(markup).toContain("Choose one");
    expect(markup).toContain("Answer choices");
    expect(markup).toContain("Helps with: Fast interviews with a narrow segment.");
    expect(markup).toContain("Watch out: May miss team buyer needs.");
    expect(markup).not.toContain("Pro: Fast interviews with a narrow segment.");
    expect(markup).not.toContain("Con: May miss team buyer needs.");
    expect(markup).toContain("Write a different answer if none fit");
    expect(markup.indexOf("Answer choices")).toBeLessThan(
      markup.indexOf("Write a different answer if none fit")
    );
  });

  it("renders open-ended questions without forcing suggested choices", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_open_text" as QueueItemId,
          title: "Describe the customer situation in your own words.",
          state: "active",
          expectedAnswerType: "text",
          answerOptions: []
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

    expect(markup).toContain("Describe the customer situation in your own words.");
    expect(markup).toContain("Open-ended answer");
    expect(markup).toContain("No suggested choice is required.");
    expect(markup).not.toContain("Answer choices");
    expect(markup).not.toContain("Write a different answer if none fit");
    expect(markup).toContain(">Answer</span>");
  });

  it("renders a bounded current-batch submit action for drafted active answers", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_batch_answered" as QueueItemId,
          title: "Which buyer should be validated first?",
          state: "active",
          cardType: "question"
        },
        {
          queueItemId: "queue_batch_follow_up" as QueueItemId,
          title: "What evidence would close the risk?",
          state: "active",
          cardType: "follow_up_question"
        },
        {
          queueItemId: "queue_batch_review" as QueueItemId,
          title: "Review research evidence",
          state: "active",
          cardType: "research_review"
        }
      ],
      next: [],
      blocked: [],
      deferred: []
    };

    const markup = renderQuestionsView({
      answerDrafts: {
        queue_batch_answered: "Validate solo founders first.",
        queue_batch_follow_up: "Use five interviews to close the risk.",
        queue_batch_review: "This should not count as an answer draft."
      },
      projections: {
        ...emptyProjectionState(),
        session: {
          kind: "SessionShellProjection",
          projectId: "proj_batch" as ProjectId,
          sessionId: "sess_batch" as SessionId,
          version: 1 as ProjectionVersion,
          phase: "spec",
          projectPurposeMode: "business",
          projectPurposeModeSelectionStatus: "confirmed",
          projectPurposeModeLabel: "Business validation",
          projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
        },
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

    expect(markup).toContain("Submit 2 drafted answers");
    expect(markup).not.toContain("Submit 3 drafted answers");
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

  it("lets ordinary question debt be carried as a known risk instead of forcing every answer immediately", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_generic_risk" as QueueItemId,
          title: "Which customer detail can be checked later?",
          state: "active",
          expectedAnswerType: "text"
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

    expect(markup).toContain("Which customer detail can be checked later?");
    expect(markup).toContain("Add comment or risk");
    expect(markup).toContain("Keep as a known risk");
    expect(markup).not.toContain("Customer pain");
  });

  it("renders question debt progress so long sessions show generated, active, upcoming, follow-up, and visible counts", () => {
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
    expect(markup).toContain("Active now");
    expect(markup).toContain("Upcoming next");
    expect(markup).toContain("Answered");
    expect(markup).toContain("Follow-ups");
    expect(markup).toContain("Open follow-ups");
    expect(markup).toContain("Topics covered");
    expect(markup).toContain("Open topics");
    expect(markup).toContain("Follow-up budget");
    expect(markup).toContain("Blocked");
    expect(markup).toContain("Fatigue checkpoint");
    expect(markup).toContain("18 open questions remain after 22% handled across 23 generated questions.");
    expect(markup).toContain("Answer only the current batch");
    expect(markup).toContain("40 follow-up slots remain; use them deliberately.");
    expect(markup).toContain("<dd>23</dd>");
    expect(markup).toContain("<dd>18</dd>");
    expect(markup).toContain("<dd>6</dd>");
    expect(markup).toContain("<dd>5</dd>");
    expect(markup).toContain("<dd>1</dd>");
    expect(markup).toContain("<dd>8</dd>");
    expect(markup).toContain("<dd>7</dd>");
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
              title: "paid founder urgency를 조금 더 구체화하기 위해 리서치 결과를 모아보니 찬성쪽 근거는 founders report urgency입니다.\n\n한계와 불확실성은 반대 근거가 부족해 과신 가능성이 남아 있습니다.\n\n어느 방향으로 판단하시겠습니까?",
              state: "blocked",
              cardType: "follow_up_question",
              sourceRef: "research:research_task_demo:evidence_matrix_demo:additional_question:1",
              additionalQuestions: [
                "paid founder urgency를 조금 더 구체화하기 위해 리서치 결과를 모아보니 찬성쪽 근거는 founders report urgency입니다.\n\n한계와 불확실성은 반대 근거가 부족해 과신 가능성이 남아 있습니다.\n\n어느 방향으로 판단하시겠습니까?"
              ]
            }
          ]
        }
      ]
    });

    expect(markup).toContain("Research-generated questions");
    expect(markup).toContain("찬성쪽 근거는 founders report urgency입니다.");
    expect(markup).toContain("한계와 불확실성은 반대 근거가 부족해 과신 가능성이 남아 있습니다.");
    expect(markup).not.toContain("What evidence would resolve");
    expect(markup).toContain("Source trace");
    expect(markup).toContain("research:research_task_demo:evidence_matrix_demo:additional_question:1");
    expect(markup).toContain("Blocked");
    expect(markup).not.toContain(">blocked<");
  });

  it("renders multiple-select answer choices when a question accepts more than one option", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_multi_choice" as QueueItemId,
          title: "Which customer signals should be investigated together?",
          state: "active",
          answerSelectionMode: "multiple",
          answerOptions: [
            {
              id: "manual_pain",
              label: "Manual pain",
              value: "Investigate manual pain.",
              pro: "Shows urgency.",
              con: "May be narrow."
            },
            {
              id: "budget_owner",
              label: "Budget owner",
              value: "Investigate budget owner.",
              pro: "Clarifies buyer.",
              con: "May slow interviews."
            },
            {
              id: "repeat_use",
              label: "Repeat use",
              value: "Investigate repeat use.",
              pro: "Clarifies retention.",
              con: "Needs time."
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

    expect(markup).toContain("Choose one or more");
    expect(markup).toContain("Selectable answers");
    expect(markup).toContain("Select one or more options, or write your own answer below.");
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('type="radio"');
  });

  it("labels explicit agree/disagree questions as stance choices instead of generic pro-con review", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_binary_choice" as QueueItemId,
          title: "Do you agree or disagree with narrowing to solo founders first?",
          state: "active",
          expectedAnswerType: "choice",
          answerOptions: [
            {
              id: "agree",
              label: "Agree",
              value: "Agree and continue with solo founders first.",
              pro: "Locks the first customer direction.",
              con: "May move too quickly if evidence is thin."
            },
            {
              id: "disagree",
              label: "Disagree",
              value: "Disagree and keep the segment open.",
              pro: "Keeps alternatives visible.",
              con: "Delays the next implementation slice."
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

    expect(markup).toContain("Agree/disagree choice");
    expect(markup).toContain("Stance choices");
    expect(markup).toContain('type="radio"');
    expect(markup).not.toContain("Evidence judgment choices");
  });


});
