import { pathToFileURL } from "node:url";
import {
  CONTRACT_SCHEMA_VERSION,
  type CommandId,
  type CorrelationId,
  type EventId,
  type ProductEngineCommand,
  type ProductEngineCommandType,
  type ProductEngineEvent,
  type ProductEngineEventDraft,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type QueueItemProjection,
  type SessionId,
  type StateVersion
} from "@solo-superman/contracts";
import {
  createInitialProductEngineState,
  reduceProductEngineCommand,
  replayProductEngineEvents
} from "@solo-superman/core";

export const CLARIFICATION_VOLUME_SMOKE = "clarification_volume" as const;

const PROJECT_ID = "proj_clarification_volume_smoke" as ProjectId;
const SESSION_ID = "sess_clarification_volume_smoke" as SessionId;
const CORRELATION_ID = "corr_clarification_volume_smoke" as CorrelationId;
const TARGET_ANSWERED_QUESTION_COUNT = 200;
const MIN_INITIAL_FOLLOW_UP_BUDGET = 200;
const MAX_ANSWER_LOOP_ITERATIONS = 300;

type SmokeStatus = "blocked" | "passed";

type QueueProgressProjection = NonNullable<ProductEngineStateSnapshot["queueProjection"]["progress"]>;

interface CommandContext {
  readonly state: ProductEngineStateSnapshot;
  readonly events: readonly ProductEngineEvent[];
  readonly nextCommandIndex: number;
}

interface VolumeFlowResult {
  readonly state: ProductEngineStateSnapshot;
  readonly initialProgress: QueueProgressProjection;
  readonly answeredQuestionCountAtTarget: number;
  readonly maxActiveQuestionCount: number;
  readonly minActiveQuestionCountBeforeTarget: number;
  readonly stoppedBecauseActiveQueueWasEmpty: boolean;
  readonly finalEventCount: number;
}

export interface ClarificationVolumeSmokeEvidence {
  readonly status: SmokeStatus;
  readonly smoke: typeof CLARIFICATION_VOLUME_SMOKE;
  readonly mode: "fixture";
  readonly volume?: {
    readonly initialGeneratedQuestionCount: number;
    readonly initialFollowUpBudgetRemainingCount: number;
    readonly targetAnsweredQuestionCount: number;
    readonly answeredQuestionCountAtTarget: number;
    readonly finalGeneratedQuestionCount: number;
    readonly finalAnsweredQuestionCount: number;
    readonly finalFollowUpQuestionCount: number;
    readonly finalFollowUpBudgetRemainingCount: number;
    readonly maxRepeatDepth: number;
    readonly researchTaskCount: number;
    readonly maxActiveQuestionCount: number;
    readonly minActiveQuestionCountBeforeTarget: number;
    readonly finalCompletionPercent: number;
    readonly finalEventCount: number;
  };
  readonly reason?: string;
  readonly blockers?: readonly string[];
  readonly checked: readonly string[];
}

function issuedAtFor(index: number) {
  return new Date(Date.UTC(2026, 4, 23, 3, 0, index)).toISOString();
}

function stateVersionNumber(state: ProductEngineStateSnapshot) {
  return Number(state.stateVersion);
}

function command(input: {
  readonly commandType: ProductEngineCommandType;
  readonly expectedStateVersion: number;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly commandIndex: number;
}): ProductEngineCommand {
  return {
    commandId: `cmd_clarification_volume_${input.commandIndex}` as CommandId,
    commandType: input.commandType,
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    actor: "user",
    issuedAt: issuedAtFor(input.commandIndex),
    idempotencyKey: `${input.commandType}:clarification-volume:${input.commandIndex}`,
    expectedStateVersion: input.expectedStateVersion as StateVersion,
    causationId: null,
    correlationId: CORRELATION_ID,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    payload: input.payload ?? {}
  };
}

function persistedEventsForCommand(
  drafts: readonly ProductEngineEventDraft[],
  issuedAt: string,
  firstSequence: number
): readonly ProductEngineEvent[] {
  return drafts.map((draft, index) => ({
    ...draft,
    eventId: `evt_clarification_volume_${firstSequence + index}` as EventId,
    sequence: firstSequence + index,
    occurredAt: issuedAt
  }));
}

function applyCommand(
  context: CommandContext,
  commandType: ProductEngineCommandType,
  payload: Readonly<Record<string, unknown>> = {}
): CommandContext {
  const nextCommand = command({
    commandType,
    expectedStateVersion: stateVersionNumber(context.state),
    payload,
    commandIndex: context.nextCommandIndex
  });
  const reduction = reduceProductEngineCommand(nextCommand, context.state);

  if (!reduction.accepted) {
    throw new Error(`${commandType} rejected: ${JSON.stringify(reduction.rejectionReason)}`);
  }

  const events = [
    ...context.events,
    ...persistedEventsForCommand(reduction.events, nextCommand.issuedAt, context.events.length + 1)
  ];
  const state = replayProductEngineEvents(PROJECT_ID, SESSION_ID, events);

  return {
    state,
    events,
    nextCommandIndex: context.nextCommandIndex + 1
  };
}

