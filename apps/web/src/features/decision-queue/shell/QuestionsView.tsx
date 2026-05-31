import { useState } from "react";
import type { AmbiguityAnswerSelectionMode, QueueItemProjection } from "@solo-superman/contracts";
import {
  draftedActiveQuestionAnswerIds,
  questionFatigueViewModel,
  queueItemIsQuestionDebt
} from "../decision-queue-view-model";
import { isBusinessCriticQueueItem } from "./decision-queue-shell-model";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";
import { boundedQuestionBatchSize, MIN_QUESTION_BATCH_SIZE, MAX_QUESTION_BATCH_SIZE } from "./useDecisionQueueSessionActions";

interface QuestionsViewProps {
  readonly controller: DecisionQueueShellController;
}

type DecisionQueueCopy = ReturnType<typeof useDecisionQueueCopy>;

function businessCriticSummary(copy: DecisionQueueCopy, item: QueueItemProjection) {
  return [
    item.businessCriticCategory ? copy.questions.businessCriticCategoryLabels[item.businessCriticCategory] : undefined,
    item.businessCriticPressureKind
      ? copy.questions.businessCriticPressureKindLabels[item.businessCriticPressureKind]
      : undefined,
    item.businessCriticIntensity
      ? copy.businessCriticIntensityOptions.find((option) => option.intensity === item.businessCriticIntensity)?.label
      : undefined
  ]
    .filter(Boolean)
    .join(" · ");
}

function boundedPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function researchFollowUpSourceTrace(item: QueueItemProjection) {
  return item.cardType === "follow_up_question" && item.sourceRef?.startsWith("research:")
    ? item.sourceRef
    : null;
}

export function answerDraftFromSelectedOptions(
  answerOptions: NonNullable<QueueItemProjection["answerOptions"]>,
  selectedOptionIds: readonly string[],
  answerSelectionMode: AmbiguityAnswerSelectionMode
) {
  const optionValueById = new Map(answerOptions.map((option) => [option.id, option.value]));
  const selectedOptionValues = selectedOptionIds
    .map((optionId) => optionValueById.get(optionId))
    .filter((value): value is string => value !== undefined);

  if (answerSelectionMode === "ranked") {
    return selectedOptionValues.map((value, index) => `${index + 1}. ${value}`).join("\n");
  }

  return selectedOptionValues.join("\n");
}

export function answerDraftFromSelectionAndNote(
  answerOptions: NonNullable<QueueItemProjection["answerOptions"]>,
  selectedOptionIds: readonly string[],
  answerSelectionMode: AmbiguityAnswerSelectionMode,
  note: string
) {
  return [
    answerDraftFromSelectedOptions(answerOptions, selectedOptionIds, answerSelectionMode),
    note.trim()
  ]
    .filter(Boolean)
    .join("\n\n");
}

type AnswerFormatKind =
  | "open_text"
  | "binary_choice"
  | "single_choice"
  | "multi_select"
  | "ranked_choice"
  | "evidence_judgment"
  | "experiment_plan";

function answerLooksLikeBinaryChoice(item: QueueItemProjection) {
  const answerOptions = item.answerOptions ?? [];
  const binaryOptionCount = answerOptions.filter((option) =>
    /(?:찬성|반대|찬반|동의|비동의|예\s*[/·또는과]*\s*아니오|\b(?:yes|no|agree|disagree|support|oppose)\b)/iu.test(
      [option.id, option.label, option.value].join(" ")
    )
  ).length;

  return binaryOptionCount >= 2;
}

function answerFormatKindForItem(item: QueueItemProjection): AnswerFormatKind {
  if (item.answerSelectionMode === "multiple") {
    return "multi_select";
  }

  if (item.answerSelectionMode === "ranked") {
    return "ranked_choice";
  }

  if (item.expectedAnswerType === "text") {
    return "open_text";
  }

  if (item.expectedAnswerType === "rank") {
    return "ranked_choice";
  }

  if (item.expectedAnswerType === "experiment") {
    return "experiment_plan";
  }

  if (item.expectedAnswerType === "evidence") {
    return "evidence_judgment";
  }

  if (!item.answerOptions?.length) {
    return "open_text";
  }

  return answerLooksLikeBinaryChoice(item) ? "binary_choice" : "single_choice";
}

