import { readFileSync } from "node:fs";
import type { BusinessCriticIntensity, ProjectPurposeMode } from "@solo-superman/contracts";
import { GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION } from "@solo-superman/core";

export const GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_ARTIFACT_PATH =
  "packages/core/prompts/generated-ambiguity-questions.v1.md" as const;

const PROMPT_TEMPLATE_URL = new URL(
  `../../../../${GENERATED_AMBIGUITY_QUESTION_PROMPT_TEMPLATE_ARTIFACT_PATH}`,
  import.meta.url
);

const DEFAULT_REVIEW_AXES = [
  "domainSignals: actors/users/buyers/artifacts/jobs/pains/constraints/channels/exclusions",
  "dimensionScores: goal/scope/decision authority/success criteria/constraints/assumption pressure/context",
  "goal clarity",
  "scope and non-goals",
  "decision authority",
  "constraints",
  "success criteria",
  "assumption pressure",
  "current research gaps"
] as const;

export interface GeneratedAmbiguityQuestionPromptInput {
  readonly rawIdea: string | undefined;
  readonly intakeGoal: string | undefined;
  readonly projectPurposeMode: ProjectPurposeMode;
  readonly businessCriticIntensity?: BusinessCriticIntensity | null;
  readonly reviewAxes: readonly string[];
  readonly initialQuestionCount?: {
    readonly min?: number;
    readonly max?: number;
  };
  readonly ambiguityDimensions?: readonly string[];
  readonly language?: string;
  readonly domainKeywordExpansions?: Readonly<Record<string, readonly string[]>>;
}

export function loadGeneratedAmbiguityQuestionPromptTemplate() {
  return readFileSync(PROMPT_TEMPLATE_URL, "utf8");
}

function replacementMap(input: GeneratedAmbiguityQuestionPromptInput) {
  const axes = input.reviewAxes.length ? input.reviewAxes : DEFAULT_REVIEW_AXES;
  const minimumQuestionCount = boundedQuestionCount(input.initialQuestionCount?.min, 3);
  const maximumQuestionCount = Math.max(minimumQuestionCount, boundedQuestionCount(input.initialQuestionCount?.max, 15));
  const dimensions = input.ambiguityDimensions?.length
    ? input.ambiguityDimensions
    : ["goal", "scope/non-goals", "decision_authority", "success_criteria", "constraints", "assumption_pressure", "context"];
  const keywordExpansionLines = domainKeywordExpansionLines(input);

  const replacements: Readonly<Record<string, string>> = {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    projectPurposeMode: input.projectPurposeMode,
    businessCriticIntensity: input.businessCriticIntensity ?? "not_applicable",
    rawIdea: input.rawIdea ?? "",
    intakeGoal: input.intakeGoal ?? "",
    reviewAxes: axes.join(", "),
    minimumQuestionCount: String(minimumQuestionCount),
    maximumQuestionCount: String(maximumQuestionCount),
    preferredOutputLanguage: input.language ?? "match the user's language",
    ambiguityDimensionPriority: dimensions.join(" -> "),
    domainKeywordExpansions: keywordExpansionLines.length
      ? keywordExpansionLines.join("\n")
      : "No configured keyword expansions. If the idea contains Korean domain terms, infer concise English search synonyms internally while keeping user-facing strings in the preferred output language."
  };

  return replacements;
}

function boundedQuestionCount(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || value === undefined) {
    return fallback;
  }

  return Math.max(1, Math.min(30, value));
}

function domainKeywordExpansionLines(input: GeneratedAmbiguityQuestionPromptInput) {
  const configured = Object.entries(input.domainKeywordExpansions ?? {}).map(
    ([keyword, expansions]) => `- ${keyword}: ${expansions.join(", ")}`
  );
  const text = `${input.rawIdea ?? ""} ${input.intakeGoal ?? ""}`;

  if (/[가-힣]/u.test(text) && /(?:반려\s*동물|반려견|반려묘|펫)/u.test(text) && !input.domainKeywordExpansions?.["반려동물"]) {
    configured.push("- 반려동물: pet, companion animal, pet guardian, veterinary care, pet insurance");
  }

  return configured;
}

export function renderGeneratedAmbiguityQuestionPromptTemplate(
  templateText: string,
  input: GeneratedAmbiguityQuestionPromptInput
) {
  const replacements = replacementMap(input);

  return templateText.replace(/\{\{([a-zA-Z0-9_]+)\}\}/gu, (placeholder, key: string) => {
    return Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key] ?? "" : placeholder;
  });
}

export function buildGeneratedAmbiguityQuestionPrompt(input: GeneratedAmbiguityQuestionPromptInput) {
  return renderGeneratedAmbiguityQuestionPromptTemplate(loadGeneratedAmbiguityQuestionPromptTemplate(), input);
}
