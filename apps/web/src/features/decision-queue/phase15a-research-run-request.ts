import type {
  CreateResearchAllowlistRequest,
  LivingSpecProjection,
  ResearchAllowlistGovernanceProjection,
  ResearchConnectorId,
  ResearchEvidenceProjection
} from "@solo-superman/contracts";
import type { StartResearchRunInput } from "../../shared/api/sidecar-client";
import { researchRoutingReadinessForTask } from "./research-routing-readiness";

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
  readonly detailedAnswers?: readonly string[] | undefined;
  readonly task: ResearchTaskProjection;
}

const CANONICAL_SPEC_SECTION_PATTERN = /^(?:Problem|Target Customer|JTBD|Use Case|Current Alternatives|Value Proposition|Build Slice)\s*[:：]?/iu;

function compactResearchContextFromSpec(spec: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined) {
  return [spec?.title, ...(spec?.sections ?? []).filter((section) => !CANONICAL_SPEC_SECTION_PATTERN.test(section.trim()))]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 900);
}

export function buildWebResearchRunRequest({
  allowlist,
  detailedAnswers,
  spec,
  specTitle,
  task
}: WebResearchRunRequestInput): StartResearchRunInput {
  const publicContext = compactResearchContextFromSpec(spec);
  const answerContext = (detailedAnswers ?? [])
    .map((answer) => answer.trim())
    .filter(Boolean)
    .slice(-5);
  const productCategory = spec?.title ?? specTitle ?? (publicContext ? "Product idea validation" : "Public product research");
  const routingReadiness = researchRoutingReadinessForTask({ task });
  const customerProblemHypothesis =
    publicContext ||
    answerContext.join(" ") ||
    "아이디어의 첫 사용자, 기존 대안, 대표 사용 장면을 공개 자료로 간단히 확인합니다.";
  const rawIdea = spec?.title ?? specTitle;

  return {
    researchTaskId: task.researchTaskId,
    allowlistId: allowlist.allowlistId,
    connectorId: WEB_PUBLIC_SEARCH_CONNECTOR_ID,
    sourceCategory: "public_web",
    adapterKind: "web_search_readonly",
    researchObjective: task.objective,
    productCategory,
    customerProblemHypothesis,
    ...(rawIdea ? { rawIdea } : {}),
    detailedAnswers: answerContext,
    highLevelContext: [
      routingReadiness === "codex_quick_search"
        ? "짧은 공개 검색으로 확인할 수 있는 범위만 다룹니다."
        : "여러 공개 자료를 모아 사용자 미래, 대표 사용 케이스, 기존 대안, 막힐 상황, 대응 선택지를 정리합니다.",
      publicContext,
      answerContext.length ? `최근 사용자 답변: ${answerContext.join(" / ")}` : null
    ].filter((value): value is string => Boolean(value)).join(" "),
    contextHash: `${task.researchTaskId}_${allowlist.version}_web`,
    sourceRefs: [task.sourceQueueItemId ?? task.researchTaskId]
  };
}
