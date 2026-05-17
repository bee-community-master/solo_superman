import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CodexRuntimeStatusDto } from "@solo-superman/contracts";
import { AppLanguageProvider } from "../../../shared/i18n/app-language";
import { OnboardingView } from "./OnboardingView";
import { DEFAULT_IDEA, DEFAULT_INTAKE, emptyProjectionState } from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

function codexRuntimeStatus(
  account: Partial<CodexRuntimeStatusDto["account"]> = {}
): CodexRuntimeStatusDto {
  return {
    status: "unavailable",
    adapterVersion: "codex-app-server-preview-v1",
    generatedSchemaVersion: "codex-cli-0.128.0",
    transport: "stdio",
    checkedAt: "2026-05-17T00:00:00.000Z",
    manualHandoffAvailable: true,
    account: {
      status: "missing",
      loginCommand: "codex auth login",
      loginStatusCommand: "codex login status",
      ...account
    }
  };
}

function renderOnboardingView(controllerOverrides: Partial<DecisionQueueShellController> = {}) {
  const controller = {
    businessCriticIntensity: null,
    canStart: false,
    chatGptLoginAcknowledged: false,
    codexLoginStart: null,
    idea: "",
    initialBusinessCriticIntensityReason: "",
    intake: "",
    isBusy: false,
    projectPurposeMode: null,
    projections: emptyProjectionState(),
    refreshRuntimeStatus: vi.fn(),
    runInitialQueueFlow: vi.fn(),
    setBusinessCriticIntensity: vi.fn(),
    setChatGptLoginAcknowledged: vi.fn(),
    setIdea: vi.fn(),
    setInitialBusinessCriticIntensityReason: vi.fn(),
    setIntake: vi.fn(),
    setProjectPurposeMode: vi.fn(),
    startCodexLogin: vi.fn(),
    ...controllerOverrides
  } as unknown as DecisionQueueShellController;

  return renderToStaticMarkup(
    <AppLanguageProvider initialLanguage="en">
      <OnboardingView controller={controller} />
    </AppLanguageProvider>
  );
}

describe("OnboardingView", () => {
  it("renders login gates on the left and the larger goal setup area on the right", () => {
    const markup = renderOnboardingView({
      idea: DEFAULT_IDEA,
      intake: DEFAULT_INTAKE
    });

    expect(markup).toContain('class="session-start-layout"');
    expect(markup).toContain('class="session-login-column"');
    expect(markup).toContain('class="session-goal-column"');
    expect(markup).toContain('class="session-idea-field"');
    expect(markup).toContain('rows="6"');
    expect(markup).toContain('class="session-intake-field"');
    expect(markup).toContain('rows="8"');
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
    const markup = renderOnboardingView({
      runtimeStatus: codexRuntimeStatus({
        reason: "Codex CLI is not logged in for this local environment."
      })
    });

    expect(markup).toContain("Sign in to Codex CLI for backend questions and research");
    expect(markup).toContain("Codex status");
    expect(markup).toContain("Login required");
    expect(markup).toContain("codex auth login");
    expect(markup).toContain("Open Codex login");
    expect(markup).toContain("Refresh Codex login status");
    expect(markup.indexOf("Sign in to Codex CLI for backend questions and research")).toBeLessThan(
      markup.indexOf("Idea summary")
    );
  });

  it("disables Codex login actions while another local action is running", () => {
    const markup = renderOnboardingView({
      isBusy: true,
      runtimeStatus: codexRuntimeStatus()
    });

    expect(markup).toContain('<button type="button" disabled="">Open Codex login</button>');
    expect(markup).toContain('<button type="button" disabled="">Refresh Codex login status</button>');
  });

  it("keeps Codex login feedback visible when runtime status is still unknown", () => {
    const markup = renderOnboardingView({
      codexLoginStart: {
        status: "unavailable",
        command: "codex auth login",
        statusCommand: "codex login status",
        startedAt: "2026-05-17T00:00:00.000Z",
        terminal: "none",
        message: "The local service is not connected. Start Solo Superman with `pnpm start:local`, then reconnect and try Codex login again."
      }
    });

    expect(markup).toContain("Codex status");
    expect(markup).toContain("Unknown");
    expect(markup).toContain("codex auth login");
    expect(markup).toContain("Open Codex login");
    expect(markup).toContain("The local service is not connected.");
  });
});
