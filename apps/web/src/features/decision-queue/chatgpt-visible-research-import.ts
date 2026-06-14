import type {
  ChatGptBrowserDelegationProjection,
  ChatGptBrowserDelegationRun,
  CommandResponse,
  CreateChatGptBrowserDelegationRunRequest,
  ImportResearchResultRequest,
  ResearchResultId,
  ResearchTaskId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";

export interface ChatGptVisibleResearchImportCopy {
  readonly manualResearchSourceTitle: string;
  readonly manualResearchLimitationNotes: string;
  readonly chatGptResearchSourceTitle: string;
  readonly chatGptResearchLimitationNotes: string;
}

export type ResearchImportMetadata = Pick<
  ImportResearchResultRequest,
  | "sourceTitle"
  | "sourceReliability"
  | "limitationNotes"
  | "decisionContext"
  | "questionRef"
  | "implicationScope"
  | "staleSensitive"
>;

export function chatGptDelegationRunForResearchTask(input: {
  readonly delegation: ChatGptBrowserDelegationProjection | null | undefined;
  readonly researchTaskId: ResearchTaskId;
}): ChatGptBrowserDelegationRun | null {
  const runs = input.delegation?.runs ?? [];

  return [...runs].reverse().find((run) => run.researchTaskId === input.researchTaskId) ?? null;
}

export function chatGptVisibleResearchImportHint(input: {
  readonly delegation: ChatGptBrowserDelegationProjection | null | undefined;
  readonly researchTaskId: ResearchTaskId;
  readonly hint: string;
}) {
  const run = chatGptDelegationRunForResearchTask(input);

  return run ? input.hint : null;
}

export function researchImportMetadataForTask(input: {
  readonly delegation: ChatGptBrowserDelegationProjection | null | undefined;
  readonly researchTaskId: ResearchTaskId;
  readonly visibleChatGptHandoffAvailable?: boolean;
  readonly copy: ChatGptVisibleResearchImportCopy;
}): ResearchImportMetadata {
  const run = chatGptDelegationRunForResearchTask(input);

  if (!run && !input.visibleChatGptHandoffAvailable) {
    return {
      sourceTitle: input.copy.manualResearchSourceTitle,
      limitationNotes: input.copy.manualResearchLimitationNotes
    };
  }

  return {
    sourceTitle: input.copy.chatGptResearchSourceTitle,
    sourceReliability: "unknown",
    limitationNotes: input.copy.chatGptResearchLimitationNotes,
    decisionContext:
      run?.userVisibleExplanation ??
      "Visible ChatGPT Pro/Deep Research request was shown from the user's onboarding permission; the user reviewed and pasted the result from their own browser session.",
    questionRef: run?.promptPreviewRef ?? `visible_chatgpt_handoff:${input.researchTaskId}`,
    implicationScope: "visible_chatgpt_deep_research_import",
    staleSensitive: true
  };
}

export function importedResearchResultRefFromResponse(
  response: CommandResponse<unknown>,
  researchTaskId: ResearchTaskId
): ResearchResultId | null {
  const output = response.deterministicOutputs?.find(
    (item) => item.outputType === "reducer_deterministic_output" && item.payload.researchTaskId === researchTaskId
  );

  return typeof output?.outputRef === "string" ? (output.outputRef as ResearchResultId) : null;
}

export function chatGptRunCanRecordResultImport(run: ChatGptBrowserDelegationRun | null) {
  return Boolean(run?.approvalDecision === "approved" && run.browserActionAuthorityRef);
}

export function buildChatGptVisibleResultImportDelegationRequest(input: {
  readonly expectedStateVersion: StateVersion;
  readonly sessionId: SessionId;
  readonly run: ChatGptBrowserDelegationRun;
  readonly resultImportRef: ResearchResultId;
}): CreateChatGptBrowserDelegationRunRequest | null {
  const { expectedStateVersion, resultImportRef, run, sessionId } = input;

  if (!chatGptRunCanRecordResultImport(run)) {
    return null;
  }

  return {
    sessionId,
    expectedStateVersion,
    idempotencyKey: `chatgpt-visible-result-import:${run.runId}:${resultImportRef}`,
    researchTaskId: run.researchTaskId,
    status: "completed",
    userVisibleExplanation: "Visible ChatGPT Pro/Deep Research result was imported into Research Evidence.",
    nextAction: "Review the generated evidence matrix, uncertainty notes, and follow-up questions before using this result for planning.",
    promptPreviewRef: run.promptPreviewRef,
    dataDisclosurePreview: run.dataDisclosurePreview,
    redactionSummary: run.redactionSummary,
    policyRiskVerdict: run.policyRiskVerdict,
    sessionOwnershipVerdict: run.sessionOwnershipVerdict,
    approvalDecision: run.approvalDecision,
    ...(run.browserActionAuthorityRef ? { browserActionAuthorityRef: run.browserActionAuthorityRef } : {}),
    resultImportRef,
    resultImportGate: {
      sourceProvenanceStatus: "pass",
      uncertaintyStatus: "pass",
      conEvidenceStatus: "pass",
      staleRiskStatus: "pass",
      sourceRefs: [`research_result:${resultImportRef}`, `prompt:${run.promptPreviewRef}`],
      uncertaintyRefs: [`research_result:${resultImportRef}:evidence_matrix_uncertainty`],
      conEvidenceRefs: [`research_result:${resultImportRef}:evidence_matrix_counterpoint`],
      staleRiskRefs: [`research_result:${resultImportRef}:source_freshness_review`],
      importRationale:
        "User-visible ChatGPT result was imported as source-traced research evidence; downstream evidence matrix review keeps uncertainty, counterpoint, and freshness gates visible."
    },
    screenshotRefs: run.screenshotRefs,
    logRefs: run.logRefs,
    auditRefs: [...run.auditRefs, `research_result:${resultImportRef}`, "audit:chatgpt-visible-result-import"],
    activityFeedRefs: [...run.activityFeedRefs, `research_result:${resultImportRef}`]
  };
}
