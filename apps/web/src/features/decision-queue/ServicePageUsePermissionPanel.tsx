import {
  SERVICE_PAGE_FINAL_SUBMIT_BLOCKED_CONTRACT_LABEL,
  type ServicePageUsePermissionProjection,
  type ServicePageUsePermissionRecord
} from "@solo-superman/contracts";
import { useDecisionQueueCopy } from "./shell/decision-queue-copy";
import { formatListWithFallback } from "./text-formatting";

export interface ServicePageUsePermissionViewModel {
  readonly status: string;
  readonly summary: string;
  readonly serviceLabel: string;
  readonly pageUrl: string;
  readonly purpose: string;
  readonly allowedActionsLabel: string;
  readonly blockedActionsLabel: string;
  readonly dataCategoriesLabel: string;
  readonly approvalGranularityLabel: string;
  readonly approvalLabel: string;
  readonly loginBoundaryLabel: string;
  readonly finalSubmitBoundaryLabel: string;
  readonly explanation: string;
  readonly nextAction: string;
  readonly canRevoke: boolean;
  readonly permissionId: string | null;
  readonly artifactRefs: readonly string[];
  readonly redactionPreviewRef: string | null;
  readonly exportControlLabel: string | null;
  readonly deleteControlLabel: string | null;
  readonly auditItems: readonly string[];
  readonly activityFeedRefs: readonly string[];
  readonly blockReasonItems: readonly string[];
}

function formatFinalSubmitBoundaryLabel(permission: ServicePageUsePermissionRecord) {
  if (!permission.finalSubmitBoundary.requested) {
    return `Fill-draft/preview and final submit stay separate; ${SERVICE_PAGE_FINAL_SUBMIT_BLOCKED_CONTRACT_LABEL}`;
  }

  const confirmationCardRef = permission.finalSubmitBoundary.confirmationCardRef ?? "missing";
  const executionAuthorityRef = permission.finalSubmitBoundary.executionAuthorityRef ?? "missing";

  return [
    `Final submit requested with confirmation=${confirmationCardRef} and authority=${executionAuthorityRef}.`,
    SERVICE_PAGE_FINAL_SUBMIT_BLOCKED_CONTRACT_LABEL,
    `production mutation performed=${permission.finalSubmitBoundary.productionMutationPerformed}.`
  ].join(" ");
}

function artifactRefsForPermission(permission: ServicePageUsePermissionRecord) {
  if (permission.artifactRetention.promptResultScreenshotLogRetention === "deleted_audit_metadata_only") {
    return [];
  }

  return [
    ...(permission.promptPreviewRef ? [`prompt:${permission.promptPreviewRef}`] : []),
    ...(permission.artifactRetention.redactionPreviewRef
      ? [`redaction:${permission.artifactRetention.redactionPreviewRef}`]
      : []),
    ...permission.screenshotRefs.map((ref) => `screenshot:${ref}`),
    ...permission.logRefs.map((ref) => `log:${ref}`)
  ];
}

export function servicePageUsePermissionViewModel(
  projection: ServicePageUsePermissionProjection | null
): ServicePageUsePermissionViewModel {
  if (!projection) {
    return {
      status: "not_started",
      summary: "Service page-use permission has not been granted.",
      serviceLabel: "No service selected",
      pageUrl: "No page URL has been previewed.",
      purpose: "No purpose has been previewed for an external service page.",
      allowedActionsLabel: "none",
      blockedActionsLabel: "credential/session/secret custody and sensitive production submits stay blocked",
      dataCategoriesLabel: "none",
      approvalGranularityLabel: "not set",
      approvalLabel: "No user approval ref has been recorded.",
      loginBoundaryLabel: "User-owned login is required before any page-use permission.",
      finalSubmitBoundaryLabel: SERVICE_PAGE_FINAL_SUBMIT_BLOCKED_CONTRACT_LABEL,
      explanation: "Create a purpose-limited service page-use permission before using an external service page.",
      nextAction: "Show service origin, purpose, data categories, allowed/blocked actions, and redaction preview.",
      canRevoke: false,
      permissionId: null,
      artifactRefs: [],
      redactionPreviewRef: null,
      exportControlLabel: null,
      deleteControlLabel: null,
      auditItems: [],
      activityFeedRefs: [],
      blockReasonItems: []
    };
  }

  const permission = projection.latestPermission;

  return {
    status: projection.currentStatus,
    summary: projection.summary,
    serviceLabel: `${permission.serviceName} (${permission.serviceOrigin})`,
    pageUrl: permission.pageUrl,
    purpose: permission.purpose,
    allowedActionsLabel: formatListWithFallback(permission.allowedActionClasses, "none"),
    blockedActionsLabel: formatListWithFallback(permission.blockedActionClasses, "none"),
    dataCategoriesLabel: formatListWithFallback(permission.dataCategories, "none"),
    approvalGranularityLabel: permission.approvalGranularity,
    approvalLabel: `${permission.approvalDecision} via ${permission.userApprovalRef}`,
    loginBoundaryLabel: permission.credentialEntryDelegated
      ? "Credential entry is delegated — blocked by contract."
      : "User logs in directly; credentials, cookies, sessions, 2FA, API keys, and secrets are never stored.",
    finalSubmitBoundaryLabel: formatFinalSubmitBoundaryLabel(permission),
    explanation: permission.userVisibleExplanation,
    nextAction: permission.nextAction,
    canRevoke: permission.canRevoke,
    permissionId: permission.permissionId,
    artifactRefs: artifactRefsForPermission(permission),
    redactionPreviewRef: permission.artifactRetention.redactionPreviewRef,
    exportControlLabel: permission.artifactRetention.userExportDeleteControls &&
      permission.artifactRetention.promptResultScreenshotLogRetention === "default_evidence_refs_only"
      ? "Export retained prompt/result/screenshot/log artifact refs"
      : null,
    deleteControlLabel: permission.artifactRetention.userExportDeleteControls &&
      permission.artifactRetention.promptResultScreenshotLogRetention === "default_evidence_refs_only"
      ? "Delete retained artifacts while leaving audit metadata only"
      : null,
    auditItems: permission.auditLog.map((entry) => `${entry.eventType}: ${entry.label}`),
    activityFeedRefs: permission.activityFeedRefs,
    blockReasonItems: permission.blockReasons.map((reason) => `${reason.code}: ${reason.message}`)
  };
}

