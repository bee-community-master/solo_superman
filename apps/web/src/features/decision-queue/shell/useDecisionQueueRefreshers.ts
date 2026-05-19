import { type Dispatch, type SetStateAction, useCallback } from "react";
import type {
  DecisionQueueProjection,
  Phase15bUpgradeHintProjection,
  ProjectId,
  SessionShellProjection
} from "@solo-superman/contracts";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { shouldRefetchQueueForSseNotification } from "../decision-queue-view-model";
import type { ProjectionState } from "./decision-queue-shell-model";

interface DecisionQueueRefreshersProps {
  readonly client: SidecarClient | null;
  readonly setPhase15bReadiness: Dispatch<SetStateAction<Phase15bUpgradeHintProjection | null>>;
  readonly setProjections: Dispatch<SetStateAction<ProjectionState>>;
  readonly setResearchOperations: Dispatch<SetStateAction<ResearchOperationsState>>;
}

export function useDecisionQueueRefreshers({
  client,
  setPhase15bReadiness,
  setProjections,
  setResearchOperations
}: DecisionQueueRefreshersProps) {
  const refreshResearchOperations = useCallback(
    async (projectId: ProjectId) => {
      if (!client) {
        return;
      }

      const [allowlists, disclosures, runs] = await Promise.all([
        client.listResearchAllowlists(projectId),
        client.listResearchDisclosures(projectId),
        client.listResearchRuns(projectId)
      ]);

      setResearchOperations({
        allowlists,
        disclosures,
        runs
      });
    },
    [client, setResearchOperations]
  );

  const refreshPhase15bReadiness = useCallback(
    async (projectId: ProjectId) => {
      if (!client) {
        return;
      }

      setPhase15bReadiness(await client.listPhase15bUpgradeHints(projectId));
    },
    [client, setPhase15bReadiness]
  );

  const refreshPlanningHandoff = useCallback(
    async (sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const planningHandoff = await client.getPlanningHandoff(sessionId);

      setProjections((current) => ({
        ...current,
        planningHandoff
      }));
    },
    [client, setProjections]
  );

  const refreshChatGptDelegation = useCallback(
    async (sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const chatGptDelegation = await client.getChatGptBrowserDelegation(sessionId);

      setProjections((current) => ({
        ...current,
        chatGptDelegation
      }));
    },
    [client, setProjections]
  );

  const refreshServicePageUsePermission = useCallback(
    async (sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const servicePageUsePermission = await client.getServicePageUsePermission(sessionId);

      setProjections((current) => ({
        ...current,
        servicePageUsePermission
      }));
    },
    [client, setProjections]
  );

  const refreshImplementationStepLedger = useCallback(
    async (sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const implementationStepLedger = await client.getImplementationStepLedger(sessionId);

      setProjections((current) => ({
        ...current,
        implementationStepLedger
      }));
    },
    [client, setProjections]
  );

  const refreshAutoImplementationRuns = useCallback(
    async (sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const autoImplementationRuns = await client.getAutoImplementationRuns(sessionId);

      setProjections((current) => ({
        ...current,
        autoImplementationRuns
      }));
    },
    [client, setProjections]
  );

  const refreshProjections = useCallback(
    async (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => {
      if (!client) {
        return;
      }

      const [
        session,
        spec,
        queue,
        research,
        activity,
        confidence,
        founderBrief,
        planningHandoff,
        chatGptDelegation,
        servicePageUsePermission,
        implementationStepLedger,
        autoImplementationRuns
      ] = await Promise.all([
        client.getSession(projectId, sessionId),
        client.getSpec(sessionId),
        client.getQueue(sessionId),
        client.getResearch(sessionId),
        client.getActivity(sessionId),
        client.getCompleteness(sessionId),
        client.getFounderBrief(sessionId).catch(() => null),
        client.getPlanningHandoff(sessionId),
        client.getChatGptBrowserDelegation(sessionId),
        client.getServicePageUsePermission(sessionId),
        client.getImplementationStepLedger(sessionId),
        client.getAutoImplementationRuns(sessionId)
      ]);

      setProjections({
        session,
        spec,
        queue,
        research,
        activity,
        confidence,
        founderBrief,
        planningHandoff,
        chatGptDelegation,
        servicePageUsePermission,
        implementationStepLedger,
        autoImplementationRuns
      });
      await Promise.all([refreshResearchOperations(projectId), refreshPhase15bReadiness(projectId)]);
    },
    [client, refreshPhase15bReadiness, refreshResearchOperations, setProjections]
  );

  const refetchQueueAfterSseNotification = useCallback(
    async (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"], currentQueue: DecisionQueueProjection | null) => {
      if (!client) {
        return;
      }

      try {
        const notifications = await client.readSessionEventStreamSnapshot(sessionId);
        const queueNeedsCanonicalRefetch = notifications.some((notification) =>
          shouldRefetchQueueForSseNotification(notification, currentQueue)
        );

        if (queueNeedsCanonicalRefetch) {
          await refreshProjections(projectId, sessionId);
        }
      } catch {
        // SSE snapshots are best-effort refetch hints; the command-driven refresh above remains canonical.
      }
    },
    [client, refreshProjections]
  );

  return {
    refreshResearchOperations,
    refreshPhase15bReadiness,
    refreshPlanningHandoff,
    refreshChatGptDelegation,
    refreshServicePageUsePermission,
    refreshImplementationStepLedger,
    refreshAutoImplementationRuns,
    refreshProjections,
    refetchQueueAfterSseNotification
  };
}
