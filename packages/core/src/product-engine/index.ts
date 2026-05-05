import {
  CONTRACT_SCHEMA_VERSION,
  BLOCKED_ACTION_TYPES,
  CODEX_APPLY_POLICY_BY_TURN_PURPOSE,
  CODEX_APPLY_POLICIES,
  CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE,
  CODEX_ARTIFACT_KINDS,
  CODEX_RUNTIME_ADAPTER_VERSION,
  CODEX_TURN_PURPOSES,
  type ActiveBatchSafeProjection,
  type AmbiguityIssueSnapshot,
  type BlockedActionType,
  type CodexApplyPolicy,
  type CodexArtifactKind,
  type CodexRuntimeSource,
  type CodexTurnPurpose,
  type ConfidenceCompletionProjection,
  type DecisionId,
  type QueueItemProjection,
  type DecisionQueueProjection,
  type EvidenceMatrixProjection,
  type FounderBriefProjection,
  type LivingSpecProjection,
  type ProductEngineCommand,
  type ProductEngineEffectPlanItem,
  type ProductEngineEvent,
  type ProductEngineEventDraft,
  type ProductEngineReduction,
  type ProductEngineRejectionCode,
  type ProductEngineStateSnapshot,
  type ProjectId,
  type ProjectionVersion,
  type QueueItemId,
  type EffectTaskId,
  type RequiredDecisionRef,
  type ResearchImpact,
  type ResearchEvidenceProjection,
  type ResearchResultId,
  type ResearchRouteOutcome,
  type ResearchTaskId,
  type ResearchTaskProjection,
  type RuntimeActivityProjection,
  type RuntimeArtifactId,
  type RuntimePreviewArtifact,
  type SessionShellProjection,
  type SessionId,
  type SpecVersionId,
  type SpecUpdatePreviewSnapshot,
  type StateVersion
} from "@solo-superman/contracts";
import {
  buildConfidenceCompletionProjection,
  buildFounderBriefProjection
} from "../completeness";
import {
  addImportedResearchResultToProjection,
  addResearchResultToProjection,
  addResearchTaskToProjection,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  synthesizeEvidenceMatrix
} from "../research-engine";

export const PACKAGE_SLICE_STATUS = "product-engine-e2e-dry-run-pr-09" as const;

type PrivacyMode = "local_only" | "local_with_manual_export";

const EMPTY_RESEARCH_PROJECTION: ResearchEvidenceProjection = emptyResearchEvidenceProjection();

const EMPTY_RUNTIME_PROJECTION: RuntimeActivityProjection = {
  kind: "RuntimeActivityProjection",
  version: 0 as ProjectionVersion,
  effects: [],
  runtimeArtifacts: [],
  runtimeStatus: "scaffold_placeholder"
};

function emptyConfidenceCompletionProjection(
  sessionIdValue: SessionId,
  version: ProjectionVersion = 0 as ProjectionVersion
): ConfidenceCompletionProjection {
  return {
    kind: "ConfidenceCompletionProjection",
    sessionId: sessionIdValue,
    version,
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
    gates: [],
    topRisks: [],
    topRiskCards: [],
    nextBestActions: ["Capture intake and draft the initial spec."],
    completionCandidate: {
      status: "not_ready",
      summary: "Completeness has not been scored yet.",
      gateFailures: ["Completeness has not been scored yet."],
      ifStopNowArtifact: {
        title: "If stop now",
        summary: "No founder brief can be prepared before intake and scoring.",
        knownRisks: [],
        nextValidationActions: ["Capture intake and draft the initial spec."]
      }
    }
  };
}

function isRequiredDecisionRef(value: unknown): value is RequiredDecisionRef {
  return (
    value === "primary_customer" ||
    value === "problem" ||
    value === "value" ||
    value === "mvp_scope" ||
    value === "validation_plan" ||
    value === "success_criteria"
  );
}

function reject(
  message: string,
  code: ProductEngineRejectionCode = "COMMAND_PRECONDITION_FAILED",
  details?: Readonly<Record<string, unknown>>
): ProductEngineReduction {
  return {
    accepted: false,
    rejectionReason: {
      code,
      message,
      ...(details ? { details } : {})
    },
    events: [],
    nextState: {},
    effectPlan: [],
    deterministicOutputs: []
  };
}

function isPrivacyMode(value: unknown): value is PrivacyMode {
  return value === "local_only" || value === "local_with_manual_export";
}

function isDecisionResolutionStatus(value: unknown): value is Exclude<
  ProductEngineStateSnapshot["decisions"][number]["status"],
  "active"
> {
  return value === "approved" || value === "rejected" || value === "deferred" || value === "risk_accepted";
}

function mergeDecision(
  decisions: ProductEngineStateSnapshot["decisions"],
  decision: ProductEngineStateSnapshot["decisions"][number]
) {
  return [...decisions.filter((candidate) => candidate.decisionId !== decision.decisionId), decision];
}

function mergeSpecUpdatePreview(
  previews: readonly SpecUpdatePreviewSnapshot[],
  preview: SpecUpdatePreviewSnapshot
) {
  return [...previews.filter((candidate) => candidate.previewRef !== preview.previewRef), preview];
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalPayloadSections(value: unknown) {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return "invalid";
  }

  const sections = value.map((section) => (typeof section === "string" ? section.trim() : ""));

  return sections.every(Boolean) ? (sections as readonly string[]) : "invalid";
}

function stringArraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function queueItemIdSelection(value: unknown): readonly QueueItemId[] | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    return "invalid";
  }

  const queueItemIds: QueueItemId[] = [];

  for (const item of value) {
    const queueItemId = requiredString(item);

    if (!queueItemId) {
      return "invalid";
    }

    queueItemIds.push(queueItemId as QueueItemId);
  }

  const uniqueQueueItemIds = new Set(queueItemIds);

  if (uniqueQueueItemIds.size !== queueItemIds.length) {
    return "invalid";
  }

  return queueItemIds as readonly QueueItemId[];
}

function numericVersion(version: StateVersion) {
  return Number(version);
}

function nextVersion(state: ProductEngineStateSnapshot) {
  return (numericVersion(state.stateVersion) + 1) as StateVersion;
}

function projectionVersionFor(state: ProductEngineStateSnapshot) {
  return Number(nextVersion(state)) as ProjectionVersion;
}

function eventDraft(
  command: ProductEngineCommand,
  eventType: ProductEngineEventDraft["eventType"],
  payload: ProductEngineEventDraft["payload"]
): ProductEngineEventDraft {
  return {
    eventType,
    projectId: command.projectId,
    sessionId: command.sessionId,
    sourceCommandId: command.commandId,
    correlationId: command.correlationId,
    causationId: command.causationId,
    schemaVersion: command.schemaVersion,
    payload
  };
}

