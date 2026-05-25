import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
  type CommandId,
  type CommandResponse,
  type ConfidenceCompletionProjection,
  type CorrelationId,
  type DecisionQueueProjection,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type ProjectId,
  type ProjectionVersion,
  type SessionId,
  type SessionShellProjection,
  type StateVersion
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { DECISION_QUEUE_COPY } from "./decision-queue-copy";
import { emptyProjectionState } from "./decision-queue-shell-model";
import { useDecisionQueuePlanningPermissionActions } from "./useDecisionQueuePlanningPermissionActions";

type PlanningPermissionActions = ReturnType<typeof useDecisionQueuePlanningPermissionActions>;

function capturePlanningPermissionActions(
  overrides: Partial<Parameters<typeof useDecisionQueuePlanningPermissionActions>[0]> = {}
) {
  let actions: PlanningPermissionActions | undefined;
  const defaultProps: Parameters<typeof useDecisionQueuePlanningPermissionActions>[0] = {
    appendCommand: vi.fn(),
    client: null,
    copy: DECISION_QUEUE_COPY.ko,
    phase15bReadiness: null,
    projections: emptyProjectionState(),
    refreshChatGptDelegation: vi.fn(async () => undefined),
    refreshProjections: vi.fn(async () => undefined),
    refreshServicePageUsePermission: vi.fn(async () => undefined),
    setCommandLog: vi.fn(),
    setIsBusy: vi.fn(),
    setProjections: vi.fn(),
    setWorkflowError: vi.fn(),
    ...overrides
  };

  function Harness() {
    actions = useDecisionQueuePlanningPermissionActions(defaultProps);
    return null;
  }

  renderToStaticMarkup(<Harness />);

  if (!actions) {
    throw new Error("Planning permission actions were not captured.");
  }

  return {
    actions,
    props: defaultProps
  };
}

