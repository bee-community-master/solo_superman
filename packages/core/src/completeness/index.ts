import {
  BUSINESS_CRITIC_INTENSITY_EFFECTS,
  BUSINESS_CRITIC_INTENSITY_LABELS,
  BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL,
  PROJECT_PURPOSE_MODE_LABELS,
  PROJECT_PURPOSE_MODE_REQUIRED_LABEL,
  PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES,
  type CompletionGateStatus,
  type ConfidenceAxisScore,
  type ConfidenceCompletionProjection,
  type FounderBriefProjection,
  type IfStopNowArtifactProjection,
  type BusinessCriticalQuestionCategory,
  type BusinessCriticIntensity,
  type ProductEngineStateSnapshot,
  type ProjectPurposeMode,
  type ProjectionVersion,
  type RequiredDecisionRef,
  type ReadinessLabel,
  type TopRiskCardProjection
} from "@solo-superman/contracts";

export const COMPLETENESS_ENGINE_SLICE_STATUS = "completeness-founder-brief-pr-08" as const;

const AXIS_LABELS = {
  problem: "Problem confidence",
  customer: "Customer segment confidence",
  value: "Value proposition confidence",
  validation: "Validation confidence",
  implementation: "Implementation readiness"
} as const;

const REQUIRED_SECTION_KEYWORDS = [
  ["problem"],
  ["target", "customer"],
  ["value", "proposition"],
  ["alternative", "competition"],
  ["evidence"],
  ["validation"],
  ["mvp", "scope"],
  ["success", "criteria"]
] as const;

const PERSONAL_REQUIRED_SECTION_KEYWORDS = [
  ["workflow"],
  ["frequency"],
  ["input"],
  ["output"],
  ["gui"],
  ["implementation"],
  ["local", "data"],
  ["security"],
  ["maintainability"],
  ["success", "criteria"]
] as const;

const PROJECT_PURPOSE_MODE_DETAILS = {
  business: {
    label: PROJECT_PURPOSE_MODE_LABELS.business,
    effect:
      "고객/문제/유료 의향/대체재/채널/법무·운영 리스크를 completion gate와 다음 검증 행동에 유지합니다.",
    skippedCommercializationAxes: PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES.business
  },
  personal: {
    label: PROJECT_PURPOSE_MODE_LABELS.personal,
    effect:
      "시장 규모, 투자자 narrative, 유료 의향을 기본 completion 요구에서 제외하고 workflow/GUI/구현 가능성/local data/security/유지보수를 우선합니다.",
    skippedCommercializationAxes: PROJECT_PURPOSE_MODE_SKIPPED_COMMERCIALIZATION_AXES.personal
  }
} as const satisfies Record<
  ProjectPurposeMode,
  {
    readonly label: string;
    readonly effect: string;
    readonly skippedCommercializationAxes: readonly string[];
  }
>;

const PROJECT_PURPOSE_MODE_REQUIRED_EFFECT =
  "사용자가 사업화 검증 중심 또는 개인 workflow 구현 중심을 명시 선택하기 전까지 mode-specific completeness gate를 확정하지 않습니다.";

const BUSINESS_CRITIC_INTENSITY_REQUIRED_EFFECT =
  "사업화 모드에서는 사용자가 balanced, strong, investor_grade 중 하나를 명시 선택하기 전까지 business completion gate를 확정하지 않습니다.";

const ELEVATED_BUSINESS_CRITIC_CATEGORY_REPORT_ORDER = [
  "paid_intent",
  "acquisition",
  "pricing",
  "retention_proxy",
  "legal_ops_security",
  "market_timing",
  "founder_advantage"
] as const satisfies readonly BusinessCriticalQuestionCategory[];

const REQUIRED_DECISION_REFS: readonly RequiredDecisionRef[] = [
  "primary_customer",
  "problem",
  "value",
  "mvp_scope",
  "validation_plan",
  "success_criteria"
] as const;
const CONFIDENCE_AXIS_READY_THRESHOLD = 75;
const MIN_READY_CONFIDENCE_AXIS_COUNT = 4;

const RISK_SEVERITY_RANK = {
  high: 0,
  medium: 1,
  low: 2
} as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: readonly number[], fallback = 0) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : fallback;
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sectionCompletenessScore(state: ProductEngineStateSnapshot) {
  if (!state.project.projectPurposeMode) {
    return 0;
  }

  const sections = state.currentSpec.sections ?? [];
  const normalizedSections = sections.map((section) => section.toLowerCase());
  const requiredSectionKeywords =
    state.project.projectPurposeMode === "personal" ? PERSONAL_REQUIRED_SECTION_KEYWORDS : REQUIRED_SECTION_KEYWORDS;
  const matched = requiredSectionKeywords.filter((keywords) =>
    normalizedSections.some((section) => keywords.every((keyword) => section.includes(keyword)))
  ).length;

  return clampScore((matched / requiredSectionKeywords.length) * 100);
}

