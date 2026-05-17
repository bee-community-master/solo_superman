import type { BusinessCriticIntensity, ProjectPurposeMode } from "@solo-superman/contracts";
import { useAppLanguage } from "../../../shared/i18n/app-language";
import type { DecisionQueuePageId } from "./decision-queue-shell-model";

export const DECISION_QUEUE_PAGE_ORDER = ["questions", "research", "planning", "implementation", "permissions"] as const satisfies readonly DecisionQueuePageId[];

const EN_COPY = {
  pageMeta: {
    questions: {
      label: "Questions",
      shortLabel: "Q",
      title: "Decision Queue",
      description: "Handle purpose choices, research needs, and known risks in one place."
    },
    research: {
      label: "Research",
      shortLabel: "R",
      title: "Research Evidence",
      description: "Manage approved public-safe research runs and manual evidence imports."
    },
    planning: {
      label: "Planning",
      shortLabel: "P",
      title: "Planning Readiness",
      description: "Review the spec, completeness score, Founder Brief, and handoff gate."
    },
    implementation: {
      label: "Implementation",
      shortLabel: "I",
      title: "Implementation Runtime",
      description: "Track runtime activity and the implementation ledger in one flow."
    },
    permissions: {
      label: "Permissions",
      shortLabel: "A",
      title: "Delegation & Permissions",
      description: "Audit external browser delegation and service page-use permissions separately."
    }
  },
  projectPurposeModeOptions: [
    {
      mode: "business" as ProjectPurposeMode,
      label: "Business validation",
      description: "Validate customers, problem intensity, paid intent, competition, channels, and legal/ops risk."
    },
    {
      mode: "personal" as ProjectPurposeMode,
      label: "Personal workflow build",
      description: "Focus on personal workflow, GUI, implementation feasibility, and local data/security instead of market narrative."
    }
  ],
  businessCriticIntensityOptions: [
    {
      intensity: "balanced" as BusinessCriticIntensity,
      label: "Balanced business review",
      description: "Keep at least one opposing or critical question in each major decision group."
    },
    {
      intensity: "strong" as BusinessCriticIntensity,
      label: "Strong business review",
      description: "Keep core-assumption challenge questions queued when high-impact business gaps appear."
    },
    {
      intensity: "investor_grade" as BusinessCriticIntensity,
      label: "Investor-grade review",
      description: "Pressure-test pricing, channels, retention proxies, legal/ops risk, market timing, and founder advantage."
    }
  ],
  layout: {
    localQueueFallback: "Local Decision Queue",
    workflowSectionsAria: "Desktop workflow sections",
    leftRailAria: "Workflow navigation",
    workflowSteps: "Workflow steps",
    progressAria: "Live queue progress",
    progress: "Progress",
    completeness: "Completeness",
    pendingQuestions: "Pending questions",
    blockedQuestions: "Blocked questions",
    reconnectSidecar: "Reconnect sidecar",
    sidecarUnavailable: "Sidecar unavailable",
    sidecarUnavailableMessage: "Sidecar connection is unavailable.",
    retryConnection: "Retry connection",
    commandFailed: "Command failed"
  },
  nav: {
    questionsSublabel: (active: number, next: number) => `${active} active · ${next} next`,
    researchSublabel: (tasks: number, runs: number) => `${tasks} tasks · ${runs} runs`,
    permissionsSublabel: (workspaceStatus: string, permissionStatus: string) => `${workspaceStatus} · ${permissionStatus}`
  },
  questions: {
    sessionStart: "Session start",
    firstRunAria: "First run guidance",
    firstRunTitle: "First run setup",
    firstRunItems: [
      "Write the idea and current concern to create the first question batch.",
      "If this is a business goal, choose the review intensity yourself. The app does not decide it for you.",
      "Research and execution prep are recorded as reviewable notes first; risky actions are not run automatically."
    ],
    rawIdea: "Raw idea",
    intakeAnswer: "Intake answer",
    projectPurpose: "Project purpose",
    purposeHelp: "Even if AI suggests a mode, you confirm it. Until then the session stays in mode_required, and later changes are auditable events.",
    businessCriticIntensity: "Business critic intensity",
    intensityReason: "Intensity reason",
    intensityReasonPlaceholder: "Record why this validation intensity was selected.",
    intensityHelp: "Business mode does not auto-select an intensity. Until you choose one, it remains blocked on business critic intensity.",
    running: "Running",
    createFirstBatch: "Create first batch",
    queue: "Queue",
    nextValidation: "Next validation",
    suggestedAnswers: "Suggested answer choices",
    optionPro: "Pro",
    optionCon: "Con",
    customAnswer: "Write a different answer if none fit",
    customAnswerPlaceholder: "If the choices do not match your situation, write your own answer here.",
    answerAriaPrefix: "Answer",
    submitAnswer: "Submit answer",
    nextValidationActionAriaPrefix: "Next validation action for",
    knownRiskPlaceholder: "When carrying this as a Known Risk, write the next validation action.",
    carryAsKnownRisk: "Carry as Known Risk",
    queueRecoveryFresh: "Queue projection is fresh; SSE notifications will trigger refetch instead of local state mutation.",
    queueRefetchMissing: "Canonical queue refetch URL is not loaded yet.",
    queueSseMissing: "SSE notification stream is not loaded yet.",
    queueActiveBatchMissing: "No active batch metadata loaded yet.",
    queueSections: {
      active: { title: "Active batch", emptyLabel: "No active questions." },
      next: { title: "Next", emptyLabel: "No queued-next items." },
      blocked: { title: "Blocked", emptyLabel: "No blocked cards." },
      deferred: { title: "Deferred", emptyLabel: "No deferred cards." }
    }
  },
  planning: {
    spec: "Spec",
    noSpecDraft: "No spec draft yet.",
    sessionVersion: "Session version",
    specSections: "Spec sections",
    approval: "Approval",
    projectPurpose: "Project purpose",
    businessCritic: "Business critic",
    notSelected: "not selected",
    notApplicable: "not applicable",
    businessCriticChangeReason: "Business critic change reason",
    businessCriticChangeReasonPlaceholder: "Record why the business validation intensity is changing.",
    changeTo: (label: string) => `Change to ${label}`,
    businessCriticAuditHelp: "Changes are audited as BusinessCriticIntensityChanged events and add new pressure to queued_next without replacing the active batch.",
    modeChangeReason: "Mode change reason",
    modeChangeReasonPlaceholder: "Record why the question/research criteria are changing.",
    modeAuditHelp: "Changes are audited as ProjectPurposeModeChanged events and keep the current active batch.",
    progress: "Progress",
    pending: "pending",
    scoreCompleteness: "Score completeness",
    noRiskProjection: "No risk projection yet.",
    founderBrief: "Founder Brief",
    ready: "ready",
    draft: "draft",
    prepareExportMetadata: "Prepare export metadata",
    noFounderBrief: "No Founder Brief prepared yet."
  },
  research: {
    research: "Research",
    unknown: "unknown",
    planResearchTask: "Plan research task",
    rationale: "Rationale",
    importResearchAriaPrefix: "Import research for",
    importResult: "Import result",
    startReadOnlyRun: "Start read-only run",
    noResearchTasks: "No research tasks yet."
  },
  implementation: {
    runtimeEvidence: "Runtime evidence",
    adapterPrefix: "Adapter",
    effectSuffix: "effect(s)",
    noCommandStatus: "No command status records yet.",
    activity: "Activity",
    pending: "pending",
    refreshStatus: "Refresh status",
    noActivity: "No activity yet."
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
      customer: "Customer/JTBD",
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
    allowlistScreen: "Allowlist screen",
    limits: "limits",
    concurrent: "concurrent",
    session: "session",
    retries: "retries",
    disclosure: "disclosure",
    publicSafeSummaryRequired: "public-safe summary required",
    policyMissing: "policy missing",
    pause: "Pause",
    revoke: "Revoke",
    noAllowlist: "No allowlist loaded yet.",
    researchRunCards: "Research run cards",
    run: "run",
    attempt: "attempt",
    qualityGate: "quality gate",
    terminal: "terminal",
    recovery: "recovery",
    refetchUnavailable: "refetch unavailable",
    refreshRunStatus: "Refresh status",
    cancel: "Cancel",
    retry: "Retry",
    noResearchRuns: "No research runs loaded yet.",
    qualityGateDisplay: "Quality gate display"
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
    sourceRefs: "source refs",
    runGate: "Run Planning Handoff gate",
    refresh: "Refresh handoff"
  },
  permissions: {
    externalAiWorkspace: "External AI workspace",
    nextAction: "Next action",
    refreshWorkspace: "Refresh workspace",
    revokeWorkspace: "Revoke workspace",
    fallback: "Fallback",
    fallbackReason: "Fallback reason",
    storedArtifacts: "Stored artifacts",
    redactionPreview: "Redaction preview",
    noRetainedArtifactRefs: "No retained artifact refs.",
    activityFeedLinks: "Activity feed links",
    noLinkedResearchDecisionRefs: "No linked ResearchTask/Decision refs.",
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
    noLinkedSetupDecisionRefs: "No linked setup-step/decision refs.",
    noServicePermissionAuditEntries: "No service permission audit entries yet."
  },
  ledger: {
    title: "Implementation step ledger",
    nextAction: "Next action",
    refresh: "Refresh implementation ledger",
    latestStep: "Latest step",
    step: "Step",
    scope: "Scope",
    progressReport: "Progress report",
    missingEvidence: "Missing or blocked evidence",
    evidenceRefs: "Evidence refs",
    noEvidenceRefs: "No implementation evidence refs recorded."
  }
};

