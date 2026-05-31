import { describe, expect, it, vi } from "vitest";
import type {
  DecisionQueueProjection,
  ProjectionVersion,
  ProjectId,
  QueueItemId,
  SessionId
} from "@solo-superman/contracts";
import { renderMarkup } from "../test-rendering";
import { QuestionsView, answerDraftFromSelectedOptions, answerDraftFromSelectionAndNote } from "./QuestionsView";
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
  backlogQuestionCount: 0,
  completionPercent: 0
} as const;

function activeSessionProjection() {
  return {
    kind: "SessionShellProjection",
    projectId: "proj_questions" as ProjectId,
    sessionId: "sess_questions" as SessionId,
    version: 1 as ProjectionVersion,
    phase: "spec",
    projectPurposeMode: "business",
    projectPurposeModeSelectionStatus: "confirmed",
    projectPurposeModeLabel: "Business validation",
    projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
  } as const;
}

function renderQuestionsView(
  controllerOverrides: Partial<DecisionQueueShellController> = {},
  initialLanguage: Parameters<typeof renderMarkup>[1] = "en"
) {
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
    questionBatchSize: 5,
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
    setQuestionBatchSize: vi.fn(),
    setKnownRiskDrafts: vi.fn(),
    setProjectPurposeMode: vi.fn(),
    startCodexLogin: vi.fn(),
    submitAnswer: vi.fn(),
    submitDraftedActiveAnswers: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderMarkup(<QuestionsView controller={controller as DecisionQueueShellController} />, initialLanguage);
}

