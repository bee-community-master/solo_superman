import { useState } from "react";
import { isBusinessCriticQueueItem } from "./decision-queue-shell-model";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface QuestionsViewProps {
  readonly controller: DecisionQueueShellController;
}

export function QuestionsView({ controller }: QuestionsViewProps) {
  const copy = useDecisionQueueCopy();
  const [selectedAnswerOptionIds, setSelectedAnswerOptionIds] = useState<Record<string, string>>({});
  const {
    answerDrafts,
    carryQueueItemAsKnownRisk,
    isBusy,
    knownRiskDrafts,
    projections,
    queueRecovery,
    sections,
    setAnswerDrafts,
    setKnownRiskDrafts,
    submitAnswer
  } = controller;

  return (
    <div className="view-grid questions-view">
      <section className="panel queue-panel">
        <div className="panel-heading">
          <h2>{copy.questions.queue}</h2>
          <span>{copy.questions.queueRecoveryStatusLabels[queueRecovery.status]} · v{projections.queue?.version ?? 0}</span>
        </div>
        <div className="queue-recovery">
          <p>{queueRecovery.label}</p>
          <small>{queueRecovery.activeBatchLabel}</small>
          <small>{queueRecovery.refetchLabel}</small>
          <small>{queueRecovery.sseLabel}</small>
        </div>
        <div className="queue-sections">
          {sections.map((section) => (
            <section className="queue-section" key={section.id}>
              <div className="queue-section-heading">
                <h3>{section.title}</h3>
                <span>{section.items.length}</span>
              </div>
              {section.items.length ? (
                <div className="queue-list">
                  {section.items.map((item) => (
                    <article className={`queue-card ${item.state}`} key={item.queueItemId}>
                      <div>
                        <span>{item.state}</span>
                        <h4>{item.title}</h4>
                        {isBusinessCriticQueueItem(item) ? (
                          <p className="mode-summary">
                            {[item.businessCriticCategory, item.businessCriticPressureKind, item.businessCriticIntensity]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                        {item.nextValidationAction ? (
                          <p className="research-recovery">{copy.questions.nextValidation}: {item.nextValidationAction}</p>
                        ) : null}
                      </div>
                      {section.id === "active" && item.state === "active" ? (
                        <div className="answer-box">
                          {item.answerOptions?.length ? (
                            <fieldset className="answer-choice-fieldset">
                              <legend>{copy.questions.suggestedAnswers}</legend>
                              <div className="answer-choice-list">
                                {item.answerOptions.map((option) => (
                                  <label className="answer-choice-option" key={option.id}>
                                    <input
                                      checked={selectedAnswerOptionIds[item.queueItemId] === option.id}
                                      name={`answer-option-${item.queueItemId}`}
                                      onChange={() => {
                                        setSelectedAnswerOptionIds((current) => ({
                                          ...current,
                                          [item.queueItemId]: option.id
                                        }));
                                        setAnswerDrafts((current) => ({
                                          ...current,
                                          [item.queueItemId]: option.value
                                        }));
                                      }}
                                      type="radio"
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
                                  [item.queueItemId]: ""
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
                        <div className="answer-box">
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
                        </div>
                      ) : null}
                    </article>
                  ))}
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
