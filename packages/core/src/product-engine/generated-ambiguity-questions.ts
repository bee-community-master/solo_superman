import type {
  AmbiguityAnswerOption,
  AmbiguityAnswerSelectionMode,
  AmbiguityExpectedAnswerType,
  AmbiguityIssueSeverity,
  AmbiguityIssueUncertaintyType,
  AmbiguityPossibleRoute,
  AmbiguityReductionDimension,
  AmbiguityRoutingPath,
  BusinessCriticIntensity,
  BusinessCriticPressureKind
} from "@solo-superman/contracts";
import {
  AMBIGUITY_REDUCTION_DIMENSIONS,
  AMBIGUITY_ROUTING_PATHS,
  BUSINESS_CRITIC_INTENSITIES,
  CANONICAL_INITIAL_SPEC_SECTIONS
} from "@solo-superman/contracts";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";
import {
  extractIdeaFitDomainSignals,
  ideaFitDomainAnchorTerms,
  textHasIdeaFitDomainAnchor
} from "./idea-fit-questioning";

export const GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION =
  "solo-superman-generated-ambiguity-questions.v1";
export const GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_REF =
  "prompt-template:generated-ambiguity-questions:v1";

export interface GeneratedAmbiguityQuestionSeed {
  readonly sectionRef: string;
  readonly topicKey: string;
  readonly uncertaintyType: AmbiguityIssueUncertaintyType;
  readonly severity: AmbiguityIssueSeverity;
  readonly summary: string;
  readonly whyItMatters: string;
  readonly question: string;
  readonly expectedAnswerType: AmbiguityExpectedAnswerType;
  readonly answerSelectionMode?: AmbiguityAnswerSelectionMode;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
  readonly decisionItUnlocks: string;
  readonly ambiguityDimension: AmbiguityReductionDimension;
  readonly ambiguityRoutingPath: AmbiguityRoutingPath;
  readonly businessCriticIntensityMinimum?: BusinessCriticIntensity;
  readonly businessCriticPressureKind?: BusinessCriticPressureKind;
  readonly researchQuestion?: string;
  readonly routes: readonly AmbiguityPossibleRoute[];
  readonly suggestedResearchTask?: string;
  readonly sourceRef?: string;
}

export interface GeneratedAmbiguityQuestionSetParseResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly questions: readonly GeneratedAmbiguityQuestionSeed[];
}

export interface GeneratedAmbiguityQuestionSetTextParseResult extends GeneratedAmbiguityQuestionSetParseResult {
  readonly value?: unknown;
}

export interface GeneratedAmbiguityQuestionSetContextValidationInput {
  readonly contextText?: string;
}

const ALLOWED_SECTIONS = new Set<string>(CANONICAL_INITIAL_SPEC_SECTIONS);
const ALLOWED_UNCERTAINTY_TYPES = new Set<AmbiguityIssueUncertaintyType>([
  "missing",
  "vague",
  "unsupported",
  "conflict",
  "decision_required",
  "missing_con_evidence"
]);
const ALLOWED_SEVERITIES = new Set<AmbiguityIssueSeverity>(["high", "medium", "low"]);
const ALLOWED_EXPECTED_ANSWER_TYPES = new Set<AmbiguityExpectedAnswerType>([
  "choice",
  "text",
  "rank",
  "evidence",
  "experiment"
]);
const ALLOWED_SELECTION_MODES = new Set<AmbiguityAnswerSelectionMode>(["single", "multiple", "ranked"]);
const ALLOWED_ROUTES = new Set<AmbiguityPossibleRoute>([
  "question",
  "research_needed",
  "missing_con_evidence",
  "decision_candidate",
  "spec_update_candidate",
  "conflict_detected",
  "deferred",
  "repeat_limit_reached"
]);
const ALLOWED_AMBIGUITY_DIMENSIONS = new Set<AmbiguityReductionDimension>(AMBIGUITY_REDUCTION_DIMENSIONS);
const ALLOWED_AMBIGUITY_ROUTING_PATHS = new Set<AmbiguityRoutingPath>(AMBIGUITY_ROUTING_PATHS);
const ALLOWED_BUSINESS_CRITIC_INTENSITIES = new Set<BusinessCriticIntensity>(BUSINESS_CRITIC_INTENSITIES);
const ALLOWED_BUSINESS_CRITIC_PRESSURE_KINDS = new Set<BusinessCriticPressureKind>([
  "balanced_con",
  "core_assumption_challenge",
  "investor_pressure_pass"
]);
const PET_LIFECYCLE_CONTEXT_PATTERN =
  /(?:반려\s*동물|반려견|반려묘|펫\b|pet\b|companion\s+animal|동물병원|수의|veterinary|동물\s*진료|동물\s*의료|동물\s*보험|펫\s*보험|반려\s*(?:동물|견|묘).{0,20}(?:기록|의료|보험|장례|급여|일상|전생애|생애주기)|사료|동물\s*장례|반려\s*(?:동물|견|묘).{0,20}말기\s*케어|동물\s*말기\s*케어|펫\s*말기\s*케어)/iu;
const PET_LIFECYCLE_ANCHOR_PATTERN =
  /(?:반려\s*동물|반려견|반려묘|보호자|펫\b|pet\b|guardian|companion\s+animal|clinic|veterinary|medical|record|daily\s*care|동물병원|수의|진료|의료\s*기록|기록|의료비|투약|급여|사료|보험|insurance|장례|funeral|end-of-life|말기\s*케어|전생애|생애주기|lifecycle)/iu;
