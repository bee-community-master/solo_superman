import type {
  ChatGptBrowserDelegationProjection,
  ChatGptBrowserDelegationRun
} from "@solo-superman/contracts";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";

export interface ChatGptDelegationViewModel {
  readonly status: string;
  readonly summary: string;
  readonly explanation: string;
  readonly visibleHandoffLabel: string;
  readonly nextAction: string;
  readonly canRevoke: boolean;
  readonly runId: string | null;
  readonly activityFeedRefs: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly redactionPreviewRef: string | null;
  readonly artifactControlLabels: readonly string[];
  readonly auditItems: readonly string[];
  readonly fallbackLabel: string | null;
  readonly fallbackReason: string | null;
  readonly blockReasonItems: readonly string[];
  readonly retentionLabel: string;
}

function artifactRefsForRun(run: ChatGptBrowserDelegationRun) {
  return [
    `prompt:${run.promptPreviewRef}`,
    `redaction:${run.redactionSummary.redactionPreviewRef}`,
    ...run.screenshotRefs.map((ref) => `screenshot:${ref}`),
    ...run.logRefs.map((ref) => `log:${ref}`),
    ...(run.resultImportRef ? [`result:${run.resultImportRef}`] : [])
  ];
}

function visibleHandoffLabelForRun(run: ChatGptBrowserDelegationRun) {
  switch (run.status) {
    case "waiting_for_approval":
      return "사용자 승인 전에는 ChatGPT 브라우저 작업을 시작하지 않습니다.";
    case "running":
      return "사용자가 볼 수 있는 로컬 브라우저 작업만 허용되며 계정/쿠키/2FA는 저장하지 않습니다.";
    case "waiting_for_user":
      return "로그인, CAPTCHA, 사용량 제한, UI 변경은 사용자 직접 조치가 필요합니다.";
    case "importing_result":
      return "가져온 결과는 출처/불확실성/반대근거/신선도 게이트를 통과해야 합니다.";
    case "completed":
      return "결과 가져오기가 끝났지만 저장 자료는 사용자가 내보내거나 삭제할 수 있어야 합니다.";
    case "blocked":
    case "failed":
      return "완전 headless ChatGPT Pro 자동화 대신 수동 프롬프트 전달 또는 공식 경로로 대체합니다.";
    case "revoked":
      return "사용자가 위임을 취소했으므로 더 이상 브라우저 작업을 계속할 수 없습니다.";
    case "pending_preflight":
      return "프롬프트/가림 처리/정책/세션 소유권 사전 점검을 먼저 기록합니다.";
  }
}

export function chatGptDelegationViewModel(
  projection: ChatGptBrowserDelegationProjection | null
): ChatGptDelegationViewModel {
  if (!projection) {
    return {
      status: "not_started",
      summary: "External AI workspace has not been prepared.",
      explanation: "No per-run local browser workspace has been recorded for this session.",
      visibleHandoffLabel: "ChatGPT Pro/Deep Research는 사용자 소유 브라우저에서 보이는 위임으로만 준비합니다.",
      nextAction: "Plan a research task and prepare a safe browser handoff preview before using an external AI workspace.",
      canRevoke: false,
      runId: null,
      activityFeedRefs: [],
      artifactRefs: [],
      redactionPreviewRef: null,
      artifactControlLabels: [],
      auditItems: [],
      fallbackLabel: null,
      fallbackReason: null,
      blockReasonItems: [],
      retentionLabel: "No prompt/result/screenshot/log artifacts are stored yet."
    };
  }

  const run = projection.latestRun;
  const artifactRefs = artifactRefsForRun(run);
  const artifactControlLabels = run.redactionSummary.userExportDeleteControls
    ? [
        "Export retained prompt/result/screenshot/log artifact refs",
        "Delete retained artifacts while leaving audit metadata only"
      ]
    : [];

  return {
    status: projection.currentStatus,
    summary: projection.summary,
    explanation: run.userVisibleExplanation,
    visibleHandoffLabel: visibleHandoffLabelForRun(run),
    nextAction: run.nextAction,
    canRevoke: run.canRevoke,
    runId: run.runId,
    activityFeedRefs: run.activityFeedRefs,
    artifactRefs,
    redactionPreviewRef: run.redactionSummary.redactionPreviewRef,
    artifactControlLabels,
    auditItems: run.auditLog.map((entry) => `${entry.eventType}: ${entry.label}`),
    fallbackLabel: run.fallbackApplied ? `${run.fallbackApplied.lane}: ${run.fallbackApplied.userAction}` : null,
    fallbackReason: run.fallbackApplied?.reason ?? null,
    blockReasonItems: run.blockReasons.map((reason) => `${reason.code}: ${reason.message}`),
    retentionLabel: run.redactionSummary.userExportDeleteControls
      ? "Prompt/result/screenshot/log artifacts are retained by default with export/delete controls; deleting artifacts leaves audit metadata only."
      : "Artifact retention controls are unavailable for this run."
  };
}