function stableToken(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function emptyQueueProjection(version: ProjectionVersion = 0 as ProjectionVersion): DecisionQueueProjection {
  return {
    kind: "DecisionQueueProjection",
    version,
    active: [],
    next: [],
    blocked: [],
    deferred: []
  };
}

export function createInitialProductEngineState(projectId: ProjectId, sessionId: SessionId): ProductEngineStateSnapshot {
  return {
    stateVersion: 0 as StateVersion,
    project: {
      projectId,
      privacyMode: "local_only"
    },
    session: {
      sessionId,
      phase: "intake"
    },
    currentSpec: {
      draftRef: ""
    },
    openIssues: [],
    queueProjection: emptyQueueProjection(),
    researchState: EMPTY_RESEARCH_PROJECTION,
    decisions: [],
    specUpdatePreviews: [],
    runtimeState: EMPTY_RUNTIME_PROJECTION,
    completeness: emptyConfidenceCompletionProjection(sessionId)
  };
}

function createSessionShellProjection(command: ProductEngineCommand, version: ProjectionVersion) {
  return {
    kind: "SessionShellProjection",
    projectId: command.projectId,
    sessionId: command.sessionId,
    version,
    phase: "intake"
  } as const;
}

function createLivingSpecProjection(
  command: ProductEngineCommand,
  version: ProjectionVersion,
  title: string,
  sections: readonly string[],
  approvalStatus: LivingSpecProjection["approvalStatus"] = "draft"
) {
  return {
    kind: "LivingSpecProjection",
    sessionId: command.sessionId,
    version,
    title,
    sections,
    sectionCount: sections.length,
    approvalStatus
  } as const;
}

function createAmbiguityIssues(sessionId: SessionId, specRef: string): readonly AmbiguityIssueSnapshot[] {
  const token = stableToken(`${sessionId}:${specRef}`);
  const issueSeeds = [
    {
      key: "customer-problem",
      summary: "핵심 고객 문제와 즉시성",
      question: "가장 먼저 검증해야 할 고객 문제는 무엇인가?"
    },
    {
      key: "cost-of-delay",
      summary: "문제를 방치했을 때의 비용",
      question: "이 문제를 지금 해결하지 못하면 어떤 비용이 생기는가?"
    },
    {
      key: "alternative-gap",
      summary: "대체재 대비 차별화 기준",
      question: "대체재와 비교했을 때 반드시 달라야 하는 지점은 무엇인가?"
    },
    {
      key: "first-decision",
      summary: "세션 종료 시 내려야 할 첫 결정",
      question: "2~5시간 세션이 끝났을 때 창업자가 내려야 할 첫 결정은 무엇인가?"
    }
  ] as const;

  return issueSeeds.map((seed, index) => ({
    queueItemId: `queue_${token}_${index + 1}` as QueueItemId,
    summary: seed.summary,
    status: "open",
    questionText: seed.question,
    sourceRef: seed.key
  }));
}

function queueProjectionFromIssues(
  issues: readonly AmbiguityIssueSnapshot[],
  version: ProjectionVersion
): DecisionQueueProjection {
  return {
    kind: "DecisionQueueProjection",
    version,
    active: issues.map((issue) => ({
      queueItemId: issue.queueItemId,
      title: issue.questionText ?? issue.summary,
      state: "active"
    })),
    next: [],
    blocked: [],
    deferred: []
  };
}

function queueProjectionWithAnsweredItem(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId,
  version: ProjectionVersion
): DecisionQueueProjection {
  const markAnswered = (items: DecisionQueueProjection["active"]) =>
    items.map((item) =>
      item.queueItemId === queueItemId
        ? {
            ...item,
            state: "answered" as const
          }
        : item
    );

  return {
    ...projection,
    version,
    active: markAnswered(projection.active),
    next: markAnswered(projection.next),
    blocked: markAnswered(projection.blocked),
    deferred: markAnswered(projection.deferred)
  };
}

function queueProjectionWithoutItem(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId,
  version: ProjectionVersion
): DecisionQueueProjection {
  const withoutItem = (items: readonly QueueItemProjection[]) =>
    items.filter((candidate) => candidate.queueItemId !== queueItemId);

  return {
    ...projection,
    version,
    active: withoutItem(projection.active),
    next: withoutItem(projection.next),
    blocked: withoutItem(projection.blocked),
    deferred: withoutItem(projection.deferred)
  };
}

function queueProjectionWithNextOrBlockedItem(
  projection: DecisionQueueProjection,
  item: QueueItemProjection & { readonly state: "next" | "blocked" },
  version: ProjectionVersion
): DecisionQueueProjection {
  const withoutItem = queueProjectionWithoutItem(projection, item.queueItemId, version);

  return {
    ...withoutItem,
    next: item.state === "next" ? [...withoutItem.next, item] : withoutItem.next,
    blocked: item.state === "blocked" ? [...withoutItem.blocked, item] : withoutItem.blocked
  };
}

function queueProjectionWithDeferredItem(
  projection: DecisionQueueProjection,
  item: QueueItemProjection & { readonly state: "deferred" },
  version: ProjectionVersion
): DecisionQueueProjection {
  const withoutItem = queueProjectionWithoutItem(projection, item.queueItemId, version);

  return {
    ...withoutItem,
    deferred: [...withoutItem.deferred, item]
  };
}

function queueItemFromProjection(
  projection: DecisionQueueProjection,
  queueItemId: QueueItemId
): QueueItemProjection | null {
  return (
    [
      ...projection.active,
      ...projection.next,
      ...projection.blocked,
      ...projection.deferred
    ].find((item) => item.queueItemId === queueItemId) ?? null
  );
}

function issuesWithQueueItemStatus(
  issues: readonly AmbiguityIssueSnapshot[],
  queueItemId: QueueItemId,
  status: AmbiguityIssueSnapshot["status"]
): readonly AmbiguityIssueSnapshot[] {
  return issues.map((issue) =>
    issue.queueItemId === queueItemId
      ? {
          ...issue,
          status
        }
      : issue
  );
}

function queueProjectionEffect(
  command: ProductEngineCommand,
  sourceEventType: ProductEngineEventDraft["eventType"],
  inputRef: ProductEngineEffectPlanItem["inputRef"],
  priority: ProductEngineEffectPlanItem["priority"]
): ProductEngineEffectPlanItem {
  return {
    effectType: "queue_projection_effect",
    idempotencyKey: `${command.commandId}:${sourceEventType}:decision_queue`,
    sourceCommandId: command.commandId,
    sourceEventTypes: [sourceEventType],
    correlationId: command.correlationId,
    priority,
    inputRef,
    previewPolicy: "auto_low_risk"
  };
}

function researchEvidenceEffect(
  command: ProductEngineCommand,
  sourceEventTypes: readonly ProductEngineEventDraft["eventType"][],
  inputRef: ProductEngineEffectPlanItem["inputRef"],
  priority: ProductEngineEffectPlanItem["priority"],
  idempotencyKey: string,
  runAfter?: string
): ProductEngineEffectPlanItem {
  return {
    effectType: "research_evidence_effect",
    idempotencyKey,
    sourceCommandId: command.commandId,
    sourceEventTypes,
    correlationId: command.correlationId,
    priority,
    inputRef,
    previewPolicy: "manual_handoff_required",
    ...(runAfter ? { runAfter } : {})
  };
}

function codexRuntimePreviewEffect(
  command: ProductEngineCommand,
  turnPurpose: CodexTurnPurpose,
  contextHash: string
): ProductEngineEffectPlanItem {
  return {
    effectType: "codex_runtime_preview_effect",
    idempotencyKey: `codex:${command.sessionId}:${turnPurpose}:${contextHash}:${CODEX_RUNTIME_ADAPTER_VERSION}`,
    sourceCommandId: command.commandId,
    sourceEventTypes: ["RuntimePreviewRequested"],
    correlationId: command.correlationId,
    priority: "normal",
    inputRef: {
      refType: "RuntimePreviewRequest",
      refId: `${turnPurpose}:${contextHash}`
    },
    previewPolicy: "manual_handoff_required"
  };
}

function isCodexTurnPurpose(value: unknown): value is CodexTurnPurpose {
  return typeof value === "string" && CODEX_TURN_PURPOSES.includes(value as CodexTurnPurpose);
}

function isCodexArtifactKind(value: unknown): value is CodexArtifactKind {
  return typeof value === "string" && CODEX_ARTIFACT_KINDS.includes(value as CodexArtifactKind);
}

function isCodexApplyPolicy(value: unknown): value is CodexApplyPolicy {
  return typeof value === "string" && CODEX_APPLY_POLICIES.includes(value as CodexApplyPolicy);
}

function isBlockedActionType(value: unknown): value is BlockedActionType {
  return typeof value === "string" && BLOCKED_ACTION_TYPES.includes(value as BlockedActionType);
}

function optionalStringArray(value: unknown): readonly string[] | "invalid" {
  if (!Array.isArray(value) || value.length === 0) {
    return "invalid";
  }

  const strings = value.map((item) => (typeof item === "string" ? item.trim() : ""));

  return strings.every(Boolean) ? strings : "invalid";
}

function runtimeArtifactIdFor(
  sessionIdValue: SessionId,
  turnPurpose: CodexTurnPurpose,
  contextHash: string,
  runtimeAdapterVersion: string
): RuntimeArtifactId {
  return `runtime_artifact_${stableToken(
    `${sessionIdValue}:${turnPurpose}:${contextHash}:${runtimeAdapterVersion}`
  )}` as RuntimeArtifactId;
}

function isRuntimeArtifactBlocked(artifact: RuntimePreviewArtifact) {
  return Boolean(artifact.blockedAction) || artifact.status === "blocked" || artifact.applyPolicy === "blocked";
}

function runtimePreviewQueueItem(artifact: RuntimePreviewArtifact) {
  const isBlocked = isRuntimeArtifactBlocked(artifact);

  return {
    queueItemId: `runtime_preview_${artifact.artifactId}` as QueueItemId,
    title: isBlocked ? `Runtime blocked: ${artifact.summary}` : `Runtime preview: ${artifact.summary}`,
    state: isBlocked ? ("blocked" as const) : ("next" as const)
  };
}

function queueProjectionWithRuntimePreviewItem(
  projection: DecisionQueueProjection,
  artifact: RuntimePreviewArtifact,
  version: ProjectionVersion
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, runtimePreviewQueueItem(artifact), version);
}

function completionCandidateQueueItem(projection: ConfidenceCompletionProjection) {
  const isCandidate = projection.completionCandidate.status === "candidate";

  return {
    queueItemId: `completion_candidate_${projection.sessionId}` as QueueItemId,
    title: isCandidate
      ? `Completion candidate: Founder Brief ready (${projection.compositeScore})`
      : `Completion blocked: ${projection.completionCandidate.gateFailures[0] ?? "Gate failure"}`,
    state: isCandidate ? ("next" as const) : ("blocked" as const)
  };
}

function queueProjectionWithCompletionCandidate(
  projection: DecisionQueueProjection,
  confidenceProjection: ConfidenceCompletionProjection,
  version: ProjectionVersion
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, completionCandidateQueueItem(confidenceProjection), version);
}

function decisionIdForSpecUpdatePreview(previewRef: string): DecisionId {
  const stablePreviewToken = previewRef.replace(/^spec_update_/, "");

  return `decision_${stablePreviewToken}` as DecisionId;
}

function decisionQueueItemId(decisionId: DecisionId): QueueItemId {
  return `decision_card_${decisionId}` as QueueItemId;
}

function specUpdateDecisionQueueItem(decisionId: DecisionId, title: string) {
  return {
    queueItemId: decisionQueueItemId(decisionId),
    title,
    state: "next" as const
  };
}

function queueProjectionWithSpecUpdateDecision(
  projection: DecisionQueueProjection,
  decisionId: DecisionId,
  title: string,
  version: ProjectionVersion
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, specUpdateDecisionQueueItem(decisionId, title), version);
}

function completenessDeterministicOutputs(
  command: ProductEngineCommand,
  projection: ConfidenceCompletionProjection
): ProductEngineReduction["deterministicOutputs"] {
  return [
    {
      outputType: "completeness_snapshot",
      outputRef: `completeness:${command.sessionId}:${projection.version}`,
      payload: {
        compositeScore: projection.compositeScore,
        readinessLabel: projection.readinessLabel,
        gateFailures: projection.completionCandidate.gateFailures
      }
    },
    {
      outputType: "confidence_map",
      outputRef: `confidence:${command.sessionId}:${projection.version}`,
      payload: {
        axes: projection.axes
      }
    }
  ];
}