const LOCAL_COMMERCE_CONTEXT_PATTERN =
  /(?:식당|카페|매장|소상공인|예약|주문|픽업|배달|단골|손님|로컬\s*커머스|restaurant|cafe|merchant|reservation|order|pickup|delivery|loyalty)/iu;
const LOCAL_COMMERCE_ANCHOR_PATTERN =
  /(?:식당|카페|매장|소상공인|예약|주문|픽업|배달|단골|손님|고객|로컬\s*커머스|restaurant|cafe|store|merchant|reservation|order|pickup|delivery|loyalty|customer)/iu;
const FOUNDER_VALIDATION_CONTEXT_PATTERN =
  /(?:창업자|예비\s*창업|스타트업|고객\s*인터뷰|제품\s*스펙|아이디어\s*검증|\bfounder\b|\bstartup\b|customer\s*interview|product\s*spec|idea\s*validation|\bsolo\s*founder\b)/iu;
const FOUNDER_VALIDATION_ANCHOR_PATTERN =
  /(?:창업자|예비\s*창업|스타트업|고객\s*인터뷰|제품\s*스펙|아이디어\s*검증|질문\s*품질|근거\s*추적|\bfounder\b|\bstartup\b|customer\s*interview|product\s*spec|idea\s*validation|\bquestion\b|\btraceable\b)/iu;
const GENERIC_PERSONA_GUARDS = [
  {
    personaPattern: /(?:1\s*인\s*창업자|혼자\s*만드는\s*창업자|초기\s*창업자|\bsolo\s*founder\b|\bfounder\b)/iu,
    allowedContextPattern:
      /(?:창업자|예비\s*창업자|창업\s*준비(?:자|생|중인\s*사람)|만드는\s*사람|스타트업|\bfounder\b|\bstartup\b|\bsolo\s*founder\b)/iu
  },
  {
    personaPattern: /(?:도메인\s*전문\s*1\s*인\s*빌더|\bdomain\s*builder\b)/iu,
    allowedContextPattern:
      /(?:1\s*인\s*빌더|도메인\s*전문\s*빌더|도메인\s*전문\s*1\s*인\s*빌더|\bsolo\s*builder\b|\bdomain\s*builder\b)/iu
  },
  {
    personaPattern: /(?:팀\s*리더|운영\s*담당자|\bteam\s*lead\b|\boperator\b)/iu,
    allowedContextPattern: /(?:팀\s*리더|운영\s*담당자|운영\s*팀|\bteam\s*lead\b|\boperator\b)/iu
  }
] as const;
const USER_FACING_GENERATED_QUESTION_JARGON_PATTERN =
  /\b(?:primary\s+customer|planning-ready|high-impact\s+gate|quality-gate|pro\/con|MVP|paid\s+intent|proxy|validation\s+experiment)\b/iu;
const INITIAL_META_ANSWER_OPTION_PATTERN =
  /^(?:진행|진행한다|보류|보류한다|더\s*설명|추가\s*설명|추가\s*리서치|리서치\s*필요|검증\s*후\s*결정|모름|알\s*수\s*없음)$/iu;
const GENERIC_PLANNING_ANSWER_OPTION_PATTERN =
  /^(?:초기\s*(?:사용자|고객)|일반\s*(?:사용자|고객)|모든\s*(?:사용자|고객)|첫\s*(?:사용자|고객)|고객\s*후보\s*[a-z가-힣0-9]?|사용자\s*후보\s*[a-z가-힣0-9]?|세그먼트\s*[a-z가-힣0-9]?|옵션\s*[a-z가-힣0-9]?|선택지\s*[a-z가-힣0-9]?|기능\s*[a-z가-힣0-9]?)$/iu;
const GENERIC_RESEARCH_TASK_PATTERN =
  /^(?:추가\s*리서치(?:가)?\s*(?:필요|하기|진행)?|자료\s*더\s*찾기|근거\s*더\s*찾기|리서치\s*필요|do\s+more\s+research|additional\s+research\s+needed|research\s+needed)$/iu;
const RESEARCH_SOURCE_SEEKING_CUE_PATTERN =
  /(?:공개|출처|자료|후기|커뮤니티|리포트|보고서|통계|가이드|가격|정책|규정|경쟁|대체재|사례|리뷰|forum|community|review|report|source|public|statistic|guide|policy|pricing|competitor|alternative|case)/iu;
const MAX_USER_FACING_QUESTION_CHARS = 120;
const MAX_USER_FACING_SUPPORTING_TEXT_CHARS = 180;
const RESEARCH_SKEPTICAL_CUE_PATTERN =
  /(?:반례|반대|부족|약하|흔들|불확실|한계|위험|실패|다른|여전히|남는|counter|contrary|weaken|missing|gap|uncertain|uncertainty|limit|risk|fail|skeptical)/iu;
const RESEARCH_REMAINING_HUMAN_JUDGMENT_CUE_PATTERN =
  /(?:남(?:는|은)\s*(?:판단|결정|선택|불확실)|사용자\s*(?:판단|결정|선택)|사람이\s*(?:판단|결정|선택)|리서치(?:로|만으로)?\s*(?:정할|결정할|판단할)\s*수\s*없|human\s+judgment|remaining\s+(?:decision|judgment)|cannot\s+be\s+(?:answered|decided))/iu;
