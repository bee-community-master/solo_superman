import { ChatGptDelegationPanel } from "../ChatGptDelegationPanel";
import { ServicePageUsePermissionPanel } from "../ServicePageUsePermissionPanel";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface PermissionsViewProps {
  readonly controller: DecisionQueueShellController;
}

export function PermissionsView({ controller }: PermissionsViewProps) {
  const {
    chatGptDelegationView,
    deleteServicePageArtifacts,
    exportServicePageArtifacts,
    isBusy,
    projections,
    refreshChatGptDelegation,
    refreshServicePageUsePermission,
    revokeChatGptDelegation,
    revokeServicePageUsePermission,
    servicePageUsePermissionView
  } = controller;

  return (
    <div className="view-grid permissions-view">
      <ChatGptDelegationPanel
        delegation={chatGptDelegationView}
        isBusy={isBusy}
        onRefreshDelegation={() => {
          if (projections.session) {
            void refreshChatGptDelegation(projections.session.sessionId);
          }
        }}
        onRevokeDelegation={(runId) => void revokeChatGptDelegation(runId)}
      />

      <ServicePageUsePermissionPanel
        permission={servicePageUsePermissionView}
        isBusy={isBusy}
        onRefreshPermission={() => {
          if (projections.session) {
            void refreshServicePageUsePermission(projections.session.sessionId);
          }
        }}
        onRevokePermission={(permissionId) => void revokeServicePageUsePermission(permissionId)}
        onExportArtifacts={(permissionId) => exportServicePageArtifacts(permissionId)}
        onDeleteArtifacts={(permissionId) => void deleteServicePageArtifacts(permissionId)}
      />
    </div>
  );
}
