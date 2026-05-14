import { CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
import {
  BUSINESS_CRITIC_INTENSITY_OPTIONS,
  isBusinessCriticQueueItem,
  PROJECT_PURPOSE_MODE_OPTIONS
} from "./decision-queue-shell-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface QuestionsViewProps {
  readonly controller: DecisionQueueShellController;
}

export function QuestionsView({ controller }: QuestionsViewProps) {
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
          <h2>Session start</h2>
          <span>{CONTRACT_SCHEMA_VERSION}</span>
        </div>
        <label>
          Raw idea
          <textarea value={idea} onChange={(event) => setIdea(event.target.value)} rows={4} />
        </label>
        <label>
          Intake answer
          <textarea value={intake} onChange={(event) => setIntake(event.target.value)} rows={5} />
        </label>
        <fieldset className="mode-fieldset">
          <legend>Project purpose</legend>
          {PROJECT_PURPOSE_MODE_OPTIONS.map((option) => (
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
            AI가 모드를 제안할 수 있어도 확정은 사용자가 선택합니다. 선택 전에는 mode_required 상태로 두며 이후 변경은 auditable event로 남습니다.
          </p>
        </fieldset>
        {projectPurposeMode === "business" ? (
          <fieldset className="mode-fieldset">
            <legend>Business critic intensity</legend>
            {BUSINESS_CRITIC_INTENSITY_OPTIONS.map((option) => (
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
              Intensity reason
              <input
                value={initialBusinessCriticIntensityReason}
                onChange={(event) => setInitialBusinessCriticIntensityReason(event.target.value)}
                placeholder="검증 강도를 선택한 이유를 audit에 남깁니다."
              />
            </label>
            <p className="mode-help">
              사업화 모드는 기본 강도를 자동 선택하지 않습니다. 선택 전에는 상업성 검증 강도 선택 필요 상태로 남습니다.
            </p>
          </fieldset>
        ) : null}
        <button type="submit" disabled={!canStart}>
          {isBusy ? "Running" : "Create first batch"}
        </button>
      </form>

      <section className="panel queue-panel">
        <div className="panel-heading">
          <h2>Queue</h2>
          <span>{queueRecovery.status} · v{projections.queue?.version ?? 0}</span>
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
                          <p className="research-recovery">Next validation: {item.nextValidationAction}</p>
                        ) : null}
                      </div>
                      {section.id === "active" && item.state === "active" ? (
                        <div className="answer-box">
                          <textarea
                            aria-label={`Answer ${item.title}`}
                            value={answerDrafts[item.queueItemId] ?? ""}
                            onChange={(event) =>
                              setAnswerDrafts((current) => ({
                                ...current,
                                [item.queueItemId]: event.target.value
                              }))
                            }
                            rows={3}
                          />
                          <button type="button" disabled={isBusy} onClick={() => void submitAnswer(item.queueItemId)}>
                            Submit answer
                          </button>
                        </div>
                      ) : null}
                      {isBusinessCriticQueueItem(item) && item.state !== "deferred" ? (
                        <div className="answer-box">
                          <textarea
                            aria-label={`Next validation action for ${item.title}`}
                            value={knownRiskDrafts[item.queueItemId] ?? ""}
                            onChange={(event) =>
                              setKnownRiskDrafts((current) => ({
                                ...current,
                                [item.queueItemId]: event.target.value
                              }))
                            }
                            placeholder="Known Risk로 남길 때 다음 검증 행동을 적어주세요."
                            rows={2}
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void carryQueueItemAsKnownRisk(item.queueItemId)}
                          >
                            Carry as Known Risk
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
