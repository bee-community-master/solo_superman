import type {
  ChatGptBrowserDelegationProjection,
  CreateChatGptBrowserDelegationRunRequest,
  ResearchEvidenceProjection,
  ResearchTaskId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];

const CHATGPT_DELEGATION_SENSITIVE_FIELD_KINDS = [
  "credential",
  "session",
  "secret",
  "2fa",
  "payment",
  "legal_sensitive"
] as const;
const CHATGPT_VISIBLE_RESEARCH_OPEN_URL = "https://chatgpt.com/" as const;

export interface VisibleChatGptResearchHandoff {
  readonly openUrl: typeof CHATGPT_VISIBLE_RESEARCH_OPEN_URL;
  readonly prompt: string;
  readonly checklist: readonly string[];
}

export function visibleChatGptResearchDelegationTaskIds(input: {
  readonly research: ResearchEvidenceProjection | null | undefined;
  readonly delegation: ChatGptBrowserDelegationProjection | null | undefined;
  readonly maxTasks?: number;
}): readonly ResearchTaskId[] {
  const delegatedTaskIds = new Set(input.delegation?.runs.map((run) => run.researchTaskId) ?? []);
  const maxTasks = Math.max(0, Math.trunc(input.maxTasks ?? 3));

  return (input.research?.tasks ?? [])
    .filter((task) => task.status === "planned" && !delegatedTaskIds.has(task.researchTaskId))
    .slice(0, maxTasks)
    .map((task) => task.researchTaskId);
}

export function visibleChatGptResearchHandoffForTask(task: ResearchTaskProjection): VisibleChatGptResearchHandoff {
  return {
    openUrl: CHATGPT_VISIBLE_RESEARCH_OPEN_URL,
    prompt: [
      "Use ChatGPT Pro/Deep Research as a visible, user-owned research assistant for Solo Superman.",
      "",
      `Research task: ${task.objective}`,
      `Impact: ${task.impact}`,
      `Route: ${task.routeOutcome}`,
      "",
      "Return a concise answer that includes:",
      "1. What the strongest current public evidence suggests.",
      "2. What would weaken or contradict that assumption.",
      "3. Source links with titles, publisher/site, and publication or retrieval dates when visible.",
      "4. Uncertainty, freshness risk, and any missing counterpoint.",
      "5. One follow-up question that a human should answer before this becomes implementation-ready.",
      "",
      "Do not include passwords, session cookies, API keys, private documents, contact lists, or legal/medical/financial secrets. If a page asks for login, CAPTCHA, payment, or private access, skip it and note the limitation."
    ].join("\n"),
    checklist: [
      "Review and edit the prompt before sending it in the visible ChatGPT browser.",
      "Keep login, CAPTCHA, quota, and account state under the user's direct control.",
      "Paste only the reviewed result and public source refs back into Solo Superman.",
      "If sources are weak, stale, or one-sided, keep that uncertainty in the pasted result."
    ]
  };
}

export function buildVisibleChatGptResearchDelegationRequest(input: {
  readonly expectedStateVersion: StateVersion;
  readonly sessionId: SessionId;
  readonly task: ResearchTaskProjection;
}): CreateChatGptBrowserDelegationRunRequest {
  const { expectedStateVersion, sessionId, task } = input;
  const refSuffix = `chatgpt_visible:${task.researchTaskId}`;

  return {
    sessionId,
    expectedStateVersion,
    idempotencyKey: `chatgpt-visible-preflight:${sessionId}:${task.researchTaskId}`,
    researchTaskId: task.researchTaskId,
    userVisibleExplanation:
      `ChatGPT Pro/Deep Research handoff is prepared as a visible, user-owned browser review for: ${task.objective}`,
    nextAction:
      "Review the redacted prompt preview, then approve a visible browser action or keep using public-web/Codex research instead.",
    promptPreviewRef: `prompt_preview:${refSuffix}`,
    dataDisclosurePreview: {
      disclosurePreviewRef: `disclosure_preview:${refSuffix}`,
      promptContextSummaryRef: `context_summary:${refSuffix}`,
      redactedPromptPreviewRef: `redacted_prompt:${refSuffix}`,
      excludedSensitiveFieldKinds: CHATGPT_DELEGATION_SENSITIVE_FIELD_KINDS,
      redactionPreviewShown: true,
      userCanEditPromptBeforeRun: true
    },
    redactionSummary: {
      redactionPreviewRef: `redaction_preview:${refSuffix}`,
      redactedFieldKinds: CHATGPT_DELEGATION_SENSITIVE_FIELD_KINDS,
      retainedArtifactKinds: ["prompt", "imported_result", "screenshot", "log"],
      defaultRetention: "prompt_result_screenshot_log",
      forbiddenRetentionPolicy: "no_credential_session_secret_2fa_payment_or_legal_sensitive_fields",
      userExportDeleteControls: true,
      deletionLeavesAuditMetadataOnly: true
    },
    policyRiskVerdict: {
      verdict: "pass",
      rationale:
        "Prepared as per-run visible research handoff only; no account sharing, resale, backend custody, or unattended ChatGPT queue is authorized.",
      evidenceRefs: [
        `research_task:${task.researchTaskId}`,
        "policy:chatgpt-visible-handoff:onboarding-permission"
      ]
    },
    sessionOwnershipVerdict: {
      verdict: "pass",
      rationale:
        "User selected visible ChatGPT handoff permission; login, CAPTCHA, usage limits, and final submission remain user-owned.",
      evidenceRefs: [
        "session:chatgpt-visible:user-owned-browser-required",
        `research_task:${task.researchTaskId}`
      ]
    },
    approvalDecision: "pending",
    auditRefs: [`audit:${refSuffix}:prepared`],
    activityFeedRefs: [
      `research_task:${task.researchTaskId}`,
      ...(task.sourceQueueItemId ? [`queue_item:${task.sourceQueueItemId}`] : [])
    ]
  };
}
