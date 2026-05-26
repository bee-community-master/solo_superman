import type {
  AmbiguityAnswerOption,
  AmbiguityAnswerSelectionMode,
  AmbiguityExpectedAnswerType,
  AmbiguityIssueSeverity,
  AmbiguityIssueUncertaintyType,
  AmbiguityPossibleRoute,
  AmbiguityReductionDimension,
  AmbiguityRoutingPath
} from "@solo-superman/contracts";
import {
  AMBIGUITY_REDUCTION_DIMENSIONS,
  AMBIGUITY_ROUTING_PATHS,
  CANONICAL_INITIAL_SPEC_SECTIONS
} from "@solo-superman/contracts";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";

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
const PET_LIFECYCLE_CONTEXT_PATTERN =
  /(?:반려\s*동물|반려견|반려묘|보호자|펫\b|pet\b|guardian|companion\s+animal|clinic|veterinary|medical|record|daily\s*care|동물병원|수의|진료|의료\s*기록|기록|의료비|투약|급여|사료|보험|insurance|장례|funeral|end-of-life|말기\s*케어|전생애|생애주기|lifecycle)/iu;
const LOCAL_COMMERCE_CONTEXT_PATTERN =
  /(?:식당|카페|매장|소상공인|예약|주문|픽업|배달|단골|손님|로컬\s*커머스|restaurant|cafe|store|merchant|reservation|order|pickup|delivery|loyalty|customer)/iu;
const FOUNDER_VALIDATION_CONTEXT_PATTERN =
  /(?:창업자|예비\s*창업|스타트업|고객\s*인터뷰|제품\s*스펙|아이디어\s*검증|질문\s*품질|근거\s*추적|founder|startup|customer\s*interview|product\s*spec|idea\s*validation|question|traceable)/iu;
const GENERIC_BUILDER_PERSONA_PATTERN =
  /(?:1\s*인\s*창업자|혼자\s*만드는\s*창업자|도메인\s*전문\s*1\s*인\s*빌더|팀\s*리더|운영\s*담당자|solo\s*founder|founder|domain\s*builder|team\s*lead|operator)/iu;
const GENERIC_BUILDER_PERSONA_ALLOWED_CONTEXT_PATTERN =
  /(?:창업자|예비\s*창업자|창업\s*준비(?:자|생|중인\s*사람)|스타트업\s*(?:창업자|팀|리더|운영\s*담당자)|founder|startup\s+(?:founder|team|lead|operator)|solo\s*builder|1\s*인\s*빌더|domain\s*builder|팀\s*리더|운영\s*담당자|운영\s*팀|team\s*lead|operator|operations?)/iu;
const USER_FACING_GENERATED_QUESTION_JARGON_PATTERN =
  /\b(?:primary\s+customer|planning-ready|high-impact\s+gate|quality-gate|pro\/con|MVP)\b/iu;
const GENERIC_RESEARCH_TASK_PATTERN =
  /^(?:추가\s*리서치(?:가)?\s*(?:필요|하기|진행)?|자료\s*더\s*찾기|근거\s*더\s*찾기|리서치\s*필요|do\s+more\s+research|additional\s+research\s+needed|research\s+needed)$/iu;
const RESEARCH_SOURCE_SEEKING_CUE_PATTERN =
  /(?:공개|출처|자료|후기|커뮤니티|리포트|보고서|통계|가이드|가격|정책|규정|경쟁|대체재|사례|리뷰|forum|community|review|report|source|public|statistic|guide|policy|pricing|competitor|alternative|case)/iu;
const RESEARCH_SKEPTICAL_CUE_PATTERN =
  /(?:반례|반대|부족|약하|흔들|불확실|한계|위험|실패|다른|여전히|남는|counter|contrary|weaken|missing|gap|uncertain|uncertainty|limit|risk|fail|skeptical)/iu;
const DECISION_AXIS_PATTERNS = [
  /(?:누구|어떤\s*(?:고객|사용자|보호자|사람|조직|세그먼트)|who|customer|user|segment)/iu,
  /(?:기능|어디까지|범위|무엇을\s*(?:만들|제공|포함)|feature|scope)/iu,
  /(?:성공\s*기준|성공했는지|어떻게\s*(?:판단|측정)|지표|완료\s*조건|success|metric|criteria|measure)/iu,
  /(?:구매자|결제자|돈을\s*내|buyer|payer|purchase)/iu,
  /(?:채널|어디에서\s*(?:만나|찾|모집)|channel|acquisition)/iu
] as const;

