import {
  localizedUserFacingDecisionQueueText,
  type DecisionQueueDisplayLanguage
} from "@solo-superman/contracts";

export function formatListWithFallback(items: readonly string[], fallback: string) {
  return items.length ? items.join(", ") : fallback;
}

export function decisionQueueDisplayText(value: string, language: DecisionQueueDisplayLanguage) {
  return localizedUserFacingDecisionQueueText(value, language).replace(/\s+/gu, " ").trim();
}

export function compactDecisionQueueDisplayText(
  value: string | undefined,
  language: DecisionQueueDisplayLanguage,
  maxLength = 180
) {
  const text = value ? decisionQueueDisplayText(value, language) : "";

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}
