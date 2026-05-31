import type {
  DecisionEvidencePackProjection,
  EvidenceMatrixProjection,
  ResearchTaskProjection
} from "@solo-superman/contracts";

export interface EvidenceGateConfig {
  readonly highImpactRequiresBalancedEvidence: boolean;
  readonly minimumUsableFindings: number;
  readonly evidenceConflictRatio: number;
  readonly statuses: {
    readonly balanced: EvidenceMatrixProjection["balanceStatus"];
    readonly needsConEvidence: EvidenceMatrixProjection["balanceStatus"];
    readonly missingConEvidence: EvidenceMatrixProjection["balanceStatus"];
    readonly sourceQualityInsufficient: EvidenceMatrixProjection["balanceStatus"];
    readonly blockedByConEvidence: EvidenceMatrixProjection["balanceStatus"];
    readonly accepted: DecisionEvidencePackProjection["gateStatus"];
    readonly needsReview: DecisionEvidencePackProjection["gateStatus"];
    readonly researchInsufficient: DecisionEvidencePackProjection["gateStatus"];
    readonly stale: DecisionEvidencePackProjection["gateStatus"];
  };
}

export const DEFAULT_EVIDENCE_GATE_CONFIG: EvidenceGateConfig = {
  highImpactRequiresBalancedEvidence: true,
  minimumUsableFindings: 1,
  evidenceConflictRatio: 0.35,
  statuses: {
    balanced: "balanced",
    needsConEvidence: "needs_con_evidence",
    missingConEvidence: "missing_con_evidence",
    sourceQualityInsufficient: "source_quality_insufficient",
    blockedByConEvidence: "blocked_by_con_evidence",
    accepted: "accepted",
    needsReview: "needs_review",
    researchInsufficient: "research_insufficient",
    stale: "stale"
  }
} as const;

export const EVIDENCE_GATE_ENV = {
  highImpactRequiresBalancedEvidence: "SOLO_RESEARCH_HIGH_IMPACT_REQUIRES_BALANCED_EVIDENCE",
  minimumUsableFindings: "SOLO_RESEARCH_MINIMUM_USABLE_FINDINGS",
  evidenceConflictRatio: "MAX_EVIDENCE_CONFLICT_RATIO"
} as const;

type ResearchGateEnv = Readonly<Record<string, string | undefined>>;

function envBoolean(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (/^(1|true|yes)$/iu.test(value)) {
    return true;
  }

  if (/^(0|false|no)$/iu.test(value)) {
    return false;
  }

  throw new Error(`${name} must be one of 1, 0, true, false, yes, or no. Example: ${name}=false.`);
}

function envPositiveInteger(value: string | undefined, fallback: number, name: string) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${name} must be a positive integer. Example: ${name}=1.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (parsed < 1) {
    throw new Error(`${name} must be between 1 and 20. Example: ${name}=1.`);
  }

  return Math.min(parsed, 20);
}

function envRatio(value: string | undefined, fallback: number, name: string) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be a number between 0 and 1. Example: ${name}=0.35.`);
  }

  return parsed;
}

export function evidenceGateConfigFromEnv(
  env: ResearchGateEnv = runtimeResearchGateEnv()
): EvidenceGateConfig {
  return {
    ...DEFAULT_EVIDENCE_GATE_CONFIG,
    highImpactRequiresBalancedEvidence: envBoolean(
      env[EVIDENCE_GATE_ENV.highImpactRequiresBalancedEvidence],
      DEFAULT_EVIDENCE_GATE_CONFIG.highImpactRequiresBalancedEvidence,
      EVIDENCE_GATE_ENV.highImpactRequiresBalancedEvidence
    ),
    minimumUsableFindings: envPositiveInteger(
      env[EVIDENCE_GATE_ENV.minimumUsableFindings],
      DEFAULT_EVIDENCE_GATE_CONFIG.minimumUsableFindings,
      EVIDENCE_GATE_ENV.minimumUsableFindings
    ),
    evidenceConflictRatio: envRatio(
      env[EVIDENCE_GATE_ENV.evidenceConflictRatio],
      DEFAULT_EVIDENCE_GATE_CONFIG.evidenceConflictRatio,
      EVIDENCE_GATE_ENV.evidenceConflictRatio
    )
  };
}

function runtimeResearchGateEnv(): ResearchGateEnv {
  return (globalThis as { readonly process?: { readonly env?: ResearchGateEnv } }).process?.env ?? {};
}

export function evidenceGateConfigWithOverrides(
  overrides: Partial<Omit<EvidenceGateConfig, "statuses">> | undefined,
  base: EvidenceGateConfig = evidenceGateConfigFromEnv()
): EvidenceGateConfig {
  return {
    ...base,
    ...(overrides?.highImpactRequiresBalancedEvidence === undefined
      ? {}
      : { highImpactRequiresBalancedEvidence: overrides.highImpactRequiresBalancedEvidence }),
    ...(overrides?.minimumUsableFindings === undefined
      ? {}
      : { minimumUsableFindings: Math.max(1, Math.min(20, Math.trunc(overrides.minimumUsableFindings))) }),
    ...(overrides?.evidenceConflictRatio === undefined
      ? {}
      : { evidenceConflictRatio: Math.max(0, Math.min(1, overrides.evidenceConflictRatio)) })
  };
}

export function evidenceMatrixDecisionBlocked(task: ResearchTaskProjection, matrix: EvidenceMatrixProjection) {
  const config = evidenceGateConfigFromEnv();

  return (
    task.impact === "high" &&
    config.highImpactRequiresBalancedEvidence &&
    matrix.balanceStatus !== config.statuses.balanced
  );
}
