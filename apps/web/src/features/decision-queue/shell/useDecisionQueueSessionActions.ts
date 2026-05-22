import { type Dispatch, type FormEvent, type SetStateAction, useCallback } from "react";
import {
  BUSINESS_CRITIC_INTENSITY_LABELS,
  PROJECT_PURPOSE_MODE_LABELS,
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
  BUSINESS_CRITIC_INTENSITY_OPTIONS,
  INITIAL_QUEUE_START_BLOCKER_MESSAGES,
  displayError,
  emptyProjectionState,
  emptyResearchOperationsState,
  WEB_PUBLIC_SAFE_ALLOWLIST_ID,
  type InitialResearchPermission,
  initialQueueStartBlocker,
  latestCommandBackedProjectionVersion,
  PROJECT_PURPOSE_MODE_OPTIONS,
  type AppendCommand,
  type CommandLogEntry,
  type ConnectionState,
  type ProjectionState
} from "./decision-queue-shell-model";

interface DecisionQueueSessionActionsProps {
  readonly answerDrafts: Record<string, string>;
  readonly appendCommand: AppendCommand;
  readonly businessCriticIntensity: BusinessCriticIntensity | null;
  readonly businessCriticIntensityChangeReason: string;
  readonly chatGptLoginAcknowledged: boolean;
  readonly codexLoginAuthenticated: boolean;
  readonly client: SidecarClient | null;
  readonly connectionStatus: ConnectionState["status"];
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
  onInitialQueueCreated
}: DecisionQueueSessionActionsProps) {
  const enableInitialResearchSources = useCallback(
    async (activeClient: SidecarClient, projectId: ProjectId) => {
      const response = await appendCommand(
        "Enable onboarding research sources",
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
        setWorkflowError(INITIAL_QUEUE_START_BLOCKER_MESSAGES[startBlocker]);
        return;
      }

      if (!client) {
        setWorkflowError(INITIAL_QUEUE_START_BLOCKER_MESSAGES.sidecar_connection);
        return;
      }

      if (!projectPurposeMode) {
        setWorkflowError(INITIAL_QUEUE_START_BLOCKER_MESSAGES.project_purpose);
        return;
      }

      if (projectPurposeMode === "business" && !businessCriticIntensity) {
        setWorkflowError(INITIAL_QUEUE_START_BLOCKER_MESSAGES.business_critic_intensity);
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
        const start = await appendCommand(
          "Create project",
          await client.createProject({
            rawIdea: idea,
            localPrivacyMode: "local_only",
            projectPurposeMode,
            projectPurposeModeConfirmation: "user_confirmed",
            projectPurposeModeReason: `${PROJECT_PURPOSE_MODE_LABELS[projectPurposeMode]}으로 사용자가 시작 전에 확인했습니다.`,
            ...(projectPurposeMode === "business" && businessCriticIntensity
              ? {
                  businessCriticIntensity,
                  businessCriticIntensityConfirmation: "user_confirmed" as const,
                  businessCriticIntensityReason:
                    initialBusinessCriticIntensityReason.trim() ||
                    `${BUSINESS_CRITIC_INTENSITY_LABELS[businessCriticIntensity]}으로 사용자가 시작 전에 확인했습니다.`
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
          "Capture intake",
          await client.captureIntake(session.sessionId, commandResponseVersion(start), intake)
        );
        const draftResponse = await appendCommand(
          "Draft initial spec",
          await client.draftInitialSpec(session.sessionId, commandResponseVersion(intakeResponse))
        );
        const analyzeResponse = await appendCommand(
          "Analyze ambiguity",
          await client.analyzeAmbiguity(session.sessionId, commandResponseVersion(draftResponse), "current_spec")
        );
        const activateResponse = await appendCommand(
          "Activate question batch",
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
      onInitialQueueCreated
    ]
  );

  const changeProjectPurposeMode = useCallback(
    async (nextMode: ProjectPurposeMode) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before changing the project purpose mode.");
        return;
      }

      if (nextMode === projections.session.projectPurposeMode) {
        setWorkflowError("Project purpose mode is already set to the selected value.");
        return;
      }

      const selectedOption = PROJECT_PURPOSE_MODE_OPTIONS.find((option) => option.mode === nextMode);
      const reason =
        purposeModeChangeReason.trim() ||
        `사용자가 프로젝트 목적을 ${selectedOption?.label ?? nextMode}으로 변경했습니다.`;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Change project purpose mode",
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
    [appendCommand, client, projections, purposeModeChangeReason, refreshProjections]
  );

  const changeBusinessCriticIntensity = useCallback(
    async (nextIntensity: BusinessCriticIntensity) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before changing the business critic intensity.");
        return;
      }

      if (projections.session.projectPurposeMode !== "business") {
        setWorkflowError("상업성 검증 강도는 사업화 검증 중심 프로젝트에서만 변경할 수 있습니다.");
        return;
      }

      const selectedOption = BUSINESS_CRITIC_INTENSITY_OPTIONS.find((option) => option.intensity === nextIntensity);
      const reason =
        businessCriticIntensityChangeReason.trim() ||
        `사용자가 상업성 검증 강도를 ${selectedOption?.label ?? nextIntensity}으로 변경했습니다.`;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Change business critic intensity",
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
    [appendCommand, businessCriticIntensityChangeReason, client, projections, refreshProjections]
  );

  const submitAnswer = useCallback(
    async (queueItemId: QueueItemId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before submitting an answer.");
        return;
      }

      const answer = answerDrafts[queueItemId]?.trim();

      if (!answer) {
        setWorkflowError("Answer text is required.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Submit answer",
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
        await refreshProjections(projections.session.projectId, projections.session.sessionId);
        await refetchQueueAfterSseNotification(projections.session.projectId, projections.session.sessionId, queue);
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [answerDrafts, appendCommand, client, projections, refetchQueueAfterSseNotification, refreshProjections]
  );

  const submitDraftedActiveAnswers = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before submitting drafted answers.");
      return;
    }

    const queueItemIds = draftedActiveQuestionAnswerIds(projections.queue, answerDrafts);

    if (!queueItemIds.length) {
      setWorkflowError("Write at least one active question answer before submitting drafted answers.");
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
          "Submit drafted answer",
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

      await refreshProjections(projections.session.projectId, projections.session.sessionId);

      if (latestQueue) {
        await refetchQueueAfterSseNotification(projections.session.projectId, projections.session.sessionId, latestQueue);
      }
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
          ? " Some drafted answers were submitted before the failure; the queue was refreshed."
          : " Some drafted answers were submitted before the failure; refresh the queue before continuing."
        : "";
      setWorkflowError(`${displayError(error)}${partialFailureNote}`);
    } finally {
      setIsBusy(false);
    }
  }, [answerDrafts, appendCommand, client, projections, refetchQueueAfterSseNotification, refreshProjections]);

  const refreshQuestionList = useCallback(async () => {
    if (!projections.session) {
      setWorkflowError("An active session is required before refreshing questions.");
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
  }, [projections.session, refreshProjections]);

  const loadNextQuestionBatch = useCallback(async () => {
    if (!client || !projections.session) {
      setWorkflowError("An active session is required before loading the next question list.");
      return;
    }

    if (projections.queue?.active.length) {
      setWorkflowError("Answer or save the current questions before loading the next question list.");
      return;
    }

    setIsBusy(true);
    setWorkflowError(null);

    try {
      const response = await appendCommand(
        "Load next questions",
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
  }, [appendCommand, client, projections, refetchQueueAfterSseNotification, refreshProjections]);

  const carryQueueItemAsKnownRisk = useCallback(
    async (queueItemId: QueueItemId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before carrying a queue item as a Known Risk.");
        return;
      }

      const nextValidationAction = knownRiskDrafts[queueItemId]?.trim();

      if (!nextValidationAction) {
        setWorkflowError("Next Validation Action is required to carry a business critic item as a Known Risk.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Carry as Known Risk",
          await client.deferQueueItem({
            sessionId: projections.session.sessionId,
            queueItemId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            reason: "사용자가 business critic item을 Known Risk로 이관했습니다.",
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
    [appendCommand, client, knownRiskDrafts, projections, refetchQueueAfterSseNotification, refreshProjections]
  );

  const importResearchResult = useCallback(
    async (researchTaskId: ResearchTaskId) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before importing research.");
        return;
      }

      const result = researchDrafts[researchTaskId]?.trim();

      if (!result) {
        setWorkflowError("Research result text is required.");
        return;
      }

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          "Import research result",
          await client.importResearchResult({
            sessionId: projections.session.sessionId,
            researchTaskId,
            expectedStateVersion: latestCommandBackedProjectionVersion(projections),
            result,
            sourceTitle: "Manual desk research",
            limitationNotes: "Manual import from founder-provided source."
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
    [appendCommand, client, projections, refreshProjections, researchDrafts]
  );

  const resolveResearchCard = useCallback(
    async (cardId: QueueItemId, outcome: ResearchQueueTerminalOutcome, title: string) => {
      if (!client || !projections.session) {
        setWorkflowError("An active session is required before resolving a research card.");
        return;
      }

      const needsRationale = outcome === "deferred" || outcome === "risk_accepted";
      const rationale = needsRationale
        ? `${outcome} from Research card: ${title}`
        : outcome === "revised" || outcome === "research_insufficient"
          ? `Resolved as ${outcome}: ${title}`
          : undefined;

      setIsBusy(true);
      setWorkflowError(null);

      try {
        const response = await appendCommand(
          `Resolve research card: ${outcome}`,
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
    [appendCommand, client, projections, refreshProjections]
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
