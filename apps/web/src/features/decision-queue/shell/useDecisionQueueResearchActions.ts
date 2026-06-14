import { type Dispatch, type SetStateAction, useCallback } from "react";
import {
  isTerminalResearchRunStatus,
  type ChatGptBrowserDelegationProjection,
  type ProjectId,
  type QueueItemId,
  type ResearchAllowlistGovernanceProjection,
  type ResearchAllowlistId,
  type ResearchEvidenceProjection,
  type ResearchRunId,
  type ResearchTaskId,
  type SessionShellProjection,
  type StateVersion
} from "@solo-superman/contracts";
import { commandResponseVersion, requiredCommandProjection } from "../../../shared/api/command-response-helpers";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import {
  buildVisibleChatGptResearchDelegationRequest,
  visibleChatGptResearchDelegationTaskIds
} from "../chatgpt-browser-delegation-request";
import {
  activeWebPublicResearchAllowlist,
  buildWebResearchRunRequest,
  webPublicResearchAllowlistPolicy
} from "../phase15a-research-run-request";
import { readyReadOnlyResearchRunStartPlan } from "../ready-readonly-research-start-plan";
import { taskCanStartPublicSearchResearch } from "../research-routing-readiness";
import {
  displayError,
  latestCommandBackedProjectionVersion,
  researchRunProjectionFromResponse,
  WEB_PUBLIC_SAFE_ALLOWLIST_ID,
  type AppendCommand,
  type ProjectionState
} from "./decision-queue-shell-model";
import type { DecisionQueueCopy } from "./decision-queue-copy";

