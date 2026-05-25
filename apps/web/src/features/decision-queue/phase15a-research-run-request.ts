import type {
  CreateResearchAllowlistRequest,
  LivingSpecProjection,
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
  readonly spec?: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
  readonly task: ResearchTaskProjection;
}

function compactResearchContextFromSpec(spec: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined) {
  return [spec?.title, ...(spec?.sections ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 900);
}

export function buildWebResearchRunRequest({
  allowlist,
  spec,
  specTitle,
  task
}: WebResearchRunRequestInput): StartResearchRunInput {
  const publicContext = compactResearchContextFromSpec(spec);
  const productCategory = spec?.title ?? specTitle ?? (publicContext ? "Product idea validation" : "Public product research");

  return {
    researchTaskId: task.researchTaskId,
    allowlistId: allowlist.allowlistId,
    connectorId: WEB_PUBLIC_SEARCH_CONNECTOR_ID,
    sourceCategory: "public_web",
    adapterKind: "web_search_readonly",
    researchObjective: task.objective,
    productCategory,
    customerProblemHypothesis:
      publicContext ||
      "Validate the product idea and customer problem with public web evidence before execution planning.",
    ...(publicContext ? { highLevelContext: publicContext } : {}),
    contextHash: `${task.researchTaskId}_${allowlist.version}_web`,
    sourceRefs: [task.sourceQueueItemId ?? task.researchTaskId]
  };
}
