import type {
  ResearchAllowlistGovernanceProjection,
  ResearchConnectorId,
  ResearchEvidenceProjection
} from "@solo-superman/contracts";
import type { StartResearchRunInput } from "../../shared/api/sidecar-client";

export const WEB_PUBLIC_SEARCH_CONNECTOR_ID = "public_search" as ResearchConnectorId;

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];
type ResearchAllowlistProjection = ResearchAllowlistGovernanceProjection["allowlists"][number];

interface WebResearchRunRequestInput {
  readonly allowlist: ResearchAllowlistProjection;
  readonly specTitle?: string | undefined;
  readonly task: ResearchTaskProjection;
}

export function buildWebResearchRunRequest({
  allowlist,
  specTitle,
  task
}: WebResearchRunRequestInput): StartResearchRunInput {
  return {
    researchTaskId: task.researchTaskId,
    allowlistId: allowlist.allowlistId,
    connectorId: allowlist.connectorIds[0] ?? WEB_PUBLIC_SEARCH_CONNECTOR_ID,
    sourceCategory: allowlist.sourceCategories[0] ?? "public_web",
    researchObjective: task.objective,
    productCategory: specTitle ?? "Founder workflow assistant",
    customerProblemHypothesis: "Founder needs public-safe evidence before execution preparation notes.",
    contextHash: `${task.researchTaskId}_${allowlist.version}_web`,
    sourceRefs: [task.sourceQueueItemId ?? task.researchTaskId]
  };
}