function isQuestionDebtItem(item: QueueItemProjection) {
  return item.cardType === undefined || item.cardType === "question" || item.cardType === "follow_up_question";
}

function activeQuestionItems(state: ProductEngineStateSnapshot) {
  return state.queueProjection.active.filter(isQuestionDebtItem);
}

function queueProgress(state: ProductEngineStateSnapshot): QueueProgressProjection {
  const progress = state.queueProjection.progress;

  if (!progress) {
    throw new Error("Decision Queue progress projection is missing.");
  }

  return progress;
}

function answerPayload(item: QueueItemProjection, index: number): Readonly<Record<string, unknown>> {
  const routeHint = index % 3 === 0 ? "missing_con_evidence" : "research_needed";

  return {
    queueItemId: item.queueItemId,
    answer: [
      `Volume answer ${index} for ${item.topicKey ?? item.queueItemId}.`,
      "The target user, evidence threshold, success metric, and first implementation boundary are explicit.",
      "If contradictory evidence appears, the next build slice should narrow scope before implementation."
    ].join(" "),
    researchRouteHint: routeHint,
    claimImpact: "high",
    researchObjective: `Find source-traced evidence and counter-evidence for clarification volume answer ${index}.`
  };
}

function maxRepeatDepth(state: ProductEngineStateSnapshot) {
  return state.openIssues.reduce((maxDepth, issue) => Math.max(maxDepth, issue.repeatCount ?? 0), 0);
}

function runVolumeFlow(): VolumeFlowResult {
  let context: CommandContext = {
    state: createInitialProductEngineState(PROJECT_ID, SESSION_ID),
    events: [],
    nextCommandIndex: 1
  };

  for (const [commandType, payload] of [
    ["StartProject", {
      rawIdea: "A long-session founder clarification assistant that should survive hundreds of answers.",
      localPrivacyMode: "local_only",
      projectPurposeMode: "business",
      projectPurposeModeConfirmation: "user_confirmed",
      businessCriticIntensity: "balanced",
      businessCriticIntensityConfirmation: "user_confirmed"
    }],
    ["CaptureIntake", {
      answer: "Help founders answer hundreds of precise validation questions before committing to software implementation."
    }],
    ["DraftInitialSpec", {}],
    ["AnalyzeAmbiguity", { targetRef: "current_spec" }],
    ["ActivateQuestionBatch", {}]
  ] as const satisfies readonly (readonly [ProductEngineCommandType, Readonly<Record<string, unknown>>])[]) {
    context = applyCommand(context, commandType, payload);
  }

  const initialProgress = queueProgress(context.state);
  let answeredLoopIterations = 0;
  let answeredQuestionCountAtTarget = 0;
  let maxActiveQuestionCount = activeQuestionItems(context.state).length;
  let minActiveQuestionCountBeforeTarget = maxActiveQuestionCount;
  let stoppedBecauseActiveQueueWasEmpty = false;

  while (answeredLoopIterations < MAX_ANSWER_LOOP_ITERATIONS) {
    const activeQuestions = activeQuestionItems(context.state);
    maxActiveQuestionCount = Math.max(maxActiveQuestionCount, activeQuestions.length);

    if (queueProgress(context.state).answeredQuestionCount < TARGET_ANSWERED_QUESTION_COUNT) {
      minActiveQuestionCountBeforeTarget = Math.min(minActiveQuestionCountBeforeTarget, activeQuestions.length);
    }

    const nextQuestion = activeQuestions[0];

    if (!nextQuestion) {
      stoppedBecauseActiveQueueWasEmpty = true;
      break;
    }

    answeredLoopIterations += 1;
    context = applyCommand(
      context,
      "SubmitAnswer",
      answerPayload(nextQuestion, answeredLoopIterations)
    );

    if (
      answeredQuestionCountAtTarget === 0 &&
      queueProgress(context.state).answeredQuestionCount >= TARGET_ANSWERED_QUESTION_COUNT
    ) {
      answeredQuestionCountAtTarget = queueProgress(context.state).answeredQuestionCount;
    }
  }

  return {
    state: context.state,
    initialProgress,
    answeredQuestionCountAtTarget,
    maxActiveQuestionCount,
    minActiveQuestionCountBeforeTarget,
    stoppedBecauseActiveQueueWasEmpty,
    finalEventCount: context.events.length
  };
}

