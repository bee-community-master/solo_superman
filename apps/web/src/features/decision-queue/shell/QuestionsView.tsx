import { useState, type ReactNode } from "react";
import {
  localizedUserFacingDecisionQueueText,
  type AmbiguityAnswerSelectionMode,
  type QueueItemProjection
} from "@solo-superman/contracts";
import {
  draftedActiveQuestionAnswerIds,
  questionFatigueViewModel,
  queueItemIsQuestionDebt
} from "../decision-queue-view-model";
import { isBusinessCriticQueueItem } from "./decision-queue-shell-model";
import { useDecisionQueueCopy, type DecisionQueueCopy } from "./decision-queue-copy";
import { useAppLanguage, type AppLanguage } from "../../../shared/i18n/app-language";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";
import { boundedQuestionBatchSize, MIN_QUESTION_BATCH_SIZE, MAX_QUESTION_BATCH_SIZE } from "./useDecisionQueueSessionActions";
import { uniqueTextItems } from "./list-values";
import { decisionQueueDisplayText } from "../text-formatting";

interface QuestionsViewProps {
  readonly controller: DecisionQueueShellController;
}

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

function compactSourceTraceLabel(value: string) {
  const compacted = value.replace(/\s+/gu, " ").trim();

  return compacted.length > 220 ? `${compacted.slice(0, 219).trimEnd()}…` : compacted;
}

function compactPlanningProgressText(value: string | null | undefined, language: AppLanguage) {
  return compactSourceTraceLabel(decisionQueueDisplayText(value ?? "", language));
}

function planningDetailProgressItems(input: {
  readonly copy: DecisionQueueCopy;
  readonly language: AppLanguage;
  readonly projections: DecisionQueueShellController["projections"];
  readonly answeredQuestionCount: number;
}) {
  const { answeredQuestionCount, copy, language, projections } = input;

  if (answeredQuestionCount < 1) {
    return [];
  }

  const planningProgressTitle = compactPlanningProgressText(
    projections.spec?.title ?? copy.questions.planningDetailProgressFallbackTitle,
    language
  );
  const planningProgressNextQuestionItem = [
    ...(projections.queue?.active ?? []),
    ...(projections.queue?.next ?? [])
  ].find(queueItemIsQuestionDebt);
  const planningProgressNextQuestion = compactPlanningProgressText(planningProgressNextQuestionItem?.title, language);
  const planningProgressResearch = compactPlanningProgressText(
    (projections.research?.tasks.find((task) => task.status === "planned") ?? projections.research?.tasks[0])?.objective,
    language
  );

  return [
    copy.questions.planningDetailProgressAnswered(answeredQuestionCount, planningProgressTitle),
    planningProgressNextQuestion ? copy.questions.planningDetailProgressNextQuestion(planningProgressNextQuestion) : undefined,
    planningProgressResearch
      ? copy.questions.planningDetailProgressResearch(planningProgressResearch)
      : copy.questions.planningDetailProgressNoResearch
  ].filter((item): item is string => Boolean(item));
}

const EMPHASIS_LABELS_BY_LANGUAGE: Record<AppLanguage, readonly string[]> = {
  en: [
    "Research evidence summary",
    "Evidence gap",
    "Known limitation",
    "Limitation",
    "Uncertainty",
    "Source clue",
    "Source",
    "Confirmed clue",
    "Other perspective",
    "Additional perspective",
    "Decision this unlocks"
  ],
  ja: [
    "リサーチ根拠の要約",
    "根拠ギャップ",
    "限界/不確実性",
    "出典の手がかり",
    "確認された手がかり",
    "補足観点",
    "この回答で決まる判断"
  ],
  ko: [
    "리서치 근거 요약",
    "근거 공백",
    "한계/불확실성",
    "한계와 불확실성",
    "출처 단서",
    "확인된 단서",
    "보완할 관점",
    "다음 판단",
    "이 답으로 정해지는 내용",
    "이 답으로 정해지는 판단"
  ]
};

function lineWithEmphasis(line: string, language: AppLanguage) {
  const labels = EMPHASIS_LABELS_BY_LANGUAGE[language];
  const bulletMatch = /^(\s*[-•]\s*)([^:：]{2,40})([:：])\s*(.*)$/u.exec(line);
  const labelMatch = /^(\s*)([^:：]{2,40})([:：])\s*(.*)$/u.exec(line);
  const match = bulletMatch ?? labelMatch;

  if (!match) {
    return line;
  }

  const [, prefix = "", label = "", separator = ":", rest = ""] = match;
  const normalizedLabel = label.trim();

  if (!labels.includes(normalizedLabel)) {
    return line;
  }

  return (
    <>
      {prefix}
      <strong>{normalizedLabel}{separator}</strong>
      {rest ? ` ${rest}` : ""}
    </>
  );
}

function GeneratedQuestionText({ language, text }: { readonly language: AppLanguage; readonly text: string }) {
  const localizedText = localizedUserFacingDecisionQueueText(text, language);
  const lines = localizedText.split(/\r?\n/u);

  return (
    <span className="generated-question-text">
      {lines.map((line, index) => (
        <span className="generated-question-text-line" key={`${index}:${line}`}>
          {lineWithEmphasis(line, language) as ReactNode}
        </span>
      ))}
    </span>
  );
}

