import { type Dispatch, type SetStateAction, useCallback } from "react";
import type {
  ChatGptBrowserDelegationProjection,
  CommandResponse,
  ConfidenceCompletionProjection,
  DecisionQueueProjection,
  FounderBriefProjection,
  Phase15bUpgradeHintProjection,
  PlanningHandoffProjection,
  ProjectId,
  ServicePageUsePermissionProjection,
  SessionShellProjection
} from "@solo-superman/contracts";
import { requiredCommandProjection } from "../../../shared/api/command-response-helpers";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import { servicePageUsePermissionViewModel } from "../ServicePageUsePermissionPanel";
import { buildPlanningHandoffRequest } from "../phase2-planning-handoff-request";
import {
  COMMAND_LOG_LIMIT,
  displayError,
  latestCommandBackedProjectionVersion,
  type AppendCommand,
  type CommandLogEntry,
  type ProjectionState
} from "./decision-queue-shell-model";
import type { DecisionQueueCopy } from "./decision-queue-copy";

interface DecisionQueuePlanningPermissionActionsProps {
  readonly appendCommand: AppendCommand;
  readonly client: SidecarClient | null;
  readonly copy: DecisionQueueCopy;
  readonly phase15bReadiness: Phase15bUpgradeHintProjection | null;
  readonly projections: ProjectionState;
  readonly refreshChatGptDelegation: (sessionId: SessionShellProjection["sessionId"]) => Promise<void>;
  readonly refreshProjections: (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => Promise<void>;
  readonly refreshServicePageUsePermission: (sessionId: SessionShellProjection["sessionId"]) => Promise<void>;
  readonly setCommandLog: Dispatch<SetStateAction<readonly CommandLogEntry[]>>;
  readonly setIsBusy: Dispatch<SetStateAction<boolean>>;
  readonly setProjections: Dispatch<SetStateAction<ProjectionState>>;
  readonly setWorkflowError: Dispatch<SetStateAction<string | null>>;
}

export function useDecisionQueuePlanningPermissionActions({
  appendCommand,
  client,
  copy,
  phase15bReadiness,
  projections,
  refreshChatGptDelegation,
  refreshProjections,
  refreshServicePageUsePermission,
  setCommandLog,
  setIsBusy,
  setProjections,
  setWorkflowError
}: DecisionQueuePlanningPermissionActionsProps) {
  const { planningActionErrors } = copy.handoff;
  const { permissionActionErrors, permissionActionReasons } = copy.permissions;

  const scoreCompleteness = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(planningActionErrors.activeSessionRequiredScoreCompleteness);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Score completeness",
        await client.scoreCompleteness({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestCommandBackedProjectionVersion(projections)
        })
      );
      const confidence = requiredCommandProjection<ConfidenceCompletionProjection>(
        response,
        "ConfidenceCompletionProjection"
      );
      const maybeQueueProjection = (response as CommandResponse<unknown>).queueProjection;