function runtimeProjectionWithArtifact(
  projection: RuntimeActivityProjection,
  artifact: RuntimePreviewArtifact,
  version: ProjectionVersion
): RuntimeActivityProjection {
  const artifacts = [
    ...projection.runtimeArtifacts.filter((candidate) => candidate.artifactId !== artifact.artifactId),
    artifact
  ];
  const hasBlocked = artifacts.some((candidate) => candidate.status === "blocked");
  const hasManualHandoff = artifacts.some((candidate) => candidate.status === "manual_handoff");

  return {
    ...projection,
    version,
    runtimeArtifacts: artifacts,
    runtimeStatus: hasBlocked ? "blocked" : hasManualHandoff ? "unavailable" : "available"
  };
}

function blockedArtifactFromConversion(
  command: ProductEngineCommand,
  artifact: RuntimePreviewArtifact
): RuntimePreviewArtifact {
  const blockReason =
    requiredString(command.payload.blockReason) ??
    artifact.blockedAction?.reason ??
    "Runtime artifact conversion was blocked by Phase 1 preview-only policy.";
  const blockedActionType = isBlockedActionType(command.payload.blockedActionType)
    ? command.payload.blockedActionType
    : artifact.blockedAction?.actionType;
  const payload = {
    ...artifact.payload,
    title: `Runtime artifact blocked: ${artifact.summary}`,
    body: blockReason,
    targetObject: "blocked_action",
    sourceRefs: artifact.sourceRefs,
    blockReason,
    originalArtifactId: artifact.artifactId
  };

  return {
    ...artifact,
    kind: "BlockedActionArtifact",
    applyPolicy: "blocked",
    status: "blocked",
    targetObject: "blocked_action",
    summary: `Runtime artifact blocked: ${artifact.summary}`,
    payload,
    ...(blockedActionType
      ? {
          blockedAction: {
            actionType: blockedActionType,
            reason: blockReason,
            ...(artifact.blockedAction?.suggestedSafeAlternative
              ? { suggestedSafeAlternative: artifact.blockedAction.suggestedSafeAlternative }
              : {})
          }
        }
      : {})
  };
}

function validResearchImpact(value: unknown): ResearchImpact {
  return value === "low" || value === "medium" || value === "high" ? value : "high";
}

function optionalPositiveInteger(value: unknown): number | null | "invalid" {
  if (value === undefined) {
    return null;
  }

  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : "invalid";
}

function routeOutcomeForAnswer(command: ProductEngineCommand): ResearchRouteOutcome {
  if (command.payload.researchRouteHint === "research_needed" || command.payload.researchRouteHint === "missing_con_evidence") {
    return command.payload.researchRouteHint;
  }

  if (command.payload.evidenceBalanceHint === "pro_only") {
    return "missing_con_evidence";
  }

  const answer = typeof command.payload.answer === "string" ? command.payload.answer.toLowerCase() : "";

  return answer.includes("pro-only") || answer.includes("찬성만") || answer.includes("반대근거")
    ? "missing_con_evidence"
    : "research_needed";
}

function researchReviewQueueItem(
  researchTaskId: ResearchTaskId,
  title: string,
  state: "next" | "blocked"
) {
  return {
    queueItemId: `research_review_${researchTaskId}` as QueueItemId,
    title,
    state
  };
}

function queueProjectionWithResearchReviewItem(
  projection: DecisionQueueProjection,
  researchTaskId: ResearchTaskId,
  title: string,
  state: "next" | "blocked",
  version: ProjectionVersion
): DecisionQueueProjection {
  return queueProjectionWithNextOrBlockedItem(projection, researchReviewQueueItem(researchTaskId, title, state), version);
}

function evidenceReviewQueueTitle(task: ResearchTaskProjection, matrix: EvidenceMatrixProjection) {
  if (matrix.balanceStatus === "balanced") {
    return `Evidence ready: ${task.objective}`;
  }

  return matrix.decisionBlocked ? `Decision blocked: ${task.objective}` : `Known risk: ${task.objective}`;
}

function evidenceReviewQueueState(matrix: EvidenceMatrixProjection): "next" | "blocked" {
  return matrix.decisionBlocked ? "blocked" : "next";
}

function acceptedReduction(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  event: ProductEngineEventDraft,
  patch: ProductEngineReduction["nextState"],
  deterministicOutputs: ProductEngineReduction["deterministicOutputs"],
  effectPlan: readonly ProductEngineEffectPlanItem[] = [],
  immediateProjection?: ActiveBatchSafeProjection
): ProductEngineReduction {
  return {
    accepted: true,
    events: [event],
    nextState: {
      stateVersion: nextVersion(state),
      ...patch
    },
    effectPlan,
    deterministicOutputs,
    ...(immediateProjection ? { immediateProjection } : {})
  };
}

function acceptedMultiEventReduction(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  events: readonly ProductEngineEventDraft[],
  patch: ProductEngineReduction["nextState"],
  deterministicOutputs: ProductEngineReduction["deterministicOutputs"],
  effectPlan: readonly ProductEngineEffectPlanItem[] = [],
  immediateProjection?: ActiveBatchSafeProjection
): ProductEngineReduction {
  return {
    accepted: true,
    events,
    nextState: {
      stateVersion: (numericVersion(state.stateVersion) + events.length) as StateVersion,
      ...patch
    },
    effectPlan,
    deterministicOutputs,
    ...(immediateProjection ? { immediateProjection } : {})
  };
}

function projectionPayload<TProjection>(payload: ProductEngineEvent["payload"], fallback: TProjection): TProjection {
  return typeof payload.projection === "object" && payload.projection !== null
    ? (payload.projection as TProjection)
    : fallback;
}

function objectPayload<TValue>(payload: ProductEngineEvent["payload"], key: string): TValue | null {
  const value = payload[key];

  return typeof value === "object" && value !== null ? (value as TValue) : null;
}

function confidenceProjectionPayload(payload: ProductEngineEvent["payload"]) {
  return objectPayload<ConfidenceCompletionProjection>(payload, "confidenceProjection");
}

function queueProjectionPayload(payload: ProductEngineEvent["payload"]) {
  return objectPayload<DecisionQueueProjection>(payload, "queueProjection");
}

export function sessionPhaseForProductEngineEvent(
  event: ProductEngineEvent
): ProductEngineStateSnapshot["session"]["phase"] | null {
  switch (event.eventType) {
    case "ProjectStarted":
      return "intake";
    case "InitialSpecDrafted":
      return "spec";
    case "QuestionBatchActivated":
      return "question_loop";
    case "ResearchPlanned":
    case "ResearchResultImported":
    case "EvidenceSynthesisRequested":
    case "EvidenceSynthesized":
      return "research";
    case "CompletenessScored":
      return event.payload.candidateStatus === "candidate" ? "completion" : null;
    case "FounderBriefPrepared":
      return event.payload.exportReady === true ? "completion" : null;
    default:
      return null;
  }
}

export function sessionShellPhaseForProductEnginePhase(
  phase: ProductEngineStateSnapshot["session"]["phase"]
): SessionShellProjection["phase"] {
  switch (phase) {
    case "spec":
      return "spec";
    case "question_loop":
    case "research":
      return "validation";
    case "completion":
      return "complete";
    case "intake":
      return "intake";
  }
}

function reduceStartProject(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const rawIdea = requiredString(command.payload.rawIdea);
  const localPrivacyMode = command.payload.localPrivacyMode;

  if (!rawIdea || !isPrivacyMode(localPrivacyMode)) {
    return reject("StartProject requires rawIdea and a valid local privacy mode.", "VALIDATION_FAILED");
  }

  if (numericVersion(state.stateVersion) !== 0) {
    return reject("StartProject can only initialize an empty ProductEngine state.");
  }

  const projection = createSessionShellProjection(command, projectionVersionFor(state));
  const event = eventDraft(command, "ProjectStarted", {
    rawIdea,
    localPrivacyMode,
    sourceNote: typeof command.payload.sourceNote === "string" ? command.payload.sourceNote : undefined,
    sessionPhase: "intake",
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      project: {
        projectId: command.projectId,
        privacyMode: localPrivacyMode,
        rawIdeaText: rawIdea
      },
      session: {
        sessionId: command.sessionId,
        phase: "intake"
      },
      sessionShellProjection: projection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: `project:${command.projectId}:session:${command.sessionId}`,
        payload: {
          rawIdea,
          localPrivacyMode
        }
      }
    ],
    [],
    projection
  );
}

function reduceCaptureIntake(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const answer = requiredString(command.payload.answer);

  if (!answer) {
    return reject("CaptureIntake requires a non-empty answer.", "VALIDATION_FAILED");
  }

  if (numericVersion(state.stateVersion) < 1) {
    return reject("CaptureIntake requires an initialized project.");
  }

  const intakeRef = `intake_${stableToken(`${command.sessionId}:${answer}`)}`;
  const event = eventDraft(command, "IntakeCaptured", {
    intakeRef,
    answer,
    source: "user_intake"
  });

  return acceptedReduction(command, state, event, { intake: { intakeRef, answer } }, [
    {
      outputType: "reducer_deterministic_output",
      outputRef: intakeRef,
      payload: {
        normalizedAnswer: answer
      }
    }
  ]);
}

