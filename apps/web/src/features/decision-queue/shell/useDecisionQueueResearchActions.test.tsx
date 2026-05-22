import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  ProjectId,
  ProjectionVersion,
  ResearchRunControlProjection,
  ResearchRunId,
  SessionId
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { emptyProjectionState, emptyResearchOperationsState } from "./decision-queue-shell-model";
import { useDecisionQueueResearchActions } from "./useDecisionQueueResearchActions";

const projectId = "proj_research_refresh" as ProjectId;
const sessionId = "sess_research_refresh" as SessionId;
const researchRunId = "research_run_refresh" as ResearchRunId;

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

type ResearchActions = ReturnType<typeof useDecisionQueueResearchActions>;

function captureResearchActions(overrides: Partial<Parameters<typeof useDecisionQueueResearchActions>[0]> = {}) {
  let actions: ResearchActions | undefined;
  const defaultProps: Parameters<typeof useDecisionQueueResearchActions>[0] = {
    appendCommand: vi.fn(),
    client: {
      getResearchRunStatus: vi.fn(async () => researchRunProjection())
    } as unknown as SidecarClient,
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
});