interface ChatGptDelegationPanelProps {
  readonly delegation: ChatGptDelegationViewModel;
  readonly isBusy: boolean;
  readonly onRefreshDelegation: () => void;
  readonly onRevokeDelegation: (runId: string) => void;
}

export function ChatGptDelegationPanel({
  delegation,
  isBusy,
  onRefreshDelegation,
  onRevokeDelegation
}: ChatGptDelegationPanelProps) {
  const copy = useDecisionQueueCopy();
  const revokableRunId = delegation.canRevoke ? delegation.runId : null;

  return (
    <section className="panel chatgpt-delegation-panel">
      <div className="panel-heading">
        <h2>{copy.permissions.externalAiWorkspace}</h2>
        <span>{delegation.status}</span>
      </div>
      <p>{delegation.summary}</p>
      <p className="research-recovery">{delegation.explanation}</p>
      <p className="mode-summary">{delegation.visibleHandoffLabel}</p>
      <p className="mode-summary">{copy.permissions.nextAction}: {delegation.nextAction}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy} onClick={onRefreshDelegation}>
          {copy.permissions.refreshWorkspace}
        </button>
        {revokableRunId ? (
          <button type="button" disabled={isBusy} onClick={() => onRevokeDelegation(revokableRunId)}>
            {copy.permissions.revokeWorkspace}
          </button>
        ) : null}
      </div>
      {delegation.fallbackLabel ? <p className="research-recovery">{copy.permissions.fallback}: {delegation.fallbackLabel}</p> : null}
      {delegation.fallbackReason ? <p className="mode-summary">{copy.permissions.fallbackReason}: {delegation.fallbackReason}</p> : null}
      {delegation.blockReasonItems.length ? (
        <ul>
          {delegation.blockReasonItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <h3>{copy.permissions.storedArtifacts}</h3>
      <p className="mode-summary">{delegation.retentionLabel}</p>
      {delegation.redactionPreviewRef ? (
        <p className="mode-summary">{copy.permissions.redactionPreview}: {delegation.redactionPreviewRef}</p>
      ) : null}
      {delegation.artifactControlLabels.length ? (
        <div className="card-actions panel-actions">
          {delegation.artifactControlLabels.map((label) => (
            <button
              key={label}
              type="button"
              disabled
              title="This PR exposes the artifact control surface and retained refs; artifact content export/delete execution remains separate from revoke."
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {delegation.artifactRefs.length ? (
        <ul>
          {delegation.artifactRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.permissions.noRetainedArtifactRefs}</p>
      )}
      <h3>{copy.permissions.activityFeedLinks}</h3>
      {delegation.activityFeedRefs.length ? (
        <ul>
          {delegation.activityFeedRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.permissions.noLinkedResearchDecisionRefs}</p>
      )}
      <h3>{copy.permissions.auditLog}</h3>
      {delegation.auditItems.length ? (
        <ul>
          {delegation.auditItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.permissions.noAuditEntries}</p>
      )}
    </section>
  );
}
