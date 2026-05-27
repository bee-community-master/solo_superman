import { readFileSync } from "node:fs";
import type { ProjectPurposeMode } from "@solo-superman/contracts";
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
  readonly reviewAxes: readonly string[];
}

export function loadGeneratedAmbiguityQuestionPromptTemplate() {
  return readFileSync(PROMPT_TEMPLATE_URL, "utf8");
}

function replacementMap(input: GeneratedAmbiguityQuestionPromptInput) {
  const axes = input.reviewAxes.length ? input.reviewAxes : DEFAULT_REVIEW_AXES;

  const replacements: Readonly<Record<string, string>> = {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    projectPurposeMode: input.projectPurposeMode,
    rawIdea: input.rawIdea ?? "",
    intakeGoal: input.intakeGoal ?? "",
    reviewAxes: axes.join(", ")
  };

  return replacements;
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