function questionDebtScore(state: ProductEngineStateSnapshot) {
  const highOpen = state.openIssues.filter((issue) => issue.status === "open").length;
  const mediumOpen = state.queueProjection.blocked.filter(
    (item) => !String(item.queueItemId).startsWith("completion_candidate_")
  ).length;
  const lowDeferred = state.openIssues.filter((issue) => issue.status === "deferred").length + state.queueProjection.deferred.length;

  return clampScore(100 - Math.min(100, highOpen * 25 + mediumOpen * 8 + lowDeferred * 2));
}

function matrixQualityScore(matrix: ProductEngineStateSnapshot["researchState"]["evidenceMatrices"][number]) {
  switch (matrix.balanceStatus) {
    case "balanced":
      return matrix.uncertainties.length || matrix.additionalQuestions.length ? 90 : 80;
    case "needs_con_evidence":
      return matrix.knownRisk && matrix.additionalQuestions.length ? 70 : 60;
    case "missing_con_evidence":
      return matrix.knownRisk && matrix.additionalQuestions.length ? 50 : 40;
    case "blocked_by_con_evidence":
      return 35;
    case "source_quality_insufficient":
      return 20;
    case "unknown":
      return 0;
  }
}

function evidenceGateBlocksCompletion(matrix: ProductEngineStateSnapshot["researchState"]["evidenceMatrices"][number]) {
  return (
    matrix.decisionBlocked ||
    matrix.balanceStatus === "missing_con_evidence" ||
    matrix.balanceStatus === "blocked_by_con_evidence" ||
    matrix.balanceStatus === "source_quality_insufficient"
  );
}

function researchCardResolvesMatrixBlocker(
  card: ProductEngineStateSnapshot["researchState"]["reviewCards"][number]
) {
  if (!card.terminalOutcome) {
    return false;
  }

  switch (card.terminalOutcome) {
    case "approved":
    case "revised":
    case "rejected":
      return true;
    case "risk_accepted":
      return Boolean(card.terminalRationale);
    case "deferred":
    case "research_insufficient":
      return false;
  }
}

function evidenceMatrixBlocksCompletion(
  state: ProductEngineStateSnapshot,
  matrix: ProductEngineStateSnapshot["researchState"]["evidenceMatrices"][number]
) {
  if (!evidenceGateBlocksCompletion(matrix)) {
    return false;
  }

  const linkedCards = state.researchState.reviewCards.filter(
    (card) => card.researchTaskId === matrix.researchTaskId
  );

  return !linkedCards.some(researchCardResolvesMatrixBlocker);
}

function evidenceRiskTitle(matrix: ProductEngineStateSnapshot["researchState"]["evidenceMatrices"][number]) {
  return (
    matrix.knownRisk ??
    matrix.missingConEvidenceReason ??
    `Evidence balance is ${matrix.balanceStatus} for ${matrix.researchTaskId}.`
  );
}

function researchCardBlocksCompletion(
  card: ProductEngineStateSnapshot["researchState"]["reviewCards"][number]
) {
  return card.blocksPlanning;
}

function businessCriticIntensityLabel(intensity: BusinessCriticIntensity | null | undefined) {
  return intensity ? BUSINESS_CRITIC_INTENSITY_LABELS[intensity] : BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL;
}

function businessCriticIntensityEffect(intensity: BusinessCriticIntensity | null | undefined) {
  return intensity ? BUSINESS_CRITIC_INTENSITY_EFFECTS[intensity] : BUSINESS_CRITIC_INTENSITY_REQUIRED_EFFECT;
}

function isKnownRiskWithValidationAction(issue: ProductEngineStateSnapshot["openIssues"][number]) {
  return issue.status === "deferred" && issue.knownRiskAccepted === true && Boolean(issue.nextValidationAction);
}

function unresolvedBusinessCriticIssues(state: ProductEngineStateSnapshot) {
  return state.openIssues.filter((issue) => issue.businessCriticCategory && issue.status === "open");
}