const DECISION_AXIS_PATTERNS = [
  /(?:누구|어떤\s*(?:고객|사용자|보호자|사람|조직|세그먼트)|who|customer|user|segment)/iu,
  /(?:기능|어디까지|범위|무엇을\s*(?:만들|제공|포함)|feature|scope)/iu,
  /(?:성공\s*기준|성공했는지|어떻게\s*(?:판단|측정)|지표|완료\s*조건|success|metric|criteria|measure)/iu,
  /(?:구매자|결제자|돈을\s*내|buyer|payer|purchase)/iu,
  /(?:채널|어디에서\s*(?:만나|찾|모집)|channel|acquisition)/iu
] as const;

const IDEA_FIT_CONTEXT_PROFILES = [
  { contextPattern: PET_LIFECYCLE_CONTEXT_PATTERN, anchorPattern: PET_LIFECYCLE_ANCHOR_PATTERN },
  { contextPattern: LOCAL_COMMERCE_CONTEXT_PATTERN, anchorPattern: LOCAL_COMMERCE_ANCHOR_PATTERN },
  { contextPattern: FOUNDER_VALIDATION_CONTEXT_PATTERN, anchorPattern: FOUNDER_VALIDATION_ANCHOR_PATTERN }
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? plainUserFacingDecisionQueueText(value).trim() : "";
}

function rawStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function rawStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map(rawStringValue).filter((item) => item.length > 0)
    : [];
}

function normalizedCompactText(value: string) {
  return plainUserFacingDecisionQueueText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function significantContextPhrases(contextText: string | undefined) {
  const normalizedSentences = (contextText ?? "")
    .split(/[\n.!?。！？]+/u)
    .map(normalizedCompactText)
    .filter((phrase) => phrase.length >= 24);
  const normalizedContext = normalizedCompactText(contextText ?? "");
  const words = normalizedContext.split(/\s+/u).filter(Boolean);
  const wordWindows = words.flatMap((_, index) => {
    const window = words.slice(index, index + 8);

    if (window.length < 6) {
      return [];
    }

    const phrase = window.join(" ");

    return phrase.length >= 24 ? [phrase] : [];
  });

  return [...new Set([...normalizedSentences, ...wordWindows].map((phrase) => phrase.slice(0, 90)))];
}

interface BusinessCriticPressureMetadataValidation {
  readonly invalidIntensityMinimum: boolean;
  readonly invalidPressureKind: boolean;
  readonly missingPressureKind: boolean;
  readonly invalidInvestorMinimum: boolean;
  readonly invalidCoreAssumptionMinimum: boolean;
  readonly invalidBalancedMinimum: boolean;
}

function businessCriticPressureMetadataValidation(input: {
  readonly rawIntensityMinimum: string;
  readonly intensityMinimum: BusinessCriticIntensity;
  readonly rawPressureKind: string;
  readonly pressureKind: BusinessCriticPressureKind;
}): BusinessCriticPressureMetadataValidation {
  return {
    invalidIntensityMinimum:
      Boolean(input.rawIntensityMinimum) && !ALLOWED_BUSINESS_CRITIC_INTENSITIES.has(input.intensityMinimum),
    invalidPressureKind: Boolean(input.rawPressureKind) && !ALLOWED_BUSINESS_CRITIC_PRESSURE_KINDS.has(input.pressureKind),
    missingPressureKind: Boolean(input.rawIntensityMinimum) && !input.rawPressureKind,
    invalidInvestorMinimum: input.pressureKind === "investor_pressure_pass" && input.intensityMinimum !== "investor_grade",
    invalidCoreAssumptionMinimum:
      input.pressureKind === "core_assumption_challenge" && !["strong", "investor_grade"].includes(input.intensityMinimum),
    invalidBalancedMinimum:
      input.pressureKind === "balanced_con" &&
      Boolean(input.rawIntensityMinimum) &&
      input.intensityMinimum !== "balanced"
  };
}

function hasInvalidBusinessCriticPressureMetadata(validation: BusinessCriticPressureMetadataValidation) {
  return Object.values(validation).some(Boolean);
}

function normalizedResearchTaskText(value: string) {
  return value
    .replace(/[.。!?？！，,\s]+/gu, " ")
    .trim();
}

function isGenericResearchTask(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = normalizedResearchTaskText(value);

  return GENERIC_RESEARCH_TASK_PATTERN.test(normalized);
}

function researchTaskHasSourceSeekingCue(value: string | undefined) {
  return Boolean(value && RESEARCH_SOURCE_SEEKING_CUE_PATTERN.test(value));
}

function researchTaskHasSkepticalCue(value: string | undefined) {
  return Boolean(value && RESEARCH_SKEPTICAL_CUE_PATTERN.test(value));
}

function researchTaskHasRemainingHumanJudgmentCue(value: string | undefined) {
  return Boolean(value && RESEARCH_REMAINING_HUMAN_JUDGMENT_CUE_PATTERN.test(value));
}

function questionHasMultipleDecisionAxes(question: string) {
  const questionMarkCount = (question.match(/[?？]/gu) ?? []).length;

  if (questionMarkCount > 1) {
    return true;
  }

  const matchedAxisCount = DECISION_AXIS_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(question) ? 1 : 0),
    0
  );

  return matchedAxisCount >= 2;
}

function ideaFitCuePatternForContext(contextText: string | undefined) {
  const normalizedContext = contextText ?? "";

  return IDEA_FIT_CONTEXT_PROFILES.find((profile) => profile.contextPattern.test(normalizedContext))?.anchorPattern;
}

