import type {
  ResearchAllowlistGovernanceProjection,
  ResearchConnectorId,
  ResearchEvidenceProjection
} from "@solo-superman/contracts";
import type { StartResearchRunInput } from "../../shared/api/sidecar-client";

export const DESKTOP_PUBLIC_SEARCH_CONNECTOR_ID = "public_search" as ResearchConnectorId;

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];
type ResearchAllowlistProjection = ResearchAllowlistGovernanceProjection["allowlists"][number];

interface DesktopResearchRunRequestInput {
  readonly allowlist: ResearchAllowlistProjection;
  readonly specTitle?: string | undefined;
  readonly task: ResearchTaskProjection;
}

export function buildDesktopResearchRunRequest({
  allowlist,
  specTitle,
  task
}: DesktopResearchRunRequestInput): StartResearchRunInput {
  return {
    researchTaskId: task.researchTaskId,
    allowlistId: allowlist.allowlistId,
    connectorId: allowlist.connectorIds[0] ?? DESKTOP_PUBLIC_SEARCH_CONNECTOR_ID,
    sourceCategory: allowlist.sourceCategories[0] ?? "public_web",
    researchObjective: task.objective,
    productCategory: specTitle ?? "Founder workflow assistant",
    customerProblemHypothesis: "Founder needs public-safe evidence before Phase 1.5B readiness hints.",
    contextHash: `${task.researchTaskId}_${allowlist.version}_desktop`,
    sourceRefs: [task.sourceQueueItemId ?? task.researchTaskId]
  };
}
