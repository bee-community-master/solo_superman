import { type Dispatch, type FormEvent, type SetStateAction, useCallback } from "react";
import {
  type BusinessCriticIntensity,
  type DecisionQueueProjection,
  type ProjectId,
  type Phase15bUpgradeHintProjection,
  type ProjectPurposeMode,
  type QueueItemId,
  type ResearchAllowlistGovernanceProjection,
  type ResearchEvidenceProjection,
  type ResearchQueueTerminalOutcome,
  type ResearchTaskId,
  type SessionShellProjection,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import {
  commandResponseVersion,
  optionalCommandProjection,
  requiredCommandProjection
} from "../../../shared/api/command-response-helpers";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { draftedActiveQuestionAnswerIds, queueItemIsQuestionDebt } from "../decision-queue-view-model";
import { webPublicResearchAllowlistPolicy } from "../phase15a-research-run-request";
import {
  displayError,
  emptyProjectionState,
  emptyResearchOperationsState,
  WEB_PUBLIC_SAFE_ALLOWLIST_ID,
  type InitialResearchPermission,
  initialQueueStartBlocker,
  latestCommandBackedProjectionVersion,
  type AppendCommand,
  type CommandLogEntry,
  type ConnectionState,
  type ProjectionState
} from "./decision-queue-shell-model";
import type { DecisionQueueCopy } from "./decision-queue-copy";

interface DecisionQueueSessionActionsProps {
  readonly answerDrafts: Record<string, string>;
  readonly appendCommand: AppendCommand;
  readonly businessCriticIntensity: BusinessCriticIntensity | null;
  readonly businessCriticIntensityChangeReason: string;
  readonly chatGptLoginAcknowledged: boolean;
  readonly codexLoginAuthenticated: boolean;
  readonly client: SidecarClient | null;
  readonly connectionStatus: ConnectionState["status"];
  readonly copy: DecisionQueueCopy;
  readonly idea: string;
  readonly initialResearchPermission: InitialResearchPermission;
  readonly initialBusinessCriticIntensityReason: string;
  readonly intake: string;
  readonly isBusy: boolean;
  readonly knownRiskDrafts: Record<string, string>;
  readonly projectPurposeMode: ProjectPurposeMode | null;
  readonly projections: ProjectionState;
  readonly purposeModeChangeReason: string;
  readonly refetchQueueAfterSseNotification: (
    projectId: ProjectId,
    sessionId: SessionShellProjection["sessionId"],
    currentQueue: DecisionQueueProjection | null
  ) => Promise<void>;
  readonly refreshProjections: (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"]) => Promise<void>;
  readonly researchDrafts: Record<string, string>;
  readonly setAnswerDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  readonly setBusinessCriticIntensity: Dispatch<SetStateAction<BusinessCriticIntensity | null>>;
  readonly setBusinessCriticIntensityChangeReason: Dispatch<SetStateAction<string>>;
  readonly setCommandLog: Dispatch<SetStateAction<readonly CommandLogEntry[]>>;
  readonly setIsBusy: Dispatch<SetStateAction<boolean>>;
  readonly setKnownRiskDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  readonly setPhase15bReadiness: Dispatch<SetStateAction<Phase15bUpgradeHintProjection | null>>;
  readonly setProjectPurposeMode: Dispatch<SetStateAction<ProjectPurposeMode | null>>;
  readonly setProjections: Dispatch<SetStateAction<ProjectionState>>;
  readonly setPurposeModeChangeReason: Dispatch<SetStateAction<string>>;
  readonly setResearchDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  readonly setResearchOperations: Dispatch<SetStateAction<ResearchOperationsState>>;
  readonly setStatuses: Dispatch<SetStateAction<readonly StatusEndpointDto[]>>;
  readonly setWorkflowError: Dispatch<SetStateAction<string | null>>;
  readonly startReadyReadOnlyResearchRunsAfterAnswer?: () => Promise<void>;
  readonly onInitialQueueCreated?: () => void;
}

const NEXT_QUESTION_BATCH_LIMIT = 5;

function answerDraftsWithClearedItems(
  current: Record<string, string>,
  queueItemIds: readonly QueueItemId[]
) {
  return {
    ...current,
    ...Object.fromEntries(queueItemIds.map((queueItemId) => [queueItemId, ""]))
  };
}

export function nextQuestionBatchIdsForActivation(queue: DecisionQueueProjection | null | undefined) {
  const queueItemIds =
    queue?.next
      .filter(queueItemIsQuestionDebt)
      .slice(0, NEXT_QUESTION_BATCH_LIMIT)
      .map((item) => item.queueItemId) ?? [];

  return queueItemIds.length ? queueItemIds : undefined;
}

export function useDecisionQueueSessionActions({
  answerDrafts,
  appendCommand,
  businessCriticIntensity,
  businessCriticIntensityChangeReason,
  chatGptLoginAcknowledged,
  codexLoginAuthenticated,
  client,
  connectionStatus,
  copy,
  idea,
  initialResearchPermission,
  initialBusinessCriticIntensityReason,
  intake,
  isBusy,
  knownRiskDrafts,
  projectPurposeMode,
  projections,
  purposeModeChangeReason,
  refetchQueueAfterSseNotification,
  refreshProjections,
  researchDrafts,
  setAnswerDrafts,
  setBusinessCriticIntensity,
  setBusinessCriticIntensityChangeReason,
  setCommandLog,
  setIsBusy,
  setKnownRiskDrafts,
  setPhase15bReadiness,
  setProjectPurposeMode,
  setProjections,
  setPurposeModeChangeReason,
  setResearchDrafts,
  setResearchOperations,
  setStatuses,
  setWorkflowError,
  startReadyReadOnlyResearchRunsAfterAnswer,
  onInitialQueueCreated
}: DecisionQueueSessionActionsProps) {
  const { initialQueueStartBlockers, sessionActionErrors, sessionActionLabels, sessionActionReasons } = copy.questions;

  const enableInitialResearchSources = useCallback(
    async (activeClient: SidecarClient, projectId: ProjectId) => {
      const response = await appendCommand(
        sessionActionLabels.enableOnboardingResearchSources,
        await activeClient.createResearchAllowlist(projectId, {
          allowlistId: WEB_PUBLIC_SAFE_ALLOWLIST_ID,
          ...webPublicResearchAllowlistPolicy("web_onboarding_founder")
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
    },
    [appendCommand, setResearchOperations]
  );

  const runInitialQueueFlow = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const startBlocker = initialQueueStartBlocker({
        chatGptLoginAcknowledged,
        codexLoginAuthenticated,
        connectionStatus,
        hasClient: Boolean(client),
        projectPurposeMode,
        businessCriticIntensity,
        idea,
        intake,
        isBusy
      });

      if (startBlocker) {
        setWorkflowError(initialQueueStartBlockers[startBlocker]);
        return;
      }

      if (!client) {
        setWorkflowError(initialQueueStartBlockers.sidecar_connection);
        return;
      }

      if (!projectPurposeMode) {
        setWorkflowError(initialQueueStartBlockers.project_purpose);
        return;
      }

      if (projectPurposeMode === "business" && !businessCriticIntensity) {
        setWorkflowError(initialQueueStartBlockers.business_critic_intensity);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);
      setAnswerDrafts({});
      setCommandLog([]);
      setStatuses([]);
      setProjections(emptyProjectionState());
      setResearchOperations(emptyResearchOperationsState());
      setPhase15bReadiness(null);

      try {
        const projectPurposeLabel =
          copy.projectPurposeModeOptions.find((option) => option.mode === projectPurposeMode)?.label ?? projectPurposeMode;
        const businessCriticIntensityLabel = businessCriticIntensity
          ? (copy.businessCriticIntensityOptions.find((option) => option.intensity === businessCriticIntensity)?.label ??
            businessCriticIntensity)
          : null;
        const start = await appendCommand(
          sessionActionLabels.createProject,
          await client.createProject({
            rawIdea: idea,
            localPrivacyMode: "local_only",
            projectPurposeMode,
            projectPurposeModeConfirmation: "user_confirmed",
            projectPurposeModeReason: sessionActionReasons.projectPurposeConfirmed(projectPurposeLabel),
            ...(projectPurposeMode === "business" && businessCriticIntensity
              ? {
                  businessCriticIntensity,
                  businessCriticIntensityConfirmation: "user_confirmed" as const,
                  businessCriticIntensityReason:
                    initialBusinessCriticIntensityReason.trim() ||
                    sessionActionReasons.businessCriticIntensityConfirmed(
                      businessCriticIntensityLabel ?? businessCriticIntensity
                    )
                }
              : {})
          })
        );
        const session = requiredCommandProjection<SessionShellProjection>(start, "SessionShellProjection");
        setProjections({
          ...emptyProjectionState(),
          session,
        });
        if (initialResearchPermission === "allow_public_web") {
          await enableInitialResearchSources(client, session.projectId);
        }

        const intakeResponse = await appendCommand(
          sessionActionLabels.captureIntake,
          await client.captureIntake(session.sessionId, commandResponseVersion(start), intake)
        );
        const draftResponse = await appendCommand(
          sessionActionLabels.draftInitialSpec,
          await client.draftInitialSpec(session.sessionId, commandResponseVersion(intakeResponse))
        );
        const analyzeResponse = await appendCommand(
          sessionActionLabels.analyzeAmbiguity,
          await client.analyzeAmbiguity(session.sessionId, commandResponseVersion(draftResponse), "current_spec")
        );
        const activateResponse = await appendCommand(
          sessionActionLabels.activateQuestionBatch,
          await client.activateQuestionBatch(session.sessionId, commandResponseVersion(analyzeResponse))
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(activateResponse, "DecisionQueueProjection");

        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(session.projectId, session.sessionId);
        await refetchQueueAfterSseNotification(session.projectId, session.sessionId, queue);
        onInitialQueueCreated?.();
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      businessCriticIntensity,
      chatGptLoginAcknowledged,
      codexLoginAuthenticated,
      connectionStatus,
      copy.businessCriticIntensityOptions,
      copy.projectPurposeModeOptions,
      initialQueueStartBlockers,
      initialBusinessCriticIntensityReason,
      initialResearchPermission,
      client,
      enableInitialResearchSources,
      idea,
      intake,
      isBusy,
      projectPurposeMode,
      refetchQueueAfterSseNotification,
      refreshProjections,
      sessionActionReasons,
      onInitialQueueCreated
    ]
  );

  const changeProjectPurposeMode = useCallback(
    async (nextMode: ProjectPurposeMode) => {
      if (!client || !projections.session) {
        setWorkflowError(sessionActionErrors.activeSessionRequiredProjectPurpose);
        return;
      }

      if (nextMode === projections.session.projectPurposeMode) {
        setWorkflowError(sessionActionErrors.projectPurposeAlreadySelected);
        return;
      }

      const selectedOption = copy.projectPurposeModeOptions.find((option) => option.mode === nextMode);
      const reason =
        purposeModeChangeReason.trim() ||
        sessionActionReasons.projectPurposeChanged(selectedOption?.label ?? nextMode);

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          sessionActionLabels.changeProjectPurposeMode,
          await client.changeProjectPurposeMode({
            sessionId: projections.session.sessionId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            projectPurposeMode: nextMode,
            suggestedProjectPurposeMode: nextMode,
            reason
          })
        );
        const session = requiredCommandProjection<SessionShellProjection>(response, "SessionShellProjection");

        setProjectPurposeMode(nextMode);
        setPurposeModeChangeReason("");
        setProjections((current) => ({
          ...current,
          session
        }));
        await refreshProjections(session.projectId, session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      copy.projectPurposeModeOptions,
      projections,
      purposeModeChangeReason,
      refreshProjections,
      sessionActionErrors,
      sessionActionReasons
    ]
  );

  const changeBusinessCriticIntensity = useCallback(
    async (nextIntensity: BusinessCriticIntensity) => {
      if (!client || !projections.session) {
        setWorkflowError(sessionActionErrors.activeSessionRequiredBusinessCriticIntensity);
        return;
      }

      if (projections.session.projectPurposeMode !== "business") {
        setWorkflowError(sessionActionErrors.businessCriticIntensityBusinessOnly);
        return;
      }

      const selectedOption = copy.businessCriticIntensityOptions.find((option) => option.intensity === nextIntensity);
      const reason =
        businessCriticIntensityChangeReason.trim() ||
        sessionActionReasons.businessCriticIntensityChanged(selectedOption?.label ?? nextIntensity);

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          sessionActionLabels.changeBusinessCriticIntensity,
          await client.changeBusinessCriticIntensity({
            sessionId: projections.session.sessionId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            businessCriticIntensity: nextIntensity,
            businessCriticIntensityConfirmation: "user_confirmed",
            reason
          })
        );
        const session = requiredCommandProjection<SessionShellProjection>(response, "SessionShellProjection");

        setBusinessCriticIntensity(nextIntensity);
        setBusinessCriticIntensityChangeReason("");
        setProjections((current) => ({
          ...current,
          session
        }));
        await refreshProjections(session.projectId, session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      businessCriticIntensityChangeReason,
      client,
      copy.businessCriticIntensityOptions,
      projections,
      refreshProjections,
      sessionActionErrors,
      sessionActionReasons
    ]
  );

  const continueAnswerPostSubmitWork = useCallback(
    (projectId: ProjectId, sessionId: SessionShellProjection["sessionId"], queue: DecisionQueueProjection | null) => {
      void (async () => {
        try {
          await refreshProjections(projectId, sessionId);

          if (queue) {
            await refetchQueueAfterSseNotification(projectId, sessionId, queue);
          }

          await startReadyReadOnlyResearchRunsAfterAnswer?.();
        } catch (error) {
          setWorkflowError(displayError(error));
        }
      })();
    },
    [
      refetchQueueAfterSseNotification,
      refreshProjections,
      setWorkflowError,
      startReadyReadOnlyResearchRunsAfterAnswer
    ]
  );

  const submitAnswer = useCallback(
    async (queueItemId: QueueItemId) => {
      if (!client || !projections.session) {
        setWorkflowError(sessionActionErrors.activeSessionRequiredSubmitAnswer);
        return;
      }

      const answer = answerDrafts[queueItemId]?.trim();

      if (!answer) {
        setWorkflowError(sessionActionErrors.answerTextRequired);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          sessionActionLabels.submitAnswer,
          await client.submitAnswer({
            sessionId: projections.session.sessionId,
            queueItemId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            answer
          })
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

        setAnswerDrafts((current) => ({
          ...current,
          [queueItemId]: ""
        }));
        setProjections((current) => ({
          ...current,
          queue
        }));
        continueAnswerPostSubmitWork(projections.session.projectId, projections.session.sessionId, queue);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      answerDrafts,
      appendCommand,
      client,
      continueAnswerPostSubmitWork,
      projections,
      sessionActionErrors,
    ]
  );

  const submitDraftedActiveAnswers = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(sessionActionErrors.activeSessionRequiredDraftedAnswers);
      return;
    }

    const queueItemIds = draftedActiveQuestionAnswerIds(projections.queue, answerDrafts);

    if (!queueItemIds.length) {
      setWorkflowError(sessionActionErrors.draftedAnswersRequired);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    const submittedQueueItemIds: QueueItemId[] = [];

    try {
      let expectedStateVersion = latestCommandBackedProjectionVersion(projections);
      let latestQueue: DecisionQueueProjection | null = projections.queue;

      for (const queueItemId of queueItemIds) {
        const answer = answerDrafts[queueItemId]?.trim();

        if (!answer) {
          continue;
        }

        const response = await appendCommand(
          sessionActionLabels.submitDraftedAnswer,
          await client.submitAnswer({
            sessionId: projections.session.sessionId,
            queueItemId,
            expectedStateVersion,
            answer
          })
        );

        expectedStateVersion = commandResponseVersion(response);
        latestQueue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");
        submittedQueueItemIds.push(queueItemId);
      }

      setAnswerDrafts((current) => answerDraftsWithClearedItems(current, submittedQueueItemIds));

      if (latestQueue) {
        setProjections((current) => ({
          ...current,
          queue: latestQueue
        }));
      }

      continueAnswerPostSubmitWork(projections.session.projectId, projections.session.sessionId, latestQueue);
    } catch (error) {
      let refreshedAfterPartialFailure = false;

      if (submittedQueueItemIds.length) {
        setAnswerDrafts((current) => answerDraftsWithClearedItems(current, submittedQueueItemIds));
        try {
          await refreshProjections(projections.session.projectId, projections.session.sessionId);
          refreshedAfterPartialFailure = true;
        } catch {
          // Keep the original answer submission error visible.
        }
      }

      const partialFailureNote = submittedQueueItemIds.length
        ? refreshedAfterPartialFailure
          ? sessionActionErrors.draftedAnswersPartialFailureRefreshed
          : sessionActionErrors.draftedAnswersPartialFailureRefreshRequired
        : "";
      setWorkflowError(`${displayError(error)}${partialFailureNote}`);
    } finally {
      setIsBusy(false);
    }
  }, [
    answerDrafts,
    appendCommand,
    client,
    continueAnswerPostSubmitWork,
    projections,
    sessionActionErrors,
    refreshProjections
  ]);

  const refreshQuestionList = useCallback(async () => {
    if (!projections.session) {
      setWorkflowError(sessionActionErrors.activeSessionRequiredRefreshQuestions);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [projections.session, refreshProjections, sessionActionErrors]);

  const loadNextQuestionBatch = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError(sessionActionErrors.activeSessionRequiredLoadNextQuestions);
      return;
    }

    if (projections.queue?.active.length) {
      setWorkflowError(sessionActionErrors.answerCurrentBeforeLoadNextQuestions);
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        sessionActionLabels.loadNextQuestions,
        await client.activateQuestionBatch(
          projections.session.sessionId,
          latestCommandBackedProjectionVersion(projections),
          nextQuestionBatchIdsForActivation(projections.queue)
        )
      );
      const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

      setProjections((current) => ({
        ...current,
        queue
      }));
      await refreshProjections(projections.session.projectId, projections.session.sessionId);
      await refetchQueueAfterSseNotification(projections.session.projectId, projections.session.sessionId, queue);
    } catch (error) {
      setWorkflowError(displayError(error));
    } finally {
      setIsBusy(false);
    }
  }, [appendCommand, client, projections, refetchQueueAfterSseNotification, refreshProjections, sessionActionErrors]);

  const carryQueueItemAsKnownRisk = useCallback(
    async (queueItemId: QueueItemId) => {
      if (!client || !projections.session) {
        setWorkflowError(sessionActionErrors.activeSessionRequiredKnownRisk);
        return;
      }

      const nextValidationAction = knownRiskDrafts[queueItemId]?.trim();

      if (!nextValidationAction) {
        setWorkflowError(sessionActionErrors.knownRiskNextValidationActionRequired);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          sessionActionLabels.carryAsKnownRisk,
          await client.deferQueueItem({
            sessionId: projections.session.sessionId,
            queueItemId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            reason: sessionActionReasons.businessCriticKnownRiskDeferred,
            riskDisposition: "known_risk_next_validation_action",
            nextValidationAction
          })
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

        setKnownRiskDrafts((current) => ({
          ...current,
          [queueItemId]: ""
        }));
        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
        await refetchQueueAfterSseNotification(projections.session.projectId, projections.session.sessionId, queue);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      knownRiskDrafts,
      projections,
      refetchQueueAfterSseNotification,
      refreshProjections,
      sessionActionErrors,
      sessionActionReasons
    ]
  );

  const importResearchResult = useCallback(
    async (researchTaskId: ResearchTaskId) => {
      if (!client || !projections.session) {
        setWorkflowError(sessionActionErrors.activeSessionRequiredImportResearch);
        return;
      }

      const result = researchDrafts[researchTaskId]?.trim();

      if (!result) {
        setWorkflowError(sessionActionErrors.researchResultTextRequired);
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          sessionActionLabels.importResearchResult,
          await client.importResearchResult({
            sessionId: projections.session.sessionId,
            researchTaskId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            result,
            sourceTitle: sessionActionReasons.manualResearchSourceTitle,
            limitationNotes: sessionActionReasons.manualResearchLimitationNotes
          })
        );
        const research = optionalCommandProjection<ResearchEvidenceProjection>(response, "ResearchEvidenceProjection");

        setResearchDrafts((current) => ({
          ...current,
          [researchTaskId]: ""
        }));
        if (research) {
          setProjections((current) => ({
            ...current,
            research
          }));
        }
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections, refreshProjections, researchDrafts, sessionActionErrors, sessionActionReasons]
  );

  const resolveResearchCard = useCallback(
    async (cardId: QueueItemId, outcome: ResearchQueueTerminalOutcome, title: string) => {
      if (!client || !projections.session) {
        setWorkflowError(sessionActionErrors.activeSessionRequiredResolveResearchCard);
        return;
      }

      const needsRationale = outcome === "deferred" || outcome === "risk_accepted";
      const rationale = needsRationale
        ? sessionActionReasons.researchCardOutcomeRationale(outcome, title)
        : outcome === "revised" || outcome === "research_insufficient"
          ? sessionActionReasons.researchCardResolvedRationale(outcome, title)
          : undefined;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          sessionActionLabels.resolveResearchCard(outcome),
          await client.resolveResearchQueueCard({
            sessionId: projections.session.sessionId,
            cardId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            outcome,
            ...(rationale ? { rationale } : {})
          })
        );
        const queue = requiredCommandProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");

        setProjections((current) => ({
          ...current,
          queue
        }));
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [appendCommand, client, projections, refreshProjections, sessionActionErrors, sessionActionReasons]
  );


  return {
    runInitialQueueFlow,
    changeProjectPurposeMode,
    changeBusinessCriticIntensity,
    submitAnswer,
    submitDraftedActiveAnswers,
    refreshQuestionList,
    loadNextQuestionBatch,
    carryQueueItemAsKnownRisk,
    importResearchResult,
    resolveResearchCard
  };
}