interface DecisionQueueResearchActionsProps {
  readonly appendCommand: AppendCommand;
  readonly client: SidecarClient | null;
  readonly copy: DecisionQueueCopy;
  readonly projections: ProjectionState;
  readonly recentResearchAnswers?: readonly string[];
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
  copy,
  projections,
  recentResearchAnswers = [],
  refreshProjections,
  refreshResearchOperations,
  researchOperations,
  setIsBusy,
  setProjections,
  setResearchOperations,
  setWorkflowError
}: DecisionQueueResearchActionsProps) {
  const { researchActionErrors, researchActionLabels, researchActionReasons } = copy.research;

  const refreshResearchEvidenceSurfaces = useCallback(
    async (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => {
      await refreshProjections(projectId, sessionId);
    },
    [refreshProjections]
  );

  const prepareVisibleChatGptResearchDelegations = useCallback(
    async ({
      expectedStateVersion,
      research,
      sessionId
    }: {
      readonly expectedStateVersion: StateVersion;
      readonly research: ResearchEvidenceProjection;
      readonly sessionId: SessionShellProjection["sessionId"];
    }) => {
      if (
        !client ||
        projections.session?.initialResearchAutomationPermission !== "allow_codex_and_chatgpt_visible"
      ) {
        return expectedStateVersion;
      }

      const existingDelegation = await client.getChatGptBrowserDelegation(sessionId);
      const taskIds = visibleChatGptResearchDelegationTaskIds({
        research,
        delegation: existingDelegation
      });

      let nextExpectedStateVersion = expectedStateVersion;
      let latestDelegation: ChatGptBrowserDelegationProjection | null = existingDelegation;

      for (const researchTaskId of taskIds) {
        const task = research.tasks.find((item) => item.researchTaskId === researchTaskId);

        if (!task) {
          continue;
        }

        const response = await appendCommand(
          researchActionLabels.prepareVisibleChatGptResearchDelegation,
          await client.createChatGptBrowserDelegationRun(
            buildVisibleChatGptResearchDelegationRequest({
              expectedStateVersion: nextExpectedStateVersion,
              sessionId,
              task
            })
          )
        );

        latestDelegation = requiredCommandProjection<ChatGptBrowserDelegationProjection>(
          response,
          "ChatGptBrowserDelegationProjection"
        );
        nextExpectedStateVersion = commandResponseVersion(response);
      }

      if (latestDelegation) {
        setProjections((current) => ({
          ...current,
          chatGptDelegation: latestDelegation
        }));
      }

      return nextExpectedStateVersion;
    },
    [appendCommand, client, projections.session, researchActionLabels.prepareVisibleChatGptResearchDelegation, setProjections]
  );

  const createOrReactivateAllowlist = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(researchActionErrors.activeProjectRequiredAllowlistChange);
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
        reusableAllowlist ? researchActionLabels.reactivateAllowlist : researchActionLabels.createAllowlist,
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
      const activatedAllowlist = activeWebPublicResearchAllowlist(allowlists);

      if (activatedAllowlist && projections.research) {
        const latestRuns = await client.listResearchRuns(projectId);
        const plan = readyReadOnlyResearchRunStartPlan({
          research: projections.research,
          runs: latestRuns,
          allowlist: activatedAllowlist,
          missingAllowlistMessage: researchActionErrors.readyRunsMissingAllowlist,
          noReadyTasksMessage: researchActionErrors.readyRunsNoReadyTasks,
          quietNoop: true
        });

        setResearchOperations((current) => ({
          ...current,
          runs: latestRuns
        }));

        if (plan.status === "start") {
          for (const [index, researchTaskId] of plan.taskIds.entries()) {
            const task = projections.research.tasks.find((item) => item.researchTaskId === researchTaskId);

            if (!task) {
              continue;
            }

            const runResponse = await appendCommand(
              `${researchActionLabels.startBackgroundPublicWebResearchRun} ${index + 1}/${plan.taskIds.length}`,
              await client.startResearchRun(
                projectId,
                buildWebResearchRunRequest({
                  allowlist: activatedAllowlist,
                  detailedAnswers: recentResearchAnswers,
                  spec: projections.spec,
                  task
                })
              )
            );
            const runs = researchRunProjectionFromResponse(runResponse);
            const selectedRun =
              runs.selectedRun ?? runs.runs.find((run) => run.status === "running" || run.status === "queued");

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

            const listedRuns = await client.listResearchRuns(projectId);

            setResearchOperations((current) => ({
              ...current,
              runs: listedRuns
            }));
          }

          await refreshResearchEvidenceSurfaces(projectId, projections.session.sessionId);
        }
      }
      await refreshResearchOperations(projectId);
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
    projections.spec?.title,
    refreshResearchEvidenceSurfaces,
    refreshResearchOperations,
    researchActionErrors,
    researchActionLabels,
    researchOperations.allowlists
  ]);

  const pauseAllowlist = useCallback(
    async (allowlistId: ResearchAllowlistId) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredPauseAllowlist);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          researchActionLabels.pauseAllowlist,
          await client.pauseResearchAllowlist(
            projections.session.projectId,
            allowlistId,
            researchActionReasons.pauseAllowlist
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
    [appendCommand, client, projections.session, refreshResearchOperations, researchActionErrors, researchActionReasons]
  );

  const revokeAllowlist = useCallback(
    async (allowlistId: ResearchAllowlistId) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredRevokeAllowlist);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          researchActionLabels.revokeAllowlist,
          await client.revokeResearchAllowlist(
            projections.session.projectId,
            allowlistId,
            researchActionReasons.revokeAllowlist
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
    [appendCommand, client, projections.session, refreshResearchOperations, researchActionErrors, researchActionReasons]
  );

  const updateAllowlistMaxConcurrentRuns = useCallback(
    async (allowlistId: ResearchAllowlistId, maxConcurrentRuns: number) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredAllowlistChange);
        return;
      }

      const allowlist = researchOperations.allowlists?.allowlists.find((item) => item.allowlistId === allowlistId);

      if (!allowlist) {
        setWorkflowError(researchActionErrors.activeAllowlistRequiredStartRun);
        return;
      }

      if (!Number.isInteger(maxConcurrentRuns) || maxConcurrentRuns < 1) {
        setWorkflowError(researchActionErrors.maxConcurrentRunsInvalid);
        return;
      }

      const normalizedMax = maxConcurrentRuns;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          researchActionLabels.updateMaxConcurrentRuns,
          await client.updateResearchAllowlist(projections.session.projectId, allowlist.allowlistId, {
            rateBudgetPolicy: {
              ...allowlist.rateBudgetPolicy,
              maxConcurrentRunsPerProject: normalizedMax,
              maxRunsPerSession: Math.max(allowlist.rateBudgetPolicy.maxRunsPerSession, normalizedMax)
            }
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
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      projections.session,
      refreshResearchOperations,
      researchActionErrors,
      researchActionLabels,
      researchOperations.allowlists,
      setResearchOperations
    ]
  );

  const updateAllowlistMaxRunsPerSession = useCallback(
    async (allowlistId: ResearchAllowlistId, maxRunsPerSession: number) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredAllowlistChange);
        return;
      }

      const allowlist = researchOperations.allowlists?.allowlists.find((item) => item.allowlistId === allowlistId);

      if (!allowlist) {
        setWorkflowError(researchActionErrors.activeAllowlistRequiredStartRun);
        return;
      }

      if (
        !Number.isInteger(maxRunsPerSession) ||
        maxRunsPerSession < allowlist.rateBudgetPolicy.maxConcurrentRunsPerProject
      ) {
        setWorkflowError(researchActionErrors.maxSessionRunsInvalid);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          researchActionLabels.updateMaxSessionRuns,
          await client.updateResearchAllowlist(projections.session.projectId, allowlist.allowlistId, {
            rateBudgetPolicy: {
              ...allowlist.rateBudgetPolicy,
              maxRunsPerSession
            }
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
        await refreshResearchOperations(projections.session.projectId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      projections.session,
      refreshResearchOperations,
      researchActionErrors,
      researchActionLabels,
      researchOperations.allowlists,
      setResearchOperations
    ]
  );

  const planPhase15aResearchTask = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(researchActionErrors.activeSessionRequiredPlanResearch);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        researchActionLabels.planPublicSafeResearchTask,
        await client.planResearch({
          sessionId: projections.session.sessionId,
          expectedStateVersion: latestCommandBackedProjectionVersion(projections),
          objective: researchActionReasons.planPublicSafeObjective,
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
      await prepareVisibleChatGptResearchDelegations({
        expectedStateVersion: commandResponseVersion(response),
        research,
        sessionId: projections.session.sessionId
      });
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    appendCommand,
    client,
    prepareVisibleChatGptResearchDelegations,
    projections,
    refreshProjections,
    researchActionErrors,
    researchActionReasons
  ]);

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
        throw new Error(researchActionErrors.sidecarConnectionRequiredStartRun);
      }

      if (!taskCanStartPublicSearchResearch({ task })) {
        throw new Error(researchActionErrors.readyRunsNoReadyTasks);
      }

      const response = await appendCommand(
        label,
        await client.startResearchRun(
          projectId,
          buildWebResearchRunRequest({
            allowlist,
            detailedAnswers: recentResearchAnswers,
            spec: projections.spec,
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

      const listedRuns = await client.listResearchRuns(projectId);

      setResearchOperations((current) => ({
        ...current,
        runs: listedRuns
      }));
    },
    [appendCommand, client, projections.spec, recentResearchAnswers, researchActionErrors, setResearchOperations]
  );

  const startReadOnlyResearchRun = useCallback(async (researchTaskId: ResearchTaskId) => {
    if (!client || !projections.session) {
      setWorkflowError(researchActionErrors.activeProjectRequiredStartRun);
      return;
    }

    const task = projections.research?.tasks.find((item) => item.researchTaskId === researchTaskId);
    const allowlist = activeWebPublicResearchAllowlist(researchOperations.allowlists);

    if (!task) {
      setWorkflowError(researchActionErrors.plannedTaskRequiredStartRun);
      return;
    }

    if (task.status !== "planned") {
      setWorkflowError(researchActionErrors.plannedTaskStatusRequiredStartRun);
      return;
    }

    if (!allowlist) {
      setWorkflowError(researchActionErrors.activeAllowlistRequiredStartRun);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      await startReadOnlyResearchRunForTask({
        allowlist,
        label: researchActionLabels.startPublicWebResearchRun,
        projectId: projections.session.projectId,
        task
      });
      await refreshResearchEvidenceSurfaces(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    client,
    projections.research,
    projections.session,
    refreshResearchEvidenceSurfaces,
    researchOperations.allowlists,
    researchActionErrors,
    startReadOnlyResearchRunForTask
  ]);

  const startReadyReadOnlyResearchRunsForPlan = useCallback(
    async ({
      allowlist,
      labelPrefix,
      projectId,
      research,
      taskIds
    }: {
      readonly allowlist: ResearchAllowlistProjection;
      readonly labelPrefix: string;
      readonly projectId: ProjectId;
      readonly research: ResearchEvidenceProjection;
      readonly taskIds: readonly ResearchTaskId[];
    }) => {
      for (const [index, researchTaskId] of taskIds.entries()) {
        const task = research.tasks.find((item) => item.researchTaskId === researchTaskId);

        if (!task) {
          continue;
        }

        await startReadOnlyResearchRunForTask({
          allowlist,
          label: `${labelPrefix} ${index + 1}/${taskIds.length}`,
          projectId,
          task
        });
      }
    },
    [startReadOnlyResearchRunForTask]
  );

  const startReadyReadOnlyResearchRuns = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(researchActionErrors.activeProjectRequiredReadyRuns);
      return;
    }

    const allowlist = activeWebPublicResearchAllowlist(researchOperations.allowlists);

    if (!allowlist) {
      setWorkflowError(researchActionErrors.readyRunsMissingAllowlist);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const projectId = projections.session.projectId;
      const latestRuns = await client.listResearchRuns(projectId);

      const plan = readyReadOnlyResearchRunStartPlan({
        research: projections.research,
        runs: latestRuns,
        allowlist,
        missingAllowlistMessage: researchActionErrors.readyRunsMissingAllowlist,
        noReadyTasksMessage: researchActionErrors.readyRunsNoReadyTasks,
        quietNoop: false
      });

      setResearchOperations((current) => ({
        ...current,
        runs: latestRuns
      }));

      if (plan.status === "blocked") {
        setWorkflowError(plan.message);
        return;
      }

      if (plan.status === "start" && projections.research) {
        await startReadyReadOnlyResearchRunsForPlan({
          allowlist,
          labelPrefix: researchActionLabels.startPublicWebResearchRun,
          projectId,
          research: projections.research,
          taskIds: plan.taskIds
        });
      }

      await refreshResearchEvidenceSurfaces(projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [
    client,
    projections.research,
    projections.session,
    refreshResearchEvidenceSurfaces,
    researchOperations.allowlists,
    researchActionErrors,
    setResearchOperations,
    startReadyReadOnlyResearchRunsForPlan
  ]);

  const startReadyReadOnlyResearchRunsAfterAnswer = useCallback(async () => {
    if (!client || !projections.session) {
      return;
    }

    try {
      const { projectId, sessionId } = projections.session;
      const [allowlists, latestResearch, latestRuns] = await Promise.all([
        client.listResearchAllowlists(projectId),
        client.getResearch(sessionId),
        client.listResearchRuns(projectId)
      ]);
      const allowlist = activeWebPublicResearchAllowlist(allowlists);
      const plan = readyReadOnlyResearchRunStartPlan({
        research: latestResearch,
        runs: latestRuns,
        allowlist,
        missingAllowlistMessage: researchActionErrors.readyRunsMissingAllowlist,
        noReadyTasksMessage: researchActionErrors.readyRunsNoReadyTasks,
        quietNoop: true
      });

      setProjections((current) => ({
        ...current,
        research: latestResearch
      }));
      setResearchOperations((current) => ({
        ...current,
        allowlists,
        runs: latestRuns
      }));
      await prepareVisibleChatGptResearchDelegations({
        expectedStateVersion: latestCommandBackedProjectionVersion({
          ...projections,
          research: latestResearch
        }),
        research: latestResearch,
        sessionId
      });

      if (plan.status !== "start") {
        return;
      }

      if (!allowlist) {
        return;
      }

      await startReadyReadOnlyResearchRunsForPlan({
        allowlist,
        labelPrefix: researchActionLabels.startBackgroundPublicWebResearchRun,
        projectId,
        research: latestResearch,
        taskIds: plan.taskIds
      });
      await refreshResearchEvidenceSurfaces(projectId, sessionId);
    } catch (error) {
      setWorkflowError(researchActionErrors.backgroundStartAfterAnswerFailed(displayError(error)));
    }
  }, [
    client,
    prepareVisibleChatGptResearchDelegations,
    projections,
    refreshResearchEvidenceSurfaces,
    researchActionErrors,
    setProjections,
    setResearchOperations,
    setWorkflowError,
    startReadyReadOnlyResearchRunsForPlan
  ]);

  const refreshResearchRunStatus = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredRefreshRunStatus);
        return;
      }

      setWorkflowError(null);

      try {
        const runs = await client.getResearchRunStatus(projections.session.projectId, researchRunId);

        setResearchOperations((current) => ({
          ...current,
          runs
        }));
        await refreshProjections(projections.session.projectId, projections.session.sessionId);

        if (runs.selectedRun && isTerminalResearchRunStatus(runs.selectedRun.status)) {
          await startReadyReadOnlyResearchRunsAfterAnswer();
        }
      } catch (error) {
        setWorkflowError(displayError(error));
      }
    },
    [client, projections.session, refreshProjections, researchActionErrors, startReadyReadOnlyResearchRunsAfterAnswer]
  );

  const cancelResearchRun = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredCancelRun);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          researchActionLabels.cancelRun,
          await client.cancelResearchRun(projections.session.projectId, researchRunId, {
            reason: researchActionReasons.cancelRun
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
    [appendCommand, client, projections.session, refreshResearchOperations, researchActionErrors, researchActionReasons]
  );

  const retryResearchRun = useCallback(
    async (researchRunId: ResearchRunId) => {
      if (!client || !projections.session) {
        setWorkflowError(researchActionErrors.activeProjectRequiredRetryRun);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          researchActionLabels.retryRun,
          await client.retryResearchRun(projections.session.projectId, researchRunId, {
            retryReason: researchActionReasons.retryRun,
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
    [appendCommand, client, projections.session, refreshResearchOperations, researchActionErrors, researchActionReasons]
  );


  return {
    createOrReactivateAllowlist,
    pauseAllowlist,
    revokeAllowlist,
    updateAllowlistMaxConcurrentRuns,
    updateAllowlistMaxRunsPerSession,
    planPhase15aResearchTask,
    startReadOnlyResearchRun,
    startReadyReadOnlyResearchRunsAfterAnswer,
    startReadyReadOnlyResearchRuns,
    refreshResearchRunStatus,
    cancelResearchRun,
    retryResearchRun
  };
}