function businessCriticPressureGate(state: ProductEngineStateSnapshot): CompletionGateStatus | null {
  if (state.project.projectPurposeMode !== "business") {
    return null;
  }

  const intensity = state.project.businessCriticIntensity;

  if (!intensity) {
    return {
      gateId: "business_critic_intensity",
      label: BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL,
      passed: false,
      blockingReason: "사업화 모드 사용자가 balanced, strong, investor_grade 중 하나를 명시 선택해야 합니다."
    };
  }

  const unresolved = unresolvedBusinessCriticIssues(state);
  const unresolvedStrong = unresolved.filter((issue) => issue.businessCriticPressureKind === "core_assumption_challenge");
  const unresolvedInvestor = unresolved.filter((issue) => issue.businessCriticPressureKind === "investor_pressure_pass");
  const unresolvedInvestorPressure = [...unresolvedStrong, ...unresolvedInvestor];
  const unresolvedInvestorCategories = new Set(unresolvedInvestorPressure.map((issue) => issue.businessCriticCategory));
  const unresolvedCategoryLabel = ELEVATED_BUSINESS_CRITIC_CATEGORY_REPORT_ORDER.filter((category) =>
    unresolvedInvestorCategories.has(category)
  ).join(", ");

  if (intensity === "strong" && unresolvedStrong.length > 0) {
    return {
      gateId: "business_critic_pressure",
      label: "Strong critic core-assumption challenges are resolved or carried as Known Risks",
      passed: false,
      blockingReason: `${unresolvedStrong.length} core-assumption challenge(s) need an answer or Known Risk + Next Validation Action.`
    };
  }

  if (intensity === "investor_grade" && unresolvedInvestorPressure.length > 0) {
    return {
      gateId: "business_critic_pressure",
      label: "Investor-grade pressure passes are resolved or carried as Known Risks",
      passed: false,
      blockingReason: `Investor-grade pressure categories remain open: ${unresolvedCategoryLabel || unresolvedInvestorPressure.length}.`
    };
  }

  return {
    gateId: "business_critic_pressure",
    label:
      intensity === "balanced"
        ? "Balanced critic questions are resolved or visible"
        : `${businessCriticIntensityLabel(intensity)} pressure questions are resolved or carried as Known Risks`,
    passed: true
  };
}

function researchCardRiskTitle(
  card: ProductEngineStateSnapshot["researchState"]["reviewCards"][number]
) {
  const terminalReason = card.terminalRationale ? ` — ${card.terminalRationale}` : "";
  const outcome = card.terminalOutcome ? ` (${card.terminalOutcome})` : "";

  return `Research-updated ${card.cardType} card blocks Planning-ready: ${card.title}${outcome}${terminalReason}`;
}

function latestImplementationStep(state: ProductEngineStateSnapshot) {
  return state.implementationStepLedger?.steps.at(-1) ?? null;
}

function implementationLedgerBlocksCompletion(state: ProductEngineStateSnapshot) {
  const ledger = state.implementationStepLedger;
  const latestStep = latestImplementationStep(state);

  return Boolean(ledger && (ledger.currentStatus !== "completed" || latestStep?.status !== "completed"));
}

function implementationLedgerBlockingReason(state: ProductEngineStateSnapshot) {
  const ledger = state.implementationStepLedger;
  const latestStep = latestImplementationStep(state);

  if (!ledger) {
    return null;
  }

  if (latestStep?.blocker) {
    return `Implementation step ledger is blocked: ${latestStep.blocker.reason}`;
  }

  if (latestStep && latestStep.status !== "completed") {
    return `Implementation step ledger latest step ${latestStep.stepDoc.stepId} is ${latestStep.status}.`;
  }

  return `Implementation step ledger is ${ledger.currentStatus}.`;
}

function implementationLedgerRiskCard(state: ProductEngineStateSnapshot): TopRiskCardProjection {
  const ledger = state.implementationStepLedger;
  const latestStep = latestImplementationStep(state);
  const blocker = latestStep?.blocker ?? null;

  return {
    riskId: "risk_implementation_step_ledger",
    title: implementationLedgerBlockingReason(state) ?? "Implementation step ledger closeout is incomplete.",
    severity: blocker || latestStep?.status === "blocked" ? "high" : "medium",
    sourceRefs: [
      ...(ledger ? [`implementation_step_ledger:${ledger.sessionId}:${ledger.version}`] : []),
      ...(latestStep ? [latestStep.stepDoc.stepId] : [])
    ],
    nextValidationAction:
      blocker?.nextRequiredAction ??
      "Complete the implementation step ledger with commit, review streak, clean-code review, and passing test evidence."
  };
}

function evidenceQualityScore(state: ProductEngineStateSnapshot) {
  return clampScore(average(state.researchState.evidenceMatrices.map(matrixQualityScore), 0));
}

function decisionApprovalScore(state: ProductEngineStateSnapshot) {
  const closedRequiredDecisionRefs = new Set(
    state.decisions
      .filter((decision) => decision.status === "approved" || decision.status === "risk_accepted")
      .map((decision) => decision.requiredDecisionRef)
  );

  return clampScore((closedRequiredDecisionRefs.size / REQUIRED_DECISION_REFS.length) * 100);
}

