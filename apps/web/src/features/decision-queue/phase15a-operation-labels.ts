export interface Phase15aOperationLabelCopy {
  readonly allowlistStatusLabels: Readonly<Record<string, string>>;
  readonly connectorLabels: Readonly<Record<string, string>>;
  readonly sourceCategoryLabels: Readonly<Record<string, string>>;
  readonly contextModeLabels: Readonly<Record<string, string>>;
}

function humanizeResearchSlug(value: string) {
  return value.replaceAll("_", " ");
}

function labelResearchValue(labels: Readonly<Record<string, string>>, value: string) {
  return labels[value] ?? humanizeResearchSlug(value);
}

export function phase15aAllowlistStatusLabel(copy: Phase15aOperationLabelCopy, status: string) {
  return labelResearchValue(copy.allowlistStatusLabels, status);
}

export function phase15aConnectorLabels(copy: Phase15aOperationLabelCopy, connectorIds: readonly string[]) {
  return connectorIds.map((connectorId) => labelResearchValue(copy.connectorLabels, connectorId));
}

export function phase15aSourceCategoryLabels(copy: Phase15aOperationLabelCopy, sourceCategories: readonly string[]) {
  return sourceCategories.map((sourceCategory) => labelResearchValue(copy.sourceCategoryLabels, sourceCategory));
}

export function phase15aContextModeLabel(copy: Phase15aOperationLabelCopy, contextMode: string) {
  return labelResearchValue(copy.contextModeLabels, contextMode);
}

export function joinPhase15aResearchLabels(labels: readonly string[]) {
  return labels.join(", ");
}