interface ServicePageUsePermissionPanelProps {
  readonly permission: ServicePageUsePermissionViewModel;
  readonly isBusy: boolean;
  readonly onRefreshPermission: () => void;
  readonly onRevokePermission: (permissionId: string) => void;
  readonly onExportArtifacts: (permissionId: string) => void;
  readonly onDeleteArtifacts: (permissionId: string) => void;
}

export function ServicePageUsePermissionPanel({
  permission,
  isBusy,
  onRefreshPermission,
  onRevokePermission,
  onExportArtifacts,
  onDeleteArtifacts
}: ServicePageUsePermissionPanelProps) {
  const copy = useDecisionQueueCopy();
  const revokablePermissionId = permission.canRevoke ? permission.permissionId : null;
  const artifactControlPermissionId = permission.permissionId;

  return (
    <section className="panel service-page-use-permission-panel">
      <div className="panel-heading">
        <h2>{copy.permissions.serviceLoginPermission}</h2>
        <span>{permission.status}</span>
      </div>
      <p>{permission.summary}</p>
      <p className="research-recovery">{permission.explanation}</p>
      <p className="mode-summary">{copy.permissions.nextAction}: {permission.nextAction}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy} onClick={onRefreshPermission}>
          {copy.permissions.refreshServicePermission}
        </button>
        {revokablePermissionId ? (
          <button type="button" disabled={isBusy} onClick={() => onRevokePermission(revokablePermissionId)}>
            {copy.permissions.revokeServicePermission}
          </button>
        ) : null}
      </div>

      <h3>{copy.permissions.permissionPreview}</h3>
      <ul>
        <li>{copy.permissions.service}: {permission.serviceLabel}</li>
        <li>{copy.permissions.pageUrl}: {permission.pageUrl}</li>
        <li>{copy.permissions.purpose}: {permission.purpose}</li>
        <li>{copy.permissions.allowedActions}: {permission.allowedActionsLabel}</li>
        <li>{copy.permissions.blockedActions}: {permission.blockedActionsLabel}</li>
        <li>{copy.permissions.visibleDataCategories}: {permission.dataCategoriesLabel}</li>
        <li>{copy.permissions.approvalGranularity}: {permission.approvalGranularityLabel}</li>
        <li>{copy.permissions.userApproval}: {permission.approvalLabel}</li>
        <li>{copy.permissions.loginBoundary}: {permission.loginBoundaryLabel}</li>
        <li>{copy.permissions.finalSubmitBoundary}: {permission.finalSubmitBoundaryLabel}</li>
      </ul>

      <h3>{copy.permissions.storedArtifacts}</h3>
      {permission.redactionPreviewRef ? (
        <p className="mode-summary">{copy.permissions.redactionPreview}: {permission.redactionPreviewRef}</p>
      ) : null}
      {artifactControlPermissionId && (permission.exportControlLabel || permission.deleteControlLabel) ? (
        <div className="card-actions panel-actions">
          {permission.exportControlLabel ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onExportArtifacts(artifactControlPermissionId)}
            >
              {permission.exportControlLabel}
            </button>
          ) : null}
          {permission.deleteControlLabel ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onDeleteArtifacts(artifactControlPermissionId)}
            >
              {permission.deleteControlLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {permission.artifactRefs.length ? (
        <ul>
          {permission.artifactRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.permissions.noRetainedArtifactRefs}</p>
      )}

      {permission.blockReasonItems.length ? (
        <>
          <h3>{copy.permissions.blockedReasons}</h3>
          <ul>
            {permission.blockReasonItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>{copy.permissions.activityFeedLinks}</h3>
      {permission.activityFeedRefs.length ? (
        <ul>
          {permission.activityFeedRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.permissions.noLinkedSetupDecisionRefs}</p>
      )}

      <h3>{copy.permissions.auditLog}</h3>
      {permission.auditItems.length ? (
        <ul>
          {permission.auditItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{copy.permissions.noServicePermissionAuditEntries}</p>
      )}
    </section>
  );
}
