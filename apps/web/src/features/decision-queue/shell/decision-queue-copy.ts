import type {
  BusinessCriticalQuestionCategory,
  BusinessCriticIntensity,
  BusinessCriticPressureKind,
  ProjectPurposeMode
} from "@solo-superman/contracts";
import { useAppLanguage } from "../../../shared/i18n/app-language";
import type { DecisionQueuePageId } from "./decision-queue-shell-model";

export const DECISION_QUEUE_PAGE_ORDER = ["onboarding", "questions", "research", "planning", "implementation", "permissions"] as const satisfies readonly DecisionQueuePageId[];

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
    questionProgressAnswered: "Answered",
    questionProgressFollowUps: "Follow-ups",
    questionProgressBlocked: "Blocked",
    researchAdditionalQuestions: "Research-generated questions",
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
    nextValidation: "Next validation",
    suggestedAnswers: "Suggested answer choices",
    optionPro: "Pro",
    optionCon: "Con",
    customAnswer: "Write a different answer if none fit",
    customAnswerPlaceholder: "If the choices do not match your situation, write your own answer here.",
    answerAriaPrefix: "Answer",
    submitAnswer: "Submit answer",
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
    queueSections: {
      active: { title: "Current questions", emptyLabel: "No current questions." },
      next: { title: "Up next", emptyLabel: "No upcoming questions." },
      blocked: { title: "Needs attention", emptyLabel: "No blocked items." },
      deferred: { title: "Saved for later", emptyLabel: "No saved items." }
    }
  },
  planning: {
    spec: "Product spec",
    noSpecDraft: "No product spec draft yet.",
    sessionVersion: "Session version",
    specSections: "Spec sections",
    approval: "Approval",
    projectPurpose: "Project purpose",
    businessCritic: "Business review",
    notSelected: "not selected",
    notApplicable: "not applicable",
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
    founderBrief: "Founder Brief",
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
    additionalQuestions: "Research-generated follow-up questions",
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
    noActivity: "No activity yet."
  },
  autoImplementation: {
    title: "Auto implementation workspace",
    create: "Create workspace run",
    reprepare: "Ensure workspace run",
    refresh: "Refresh workspace run",
    stagePlan: "5-minute stage plan",
    issueDocs: "Issue documents",
    remoteGuide: "Remote connection guide",
    evidenceRefs: "Evidence references",
    noStages: "No implementation stages scheduled yet.",
    noIssueDocs: "No markdown issue documents created yet.",
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
    qualityGateDisplay: "Quality check display"
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
    safeExecutionNote: "Safe execution note"
  },
  handoff: {
    sourceRefs: "Source references",
    runGate: "Run planning handoff check",
    refresh: "Refresh handoff"
  },
  permissions: {
    externalAiWorkspace: "External AI workspace",
    nextAction: "Next action",
    refreshWorkspace: "Refresh workspace",
    revokeWorkspace: "Revoke workspace",
    fallback: "Fallback",
    fallbackReason: "Fallback reason",
    storedArtifacts: "Saved artifacts",
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
    questionProgressAnswered: "回答済み",
    questionProgressFollowUps: "追加質問",
    questionProgressBlocked: "ブロック中",
    researchAdditionalQuestions: "リサーチ生成の質問",
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
    nextValidation: "次の検証",
    suggestedAnswers: "回答候補",
    optionPro: "長所",
    optionCon: "短所",
    customAnswer: "合う選択肢がなければ直接入力",
    customAnswerPlaceholder: "候補が状況に合わない場合は、ここに自分の回答を書いてください。",
    answerAriaPrefix: "回答",
    submitAnswer: "回答を送信",
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
    queueSections: {
      active: { title: "現在の質問", emptyLabel: "現在の質問はありません。" },
      next: { title: "次に確認", emptyLabel: "次に確認する質問はありません。" },
      blocked: { title: "確認が必要", emptyLabel: "ブロック中の項目はありません。" },
      deferred: { title: "後で確認", emptyLabel: "後で確認する項目はありません。" }
    }
  },
  planning: {
    spec: "プロダクト仕様",
    noSpecDraft: "仕様ドラフトはまだありません。",
    sessionVersion: "セッションバージョン",
    specSections: "仕様セクション",
    approval: "承認",
    projectPurpose: "プロジェクト目的",
    businessCritic: "事業レビュー",
    notSelected: "未選択",
    notApplicable: "対象外",
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
    founderBrief: "Founder Brief",
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
    additionalQuestions: "リサーチが生成した追加質問",
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
    noActivity: "活動はまだありません。"
  },
  autoImplementation: {
    title: "自動実装ワークスペース",
    create: "ワークスペース実行を作成",
    reprepare: "ワークスペース実行を確認",
    refresh: "ワークスペース実行を更新",
    stagePlan: "5分間隔のステージ計画",
    issueDocs: "Issue文書",
    remoteGuide: "Remote接続ガイド",
    evidenceRefs: "確認資料",
    noStages: "実装ステージはまだ予定されていません。",
    noIssueDocs: "Markdown issue文書はまだ作成されていません。",
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
    qualityGateDisplay: "Quality gate 表示"
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
    safeExecutionNote: "安全実行ノート"
  },
  handoff: {
    sourceRefs: "参照元",
    runGate: "計画引き継ぎチェックを実行",
    refresh: "引き継ぎを更新"
  },
  permissions: {
    externalAiWorkspace: "外部AI作業スペース",
    nextAction: "次のアクション",
    refreshWorkspace: "作業スペースを更新",
    revokeWorkspace: "作業スペース権限を取り消す",
    fallback: "フォールバック",
    fallbackReason: "フォールバック理由",
    storedArtifacts: "保存済み資料",
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
    questionProgressAnswered: "답변됨",
    questionProgressFollowUps: "후속 질문",
    questionProgressBlocked: "막힘",
    researchAdditionalQuestions: "리서치가 생성한 질문",
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
    nextValidation: "다음 검증",
    suggestedAnswers: "추천 답변 선택지",
    optionPro: "찬성",
    optionCon: "반대",
    customAnswer: "맞는 선택지가 없으면 다른 답변 작성",
    customAnswerPlaceholder: "선택지가 상황에 맞지 않으면 여기에 직접 답변을 작성하세요.",
    answerAriaPrefix: "답변",
    submitAnswer: "답변 제출",
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
    queueSections: {
      active: { title: "현재 질문", emptyLabel: "현재 질문이 없습니다." },
      next: { title: "다음에 확인", emptyLabel: "다음에 확인할 질문이 없습니다." },
      blocked: { title: "확인 필요", emptyLabel: "막힌 항목이 없습니다." },
      deferred: { title: "나중에 보기", emptyLabel: "나중에 볼 항목이 없습니다." }
    }
  },
  planning: {
    spec: "제품 설명서",
    noSpecDraft: "아직 제품 설명서 초안이 없습니다.",
    sessionVersion: "세션 버전",
    specSections: "제품 설명서 섹션",
    approval: "승인",
    projectPurpose: "프로젝트 목적",
    businessCritic: "사업 리뷰",
    notSelected: "미선택",
    notApplicable: "해당 없음",
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
    founderBrief: "Founder Brief",
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
    additionalQuestions: "리서치가 생성한 후속 질문",
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
    noActivity: "아직 활동이 없습니다."
  },
  autoImplementation: {
    title: "자동 구현 작업공간",
    create: "작업공간 실행 만들기",
    reprepare: "작업공간 실행 확인",
    refresh: "작업공간 실행 새로고침",
    stagePlan: "5분 단위 단계 계획",
    issueDocs: "이슈 문서",
    remoteGuide: "Remote 연결 가이드",
    evidenceRefs: "근거 참조",
    noStages: "아직 예약된 구현 단계가 없습니다.",
    noIssueDocs: "아직 markdown 이슈 문서가 생성되지 않았습니다.",
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
    qualityGateDisplay: "품질 게이트 표시"
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
    safeExecutionNote: "안전 실행 노트"
  },
  handoff: {
    sourceRefs: "참조 출처",
    runGate: "계획 인계 확인 실행",
    refresh: "핸드오프 새로고침"
  },
  permissions: {
    externalAiWorkspace: "외부 AI 작업공간",
    nextAction: "다음 작업",
    refreshWorkspace: "작업공간 새로고침",
    revokeWorkspace: "작업공간 권한 취소",
    fallback: "대체 경로",
    fallbackReason: "대체 사유",
    storedArtifacts: "저장된 자료",
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
