import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  CommandId,
  CommandResponse,
  CorrelationId,
  ProjectId,
  ProjectionVersion,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchConnectorId,
  ResearchRunControlProjection,
  ResearchRunId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { emptyProjectionState, emptyResearchOperationsState } from "./decision-queue-shell-model";
import { useDecisionQueueResearchActions } from "./useDecisionQueueResearchActions";

const projectId = "proj_research_refresh" as ProjectId;
const sessionId = "sess_research_refresh" as SessionId;
const researchRunId = "research_run_refresh" as ResearchRunId;
const allowlistId = "research_allowlist_public_web" as ResearchAllowlistId;

function researchRunProjection(): ResearchRunControlProjection {
  return {
    kind: "ResearchRunControlProjection",
    projectionKind: "ResearchRunProjection",
    projectId,
    version: 2 as ProjectionVersion,
    generatedAt: "2026-05-23T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-runs`,
    statusUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    runs: [],
    recovery: {
      refetchUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`,
      sseEventNames: ["projection.updated"],
      projectionHints: [
        {
          projectionKind: "ResearchRunProjection",
          refetchUrl: `/api/v1/projects/${projectId}/research-runs/${researchRunId}/status`
        }
      ]
    }
  };
}

function allowlistProjection(maxConcurrentRunsPerProject = 2, maxRunsPerSession = 3): ResearchAllowlistGovernanceProjection {
  return {
    kind: "ResearchAllowlistGovernanceProjection",
    projectionKind: "ResearchAllowlistProjection",
    projectId,
    version: 1 as ProjectionVersion,
    generatedAt: "2026-05-23T00:00:00.000Z",
    stale: false,
    refetchUrl: `/api/v1/projects/${projectId}/research-allowlists`,
    pendingEffectSummary: {
      totalPending: 0,
      byType: {},
      visibleLabel: "No async ProductEngine effects are pending."
    },
    allowlists: [
      {
        kind: "ResearchAllowlistProjection",
        version: 1 as ProjectionVersion,
        allowlistId,
        projectId,
        status: "active",
        connectorIds: ["public_search" as ResearchConnectorId],
        sourceCategories: ["public_web"],
        contextMode: "public_safe_summary",
        rateBudgetPolicy: {
          maxConcurrentRunsPerProject,
          maxRunsPerSession,
          maxAutomaticRetriesPerRun: 2,
          runTimeoutSeconds: 600,
          retryBackoffSeconds: [30, 120]
        },
        stalenessPolicy: {
          staleWhenRunExceedsTaskFreshnessWindow: true,
          staleWhenSourcePredatesTaskRequirement: true
        },
        disclosureLogPolicy: {
          logEveryAutomaticRun: true,
          publicSafeSummaryRequired: true
        },
        approvedBy: "web_ui_founder",
        approvedAt: "2026-05-23T00:00:00.000Z",
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z"
      }
    ],
    automaticRunStartPolicies: [
      {
        allowed: true,
        allowlistId,
        allowlistVersion: 1 as ProjectionVersion,
        reason: "active_public_safe_allowlist"
      }
    ]
  };
}

function allowlistCommandResponse(projection = allowlistProjection()): CommandResponse<ResearchAllowlistGovernanceProjection> {
  return {
    category: "accepted_with_projection",
    commandId: "cmd_allowlist_update" as CommandId,
    correlationId: "corr_allowlist_update" as CorrelationId,
    stateVersionBefore: 1 as StateVersion,
    stateVersionAfter: 2 as StateVersion,
    immediateProjection: projection
  };
}

type ResearchActions = ReturnType<typeof useDecisionQueueResearchActions>;

function captureResearchActions(overrides: Partial<Parameters<typeof useDecisionQueueResearchActions>[0]> = {}) {
  let actions: ResearchActions | undefined;
  const defaultProps: Parameters<typeof useDecisionQueueResearchActions>[0] = {
    appendCommand: vi.fn(),
    client: {
      getResearchRunStatus: vi.fn(async () => researchRunProjection())
    } as unknown as SidecarClient,
    copy: DECISION_QUEUE_COPY.en,
    projections: {
      ...emptyProjectionState(),
      session: {
        kind: "SessionShellProjection",
        projectId,
        sessionId,
        version: 1 as ProjectionVersion,
        phase: "spec",
        projectPurposeMode: "business",
        projectPurposeModeSelectionStatus: "confirmed",
        projectPurposeModeLabel: "Business validation",
        projectPurposeModeEffect: "Business validation mode keeps commercialization gates active."
      }
    },
    refreshProjections: vi.fn(async () => undefined),
    refreshResearchOperations: vi.fn(async () => undefined),
    researchOperations: emptyResearchOperationsState(),
    setIsBusy: vi.fn(),
    setProjections: vi.fn(),
    setResearchOperations: vi.fn(),
    setWorkflowError: vi.fn(),
    ...overrides
  };

  function Harness() {
    actions = useDecisionQueueResearchActions(defaultProps);
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!actions) {
    throw new Error("Research actions were not captured.");
  }

  return {
    actions,
    props: defaultProps
  };
}

describe("useDecisionQueueResearchActions", () => {
  it("refreshes canonical queue and research projections after research-run status polling", async () => {
    const { actions, props } = captureResearchActions();

    await actions.refreshResearchRunStatus(researchRunId);

    expect(props.client?.getResearchRunStatus).toHaveBeenCalledWith(projectId, researchRunId);
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshProjections).toHaveBeenCalledWith(projectId, sessionId);
    expect(props.setWorkflowError).toHaveBeenCalledTimes(1);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("updates active allowlist concurrency so manual and answer-triggered research starts use the new budget", async () => {
    const updatedProjection = allowlistProjection(4);
    const updateResearchAllowlist = vi.fn(async () => allowlistCommandResponse(updatedProjection));
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(2)
      }
    });

    await actions.updateAllowlistMaxConcurrentRuns(allowlistId, 4);

    expect(updateResearchAllowlist).toHaveBeenCalledWith(projectId, allowlistId, {
      rateBudgetPolicy: expect.objectContaining({
        maxConcurrentRunsPerProject: 4,
        maxRunsPerSession: 4
      })
    });
    expect(appendCommandCalls).toHaveBeenCalledWith("Update research run limit", expect.any(Object));
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshResearchOperations).toHaveBeenCalledWith(projectId);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("updates the per-session research run limit without changing the simultaneous run limit", async () => {
    const updatedProjection = allowlistProjection(2, 8);
    const updateResearchAllowlist = vi.fn(async () => allowlistCommandResponse(updatedProjection));
    const appendCommandCalls = vi.fn();
    const appendCommand: Parameters<typeof useDecisionQueueResearchActions>[0]["appendCommand"] = async (
      label,
      response
    ) => {
      appendCommandCalls(label, response);

      return response;
    };
    const { actions, props } = captureResearchActions({
      appendCommand,
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(2, 3)
      }
    });

    await actions.updateAllowlistMaxRunsPerSession(allowlistId, 8);

    expect(updateResearchAllowlist).toHaveBeenCalledWith(projectId, allowlistId, {
      rateBudgetPolicy: expect.objectContaining({
        maxConcurrentRunsPerProject: 2,
        maxRunsPerSession: 8
      })
    });
    expect(appendCommandCalls).toHaveBeenCalledWith("Update session research limit", expect.any(Object));
    expect(props.setResearchOperations).toHaveBeenCalledWith(expect.any(Function));
    expect(props.refreshResearchOperations).toHaveBeenCalledWith(projectId);
    expect(props.setWorkflowError).toHaveBeenCalledWith(null);
  });

  it("rejects fractional allowlist concurrency values before mutating the allowlist", async () => {
    const updateResearchAllowlist = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(2)
      }
    });

    await actions.updateAllowlistMaxConcurrentRuns(allowlistId, 2.5);

    expect(updateResearchAllowlist).not.toHaveBeenCalled();
    expect(props.setWorkflowError).toHaveBeenCalledWith(
      "Max simultaneous research runs must be a positive whole number."
    );
  });

  it("rejects per-session research run limits below the simultaneous run limit", async () => {
    const updateResearchAllowlist = vi.fn();
    const { actions, props } = captureResearchActions({
      client: {
        updateResearchAllowlist,
        getResearchRunStatus: vi.fn(async () => researchRunProjection())
      } as unknown as SidecarClient,
      researchOperations: {
        ...emptyResearchOperationsState(),
        allowlists: allowlistProjection(3, 6)
      }
    });

    await actions.updateAllowlistMaxRunsPerSession(allowlistId, 2);

    expect(updateResearchAllowlist).not.toHaveBeenCalled();
    expect(props.setWorkflowError).toHaveBeenCalledWith(
      "Max research runs per session must be a whole number greater than or equal to the simultaneous run limit."
    );
  });
});