const IDEA_FIT_CONTEXT_PATTERNS = [
  PET_LIFECYCLE_CONTEXT_PATTERN,
  LOCAL_COMMERCE_CONTEXT_PATTERN,
  FOUNDER_VALIDATION_CONTEXT_PATTERN
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

function questionHasMultipleDecisionAxes(question: string) {
  const questionMarkCount = (question.match(/[?？]/gu) ?? []).length;

  if (questionMarkCount > 1) {
    return true;
  }

  const matchedAxisCount = DECISION_AXIS_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(question) ? 1 : 0),
    0
  );

  return matchedAxisCount >= 3;
}

function ideaFitCuePatternForContext(contextText: string | undefined) {
  const normalizedContext = contextText ?? "";

  return IDEA_FIT_CONTEXT_PATTERNS.find((pattern) => pattern.test(normalizedContext));
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
  const allowsGenericBuilderPersona = GENERIC_BUILDER_PERSONA_ALLOWED_CONTEXT_PATTERN.test(contextText ?? "");
  const ideaFitCuePattern = ideaFitCuePatternForContext(contextText);

  questions.forEach((question, questionIndex) => {
    if (ideaFitCuePattern && !ideaFitCuePattern.test(question.question)) {
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

      const hasGenericBuilderPersona = GENERIC_BUILDER_PERSONA_PATTERN.test(optionText);

      if (ideaFitCuePattern && !ideaFitCuePattern.test(optionText)) {
        issue(
          issues,
          `$.questions[${questionIndex}].answerOptions[${optionIndex}]`,
          "generated answer options must be anchored in the idea domain"
        );
      }

      if (hasGenericBuilderPersona && !allowsGenericBuilderPersona) {
        issue(
          issues,
          `$.questions[${questionIndex}].answerOptions[${optionIndex}]`,
          "generated question options must be derived from the idea; generic founder/builder/team personas are only allowed when the idea names that audience"
        );
      }

      if (isPetLifecycleContext && hasGenericBuilderPersona) {
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
  const answerOptions = rawOptions
    .slice(0, 10)
    .map((option, optionIndex) => parseAnswerOption(option, `${path}.answerOptions[${optionIndex}]`, optionIndex, issues))
    .filter((option): option is AmbiguityAnswerOption => option !== null);
  const requiresOptions = expectedAnswerType !== "text";

  if (requiresOptions && (answerOptions.length < 3 || answerOptions.length > 10)) {
    issue(issues, `${path}.answerOptions`, "must include 3-10 options for non-text generated questions");
  }
  if (!requiresOptions && rawOptions.length > 0) {
    issue(issues, `${path}.answerOptions`, "must be omitted or empty for open text questions");
  }

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
    questionHasMultipleDecisionAxes(question) ||
    !routes.length ||
    routes.some((route) => !ALLOWED_ROUTES.has(route)) ||
    (ambiguityRoutingPath === "current_research" &&
      (!researchQuestion ||
        !suggestedResearchTask ||
        isGenericResearchTask(suggestedResearchTask) ||
        !researchTaskHasSourceSeekingCue(suggestedResearchTask) ||
        !researchTaskHasSkepticalCue(suggestedResearchTask) ||
        !routes.includes("research_needed"))) ||
    (ambiguityRoutingPath !== "current_research" && isGenericResearchTask(suggestedResearchTask)) ||
    (requiresOptions && answerOptions.length < 3) ||
    (!requiresOptions && rawOptions.length > 0)
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
    expectedAnswerType,
    ...(answerSelectionMode ? { answerSelectionMode } : {}),
    ...(answerOptions.length ? { answerOptions } : {}),
    decisionItUnlocks,
    ambiguityDimension,
    ambiguityRoutingPath,
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
  if (rawQuestions.length < 3 || rawQuestions.length > 15) {
    issue(issues, "$.questions", "must include 3-15 generated questions");
  }

  const seenTopicKeys = new Set<string>();
  const questions = rawQuestions
    .slice(0, 15)
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
    questions: issues.length === 0 ? questions : []
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