function researchFollowUpSourceTrace(item: QueueItemProjection) {
  if (item.cardType !== "follow_up_question" || !item.sourceRef?.startsWith("research:")) {
    return null;
  }

  const sourceClue = /(?:출처 단서|Source clue|Source):\s*([^\n]+)/iu.exec(item.whyItMatters ?? "")?.[1]?.trim();

  if (sourceClue && !/^research[_:]/iu.test(sourceClue)) {
    return compactSourceTraceLabel(sourceClue);
  }

  const decisionSource = /(?:와|and)\s+(.+?)\s+(?:근거|evidence)\S*\s*(?:를|을)?\s*(?:스펙|spec|decision)/iu.exec(
    item.decisionItUnlocks ?? ""
  )?.[1]?.trim();

  if (decisionSource && !/^research[_:]/iu.test(decisionSource)) {
    return compactSourceTraceLabel(decisionSource);
  }

  return item.title ? compactSourceTraceLabel(item.title) : null;
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
  item,
  language
}: {
  readonly copy: DecisionQueueCopy;
  readonly item: QueueItemProjection;
  readonly language: AppLanguage;
}) {
  const sourceTrace = researchFollowUpSourceTrace(item);

  return sourceTrace ? (
    <aside className="question-source-trace" aria-label={copy.questions.researchFollowUpSourceTrace}>
      <strong>{copy.questions.researchFollowUpSourceTrace}</strong>
      <p><GeneratedQuestionText language={language} text={sourceTrace} /></p>
    </aside>
  ) : null;
}

function QuestionPromptBlock({
  copy,
  item,
  language
}: {
  readonly copy: DecisionQueueCopy;
  readonly item: QueueItemProjection;
  readonly language: AppLanguage;
}) {
  const context = item.questionContext;

  if (!context || (!context.idea && !context.goal)) {
    return <h4><GeneratedQuestionText language={language} text={item.title} /></h4>;
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
            <h4><GeneratedQuestionText language={language} text={item.title} /></h4>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function QuestionsView({ controller }: QuestionsViewProps) {
  const copy = useDecisionQueueCopy();
  const { language } = useAppLanguage();
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
  const planningProgressItems = planningDetailProgressItems({
    copy,
    language,
    projections,
    answeredQuestionCount: questionProgress.answeredQuestionCount
  });
  const queueRecoveryLabels = [
    queueRecovery.label,
    queueRecovery.activeBatchLabel,
    queueRecovery.refetchLabel,
    queueRecovery.sseLabel
  ]
    .map((label) => decisionQueueDisplayText(label, language))
    .filter(Boolean);
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
          {queueRecoveryLabels.map((label, index) =>
            index === 0 ? <p key={label}>{label}</p> : <small key={label}>{label}</small>
          )}
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
        {planningProgressItems.length ? (
          <section className="planning-detail-progress" aria-label={copy.questions.planningDetailProgressTitle}>
            <strong>{copy.questions.planningDetailProgressTitle}</strong>
            <ul>
              {planningProgressItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
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
                      <div className="queue-card-main">
                        <header className="queue-card-header">
                          <QuestionPromptBlock copy={copy} item={item} language={language} />
                          <span className="queue-state-badge">{copy.questions.queueItemStateLabels[item.state]}</span>
                        </header>
                        {isBusinessCriticQueueItem(item) ? (
                          <p className="mode-summary question-business-context">
                            {businessCriticSummary(copy, item)}
                          </p>
                        ) : null}
                        {item.whyItMatters || item.decisionItUnlocks || item.nextValidationAction ? (
                          <dl className="question-coaching-context">
                            {item.whyItMatters ? (
                              <div>
                                <dt>{copy.questions.unansweredRisk}</dt>
                                <dd><GeneratedQuestionText language={language} text={item.whyItMatters} /></dd>
                              </div>
                            ) : null}
                            {item.decisionItUnlocks ? (
                              <div>
                                <dt>{copy.questions.narrowedScope}</dt>
                                <dd><GeneratedQuestionText language={language} text={item.decisionItUnlocks} /></dd>
                              </div>
                            ) : null}
                            {item.nextValidationAction ? (
                              <div>
                                <dt>{copy.questions.nextValidation}</dt>
                                <dd><GeneratedQuestionText language={language} text={item.nextValidationAction} /></dd>
                              </div>
                            ) : null}
                          </dl>
                        ) : null}
                        <ResearchFollowUpSourceTrace copy={copy} item={item} language={language} />
                        {item.additionalQuestions?.length ? (
                          <aside className="research-additional-questions" aria-label={copy.questions.researchAdditionalQuestions}>
                            <p>{copy.questions.researchAdditionalQuestions}</p>
                            <ul>
                              {uniqueTextItems(item.additionalQuestions).map((question) => (
                                <li key={question}>
                                  <GeneratedQuestionText language={language} text={question} />
                                </li>
                              ))}
                            </ul>
                          </aside>
                        ) : null}
                      </div>
                      {section.id === "active" && item.state === "active" ? (
                        <div className="answer-box question-answer-panel">
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
