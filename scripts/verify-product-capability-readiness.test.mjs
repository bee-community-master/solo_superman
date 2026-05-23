import { describe, expect, it } from "vitest";
import {
  PRODUCT_CAPABILITY_READINESS_SCHEMA_VERSION,
  evidenceForEvaluation,
  evaluateProductCapabilityReadiness,
  parseProductCapabilityReadinessArgs,
  validateProductCapabilityReadinessContract
} from "./verify-product-capability-readiness.mjs";

function codeBackedCapability(id, verificationCommands, overrides = {}) {
  return {
    id,
    status: "code_backed",
    requiredFor: "technical-preview-core-loop",
    evidenceRefs: [`docs/product-capability-readiness_KO.md#${id}`, `apps/sidecar/src/${id}.ts`],
    verificationCommands,
    checkedBehaviors: [`${id} behavior is visible`, `${id} evidence is verifier-backed`],
    ...overrides
  };
}

function autoImplementationCheckedBehaviors() {
  return [
    "Runtime preview requests produce bounded preview artifacts without applying file, shell, browser, or network actions.",
    "Worker jobs keep planned ledger docs, authority refs, sandbox boundaries, and manual recovery evidence visible.",
    "Generated PR body includes issue document status summary, stage status summary, review/evidence gate summary, and missing-test audit summary coverage.",
    "Every canonical auto-implementation stage can carry code-review, clean-code, missing-test audit, and test evidence before completion."
  ];
}

function codeBackedContract(overrides = {}) {
  return {
    schemaVersion: PRODUCT_CAPABILITY_READINESS_SCHEMA_VERSION,
    appId: "solo-superman",
    publicPosture: "technical-preview",
    coreProductStatus: "code_backed",
    summary: "Core technical-preview product loop is code-backed by credential-free smokes.",
    releaseReadinessRef: "docs/release-readiness_KO.md",
    requiredVerificationCommands: {
      defaultSuite: [
        "pnpm verify:prod-bundle",
        "pnpm verify:clarification-pipeline",
        "pnpm verify:clarification-volume",
        "pnpm verify:research-pipeline",
        "pnpm verify:browser-delegation-pipeline",
        "pnpm verify:service-page-pipeline",
        "pnpm verify:production-mutation-contract",
        "pnpm verify:auto-implementation-pipeline",
        "pnpm verify:product-capability-readiness",
        "pnpm verify"
      ],
      supporting: [
        "pnpm verify:runtime-preview-turn",
        "pnpm verify:worker-job",
        "pnpm verify:pr-mutation",
        "pnpm verify:auto-implementation-review-loop"
      ]
    },
    capabilities: [
      codeBackedCapability("idea-clarification-loop", [
        "pnpm verify:clarification-pipeline",
        "pnpm verify:clarification-volume"
      ]),
      codeBackedCapability("research-evidence-loop", ["pnpm verify:research-pipeline"]),
      codeBackedCapability("planning-readiness-gates", [
        "pnpm verify:clarification-pipeline",
        "pnpm verify:research-pipeline"
      ]),
      codeBackedCapability("browser-service-boundary", [
        "pnpm verify:browser-delegation-pipeline",
        "pnpm verify:service-page-pipeline",
        "pnpm verify:production-mutation-contract"
      ], {
        checkedBehaviors: [
          "ChatGPT/browser delegation keeps disclosure preview, approval, evidence refs, and revoke controls visible.",
          "Service-page permissions require user-present login, action echo, artifact cleanup, and revoke checks.",
          "Final submit remains blocked until production-mutation contract evidence passes.",
          "The production-mutation contract keeps final submit separate from fill-draft and preview actions."
        ]
      }),
      codeBackedCapability("auto-implementation-review-loop", [
        "pnpm verify:runtime-preview-turn",
        "pnpm verify:worker-job",
        "pnpm verify:pr-mutation",
        "pnpm verify:auto-implementation-review-loop",
        "pnpm verify:auto-implementation-pipeline"
      ], {
        checkedBehaviors: autoImplementationCheckedBehaviors()
      }),
      codeBackedCapability("technical-preview-release-guardrails", [
        "pnpm verify:prod-bundle",
        "pnpm verify:release-readiness"
      ])
    ],
    ...overrides
  };
}

