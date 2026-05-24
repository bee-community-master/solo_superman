import { useState } from "react";
import type { QueueItemProjection } from "@solo-superman/contracts";
import { draftedActiveQuestionAnswerIds, questionFatigueViewModel } from "../decision-queue-view-model";
import { isBusinessCriticQueueItem } from "./decision-queue-shell-model";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

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

function answerDraftFromSelectedOptions(
  answerOptions: NonNullable<QueueItemProjection["answerOptions"]>,
  selectedOptionIds: readonly string[]
) {
  return answerOptions
    .filter((option) => selectedOptionIds.includes(option.id))
    .map((option) => option.value)
    .join("\n");
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

export function QuestionsView({ controller }: QuestionsViewProps) {
  const copy = useDecisionQueueCopy();
  const [selectedAnswerOptionIds, setSelectedAnswerOptionIds] = useState<Record<string, readonly string[]>>({});
  const {
    answerDrafts,
    carryQueueItemAsKnownRisk,
    isBusy,
    knownRiskDrafts,
    loadNextQuestionBatch,
    projections,
    questionProgress,
    queueRecovery,
    refreshQuestionList,
    sections,
    setAnswerDrafts,
    setKnownRiskDrafts,
    submitAnswer,
    submitDraftedActiveAnswers
  } = controller;
  const completionPercent = boundedPercent(questionProgress.completionPercent);
  const questionFatigue = questionFatigueViewModel(questionProgress);
  const draftedActiveAnswerCount = draftedActiveQuestionAnswerIds(projections.queue, answerDrafts).length;

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
          <button
            type="button"
            disabled={isBusy || !projections.session || draftedActiveAnswerCount === 0}
            onClick={() => void submitDraftedActiveAnswers()}
          >
            {copy.questions.submitDraftedAnswers(draftedActiveAnswerCount)}
          </button>
        </div>
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
                    const answerSelectionMode = item.answerSelectionMode ?? "single";
                    const selectedOptionIds = selectedAnswerOptionIds[item.queueItemId] ?? [];
                    const suggestedAnswersHelp =
                      answerSelectionMode === "multiple"
                        ? copy.questions.suggestedAnswersMultipleHelp
                        : copy.questions.suggestedAnswersSingleHelp;

                    return (
                    <article className={`queue-card ${item.state}`} key={item.queueItemId}>
                      <div>
                        <span>{copy.questions.queueItemStateLabels[item.state]}</span>
                        <h4>{item.title}</h4>
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
                          {item.answerOptions?.length ? (
                            <fieldset className="answer-choice-fieldset">
                              <legend>{copy.questions.suggestedAnswers}</legend>
                              <p className="answer-choice-help">{suggestedAnswersHelp}</p>
                              <div className="answer-choice-list">
                                {item.answerOptions.map((option) => (
                                  <label className="answer-choice-option" key={option.id}>
                                    <input
                                      checked={selectedOptionIds.includes(option.id)}
                                      name={`answer-option-${item.queueItemId}`}
                                      onChange={() => {
                                        const nextSelectedOptionIds =
                                          answerSelectionMode === "multiple"
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
                                          [item.queueItemId]: answerDraftFromSelectedOptions(item.answerOptions ?? [], nextSelectedOptionIds)
                                        }));
                                      }}
                                      type={answerSelectionMode === "multiple" ? "checkbox" : "radio"}
                                      value={option.id}
                                    />
                                    <span>
                                      <strong>{option.label}</strong>
                                      <small>
                                        {copy.questions.optionPro}: {option.pro} · {copy.questions.optionCon}: {option.con}
                                      </small>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          ) : null}
                          <label className="custom-answer-field">
                            <span>
                              {item.answerOptions?.length ? copy.questions.customAnswer : copy.questions.answerAriaPrefix}
                            </span>
                            <textarea
                              aria-label={`${copy.questions.answerAriaPrefix} ${item.title}`}
                              placeholder={
                                item.answerOptions?.length ? copy.questions.customAnswerPlaceholder : undefined
                              }
                              value={answerDrafts[item.queueItemId] ?? ""}
                              onChange={(event) => {
                                setSelectedAnswerOptionIds((current) => ({
                                  ...current,
                                  [item.queueItemId]: []
                                }));
                                setAnswerDrafts((current) => ({
                                  ...current,
                                  [item.queueItemId]: event.target.value
                                }));
                              }}
                              rows={3}
                            />
                          </label>
                          <button type="button" disabled={isBusy} onClick={() => void submitAnswer(item.queueItemId)}>
                            {copy.questions.submitAnswer}
                          </button>
                        </div>
                      ) : null}
                      {isBusinessCriticQueueItem(item) && item.state !== "deferred" ? (
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