function reduceDraftInitialSpec(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (numericVersion(state.stateVersion) < 2 || !state.intake?.answer) {
    return reject("DraftInitialSpec requires captured intake.");
  }

  if (state.currentSpec.draftRef) {
    return reject("Initial spec draft already exists.");
  }

  const draftRef = `spec_draft_${stableToken(`${command.sessionId}:${state.intake.answer}`)}`;
  const sections = [
    "Problem",
    "Target customer",
    "Value proposition",
    "Validation risks"
  ];
  const title = `초기 제품 스펙 초안: ${state.project.rawIdeaText ?? "Untitled idea"}`;
  const projection = createLivingSpecProjection(command, projectionVersionFor(state), title, sections);
  const event = eventDraft(command, "InitialSpecDrafted", {
    draftRef,
    title,
    sections,
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      currentSpec: {
        draftRef,
        title,
        sections
      },
      livingSpecProjection: projection
    },
    [
      {
        outputType: "initial_spec_draft",
        outputRef: draftRef,
        payload: {
          sections
        }
      }
    ],
    [],
    projection
  );
}

function reduceAnalyzeAmbiguity(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("AnalyzeAmbiguity requires an initial spec draft.");
  }

  if (state.openIssues.some((issue) => issue.status === "open")) {
    return reject("AnalyzeAmbiguity cannot run while open ambiguity issues already exist.");
  }

  const issues = createAmbiguityIssues(command.sessionId, state.currentSpec.draftRef);
  const event = eventDraft(command, "AmbiguityAnalyzed", {
    targetRef: typeof command.payload.targetRef === "string" ? command.payload.targetRef : state.currentSpec.draftRef,
    issueCount: issues.length,
    issues
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: issues
    },
    [
      {
        outputType: "ambiguity_analysis",
        outputRef: `ambiguity_${stableToken(`${command.sessionId}:${state.currentSpec.draftRef}`)}`,
        payload: {
          issueCount: issues.length,
          issues
        }
      }
    ],
    [
      queueProjectionEffect(
        command,
        "AmbiguityAnalyzed",
        {
          refType: "ambiguity_issue_set",
          refId: state.currentSpec.draftRef
        },
        "normal"
      )
    ]
  );
}

function reduceActivateQuestionBatch(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const openIssues = state.openIssues.filter((issue) => issue.status === "open");
  const selectedQueueItemIds = queueItemIdSelection(command.payload.queueItemIds);

  if (selectedQueueItemIds === "invalid") {
    return reject("ActivateQuestionBatch queueItemIds must be unique non-empty strings.", "VALIDATION_FAILED");
  }

  const selectedIssues = selectedQueueItemIds
    ? selectedQueueItemIds.map((queueItemId) => openIssues.find((issue) => issue.queueItemId === queueItemId))
    : openIssues;

  if (selectedIssues.some((issue) => issue === undefined)) {
    return reject("ActivateQuestionBatch queueItemIds must reference open ambiguity issues.");
  }
  const candidateIssues = selectedIssues as readonly AmbiguityIssueSnapshot[];

  if (candidateIssues.length < 3 || candidateIssues.length > 5) {
    return reject("ActivateQuestionBatch requires 3 to 5 open ambiguity issues.");
  }

  if (state.queueProjection.active.length > 0) {
    return reject("ActivateQuestionBatch cannot replace an already active batch.");
  }

  const projection = queueProjectionFromIssues(candidateIssues, projectionVersionFor(state));
  const event = eventDraft(command, "QuestionBatchActivated", {
    batchRef: `batch_${stableToken(`${command.sessionId}:${candidateIssues.map((issue) => issue.queueItemId).join(":")}`)}`,
    activeCount: projection.active.length,
    activeItems: projection.active,
    projection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      queueProjection: projection
    },
    [
      {
        outputType: "active_question_batch",
        outputRef: String(event.payload.batchRef),
        payload: {
          activeItems: projection.active
        }
      }
    ],
    [
      queueProjectionEffect(
        command,
        "QuestionBatchActivated",
        {
          refType: "active_batch",
          refId: String(event.payload.batchRef)
        },
        "high"
      )
    ],
    projection
  );
}

interface QueueItemResolutionConfig {
  readonly commandType: "DeferQueueItem" | "DismissQueueItem";
  readonly eventType: "QueueItemDeferred" | "QueueItemDismissed";
  readonly issueStatus: Extract<AmbiguityIssueSnapshot["status"], "deferred" | "resolved">;
  readonly nextQueueProjection: (
    projection: DecisionQueueProjection,
    item: QueueItemProjection,
    version: ProjectionVersion
  ) => DecisionQueueProjection;
  readonly unavailableMessage: string;
}

function reduceQueueItemResolution(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot,
  config: QueueItemResolutionConfig
): ProductEngineReduction {
  const queueItemId = requiredString(command.payload.queueItemId);
  const reason = requiredString(command.payload.reason);

  if (!queueItemId || !reason) {
    return reject(`${config.commandType} requires queueItemId and a non-empty reason.`, "VALIDATION_FAILED");
  }

  const typedQueueItemId = queueItemId as QueueItemId;
  const existingItem = queueItemFromProjection(state.queueProjection, typedQueueItemId);

  if (!existingItem) {
    return reject(`${config.commandType} requires an existing queue item.`, "RESOURCE_NOT_FOUND");
  }

  if (existingItem.state === config.issueStatus) {
    return reject(config.unavailableMessage, "COMMAND_PRECONDITION_FAILED");
  }

  const queueProjection = config.nextQueueProjection(
    state.queueProjection,
    existingItem,
    projectionVersionFor(state)
  );
  const nextOpenIssues = issuesWithQueueItemStatus(state.openIssues, typedQueueItemId, config.issueStatus);
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextOpenIssues,
      queueProjection
    },
    queueProjection.version
  );
  const event = eventDraft(command, config.eventType, {
    queueItemId,
    reason,
    projection: queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      openIssues: nextOpenIssues,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: queueItemId,
        payload: {
          queueItemId,
          reason
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        config.eventType,
        {
          refType: "queue_item",
          refId: queueItemId
        },
        "normal"
      )
    ],
    queueProjection
  );
}

function reduceDeferQueueItem(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  return reduceQueueItemResolution(command, state, {
    commandType: "DeferQueueItem",
    eventType: "QueueItemDeferred",
    issueStatus: "deferred",
    nextQueueProjection: (projection, item, version) =>
      queueProjectionWithDeferredItem(
        projection,
        {
          ...item,
          state: "deferred"
        },
        version
      ),
    unavailableMessage: "DeferQueueItem requires a queue item that is not already deferred."
  });
}

function reduceDismissQueueItem(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  return reduceQueueItemResolution(command, state, {
    commandType: "DismissQueueItem",
    eventType: "QueueItemDismissed",
    issueStatus: "resolved",
    nextQueueProjection: (projection, item, version) => queueProjectionWithoutItem(projection, item.queueItemId, version),
    unavailableMessage: "DismissQueueItem requires a queue item that is not already resolved."
  });
}

function reduceSubmitAnswer(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const queueItemId = requiredString(command.payload.queueItemId);
  const answer = requiredString(command.payload.answer);

  if (!queueItemId || !answer) {
    return reject("SubmitAnswer requires queueItemId and a non-empty answer.", "VALIDATION_FAILED");
  }

  const activeItem = state.queueProjection.active.find((item) => item.queueItemId === queueItemId);

  if (!activeItem || activeItem.state !== "active") {
    return reject("SubmitAnswer requires an active question card.");
  }

  const projection = queueProjectionWithAnsweredItem(
    state.queueProjection,
    queueItemId as QueueItemId,
    (numericVersion(state.stateVersion) + 2) as ProjectionVersion
  );
  const answerRef = `answer_${stableToken(`${command.sessionId}:${queueItemId}:${answer}`)}`;
  const routeOutcome = routeOutcomeForAnswer(command);
  const impact = validResearchImpact(command.payload.claimImpact);
  const sourceQuestion = state.openIssues.find((issue) => issue.queueItemId === queueItemId);
  const objective =
    requiredString(command.payload.researchObjective) ??
    `Validate evidence for: ${sourceQuestion?.summary ?? activeItem.title}`;
  const researchTaskId = `research_task_${stableToken(`${command.sessionId}:${queueItemId}:${answer}:${routeOutcome}`)}` as ResearchTaskId;
  const researchTask = planResearchTask({
    researchTaskId,
    sessionId: command.sessionId,
    sourceQueueItemId: queueItemId as QueueItemId,
    sourceAnswerRef: answerRef,
    objective,
    routeOutcome,
    impact,
    createdAt: command.issuedAt
  });
  const queueProjection = queueProjectionWithResearchReviewItem(
    projection,
    researchTaskId,
    routeOutcome === "missing_con_evidence"
      ? `반대근거 탐색 필요: ${activeItem.title}`
      : `Research review: ${activeItem.title}`,
    routeOutcome === "missing_con_evidence" ? "blocked" : "next",
    projection.version
  );
  const researchProjection = addResearchTaskToProjection(
    state.researchState,
    researchTask,
    queueProjection.version
  );
  const event = eventDraft(command, "AnswerSubmitted", {
    answerRef,
    queueItemId,
    answer,
    answerRouteOutcome: routeOutcome,
    researchTaskId,
    projection: queueProjection
  });
  const researchEvent = eventDraft(command, "ResearchPlanned", {
    researchTask,
    sourceAnswerRef: answerRef,
    projection: researchProjection
  });
  const nextOpenIssues = state.openIssues.map((issue) =>
    issue.queueItemId === queueItemId
      ? {
          ...issue,
          status: "answered" as const
        }
      : issue
  );
  const nextSession = {
    ...state.session,
    phase: "research" as const
  };
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      openIssues: nextOpenIssues,
      queueProjection,
      researchState: researchProjection,
      session: nextSession
    },
    queueProjection.version
  );
  const researchEventWithConfidence = {
    ...researchEvent,
    payload: {
      ...researchEvent.payload,
      confidenceProjection
    }
  };

  return acceptedMultiEventReduction(
    command,
    state,
    [event, researchEventWithConfidence],
    {
      openIssues: nextOpenIssues,
      queueProjection,
      researchState: researchProjection,
      completeness: confidenceProjection,
      session: nextSession
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: answerRef,
        payload: {
          queueItemId,
          answer,
          answerRouteOutcome: routeOutcome,
          researchTaskId
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchPlanned"],
        {
          refType: "ResearchTask",
          refId: researchTaskId
        },
        "normal",
        `research:${researchTaskId}`
      )
    ],
    queueProjection
  );
}

