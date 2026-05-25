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
    "Opt-in live runtime readiness verification reports skipped, blocked, or passed evidence without forcing opt-in live execution into the default suite.",
    "Worker jobs keep planned ledger docs, authority refs, sandbox boundaries, and manual recovery evidence visible.",
    "Planning-derived PR-sized issue docs are first-class in issueManagement.planningIssueDocs, a separate PR issue sequence tracker, generated tracker state, and the Implementation panel before stage delivery issues; each run can target a selected planningIssueId so prior slices show completed, the selected slice shows active, and later slices remain planned.",
    "Generated PR body includes issue document status summary, stage status summary, review/evidence gate summary, and missing-test audit summary coverage, and approved gh PR create/edit mutations pass the generated body through a temporary body-file handoff instead of an inline CLI argument.",
    "Every canonical auto-implementation stage requires two consecutive no-finding feature and repository code-review passes, two consecutive no-finding changed-code and repository clean-code passes, a zero-gap missing-test audit, and passing test evidence before completion.",
    "Final merge_main stays blocked until final_verify_pr_update records current PR body evidence with full verification commands plus missing-test audit and test evidence.",
    "The single-session product loop smoke proves one pet-lifecycle idea reaches domain-fit questions, answer-linked research, research follow-up questions, Planning Handoff, and initial_pr auto implementation evidence in the same session.",
    "The opt-in single-session live-web product loop smoke proves that same pet-lifecycle path can import non-fixture public-web source URLs through the real browser-search adapter branch.",
    "The readiness-to-implementation verifier proves a spec_ready completion candidate becomes a planning_ready handoff before the first auto-implementation run starts.",
    "The end-to-end core product loop smoke proves idea intake, clarification, research follow-up debt, generated follow-up research, readiness-to-implementation handoff, runtime preview, worker, PR mutation, review-loop, and merge_main fixture evidence are connected by one verifier command."
  ];
}

function researchEvidenceCheckedBehaviors() {
  return [
    "Read-only public-web research runs require an active allowlist and bounded concurrency.",
    "Mounted web_search_readonly provider polling proves source-traced result import before evidence matrices and evidence packs are synthesized.",
    "Opt-in live-web research verification can run the same public-web import path with Playwright and non-fixture source URLs when network access is available.",
    "Research operations expose Max simultaneous research runs and Max research runs per session controls so users can tune manual and answer-triggered public-web research limits.",
    "Provider-polled research writes markdown memory so duplicate research can cite existing evidence while wider follow-up research and generated follow-up research tasks still start new runs with the memory as baseline context.",
    "Research review cards retain source traces and expose pro/con/uncertainty quality gates.",
    "Research-generated follow-up questions return to the Decision Queue as answerable debt.",
    "Evidence synthesis creates sourceQueueItemId-linked planned research tasks and queued research_evidence_effect wait work for research-generated follow-up questions.",
    "Research-generated follow-up questions preserve answer-form variety: open_text narrative answers, binary_choice pro/con decisions, single_choice one-of-many choices, multi_select one-or-more selections, ranked_choice, and evidence_judgment are selected from the concrete question intent instead of forcing every answer into pro/con stance."
  ];
}

function ideaClarificationCheckedBehaviors() {
  return [
    "Idea intake creates a user-confirmed business or personal project purpose before analysis.",
    "Active question batches stay bounded while long sessions can process 200+ question/answer loops.",
    "Clarification question cards and generated follow-ups support open text subjective/narrative prompts, binary stance, one-of-many single choice, one-or-more multi-select, ranked, evidence, and experiment answer formats instead of reusing one pro/con shape.",
    "Initial ambiguity questions can come from a prompt artifact that asks Codex for generated JSON with domain-fit questions before deterministic fallback.",
    "Generated questions apply the ambiguity-reduction algorithm by tagging the weakest dimension, separating fact-checking/current research/human judgment, requiring at least one pressure question, and carrying a concrete researchQuestion plus source-seeking research task into the answer-triggered research objective.",
    "Answer submission stays non-blocking while background research starts and automatic queue refill continue after the answer is persisted.",
    "Answers produce follow-up debt and research-task debt instead of hidden notes.",
    "Question-debt completion and Planning Handoff blockers remain visible before Planning-ready."
  ];
}