const JA_COPY: typeof EN_COPY = {
  pageMeta: {
    questions: {
      label: "質問",
      shortLabel: "Q",
      title: "Decision Queue",
      description: "目的の選択、リサーチ要否、既知リスクを一つの画面で処理します。"
    },
    research: {
      label: "リサーチ",
      shortLabel: "R",
      title: "Research Evidence",
      description: "承認済みの公開安全リサーチ実行と手動エビデンス取り込みを管理します。"
    },
    planning: {
      label: "計画",
      shortLabel: "P",
      title: "Planning Readiness",
      description: "仕様、完成度スコア、Founder Brief、handoff gateを確認します。"
    },
    implementation: {
      label: "実装",
      shortLabel: "I",
      title: "Implementation Runtime",
      description: "ランタイム活動と実装台帳を一つの流れで追跡します。"
    },
    permissions: {
      label: "権限",
      shortLabel: "A",
      title: "Delegation & Permissions",
      description: "外部ブラウザ委任とサービスページ利用権限を別々の監査フローで管理します。"
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
      label: "個人ワークフロー実装",
      description: "市場向け narrative ではなく、個人ワークフロー、GUI、実装可能性、ローカルデータ/セキュリティに集中します。"
    }
  ],
  businessCriticIntensityOptions: [
    {
      intensity: "balanced",
      label: "バランス型事業レビュー",
      description: "主要 decision group ごとに最低1つの反対/批判質問を維持します。"
    },
    {
      intensity: "strong",
      label: "強い事業レビュー",
      description: "重要な business gap がある場合、核心仮説への反証質問をキューに残します。"
    },
    {
      intensity: "investor_grade",
      label: "投資審査級レビュー",
      description: "価格、チャネル、retention proxy、法務/運用、市場タイミング、founder advantage を厳しく検証します。"
    }
  ],
  layout: {
    localQueueFallback: "Local Decision Queue",
    workflowSectionsAria: "デスクトップのワークフロー区分",
    leftRailAria: "ワークフローナビゲーション",
    workflowSteps: "作業ステップ",
    progressAria: "ライブキュー進捗",
    progress: "進捗",
    completeness: "完成度",
    pendingQuestions: "待機中の質問",
    blockedQuestions: "ブロック中の質問",
    reconnectSidecar: "Sidecarに再接続",
    sidecarUnavailable: "Sidecarを利用できません",
    sidecarUnavailableMessage: "Sidecar接続を利用できません。",
    retryConnection: "再接続",
    commandFailed: "コマンド失敗"
  },
  nav: {
    questionsSublabel: (active: number, next: number) => `${active} active · ${next} next`,
    researchSublabel: (tasks: number, runs: number) => `${tasks} tasks · ${runs} runs`,
    permissionsSublabel: (workspaceStatus: string, permissionStatus: string) => `${workspaceStatus} · ${permissionStatus}`
  },
  questions: {
    sessionStart: "セッション開始",
    firstRunAria: "初回実行ガイド",
    firstRunTitle: "最初の設定",
    firstRunItems: [
      "アイデアと現在の悩みを書くと、最初の質問セットを作成します。",
      "事業目的の場合は検証強度を自分で選びます。アプリが勝手に決めることはありません。",
      "リサーチと実行準備はまず確認可能なノートとして残し、危険な作業は自動実行しません。"
    ],
    rawIdea: "アイデア原文",
    intakeAnswer: "初回回答",
    projectPurpose: "プロジェクト目的",
    purposeHelp: "AIがモードを提案しても、確定するのはユーザーです。選択前は mode_required のままで、後の変更は監査イベントになります。",
    businessCriticIntensity: "事業批判の強度",
    intensityReason: "強度を選んだ理由",
    intensityReasonPlaceholder: "この検証強度を選んだ理由を監査に残します。",
    intensityHelp: "事業モードでは強度を自動選択しません。選択するまでは事業批判強度が必要な状態です。",
    running: "実行中",
    createFirstBatch: "最初の質問セットを作成",
    queue: "キュー",
    nextValidation: "次の検証",
    suggestedAnswers: "回答候補",
    optionPro: "長所",
    optionCon: "短所",
    customAnswer: "合う選択肢がなければ直接入力",
    customAnswerPlaceholder: "候補が状況に合わない場合は、ここに自分の回答を書いてください。",
    answerAriaPrefix: "回答",
    submitAnswer: "回答を送信",
    nextValidationActionAriaPrefix: "次の検証アクション",
    knownRiskPlaceholder: "Known Risk として残す場合、次の検証アクションを書いてください。",
    carryAsKnownRisk: "Known Riskとして残す",
    queueRecoveryFresh: "キュー projection は最新です。SSE通知後も正規状態は refetch で更新します。",
    queueRefetchMissing: "正規キュー refetch URL はまだ読み込まれていません。",
    queueSseMissing: "SSE通知ストリームはまだ読み込まれていません。",
    queueActiveBatchMissing: "active batch metadata はまだ読み込まれていません。",
    queueSections: {
      active: { title: "アクティブ", emptyLabel: "アクティブな質問はありません。" },
      next: { title: "次", emptyLabel: "queued-next 項目はありません。" },
      blocked: { title: "ブロック", emptyLabel: "ブロックされたカードはありません。" },
      deferred: { title: "保留", emptyLabel: "保留中のカードはありません。" }
    }
  },
  planning: {
    spec: "仕様",
    noSpecDraft: "仕様ドラフトはまだありません。",
    sessionVersion: "セッションバージョン",
    specSections: "仕様セクション",
    approval: "承認",
    projectPurpose: "プロジェクト目的",
    businessCritic: "事業批判",
    notSelected: "未選択",
    notApplicable: "対象外",
    businessCriticChangeReason: "事業批判強度の変更理由",
    businessCriticChangeReasonPlaceholder: "事業検証強度を変える理由を記録します。",
    changeTo: (label: string) => `${label}に変更`,
    businessCriticAuditHelp: "変更は BusinessCriticIntensityChanged として監査され、active batchを置き換えず queued_next に新しい pressure を追加します。",
    modeChangeReason: "モード変更理由",
    modeChangeReasonPlaceholder: "質問/リサーチ基準を変える理由を記録します。",
    modeAuditHelp: "変更は ProjectPurposeModeChanged として監査され、既存の active batch は維持されます。",
    progress: "進捗",
    pending: "保留中",
    scoreCompleteness: "完成度を採点",
    noRiskProjection: "リスク予測はまだありません。",
    founderBrief: "Founder Brief",
    ready: "準備完了",
    draft: "ドラフト",
    prepareExportMetadata: "エクスポート metadata を準備",
    noFounderBrief: "Founder Brief はまだ準備されていません。"
  },
  research: {
    research: "リサーチ",
    unknown: "不明",
    planResearchTask: "リサーチタスクを計画",
    rationale: "根拠",
    importResearchAriaPrefix: "リサーチ取り込み",
    importResult: "結果を取り込む",
    startReadOnlyRun: "読み取り専用実行を開始",
    noResearchTasks: "リサーチタスクはまだありません。"
  },
  implementation: {
    runtimeEvidence: "ランタイム証跡",
    adapterPrefix: "アダプター",
    effectSuffix: "effect(s)",
    noCommandStatus: "コマンドステータス記録はまだありません。",
    activity: "活動",
    pending: "保留中",
    refreshStatus: "ステータス更新",
    noActivity: "活動はまだありません。"
  },
  rightRail: {
    aria: "ライブプロジェクト概要",
    planningCompleteness: "計画完成度",
    researchStatus: "リサーチ状況",
    tasks: "tasks",
    activeRuns: "active runs",
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
    allowlistScreen: "Allowlist画面",
    limits: "制限",
    concurrent: "同時",
    session: "セッション",
    retries: "再試行",
    disclosure: "開示",
    publicSafeSummaryRequired: "public-safe summary が必要",
    policyMissing: "policy missing",
    pause: "一時停止",
    revoke: "取り消し",
    noAllowlist: "Allowlist はまだ読み込まれていません。",
    researchRunCards: "リサーチ実行カード",
    run: "run",
    attempt: "試行",
    qualityGate: "quality gate",
    terminal: "terminal",
    recovery: "recovery",
    refetchUnavailable: "refetch unavailable",
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
    sourceRefs: "source refs",
    runGate: "Planning Handoff gateを実行",
    refresh: "handoff更新"
  },
  permissions: {
    externalAiWorkspace: "外部AIワークスペース",
    nextAction: "次のアクション",
    refreshWorkspace: "ワークスペース更新",
    revokeWorkspace: "ワークスペース取り消し",
    fallback: "フォールバック",
    fallbackReason: "フォールバック理由",
    storedArtifacts: "保存済み artifacts",
    redactionPreview: "Redaction preview",
    noRetainedArtifactRefs: "保持された artifact ref はありません。",
    activityFeedLinks: "Activity feed links",
    noLinkedResearchDecisionRefs: "ResearchTask/Decision ref はまだリンクされていません。",
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
    noLinkedSetupDecisionRefs: "setup-step/decision ref はまだリンクされていません。",
    noServicePermissionAuditEntries: "サービス権限の監査項目はまだありません。"
  },
  ledger: {
    title: "実装ステップ台帳",
    nextAction: "次のアクション",
    refresh: "実装台帳を更新",
    latestStep: "最新ステップ",
    step: "ステップ",
    scope: "範囲",
    progressReport: "進捗レポート",
    missingEvidence: "不足またはブロック中の証跡",
    evidenceRefs: "証跡refs",
    noEvidenceRefs: "実装証跡refはまだ記録されていません。"
  }
};

export const DECISION_QUEUE_COPY = {
  en: EN_COPY,
  ja: JA_COPY
} as const;

export type DecisionQueueCopy = typeof EN_COPY;

export function useDecisionQueueCopy(): DecisionQueueCopy {
  const { language } = useAppLanguage();

  return DECISION_QUEUE_COPY[language];
}