function reducePlanResearch(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const objective = requiredString(command.payload.objective);

  if (!objective) {
    return reject("PlanResearch requires a non-empty objective.", "VALIDATION_FAILED");
  }

  const sourceQueueItemId = requiredString(command.payload.sourceQueueItemId) as QueueItemId | null;
  const routeOutcome =
    command.payload.routeOutcome === "missing_con_evidence" ? "missing_con_evidence" : "research_needed";
  const impact = validResearchImpact(command.payload.impact);
  const researchTaskId = `research_task_${stableToken(`${command.sessionId}:${objective}:${sourceQueueItemId ?? "manual"}`)}` as ResearchTaskId;
  const researchTask = planResearchTask({
    researchTaskId,
    sessionId: command.sessionId,
    ...(sourceQueueItemId ? { sourceQueueItemId } : {}),
    objective,
    routeOutcome,
    impact,
    createdAt: command.issuedAt
  });
  const researchProjection = addResearchTaskToProjection(
    state.researchState,
    researchTask,
    projectionVersionFor(state)
  );
  const event = eventDraft(command, "ResearchPlanned", {
    researchTask,
    projection: researchProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      session: {
        ...state.session,
        phase: "research"
      }
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: researchTaskId,
        payload: {
          objective,
          routeOutcome,
          impact
        }
      }
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchPlanned"],
        {
          refType: "ResearchTask",
          refId: researchTaskId
        },
        "normal",
        `research:${researchTaskId}`
      )
    ],
    researchProjection
  );
}

function reduceImportResearchResult(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const researchTaskId = requiredString(command.payload.researchTaskId) as ResearchTaskId | null;
  const result = requiredString(command.payload.result);

  if (!researchTaskId || !result) {
    return reject("ImportResearchResult requires researchTaskId and non-empty result.", "VALIDATION_FAILED");
  }

  const researchTask = state.researchState.tasks.find((task) => task.researchTaskId === researchTaskId);

  if (!researchTask) {
    return reject("ImportResearchResult requires an existing ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const requestedSynthesisVersion = optionalPositiveInteger(command.payload.synthesisVersion);

  if (requestedSynthesisVersion === "invalid") {
    return reject("ImportResearchResult requires synthesisVersion to be a positive integer.", "VALIDATION_FAILED");
  }

  const synthesisVersion = requestedSynthesisVersion ?? 1;
  const researchResultId = `research_result_${stableToken(`${researchTaskId}:${result}`)}` as ResearchResultId;
  const researchResult = importResearchResult({
    researchResultId,
    researchTaskId,
    result,
    importedAt: command.issuedAt,
    ...(typeof command.payload.sourceTitle === "string" ? { sourceTitle: command.payload.sourceTitle } : {}),
    ...(typeof command.payload.sourceUrl === "string" ? { sourceUrl: command.payload.sourceUrl } : {}),
    ...(typeof command.payload.limitationNotes === "string" ? { limitationNotes: command.payload.limitationNotes } : {})
  });
  const researchProjection = addImportedResearchResultToProjection(
    state.researchState,
    researchTask,
    researchResult,
    projectionVersionFor(state)
  );
  const importedEvent = eventDraft(command, "ResearchResultImported", {
    researchTaskId,
    researchResult,
    synthesisVersion,
    projection: researchProjection
  });

  return acceptedReduction(
    command,
    state,
    importedEvent,
    {
      researchState: researchProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: researchResultId,
        payload: {
          researchTaskId,
          synthesisVersion
        }
      }
    ],
    [
      researchEvidenceEffect(
        command,
        ["ResearchResultImported"],
        {
          refType: "ResearchResult",
          refId: researchResultId
        },
        "high",
        `research-result:${researchResultId}:v${synthesisVersion}`,
        `synthesisVersion:${synthesisVersion}`
      )
    ]
  );
}

function reduceSynthesizeEvidence(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const researchResultId = requiredString(command.payload.researchResultId) as ResearchResultId | null;

  if (!researchResultId) {
    return reject("SynthesizeEvidence requires researchResultId.", "VALIDATION_FAILED");
  }

  const researchResult = state.researchState.results.find((result) => result.researchResultId === researchResultId);

  if (!researchResult) {
    return reject("SynthesizeEvidence requires an imported ResearchResult.", "RESOURCE_NOT_FOUND");
  }

  const researchTask = state.researchState.tasks.find((task) => task.researchTaskId === researchResult.researchTaskId);

  if (!researchTask) {
    return reject("SynthesizeEvidence requires the source ResearchTask.", "RESOURCE_NOT_FOUND");
  }

  const requestedSynthesisVersion = optionalPositiveInteger(command.payload.synthesisVersion);

  if (requestedSynthesisVersion === "invalid") {
    return reject("SynthesizeEvidence requires synthesisVersion to be a positive integer.", "VALIDATION_FAILED");
  }

  const synthesisVersion =
    requestedSynthesisVersion ??
    Math.max(
      1,
      ...state.researchState.evidenceMatrices
        .filter((matrix) => matrix.researchResultId === researchResultId)
        .map((matrix) => matrix.synthesisVersion + 1)
    );

  if (command.actor !== "effect_executor") {
    const requestedEvent = eventDraft(command, "EvidenceSynthesisRequested", {
      researchTaskId: researchTask.researchTaskId,
      researchResultId,
      synthesisVersion
    });

    return acceptedReduction(
      command,
      state,
      requestedEvent,
      {},
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: `synthesis_request:${researchResultId}:v${synthesisVersion}`,
          payload: {
            researchResultId,
            synthesisVersion
          }
        }
      ],
      [
        researchEvidenceEffect(
          command,
          ["EvidenceSynthesisRequested"],
          {
            refType: "ResearchResult",
            refId: researchResultId
          },
          "high",
          `research-result:${researchResultId}:v${synthesisVersion}`,
          `synthesisVersion:${synthesisVersion}`
        )
      ]
    );
  }

  const evidenceMatrix = synthesizeEvidenceMatrix({
    researchTask,
    researchResult,
    synthesisVersion
  });
  const researchProjection = addResearchResultToProjection(
    state.researchState,
    researchTask,
    researchResult,
    evidenceMatrix,
    projectionVersionFor(state)
  );
  const queueProjection = queueProjectionWithResearchReviewItem(
    state.queueProjection,
    researchTask.researchTaskId,
    evidenceReviewQueueTitle(researchTask, evidenceMatrix),
    evidenceReviewQueueState(evidenceMatrix),
    researchProjection.version
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      researchState: researchProjection,
      queueProjection
    },
    researchProjection.version
  );
  const event = eventDraft(command, "EvidenceSynthesized", {
    researchTaskId: researchTask.researchTaskId,
    researchResultId,
    evidenceMatrix,
    projection: researchProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: evidenceMatrix.evidenceMatrixId,
        payload: {
          balanceStatus: evidenceMatrix.balanceStatus,
          decisionBlocked: evidenceMatrix.decisionBlocked
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "EvidenceSynthesized",
        {
          refType: "EvidenceMatrix",
          refId: evidenceMatrix.evidenceMatrixId
        },
        "normal"
      )
    ]
  );
}

function runtimeArtifactFromPayload(
  command: ProductEngineCommand,
  source: CodexRuntimeSource
): RuntimePreviewArtifact | ProductEngineReduction {
  const turnPurpose = command.payload.turnPurpose;
  const contextHash = requiredString(command.payload.contextHash);
  const summary = requiredString(command.payload.summary) ?? requiredString(command.payload.prompt);
  const body = requiredString(command.payload.body) ?? requiredString(command.payload.prompt);
  const sourceRefs = optionalStringArray(command.payload.sourceRefs);

  if (!isCodexTurnPurpose(turnPurpose) || !contextHash || !summary || !body || sourceRefs === "invalid") {
    return reject("CreateRuntimePreview requires turnPurpose, contextHash, prompt/body, and valid sourceRefs.", "VALIDATION_FAILED");
  }

  const blockedActionType = command.payload.blockedActionType ?? command.payload.requestedActionType;
  const blockedActionReason =
    requiredString(command.payload.blockedActionReason) ??
    requiredString(command.payload.requestedActionReason) ??
    "Phase 1 converts forbidden runtime actions into blocked preview artifacts.";
  const hasBlockedAction = isBlockedActionType(blockedActionType);
  const requestedKind = command.payload.artifactKind;
  const requestedPolicy = command.payload.applyPolicy;
  const kind = hasBlockedAction
    ? "BlockedActionArtifact"
    : isCodexArtifactKind(requestedKind)
      ? requestedKind
      : CODEX_ARTIFACT_KIND_BY_TURN_PURPOSE[turnPurpose];
  const applyPolicy = hasBlockedAction
    ? "blocked"
    : isCodexApplyPolicy(requestedPolicy)
      ? requestedPolicy
      : source === "manual_prompt_handoff"
        ? "manual_handoff_required"
        : CODEX_APPLY_POLICY_BY_TURN_PURPOSE[turnPurpose];
  const status = hasBlockedAction ? "blocked" : source === "manual_prompt_handoff" ? "manual_handoff" : "preview_ready";
  const runtimeAdapterVersion =
    requiredString(command.payload.runtimeAdapterVersion) ?? CODEX_RUNTIME_ADAPTER_VERSION;
  const artifactId = runtimeArtifactIdFor(command.sessionId, turnPurpose, contextHash, runtimeAdapterVersion);
  const targetObject =
    requiredString(command.payload.targetObject) ?? (kind === "BlockedActionArtifact" ? "blocked_action" : turnPurpose);

  return {
    artifactId,
    turnPurpose,
    kind,
    applyPolicy,
    status,
    source,
    targetObject,
    summary,
    payload: {
      title: summary,
      body,
      targetObject,
      sourceRefs,
      ...(typeof command.payload.phase15bUpgradeHints === "object" && command.payload.phase15bUpgradeHints !== null
        ? { phase15bUpgradeHints: command.payload.phase15bUpgradeHints }
        : {})
    },
    sourceRefs,
    contextHash,
    runtimeAdapterVersion,
    ...(typeof command.payload.sourceEffectTaskId === "string"
      ? { sourceEffectTaskId: command.payload.sourceEffectTaskId as EffectTaskId }
      : {}),
    ...(hasBlockedAction
      ? {
          blockedAction: {
            actionType: blockedActionType,
            reason: blockedActionReason,
            ...(typeof command.payload.suggestedSafeAlternative === "string"
              ? { suggestedSafeAlternative: command.payload.suggestedSafeAlternative }
              : {})
          }
        }
      : {}),
    createdAt: command.issuedAt,
    schemaVersion: command.schemaVersion
  };
}