function consistencyScore(state: ProductEngineStateSnapshot) {
  const blockingMatrices = state.researchState.evidenceMatrices.filter((matrix) =>
    evidenceMatrixBlocksCompletion(state, matrix)
  ).length;
  const blockingResearchCards = state.researchState.reviewCards.filter(researchCardBlocksCompletion).length;
  const blockedRuntime = state.runtimeState.runtimeArtifacts.filter((artifact) => artifact.status === "blocked").length;
  const failedEffects = state.runtimeState.effects.filter((effect) => effect.status === "failed" || effect.status === "blocked").length;
  const incompleteImplementationCloseout = implementationLedgerBlocksCompletion(state) ? 1 : 0;

  return clampScore(
    100 -
      Math.min(
        100,
        blockingMatrices * 25 +
          blockingResearchCards * 20 +
          blockedRuntime * 20 +
          failedEffects * 20 +
          incompleteImplementationCloseout * 25
      )
  );
}

function readinessLabel(score: number, gatesPassed: boolean): ReadinessLabel {
  if (score >= 85 && gatesPassed) {
    return "spec_ready";
  }

  if (score >= 75) {
    return "decision_ready";
  }

  if (score >= 60) {
    return "researching";
  }

  if (score >= 40) {
    return "clarifying";
  }

  return "draft";
}

function riskCards(state: ProductEngineStateSnapshot, fallbackActions: readonly string[]): readonly TopRiskCardProjection[] {
  const matrixRisks = state.researchState.evidenceMatrices
    .filter(
      (matrix) =>
        matrix.knownRisk ||
        evidenceGateBlocksCompletion(matrix) ||
        matrix.balanceStatus === "needs_con_evidence"
    )
    .map((matrix, index) => ({
      riskId: `risk_evidence_${index + 1}`,
      title: evidenceRiskTitle(matrix),
      severity: evidenceGateBlocksCompletion(matrix) ? ("high" as const) : ("medium" as const),
      sourceRefs: [matrix.evidenceMatrixId, matrix.researchTaskId],
      nextValidationAction:
        matrix.additionalQuestions[0] ?? fallbackActions[0] ?? "Add counter-evidence or explicitly accept the risk."
    }));
  const researchCardRisks = state.researchState.reviewCards
    .filter(researchCardBlocksCompletion)
    .map((card, index) => ({
      riskId: `risk_research_card_${index + 1}`,
      title: researchCardRiskTitle(card),
      severity: "high" as const,
      sourceRefs: [
        card.cardId,
        card.researchTaskId,
        ...(card.evidencePackId ? [card.evidencePackId] : []),
        ...(card.retainedSourceRefs ?? [])
      ],
      nextValidationAction:
        card.terminalOutcome === "research_insufficient"
          ? "Import or synthesize stronger evidence before Planning-ready."
          : card.terminalOutcome === "deferred"
            ? "Approve risk acceptance or resolve the deferred research card before Planning-ready."
            : "Resolve the high-impact research-updated queue card."
    }));
  const openQuestionRisks = state.openIssues
    .filter((issue) => issue.status === "open")
    .map((issue, index) => ({
      riskId: `risk_question_${index + 1}`,
      title: `Open question remains: ${issue.summary}`,
      severity: "high" as const,
      sourceRefs: [issue.queueItemId],
      nextValidationAction:
        issue.nextValidationAction ?? issue.questionText ?? `Resolve ${issue.summary}.`
    }));
  const knownBusinessRisks = state.openIssues
    .filter(isKnownRiskWithValidationAction)
    .map((issue, index) => ({
      riskId: `risk_business_known_${index + 1}`,
      title: `Known business risk accepted: ${issue.summary}`,
      severity: "medium" as const,
      sourceRefs: [issue.queueItemId],
      nextValidationAction: issue.nextValidationAction ?? `Validate ${issue.summary}.`
    }));
  const runtimeRisks = state.runtimeState.runtimeArtifacts
    .filter((artifact) => artifact.status === "blocked")
    .map((artifact, index) => ({
      riskId: `risk_runtime_${index + 1}`,
      title: artifact.blockedAction?.reason ?? `Runtime preview is blocked: ${artifact.summary}`,
      severity: "high" as const,
      sourceRefs: [artifact.artifactId, ...artifact.sourceRefs],
      nextValidationAction: artifact.blockedAction?.suggestedSafeAlternative ?? "Use a manual handoff or safe preview path."
    }));
  const implementationRisks = implementationLedgerBlocksCompletion(state)
    ? [implementationLedgerRiskCard(state)]
    : [];

  return [
    ...matrixRisks,
    ...researchCardRisks,
    ...openQuestionRisks,
    ...knownBusinessRisks,
    ...runtimeRisks,
    ...implementationRisks
  ].sort((left, right) => RISK_SEVERITY_RANK[left.severity] - RISK_SEVERITY_RANK[right.severity]);
}

