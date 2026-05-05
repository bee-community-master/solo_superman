import type { PublicSafeResearchSummaryInput } from "@solo-superman/contracts";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const SECRET_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{6,}|gh[po]_[A-Za-z0-9_]{6,}|xox[baprs]-[A-Za-z0-9-]{6,}|AKIA[A-Z0-9]{12,}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*\S+)/gi;
const SENTENCE_SPLIT_PATTERN = /(?<=[.!?。！？])\s+/u;

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactExplicitValues(value: string, values: readonly string[], label: string) {
  return values.reduce((redacted, item) => {
    const normalized = compactWhitespace(item);

    if (!normalized) {
      return redacted;
    }

    return redacted.replace(new RegExp(escapeRegExp(normalized), "gi"), `[redacted ${label}]`);
  }, value);
}

export function redactPublicSafeResearchText(value: string, input: PublicSafeResearchSummaryInput) {
  const explicitPrivateValues = [
    ...(input.privateCustomerNames ?? []),
    ...(input.unreleasedPartnerNames ?? []),
    ...(input.contactDetails ?? []),
    ...(input.privateDocumentRefs ?? [])
  ];

  return redactExplicitValues(
    compactWhitespace(value)
      .replace(EMAIL_PATTERN, "[redacted contact]")
      .replace(PHONE_PATTERN, "[redacted contact]")
      .replace(SECRET_PATTERN, "[redacted secret]"),
    explicitPrivateValues,
    "private context"
  );
}

function sentenceLimited(value: string, maxSentences: number) {
  const sentences = compactWhitespace(value)
    .split(SENTENCE_SPLIT_PATTERN)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.slice(0, maxSentences).join(" ");
}

function firstSentenceContent(value: string | undefined, input: PublicSafeResearchSummaryInput) {
  const redacted = value ? redactPublicSafeResearchText(value, input) : "";

  return sentenceLimited(redacted, 1).replace(/[.!?。！？]+$/u, "");
}

function optionalSentence(label: string, value: string | undefined, input: PublicSafeResearchSummaryInput) {
  const content = firstSentenceContent(value, input);

  return content ? `${label}: ${content}.` : null;
}

export function containsPrivateResearchContext(input: PublicSafeResearchSummaryInput) {
  return Boolean(
    input.rawIdea?.trim() ||
      input.detailedAnswers?.some((answer) => answer.trim().length > 0) ||
      input.privateCustomerNames?.some((name) => name.trim().length > 0) ||
      input.unreleasedPartnerNames?.some((name) => name.trim().length > 0) ||
      input.contactDetails?.some((contact) => contact.trim().length > 0) ||
      input.privateDocumentRefs?.some((ref) => ref.trim().length > 0)
  );
}

export function buildPublicSafeResearchSummary(input: PublicSafeResearchSummaryInput) {
  const objective = redactPublicSafeResearchText(input.researchObjective, input);
  const safeSentences = [
    optionalSentence("Product category", input.productCategory, input),
    optionalSentence("Customer/problem hypothesis", input.customerProblemHypothesis ?? input.highLevelContext, input),
    optionalSentence("Research objective", objective, input)
  ].filter((sentence): sentence is string => Boolean(sentence));
  const summary = safeSentences.join(" ");

  if (!objective) {
    throw new Error("researchObjective is required to build a public-safe research summary.");
  }

  return {
    researchObjective: objective,
    publicSafeSummary:
      summary ||
      `Research objective: ${objective}.`
  };
}
