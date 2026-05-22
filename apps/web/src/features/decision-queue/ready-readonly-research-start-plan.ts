import type {
  ResearchAllowlistGovernanceProjection,
  ResearchEvidenceProjection,
  ResearchRunControlProjection,
  ResearchTaskId
} from "@solo-superman/contracts";
import { startableReadOnlyResearchTaskIds } from "./decision-queue-view-model";

type ResearchAllowlistProjection = ResearchAllowlistGovernanceProjection["allowlists"][number];

export type ReadyReadOnlyResearchRunStartPlan =
  | {
      readonly status: "start";
      readonly taskIds: readonly ResearchTaskId[];
    }
  | {
      readonly status: "blocked";
      readonly message: string;
    }
  | {
      readonly status: "noop";
      readonly reason: "missing_allowlist" | "no_ready_tasks";
    };

interface ReadyReadOnlyResearchRunStartPlanInput {
  readonly allowlist: ResearchAllowlistProjection | null | undefined;
  readonly missingAllowlistMessage: string;
  readonly noReadyTasksMessage: string;
  readonly quietNoop: boolean;
  readonly research: ResearchEvidenceProjection | null | undefined;
  readonly runs: ResearchRunControlProjection | null | undefined;
}

function blockedOrNoop(
  quietNoop: boolean,
  reason: "missing_allowlist" | "no_ready_tasks",
  message: string
): ReadyReadOnlyResearchRunStartPlan {
  return quietNoop
    ? {
        status: "noop",
        reason
      }
    : {
        status: "blocked",
        message
      };
}

export function readyReadOnlyResearchRunStartPlan({
  allowlist,
  missingAllowlistMessage,
  noReadyTasksMessage,
  quietNoop,
  research,
  runs
}: ReadyReadOnlyResearchRunStartPlanInput): ReadyReadOnlyResearchRunStartPlan {
  if (!allowlist) {
    return blockedOrNoop(quietNoop, "missing_allowlist", missingAllowlistMessage);
  }

  const taskIds = startableReadOnlyResearchTaskIds({
    allowlist,
    research,
    runs
  });

  if (!taskIds.length) {
    return blockedOrNoop(quietNoop, "no_ready_tasks", noReadyTasksMessage);
  }

  return {
    status: "start",
    taskIds
  };
}
