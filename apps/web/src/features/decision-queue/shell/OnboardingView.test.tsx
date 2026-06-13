import { describe, expect, it, vi } from "vitest";
import {
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_RUNTIME_TRANSPORT,
  CODEX_SDK_PACKAGE_VERSION,
  type CodexRuntimeStatusDto
} from "@solo-superman/contracts";
import { renderEnglishMarkup } from "../test-rendering";
import { OnboardingView } from "./OnboardingView";
import { DEFAULT_IDEA, DEFAULT_INTAKE, emptyProjectionState } from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

const FIXTURE_CODEX_CLI_VERSION = "0.137.0" as const;

function codexRuntimeStatus(
  account: Partial<CodexRuntimeStatusDto["account"]> = {}
): CodexRuntimeStatusDto {
  return {
    status: "unavailable",
    adapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
    sdkPackageVersion: CODEX_SDK_PACKAGE_VERSION,
    codexCliVersion: FIXTURE_CODEX_CLI_VERSION,
    transport: CODEX_RUNTIME_TRANSPORT,
    checkedAt: "2026-05-17T00:00:00.000Z",
    manualHandoffAvailable: true,
    liveTurnExecutionEnabled: false,
    executionMode: "manual_handoff",
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
    continueInitialQuestionGeneration: vi.fn(),
    idea: "",
    initialQuestionGeneration: {
      status: "idle",
      delayed: false,
      canUseFallback: false,
      canRetry: false
    },
    initialBusinessCriticIntensityReason: "",
    initialQueueStartBlockerMessages: [],
    initialResearchAutomationPermission: "allow_codex",
    intake: "",
    isBusy: false,
    projectPurposeMode: null,
    projections: emptyProjectionState(),
    refreshRuntimeStatus: vi.fn(),
    requestInitialQuestionFallback: vi.fn(),
    retryInitialQuestionGeneration: vi.fn(),
    runInitialQueueFlow: vi.fn(),
    setBusinessCriticIntensity: vi.fn(),
    setChatGptLoginAcknowledged: vi.fn(),
    setIdea: vi.fn(),
    setInitialBusinessCriticIntensityReason: vi.fn(),
    setInitialResearchAutomationPermission: vi.fn(),
    setIntake: vi.fn(),
    setProjectPurposeMode: vi.fn(),
    startCodexLogin: vi.fn(),
    ...controllerOverrides
  } satisfies Partial<DecisionQueueShellController>;

  return renderEnglishMarkup(<OnboardingView controller={controller as DecisionQueueShellController} />);
}

