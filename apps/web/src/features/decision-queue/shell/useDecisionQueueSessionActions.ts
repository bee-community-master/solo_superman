import { type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import {
  type BusinessCriticIntensity,
  type ChatGptBrowserDelegationProjection,
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
  type StateVersion,
  type StatusEndpointDto
} from "@solo-superman/contracts";
import {
  commandResponseVersion,
  optionalCommandProjection,
  optionalCommandQueueProjection,
  requiredCommandProjection
} from "../../../shared/api/command-response-helpers";
import type { SidecarClient } from "../../../shared/api/sidecar-client";
import type { ResearchOperationsState } from "../Phase15aOperationsPanel";
import { draftedActiveQuestionAnswerIds, queueItemIsQuestionDebt } from "../decision-queue-view-model";
import { webPublicResearchAllowlistPolicy } from "../phase15a-research-run-request";
import {
  buildChatGptVisibleResultImportDelegationRequest,
  chatGptDelegationRunForResearchTask,
  importedResearchResultRefFromResponse,
  researchImportMetadataForTask
} from "../chatgpt-visible-research-import";
import {
  displayError,
  emptyProjectionState,
  emptyResearchOperationsState,
  initialResearchAutomationEnablesPublicWebSources,
  WEB_PUBLIC_SAFE_ALLOWLIST_ID,
  type InitialResearchAutomationPermission,
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
  readonly initialResearchAutomationPermission: InitialResearchAutomationPermission;
  readonly initialBusinessCriticIntensityReason: string;
  readonly intake: string;
  readonly isBusy: boolean;
  readonly knownRiskDrafts: Record<string, string>;
  readonly projectPurposeMode: ProjectPurposeMode | null;
  readonly projections: ProjectionState;
  readonly purposeModeChangeReason: string;
  readonly questionBatchSize: number;
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
  readonly generateInitialQuestionSet?: (
    input: GeneratedInitialQuestionSetInput,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<unknown | undefined>;
  readonly startReadyReadOnlyResearchRunsAfterAnswer?: () => Promise<void>;
  readonly onInitialQueueCreated?: () => void;
}

type InitialQuestionGenerationMode = "live_preview" | "local_fallback";
type InitialQuestionGenerationAction = "fallback" | "retry";
type InitialQuestionGenerationStatus = "idle" | "generating" | "delayed" | "fallback" | "retrying";

export interface InitialQuestionGenerationState {
  readonly status: InitialQuestionGenerationStatus;
  readonly delayed: boolean;
  readonly canUseFallback: boolean;
  readonly canRetry: boolean;
}

export interface GeneratedInitialQuestionSetInput {
  readonly sessionId: SessionShellProjection["sessionId"];
  readonly expectedStateVersion: StateVersion;
  readonly idea: string;
  readonly intake: string;
  readonly projectPurposeMode: ProjectPurposeMode;
  readonly businessCriticIntensity: BusinessCriticIntensity | null;
  readonly generationMode?: InitialQuestionGenerationMode;
}

export const MIN_QUESTION_BATCH_SIZE = 1;
export const MAX_QUESTION_BATCH_SIZE = 5;
export const DEFAULT_NEXT_QUESTION_BATCH_SIZE = MIN_QUESTION_BATCH_SIZE;
export const INITIAL_QUESTION_GENERATION_DELAY_MS = 30_000;

const INITIAL_QUESTION_GENERATION_IDLE: InitialQuestionGenerationState = {
  status: "idle",
  delayed: false,
  canUseFallback: false,
  canRetry: false
};

export function boundedQuestionBatchSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_NEXT_QUESTION_BATCH_SIZE;
  }

  return Math.min(MAX_QUESTION_BATCH_SIZE, Math.max(MIN_QUESTION_BATCH_SIZE, Math.trunc(value)));
}

function answerDraftsWithClearedItems(
  current: Record<string, string>,
  queueItemIds: readonly QueueItemId[]
) {
  return {
    ...current,
    ...Object.fromEntries(queueItemIds.map((queueItemId) => [queueItemId, ""]))
  };
}