function acceptedRiskDecisionRisks(state: ProductEngineStateSnapshot) {
  return state.decisions
    .filter((decision) => decision.status === "risk_accepted")
    .map((decision) => `Accepted risk carried forward for ${decision.requiredDecisionRef}: ${decision.decisionId}`);
}

function nextBestActions(state: ProductEngineStateSnapshot, cards: readonly TopRiskCardProjection[]) {
  const modeActions =
    !state.project.projectPurposeMode
      ? ["Select the project purpose mode before scoring mode-specific completion gates."]
      : state.project.projectPurposeMode === "personal"
      ? [
          "Validate the personal workflow frequency and manual baseline.",
          "Confirm GUI fit, local data/security boundaries, implementation feasibility, maintainability, and personal success criteria."
        ]
      : [
          state.project.businessCriticIntensity
            ? `${businessCriticIntensityLabel(state.project.businessCriticIntensity)}: ${businessCriticIntensityEffect(
                state.project.businessCriticIntensity
              )}`
            : "Select the business critic intensity before scoring business completion gates.",
          "Validate customer/problem urgency, willingness to pay, competition, channel, and legal/ops risks."
        ];

  return uniqueStrings([
    ...modeActions,
    ...state.researchState.nextValidationActions,
    ...cards.map((card) => card.nextValidationAction),
    ...(state.openIssues.some((issue) => issue.status === "open") ? ["Resolve the remaining high-priority question cards."] : []),
    ...(state.researchState.evidenceMatrices.length === 0 ? ["Import and synthesize at least one pro/con evidence matrix."] : [])
  ]).slice(0, 5);
}

function axesFromScores(
  state: ProductEngineStateSnapshot,
  sectionScore: number,
  questionScore: number,
  evidenceScore: number,
  decisionScore: number,
  consistency: number
): readonly ConfidenceAxisScore[] {
  return [
    {
      axisId: "problem",
      label: AXIS_LABELS.problem,
      score: clampScore((sectionScore + evidenceScore) / 2),
      rationale: state.currentSpec.draftRef ? "Problem section and evidence are present." : "Problem section is not drafted yet."
    },
    {
      axisId: "customer",
      label: AXIS_LABELS.customer,
      score: clampScore((sectionScore + questionScore) / 2),
      rationale: questionScore >= 75 ? "Customer ambiguity debt is mostly closed." : "Customer ambiguity questions remain."
    },
    {
      axisId: "value",
      label: AXIS_LABELS.value,
      score: clampScore((evidenceScore + decisionScore) / 2),
      rationale: evidenceScore >= 70 ? "Value claims have supporting evidence." : "Value claims need stronger counter-evidence."
    },
    {
      axisId: "validation",
      label: AXIS_LABELS.validation,
      score: clampScore((evidenceScore + questionScore) / 2),
      rationale: state.researchState.nextValidationActions.length
        ? "Next validation actions are retained."
        : "Validation actions are not explicit yet."
    },
    {
      axisId: "implementation",
      label: AXIS_LABELS.implementation,
      score: clampScore((decisionScore + consistency) / 2),
      rationale: consistency >= 75 ? "No blocking runtime or conflict incident is hidden." : "Blocking risks remain."
    }
  ];
}

