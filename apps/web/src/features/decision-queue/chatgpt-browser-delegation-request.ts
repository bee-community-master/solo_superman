import type {
  ChatGptBrowserDelegationProjection,
  CreateChatGptBrowserDelegationRunRequest,
  LivingSpecProjection,
  ResearchEvidenceProjection,
  ResearchTaskId,
  SessionId,
  StateVersion
} from "@solo-superman/contracts";
import type { AppLanguage } from "../../shared/i18n/app-language";

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

function compactResearchContextFromSpec(spec: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined) {
  return [spec?.title, ...(spec?.sections ?? [])]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 900);
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

export function visibleChatGptResearchHandoffForTask(input: {
  readonly task: ResearchTaskProjection;
  readonly spec?: Pick<LivingSpecProjection, "title" | "sections"> | null | undefined;
  readonly language?: AppLanguage | undefined;
}): VisibleChatGptResearchHandoff {
  const { language = "en", spec, task } = input;
  const isKorean = language === "ko";
  const ideaContext = spec?.title?.trim() || (isKorean ? "아직 제목이 없는 서비스 아이디어" : "Untitled service idea");
  const planningContext =
    compactResearchContextFromSpec(spec) ||
    (isKorean
      ? "아직 사용자 답변과 기획서 문맥이 충분히 쌓이지 않았습니다."
      : "User answers and planning context are not detailed yet.");

  return {
    openUrl: CHATGPT_VISIBLE_RESEARCH_OPEN_URL,
    prompt: isKorean
      ? [
          "Solo Superman의 기획 상세화를 돕는 공개 웹 리서치를 해주세요.",
          "",
          `원문 아이디어: ${ideaContext}`,
          `현재까지의 사용자 답변/기획 맥락: ${planningContext}`,
          `이번 리서치가 좁힐 결정: ${task.objective}`,
          `영향도: ${task.impact}`,
          "",
          "원하는 출력 형식:",
          "1. 가능한 사용자 미래: 리서치 결과상 이 아이디어가 잘 쓰이면 어떤 모습이 되는지 2-3개.",
          "2. 대표 사용 케이스: 누가, 언제, 어떤 일에 쓰는지.",
          "3. 기존 대안: 사용자가 지금 쓰는 도구나 방법.",
          "4. 막힐 상황: 실제 도입 중 막힐 수 있는 상황.",
          "5. 대응 선택지: 위 상황별로 제품이나 기획을 어떻게 바꿀 수 있는지.",
          "6. 다음 질문: 사용자가 답하면 기획서가 더 구체화되는 쉬운 질문 2-3개.",
          "7. 출처: 링크, 제목, 사이트명, 공개일 또는 확인일을 함께 적어주세요.",
          "",
          "출처 요구사항: 공개 웹에서 확인 가능한 자료만 사용하고, 로그인·CAPTCHA·결제·비공개 문서가 필요한 자료는 건너뛰고 한계로 적어주세요.",
          "비밀번호, 세션 쿠키, API 키, 결제 정보, 개인 연락처, 법률·의료·금융 비밀은 포함하지 마세요."
        ].join("\n")
      : [
          "Research public web evidence that helps Solo Superman turn this idea into a more detailed plan.",
          "",
          `Original idea: ${ideaContext}`,
          `Current user answers / planning context: ${planningContext}`,
          `Decision this research should narrow: ${task.objective}`,
          `Impact: ${task.impact}`,
          "",
          "Return the result in this format:",
          "1. Possible user futures: 2-3 concrete ways this idea could be used if it works.",
          "2. Representative use cases: who uses it, when, and for what job.",
          "3. Existing alternatives: tools or methods users rely on today.",
          "4. Likely blockers: situations where adoption or planning may stall.",
          "5. Response options: product or planning choices for each blocker.",
          "6. Next questions: 2-3 simple questions that would make the plan more specific.",
          "7. Sources: links, titles, site names, and publication or retrieval dates when visible.",
          "",
          "Source requirements: use only public web sources. Skip login, CAPTCHA, payment, or private documents and note the limitation.",
          "Do not include passwords, session cookies, API keys, payment information, private contacts, or legal/medical/financial secrets."
        ].join("\n"),
    checklist: isKorean
      ? [
          "ChatGPT에 보내기 전에 아이디어와 현재 답변 맥락이 맞는지 확인하세요.",
          "로그인, CAPTCHA, 사용량 제한은 사용자 브라우저에서 직접 처리하세요.",
          "검토한 결과와 공개 출처만 Solo Superman에 붙여 넣으세요.",
          "출처가 약하거나 오래됐거나 한쪽 관점이면 그 한계를 결과에 남기세요."
        ]
      : [
          "Review that the idea and current answer context are accurate before sending this to ChatGPT.",
          "Keep login, CAPTCHA, and usage limits under the user's direct browser control.",
          "Paste only the reviewed result and public sources back into Solo Superman.",
          "If sources are weak, stale, or one-sided, keep that limitation in the result."
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
      `ChatGPT Pro/Deep Research request is prepared as a visible, user-owned browser review for: ${task.objective}`,
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
        "Prepared as a per-run visible research request only; no account sharing, resale, backend custody, or unattended ChatGPT queue is authorized.",
      evidenceRefs: [
        `research_task:${task.researchTaskId}`,
        "policy:chatgpt-visible-handoff:onboarding-permission"
      ]
    },
    sessionOwnershipVerdict: {
      verdict: "pass",
      rationale:
        "User selected visible ChatGPT research permission; login, CAPTCHA, usage limits, and final submission remain user-owned.",
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