function optionTextHasGenericPersona(optionText: string) {
  return GENERIC_PERSONA_GUARDS.some((guard) => guard.personaPattern.test(optionText));
}

function optionTextHasDisallowedGenericPersona(optionText: string, contextText: string | undefined) {
  const normalizedContext = contextText ?? "";

  return GENERIC_PERSONA_GUARDS.some(
    (guard) => guard.personaPattern.test(optionText) && !guard.allowedContextPattern.test(normalizedContext)
  );
}

function isGenericPlanningAnswerOption(option: AmbiguityAnswerOption) {
  return GENERIC_PLANNING_ANSWER_OPTION_PATTERN.test(option.label);
}

function issue(issues: string[], path: string, message: string) {
  issues.push(`${path}: ${message}`);
}

function normalizedOptionId(value: string, index: number) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/giu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 48);

  return normalized || `option_${index + 1}`;
}

function parseAnswerOption(value: unknown, path: string, index: number, issues: string[]): AmbiguityAnswerOption | null {
  if (!isRecord(value)) {
    issue(issues, path, "answer option must be an object");
    return null;
  }

  const label = stringValue(value.label);
  const optionValue = stringValue(value.value);
  const primaryDetail = stringValue(value.primaryDetail ?? value.pro);
  const secondaryDetail = stringValue(value.secondaryDetail ?? value.con);

  if (!label) {
    issue(issues, `${path}.label`, "must be a non-empty user-facing label");
  }
  if (!optionValue) {
    issue(issues, `${path}.value`, "must be a non-empty answer value");
  }
  if (!primaryDetail) {
    issue(issues, `${path}.primaryDetail`, "must describe what the choice decides");
  }
  if (!secondaryDetail) {
    issue(issues, `${path}.secondaryDetail`, "must describe what still needs checking");
  }

  if (!label || !optionValue || !primaryDetail || !secondaryDetail) {
    return null;
  }

  const id = rawStringValue(value.id) || normalizedOptionId(label, index);

  return {
    id,
    label,
    value: optionValue,
    primaryDetail,
    secondaryDetail,
    pro: primaryDetail,
    con: secondaryDetail
  };
}

function generatedQuestionUserFacingTexts(question: GeneratedAmbiguityQuestionSeed) {
  return [
    question.summary,
    question.whyItMatters,
    question.question,
    question.decisionItUnlocks,
    question.researchQuestion ?? "",
    question.suggestedResearchTask ?? "",
    ...(question.answerOptions ?? []).flatMap((option) => [
      option.label,
      option.value,
      option.primaryDetail ?? "",
      option.secondaryDetail ?? ""
    ])
  ].filter(Boolean);
}

function contextualGeneratedQuestionIssues(
  questions: readonly GeneratedAmbiguityQuestionSeed[],
  contextText: string | undefined
) {
  const issues: string[] = [];
  const combinedContext = [
    contextText ?? "",
    ...questions.flatMap(generatedQuestionUserFacingTexts)
  ].join("\n");
  const isPetLifecycleContext = PET_LIFECYCLE_CONTEXT_PATTERN.test(combinedContext);
  const ideaFitCuePattern = ideaFitCuePatternForContext(contextText);
  const domainSignals = extractIdeaFitDomainSignals(contextText ? { rawIdea: contextText } : {});
  const domainAnchorTerms = ideaFitDomainAnchorTerms(domainSignals);
  const repeatedContextPhrases = significantContextPhrases(contextText);

  questions.forEach((question, questionIndex) => {
    const normalizedQuestionText = normalizedCompactText(question.question);

    if (question.question.length > MAX_USER_FACING_QUESTION_CHARS) {
      issue(
        issues,
        `$.questions[${questionIndex}].questionText`,
        `generated question must stay under ${MAX_USER_FACING_QUESTION_CHARS} characters`
      );
    }

    if (repeatedContextPhrases.some((phrase) => normalizedQuestionText.includes(phrase))) {
      issue(
        issues,
        `$.questions[${questionIndex}].questionText`,
        "generated question must not repeat the full idea or goal text shown elsewhere in the UI"
      );
    }

    if (
      question.whyItMatters.length > MAX_USER_FACING_SUPPORTING_TEXT_CHARS ||
      question.decisionItUnlocks.length > MAX_USER_FACING_SUPPORTING_TEXT_CHARS
    ) {
      issue(
        issues,
        `$.questions[${questionIndex}]`,
        `whyItMatters and decisionItUnlocks must stay under ${MAX_USER_FACING_SUPPORTING_TEXT_CHARS} characters`
      );
    }

    if (
      (domainAnchorTerms.length > 0 &&
        !textHasIdeaFitDomainAnchor(question.question, domainSignals) &&
        !(ideaFitCuePattern?.test(question.question))) ||
      (domainAnchorTerms.length === 0 && ideaFitCuePattern && !ideaFitCuePattern.test(question.question))
    ) {
      issue(
        issues,
        `$.questions[${questionIndex}].questionText`,
        "generated question must include idea/domain anchors from the original idea"
      );
    }

    generatedQuestionUserFacingTexts(question).forEach((text) => {
      if (USER_FACING_GENERATED_QUESTION_JARGON_PATTERN.test(text)) {
        issue(
          issues,
          `$.questions[${questionIndex}]`,
          "user-facing generated question fields must avoid internal planning jargon"
        );
      }
    });

    (question.answerOptions ?? []).forEach((option, optionIndex) => {
      const optionText = [
        option.label,
        option.value,
        option.primaryDetail ?? "",
        option.secondaryDetail ?? ""
      ].join("\n");

      const hasGenericPersona = optionTextHasGenericPersona(optionText);

      if (
        (domainAnchorTerms.length > 0 &&
          !textHasIdeaFitDomainAnchor(optionText, domainSignals) &&
          !(ideaFitCuePattern?.test(optionText))) ||
        (domainAnchorTerms.length === 0 && ideaFitCuePattern && !ideaFitCuePattern.test(optionText))
      ) {
        issue(
          issues,
          `$.questions[${questionIndex}].answerOptions[${optionIndex}]`,
          "generated answer options must be anchored in the idea domain"
        );
      }

      if (INITIAL_META_ANSWER_OPTION_PATTERN.test(option.label)) {
        issue(
          issues,
          `$.questions[${questionIndex}].answerOptions[${optionIndex}]`,
          "initial generated answer options must be real domain choices, not progress/hold/explain meta actions"
        );
      }

      if (optionTextHasDisallowedGenericPersona(optionText, contextText)) {
        issue(
          issues,
          `$.questions[${questionIndex}].answerOptions[${optionIndex}]`,
          "generated question options must be derived from the idea; generic founder/builder/team personas are only allowed when the idea names that audience"
        );
      }

      if (isPetLifecycleContext && hasGenericPersona) {
        issue(
          issues,
          `$.questions[${questionIndex}].answerOptions[${optionIndex}]`,
          "pet lifecycle generated questions must use pet guardian/domain choices, not generic founder/builder/team personas"
        );
      }
    });
  });

  return issues;
}

