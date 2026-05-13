import { describe, expect, it } from "vitest";
import {
  CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
  chatGptBrowserDelegationStatusForRun,
  validateChatGptBrowserDelegationProjection,
  validateChatGptBrowserDelegationRun,
  type ChatGptBrowserDelegationRun
} from "./chatgpt-browser-delegation";
import type { ResearchResultId } from "../ids";

describe("ChatGPT browser delegation contract", () => {
  it("validates the ready preflight record without requiring credential or session custody", () => {
    const projection = validateChatGptBrowserDelegationProjection(CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE);
    const run = validateChatGptBrowserDelegationRun(projection.latestRun);

    expect(chatGptBrowserDelegationStatusForRun(run)).toBe("running");
    expect(run).toMatchObject({
      approvalDecision: "approved",
      policyRiskVerdict: { verdict: "pass" },
      sessionOwnershipVerdict: { verdict: "pass" },
      browserActionAuthorityRef: "exec_auth_chatgpt_ready",
      fallbackApplied: null,
      blockReasons: []
    });
    expect(run.redactionSummary).toMatchObject({
      defaultRetention: "prompt_result_screenshot_log",
      forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
      userExportDeleteControls: true,
      deletionLeavesAuditMetadataOnly: true
    });
  });

  it("requires a visible fallback state when policy/session/account-sharing risks block a run", () => {
    const projection = validateChatGptBrowserDelegationProjection(
      CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE
    );

    expect(projection.currentStatus).toBe("blocked");
    expect(projection.blockedPreconditions).toEqual(projection.latestRun.blockReasons);
    expect(projection.latestRun.fallbackApplied).toMatchObject({
      lane: "manual_prompt_handoff",
      userAction: expect.stringContaining("Known Risk")
    });
  });

  it("rejects silent blocked retries and missing disclosure/redaction previews", () => {
    const invalidRun: ChatGptBrowserDelegationRun = {
      ...CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE.latestRun,
      dataDisclosurePreview: {
        ...CHATGPT_BROWSER_DELEGATION_FALLBACK_PROJECTION_FIXTURE.latestRun.dataDisclosurePreview,
        redactionPreviewShown: false
      },
      fallbackApplied: null
    };

    expect(() => validateChatGptBrowserDelegationRun(invalidRun)).toThrow(/redactionPreviewShown/);
    expect(() => validateChatGptBrowserDelegationRun(invalidRun)).toThrow(/fallbackApplied/);
  });

  it("requires failed result-import gates to surface as visible fallback blockers", () => {
    const blockedRun: ChatGptBrowserDelegationRun = {
      ...CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.latestRun,
      status: "failed",
      userVisibleExplanation: "ChatGPT result import gates failed.",
      nextAction: "Review the transcript manually before importing the result.",
      canRevoke: false,
      resultImportRef: "research_result_chatgpt_gate_fail" as ResearchResultId,
      resultImportGate: {
        sourceProvenanceStatus: "pass",
        uncertaintyStatus: "block",
        conEvidenceStatus: "block",
        staleRiskStatus: "pass",
        sourceRefs: ["chatgpt:conversation:hash-only"],
        uncertaintyRefs: ["uncertainty:missing"],
        conEvidenceRefs: ["con:evidence:missing"],
        staleRiskRefs: ["stale-risk:checked"],
        importRationale: "Candidate output did not preserve uncertainty or counter-evidence."
      },
      fallbackApplied: {
        lane: "manual_prompt_handoff",
        visibleState: "ChatGPT 결과 가져오기를 보류하고 수동 검토가 필요합니다.",
        reason: "Result import gates did not preserve required uncertainty and counter-evidence.",
        userAction: "Review the transcript manually before importing the result."
      },
      blockReasons: [
        {
          code: "result_import_gate_failed",
          message: "ChatGPT result import requires provenance, uncertainty, con-evidence, and stale-risk gates to pass.",
          evidenceRefs: ["uncertainty:missing", "con:evidence:missing"]
        }
      ]
    };
    const silentRun: ChatGptBrowserDelegationRun = {
      ...blockedRun,
      fallbackApplied: null,
      blockReasons: []
    };

    expect(chatGptBrowserDelegationStatusForRun(validateChatGptBrowserDelegationRun(blockedRun))).toBe(
      "failed"
    );
    expect(() => validateChatGptBrowserDelegationRun(silentRun)).toThrow(/result_import_gate_failed/);
  });

  it("allows result imports only when all provenance and quality gates pass", () => {
    const importReadyRun: ChatGptBrowserDelegationRun = {
      ...CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.latestRun,
      status: "completed",
      userVisibleExplanation: "ChatGPT result import gates passed.",
      nextAction: "Import the result with source and counter-evidence refs attached.",
      canRevoke: false,
      resultImportRef: "research_result_chatgpt_gate_pass" as ResearchResultId,
      resultImportGate: {
        sourceProvenanceStatus: "pass",
        uncertaintyStatus: "pass",
        conEvidenceStatus: "pass",
        staleRiskStatus: "pass",
        sourceRefs: ["chatgpt:conversation:hash"],
        uncertaintyRefs: ["uncertainty:preserved"],
        conEvidenceRefs: ["con:evidence:preserved"],
        staleRiskRefs: ["stale-risk:checked"],
        importRationale: "Candidate output preserves source, uncertainty, counter-evidence, and stale-risk gates."
      }
    };

    expect(chatGptBrowserDelegationStatusForRun(validateChatGptBrowserDelegationRun(importReadyRun))).toBe(
      "completed"
    );
  });

  it("rejects source-less result imports before they can look ready", () => {
    const sourceLessRun: ChatGptBrowserDelegationRun = {
      ...CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.latestRun,
      resultImportRef: "research_result_chatgpt_sourceless" as ResearchResultId,
      resultImportGate: {
        sourceProvenanceStatus: "pass",
        uncertaintyStatus: "pass",
        conEvidenceStatus: "pass",
        staleRiskStatus: "pass",
        sourceRefs: [],
        uncertaintyRefs: ["uncertainty:preserved"],
        conEvidenceRefs: ["con:evidence:preserved"],
        staleRiskRefs: ["stale-risk:checked"],
        importRationale: "Candidate output claims to preserve quality gates without source provenance."
      }
    };

    expect(() => validateChatGptBrowserDelegationRun(sourceLessRun)).toThrow(/resultImportGate/);
  });

  it("rejects credential/session/token-shaped values anywhere in retained artifacts", () => {
    const invalidRun: ChatGptBrowserDelegationRun = {
      ...CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.latestRun,
      logRefs: ["chatgpt:log:api_key=sk-test-not-allowed"]
    };

    expect(() => validateChatGptBrowserDelegationRun(invalidRun)).toThrow(/must not contain credential/);
  });
});