function reduceCreateRuntimePreview(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const turnPurpose = command.payload.turnPurpose;
  const contextHash = requiredString(command.payload.contextHash);
  const prompt = requiredString(command.payload.prompt);
  const sourceRefs = optionalStringArray(command.payload.sourceRefs);

  if (!isCodexTurnPurpose(turnPurpose) || !contextHash || !prompt || sourceRefs === "invalid") {
    return reject("CreateRuntimePreview requires turnPurpose, contextHash, prompt, and valid sourceRefs.", "VALIDATION_FAILED");
  }

  const source =
    command.actor === "effect_executor"
      ? command.payload.source === "protocol_fixture"
        ? "protocol_fixture"
        : command.payload.source === "codex_app_server"
          ? "codex_app_server"
          : "manual_prompt_handoff"
      : command.payload.mode === "manual_handoff"
        ? "manual_prompt_handoff"
        : null;

  if (!source) {
    const requestedActionType = isBlockedActionType(command.payload.requestedActionType)
      ? command.payload.requestedActionType
      : null;
    const requestedActionReason = requiredString(command.payload.requestedActionReason);
    const event = eventDraft(command, "RuntimePreviewRequested", {
      turnPurpose,
      contextHash,
      prompt,
      sourceRefs,
      targetObject: requiredString(command.payload.targetObject) ?? turnPurpose,
      runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION,
      ...(requestedActionType ? { requestedActionType } : {}),
      ...(requestedActionReason ? { requestedActionReason } : {})
    });

    return acceptedReduction(
      command,
      state,
      event,
      {},
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: `runtime_preview_request:${turnPurpose}:${contextHash}`,
          payload: {
            turnPurpose,
            contextHash,
            runtimeAdapterVersion: CODEX_RUNTIME_ADAPTER_VERSION
          }
        }
      ],
      [codexRuntimePreviewEffect(command, turnPurpose, contextHash)]
    );
  }

  const artifactOrRejection = runtimeArtifactFromPayload(command, source);

  if (!("artifactId" in artifactOrRejection)) {
    return artifactOrRejection;
  }

  const runtimeProjection = runtimeProjectionWithArtifact(
    state.runtimeState,
    artifactOrRejection,
    projectionVersionFor(state)
  );
  const queueProjection = queueProjectionWithRuntimePreviewItem(
    state.queueProjection,
    artifactOrRejection,
    runtimeProjection.version
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      runtimeState: runtimeProjection,
      queueProjection
    },
    runtimeProjection.version
  );
  const event = eventDraft(command, "RuntimePreviewRequested", {
    turnPurpose,
    contextHash,
    runtimeArtifact: artifactOrRejection,
    projection: runtimeProjection,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      runtimeState: runtimeProjection,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: artifactOrRejection.artifactId,
        payload: {
          turnPurpose,
          kind: artifactOrRejection.kind,
          applyPolicy: artifactOrRejection.applyPolicy,
          status: artifactOrRejection.status
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [],
    runtimeProjection
  );
}

function reduceConvertRuntimeArtifact(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  const artifactId = requiredString(command.payload.artifactId) as RuntimeArtifactId | null;
  const artifact = artifactId
    ? state.runtimeState.runtimeArtifacts.find((candidate) => candidate.artifactId === artifactId)
    : null;

  if (!artifact) {
    return reject("ConvertRuntimeArtifact requires an existing RuntimePreviewArtifact.", "RESOURCE_NOT_FOUND");
  }

  const artifactRef = artifact.artifactId;
  const target = requiredString(command.payload.target);
  const blockReason = requiredString(command.payload.blockReason);

  if (!target) {
    return reject("ConvertRuntimeArtifact requires target.", "VALIDATION_FAILED");
  }

  const requestsBlockedTarget = target === "blocked_action" || Boolean(blockReason);
  const hasBlockedActionTaxonomy =
    isBlockedActionType(command.payload.blockedActionType) || Boolean(artifact.blockedAction?.actionType);

  if (requestsBlockedTarget && !hasBlockedActionTaxonomy) {
    return reject("Blocked runtime artifact conversion requires blockedActionType taxonomy.", "VALIDATION_FAILED");
  }

  if (isRuntimeArtifactBlocked(artifact) || requestsBlockedTarget) {
    const blockedArtifact = requestsBlockedTarget ? blockedArtifactFromConversion(command, artifact) : artifact;
    const runtimeProjection = runtimeProjectionWithArtifact(
      state.runtimeState,
      blockedArtifact,
      projectionVersionFor(state)
    );
    const queueProjection = queueProjectionWithRuntimePreviewItem(
      state.queueProjection,
      blockedArtifact,
      runtimeProjection.version
    );
    const confidenceProjection = buildConfidenceCompletionProjection(
      {
        ...state,
        runtimeState: runtimeProjection,
        queueProjection
      },
      runtimeProjection.version
    );
    const event = eventDraft(command, "RuntimeArtifactConverted", {
      artifactId: artifactRef,
      conversionStatus: "blocked",
      blockReason:
        blockedArtifact.blockedAction?.reason ??
        blockReason ??
        "Blocked runtime artifact cannot be converted into execution.",
      runtimeArtifact: blockedArtifact,
      projection: runtimeProjection,
      queueProjection,
      confidenceProjection
    });

    return acceptedReduction(
      command,
      state,
      event,
      {
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      },
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: artifactRef,
          payload: {
            conversionStatus: "blocked"
          }
        },
        ...completenessDeterministicOutputs(command, confidenceProjection)
      ],
      [],
      runtimeProjection
    );
  }

  const event = eventDraft(command, "RuntimeArtifactConverted", {
    artifactId: artifactRef,
    conversionStatus: "preview_only",
    target
  });

  return acceptedReduction(
    command,
    state,
    event,
    {},
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: artifactRef,
        payload: {
          conversionStatus: "preview_only",
          target
        }
      }
    ]
  );
}

function reduceCreateSpecUpdatePreview(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("CreateSpecUpdatePreview requires an initial spec draft.");
  }

  const sourceRef =
    requiredString(command.payload.sourceRef) ??
    requiredString(command.payload.sourcePreviewRef) ??
    requiredString(command.payload.evidenceMatrixId) ??
    requiredString(command.payload.runtimeArtifactId);

  if (!sourceRef) {
    return reject("CreateSpecUpdatePreview requires a sourceRef trace link.", "VALIDATION_FAILED");
  }

  const requiredDecisionRef = isRequiredDecisionRef(command.payload.requiredDecisionRef)
    ? command.payload.requiredDecisionRef
    : "primary_customer";
  const payloadSections = optionalPayloadSections(command.payload.sections);

  if (payloadSections === "invalid") {
    return reject("CreateSpecUpdatePreview sections must be non-empty strings.", "VALIDATION_FAILED");
  }

  const previewRef = `spec_update_${stableToken(`${command.sessionId}:${sourceRef}:${requiredDecisionRef}`)}`;
  const decisionId = decisionIdForSpecUpdatePreview(previewRef);
  const existingDecision = state.decisions.find((decision) => decision.decisionId === decisionId);

  if (
    existingDecision &&
    existingDecision.status !== "active" &&
    existingDecision.status !== "deferred"
  ) {
    return reject("CreateSpecUpdatePreview cannot recreate a terminal decision card.", "COMMAND_PRECONDITION_FAILED", {
      decisionId,
      status: existingDecision.status
    });
  }

  const version = projectionVersionFor(state);
  const decision = {
    decisionId,
    requiredDecisionRef,
    status: "active" as const
  };
  const decisions = mergeDecision(state.decisions, decision);
  const title =
    requiredString(command.payload.title) ??
    state.currentSpec.title ??
    state.project.rawIdeaText ??
    "Spec update preview";
  const sections = payloadSections ?? state.currentSpec.sections ?? [];
  const specUpdatePreview = {
    previewRef,
    sourceRef,
    decisionId,
    requiredDecisionRef,
    title,
    sections
  } as const satisfies SpecUpdatePreviewSnapshot;
  const specUpdatePreviews = mergeSpecUpdatePreview(state.specUpdatePreviews ?? [], specUpdatePreview);
  const queueProjection = queueProjectionWithSpecUpdateDecision(
    state.queueProjection,
    decisionId,
    `Decision approval required: ${requiredDecisionRef}`,
    version
  );
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      decisions,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "SpecUpdatePreviewCreated", {
    previewRef,
    sourceRef,
    requiredDecisionRef,
    title,
    sections,
    decision,
    specUpdatePreview,
    queueProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      decisions,
      specUpdatePreviews,
      queueProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: previewRef,
        payload: {
          previewRef,
          sourceRef,
          decisionId,
          requiredDecisionRef,
          title,
          sections
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [
      queueProjectionEffect(
        command,
        "SpecUpdatePreviewCreated",
        {
          refType: "SpecUpdatePreview",
          refId: previewRef
        },
        "normal"
      )
    ],
    queueProjection
  );
}