function expectedSelectionMode(
  expectedAnswerType: AmbiguityExpectedAnswerType,
  provided: unknown,
  path: string,
  issues: string[]
) {
  if (provided === undefined) {
    if (expectedAnswerType === "rank") {
      return "ranked";
    }

    return expectedAnswerType === "choice" || expectedAnswerType === "evidence" || expectedAnswerType === "experiment"
      ? "single"
      : undefined;
  }

  const value = rawStringValue(provided);
  if (!ALLOWED_SELECTION_MODES.has(value as AmbiguityAnswerSelectionMode)) {
    issue(issues, path, "must be single, multiple, or ranked when provided");
    return undefined;
  }

  return value as AmbiguityAnswerSelectionMode;
}

function parseGeneratedQuestion(
  value: unknown,
  path: string,
  index: number,
  issues: string[]
): GeneratedAmbiguityQuestionSeed | null {
  if (!isRecord(value)) {
    issue(issues, path, "question must be an object");
    return null;
  }

  const sectionRef = rawStringValue(value.sectionRef);
  const topicKey = rawStringValue(value.topicKey);
  const uncertaintyType = rawStringValue(value.uncertaintyType) as AmbiguityIssueUncertaintyType;
  const severity = rawStringValue(value.severity) as AmbiguityIssueSeverity;
  const summary = stringValue(value.summary);
  const whyItMatters = stringValue(value.whyItMatters);
  const question = stringValue(value.questionText ?? value.question);
  const expectedAnswerType = rawStringValue(value.expectedAnswerType) as AmbiguityExpectedAnswerType;
  const decisionItUnlocks = stringValue(value.decisionItUnlocks);
  const rawAmbiguityDimension = rawStringValue(value.ambiguityDimension);
  const rawAmbiguityRoutingPath = rawStringValue(value.ambiguityRoutingPath ?? value.routingPath);
  const ambiguityDimension = rawAmbiguityDimension as AmbiguityReductionDimension;
  const ambiguityRoutingPath = rawAmbiguityRoutingPath as AmbiguityRoutingPath;
  const rawBusinessCriticIntensityMinimum = rawStringValue(value.businessCriticIntensityMinimum);
  const businessCriticIntensityMinimum = rawBusinessCriticIntensityMinimum as BusinessCriticIntensity;
  const rawBusinessCriticPressureKind = rawStringValue(value.businessCriticPressureKind);
  const businessCriticPressureKind = rawBusinessCriticPressureKind as BusinessCriticPressureKind;
  const businessCriticPressureMetadata = businessCriticPressureMetadataValidation({
    rawIntensityMinimum: rawBusinessCriticIntensityMinimum,
    intensityMinimum: businessCriticIntensityMinimum,
    rawPressureKind: rawBusinessCriticPressureKind,
    pressureKind: businessCriticPressureKind
  });
  const researchQuestion = stringValue(value.researchQuestion) || undefined;
  const routes = rawStringList(value.possibleRoutes ?? value.routes) as AmbiguityPossibleRoute[];
  const suggestedResearchTask = stringValue(value.suggestedResearchTask) || undefined;
  const sourceRef = rawStringValue(value.sourceRef) || `generated_question:${topicKey || index + 1}`;

  if (!ALLOWED_SECTIONS.has(sectionRef)) {
    issue(issues, `${path}.sectionRef`, `must be one of canonical spec sections`);
  }
  if (!topicKey) {
    issue(issues, `${path}.topicKey`, "must be a non-empty stable topic key");
  }
  if (!ALLOWED_UNCERTAINTY_TYPES.has(uncertaintyType)) {
    issue(issues, `${path}.uncertaintyType`, "must be a supported uncertainty type");
  }
  if (!ALLOWED_SEVERITIES.has(severity)) {
    issue(issues, `${path}.severity`, "must be high, medium, or low");
  }
  if (!summary) {
    issue(issues, `${path}.summary`, "must be non-empty");
  }
  if (!whyItMatters) {
    issue(issues, `${path}.whyItMatters`, "must be non-empty");
  }
  if (!question) {
    issue(issues, `${path}.questionText`, "must be non-empty");
  }
  if (!ALLOWED_EXPECTED_ANSWER_TYPES.has(expectedAnswerType)) {
    issue(issues, `${path}.expectedAnswerType`, "must be choice, text, rank, evidence, or experiment");
  }
  if (!decisionItUnlocks) {
    issue(issues, `${path}.decisionItUnlocks`, "must be non-empty");
  }
  if (!rawAmbiguityDimension) {
    issue(issues, `${path}.ambiguityDimension`, "must be provided so the weakest ambiguity dimension is explicit");
  } else if (!ALLOWED_AMBIGUITY_DIMENSIONS.has(ambiguityDimension)) {
    issue(issues, `${path}.ambiguityDimension`, "must be goal, scope, constraints, success_criteria, context, decision_authority, or assumption_pressure");
  }
  if (!rawAmbiguityRoutingPath) {
    issue(issues, `${path}.ambiguityRoutingPath`, "must be provided so the question separates human judgment, existing facts, and current research");
  } else if (!ALLOWED_AMBIGUITY_ROUTING_PATHS.has(ambiguityRoutingPath)) {
    issue(issues, `${path}.ambiguityRoutingPath`, "must be human_judgment, existing_fact_check, or current_research");
  }
  if (businessCriticPressureMetadata.invalidIntensityMinimum) {
    issue(issues, `${path}.businessCriticIntensityMinimum`, "must be balanced, strong, or investor_grade when provided");
  }
  if (businessCriticPressureMetadata.invalidPressureKind) {
    issue(issues, `${path}.businessCriticPressureKind`, "must be balanced_con, core_assumption_challenge, or investor_pressure_pass when provided");
  }
  if (businessCriticPressureMetadata.missingPressureKind) {
    issue(issues, `${path}.businessCriticPressureKind`, "is required when businessCriticIntensityMinimum is provided");
  }
  if (businessCriticPressureMetadata.invalidInvestorMinimum) {
    issue(issues, `${path}.businessCriticIntensityMinimum`, "must be investor_grade for investor pressure questions");
  }
  if (businessCriticPressureMetadata.invalidCoreAssumptionMinimum) {
    issue(issues, `${path}.businessCriticIntensityMinimum`, "must be strong or investor_grade for core-assumption challenge questions");
  }
  if (businessCriticPressureMetadata.invalidBalancedMinimum) {
    issue(issues, `${path}.businessCriticIntensityMinimum`, "must be balanced for balanced pressure questions");
  }
  if (question && questionHasMultipleDecisionAxes(question)) {
    issue(issues, `${path}.questionText`, "must ask one execution-changing judgment, not a compound customer/scope/success question");
  }
  if (!routes.length || routes.some((route) => !ALLOWED_ROUTES.has(route))) {
    issue(issues, `${path}.routes`, "must include one or more supported routes");
  }
  if (ambiguityRoutingPath === "current_research") {
    if (!researchQuestion) {
      issue(issues, `${path}.researchQuestion`, "must state what current evidence should be checked");
    }
    if (!suggestedResearchTask) {
      issue(issues, `${path}.suggestedResearchTask`, "must state a concrete source-seeking task for current research");
    } else if (isGenericResearchTask(suggestedResearchTask)) {
      issue(issues, `${path}.suggestedResearchTask`, "must be a concrete source-seeking task, not a generic request for more research");
    } else {
      if (!researchTaskHasSourceSeekingCue(suggestedResearchTask)) {
        issue(issues, `${path}.suggestedResearchTask`, "must name the source area or public evidence to inspect");
      }
      if (!researchTaskHasSkepticalCue(suggestedResearchTask)) {
        issue(issues, `${path}.suggestedResearchTask`, "must name what would weaken the assumption or what uncertainty should remain");
      }
      if (!researchTaskHasRemainingHumanJudgmentCue(suggestedResearchTask)) {
        issue(issues, `${path}.suggestedResearchTask`, "must name the remaining human judgment after current research");
      }
    }
    if (!routes.includes("research_needed")) {
      issue(issues, `${path}.routes`, "must include research_needed when ambiguityRoutingPath is current_research");
    }
  } else if (isGenericResearchTask(suggestedResearchTask)) {
    issue(issues, `${path}.suggestedResearchTask`, "must be concrete when provided");
  }

  const answerSelectionMode = expectedSelectionMode(
    expectedAnswerType,
    value.answerSelectionMode,
    `${path}.answerSelectionMode`,
    issues
  );
  const rawOptions = Array.isArray(value.answerOptions) ? value.answerOptions : [];
  const parsedAnswerOptions = rawOptions
    .slice(0, 10)
    .map((option, optionIndex) => parseAnswerOption(option, `${path}.answerOptions[${optionIndex}]`, optionIndex, issues))
    .filter((option): option is AmbiguityAnswerOption => option !== null);
  const answerOptionsWithoutGenericPlanning = parsedAnswerOptions.filter(
    (option) => !isGenericPlanningAnswerOption(option)
  );
  const hasGenericPlanningOptions = parsedAnswerOptions.length !== answerOptionsWithoutGenericPlanning.length;
  const shouldFallbackToOpenText =
    expectedAnswerType !== "text" &&
    hasGenericPlanningOptions &&
    answerOptionsWithoutGenericPlanning.length < 3;
  const effectiveExpectedAnswerType = shouldFallbackToOpenText ? "text" : expectedAnswerType;
  const effectiveAnswerSelectionMode = shouldFallbackToOpenText ? undefined : answerSelectionMode;
  const answerOptions = shouldFallbackToOpenText ? [] : answerOptionsWithoutGenericPlanning;
  const requiresOptions = effectiveExpectedAnswerType !== "text";

  if (requiresOptions && (answerOptions.length < 3 || answerOptions.length > 5)) {
    issue(issues, `${path}.answerOptions`, "must include 3-5 options for non-text generated questions");
  }
  if (!requiresOptions && rawOptions.length > 0 && !shouldFallbackToOpenText) {
    issue(issues, `${path}.answerOptions`, "must be omitted or empty for open text questions");
  }

  const hasInvalidCurrentResearchTask =
    ambiguityRoutingPath === "current_research" &&
    (!researchQuestion ||
      !suggestedResearchTask ||
      isGenericResearchTask(suggestedResearchTask) ||
      !researchTaskHasSourceSeekingCue(suggestedResearchTask) ||
      !researchTaskHasSkepticalCue(suggestedResearchTask) ||
      !researchTaskHasRemainingHumanJudgmentCue(suggestedResearchTask) ||
      !routes.includes("research_needed"));
  const hasInvalidNonResearchTask =
    ambiguityRoutingPath !== "current_research" && isGenericResearchTask(suggestedResearchTask);
  const hasInvalidRequiredAnswerOptions = requiresOptions && (answerOptions.length < 3 || answerOptions.length > 5);
  const hasInvalidOpenTextAnswerOptions = !requiresOptions && rawOptions.length > 0 && !shouldFallbackToOpenText;

  if (
    !ALLOWED_SECTIONS.has(sectionRef) ||
    !topicKey ||
    !ALLOWED_UNCERTAINTY_TYPES.has(uncertaintyType) ||
    !ALLOWED_SEVERITIES.has(severity) ||
    !summary ||
    !whyItMatters ||
    !question ||
    !ALLOWED_EXPECTED_ANSWER_TYPES.has(expectedAnswerType) ||
    !decisionItUnlocks ||
    !rawAmbiguityDimension ||
    !ALLOWED_AMBIGUITY_DIMENSIONS.has(ambiguityDimension) ||
    !rawAmbiguityRoutingPath ||
    !ALLOWED_AMBIGUITY_ROUTING_PATHS.has(ambiguityRoutingPath) ||
    hasInvalidBusinessCriticPressureMetadata(businessCriticPressureMetadata) ||
    questionHasMultipleDecisionAxes(question) ||
    !routes.length ||
    routes.some((route) => !ALLOWED_ROUTES.has(route)) ||
    hasInvalidCurrentResearchTask ||
    hasInvalidNonResearchTask ||
    hasInvalidRequiredAnswerOptions ||
    hasInvalidOpenTextAnswerOptions
  ) {
    return null;
  }

  return {
    sectionRef,
    topicKey,
    uncertaintyType,
    severity,
    summary,
    whyItMatters,
    question,
    expectedAnswerType: effectiveExpectedAnswerType,
    ...(effectiveAnswerSelectionMode ? { answerSelectionMode: effectiveAnswerSelectionMode } : {}),
    ...(answerOptions.length ? { answerOptions } : {}),
    decisionItUnlocks,
    ambiguityDimension,
    ambiguityRoutingPath,
    ...(rawBusinessCriticIntensityMinimum ? { businessCriticIntensityMinimum } : {}),
    ...(rawBusinessCriticPressureKind ? { businessCriticPressureKind } : {}),
    ...(researchQuestion ? { researchQuestion } : {}),
    routes,
    ...(suggestedResearchTask ? { suggestedResearchTask } : {}),
    sourceRef
  } satisfies GeneratedAmbiguityQuestionSeed;
}

