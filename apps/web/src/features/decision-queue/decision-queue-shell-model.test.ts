import { describe, expect, it } from "vitest";
import { SidecarClientError } from "../../shared/api/sidecar-client";
import {
  DEFAULT_IDEA,
  DEFAULT_INTAKE,
  INITIAL_QUEUE_START_BLOCKER_MESSAGES,
  canStartInitialQueueFlow,
  displayError,
  emptyProjectionState,
  initialQueueStartBlocker,
  latestProjectionVersion,
  type InitialQueueStartBlocker,
  type InitialQueueStartReadinessInput,
  type ProjectionState
} from "./shell/decision-queue-shell-model";

const READY_INITIAL_QUEUE_START_INPUT = {
  chatGptLoginAcknowledged: true,
  connectionStatus: "connected",
  hasClient: true,
  projectPurposeMode: "personal",
  businessCriticIntensity: null,
  idea: "A focused founder brief generator",
  intake: "Help solo founders turn a rough idea into a traceable product spec before they start building.",
  isBusy: false
} as const satisfies InitialQueueStartReadinessInput;

function readyStartInput(overrides: Partial<InitialQueueStartReadinessInput> = {}): InitialQueueStartReadinessInput {
  return {
    ...READY_INITIAL_QUEUE_START_INPUT,
    ...overrides
  };
}

function expectStartBlocker(
  overrides: Partial<InitialQueueStartReadinessInput>,
  expectedBlocker: InitialQueueStartBlocker
) {
  expect(initialQueueStartBlocker(readyStartInput(overrides))).toBe(expectedBlocker);
}

describe("decision queue shell model", () => {
  it("starts first-run fields empty so examples stay as guidance instead of answers", () => {
    expect(DEFAULT_IDEA).toBe("");
    expect(DEFAULT_INTAKE).toBe("");
  });

  it("keeps sidecar API error codes visible in workflow errors", () => {
    const error = new SidecarClientError(
      {
        code: "COMMAND_PRECONDITION_FAILED",
        message: "Score completeness requires an active session."
      },
      409
    );

    expect(displayError(error)).toBe(
      "COMMAND_PRECONDITION_FAILED: Score completeness requires an active session."
    );
  });

  it("uses the unknown local service error fallback for non-Error throws", () => {
    expect(displayError(undefined)).toBe("Unknown local service error.");
  });

  it("keeps every refreshed projection in the expected state-version calculation", () => {
    const projections = {
      ...emptyProjectionState(),
      session: { version: 1 },
      spec: { version: 2 },
      queue: { version: 3 },
      research: { version: 4 },
      activity: { version: 5 },
      confidence: { version: 6 },
      founderBrief: { version: 7 },
      planningHandoff: { version: 8 },
      chatGptDelegation: { version: 9 },
      servicePageUsePermission: { version: 10 },
      implementationStepLedger: { version: 11 }
    } as unknown as ProjectionState;

    expect(latestProjectionVersion(projections)).toBe(11);
  });

  it("requires explicit ChatGPT direct-login acknowledgement before starting onboarding", () => {
    expect(canStartInitialQueueFlow(READY_INITIAL_QUEUE_START_INPUT)).toBe(true);
    expect(canStartInitialQueueFlow(readyStartInput({ chatGptLoginAcknowledged: false }))).toBe(false);
    expectStartBlocker({ chatGptLoginAcknowledged: false }, "chatgpt_login");
    expect(INITIAL_QUEUE_START_BLOCKER_MESSAGES.chatgpt_login).toContain("ChatGPT");
  });

  it("keeps the business critic intensity gate after ChatGPT login is acknowledged", () => {
    expect(
      canStartInitialQueueFlow(readyStartInput({
        projectPurposeMode: "business",
        businessCriticIntensity: null
      }))
    ).toBe(false);
  });

  it("keeps submit handler and disabled-button readiness on one blocker contract", () => {
    expectStartBlocker({ isBusy: true }, "busy");
    expectStartBlocker({ connectionStatus: "unavailable" }, "sidecar_connection");
    expectStartBlocker({ hasClient: false }, "sidecar_connection");
    expectStartBlocker({ projectPurposeMode: null }, "project_purpose");
    expectStartBlocker({ idea: "   " }, "idea");
    expectStartBlocker({ intake: "   " }, "intake");
    expect(canStartInitialQueueFlow(readyStartInput({ intake: "   " }))).toBe(false);
  });

});