function reduceResolveDecision(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const decisionId = requiredString(command.payload.decisionId) as DecisionId | null;
  const outcome = isDecisionResolutionStatus(command.payload.outcome) ? command.payload.outcome : null;

  if (!decisionId || !outcome) {
    return reject("ResolveDecision requires decisionId and a supported resolution outcome.", "VALIDATION_FAILED");
  }

  const existingDecision = state.decisions.find((decision) => decision.decisionId === decisionId);

  if (!existingDecision) {
    return reject("ResolveDecision requires an existing decision.", "RESOURCE_NOT_FOUND");
  }

  if (existingDecision.status !== "active" && existingDecision.status !== "deferred") {
    return reject("ResolveDecision requires an active or deferred decision.", "COMMAND_PRECONDITION_FAILED");
  }

  const version = projectionVersionFor(state);
  const decisions = state.decisions.map((decision) =>
    decision.decisionId === decisionId
      ? {
          ...decision,
          status: outcome
        }
      : decision
  );
  const queueItemId = decisionQueueItemId(decisionId);
  const queueProjection =
    outcome === "deferred"
      ? queueProjectionWithDeferredItem(
          state.queueProjection,
          {
            queueItemId,
            title: `Decision deferred: ${existingDecision.requiredDecisionRef}`,
            state: "deferred"
          },
          version
        )
      : queueProjectionWithoutItem(state.queueProjection, queueItemId, version);
  const updatedConfidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      decisions,
      queueProjection
    },
    version
  );
  const event = eventDraft(command, "DecisionResolved", {
    decisionId,
    outcome,
    requiredDecisionRef: existingDecision.requiredDecisionRef,
    queueProjection,
    confidenceProjection: updatedConfidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      decisions,
      queueProjection,
      completeness: updatedConfidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: decisionId,
        payload: {
          outcome
        }
      },
      ...completenessDeterministicOutputs(command, updatedConfidenceProjection)
    ],
    [],
    updatedConfidenceProjection
  );
}

function reduceCreateSpecVersion(command: ProductEngineCommand, state: ProductEngineStateSnapshot): ProductEngineReduction {
  const approvedPreviewRef = requiredString(command.payload.approvedPreviewRef);

  if (!state.currentSpec.draftRef) {
    return reject("CreateSpecVersion requires an initial spec draft.");
  }

  if (!approvedPreviewRef) {
    return reject("CreateSpecVersion requires approvedPreviewRef.", "VALIDATION_FAILED");
  }

  const approvedDecisionId = decisionIdForSpecUpdatePreview(approvedPreviewRef);
  const approvedDecision = state.decisions.find(
    (decision) => decision.decisionId === approvedDecisionId && decision.status === "approved"
  );
  const approvedPreview = state.specUpdatePreviews?.find((preview) => preview.previewRef === approvedPreviewRef);

  if (!approvedDecision) {
    return reject("CreateSpecVersion requires an approved decision for the preview ref.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef,
      expectedDecisionId: approvedDecisionId
    });
  }

  if (!approvedPreview) {
    return reject("CreateSpecVersion requires approved spec update preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  const payloadSections = optionalPayloadSections(command.payload.sections);

  if (payloadSections === "invalid") {
    return reject("CreateSpecVersion sections must be non-empty strings.", "VALIDATION_FAILED");
  }

  const payloadTitle = requiredString(command.payload.title);

  if (payloadTitle && payloadTitle !== approvedPreview.title) {
    return reject("CreateSpecVersion title must match the approved preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  if (payloadSections && !stringArraysEqual(payloadSections, approvedPreview.sections)) {
    return reject("CreateSpecVersion sections must match the approved preview material.", "COMMAND_PRECONDITION_FAILED", {
      approvedPreviewRef
    });
  }

  const version = projectionVersionFor(state);
  const versionRef = `spec_version_${stableToken(`${command.sessionId}:${approvedPreviewRef}:${version}`)}` as SpecVersionId;
  const title = approvedPreview.title;
  const sections = approvedPreview.sections;
  const livingSpecProjection = createLivingSpecProjection(command, version, title, sections, "approved");
  const currentSpec = {
    ...state.currentSpec,
    versionRef,
    title,
    sections
  };
  const confidenceProjection = buildConfidenceCompletionProjection(
    {
      ...state,
      currentSpec,
      livingSpecProjection
    },
    version
  );
  const event = eventDraft(command, "SpecVersionCreated", {
    versionRef,
    approvedPreviewRef,
    title,
    sections,
    projection: livingSpecProjection,
    confidenceProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      currentSpec,
      livingSpecProjection,
      completeness: confidenceProjection
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: versionRef,
        payload: {
          approvedPreviewRef,
          sectionCount: sections.length
        }
      },
      ...completenessDeterministicOutputs(command, confidenceProjection)
    ],
    [],
    livingSpecProjection
  );
}

function reduceScoreCompleteness(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("ScoreCompleteness requires an initial spec draft.");
  }

  const version = projectionVersionFor(state);
  const confidenceProjection = buildConfidenceCompletionProjection(state, version);
  const candidateRequested = command.payload.candidateRequested === true;

  if (candidateRequested && confidenceProjection.completionCandidate.status !== "candidate") {
    return reject(
      `Completion candidate gates failed: ${confidenceProjection.completionCandidate.gateFailures.join("; ")}`,
      "COMMAND_PRECONDITION_FAILED",
      {
        axes: confidenceProjection.axes,
        gates: confidenceProjection.gates,
        topRisks: confidenceProjection.topRisks,
        topRiskCards: confidenceProjection.topRiskCards,
        completionCandidate: confidenceProjection.completionCandidate
      }
    );
  }

  const queueProjection = queueProjectionWithCompletionCandidate(
    state.queueProjection,
    confidenceProjection,
    version
  );
  const event = eventDraft(command, "CompletenessScored", {
    projection: confidenceProjection,
    queueProjection,
    compositeScore: confidenceProjection.compositeScore,
    readinessLabel: confidenceProjection.readinessLabel,
    candidateStatus: confidenceProjection.completionCandidate.status
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      completeness: confidenceProjection,
      queueProjection,
      session:
        confidenceProjection.completionCandidate.status === "candidate"
          ? {
              ...state.session,
              phase: "completion" as const
            }
          : state.session
    },
    completenessDeterministicOutputs(command, confidenceProjection),
    [],
    confidenceProjection
  );
}

function reducePrepareFounderBrief(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (!state.currentSpec.draftRef) {
    return reject("PrepareFounderBrief requires an initial spec draft.");
  }

  if (command.payload.requestedFormat !== undefined && command.payload.requestedFormat !== "markdown") {
    return reject("PrepareFounderBrief requestedFormat must be markdown.", "VALIDATION_FAILED");
  }

  if (
    command.payload.fileWriteRequested === true ||
    command.payload.writeFile === true ||
    command.payload.externalExportRequested === true ||
    typeof command.payload.destinationPath === "string" ||
    typeof command.payload.exportUrl === "string"
  ) {
    return reject(
      "PrepareFounderBrief can prepare export metadata only; file and external export side effects are blocked in Phase 1.",
      "RUNTIME_ACTION_BLOCKED"
    );
  }

  const version = projectionVersionFor(state);
  const confidenceProjection = buildConfidenceCompletionProjection(state, version);
  const founderBrief = buildFounderBriefProjection(state, confidenceProjection, version, command.issuedAt);
  const event = eventDraft(command, "FounderBriefPrepared", {
    projection: founderBrief,
    confidenceProjection,
    exportReady: founderBrief.exportReady,
    exportMetadata: founderBrief.exportMetadata
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      completeness: confidenceProjection,
      founderBrief,
      session: founderBrief.exportReady
        ? {
            ...state.session,
            phase: "completion" as const
          }
        : state.session
    },
    [
      {
        outputType: "founder_brief_draft",
        outputRef: `founder_brief:${command.sessionId}:${version}`,
        payload: {
          exportReady: founderBrief.exportReady,
          exportMetadata: founderBrief.exportMetadata
        }
      }
    ],
    [],
    founderBrief
  );
}

