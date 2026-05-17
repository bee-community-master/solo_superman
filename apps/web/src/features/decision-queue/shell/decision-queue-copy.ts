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

const KO_COPY: typeof EN_COPY = {
  pageMeta: {
    questions: {
      label: "질문",
      shortLabel: "Q",
      title: "의사결정 큐",
      description: "목적 선택, 리서치 필요성, 알려진 리스크를 한곳에서 처리합니다."
    },
    research: {
      label: "리서치",
      shortLabel: "R",
      title: "리서치 근거",
      description: "승인된 공개 안전 리서치 실행과 수동 근거 가져오기를 관리합니다."
    },
    planning: {
      label: "계획",
      shortLabel: "P",
      title: "계획 준비도",
      description: "스펙, 완성도 점수, Founder Brief, 핸드오프 게이트를 검토합니다."
    },
    implementation: {
      label: "구현",
      shortLabel: "I",
      title: "구현 런타임",
      description: "런타임 활동과 구현 원장을 하나의 흐름에서 추적합니다."
    },
    permissions: {
      label: "권한",
      shortLabel: "A",
      title: "위임 및 권한",
      description: "외부 브라우저 위임과 서비스 페이지 사용 권한을 별도 감사 흐름으로 점검합니다."
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
      label: "개인 워크플로 구축",
      description: "시장 내러티브 대신 개인 워크플로, GUI, 구현 가능성, 로컬 데이터/보안에 집중합니다."
    }
  ],
  businessCriticIntensityOptions: [
    {
      intensity: "balanced",
      label: "균형 잡힌 비즈니스 리뷰",
      description: "주요 의사결정 그룹마다 최소 하나의 반대 또는 비판 질문을 유지합니다."
    },
    {
      intensity: "strong",
      label: "강한 비즈니스 리뷰",
      description: "영향이 큰 비즈니스 공백이 보이면 핵심 가정 도전 질문을 큐에 남겨둡니다."
    },
    {
      intensity: "investor_grade",
      label: "투자 심사급 리뷰",
      description: "가격, 채널, 유지율 대리지표, 법무/운영 리스크, 시장 타이밍, 창업자 우위를 압박 검증합니다."
    }
  ],
  layout: {
    localQueueFallback: "로컬 의사결정 큐",
    workflowSectionsAria: "데스크톱 워크플로 섹션",
    leftRailAria: "워크플로 내비게이션",
    workflowSteps: "워크플로 단계",
    progressAria: "실시간 큐 진행률",
    progress: "진행률",
    completeness: "완성도",
    pendingQuestions: "대기 중인 질문",
    blockedQuestions: "차단된 질문",
    reconnectSidecar: "사이드카 다시 연결",
    sidecarUnavailable: "사이드카를 사용할 수 없음",
    sidecarUnavailableMessage: "사이드카 연결을 사용할 수 없습니다.",
    retryConnection: "다시 연결",
    commandFailed: "명령 실패"
  },
  nav: {
    questionsSublabel: (active: number, next: number) => `${active}개 활성 · 다음 ${next}개`,
    researchSublabel: (tasks: number, runs: number) => `${tasks}개 작업 · ${runs}개 실행`,
    permissionsSublabel: (workspaceStatus: string, permissionStatus: string) => `${workspaceStatus} · ${permissionStatus}`
  },
  questions: {
    sessionStart: "세션 시작",
    firstRunAria: "첫 실행 가이드",
    firstRunTitle: "첫 설정",
    firstRunItems: [
      "아이디어와 현재 걱정을 적으면 첫 질문 묶음을 만듭니다.",
      "비즈니스 목표라면 리뷰 강도를 직접 선택합니다. 앱이 대신 결정하지 않습니다.",
      "리서치와 실행 준비는 먼저 검토 가능한 노트로 기록하며, 위험한 작업은 자동 실행하지 않습니다."
    ],
    rawIdea: "원본 아이디어",
    intakeAnswer: "초기 답변",
    projectPurpose: "프로젝트 목적",
    purposeHelp: "AI가 모드를 제안하더라도 확정은 사용자가 합니다. 그 전까지 세션은 mode_required 상태이며 이후 변경은 감사 이벤트로 남습니다.",
    businessCriticIntensity: "비즈니스 비판 강도",
    intensityReason: "강도 선택 이유",
    intensityReasonPlaceholder: "이 검증 강도를 선택한 이유를 기록하세요.",
    intensityHelp: "비즈니스 모드에서는 강도를 자동 선택하지 않습니다. 선택 전까지 비즈니스 비판 강도가 필요한 상태로 남습니다.",
    running: "실행 중",
    createFirstBatch: "첫 질문 묶음 만들기",
    queue: "큐",
    nextValidation: "다음 검증",
    suggestedAnswers: "추천 답변 선택지",
    optionPro: "찬성",
    optionCon: "반대",
    customAnswer: "맞는 선택지가 없으면 다른 답변 작성",
    customAnswerPlaceholder: "선택지가 상황에 맞지 않으면 여기에 직접 답변을 작성하세요.",
    answerAriaPrefix: "답변",
    submitAnswer: "답변 제출",
    nextValidationActionAriaPrefix: "다음 검증 작업",
    knownRiskPlaceholder: "Known Risk로 유지할 경우 다음 검증 작업을 작성하세요.",
    carryAsKnownRisk: "Known Risk로 유지",
    queueRecoveryFresh: "큐 projection은 최신입니다. SSE 알림은 로컬 상태 변이 대신 다시 가져오기를 트리거합니다.",
    queueRefetchMissing: "정식 큐 다시 가져오기 URL이 아직 로드되지 않았습니다.",
    queueSseMissing: "SSE 알림 스트림이 아직 로드되지 않았습니다.",
    queueActiveBatchMissing: "활성 묶음 메타데이터가 아직 로드되지 않았습니다.",
    queueSections: {
      active: { title: "활성 묶음", emptyLabel: "활성 질문이 없습니다." },
      next: { title: "다음", emptyLabel: "queued-next 항목이 없습니다." },
      blocked: { title: "차단됨", emptyLabel: "차단된 카드가 없습니다." },
      deferred: { title: "보류", emptyLabel: "보류 중인 카드가 없습니다." }
    }
  },
  planning: {
    spec: "스펙",
    noSpecDraft: "아직 스펙 초안이 없습니다.",
    sessionVersion: "세션 버전",
    specSections: "스펙 섹션",
    approval: "승인",
    projectPurpose: "프로젝트 목적",
    businessCritic: "비즈니스 비판",
    notSelected: "미선택",
    notApplicable: "해당 없음",
    businessCriticChangeReason: "비즈니스 비판 강도 변경 이유",
    businessCriticChangeReasonPlaceholder: "비즈니스 검증 강도를 바꾸는 이유를 기록하세요.",
    changeTo: (label: string) => `${label}(으)로 변경`,
    businessCriticAuditHelp: "변경은 BusinessCriticIntensityChanged 이벤트로 감사되며, 활성 묶음을 교체하지 않고 queued_next에 새 pressure를 추가합니다.",
    modeChangeReason: "모드 변경 이유",
    modeChangeReasonPlaceholder: "질문/리서치 기준을 바꾸는 이유를 기록하세요.",
    modeAuditHelp: "변경은 ProjectPurposeModeChanged 이벤트로 감사되며 현재 활성 묶음은 유지됩니다.",
    progress: "진행률",
    pending: "대기 중",
    scoreCompleteness: "완성도 채점",
    noRiskProjection: "아직 리스크 예측이 없습니다.",
    founderBrief: "Founder Brief",
    ready: "준비됨",
    draft: "초안",
    prepareExportMetadata: "내보내기 메타데이터 준비",
    noFounderBrief: "아직 Founder Brief가 준비되지 않았습니다."
  },
  research: {
    research: "리서치",
    unknown: "알 수 없음",
    planResearchTask: "리서치 작업 계획",
    rationale: "근거",
    importResearchAriaPrefix: "리서치 가져오기",
    importResult: "결과 가져오기",
    startReadOnlyRun: "읽기 전용 실행 시작",
    noResearchTasks: "아직 리서치 작업이 없습니다."
  },
  implementation: {
    runtimeEvidence: "런타임 근거",
    adapterPrefix: "어댑터",
    effectSuffix: "effect(s)",
    noCommandStatus: "아직 명령 상태 기록이 없습니다.",
    activity: "활동",
    pending: "대기 중",
    refreshStatus: "상태 새로고침",
    noActivity: "아직 활동이 없습니다."
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
      customer: "고객/JTBD",
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
    allowlistScreen: "허용 목록 화면",
    limits: "제한",
    concurrent: "동시",
    session: "세션",
    retries: "재시도",
    disclosure: "공개 고지",
    publicSafeSummaryRequired: "public-safe summary 필요",
    policyMissing: "policy 누락",
    pause: "일시정지",
    revoke: "취소",
    noAllowlist: "아직 허용 목록이 로드되지 않았습니다.",
    researchRunCards: "리서치 실행 카드",
    run: "실행",
    attempt: "시도",
    qualityGate: "품질 게이트",
    terminal: "종료 상태",
    recovery: "복구",
    refetchUnavailable: "다시 가져오기 불가",
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
    sourceRefs: "출처 refs",
    runGate: "Planning Handoff 게이트 실행",
    refresh: "핸드오프 새로고침"
  },
  permissions: {
    externalAiWorkspace: "외부 AI 워크스페이스",
    nextAction: "다음 작업",
    refreshWorkspace: "워크스페이스 새로고침",
    revokeWorkspace: "워크스페이스 취소",
    fallback: "대체 경로",
    fallbackReason: "대체 사유",
    storedArtifacts: "저장된 artifacts",
    redactionPreview: "비식별화 미리보기",
    noRetainedArtifactRefs: "보관된 artifact ref가 없습니다.",
    activityFeedLinks: "활동 피드 링크",
    noLinkedResearchDecisionRefs: "아직 연결된 ResearchTask/Decision ref가 없습니다.",
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
    approvalGranularity: "승인 세분성",
    userApproval: "사용자 승인",
    loginBoundary: "로그인 경계",
    finalSubmitBoundary: "최종 제출 경계",
    blockedReasons: "차단 사유",
    noLinkedSetupDecisionRefs: "아직 연결된 setup-step/decision ref가 없습니다.",
    noServicePermissionAuditEntries: "아직 서비스 권한 감사 항목이 없습니다."
  },
  ledger: {
    title: "구현 단계 원장",
    nextAction: "다음 작업",
    refresh: "구현 원장 새로고침",
    latestStep: "최신 단계",
    step: "단계",
    scope: "범위",
    progressReport: "진행 보고",
    missingEvidence: "누락 또는 차단된 근거",
    evidenceRefs: "근거 refs",
    noEvidenceRefs: "아직 구현 근거 ref가 기록되지 않았습니다."
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
