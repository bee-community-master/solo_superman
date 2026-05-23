import type {
  BusinessCriticalQuestionCategory,
  BusinessCriticIntensity,
  BusinessCriticPressureKind,
  ProjectPurposeMode,
  ResearchQueueTerminalOutcome
} from "@solo-superman/contracts";
import { useAppLanguage } from "../../../shared/i18n/app-language";
import type { ChatGptDelegationViewModelCopy } from "../ChatGptDelegationPanel";
import type { Phase15bReadinessViewModelCopy } from "../decision-queue-view-model";
import type { DecisionQueuePageId, InitialQueueStartBlocker } from "./decision-queue-shell-model";

export const DECISION_QUEUE_PAGE_ORDER = ["onboarding", "questions", "research", "planning", "implementation", "permissions"] as const satisfies readonly DecisionQueuePageId[];

function joinVisibleParts(parts: readonly (string | null)[]) {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function commercializationAxisLabel(axis: string, labels: Readonly<Record<string, string>>) {
  return labels[axis] ?? axis.replaceAll("_", " ");
}

const EN_COPY = {
  pageMeta: {
    onboarding: {
      label: "Onboarding",
      shortLabel: "O",
      title: "Onboarding",
      description: "Sign in to ChatGPT and Codex, then set the goal before the first question batch."
    },
    questions: {
      label: "Questions",
      shortLabel: "Q",
      title: "Questions",
      description: "Answer active questions, review upcoming questions, and keep known risks visible."
    },
    research: {
      label: "Research",
      shortLabel: "R",
      title: "Research review",
      description: "Manage approved public research and manually imported evidence."
    },
    planning: {
      label: "Planning",
      shortLabel: "P",
      title: "Planning readiness",
      description: "Review the product spec, readiness score, Founder Brief, and handoff check."
    },
    implementation: {
      label: "Implementation",
      shortLabel: "I",
      title: "Implementation activity",
      description: "Track local activity and the implementation log in one flow."
    },
    permissions: {
      label: "Permissions",
      shortLabel: "A",
      title: "Delegation and permissions",
      description: "Review external AI workspace access and service-page permissions separately."
    }
  },
  projectPurposeModeOptions: [
    {
      mode: "business" as ProjectPurposeMode,
      label: "Business validation",
      description: "Validate customers, problem urgency, willingness to pay, competitors, channels, and legal or operational risk."
    },
    {
      mode: "personal" as ProjectPurposeMode,
      label: "Personal workflow build",
      description: "Focus on your workflow, interface, build feasibility, and local data or security needs instead of a market story."
    }
  ],
  businessCriticIntensityOptions: [
    {
      intensity: "balanced" as BusinessCriticIntensity,
      label: "Balanced business review",
      description: "Keep at least one challenge question in each major decision area."
    },
    {
      intensity: "strong" as BusinessCriticIntensity,
      label: "Strong business review",
      description: "Keep challenge questions visible when a major business assumption is still weak."
    },
    {
      intensity: "investor_grade" as BusinessCriticIntensity,
      label: "Investor-grade review",
      description: "Stress-test pricing, channels, retention signals, legal or operational risk, timing, and founder advantage."
    }
  ],
  layout: {
    localQueueFallback: "Local planning workspace",
    workflowSectionsAria: "Desktop workflow sections",
    leftRailAria: "Workflow navigation",
    workflowSteps: "Workspace steps",
    progressAria: "Live queue progress",
    progress: "Progress",
    completeness: "Completeness",
    pendingQuestions: "Pending questions",
    blockedQuestions: "Blocked questions",
    reconnectSidecar: "Reconnect local service",
    sidecarUnavailable: "Local service unavailable",
    sidecarUnavailableMessage: "The local service is not connected.",
    sidecarUnavailableRecovery: "The local service is not connected. Start Solo Superman with `pnpm start:local`, then reconnect and try Codex login again.",
    retryConnection: "Retry connection",
    commandFailed: "Action failed"
  },
  nav: {
    onboardingReady: "Login + goal setup",
    onboardingComplete: "First questions created",
    questionsSublabel: (active: number, next: number) => `${active} active · ${next} next`,
    researchSublabel: (tasks: number, runs: number) => `${tasks} tasks · ${runs} runs`,
    permissionsSublabel: (workspaceStatus: string, permissionStatus: string) => `${workspaceStatus} · ${permissionStatus}`
  },
  questions: {
    sessionStart: "Start a session",
    firstRunAria: "Goal setup guide",
    firstRunTitle: "Goal setup",
    firstRunItems: [
      "Summarize the idea and describe the goal so Solo Superman can create the first question set.",
      "For business validation, choose how strongly the app should challenge the idea.",
      "Research and implementation prep start as reviewable notes; risky actions never run automatically."
    ],
    initialQueueStartBlockers: {
      busy: "The first question batch is already being created.",
      chatgpt_login: "Confirm that you signed in to ChatGPT directly before starting.",
      codex_login:
        "Local Codex CLI login must be confirmed before backend questions or research prep can start.",
      sidecar_connection: "Local service is not connected.",
      project_purpose: "Choose either business validation or personal workflow build before starting.",
      business_critic_intensity:
        "Choose a business review intensity before the business-validation queue can be confirmed.",
      idea: "Enter an idea summary before starting.",
      intake: "Enter the goal description before starting."
    } satisfies Record<InitialQueueStartBlocker, string>,
    sessionActionErrors: {
      activeSessionRequiredProjectPurpose: "An active session is required before changing the project purpose mode.",
      projectPurposeAlreadySelected: "Project purpose mode is already set to the selected value.",
      activeSessionRequiredBusinessCriticIntensity:
        "An active session is required before changing the business critic intensity.",
      businessCriticIntensityBusinessOnly:
        "Business review intensity can only be changed for business-validation projects.",
      activeSessionRequiredSubmitAnswer: "An active session is required before submitting an answer.",
      answerTextRequired: "Answer text is required.",
      activeSessionRequiredDraftedAnswers: "An active session is required before submitting drafted answers.",
      draftedAnswersRequired: "Write at least one active question answer before submitting drafted answers.",
      draftedAnswersPartialFailureRefreshed:
        " Some drafted answers were submitted before the failure; the queue was refreshed.",
      draftedAnswersPartialFailureRefreshRequired:
        " Some drafted answers were submitted before the failure; refresh the queue before continuing.",
      activeSessionRequiredRefreshQuestions: "An active session is required before refreshing questions.",
      activeSessionRequiredLoadNextQuestions:
        "An active session is required before loading the next question list.",
      answerCurrentBeforeLoadNextQuestions:
        "Answer or save the current questions before loading the next question list.",
      activeSessionRequiredKnownRisk: "An active session is required before carrying a queue item as a Known Risk.",
      knownRiskNextValidationActionRequired:
        "Next Validation Action is required to carry a business critic item as a Known Risk.",
      activeSessionRequiredImportResearch: "An active session is required before importing research.",
      researchResultTextRequired: "Research result text is required.",
      activeSessionRequiredResolveResearchCard: "An active session is required before resolving a research card."
    },
    sessionActionReasons: {
      projectPurposeConfirmed: (label: string) => `${label} was confirmed by the user before starting.`,
      businessCriticIntensityConfirmed: (label: string) =>
        `${label} was confirmed by the user before starting.`,
      projectPurposeChanged: (label: string) => `User changed the project purpose to ${label}.`,
      businessCriticIntensityChanged: (label: string) =>
        `User changed the business review intensity to ${label}.`,
      businessCriticKnownRiskDeferred: "User carried the business critic item as a Known Risk.",
      manualResearchSourceTitle: "Manual desk research",
      manualResearchLimitationNotes: "Manual import from founder-provided source.",
      researchCardOutcomeRationale: (outcome: ResearchQueueTerminalOutcome, title: string) =>
        `${outcome} from Research card: ${title}`,
      researchCardResolvedRationale: (outcome: ResearchQueueTerminalOutcome, title: string) =>
        `Resolved as ${outcome}: ${title}`
    },
    chatGptLoginAria: "ChatGPT direct login gate",
    chatGptLoginTitle: "Sign in to ChatGPT in your browser first",
    chatGptLoginDescription: "Open ChatGPT in this browser profile and sign in yourself before creating the first question batch.",
    chatGptCredentialBoundary: "Solo Superman never asks for or stores your password, 2FA code, session cookie, API key, or secrets.",
    chatGptLoginOpen: "Open ChatGPT",
    chatGptLoginAcknowledge: "I signed in to ChatGPT directly in this browser/profile.",
    codexLoginAria: "Codex CLI login gate",
    codexLoginTitle: "Sign in to Codex CLI for backend questions and research",
    codexLoginDescription: "The local sidecar checks Codex CLI before backend question or research preview work starts. If needed, open a background Terminal that runs `codex auth login`; Codex opens the browser login screen for you.",
    codexCredentialBoundary: "Solo Superman only reads Codex account status. It never asks for or stores access tokens, API keys, passwords, or cookies.",
    codexLoginStatus: "Codex status",
    codexLoginCommandLabel: "Background terminal command",
    codexLoginStart: "Open Codex login",
    codexLoginRefresh: "Refresh Codex login status",
    codexLoginStatusLabels: {
      authenticated: "Signed in",
      missing: "Login required",
      unknown: "Unknown",
      blocked: "Blocked"
    },
    rawIdea: "Idea summary",
    rawIdeaPlaceholder: "Example: A focused founder brief generator",
    intakeAnswer: "Goal description",
    intakeAnswerPlaceholder: "Describe who this is for, what problem it solves, and what you want to decide in this session.",
    projectPurpose: "Project purpose",
    purposeHelp: "You choose the project purpose. Until you choose, the app will not lock business- or workflow-specific questions.",
    initialResearchPermission: "Research permission",
    initialResearchPermissionOptions: [
      {
        permission: "not_now" as const,
        label: "Set up research later",
        description: "Create questions now and keep public web research disabled until you enable it in the Research tab."
      },
      {
        permission: "allow_public_web" as const,
        label: "Allow read-only public web research",
        description: "Enable the public-safe allowlist during onboarding so evidence tasks can use approved read-only sources."
      }
    ],
    initialResearchPermissionHelp: "This only controls public, read-only research sources. It never grants write, credential, account, or paid-service access.",
    businessCriticIntensity: "Business review intensity",
    intensityReason: "Reason for this intensity",
    intensityReasonPlaceholder: "Note why this level of challenge fits the project.",
    intensityHelp: "Business mode needs an explicit review intensity before the first question set can be created.",
    running: "Running",
    createFirstBatch: "Create first questions",
    queue: "Queue",
    refreshQuestionList: "Refresh question list",
    loadNextQuestions: "Load next questions",
    questionProgressTitle: "Question progress",
    questionProgressSummary: (handled: number, generated: number, percent: number) =>
      `${handled}/${generated} generated questions handled · ${percent}%`,
    questionProgressGenerated: "Generated",
    questionProgressOpen: "Open debt",
    questionProgressVisible: "Visible now",
    questionProgressActive: "Active now",
    questionProgressUpcoming: "Upcoming next",
    questionProgressAnswered: "Answered",
    questionProgressFollowUps: "Follow-ups",
    questionProgressOpenFollowUps: "Open follow-ups",
    questionProgressTopics: "Topics covered",
    questionProgressOpenTopics: "Open topics",
    questionProgressFollowUpBudget: "Follow-up budget",
    questionProgressBlocked: "Blocked",
    questionFatigueStatusLabels: {
      checkpoint: "Fatigue checkpoint",
      break_recommended: "Break recommended"
    },
    questionFatigueSummary: (open: number, generated: number, percent: number) =>
      `${open} open questions remain after ${percent}% handled across ${generated} generated questions.`,
    questionFatigueHelp: "Answer only the current batch, carry uncertain assumptions as known risks, or pause before loading more.",
    questionFatigueFollowUpBudget: (count: number) => `${count} follow-up slots remain; use them deliberately.`,
    researchAdditionalQuestions: "Research-generated questions",
    researchFollowUpSourceTrace: "Source trace",
    businessCriticCategoryLabels: {
      customer_pain: "Customer pain",
      paid_intent: "Willingness to pay",
      alternatives: "Alternatives",
      pricing: "Pricing",
      acquisition: "Finding users",
      mvp_validation: "First-version validation",
      legal_ops_security: "Legal, operations, and security",
      retention_proxy: "Repeat-use signal",
      market_timing: "Market timing",
      founder_advantage: "Founder/team advantage"
    } satisfies Record<BusinessCriticalQuestionCategory, string>,
    businessCriticPressureKindLabels: {
      balanced_con: "Balanced challenge",
      core_assumption_challenge: "Core assumption check",
      investor_pressure_pass: "Investor-style stress test"
    } satisfies Record<BusinessCriticPressureKind, string>,
    whyItMatters: "Why this matters",
    decisionItUnlocks: "Decision this unlocks",
    nextValidation: "Next validation",
    suggestedAnswers: "Suggested answer choices",
    optionPro: "Pro",
    optionCon: "Con",
    customAnswer: "Write a different answer if none fit",
    customAnswerPlaceholder: "If the choices do not match your situation, write your own answer here.",
    answerAriaPrefix: "Answer",
    submitAnswer: "Submit answer",
    submitDraftedAnswers: (count: number) =>
      count > 0 ? `Submit ${count} drafted answers` : "Submit drafted answers",
    nextValidationActionAriaPrefix: "Next validation action for",
    additionalRiskDetails: "Add comment or risk",
    additionalRiskHelp: "Optional: use this only when you want to keep the card as a known risk instead of answering it now.",
    knownRiskPlaceholder: "If you keep this as a known risk, write the next validation step.",
    carryAsKnownRisk: "Keep as a known risk",
    queueRecoveryFresh: "Questions are up to date. New local-service updates will refresh this list.",
    queueRefetchMissing: "The question refresh path is not loaded yet.",
    queueSseMissing: "Live update notifications are not connected yet.",
    queueActiveBatchMissing: "Current question details are not loaded yet.",
    queueRefetchReady: (url: string) => `Question refresh ${url}`,
    queueSseReady: (url: string) => `Live update stream ${url}`,
    queueActiveBatchReady: (count: number) => `${count === 1 ? "1 current question" : `${count} current questions`} selected for this round.`,
    queueRecoveryStatusLabels: {
      idle: "Up to date",
      pending_refetch: "Refresh pending",
      recovering: "Refreshing",
      recovered_by_refetch: "Updated",
      stale: "Needs refresh"
    },
    queueRecoveryMessages: {
      idle: "Questions are up to date. New local-service updates will refresh this list.",
      pending_refetch: "Question updates are waiting. This list will refresh from the local service.",
      recovering: "Questions are refreshing after a live update or reconnect.",
      recovered_by_refetch: "Questions refreshed after a live update.",
      stale: "Questions may be out of date. Refresh before using them as the source of truth."
    },
    queueItemStateLabels: {
      active: "Current",
      next: "Up next",
      blocked: "Blocked",
      deferred: "Known risk",
      answered: "Answered",
      resolved: "Resolved"
    },
    queueSections: {
      active: { title: "Current questions", emptyLabel: "No current questions." },
      next: { title: "Up next", emptyLabel: "No upcoming questions." },
      blocked: { title: "Needs attention", emptyLabel: "No blocked items." },
      deferred: { title: "Saved for later", emptyLabel: "No saved items." }
    }
  },
  planning: {
    spec: "Product spec",
    sessionStatusLabels: {
      none: "Not started",
      scaffold: "Not started",
      intake: "Questions in progress",
      spec: "Spec-ready",
      validation: "Research in progress",
      complete: "Waiting for safe execution"
    },
    noSpecDraft: "No product spec draft yet.",
    sessionVersion: "Session version",
    specSections: "Spec sections",
    approval: "Approval",
    projectPurpose: "Project purpose",
    businessCritic: "Business review",
    notSelected: "not selected",
    notApplicable: "not applicable",
    skippedCommercializationAxes: "Skipped commercialization axes",
    skippedCommercializationAxesHelp: "Personal mode keeps these business/investor checks visible, but excludes them from required completion gates.",
    commercializationAxisLabel: (axis: string) =>
      commercializationAxisLabel(axis, {
        market_size: "Market size",
        investor_narrative: "Investor narrative",
        willingness_to_pay: "Willingness to pay",
        acquisition_channel: "Acquisition channel",
        competition_pressure: "Competition pressure"
      }),
    businessCriticChangeReason: "Business review change reason",
    businessCriticChangeReasonPlaceholder: "Record why the business validation intensity is changing.",
    changeTo: (label: string) => `Change to ${label}`,
    businessCriticAuditHelp: "Changes are saved to the audit trail and add new review pressure without replacing current questions.",
    modeChangeReason: "Mode change reason",
    modeChangeReasonPlaceholder: "Record why the question/research criteria are changing.",
    modeAuditHelp: "Changes are saved to the audit trail and keep the current question set.",
    progress: "Progress",
    pending: "pending",
    scoreCompleteness: "Score completeness",
    noRiskProjection: "No risk summary yet.",
    confidenceMap: "Confidence Map",
    confidenceMapHelp: "Shows the score drivers and readiness gates behind the current Planning score.",
    scoreBreakdownLabels: {
      sectionCompleteness: "Spec sections",
      questionDebtResolution: "Question debt",
      evidenceQuality: "Evidence quality",
      decisionApproval: "Decision approval",
      consistencyAndConflict: "Consistency"
    },
    completionCandidate: "Completion candidate",
    completionCandidateStatusLabels: {
      candidate: "candidate",
      not_ready: "not ready"
    },
    confidenceGateFailures: "Readiness gate blockers",
    confidenceGatesReady: "All readiness gates are passing.",
    nextBestActions: "Next best actions",
    ifStopNowArtifact: "If stop now",
    ifStopNowKnownRisks: "If-stop-now known risks",
    ifStopNowNextValidationActions: "If-stop-now next validation actions",
    topRiskCards: "Top 3 Risk Cards",
    riskSeverity: "Severity",
    riskSeverityLabels: { low: "low", medium: "medium", high: "high" },
    riskNextValidation: "Next validation action",
    riskNextValidationAriaPrefix: "Next validation action for",
    riskSourceRefs: "Source refs",
    riskNoSourceRefs: "no source refs",
    founderBrief: "Founder Brief",
    founderBriefRiskActions: "Founder Brief risk actions",
    founderBriefKnownRisks: "Founder Brief known risks",
    founderBriefNextValidationActions: "Founder Brief next validation actions",
    ready: "ready",
    draft: "draft",
    prepareExportMetadata: "Prepare export details",
    noFounderBrief: "No Founder Brief prepared yet."
  },
  research: {
    research: "Research",
    unknown: "unknown",
    planResearchTask: "Plan research task",
    rationale: "Rationale",
    importResearchAriaPrefix: "Import research for",
    importResult: "Import result",
    startReadOnlyRun: "Start public web run",
    startReadyReadOnlyRuns: (count: number) =>
      count === 0
        ? "No ready public web runs"
        : count === 1
          ? "Start 1 ready public web run"
          : `Start ${count} ready public web runs`,
    readyReadOnlyRunsPlanTitle: "Ready public web batch plan",
    readyReadOnlyRunsPlanReady: (count: number) =>
      count === 1
        ? "1 planned read-only research task will start within the active allowlist budget."
        : `${count} planned read-only research tasks will start within the active allowlist budget.`,
    readyReadOnlyRunsPlanBlocked: {
      missing_allowlist: "Create or reactivate an active public web allowlist before starting the ready batch.",
      no_ready_tasks: "No planned public web tasks are ready within the active allowlist concurrency budget."
    },
    researchActionErrors: {
      activeProjectRequiredAllowlistChange: "An active project is required before changing research allowlists.",
      activeProjectRequiredPauseAllowlist: "An active project is required before pausing a research allowlist.",
      activeProjectRequiredRevokeAllowlist: "An active project is required before revoking a research allowlist.",
      activeSessionRequiredPlanResearch: "An active session is required before planning public-safe research.",
      sidecarConnectionRequiredStartRun: "A sidecar connection is required before starting a research run.",
      activeProjectRequiredStartRun: "An active project is required before starting a research run.",
      plannedTaskRequiredStartRun: "Select a planned research task before starting a read-only research run.",
      plannedTaskStatusRequiredStartRun: "Only planned research tasks can start a new read-only research run.",
      activeAllowlistRequiredStartRun:
        "Create or reactivate an active public web allowlist before starting a research run.",
      activeProjectRequiredReadyRuns: "An active project is required before starting ready research runs.",
      readyRunsMissingAllowlist:
        "Create or reactivate an active public web allowlist before starting research runs.",
      readyRunsNoReadyTasks: "No planned public web research tasks are ready within the active allowlist concurrency budget.",
      backgroundStartAfterAnswerFailed: (error: string) =>
        `Answer submitted, but automatic public web research start failed: ${error}`,
      activeProjectRequiredRefreshRunStatus: "An active project is required before refreshing research run status.",
      activeProjectRequiredCancelRun: "An active project is required before cancelling a research run.",
      activeProjectRequiredRetryRun: "An active project is required before retrying a research run."
    },
    researchActionReasons: {
      pauseAllowlist: "Paused from the research operations screen.",
      revokeAllowlist: "Revoked from the research operations screen.",
      planPublicSafeObjective:
        "Validate public onboarding evidence and quality-gate readiness for the research loop.",
      cancelRun: "Cancelled from the research operations screen.",
      retryRun: "Manual retry from the research operations screen."
    },
    readyReadOnlyRunsPlanTaskIds: "Task IDs queued for this batch",
    validationSummary: "Validation summary",
    knownRisks: "Known risks",
    nextValidationAction: "Next validation action",
    nextValidationActions: "Next validation actions",
    evidencePacks: "Evidence packs",
    evidencePackSource: "Source",
    decisionContext: "Decision context",
    sourceReliability: "Source reliability",
    gateStatus: "Gate status",
    gateChecks: "Gate checks",
    noGateChecks: "No gate checks",
    limitationRefs: "Limitations",
    evidenceMatrix: "Evidence matrix",
    balanceStatus: "Balance status",
    decisionBlocked: "Planning blocked",
    decisionReady: "Planning not blocked",
    proEvidence: "Pro evidence",
    conEvidence: "Con evidence",
    uncertainties: "Uncertainties",
    missingConEvidenceReason: "Missing con-evidence reason",
    knownRisk: "Known risk",
    noEvidenceItems: "No evidence items",
    additionalQuestions: "Research-generated follow-up questions",
    sourceTrace: "Source trace",
    noResearchTasks: "No research tasks yet."
  },
  implementation: {
    runtimeEvidence: "Execution records",
    adapterPrefix: "Tool",
    effectSuffix: "item(s)",
    noCommandStatus: "No command status records yet.",
    activity: "Activity",
    pending: "pending",
    refreshStatus: "Refresh status",
    refreshRuntimeStatus: "Refresh runtime status",
    runtimeEvidenceDetails: "Runtime evidence details",
    runtimeCheckedAt: "Runtime checked at",
    runtimeAdapterVersion: "Runtime adapter",
    runtimeGeneratedSchemaVersion: "Generated schema version",
    runtimeTransport: "Transport",
    runtimeExecutionMode: "Execution mode",
    runtimeAccount: "Codex account",
    runtimeLiveTurns: "Live turns",
    runtimeManualHandoff: "Manual handoff",
    runtimeLiveTurnStates: {
      enabled: "enabled",
      disabled: "disabled",
      unknown: "unknown"
    },
    runtimeManualHandoffStates: {
      available: "available",
      unavailable: "unavailable",
      unknown: "unknown"
    },
    unknown: "unknown",
    noActivity: "No activity yet."
  },
  autoImplementation: {
    title: "Auto implementation workspace",
    create: "Create workspace run",
    reprepare: "Ensure workspace run",
    planWorkerJob: "Approve worker authority + plan job",
    recordStageTick: "Record current stage tick",
    startStage: "Start current stage",
    pauseStage: "Pause current stage",
    blockStage: "Block current stage",
    completeWorkerJob: "Complete worker from ledger",
    importWorkerLedger: "Import worker ledger",
    workerLedgerImport: "Worker ledger import JSON",
    workerLedgerImportPlaceholder: "Paste { \"ledgerTransitions\": [...] } from the local Codex worker output or paste the raw transition array.",
    recordGitHubIssueDryRun: "Record GitHub issue dry-run",
    applyGitHubIssueCreation: "Apply approved GitHub issues",
    recordPullRequestOpenDryRun: "Record PR open dry-run",
    applyPullRequestOpen: "Apply approved PR open",
    recordPullRequestDryRun: "Record PR body dry-run",
    recordPullRequestMergeDryRun: "Record PR merge dry-run",
    applyPullRequestBodyUpdate: "Apply approved PR body update",
    applyPullRequestMerge: "Apply approved PR merge",
    runWorkerJob: "Run worker job",
    advanceWorkerStage: "Advance worker stage",
    refresh: "Refresh workspace run",
    actionErrors: {
      activeSessionRequiredCreateWorkspace:
        "An active session is required before creating an auto implementation workspace.",
      planningHandoffMustBeReady:
        "Planning handoff must be planning_ready before creating or reprovisioning an auto implementation workspace.",
      planningHandoffRequired:
        "Run the planning handoff gate and reach planning_ready before creating an auto implementation workspace.",
      workspaceCreationFailed: (error: string) => `Auto implementation workspace creation failed: ${error}`,
      activeRunRequiredPlanWorker:
        "An active auto implementation workspace run is required before planning a local worker job.",
      currentStageWorkerMustContinue:
        "Continue the latest current-stage worker with run, import, complete, or advance before planning another local worker job.",
      activeRunRequiredStageTick:
        "An active auto implementation workspace run is required before recording a stage tick.",
      activeRunRequiredStartStage:
        "An active auto implementation workspace run is required before starting a stage.",
      activeRunRequiredPauseStage:
        "An active auto implementation workspace run is required before pausing a stage.",
      activeRunRequiredBlockStage:
        "An active auto implementation workspace run is required before blocking a stage.",
      activeRunRequiredCompleteWorker:
        "An active auto implementation workspace run is required before completing a worker from ledger evidence.",
      completedLedgerRequiredCompleteWorker:
        "A planned or ledger-blocked current-stage worker and a completed ImplementationStepLedger step are required before completing the worker.",
      plannedWorkerRequiredRunWorker: "A planned local Codex worker job is required before running the worker.",
      activeRunRequiredImportWorkerLedger:
        "An active auto implementation workspace run is required before importing worker ledger evidence.",
      workerLedgerImportPrepareFailed: "Worker ledger import request could not be prepared.",
      completedWorkerRequiredAdvanceStage: "A completed local Codex worker job is required before advancing the worker stage.",
      githubIssueMutationUnavailable:
        "This auto implementation GitHub issue mutation is not available for the current run state.",
      activeRunRequiredRecordGitHubIssueDryRun:
        "An active auto implementation workspace run is required before recording a GitHub issue dry-run.",
      activeRunRequiredApplyGitHubIssueCreation:
        "An active auto implementation workspace run is required before applying approved GitHub issue creation.",
      githubIssueAlreadyRecorded:
        "GitHub issue URLs are already recorded; continue with the existing generated issues instead of creating duplicates.",
      pullRequestMutationUnavailable:
        "This auto implementation PR mutation is not available for the current run state.",
      activeRunRequiredRecordPullRequestOpenDryRun:
        "An active auto implementation workspace run is required before recording a PR open dry-run.",
      activeRunRequiredApplyPullRequestOpen:
        "An active auto implementation workspace run is required before applying an approved PR open.",
      pullRequestAlreadyRecorded:
        "A pull request URL is already recorded; update or merge the existing PR instead of opening another one.",
      activeRunRequiredRecordPullRequestDryRun:
        "An active auto implementation workspace run is required before recording a PR body dry-run.",
      activeRunRequiredRecordPullRequestMergeDryRun:
        "An active auto implementation workspace run is required before recording a PR merge dry-run.",
      activeRunRequiredApplyPullRequestBodyUpdate:
        "An active auto implementation workspace run is required before applying an approved PR body update.",
      activeRunRequiredApplyPullRequestMerge:
        "An active auto implementation workspace run is required before applying an approved PR merge.",
      pullRequestMergeAlreadyRecorded:
        "A pull request merge is already recorded; do not merge the same auto implementation PR again."
    },
    workerPlan: "Local worker bounded plan",
    workerRuntimeReadiness: "Worker runtime readiness",
    workerRuntimeStatus: "Runtime status",
    workerRuntimeExecutionMode: "Execution mode",
    workerRuntimeAccount: "Codex account",
    workerRuntimeCheckedAt: "Checked at",
    workerRuntimeAdapterVersion: "Runtime adapter",
    workerRuntimeGeneratedSchemaVersion: "Generated schema version",
    workerRuntimeTransport: "Transport",
    workerRuntimeLiveTurns: "Live turns",
    workerRuntimeManualHandoff: "Manual handoff",
    workerRuntimeLiveTurnStates: {
      enabled: "enabled",
      disabled: "disabled",
      unknown: "unknown"
    },
    workerRuntimeManualHandoffStates: {
      available: "available",
      unavailable: "unavailable",
      unknown: "unknown"
    },
    workerRuntimeReason: "Runtime reason",
    workerRuntimeNextAction: "Worker runtime next action",
    workerRuntimeNextActions: {
      refreshRuntime: "Refresh Codex runtime status before running a local worker; manual worker ledger import remains the fallback once a worker job exists.",
      liveReady: "Live local Codex worker execution is available; run only after the bounded authority and worker job are planned, then keep ledger import available for blocked output.",
      fixture: "Fixture runtime can simulate worker execution; production work still needs live local execution or manual ledger import evidence.",
      codexLogin: "Run Codex login, refresh runtime status, or complete the bounded worker manually and import its ledger evidence.",
      enableLiveTurns: "Set SOLO_CODEX_APP_SERVER_LIVE_TURNS=1 and restart the local sidecar to attempt live worker execution, or complete the bounded worker manually and import its ledger evidence.",
      resolveBlocker: "Resolve the Codex runtime blocker, then rerun the worker or import a completed worker ledger envelope."
    },
    workerPlanExecutionMode: "Execution mode",
    workerPlanWorkingDirectory: "Working directory",
    workerPlanIssueDocument: "Issue document",
    workerPlanExecutionAuthority: "Execution authority",
    workerPlanLedgerTrackerDoc: "Ledger tracker doc",
    workerPlanLedgerStepDoc: "Ledger step doc",
    workerPlanLedgerDocSourceRefs: "Ledger doc source refs",
    workerPlanAllowedWriteScope: "Allowed write scope",
    workerPlanRequiredEvidence: "Required evidence",
    workerPlanForbiddenActions: "Forbidden actions",
    workerPlanSourceRefs: "Source refs",
    workerPlanBlocker: "Blocker",
    workerPlanMissingEvidence: "Missing evidence",
    workerPlanEvidenceRefs: "Job evidence refs",
    missingExecutionAuthority: "Missing ExecutionAuthorityRecord",
    stagePlan: "5-minute stage plan",
    reviewProtocol: "Review and merge protocol",
    issueDocs: "Issue documents",
    githubIssueMutation: "GitHub issue mutation contract",
    githubPullRequestMutation: "GitHub PR mutation evidence",
    pullRequestMutationHistory: (count: number) => `${count} PR mutation record(s) captured.`,
    prMutationRequestMode: "Request mode",
    prMutationMutatesGitHub: "Mutates GitHub",
    prMutationPullRequest: "Pull request",
    prMutationBlockedReason: "Blocked reason",
    prMutationRollbackNotes: "Rollback notes",
    prMutationIssueLinks: "Issue links",
    prMutationReviewStreaks: "Review streak refs",
    prMutationVerificationCommands: "Verification commands",
    prMutationKnownGaps: "Known gaps",
    prMutationApprovalEvidence: "Approval evidence",
    prMutationApprovalRollback: "Approval rollback plan",
    prMutationBodyEvidence: "PR body evidence",
    prMutationMergeEvidence: "Merge evidence",
    prMutationVerifierEvidence: "Verifier evidence",
    prMutationAuditEvidence: "Audit evidence",
    noGithubPullRequestMutations: "No GitHub PR mutation records yet; PR actions remain unclaimed.",
    noPullRequestUrl: "No PR URL recorded",
    notBlocked: "not blocked",
    yes: "yes",
    no: "no",
    none: "none",
    remoteGuide: "Remote connection guide",
    evidenceRefs: "Evidence references",
    noStages: "No implementation stages scheduled yet.",
    noReviewGates: "No review gates recorded yet.",
    noIssueDocs: "No markdown issue documents created yet.",
    noGithubIssuePlans: "No GitHub issue mutation plan has been prepared yet.",
    noGithubIssueUrls: "No GitHub issues have been created; local markdown issue paths remain the source of truth.",
    noRemoteCommands: "Remote is connected or no connection command is needed.",
    noEvidenceRefs: "No workspace evidence references recorded."
  },
  rightRail: {
    aria: "Live project summary",
    planningCompleteness: "Planning completeness",
    researchStatus: "Research status",
    tasks: "tasks",
    activeRuns: "active runs",
    recentActivity: "Recent activity",
    researchNeedsReview: "Research review is not finished yet. Check remaining items and recovery paths first.",
    pending: "pending",
    noActivity: "No activity yet.",
    radarAxes: {
      problem: "Problem",
      customer: "Customer / job",
      value: "Value proposition",
      validation: "Validation plan",
      implementation: "Implementation"
    },
    radarAria: (score: number, readinessLabel: string) => `Planning completeness radar chart, total ${score}%, ${readinessLabel}`
  },
  phase15a: {
    ready: "Ready",
    needsReview: "Needs review",
    title: "Research operations",
    enableResearchSources: "Enable research sources",
    refreshStatus: "Refresh status",
    allowlistScreen: "Research source setup",
    limits: "limits",
    concurrent: "concurrent",
    session: "session",
    retries: "retries",
    disclosure: "disclosure",
    publicSafeSummaryRequired: "safe public summary required",
    policyMissing: "policy not set",
    pause: "Pause",
    revoke: "Revoke",
    noAllowlist: "No research source settings loaded yet.",
    researchRunCards: "Research run cards",
    run: "run",
    attempt: "attempt",
    sourceRefs: "source refs",
    qualityGate: "quality check",
    terminal: "final state",
    recovery: "recovery",
    refetchUnavailable: "refresh unavailable",
    refreshRunStatus: "Refresh status",
    cancel: "Cancel",
    retry: "Retry",
    noResearchRuns: "No research runs loaded yet.",
    qualityGateDisplay: "Quality check display",
    blockers: {
      noActiveAllowlist: "No public-safe research source is active yet.",
      noAllowlistRefetch: "The research source refresh path is not visible yet.",
      noDisclosureRefetch: "The research-use log refresh path is not visible yet.",
      noRunsRefetch: "The research run status refresh path is not visible yet.",
      noRunSse: "Research status update notifications are missing.",
      noQualityGate: "Evidence quality review results are not visible yet.",
      reviewCardRemaining: (title: string) => `Research card still needs review: ${title}`
    },
    allowlistPolicyLoaded: (
      status: string,
      connectors: string,
      sourceCategories: string,
      contextMode: string,
      concurrentRuns: number,
      runsPerSession: number,
      logRequired: boolean
    ) =>
      joinVisibleParts([
        `${status} · ${connectors}`,
        sourceCategories,
        contextMode,
        `${concurrentRuns} concurrent / ${runsPerSession} per session`,
        logRequired ? "activity log required" : null
      ]),
    noAllowlistPolicyLoaded: "No research source settings loaded.",
    disclosureActivityLoaded: (logCount: number, latestStatus: string) =>
      `${logCount} research-use log(s); latest ${latestStatus}`,
    noDisclosureActivity: "No disclosure activity loaded.",
    runRecoveryLoaded: (runCount: number, attentionCount: number, refetchUrl: string) =>
      `${runCount} run(s); ${attentionCount} need review or recovery; refresh ${refetchUrl}`,
    noRunStatus: "No research run status loaded.",
    qualityGatePending: "Quality check has not produced a visible result.",
    exitGateBlocked: "Research review is not finished yet. Check the remaining items and recovery paths first.",
    exitGateReady: "Research results and recovery paths are ready. You can move to execution-readiness review."
  },
  phase15b: {
    rows: {
      summary: "Summary",
      approval: "Approval",
      sandbox: "Execution isolation",
      rollback: "Rollback",
      evidence: "Evidence",
      risk: "Blocked risk",
      source: "Source"
    },
    title: "Execution readiness notes",
    refresh: "Refresh readiness",
    safeExecutionNote: "Safe execution note",
    viewModel: {
      terms: {
        phase15a: "Research readiness",
        phase15b: "Execution readiness",
        readinessPreviewHandoffMetadata: "execution readiness notes",
        blockedActionArtifact: "Blocked action review artifact",
        chatGptDelegation: "External AI workspace",
        chatGptWebAutomation: "External AI workspace automation"
      },
      statusVisible: "Execution readiness notes visible",
      statusPending: "Execution readiness pending",
      summaryVisible: (recordCount: number) =>
        `${recordCount} execution readiness note${recordCount === 1 ? "" : "s"} shown for planning and safety review.`,
      summaryEmpty: "No execution readiness notes are available to show yet.",
      actualWorkNotExecuted: "Actual work has not been executed",
      noExecutionUnloaded:
        "Execution readiness notes have not loaded yet. Actual work has not been executed and credentials have not been stored.",
      reviewNoteOnly: "Review note only; actual work has not been executed",
      delegationState: (value: string) => `delegation state ${value}`,
      credentialState: (value: string) => `credential state ${value}`,
      exportLoaded: (url: string) => `Execution readiness export: ${url}`,
      exportMissing: "Execution readiness export has not loaded yet.",
      loadedEmpty: "This project has no execution readiness notes to show yet.",
      unloadedEmpty: "Execution readiness notes have not loaded yet."
    } satisfies Phase15bReadinessViewModelCopy
  },
  handoff: {
    title: "Planning Handoff",
    sourceRefs: "Source references",
    runGate: "Run planning handoff check",
    refresh: "Refresh handoff",
    planningActionErrors: {
      activeSessionRequiredScoreCompleteness: "An active session is required before scoring completeness.",
      activeSessionRequiredFounderBrief: "An active session is required before preparing a Founder Brief.",
      activeSessionRequiredPlanningHandoff: "An active session is required before running the Planning Handoff gate."
    }
  },
  permissions: {
    externalAiWorkspace: "External AI workspace",
    nextAction: "Next action",
    refreshWorkspace: "Refresh workspace",
    revokeWorkspace: "Revoke workspace",
    fallback: "Fallback",
    fallbackReason: "Fallback reason",
    permissionActionErrors: {
      activeSessionRequiredRevokeWorkspace: "An active session is required before revoking an external AI workspace.",
      activeSessionRequiredRevokeServicePage: "An active session is required before revoking service page-use permission.",
      artifactExportPermissionMismatch:
        "The latest service page-use permission no longer matches this artifact export request.",
      artifactExportBrowserRequired: "Artifact ref export requires a browser document context.",
      activeSessionRequiredDeleteServicePageArtifacts:
        "An active session is required before deleting service page-use artifact refs.",
      artifactDeletePermissionMismatch:
        "The latest service page-use permission no longer matches this artifact delete request."
    },
    permissionActionReasons: {
      revokeWorkspace: "Revoked from the external AI workspace panel.",
      revokeServicePagePermission: "Revoked from the service page-use permission panel.",
      deleteServicePageArtifacts: "User deleted retained service page-use artifact refs from the permission panel.",
      exportArtifactRefsNote:
        "Exports retained artifact references only; credentials, cookies, sessions, 2FA codes, API keys, and raw secret values are never stored or exported.",
      exportArtifactRefsLogMessage: (refCount: number, permissionId: string) =>
        `exported_refs_only: ${refCount} retained refs for ${permissionId}; audit metadata preserved.`
    },
    chatGptDelegationSafety: "ChatGPT delegation safety",
    chatGptDelegationViewModel: {
      visibleHandoffLabels: {
        waiting_for_approval: "ChatGPT browser work does not start before user approval.",
        running:
          "Only visible local browser work is allowed; Solo Superman does not store accounts, cookies, or 2FA.",
        waiting_for_user: "Login, CAPTCHA, usage limits, or UI changes require direct user action.",
        importing_result: "Imported results must pass provenance, uncertainty, con-evidence, and freshness gates.",
        completed:
          "Result import is complete, but retained artifacts must remain exportable or deletable by the user.",
        blocked:
          "Use manual prompt handoff or official paths instead of fully headless ChatGPT Pro automation.",
        failed:
          "Use manual prompt handoff or official paths instead of fully headless ChatGPT Pro automation.",
        revoked: "The user revoked this delegation, so browser work cannot continue.",
        pending_preflight: "Record prompt, redaction, policy, and session-ownership preflight checks first."
      },
      notStarted: {
        summary: "External AI workspace has not been prepared.",
        explanation: "No per-run local browser workspace has been recorded for this session.",
        visibleHandoffLabel:
          "ChatGPT Pro/Deep Research is prepared only as visible delegation in a user-owned browser.",
        nextAction:
          "Plan a research task and prepare a safe browser handoff preview before using an external AI workspace.",
        retentionLabel: "No prompt/result/screenshot/log artifacts are stored yet."
      },
      dataDisclosure: {
        disclosurePreview: (ref: string) => `Disclosure preview: ${ref}`,
        promptContextSummary: (ref: string) => `Prompt context summary: ${ref}`,
        redactedPromptPreview: (ref: string) => `Redacted prompt preview: ${ref}`,
        excludedSensitiveFields: (value: string) => `Excluded sensitive fields: ${value}`,
        redactionPreviewShown: (value: string) => `Redaction preview shown: ${value}`,
        userCanEditPromptBeforeRun: (value: string) => `User can edit prompt before run: ${value}`,
        none: "none",
        yes: "yes",
        no: "no"
      },
      resultImportGate: {
        notEvaluated: "No result import gate has been evaluated yet.",
        sourceProvenance: (status: string, refs: string) => `Source provenance: ${status} (${refs})`,
        noSourceRefs: "no source refs",
        uncertainty: (status: string, refs: string) => `Uncertainty: ${status} (${refs})`,
        noUncertaintyRefs: "no uncertainty refs",
        conEvidence: (status: string, refs: string) => `Con evidence: ${status} (${refs})`,
        noConEvidenceRefs: "no con evidence refs",
        staleRisk: (status: string, refs: string) => `Stale risk: ${status} (${refs})`,
        noStaleRiskRefs: "no stale risk refs",
        importRationale: (rationale: string) => `Import rationale: ${rationale}`
      },
      artifactControls: {
        exportRetained: "Export retained prompt/result/screenshot/log artifact refs",
        deleteRetained: "Delete retained artifacts while leaving audit metadata only"
      },
      missingBrowserActionAuthority: "missing browser action authority",
      noResultImport: "No result import has been captured yet.",
      retentionWithControls:
        "Prompt/result/screenshot/log artifacts are retained by default with export/delete controls; deleting artifacts leaves audit metadata only.",
      retentionUnavailable: "Artifact retention controls are unavailable for this run."
    } satisfies ChatGptDelegationViewModelCopy,
    dataDisclosurePreview: "Data disclosure preview",
    policyRiskVerdict: "Policy risk verdict",
    sessionOwnershipVerdict: "Session ownership verdict",
    evidenceRefs: "Evidence refs",
    noEvidenceRefs: "no evidence refs",
    approvalDecision: "Approval decision",
    browserActionAuthority: "Browser action authority",
    resultImport: "Result import",
    resultImportGate: "Result import gate",
    storedArtifacts: "Saved artifacts",
    artifactControlTitle:
      "This PR exposes the artifact control surface and retained refs; artifact content export/delete execution remains separate from revoke.",
    redactionPreview: "Redaction preview",
    noRetainedArtifactRefs: "No saved artifact references.",
    activityFeedLinks: "Activity feed links",
    noLinkedResearchDecisionRefs: "No linked research or decision references.",
    auditLog: "Audit log",
    noAuditEntries: "No audit entries yet.",
    serviceLoginPermission: "Service login permission",
    refreshServicePermission: "Refresh service permission",
    revokeServicePermission: "Revoke service permission",
    permissionPreview: "Permission preview",
    service: "Service",
    pageUrl: "Page URL",
    purpose: "Purpose",
    allowedActions: "Allowed actions",
    blockedActions: "Blocked actions",
    visibleDataCategories: "Visible data categories",
    approvalGranularity: "Approval granularity",
    userApproval: "User approval",
    loginBoundary: "Login boundary",
    finalSubmitBoundary: "Final submit boundary",
    blockedReasons: "Blocked reasons",
    noLinkedSetupDecisionRefs: "No linked setup or decision references.",
    noServicePermissionAuditEntries: "No service permission audit entries yet."
  },
  ledger: {
    title: "Implementation log",
    nextAction: "Next action",
    refresh: "Refresh implementation log",
    latestStep: "Latest step",
    step: "Step",
    scope: "Scope",
    progressReport: "Progress report",
    missingEvidence: "Missing or blocked evidence",
    evidenceRefs: "Evidence references",
    noEvidenceRefs: "No implementation evidence references recorded."
  }
};

const JA_COPY: typeof EN_COPY = {
  pageMeta: {
    onboarding: {
      label: "オンボーディング",
      shortLabel: "O",
      title: "オンボーディング",
      description: "ChatGPTとCodexにログインし、最初の質問セットの前に目標を設定します。"
    },
    questions: {
      label: "質問",
      shortLabel: "Q",
      title: "質問",
      description: "現在の質問、次の質問、既知のリスクを一つの画面で整理します。"
    },
    research: {
      label: "リサーチ",
      shortLabel: "R",
      title: "リサーチ確認",
      description: "承認済みの公開リサーチと手動で追加した根拠を管理します。"
    },
    planning: {
      label: "計画",
      shortLabel: "P",
      title: "計画の準備状況",
      description: "プロダクト仕様、準備スコア、Founder Brief、引き継ぎ確認を見直します。"
    },
    implementation: {
      label: "実装",
      shortLabel: "I",
      title: "実装の動き",
      description: "ローカルでの動きと実装ログを一つの流れで追跡します。"
    },
    permissions: {
      label: "権限",
      shortLabel: "A",
      title: "委任と権限",
      description: "外部AIワークスペースとサービスページの利用権限を分けて確認します。"
    }
  },
  projectPurposeModeOptions: [
    {
      mode: "business",
      label: "事業検証",
      description: "顧客、課題の強さ、有料意向、競合、チャネル、法務/運用リスクを検証します。"
    },
    {
      mode: "personal",
      label: "個人ワークフローの構築",
      description: "市場向けの説明よりも、自分の作業フロー、画面、実装可能性、ローカルデータやセキュリティに集中します。"
    }
  ],
  businessCriticIntensityOptions: [
    {
      intensity: "balanced",
      label: "バランス型事業レビュー",
      description: "主要な判断領域ごとに、少なくとも1つの反証質問を残します。"
    },
    {
      intensity: "strong",
      label: "強い事業レビュー",
      description: "重要な事業上の弱点がある場合、核心仮説への反証質問を残します。"
    },
    {
      intensity: "investor_grade",
      label: "投資審査級レビュー",
      description: "価格、チャネル、継続利用の兆候、法務・運用リスク、市場タイミング、創業者の強みを厳しく検証します。"
    }
  ],
  layout: {
    localQueueFallback: "ローカル計画ワークスペース",
    workflowSectionsAria: "デスクトップのワークフロー区分",
    leftRailAria: "ワークフローナビゲーション",
    workflowSteps: "作業ステップ",
    progressAria: "ライブキュー進捗",
    progress: "進捗",
    completeness: "完成度",
    pendingQuestions: "待機中の質問",
    blockedQuestions: "ブロック中の質問",
    reconnectSidecar: "ローカルサービスに再接続",
    sidecarUnavailable: "ローカルサービスを利用できません",
    sidecarUnavailableMessage: "ローカルサービスに接続されていません。",
    sidecarUnavailableRecovery: "ローカルサービスに接続されていません。`pnpm start:local`でSolo Supermanを起動し、再接続してからCodexログインをもう一度開いてください。",
    retryConnection: "再接続",
    commandFailed: "操作に失敗しました"
  },
  nav: {
    onboardingReady: "ログイン + 目標設定",
    onboardingComplete: "最初の質問を作成済み",
    questionsSublabel: (active: number, next: number) => `${active} active · ${next} next`,
    researchSublabel: (tasks: number, runs: number) => `${tasks} tasks · ${runs} runs`,
    permissionsSublabel: (workspaceStatus: string, permissionStatus: string) => `${workspaceStatus} · ${permissionStatus}`
  },
  questions: {
    sessionStart: "セッションを始める",
    firstRunAria: "目標設定ガイド",
    firstRunTitle: "目標設定",
    firstRunItems: [
      "アイデアの概要と目標を書くと、Solo Superman が最初の質問セットを作成します。",
      "事業検証の場合は、どの程度厳しく問い直すかを自分で選びます。",
      "リサーチと実装準備はまず確認できるノートとして残し、危険な操作は自動実行しません。"
    ],
    initialQueueStartBlockers: {
      busy: "最初の質問セットはすでに作成中です。",
      chatgpt_login: "開始前にChatGPTへ直接ログインしたことを確認してください。",
      codex_login:
        "バックエンド質問またはリサーチ準備を始める前に、ローカルCodex CLIログインを確認する必要があります。",
      sidecar_connection: "ローカルサービスが接続されていません。",
      project_purpose: "開始前に事業検証または個人ワークフロー構築のどちらかを選んでください。",
      business_critic_intensity: "事業検証キューを確定する前に、事業レビュー強度を選んでください。",
      idea: "開始前にアイデア概要を入力してください。",
      intake: "開始前に目標の説明を入力してください。"
    },
    sessionActionErrors: {
      activeSessionRequiredProjectPurpose: "プロジェクト目的を変更するにはアクティブなセッションが必要です。",
      projectPurposeAlreadySelected: "プロジェクト目的はすでに選択した値に設定されています。",
      activeSessionRequiredBusinessCriticIntensity:
        "事業レビュー強度を変更するにはアクティブなセッションが必要です。",
      businessCriticIntensityBusinessOnly: "事業レビュー強度は、事業検証プロジェクトでのみ変更できます。",
      activeSessionRequiredSubmitAnswer: "回答を送信するにはアクティブなセッションが必要です。",
      answerTextRequired: "回答テキストが必要です。",
      activeSessionRequiredDraftedAnswers: "下書き回答を送信するにはアクティブなセッションが必要です。",
      draftedAnswersRequired: "下書き回答を送信する前に、少なくとも1つのアクティブな質問に回答してください。",
      draftedAnswersPartialFailureRefreshed:
        " 失敗前に一部の下書き回答が送信され、キューは更新されました。",
      draftedAnswersPartialFailureRefreshRequired:
        " 失敗前に一部の下書き回答が送信されました。続行する前にキューを更新してください。",
      activeSessionRequiredRefreshQuestions: "質問を更新するにはアクティブなセッションが必要です。",
      activeSessionRequiredLoadNextQuestions: "次の質問リストを読み込むにはアクティブなセッションが必要です。",
      answerCurrentBeforeLoadNextQuestions:
        "次の質問リストを読み込む前に、現在の質問に回答するか保存してください。",
      activeSessionRequiredKnownRisk: "キュー項目をKnown Riskに移すにはアクティブなセッションが必要です。",
      knownRiskNextValidationActionRequired:
        "business critic項目をKnown Riskに移すには、次の検証アクションが必要です。",
      activeSessionRequiredImportResearch: "リサーチを取り込むにはアクティブなセッションが必要です。",
      researchResultTextRequired: "リサーチ結果テキストが必要です。",
      activeSessionRequiredResolveResearchCard: "リサーチカードを解決するにはアクティブなセッションが必要です。"
    },
    sessionActionReasons: {
      projectPurposeConfirmed: (label: string) => `${label}を開始前にユーザーが確認しました。`,
      businessCriticIntensityConfirmed: (label: string) => `${label}を開始前にユーザーが確認しました。`,
      projectPurposeChanged: (label: string) => `ユーザーがプロジェクト目的を${label}に変更しました。`,
      businessCriticIntensityChanged: (label: string) =>
        `ユーザーが事業レビュー強度を${label}に変更しました。`,
      businessCriticKnownRiskDeferred: "ユーザーがbusiness critic項目をKnown Riskに移しました。",
      manualResearchSourceTitle: "手動デスクリサーチ",
      manualResearchLimitationNotes: "創業者が提供した情報源からの手動取り込みです。",
      researchCardOutcomeRationale: (outcome: ResearchQueueTerminalOutcome, title: string) =>
        `リサーチカード「${title}」を${outcome}として処理しました。`,
      researchCardResolvedRationale: (outcome: ResearchQueueTerminalOutcome, title: string) =>
        `リサーチカード「${title}」を${outcome}として解決しました。`
    },
    chatGptLoginAria: "ChatGPT直接ログイン確認",
    chatGptLoginTitle: "先にブラウザでChatGPTにログイン",
    chatGptLoginDescription: "最初の質問セットを作成する前に、このブラウザプロファイルでChatGPTを開き、自分でログインします。",
    chatGptCredentialBoundary: "Solo Supermanはパスワード、2FAコード、セッションCookie、API key、secretを要求・保存しません。",
    chatGptLoginOpen: "ChatGPTを開く",
    chatGptLoginAcknowledge: "このブラウザ/プロファイルでChatGPTに直接ログインしました。",
    codexLoginAria: "Codex CLIログイン確認",
    codexLoginTitle: "backendの質問・リサーチ用にCodex CLIへログイン",
    codexLoginDescription: "ローカルsidecarは、backendの質問やリサーチpreviewを始める前にCodex CLI状態を確認します。必要なら`codex auth login`を実行するバックグラウンドTerminalを開き、Codexがブラウザのログイン画面を表示します。",
    codexCredentialBoundary: "Solo SupermanはCodexのアカウント状態だけを読み取ります。access token、API key、password、cookieは要求・保存しません。",
    codexLoginStatus: "Codex状態",
    codexLoginCommandLabel: "バックグラウンドTerminalコマンド",
    codexLoginStart: "Codexログインを開く",
    codexLoginRefresh: "Codexログイン状態を更新",
    codexLoginStatusLabels: {
      authenticated: "ログイン済み",
      missing: "ログインが必要",
      unknown: "不明",
      blocked: "ブロック中"
    },
    rawIdea: "アイデア概要",
    rawIdeaPlaceholder: "例: 創業者向けのFounder Brief生成ツール",
    intakeAnswer: "目標の説明",
    intakeAnswerPlaceholder: "誰のために、どの問題を解決し、このセッションで何を決めたいかを書いてください。",
    projectPurpose: "プロジェクト目的",
    purposeHelp: "プロジェクト目的は自分で選びます。選択するまで、事業向け・個人ワークフロー向けの質問は確定しません。",
    initialResearchPermission: "リサーチ権限",
    initialResearchPermissionOptions: [
      {
        permission: "not_now" as const,
        label: "リサーチ設定は後で行う",
        description: "今は質問だけ作成し、Research タブで有効化するまで公開 Web リサーチを無効のままにします。"
      },
      {
        permission: "allow_public_web" as const,
        label: "読み取り専用の公開 Web リサーチを許可",
        description: "オンボーディング中に安全な allowlist を有効化し、承認済みの読み取り専用ソースを使えるようにします。"
      }
    ],
    initialResearchPermissionHelp: "これは公開・読み取り専用リサーチソースだけの設定です。書き込み、認証情報、アカウント、有料サービスへのアクセスは許可しません。",
    businessCriticIntensity: "事業レビューの強さ",
    intensityReason: "この強さを選ぶ理由",
    intensityReasonPlaceholder: "この問い直しの強さが合う理由を書いてください。",
    intensityHelp: "事業検証では、最初の質問セットを作る前にレビューの強さを明示する必要があります。",
    running: "実行中",
    createFirstBatch: "最初の質問を作成",
    queue: "キュー",
    refreshQuestionList: "質問リストを更新",
    loadNextQuestions: "次の質問を読み込む",
    questionProgressTitle: "質問の進捗",
    questionProgressSummary: (handled: number, generated: number, percent: number) =>
      `生成済み質問 ${generated}件中 ${handled}件処理 · ${percent}%`,
    questionProgressGenerated: "生成済み",
    questionProgressOpen: "残り質問",
    questionProgressVisible: "表示中",
    questionProgressActive: "回答中",
    questionProgressUpcoming: "次の質問",
    questionProgressAnswered: "回答済み",
    questionProgressFollowUps: "追加質問",
    questionProgressOpenFollowUps: "未回答の追加質問",
    questionProgressTopics: "対象トピック",
    questionProgressOpenTopics: "未解決トピック",
    questionProgressFollowUpBudget: "追加質問枠",
    questionProgressBlocked: "ブロック中",
    questionFatigueStatusLabels: {
      checkpoint: "疲労チェックポイント",
      break_recommended: "休憩を推奨"
    },
    questionFatigueSummary: (open: number, generated: number, percent: number) =>
      `${generated}件の生成済み質問のうち${percent}%を処理済みで、未解決が${open}件残っています。`,
    questionFatigueHelp: "今の質問セットだけに答える、弱い仮説を既知リスクとして残す、または次を読み込む前に一度止めることができます。",
    questionFatigueFollowUpBudget: (count: number) => `追加質問枠は${count}件残っています。意図的に使ってください。`,
    researchAdditionalQuestions: "リサーチ生成の質問",
    researchFollowUpSourceTrace: "ソーストレース",
    businessCriticCategoryLabels: {
      customer_pain: "顧客の痛み",
      paid_intent: "支払い意向",
      alternatives: "代替手段",
      pricing: "価格",
      acquisition: "ユーザー獲得",
      mvp_validation: "初期版の検証",
      legal_ops_security: "法務・運用・セキュリティ",
      retention_proxy: "継続利用の兆し",
      market_timing: "市場タイミング",
      founder_advantage: "作り手・チームの強み"
    },
    businessCriticPressureKindLabels: {
      balanced_con: "バランス型の問い直し",
      core_assumption_challenge: "核心仮説の確認",
      investor_pressure_pass: "投資審査目線の検証"
    },
    whyItMatters: "なぜ重要か",
    decisionItUnlocks: "この回答で決まる判断",
    nextValidation: "次の検証",
    suggestedAnswers: "回答候補",
    optionPro: "長所",
    optionCon: "短所",
    customAnswer: "合う選択肢がなければ直接入力",
    customAnswerPlaceholder: "候補が状況に合わない場合は、ここに自分の回答を書いてください。",
    answerAriaPrefix: "回答",
    submitAnswer: "回答を送信",
    submitDraftedAnswers: (count: number) =>
      count > 0 ? `下書き回答 ${count}件を送信` : "下書き回答を送信",
    nextValidationActionAriaPrefix: "次の検証アクション",
    additionalRiskDetails: "追加コメントまたはリスクを入力",
    additionalRiskHelp: "任意: 今すぐ回答せず、既知リスクとして残す場合だけ使います。",
    knownRiskPlaceholder: "既知のリスクとして残す場合、次の検証ステップを書いてください。",
    carryAsKnownRisk: "既知のリスクとして残す",
    queueRecoveryFresh: "質問は最新です。ローカルサービスの更新が届くと、この一覧を更新します。",
    queueRefetchMissing: "質問を更新する経路はまだ読み込まれていません。",
    queueSseMissing: "ライブ更新通知はまだ接続されていません。",
    queueActiveBatchMissing: "現在の質問の詳細はまだ読み込まれていません。",
    queueRefetchReady: (url: string) => `質問の更新 ${url}`,
    queueSseReady: (url: string) => `ライブ更新ストリーム ${url}`,
    queueActiveBatchReady: (count: number) => `${count}件の現在の質問がこのラウンドに選ばれています。`,
    queueRecoveryStatusLabels: {
      idle: "最新",
      pending_refetch: "更新待ち",
      recovering: "更新中",
      recovered_by_refetch: "更新済み",
      stale: "更新が必要"
    },
    queueRecoveryMessages: {
      idle: "質問は最新です。ローカルサービスの更新が届くと、この一覧を更新します。",
      pending_refetch: "質問の更新が待機中です。この一覧はローカルサービスから更新されます。",
      recovering: "ライブ更新または再接続の後、質問を更新しています。",
      recovered_by_refetch: "ライブ更新の後に質問を更新しました。",
      stale: "質問が古い可能性があります。判断材料にする前に更新してください。"
    },
    queueItemStateLabels: {
      active: "現在",
      next: "次の候補",
      blocked: "ブロック中",
      deferred: "既知のリスク",
      answered: "回答済み",
      resolved: "解決済み"
    },
    queueSections: {
      active: { title: "現在の質問", emptyLabel: "現在の質問はありません。" },
      next: { title: "次に確認", emptyLabel: "次に確認する質問はありません。" },
      blocked: { title: "確認が必要", emptyLabel: "ブロック中の項目はありません。" },
      deferred: { title: "後で確認", emptyLabel: "後で確認する項目はありません。" }
    }
  },
  planning: {
    spec: "プロダクト仕様",
    sessionStatusLabels: {
      none: "未開始",
      scaffold: "未開始",
      intake: "質問進行中",
      spec: "Spec-ready",
      validation: "Research in progress",
      complete: "安全な実行待ち"
    },
    noSpecDraft: "仕様ドラフトはまだありません。",
    sessionVersion: "セッションバージョン",
    specSections: "仕様セクション",
    approval: "承認",
    projectPurpose: "プロジェクト目的",
    businessCritic: "事業レビュー",
    notSelected: "未選択",
    notApplicable: "対象外",
    skippedCommercializationAxes: "除外した事業化チェック",
    skippedCommercializationAxesHelp: "Personal mode では、これらの事業/投資家向けチェックを見える状態に保ちながら、必須の完成度ゲートからは外します。",
    commercializationAxisLabel: (axis: string) =>
      commercializationAxisLabel(axis, {
        market_size: "市場規模",
        investor_narrative: "投資家向けストーリー",
        willingness_to_pay: "支払い意向",
        acquisition_channel: "獲得チャネル",
        competition_pressure: "競合圧力"
      }),
    businessCriticChangeReason: "事業批判強度の変更理由",
    businessCriticChangeReasonPlaceholder: "事業検証強度を変える理由を記録します。",
    changeTo: (label: string) => `${label}に変更`,
    businessCriticAuditHelp: "変更は監査ログに残り、現在の質問を置き換えずに新しい問い直しを追加します。",
    modeChangeReason: "モード変更理由",
    modeChangeReasonPlaceholder: "質問/リサーチ基準を変える理由を記録します。",
    modeAuditHelp: "変更は監査ログに残り、現在の質問セットは維持されます。",
    progress: "進捗",
    pending: "保留中",
    scoreCompleteness: "完成度を採点",
    noRiskProjection: "リスク予測はまだありません。",
    confidenceMap: "信頼度マップ",
    confidenceMapHelp: "現在の Planning スコアの根拠になるスコア要因と準備ゲートを表示します。",
    scoreBreakdownLabels: {
      sectionCompleteness: "仕様セクション",
      questionDebtResolution: "質問負債",
      evidenceQuality: "証拠品質",
      decisionApproval: "意思決定承認",
      consistencyAndConflict: "一貫性"
    },
    completionCandidate: "完成候補",
    completionCandidateStatusLabels: {
      candidate: "候補",
      not_ready: "未準備"
    },
    confidenceGateFailures: "準備ゲートのブロッカー",
    confidenceGatesReady: "すべての準備ゲートを通過しています。",
    nextBestActions: "次の最善アクション",
    ifStopNowArtifact: "今止める場合",
    ifStopNowKnownRisks: "今止める場合の既知リスク",
    ifStopNowNextValidationActions: "今止める場合の次の検証アクション",
    topRiskCards: "上位3つのリスクカード",
    riskSeverity: "深刻度",
    riskSeverityLabels: { low: "低", medium: "中", high: "高" },
    riskNextValidation: "次の検証アクション",
    riskNextValidationAriaPrefix: "次の検証アクション:",
    riskSourceRefs: "参照元",
    riskNoSourceRefs: "参照元なし",
    founderBrief: "Founder Brief",
    founderBriefRiskActions: "Founder Brief リスクアクション",
    founderBriefKnownRisks: "Founder Brief の既知リスク",
    founderBriefNextValidationActions: "Founder Brief の次の検証アクション",
    ready: "準備完了",
    draft: "ドラフト",
    prepareExportMetadata: "エクスポート情報を準備",
    noFounderBrief: "Founder Brief はまだ準備されていません。"
  },
  research: {
    research: "リサーチ",
    unknown: "不明",
    planResearchTask: "リサーチタスクを計画",
    rationale: "根拠",
    importResearchAriaPrefix: "リサーチ取り込み",
    importResult: "結果を取り込む",
    startReadOnlyRun: "公開Webリサーチを開始",
    startReadyReadOnlyRuns: (count: number) =>
      count === 0 ? "開始できる公開Webリサーチはありません" : `準備済み公開Webリサーチを${count}件開始`,
    readyReadOnlyRunsPlanTitle: "準備済み公開Webバッチ計画",
    readyReadOnlyRunsPlanReady: (count: number) =>
      count === 1
        ? "読み取り専用リサーチタスク1件を active allowlist の予算内で開始します。"
        : `読み取り専用リサーチタスク${count}件を active allowlist の予算内で開始します。`,
    readyReadOnlyRunsPlanBlocked: {
      missing_allowlist: "準備済みバッチを開始する前に active public web allowlist を作成または再有効化してください。",
      no_ready_tasks: "active allowlist の concurrency budget 内で開始できる planned public-web task はありません。"
    },
    researchActionErrors: {
      activeProjectRequiredAllowlistChange: "リサーチallowlistを変更するにはアクティブなプロジェクトが必要です。",
      activeProjectRequiredPauseAllowlist: "リサーチallowlistを一時停止するにはアクティブなプロジェクトが必要です。",
      activeProjectRequiredRevokeAllowlist: "リサーチallowlistを取り消すにはアクティブなプロジェクトが必要です。",
      activeSessionRequiredPlanResearch: "public-safeリサーチを計画するにはアクティブなセッションが必要です。",
      sidecarConnectionRequiredStartRun: "リサーチ実行を開始するにはsidecar接続が必要です。",
      activeProjectRequiredStartRun: "リサーチ実行を開始するにはアクティブなプロジェクトが必要です。",
      plannedTaskRequiredStartRun: "読み取り専用リサーチ実行を始める前に、計画済みリサーチタスクを選択してください。",
      plannedTaskStatusRequiredStartRun: "新しい読み取り専用リサーチ実行を開始できるのは計画済みタスクだけです。",
      activeAllowlistRequiredStartRun:
        "リサーチ実行を始める前に active public web allowlist を作成または再有効化してください。",
      activeProjectRequiredReadyRuns: "準備済みリサーチ実行を始めるにはアクティブなプロジェクトが必要です。",
      readyRunsMissingAllowlist:
        "リサーチ実行を始める前に active public web allowlist を作成または再有効化してください。",
      readyRunsNoReadyTasks:
        "active allowlist の concurrency budget 内で開始できる planned public web research task はありません。",
      backgroundStartAfterAnswerFailed: (error: string) =>
        `回答は送信されましたが、自動public webリサーチ開始に失敗しました: ${error}`,
      activeProjectRequiredRefreshRunStatus: "リサーチ実行状態を更新するにはアクティブなプロジェクトが必要です。",
      activeProjectRequiredCancelRun: "リサーチ実行をキャンセルするにはアクティブなプロジェクトが必要です。",
      activeProjectRequiredRetryRun: "リサーチ実行を再試行するにはアクティブなプロジェクトが必要です。"
    },
    researchActionReasons: {
      pauseAllowlist: "リサーチ運用画面から一時停止しました。",
      revokeAllowlist: "リサーチ運用画面から取り消しました。",
      planPublicSafeObjective: "リサーチループの公開オンボーディング根拠と品質ゲート準備を検証します。",
      cancelRun: "リサーチ運用画面からキャンセルしました。",
      retryRun: "リサーチ運用画面から手動で再試行しました。"
    },
    readyReadOnlyRunsPlanTaskIds: "このバッチで開始する task ID",
    validationSummary: "検証サマリー",
    knownRisks: "既知のリスク",
    nextValidationAction: "次の検証アクション",
    nextValidationActions: "次の検証アクション",
    evidencePacks: "エビデンスパック",
    evidencePackSource: "出典",
    decisionContext: "判断文脈",
    sourceReliability: "出典信頼度",
    gateStatus: "ゲート状態",
    gateChecks: "ゲート確認",
    noGateChecks: "ゲート確認なし",
    limitationRefs: "制約",
    evidenceMatrix: "エビデンスマトリクス",
    balanceStatus: "バランス状態",
    decisionBlocked: "Planningブロック中",
    decisionReady: "Planningブロックなし",
    proEvidence: "賛成エビデンス",
    conEvidence: "反証エビデンス",
    uncertainties: "不確実性",
    missingConEvidenceReason: "反証不足の理由",
    knownRisk: "既知のリスク",
    noEvidenceItems: "エビデンス項目なし",
    additionalQuestions: "リサーチが生成した追加質問",
    sourceTrace: "参照元トレース",
    noResearchTasks: "リサーチタスクはまだありません。"
  },
  implementation: {
    runtimeEvidence: "実行記録",
    adapterPrefix: "ツール",
    effectSuffix: "件",
    noCommandStatus: "コマンドステータス記録はまだありません。",
    activity: "活動",
    pending: "保留中",
    refreshStatus: "ステータス更新",
    refreshRuntimeStatus: "Runtime状態を更新",
    runtimeEvidenceDetails: "Runtime evidence details",
    runtimeCheckedAt: "Runtime確認時刻",
    runtimeAdapterVersion: "Runtime adapter",
    runtimeGeneratedSchemaVersion: "生成schema version",
    runtimeTransport: "Transport",
    runtimeExecutionMode: "実行モード",
    runtimeAccount: "Codexアカウント",
    runtimeLiveTurns: "Live turns",
    runtimeManualHandoff: "手動引き継ぎ",
    runtimeLiveTurnStates: {
      enabled: "有効",
      disabled: "無効",
      unknown: "不明"
    },
    runtimeManualHandoffStates: {
      available: "利用可能",
      unavailable: "利用不可",
      unknown: "不明"
    },
    unknown: "不明",
    noActivity: "活動はまだありません。"
  },
  autoImplementation: {
    title: "自動実装ワークスペース",
    create: "ワークスペース実行を作成",
    reprepare: "ワークスペース実行を確認",
    planWorkerJob: "Worker権限を承認してjobを計画",
    recordStageTick: "現在のstage tickを記録",
    startStage: "現在のstageを開始",
    pauseStage: "現在のstageを一時停止",
    blockStage: "現在のstageをブロック",
    completeWorkerJob: "Ledgerからworkerを完了",
    importWorkerLedger: "Worker ledgerをimport",
    workerLedgerImport: "Worker ledger import JSON",
    workerLedgerImportPlaceholder: "ローカルCodex worker出力の { \"ledgerTransitions\": [...] } か raw transition array を貼り付けてください。",
    recordGitHubIssueDryRun: "GitHub issue dry-runを記録",
    applyGitHubIssueCreation: "承認済みGitHub issue作成を適用",
    recordPullRequestOpenDryRun: "PR作成dry-runを記録",
    applyPullRequestOpen: "承認済みPR作成を適用",
    recordPullRequestDryRun: "PR本文dry-runを記録",
    recordPullRequestMergeDryRun: "PR merge dry-runを記録",
    applyPullRequestBodyUpdate: "承認済みPR本文更新を適用",
    applyPullRequestMerge: "承認済みPR mergeを適用",
    runWorkerJob: "Worker jobを実行",
    advanceWorkerStage: "Worker stageを進める",
    refresh: "ワークスペース実行を更新",
    actionErrors: {
      activeSessionRequiredCreateWorkspace: "自動実装ワークスペースを作成するにはアクティブなセッションが必要です。",
      planningHandoffMustBeReady:
        "自動実装ワークスペースを作成または再準備する前に、計画引き継ぎが planning_ready である必要があります。",
      planningHandoffRequired:
        "自動実装ワークスペースを作成する前に、計画引き継ぎゲートを実行して planning_ready にしてください。",
      workspaceCreationFailed: (error: string) => `自動実装ワークスペースの作成に失敗しました: ${error}`,
      activeRunRequiredPlanWorker: "ローカルworker jobを計画するにはアクティブな自動実装ワークスペース実行が必要です。",
      currentStageWorkerMustContinue:
        "別のローカルworker jobを計画する前に、最新の現在stage workerを実行、import、完了、またはadvanceしてください。",
      activeRunRequiredStageTick: "stage tickを記録するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredStartStage: "stageを開始するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredPauseStage: "stageを一時停止するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredBlockStage: "stageをブロックするにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredCompleteWorker:
        "ledger evidenceからworkerを完了するにはアクティブな自動実装ワークスペース実行が必要です。",
      completedLedgerRequiredCompleteWorker:
        "workerを完了するには、計画済みまたはledger-blockedの現在stage workerと完了済みImplementationStepLedger stepが必要です。",
      plannedWorkerRequiredRunWorker: "workerを実行するには計画済みローカルCodex worker jobが必要です。",
      activeRunRequiredImportWorkerLedger:
        "worker ledger evidenceをimportするにはアクティブな自動実装ワークスペース実行が必要です。",
      workerLedgerImportPrepareFailed: "Worker ledger import requestを準備できませんでした。",
      completedWorkerRequiredAdvanceStage: "worker stageを進めるには完了済みローカルCodex worker jobが必要です。",
      githubIssueMutationUnavailable:
        "現在のrun状態では、この自動実装GitHub issue mutationは利用できません。",
      activeRunRequiredRecordGitHubIssueDryRun:
        "GitHub issue dry-runを記録するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredApplyGitHubIssueCreation:
        "承認済みGitHub issue作成を適用するにはアクティブな自動実装ワークスペース実行が必要です。",
      githubIssueAlreadyRecorded:
        "GitHub issue URLはすでに記録されています。重複作成せず、既存の生成済みissueを続行してください。",
      pullRequestMutationUnavailable: "現在のrun状態では、この自動実装PR mutationは利用できません。",
      activeRunRequiredRecordPullRequestOpenDryRun:
        "PR作成dry-runを記録するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredApplyPullRequestOpen:
        "承認済みPR作成を適用するにはアクティブな自動実装ワークスペース実行が必要です。",
      pullRequestAlreadyRecorded: "PR URLはすでに記録されています。新しく開かず、既存PRを更新またはmergeしてください。",
      activeRunRequiredRecordPullRequestDryRun:
        "PR本文dry-runを記録するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredRecordPullRequestMergeDryRun:
        "PR merge dry-runを記録するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredApplyPullRequestBodyUpdate:
        "承認済みPR本文更新を適用するにはアクティブな自動実装ワークスペース実行が必要です。",
      activeRunRequiredApplyPullRequestMerge:
        "承認済みPR mergeを適用するにはアクティブな自動実装ワークスペース実行が必要です。",
      pullRequestMergeAlreadyRecorded: "PR mergeはすでに記録されています。同じ自動実装PRを再mergeしないでください。"
    },
    workerPlan: "ローカルworkerの境界付き計画",
    workerRuntimeReadiness: "Worker実行環境の準備状態",
    workerRuntimeStatus: "Runtime状態",
    workerRuntimeExecutionMode: "実行モード",
    workerRuntimeAccount: "Codexアカウント",
    workerRuntimeCheckedAt: "確認時刻",
    workerRuntimeAdapterVersion: "Runtime adapter",
    workerRuntimeGeneratedSchemaVersion: "生成schema version",
    workerRuntimeTransport: "Transport",
    workerRuntimeLiveTurns: "Live turns",
    workerRuntimeManualHandoff: "手動引き継ぎ",
    workerRuntimeLiveTurnStates: {
      enabled: "有効",
      disabled: "無効",
      unknown: "不明"
    },
    workerRuntimeManualHandoffStates: {
      available: "利用可能",
      unavailable: "利用不可",
      unknown: "不明"
    },
    workerRuntimeReason: "Runtime理由",
    workerRuntimeNextAction: "Worker runtimeの次アクション",
    workerRuntimeNextActions: {
      refreshRuntime: "ローカルworker実行前にCodex runtime状態を更新します。worker job作成後は手動worker ledger importがfallbackです。",
      liveReady: "Live local Codex worker executionを利用できます。境界付き権限とworker jobを計画してから実行し、出力がblockedの場合はledger importを残します。",
      fixture: "Fixture runtimeはworker実行をシミュレートできます。本番作業にはlive local実行またはmanual ledger import evidenceが必要です。",
      codexLogin: "Codex loginを実行し、runtime状態を更新するか、境界付きworkerを手動で完了してledger evidenceをimportします。",
      enableLiveTurns: "SOLO_CODEX_APP_SERVER_LIVE_TURNS=1を設定してlocal sidecarを再起動するか、境界付きworkerを手動で完了してledger evidenceをimportします。",
      resolveBlocker: "Codex runtime blockerを解消してworkerを再実行するか、完了済みworker ledger envelopeをimportします。"
    },
    workerPlanExecutionMode: "実行モード",
    workerPlanWorkingDirectory: "作業ディレクトリ",
    workerPlanIssueDocument: "Issue文書",
    workerPlanExecutionAuthority: "実行権限",
    workerPlanLedgerTrackerDoc: "Ledger tracker doc",
    workerPlanLedgerStepDoc: "Ledger step doc",
    workerPlanLedgerDocSourceRefs: "Ledger doc参照元",
    workerPlanAllowedWriteScope: "許可された書き込み範囲",
    workerPlanRequiredEvidence: "必須根拠",
    workerPlanForbiddenActions: "禁止アクション",
    workerPlanSourceRefs: "参照元",
    workerPlanBlocker: "ブロッカー",
    workerPlanMissingEvidence: "不足している根拠",
    workerPlanEvidenceRefs: "Job確認資料",
    missingExecutionAuthority: "ExecutionAuthorityRecord未作成",
    stagePlan: "5分間隔のステージ計画",
    reviewProtocol: "レビューとマージの手順",
    issueDocs: "Issue文書",
    githubIssueMutation: "GitHub issue mutation contract",
    githubPullRequestMutation: "GitHub PR mutation evidence",
    pullRequestMutationHistory: (count: number) => `${count} 件のPR mutation記録があります。`,
    prMutationRequestMode: "リクエストモード",
    prMutationMutatesGitHub: "GitHubを変更",
    prMutationPullRequest: "Pull request",
    prMutationBlockedReason: "ブロック理由",
    prMutationRollbackNotes: "ロールバックメモ",
    prMutationIssueLinks: "Issueリンク",
    prMutationReviewStreaks: "レビュー連続パス",
    prMutationVerificationCommands: "検証コマンド",
    prMutationKnownGaps: "既知の不足",
    prMutationApprovalEvidence: "承認根拠",
    prMutationApprovalRollback: "承認ロールバック計画",
    prMutationBodyEvidence: "PR本文の根拠",
    prMutationMergeEvidence: "マージ根拠",
    prMutationVerifierEvidence: "検証者の根拠",
    prMutationAuditEvidence: "監査根拠",
    noGithubPullRequestMutations: "GitHub PR mutation記録はまだありません。PR操作は未主張です。",
    noPullRequestUrl: "PR URL未記録",
    notBlocked: "ブロックなし",
    yes: "はい",
    no: "いいえ",
    none: "なし",
    remoteGuide: "Remote接続ガイド",
    evidenceRefs: "確認資料",
    noStages: "実装ステージはまだ予定されていません。",
    noReviewGates: "レビューゲートはまだ記録されていません。",
    noIssueDocs: "Markdown issue文書はまだ作成されていません。",
    noGithubIssuePlans: "GitHub issue mutation planはまだ準備されていません。",
    noGithubIssueUrls: "GitHub issueはまだ作成されていません。local markdown issue pathがsource of truthです。",
    noRemoteCommands: "Remoteは接続済み、または接続コマンドは不要です。",
    noEvidenceRefs: "ワークスペース確認資料はまだ記録されていません。"
  },
  rightRail: {
    aria: "ライブプロジェクト概要",
    planningCompleteness: "計画完成度",
    researchStatus: "リサーチ状況",
    tasks: "タスク",
    activeRuns: "実行中",
    recentActivity: "最近の活動",
    researchNeedsReview: "リサーチ確認はまだ完了していません。残り項目と復旧経路を先に確認してください。",
    pending: "保留中",
    noActivity: "活動はまだありません。",
    radarAxes: {
      problem: "問題定義",
      customer: "顧客/JTBD",
      value: "価値提案",
      validation: "検証計画",
      implementation: "実現可能性"
    },
    radarAria: (score: number, readinessLabel: string) => `計画完成度レーダーチャート、合計 ${score}%、${readinessLabel}`
  },
  phase15a: {
    ready: "準備完了",
    needsReview: "確認が必要",
    title: "リサーチ運用",
    enableResearchSources: "リサーチソースを有効化",
    refreshStatus: "状態更新",
    allowlistScreen: "リサーチソース設定",
    limits: "制限",
    concurrent: "同時",
    session: "セッション",
    retries: "再試行",
    disclosure: "開示",
    publicSafeSummaryRequired: "公開してよい要約が必要",
    policyMissing: "ポリシー未設定",
    pause: "一時停止",
    revoke: "取り消し",
    noAllowlist: "リサーチソース設定はまだ読み込まれていません。",
    researchRunCards: "リサーチ実行カード",
    run: "run",
    attempt: "試行",
    sourceRefs: "出典",
    qualityGate: "品質確認",
    terminal: "完了状態",
    recovery: "復旧",
    refetchUnavailable: "再読み込み不可",
    refreshRunStatus: "状態更新",
    cancel: "キャンセル",
    retry: "再試行",
    noResearchRuns: "リサーチ実行はまだ読み込まれていません。",
    qualityGateDisplay: "Quality gate 表示",
    blockers: {
      noActiveAllowlist: "公開してよいリサーチソースはまだ有効化されていません。",
      noAllowlistRefetch: "リサーチソース状態の再読み込み経路がまだ見えていません。",
      noDisclosureRefetch: "リサーチ利用ログの再読み込み経路がまだ見えていません。",
      noRunsRefetch: "リサーチ実行状態の再読み込み経路がまだ見えていません。",
      noRunSse: "リサーチ状態更新の通知経路がありません。",
      noQualityGate: "根拠品質レビュー結果がまだ見えていません。",
      reviewCardRemaining: (title: string) => `リサーチカードの確認が残っています: ${title}`
    },
    allowlistPolicyLoaded: (
      status: string,
      connectors: string,
      sourceCategories: string,
      contextMode: string,
      concurrentRuns: number,
      runsPerSession: number,
      logRequired: boolean
    ) =>
      joinVisibleParts([
        `${status} · ${connectors}`,
        sourceCategories,
        contextMode,
        `${concurrentRuns} 同時 / セッションあたり ${runsPerSession}`,
        logRequired ? "活動ログが必要" : null
      ]),
    noAllowlistPolicyLoaded: "リサーチソース設定は読み込まれていません。",
    disclosureActivityLoaded: (logCount: number, latestStatus: string) =>
      `${logCount} 件のリサーチ利用ログ · 最新 ${latestStatus}`,
    noDisclosureActivity: "リサーチ利用ログはまだ読み込まれていません。",
    runRecoveryLoaded: (runCount: number, attentionCount: number, refetchUrl: string) =>
      `${runCount} 件の実行 · ${attentionCount} 件は確認または復旧が必要 · 再読み込み ${refetchUrl}`,
    noRunStatus: "リサーチ実行状態はまだ読み込まれていません。",
    qualityGatePending: "品質確認はまだ表示できる結果を生成していません。",
    exitGateBlocked: "リサーチ確認はまだ完了していません。残り項目と復旧経路を先に確認してください。",
    exitGateReady: "リサーチ結果と復旧経路が準備できました。実行準備レビューへ進めます。"
  },
  phase15b: {
    rows: {
      summary: "要約",
      approval: "承認",
      sandbox: "実行分離",
      rollback: "ロールバック",
      evidence: "確認資料",
      risk: "ブロック中リスク",
      source: "出典"
    },
    title: "実行準備ノート",
    refresh: "実行準備を更新",
    safeExecutionNote: "安全実行ノート",
    viewModel: {
      terms: {
        phase15a: "リサーチ準備",
        phase15b: "実行準備",
        readinessPreviewHandoffMetadata: "実行準備ノート",
        blockedActionArtifact: "ブロック操作の確認資料",
        chatGptDelegation: "外部AI作業スペース",
        chatGptWebAutomation: "外部AI作業スペース自動化"
      },
      statusVisible: "実行準備ノートあり",
      statusPending: "実行準備待ち",
      summaryVisible: (recordCount: number) =>
        `${recordCount} 件の実行準備ノートを計画と安全確認のために表示します。`,
      summaryEmpty: "表示できる実行準備ノートはまだありません。",
      actualWorkNotExecuted: "実際の作業は実行していません",
      noExecutionUnloaded:
        "実行準備ノートはまだ読み込まれていません。実際の作業は実行しておらず、認証情報も保存していません。",
      reviewNoteOnly: "確認ノートのみ保存済み; 実際の作業は実行していません",
      delegationState: (value: string) => `委任状態 ${value}`,
      credentialState: (value: string) => `認証情報 ${value}`,
      exportLoaded: (url: string) => `実行準備エクスポート情報: ${url}`,
      exportMissing: "実行準備エクスポート情報はまだ読み込まれていません。",
      loadedEmpty: "このプロジェクトで表示できる実行準備ノートはまだありません。",
      unloadedEmpty: "実行準備ノートはまだ読み込まれていません。"
    }
  },
  handoff: {
    title: "計画引き継ぎ",
    sourceRefs: "参照元",
    runGate: "計画引き継ぎチェックを実行",
    refresh: "引き継ぎを更新",
    planningActionErrors: {
      activeSessionRequiredScoreCompleteness: "完成度を採点するにはアクティブなセッションが必要です。",
      activeSessionRequiredFounderBrief: "Founder Briefを準備するにはアクティブなセッションが必要です。",
      activeSessionRequiredPlanningHandoff: "計画引き継ぎゲートを実行するにはアクティブなセッションが必要です。"
    }
  },
  permissions: {
    externalAiWorkspace: "外部AI作業スペース",
    nextAction: "次のアクション",
    refreshWorkspace: "作業スペースを更新",
    revokeWorkspace: "作業スペース権限を取り消す",
    fallback: "フォールバック",
    fallbackReason: "フォールバック理由",
    permissionActionErrors: {
      activeSessionRequiredRevokeWorkspace: "外部AI作業スペースを取り消すにはアクティブなセッションが必要です。",
      activeSessionRequiredRevokeServicePage:
        "サービスページ利用権限を取り消すにはアクティブなセッションが必要です。",
      artifactExportPermissionMismatch:
        "最新のサービスページ利用権限は、この資料エクスポート要求と一致しません。",
      artifactExportBrowserRequired: "資料参照のエクスポートにはブラウザdocumentコンテキストが必要です。",
      activeSessionRequiredDeleteServicePageArtifacts:
        "サービスページ利用資料の参照を削除するにはアクティブなセッションが必要です。",
      artifactDeletePermissionMismatch: "最新のサービスページ利用権限は、この資料削除要求と一致しません。"
    },
    permissionActionReasons: {
      revokeWorkspace: "外部AI作業スペースパネルから取り消しました。",
      revokeServicePagePermission: "サービスページ利用権限パネルから取り消しました。",
      deleteServicePageArtifacts: "ユーザーがサービスページ利用権限パネルから保持資料参照を削除しました。",
      exportArtifactRefsNote:
        "保持された資料参照だけをエクスポートします。認証情報、Cookie、セッション、2FAコード、API key、生のsecret値は保存またはエクスポートしません。",
      exportArtifactRefsLogMessage: (refCount: number, permissionId: string) =>
        `exported_refs_only: ${permissionId} の保持資料参照 ${refCount} 件をエクスポートし、監査メタデータを保持しました。`
    },
    chatGptDelegationSafety: "ChatGPT委任の安全確認",
    chatGptDelegationViewModel: {
      visibleHandoffLabels: {
        waiting_for_approval: "ユーザー承認の前にChatGPTブラウザ作業は開始しません。",
        running:
          "ユーザーに見えるローカルブラウザ作業だけを許可し、アカウント、Cookie、2FAは保存しません。",
        waiting_for_user: "ログイン、CAPTCHA、利用制限、UI変更はユーザーの直接操作が必要です。",
        importing_result: "取り込んだ結果は出典、不確実性、反証、鮮度ゲートを通過する必要があります。",
        completed:
          "結果の取り込みは完了しましたが、保持された資料はユーザーがエクスポートまたは削除できる必要があります。",
        blocked:
          "完全なheadless ChatGPT Pro自動化ではなく、手動プロンプト引き継ぎまたは公式経路を使います。",
        failed:
          "完全なheadless ChatGPT Pro自動化ではなく、手動プロンプト引き継ぎまたは公式経路を使います。",
        revoked: "ユーザーが委任を取り消したため、ブラウザ作業は続行できません。",
        pending_preflight: "先にプロンプト、マスキング、ポリシー、セッション所有確認の事前チェックを記録します。"
      },
      notStarted: {
        summary: "外部AI作業スペースはまだ準備されていません。",
        explanation: "このセッションでは実行ごとのローカルブラウザ作業スペースがまだ記録されていません。",
        visibleHandoffLabel:
          "ChatGPT Pro/Deep Researchは、ユーザー所有ブラウザで見える委任としてのみ準備します。",
        nextAction:
          "外部AI作業スペースを使う前に、リサーチタスクを計画し、安全なブラウザ引き継ぎプレビューを準備してください。",
        retentionLabel: "プロンプト/結果/スクリーンショット/ログ資料はまだ保存されていません。"
      },
      dataDisclosure: {
        disclosurePreview: (ref: string) => `開示プレビュー: ${ref}`,
        promptContextSummary: (ref: string) => `プロンプト文脈要約: ${ref}`,
        redactedPromptPreview: (ref: string) => `マスキング済みプロンプトプレビュー: ${ref}`,
        excludedSensitiveFields: (value: string) => `除外した機微フィールド: ${value}`,
        redactionPreviewShown: (value: string) => `マスキングプレビュー表示: ${value}`,
        userCanEditPromptBeforeRun: (value: string) => `実行前にユーザーがプロンプトを編集可能: ${value}`,
        none: "なし",
        yes: "はい",
        no: "いいえ"
      },
      resultImportGate: {
        notEvaluated: "結果取り込みゲートはまだ評価されていません。",
        sourceProvenance: (status: string, refs: string) => `出典来歴: ${status} (${refs})`,
        noSourceRefs: "出典参照なし",
        uncertainty: (status: string, refs: string) => `不確実性: ${status} (${refs})`,
        noUncertaintyRefs: "不確実性参照なし",
        conEvidence: (status: string, refs: string) => `反証: ${status} (${refs})`,
        noConEvidenceRefs: "反証参照なし",
        staleRisk: (status: string, refs: string) => `鮮度リスク: ${status} (${refs})`,
        noStaleRiskRefs: "鮮度リスク参照なし",
        importRationale: (rationale: string) => `取り込み理由: ${rationale}`
      },
      artifactControls: {
        exportRetained: "保持されたプロンプト/結果/スクリーンショット/ログ資料参照をエクスポート",
        deleteRetained: "監査メタデータだけを残して保持資料を削除"
      },
      missingBrowserActionAuthority: "ブラウザ操作権限がありません",
      noResultImport: "結果取り込みはまだ記録されていません。",
      retentionWithControls:
        "プロンプト/結果/スクリーンショット/ログ資料は標準で保持され、エクスポート/削除できます。削除後は監査メタデータのみ残ります。",
      retentionUnavailable: "この実行では資料保持コントロールを利用できません。"
    },
    dataDisclosurePreview: "データ開示プレビュー",
    policyRiskVerdict: "ポリシーリスク判定",
    sessionOwnershipVerdict: "セッション所有判定",
    evidenceRefs: "確認資料",
    noEvidenceRefs: "確認資料なし",
    approvalDecision: "承認判定",
    browserActionAuthority: "ブラウザ操作権限",
    resultImport: "結果取り込み",
    resultImportGate: "結果取り込みゲート",
    storedArtifacts: "保存済み資料",
    artifactControlTitle:
      "このPRは資料コントロール面と保持参照を表示します。資料本文のエクスポート/削除実行は取り消しとは別です。",
    redactionPreview: "非表示化プレビュー",
    noRetainedArtifactRefs: "保存済み資料の参照はありません。",
    activityFeedLinks: "活動フィードリンク",
    noLinkedResearchDecisionRefs: "リサーチや判断への参照はまだリンクされていません。",
    auditLog: "監査ログ",
    noAuditEntries: "監査項目はまだありません。",
    serviceLoginPermission: "サービスログイン権限",
    refreshServicePermission: "サービス権限更新",
    revokeServicePermission: "サービス権限取り消し",
    permissionPreview: "権限プレビュー",
    service: "サービス",
    pageUrl: "ページURL",
    purpose: "目的",
    allowedActions: "許可された操作",
    blockedActions: "ブロックされた操作",
    visibleDataCategories: "表示データカテゴリ",
    approvalGranularity: "承認粒度",
    userApproval: "ユーザー承認",
    loginBoundary: "ログイン境界",
    finalSubmitBoundary: "最終送信境界",
    blockedReasons: "ブロック理由",
    noLinkedSetupDecisionRefs: "設定や判断への参照はまだリンクされていません。",
    noServicePermissionAuditEntries: "サービス権限の監査項目はまだありません。"
  },
  ledger: {
    title: "実装ログ",
    nextAction: "次のアクション",
    refresh: "実装ログを更新",
    latestStep: "最新ステップ",
    step: "ステップ",
    scope: "範囲",
    progressReport: "進捗レポート",
    missingEvidence: "不足またはブロック中の証跡",
    evidenceRefs: "確認資料",
    noEvidenceRefs: "実装の確認資料はまだ記録されていません。"
  }
};

const KO_COPY: typeof EN_COPY = {
  pageMeta: {
    onboarding: {
      label: "온보딩",
      shortLabel: "O",
      title: "온보딩",
      description: "첫 질문을 만들기 전에 ChatGPT와 Codex에 로그인하고 목표를 설정합니다."
    },
    questions: {
      label: "질문",
      shortLabel: "Q",
      title: "질문",
      description: "현재 질문, 다음 질문, 알려진 리스크를 한곳에서 정리합니다."
    },
    research: {
      label: "리서치",
      shortLabel: "R",
      title: "리서치 검토",
      description: "승인된 공개 리서치와 직접 추가한 근거를 관리합니다."
    },
    planning: {
      label: "계획",
      shortLabel: "P",
      title: "계획 준비 상태",
      description: "제품 설명서, 준비 점수, Founder Brief, 인계 확인을 검토합니다."
    },
    implementation: {
      label: "구현",
      shortLabel: "I",
      title: "구현 활동",
      description: "로컬 실행 상태와 구현 로그를 하나의 흐름에서 추적합니다."
    },
    permissions: {
      label: "권한",
      shortLabel: "A",
      title: "위임과 권한",
      description: "외부 AI 작업공간 접근과 서비스 페이지 사용 권한을 나누어 확인합니다."
    }
  },
  projectPurposeModeOptions: [
    {
      mode: "business",
      label: "비즈니스 검증",
      description: "고객, 문제 강도, 유료 의향, 경쟁, 채널, 법무/운영 리스크를 검증합니다."
    },
    {
      mode: "personal",
      label: "개인 워크플로 만들기",
      description: "시장 설명보다 내 작업 흐름, 화면, 구현 가능성, 로컬 데이터와 보안에 집중합니다."
    }
  ],
  businessCriticIntensityOptions: [
    {
      intensity: "balanced",
      label: "균형 잡힌 비즈니스 리뷰",
      description: "주요 판단 영역마다 최소 하나의 반박 질문을 남깁니다."
    },
    {
      intensity: "strong",
      label: "강한 비즈니스 리뷰",
      description: "중요한 사업 가정이 약하면 핵심 가정을 다시 묻는 질문을 남깁니다."
    },
    {
      intensity: "investor_grade",
      label: "투자 심사급 리뷰",
      description: "가격, 채널, 유지 신호, 법무·운영 리스크, 시장 타이밍, 창업자 강점을 강하게 검증합니다."
    }
  ],
  layout: {
    localQueueFallback: "로컬 계획 작업공간",
    workflowSectionsAria: "데스크톱 워크플로 섹션",
    leftRailAria: "워크플로 내비게이션",
    workflowSteps: "작업 단계",
    progressAria: "실시간 큐 진행률",
    progress: "진행률",
    completeness: "완성도",
    pendingQuestions: "대기 중인 질문",
    blockedQuestions: "차단된 질문",
    reconnectSidecar: "로컬 서비스 다시 연결",
    sidecarUnavailable: "로컬 서비스를 사용할 수 없음",
    sidecarUnavailableMessage: "로컬 서비스가 연결되어 있지 않습니다.",
    sidecarUnavailableRecovery: "로컬 서비스가 연결되어 있지 않습니다. `pnpm start:local`로 Solo Superman을 실행한 뒤 다시 연결하고 Codex 로그인을 다시 열어주세요.",
    retryConnection: "다시 연결",
    commandFailed: "작업 실패"
  },
  nav: {
    onboardingReady: "로그인 + 목표 설정",
    onboardingComplete: "첫 질문 생성됨",
    questionsSublabel: (active: number, next: number) => `${active}개 활성 · 다음 ${next}개`,
    researchSublabel: (tasks: number, runs: number) => `${tasks}개 작업 · ${runs}개 실행`,
    permissionsSublabel: (workspaceStatus: string, permissionStatus: string) => `${workspaceStatus} · ${permissionStatus}`
  },
  questions: {
    sessionStart: "세션 시작",
    firstRunAria: "목표 설정 가이드",
    firstRunTitle: "목표 설정",
    firstRunItems: [
      "아이디어 요약과 목표를 적으면 Solo Superman이 첫 질문을 만듭니다.",
      "사업 검증이라면 어느 정도 강하게 되물을지 직접 선택합니다.",
      "리서치와 구현 준비는 먼저 검토 가능한 노트로 남기며, 위험한 작업은 자동 실행하지 않습니다."
    ],
    initialQueueStartBlockers: {
      busy: "첫 질문 묶음을 이미 생성 중입니다.",
      chatgpt_login: "시작 전에 ChatGPT에 직접 로그인했다는 확인이 필요합니다.",
      codex_login:
        "backend 질문 또는 리서치 준비를 시작하기 전에 로컬 Codex CLI 로그인이 확인되어야 합니다.",
      sidecar_connection: "로컬 서비스가 연결되어 있지 않습니다.",
      project_purpose:
        "시작 전에 프로젝트 목적을 비즈니스 검증 또는 개인 워크플로 만들기 중 하나로 선택해야 합니다.",
      business_critic_intensity: "비즈니스 검증 큐를 확정하려면 먼저 사업 리뷰 강도를 선택해야 합니다.",
      idea: "시작 전에 아이디어 요약을 입력해야 합니다.",
      intake: "시작 전에 목표에 대한 서술을 입력해야 합니다."
    },
    sessionActionErrors: {
      activeSessionRequiredProjectPurpose: "프로젝트 목적을 변경하려면 활성 세션이 필요합니다.",
      projectPurposeAlreadySelected: "프로젝트 목적이 이미 선택한 값으로 설정되어 있습니다.",
      activeSessionRequiredBusinessCriticIntensity: "사업 리뷰 강도를 변경하려면 활성 세션이 필요합니다.",
      businessCriticIntensityBusinessOnly: "사업 리뷰 강도는 비즈니스 검증 프로젝트에서만 변경할 수 있습니다.",
      activeSessionRequiredSubmitAnswer: "답변을 제출하려면 활성 세션이 필요합니다.",
      answerTextRequired: "답변 내용을 입력해야 합니다.",
      activeSessionRequiredDraftedAnswers: "작성한 답변을 제출하려면 활성 세션이 필요합니다.",
      draftedAnswersRequired: "작성한 답변을 제출하기 전에 현재 질문 답변을 하나 이상 입력해야 합니다.",
      draftedAnswersPartialFailureRefreshed: " 실패 전에 일부 작성 답변이 제출되었고 큐를 새로고침했습니다.",
      draftedAnswersPartialFailureRefreshRequired:
        " 실패 전에 일부 작성 답변이 제출되었습니다. 계속하기 전에 큐를 새로고침하세요.",
      activeSessionRequiredRefreshQuestions: "질문을 새로고침하려면 활성 세션이 필요합니다.",
      activeSessionRequiredLoadNextQuestions: "다음 질문 목록을 불러오려면 활성 세션이 필요합니다.",
      answerCurrentBeforeLoadNextQuestions:
        "다음 질문 목록을 불러오기 전에 현재 질문에 답하거나 저장해야 합니다.",
      activeSessionRequiredKnownRisk: "큐 항목을 Known Risk로 이관하려면 활성 세션이 필요합니다.",
      knownRiskNextValidationActionRequired:
        "business critic 항목을 Known Risk로 이관하려면 다음 검증 액션이 필요합니다.",
      activeSessionRequiredImportResearch: "리서치를 가져오려면 활성 세션이 필요합니다.",
      researchResultTextRequired: "리서치 결과 내용을 입력해야 합니다.",
      activeSessionRequiredResolveResearchCard: "리서치 카드를 해결하려면 활성 세션이 필요합니다."
    },
    sessionActionReasons: {
      projectPurposeConfirmed: (label: string) => `${label}을(를) 사용자가 시작 전에 확인했습니다.`,
      businessCriticIntensityConfirmed: (label: string) =>
        `${label}을(를) 사용자가 시작 전에 확인했습니다.`,
      projectPurposeChanged: (label: string) => `사용자가 프로젝트 목적을 ${label}으로 변경했습니다.`,
      businessCriticIntensityChanged: (label: string) =>
        `사용자가 사업 리뷰 강도를 ${label}으로 변경했습니다.`,
      businessCriticKnownRiskDeferred: "사용자가 business critic 항목을 Known Risk로 이관했습니다.",
      manualResearchSourceTitle: "수동 데스크 리서치",
      manualResearchLimitationNotes: "창업자가 제공한 출처에서 수동으로 가져왔습니다.",
      researchCardOutcomeRationale: (outcome: ResearchQueueTerminalOutcome, title: string) =>
        `리서치 카드 '${title}'을(를) ${outcome} 처리했습니다.`,
      researchCardResolvedRationale: (outcome: ResearchQueueTerminalOutcome, title: string) =>
        `리서치 카드 '${title}'을(를) ${outcome}로 해결했습니다.`
    },
    chatGptLoginAria: "ChatGPT 직접 로그인 확인",
    chatGptLoginTitle: "먼저 브라우저에서 ChatGPT에 로그인",
    chatGptLoginDescription: "첫 질문 묶음을 만들기 전에 이 브라우저 프로필에서 ChatGPT를 열고 직접 로그인하세요.",
    chatGptCredentialBoundary: "Solo Superman은 비밀번호, 2FA 코드, session cookie, API key, secret을 요구하거나 저장하지 않습니다.",
    chatGptLoginOpen: "ChatGPT 열기",
    chatGptLoginAcknowledge: "이 브라우저/프로필에서 ChatGPT에 직접 로그인했습니다.",
    codexLoginAria: "Codex CLI 로그인 확인",
    codexLoginTitle: "backend 질문·리서치를 위해 Codex CLI에 로그인",
    codexLoginDescription: "로컬 sidecar는 backend 질문 또는 리서치 preview를 시작하기 전에 Codex CLI 상태를 확인합니다. 필요하면 `codex auth login`을 실행하는 백그라운드 Terminal을 열고, Codex가 브라우저 로그인 화면을 띄웁니다.",
    codexCredentialBoundary: "Solo Superman은 Codex 계정 상태만 읽습니다. access token, API key, 비밀번호, cookie를 요구하거나 저장하지 않습니다.",
    codexLoginStatus: "Codex 상태",
    codexLoginCommandLabel: "백그라운드 Terminal 명령",
    codexLoginStart: "Codex 로그인 열기",
    codexLoginRefresh: "Codex 로그인 상태 새로고침",
    codexLoginStatusLabels: {
      authenticated: "로그인됨",
      missing: "로그인 필요",
      unknown: "알 수 없음",
      blocked: "차단됨"
    },
    rawIdea: "아이디어 요약",
    rawIdeaPlaceholder: "예: 창업자를 위한 Founder Brief 생성 도구",
    intakeAnswer: "목표에 대한 서술",
    intakeAnswerPlaceholder: "누구를 위한 것인지, 어떤 문제를 풀고 싶은지, 이번 세션에서 무엇을 결정하고 싶은지 적어주세요.",
    projectPurpose: "프로젝트 목적",
    purposeHelp: "프로젝트 목적은 사용자가 직접 선택합니다. 선택 전에는 사업 검증용 질문이나 개인 워크플로용 질문을 확정하지 않습니다.",
    initialResearchPermission: "리서치 권한",
    initialResearchPermissionOptions: [
      {
        permission: "not_now" as const,
        label: "리서치는 나중에 설정",
        description: "지금은 질문만 만들고, Research 탭에서 켜기 전까지 공개 웹 리서치를 비활성화합니다."
      },
      {
        permission: "allow_public_web" as const,
        label: "읽기 전용 공개 웹 리서치 허용",
        description: "온보딩 중 안전한 allowlist를 켜서 승인된 읽기 전용 공개 자료만 사용할 수 있게 합니다."
      }
    ],
    initialResearchPermissionHelp: "이 설정은 공개·읽기 전용 리서치 소스만 허용합니다. 쓰기, 계정, credential, 유료 서비스 접근은 허용하지 않습니다.",
    businessCriticIntensity: "사업 리뷰 강도",
    intensityReason: "이 강도를 선택한 이유",
    intensityReasonPlaceholder: "이 정도로 되묻는 것이 프로젝트에 맞는 이유를 적어주세요.",
    intensityHelp: "사업 검증에서는 첫 질문을 만들기 전에 리뷰 강도를 명시해야 합니다.",
    running: "실행 중",
    createFirstBatch: "첫 질문 만들기",
    queue: "큐",
    refreshQuestionList: "질문 목록 새로고침",
    loadNextQuestions: "다음 질문 불러오기",
    questionProgressTitle: "질문 진행률",
    questionProgressSummary: (handled: number, generated: number, percent: number) =>
      `생성된 질문 ${generated}개 중 ${handled}개 처리 · ${percent}%`,
    questionProgressGenerated: "생성됨",
    questionProgressOpen: "남은 질문",
    questionProgressVisible: "지금 보이는 질문",
    questionProgressActive: "지금 답할 질문",
    questionProgressUpcoming: "다음 질문",
    questionProgressAnswered: "답변됨",
    questionProgressFollowUps: "후속 질문",
    questionProgressOpenFollowUps: "남은 후속 질문",
    questionProgressTopics: "다룬 주제",
    questionProgressOpenTopics: "남은 주제",
    questionProgressFollowUpBudget: "후속 질문 여유",
    questionProgressBlocked: "막힘",
    questionFatigueStatusLabels: {
      checkpoint: "피로 체크포인트",
      break_recommended: "잠시 쉬기 권장"
    },
    questionFatigueSummary: (open: number, generated: number, percent: number) =>
      `생성된 질문 ${generated}개 중 ${percent}%를 처리했고, 아직 ${open}개가 남아 있습니다.`,
    questionFatigueHelp: "현재 질문 묶음만 답하거나, 불확실한 가정은 알려진 리스크로 남기거나, 더 불러오기 전에 잠시 멈출 수 있습니다.",
    questionFatigueFollowUpBudget: (count: number) => `후속 질문 여유가 ${count}개 남았습니다. 의도적으로 사용하세요.`,
    researchAdditionalQuestions: "리서치가 생성한 질문",
    researchFollowUpSourceTrace: "소스 추적",
    businessCriticCategoryLabels: {
      customer_pain: "고객 문제",
      paid_intent: "유료 의향",
      alternatives: "대안/경쟁",
      pricing: "가격",
      acquisition: "고객 유입",
      mvp_validation: "첫 버전 검증",
      legal_ops_security: "법무·운영·보안",
      retention_proxy: "반복 사용 신호",
      market_timing: "시장 타이밍",
      founder_advantage: "만드는 사람/팀 강점"
    },
    businessCriticPressureKindLabels: {
      balanced_con: "균형형 반대 질문",
      core_assumption_challenge: "핵심 가설 점검",
      investor_pressure_pass: "투자심사식 검증"
    },
    whyItMatters: "왜 중요한가",
    decisionItUnlocks: "이 답으로 정해지는 판단",
    nextValidation: "다음 검증",
    suggestedAnswers: "추천 답변 선택지",
    optionPro: "찬성",
    optionCon: "반대",
    customAnswer: "맞는 선택지가 없으면 다른 답변 작성",
    customAnswerPlaceholder: "선택지가 상황에 맞지 않으면 여기에 직접 답변을 작성하세요.",
    answerAriaPrefix: "답변",
    submitAnswer: "답변 제출",
    submitDraftedAnswers: (count: number) =>
      count > 0 ? `작성한 답변 ${count}개 제출` : "작성한 답변 제출",
    nextValidationActionAriaPrefix: "다음 검증 작업",
    additionalRiskDetails: "추가 의견 또는 리스크 입력",
    additionalRiskHelp: "선택 사항입니다. 지금 답하지 않고 알려진 리스크로 남길 때만 사용하세요.",
    knownRiskPlaceholder: "알려진 리스크로 남길 경우 다음 검증 작업을 적어주세요.",
    carryAsKnownRisk: "알려진 리스크로 남기기",
    queueRecoveryFresh: "질문 목록은 최신입니다. 로컬 서비스 업데이트가 오면 이 목록을 새로고침합니다.",
    queueRefetchMissing: "질문을 새로고침할 경로가 아직 로드되지 않았습니다.",
    queueSseMissing: "실시간 업데이트 알림이 아직 연결되지 않았습니다.",
    queueActiveBatchMissing: "현재 질문의 세부 정보가 아직 로드되지 않았습니다.",
    queueRefetchReady: (url: string) => `질문 새로고침 ${url}`,
    queueSseReady: (url: string) => `실시간 업데이트 스트림 ${url}`,
    queueActiveBatchReady: (count: number) => `현재 질문 ${count}개가 이번 라운드에 선택되었습니다.`,
    queueRecoveryStatusLabels: {
      idle: "최신",
      pending_refetch: "새로고침 대기",
      recovering: "새로고침 중",
      recovered_by_refetch: "새로고침됨",
      stale: "새로고침 필요"
    },
    queueRecoveryMessages: {
      idle: "질문 목록은 최신입니다. 로컬 서비스 업데이트가 오면 이 목록을 새로고침합니다.",
      pending_refetch: "질문 업데이트가 대기 중입니다. 로컬 서비스에서 이 목록을 새로고침합니다.",
      recovering: "실시간 업데이트 또는 재연결 후 질문을 새로고침하고 있습니다.",
      recovered_by_refetch: "실시간 업데이트 후 질문을 새로고침했습니다.",
      stale: "질문이 오래되었을 수 있습니다. 판단 근거로 쓰기 전에 새로고침하세요."
    },
    queueItemStateLabels: {
      active: "현재",
      next: "다음 후보",
      blocked: "막힘",
      deferred: "알려진 리스크",
      answered: "답변됨",
      resolved: "해결됨"
    },
    queueSections: {
      active: { title: "현재 질문", emptyLabel: "현재 질문이 없습니다." },
      next: { title: "다음에 확인", emptyLabel: "다음에 확인할 질문이 없습니다." },
      blocked: { title: "확인 필요", emptyLabel: "막힌 항목이 없습니다." },
      deferred: { title: "나중에 보기", emptyLabel: "나중에 볼 항목이 없습니다." }
    }
  },
  planning: {
    spec: "제품 설명서",
    sessionStatusLabels: {
      none: "시작 전",
      scaffold: "시작 전",
      intake: "질문 진행 중",
      spec: "Spec-ready",
      validation: "Research in progress",
      complete: "안전한 실행 대기"
    },
    noSpecDraft: "아직 제품 설명서 초안이 없습니다.",
    sessionVersion: "세션 버전",
    specSections: "제품 설명서 섹션",
    approval: "승인",
    projectPurpose: "프로젝트 목적",
    businessCritic: "사업 리뷰",
    notSelected: "미선택",
    notApplicable: "해당 없음",
    skippedCommercializationAxes: "제외된 사업화 검토 축",
    skippedCommercializationAxesHelp: "Personal mode에서는 이 사업/투자자 검토 축을 계속 보이게 두되, 필수 완성도 게이트에서는 제외합니다.",
    commercializationAxisLabel: (axis: string) =>
      commercializationAxisLabel(axis, {
        market_size: "시장 규모",
        investor_narrative: "투자자 내러티브",
        willingness_to_pay: "유료 의향",
        acquisition_channel: "고객 유입 채널",
        competition_pressure: "경쟁 압력"
      }),
    businessCriticChangeReason: "사업 리뷰 강도 변경 이유",
    businessCriticChangeReasonPlaceholder: "비즈니스 검증 강도를 바꾸는 이유를 기록하세요.",
    changeTo: (label: string) => `${label}(으)로 변경`,
    businessCriticAuditHelp: "변경은 감사 로그에 남고, 현재 질문을 교체하지 않은 채 새 검토 압력을 추가합니다.",
    modeChangeReason: "모드 변경 이유",
    modeChangeReasonPlaceholder: "질문/리서치 기준을 바꾸는 이유를 기록하세요.",
    modeAuditHelp: "변경은 감사 로그에 남고, 현재 질문 묶음은 유지됩니다.",
    progress: "진행률",
    pending: "대기 중",
    scoreCompleteness: "완성도 채점",
    noRiskProjection: "아직 리스크 예측이 없습니다.",
    confidenceMap: "신뢰도 맵",
    confidenceMapHelp: "현재 Planning 점수의 근거가 되는 점수 요인과 준비 게이트를 보여줍니다.",
    scoreBreakdownLabels: {
      sectionCompleteness: "스펙 섹션",
      questionDebtResolution: "질문 부채",
      evidenceQuality: "증거 품질",
      decisionApproval: "의사결정 승인",
      consistencyAndConflict: "일관성"
    },
    completionCandidate: "완성 후보",
    completionCandidateStatusLabels: {
      candidate: "후보",
      not_ready: "준비 안 됨"
    },
    confidenceGateFailures: "준비 게이트 차단 항목",
    confidenceGatesReady: "모든 준비 게이트를 통과했습니다.",
    nextBestActions: "다음 최선 작업",
    ifStopNowArtifact: "지금 멈춘다면",
    ifStopNowKnownRisks: "지금 멈출 때의 알려진 리스크",
    ifStopNowNextValidationActions: "지금 멈출 때의 다음 검증 액션",
    topRiskCards: "상위 3개 리스크 카드",
    riskSeverity: "심각도",
    riskSeverityLabels: { low: "낮음", medium: "중간", high: "높음" },
    riskNextValidation: "다음 검증 작업",
    riskNextValidationAriaPrefix: "다음 검증 작업:",
    riskSourceRefs: "참조 출처",
    riskNoSourceRefs: "참조 출처 없음",
    founderBrief: "Founder Brief",
    founderBriefRiskActions: "Founder Brief 리스크 액션",
    founderBriefKnownRisks: "Founder Brief 알려진 리스크",
    founderBriefNextValidationActions: "Founder Brief 다음 검증 액션",
    ready: "준비됨",
    draft: "초안",
    prepareExportMetadata: "내보내기 정보 준비",
    noFounderBrief: "아직 Founder Brief가 준비되지 않았습니다."
  },
  research: {
    research: "리서치",
    unknown: "알 수 없음",
    planResearchTask: "리서치 작업 계획",
    rationale: "근거",
    importResearchAriaPrefix: "리서치 가져오기",
    importResult: "결과 가져오기",
    startReadOnlyRun: "공개 웹 리서치 실행 시작",
    startReadyReadOnlyRuns: (count: number) =>
      count === 0 ? "시작할 준비가 된 공개 웹 리서치 없음" : `준비된 공개 웹 리서치 ${count}개 시작`,
    readyReadOnlyRunsPlanTitle: "준비된 공개 웹 배치 계획",
    readyReadOnlyRunsPlanReady: (count: number) =>
      `읽기 전용 리서치 작업 ${count}개가 active allowlist 예산 안에서 시작됩니다.`,
    readyReadOnlyRunsPlanBlocked: {
      missing_allowlist: "준비된 배치를 시작하기 전에 active public web allowlist를 만들거나 다시 활성화하세요.",
      no_ready_tasks: "active allowlist concurrency budget 안에서 시작할 수 있는 planned public-web task가 없습니다."
    },
    researchActionErrors: {
      activeProjectRequiredAllowlistChange: "리서치 allowlist를 변경하려면 활성 프로젝트가 필요합니다.",
      activeProjectRequiredPauseAllowlist: "리서치 allowlist를 일시 중지하려면 활성 프로젝트가 필요합니다.",
      activeProjectRequiredRevokeAllowlist: "리서치 allowlist를 철회하려면 활성 프로젝트가 필요합니다.",
      activeSessionRequiredPlanResearch: "public-safe 리서치를 계획하려면 활성 세션이 필요합니다.",
      sidecarConnectionRequiredStartRun: "리서치 실행을 시작하려면 sidecar 연결이 필요합니다.",
      activeProjectRequiredStartRun: "리서치 실행을 시작하려면 활성 프로젝트가 필요합니다.",
      plannedTaskRequiredStartRun: "읽기 전용 리서치 실행을 시작하기 전에 planned 리서치 작업을 선택하세요.",
      plannedTaskStatusRequiredStartRun: "planned 리서치 작업만 새 읽기 전용 리서치 실행을 시작할 수 있습니다.",
      activeAllowlistRequiredStartRun:
        "리서치 실행을 시작하기 전에 active public web allowlist를 만들거나 다시 활성화하세요.",
      activeProjectRequiredReadyRuns: "준비된 리서치 실행을 시작하려면 활성 프로젝트가 필요합니다.",
      readyRunsMissingAllowlist:
        "리서치 실행을 시작하기 전에 active public web allowlist를 만들거나 다시 활성화하세요.",
      readyRunsNoReadyTasks:
        "active allowlist concurrency budget 안에서 시작할 수 있는 planned public web research task가 없습니다.",
      backgroundStartAfterAnswerFailed: (error: string) =>
        `답변은 제출되었지만 자동 공개 웹 리서치 시작에 실패했습니다: ${error}`,
      activeProjectRequiredRefreshRunStatus: "리서치 실행 상태를 새로고침하려면 활성 프로젝트가 필요합니다.",
      activeProjectRequiredCancelRun: "리서치 실행을 취소하려면 활성 프로젝트가 필요합니다.",
      activeProjectRequiredRetryRun: "리서치 실행을 다시 시도하려면 활성 프로젝트가 필요합니다."
    },
    researchActionReasons: {
      pauseAllowlist: "리서치 운영 화면에서 일시 중지했습니다.",
      revokeAllowlist: "리서치 운영 화면에서 철회했습니다.",
      planPublicSafeObjective: "리서치 루프의 공개 온보딩 근거와 품질 게이트 준비 상태를 검증합니다.",
      cancelRun: "리서치 운영 화면에서 취소했습니다.",
      retryRun: "리서치 운영 화면에서 수동으로 다시 시도했습니다."
    },
    readyReadOnlyRunsPlanTaskIds: "이번 배치에서 시작할 작업 ID",
    validationSummary: "검증 요약",
    knownRisks: "알려진 리스크",
    nextValidationAction: "다음 검증 액션",
    nextValidationActions: "다음 검증 액션",
    evidencePacks: "근거 패키지",
    evidencePackSource: "출처",
    decisionContext: "판단 맥락",
    sourceReliability: "출처 신뢰도",
    gateStatus: "게이트 상태",
    gateChecks: "게이트 확인",
    noGateChecks: "게이트 확인 없음",
    limitationRefs: "제약",
    evidenceMatrix: "근거 매트릭스",
    balanceStatus: "균형 상태",
    decisionBlocked: "Planning 차단됨",
    decisionReady: "Planning 차단 없음",
    proEvidence: "찬성 근거",
    conEvidence: "반대 근거",
    uncertainties: "불확실성",
    missingConEvidenceReason: "반대 근거 부족 이유",
    knownRisk: "알려진 리스크",
    noEvidenceItems: "근거 항목 없음",
    additionalQuestions: "리서치가 생성한 후속 질문",
    sourceTrace: "출처 추적",
    noResearchTasks: "아직 리서치 작업이 없습니다."
  },
  implementation: {
    runtimeEvidence: "실행 기록",
    adapterPrefix: "도구",
    effectSuffix: "개",
    noCommandStatus: "아직 명령 상태 기록이 없습니다.",
    activity: "활동",
    pending: "대기 중",
    refreshStatus: "상태 새로고침",
    refreshRuntimeStatus: "Runtime 상태 새로고침",
    runtimeEvidenceDetails: "Runtime evidence details",
    runtimeCheckedAt: "Runtime 확인 시각",
    runtimeAdapterVersion: "Runtime adapter",
    runtimeGeneratedSchemaVersion: "생성 schema version",
    runtimeTransport: "Transport",
    runtimeExecutionMode: "실행 모드",
    runtimeAccount: "Codex 계정",
    runtimeLiveTurns: "Live turns",
    runtimeManualHandoff: "수동 인계",
    runtimeLiveTurnStates: {
      enabled: "활성",
      disabled: "비활성",
      unknown: "알 수 없음"
    },
    runtimeManualHandoffStates: {
      available: "가능",
      unavailable: "불가",
      unknown: "알 수 없음"
    },
    unknown: "알 수 없음",
    noActivity: "아직 활동이 없습니다."
  },
  autoImplementation: {
    title: "자동 구현 작업공간",
    create: "작업공간 실행 만들기",
    reprepare: "작업공간 실행 확인",
    planWorkerJob: "Worker 권한 승인 + job 계획",
    recordStageTick: "현재 단계 tick 기록",
    startStage: "현재 단계 시작",
    pauseStage: "현재 단계 일시정지",
    blockStage: "현재 단계 차단",
    completeWorkerJob: "Ledger로 worker 완료",
    importWorkerLedger: "Worker ledger 가져오기",
    workerLedgerImport: "Worker ledger import JSON",
    workerLedgerImportPlaceholder: "local Codex worker 출력의 { \"ledgerTransitions\": [...] } 또는 raw transition array를 붙여넣으세요.",
    recordGitHubIssueDryRun: "GitHub issue dry-run 기록",
    applyGitHubIssueCreation: "승인된 GitHub issue 생성 적용",
    recordPullRequestOpenDryRun: "PR 생성 dry-run 기록",
    applyPullRequestOpen: "승인된 PR 생성 적용",
    recordPullRequestDryRun: "PR 본문 dry-run 기록",
    recordPullRequestMergeDryRun: "PR merge dry-run 기록",
    applyPullRequestBodyUpdate: "승인된 PR 본문 업데이트 적용",
    applyPullRequestMerge: "승인된 PR merge 적용",
    runWorkerJob: "Worker job 실행",
    advanceWorkerStage: "Worker stage 진행",
    refresh: "작업공간 실행 새로고침",
    actionErrors: {
      activeSessionRequiredCreateWorkspace: "자동 구현 작업공간을 만들려면 활성 세션이 필요합니다.",
      planningHandoffMustBeReady:
        "자동 구현 작업공간을 만들거나 다시 준비하기 전에 계획 인계가 planning_ready여야 합니다.",
      planningHandoffRequired:
        "자동 구현 작업공간을 만들기 전에 계획 인계 게이트를 실행하고 planning_ready에 도달해야 합니다.",
      workspaceCreationFailed: (error: string) => `자동 구현 작업공간 생성에 실패했습니다: ${error}`,
      activeRunRequiredPlanWorker: "로컬 worker job을 계획하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      currentStageWorkerMustContinue:
        "다른 로컬 worker job을 계획하기 전에 최신 현재 단계 worker를 실행, 가져오기, 완료 또는 진행하세요.",
      activeRunRequiredStageTick: "단계 tick을 기록하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredStartStage: "단계를 시작하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredPauseStage: "단계를 일시정지하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredBlockStage: "단계를 차단하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredCompleteWorker:
        "ledger evidence에서 worker를 완료하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      completedLedgerRequiredCompleteWorker:
        "worker를 완료하려면 계획됨 또는 ledger-blocked 상태의 현재 단계 worker와 완료된 ImplementationStepLedger step이 필요합니다.",
      plannedWorkerRequiredRunWorker: "worker를 실행하려면 계획된 로컬 Codex worker job이 필요합니다.",
      activeRunRequiredImportWorkerLedger:
        "worker ledger evidence를 가져오려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      workerLedgerImportPrepareFailed: "Worker ledger import request를 준비할 수 없습니다.",
      completedWorkerRequiredAdvanceStage: "worker stage를 진행하려면 완료된 로컬 Codex worker job이 필요합니다.",
      githubIssueMutationUnavailable:
        "현재 run 상태에서는 이 자동 구현 GitHub issue mutation을 사용할 수 없습니다.",
      activeRunRequiredRecordGitHubIssueDryRun:
        "GitHub issue dry-run을 기록하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredApplyGitHubIssueCreation:
        "승인된 GitHub issue 생성을 적용하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      githubIssueAlreadyRecorded:
        "GitHub issue URL이 이미 기록되어 있습니다. 중복 생성하지 말고 기존 생성된 issue를 이어가세요.",
      pullRequestMutationUnavailable: "현재 run 상태에서는 이 자동 구현 PR mutation을 사용할 수 없습니다.",
      activeRunRequiredRecordPullRequestOpenDryRun:
        "PR 생성 dry-run을 기록하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredApplyPullRequestOpen:
        "승인된 PR 생성을 적용하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      pullRequestAlreadyRecorded: "PR URL이 이미 기록되어 있습니다. 새로 열지 말고 기존 PR을 업데이트하거나 merge하세요.",
      activeRunRequiredRecordPullRequestDryRun:
        "PR 본문 dry-run을 기록하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredRecordPullRequestMergeDryRun:
        "PR merge dry-run을 기록하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredApplyPullRequestBodyUpdate:
        "승인된 PR 본문 업데이트를 적용하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      activeRunRequiredApplyPullRequestMerge:
        "승인된 PR merge를 적용하려면 활성 자동 구현 작업공간 실행이 필요합니다.",
      pullRequestMergeAlreadyRecorded: "PR merge가 이미 기록되어 있습니다. 같은 자동 구현 PR을 다시 merge하지 마세요."
    },
    workerPlan: "로컬 worker 경계 계획",
    workerRuntimeReadiness: "Worker runtime 준비 상태",
    workerRuntimeStatus: "Runtime 상태",
    workerRuntimeExecutionMode: "실행 모드",
    workerRuntimeAccount: "Codex 계정",
    workerRuntimeCheckedAt: "확인 시각",
    workerRuntimeAdapterVersion: "Runtime adapter",
    workerRuntimeGeneratedSchemaVersion: "생성 schema version",
    workerRuntimeTransport: "Transport",
    workerRuntimeLiveTurns: "Live turns",
    workerRuntimeManualHandoff: "수동 인계",
    workerRuntimeLiveTurnStates: {
      enabled: "활성",
      disabled: "비활성",
      unknown: "알 수 없음"
    },
    workerRuntimeManualHandoffStates: {
      available: "가능",
      unavailable: "불가",
      unknown: "알 수 없음"
    },
    workerRuntimeReason: "Runtime 사유",
    workerRuntimeNextAction: "Worker runtime 다음 작업",
    workerRuntimeNextActions: {
      refreshRuntime: "local worker 실행 전에 Codex runtime 상태를 새로고침하세요. worker job이 있으면 수동 worker ledger import가 fallback입니다.",
      liveReady: "Live local Codex worker 실행을 사용할 수 있습니다. 경계 권한과 worker job을 계획한 뒤 실행하고, 출력이 blocked이면 ledger import를 유지하세요.",
      fixture: "Fixture runtime은 worker 실행을 시뮬레이션할 수 있습니다. 실제 작업에는 live local 실행 또는 manual ledger import evidence가 필요합니다.",
      codexLogin: "Codex login을 실행하고 runtime 상태를 새로고침하거나, 경계가 정해진 worker를 수동 완료한 뒤 ledger evidence를 가져오세요.",
      enableLiveTurns: "SOLO_CODEX_APP_SERVER_LIVE_TURNS=1을 설정하고 local sidecar를 재시작하거나, 경계가 정해진 worker를 수동 완료한 뒤 ledger evidence를 가져오세요.",
      resolveBlocker: "Codex runtime blocker를 해소한 뒤 worker를 다시 실행하거나 완료된 worker ledger envelope을 가져오세요."
    },
    workerPlanExecutionMode: "실행 모드",
    workerPlanWorkingDirectory: "작업 디렉터리",
    workerPlanIssueDocument: "이슈 문서",
    workerPlanExecutionAuthority: "실행 권한",
    workerPlanLedgerTrackerDoc: "Ledger tracker doc",
    workerPlanLedgerStepDoc: "Ledger step doc",
    workerPlanLedgerDocSourceRefs: "Ledger doc 참조 출처",
    workerPlanAllowedWriteScope: "허용된 쓰기 범위",
    workerPlanRequiredEvidence: "필수 근거",
    workerPlanForbiddenActions: "금지된 작업",
    workerPlanSourceRefs: "참조 출처",
    workerPlanBlocker: "차단 항목",
    workerPlanMissingEvidence: "누락된 근거",
    workerPlanEvidenceRefs: "Job 근거 참조",
    missingExecutionAuthority: "ExecutionAuthorityRecord 누락",
    stagePlan: "5분 단위 단계 계획",
    reviewProtocol: "리뷰와 머지 프로토콜",
    issueDocs: "이슈 문서",
    githubIssueMutation: "GitHub issue mutation contract",
    githubPullRequestMutation: "GitHub PR mutation evidence",
    pullRequestMutationHistory: (count: number) => `PR mutation 기록 ${count}개가 캡처됐습니다.`,
    prMutationRequestMode: "요청 모드",
    prMutationMutatesGitHub: "GitHub 변경 여부",
    prMutationPullRequest: "Pull request",
    prMutationBlockedReason: "차단 이유",
    prMutationRollbackNotes: "롤백 메모",
    prMutationIssueLinks: "이슈 링크",
    prMutationReviewStreaks: "리뷰 연속 통과 근거",
    prMutationVerificationCommands: "검증 명령",
    prMutationKnownGaps: "알려진 gap",
    prMutationApprovalEvidence: "승인 근거",
    prMutationApprovalRollback: "승인 롤백 계획",
    prMutationBodyEvidence: "PR 본문 근거",
    prMutationMergeEvidence: "머지 근거",
    prMutationVerifierEvidence: "검증자 근거",
    prMutationAuditEvidence: "감사 근거",
    noGithubPullRequestMutations: "아직 GitHub PR mutation 기록이 없습니다. PR 작업은 아직 주장되지 않았습니다.",
    noPullRequestUrl: "PR URL 기록 없음",
    notBlocked: "차단 없음",
    yes: "예",
    no: "아니오",
    none: "없음",
    remoteGuide: "Remote 연결 가이드",
    evidenceRefs: "근거 참조",
    noStages: "아직 예약된 구현 단계가 없습니다.",
    noReviewGates: "아직 리뷰 게이트가 기록되지 않았습니다.",
    noIssueDocs: "아직 markdown 이슈 문서가 생성되지 않았습니다.",
    noGithubIssuePlans: "아직 GitHub issue mutation plan이 준비되지 않았습니다.",
    noGithubIssueUrls: "아직 GitHub issue가 생성되지 않았습니다. local markdown issue path가 source of truth입니다.",
    noRemoteCommands: "Remote가 연결되어 있거나 필요한 연결 명령이 없습니다.",
    noEvidenceRefs: "아직 작업공간 근거 참조가 기록되지 않았습니다."
  },
  rightRail: {
    aria: "실시간 프로젝트 요약",
    planningCompleteness: "계획 완성도",
    researchStatus: "리서치 상태",
    tasks: "작업",
    activeRuns: "활성 실행",
    recentActivity: "최근 활동",
    researchNeedsReview: "리서치 검토가 아직 끝나지 않았습니다. 남은 항목과 복구 경로를 먼저 확인하세요.",
    pending: "대기 중",
    noActivity: "아직 활동이 없습니다.",
    radarAxes: {
      problem: "문제",
      customer: "고객 / 할 일",
      value: "가치 제안",
      validation: "검증 계획",
      implementation: "구현"
    },
    radarAria: (score: number, readinessLabel: string) => `계획 완성도 레이더 차트, 총 ${score}%, ${readinessLabel}`
  },
  phase15a: {
    ready: "준비됨",
    needsReview: "검토 필요",
    title: "리서치 운영",
    enableResearchSources: "리서치 소스 활성화",
    refreshStatus: "상태 새로고침",
    allowlistScreen: "리서치 소스 설정",
    limits: "제한",
    concurrent: "동시",
    session: "세션",
    retries: "재시도",
    disclosure: "공개 고지",
    publicSafeSummaryRequired: "공개 가능한 요약 필요",
    policyMissing: "정책 누락",
    pause: "일시정지",
    revoke: "취소",
    noAllowlist: "아직 리서치 소스 설정이 로드되지 않았습니다.",
    researchRunCards: "리서치 실행 카드",
    run: "실행",
    attempt: "시도",
    sourceRefs: "출처",
    qualityGate: "품질 확인",
    terminal: "종료 상태",
    recovery: "복구",
    refetchUnavailable: "새로고침 불가",
    refreshRunStatus: "상태 새로고침",
    cancel: "취소",
    retry: "재시도",
    noResearchRuns: "아직 리서치 실행이 로드되지 않았습니다.",
    qualityGateDisplay: "품질 게이트 표시",
    blockers: {
      noActiveAllowlist: "안전한 공개 리서치 소스가 아직 활성화되지 않았습니다.",
      noAllowlistRefetch: "리서치 소스 상태를 다시 불러오는 경로가 보이지 않습니다.",
      noDisclosureRefetch: "리서치 사용 내역을 다시 불러오는 경로가 보이지 않습니다.",
      noRunsRefetch: "리서치 실행 상태를 다시 불러오는 경로가 보이지 않습니다.",
      noRunSse: "리서치 상태 업데이트 알림 경로가 빠져 있습니다.",
      noQualityGate: "근거 품질 검토 결과가 아직 보이지 않습니다.",
      reviewCardRemaining: (title: string) => `다음 리서치 카드 검토가 남아 있습니다: ${title}`
    },
    allowlistPolicyLoaded: (
      status: string,
      connectors: string,
      sourceCategories: string,
      contextMode: string,
      concurrentRuns: number,
      runsPerSession: number,
      logRequired: boolean
    ) =>
      joinVisibleParts([
        `${status} · ${connectors}`,
        sourceCategories,
        contextMode,
        `${concurrentRuns} 동시 / 세션당 ${runsPerSession}`,
        logRequired ? "활동 기록 필요" : null
      ]),
    noAllowlistPolicyLoaded: "리서치 소스 설정이 로드되지 않았습니다.",
    disclosureActivityLoaded: (logCount: number, latestStatus: string) =>
      `리서치 사용 기록 ${logCount}개 · 최신 ${latestStatus}`,
    noDisclosureActivity: "리서치 사용 기록이 아직 로드되지 않았습니다.",
    runRecoveryLoaded: (runCount: number, attentionCount: number, refetchUrl: string) =>
      `실행 ${runCount}개 · 검토 또는 복구 필요 ${attentionCount}개 · 새로고침 ${refetchUrl}`,
    noRunStatus: "리서치 실행 상태가 아직 로드되지 않았습니다.",
    qualityGatePending: "품질 확인이 아직 표시 가능한 결과를 만들지 않았습니다.",
    exitGateBlocked: "리서치 검토가 아직 끝나지 않았습니다. 남은 항목과 복구 경로를 먼저 확인하세요.",
    exitGateReady: "리서치 결과와 복구 경로가 준비됐습니다. 실행 준비 검토로 넘어갈 수 있습니다."
  },
  phase15b: {
    rows: {
      summary: "요약",
      approval: "승인",
      sandbox: "실행 격리",
      rollback: "롤백",
      evidence: "근거",
      risk: "차단된 리스크",
      source: "출처"
    },
    title: "실행 준비 노트",
    refresh: "준비 상태 새로고침",
    safeExecutionNote: "안전 실행 노트",
    viewModel: {
      terms: {
        phase15a: "리서치 준비",
        phase15b: "실행 준비",
        readinessPreviewHandoffMetadata: "실행 준비 노트",
        blockedActionArtifact: "차단 작업 검토 자료",
        chatGptDelegation: "외부 AI 작업공간",
        chatGptWebAutomation: "외부 AI 작업공간 자동화"
      },
      statusVisible: "실행 준비 노트 있음",
      statusPending: "실행 준비 대기",
      summaryVisible: (recordCount: number) =>
        `${recordCount}개 실행 준비 노트가 계획 및 안전 검토용으로 표시됩니다.`,
      summaryEmpty: "아직 표시할 실행 준비 노트가 없습니다.",
      actualWorkNotExecuted: "실제 작업은 실행하지 않음",
      noExecutionUnloaded:
        "실행 준비 노트가 아직 없습니다. 실제 작업은 실행하지 않았고 인증 정보도 저장하지 않았습니다.",
      reviewNoteOnly: "검토 노트만 저장됨; 실제 작업은 실행하지 않음",
      delegationState: (value: string) => `위임 상태 ${value}`,
      credentialState: (value: string) => `인증 정보 ${value}`,
      exportLoaded: (url: string) => `실행 준비 내보내기 정보: ${url}`,
      exportMissing: "실행 준비 내보내기 정보가 아직 로드되지 않았습니다.",
      loadedEmpty: "이 프로젝트에 표시할 실행 준비 노트가 아직 없습니다.",
      unloadedEmpty: "실행 준비 노트가 아직 로드되지 않았습니다."
    }
  },
  handoff: {
    title: "계획 인계",
    sourceRefs: "참조 출처",
    runGate: "계획 인계 확인 실행",
    refresh: "핸드오프 새로고침",
    planningActionErrors: {
      activeSessionRequiredScoreCompleteness: "완성도를 채점하려면 활성 세션이 필요합니다.",
      activeSessionRequiredFounderBrief: "Founder Brief를 준비하려면 활성 세션이 필요합니다.",
      activeSessionRequiredPlanningHandoff: "계획 인계 게이트를 실행하려면 활성 세션이 필요합니다."
    }
  },
  permissions: {
    externalAiWorkspace: "외부 AI 작업공간",
    nextAction: "다음 작업",
    refreshWorkspace: "작업공간 새로고침",
    revokeWorkspace: "작업공간 권한 취소",
    fallback: "대체 경로",
    fallbackReason: "대체 사유",
    permissionActionErrors: {
      activeSessionRequiredRevokeWorkspace: "외부 AI 작업공간을 취소하려면 활성 세션이 필요합니다.",
      activeSessionRequiredRevokeServicePage: "서비스 페이지 사용 권한을 취소하려면 활성 세션이 필요합니다.",
      artifactExportPermissionMismatch:
        "최신 서비스 페이지 사용 권한이 이 자료 내보내기 요청과 더 이상 일치하지 않습니다.",
      artifactExportBrowserRequired: "자료 참조를 내보내려면 브라우저 document 컨텍스트가 필요합니다.",
      activeSessionRequiredDeleteServicePageArtifacts:
        "서비스 페이지 사용 자료 참조를 삭제하려면 활성 세션이 필요합니다.",
      artifactDeletePermissionMismatch:
        "최신 서비스 페이지 사용 권한이 이 자료 삭제 요청과 더 이상 일치하지 않습니다."
    },
    permissionActionReasons: {
      revokeWorkspace: "외부 AI 작업공간 패널에서 취소했습니다.",
      revokeServicePagePermission: "서비스 페이지 사용 권한 패널에서 취소했습니다.",
      deleteServicePageArtifacts: "사용자가 서비스 페이지 사용 권한 패널에서 보관된 자료 참조를 삭제했습니다.",
      exportArtifactRefsNote:
        "보관된 자료 참조만 내보냅니다. credentials, cookies, sessions, 2FA codes, API keys, raw secret 값은 저장하거나 내보내지 않습니다.",
      exportArtifactRefsLogMessage: (refCount: number, permissionId: string) =>
        `exported_refs_only: ${permissionId}의 보관 자료 참조 ${refCount}개를 내보냈고 audit metadata는 보존했습니다.`
    },
    chatGptDelegationSafety: "ChatGPT 위임 안전 확인",
    chatGptDelegationViewModel: {
      visibleHandoffLabels: {
        waiting_for_approval: "사용자 승인 전에는 ChatGPT 브라우저 작업을 시작하지 않습니다.",
        running: "사용자가 볼 수 있는 로컬 브라우저 작업만 허용되며 계정/쿠키/2FA는 저장하지 않습니다.",
        waiting_for_user: "로그인, CAPTCHA, 사용량 제한, UI 변경은 사용자 직접 조치가 필요합니다.",
        importing_result: "가져온 결과는 출처/불확실성/반대근거/신선도 게이트를 통과해야 합니다.",
        completed: "결과 가져오기가 끝났지만 저장 자료는 사용자가 내보내거나 삭제할 수 있어야 합니다.",
        blocked: "완전 headless ChatGPT Pro 자동화 대신 수동 프롬프트 전달 또는 공식 경로로 대체합니다.",
        failed: "완전 headless ChatGPT Pro 자동화 대신 수동 프롬프트 전달 또는 공식 경로로 대체합니다.",
        revoked: "사용자가 위임을 취소했으므로 더 이상 브라우저 작업을 계속할 수 없습니다.",
        pending_preflight: "프롬프트/가림 처리/정책/세션 소유권 사전 점검을 먼저 기록합니다."
      },
      notStarted: {
        summary: "외부 AI 작업공간이 아직 준비되지 않았습니다.",
        explanation: "이 세션에는 실행별 로컬 브라우저 작업공간이 아직 기록되지 않았습니다.",
        visibleHandoffLabel: "ChatGPT Pro/Deep Research는 사용자 소유 브라우저에서 보이는 위임으로만 준비합니다.",
        nextAction: "외부 AI 작업공간을 사용하기 전에 리서치 작업을 계획하고 안전한 브라우저 인계 preview를 준비하세요.",
        retentionLabel: "아직 prompt/result/screenshot/log 자료가 저장되지 않았습니다."
      },
      dataDisclosure: {
        disclosurePreview: (ref: string) => `공개 미리보기: ${ref}`,
        promptContextSummary: (ref: string) => `프롬프트 문맥 요약: ${ref}`,
        redactedPromptPreview: (ref: string) => `가림 처리된 프롬프트 미리보기: ${ref}`,
        excludedSensitiveFields: (value: string) => `제외된 민감 필드: ${value}`,
        redactionPreviewShown: (value: string) => `가림 처리 미리보기 표시: ${value}`,
        userCanEditPromptBeforeRun: (value: string) => `실행 전 사용자 프롬프트 수정 가능: ${value}`,
        none: "없음",
        yes: "예",
        no: "아니오"
      },
      resultImportGate: {
        notEvaluated: "결과 가져오기 게이트가 아직 평가되지 않았습니다.",
        sourceProvenance: (status: string, refs: string) => `출처 이력: ${status} (${refs})`,
        noSourceRefs: "출처 참조 없음",
        uncertainty: (status: string, refs: string) => `불확실성: ${status} (${refs})`,
        noUncertaintyRefs: "불확실성 참조 없음",
        conEvidence: (status: string, refs: string) => `반대 근거: ${status} (${refs})`,
        noConEvidenceRefs: "반대 근거 참조 없음",
        staleRisk: (status: string, refs: string) => `신선도 리스크: ${status} (${refs})`,
        noStaleRiskRefs: "신선도 리스크 참조 없음",
        importRationale: (rationale: string) => `가져오기 근거: ${rationale}`
      },
      artifactControls: {
        exportRetained: "보관된 prompt/result/screenshot/log 자료 참조 내보내기",
        deleteRetained: "감사 metadata만 남기고 보관 자료 삭제"
      },
      missingBrowserActionAuthority: "브라우저 작업 권한 없음",
      noResultImport: "아직 결과 가져오기가 기록되지 않았습니다.",
      retentionWithControls:
        "prompt/result/screenshot/log 자료는 기본적으로 보관되며 내보내기/삭제 제어를 제공합니다. 삭제하면 감사 metadata만 남습니다.",
      retentionUnavailable: "이 실행에서는 자료 보관 제어를 사용할 수 없습니다."
    },
    dataDisclosurePreview: "데이터 공개 미리보기",
    policyRiskVerdict: "정책 리스크 판정",
    sessionOwnershipVerdict: "세션 소유권 판정",
    evidenceRefs: "근거 참조",
    noEvidenceRefs: "근거 참조 없음",
    approvalDecision: "승인 판정",
    browserActionAuthority: "브라우저 작업 권한",
    resultImport: "결과 가져오기",
    resultImportGate: "결과 가져오기 게이트",
    storedArtifacts: "저장된 자료",
    artifactControlTitle:
      "이 PR은 자료 제어 화면과 보관 참조를 노출합니다. 자료 본문 내보내기/삭제 실행은 위임 취소와 별도입니다.",
    redactionPreview: "가림 처리 미리보기",
    noRetainedArtifactRefs: "저장된 자료 참조가 없습니다.",
    activityFeedLinks: "활동 기록 링크",
    noLinkedResearchDecisionRefs: "아직 연결된 리서치나 결정 참조가 없습니다.",
    auditLog: "감사 로그",
    noAuditEntries: "아직 감사 항목이 없습니다.",
    serviceLoginPermission: "서비스 로그인 권한",
    refreshServicePermission: "서비스 권한 새로고침",
    revokeServicePermission: "서비스 권한 취소",
    permissionPreview: "권한 미리보기",
    service: "서비스",
    pageUrl: "페이지 URL",
    purpose: "목적",
    allowedActions: "허용된 작업",
    blockedActions: "차단된 작업",
    visibleDataCategories: "표시되는 데이터 범주",
    approvalGranularity: "승인 단위",
    userApproval: "사용자 승인",
    loginBoundary: "로그인 범위",
    finalSubmitBoundary: "최종 제출 범위",
    blockedReasons: "차단 사유",
    noLinkedSetupDecisionRefs: "아직 연결된 설정이나 결정 참조가 없습니다.",
    noServicePermissionAuditEntries: "아직 서비스 권한 감사 항목이 없습니다."
  },
  ledger: {
    title: "구현 로그",
    nextAction: "다음 작업",
    refresh: "구현 로그 새로고침",
    latestStep: "최신 단계",
    step: "단계",
    scope: "범위",
    progressReport: "진행 보고",
    missingEvidence: "누락 또는 차단된 근거",
    evidenceRefs: "근거 참조",
    noEvidenceRefs: "아직 구현 근거 참조가 기록되지 않았습니다."
  }
};

export const DECISION_QUEUE_COPY = {
  en: EN_COPY,
  ja: JA_COPY,
  ko: KO_COPY
} as const;

export type DecisionQueueCopy = typeof EN_COPY;

export function useDecisionQueueCopy(): DecisionQueueCopy {
  const { language } = useAppLanguage();

  return DECISION_QUEUE_COPY[language];
}
