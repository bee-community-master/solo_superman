import type {
  CompletionGateStatus,
  ConfidenceAxisScore,
  ConfidenceCompletionProjection,
  FounderBriefProjection,
  IfStopNowArtifactProjection,
  ProductEngineStateSnapshot,
  ProjectionVersion,
  RequiredDecisionRef,
  ReadinessLabel,
  TopRiskCardProjection
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

const REQUIRED_DECISION_REFS: readonly RequiredDecisionRef[] = [
  "primary_customer",
  "problem",
  "value",
  "mvp_scope",
  "validation_plan",
  "success_criteria"
] as const;

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
  const sections = state.currentSpec.sections ?? [];
  const normalizedSections = sections.map((section) => section.toLowerCase());
  const matched = REQUIRED_SECTION_KEYWORDS.filter((keywords) =>
    normalizedSections.some((section) => keywords.every((keyword) => section.includes(keyword)))
  ).length;

  return clampScore((matched / REQUIRED_SECTION_KEYWORDS.length) * 100);
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

function evidenceRiskTitle(matrix: ProductEngineStateSnapshot["researchState"]["evidenceMatrices"][number]) {
  return (
    matrix.knownRisk ??
    matrix.missingConEvidenceReason ??
    `Evidence balance is ${matrix.balanceStatus} for ${matrix.researchTaskId}.`
  );
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
  const blockingMatrices = state.researchState.evidenceMatrices.filter((matrix) => matrix.decisionBlocked).length;
  const blockedRuntime = state.runtimeState.runtimeArtifacts.filter((artifact) => artifact.status === "blocked").length;
  const failedEffects = state.runtimeState.effects.filter((effect) => effect.status === "failed" || effect.status === "blocked").length;

  return clampScore(100 - Math.min(100, blockingMatrices * 25 + blockedRuntime * 20 + failedEffects * 20));
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
  const openQuestionRisks = state.openIssues
    .filter((issue) => issue.status === "open")
    .map((issue, index) => ({
      riskId: `risk_question_${index + 1}`,
      title: `Open question remains: ${issue.summary}`,
      severity: "high" as const,
      sourceRefs: [issue.queueItemId],
      nextValidationAction: issue.questionText ?? `Resolve ${issue.summary}.`
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

  return [...matrixRisks, ...openQuestionRisks, ...runtimeRisks].sort(
    (left, right) => RISK_SEVERITY_RANK[left.severity] - RISK_SEVERITY_RANK[right.severity]
  );
}

function acceptedRiskDecisionRisks(state: ProductEngineStateSnapshot) {
  return state.decisions
    .filter((decision) => decision.status === "risk_accepted")
    .map((decision) => `Accepted risk carried forward for ${decision.requiredDecisionRef}: ${decision.decisionId}`);
}

function nextBestActions(state: ProductEngineStateSnapshot, cards: readonly TopRiskCardProjection[]) {
  return uniqueStrings([
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
  const unresolvedOpenQuestions = state.openIssues.filter((issue) => issue.status === "open").length;
  const blockingEvidence = state.researchState.evidenceMatrices.filter(evidenceGateBlocksCompletion).length;
  const blockingIncidents =
    state.runtimeState.runtimeArtifacts.filter((artifact) => artifact.status === "blocked").length +
    state.runtimeState.effects.filter((effect) => effect.status === "failed" || effect.status === "blocked").length;

  return [
    {
      gateId: "score_threshold",
      label: "Composite score is 85 or higher",
      passed: compositeScore >= 85,
      ...(compositeScore >= 85 ? {} : { blockingReason: `Composite score is ${compositeScore}.` })
    },
    {
      gateId: "confidence_axes",
      label: "All confidence axes are 75 or higher",
      passed: axes.every((axis) => axis.score >= 75),
      ...(axes.every((axis) => axis.score >= 75)
        ? {}
        : {
            blockingReason: axes
              .filter((axis) => axis.score < 75)
              .map((axis) => `${axis.label} ${axis.score}`)
              .join(", ")
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

  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: state.session.sessionId,
    version,
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
  const knownRisks = uniqueStrings([...completeness.topRisks, ...acceptedRiskDecisionRisks(state)]);
  const nextValidationActions = uniqueStrings([
    ...completeness.nextBestActions,
    ...state.researchState.nextValidationActions
  ]);
  const decisions = uniqueStrings([...topDecisions, ...inferredDecisions]).slice(0, 6);
  const briefSections = [
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
