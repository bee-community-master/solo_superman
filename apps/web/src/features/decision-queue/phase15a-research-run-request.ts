import type {
  CreateResearchAllowlistRequest,
  ResearchAllowlistGovernanceProjection,
  ResearchConnectorId,
  ResearchEvidenceProjection
} from "@solo-superman/contracts";
import type { StartResearchRunInput } from "../../shared/api/sidecar-client";

export const WEB_PUBLIC_SEARCH_CONNECTOR_ID = "public_search" as ResearchConnectorId;

type WebPublicResearchAllowlistPolicy = Required<
  Pick<CreateResearchAllowlistRequest, "approvedBy" | "connectorIds" | "sourceCategories">
>;

export function webPublicResearchAllowlistPolicy(approvedBy: string): WebPublicResearchAllowlistPolicy {
  return {
    connectorIds: [WEB_PUBLIC_SEARCH_CONNECTOR_ID],
    sourceCategories: ["public_web"],
    approvedBy
  };
}

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];
type ResearchAllowlistProjection = ResearchAllowlistGovernanceProjection["allowlists"][number];

export function allowlistPermitsWebPublicResearch(allowlist: ResearchAllowlistProjection) {
  return (
    allowlist.connectorIds.includes(WEB_PUBLIC_SEARCH_CONNECTOR_ID) &&
    allowlist.sourceCategories.includes("public_web")
  );
}

export function activeWebPublicResearchAllowlist(
  allowlists: ResearchAllowlistGovernanceProjection | null | undefined
) {
  return allowlists?.allowlists.find(
    (allowlist) => allowlist.status === "active" && allowlistPermitsWebPublicResearch(allowlist)
  ) ?? null;
}

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
    connectorId: WEB_PUBLIC_SEARCH_CONNECTOR_ID,
    sourceCategory: "public_web",
    adapterKind: "web_search_readonly",
    researchObjective: task.objective,
    productCategory: specTitle ?? "Founder workflow assistant",
    customerProblemHypothesis: "Founder needs public-safe evidence before execution preparation notes.",
    contextHash: `${task.researchTaskId}_${allowlist.version}_web`,
    sourceRefs: [task.sourceQueueItemId ?? task.researchTaskId]
  };
}
