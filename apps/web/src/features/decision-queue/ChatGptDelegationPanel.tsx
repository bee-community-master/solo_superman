import type {
  ChatGptBrowserDelegationProjection,
  ChatGptBrowserDelegationRun
} from "@solo-superman/contracts";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";
import { formatListWithFallback } from "./text-formatting";

export interface ChatGptDelegationViewModel {
  readonly status: ChatGptBrowserDelegationProjection["currentStatus"] | "not_started";
  readonly summary: string;
  readonly explanation: string;
  readonly visibleHandoffLabel: string;
  readonly nextAction: string;
  readonly dataDisclosureItems: readonly string[];
  readonly policyRiskVerdictLabel: string | null;
  readonly policyRiskEvidenceRefs: readonly string[];
  readonly sessionOwnershipVerdictLabel: string | null;
  readonly sessionOwnershipEvidenceRefs: readonly string[];
  readonly approvalDecisionLabel: string | null;
  readonly browserActionAuthorityLabel: string | null;
  readonly resultImportLabel: string | null;
  readonly resultImportGateItems: readonly string[];
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

type ChatGptDelegationRunStatus = ChatGptBrowserDelegationRun["status"];

export interface ChatGptDelegationViewModelCopy {
  readonly visibleHandoffLabels: Readonly<Record<ChatGptDelegationRunStatus, string>>;
  readonly notStarted: {
    readonly summary: string;
    readonly explanation: string;
    readonly visibleHandoffLabel: string;
    readonly nextAction: string;
    readonly retentionLabel: string;
  };
  readonly dataDisclosure: {
    readonly disclosurePreview: (ref: string) => string;
    readonly promptContextSummary: (ref: string) => string;
    readonly redactedPromptPreview: (ref: string) => string;
    readonly excludedSensitiveFields: (value: string) => string;
    readonly redactionPreviewShown: (value: string) => string;
    readonly userCanEditPromptBeforeRun: (value: string) => string;
    readonly none: string;
    readonly yes: string;
    readonly no: string;
  };
  readonly resultImportGate: {
    readonly notEvaluated: string;
    readonly sourceProvenance: (status: string, refs: string) => string;
    readonly noSourceRefs: string;
    readonly uncertainty: (status: string, refs: string) => string;
    readonly noUncertaintyRefs: string;
    readonly conEvidence: (status: string, refs: string) => string;
    readonly noConEvidenceRefs: string;
    readonly staleRisk: (status: string, refs: string) => string;
    readonly noStaleRiskRefs: string;
    readonly importRationale: (rationale: string) => string;
  };
  readonly artifactControls: {
    readonly exportRetained: string;
    readonly deleteRetained: string;
  };
  readonly missingBrowserActionAuthority: string;
  readonly noResultImport: string;
  readonly retentionWithControls: string;
  readonly retentionUnavailable: string;
}

const DEFAULT_CHATGPT_DELEGATION_VIEW_MODEL_COPY: ChatGptDelegationViewModelCopy = {
  visibleHandoffLabels: {
    waiting_for_approval: "ChatGPT browser work does not start before user approval.",
    running:
      "Only visible local browser work is allowed; Solo Superman does not store accounts, cookies, or 2FA.",
    waiting_for_user: "Login, CAPTCHA, usage limits, or UI changes require direct user action.",
    importing_result: "Imported results must pass provenance, uncertainty, con-evidence, and freshness gates.",
    completed: "Result import is complete, but retained artifacts must remain exportable or deletable by the user.",
    blocked:
      "Use manual prompt handoff or official paths instead of fully headless ChatGPT Pro automation.",
    failed:
      "Use manual prompt handoff or official paths instead of fully headless ChatGPT Pro automation.",
    revoked: "The user revoked this delegation, so browser work cannot continue.",
    pending_preflight: "Record prompt, redaction, policy, and session-ownership preflight checks first."
  },
  notStarted: {
    summary: "External AI workspace has not been prepared.",
    explanation: "No per-run local browser workspace has been recorded for this session.",
    visibleHandoffLabel: "ChatGPT Pro/Deep Research is prepared only as visible delegation in a user-owned browser.",
    nextAction:
      "Plan a research task and prepare a safe browser handoff preview before using an external AI workspace.",
    retentionLabel: "No prompt/result/screenshot/log artifacts are stored yet."
  },
  dataDisclosure: {
    disclosurePreview: (ref: string) => `Disclosure preview: ${ref}`,
    promptContextSummary: (ref: string) => `Prompt context summary: ${ref}`,
    redactedPromptPreview: (ref: string) => `Redacted prompt preview: ${ref}`,
    excludedSensitiveFields: (value: string) => `Excluded sensitive fields: ${value}`,
    redactionPreviewShown: (value: string) => `Redaction preview shown: ${value}`,
    userCanEditPromptBeforeRun: (value: string) => `User can edit prompt before run: ${value}`,
    none: "none",
    yes: "yes",
    no: "no"
  },
  resultImportGate: {
    notEvaluated: "No result import gate has been evaluated yet.",
    sourceProvenance: (status: string, refs: string) => `Source provenance: ${status} (${refs})`,
    noSourceRefs: "no source refs",
    uncertainty: (status: string, refs: string) => `Uncertainty: ${status} (${refs})`,
    noUncertaintyRefs: "no uncertainty refs",
    conEvidence: (status: string, refs: string) => `Counterpoints / risks: ${status} (${refs})`,
    noConEvidenceRefs: "no counterpoint refs",
    staleRisk: (status: string, refs: string) => `Stale risk: ${status} (${refs})`,
    noStaleRiskRefs: "no stale risk refs",
    importRationale: (rationale: string) => `Import rationale: ${rationale}`
  },
  artifactControls: {
    exportRetained: "Export retained prompt/result/screenshot/log artifact refs",
    deleteRetained: "Delete retained artifacts while leaving audit metadata only"
  },
  missingBrowserActionAuthority: "missing browser action authority",
  noResultImport: "No result import has been captured yet.",
  retentionWithControls:
    "Prompt/result/screenshot/log artifacts are retained by default with export/delete controls; deleting artifacts leaves audit metadata only.",
  retentionUnavailable: "Artifact retention controls are unavailable for this run."
};

function artifactRefsForRun(run: ChatGptBrowserDelegationRun) {
  return [
    `prompt:${run.promptPreviewRef}`,
    `redaction:${run.redactionSummary.redactionPreviewRef}`,
    ...run.screenshotRefs.map((ref) => `screenshot:${ref}`),
    ...run.logRefs.map((ref) => `log:${ref}`),
    ...(run.resultImportRef ? [`result:${run.resultImportRef}`] : [])
  ];
}

function verdictLabel(
  verdict: ChatGptBrowserDelegationRun["policyRiskVerdict"] | ChatGptBrowserDelegationRun["sessionOwnershipVerdict"]
) {
  return `${verdict.verdict}: ${verdict.rationale}`;
}

function dataDisclosureItemsForRun(run: ChatGptBrowserDelegationRun, copy: ChatGptDelegationViewModelCopy) {
  const preview = run.dataDisclosurePreview;

  return [
    copy.dataDisclosure.disclosurePreview(preview.disclosurePreviewRef),
    copy.dataDisclosure.promptContextSummary(preview.promptContextSummaryRef),
    copy.dataDisclosure.redactedPromptPreview(preview.redactedPromptPreviewRef),
    copy.dataDisclosure.excludedSensitiveFields(
      formatListWithFallback(preview.excludedSensitiveFieldKinds, copy.dataDisclosure.none)
    ),
    copy.dataDisclosure.redactionPreviewShown(
      preview.redactionPreviewShown ? copy.dataDisclosure.yes : copy.dataDisclosure.no
    ),
    copy.dataDisclosure.userCanEditPromptBeforeRun(
      preview.userCanEditPromptBeforeRun ? copy.dataDisclosure.yes : copy.dataDisclosure.no
    )
  ];
}

function resultImportGateItemsForRun(run: ChatGptBrowserDelegationRun, copy: ChatGptDelegationViewModelCopy) {
  const gate = run.resultImportGate;

  if (!gate) {
    return [copy.resultImportGate.notEvaluated];
  }

  return [
    copy.resultImportGate.sourceProvenance(
      gate.sourceProvenanceStatus,
      formatListWithFallback(gate.sourceRefs, copy.resultImportGate.noSourceRefs)
    ),
    copy.resultImportGate.uncertainty(
      gate.uncertaintyStatus,
      formatListWithFallback(gate.uncertaintyRefs, copy.resultImportGate.noUncertaintyRefs)
    ),
    copy.resultImportGate.conEvidence(
      gate.conEvidenceStatus,
      formatListWithFallback(gate.conEvidenceRefs, copy.resultImportGate.noConEvidenceRefs)
    ),
    copy.resultImportGate.staleRisk(
      gate.staleRiskStatus,
      formatListWithFallback(gate.staleRiskRefs, copy.resultImportGate.noStaleRiskRefs)
    ),
    copy.resultImportGate.importRationale(gate.importRationale)
  ];
}

function visibleHandoffLabelForRun(run: ChatGptBrowserDelegationRun, copy: ChatGptDelegationViewModelCopy) {
  return copy.visibleHandoffLabels[run.status];
}

export function chatGptDelegationViewModel(
  projection: ChatGptBrowserDelegationProjection | null,
  copy: ChatGptDelegationViewModelCopy = DEFAULT_CHATGPT_DELEGATION_VIEW_MODEL_COPY
): ChatGptDelegationViewModel {
  if (!projection) {
    return {
      status: "not_started",
      summary: copy.notStarted.summary,
      explanation: copy.notStarted.explanation,
      visibleHandoffLabel: copy.notStarted.visibleHandoffLabel,
      nextAction: copy.notStarted.nextAction,
      dataDisclosureItems: [],
      policyRiskVerdictLabel: null,
      policyRiskEvidenceRefs: [],
      sessionOwnershipVerdictLabel: null,
      sessionOwnershipEvidenceRefs: [],
      approvalDecisionLabel: null,
      browserActionAuthorityLabel: null,
      resultImportLabel: null,
      resultImportGateItems: [],
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
      retentionLabel: copy.notStarted.retentionLabel
    };
  }

  const run = projection.latestRun;
  const artifactRefs = artifactRefsForRun(run);
  const artifactControlLabels = run.redactionSummary.userExportDeleteControls
    ? [copy.artifactControls.exportRetained, copy.artifactControls.deleteRetained]
    : [];

  return {
    status: projection.currentStatus,
    summary: projection.summary,
    explanation: run.userVisibleExplanation,
    visibleHandoffLabel: visibleHandoffLabelForRun(run, copy),
    nextAction: run.nextAction,
    dataDisclosureItems: dataDisclosureItemsForRun(run, copy),
    policyRiskVerdictLabel: verdictLabel(run.policyRiskVerdict),
    policyRiskEvidenceRefs: run.policyRiskVerdict.evidenceRefs,
    sessionOwnershipVerdictLabel: verdictLabel(run.sessionOwnershipVerdict),
    sessionOwnershipEvidenceRefs: run.sessionOwnershipVerdict.evidenceRefs,
    approvalDecisionLabel: run.approvalDecision,
    browserActionAuthorityLabel: run.browserActionAuthorityRef ?? copy.missingBrowserActionAuthority,
    resultImportLabel: run.resultImportRef ?? copy.noResultImport,
    resultImportGateItems: resultImportGateItemsForRun(run, copy),
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
    retentionLabel: run.redactionSummary.userExportDeleteControls ? copy.retentionWithControls : copy.retentionUnavailable
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
  const hasSafetyDetails = Boolean(
    delegation.dataDisclosureItems.length ||
      delegation.policyRiskVerdictLabel ||
      delegation.sessionOwnershipVerdictLabel ||
      delegation.approvalDecisionLabel ||
      delegation.browserActionAuthorityLabel ||
      delegation.resultImportLabel ||
      delegation.resultImportGateItems.length
  );

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
      {hasSafetyDetails ? (
        <section className="chatgpt-delegation-safety" aria-label={copy.permissions.chatGptDelegationSafety}>
          <h3>{copy.permissions.chatGptDelegationSafety}</h3>
          {delegation.dataDisclosureItems.length ? (
            <>
              <strong>{copy.permissions.dataDisclosurePreview}</strong>
              <ul>
                {delegation.dataDisclosureItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {delegation.policyRiskVerdictLabel ? (
            <div>
              <strong>{copy.permissions.policyRiskVerdict}</strong>
              <p>{delegation.policyRiskVerdictLabel}</p>
              <p>{copy.permissions.evidenceRefs}: {formatListWithFallback(delegation.policyRiskEvidenceRefs, copy.permissions.noEvidenceRefs)}</p>
            </div>
          ) : null}
          {delegation.sessionOwnershipVerdictLabel ? (
            <div>
              <strong>{copy.permissions.sessionOwnershipVerdict}</strong>
              <p>{delegation.sessionOwnershipVerdictLabel}</p>
              <p>{copy.permissions.evidenceRefs}: {formatListWithFallback(delegation.sessionOwnershipEvidenceRefs, copy.permissions.noEvidenceRefs)}</p>
            </div>
          ) : null}
          {delegation.approvalDecisionLabel ? <p>{copy.permissions.approvalDecision}: {delegation.approvalDecisionLabel}</p> : null}
          {delegation.browserActionAuthorityLabel ? (
            <p>{copy.permissions.browserActionAuthority}: {delegation.browserActionAuthorityLabel}</p>
          ) : null}
          {delegation.resultImportLabel ? <p>{copy.permissions.resultImport}: {delegation.resultImportLabel}</p> : null}
          {delegation.resultImportGateItems.length ? (
            <>
              <strong>{copy.permissions.resultImportGate}</strong>
              <ul>
                {delegation.resultImportGateItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
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
              title={copy.permissions.artifactControlTitle}
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
