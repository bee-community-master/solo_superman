import { CONTRACT_SCHEMA_VERSION } from "@solo-superman/contracts";
import { useDecisionQueueCopy } from "./decision-queue-copy";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface OnboardingViewProps {
  readonly controller: DecisionQueueShellController;
}

export function OnboardingView({ controller }: OnboardingViewProps) {
  const copy = useDecisionQueueCopy();
  const {
    businessCriticIntensity,
    canStart,
    chatGptLoginAcknowledged,
    codexLoginStart,
    idea,
    initialResearchPermission,
    initialBusinessCriticIntensityReason,
    intake,
    isBusy,
    projectPurposeMode,
    refreshRuntimeStatus,
    runInitialQueueFlow,
    setBusinessCriticIntensity,
    setChatGptLoginAcknowledged,
    setIdea,
    setInitialResearchPermission,
    setInitialBusinessCriticIntensityReason,
    setIntake,
    setProjectPurposeMode,
    startCodexLogin
  } = controller;
  const codexAccount = controller.runtimeStatus?.account ?? null;
  const codexStatusReason =
    codexAccount?.reason ??
    controller.runtimeStatus?.reason ??
    (controller.connectionState.status === "unavailable" ? controller.connectionState.message : null);

  return (
    <div className="view-grid onboarding-view">
      <form className="panel start-panel" onSubmit={runInitialQueueFlow}>
        <div className="panel-heading">
          <h2>{copy.questions.sessionStart}</h2>
          <span>{CONTRACT_SCHEMA_VERSION}</span>
        </div>
        <div className="session-start-layout">
          <div className="session-login-column">
            <section className="start-guide chatgpt-login-gate" aria-label={copy.questions.chatGptLoginAria}>
              <div className="login-gate-copy">
                <h3>{copy.questions.chatGptLoginTitle}</h3>
                <p>{copy.questions.chatGptLoginDescription}</p>
                <p className="mode-summary">{copy.questions.chatGptCredentialBoundary}</p>
              </div>
              <div className="card-actions panel-actions">
                <a className="chatgpt-login-link" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">
                  {copy.questions.chatGptLoginOpen}
                </a>
              </div>
              <label className="mode-option">
                <input
                  type="checkbox"
                  checked={chatGptLoginAcknowledged}
                  onChange={(event) => setChatGptLoginAcknowledged(event.target.checked)}
                />
                <span>
                  <strong>{copy.questions.chatGptLoginAcknowledge}</strong>
                </span>
              </label>
            </section>
            <section className="start-guide codex-login-gate" aria-label={copy.questions.codexLoginAria}>
              <div className="login-gate-copy">
                <h3>{copy.questions.codexLoginTitle}</h3>
                <p>{copy.questions.codexLoginDescription}</p>
                <p className="mode-summary">{copy.questions.codexCredentialBoundary}</p>
                <p className="runtime-status-line">
                  {copy.questions.codexLoginStatus}: {" "}
                  <strong>
                    {codexAccount
                      ? copy.questions.codexLoginStatusLabels[codexAccount.status]
                      : copy.questions.codexLoginStatusLabels.unknown}
                  </strong>
                  {codexAccount?.email ? ` · ${codexAccount.email}` : ""}
                  {codexAccount?.planType ? ` · ${codexAccount.planType}` : ""}
                </p>
                {codexAccount?.status === "authenticated" ? null : (
                  <p className="mode-summary">
                    {copy.questions.codexLoginCommandLabel}: <code>{codexAccount?.loginCommand ?? "codex auth login"}</code>
                  </p>
                )}
                {codexStatusReason ? <p className="research-recovery">{codexStatusReason}</p> : null}
                {codexLoginStart?.message ? <p className="research-recovery">{codexLoginStart.message}</p> : null}
              </div>
              <div className="card-actions panel-actions">
                {codexAccount?.status === "authenticated" ? null : (
                  <button type="button" disabled={isBusy} onClick={() => void startCodexLogin()}>
                    {copy.questions.codexLoginStart}
                  </button>
                )}
                <button type="button" disabled={isBusy} onClick={() => void refreshRuntimeStatus()}>
                  {copy.questions.codexLoginRefresh}
                </button>
              </div>
            </section>
          </div>
          <div className="session-goal-column">
            <section className="start-guide goal-setup-guide" aria-label={copy.questions.firstRunAria}>
              <h3>{copy.questions.firstRunTitle}</h3>
              <ul>
                {copy.questions.firstRunItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <label className="session-idea-field">
              {copy.questions.rawIdea}
              <textarea
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                placeholder={copy.questions.rawIdeaPlaceholder}
                rows={6}
              />
            </label>
            <label className="session-intake-field">
              {copy.questions.intakeAnswer}
              <textarea
                value={intake}
                onChange={(event) => setIntake(event.target.value)}
                placeholder={copy.questions.intakeAnswerPlaceholder}
                rows={8}
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
            <fieldset className="mode-fieldset">
              <legend>{copy.questions.initialResearchPermission}</legend>
              {copy.questions.initialResearchPermissionOptions.map((option) => (
                <label className="mode-option" key={option.permission}>
                  <input
                    checked={initialResearchPermission === option.permission}
                    name="initial-research-permission"
                    onChange={() => setInitialResearchPermission(option.permission)}
                    type="radio"
                    value={option.permission}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
              <p className="mode-help">
                {copy.questions.initialResearchPermissionHelp}
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
          </div>
        </div>
      </form>
    </div>
  );
}