function planningReadinessCheckedBehaviors() {
  return [
    "Completeness keeps question debt and source-trace gaps from being labelled Planning-ready.",
    "Completion requires Composite score is 85 or higher before software implementation starts.",
    "Completion requires Most confidence axes are 75 or higher so most readiness metrics are concrete.",
    "Completion requires Core ambiguity dimensions are 75 or higher so goal, scope/non-goal, success criteria, and decision authority cannot be hidden by a high average score.",
    "Confidence and if-stop-now risk/action artifacts remain visible for readiness decisions.",
    "Planning Handoff carries research follow-up provenance into build-slice evidence.",
    "A positive readiness handoff is verified from candidate completeness through Planning Handoff into the first auto-implementation run."
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
        "pnpm verify:single-session-product-loop",
        "pnpm verify:readiness-to-implementation",
        "pnpm verify:auto-implementation-pipeline",
        "pnpm verify:core-product-loop",
        "pnpm verify:support-bundle",
        "pnpm verify:product-capability-readiness",
        "pnpm verify"
      ],
      supporting: [
        "pnpm verify:runtime-preview-turn",
        "pnpm verify:codex-live-runtime",
        "pnpm verify:worker-job",
        "pnpm verify:pr-mutation",
        "pnpm verify:auto-implementation-review-loop",
        "pnpm verify:single-session-product-loop:live-web",
        "pnpm verify:ready-release -- --plan-only",
        "pnpm support:bundle"
      ]
    },
    capabilities: [
      codeBackedCapability("idea-clarification-loop", [
        "pnpm verify:clarification-pipeline",
        "pnpm verify:clarification-volume"
      ], {
        checkedBehaviors: ideaClarificationCheckedBehaviors()
      }),
      codeBackedCapability("research-evidence-loop", ["pnpm verify:research-pipeline"], {
        checkedBehaviors: researchEvidenceCheckedBehaviors()
      }),
      codeBackedCapability("planning-readiness-gates", [
        "pnpm verify:clarification-pipeline",
        "pnpm verify:research-pipeline",
        "pnpm verify:readiness-to-implementation"
      ], {
        checkedBehaviors: planningReadinessCheckedBehaviors()
      }),
      codeBackedCapability("browser-service-boundary", [
        "pnpm verify:browser-delegation-pipeline",
        "pnpm verify:service-page-pipeline",
        "pnpm verify:production-mutation-contract"
      ], {
        checkedBehaviors: [
          "ChatGPT/browser delegation keeps disclosure preview, approval, evidence refs, revoke controls, visible ChatGPT handoff, and result import gate visibility.",
          "Service-page permissions require user-present login, action echo, artifact cleanup, and revoke checks.",
          "approved public-read browser actions accept only HTTPS public DNS targets while loopback-only remains required for service-page/local preview flows.",
          "Final submit remains blocked until production-mutation contract evidence passes.",
          "The production-mutation contract keeps final submit separate from fill-draft and preview actions."
        ]
      }),
      codeBackedCapability("auto-implementation-review-loop", [
        "pnpm verify:runtime-preview-turn",
        "pnpm verify:codex-live-runtime",
      "pnpm verify:worker-job",
      "pnpm verify:pr-mutation",
      "pnpm verify:auto-implementation-review-loop",
      "pnpm verify:single-session-product-loop",
      "pnpm verify:single-session-product-loop:live-web",
      "pnpm verify:readiness-to-implementation",
      "pnpm verify:auto-implementation-pipeline",
      "pnpm verify:core-product-loop"
      ], {
        checkedBehaviors: autoImplementationCheckedBehaviors()
      }),
      codeBackedCapability("technical-preview-release-guardrails", [
        "pnpm verify:prod-bundle",
        "pnpm verify:release-readiness"
      ]),
      codeBackedCapability("local-error-reporting", ["pnpm verify:support-bundle"], {
        checkedBehaviors: [
          "support diagnostics bundle generation is credential-free and writes a local JSON evidence file for error reports.",
          "Support bundle validation captures compact product/release diagnostics while excluding full environment dumps, file contents, browser cookies, OpenAI/GitHub tokens, and ChatGPT web credentials.",
          "ready-release plan-only support diagnostics expose the release evidence bundle preparation command, planned command list, release evidence blocker summary counts, and issue-specific handoff entries without running credential-required gates.",
          "URL credentials, secret-like query values, and token-shaped strings are redacted before support evidence is reported."
        ]
      })
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
      "required capability behavior snippets, including clarification answer-form variety, ambiguity-reduction routing, pressure questions, generated source-seeking research targets, non-blocking answer submission, mounted research provider polling, opt-in live-web research import coverage, research run limit UX, research markdown memory, generated follow-up research baseline memory, source-linked research follow-up task debt, answer-form variety for research follow-up questions, planning readiness score/axis/ambiguity-dimension floor gates, positive readiness handoff coverage, approved public-read browser targets, final-submit production-mutation contract coverage, opt-in live runtime coverage, generated PR body summary coverage, single-session product loop coverage, single-session live-web product loop coverage, readiness-to-implementation coverage, two-pass review streak gates, missing-test audit coverage, end-to-end core product loop coverage, redacted support diagnostics coverage, and ready-release plan-only coverage"
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
      "$.capabilities[4].verificationCommands: must include pnpm verify:codex-live-runtime",
      "$.capabilities[4].verificationCommands: must include pnpm verify:worker-job",
      "$.capabilities[4].verificationCommands: must include pnpm verify:pr-mutation",
      "$.capabilities[4].verificationCommands: must include pnpm verify:auto-implementation-review-loop",
      "$.capabilities[4].verificationCommands: must include pnpm verify:single-session-product-loop",
      "$.capabilities[4].verificationCommands: must include pnpm verify:single-session-product-loop:live-web",
      "$.capabilities[4].verificationCommands: must include pnpm verify:readiness-to-implementation",
      "$.capabilities[4].verificationCommands: must include pnpm verify:core-product-loop"
    ]));
  });

  it("requires browser/service readiness to name final-submit production-mutation coverage", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "browser-service-boundary"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("production-mutation contract") &&
                !behavior.includes("approved public-read") &&
                !behavior.includes("visible ChatGPT") &&
                !behavior.includes("result import gate")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[3].checkedBehaviors: must mention approved public-read",
      "$.capabilities[3].checkedBehaviors: must mention visible ChatGPT",
      "$.capabilities[3].checkedBehaviors: must mention result import gate",
      "$.capabilities[3].checkedBehaviors: must mention production-mutation contract",
      "$.capabilities[3].checkedBehaviors: must mention final submit"
    ]));
  });

  it("requires clarification readiness to name answer-form variety coverage", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "idea-clarification-loop"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("open text") &&
                !behavior.includes("single choice") &&
                !behavior.includes("experiment answer formats") &&
                !behavior.includes("prompt artifact") &&
                !behavior.includes("generated JSON") &&
                !behavior.includes("domain-fit") &&
                !behavior.includes("pressure question") &&
                !behavior.includes("source-seeking research task") &&
                !behavior.includes("non-blocking")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[0].checkedBehaviors: must mention open text",
      "$.capabilities[0].checkedBehaviors: must mention subjective/narrative",
      "$.capabilities[0].checkedBehaviors: must mention binary stance",
      "$.capabilities[0].checkedBehaviors: must mention one-of-many",
      "$.capabilities[0].checkedBehaviors: must mention single choice",
      "$.capabilities[0].checkedBehaviors: must mention one-or-more",
      "$.capabilities[0].checkedBehaviors: must mention multi-select",
      "$.capabilities[0].checkedBehaviors: must mention ranked",
      "$.capabilities[0].checkedBehaviors: must mention evidence",
      "$.capabilities[0].checkedBehaviors: must mention experiment answer formats",
      "$.capabilities[0].checkedBehaviors: must mention prompt artifact",
      "$.capabilities[0].checkedBehaviors: must mention generated JSON",
      "$.capabilities[0].checkedBehaviors: must mention domain-fit",
      "$.capabilities[0].checkedBehaviors: must mention pressure question",
      "$.capabilities[0].checkedBehaviors: must mention source-seeking research task",
      "$.capabilities[0].checkedBehaviors: must mention non-blocking",
      "$.capabilities[0].checkedBehaviors: must mention background research starts",
      "$.capabilities[0].checkedBehaviors: must mention automatic queue refill"
    ]));
  });

  it("requires research readiness to name mounted provider polling and follow-up debt coverage", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "research-evidence-loop"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("Mounted web_search_readonly provider polling") &&
                !behavior.includes("Opt-in live-web research verification") &&
                !behavior.includes("Max simultaneous research runs") &&
                !behavior.includes("markdown memory") &&
                !behavior.includes("Research-generated follow-up questions")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[1].checkedBehaviors: must mention Mounted web_search_readonly provider polling",
      "$.capabilities[1].checkedBehaviors: must mention Opt-in live-web research verification",
      "$.capabilities[1].checkedBehaviors: must mention source-traced result import",
      "$.capabilities[1].checkedBehaviors: must mention Max simultaneous research runs",
      "$.capabilities[1].checkedBehaviors: must mention Max research runs per session",
      "$.capabilities[1].checkedBehaviors: must mention markdown memory",
      "$.capabilities[1].checkedBehaviors: must mention wider follow-up research",
      "$.capabilities[1].checkedBehaviors: must mention generated follow-up research tasks",
      "$.capabilities[1].checkedBehaviors: must mention Research-generated follow-up questions",
      "$.capabilities[1].checkedBehaviors: must mention open_text narrative answers",
      "$.capabilities[1].checkedBehaviors: must mention binary_choice pro/con decisions",
      "$.capabilities[1].checkedBehaviors: must mention single_choice one-of-many choices",
      "$.capabilities[1].checkedBehaviors: must mention multi_select one-or-more selections",
      "$.capabilities[1].checkedBehaviors: must mention ranked_choice",
      "$.capabilities[1].checkedBehaviors: must mention evidence_judgment"
    ]));
  });

  it("requires planning readiness to name score and confidence-axis gates", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "planning-readiness-gates"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("Composite score") &&
                !behavior.includes("Most confidence axes") &&
                !behavior.includes("Core ambiguity dimensions") &&
                !behavior.includes("question debt") &&
                !behavior.includes("positive readiness handoff")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[2].checkedBehaviors: must mention Composite score is 85 or higher",
      "$.capabilities[2].checkedBehaviors: must mention Most confidence axes are 75 or higher",
      "$.capabilities[2].checkedBehaviors: must mention Core ambiguity dimensions are 75 or higher",
      "$.capabilities[2].checkedBehaviors: must mention question debt",
      "$.capabilities[2].checkedBehaviors: must mention positive readiness handoff"
    ]));
  });

  it("requires auto-implementation readiness to name live runtime and generated PR body coverage", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "auto-implementation-review-loop"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("live runtime readiness") && !behavior.startsWith("Generated PR body")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[4].checkedBehaviors: must mention live runtime readiness",
      "$.capabilities[4].checkedBehaviors: must mention skipped, blocked, or passed evidence",
      "$.capabilities[4].checkedBehaviors: must mention Generated PR body",
      "$.capabilities[4].checkedBehaviors: must mention issue document status summary",
      "$.capabilities[4].checkedBehaviors: must mention missing-test audit summary"
    ]));
  });

  it("requires auto-implementation readiness to name two-pass review, missing-test, and final test gates", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "auto-implementation-review-loop"
          ? {
              ...capability,
              checkedBehaviors: capability.checkedBehaviors.filter((behavior) =>
                !behavior.includes("two consecutive no-finding") &&
                !behavior.includes("Final merge_main") &&
                !behavior.includes("single-session product loop") &&
                !behavior.includes("single-session live-web product loop") &&
                !behavior.includes("readiness-to-implementation") &&
                !behavior.includes("end-to-end core product loop")
              )
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[4].checkedBehaviors: must mention two consecutive no-finding",
      "$.capabilities[4].checkedBehaviors: must mention feature and repository code-review",
      "$.capabilities[4].checkedBehaviors: must mention changed-code and repository clean-code",
      "$.capabilities[4].checkedBehaviors: must mention zero-gap missing-test audit",
      "$.capabilities[4].checkedBehaviors: must mention passing test evidence before completion",
      "$.capabilities[4].checkedBehaviors: must mention Final merge_main",
      "$.capabilities[4].checkedBehaviors: must mention final_verify_pr_update",
      "$.capabilities[4].checkedBehaviors: must mention current PR body evidence",
      "$.capabilities[4].checkedBehaviors: must mention full verification commands",
      "$.capabilities[4].checkedBehaviors: must mention single-session product loop",
      "$.capabilities[4].checkedBehaviors: must mention single-session live-web product loop",
      "$.capabilities[4].checkedBehaviors: must mention readiness-to-implementation",
      "$.capabilities[4].checkedBehaviors: must mention end-to-end core product loop"
    ]));
  });

  it("requires local error reporting to name redacted credential-free support diagnostics", () => {
    const contract = codeBackedContract({
      capabilities: codeBackedContract().capabilities.map((capability) =>
        capability.id === "local-error-reporting"
          ? {
              ...capability,
              checkedBehaviors: ["Support bundle can be generated.", "Credential-free evidence is captured."]
            }
          : capability
      )
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.capabilities[6].checkedBehaviors: must mention support diagnostics bundle",
      "$.capabilities[6].checkedBehaviors: must mention redacted",
      "$.capabilities[6].checkedBehaviors: must mention ready-release plan-only",
      "$.capabilities[6].checkedBehaviors: must mention bundle preparation command",
      "$.capabilities[6].checkedBehaviors: must mention planned command list",
      "$.capabilities[6].checkedBehaviors: must mention release evidence blocker summary",
      "$.capabilities[6].checkedBehaviors: must mention issue-specific handoff"
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
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:single-session-product-loop",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:readiness-to-implementation",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:auto-implementation-pipeline",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:core-product-loop",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:production-mutation-contract",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:support-bundle",
      "$.requiredVerificationCommands.defaultSuite: must include pnpm verify:product-capability-readiness"
    ]));
  });

  it("requires supporting commands to include live runtime, safe support, and ready-release plan checks", () => {
    const contract = codeBackedContract({
      requiredVerificationCommands: {
        defaultSuite: codeBackedContract().requiredVerificationCommands.defaultSuite,
        supporting: ["pnpm verify:runtime-preview-turn"]
      }
    });
    const result = validateProductCapabilityReadinessContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredVerificationCommands.supporting: must include pnpm verify:codex-live-runtime",
      "$.requiredVerificationCommands.supporting: must include pnpm verify:single-session-product-loop:live-web",
      "$.requiredVerificationCommands.supporting: must include pnpm verify:ready-release -- --plan-only",
      "$.requiredVerificationCommands.supporting: must include pnpm support:bundle"
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
