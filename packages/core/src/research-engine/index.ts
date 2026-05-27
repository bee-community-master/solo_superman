import {
  derivePendingResearchReviewCardOutcomeMetadata,
  deriveResearchReviewCardOutcomeMetadata
} from "@solo-superman/contracts";
import type {
  DecisionEvidencePackId,
  DecisionEvidencePackProjection,
  EvidenceItemId,
  EvidenceMatrixProjection,
  ProjectionVersion,
  QueueItemId,
  ResearchEvidenceProjection,
  ResearchImpact,
  ProjectPurposeMode,
  ResearchQueueTerminalOutcome,
  ResearchQualityGateCheckProjection,
  ResearchResultId,
  ResearchResultProjection,
  ResearchRunId,
  ResearchReviewCardProjection,
  ResearchRouteOutcome,
  ResearchSourceReliability,
  ResearchTaskId,
  ResearchTaskProjection,
  SessionId
} from "@solo-superman/contracts";
import { describesAnswerFormPolicy } from "../answer-form-policy";

export * from "./public-safe-summary";
export * from "./background-research-runtime";

export const RESEARCH_ENGINE_SLICE_STATUS = "research-evidence-loop-pr-06" as const;

export interface PlanResearchTaskInput {
  readonly researchTaskId: ResearchTaskId;
  readonly sessionId: SessionId;
  readonly objective: string;
  readonly projectPurposeMode?: ProjectPurposeMode;
  readonly projectPurposeModeLabel?: string;
  readonly projectPurposeModeEffect?: string;
  readonly skippedCommercializationAxes?: readonly string[];
  readonly routeOutcome: ResearchRouteOutcome;
  readonly impact: ResearchImpact;
  readonly createdAt: string;
  readonly sourceQueueItemId?: QueueItemId;
  readonly sourceAnswerRef?: string;
}

export interface ImportResearchResultInput {
  readonly researchResultId: ResearchResultId;
  readonly researchTaskId: ResearchTaskId;
  readonly result: string;
  readonly importedAt: string;
  readonly researchRunId?: ResearchRunId;
  readonly sourceTitle?: string;
  readonly sourceUrl?: string;
  readonly sourceReliability?: ResearchSourceReliability;
  readonly sourcePublishedAt?: string;
  readonly sourceRetrievedAt?: string;
  readonly limitationNotes?: string;
  readonly claim?: string;
  readonly decisionContext?: string;
  readonly specSectionRef?: string;
  readonly questionRef?: string;
  readonly implicationScope?: string;
  readonly staleSensitive?: boolean;
  readonly sourceRequiredAfter?: string;
}

export interface SynthesizeEvidenceInput {
  readonly researchTask: ResearchTaskProjection;
  readonly researchResult: ResearchResultProjection;
  readonly synthesisVersion: number;
  readonly contextText?: string;
}

const EMPTY_RESEARCH_PROJECTION: Omit<ResearchEvidenceProjection, "version"> = {
  kind: "ResearchEvidenceProjection",
  taskIds: [],
  tasks: [],
  results: [],
  evidenceMatrices: [],
  evidencePacks: [],
  reviewCards: [],
  knownRisks: [],
  nextValidationActions: [],
  proConBalanceStatus: "unknown"
};
const PRO_EVIDENCE_MARKERS = ["pro:", "찬성", "supports", "support", "긍정", "validates"] as const;
const CON_EVIDENCE_MARKERS = ["con:", "risk:", "risks:", "반대", "우려", "부정", "caution"] as const;
const CON_EVIDENCE_SNIPPET_MARKERS = ["con:", "risk:", "risks:", "risk", "risks", "반대", "우려", "부정", "caution"] as const;
const UNCERTAINTY_MARKERS = ["uncertain", "unknown", "불확실", "limitation", "한계"] as const;

type StructuredResearchFindingLabel = "supports" | "weakens" | "uncertain";

interface StructuredResearchFindings {
  readonly isStructuredSummary: boolean;
  readonly sourceQualityInsufficient: boolean;
  readonly findings: readonly {
    readonly label: StructuredResearchFindingLabel;
    readonly summary: string;
  }[];
}