function generatedQuestionSetIssues(questions: readonly GeneratedAmbiguityQuestionSeed[]) {
  const issues: string[] = [];
  const hasPressureQuestion = questions.some(
    (question) =>
      question.ambiguityDimension === "assumption_pressure" ||
      question.uncertaintyType === "missing_con_evidence" ||
      question.routes.includes("missing_con_evidence")
  );

  if (!hasPressureQuestion) {
    issue(
      issues,
      "$.questions",
      "must include at least one pressure question that challenges an assumption, tradeoff, counterexample, or missing counter-evidence"
    );
  }

  return issues;
}

const PLANNING_BOTTLENECK_AXIS_RANK = {
  customer: 0,
  scope: 1,
  success: 2
} as const;
const PLANNING_BOTTLENECK_SEVERITY_RANK: Record<AmbiguityIssueSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2
};
const PLANNING_BOTTLENECK_UNCERTAINTY_RANK: Record<AmbiguityIssueUncertaintyType, number> = {
  missing: 0,
  vague: 1,
  decision_required: 2,
  unsupported: 3,
  conflict: 4,
  missing_con_evidence: 5
};

function planningBottleneckAxis(question: GeneratedAmbiguityQuestionSeed) {
  const text = [
    question.sectionRef,
    question.topicKey,
    question.summary,
    question.question,
    question.decisionItUnlocks,
    question.ambiguityDimension
  ].join(" ");

  if (question.sectionRef === "Target Customer") {
    return "customer" as const;
  }

  if (question.sectionRef === "MVP Scope" || question.ambiguityDimension === "scope") {
    return "scope" as const;
  }

  if (question.sectionRef === "Success Criteria" || question.ambiguityDimension === "success_criteria") {
    return "success" as const;
  }

  if (
    /(?:customer|segment|persona|buyer|user|고객|세그먼트|구매자|사용자\s*유형|고객\s*후보|보호자\s*유형|환자\s*유형|누구|어떤\s*(?:고객|사용자|보호자|환자|사람|대상|유형)|먼저\s*(?:쓸|검증할|만날|집중할))/iu.test(text)
  ) {
    return "customer" as const;
  }

  if (/(?:범위|기능|첫\s*구현|어디까지|무엇을\s*(?:만들|넣|뺄)|scope|feature|mvp|build\s*slice)/iu.test(text)) {
    return "scope" as const;
  }

  if (/(?:성공\s*기준|성공했는지|지표|측정|완료\s*조건|success|metric|measure|criteria)/iu.test(text)) {
    return "success" as const;
  }

  return null;
}

