import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
    await actions.revokeChatGptDelegation("delegation_run_1");

    expect(props.setWorkflowError).toHaveBeenNthCalledWith(
      1,
      DECISION_QUEUE_COPY.ko.handoff.planningActionErrors.activeSessionRequiredScoreCompleteness
    );
    expect(props.setWorkflowError).toHaveBeenNthCalledWith(
      2,
      DECISION_QUEUE_COPY.ko.permissions.permissionActionErrors.activeSessionRequiredRevokeWorkspace
    );
  });
});