export function reduceProductEngineCommand(
  command: ProductEngineCommand,
  state: ProductEngineStateSnapshot
): ProductEngineReduction {
  if (command.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    return reject("Unsupported ProductEngine command schema version.", "VALIDATION_FAILED");
  }

  if (command.expectedStateVersion !== state.stateVersion) {
    return reject("Command expectedStateVersion does not match the loaded ProductEngine state.", "STATE_VERSION_CONFLICT");
  }

  switch (command.commandType) {
    case "StartProject":
      return reduceStartProject(command, state);
    case "CaptureIntake":
      return reduceCaptureIntake(command, state);
    case "DraftInitialSpec":
      return reduceDraftInitialSpec(command, state);
    case "AnalyzeAmbiguity":
      return reduceAnalyzeAmbiguity(command, state);
    case "ActivateQuestionBatch":
      return reduceActivateQuestionBatch(command, state);
    case "DeferQueueItem":
      return reduceDeferQueueItem(command, state);
    case "DismissQueueItem":
      return reduceDismissQueueItem(command, state);
    case "SubmitAnswer":
      return reduceSubmitAnswer(command, state);
    case "PlanResearch":
      return reducePlanResearch(command, state);
    case "ImportResearchResult":
      return reduceImportResearchResult(command, state);
    case "SynthesizeEvidence":
      return reduceSynthesizeEvidence(command, state);
    case "CreateRuntimePreview":
      return reduceCreateRuntimePreview(command, state);
    case "ConvertRuntimeArtifact":
      return reduceConvertRuntimeArtifact(command, state);
    case "CreateSpecUpdatePreview":
      return reduceCreateSpecUpdatePreview(command, state);
    case "ResolveDecision":
      return reduceResolveDecision(command, state);
    case "CreateSpecVersion":
      return reduceCreateSpecVersion(command, state);
    case "ScoreCompleteness":
      return reduceScoreCompleteness(command, state);
    case "PrepareFounderBrief":
      return reducePrepareFounderBrief(command, state);
    default:
      return reject(`${command.commandType} is outside the mounted PR-09 reducer slice.`);
  }
}

function applyEvent(state: ProductEngineStateSnapshot, event: ProductEngineEvent): ProductEngineStateSnapshot {
  const nextStateVersion = event.sequence as StateVersion;

  switch (event.eventType) {
    case "ProjectStarted": {
      const rawIdeaText = typeof event.payload.rawIdea === "string" ? event.payload.rawIdea : undefined;
      const projection = projectionPayload(event.payload, state.sessionShellProjection);
      const phase = sessionPhaseForProductEngineEvent(event) ?? "intake";

      return {
        ...state,
        stateVersion: nextStateVersion,
        project: {
          projectId: event.projectId,
          privacyMode: isPrivacyMode(event.payload.localPrivacyMode) ? event.payload.localPrivacyMode : "local_only",
          ...(rawIdeaText ? { rawIdeaText } : {})
        },
        session: {
          sessionId: event.sessionId,
          phase
        },
        ...(projection ? { sessionShellProjection: projection } : {})
      };
    }
    case "IntakeCaptured":
      return {
        ...state,
        stateVersion: nextStateVersion,
        intake: {
          intakeRef: typeof event.payload.intakeRef === "string" ? event.payload.intakeRef : "intake_unknown",
          answer: typeof event.payload.answer === "string" ? event.payload.answer : ""
        }
      };
    case "InitialSpecDrafted": {
      const projection = projectionPayload(event.payload, state.livingSpecProjection);
      const title = typeof event.payload.title === "string" ? event.payload.title : state.currentSpec.title;
      const sections = Array.isArray(event.payload.sections)
        ? event.payload.sections.map(String)
        : state.currentSpec.sections;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        currentSpec: {
          draftRef: typeof event.payload.draftRef === "string" ? event.payload.draftRef : state.currentSpec.draftRef,
          ...(title ? { title } : {}),
          ...(sections ? { sections } : {})
        },
        session: {
          ...state.session,
          phase
        },
        ...(projection ? { livingSpecProjection: projection } : {})
      };
    }
    case "AmbiguityAnalyzed": {
      const issues = Array.isArray(event.payload.issues)
        ? (event.payload.issues as readonly AmbiguityIssueSnapshot[])
        : state.openIssues;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: issues
      };
    }
    case "QuestionBatchActivated": {
      const projection = projectionPayload(event.payload, state.queueProjection);
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        queueProjection: projection
      };
    }
    case "AnswerSubmitted": {
      const projection = projectionPayload(event.payload, state.queueProjection);
      const queueItemId = typeof event.payload.queueItemId === "string" ? event.payload.queueItemId : null;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? state.openIssues.map((issue) =>
              issue.queueItemId === queueItemId
                ? {
                    ...issue,
                    status: "answered" as const
                  }
                : issue
            )
          : state.openIssues,
        queueProjection: projection
      };
    }
    case "QueueItemDeferred": {
      const queueItemId = typeof event.payload.queueItemId === "string" ? (event.payload.queueItemId as QueueItemId) : null;
      const projection = projectionPayload(event.payload, state.queueProjection);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? issuesWithQueueItemStatus(state.openIssues, queueItemId, "deferred")
          : state.openIssues,
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "QueueItemDismissed": {
      const queueItemId = typeof event.payload.queueItemId === "string" ? (event.payload.queueItemId as QueueItemId) : null;
      const projection = projectionPayload(event.payload, state.queueProjection);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        openIssues: queueItemId
          ? issuesWithQueueItemStatus(state.openIssues, queueItemId, "resolved")
          : state.openIssues,
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "SpecUpdatePreviewCreated": {
      const projection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const decision = objectPayload<ProductEngineStateSnapshot["decisions"][number]>(event.payload, "decision");
      const specUpdatePreview = objectPayload<SpecUpdatePreviewSnapshot>(event.payload, "specUpdatePreview");
      const decisions =
        decision && isRequiredDecisionRef(decision.requiredDecisionRef)
          ? mergeDecision(state.decisions, decision)
          : state.decisions;
      const specUpdatePreviews = specUpdatePreview
        ? mergeSpecUpdatePreview(state.specUpdatePreviews ?? [], specUpdatePreview)
        : state.specUpdatePreviews;
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            decisions,
            queueProjection: projection
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        decisions,
        ...(specUpdatePreviews ? { specUpdatePreviews } : {}),
        queueProjection: projection,
        completeness: confidenceProjection
      };
    }
    case "DecisionResolved": {
      const decisionId = typeof event.payload.decisionId === "string" ? (event.payload.decisionId as DecisionId) : null;
      const outcome = isDecisionResolutionStatus(event.payload.outcome) ? event.payload.outcome : null;
      const requiredDecisionRef = isRequiredDecisionRef(event.payload.requiredDecisionRef)
        ? event.payload.requiredDecisionRef
        : null;
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const decisions =
        decisionId && outcome && requiredDecisionRef
          ? state.decisions.some((decision) => decision.decisionId === decisionId)
            ? state.decisions.map((decision) =>
                decision.decisionId === decisionId
                  ? {
                      ...decision,
                      status: outcome
                    }
                  : decision
              )
            : [
                ...state.decisions,
                {
                  decisionId,
                  requiredDecisionRef,
                  status: outcome
                }
              ]
          : state.decisions;
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            decisions,
            queueProjection
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        decisions,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "SpecVersionCreated": {
      const projection = projectionPayload<LivingSpecProjection | undefined>(
        event.payload,
        state.livingSpecProjection
      );
      const title =
        typeof event.payload.title === "string"
          ? event.payload.title
          : projection?.title ?? state.currentSpec.title;
      const sections = Array.isArray(event.payload.sections)
        ? event.payload.sections.map(String)
        : projection?.sections ?? state.currentSpec.sections;
      const versionRef =
        typeof event.payload.versionRef === "string" ? event.payload.versionRef : state.currentSpec.versionRef;
      const currentSpec = {
        ...state.currentSpec,
        ...(versionRef ? { versionRef } : {}),
        ...(title ? { title } : {}),
        ...(sections ? { sections } : {})
      };
      const confidenceProjection =
        confidenceProjectionPayload(event.payload) ??
        buildConfidenceCompletionProjection(
          {
            ...state,
            currentSpec,
            ...(projection ? { livingSpecProjection: projection } : {})
          },
          Number(nextStateVersion) as ProjectionVersion
        );

      return {
        ...state,
        stateVersion: nextStateVersion,
        currentSpec,
        ...(projection ? { livingSpecProjection: projection } : {}),
        completeness: confidenceProjection
      };
    }
    case "ResearchPlanned": {
      const projection = projectionPayload(event.payload, state.researchState);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        researchState: projection,
        completeness: confidenceProjection
      };
    }
    case "ResearchResultImported":
      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: projectionPayload(event.payload, state.researchState)
      };
    case "EvidenceSynthesisRequested":
      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase: sessionPhaseForProductEngineEvent(event) ?? state.session.phase
        }
      };
    case "EvidenceSynthesized": {
      const researchProjection = projectionPayload(event.payload, state.researchState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: researchProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "RuntimePreviewRequested": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "RuntimeArtifactConverted": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection,
        completeness: confidenceProjection
      };
    }
    case "CompletenessScored": {
      const completeness = projectionPayload(event.payload, state.completeness);
      const queueProjection = queueProjectionPayload(event.payload) ?? state.queueProjection;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        completeness,
        queueProjection
      };
    }
    case "FounderBriefPrepared": {
      const founderBrief = projectionPayload(event.payload, state.founderBrief);
      const confidenceProjection = confidenceProjectionPayload(event.payload) ?? state.completeness;
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        completeness: confidenceProjection,
        ...(founderBrief ? { founderBrief: founderBrief as FounderBriefProjection } : {})
      };
    }
    default:
      return {
        ...state,
        stateVersion: nextStateVersion
      };
  }
}

export function replayProductEngineEvents(
  projectId: ProjectId,
  sessionId: SessionId,
  events: readonly ProductEngineEvent[]
): ProductEngineStateSnapshot {
  return events.reduce(
    (state, event) => applyEvent(state, event),
    createInitialProductEngineState(projectId, sessionId)
  );
}