function answerSelectionModeForItem(item: QueueItemProjection): AmbiguityAnswerSelectionMode {
  return item.answerSelectionMode ?? (item.expectedAnswerType === "rank" ? "ranked" : "single");
}

function answerOptionInputType(answerSelectionMode: AmbiguityAnswerSelectionMode) {
  return answerSelectionMode === "single" ? "radio" : "checkbox";
}

function questionLoopNextAction(copy: DecisionQueueCopy, input: {
  readonly activeQuestionCount: number;
  readonly blockedQuestionCount: number;
  readonly draftedActiveAnswerCount: number;
  readonly hasActiveSession: boolean;
  readonly openQuestionCount: number;
  readonly questionBatchSize: number;
  readonly upcomingQuestionCount: number;
}) {
  if (!input.hasActiveSession) {
    return copy.questions.questionLoopNextActionStart;
  }

  if (input.draftedActiveAnswerCount > 0) {
    return copy.questions.questionLoopNextActionDrafted(input.draftedActiveAnswerCount);
  }

  if (input.activeQuestionCount > 0) {
    return copy.questions.questionLoopNextActionActive(input.activeQuestionCount);
  }

  if (input.openQuestionCount > 0) {
    return copy.questions.questionLoopNextActionLoadNext(
      Math.min(input.questionBatchSize, Math.max(input.upcomingQuestionCount, 1))
    );
  }

  if (input.blockedQuestionCount > 0) {
    return copy.questions.questionLoopNextActionBlocked(input.blockedQuestionCount);
  }

  return copy.questions.questionLoopNextActionComplete;
}

function ResearchFollowUpSourceTrace({
  copy,
  item
}: {
  readonly copy: DecisionQueueCopy;
  readonly item: QueueItemProjection;
}) {
  const sourceTrace = researchFollowUpSourceTrace(item);

  return sourceTrace ? (
    <p className="research-source-trace">
      {copy.questions.researchFollowUpSourceTrace}: <code>{sourceTrace}</code>
    </p>
  ) : null;
}

