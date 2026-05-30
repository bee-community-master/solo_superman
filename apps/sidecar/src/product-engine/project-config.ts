import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVIDENCE_GATE_ENV } from "@solo-superman/core";

export interface SoloProjectQuestionGenerationConfig {
  readonly initialQuestionCount?: {
    readonly min?: number;
    readonly max?: number;
  };
  readonly reviewAxes?: readonly string[];
  readonly ambiguityDimensions?: readonly string[];
  readonly language?: "ko" | "en" | string;
  readonly domainKeywordExpansions?: Readonly<Record<string, readonly string[]>>;
}

export interface SoloProjectResearchConfig {
  readonly localCorpusDir?: string;
  readonly preferredLanguage?: "ko" | "en" | string;
  readonly region?: string;
  readonly evidenceConflictRatio?: number;
  readonly gates?: {
    readonly highImpactRequiresBalancedEvidence?: boolean;
    readonly minimumUsableFindings?: number;
  };
}

export interface SoloProjectConfig {
  readonly questionGeneration?: SoloProjectQuestionGenerationConfig;
  readonly research?: SoloProjectResearchConfig;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableEnv = Record<string, string | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function keywordExpansions(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([key, rawValues]) => {
    const values = stringArray(rawValues);

    return values ? [[key, values] as const] : [];
  });

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeProjectConfig(value: unknown): SoloProjectConfig {
  if (!isRecord(value)) {
    return {};
  }

  const questionGeneration = isRecord(value.questionGeneration) ? value.questionGeneration : {};
  const initialQuestionCount = isRecord(questionGeneration.initialQuestionCount)
    ? questionGeneration.initialQuestionCount
    : {};
  const research = isRecord(value.research) ? value.research : {};
  const gates = isRecord(research.gates) ? research.gates : {};
  const minQuestionCount = numberValue(initialQuestionCount.min);
  const maxQuestionCount = numberValue(initialQuestionCount.max);
  const questionCount = {
    ...(minQuestionCount === undefined ? {} : { min: minQuestionCount }),
    ...(maxQuestionCount === undefined ? {} : { max: maxQuestionCount })
  };
  const minimumUsableFindings = numberValue(gates.minimumUsableFindings);
  const normalizedQuestionGeneration: Mutable<SoloProjectQuestionGenerationConfig> = {};
  const normalizedResearch: Mutable<SoloProjectResearchConfig> = {};

  if (Object.keys(questionCount).length) {
    normalizedQuestionGeneration.initialQuestionCount = questionCount;
  }

  const reviewAxes = stringArray(questionGeneration.reviewAxes);
  const ambiguityDimensions = stringArray(questionGeneration.ambiguityDimensions);
  const language = stringValue(questionGeneration.language);
  const expansions = keywordExpansions(questionGeneration.domainKeywordExpansions);

  if (reviewAxes) {
    normalizedQuestionGeneration.reviewAxes = reviewAxes;
  }

  if (ambiguityDimensions) {
    normalizedQuestionGeneration.ambiguityDimensions = ambiguityDimensions;
  }

  if (language) {
    normalizedQuestionGeneration.language = language;
  }

  if (expansions) {
    normalizedQuestionGeneration.domainKeywordExpansions = expansions;
  }

  const localCorpusDir = stringValue(research.localCorpusDir);
  const preferredLanguage = stringValue(research.preferredLanguage);
  const region = stringValue(research.region);
  const evidenceConflictRatio = numberValue(research.evidenceConflictRatio);
  const normalizedGates: Mutable<NonNullable<SoloProjectResearchConfig["gates"]>> = {};

  if (localCorpusDir) {
    normalizedResearch.localCorpusDir = localCorpusDir;
  }

  if (preferredLanguage) {
    normalizedResearch.preferredLanguage = preferredLanguage;
  }

  if (region) {
    normalizedResearch.region = region;
  }

  if (evidenceConflictRatio !== undefined) {
    normalizedResearch.evidenceConflictRatio = evidenceConflictRatio;
  }

  if (typeof gates.highImpactRequiresBalancedEvidence === "boolean") {
    normalizedGates.highImpactRequiresBalancedEvidence = gates.highImpactRequiresBalancedEvidence;
  }

  if (minimumUsableFindings !== undefined) {
    normalizedGates.minimumUsableFindings = minimumUsableFindings;
  }

  normalizedResearch.gates = normalizedGates;

  return {
    questionGeneration: normalizedQuestionGeneration,
    research: normalizedResearch
  };
}

function mergeProjectConfig(base: SoloProjectConfig, override: SoloProjectConfig): SoloProjectConfig {
  return {
    questionGeneration: {
      ...base.questionGeneration,
      ...override.questionGeneration,
      initialQuestionCount: {
        ...base.questionGeneration?.initialQuestionCount,
        ...override.questionGeneration?.initialQuestionCount
      },
      domainKeywordExpansions: {
        ...base.questionGeneration?.domainKeywordExpansions,
        ...override.questionGeneration?.domainKeywordExpansions
      }
    },
    research: {
      ...base.research,
      ...override.research,
      gates: {
        ...base.research?.gates,
        ...override.research?.gates
      }
    }
  };
}

function readConfigFile(path: string) {
  if (!existsSync(path)) {
    return {};
  }

  return normalizeProjectConfig(JSON.parse(readFileSync(path, "utf8")));
}

export function loadSoloProjectConfig(root = process.cwd()): SoloProjectConfig {
  const basePath = resolve(root, "projectConfig.json");
  const localPath = resolve(root, ".solo-superman", "projectConfig.json");

  return mergeProjectConfig(readConfigFile(basePath), readConfigFile(localPath));
}

export function researchGateEnvDefaultsFromProjectConfig(config: SoloProjectConfig): Readonly<Record<string, string>> {
  const defaults: Record<string, string> = {};
  const research = config.research;

  if (research?.evidenceConflictRatio !== undefined) {
    defaults[EVIDENCE_GATE_ENV.evidenceConflictRatio] = String(research.evidenceConflictRatio);
  }

  if (research?.gates?.minimumUsableFindings !== undefined) {
    defaults[EVIDENCE_GATE_ENV.minimumUsableFindings] = String(research.gates.minimumUsableFindings);
  }

  if (research?.gates?.highImpactRequiresBalancedEvidence !== undefined) {
    defaults[EVIDENCE_GATE_ENV.highImpactRequiresBalancedEvidence] =
      String(research.gates.highImpactRequiresBalancedEvidence);
  }

  return defaults;
}

export function applyResearchGateEnvDefaultsFromProjectConfig(
  config: SoloProjectConfig,
  env: MutableEnv = process.env
) {
  for (const [name, value] of Object.entries(researchGateEnvDefaultsFromProjectConfig(config))) {
    if (!env[name]) {
      env[name] = value;
    }
  }
}