async function generateInitialQuestionSetForAnalysis(
  client: SidecarClient,
  input: GeneratedInitialQuestionSetInput,
  override?: (
    input: GeneratedInitialQuestionSetInput,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<unknown | undefined>,
  options: {
    readonly generationMode?: InitialQuestionGenerationMode;
    readonly signal?: AbortSignal;
  } = {}
) {
  const generationMode = options.generationMode ?? input.generationMode ?? "live_preview";
  const requestOptions = options.signal ? { signal: options.signal } : undefined;

  if (override) {
    const generatedQuestionSet = await override({ ...input, generationMode }, requestOptions);

    if (generatedQuestionSet === undefined) {
      throw new Error("Codex question generation did not return a generated question set.");
    }

    return generatedQuestionSet;
  }

  const response = await client.generateInitialQuestionSet({
    sessionId: input.sessionId,
    expectedStateVersion: input.expectedStateVersion,
    rawIdea: input.idea,
    intakeGoal: input.intake,
    projectPurposeMode: input.projectPurposeMode,
    businessCriticIntensity: input.businessCriticIntensity,
    generationMode
  }, requestOptions);

  if (response.status !== "generated" || response.generatedQuestionSet === undefined) {
    throw new Error(response.reason ?? "Codex question generation is required before ambiguity analysis.");
  }

  return response.generatedQuestionSet;
}

export function nextQuestionBatchIdsForActivation(
  queue: DecisionQueueProjection | null | undefined,
  requestedBatchSize = DEFAULT_NEXT_QUESTION_BATCH_SIZE
) {
  const batchSize = boundedQuestionBatchSize(requestedBatchSize);
  const queueItemIds =
    queue?.next
      .filter(queueItemIsQuestionDebt)
      .slice(0, batchSize)
      .map((item) => item.queueItemId) ?? [];
  const openQuestionCount = queue?.progress?.openQuestionCount ?? queueItemIds.length;

  if (queueItemIds.length > 0 && queueItemIds.length < Math.min(MIN_QUESTION_BATCH_SIZE, openQuestionCount)) {
    return undefined;
  }

  return queueItemIds.length ? queueItemIds : undefined;
}

export function queueHasActiveQuestionDebt(queue: DecisionQueueProjection | null | undefined) {
  return queue?.active.some(queueItemIsQuestionDebt) ?? false;
}

function queueHasRemainingOpenQuestionDebt(queue: DecisionQueueProjection | null | undefined) {
  if (!queue) {
    return false;
  }

  if (queue.progress) {
    return queue.progress.openQuestionCount > queue.progress.activeQuestionCount;
  }

  return queue.next.some(queueItemIsQuestionDebt);
}

export function queueShouldAutoActivateNextQuestionBatch(
  queue: DecisionQueueProjection | null | undefined,
  requestedBatchSize = DEFAULT_NEXT_QUESTION_BATCH_SIZE
) {
  return !queueHasActiveQuestionDebt(queue) && (
    Boolean(nextQuestionBatchIdsForActivation(queue, requestedBatchSize)?.length) ||
    queueHasRemainingOpenQuestionDebt(queue)
  );
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
  initialResearchAutomationPermission,
  initialBusinessCriticIntensityReason,
  intake,
  isBusy,
  knownRiskDrafts,
  projectPurposeMode,
  projections,
  purposeModeChangeReason,
  questionBatchSize,
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
  generateInitialQuestionSet,
  startReadyReadOnlyResearchRunsAfterAnswer,
  onInitialQueueCreated
}: DecisionQueueSessionActionsProps) {
  const { initialQueueStartBlockers, sessionActionErrors, sessionActionLabels, sessionActionReasons } = copy.questions;
  const [initialQuestionGeneration, setInitialQuestionGeneration] = useState<InitialQuestionGenerationState>(
    INITIAL_QUESTION_GENERATION_IDLE
  );
  const initialQuestionDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialQuestionAttemptRef = useRef(0);
  const initialQuestionControlRef = useRef<{
    readonly attemptId: number;
    readonly abortController: AbortController;
    readonly resolveAction: (action: InitialQuestionGenerationAction) => void;
  } | null>(null);

  const clearInitialQuestionDelayTimer = useCallback(() => {
    if (initialQuestionDelayTimerRef.current) {
      clearTimeout(initialQuestionDelayTimerRef.current);
      initialQuestionDelayTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearInitialQuestionDelayTimer();
    initialQuestionControlRef.current?.abortController.abort();
    initialQuestionControlRef.current = null;
  }, [clearInitialQuestionDelayTimer]);

  const continueInitialQuestionGeneration = useCallback(() => {
    setInitialQuestionGeneration((current) => current.status === "delayed"
      ? {
          status: "generating",
          delayed: false,
          canUseFallback: true,
          canRetry: true
        }
      : current);
  }, []);

  const requestInitialQuestionFallback = useCallback(() => {
    const control = initialQuestionControlRef.current;

    if (!control) {
      return;
    }

    control.resolveAction("fallback");
    control.abortController.abort();
    initialQuestionControlRef.current = null;
    setInitialQuestionGeneration({
      status: "fallback",
      delayed: false,
      canUseFallback: false,
      canRetry: false
    });
  }, []);

  const retryInitialQuestionGeneration = useCallback(() => {
    const control = initialQuestionControlRef.current;

    if (!control) {
      return;
    }

    control.resolveAction("retry");
    control.abortController.abort();
    initialQuestionControlRef.current = null;
    setInitialQuestionGeneration({
      status: "retrying",
      delayed: false,
      canUseFallback: true,
      canRetry: false
    });
  }, []);

  const runInitialQuestionGenerationAttempt = useCallback(
    async (
      generationInput: GeneratedInitialQuestionSetInput,
      generationMode: InitialQuestionGenerationMode,
      status: Extract<InitialQuestionGenerationStatus, "generating" | "fallback" | "retrying">
    ): Promise<
      | { readonly kind: "generated"; readonly generatedQuestionSet: unknown }
      | { readonly kind: "action"; readonly action: InitialQuestionGenerationAction }
    > => {
      if (!client) {
        throw new Error(initialQueueStartBlockers.sidecar_connection);
      }

      const attemptId = initialQuestionAttemptRef.current + 1;
      initialQuestionAttemptRef.current = attemptId;
      const abortController = new AbortController();
      let resolveAction!: (action: InitialQuestionGenerationAction) => void;
      const actionPromise = new Promise<InitialQuestionGenerationAction>((resolve) => {
        resolveAction = resolve;
      });

      initialQuestionControlRef.current = {
        attemptId,
        abortController,
        resolveAction
      };
      clearInitialQuestionDelayTimer();
      setInitialQuestionGeneration({
        status,
        delayed: false,
        canUseFallback: generationMode === "live_preview",
        canRetry: generationMode === "live_preview"
      });

      if (generationMode === "live_preview") {
        initialQuestionDelayTimerRef.current = setTimeout(() => {
          if (initialQuestionControlRef.current?.attemptId !== attemptId) {
            return;
          }

          setInitialQuestionGeneration({
            status: "delayed",
            delayed: true,
            canUseFallback: true,
            canRetry: true
          });
        }, INITIAL_QUESTION_GENERATION_DELAY_MS);
      }

      const generatedPromise = generateInitialQuestionSetForAnalysis(
        client,
        generationInput,
        generateInitialQuestionSet,
        {
          generationMode,
          signal: abortController.signal
        }
      ).then(
        (generatedQuestionSet) => ({
          kind: "generated" as const,
          generatedQuestionSet
        }),
        (error) => ({
          kind: "error" as const,
          error
        })
      );
      const result = await Promise.race([
        generatedPromise,
        actionPromise.then((action) => ({ kind: "action" as const, action }))
      ]);

      if (result.kind === "error" && generationMode === "live_preview") {
        clearInitialQuestionDelayTimer();
        if (initialQuestionControlRef.current?.attemptId === attemptId) {
          setInitialQuestionGeneration({
            status: "delayed",
            delayed: true,
            canUseFallback: true,
            canRetry: true
          });
          const action = await actionPromise;
          if (initialQuestionControlRef.current?.attemptId === attemptId) {
            initialQuestionControlRef.current = null;
          }
          clearInitialQuestionDelayTimer();

          return { kind: "action", action };
        }
      }

      if (initialQuestionControlRef.current?.attemptId === attemptId) {
        initialQuestionControlRef.current = null;
      }
      clearInitialQuestionDelayTimer();

      if (result.kind === "error") {
        throw result.error;
      }

      return result;
    },
    [clearInitialQuestionDelayTimer, client, generateInitialQuestionSet, initialQueueStartBlockers.sidecar_connection]
  );

  const generateInitialQuestionSetWithControls = useCallback(
    async (generationInput: GeneratedInitialQuestionSetInput) => {
      let nextMode: InitialQuestionGenerationMode = "live_preview";
      let nextStatus: Extract<InitialQuestionGenerationStatus, "generating" | "fallback" | "retrying"> = "generating";

      for (;;) {
        const result = await runInitialQuestionGenerationAttempt(generationInput, nextMode, nextStatus);

        if (result.kind === "generated") {
          return result.generatedQuestionSet;
        }

        if (result.action === "fallback") {
          nextMode = "local_fallback";
          nextStatus = "fallback";
        } else {
          nextMode = "live_preview";
          nextStatus = "retrying";
        }
      }
    },
    [runInitialQuestionGenerationAttempt]
  );

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
        initialResearchAutomationPermission,
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
            initialResearchAutomationPermission,
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
        if (initialResearchAutomationEnablesPublicWebSources(initialResearchAutomationPermission)) {
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
        const generatedQuestionSet = await generateInitialQuestionSetWithControls({
          sessionId: session.sessionId,
          expectedStateVersion: commandResponseVersion(draftResponse),
          idea,
          intake,
          projectPurposeMode,
          businessCriticIntensity: projectPurposeMode === "business" ? businessCriticIntensity : null
        });
        const analyzeResponse = await appendCommand(
          sessionActionLabels.analyzeAmbiguity,
          await client.analyzeAmbiguity(
            session.sessionId,
            commandResponseVersion(draftResponse),
            "current_spec",
            generatedQuestionSet
          )
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
        clearInitialQuestionDelayTimer();
        initialQuestionControlRef.current = null;
        setInitialQuestionGeneration(INITIAL_QUESTION_GENERATION_IDLE);
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
      initialResearchAutomationPermission,
      client,
      clearInitialQuestionDelayTimer,
      enableInitialResearchSources,
      generateInitialQuestionSetWithControls,
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

  const continueQuestionLoopAfterQueueUpdate = useCallback(
    (
      projectId: ProjectId,
      sessionId: SessionShellProjection["sessionId"],
      expectedStateVersion: StateVersion,
      queue: DecisionQueueProjection | null
    ) => {
      void (async () => {
        try {
          await refreshProjections(projectId, sessionId);

          if (queue) {
            await refetchQueueAfterSseNotification(projectId, sessionId, queue);
          }

          if (client && queueShouldAutoActivateNextQuestionBatch(queue, questionBatchSize)) {
            const activateResponse = await appendCommand(
              sessionActionLabels.loadNextQuestions,
              await client.activateQuestionBatch(
                sessionId,
                expectedStateVersion,
                nextQuestionBatchIdsForActivation(queue, questionBatchSize)
              )
            );
            const activatedQueue = requiredCommandProjection<DecisionQueueProjection>(
              activateResponse,
              "DecisionQueueProjection"
            );

            setProjections((current) => ({
              ...current,
              queue: activatedQueue
            }));
            await refreshProjections(projectId, sessionId);
            await refetchQueueAfterSseNotification(projectId, sessionId, activatedQueue);
          }

          await startReadyReadOnlyResearchRunsAfterAnswer?.();
        } catch (error) {
          setWorkflowError(displayError(error));
        }
      })();
    },
    [
      appendCommand,
      client,
      refetchQueueAfterSseNotification,
      refreshProjections,
      questionBatchSize,
      sessionActionLabels.loadNextQuestions,
      setProjections,
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
        continueQuestionLoopAfterQueueUpdate(
          projections.session.projectId,
          projections.session.sessionId,
          commandResponseVersion(response),
          queue
        );
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
      continueQuestionLoopAfterQueueUpdate,
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

      continueQuestionLoopAfterQueueUpdate(
        projections.session.projectId,
        projections.session.sessionId,
        expectedStateVersion,
        latestQueue
      );
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
    continueQuestionLoopAfterQueueUpdate,
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

    if (queueHasActiveQuestionDebt(projections.queue)) {
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
          nextQuestionBatchIdsForActivation(projections.queue, questionBatchSize)
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
  }, [
    appendCommand,
    client,
    projections,
    questionBatchSize,
    refetchQueueAfterSseNotification,
    refreshProjections,
    sessionActionErrors,
    sessionActionLabels.loadNextQuestions,
    setIsBusy,
    setProjections,
    setWorkflowError
  ]);

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
        continueQuestionLoopAfterQueueUpdate(
          projections.session.projectId,
          projections.session.sessionId,
          commandResponseVersion(response),
          queue
        );
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      continueQuestionLoopAfterQueueUpdate,
      knownRiskDrafts,
      projections,
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
            ...researchImportMetadataForTask({
              delegation: projections.chatGptDelegation,
              researchTaskId,
              visibleChatGptHandoffAvailable:
                projections.session.initialResearchAutomationPermission === "allow_codex_and_chatgpt_visible",
              copy: {
                manualResearchSourceTitle: sessionActionReasons.manualResearchSourceTitle,
                manualResearchLimitationNotes: sessionActionReasons.manualResearchLimitationNotes,
                chatGptResearchSourceTitle: sessionActionReasons.chatGptResearchSourceTitle,
                chatGptResearchLimitationNotes: sessionActionReasons.chatGptResearchLimitationNotes
              }
            })
          })
        );
        const research = optionalCommandProjection<ResearchEvidenceProjection>(response, "ResearchEvidenceProjection");
        const queue = optionalCommandQueueProjection<DecisionQueueProjection>(response, "DecisionQueueProjection");
        let nextStateVersion = commandResponseVersion(response);
        const delegatedRun = chatGptDelegationRunForResearchTask({
          delegation: projections.chatGptDelegation,
          researchTaskId
        });
        const resultImportRef = importedResearchResultRefFromResponse(response, researchTaskId);
        const chatGptResultImportRequest = delegatedRun && resultImportRef
          ? buildChatGptVisibleResultImportDelegationRequest({
              expectedStateVersion: nextStateVersion,
              sessionId: projections.session.sessionId,
              run: delegatedRun,
              resultImportRef
            })
          : null;
        let chatGptDelegation: ChatGptBrowserDelegationProjection | null = null;

        if (chatGptResultImportRequest) {
          const delegationResponse = await appendCommand(
            sessionActionLabels.recordVisibleChatGptResearchResultImport,
            await client.createChatGptBrowserDelegationRun(chatGptResultImportRequest)
          );

          chatGptDelegation = optionalCommandProjection<ChatGptBrowserDelegationProjection>(
            delegationResponse,
            "ChatGptBrowserDelegationProjection"
          );
          nextStateVersion = commandResponseVersion(delegationResponse);
        }

        setResearchDrafts((current) => ({
          ...current,
          [researchTaskId]: ""
        }));
        if (research || queue || chatGptDelegation) {
          setProjections((current) => ({
            ...current,
            ...(research ? { research } : {}),
            ...(queue ? { queue } : {}),
            ...(chatGptDelegation ? { chatGptDelegation } : {})
          }));
        }
        if (queue) {
          continueQuestionLoopAfterQueueUpdate(
            projections.session.projectId,
            projections.session.sessionId,
            nextStateVersion,
            queue
          );
        } else {
          await refreshProjections(projections.session.projectId, projections.session.sessionId);
          void startReadyReadOnlyResearchRunsAfterAnswer?.();
        }
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      continueQuestionLoopAfterQueueUpdate,
      projections,
      refreshProjections,
      researchDrafts,
      sessionActionLabels,
      sessionActionErrors,
      sessionActionReasons,
      startReadyReadOnlyResearchRunsAfterAnswer
    ]
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
        continueQuestionLoopAfterQueueUpdate(
          projections.session.projectId,
          projections.session.sessionId,
          commandResponseVersion(response),
          queue
        );
      } catch (error) {
        setWorkflowError(displayError(error));
      } finally {
        setIsBusy(false);
      }
    },
    [
      appendCommand,
      client,
      continueQuestionLoopAfterQueueUpdate,
      projections,
      sessionActionErrors,
      sessionActionReasons
    ]
  );


  return {
    initialQuestionGeneration,
    continueInitialQuestionGeneration,
    requestInitialQuestionFallback,
    retryInitialQuestionGeneration,
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
