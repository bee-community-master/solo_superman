import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_GATE_ENV } from "@solo-superman/core";
import {
  applyResearchGateEnvDefaultsFromProjectConfig,
  loadSoloProjectConfig,
  researchGateEnvDefaultsFromProjectConfig
} from "./project-config";

describe("Solo project config", () => {
  it("loads question, research, and evidence gate overrides with local precedence", async () => {
    const root = await mkdtemp(join(tmpdir(), "solo-project-config-"));

    await writeFile(
      join(root, "projectConfig.json"),
      JSON.stringify({
        questionGeneration: {
          initialQuestionCount: { min: 4, max: 8 },
          reviewAxes: ["customer", "pricing"],
          language: "en"
        },
        research: {
          localCorpusDir: "./research-corpus",
          preferredLanguage: "en",
          evidenceConflictRatio: 0.6,
          gates: {
            minimumUsableFindings: 2,
            highImpactRequiresBalancedEvidence: true
          }
        }
      })
    );
    await mkdir(join(root, ".solo-superman"));
    await writeFile(
      join(root, ".solo-superman", "projectConfig.json"),
      JSON.stringify({
        questionGeneration: {
          language: "ko",
          domainKeywordExpansions: {
            "반려동물": ["pet", "companion animal"]
          }
        },
        research: {
          evidenceConflictRatio: 0.8,
          gates: {
            highImpactRequiresBalancedEvidence: false
          }
        }
      })
    );

    const config = loadSoloProjectConfig(root);

    expect(config.questionGeneration).toMatchObject({
      initialQuestionCount: { min: 4, max: 8 },
      reviewAxes: ["customer", "pricing"],
      language: "ko",
      domainKeywordExpansions: {
        "반려동물": ["pet", "companion animal"]
      }
    });
    expect(config.research).toMatchObject({
      localCorpusDir: "./research-corpus",
      preferredLanguage: "en",
      evidenceConflictRatio: 0.8,
      gates: {
        minimumUsableFindings: 2,
        highImpactRequiresBalancedEvidence: false
      }
    });
  });

  it("maps project evidence gate settings to environment defaults without overriding explicit env", () => {
    const env = {
      [EVIDENCE_GATE_ENV.evidenceConflictRatio]: "0.9"
    };
    const config = {
      research: {
        evidenceConflictRatio: 0.4,
        gates: {
          minimumUsableFindings: 3,
          highImpactRequiresBalancedEvidence: false
        }
      }
    };

    expect(researchGateEnvDefaultsFromProjectConfig(config)).toMatchObject({
      [EVIDENCE_GATE_ENV.evidenceConflictRatio]: "0.4",
      [EVIDENCE_GATE_ENV.minimumUsableFindings]: "3",
      [EVIDENCE_GATE_ENV.highImpactRequiresBalancedEvidence]: "false"
    });

    applyResearchGateEnvDefaultsFromProjectConfig(config, env);

    expect(env).toMatchObject({
      [EVIDENCE_GATE_ENV.evidenceConflictRatio]: "0.9",
      [EVIDENCE_GATE_ENV.minimumUsableFindings]: "3",
      [EVIDENCE_GATE_ENV.highImpactRequiresBalancedEvidence]: "false"
    });
  });
});
