import { useState } from "react";
import { CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
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
    businessCriticIntensity,
    canStart,
    carryQueueItemAsKnownRisk,
    idea,
    initialBusinessCriticIntensityReason,
    intake,
    isBusy,
    knownRiskDrafts,
    projectPurposeMode,
    projections,
    queueRecovery,
    runInitialQueueFlow,
    sections,
    setAnswerDrafts,
    setBusinessCriticIntensity,
    setIdea,
    setInitialBusinessCriticIntensityReason,
    setIntake,
    setKnownRiskDrafts,
    setProjectPurposeMode,
    submitAnswer
  } = controller;

  return (
    <div className="view-grid questions-view">
      <form className="panel start-panel" onSubmit={runInitialQueueFlow}>
        <div className="panel-heading">
          <h2>{copy.questions.sessionStart}</h2>
          <span>{CONTRACT_SCHEMA_VERSION}</span>
        </div>
        <section className="start-guide" aria-label={copy.questions.firstRunAria}>
          <h3>{copy.questions.firstRunTitle}</h3>
          <ul>
            {copy.questions.firstRunItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <label>
          {copy.questions.rawIdea}
          <textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder={copy.questions.rawIdeaPlaceholder}
            rows={4}
          />
        </label>
        <label>
          {copy.questions.intakeAnswer}
          <textarea
            value={intake}
            onChange={(event) => setIntake(event.target.value)}
            placeholder={copy.questions.intakeAnswerPlaceholder}
            rows={5}
          />
        </label>
        <fieldset className="mode-fieldset">
          <legend>{copy.questions.projectPurpose}</legend>
          {copy.projectPurposeModeOptions.map((option) => (
            <label className="mode-option" key={option.mode}>
              <input
                checked={projectPurposeMode === option.mode}
                name="project-purpose-mode"
                onChange={() => setProjectPurposeMode(option.mode)}
                type="radio"
                value={option.mode}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
          <p className="mode-help">
            {copy.questions.purposeHelp}
          </p>
        </fieldset>
        {projectPurposeMode === "business" ? (
          <fieldset className="mode-fieldset">
            <legend>{copy.questions.businessCriticIntensity}</legend>
            {copy.businessCriticIntensityOptions.map((option) => (
              <label className="mode-option" key={option.intensity}>
                <input
                  checked={businessCriticIntensity === option.intensity}
                  name="business-critic-intensity"
                  onChange={() => setBusinessCriticIntensity(option.intensity)}
                  type="radio"
                  value={option.intensity}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
            <label>
              {copy.questions.intensityReason}
              <input
                value={initialBusinessCriticIntensityReason}
                onChange={(event) => setInitialBusinessCriticIntensityReason(event.target.value)}
                placeholder={copy.questions.intensityReasonPlaceholder}
              />
            </label>
            <p className="mode-help">
              {copy.questions.intensityHelp}
            </p>
          </fieldset>
        ) : null}
        <button type="submit" disabled={!canStart}>
          {isBusy ? copy.questions.running : copy.questions.createFirstBatch}
        </button>
      </form>

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
