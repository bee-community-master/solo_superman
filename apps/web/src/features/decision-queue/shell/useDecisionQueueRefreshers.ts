import { type Dispatch, type SetStateAction, useCallback } from "react";
import type {
  DecisionQueueProjection,
  Phase15bUpgradeHintProjection,
  ProjectId,
  ResearchAllowlistGovernanceProjection,
  ResearchDisclosureLogProjection,
  ResearchRunControlProjection,
  SessionShellProjection
} from "@solo-superman/contracts";
import { type SidecarClient } from "../../../shared/api/sidecar-client";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { shouldRefetchQueueForSseNotification } from "../decision-queue-view-model";
import type { ProjectionState } from "./decision-queue-shell-model";

interface DecisionQueueRefreshersProps {
  readonly client: SidecarClient | null;
  readonly setPhase15bReadiness: Dispatch<SetStateAction<Phase15bUpgradeHintProjection | null>>;
  readonly setProjections: Dispatch<SetStateAction<ProjectionState>>;
  readonly setResearchOperations: Dispatch<SetStateAction<ResearchOperationsState>>;
}

export interface RefreshableDecisionQueueClient {
  getSession(projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getSpec(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getQueue(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getResearch(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getActivity(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getCompleteness(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getPlanningHandoff(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getChatGptBrowserDelegation(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getServicePageUsePermission(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getImplementationStepLedger(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
  getAutoImplementationRuns(sessionId: SessionShellProjection["sessionId"]): Promise<unknown>;
}

export interface ResearchOperationsRefreshClient {
  listResearchAllowlists(projectId: ProjectId): Promise<ResearchAllowlistGovernanceProjection>;
  listResearchDisclosures(projectId: ProjectId): Promise<ResearchDisclosureLogProjection>;
  listResearchRuns(projectId: ProjectId): Promise<ResearchRunControlProjection>;
}

type LoadedRefreshableDecisionQueueProjections<TClient extends RefreshableDecisionQueueClient> = {
  readonly session: Awaited<ReturnType<TClient["getSession"]>>;
  readonly spec: Awaited<ReturnType<TClient["getSpec"]>>;
  readonly queue: Awaited<ReturnType<TClient["getQueue"]>>;
  readonly research: Awaited<ReturnType<TClient["getResearch"]>>;
  readonly activity: Awaited<ReturnType<TClient["getActivity"]>>;
  readonly confidence: Awaited<ReturnType<TClient["getCompleteness"]>>;
  readonly planningHandoff: Awaited<ReturnType<TClient["getPlanningHandoff"]>>;
  readonly chatGptDelegation: Awaited<ReturnType<TClient["getChatGptBrowserDelegation"]>>;
  readonly servicePageUsePermission: Awaited<ReturnType<TClient["getServicePageUsePermission"]>>;
  readonly implementationStepLedger: Awaited<ReturnType<TClient["getImplementationStepLedger"]>>;
  readonly autoImplementationRuns: Awaited<ReturnType<TClient["getAutoImplementationRuns"]>>;
};

export async function loadResearchOperations(
  client: ResearchOperationsRefreshClient,
  projectId: ProjectId
): Promise<ResearchOperationsState> {
  const [allowlists, disclosures, runs] = await Promise.all([
    client.listResearchAllowlists(projectId),
    client.listResearchDisclosures(projectId),
    client.listResearchRuns(projectId)
  ]);

  return {
    allowlists,
    disclosures,
    runs
  };
}

export function loadRefreshableDecisionQueueProjections(
  client: SidecarClient,
  projectId: ProjectId,
  sessionId: SessionShellProjection["sessionId"]
): Promise<Omit<ProjectionState, "founderBrief">>;
export function loadRefreshableDecisionQueueProjections<TClient extends RefreshableDecisionQueueClient>(
  client: TClient,
  projectId: ProjectId,
  sessionId: SessionShellProjection["sessionId"]
): Promise<LoadedRefreshableDecisionQueueProjections<TClient>>;
export async function loadRefreshableDecisionQueueProjections(
  client: RefreshableDecisionQueueClient,
  projectId: ProjectId,
  sessionId: SessionShellProjection["sessionId"]
): Promise<LoadedRefreshableDecisionQueueProjections<RefreshableDecisionQueueClient>> {
  const [
    session,
    spec,
    queue,
    research,
    activity,
    confidence,
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
    client.getPlanningHandoff(sessionId),
    client.getChatGptBrowserDelegation(sessionId),
    client.getServicePageUsePermission(sessionId),
    client.getImplementationStepLedger(sessionId),
    client.getAutoImplementationRuns(sessionId)
  ]);

  return {
    session,
    spec,
    queue,
    research,
    activity,
    confidence,
    planningHandoff,
    chatGptDelegation,
    servicePageUsePermission,
    implementationStepLedger,
    autoImplementationRuns
  };
}

export function loadResearchSettledDecisionQueueRefresh(
  client: SidecarClient,
  projectId: ProjectId,
  sessionId: SessionShellProjection["sessionId"]
): Promise<{
  readonly projections: Omit<ProjectionState, "founderBrief">;
  readonly researchOperations: ResearchOperationsState;
}>;
export function loadResearchSettledDecisionQueueRefresh<
  TClient extends RefreshableDecisionQueueClient & ResearchOperationsRefreshClient
>(
  client: TClient,
  projectId: ProjectId,
  sessionId: SessionShellProjection["sessionId"]
): Promise<{
  readonly projections: LoadedRefreshableDecisionQueueProjections<TClient>;
  readonly researchOperations: ResearchOperationsState;
}>;
export async function loadResearchSettledDecisionQueueRefresh(
  client: RefreshableDecisionQueueClient & ResearchOperationsRefreshClient,
  projectId: ProjectId,
  sessionId: SessionShellProjection["sessionId"]
) {
  const researchOperations = await loadResearchOperations(client, projectId);
  const projections = await loadRefreshableDecisionQueueProjections(client, projectId, sessionId);

  return {
    projections,
    researchOperations
  };
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

      setResearchOperations(await loadResearchOperations(client, projectId));
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

      const { projections: refreshed, researchOperations } = await loadResearchSettledDecisionQueueRefresh(
        client,
        projectId,
        sessionId
      );

      setResearchOperations(researchOperations);
      setProjections((current) => ({
        ...current,
        ...refreshed
      }));
      await refreshPhase15bReadiness(projectId);
    },
    [client, refreshPhase15bReadiness, setProjections, setResearchOperations]
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
