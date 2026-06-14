import { describe, expect, it } from "vitest";
import type { ResearchTaskId, StateVersion } from "@solo-superman/contracts";
import {
  CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
  CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE
} from "@solo-superman/contracts";
import {
  buildChatGptVisibleResultImportDelegationRequest,
  chatGptDelegationRunForResearchTask,
  chatGptVisibleResearchImportHint,
  importedResearchResultRefFromResponse,
  researchImportMetadataForTask
} from "./chatgpt-visible-research-import";

const copy = {
  manualResearchSourceTitle: "Manual desk research",
  manualResearchLimitationNotes: "Manual import from founder-provided source.",
  chatGptResearchSourceTitle: "User-supplied ChatGPT Deep Research result",
  chatGptResearchLimitationNotes: "Imported from a visible user-owned ChatGPT session; verify cited sources, uncertainty, counterpoints, and freshness before planning."
};

describe("chatgpt visible research import helpers", () => {
  it("adds visible ChatGPT provenance to research imports for matching delegated tasks", () => {
    const metadata = researchImportMetadataForTask({
      delegation: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
      researchTaskId: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.researchTaskId,
      copy
    });

    expect(chatGptDelegationRunForResearchTask({
      delegation: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
      researchTaskId: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.researchTaskId
    })?.runId).toBe(CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.runId);
    expect(metadata).toMatchObject({
      sourceTitle: "User-supplied ChatGPT Deep Research result",
      sourceReliability: "unknown",
      questionRef: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.promptPreviewRef,
      implicationScope: "visible_chatgpt_deep_research_import",
      staleSensitive: true
    });
  });

  it("keeps ordinary manual import metadata when no delegated task matches", () => {
    expect(researchImportMetadataForTask({
      delegation: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
      researchTaskId: "research_task_unrelated" as ResearchTaskId,
      copy
    })).toEqual({
      sourceTitle: "Manual desk research",
      limitationNotes: "Manual import from founder-provided source."
    });
    expect(chatGptVisibleResearchImportHint({
      delegation: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE,
      researchTaskId: "research_task_unrelated" as ResearchTaskId,
      hint: "Paste visible ChatGPT result"
    })).toBeNull();
  });

  it("adds visible ChatGPT provenance when onboarding exposed a user-owned handoff without a delegation run", () => {
    const researchTaskId = "research_task_visible_handoff_only" as ResearchTaskId;

    expect(researchImportMetadataForTask({
      delegation: null,
      researchTaskId,
      visibleChatGptHandoffAvailable: true,
      copy
    })).toMatchObject({
      sourceTitle: "User-supplied ChatGPT Deep Research result",
      sourceReliability: "unknown",
      limitationNotes:
        "Imported from a visible user-owned ChatGPT session; verify cited sources, uncertainty, counterpoints, and freshness before planning.",
      decisionContext: expect.stringContaining("user reviewed and pasted the result"),
      questionRef: `visible_chatgpt_handoff:${researchTaskId}`,
      implicationScope: "visible_chatgpt_deep_research_import",
      staleSensitive: true
    });
  });

  it("extracts imported research result refs from deterministic command outputs", () => {
    expect(importedResearchResultRefFromResponse({
      category: "accepted_with_projection",
      commandId: "cmd_import" as never,
      correlationId: "corr_import" as never,
      stateVersionBefore: 1 as StateVersion,
      stateVersionAfter: 2 as StateVersion,
      deterministicOutputs: [
        {
          outputType: "reducer_deterministic_output",
          outputRef: "research_result_visible_chatgpt",
          payload: {
            researchTaskId: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.researchTaskId,
            synthesisVersion: 1
          }
        }
      ]
    }, CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.researchTaskId)).toBe("research_result_visible_chatgpt");
  });

  it("builds a completed delegation import gate only after visible browser authority is approved", () => {
    const request = buildChatGptVisibleResultImportDelegationRequest({
      expectedStateVersion: 9 as StateVersion,
      sessionId: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.sessionId,
      run: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE,
      resultImportRef: "research_result_visible_chatgpt" as never
    });

    expect(request).toMatchObject({
      expectedStateVersion: 9,
      researchTaskId: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.researchTaskId,
      status: "completed",
      approvalDecision: "approved",
      browserActionAuthorityRef: CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE.browserActionAuthorityRef,
      resultImportRef: "research_result_visible_chatgpt",
      resultImportGate: expect.objectContaining({
        sourceProvenanceStatus: "pass",
        uncertaintyStatus: "pass",
        conEvidenceStatus: "pass",
        staleRiskStatus: "pass"
      })
    });
  });

  it("does not build a delegation result import without approval and browser authority", () => {
    const blockedRun = {
      ...CHATGPT_BROWSER_DELEGATION_READY_RUN_FIXTURE,
      approvalDecision: "pending" as const,
      browserActionAuthorityRef: null
    };

    expect(buildChatGptVisibleResultImportDelegationRequest({
      expectedStateVersion: 9 as StateVersion,
      sessionId: CHATGPT_BROWSER_DELEGATION_READY_PROJECTION_FIXTURE.sessionId,
      run: blockedRun,
      resultImportRef: "research_result_visible_chatgpt" as never
    })).toBeNull();
  });
});
