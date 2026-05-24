import { describe, expect, it } from "vitest";
import { SidecarClientError } from "../../shared/api/sidecar-client";
import {
  DEFAULT_IDEA,
  DEFAULT_INTAKE,
  canStartInitialQueueFlow,
  displayError,
  emptyProjectionState,
  initialQueueStartBlocker,
  initialQueueStartBlockerList,
  latestCommandBackedProjectionVersion,
  latestProjectionVersion,
  researchRunProjectionFromResponse,
  type InitialQueueStartBlocker,
  type InitialQueueStartReadinessInput,
  type ProjectionVersionSnapshot
} from "./shell/decision-queue-shell-model";

const READY_INITIAL_QUEUE_START_INPUT = {
  chatGptLoginAcknowledged: true,
  codexLoginAuthenticated: true,
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
      implementationStepLedger: { version: 11 },
      autoImplementationRuns: { version: 12 }
    } satisfies ProjectionVersionSnapshot;

    expect(latestProjectionVersion(projections)).toBe(12);
  });

  it("excludes projection-only auto implementation runs from command expected-state versions", () => {
    const projections = {
      ...emptyProjectionState(),
      session: { version: 4 },
      planningHandoff: { version: 5 },
      autoImplementationRuns: { version: 99 }
    } satisfies ProjectionVersionSnapshot;

    expect(latestCommandBackedProjectionVersion(projections)).toBe(5);
  });

  it("keeps malformed research-run command projections as recoverable workflow errors", () => {
    expect(() =>
      researchRunProjectionFromResponse({
        category: "accepted_with_projection",
        commandId: "command_malformed_research",
        correlationId: "correlation_malformed_research",
        stateVersionBefore: 1,
        stateVersionAfter: 2,
        eventIds: [],
        effectTaskIds: [],
        immediateProjection: {
          kind: "ResearchRunControlResult",
          action: "start",
          status: "started",
          projectId: "proj_malformed_research",
          recovery: {
            refetchUrl: "/api/v1/projects/proj_malformed_research/research-runs",
            sseEventNames: ["projection.updated"],
            projectionHints: []
          }
        },
        pendingEffectSummary: {
          totalPending: 0,
          byType: {},
          visibleLabel: "No background tasks are pending."
        },
        projectionHints: [],
        deterministicOutputs: []
      } as never)
    ).toThrow("ResearchRunControlProjection was not returned");
  });

  it("requires explicit ChatGPT direct-login acknowledgement before starting onboarding", () => {
    expect(canStartInitialQueueFlow(READY_INITIAL_QUEUE_START_INPUT)).toBe(true);
    expect(canStartInitialQueueFlow(readyStartInput({ chatGptLoginAcknowledged: false }))).toBe(false);
    expectStartBlocker({ chatGptLoginAcknowledged: false }, "chatgpt_login");
  });

  it("requires backend-visible Codex CLI login before starting onboarding", () => {
    expect(canStartInitialQueueFlow(readyStartInput({ codexLoginAuthenticated: false }))).toBe(false);
    expectStartBlocker({ codexLoginAuthenticated: false }, "codex_login");
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

  it("lists every visible onboarding blocker so disabled starts explain the next steps", () => {
    expect(initialQueueStartBlockerList(READY_INITIAL_QUEUE_START_INPUT)).toEqual([]);
    expect(
      initialQueueStartBlockerList(
        readyStartInput({
          chatGptLoginAcknowledged: false,
          codexLoginAuthenticated: false,
          connectionStatus: "unavailable",
          projectPurposeMode: null,
          idea: " ",
          intake: " "
        })
      )
    ).toEqual([
      "chatgpt_login",
      "sidecar_connection",
      "codex_login",
      "project_purpose",
      "idea",
      "intake"
    ]);
  });

  it("shows the temporary busy state as the only onboarding blocker while work is running", () => {
    expect(
      initialQueueStartBlockerList(
        readyStartInput({
          chatGptLoginAcknowledged: false,
          isBusy: true
        })
      )
    ).toEqual(["busy"]);
  });

});
