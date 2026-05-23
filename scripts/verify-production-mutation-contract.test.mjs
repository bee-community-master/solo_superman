import { describe, expect, it } from "vitest";
import {
  PRODUCTION_MUTATION_CONTRACT_SCHEMA_VERSION,
  evaluateProductionMutationContract,
  evidenceForEvaluation,
  parseProductionMutationContractArgs,
  validateProductionMutationContract
} from "./verify-production-mutation-contract.mjs";

function baseContract(overrides = {}) {
  return {
    schemaVersion: PRODUCTION_MUTATION_CONTRACT_SCHEMA_VERSION,
    appId: "solo-superman",
    contractStatus: "defined_final_submit_blocked",
    productionMutationPerformed: false,
    summary: "Final submit stays blocked until explicit evidence passes.",
    finalSubmitGate: {
      id: "service-page-final-submit",
      status: "blocked_until_ready_evidence",
      allowedActionClass: "final_submit_request",
      requiresUserPresentLogin: true,
      requiresPerActionApproval: true,
      requiresSeparateConfirmation: true,
      productionMutationPerformed: false,
      blockedActionClasses: [
        "credential_entry",
        "secret_storage",
        "unattended_login",
        "payment_submit",
        "legal_submit",
        "medical_submit",
        "financial_submit",
        "privacy_submit",
        "production_deploy",
        "dns_cutover",
        "account_deletion"
      ]
    },
    requiredEvidence: {
      confirmationCard: [
        "service_origin",
        "exact_action_summary",
        "redacted_form_diff",
        "irreversible_effect_notice",
        "fresh_user_final_confirmation"
      ],
      executionAuthorityRecord: [
        "ready_status",
        "browser_action_scope",
        "approved_service_origin_only",
        "rollback_ref",
        "no_secret_values"
      ],
      redactionAndConsent: [
        "redaction_preview_ref",
        "visible_data_categories",
        "forbidden_credential_session_token_values",
        "user_present_login_confirmation"
      ],
      auditAndRollback: ["idempotency_key", "pre_mutation_snapshot_ref", "rollback_plan_ref", "activity_feed_ref", "audit_ref"]
    },
    requiredVerificationCommands: {
      credentialFree: ["pnpm verify:production-mutation-contract", "pnpm verify:service-page-pipeline"],
      ready: ["pnpm verify:production-mutation-contract -- --require-ready", "pnpm verify:service-page-pipeline"]
    },
    checkedBehaviors: [
      "Final submit stays blocked by default even when confirmation and authority refs are present.",
      "Production mutation performed remains false in credential-free verification."
    ],
    ...overrides
  };
}

function readyEvidenceRefs() {
  return {
    confirmationCard: ["evidence:confirmation-card:ready"],
    executionAuthorityRecord: ["evidence:execution-authority:ready"],
    redactionAndConsent: ["evidence:redaction-consent:ready"],
    auditAndRollback: ["evidence:audit-rollback:ready"]
  };
}

describe("production mutation contract verification", () => {
  it("passes the default blocked contract posture", () => {
    const evaluation = evaluateProductionMutationContract(baseContract());

    expect(evaluation).toEqual({
      ok: true,
      contractValid: true,
      finalSubmitReady: false,
      blockers: []
    });
  });

  it("reports require-ready mode as blocked until final-submit evidence is ready", () => {
    const evaluation = evaluateProductionMutationContract(baseContract(), { requireReady: true });
    const evidence = evidenceForEvaluation(evaluation, { requireReady: true });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toContain("service-page final-submit production mutation contract is not ready");
    expect(evidence).toMatchObject({ status: "blocked", mode: "require-ready", finalSubmitReady: false });
  });

  it("requires confirmation card evidence fields", () => {
    const contract = baseContract({
      requiredEvidence: {
        ...baseContract().requiredEvidence,
        confirmationCard: ["service_origin", "exact_action_summary"]
      }
    });
    const result = validateProductionMutationContract(contract);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "$.requiredEvidence.confirmationCard: must include redacted_form_diff",
      "$.requiredEvidence.confirmationCard: must include fresh_user_final_confirmation"
    ]));
  });

  it("rejects credential-free contracts that claim a production mutation already happened", () => {
    const result = validateProductionMutationContract(baseContract({ productionMutationPerformed: true }));

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.productionMutationPerformed: must remain false in contract verification");
  });

  it("rejects secret-like URL evidence strings", () => {
    const result = validateProductionMutationContract(baseContract({
      summary: "See https://example.com/evidence?token=abc for details."
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.summary: must not contain secret-like query parameter token");
  });

  it("rejects a status-only ready flip without concrete ready evidence refs", () => {
    const result = validateProductionMutationContract(baseContract({
      contractStatus: "ready_for_final_submit",
      finalSubmitGate: { ...baseContract().finalSubmitGate, status: "ready" }
    }));

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("$.readyEvidenceRefs: must be an object when final-submit readiness is marked ready");
  });

  it("accepts a ready fixture only when status, gate, and ready evidence refs are present", () => {
    const evaluation = evaluateProductionMutationContract(baseContract({
      contractStatus: "ready_for_final_submit",
      finalSubmitGate: { ...baseContract().finalSubmitGate, status: "ready" },
      readyEvidenceRefs: readyEvidenceRefs()
    }), { requireReady: true });

    expect(evaluation).toMatchObject({ ok: true, finalSubmitReady: true, blockers: [] });
  });

  it("parses contract path and require-ready flags", () => {
    expect(parseProductionMutationContractArgs(["--contract", "custom.json", "--require-ready"])).toEqual({
      contractPath: "custom.json",
      requireReady: true
    });
    expect(() => parseProductionMutationContractArgs(["--contract"])).toThrow("--contract requires a path value");
  });
});
