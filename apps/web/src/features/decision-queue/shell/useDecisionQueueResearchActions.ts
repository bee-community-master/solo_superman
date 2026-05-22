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
import { startableReadOnlyResearchTaskIds } from "../decision-queue-view-model";
import {
  activeWebPublicResearchAllowlist,
  buildWebResearchRunRequest,
  webPublicResearchAllowlistPolicy
} from "../phase15a-research-run-request";
import {
  displayError,
  latestCommandBackedProjectionVersion,
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

type ResearchAllowlistProjection = ResearchAllowlistGovernanceProjection["allowlists"][number];
type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];

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
      const policy = webPublicResearchAllowlistPolicy("web_ui_founder");
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
            "Paused from the research operations screen."
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
            "Revoked from the research operations screen."
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
      setWorkflowError("An active session is required before planning public-safe research.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Plan public-safe research task",
        await client.planResearch({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestCommandBackedProjectionVersion(projections),
          objective: "Validate public onboarding evidence and quality-gate readiness for the research loop.",
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

  const startReadOnlyResearchRunForTask = useCallback(
    async ({
      allowlist,
      label,
      projectId,
      task
    }: {
      readonly allowlist: ResearchAllowlistProjection;
      readonly label: string;
      readonly projectId: ProjectId;
      readonly task: ResearchTaskProjection;
    }) => {
      if (!client) {
        throw new Error("A sidecar connection is required before starting a research run.");
      }

      const response = await appendCommand(
        label,
        await client.startResearchRun(
          projectId,
          buildWebResearchRunRequest({
            allowlist,
            specTitle: projections.spec?.title,
            task
          })
        )
      );
      const runs = researchRunProjectionFromResponse(response);
      const selectedRun = runs.selectedRun ?? runs.runs.find((run) => run.status === "running" || run.status === "queued");

      setResearchOperations((current) => ({
        ...current,
        runs
      }));

      if (selectedRun && (selectedRun.status === "running" || selectedRun.status === "queued")) {
        const refreshedRuns = await client.getResearchRunStatus(projectId, selectedRun.researchRunId);

        setResearchOperations((current) => ({
          ...current,
          runs: refreshedRuns
        }));
      }
    },
    [appendCommand, client, projections.spec, setResearchOperations]
  );

  const startReadOnlyResearchRun = useCallback(async (researchTaskId: ResearchTaskId) => {
    if (!client || !projections.session) {
      setWorkflowError("An active project is required before starting a research run.");
      return;
    }

    const task = projections.research?.tasks.find((item) => item.researchTaskId === researchTaskId);
    const allowlist = activeWebPublicResearchAllowlist(researchOperations.allowlists);

    if (!task) {
      setWorkflowError("Select a planned research task before starting a read-only research run.");
      return;
    }

    if (task.status !== "planned") {
      setWorkflowError("Only planned research tasks can start a new read-only research run.");
      return;
    }

    if (!allowlist) {
      setWorkflowError("Create or reactivate an active public web allowlist before starting a research run.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      await startReadOnlyResearchRunForTask({
        allowlist,
        label: "Start public web research run",
        projectId: projections.session.projectId,
        task
      });
      await refreshResearchOperations(projections.session.projectId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    client,
    projections.research,
    projections.session,
    refreshResearchOperations,
    researchOperations.allowlists,
    startReadOnlyResearchRunForTask
  ]);

  const startReadyReadOnlyResearchRuns = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active project is required before starting ready research runs.");
      return;
    }

    const allowlist = activeWebPublicResearchAllowlist(researchOperations.allowlists);

    if (!allowlist) {
      setWorkflowError("Create or reactivate an active public web allowlist before starting research runs.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const projectId = projections.session.projectId;
      const latestRuns = await client.listResearchRuns(projectId);
      const taskIds = startableReadOnlyResearchTaskIds({
        research: projections.research,
        runs: latestRuns,
        allowlist
      });

      setResearchOperations((current) => ({
        ...current,
        runs: latestRuns
      }));

      if (!taskIds.length) {
        setWorkflowError("No planned public web research tasks are ready within the active allowlist concurrency budget.");
        return;
      }

      for (const [index, researchTaskId] of taskIds.entries()) {
        const task = projections.research?.tasks.find((item) => item.researchTaskId === researchTaskId);

        if (!task) {
          continue;
        }

        await startReadOnlyResearchRunForTask({
          allowlist,
          label: `Start public web research run ${index + 1}/${taskIds.length}`,
          projectId,
          task
        });
      }

      await refreshResearchOperations(projectId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    client,
    projections.research,
    projections.session,
    refreshResearchOperations,
    researchOperations.allowlists,
    setResearchOperations,
    startReadOnlyResearchRunForTask
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
            reason: "Cancelled from the research operations screen."
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
            retryReason: "Manual retry from the research operations screen.",
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
    startReadyReadOnlyResearchRuns,
    refreshResearchRunStatus,
    cancelResearchRun,
    retryResearchRun
  };
}