function generatedQuestionPlanningBottleneckRank(
  question: GeneratedAmbiguityQuestionSeed,
  originalIndex: number
) {
  const axis = planningBottleneckAxis(question);

  return {
    axisPriority: axis ? 0 : 1,
    severityPriority: PLANNING_BOTTLENECK_SEVERITY_RANK[question.severity],
    uncertaintyPriority: PLANNING_BOTTLENECK_UNCERTAINTY_RANK[question.uncertaintyType],
    axisRank: axis ? PLANNING_BOTTLENECK_AXIS_RANK[axis] : Number.MAX_SAFE_INTEGER,
    originalIndex
  };
}

function sortGeneratedQuestionsByPlanningBottleneck(
  questions: readonly GeneratedAmbiguityQuestionSeed[]
) {
  return questions
    .map((question, originalIndex) => ({
      question,
      rank: generatedQuestionPlanningBottleneckRank(question, originalIndex)
    }))
    .sort((left, right) =>
      left.rank.axisPriority - right.rank.axisPriority ||
      left.rank.severityPriority - right.rank.severityPriority ||
      left.rank.uncertaintyPriority - right.rank.uncertaintyPriority ||
      left.rank.axisRank - right.rank.axisRank ||
      left.rank.originalIndex - right.rank.originalIndex
    )
    .map(({ question }) => question);
}