function gateStatuses(
  state: ProductEngineStateSnapshot,
  compositeScore: number,
  axes: readonly ConfidenceAxisScore[],
  decisionScore: number
): readonly CompletionGateStatus[] {
  const readyAxisCount = axes.filter((axis) => axis.score >= CONFIDENCE_AXIS_READY_THRESHOLD).length;
  const confidenceAxesPassed = readyAxisCount >= Math.min(MIN_READY_CONFIDENCE_AXIS_COUNT, axes.length);
  const unresolvedOpenQuestions = state.openIssues.filter((issue) => issue.status === "open").length;
  const blockingEvidence = state.researchState.evidenceMatrices.filter((matrix) =>
    evidenceMatrixBlocksCompletion(state, matrix)
  ).length;
  const blockingResearchCards = state.researchState.reviewCards.filter(researchCardBlocksCompletion).length;
  const blockingIncidents =
    state.runtimeState.runtimeArtifacts.filter((artifact) => artifact.status === "blocked").length +
    state.runtimeState.effects.filter((effect) => effect.status === "failed" || effect.status === "blocked").length;
  const criticGate = businessCriticPressureGate(state);
  const implementationCloseoutBlockingReason = implementationLedgerBlocksCompletion(state)
    ? implementationLedgerBlockingReason(state)
    : null;

  return [
    ...(criticGate ? [criticGate] : []),
    {
      gateId: "score_threshold",
      label: "Composite score is 85 or higher",
      passed: compositeScore >= 85,
      ...(compositeScore >= 85 ? {} : { blockingReason: `Composite score is ${compositeScore}.` })
    },
    {
      gateId: "confidence_axes",
      label: `Most confidence axes are ${CONFIDENCE_AXIS_READY_THRESHOLD} or higher`,
      passed: confidenceAxesPassed,
      ...(confidenceAxesPassed
        ? {}
        : {
            blockingReason: `${readyAxisCount}/${axes.length} confidence axes are ${CONFIDENCE_AXIS_READY_THRESHOLD} or higher; below threshold: ${axes
              .filter((axis) => axis.score < CONFIDENCE_AXIS_READY_THRESHOLD)
              .map((axis) => `${axis.label} ${axis.score}`)
              .join(", ")}`
          })
    },
    {
      gateId: "question_debt",
      label: "No high-risk open questions remain",
      passed: unresolvedOpenQuestions === 0,
      ...(unresolvedOpenQuestions === 0 ? {} : { blockingReason: `${unresolvedOpenQuestions} open question(s) remain.` })
    },
    {
      gateId: "evidence_balance",
      label: "No high-impact claim is missing con evidence",
      passed: blockingEvidence === 0,
      ...(blockingEvidence === 0 ? {} : { blockingReason: `${blockingEvidence} evidence matrix/matrices block decisions.` })
    },
    {
      gateId: "research_queue_cards",
      label: "No high-impact Research-updated Queue cards remain unresolved",
      passed: blockingResearchCards === 0,
      ...(blockingResearchCards === 0
        ? {}
        : { blockingReason: `${blockingResearchCards} high-impact research-updated queue card(s) block Planning-ready.` })
    },
    {
      gateId: "required_decisions",
      label: "Required decisions are approved or explicitly carried as known risks",
      passed: decisionScore >= 100,
      ...(decisionScore >= 100
        ? {}
        : { blockingReason: "Required decisions are not closed enough for completion." })
    },
    {
      gateId: "blocking_incidents",
      label: "No unresolved blocking runtime or operation incident is hidden",
      passed: blockingIncidents === 0,
      ...(blockingIncidents === 0 ? {} : { blockingReason: `${blockingIncidents} blocking incident(s) remain.` })
    },
    {
      gateId: "implementation_closeout",
      label: "No started implementation step ledger is blocked or incomplete",
      passed: implementationCloseoutBlockingReason === null,
      ...(implementationCloseoutBlockingReason === null
        ? {}
        : { blockingReason: implementationCloseoutBlockingReason })
    }
  ];
}

function ifStopNowArtifact(
  title: string,
  knownRisks: readonly string[],
  nextValidationActions: readonly string[]
): IfStopNowArtifactProjection {
  return {
    title,
    summary: knownRisks.length
      ? "The plan can be reviewed now only with these explicit risks carried forward."
      : "The current spec can be reviewed as a founder brief draft.",
    knownRisks,
    nextValidationActions
  };
}