describe("OnboardingView", () => {
  it("renders the first-run action strip before setup fields", () => {
    const markup = renderOnboardingView({
      idea: DEFAULT_IDEA,
      intake: DEFAULT_INTAKE
    });

    expect(markup).toContain('class="first-run-action-strip first-run-action-strip-blocked"');
    expect(markup).toContain('class="session-start-layout"');
    expect(markup).toContain('class="session-input-column"');
    expect(markup).toContain('class="session-action-column"');
    expect(markup).toContain('class="session-idea-field"');
    expect(markup).toContain('rows="6"');
    expect(markup).toContain('class="session-intake-field"');
    expect(markup).toContain('rows="8"');
    expect(markup).toContain("Idea summary");
    expect(markup).toContain("Goal description");
    expect(markup).not.toContain("Research permission");
    expect(markup).not.toContain("Set up research later");
    expect(markup).not.toContain("Allow read-only public web research");
    expect(markup).toContain("Research setup");
    expect(markup).toContain("Codex + read-only public web research");
    expect(markup).toContain("Codex + visible ChatGPT Pro/Deep Research");
    expect(markup).not.toContain("Sign in to ChatGPT in your browser first");
    expect(markup.indexOf("First-question readiness checklist")).toBeLessThan(
      markup.indexOf("Idea summary")
    );
    expect(markup.indexOf("Create first questions")).toBeLessThan(markup.indexOf("Idea summary"));
    expect(markup.indexOf("Idea summary")).toBeLessThan(markup.indexOf("Goal description"));
  });

  it("keeps business-only follow-up settings directly after the purpose choice", () => {
    const markup = renderOnboardingView({
      projectPurposeMode: "business"
    });

    expect(markup).toContain("Business review intensity");
    expect(markup.indexOf("Project purpose")).toBeLessThan(markup.indexOf("Business review intensity"));
    expect(markup.indexOf("Business review intensity")).toBeLessThan(markup.indexOf("Research setup"));
  });

  it("shows fallback and retry choices when first question generation is delayed", () => {
    const markup = renderOnboardingView({
      isBusy: true,
      initialQuestionGeneration: {
        status: "delayed",
        delayed: true,
        canUseFallback: true,
        canRetry: true
      }
    });

    expect(markup).toContain("Live generation is taking longer than 30 seconds or is not ready");
    expect(markup).not.toContain("Keep generating");
    expect(markup).toContain("Start with fallback questions");
    expect(markup).toContain("Retry");
  });

  it("shows the ChatGPT login gate only when visible ChatGPT research is selected", () => {
    const hiddenMarkup = renderOnboardingView({
      initialResearchAutomationPermission: "allow_codex"
    });
    const visibleMarkup = renderOnboardingView({
      initialResearchAutomationPermission: "allow_codex_and_chatgpt_visible"
    });

    expect(hiddenMarkup).not.toContain("Sign in to ChatGPT in your browser first");
    expect(visibleMarkup).toContain("Sign in to ChatGPT in your browser first");
    expect(visibleMarkup).toContain("Open ChatGPT");
    expect(visibleMarkup).toContain('href="https://chatgpt.com/"');
    expect(visibleMarkup).toContain('target="_blank"');
    expect(visibleMarkup).toContain('rel="noopener noreferrer"');
    expect(visibleMarkup).toContain("I signed in to ChatGPT directly in this browser/profile.");
    expect(visibleMarkup.indexOf("Research setup")).toBeLessThan(
      visibleMarkup.indexOf("Sign in to ChatGPT in your browser first")
    );
    expect(visibleMarkup.indexOf("Sign in to ChatGPT in your browser first")).toBeLessThan(
      visibleMarkup.indexOf("Sign in to Codex CLI for backend questions and research")
    );
  });

  it("renders backend Codex CLI login status before the first queue can start", () => {
    const markup = renderOnboardingView({
      runtimeStatus: {
        ...codexRuntimeStatus(),
        reason: "Live Codex SDK turn execution is not enabled for this local environment."
      }
    });

    expect(markup).toContain("Sign in to Codex CLI for backend questions and research");
    expect(markup).toContain("Codex status");
    expect(markup).toContain("Login required");
    expect(markup).toContain("codex auth login");
    expect(markup).toContain("Live Codex preview execution is not enabled yet.");
    expect(markup).not.toContain("Live Codex SDK turn execution is not enabled");
    expect(markup).toContain("Open Codex login");
    expect(markup).toContain("Refresh Codex login status");
    expect(markup.indexOf("First-question readiness checklist")).toBeLessThan(
      markup.indexOf("Research setup")
    );
    expect(markup.indexOf("Research setup")).toBeLessThan(
      markup.indexOf("Sign in to Codex CLI for backend questions and research")
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

  it("explains every missing item before the first-question button can be enabled", () => {
    const markup = renderOnboardingView({
      initialQueueStartBlockerMessages: [
        "Confirm direct ChatGPT login before allowing visible ChatGPT Pro/Deep Research handoff.",
        "Choose either business validation or personal workflow build before starting.",
        "Enter an idea summary before starting."
      ]
    });

    expect(markup).toContain("First-question readiness checklist");
    expect(markup).toContain("Before you can start");
    expect(markup).toContain("Complete these items, then the Create first questions button will turn on.");
    expect(markup).toContain("Confirm direct ChatGPT login before allowing visible ChatGPT Pro/Deep Research handoff.");
    expect(markup).toContain("Choose either business validation or personal workflow build before starting.");
    expect(markup).toContain("Enter an idea summary before starting.");
    expect(markup).toContain('<button type="submit" disabled="">Create first questions</button>');
    expect(markup.indexOf("First-question readiness checklist")).toBeLessThan(
      markup.indexOf("Create first questions")
    );
  });

  it("shows a ready state once all first-question prerequisites are complete", () => {
    const markup = renderOnboardingView({
      canStart: true,
      initialQueueStartBlockerMessages: []
    });

    expect(markup).toContain("Ready to create first questions");
    expect(markup).toContain("Everything needed for the first question is in place.");
    expect(markup).toContain('class="first-run-action-strip first-run-action-strip-ready"');
    expect(markup).toContain("<button type=\"submit\">Create first questions</button>");
  });

  it("keeps the first-question CTA disabled while the first-run action is already running", () => {
    const markup = renderOnboardingView({
      canStart: true,
      isBusy: true,
      initialQueueStartBlockerMessages: []
    });

    expect(markup).toContain('<button type="submit" disabled="">Running</button>');
  });

  it("keeps Codex login feedback visible when runtime status is still unknown", () => {
    const markup = renderOnboardingView({
      connectionState: {
        status: "unavailable",
        message: "The local service is not connected. Start Solo Superman with `pnpm start:local`, then reconnect and try Codex login again."
      },
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

  it("shows the runtime status failure reason instead of only showing Unknown", () => {
    const markup = renderOnboardingView({
      runtimeStatus: codexRuntimeStatus({
        status: "unknown",
        reason: "Timed out while checking Codex login status."
      })
    });

    expect(markup).toContain("Unknown");
    expect(markup).toContain("Timed out while checking Codex login status.");
  });
});
