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
  type DecisionQueueProjection,
  type EvidenceMatrixProjection,
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
  type StateVersion
} from "@solo-superman/contracts";
import {
  addImportedResearchResultToProjection,
  addResearchResultToProjection,
  addResearchTaskToProjection,
  emptyResearchEvidenceProjection,
  importResearchResult,
  planResearchTask,
  synthesizeEvidenceMatrix
} from "../research-engine";

export const PACKAGE_SLICE_STATUS = "product-engine-runtime-preview-pr-07" as const;

type PrivacyMode = "local_only" | "local_with_manual_export";

const EMPTY_RESEARCH_PROJECTION: ResearchEvidenceProjection = emptyResearchEvidenceProjection();

const EMPTY_RUNTIME_PROJECTION: RuntimeActivityProjection = {
  kind: "RuntimeActivityProjection",
  version: 0 as ProjectionVersion,
  effects: [],
  runtimeArtifacts: [],
  runtimeStatus: "scaffold_placeholder"
};

function reject(message: string, code: ProductEngineRejectionCode = "COMMAND_PRECONDITION_FAILED"): ProductEngineReduction {
  return {
    accepted: false,
    rejectionReason: { code, message },
    events: [],
    nextState: {},
    effectPlan: [],
    deterministicOutputs: []
  };
}

function isPrivacyMode(value: unknown): value is PrivacyMode {
  return value === "local_only" || value === "local_with_manual_export";
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
    runtimeState: EMPTY_RUNTIME_PROJECTION,
    completeness: {
      kind: "ConfidenceCompletionProjection",
      sessionId,
      version: 0 as ProjectionVersion,
      compositeScore: 0,
      topRisks: []
    }
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
  sections: readonly string[]
) {
  return {
    kind: "LivingSpecProjection",
    sessionId: command.sessionId,
    version,
    title,
    sections,
    sectionCount: sections.length,
    approvalStatus: "draft"
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
  const item = runtimePreviewQueueItem(artifact);
  const withoutExisting = (items: DecisionQueueProjection["next"]) =>
    items.filter((candidate) => candidate.queueItemId !== item.queueItemId);

  return {
    ...projection,
    version,
    next: item.state === "next" ? [...withoutExisting(projection.next), item] : withoutExisting(projection.next),
    blocked:
      item.state === "blocked" ? [...withoutExisting(projection.blocked), item] : withoutExisting(projection.blocked)
  };
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
  const item = researchReviewQueueItem(researchTaskId, title, state);
  const withoutExisting = (items: DecisionQueueProjection["next"]) =>
    items.filter((candidate) => candidate.queueItemId !== item.queueItemId);

  return {
    ...projection,
    version,
    next: state === "next" ? [...withoutExisting(projection.next), item] : withoutExisting(projection.next),
    blocked:
      state === "blocked" ? [...withoutExisting(projection.blocked), item] : withoutExisting(projection.blocked)
  };
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

  return acceptedMultiEventReduction(
    command,
    state,
    [event, researchEvent],
    {
      openIssues: state.openIssues.map((issue) =>
        issue.queueItemId === queueItemId
          ? {
              ...issue,
              status: "answered" as const
            }
          : issue
      ),
      queueProjection,
      researchState: researchProjection,
      session: {
        ...state.session,
        phase: "research"
      }
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
  const event = eventDraft(command, "EvidenceSynthesized", {
    researchTaskId: researchTask.researchTaskId,
    researchResultId,
    evidenceMatrix,
    projection: researchProjection,
    queueProjection,
    confidenceProjection: {
      ...state.completeness,
      version: researchProjection.version,
      topRisks: researchProjection.knownRisks
    }
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      researchState: researchProjection,
      queueProjection,
      completeness: {
        ...state.completeness,
        version: researchProjection.version,
        topRisks: researchProjection.knownRisks
      }
    },
    [
      {
        outputType: "reducer_deterministic_output",
        outputRef: evidenceMatrix.evidenceMatrixId,
        payload: {
          balanceStatus: evidenceMatrix.balanceStatus,
          decisionBlocked: evidenceMatrix.decisionBlocked
        }
      }
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
  const event = eventDraft(command, "RuntimePreviewRequested", {
    turnPurpose,
    contextHash,
    runtimeArtifact: artifactOrRejection,
    projection: runtimeProjection,
    queueProjection
  });

  return acceptedReduction(
    command,
    state,
    event,
    {
      runtimeState: runtimeProjection,
      queueProjection
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
      }
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
  const requestsBlockedTarget = target === "blocked_action" || Boolean(requiredString(command.payload.blockReason));
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
    const event = eventDraft(command, "RuntimeArtifactConverted", {
      artifactId: artifactRef,
      conversionStatus: "blocked",
      blockReason:
        blockedArtifact.blockedAction?.reason ??
        requiredString(command.payload.blockReason) ??
        "Blocked runtime artifact cannot be converted into execution.",
      runtimeArtifact: blockedArtifact,
      projection: runtimeProjection,
      queueProjection
    });

    return acceptedReduction(
      command,
      state,
      event,
      {
        runtimeState: runtimeProjection,
        queueProjection
      },
      [
        {
          outputType: "reducer_deterministic_output",
          outputRef: artifactRef,
          payload: {
            conversionStatus: "blocked"
          }
        }
      ],
      [],
      runtimeProjection
    );
  }

  const event = eventDraft(command, "RuntimeArtifactConverted", {
    artifactId: artifactRef,
    conversionStatus: "preview_only",
    target: requiredString(command.payload.target) ?? artifact.targetObject
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
          target: target ?? artifact.targetObject
        }
      }
    ]
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
    default:
      return reject(`${command.commandType} is outside the mounted PR-07 reducer slice.`);
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
    case "ResearchPlanned": {
      const projection = projectionPayload(event.payload, state.researchState);
      const phase = sessionPhaseForProductEngineEvent(event) ?? state.session.phase;

      return {
        ...state,
        stateVersion: nextStateVersion,
        session: {
          ...state.session,
          phase
        },
        researchState: projection
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
      const queueProjection =
        typeof event.payload.queueProjection === "object" && event.payload.queueProjection !== null
          ? (event.payload.queueProjection as DecisionQueueProjection)
          : state.queueProjection;

      return {
        ...state,
        stateVersion: nextStateVersion,
        researchState: researchProjection,
        queueProjection,
        completeness: {
          ...state.completeness,
          version: researchProjection.version,
          topRisks: researchProjection.knownRisks
        }
      };
    }
    case "RuntimePreviewRequested": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection =
        typeof event.payload.queueProjection === "object" && event.payload.queueProjection !== null
          ? (event.payload.queueProjection as DecisionQueueProjection)
          : state.queueProjection;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection
      };
    }
    case "RuntimeArtifactConverted": {
      const runtimeProjection = projectionPayload(event.payload, state.runtimeState);
      const queueProjection =
        typeof event.payload.queueProjection === "object" && event.payload.queueProjection !== null
          ? (event.payload.queueProjection as DecisionQueueProjection)
          : state.queueProjection;

      return {
        ...state,
        stateVersion: nextStateVersion,
        runtimeState: runtimeProjection,
        queueProjection
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