function QuestionPromptBlock({
  copy,
  item
}: {
  readonly copy: DecisionQueueCopy;
  readonly item: QueueItemProjection;
}) {
  const context = item.questionContext;

  if (!context || (!context.idea && !context.goal)) {
    return <h4>{item.title}</h4>;
  }

  const { goal, idea } = context;

  return (
    <section className="question-prompt-block" aria-label={copy.questions.questionContextTitle}>
      <p className="question-prompt-block__title">{copy.questions.questionContextTitle}</p>
      <dl className="question-prompt-block__rows">
        {idea ? (
          <div>
            <dt>{copy.questions.questionContextIdea} -</dt>
            <dd>"{idea}"</dd>
          </div>
        ) : null}
        {goal ? (
          <div>
            <dt>{copy.questions.questionContextGoal} -</dt>
            <dd>"{goal}"</dd>
          </div>
        ) : null}
        <div className="question-prompt-block__question">
          <dt>{copy.questions.questionContextQuestion} -</dt>
          <dd>
            <h4>{item.title}</h4>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function QuestionsView({ controller }: QuestionsViewProps) {
  const copy = useDecisionQueueCopy();
  const [selectedAnswerOptionIds, setSelectedAnswerOptionIds] = useState<Record<string, readonly string[]>>({});
  const [answerOptionNotes, setAnswerOptionNotes] = useState<Record<string, string>>({});
  const {
    answerDrafts,
    carryQueueItemAsKnownRisk,
    isBusy,
    knownRiskDrafts,
    loadNextQuestionBatch,
    projections,
    questionBatchSize,
    questionProgress,
    queueRecovery,
    refreshQuestionList,
    sections,
    setAnswerDrafts,
    setQuestionBatchSize,
    setKnownRiskDrafts,
    submitAnswer,
    submitDraftedActiveAnswers
  } = controller;
  const completionPercent = boundedPercent(questionProgress.completionPercent);
  const questionFatigue = questionFatigueViewModel(questionProgress);
  const draftedActiveAnswerCount = draftedActiveQuestionAnswerIds(projections.queue, answerDrafts).length;
  const nextQuestionLoopAction = questionLoopNextAction(copy, {
    activeQuestionCount: questionProgress.activeQuestionCount,
    blockedQuestionCount: questionProgress.blockedQuestionCount,
    draftedActiveAnswerCount,
    hasActiveSession: Boolean(projections.session),
    openQuestionCount: questionProgress.openQuestionCount,
    questionBatchSize: boundedQuestionBatchSize(questionBatchSize),
    upcomingQuestionCount: questionProgress.upcomingQuestionCount
  });

  return (
    <div className="view-grid questions-view">
      <section className="panel queue-panel">
        <div className="panel-heading">
          <h2>{copy.questions.queue}</h2>
          <span>{copy.questions.queueRecoveryStatusLabels[queueRecovery.status]} · v{projections.queue?.version ?? 0}</span>
        </div>
        <div className="card-actions panel-actions">
          <button type="button" disabled={isBusy || !projections.session} onClick={() => void refreshQuestionList()}>
            {copy.questions.refreshQuestionList}
          </button>
          <button
            type="button"
            disabled={isBusy || !projections.session || Boolean(projections.queue?.active.length)}
            onClick={() => void loadNextQuestionBatch()}
          >
            {copy.questions.loadNextQuestions}
          </button>
          <label className="inline-control">
            <span>{copy.questions.questionBatchSizeLabel}</span>
            <select
              aria-label={copy.questions.questionBatchSizeLabel}
              disabled={isBusy}
              onChange={(event) => setQuestionBatchSize(boundedQuestionBatchSize(Number(event.target.value)))}
              value={boundedQuestionBatchSize(questionBatchSize)}
            >
              {Array.from(
                { length: MAX_QUESTION_BATCH_SIZE - MIN_QUESTION_BATCH_SIZE + 1 },
                (_, index) => MIN_QUESTION_BATCH_SIZE + index
              ).map((size) => (
                <option key={size} value={size}>
                  {copy.questions.questionBatchSizeOption(size)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={isBusy || !projections.session || draftedActiveAnswerCount === 0}
            onClick={() => void submitDraftedActiveAnswers()}
          >
            {copy.questions.submitDraftedAnswers(draftedActiveAnswerCount)}
          </button>
        </div>
        <p className="mode-help">{copy.questions.questionBatchSizeHelp}</p>
        <section className="question-loop-next-action" aria-label={copy.questions.questionLoopNextActionTitle}>
          <strong>{copy.questions.questionLoopNextActionTitle}</strong>
          <p>{nextQuestionLoopAction}</p>
        </section>
        <div className="queue-recovery">
          <p>{queueRecovery.label}</p>
          <small>{queueRecovery.activeBatchLabel}</small>
          <small>{queueRecovery.refetchLabel}</small>
          <small>{queueRecovery.sseLabel}</small>
        </div>
        <section className="question-progress" aria-label={copy.questions.questionProgressTitle}>
          <div>
            <h3>{copy.questions.questionProgressTitle}</h3>
            <p>
              {copy.questions.questionProgressSummary(
                questionProgress.terminalQuestionCount,
                questionProgress.generatedQuestionCount,
                completionPercent
              )}
            </p>
          </div>
          <div className="question-progress-track" aria-hidden="true">
            <span style={{ width: `${completionPercent}%` }} />
          </div>
          <dl className="question-progress-metrics">
            <div>
              <dt>{copy.questions.questionProgressGenerated}</dt>
              <dd>{questionProgress.generatedQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressOpen}</dt>
              <dd>{questionProgress.openQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressVisible}</dt>
              <dd>{questionProgress.visibleQuestionDebtCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressActive}</dt>
              <dd>{questionProgress.activeQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressUpcoming}</dt>
              <dd>{questionProgress.upcomingQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressAnswered}</dt>
              <dd>{questionProgress.answeredQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressFollowUps}</dt>
              <dd>{questionProgress.followUpQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressOpenFollowUps}</dt>
              <dd>{questionProgress.followUpOpenQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressTopics}</dt>
              <dd>{questionProgress.topicCoverageCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressOpenTopics}</dt>
              <dd>{questionProgress.openTopicCoverageCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressFollowUpBudget}</dt>
              <dd>{questionProgress.followUpBudgetRemainingCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressBlocked}</dt>
              <dd>{questionProgress.blockedQuestionCount}</dd>
            </div>
            <div>
              <dt>{copy.questions.questionProgressBacklog}</dt>
              <dd>{questionProgress.backlogQuestionCount}</dd>
            </div>
          </dl>
        </section>
        {questionFatigue.shouldShow ? (
          <section
            className={`question-fatigue-checkpoint level-${questionFatigue.level}`}
            aria-label={copy.questions.questionFatigueStatusLabels[questionFatigue.level]}
          >
            <strong>{copy.questions.questionFatigueStatusLabels[questionFatigue.level]}</strong>
            <p>
              {copy.questions.questionFatigueSummary(
                questionFatigue.openQuestionCount,
                questionFatigue.generatedQuestionCount,
                questionFatigue.completionPercent
              )}
            </p>
            <p>{copy.questions.questionFatigueHelp}</p>
            <small>
              {copy.questions.questionFatigueFollowUpBudget(questionFatigue.followUpBudgetRemainingCount)}
            </small>
          </section>
        ) : null}
        <div className="queue-sections">
          {sections.map((section) => (
            <section className="queue-section" key={section.id}>
              <div className="queue-section-heading">
                <h3>{section.title}</h3>
                <span>{section.items.length}</span>
              </div>
              {section.items.length ? (
                <div className="queue-list">
                  {section.items.map((item) => {
                    const answerSelectionMode = answerSelectionModeForItem(item);
                    const answerFormatKind = answerFormatKindForItem(item);
                    const answerOptions = item.answerOptions ?? [];
                    const selectedOptionIds = selectedAnswerOptionIds[item.queueItemId] ?? [];
                    const hasAnswerOptions = answerOptions.length > 0;
                    const answerOptionNote = answerOptionNotes[item.queueItemId] ?? "";
                    const composedAnswerPreview = hasAnswerOptions ? answerDrafts[item.queueItemId]?.trim() ?? "" : "";
                    const suggestedAnswersHelp =
                      answerSelectionMode === "ranked"
                        ? copy.questions.suggestedAnswersRankedHelp
                        : answerSelectionMode === "multiple"
                        ? copy.questions.suggestedAnswersMultipleHelp
                        : copy.questions.suggestedAnswersSingleHelp;
                    const answerOptionDetailLabels = copy.questions.answerOptionDetailLabels[answerFormatKind];
                    const canCarryAsKnownRisk = queueItemIsQuestionDebt(item) && item.state !== "deferred";

                    return (
                    <article className={`queue-card ${item.state}`} key={item.queueItemId}>
                      <div>
                        <span>{copy.questions.queueItemStateLabels[item.state]}</span>
                        <QuestionPromptBlock copy={copy} item={item} />
                        {isBusinessCriticQueueItem(item) ? (
                          <p className="mode-summary">
                            {businessCriticSummary(copy, item)}
                          </p>
                        ) : null}
                        {item.whyItMatters || item.decisionItUnlocks ? (
                          <dl className="question-coaching-context">
                            {item.whyItMatters ? (
                              <div>
                                <dt>{copy.questions.whyItMatters}</dt>
                                <dd>{item.whyItMatters}</dd>
                              </div>
                            ) : null}
                            {item.decisionItUnlocks ? (
                              <div>
                                <dt>{copy.questions.decisionItUnlocks}</dt>
                                <dd>{item.decisionItUnlocks}</dd>
                              </div>
                            ) : null}
                          </dl>
                        ) : null}
                        {item.nextValidationAction ? (
                          <p className="research-recovery">{copy.questions.nextValidation}: {item.nextValidationAction}</p>
                        ) : null}
                        <ResearchFollowUpSourceTrace copy={copy} item={item} />
                        {item.additionalQuestions?.length ? (
                          <div className="research-additional-questions">
                            <p>{copy.questions.researchAdditionalQuestions}</p>
                            <ul>
                              {item.additionalQuestions.map((question) => (
                                <li key={question}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      {section.id === "active" && item.state === "active" ? (
                        <div className="answer-box">
                          <p className="answer-format-help">
                            <strong>{copy.questions.answerFormatLabels[answerFormatKind]}</strong>
                            <span>{copy.questions.answerFormatDescriptions[answerFormatKind]}</span>
                          </p>
                          {hasAnswerOptions ? (
                            <fieldset className="answer-choice-fieldset">
                              <legend>{copy.questions.answerChoiceLabels[answerFormatKind]}</legend>
                              <p className="answer-choice-help">{suggestedAnswersHelp}</p>
                              <div className="answer-choice-list">
                                {answerOptions.map((option) => (
                                  <label className="answer-choice-option" key={option.id}>
                                    <input
                                      checked={selectedOptionIds.includes(option.id)}
                                      name={`answer-option-${item.queueItemId}`}
                                      onChange={() => {
                                        const nextSelectedOptionIds =
                                          answerSelectionMode === "multiple" || answerSelectionMode === "ranked"
                                            ? selectedOptionIds.includes(option.id)
                                              ? selectedOptionIds.filter((selectedOptionId) => selectedOptionId !== option.id)
                                              : [...selectedOptionIds, option.id]
                                            : [option.id];
                                        setSelectedAnswerOptionIds((current) => ({
                                          ...current,
                                          [item.queueItemId]: nextSelectedOptionIds
                                        }));
                                        setAnswerDrafts((current) => ({
                                          ...current,
                                          [item.queueItemId]: answerDraftFromSelectionAndNote(
                                            answerOptions,
                                            nextSelectedOptionIds,
                                            answerSelectionMode,
                                            answerOptionNote
                                          )
                                        }));
                                      }}
                                      type={answerOptionInputType(answerSelectionMode)}
                                      value={option.id}
                                    />
                                    <span>
                                      <strong>{option.label}</strong>
                                      <small className="answer-choice-option-details">
                                        <span>{answerOptionDetailLabels.primary}: {option.primaryDetail ?? option.pro}</span>
                                        <span>{answerOptionDetailLabels.secondary}: {option.secondaryDetail ?? option.con}</span>
                                      </small>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          ) : null}
                          <label className="custom-answer-field">
                            <span>
                              {hasAnswerOptions ? copy.questions.customAnswer : copy.questions.answerAriaPrefix}
                            </span>
                            <textarea
                              aria-label={`${copy.questions.answerAriaPrefix} ${item.title}`}
                              placeholder={
                                hasAnswerOptions ? copy.questions.customAnswerPlaceholder : undefined
                              }
                              value={hasAnswerOptions ? answerOptionNote : answerDrafts[item.queueItemId] ?? ""}
                              onChange={(event) => {
                                const nextNote = event.target.value;

                                if (hasAnswerOptions) {
                                  setAnswerOptionNotes((current) => ({
                                    ...current,
                                    [item.queueItemId]: nextNote
                                  }));
                                  setAnswerDrafts((current) => ({
                                    ...current,
                                    [item.queueItemId]: answerDraftFromSelectionAndNote(
                                      answerOptions,
                                      selectedOptionIds,
                                      answerSelectionMode,
                                      nextNote
                                    )
                                  }));

                                  return;
                                }

                                setAnswerDrafts((current) => ({
                                  ...current,
                                  [item.queueItemId]: nextNote
                                }));
                              }}
                              rows={3}
                            />
                          </label>
                          {composedAnswerPreview ? (
                            <div className="composed-answer-preview">
                              <strong>{copy.questions.composedAnswerPreview}</strong>
                              <p>{copy.questions.composedAnswerPreviewHelp}</p>
                              <pre>{composedAnswerPreview}</pre>
                            </div>
                          ) : null}
                          <button type="button" disabled={isBusy} onClick={() => void submitAnswer(item.queueItemId)}>
                            {copy.questions.submitAnswer}
                          </button>
                        </div>
                      ) : null}
                      {canCarryAsKnownRisk ? (
                        <details className="answer-box risk-details">
                          <summary>{copy.questions.additionalRiskDetails}</summary>
                          <p className="mode-help">{copy.questions.additionalRiskHelp}</p>
                          <textarea
                            aria-label={`${copy.questions.nextValidationActionAriaPrefix} ${item.title}`}
                            value={knownRiskDrafts[item.queueItemId] ?? ""}
                            onChange={(event) =>
                              setKnownRiskDrafts((current) => ({
                                ...current,
                                [item.queueItemId]: event.target.value
                              }))
                            }
                            placeholder={copy.questions.knownRiskPlaceholder}
                            rows={2}
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void carryQueueItemAsKnownRisk(item.queueItemId)}
                          >
                            {copy.questions.carryAsKnownRisk}
                          </button>
                        </details>
                      ) : null}
                    </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">{section.emptyLabel}</p>
              )}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
