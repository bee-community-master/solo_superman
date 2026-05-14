import { type Dispatch, type SetStateAction, useCallback } from "react";
import type {
  ProjectId,
  QueueItemId,
  ResearchAllowlistGovernanceProjection,
  ResearchAllowlistId,
  ResearchEvidenceProjection,
  ResearchRunId,
  ResearchTaskId,
  SessionShellProjection
} from "@solo-superman/contracts";
import { requiredCommandProjection } from "../../../shared/api/command-response-helpers";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { buildWebResearchRunRequest, WEB_PUBLIC_SEARCH_CONNECTOR_ID } from "../phase15a-research-run-request";
import {
  displayError,
  latestProjectionVersion,
  researchRunProjectionFromResponse,
  WEB_PUBLIC_SAFE_ALLOWLIST_ID,
  type AppendCommand,
  type ProjectionState
} from "./decision-queue-shell-model";

interface DecisionQueueResearchActionsProps {
  readonly appendCommand: AppendCommand;
  readonly client: SidecarClient | null;
  readonly projections: ProjectionState;
  readonly refreshProjections: (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => Promise<void>;
  readonly refreshResearchOperations: (projectId: ProjectId) => Promise<void>;
  readonly researchOperations: ResearchOperationsState;
  readonly setIsBusy: Dispatch<SetStateAction<boolean>>;
  readonly setProjections: Dispatch<SetStateAction<ProjectionState>>;
  readonly setResearchOperations: Dispatch<SetStateAction<ResearchOperationsState>>;
  readonly setWorkflowError: Dispatch<SetStateAction<string | null>>;
}

export function useDecisionQueueResearchActions({
  appendCommand,
  client,
  projections,
  refreshProjections,
  refreshResearchOperations,
  researchOperations,
  setIsBusy,
  setProjections,
  setResearchOperations,
  setWorkflowError
}: DecisionQueueResearchActionsProps) {
  const createOrReactivateAllowlist = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active project is required before changing research allowlists.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const projectId = projections.session.projectId;
      const reusableAllowlist = researchOperations.allowlists?.allowlists.find(
        (allowlist) => allowlist.status !== "revoked"
      );
      const defaultAllowlistIdExists =
        researchOperations.allowlists?.allowlists.some(
          (allowlist) => allowlist.allowlistId === WEB_PUBLIC_SAFE_ALLOWLIST_ID
        ) ?? false;
      const policy = {
        connectorIds: [WEB_PUBLIC_SEARCH_CONNECTOR_ID],
        sourceCategories: ["public_web" as const],
        approvedBy: "web_ui_founder"
      };
      const response = await appendCommand(
        reusableAllowlist ? "Reactivate research allowlist" : "Create research allowlist",
        reusableAllowlist
          ? await client.updateResearchAllowlist(projectId, reusableAllowlist.allowlistId, {
              ...policy,
              status: "active"
            })
          : await client.createResearchAllowlist(projectId, {
              ...policy,
              ...(defaultAllowlistIdExists ? {} : { allowlistId: WEB_PUBLIC_SAFE_ALLOWLIST_ID })
            })
      );
      const allowlists = requiredCommandProjection<ResearchAllowlistGovernanceProjection>(
        response,
        "ResearchAllowlistGovernanceProjection"
      );

      setResearchOperations((current) => ({
        ...current,
        allowlists
      }));
      await refreshResearchOperations(projectId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections.session, refreshResearchOperations, researchOperations.allowlists]);

  const pauseAllowlist = useCallback(
    async (allowlistId: ResearchAllowlistId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before pausing a research allowlist.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Pause research allowlist",
          await client.pauseResearchAllowlist(
            projections.session.projectId,
            allowlistId,
            "Paused from the Phase 1.5A operations screen."
          )
        );
        const allowlists = requiredCommandProjection<ResearchAllowlistGovernanceProjection>(
          response,
          "ResearchAllowlistGovernanceProjection"
        );

        setResearchOperations((current) => ({
          ...current,
          allowlists
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const revokeAllowlist = useCallback(
    async (allowlistId: ResearchAllowlistId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before revoking a research allowlist.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Revoke research allowlist",
          await client.revokeResearchAllowlist(
            projections.session.projectId,
            allowlistId,
            "Revoked from the Phase 1.5A operations screen."
          )
        );
        const allowlists = requiredCommandProjection<ResearchAllowlistGovernanceProjection>(
          response,
          "ResearchAllowlistGovernanceProjection"
        );

        setResearchOperations((current) => ({
          ...current,
          allowlists
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const planPhase15aResearchTask = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before planning Phase 1.5A research.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Plan Phase 1.5A research task",
        await client.planResearch({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestProjectionVersion(projections),
          objective: "Validate public onboarding evidence and quality-gate readiness for Phase 1.5A.",
          sourceQueueItemId: "phase15a_operations_acceptance" as QueueItemId,
          routeOutcome: "research_needed",
          impact: "high"
        })
      );
      const research = requiredCommandProjection<ResearchEvidenceProjection>(response, "ResearchEvidenceProjection");

      setProjections((current) => ({
        ...current,
        research
      }));
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections, refreshProjections]);

  const startReadOnlyResearchRun = useCallback(async (researchTaskId: ResearchTaskId) => {
    if (!client || !projections.session) {
      setWorkflowError("An active project is required before starting a research run.");
      return;
    }

    const task = projections.research?.tasks.find((item) => item.researchTaskId === researchTaskId);
    const allowlist = researchOperations.allowlists?.allowlists.find((item) => item.status === "active");

    if (!task) {
      setWorkflowError("Select a planned research task before starting a read-only research run.");
      return;
    }

    if (!allowlist) {
      setWorkflowError("Create or reactivate an active public-safe allowlist before starting a research run.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Start read-only research run",
        await client.startResearchRun(
          projections.session.projectId,
          buildWebResearchRunRequest({
            allowlist,
            specTitle: projections.spec?.title,
            task
          })
        )
      );

      setResearchOperations((current) => ({
        ...current,
        runs: researchRunProjectionFromResponse(response)
      }));
      await refreshResearchOperations(projections.session.projectId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    appendCommand,
    client,
    projections.research,
    projections.session,
    projections.spec,
    refreshResearchOperations,
    researchOperations.allowlists
  ]);

  const refreshResearchRunStatus = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before refreshing research run status.");
        return;
      }

      setWorkflowError(null);

      try {
        const runs = await client.getResearchRunStatus(projections.session.projectId, researchRunId);

        setResearchOperations((current) => ({
          ...current,
          runs
        }));
      } catch (error) {
        setWorkflowError(displayError(error));
      }
    },
    [client, projections.session]
  );

  const cancelResearchRun = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before cancelling a research run.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Cancel research run",
          await client.cancelResearchRun(projections.session.projectId, researchRunId, {
            reason: "Cancelled from the Phase 1.5A operations screen."
          })
        );

        setResearchOperations((current) => ({
          ...current,
          runs: researchRunProjectionFromResponse(response)
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );

  const retryResearchRun = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active project is required before retrying a research run.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Retry research run",
          await client.retryResearchRun(projections.session.projectId, researchRunId, {
            retryReason: "Manual retry from the Phase 1.5A operations screen.",
            contextHash: `${researchRunId}_web_retry`
          })
        );

        setResearchOperations((current) => ({
          ...current,
          runs: researchRunProjectionFromResponse(response)
        }));
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections.session, refreshResearchOperations]
  );


  return {
    createOrReactivateAllowlist,
    pauseAllowlist,
    revokeAllowlist,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
    refreshResearchRunStatus,
    cancelResearchRun,
    retryResearchRun
  };
}