describe("useDecisionQueuePlanningPermissionActions", () => {
  it("uses active copy for planning and permission missing-session workflow errors", async () => {
    const { actions, props } = capturePlanningPermissionActions();

    await actions.scoreCompleteness();
    await actions.prepareImplementationContext();
    await actions.revokeChatGptDelegation("delegation_run_1");

    expect(props.setWorkflowError).toHaveBeenNthCalledWith(
      1,
      DECISION_QUEUE_COPY.ko.handoff.planningActionErrors.activeSessionRequiredScoreCompleteness
    );
    expect(props.setWorkflowError).toHaveBeenNthCalledWith(
      2,
      DECISION_QUEUE_COPY.ko.handoff.planningActionErrors.activeSessionRequiredPrepareImplementationContext
    );
    expect(props.setWorkflowError).toHaveBeenNthCalledWith(
      3,
      DECISION_QUEUE_COPY.ko.permissions.permissionActionErrors.activeSessionRequiredRevokeWorkspace
    );
  });

  it("chains score, Founder Brief, and Planning Handoff into one implementation-context preparation action", async () => {
    const projectId = "proj_prepare_implementation_context" as ProjectId;
    const sessionId = "sess_prepare_implementation_context" as SessionId;
    const session: SessionShellProjection = {
      kind: "SessionShellProjection",
      projectId,
      sessionId,
      version: 1 as ProjectionVersion,
      phase: "spec",
      projectPurposeMode: "business",
      projectPurposeModeSelectionStatus: "confirmed",
      projectPurposeModeLabel: "Business validation",
      projectPurposeModeEffect: "Business validation keeps commercial readiness gates visible."
    };
    const spec = {
      kind: "LivingSpecProjection",
      sessionId,
      version: 2 as ProjectionVersion,
      title: "Pet lifecycle assistant",
      sections: []
    } as unknown as LivingSpecProjection;
    const queue: DecisionQueueProjection = {
      kind: "DecisionQueueProjection",
      version: 3 as ProjectionVersion,
      active: [],
      next: [],
      blocked: [],
      deferred: []
    };
    const scoredQueue: DecisionQueueProjection = {
      ...queue,
      version: 5 as ProjectionVersion
    };
    const confidence = {
      kind: "ConfidenceCompletionProjection",
      sessionId,
      version: 5 as ProjectionVersion,
      compositeScore: 92,
      readinessLabel: "implementation-ready",
      axes: [],
      ambiguityDimensionCoverage: [],
      scoreBreakdown: {
        sectionCompleteness: 92,
        questionDebtResolution: 96,
        evidenceQuality: 91,
        decisionApproval: 90,
        consistencyAndConflict: 94
      },
      completionCandidate: {
        status: "candidate",
        summary: "Pet guardians and lifecycle MVP scope are ready for implementation planning.",
        gateFailures: [],
        ifStopNowArtifact: {
          summary: "Ready enough to create implementation slices.",
          knownRisks: [],
          nextValidationActions: []
        }
      },
      nextBestActions: [],
      topRiskCards: []
    } as unknown as ConfidenceCompletionProjection;
    const founderBrief = {
      kind: "FounderBriefProjection",
      sessionId,
      version: 6 as ProjectionVersion,
      exportReady: true,
      problemCustomerValue: "Pet guardians need one lifecycle record for care, insurance, and end-of-life tasks.",
      briefSections: [],
      knownRisks: [],
      nextValidationActions: []
    } as unknown as FounderBriefProjection;
    const planningHandoff = {
      ...PLANNING_HANDOFF_FINAL_PROJECTION_FIXTURE,
      sessionId,
      version: 7 as ProjectionVersion
    };
    const commandResponse = <TProjection,>(
      index: number,
      immediateProjection: TProjection,
      queueProjection?: DecisionQueueProjection
    ): CommandResponse<TProjection> => ({
      category: "accepted_with_projection",
      commandId: `cmd_prepare_implementation_context_${index}` as CommandId,
      correlationId: "corr_prepare_implementation_context" as CorrelationId,
      stateVersionBefore: (index - 1) as StateVersion,
      stateVersionAfter: index as StateVersion,
      immediateProjection,
      ...(queueProjection ? { queueProjection } : {})
    } as CommandResponse<TProjection>);
    const scoreCompleteness = vi.fn(async () => commandResponse(5, confidence, scoredQueue));
    const prepareFounderBriefExport = vi.fn(async () => commandResponse(6, founderBrief));
    const createPlanningHandoff = vi.fn(async () => commandResponse(7, planningHandoff));
    const appendCommand = vi.fn(async (_label, response) => response);
    const refreshProjections = vi.fn(async () => undefined);
    const { actions, props } = capturePlanningPermissionActions({
      appendCommand,
      client: {
        scoreCompleteness,
        prepareFounderBriefExport,
        createPlanningHandoff
      } as unknown as SidecarClient,
      projections: {
        ...emptyProjectionState(),
        session,
        spec,
        queue
      },
      refreshProjections
    });

    await actions.prepareImplementationContext();

    expect(scoreCompleteness).toHaveBeenCalledWith({
      sessionId,
      expectedStateVersion: 3
    });
    expect(prepareFounderBriefExport).toHaveBeenCalledWith({
      sessionId,
      expectedStateVersion: 5,
      requestedFormat: "markdown"
    });
    expect(createPlanningHandoff).toHaveBeenCalledWith(expect.objectContaining({
      sessionId,
      expectedStateVersion: 6,
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          sourceType: "founder_brief",
          sourceId: `founder_brief:${sessionId}:6`
        })
      ])
    }));
    expect(appendCommand).toHaveBeenNthCalledWith(
      1,
      DECISION_QUEUE_COPY.ko.handoff.planningActionLabels.scoreCompleteness,
      expect.any(Object)
    );
    expect(appendCommand).toHaveBeenNthCalledWith(
      2,
      DECISION_QUEUE_COPY.ko.handoff.planningActionLabels.prepareFounderBrief,
      expect.any(Object)
    );
    expect(appendCommand).toHaveBeenNthCalledWith(
      3,
      DECISION_QUEUE_COPY.ko.handoff.planningActionLabels.runPlanningHandoffGate,
      expect.any(Object)
    );
    expect(refreshProjections).toHaveBeenCalledWith(projectId, sessionId);
    expect(props.setProjections).toHaveBeenCalledWith(expect.any(Function));

    const update = vi.mocked(props.setProjections).mock.calls.at(-1)?.[0];
    if (typeof update !== "function") {
      throw new Error("expected setProjections to receive an updater");
    }

    expect(update(emptyProjectionState())).toEqual(expect.objectContaining({
      confidence,
      queue: scoredQueue,
      founderBrief,
      planningHandoff
    }));
  });
});
