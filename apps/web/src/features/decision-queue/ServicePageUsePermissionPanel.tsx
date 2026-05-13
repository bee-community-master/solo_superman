import type {
  ServicePageUsePermissionProjection,
  ServicePageUsePermissionRecord
} from "@solo-superman/contracts";

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
  readonly artifactControlLabels: readonly string[];
  readonly auditItems: readonly string[];
  readonly activityFeedRefs: readonly string[];
  readonly blockReasonItems: readonly string[];
}

function commaList(values: readonly string[]) {
  return values.length ? values.join(", ") : "none";
}

function artifactRefsForPermission(permission: ServicePageUsePermissionRecord) {
  return [
    `prompt:${permission.promptPreviewRef}`,
    `redaction:${permission.artifactRetention.redactionPreviewRef}`,
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
      finalSubmitBoundaryLabel: "Final submit requires a separate confirmation card and ExecutionAuthorityRecord.",
      explanation: "Create a purpose-limited service page-use permission before using an external service page.",
      nextAction: "Show service origin, purpose, data categories, allowed/blocked actions, and redaction preview.",
      canRevoke: false,
      permissionId: null,
      artifactRefs: [],
      redactionPreviewRef: null,
      artifactControlLabels: [],
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
    allowedActionsLabel: commaList(permission.allowedActionClasses),
    blockedActionsLabel: commaList(permission.blockedActionClasses),
    dataCategoriesLabel: commaList(permission.dataCategories),
    approvalGranularityLabel: permission.approvalGranularity,
    approvalLabel: `${permission.approvalDecision} via ${permission.userApprovalRef}`,
    loginBoundaryLabel: permission.credentialEntryDelegated
      ? "Credential entry is delegated — blocked by contract."
      : "User logs in directly; credentials, cookies, sessions, 2FA, API keys, and secrets are never stored.",
    finalSubmitBoundaryLabel: permission.finalSubmitBoundary.requested
      ? `Final submit requested with confirmation=${permission.finalSubmitBoundary.confirmationCardRef ?? "missing"} and authority=${permission.finalSubmitBoundary.executionAuthorityRef ?? "missing"}; production mutation performed=${permission.finalSubmitBoundary.productionMutationPerformed}.`
      : "Fill-draft/preview and final submit stay separate; final submit requires confirmation + ExecutionAuthorityRecord.",
    explanation: permission.userVisibleExplanation,
    nextAction: permission.nextAction,
    canRevoke: permission.canRevoke,
    permissionId: permission.permissionId,
    artifactRefs: artifactRefsForPermission(permission),
    redactionPreviewRef: permission.artifactRetention.redactionPreviewRef,
    artifactControlLabels: permission.artifactRetention.userExportDeleteControls
      ? [
          "Export retained prompt/result/screenshot/log artifact refs",
          "Delete retained artifacts while leaving audit metadata only"
        ]
      : [],
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
}

export function ServicePageUsePermissionPanel({
  permission,
  isBusy,
  onRefreshPermission,
  onRevokePermission
}: ServicePageUsePermissionPanelProps) {
  const revokablePermissionId = permission.canRevoke ? permission.permissionId : null;

  return (
    <section className="panel service-page-use-permission-panel">
      <div className="panel-heading">
        <h2>Service login permission</h2>
        <span>{permission.status}</span>
      </div>
      <p>{permission.summary}</p>
      <p className="research-recovery">{permission.explanation}</p>
      <p className="mode-summary">Next action: {permission.nextAction}</p>
      <div className="card-actions panel-actions">
        <button type="button" disabled={isBusy} onClick={onRefreshPermission}>
          Refresh service permission
        </button>
        {revokablePermissionId ? (
          <button type="button" disabled={isBusy} onClick={() => onRevokePermission(revokablePermissionId)}>
            Revoke service permission
          </button>
        ) : null}
      </div>

      <h3>Permission preview</h3>
      <ul>
        <li>Service: {permission.serviceLabel}</li>
        <li>Page URL: {permission.pageUrl}</li>
        <li>Purpose: {permission.purpose}</li>
        <li>Allowed actions: {permission.allowedActionsLabel}</li>
        <li>Blocked actions: {permission.blockedActionsLabel}</li>
        <li>Visible data categories: {permission.dataCategoriesLabel}</li>
        <li>Approval granularity: {permission.approvalGranularityLabel}</li>
        <li>User approval: {permission.approvalLabel}</li>
        <li>Login boundary: {permission.loginBoundaryLabel}</li>
        <li>Final submit boundary: {permission.finalSubmitBoundaryLabel}</li>
      </ul>

      <h3>Stored artifacts</h3>
      {permission.redactionPreviewRef ? (
        <p className="mode-summary">Redaction preview: {permission.redactionPreviewRef}</p>
      ) : null}
      {permission.artifactControlLabels.length ? (
        <div className="card-actions panel-actions">
          {permission.artifactControlLabels.map((label) => (
            <button
              type="button"
              disabled
              title="This PR exposes the artifact control surface and retained refs; artifact content export/delete execution is separate from permission revoke."
              key={label}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {permission.artifactRefs.length ? (
        <ul>
          {permission.artifactRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No retained artifact refs.</p>
      )}

      {permission.blockReasonItems.length ? (
        <>
          <h3>Blocked reasons</h3>
          <ul>
            {permission.blockReasonItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Activity feed links</h3>
      {permission.activityFeedRefs.length ? (
        <ul>
          {permission.activityFeedRefs.map((ref) => (
            <li key={ref}>{ref}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No linked setup-step/decision refs.</p>
      )}

      <h3>Audit log</h3>
      {permission.auditItems.length ? (
        <ul>
          {permission.auditItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No service permission audit entries yet.</p>
      )}
    </section>
  );
}