describe("QuestionsView", () => {
  it("drafts ranked choices in the order the user selected them", () => {
    const answerOptions = [
      {
        id: "pain",
        label: "Pain strength",
        value: "Rank pain strength first.",
        pro: "Shows urgency.",
        con: "May overfocus on interviews."
      },
      {
        id: "speed",
        label: "Validation speed",
        value: "Rank validation speed first.",
        pro: "Gets faster signal.",
        con: "May miss depth."
      }
    ];

    expect(answerDraftFromSelectedOptions(answerOptions, ["speed", "pain"], "ranked")).toBe(
      "1. Rank validation speed first.\n2. Rank pain strength first."
    );
    expect(answerDraftFromSelectedOptions(answerOptions, ["speed", "pain"], "multiple")).toBe(
      "Rank validation speed first.\nRank pain strength first."
    );
    expect(answerDraftFromSelectionAndNote(answerOptions, ["speed", "pain"], "multiple", "Pick both, but start with speed.")).toBe(
      "Rank validation speed first.\nRank pain strength first.\n\nPick both, but start with speed."
    );
    expect(answerDraftFromSelectionAndNote(answerOptions, ["speed", "pain"], "ranked", "Re-check after first interviews.")).toBe(
      "1. Rank validation speed first.\n2. Rank pain strength first.\n\nRe-check after first interviews."
    );
    expect(answerDraftFromSelectionAndNote(answerOptions, [], "single", "Use a different customer segment.")).toBe(
      "Use a different customer segment."
    );
  });

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
    expect(markup).toContain("Questions per batch");
    expect(markup).toContain("Choose a smaller batch when the session feels heavy");
    expect(markup).not.toContain("Idea summary");
    expect(markup).not.toContain("Goal description");
    expect(markup).toContain("Choose one");
    expect(markup).toContain("Answer choices");
    expect(markup).toContain("Decision made: Fast interviews with a narrow segment.");
    expect(markup).toContain("Check next: May miss team buyer needs.");
    expect(markup).not.toContain("Helps with: Fast interviews with a narrow segment.");
    expect(markup).not.toContain("Watch out: May miss team buyer needs.");
    expect(markup).not.toContain("Pro: Fast interviews with a narrow segment.");
    expect(markup).not.toContain("Con: May miss team buyer needs.");
    expect(markup).toContain("Add a reason or write a different answer");
    expect(markup.indexOf("Answer choices")).toBeLessThan(
      markup.indexOf("Add a reason or write a different answer")
    );
  });

  it("shows the composed selected answer preview before submitting mixed choice and written reasons", () => {
    const queueItemId = "queue_choice_preview" as QueueItemId;
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId,
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
      answerDrafts: {
        [queueItemId]: "Validate solo founders first.\n\nOnly if they already have a manual workaround."
      },
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

    expect(markup).toContain("Answer that will be submitted");
    expect(markup).toContain("This combines selected options with your written reason.");
    expect(markup).toContain("Validate solo founders first.");
    expect(markup).toContain("Only if they already have a manual workaround.");
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
    expect(markup).not.toContain("Add a reason or write a different answer");
    expect(markup).toContain(">Answer</span>");
  });

  it("uses neutral option details instead of treating every option as pro/con evidence", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_neutral_option_details" as QueueItemId,
          title: "Choose the customer segment that fits best.",
          state: "active",
          expectedAnswerType: "choice",
          answerOptions: [
            {
              id: "solo_founder",
              label: "Solo founder",
              value: "Focus on solo founders.",
              primaryDetail: "Locks the first interviews to solo founders.",
              secondaryDetail: "Team workflows stay as a later comparison.",
              pro: "Legacy pro wording should not be shown.",
              con: "Legacy con wording should not be shown."
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

    expect(markup).toContain("Decision made: Locks the first interviews to solo founders.");
    expect(markup).toContain("Check next: Team workflows stay as a later comparison.");
    expect(markup).not.toContain("Legacy pro wording should not be shown.");
    expect(markup).not.toContain("Legacy con wording should not be shown.");
  });

  it("keeps candidate choices as one-of-many even when the question mentions pro/con evidence context", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_candidate_with_evidence_context" as QueueItemId,
          title:
            "리서치 단서는 참고용입니다. 후보는 개인 창업자, 팀 리더, 운영 담당자입니다. 고객 후보를 선택해주세요.",
          state: "active",
          expectedAnswerType: "choice",
          answerOptions: [
            {
              id: "solo_founder",
              label: "Solo founder",
              value: "Focus on solo founders.",
              pro: "Narrows the first customer segment.",
              con: "Team buyer needs may be deferred."
            },
            {
              id: "team_leader",
              label: "Team leader",
              value: "Focus on team leaders.",
              pro: "Keeps budget ownership visible.",
              con: "Sales cycle may be slower."
            },
            {
              id: "ops_owner",
              label: "Operations owner",
              value: "Focus on operations owners.",
              pro: "Matches repeated coordination pain.",
              con: "Role boundaries may vary."
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

    expect(markup).toContain("Choose one");
    expect(markup).toContain("Answer choices");
    expect(markup).toContain("Decision made: Narrows the first customer segment.");
    expect(markup).toContain("Check next: Team buyer needs may be deferred.");
    expect(markup).not.toContain("Agree/disagree choice");
    expect(markup).not.toContain("Stance choices");
    expect(markup).not.toContain("Condition or uncertainty: Team buyer needs may be deferred.");
  });

  it("renders research-named customer candidates with Korean answer-form chrome", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_korean_research_candidates" as QueueItemId,
          title:
            "첫 고객 세그먼트 후보를 조금 더 구체화하기 위해 리서치 결과를 모아보니 독립 컨설턴트, 부트캠프 강사, 소규모 에이전시 운영자 같은 단서가 나타났습니다.\n\n리서치 단서에서 우선 비교할 고객 후보는 다음과 같습니다:\n- 독립 컨설턴트\n- 부트캠프 강사\n- 소규모 에이전시 운영자\n\n어느 성향의 고객에 집중하시겠습니까?",
          state: "active",
          cardType: "follow_up_question",
          expectedAnswerType: "choice",
          answerSelectionMode: "single",
          answerOptions: [
            {
              id: "question_candidate_1",
              label: "독립 컨설턴트",
              value: "독립 컨설턴트 후보를 선택한다.",
              primaryDetail: "리서치에서 이름으로 나온 고객 후보입니다.",
              secondaryDetail: "조건이나 제외 범위가 모호하면 아래 입력칸에 보완 설명이 필요합니다.",
              pro: "리서치에서 이름으로 나온 고객 후보입니다.",
              con: "조건이나 제외 범위가 모호하면 아래 입력칸에 보완 설명이 필요합니다."
            },
            {
              id: "question_candidate_2",
              label: "부트캠프 강사",
              value: "부트캠프 강사 후보를 선택한다.",
              primaryDetail: "리서치에서 이름으로 나온 고객 후보입니다.",
              secondaryDetail: "교육 시장 표본을 추가 확인해야 합니다.",
              pro: "리서치에서 이름으로 나온 고객 후보입니다.",
              con: "교육 시장 표본을 추가 확인해야 합니다."
            },
            {
              id: "question_candidate_3",
              label: "소규모 에이전시 운영자",
              value: "소규모 에이전시 운영자 후보를 선택한다.",
              primaryDetail: "리서치에서 이름으로 나온 고객 후보입니다.",
              secondaryDetail: "팀 규모와 구매 권한이 다를 수 있습니다.",
              pro: "리서치에서 이름으로 나온 고객 후보입니다.",
              con: "팀 규모와 구매 권한이 다를 수 있습니다."
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
          title: "현재 질문",
          emptyLabel: "현재 질문이 없습니다.",
          items: queue.active
        }
      ]
    }, "ko");

    expect(markup).toContain("하나 선택");
    expect(markup).toContain("답변 선택지");
    expect(markup).toContain("정해지는 후보: 리서치에서 이름으로 나온 고객 후보입니다.");
    expect(markup).toContain("추가 확인할 점: 교육 시장 표본을 추가 확인해야 합니다.");
    expect(markup).toContain("선택 이유를 덧붙이거나 다른 답변 작성");
    expect(markup).toContain("독립 컨설턴트");
    expect(markup).toContain("부트캠프 강사");
    expect(markup).toContain("소규모 에이전시 운영자");
    expect(markup).toContain('type="radio"');
    expect(markup).not.toContain("Choose one");
    expect(markup).not.toContain("Answer choices");
    expect(markup).not.toContain("Add a reason or write a different answer");
    expect(markup).not.toContain("Decision made:");
  });

  it("preserves non-choice answer format labels even when no suggested choices are available", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_rank_text" as QueueItemId,
          title: "Rank the first validation risks in your own words.",
          state: "active",
          expectedAnswerType: "rank",
          answerOptions: []
        },
        {
          queueItemId: "queue_evidence_text" as QueueItemId,
          title: "Explain what evidence would change the decision.",
          state: "active",
          expectedAnswerType: "evidence",
          answerOptions: []
        },
        {
          queueItemId: "queue_experiment_text" as QueueItemId,
          title: "Describe the smallest validation experiment.",
          state: "active",
          expectedAnswerType: "experiment",
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

    expect(markup).toContain("Priority/ranking answer");
    expect(markup).toContain("Use the choices if shown as priority strategies, or write the actual order yourself.");
    expect(markup).toContain("Evidence judgment");
    expect(markup).toContain("Choose an evidence decision if choices are shown, or write what is still uncertain.");
    expect(markup).toContain("Validation plan answer");
    expect(markup).toContain("Choose a validation approach if choices are shown, or write a different experiment plan.");
    expect(markup).not.toContain("Priority choices");
    expect(markup).not.toContain("Evidence judgment choices");
    expect(markup).not.toContain("Validation choices");
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

    expect(markup).toContain("Why ask this");
    expect(markup).toContain("If the painful workflow is unclear");
    expect(markup).toContain("What this answer decides");
    expect(markup).toContain("Locks the first workflow slice");
    expect(markup).toContain("Current");
    expect(markup).not.toContain(">active<");
    expect(markup).not.toContain("whyItMatters");
    expect(markup).not.toContain("decisionItUnlocks");
  });

  it("renders structured idea and goal context separately from the question text", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_context_1" as QueueItemId,
          title: "사용자가 돈을 내기 망설일 가장 큰 이유는 무엇인가요?",
          state: "active",
          questionContext: {
            idea: "반려동물의 요람에서 무덤까지 관리하는 앱",
            goal: "보호자가 모든 정보를 한곳에서 관리하고 운영자는 돈을 벌고 싶다."
          }
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
    }, "ko");

    expect(markup).toContain("근거 문장");
    expect(markup).toContain("아이디어");
    expect(markup).toContain("반려동물의 요람에서 무덤까지 관리하는 앱");
    expect(markup).toContain("목표");
    expect(markup).toContain("보호자가 모든 정보를 한곳에서 관리하고 운영자는 돈을 벌고 싶다.");
    expect(markup).toContain("질문");
    expect(markup).toContain("사용자가 돈을 내기 망설일 가장 큰 이유는 무엇인가요?");
    expect(markup).not.toContain("아이디어 “반려동물의 요람에서 무덤까지 관리하는 앱”와 목표");
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
    expect(markup).toContain("Keep as a later check instead of answering");
    expect(markup).toContain("Use this separate action only when you want to stop answering this card now");
    expect(markup).toContain("Keep for later checking");
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
    expect(markup).toContain("Keep as a later check instead of answering");
    expect(markup).toContain("Use this separate action only when you want to stop answering this card now");
    expect(markup).toContain("Keep for later checking");
    expect(markup).not.toContain("Customer pain");
  });

  it("renders question debt progress so long sessions show generated, active, upcoming, follow-up, and visible counts", () => {
    const markup = renderQuestionsView({
      projections: {
        ...emptyProjectionState(),
        session: activeSessionProjection()
      },
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
        backlogQuestionCount: 12,
        completionPercent: 22
      }
    });

    expect(markup).toContain("Question loop next action");
    expect(markup).toContain("Answer the 5 active questions; the loop can continue automatically after the current batch is cleared.");
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
    expect(markup).toContain("Later backlog");
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
    expect(markup).toContain("<dd>12</dd>");
  });

  it("points users to the next question batch when the active batch is clear but debt remains", () => {
    const markup = renderQuestionsView({
      projections: {
        ...emptyProjectionState(),
        session: activeSessionProjection()
      },
      questionBatchSize: 4,
      questionProgress: {
        ...DEFAULT_QUESTION_PROGRESS,
        generatedQuestionCount: 12,
        openQuestionCount: 7,
        terminalQuestionCount: 5,
        upcomingQuestionCount: 3,
        backlogQuestionCount: 4,
        completionPercent: 42
      }
    });

    expect(markup).toContain("Question loop next action");
    expect(markup).toContain("Load the next 3 questions to keep reducing the remaining question debt.");
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
              title: "paid founder urgency를 조금 더 구체화하기 위해 리서치 결과를 모아보니 founders report urgency 같은 단서가 확인되었습니다.\n\n한계와 불확실성은 다른 관점이나 반례가 부족해 과신 가능성이 남아 있습니다.\n\n어느 방향으로 판단하시겠습니까?",
              state: "blocked",
              cardType: "follow_up_question",
              sourceRef: "research:research_task_demo:evidence_matrix_demo:additional_question:1",
              additionalQuestions: [
                "paid founder urgency를 조금 더 구체화하기 위해 리서치 결과를 모아보니 founders report urgency 같은 단서가 확인되었습니다.\n\n한계와 불확실성은 다른 관점이나 반례가 부족해 과신 가능성이 남아 있습니다.\n\n어느 방향으로 판단하시겠습니까?"
              ]
            }
          ]
        }
      ]
    });

    expect(markup).toContain("Research-generated questions");
    expect(markup).toContain("founders report urgency 같은 단서가 확인되었습니다.");
    expect(markup).toContain("한계와 불확실성은 다른 관점이나 반례가 부족해 과신 가능성이 남아 있습니다.");
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
    expect(markup).toContain("Select one or more options, then add a combined reason below if needed.");
    expect(markup).toContain("Keeps in scope: Shows urgency.");
    expect(markup).toContain("Check next: May be narrow.");
    expect(markup).toContain('type="checkbox"');
    expect(markup).not.toContain('type="radio"');
  });

  it("renders ranked answer choices as ordered checkbox input instead of a single radio choice", () => {
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 1 as ProjectionVersion,
      active: [
        {
          queueItemId: "queue_ranked_choice" as QueueItemId,
          title: "Rank the validation candidates.",
          state: "active",
          expectedAnswerType: "rank",
          answerSelectionMode: "ranked",
          answerOptions: [
            {
              id: "pain",
              label: "Pain strength",
              value: "Rank pain strength first.",
              pro: "Shows urgency.",
              con: "May overfocus on interviews."
            },
            {
              id: "speed",
              label: "Validation speed",
              value: "Rank validation speed first.",
              pro: "Gets faster signal.",
              con: "May miss depth."
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

    expect(markup).toContain("Priority/ranking answer");
    expect(markup).toContain("Priority choices");
    expect(markup).toContain("Select candidates in priority order, then add ranking notes below if needed.");
    expect(markup).toContain("Priority effect: Shows urgency.");
    expect(markup).toContain("Trade-off: May overfocus on interviews.");
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
    expect(markup).toContain("If selected: Locks the first customer direction.");
    expect(markup).toContain("Condition or uncertainty: May move too quickly if evidence is thin.");
    expect(markup).toContain('type="radio"');
    expect(markup).not.toContain("Evidence judgment choices");
  });


});