function flowBlockers(result: VolumeFlowResult) {
  const blockers: string[] = [];
  const finalProgress = queueProgress(result.state);
  const depth = maxRepeatDepth(result.state);

  if (result.initialProgress.generatedQuestionCount < 10) {
    blockers.push("initial ambiguity analysis must generate a broad base question set.");
  }

  if (result.initialProgress.followUpBudgetRemainingCount < MIN_INITIAL_FOLLOW_UP_BUDGET) {
    blockers.push(
      `initial follow-up budget must support 200+ answers; received ${result.initialProgress.followUpBudgetRemainingCount}`
    );
  }

  if (result.answeredQuestionCountAtTarget < TARGET_ANSWERED_QUESTION_COUNT) {
    blockers.push(
      `clarification loop must answer at least ${TARGET_ANSWERED_QUESTION_COUNT} questions before active debt is exhausted; received ${result.answeredQuestionCountAtTarget || finalProgress.answeredQuestionCount}`
    );
  }

  if (finalProgress.generatedQuestionCount < TARGET_ANSWERED_QUESTION_COUNT) {
    blockers.push(`generated question count must reach 200+; received ${finalProgress.generatedQuestionCount}`);
  }

  if (finalProgress.followUpQuestionCount < MIN_INITIAL_FOLLOW_UP_BUDGET) {
    blockers.push(`follow-up question count must reach 200+ budget scale; received ${finalProgress.followUpQuestionCount}`);
  }

  if (result.minActiveQuestionCountBeforeTarget < 1) {
    blockers.push("active batch refill must keep at least one answerable question before the 200-answer target.");
  }

  if (result.maxActiveQuestionCount > 5) {
    blockers.push(`active batch must remain bounded to five questions; observed ${result.maxActiveQuestionCount}`);
  }

  if (depth < 16) {
    blockers.push(`follow-up chain depth must reach 16; received ${depth}`);
  }

  if (result.state.researchState.tasks.length < TARGET_ANSWERED_QUESTION_COUNT) {
    blockers.push(`each volume answer should create durable research debt; received ${result.state.researchState.tasks.length}`);
  }

  if (!result.stoppedBecauseActiveQueueWasEmpty) {
    blockers.push("volume loop should exhaust answerable question debt before the guard limit.");
  }

  if (finalProgress.completionPercent !== 100 || finalProgress.openQuestionCount !== 0) {
    blockers.push("final question progress must reach 100% with no open question debt.");
  }

  return blockers;
}

function passedEvidence(result: VolumeFlowResult): ClarificationVolumeSmokeEvidence {
  const finalProgress = queueProgress(result.state);

  return {
    status: "passed",
    smoke: CLARIFICATION_VOLUME_SMOKE,
    mode: "fixture",
    volume: {
      initialGeneratedQuestionCount: result.initialProgress.generatedQuestionCount,
      initialFollowUpBudgetRemainingCount: result.initialProgress.followUpBudgetRemainingCount,
      targetAnsweredQuestionCount: TARGET_ANSWERED_QUESTION_COUNT,
      answeredQuestionCountAtTarget: result.answeredQuestionCountAtTarget,
      finalGeneratedQuestionCount: finalProgress.generatedQuestionCount,
      finalAnsweredQuestionCount: finalProgress.answeredQuestionCount,
      finalFollowUpQuestionCount: finalProgress.followUpQuestionCount,
      finalFollowUpBudgetRemainingCount: finalProgress.followUpBudgetRemainingCount,
      maxRepeatDepth: maxRepeatDepth(result.state),
      researchTaskCount: result.state.researchState.tasks.length,
      maxActiveQuestionCount: result.maxActiveQuestionCount,
      minActiveQuestionCountBeforeTarget: result.minActiveQuestionCountBeforeTarget,
      finalCompletionPercent: finalProgress.completionPercent,
      finalEventCount: result.finalEventCount
    },
    checked: [
      "core ProductEngine long-session fixture started without external services",
      "business-mode ambiguity analysis produced a broad base backlog",
      "initial follow-up budget supports 200+ answerable questions",
      "active batch stayed bounded to five visible questions",
      "active batch refilled until at least 200 answers were accepted",
      "follow-up chains reached depth 16 without duplicate-topic rejection",
      "every accepted answer created durable research task debt",
      "question progress reached 100% after answerable debt was exhausted"
    ]
  };
}

function blockedEvidence(result: VolumeFlowResult, blockers: readonly string[]): ClarificationVolumeSmokeEvidence {
  return {
    ...passedEvidence(result),
    status: "blocked",
    reason: "Clarification volume smoke did not satisfy every long-session fixture check.",
    blockers
  };
}

function errorEvidence(error: unknown): ClarificationVolumeSmokeEvidence {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "blocked",
    smoke: CLARIFICATION_VOLUME_SMOKE,
    mode: "fixture",
    reason: "Clarification volume smoke failed before full evidence could be collected.",
    blockers: [message],
    checked: ["core ProductEngine clarification volume smoke started"]
  };
}

export async function runClarificationVolumeSmoke(): Promise<ClarificationVolumeSmokeEvidence> {
  try {
    const result = runVolumeFlow();
    const blockers = flowBlockers(result);

    return blockers.length ? blockedEvidence(result, blockers) : passedEvidence(result);
  } catch (error: unknown) {
    return errorEvidence(error);
  }
}

function exitCodeForEvidence(evidence: ClarificationVolumeSmokeEvidence) {
  return evidence.status === "passed" ? 0 : 1;
}

async function main() {
  const evidence = await runClarificationVolumeSmoke();

  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = exitCodeForEvidence(evidence);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
