import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DecisionQueueProjection, ProjectionVersion, QueueItemId } from "@solo-superman/contracts";
import { AppLanguageProvider } from "../../../shared/i18n/app-language";
import { QuestionsView } from "./QuestionsView";
import { DEFAULT_IDEA, DEFAULT_INTAKE, emptyProjectionState } from "./decision-queue-shell-model";
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
    submitAnswer: vi.fn(),
    ...controllerOverrides
  } as unknown as DecisionQueueShellController;

  return renderToStaticMarkup(
    <AppLanguageProvider initialLanguage="en">
      <QuestionsView controller={controller} />
    </AppLanguageProvider>
  );
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

    expect(markup).toContain("Idea summary");
    expect(markup).toContain("Goal description");
    expect(markup).toContain("Up to date");
    expect(markup).toContain("Describe who this is for, what problem it solves, and what you want to decide in this session.");
    expect(markup).toContain("Suggested answer choices");
    expect(markup).toContain("Pro: Fast interviews with a narrow segment.");
    expect(markup).toContain("Con: May miss team buyer needs.");
    expect(markup).toContain("Write a different answer if none fit");
    expect(markup.indexOf("Suggested answer choices")).toBeLessThan(
      markup.indexOf("Write a different answer if none fit")
    );
  });

  it("renders the ChatGPT direct-login gate before idea and final goal fields", () => {
    const markup = renderQuestionsView({
      idea: DEFAULT_IDEA,
      intake: DEFAULT_INTAKE
    });

    expect(markup).toContain("Sign in to ChatGPT in your browser first");
    expect(markup).toContain("Open ChatGPT");
    expect(markup).toContain('href="https://chatgpt.com/"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain("I signed in to ChatGPT directly in this browser/profile.");
    expect(markup).toContain("Idea summary");
    expect(markup).toContain("Goal description");
    expect(markup.indexOf("Sign in to ChatGPT in your browser first")).toBeLessThan(
      markup.indexOf("Idea summary")
    );
    expect(markup.indexOf("Idea summary")).toBeLessThan(markup.indexOf("Goal description"));
  });

  it("renders backend Codex CLI login status before the first queue can start", () => {
    const markup = renderQuestionsView({
      runtimeStatus: {
        status: "unavailable",
        adapterVersion: "codex-app-server-preview-v1",
        generatedSchemaVersion: "codex-cli-0.128.0",
        transport: "stdio",
        checkedAt: "2026-05-17T00:00:00.000Z",
        manualHandoffAvailable: true,
        account: {
          status: "missing",
          loginCommand: "codex login",
          loginStatusCommand: "codex login status",
          reason: "Codex CLI is not logged in for this local environment."
        }
      }
    });

    expect(markup).toContain("Sign in to Codex CLI for backend questions and research");
    expect(markup).toContain("Codex status");
    expect(markup).toContain("Login required");
    expect(markup).toContain("codex login");
    expect(markup).toContain("Refresh Codex login status");
    expect(markup.indexOf("Sign in to Codex CLI for backend questions and research")).toBeLessThan(
      markup.indexOf("Idea summary")
    );
  });

});