      setProjections((current) => ({
        ...current,
        confidence,
        queue:
          maybeQueueProjection &&
          typeof maybeQueueProjection === "object" &&
          "kind" in maybeQueueProjection &&
          maybeQueueProjection.kind === "DecisionQueueProjection"
            ? (maybeQueueProjection as DecisionQueueProjection)
            : current.queue
      }));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, planningActionErrors, projections]);

  const prepareFounderBrief = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(planningActionErrors.activeSessionRequiredFounderBrief);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Prepare Founder Brief",
        await client.prepareFounderBriefExport({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestCommandBackedProjectionVersion(projections),
          requestedFormat: "markdown"
        })
      );
      const founderBrief = requiredCommandProjection<FounderBriefProjection>(response, "FounderBriefProjection");

      setProjections((current) => ({
        ...current,
        founderBrief
      }));
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, planningActionErrors, projections]);

  const runPlanningHandoffGate = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(planningActionErrors.activeSessionRequiredPlanningHandoff);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const request = buildPlanningHandoffRequest({
        session: projections.session,
        spec: projections.spec,
        queue: projections.queue,
        research: projections.research,
        confidence: projections.confidence,
        founderBrief: projections.founderBrief,
        phase15bReadiness,
        expectedStateVersion: latestCommandBackedProjectionVersion(projections)
      });
      const response = await appendCommand("Run Planning Handoff gate", await client.createPlanningHandoff(request));
      const planningHandoff = requiredCommandProjection<PlanningHandoffProjection>(response, "PlanningHandoffProjection");

      setProjections((current) => ({
        ...current,
        planningHandoff
      }));
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, phase15bReadiness, planningActionErrors, projections, refreshProjections]);

  const revokeChatGptDelegation = useCallback(
    async (runId: string) => {
      if (!client || !projections.session) {
        setWorkflowError(permissionActionErrors.activeSessionRequiredRevokeWorkspace);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const expectedStateVersion = latestCommandBackedProjectionVersion(projections);
        const response = await appendCommand(
          "Revoke external AI workspace",
          await client.revokeChatGptBrowserDelegationRun({
            sessionId: projections.session.sessionId,
            expectedStateVersion,
            idempotencyKey: `chatgpt-delegation:revoke:${runId}:${expectedStateVersion}`,
            runId,
            reason: permissionActionReasons.revokeWorkspace,
            auditRefs: [`audit:chatgpt-browser-delegation:web-revoke:${runId}`]
          })
        );
        const chatGptDelegation = requiredCommandProjection<ChatGptBrowserDelegationProjection>(
          response,
          "ChatGptBrowserDelegationProjection"
        );

        setProjections((current) => ({
          ...current,
          chatGptDelegation
        }));
        await refreshChatGptDelegation(projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, permissionActionErrors, permissionActionReasons, projections, refreshChatGptDelegation]
  );

  const revokeServicePageUsePermission = useCallback(
    async (permissionId: string) => {
      if (!client || !projections.session) {
        setWorkflowError(permissionActionErrors.activeSessionRequiredRevokeServicePage);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const expectedStateVersion = latestCommandBackedProjectionVersion(projections);
        const response = await appendCommand(
          "Revoke service page-use permission",
          await client.revokeServicePageUsePermission({
            sessionId: projections.session.sessionId,
            expectedStateVersion,
            idempotencyKey: `service-page-permission:revoke:${permissionId}:${expectedStateVersion}`,
            permissionId,
            reason: permissionActionReasons.revokeServicePagePermission,
            auditRefs: [`audit:service-page-use-permission:web-revoke:${permissionId}`]
          })
        );
        const servicePageUsePermission = requiredCommandProjection<ServicePageUsePermissionProjection>(
          response,
          "ServicePageUsePermissionProjection"
        );

        setProjections((current) => ({
          ...current,
          servicePageUsePermission
        }));
        await refreshServicePageUsePermission(projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, permissionActionErrors, permissionActionReasons, projections, refreshServicePageUsePermission]
  );

  const exportServicePageArtifacts = useCallback(
    (permissionId: string) => {
      const projection = projections.servicePageUsePermission;
      const permission = projection?.latestPermission;

      if (!permission || permission.permissionId !== permissionId) {
        setWorkflowError(permissionActionErrors.artifactExportPermissionMismatch);
        return;
      }

      if (typeof document === "undefined" || typeof URL === "undefined") {
        setWorkflowError(permissionActionErrors.artifactExportBrowserRequired);
        return;
      }

      const view = servicePageUsePermissionViewModel(projection);
      const exportedAt = new Date().toISOString();
      const payload = {
        exportedAt,
        permissionId,
        serviceName: permission.serviceName,
        serviceOrigin: permission.serviceOrigin,
        pageUrl: permission.pageUrl,
        purpose: permission.purpose,
        redactionPreviewRef: permission.artifactRetention.redactionPreviewRef,
        artifactRefs: view.artifactRefs,
        auditEvidenceRefs: permission.auditLog.flatMap((entry) => entry.evidenceRefs),
        note: permissionActionReasons.exportArtifactRefsNote
      };
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `service-page-artifact-refs-${permissionId}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setCommandLog((previous) => [
        {
          id: `service-page-permission:export:artifacts:${permissionId}:${Date.now()}`,
          label: "Export service page-use artifact refs",
          createdAt: exportedAt,
          message: permissionActionReasons.exportArtifactRefsLogMessage(view.artifactRefs.length, permissionId)
        },
        ...previous
      ].slice(0, COMMAND_LOG_LIMIT));
    },
    [permissionActionErrors, permissionActionReasons, projections.servicePageUsePermission]
  );

  const deleteServicePageArtifacts = useCallback(
    async (permissionId: string) => {
      if (!client || !projections.session) {
        setWorkflowError(permissionActionErrors.activeSessionRequiredDeleteServicePageArtifacts);
        return;
      }

      const projection = projections.servicePageUsePermission;
      const permission = projection?.latestPermission;

      if (!permission || permission.permissionId !== permissionId) {
        setWorkflowError(permissionActionErrors.artifactDeletePermissionMismatch);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const expectedStateVersion = latestCommandBackedProjectionVersion(projections);
        const response = await appendCommand(
          "Delete service page-use artifact refs",
          await client.deleteServicePageUsePermissionArtifacts({
            sessionId: projections.session.sessionId,
            expectedStateVersion,
            idempotencyKey: `service-page-permission:delete-artifacts:${permissionId}:${expectedStateVersion}`,
            permissionId,
            reason: permissionActionReasons.deleteServicePageArtifacts,
            auditRefs: [`audit:service-page-use-permission:web-delete-artifacts:${permissionId}`]
          })
        );
        const servicePageUsePermission = requiredCommandProjection<ServicePageUsePermissionProjection>(
          response,
          "ServicePageUsePermissionProjection"
        );

        setProjections((current) => ({
          ...current,
          servicePageUsePermission
        }));
        await refreshServicePageUsePermission(projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, permissionActionErrors, permissionActionReasons, projections, refreshServicePageUsePermission]
  );


  return {
    scoreCompleteness,
    prepareFounderBrief,
    runPlanningHandoffGate,
    revokeChatGptDelegation,
    revokeServicePageUsePermission,
    exportServicePageArtifacts,
    deleteServicePageArtifacts
  };
}