describe("product capability readiness verification", () => {
  it("passes the default contract mode when every technical-preview core capability is code-backed", () => {
    const evaluation = evaluateProductCapabilityReadiness(codeBackedContract());

    expect(evaluation).toMatchObject({
      ok: true,
      coreProductStatus: "code_backed",
      coreProductCodeBacked: true,
      blockedCapabilities: [],
      blockers: []
    });
  });

  it("reports behavior snippet verification in readiness evidence", () => {
    const evidence = evidenceForEvaluation(evaluateProductCapabilityReadiness(codeBackedContract()), {
      requireCodeBacked: false
    });

    expect(evidence.checked).toContain(
      "required capability behavior snippets, including final-submit production-mutation contract coverage and generated PR body summary coverage"
    );
  });

  it("fails when a required capability is omitted", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.filter((capability) => capability.id !== "research-evidence-loop")
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.capabilities: must include research-evidence-loop");
  });

  it("requires each capability to name its exact verifier commands", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "auto-implementation-review-loop"
          ? { ...capability, verificationCommands: ["pnpm verify:auto-implementation-pipeline"] }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[4].verificationCommands: must include pnpm verify:runtime-preview-turn",
      "$.capabilities[4].verificationCommands: must include pnpm verify:worker-job",
      "$.capabilities[4].verificationCommands: must include pnpm verify:pr-mutation",
      "$.capabilities[4].verificationCommands: must include pnpm verify:auto-implementation-review-loop"
    ]));
  });

  it("requires browser/service readiness to name final-submit production-mutation coverage", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "browser-service-boundary"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("production-mutation contract")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[3].checkedBehaviors: must mention production-mutation contract",
      "$.capabilities[3].checkedBehaviors: must mention final submit"
    ]));
  });

  it("requires auto-implementation readiness to name generated PR body summary coverage", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "auto-implementation-review-loop"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.startsWith("Generated PR body")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[4].checkedBehaviors: must mention Generated PR body",
      "$.capabilities[4].checkedBehaviors: must mention issue document status summary",
      "$.capabilities[4].checkedBehaviors: must mention missing-test audit summary"
    ]));
  });

  it("keeps require-code-backed mode blocked when a capability is blocked", () => {
    const contract = codeBackedContract({
      coreProductStatus: "blocked",
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "browser-service-boundary"
          ? {
              ...capability,
              status: "blocked",
              blocker: "Browser/service boundary smoke has not been implemented.",
              blockerIssue: "https://github.com/bee-community-master/solo_superman/issues/999"
            }
          : capability
      )
    });
    const evaluation = evaluateProductCapabilityReadiness(contract, { requireCodeBacked: true });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      "core product capabilities are not code_backed",
      "browser-service-boundary capability is still blocked"
    ]);
  });

  it("rejects a code-backed capability that still carries blocker prose", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "idea-clarification-loop"
          ? { ...capability, blocker: "Stale blocker should not remain on code-backed capability." }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.capabilities[0].blocker: must be omitted when the capability is code_backed");
  });

  it("requires the default verification command list to include product readiness", () => {
    const contract = codeBackedContract({
      requiredVerificationCommands: {
        defaultSuite: ["pnpm verify"],
        supporting: ["pnpm verify:runtime-preview-turn"]
      }
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:prod-bundle",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:research-pipeline",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:auto-implementation-pipeline",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:production-mutation-contract",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:product-capability-readiness"
    ]));
  });

  it("rejects secret-shaped URL evidence rather than accepting it as documentation", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "research-evidence-loop"
          ? { ...capability, evidenceRefs: ["https://example.com/evidence?token=abc", "docs/product_KO.md"] }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "$.capabilities[1].evidenceRefs[0]: must not contain secret-like query parameter token"
    );
  });

  it("parses contract path and require-code-backed mode flags", () => {
    expect(parseProductCapabilityReadinessArgs(["--contract", "custom.json", "--require-code-backed"])).toEqual({
      contractPath: "custom.json",
      requireCodeBacked: true
    });
    expect(() => parseProductCapabilityReadinessArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