export function parseGeneratedAmbiguityQuestionSet(
  value: unknown,
  context: GeneratedAmbiguityQuestionSetContextValidationInput = {}
): GeneratedAmbiguityQuestionSetParseResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: ["$: generated question set must be a JSON object"],
      questions: []
    };
  }

  if (value.schemaVersion !== GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION) {
    issue(issues, "$.schemaVersion", `must be ${GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION}`);
  }

  const rawQuestions = Array.isArray(value.questions) ? value.questions : [];
  if (rawQuestions.length < 3 || rawQuestions.length > 25) {
    issue(issues, "$.questions", "must include 3-25 generated questions");
  }

  const seenTopicKeys = new Set<string>();
  const questions = rawQuestions
    .slice(0, 25)
    .map((question, index) => {
      const parsed = parseGeneratedQuestion(question, `$.questions[${index}]`, index, issues);

      if (parsed) {
        if (seenTopicKeys.has(parsed.topicKey)) {
          issue(issues, `$.questions[${index}].topicKey`, "must be unique");
          return null;
        }
        seenTopicKeys.add(parsed.topicKey);
      }

      return parsed;
    })
    .filter((question): question is GeneratedAmbiguityQuestionSeed => question !== null);
  const setIssues = issues.length === 0
    ? generatedQuestionSetIssues(questions)
    : [];
  const contextualIssues = issues.length === 0 && setIssues.length === 0
    ? contextualGeneratedQuestionIssues(questions, context.contextText)
    : [];

  issues.push(...setIssues, ...contextualIssues);

  return {
    ok: issues.length === 0,
    issues,
    questions: issues.length === 0 ? sortGeneratedQuestionsByPlanningBottleneck(questions) : []
  };
}

function jsonTextCandidates(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  const firstObjectStart = withoutFence.indexOf("{");
  const lastObjectEnd = withoutFence.lastIndexOf("}");
  const extractedObject =
    firstObjectStart >= 0 && lastObjectEnd > firstObjectStart
      ? withoutFence.slice(firstObjectStart, lastObjectEnd + 1)
      : "";

  return [withoutFence, extractedObject].filter((candidate, index, all) =>
    candidate.length > 0 && all.indexOf(candidate) === index
  );
}

export function parseGeneratedAmbiguityQuestionSetText(
  text: string,
  context: GeneratedAmbiguityQuestionSetContextValidationInput = {}
): GeneratedAmbiguityQuestionSetTextParseResult {
  const parseIssues: string[] = [];

  for (const candidate of jsonTextCandidates(text)) {
    try {
      const value = JSON.parse(candidate) as unknown;
      const parsed = parseGeneratedAmbiguityQuestionSet(value, context);

      return {
        ...parsed,
        ...(parsed.ok ? { value } : {})
      };
    } catch (error) {
      parseIssues.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    ok: false,
    issues: parseIssues.length
      ? parseIssues.map((message) => `$: generated question set JSON could not be parsed: ${message}`)
      : ["$: generated question set text was empty"],
    questions: []
  };
}