export function buildConfidenceCompletionProjection(
  state: ProductEngineStateSnapshot,
  version: ProjectionVersion
): ConfidenceCompletionProjection {
  if (!state.project.projectPurposeMode) {
    return {
      kind: "ConfidenceCompletionProjection",
      sessionId: state.session.sessionId,
      version,
      projectPurposeModeSelectionStatus: "mode_required",
      projectPurposeModeLabel: PROJECT_PURPOSE_MODE_REQUIRED_LABEL,
      projectPurposeModeEffect: PROJECT_PURPOSE_MODE_REQUIRED_EFFECT,
      skippedCommercializationAxes: [],
      businessCriticIntensitySelectionStatus: "not_applicable",
      compositeScore: 0,
      readinessLabel: "draft",
      axes: [],
      scoreBreakdown: {
        sectionCompleteness: 0,
        questionDebtResolution: 0,
        evidenceQuality: 0,
        decisionApproval: 0,
        consistencyAndConflict: 0
      },
      gates: [
        {
          gateId: "project_purpose_mode",
          label: PROJECT_PURPOSE_MODE_REQUIRED_LABEL,
          passed: false,
          blockingReason: "사용자가 business 또는 personal project purpose mode를 명시 선택해야 합니다."
        }
      ],
      topRisks: [PROJECT_PURPOSE_MODE_REQUIRED_LABEL],
      topRiskCards: [
        {
          riskId: "risk_project_purpose_mode_required",
          title: PROJECT_PURPOSE_MODE_REQUIRED_LABEL,
          severity: "high",
          sourceRefs: [state.session.sessionId],
          nextValidationAction: "사용자가 사업화 검증 중심 또는 개인 workflow 구현 중심을 선택합니다."
        }
      ],
      nextBestActions: ["Select the project purpose mode before scoring mode-specific completion gates."],
      completionCandidate: {
        status: "not_ready",
        summary: "Completion is blocked until the user confirms the project purpose mode.",
        gateFailures: ["사용자가 business 또는 personal project purpose mode를 명시 선택해야 합니다."],
        ifStopNowArtifact: {
          title: "If stop now",
          summary: "No founder brief can be prepared before project purpose mode selection.",
          knownRisks: [PROJECT_PURPOSE_MODE_REQUIRED_LABEL],
          nextValidationActions: ["사용자가 사업화 검증 중심 또는 개인 workflow 구현 중심을 선택합니다."]
        }
      }
    };
  }

  const scoreBreakdown = {
    sectionCompleteness: sectionCompletenessScore(state),
    questionDebtResolution: questionDebtScore(state),
    evidenceQuality: evidenceQualityScore(state),
    decisionApproval: decisionApprovalScore(state),
    consistencyAndConflict: consistencyScore(state)
  };
  const compositeScore = clampScore(
    scoreBreakdown.sectionCompleteness * 0.25 +
      scoreBreakdown.questionDebtResolution * 0.2 +
      scoreBreakdown.evidenceQuality * 0.2 +
      scoreBreakdown.decisionApproval * 0.2 +
      scoreBreakdown.consistencyAndConflict * 0.15
  );
  const axes = axesFromScores(
    state,
    scoreBreakdown.sectionCompleteness,
    scoreBreakdown.questionDebtResolution,
    scoreBreakdown.evidenceQuality,
    scoreBreakdown.decisionApproval,
    scoreBreakdown.consistencyAndConflict
  );
  const provisionalActions = nextBestActions(state, []);
  const allRiskCards = riskCards(state, provisionalActions);
  const topRiskCards = allRiskCards.slice(0, 3);
  const nextActions = nextBestActions(state, topRiskCards);
  const gates = gateStatuses(state, compositeScore, axes, scoreBreakdown.decisionApproval);
  const gateFailures = gates.flatMap((gate) => (gate.passed ? [] : [gate.blockingReason ?? gate.label]));
  const topRisks = uniqueStrings([
    ...state.researchState.knownRisks,
    ...allRiskCards.map((card) => card.title),
    ...acceptedRiskDecisionRisks(state)
  ]);
  const candidateArtifact = ifStopNowArtifact(
    state.currentSpec.title ?? "If stop now founder brief",
    topRisks,
    nextActions
  );
  const gatesPassed = gates.every((gate) => gate.passed);
  const purposeModeDetails = PROJECT_PURPOSE_MODE_DETAILS[state.project.projectPurposeMode];
  const businessCriticIntensity = state.project.businessCriticIntensity;

  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: state.session.sessionId,
    version,
    projectPurposeMode: state.project.projectPurposeMode,
    projectPurposeModeSelectionStatus: "confirmed",
    projectPurposeModeLabel: purposeModeDetails.label,
    projectPurposeModeEffect: purposeModeDetails.effect,
    skippedCommercializationAxes: purposeModeDetails.skippedCommercializationAxes,
    businessCriticIntensitySelectionStatus:
      state.project.projectPurposeMode === "business"
        ? businessCriticIntensity
          ? "confirmed"
          : "intensity_required"
        : "not_applicable",
    ...(businessCriticIntensity
      ? {
          businessCriticIntensity,
          businessCriticIntensityLabel: businessCriticIntensityLabel(businessCriticIntensity),
          businessCriticIntensityEffect: businessCriticIntensityEffect(businessCriticIntensity)
        }
      : state.project.projectPurposeMode === "business"
        ? {
            businessCriticIntensityLabel: BUSINESS_CRITIC_INTENSITY_REQUIRED_LABEL,
            businessCriticIntensityEffect: BUSINESS_CRITIC_INTENSITY_REQUIRED_EFFECT
          }
        : {}),
    compositeScore,
    readinessLabel: readinessLabel(compositeScore, gatesPassed),
    axes,
    scoreBreakdown,
    gates,
    topRisks,
    topRiskCards,
    nextBestActions: nextActions,
    completionCandidate: {
      status: gatesPassed ? "candidate" : "not_ready",
      summary: gatesPassed
        ? "Completion candidate is ready with explicit risk carry-forward."
        : "Completion is blocked until the listed gates are closed or carried forward.",
      gateFailures,
      ifStopNowArtifact: candidateArtifact
    }
  };
}

