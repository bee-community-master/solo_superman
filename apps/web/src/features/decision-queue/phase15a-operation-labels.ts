export interface Phase15aOperationLabelCopy {
  readonly allowlistStatusLabels: Readonly<Record<string, string>>;
  readonly connectorLabels: Readonly<Record<string, string>>;
  readonly sourceCategoryLabels: Readonly<Record<string, string>>;
  readonly contextModeLabels: Readonly<Record<string, string>>;
  readonly disclosureStatusLabels: Readonly<Record<string, string>>;
  readonly runStatusLabels: Readonly<Record<string, string>>;
  readonly adapterKindLabels: Readonly<Record<string, string>>;
  readonly qualityGateStatusLabels: Readonly<Record<string, string>>;
  readonly evidenceGateStatusLabels: Readonly<Record<string, string>>;
  readonly reviewCardStateLabels: Readonly<Record<string, string>>;
  readonly terminalReasonLabels: Readonly<Record<string, string>>;
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

export function phase15aDisclosureStatusLabel(copy: Phase15aOperationLabelCopy, status: string) {
  return labelResearchValue(copy.disclosureStatusLabels, status);
}

export function phase15aRunStatusLabel(copy: Phase15aOperationLabelCopy, status: string) {
  return labelResearchValue(copy.runStatusLabels, status);
}

export function phase15aAdapterKindLabel(copy: Phase15aOperationLabelCopy, adapterKind: string) {
  return labelResearchValue(copy.adapterKindLabels, adapterKind);
}

export function phase15aQualityGateStatusLabel(copy: Phase15aOperationLabelCopy, status: string) {
  return labelResearchValue(copy.qualityGateStatusLabels, status);
}

export function phase15aEvidenceGateStatusLabel(copy: Phase15aOperationLabelCopy, status: string) {
  return labelResearchValue(copy.evidenceGateStatusLabels, status);
}

export function phase15aReviewCardStateLabel(copy: Phase15aOperationLabelCopy, state: string) {
  return labelResearchValue(copy.reviewCardStateLabels, state);
}

export function phase15aTerminalReasonLabel(copy: Phase15aOperationLabelCopy, reason: string) {
  return labelResearchValue(copy.terminalReasonLabels, reason);
}

export function joinPhase15aResearchLabels(labels: readonly string[]) {
  return labels.join(", ");
}
