/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CommandId,
  CommandResponse,
  CorrelationId,
  DecisionQueueProjection,
  ProjectId,
  ProjectionVersion,
  SessionId,
  SessionShellProjection,
  StateVersion
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { emptyProjectionState } from "./decision-queue-shell-model";
import {
  INITIAL_QUESTION_GENERATION_DECISION_MS,
  useDecisionQueueSessionActions
} from "./useDecisionQueueSessionActions";

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

afterEach(() => {
  mountedRoot?.unmount();
  mountedContainer?.remove();
  mountedRoot = null;
  mountedContainer = null;
  vi.useRealTimers();
});

async function waitFor(expectation: () => void) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      expectation();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Timed out waiting for expectation.");
}

function initialQueueFlowSubmitEvent() {
  return { preventDefault: vi.fn() } as unknown as Parameters<
    ReturnType<typeof useDecisionQueueSessionActions>["runInitialQueueFlow"]
  >[0];
}

function commandResponse<TProjection>(
  index: number,
  immediateProjection?: TProjection
): CommandResponse<TProjection> {
  return {
    ok: true,
    category: immediateProjection ? "accepted_with_projection" : "accepted",
    commandId: `cmd_initial_generation_${index}` as CommandId,
    correlationId: `corr_initial_generation_${index}` as CorrelationId,
    stateVersionBefore: (index - 1) as StateVersion,
    stateVersionAfter: index as StateVersion,
    ...(immediateProjection ? { immediateProjection } : {})
  } as CommandResponse<TProjection>;
}

describe("useDecisionQueueSessionActions initial live question controls", () => {
  it("keeps retry status when a delayed retry attempt is told to keep waiting", async () => {
    vi.useFakeTimers();

    const sessionId = "sess_initial_generation_retry" as SessionId;
    const sessionProjection: SessionShellProjection = {
      kind: "SessionShellProjection",
      projectId: "proj_initial_generation_retry" as ProjectId,
      sessionId,
      version: 1 as ProjectionVersion,
      phase: "intake",
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "Business validation",
      projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
    };
    const queueProjection: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 5 as ProjectionVersion,
      active: [],
      next: [],
      blocked: [],
      deferred: []
    };
    const fallbackQuestionSet = {
      schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
      sourceSummary: "fallback",
      questions: []
    };
    const generateInitialQuestionSet = vi.fn(
      async (
        input: Parameters<
          NonNullable<Parameters<typeof useDecisionQueueSessionActions>[0]["generateInitialQuestionSet"]>
        >[0]
      ) => {
        if (input.generationMode === "local_fallback") {
          return {
            status: "generated" as const,
            source: "local_fallback" as const,
            generatedQuestionSet: fallbackQuestionSet
          };
        }

        return new Promise<undefined>(() => undefined);
      }
    );
    let actions: ReturnType<typeof useDecisionQueueSessionActions> | undefined;

    function Harness() {
      actions = useDecisionQueueSessionActions({
        answerDrafts: {},
        appendCommand: async (_label, response) => response,
        businessCriticIntensity: "strong",
        businessCriticIntensityChangeReason: "",
        chatGptLoginAcknowledged: true,
        codexLoginAuthenticated: true,
        client: {
          createProject: vi.fn(async () => commandResponse(1, sessionProjection)),
          captureIntake: vi.fn(async () => commandResponse(2)),
          draftInitialSpec: vi.fn(async () => commandResponse(3)),
          generateInitialQuestionSet,
          analyzeAmbiguity: vi.fn(async () => commandResponse(4)),
          activateQuestionBatch: vi.fn(async () => commandResponse(5, queueProjection))
        } as unknown as SidecarClient,
        connectionStatus: "connected",
        copy: DECISION_QUEUE_COPY.en,
        idea: "AI career transition planner",
        initialResearchAutomationPermission: "manual_only",
        initialBusinessCriticIntensityReason: "",
        intake: "Start with the biggest planning bottleneck before counterexamples.",
        isBusy: false,
        knownRiskDrafts: {},
        projectPurposeMode: "business",
        projections: emptyProjectionState(),
        purposeModeChangeReason: "",
        questionBatchSize: 1,
        refetchQueueAfterSseNotification: vi.fn(async () => undefined),
        refreshProjections: vi.fn(async () => undefined),
        researchDrafts: {},
        setAnswerDrafts: vi.fn(),
        setBusinessCriticIntensity: vi.fn(),
        setBusinessCriticIntensityChangeReason: vi.fn(),
        setCommandLog: vi.fn(),
        setIsBusy: vi.fn(),
        setKnownRiskDrafts: vi.fn(),
        setPhase15bReadiness: vi.fn(),
        setProjectPurposeMode: vi.fn(),
        setProjections: vi.fn(),
        setPurposeModeChangeReason: vi.fn(),
        setResearchDrafts: vi.fn(),
        setResearchOperations: vi.fn(),
        setStatuses: vi.fn(),
        setWorkflowError: vi.fn()
      });

      return null;
    }

    mountedContainer = document.createElement("div");
    document.body.append(mountedContainer);
    mountedRoot = createRoot(mountedContainer);

    await act(async () => {
      mountedRoot?.render(<Harness />);
    });

    if (!actions) {
      throw new Error("Session actions were not captured.");
    }

    const runPromise = actions.runInitialQueueFlow(initialQueueFlowSubmitEvent());

    await waitFor(() => {
      expect(generateInitialQuestionSet).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      vi.advanceTimersByTime(INITIAL_QUESTION_GENERATION_DECISION_MS);
    });
    await waitFor(() => {
      expect(actions?.initialQuestionGeneration.status).toBe("delayed");
    });

    await act(async () => {
      actions?.retryInitialQuestionGeneration();
    });
    await waitFor(() => {
      expect(generateInitialQuestionSet).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      vi.advanceTimersByTime(INITIAL_QUESTION_GENERATION_DECISION_MS);
    });
    await waitFor(() => {
      expect(actions?.initialQuestionGeneration.status).toBe("delayed");
    });

    await act(async () => {
      actions?.keepWaitingForInitialQuestionGeneration();
    });

    expect(actions?.initialQuestionGeneration.status).toBe("retrying");
    expect(actions?.initialQuestionGeneration.countdownSeconds).toBe(60);

    await act(async () => {
      actions?.requestInitialQuestionFallback();
    });
    await runPromise;
  });
});