function trimOrNull(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function uniqueValues(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function itemId(prefix: string, token: string, index: number) {
  return `${prefix}_${token}_${index}` as EvidenceItemId;
}

function compactSummary(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return fallback;
  }

  if (trimmed.length <= 280) {
    return trimmed;
  }

  const sentences = trimmed.match(/[^.!?。！？]+[.!?。！？]?/gu) ?? [];
  const summary = sentences.reduce((current, sentence) => {
    const next = `${current}${sentence}`.trim();

    return next.length <= 280 ? next : current;
  }, "");

  return summary || trimmed.slice(0, 280).trimEnd();
}

export function stripInternalResearchMetaText(value: string) {
  return value
    .split(/\r?\n/u)
    .map((line) =>
      line
        .replace(/\bPage body could not be fetched before timeout;?\s*/giu, "")
        .replace(/\bFull page text was unavailable before timeout, so only the search-result summary is shown\.?/giu, "")
        .replace(/\b(?:search-result|rch-result|result)\s+snippet retained for review\.?/giu, "")
        .replace(/\bsnippet retained for review\.?/giu, "")
        .replace(/\bSource snippets and fetched page text require quality-gate review before accepted (?:evidence|근거)\.?/giu, "")
        .replace(/\bSource snippets and fetched page text require review before accepted (?:evidence|근거)\.?/giu, "")
        .replace(/\bBrowser search snippets can be incomplete; quality-gate review must verify claims before acceptance\.?/giu, "")
        .replace(/\bBrowser search snippets can be incomplete;?\s*/giu, "")
        .replace(/\bSearch snippets and available page text may be incomplete, so important claims still need follow-up confirmation\.?/giu, "")
        .replace(/\bOnly publicly reachable web pages were checked; login-only, paid, CAPTCHA, and anti-bot-blocked pages were not used\.?/giu, "")
        .replace(/\bquality-gate review must verify claims before acceptance\.?/giu, "")
        .replace(/\bquality-gate review before accepted (?:evidence|근거)\.?/giu, "")
        .replace(/\bPublic page opened, but readable body text was blocked by a login, CAPTCHA, or anti-bot interstitial\.?/giu, "")
        .replace(/\bBrowser-based public web search only; no login, CAPTCHA, anti-bot bypass, paid-service access, or external search API was used\.?/giu, "")
        .replace(/\bRandom delay range was \d+-\d+ms with at most \d+ fetched public page\(s\)\.?/giu, "")
        .replace(/\bPublic web research completed for [^.。!?]+[.。!?]?/giu, "")
        .replace(/\bQuery:\s*[^.。!?]+[.。!?]?/giu, "")
        .replace(/\bSources reviewed:\s*\d+[.。!?]?/giu, "")
        .replace(/\bPro:\s*At least one public source was reachable through a read-only browser search\.?/giu, "")
        .replace(/\bLimitation:\s*Browser search snippets can be incomplete;?\s*/giu, "")
        .replace(/\b(?:Pro|Con|Limitation):\s*$/giu, "")
        .replace(/\bread-only browser search\.?/giu, "")
        .replace(/\bread-only public web search\.?/giu, "")
        .replace(/\s+([.。!?])/gu, "$1")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function userFacingResearchText(value: string | undefined, fallback: string) {
  const sanitized = stripInternalResearchMetaText(value ?? "");

  return sanitized || fallback;
}

function userFacingQuestionText(value: string) {
  return value
    .replace(/^Validate evidence for:\s*/iu, "")
    .replace(/^Broaden research beyond existing notes for:\s*/iu, "")
    .replace(/\bValidate\s+/giu, "")
    .replace(/\bevidence\b/giu, "근거")
    .replace(/\s+/gu, " ")
    .trim();
}

function evidenceSummaryOrFallback(
  evidenceItems: readonly { readonly summary: string }[],
  fallback: string
) {
  return compactSummary(userFacingResearchText(evidenceItems[0]?.summary, fallback), fallback);
}

function neutralizeEvidenceStancePrefix(value: string) {
  return value
    .replace(/^(?:pro|con|risk|risks|support|supports|caution)\s*[:：-]\s*/iu, "")
    .replace(/^(?:찬성|반대|우려|긍정|부정)\s*(?:쪽\s*)?(?:근거|단서)?\s*[:：-]\s*/u, "")
    .trim();
}

function neutralEvidenceSummaryOrFallback(
  evidenceItems: readonly { readonly summary: string }[],
  fallback: string
) {
  const neutralSummary = neutralizeEvidenceStancePrefix(userFacingResearchText(evidenceItems[0]?.summary, fallback));

  return compactSummary(neutralSummary, fallback);
}

function stripStructuredFindingSourceSuffix(value: string) {
  return value
    .replace(/\s+—\s+https?:\/\/\S+\s*$/iu, "")
    .replace(/\s+—\s+.+?\s+https?:\/\/\S+\s*$/iu, "")
    .trim();
}

function parseStructuredResearchFindings(value: string): StructuredResearchFindings {
  const isStructuredSummary =
    /\bUsable findings:/imu.test(value) ||
    /^\s*-\s*\[(?:supports|weakens|uncertain)\]/imu.test(value) ||
    /source_quality_insufficient/iu.test(value);

  if (!isStructuredSummary) {
    return {
      isStructuredSummary: false,
      sourceQualityInsufficient: false,
      findings: []
    };
  }

  const normalized = value.replace(/\r?\n/gu, " ");
  const findings = [...normalized.matchAll(/-\s*\[(supports|weakens|uncertain)\]\s*(.+?)(?=\s+-\s*\[(?:supports|weakens|uncertain)\]|\s+Rejected noise:|\s+Limitations:|\s+Human decision needed:|$)/giu)]
    .flatMap((match) => {
      const [, label, rawSummary] = match;
      const summary = compactSummary(stripStructuredFindingSourceSuffix(rawSummary ?? ""), "");

      return summary
        ? [
            {
              label: label?.toLowerCase() as StructuredResearchFindingLabel,
              summary
            }
          ]
        : [];
    });

  return {
    isStructuredSummary: true,
    sourceQualityInsufficient:
      /source_quality_insufficient|usable finding 없음|no usable(?: source-linked)? finding/iu.test(value) ||
      findings.length === 0,
    findings
  };
}

type AdditionalQuestionAnswerIntent =
  | "open_text"
  | "binary_choice"
  | "single_choice"
  | "multi_choice"
  | "ranked_choice"
  | "single_customer_choice"
  | "multi_customer_choice"
  | "multi_signal_choice"
  | "answer_form_policy"
  | "evidence_judgment";

const explicitAdditionalQuestionNarrativeInstructionPattern = new RegExp(
  [
    String.raw`(?:이번(?:에는| 질문은)?|지금(?:은)?|여기서는|이\s*질문은|답변은)[^.\n?]{0,100}(?:주관식|주관형|서술형|서술식|논술형|자유\s*(?:답변|서술|입력|문항)|직접\s*(?:입력|작성)|open[-\s]?question|open[-\s]?ended)`,
    String.raw`(?:주관식|주관형|서술형|서술식|논술형|자유\s*(?:답변|서술|입력|문항)|open[-\s]?question|open[-\s]?ended)[^.\n?]{0,100}(?:답변을?\s*(?:요구|작성|적어|남겨)|로\s*(?:답변|작성|서술)|(?:실제|본인|사용자|고객)[^.\n?]{0,60}(?:맥락|상황|이유|제약)\s*(?:서술|설명))`
  ].join("|"),
  "iu"
);

function additionalQuestionAnswerIntentForObjective(objective: string): AdditionalQuestionAnswerIntent {
  const topic = userFacingQuestionText(objective).toLowerCase();
  const asksForNarrative =
    /(?:주관식|주관형|서술형|서술식|논술형|자유\s*(?:답변|서술|입력|문항)|직접\s*(?:입력|작성)|서술|설명|자유롭게|상황|맥락|이유|제약|왜|어떻게|workflow|흐름|사용\s*방식|describe|explain|free[-\s]?form|open[-\s]?(?:ended|question)|context)/iu.test(topic);
  const rejectsChoiceOptions =
    /(?:선택지\s*없이|선택지(?:가|는)?\s*아니라|객관식(?:이|은)?\s*아니라|선택형(?:이|은)?\s*아니라|고르지\s*말고|선택하지\s*말고|without\s+choices?|no\s+choices?|not\s+(?:a\s+)?(?:choice|multiple[-\s]?choice|single[-\s]?choice))/iu.test(topic);
  const asksForForcedChoice =
    /(?:객관식|선택형|선택|고르|골라|중\s*(?:하나|한\s*가지)|하나(?:를|만)?\s*(?:선택|고르)|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|복수|다중|(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|동의\s*[/·또는과]*\s*비동의|예\s*[/·또는과]*\s*아니오)\s*(?:중|중에|중에서|여부|선택|고르|판단)|양자\s*택일|양자택일|choose|pick|select|single[-\s]?choice|multi[-\s]?select|one\s+or\s+more|select\s+all|yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose)/iu.test(topic);
  const rejectsBinaryChoice =
    /(?:(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|찬반|동의\s*[/·또는과]*\s*비동의|예\s*[/·또는과]*\s*아니오)\s*(?:선택|답변|판단|질문)?(?:이|가|은|는)?\s*(?:아니라|아닌|말고|대신|보다)|(?:not|instead\s+of|rather\s+than|not\s+an?\s+)[^.\n?]{0,60}(?:yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose|pro\s*[/ ]?con|binary\s+choice)|(?:yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose|pro\s*[/ ]?con|binary\s+choice)[^.\n?]{0,60}(?:not|instead|rather\s+than))/iu.test(topic);
  const asksForExplicitChoice =
    /(?:객관식|선택형|선택|고르|골라|중\s*(?:하나|한\s*가지)|어느\s*(?:쪽|방향|후보|성향|고객|세그먼트|종류|선택지)|choose|pick|select|which\s+(?:one|customer|segment|option|side|direction))/iu.test(topic);
  const asksForCustomerChoice =
    /(?:세그먼트|성향|persona|segment|어느\s*(?:고객|사용자|성향|후보)|고객\s*(?:후보|유형|타입)|customer\s*(?:segment|persona|type)|which\s+customer)/iu.test(topic);
  const asksForSignalOrCriteriaChoice = /(?:신호|조건|요인|기준|signals?|criteria|factors?)/iu.test(topic);
  const asksForMultiChoice =
    /(?:복수|모두|해당|다중|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|여러\s*(?:개|항목)\s*(?:선택|고르)|둘\s*이상|multi[-\s]?select|one\s+or\s+more|select\s+all)/iu.test(
      topic
    );
  const asksForBinaryChoice =
    /(?:(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|찬반|동의\s*[/·또는과]*\s*비동의|예\s*[/·또는과]*\s*아니오)\s*(?:중|중에|중에서|여부|어느|선택|고르|판단|(?:의견|답변|방향)?(?:을|를)?\s*(?:하|할|선택|고르|골라|판단|정|답))|(?:진행|채택|반영|동의|찬성|반대)\s*여부|(?:할지|갈지|진행할지|반영할지|채택할지)\s*(?:여부|말지)|양자\s*택일|양자택일|동의하시|찬성하시|반대하시|해야\s*(?:할까|하나|할지)|yes\s*[/ ]?no|whether\s+to|agree\s*[/ ]?disagree|support\s*[/ ]?oppose)/iu.test(topic);
  const asksForSingleChoice =
    /(?:객관식|선택형|단일\s*선택|하나(?:를|만)?\s*(?:선택|고르)|중\s*(?:하나|한\s*가지)|종류\s*중\s*하나|후보\s*중\s*하나|옵션\s*중\s*하나|(?:후보|선택지|옵션|고객\s*후보|고객\s*세그먼트)(?:를|을)?\s*(?:선택|고르)|which\s+(?:one|option)|single[-\s]?choice)/iu.test(topic);
  const asksForRanking =
    /(?:우선순위|우선\s*순위|순위|순서|랭킹|중요도순|먼저\s*(?:볼|검증|구현|확인)할\s*순서|rank(?:ed|ing)?|priorit(?:y|ize|ise)|order\s+(?:of|the))/iu.test(topic);

  if (describesAnswerFormPolicy(topic)) {
    return "answer_form_policy";
  }

  if (explicitAdditionalQuestionNarrativeInstructionPattern.test(topic)) {
    return "open_text";
  }

  if (asksForNarrative && (rejectsChoiceOptions || !asksForForcedChoice)) {
    return "open_text";
  }

  if (asksForBinaryChoice && !rejectsBinaryChoice) {
    return "binary_choice";
  }

  if (asksForRanking) {
    return "ranked_choice";
  }

  if (asksForMultiChoice) {
    if (asksForCustomerChoice) {
      return "multi_customer_choice";
    }

    return asksForSignalOrCriteriaChoice ? "multi_signal_choice" : "multi_choice";
  }

  if (asksForCustomerChoice && (!asksForNarrative || asksForForcedChoice || asksForExplicitChoice)) {
    return "single_customer_choice";
  }

  if (asksForSingleChoice) {
    return "single_choice";
  }

  if (asksForSignalOrCriteriaChoice) {
    return "multi_signal_choice";
  }

  return "evidence_judgment";
}

function koreanObjectParticleFor(value: string) {
  const lastCodePoint = Array.from(value.trim()).at(-1)?.codePointAt(0);

  if (lastCodePoint === undefined || lastCodePoint < 0xac00 || lastCodePoint > 0xd7a3) {
    return "를";
  }

  return (lastCodePoint - 0xac00) % 28 === 0 ? "를" : "을";
}

function joinedEvidenceContext(input: {
  readonly topic: string;
  readonly proSummary: string;
  readonly conSummary: string | null;
  readonly uncertaintySummary: string;
  readonly contextText?: string;
}) {
  return [input.topic, input.contextText, input.proSummary, input.conSummary, input.uncertaintySummary]
    .filter(Boolean)
    .join(" ");
}

function bulletedQuestionCandidates(candidates: readonly string[]) {
  return candidates.map((candidate) => `- ${candidate}`).join("\n");
}

function normalizeGenericChoiceCandidateLabel(value: string) {
  return value
    .replace(/^[\s"'‘’“”([{<]+|[\s"'‘’“”)\]}>.。]+$/gu, "")
    .replace(/\s+(?:정도|후보|옵션|선택지)$/u, "")
    .trim();
}

function splitGenericChoiceCandidatePhrase(value: string) {
  return value
    .replace(/([^\s,·/]+)(?:와|과)\s+/gu, "$1, ")
    .replace(/\s+(?:및|또는|혹은)\s+/gu, ", ")
    .replace(/\s+(?:and|or)\s+/giu, ", ")
    .split(/[,·/]+/u)
    .map(normalizeGenericChoiceCandidateLabel)
    .filter((candidate) => candidate.length >= 2 && candidate.length <= 64);
}

function labelsFromEvidenceCandidatePhrases(input: {
  readonly text: string;
  readonly patterns: readonly RegExp[];
}) {
  const phrases: string[] = [];

  for (const pattern of input.patterns) {
    for (const match of input.text.matchAll(pattern)) {
      const phrase = match.groups?.candidates?.trim();

      if (phrase) {
        phrases.push(phrase);
      }
    }
  }

  return uniqueValues(phrases.flatMap(splitGenericChoiceCandidatePhrase)).slice(0, 10);
}

function withCandidateFallbackFloor(
  candidates: readonly string[],
  fallbackCandidates: readonly string[],
  minimumCount = 3
) {
  if (!candidates.length) {
    return [];
  }

  if (candidates.length >= minimumCount) {
    return candidates.slice(0, 10);
  }

  return uniqueValues([...candidates, ...fallbackCandidates]).slice(0, 10);
}

function genericChoiceCandidateLabelsFromTopic(topic: string) {
  const phrases: string[] = [];
  const patterns = [
    /(?:후보|선택지|옵션|종류|유형|타입|기능|검증\s*방법|검증\s*후보)(?:는|은|로는|로|:)\s*(?<candidates>.+?)(?:입니다|입니다만|정도로|정도(?:로)?\s*추려|중에서|중\s*(?:하나|한\s*가지|하나\s*이상|여러\s*개)|를\s*고르|을\s*고르|를\s*선택|을\s*선택|\.|\?|$)/giu,
    /(?:customer\s*)?(?:(?:candidates?|options?|validation\s*(?:methods?|candidates?)|feature\s*candidates?)\s*(?:include|includes|are|:)|(?:segments?|personas?|types?)\s*(?:include|includes|:))\s*(?<candidates>[^.?\n]{2,180})(?:\.|\?|$)/giu,
    /(?<candidates>[^.?\n]{2,180}(?:[,·/]|(?:와|과)\s+|(?:및|또는|혹은)\s+)[^.?\n]{2,180}?)(?:\s*(?:중|가운데)\s*(?:하나(?:만)?|한\s*가지|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|여러\s*(?:개|항목)|복수|다중)(?:를|을)?\s*(?:선택|고르|골라|정|택)|\s*(?:중|가운데)\s*먼저\s*(?:볼|확인|검증|구현)할\s*순서)/giu
  ];

  for (const pattern of patterns) {
    for (const match of topic.matchAll(pattern)) {
      const phrase = match.groups?.candidates?.trim();

      if (phrase) {
        phrases.push(phrase);
      }
    }
  }

  return uniqueValues(phrases.flatMap(splitGenericChoiceCandidatePhrase)).slice(0, 10);
}

function promptWithGenericCandidates(input: {
  readonly topic: string;
  readonly lead: string;
  readonly action: string;
  readonly fallback: string;
}) {
  const candidates = genericChoiceCandidateLabelsFromTopic(input.topic);

  if (!candidates.length) {
    return input.fallback;
  }

  return `${input.lead}\n${bulletedQuestionCandidates(candidates)}\n\n${input.action}`;
}

const PET_LIFECARE_CUSTOMER_CANDIDATES = [
  "첫 반려동물을 키우는 보호자",
  "노령·만성질환 반려동물 보호자",
  "여러 마리를 함께 키우는 가구",
  "보험·의료비 관리가 필요한 보호자",
  "장례·말기 케어까지 준비하는 보호자"
] as const;

function hasPetLifecycleContext(text: string) {
  return /(?:반려\s*동물|반려견|반려묘|펫\b|pet\b|companion\s+animal|동물병원|수의|의료비|급여|사료|보험|장례|말기\s*케어|전생애|생애주기)/iu.test(
    text
  );
}

function customerFallbackCandidatesForContext(text: string) {
  if (hasPetLifecycleContext(text)) {
    return PET_LIFECARE_CUSTOMER_CANDIDATES;
  }

  return [];
}

const CUSTOMER_CANDIDATE_LABEL_RULES = [
  {
    label: "소상공인/자영업 운영자",
    pattern: /(?:소상공|자영업|small\s*business|smb|merchant|store\s*owner)/iu
  },
  {
    label: "크리에이터/마케터형 실무자",
    pattern: /(?:creator|크리에이터|marketer|마케터|designer|디자이너|content)/iu
  },
  {
    label: "컨설턴트/에이전시 실무자",
    pattern: /(?:consultant|컨설턴트|agency|에이전시|freelance|프리랜서)/iu
  }
] as const;

function customerCandidateLabelsFromEvidence(input: {
  readonly topic: string;
  readonly proSummary: string;
  readonly conSummary: string | null;
  readonly uncertaintySummary: string;
  readonly contextText?: string;
}) {
  const text = joinedEvidenceContext(input);
  const fallbackCandidates = customerFallbackCandidatesForContext(text);
  const explicitCandidates = labelsFromEvidenceCandidatePhrases({
    text,
    patterns: [
      /(?:고객\s*)?(?:후보|세그먼트|유형|타입|성향)(?:는|은|로는|로|:|：)\s*(?<candidates>[^.?!\n。！？]{2,220})(?:입니다|입니다만|정도로|정도(?:로)?\s*추려|중에서|중\s*(?:하나|한\s*가지|하나\s*이상|여러\s*개)|를\s*고르|을\s*고르|를\s*선택|을\s*선택|$)/giu,
      /(?:customer\s*)?(?:(?:candidates?)\s*(?:include|includes|are|:)|(?:segments?|personas?|types?)\s*(?:include|includes|:))\s*(?<candidates>[^.?!\n]{2,220})/giu
    ]
  });
  const candidates = CUSTOMER_CANDIDATE_LABEL_RULES
    .filter((candidate) => candidate.pattern.test(text))
    .map((candidate) => candidate.label);

  if (explicitCandidates.length) {
    return withCandidateFallbackFloor(uniqueValues(explicitCandidates), fallbackCandidates);
  }

  if (hasPetLifecycleContext(text)) {
    return fallbackCandidates.slice(0, 10);
  }

  return withCandidateFallbackFloor(uniqueValues(candidates), fallbackCandidates);
}

const DEFAULT_CUSTOMER_SIGNAL_CANDIDATES = [
  "반복되는 수동 고통",
  "예산/지불 의향",
  "기존 대안 불만",
  "직접 만든 임시 해결책",
  "반복 사용/공유 신호"
] as const;

const CUSTOMER_SIGNAL_LABEL_RULES = [
  {
    label: "반복되는 수동 고통",
    pattern: /(?:manual|수동|반복|repeated|coordination|정리|고통|pain|귀찮|오래\s*걸)/iu
  },
  {
    label: "예산/지불 의향",
    pattern: /(?:budget|예산|pay|paid|willingness|지불|결제|돈|구매)/iu
  },
  {
    label: "기존 대안 불만",
    pattern: /(?:alternative|대안|competitor|경쟁|불만|dissatisfaction|현재\s*방법|replacement)/iu
  },
  {
    label: "직접 만든 임시 해결책",
    pattern: /(?:workaround|임시|스프레드시트|spreadsheet|script|스크립트|직접\s*만|self[-\s]?built)/iu
  },
  {
    label: "반복 사용/공유 신호",
    pattern: /(?:repeat[-\s]?use|retention|재사용|반복\s*사용|공유|share|sharing|referral)/iu
  },
  {
    label: "긴급한 시간/스트레스 압박",
    pattern: /(?:urgent|urgency|긴급|급하|stress|스트레스|deadline|마감|시간\s*압박)/iu
  }
] as const;

function customerSignalLabelsFromEvidence(input: {
  readonly topic: string;
  readonly proSummary: string;
  readonly conSummary: string | null;
  readonly uncertaintySummary: string;
  readonly contextText?: string;
}) {
  const text = joinedEvidenceContext(input);
  const explicitSignals = labelsFromEvidenceCandidatePhrases({
    text,
    patterns: [
      /(?:고객\s*)?(?:신호|조건|요인|기준)(?:는|은|로는|로|:|：)\s*(?<candidates>[^.?!\n。！？]{2,220})(?:입니다|입니다만|정도로|정도(?:로)?\s*추려|중에서|해당|여러\s*(?:개|항목)|를\s*확인|을\s*확인|를\s*선택|을\s*선택|$)/giu,
      /(?:customer\s*)?(?:signals?|criteria|factors?|conditions?)\s*(?:include|includes|:)\s*(?<candidates>[^.?!\n]{2,220})/giu
    ]
  });
  const signals = CUSTOMER_SIGNAL_LABEL_RULES
    .filter((signal) => signal.pattern.test(text))
    .map((signal) => signal.label);

  return withCandidateFallbackFloor(uniqueValues([...explicitSignals, ...signals]), DEFAULT_CUSTOMER_SIGNAL_CANDIDATES);
}

function promptSentenceForAnswerIntent(
  intent: AdditionalQuestionAnswerIntent,
  evidenceJudgmentPrompt: string,
  context: {
    readonly topic: string;
    readonly proSummary: string;
    readonly conSummary: string | null;
    readonly uncertaintySummary: string;
    readonly contextText?: string;
  }
) {
  switch (intent) {
    case "single_customer_choice": {
      const evidenceCandidates = customerCandidateLabelsFromEvidence(context);
      if (evidenceCandidates.length < 2) {
        return "리서치 단서만으로는 비교할 고객 후보가 충분히 분리되지 않았습니다. 선택지 없이, 이 아이디어에 맞는 첫 고객 후보를 2~4개로 직접 적고 그중 가장 먼저 검증할 후보와 이유를 1~2문장으로 설명해주세요.";
      }

      return `리서치 단서에서 우선 비교할 고객 후보는 다음과 같습니다:\n${bulletedQuestionCandidates(evidenceCandidates)}\n\n어느 성향의 고객에 집중하시겠습니까?`;
    }
    case "multi_customer_choice": {
      const evidenceCandidates = customerCandidateLabelsFromEvidence(context);
      if (evidenceCandidates.length < 2) {
        return "리서치 단서만으로는 함께 비교할 고객 후보가 충분히 분리되지 않았습니다. 선택지 없이, 첫 검증 배치에 남길 고객 후보와 제외할 후보를 직접 적고 각 이유를 간단히 설명해주세요.";
      }

      return `리서치 단서에서 함께 비교할 고객 후보는 다음과 같습니다:\n${bulletedQuestionCandidates(evidenceCandidates)}\n\n해당되는 고객 후보를 하나 이상 선택해주세요. 필요하면 선택지 조합이나 빠진 후보를 직접 적어도 됩니다.`;
    }
    case "multi_signal_choice": {
      const evidenceSignals = customerSignalLabelsFromEvidence(context);
      const signals = evidenceSignals.length ? evidenceSignals : DEFAULT_CUSTOMER_SIGNAL_CANDIDATES;
      const lead = evidenceSignals.length
        ? "리서치 단서에서 다음에 함께 확인할 고객 신호는 다음과 같습니다:"
        : "다음 리서치나 인터뷰에서 함께 확인할 신호 후보는 다음과 같습니다:";

      return `${lead}\n${bulletedQuestionCandidates(signals)}\n\n해당되는 신호를 여러 개 선택해주세요.`;
    }
    case "answer_form_policy":
      return "이 요구사항은 질문마다 답변 형식을 달리 정해야 하는 설계 기준입니다. 실제로 어떤 질문에서 주관식/서술형, 진행·보류 판단, 하나 선택, 여러 개 선택, 우선순위 답변이 필요한지 3~5문장으로 서술해주세요.";
    case "multi_choice":
      return promptWithGenericCandidates({
        topic: context.topic,
        lead: "질문에서 함께 비교할 후보는 다음과 같습니다:",
        action: "위 후보 중 해당되는 선택지를 하나 이상 선택해주세요. 필요하면 선택지 조합이나 빠진 후보를 직접 적어도 됩니다.",
        fallback: "위 정보를 기준으로 해당되는 선택지를 하나 이상 선택해주세요. 필요하면 선택지 조합이나 빠진 후보를 직접 적어도 됩니다."
      });
    case "single_choice":
      return promptWithGenericCandidates({
        topic: context.topic,
        lead: "질문에서 비교할 후보는 다음과 같습니다:",
        action: "위 후보 중 지금 가장 먼저 확정할 하나의 선택지를 골라주세요. 선택지에 없는 후보가 더 맞다면 직접 적어도 됩니다.",
        fallback: "위 정보를 기준으로 지금 가장 먼저 확정할 하나의 선택지를 골라주세요. 선택지에 없는 후보가 더 맞다면 직접 적어도 됩니다."
      });
    case "ranked_choice":
      return promptWithGenericCandidates({
        topic: context.topic,
        lead: "질문에서 순서를 비교할 후보는 다음과 같습니다:",
        action: "위 후보들의 우선순위를 1순위부터 정해주세요. 같은 수준이면 묶어서 적고, 빠진 후보가 있으면 직접 추가해도 됩니다.",
        fallback: "위 정보를 기준으로 후보들의 우선순위를 1순위부터 정해주세요. 같은 수준이면 묶어서 적고, 빠진 후보가 있으면 직접 추가해도 됩니다."
      });
    case "open_text":
      return "이 근거를 참고해 실제 사용자가 어떤 상황에서 이 문제를 겪고, 어떤 제약 때문에 지금 해결하려는지 본인 말로 3~5문장으로 서술해주세요.";
    case "binary_choice":
      return "이 방향을 지금 스펙이나 다음 검증 단계에 진행 후보로 둘지, 보류하거나 좁힐지, 조건을 붙여 진행할지 골라주세요.";
    case "evidence_judgment":
      return evidenceJudgmentPrompt;
  }
}

function unlockSentenceForAnswerIntent(intent: AdditionalQuestionAnswerIntent, topic: string) {
  switch (intent) {
    case "single_customer_choice":
      return "이 답으로 정해지는 내용은 첫 인터뷰 대상, 리서치 초점, MVP 범위를 어느 고객 성향에 맞출지입니다.";
    case "multi_customer_choice":
      return "이 답으로 정해지는 내용은 첫 검증 배치에서 동시에 비교하거나 유지할 고객 후보와 제외할 고객 후보입니다.";
    case "multi_signal_choice":
      return "이 답으로 정해지는 내용은 다음 리서치/인터뷰에서 동시에 확인할 고객 신호와 검증 체크리스트입니다.";
    case "answer_form_policy":
      return "이 답으로 정해지는 내용은 질문 카드마다 주관식, 진행/보류 판단, 단일 선택, 복수 선택, 순위형 중 어떤 입력 방식과 저장 형식을 써야 하는지입니다.";
    case "multi_choice":
      return "이 답으로 정해지는 내용은 동시에 유지할 후보와 다음 리서치/검증 체크리스트입니다.";
    case "single_choice":
      return "이 답으로 정해지는 내용은 다음 스펙과 구현 범위가 우선 따라갈 하나의 선택 기준입니다.";
    case "ranked_choice":
      return "이 답으로 정해지는 내용은 먼저 검증하거나 구현할 순서와 뒤로 미룰 후보입니다.";
    case "open_text":
      return "이 답으로 정해지는 내용은 문제 맥락, 예외 조건, 스펙에 남길 실제 사용자 상황입니다.";
    case "binary_choice":
      return "이 답으로 정해지는 내용은 이 방향을 결정 후보로 진행할지, 보류할지, 조건부로 추가 검증할지입니다.";
    case "evidence_judgment":
      return `이 답으로 정해지는 내용은 ${topic}을 스펙에 반영할지, 알려진 리스크로 남길지, 추가 리서치를 더 진행할지입니다.`;
  }
}

function questionLeadLinesForAnswerIntent(input: {
  readonly intent: AdditionalQuestionAnswerIntent;
  readonly topic: string;
  readonly proSummary: string;
  readonly conSummary: string | null;
  readonly uncertaintySummary: string;
}) {
  if (input.intent === "evidence_judgment" || input.intent === "binary_choice") {
    return [
      `${input.topic}${koreanObjectParticleFor(input.topic)} 조금 더 구체화하기 위해 리서치 결과를 모아보니 ${input.proSummary} 같은 단서가 확인되었습니다.`,
      "",
      input.conSummary ? `다른 관점이나 반례로는 ${input.conSummary}도 확인되었습니다.` : null,
      `한계와 불확실성은 ${input.uncertaintySummary}입니다.`
    ];
  }

  if (input.intent === "answer_form_policy") {
    return [
      "답변 형식 요구사항을 살펴보면 질문마다 필요한 입력 방식이 달라져야 합니다.",
      "",
      `리서치 단서로는 ${input.proSummary} 같은 내용이 확인되었습니다.`,
      input.conSummary ? `다른 관점이나 반례로는 ${input.conSummary}도 확인되었습니다.` : null,
      `한계와 불확실성은 ${input.uncertaintySummary}입니다.`
    ];
  }

  return [
    `${input.topic}${koreanObjectParticleFor(input.topic)} 조금 더 구체화하기 위해 리서치 결과를 모아보니 ${input.proSummary} 같은 단서가 나타났습니다.`,
    "",
    input.conSummary ? `다른 관점이나 반례로는 ${input.conSummary}도 확인되었습니다.` : null,
    `한계와 불확실성은 ${input.uncertaintySummary}입니다.`
  ];
}

function additionalQuestionForEvidenceGap(input: {
  readonly objective: string;
  readonly balanceStatus: EvidenceMatrixProjection["balanceStatus"];
  readonly proEvidence: readonly { readonly summary: string }[];
  readonly conEvidence: readonly { readonly summary: string }[];
  readonly uncertainties: readonly { readonly summary: string }[];
  readonly contextText?: string;
}) {
  const topic = userFacingQuestionText(input.objective) || "이번 주장";
  const contextText = userFacingResearchText(input.contextText, "");
  const answerIntent = additionalQuestionAnswerIntentForObjective(input.objective);
  if (input.balanceStatus === "source_quality_insufficient" && input.proEvidence.length === 0 && input.conEvidence.length === 0) {
    const uncertaintySummary = input.uncertainties.length
      ? evidenceSummaryOrFallback(input.uncertainties, "출처 폭과 실제 적용 가능성은 추가 확인이 필요합니다")
      : "공개 리서치에서 유의미한 근거를 찾지 못했습니다";
    const promptSentence =
      "공개 리서치에서 유의미한 근거를 찾지 못했으니 사용자가 직접 판단/검증 기준을 정해야 합니다. 어떤 조건이 확인되면 이 방향을 진행하거나 보류하시겠습니까?";
    const unlockSentence = unlockSentenceForAnswerIntent(answerIntent, topic);

    return [
      `${topic}${koreanObjectParticleFor(topic)} 판단할 공개 리서치 단서를 확인했지만, usable source-linked finding으로 쓸 만한 근거는 아직 없습니다.`,
      "",
      `한계와 불확실성은 ${uncertaintySummary}입니다.`,
      contextText ? `현재 맥락은 ${compactSummary(contextText, contextText)}입니다.` : null,
      "",
      promptSentence,
      "",
      unlockSentence
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  }
  const usesStanceFraming = answerIntent === "evidence_judgment" || answerIntent === "binary_choice";
  const proSummary = neutralEvidenceSummaryOrFallback(
    input.proEvidence,
    "아직 참고할 리서치 단서가 충분히 정리되지 않았습니다"
  );
  const conSummary = input.conEvidence.length
    ? usesStanceFraming
      ? neutralEvidenceSummaryOrFallback(input.conEvidence, "다른 관점이나 반례가 아직 충분히 정리되지 않았습니다")
      : neutralEvidenceSummaryOrFallback(input.conEvidence, "다른 관점이나 반례가 아직 충분히 정리되지 않았습니다")
    : null;
  const uncertaintySummary =
    (input.uncertainties.length
      ? evidenceSummaryOrFallback(input.uncertainties, "출처 폭과 실제 적용 가능성은 추가 확인이 필요합니다")
      : null) ??
    (input.balanceStatus === "missing_con_evidence" || input.balanceStatus === "needs_con_evidence"
      ? usesStanceFraming
        ? "다른 관점이나 반례가 부족해 과신 가능성이 남아 있습니다"
        : "다른 관점이나 반례가 부족해 과신 가능성이 남아 있습니다"
      : "출처 폭과 실제 적용 가능성은 추가 확인이 필요합니다");

  const choiceSentence = conSummary
    ? `지금은 ‘이 방향을 우선 후보로 둔다’, ‘범위 축소나 방향 전환을 검토한다’, ‘추가 리서치로 근거자료를 더 보강한다’ 중에서 다음 판단을 고를 수 있습니다. 어느 방향으로 판단하시겠습니까?`
    : `지금은 ‘이 방향을 우선 후보로 둔다’, ‘반례와 한계를 더 확인한다’, ‘지금은 스펙을 확정하기 어렵다’ 중에서 다음 판단을 고를 수 있습니다. 어느 방향으로 판단하시겠습니까?`;
  const promptContext = {
    topic,
    proSummary,
    conSummary,
    uncertaintySummary,
    contextText
  };
  const promptSentence = promptSentenceForAnswerIntent(answerIntent, choiceSentence, promptContext);
  const unlockSentence = unlockSentenceForAnswerIntent(answerIntent, topic);
  const questionLeadLines = questionLeadLinesForAnswerIntent({
    intent: answerIntent,
    ...promptContext
  });

  return [
    ...questionLeadLines,
    "",
    promptSentence,
    "",
    unlockSentence
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function normalizeResultText(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  return trimmed || fallback;
}

function optionalNormalizedString(value: string | undefined) {
  return trimOrNull(value) ?? undefined;
}

function evidenceSnippet(value: string, markers: readonly string[], fallback: string) {
  const normalized = normalizeResultText(value, fallback);
  const lower = normalized.toLowerCase();
  const markerIndex = markers
    .map((marker) => lower.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (markerIndex === undefined || markerIndex <= 40) {
    return compactSummary(normalized, fallback);
  }

  const start = Math.max(0, markerIndex - 40);
  const excerpt = normalized.slice(start, start + 280).trim();

  return compactSummary(excerpt, fallback);
}

function includesAny(value: string, needles: readonly string[]) {
  return needles.some((needle) => value.includes(needle));
}

function hasNegatedRiskClaim(value: string) {
  return /\b(?:no|not|without)\s+(?:meaningful\s+|material\s+|credible\s+|skeptical\s+)?(?:risk|risks|con evidence|counter-evidence|counter evidence)\b/.test(
    value
  );
}

function sourceRetainedRef(result: ResearchResultProjection) {
  if (result.sourceUrl) {
    return result.sourceUrl;
  }

  if (result.sourceTitle) {
    return result.sourceTitle;
  }

  const summary = userFacingResearchText(result.resultSummary, "");
  const findingMatch = /-\s*\[(?:supports|weakens|uncertain)\]\s*(.+?)(?=\s+-\s*\[(?:supports|weakens|uncertain)\]|\s+Rejected noise:|\s+Limitations:|\s+Human decision needed:|$)/isu.exec(
    summary.replace(/\r?\n/gu, " ")
  );
  const finding = findingMatch?.[1]
    ?.replace(/\s+—\s+https?:\/\/\S+\s*$/iu, "")
    .replace(/\s+—\s+.+?\s+https?:\/\/\S+\s*$/iu, "")
    .trim();

  if (finding) {
    return compactSummary(finding, "source-linked finding");
  }

  const humanDecisionMatch = /Human decision needed:\s*(.+?)(?=\s+[A-Z][A-Za-z ]+:|$)/isu.exec(
    summary.replace(/\r?\n/gu, " ")
  );
  const humanDecision = humanDecisionMatch?.[1]?.trim();

  if (humanDecision) {
    return compactSummary(humanDecision, "human decision needed");
  }

  return "출처 내용이 아직 정리되지 않았습니다.";
}

function retainedSourceRefs(result: ResearchResultProjection, pack?: DecisionEvidencePackProjection) {
  return uniqueValues([
    sourceRetainedRef(result),
    ...(result.researchRunId ? [result.researchRunId] : []),
    ...(result.questionRef ? [result.questionRef] : []),
    ...(result.specSectionRef ? [result.specSectionRef] : []),
    ...(pack?.knownRisk ? [pack.knownRisk] : [])
  ]);
}

function mergeById<TItem, TId extends string>(items: readonly TItem[], nextItem: TItem, idOf: (item: TItem) => TId) {
  const nextId = idOf(nextItem);
  const withoutExisting = items.filter((item) => idOf(item) !== nextId);

  return [...withoutExisting, nextItem];
}

function reviewCardForTask(task: ResearchTaskProjection): ResearchReviewCardProjection {
  const retainedSourceRef = task.sourceAnswerRef ?? task.sourceQueueItemId;
  const outcomeMetadata = derivePendingResearchReviewCardOutcomeMetadata();

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    cardType: outcomeMetadata.cardType,
    title:
      task.routeOutcome === "missing_con_evidence"
        ? `다른 관점 확인 필요: ${task.objective}`
        : `Research review: ${task.objective}`,
    state: "pending_manual_result",
    impact: task.impact,
    ...(retainedSourceRef ? { retainedSourceRef } : {}),
    availableOutcomes: outcomeMetadata.availableOutcomes,
    suggestedOutcome: outcomeMetadata.suggestedOutcome,
    blocksPlanning: task.impact === "high",
    recoveryActions: outcomeMetadata.recoveryActions
  };
}

function reviewCardForMatrix(
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  matrix: EvidenceMatrixProjection,
  pack: DecisionEvidencePackProjection
): ResearchReviewCardProjection {
  const terminalFailure = matrix.balanceStatus === "source_quality_insufficient";
  const insufficient =
    pack.gateStatus === "research_insufficient" ||
    matrix.balanceStatus === "missing_con_evidence" ||
    matrix.balanceStatus === "needs_con_evidence" ||
    matrix.balanceStatus === "blocked_by_con_evidence";
  const needsReview = pack.gateStatus === "needs_review";
  const stale = pack.gateStatus === "stale";
  const sourceRefs = retainedSourceRefs(result, pack);
  const outcomeMetadata = deriveResearchReviewCardOutcomeMetadata({
    impact: task.impact,
    gateStatus: pack.gateStatus,
    balanceStatus: matrix.balanceStatus,
    hasAdditionalQuestions: matrix.additionalQuestions.length > 0
  });

  return {
    cardId: `research_review_${task.researchTaskId}` as QueueItemId,
    researchTaskId: task.researchTaskId,
    evidencePackId: pack.evidencePackId,
    cardType: outcomeMetadata.cardType,
    title: stale
      ? `Research stale: ${task.objective}`
      : needsReview
        ? `Quality gate review required: ${task.objective}`
        : terminalFailure
      ? `Research failed: ${task.objective}`
      : insufficient
        ? `Evidence still insufficient: ${task.objective}`
        : `Evidence ready: ${task.objective}`,
    state: stale
      ? "stale"
      : needsReview
        ? "quality_gate_review"
        : terminalFailure
          ? "terminal_failure"
          : insufficient
            ? "research_insufficient"
            : "ready_for_review",
    impact: task.impact,
    gateStatus: pack.gateStatus,
    decisionContext: pack.decisionContext,
    reviewReason: primaryGateReviewReason(pack) ?? pack.implicationScope,
    retainedSourceRef: sourceRetainedRef(result),
    retainedSourceRefs: sourceRefs,
    ...(matrix.additionalQuestions.length ? { additionalQuestions: matrix.additionalQuestions } : {}),
    availableOutcomes: outcomeMetadata.availableOutcomes,
    suggestedOutcome: outcomeMetadata.suggestedOutcome,
    blocksPlanning: task.impact === "high",
    recoveryActions: outcomeMetadata.recoveryActions
  };
}

export function resolveResearchReviewCardInProjection(
  projection: ResearchEvidenceProjection,
  cardId: QueueItemId,
  outcome: ResearchQueueTerminalOutcome,
  rationale: string | undefined,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const reviewCards = projection.reviewCards.map((card) =>
    card.cardId === cardId
      ? {
          ...card,
          state: "resolved" as const,
          terminalOutcome: outcome,
          ...(rationale ? { terminalRationale: rationale } : {}),
          blocksPlanning: card.impact === "high" && (outcome === "deferred" || outcome === "research_insufficient")
        }
      : card
  );
  const resolvedCard = reviewCards.find((card) => card.cardId === cardId);
  const knownRisks = uniqueValues([
    ...projection.knownRisks,
    ...(resolvedCard?.terminalOutcome === "risk_accepted"
      ? [
          `Accepted research risk for ${resolvedCard.title}: ${
            resolvedCard.terminalRationale ?? "No rationale provided."
          }`
        ]
      : []),
    ...(resolvedCard?.terminalOutcome === "deferred" && resolvedCard.terminalRationale
      ? [`Deferred research card ${resolvedCard.title}: ${resolvedCard.terminalRationale}`]
      : [])
  ]);

  return {
    ...projection,
    version,
    reviewCards,
    knownRisks,
    nextValidationActions: uniqueValues([
      ...projection.nextValidationActions,
      ...(outcome === "revised" && rationale ? [rationale] : []),
      ...(outcome === "research_insufficient" ? [`Supplement evidence before relying on ${cardId}.`] : [])
    ])
  };
}

function taskStatusForPack(matrix: EvidenceMatrixProjection, pack: DecisionEvidencePackProjection): ResearchTaskProjection["status"] {
  if (pack.gateStatus === "needs_review") {
    return "needs_review";
  }

  if (pack.gateStatus === "stale") {
    return "stale";
  }

  if (pack.gateStatus === "research_insufficient") {
    return "research_insufficient";
  }

  if (matrix.balanceStatus === "balanced") {
    return "evidence_ready";
  }

  if (matrix.balanceStatus === "source_quality_insufficient") {
    return "failed";
  }

  return "research_insufficient";
}

export function emptyResearchEvidenceProjection(version: ProjectionVersion = 0 as ProjectionVersion): ResearchEvidenceProjection {
  return {
    ...EMPTY_RESEARCH_PROJECTION,
    version
  };
}

export function planResearchTask(input: PlanResearchTaskInput): ResearchTaskProjection {
  return {
    researchTaskId: input.researchTaskId,
    sessionId: input.sessionId,
    ...(input.sourceQueueItemId ? { sourceQueueItemId: input.sourceQueueItemId } : {}),
    ...(input.sourceAnswerRef ? { sourceAnswerRef: input.sourceAnswerRef } : {}),
    objective: input.objective,
    ...(input.projectPurposeMode ? { projectPurposeMode: input.projectPurposeMode } : {}),
    ...(input.projectPurposeModeLabel ? { projectPurposeModeLabel: input.projectPurposeModeLabel } : {}),
    ...(input.projectPurposeModeEffect ? { projectPurposeModeEffect: input.projectPurposeModeEffect } : {}),
    ...(input.skippedCommercializationAxes?.length
      ? { skippedCommercializationAxes: input.skippedCommercializationAxes }
      : {}),
    routeOutcome: input.routeOutcome,
    impact: input.impact,
    status: "planned",
    createdAt: input.createdAt
  };
}

export function importResearchResult(input: ImportResearchResultInput): ResearchResultProjection {
  const sourceTitle = trimOrNull(input.sourceTitle);
  const sourceUrl = trimOrNull(input.sourceUrl);
  const limitationNotes = trimOrNull(input.limitationNotes);
  const sourceReliability = input.sourceReliability;
  const sourcePublishedAt = optionalNormalizedString(input.sourcePublishedAt);
  const sourceRetrievedAt = optionalNormalizedString(input.sourceRetrievedAt);
  const claim = optionalNormalizedString(input.claim);
  const decisionContext = optionalNormalizedString(input.decisionContext);
  const specSectionRef = optionalNormalizedString(input.specSectionRef);
  const questionRef = optionalNormalizedString(input.questionRef);
  const implicationScope = optionalNormalizedString(input.implicationScope);
  const sourceRequiredAfter = optionalNormalizedString(input.sourceRequiredAfter);

  return {
    researchResultId: input.researchResultId,
    researchTaskId: input.researchTaskId,
    ...(input.researchRunId ? { researchRunId: input.researchRunId } : {}),
    ...(sourceTitle ? { sourceTitle } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceReliability ? { sourceReliability } : {}),
    ...(sourcePublishedAt ? { sourcePublishedAt } : {}),
    ...(sourceRetrievedAt ? { sourceRetrievedAt } : {}),
    resultSummary: normalizeResultText(input.result, "Manual research result"),
    ...(limitationNotes ? { limitationNotes } : {}),
    ...(claim ? { claim } : {}),
    ...(decisionContext ? { decisionContext } : {}),
    ...(specSectionRef ? { specSectionRef } : {}),
    ...(questionRef ? { questionRef } : {}),
    ...(implicationScope ? { implicationScope } : {}),
    ...(input.staleSensitive !== undefined ? { staleSensitive: input.staleSensitive } : {}),
    ...(sourceRequiredAfter ? { sourceRequiredAfter } : {}),
    importedAt: input.importedAt
  };
}

export function synthesizeEvidenceMatrix(input: SynthesizeEvidenceInput): EvidenceMatrixProjection {
  const userFacingResultSummary = userFacingResearchText(
    input.researchResult.resultSummary,
    "Imported research result needs a user-facing summary."
  );
  const userFacingLimitationNotes = userFacingResearchText(
    input.researchResult.limitationNotes,
    "출처 폭과 실제 적용 가능성은 추가 확인이 필요합니다"
  );
  const resultText = `${userFacingResultSummary} ${userFacingLimitationNotes}`.toLowerCase();
  const token = `${input.researchResult.researchResultId}_v${input.synthesisVersion}`;
  const structuredFindings = parseStructuredResearchFindings(input.researchResult.resultSummary);
  const proFindingSummaries = structuredFindings.isStructuredSummary
    ? structuredFindings.findings
        .filter((finding) => finding.label === "supports")
        .map((finding) => finding.summary)
    : [];
  const conFindingSummaries = structuredFindings.isStructuredSummary
    ? structuredFindings.findings
        .filter((finding) => finding.label === "weakens")
        .map((finding) => finding.summary)
    : [];
  const uncertainFindingSummaries = structuredFindings.isStructuredSummary
    ? structuredFindings.findings
        .filter((finding) => finding.label === "uncertain")
        .map((finding) => finding.summary)
    : [];
  const hasPro = structuredFindings.isStructuredSummary
    ? proFindingSummaries.length > 0
    : includesAny(resultText, PRO_EVIDENCE_MARKERS);
  const hasCon = structuredFindings.isStructuredSummary
    ? conFindingSummaries.length > 0
    : includesAny(resultText, CON_EVIDENCE_MARKERS) ||
      (/\brisks?\b/.test(resultText) && !hasNegatedRiskClaim(resultText));
  const hasUncertainty = structuredFindings.isStructuredSummary
    ? uncertainFindingSummaries.length > 0 || structuredFindings.sourceQualityInsufficient
    : includesAny(resultText, UNCERTAINTY_MARKERS);
  const proEvidence = hasPro
    ? [
        {
          evidenceItemId: itemId("evidence_pro", token, 1),
          kind: "pro" as const,
          summary: structuredFindings.isStructuredSummary
            ? compactSummary(proFindingSummaries[0] ?? "", "Imported result supports the claim.")
            : evidenceSnippet(
                userFacingResultSummary,
                PRO_EVIDENCE_MARKERS,
                "Imported result supports the claim."
              )
        }
      ]
    : [];
  const conEvidence = hasCon
    ? [
        {
          evidenceItemId: itemId("evidence_con", token, 1),
          kind: "con" as const,
          summary: structuredFindings.isStructuredSummary
            ? compactSummary(conFindingSummaries[0] ?? "", "Imported result raises counter-evidence or risk.")
            : evidenceSnippet(
                userFacingResultSummary,
                CON_EVIDENCE_SNIPPET_MARKERS,
                "Imported result raises counter-evidence or risk."
              )
        }
      ]
    : [];
  const uncertaintySummary = structuredFindings.isStructuredSummary && uncertainFindingSummaries.length > 0
    ? compactSummary(uncertainFindingSummaries[0] ?? "", userFacingLimitationNotes)
    : userFacingLimitationNotes;
  const uncertainties = hasUncertainty || input.researchResult.limitationNotes
    ? [
        {
          evidenceItemId: itemId("evidence_uncertainty", token, 1),
          kind: "uncertainty" as const,
          summary: uncertaintySummary
        }
      ]
    : [];
  const balanceStatus =
    proEvidence.length > 0 && conEvidence.length > 0
      ? "balanced"
      : proEvidence.length > 0
        ? input.researchTask.impact === "high"
          ? "missing_con_evidence"
          : "needs_con_evidence"
        : conEvidence.length > 0
          ? "blocked_by_con_evidence"
          : "source_quality_insufficient";
  const missingConEvidenceReason =
    balanceStatus === "missing_con_evidence"
      ? input.researchResult.limitationNotes ??
        "Skeptical search/import did not include enough counter-evidence for a high-impact claim."
      : undefined;
  const knownRisk =
    balanceStatus === "balanced"
      ? undefined
      : balanceStatus === "source_quality_insufficient"
        ? `Research source was insufficient for ${input.researchTask.objective}.`
        : `Evidence remains ${balanceStatus} for ${input.researchTask.objective}.`;

  return {
    evidenceMatrixId: `evidence_matrix_${input.researchResult.researchResultId}_v${input.synthesisVersion}`,
    researchTaskId: input.researchTask.researchTaskId,
    researchResultId: input.researchResult.researchResultId,
    synthesisVersion: input.synthesisVersion,
    proEvidence,
    conEvidence,
    uncertainties,
    additionalQuestions:
      balanceStatus === "balanced"
        ? []
        : [
            additionalQuestionForEvidenceGap({
              objective: input.researchTask.objective,
              balanceStatus,
              proEvidence,
              conEvidence,
              uncertainties,
              ...(input.contextText ? { contextText: input.contextText } : {})
            })
          ],
    balanceStatus,
    decisionBlocked: input.researchTask.impact === "high" && balanceStatus !== "balanced",
    ...(missingConEvidenceReason ? { missingConEvidenceReason } : {}),
    ...(knownRisk ? { knownRisk } : {})
  };
}

function isoMillis(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function check(
  code: ResearchQualityGateCheckProjection["code"],
  status: ResearchQualityGateCheckProjection["status"],
  reason: string
): ResearchQualityGateCheckProjection {
  return { code, status, reason };
}

function qualityGateStatusFor(
  task: ResearchTaskProjection,
  matrix: EvidenceMatrixProjection,
  checks: readonly ResearchQualityGateCheckProjection[]
): DecisionEvidencePackProjection["gateStatus"] {
  if (checks.some((candidate) => candidate.code === "staleness" && candidate.status === "failed")) {
    return "stale";
  }

  if (
    checks.some((candidate) => candidate.status === "failed") ||
    matrix.balanceStatus === "source_quality_insufficient" ||
    matrix.balanceStatus === "blocked_by_con_evidence" ||
    (task.impact === "high" && matrix.balanceStatus !== "balanced")
  ) {
    return "research_insufficient";
  }

  if (checks.some((candidate) => candidate.status === "unknown")) {
    return "needs_review";
  }

  return "accepted";
}

function sourceReliabilityFor(result: ResearchResultProjection): ResearchSourceReliability {
  return result.sourceReliability ?? "medium";
}

function limitationRefsFor(result: ResearchResultProjection, matrix: EvidenceMatrixProjection) {
  return uniqueValues([
    ...(result.limitationNotes ? [result.limitationNotes] : []),
    ...(matrix.uncertainties.length ? matrix.uncertainties.map((item) => item.summary) : [])
  ]);
}

function implicationScopeFor(task: ResearchTaskProjection, result: ResearchResultProjection, matrix: EvidenceMatrixProjection) {
  const provided = trimOrNull(result.implicationScope);

  if (provided) {
    return provided;
  }

  if (matrix.balanceStatus === "balanced") {
    return `Evidence is scoped to the research task "${task.objective}" and supports decision review, not automatic SpecVersion updates.`;
  }

  return `Evidence is insufficient for "${task.objective}"; preserve it as a Risk/Review item before changing product decisions.`;
}

function primaryGateReviewReason(pack: DecisionEvidencePackProjection) {
  return (
    pack.gateChecks.find((check) => check.status === "failed") ??
    pack.gateChecks.find((check) => check.status === "unknown")
  )?.reason;
}

export function buildDecisionEvidencePack(
  input: SynthesizeEvidenceInput & { readonly matrix: EvidenceMatrixProjection }
): DecisionEvidencePackProjection {
  const { researchTask, researchResult, matrix } = input;
  const reliability = sourceReliabilityFor(researchResult);
  const limitationRefs = limitationRefsFor(researchResult, matrix);
  const implicationScope = implicationScopeFor(researchTask, researchResult, matrix);
  const publishedAt = isoMillis(researchResult.sourcePublishedAt);
  const requiredAfter = isoMillis(researchResult.sourceRequiredAfter);
  const staleSensitive = researchResult.staleSensitive === true || Boolean(researchResult.sourceRequiredAfter);
  const staleFailed =
    staleSensitive && publishedAt !== null && requiredAfter !== null && publishedAt < requiredAfter;
  const checks = [
    check(
      "source_metadata",
      reliability === "unknown" && !researchResult.sourceTitle && !researchResult.sourceUrl ? "unknown" : "passed",
      reliability === "unknown" && !researchResult.sourceTitle && !researchResult.sourceUrl
        ? "Source metadata is insufficient for automatic quality-gate evaluation."
        : "Source title/url/date metadata is captured when available or the manual import is explicitly retained."
    ),
    check(
      "source_reliability",
      researchTask.impact === "high" && reliability === "low"
        ? "failed"
        : reliability === "unknown"
          ? "unknown"
          : "passed",
      researchTask.impact === "high" && reliability === "low"
        ? "Low-reliability source cannot support a high-impact claim by itself."
        : reliability === "unknown"
          ? "Source reliability requires manual review before evidence acceptance."
          : `Source reliability is ${reliability}.`
    ),
    check(
      "pro_con_balance",
      matrix.proEvidence.length > 0 && matrix.conEvidence.length > 0
        ? "passed"
        : matrix.missingConEvidenceReason || matrix.balanceStatus === "needs_con_evidence"
          ? researchTask.impact === "high"
            ? "failed"
            : "passed"
          : "failed",
      matrix.proEvidence.length > 0 && matrix.conEvidence.length > 0
        ? "Pro and con evidence are both present."
        : matrix.missingConEvidenceReason || matrix.balanceStatus === "needs_con_evidence"
          ? researchTask.impact === "high"
            ? "High-impact claim records missing_con_evidence and remains blocked from decision-ready."
            : "Missing counterpoint evidence is explicit and connected to Known Risks/validation actions."
          : "Evidence lacks an explicit pro/con or missing_con_evidence outcome."
    ),
    check(
      "limitations_linked",
      limitationRefs.length > 0 || matrix.knownRisk || matrix.balanceStatus === "balanced" ? "passed" : "unknown",
      limitationRefs.length > 0 || matrix.knownRisk
        ? "Limitations are connected to Known Risks or next validation actions."
        : matrix.balanceStatus === "balanced"
          ? "No separate limitation was declared for the balanced evidence pack."
        : "Limitations are not explicit enough for automatic acceptance."
    ),
    check(
      "staleness",
      staleFailed ? "failed" : staleSensitive && (publishedAt === null || requiredAfter === null) ? "unknown" : "passed",
      staleFailed
        ? "Source timestamp predates the freshness requirement."
        : staleSensitive && (publishedAt === null || requiredAfter === null)
          ? "Stale-sensitive evidence is missing comparable source/freshness timestamps."
          : "Staleness policy is satisfied or not applicable."
    ),
    check(
      "implication_scope",
      implicationScope ? "passed" : "unknown",
      implicationScope
        ? "Implication is scoped to evidence strength and does not silently update SpecVersion."
        : "Product implication scope requires manual review."
    )
  ] as const satisfies readonly ResearchQualityGateCheckProjection[];
  const gateStatus = qualityGateStatusFor(researchTask, matrix, checks);
  const knownRisk =
    gateStatus === "accepted"
      ? matrix.knownRisk
      : matrix.knownRisk ?? `${gateStatus} evidence for ${researchTask.objective}.`;
  const nextValidationAction =
    gateStatus === "accepted"
      ? undefined
      : gateStatus === "stale"
        ? `Refresh source evidence for ${researchTask.objective}.`
        : `Review or supplement evidence for ${researchTask.objective}.`;

  return {
    evidencePackId: `evidence_pack_${researchResult.researchResultId}_v${input.synthesisVersion}` as DecisionEvidencePackId,
    researchTaskId: researchTask.researchTaskId,
    researchResultId: researchResult.researchResultId,
    ...(researchResult.researchRunId ? { researchRunId: researchResult.researchRunId } : {}),
    claim: researchResult.claim ?? researchTask.objective,
    decisionContext: researchResult.decisionContext ?? researchTask.routeOutcome,
    ...(researchResult.specSectionRef ? { specSectionRef: researchResult.specSectionRef } : {}),
    ...(researchResult.questionRef ?? researchTask.sourceQueueItemId
      ? { questionRef: researchResult.questionRef ?? researchTask.sourceQueueItemId }
      : {}),
    ...(researchResult.sourceTitle ? { sourceTitle: researchResult.sourceTitle } : {}),
    ...(researchResult.sourceUrl ? { sourceUrl: researchResult.sourceUrl } : {}),
    sourceReliability: reliability,
    ...(researchResult.sourcePublishedAt ? { sourcePublishedAt: researchResult.sourcePublishedAt } : {}),
    retrievedAt: researchResult.sourceRetrievedAt ?? researchResult.importedAt,
    gateStatus,
    gateChecks: checks,
    proEvidenceItemIds: matrix.proEvidence.map((item) => item.evidenceItemId),
    conEvidenceItemIds: matrix.conEvidence.map((item) => item.evidenceItemId),
    uncertaintyItemIds: matrix.uncertainties.map((item) => item.evidenceItemId),
    limitationRefs,
    implicationScope,
    ...(knownRisk ? { knownRisk } : {}),
    ...(nextValidationAction ? { nextValidationAction } : {}),
    createdAt: researchResult.importedAt
  };
}

export function addResearchTaskToProjection(
  projection: ResearchEvidenceProjection,
  task: ResearchTaskProjection,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const tasks = mergeById(projection.tasks, task, (item) => item.researchTaskId);
  const reviewCards = mergeById(projection.reviewCards, reviewCardForTask(task), (item) => item.cardId);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    reviewCards,
    proConBalanceStatus:
      task.routeOutcome === "missing_con_evidence" ? "missing_con_evidence" : projection.proConBalanceStatus
  };
}

export function addResearchResultToProjection(
  projection: ResearchEvidenceProjection,
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  matrix: EvidenceMatrixProjection,
  pack: DecisionEvidencePackProjection,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const updatedTask = {
    ...task,
    status: taskStatusForPack(matrix, pack)
  };
  const tasks = mergeById(projection.tasks, updatedTask, (item) => item.researchTaskId);
  const results = mergeById(projection.results, result, (item) => item.researchResultId);
  const evidenceMatrices = mergeById(projection.evidenceMatrices, matrix, (item) => item.evidenceMatrixId);
  const evidencePacks = mergeById(projection.evidencePacks, pack, (item) => item.evidencePackId);
  const reviewCards = mergeById(
    projection.reviewCards,
    reviewCardForMatrix(updatedTask, result, matrix, pack),
    (item) => item.cardId
  );
  const knownRisks = uniqueValues([
    ...projection.knownRisks,
    ...(matrix.knownRisk ? [matrix.knownRisk] : []),
    ...(pack.knownRisk ? [pack.knownRisk] : [])
  ]);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    results,
    evidenceMatrices,
    evidencePacks,
    reviewCards,
    knownRisks,
    nextValidationActions: uniqueValues([
      ...projection.nextValidationActions,
      ...(pack.nextValidationAction ? [pack.nextValidationAction] : []),
      ...knownRisks.map((risk) => `Validate or explicitly accept: ${risk}`)
    ]),
    proConBalanceStatus: matrix.balanceStatus
  };
}

export function addImportedResearchResultToProjection(
  projection: ResearchEvidenceProjection,
  task: ResearchTaskProjection,
  result: ResearchResultProjection,
  version: ProjectionVersion
): ResearchEvidenceProjection {
  const updatedTask = {
    ...task,
    status: "handoff_ready" as const
  };
  const tasks = mergeById(projection.tasks, updatedTask, (item) => item.researchTaskId);
  const results = mergeById(projection.results, result, (item) => item.researchResultId);

  return {
    ...projection,
    version,
    taskIds: tasks.map((item) => item.researchTaskId),
    tasks,
    results
  };
}