export function buildFounderBriefProjection(
  state: ProductEngineStateSnapshot,
  completeness: ConfidenceCompletionProjection,
  version: ProjectionVersion,
  preparedAt: string
): FounderBriefProjection {
  const projectPurposeMode = state.project.projectPurposeMode;

  if (!projectPurposeMode) {
    throw new Error("buildFounderBriefProjection requires a user-confirmed projectPurposeMode.");
  }

  const purposeModeDetails = PROJECT_PURPOSE_MODE_DETAILS[projectPurposeMode];
  const projectPurposeModeNarrative = `${purposeModeDetails.label}: ${purposeModeDetails.effect}`;
  const problemCustomerValue = [
    state.currentSpec.title ?? state.project.rawIdeaText ?? "Untitled product idea",
    ...(state.currentSpec.sections ?? [])
  ].join(" / ");
  const topDecisions = state.decisions
    .filter((decision) => decision.status === "approved")
    .map((decision) => `Approved ${decision.requiredDecisionRef} decision: ${decision.decisionId}`);
  const inferredDecisions = state.researchState.evidenceMatrices
    .filter((matrix) => matrix.balanceStatus === "balanced")
    .map((matrix) => `Evidence-backed decision signal: ${matrix.researchTaskId}`);
  const implementationProgressReport =
    state.implementationStepLedger?.progressReport ?? "No implementation step ledger has been recorded yet.";
  const implementationLedgerRisks = state.implementationStepLedger
    ? [
        ...state.implementationStepLedger.blockedSteps.map((blocker) =>
          `Implementation step blocked: ${blocker.stepId} — ${blocker.reason} Missing: ${blocker.missingEvidence.join(", ")}`
        ),
        ...state.implementationStepLedger.testEvidenceRecords.flatMap((record) =>
          record.outcome !== "passed" || record.failedTestCount > 0 || record.notTestedGaps.length > 0
            ? [`Implementation tests not clean for ${record.stepId}: ${record.outcome}; failed=${record.failedTestCount}; Not-tested=${record.notTestedGaps.join(", ") || "none"}`]
            : []
        ),
        ...(state.implementationStepLedger.missingTestAuditRecords ?? []).flatMap((record) =>
          record.missingTestGaps.length > 0
            ? [`Implementation missing-test audit gaps for ${record.stepId}: ${record.missingTestGaps.join(", ")}`]
            : []
        )
      ]
    : [];
  const implementationNextActions = state.implementationStepLedger?.blockedSteps.map((blocker) =>
    `Implementation step ${blocker.stepId}: ${blocker.nextRequiredAction}`
  ) ?? [];
  const knownRisks = uniqueStrings([
    ...completeness.topRisks,
    ...acceptedRiskDecisionRisks(state),
    ...implementationLedgerRisks
  ]);
  const nextValidationActions = uniqueStrings([
    ...completeness.nextBestActions,
    ...state.researchState.nextValidationActions,
    ...implementationNextActions
  ]);
  const decisions = uniqueStrings([...topDecisions, ...inferredDecisions]).slice(0, 6);
  const briefSections = [
    {
      sectionId: "project_purpose_mode" as const,
      title: "Project purpose mode",
      body: projectPurposeModeNarrative
    },
    {
      sectionId: "problem_customer_value" as const,
      title: "Problem-Customer-Value",
      body: problemCustomerValue
    },
    {
      sectionId: "top_decisions" as const,
      title: "Top decisions",
      body: decisions.length ? decisions.join("\n") : "No approved or evidence-backed decisions are closed yet."
    },
    {
      sectionId: "implementation_progress" as const,
      title: "Implementation progress",
      body: implementationProgressReport
    },
    {
      sectionId: "known_risks" as const,
      title: "Known risks",
      body: knownRisks.length ? knownRisks.join("\n") : "No unresolved known risks are currently projected."
    },
    {
      sectionId: "next_validation_actions" as const,
      title: "Next validation actions",
      body: nextValidationActions.length
        ? nextValidationActions.join("\n")
        : "Define the next validation action before treating this brief as execution-ready."
    }
  ];

  return {
    kind: "FounderBriefProjection",
    sessionId: state.session.sessionId,
    version,
    projectPurposeMode,
    projectPurposeModeLabel: purposeModeDetails.label,
    projectPurposeModeNarrative,
    skippedCommercializationAxes: purposeModeDetails.skippedCommercializationAxes,
    exportReady: completeness.completionCandidate.status === "candidate",
    problemCustomerValue,
    topDecisions: decisions,
    knownRisks,
    nextValidationActions,
    briefSections,
    ifStopNowArtifact: completeness.completionCandidate.ifStopNowArtifact,
    exportMetadata: {
      format: "markdown",
      filename: `solo-superman-founder-brief-${state.session.sessionId}.md`,
      preparedAt,
      writePolicy: "metadata_only_no_file_write",
      blockedSideEffects: ["file_write", "external_export"]
    }
  };
}
