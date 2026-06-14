import type { LivingSpecProjection, ResearchEvidenceProjection } from "@solo-superman/contracts";

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];

export type ResearchRoutingReadiness = "codex_quick_search" | "browser_deep_research" | "needs_more_clarification";

const NEEDS_MORE_CLARIFICATION_PATTERNS = [
  /첫\s*사용자\s*상황.{0,16}(?:구체화|좁혀|정리)/iu,
  /(?:사용자|고객|대상|상황).{0,12}(?:아직|더|먼저).{0,16}(?:넓|모호|구체화|좁혀)/iu,
  /(?:무엇을|누가|언제|어떤\s*상황).{0,20}(?:정해야|정리해야|구체화해야)/iu,
  /기획\s*맥락.{0,16}(?:부족|충분하지)/iu
] as const;

const BROWSER_DEEP_RESEARCH_PATTERNS = [
  /(?:여러|복수|다양한).{0,16}(?:출처|자료|사례|대안|경쟁|리뷰)/iu,
  /(?:취합|비교|종합|트렌드|시장|경쟁|벤치마크|사용\s*케이스)/iu,
  /(?:deep research|chatgpt|possible user futures|representative use cases|existing alternatives|market|trend|competitor|benchmark|case stud)/iu,
  /(?:사용자\s*미래|대표\s*사용\s*케이스|막힐\s*상황|대응\s*선택지)/iu
] as const;

function compactText(value: string | undefined) {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

export function researchRoutingReadinessForTask(input: {
  readonly task: ResearchTaskProjection;
  readonly spec?: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
}): ResearchRoutingReadiness {
  const text = compactText([
    input.task.objective,
    input.task.routeOutcome,
    input.task.sourceAnswerRef
  ].filter(Boolean).join(" "));

  if (NEEDS_MORE_CLARIFICATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "needs_more_clarification";
  }

  if (BROWSER_DEEP_RESEARCH_PATTERNS.some((pattern) => pattern.test(text))) {
    return "browser_deep_research";
  }

  return "codex_quick_search";
}

export function taskCanStartPublicSearchResearch(input: {
  readonly task: ResearchTaskProjection;
  readonly spec?: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
}) {
  return researchRoutingReadinessForTask(input) === "codex_quick_search";
}

export function taskShouldUseBrowserDeepResearch(input: {
  readonly task: ResearchTaskProjection;
  readonly spec?: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
}) {
  return researchRoutingReadinessForTask(input) === "browser_deep_research";
}
